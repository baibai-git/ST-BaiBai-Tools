import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'espree';

// Exercise the real modules with isolated ST imports, without a browser, server,
// real chats, or paid generation requests.
async function loadModule(file, context, mocks) {
    const code = await readFile(new URL(`../src/features/${file}`, import.meta.url), 'utf8');
    const imports = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body
        .filter(node => node.type === 'ImportDeclaration');
    const dependencies = new Map();
    const module = new vm.SourceTextModule(code, {
        context,
        identifier: file,
        initializeImportMeta: meta => { meta.url = new URL(`../src/features/${file}`, import.meta.url).href; },
    });
    await module.link(source => {
        if (!dependencies.has(source)) {
            const values = mocks[source] || {};
            const names = new Set(Object.keys(values));
            for (const entry of imports.filter(entry => entry.source.value === source)) {
                for (const specifier of entry.specifiers) {
                    if (specifier.type === 'ImportSpecifier') names.add(specifier.imported.name);
                    if (specifier.type === 'ImportDefaultSpecifier') names.add('default');
                }
            }
            dependencies.set(source, new vm.SyntheticModule([...names], function () {
                for (const name of names) this.setExport(name, values[name]);
            }, { context }));
        }
        return dependencies.get(source);
    });
    await module.evaluate();
    return { exports: module.namespace, dependencies };
}

function deferred() {
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

async function harness(options = {}) {
    const events = ['GENERATION_STARTED', 'GENERATION_AFTER_COMMANDS', 'CHARACTER_MESSAGE_RENDERED',
        'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED',
        'MESSAGE_DELETED', 'CHAT_COMPLETION_SETTINGS_READY', 'GENERATE_AFTER_DATA'];
    const event_types = Object.fromEntries(events.map(event => [event, event]));
    const listeners = new Map();
    const eventSource = {
        on(event, listener) {
            listeners.set(event, [...(listeners.get(event) || []), listener]);
        },
        async emit(event, ...args) {
            for (const listener of [...(listeners.get(event) || [])]) await listener(...args);
        },
    };
    const settings = {
        generateBlacklistRetryEnabled: true,
        generateBlacklistRetryText: 'blocked\n\u62b1\u6b49',
        generateRetryEnabled: true,
        generateRetryMaxRetries: 3,
        ...options.settings,
    };
    const extensionState = {};
    const notices = [];
    const saves = [];
    const calls = [];
    const deletions = [];
    const errors = [];
    const scriptModules = [];
    const timers = new Map();
    const responses = [...(options.responses || ['accepted'])];
    const apiResponses = [...(options.apiResponses || [])];
    const apiRequests = [];
    let now = 0;
    let serial = 0;
    let script;
    let context;
    const setFlag = (name, value) => {
        script[name] = value;
        for (const module of scriptModules) module.setExport(name, value);
    };
    const st = {
        chat: options.chat || [{ is_user: true, mes: 'prompt' }],
        characterId: 0,
        chatId: 'test-chat',
        groupId: null,
        chatMetadata: { integrity: 'test' },
        characters: [{ name: 'Test', avatar: 'test.png' }],
        powerUserSettings: {},
        streamingProcessor: null,
        getCurrentChatId: () => st.chatId,
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
        deactivateSendButtons() {},
        activateSendButtons() {
            setFlag('is_send_press', false);
            void eventSource.emit(event_types.GENERATION_ENDED);
        },
        addOneMessage() {},
        async deleteLastMessage() {
            deletions.push(st.chat.pop());
            await eventSource.emit(event_types.MESSAGE_DELETED, st.chat.length);
        },
        async generate(type, args) {
            calls.push({ type, args, prompt: null });
            await begin(type, args);
            if (st.chat.length && !st.chat.at(-1).is_user) await st.deleteLastMessage();
            calls.at(-1).prompt = st.chat.map(message => message.mes);
            const response = options.apiResponses ? await requestReply(type) : responses.shift() ?? 'accepted';
            if (response instanceof Error) {
                setFlag('is_send_press', false);
                await eventSource.emit(event_types.GENERATION_ENDED);
                throw response;
            }
            await finish(response, { streaming: options.streamingRetries });
        },
    };
    script = {
        event_types,
        eventSource,
        getContext: () => st,
        setSendButtonState: value => setFlag('is_send_press', value),
        is_send_press: false,
        isChatSaving: false,
    };
    const constants = {
        LOG_PREFIX: '[test]',
        GENERATE_RETRY_BASE_DELAY_MS: 1500,
        GENERATE_RETRY_DEFAULT_RETRIES: 3,
        GENERATE_RETRY_MIN_RETRIES: 1,
        GENERATE_RETRY_MAX_RETRIES: 10,
        GENERATE_RETRY_MAX_DELAY_MS: 15_000,
        GENERATE_RETRY_BODY_TTL_MS: 60_000,
        GENERATE_RETRY_WINDOW_TTL_MS: 60_000,
        GENERATE_RETRY_MAX_PENDING_BODIES: 4,
        GENERATE_RETRY_MESSAGE_TYPES: new Set(['normal', 'regenerate', 'swipe', 'continue', 'impersonate']),
        GENERATE_RETRY_PATHS: new Set(['/api/backends/chat-completions/generate']),
        GENERATE_RETRY_FETCH_KEY: '__requestRetry',
        GENERATE_RETRY_PERMANENT_STATUSES: new Set([400, 401, 403, 404, 413, 422, 499]),
        GENERATE_RETRY_REASON_MAX_LENGTH: 60,
        BAIBAOKU_SAVE_GENERATE_URL: '/save-generate',
    };
    context = vm.createContext({
        Date: class extends Date { static now() { return now; } },
        setTimeout(fn, delay) {
            timers.set(++serial, { fn, at: now + delay });
            return serial;
        },
        clearTimeout: id => timers.delete(id),
        console: { debug() {}, warn() {}, error() {} },
        AbortController, AbortSignal, Response, Request, Headers, URL,
        location: new URL('http://localhost/'),
        toastr: Object.fromEntries(['warning', 'error'].map(level => [level, (...args) => notices.push({ level, args })])),
        fetch: async (url, init) => {
            if (options.fetch) return options.fetch(url, init);
            if (url === '/api/backends/chat-completions/generate') {
                apiRequests.push(JSON.parse(init.body));
                assert.ok(apiResponses.length, 'generation exceeded the supplied response sequence');
                const result = apiResponses.shift();
                if (result instanceof Error) throw result;
                const payload = typeof result === 'string'
                    ? { choices: [{ message: { content: result } }] }
                    : typeof result === 'number' ? { error: 'temporary failure' } : result;
                return new Response(JSON.stringify(payload), {
                    status: typeof result === 'number' ? result : 200,
                    headers: { 'content-type': 'application/json' },
                });
            }
            assert.equal(url, '/api/chats/save');
            saves.push(JSON.parse(init.body));
            return { ok: !options.saveFails, status: options.saveFails ? 500 : 200 };
        },
    });
    const retry = await loadModule('generateRetry.js', context, {
        '@sillytavern/script': script,
        './constants.js': constants,
        './state.js': { settings, extensionState },
        './gzipHook.js': {
            getFetchRequestMethod: (input, init) => init?.method || 'GET',
            getFetchRequestUrl: input => String(input),
            isFetchRequest: input => input instanceof Request,
        },
        './util.js': { parseJsonOrNull: text => { try { return JSON.parse(text); } catch { return null; } } },
    });
    scriptModules.push(retry.dependencies.get('@sillytavern/script'));
    retry.exports.installGenerateRetryFetchHook();
    const feature = await loadModule('generateBlacklistRetry.js', context, {
        '@sillytavern/script': script,
        '@sillytavern/scripts/utils': { waitUntilCondition: options.waitSave || (async condition => assert.ok(condition())) },
        './constants.js': constants,
        './state.js': { settings, extensionState },
        './generateRetry.js': retry.exports,
        './saveGenerate.js': {
            discardSaveGenerateJobsBeforeRetry: options.prepareCleanup || (async () => {}),
            waitForSaveGenerateMessageDelete: options.waitCleanup || (async () => {}),
        },
    });
    scriptModules.push(feature.dependencies.get('@sillytavern/script'));
    feature.exports.installGenerateBlacklistRetry();

    async function begin(type = 'normal', args = {}, dryRun = false) {
        await eventSource.emit(event_types.GENERATION_STARTED, type, args, dryRun);
        await eventSource.emit(event_types.GENERATION_AFTER_COMMANDS, type, args, dryRun);
        if (!dryRun) setFlag('is_send_press', true);
    }
    async function requestReply(type = 'normal', signal = new AbortController().signal) {
        try {
            const body = { type, stream: false, messages: st.chat.map(message => ({ content: message.mes })) };
            await eventSource.emit(event_types.CHAT_COMPLETION_SETTINGS_READY, body);
            const response = await context.fetch('/api/backends/chat-completions/generate', {
                method: 'POST', body: JSON.stringify(body), signal,
            });
            const data = await response.json();
            if (!response.ok || data.error) throw new Error(`Generation failed: HTTP ${response.status}`);
            return data.choices[0].message.content;
        } catch (error) {
            setFlag('is_send_press', false);
            await eventSource.emit(event_types.GENERATION_ENDED);
            throw error;
        }
    }
    async function finish(text, { streaming = false, holdSave = false, reasoning = '' } = {}) {
        st.chat.push({ is_user: false, mes: text, swipe_id: 0, extra: { reasoning } });
        if (streaming) {
            st.streamingProcessor = { isFinished: true, isStopped: false, abortController: new AbortController() };
            setFlag('is_send_press', false);
            await eventSource.emit(event_types.GENERATION_ENDED);
        }
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, st.chat.length - 1, 'normal');
        setFlag('isChatSaving', holdSave);
        if (!streaming) {
            setFlag('is_send_press', false);
            await eventSource.emit(event_types.GENERATION_ENDED);
        }
        if (!holdSave) st.streamingProcessor = null;
    }
    async function advance(ms) {
        const target = now + ms;
        let steps = 0;
        while (true) {
            const next = [...timers.entries()].filter(([, timer]) => timer.at <= target)
                .sort((a, b) => a[1].at - b[1].at)[0];
            if (!next) break;
            assert.ok(++steps < 1000, 'timer loop did not settle');
            now = next[1].at;
            timers.delete(next[0]);
            try {
                const result = next[1].fn();
                if (result?.catch) result.catch(error => errors.push(error));
            } catch (error) { errors.push(error); }
            await setImmediate();
        }
        now = target;
        await setImmediate();
        assert.deepEqual(errors, []);
    }
    return { st, settings, feature: feature.exports, retry: retry.exports, begin, finish, advance,
        eventSource, event_types, calls, saves, deletions, notices, setFlag, context, timers, apiRequests, requestReply,
        get run() { return extensionState.generateBlacklistRetry.run; } };
}

test('literal lines: Chinese, case folding, CRLF, blank lines and regex characters', async () => {
    const h = await harness();
    const entries = h.feature.parseGenerateBlacklist(' \u62b1\u6b49 \r\n\r\n.*\nI CANNOT\n\u62b1\u6b49\n');
    assert.deepEqual([...entries], ['\u62b1\u6b49', '.*', 'I CANNOT']);
    assert.equal(h.feature.findGenerateBlacklistMatch('\u975e\u5e38\u62b1\u6b49', entries), '\u62b1\u6b49');
    assert.equal(h.feature.findGenerateBlacklistMatch('i cannot help', entries), 'I CANNOT');
    assert.equal(h.feature.findGenerateBlacklistMatch('normal text', entries), '');
    assert.equal(h.feature.findGenerateBlacklistMatch('literal .* pattern', entries), '.*');
});

test('blacklist input follows the saved toggle and preserves its text when hidden', async () => {
    for (const enabled of [false, true]) {
        const h = await harness({ settings: { generateBlacklistRetryEnabled: enabled } });
        const elements = new Map();
        h.context.$ = selector => {
            if (typeof selector !== 'string') return selector;
            if (!elements.has(selector)) elements.set(selector, {
                handlers: new Map(),
                prop(key, value) {
                    if (arguments.length === 1) return this[key];
                    this[key] = value;
                    return this;
                },
                val(...args) { return this.prop('value', ...args); },
                toggle(visible) { this.visible = visible; return this; },
                off(event) { this.handlers.delete(event); return this; },
                on(event, handler) { this.handlers.set(event, handler); return this; },
                input() { for (const handler of this.handlers.values()) handler.call(this); },
            });
            return elements.get(selector);
        };
        let saved = 0;
        const bind = () => h.feature.bindGenerateBlacklistRetrySettings({ saveSettings: () => saved++ });
        bind();
        const toggle = elements.get('#bai_bai_toolkit_generate_blacklist_retry_enabled');
        const text = elements.get('#bai_bai_toolkit_generate_blacklist_retry_text');
        assert.equal(toggle.checked, enabled);
        assert.equal(text.visible, enabled);
        assert.equal(text.value, h.settings.generateBlacklistRetryText);
        assert.equal(saved, 0);
        for (const checked of [true, false, true]) {
            toggle.checked = checked;
            toggle.input();
            assert.equal(text.visible, checked);
            assert.equal(h.settings.generateBlacklistRetryEnabled, checked);
            assert.equal(text.value, h.settings.generateBlacklistRetryText);
        }
        assert.equal(saved, 3);
        text.value = 'edited blacklist';
        text.input();
        assert.equal(h.settings.generateBlacklistRetryText, 'edited blacklist');
        bind();
        toggle.checked = false;
        toggle.input();
        assert.equal(text.visible, false);
        assert.equal(text.value, 'edited blacklist');
        assert.equal(h.settings.generateBlacklistRetryText, 'edited blacklist');
        assert.equal(saved, 5);
    }
});

for (const streaming of [false, true]) {
    test(`retries a completed ${streaming ? 'streaming' : 'non-streaming'} reply, preserving its prompt`, async () => {
        const h = await harness({ streamingRetries: streaming });
        await h.begin();
        await h.finish('blocked response', { streaming });
        await h.advance(2000);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].type, 'regenerate');
        assert.deepEqual(h.calls[0].prompt, ['prompt']);
        assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'accepted']);
        assert.equal(h.run, null);
    });
}

test('does not discard the earlier assistant reply when no new user message exists', async () => {
    const prior = { is_user: false, mes: 'earlier valid reply' };
    const h = await harness({ chat: [{ is_user: true, mes: 'prompt' }, prior] });
    await h.begin();
    await h.finish('blocked response');
    await h.advance(2000);
    assert.equal(h.st.chat[1], prior);
    assert.deepEqual(h.calls[0].prompt, ['prompt', 'earlier valid reply']);
});

test('waits for stream and chat save to settle after the end event', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked response', { streaming: true, holdSave: true });
    await h.advance(5000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
    h.st.streamingProcessor = null;
    h.setFlag('isChatSaving', false);
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
});

test('enforces a finite chain and persists deletion of the last rejected reply', async () => {
    const h = await harness({ responses: ['blocked 1', 'blocked 2', 'blocked 3'] });
    await h.begin();
    await h.finish('blocked initial');
    await h.advance(10_000);
    assert.equal(h.calls.length, 3);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt']);
    assert.equal(h.saves.length, 1);
    assert.equal(h.saves[0].chat.length, 2);
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
});

test('does not scan old messages or the separate reasoning field', async () => {
    const h = await harness({ chat: [{ is_user: true, mes: 'blocked history' }] });
    await h.begin();
    await h.finish('accepted', { reasoning: 'blocked reasoning' });
    await h.advance(3000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.run, null);
});

test('handles an original regenerate operation', async () => {
    const h = await harness({ chat: [{ is_user: true, mes: 'prompt' }, { is_user: false, mes: 'old reply' }] });
    await h.begin('regenerate');
    await h.st.deleteLastMessage();
    await h.finish('blocked');
    await h.advance(3000);
    assert.equal(h.calls.length, 1);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'accepted']);
});

test('does not mistake a second rendered message for the native reply', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('accepted native reply');
    await h.finish('blocked message from another source');
    await h.advance(3000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
});

for (const mode of ['disabled', 'empty', 'group', 'quiet', 'continue', 'swipe', 'impersonate', 'dry-run', 'native-auto-swipe']) {
    test(`skips ${mode}`, async () => {
        const h = await harness();
        if (mode === 'disabled') h.settings.generateBlacklistRetryEnabled = false;
        if (mode === 'empty') h.settings.generateBlacklistRetryText = ' \n';
        if (mode === 'group') h.st.groupId = 'group';
        if (mode === 'native-auto-swipe') h.st.powerUserSettings.auto_swipe = true;
        const type = ['quiet', 'continue', 'swipe', 'impersonate'].includes(mode) ? mode : 'normal';
        await h.begin(type, {}, mode === 'dry-run');
        await h.finish('blocked');
        await h.advance(5000);
        assert.equal(h.calls.length, 0);
        assert.equal(h.deletions.length, 0);
    });
}

for (const action of ['stop', 'switch-chat', 'disable', 'edit', 'append', 'new-generation']) {
    test(`cancels pending retries on ${action}`, async () => {
        const h = await harness();
        await h.begin();
        await h.finish('blocked');
        await h.advance(100);
        if (action === 'stop') await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
        if (action === 'switch-chat') {
            h.st.chat = [{ is_user: true, mes: 'other chat' }];
            h.st.chatId = 'other';
            await h.eventSource.emit(h.event_types.CHAT_CHANGED);
        }
        if (action === 'disable') h.settings.generateBlacklistRetryEnabled = false;
        if (action === 'edit') h.st.chat.at(-1).mes = 'manually edited';
        if (action === 'append') h.st.chat.push({ is_user: true, mes: 'new prompt' });
        if (action === 'new-generation') await h.begin('continue');
        await h.advance(5000);
        assert.equal(h.calls.length, 0);
        assert.equal(h.deletions.length, 0);
    });
}

test('aborted streaming output is not treated as a completed reply', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked', { streaming: true, holdSave: true });
    h.st.streamingProcessor.abortController.abort();
    h.setFlag('isChatSaving', false);
    h.st.streamingProcessor = null;
    await h.advance(5000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
});

test('waits for background discard and rechecks chat identity afterwards', async () => {
    const gate = deferred();
    const h = await harness({ prepareCleanup: () => gate.promise });
    await h.begin();
    await h.finish('blocked');
    await h.advance(2000);
    assert.equal(h.calls.length, 0);
    h.st.chat = [{ is_user: true, mes: 'other' }];
    h.st.chatId = 'other';
    await h.eventSource.emit(h.event_types.CHAT_CHANGED);
    gate.resolve();
    await setImmediate();
    await h.advance(5000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
    assert.equal(h.saves.length, 0);
});

test('background discard failure stops without deleting the visible reply', async () => {
    const h = await harness({ prepareCleanup: async () => { throw new Error('offline'); } });
    await h.begin();
    await h.finish('blocked');
    await h.advance(5000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
    assert.equal(h.st.chat.at(-1).mes, 'blocked');
    assert.equal(h.run, null);
    assert.ok(h.notices.some(notice => notice.level === 'error'));
});

test('failed final deletion save restores the reply instead of hiding an unsaved change', async () => {
    const h = await harness({ settings: { generateRetryMaxRetries: 1 }, responses: ['blocked again'], saveFails: true });
    await h.begin();
    await h.finish('blocked');
    await h.advance(5000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.st.chat.at(-1).mes, 'blocked again');
    assert.equal(h.run, null);
    assert.ok(h.notices.some(notice => notice.level === 'error'));
});

test('a delayed save never writes the old chat contents into a newly opened chat', async () => {
    const gate = deferred();
    let h;
    h = await harness({
        settings: { generateRetryMaxRetries: 1 },
        responses: ['blocked again'],
        waitCleanup: async () => { h.setFlag('isChatSaving', true); },
        waitSave: () => gate.promise,
    });
    await h.begin();
    await h.finish('blocked');
    await h.advance(3000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.saves.length, 0);
    h.st.chat = [{ is_user: true, mes: 'other' }];
    h.st.chatId = 'other';
    await h.eventSource.emit(h.event_types.CHAT_CHANGED);
    h.setFlag('isChatSaving', false);
    gate.resolve();
    await setImmediate();
    assert.equal(h.saves.length, 0);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['other']);
});

test('failed regeneration persists removal without deleting an earlier valid message', async () => {
    const h = await harness({ responses: [new Error('network')] });
    await h.begin();
    await h.finish('blocked');
    await h.advance(5000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.st.chat.length, 1);
    assert.equal(h.saves.length, 1);
});

test('install is idempotent', async () => {
    const h = await harness();
    h.feature.installGenerateBlacklistRetry();
    await h.begin();
    await h.finish('blocked');
    await h.advance(5000);
    assert.equal(h.calls.length, 1);
});

test('the existing request retry still replays only claimed generation requests', async () => {
    let attempts = 0;
    const h = await harness({ fetch: async () => {
        attempts += 1;
        return new Response(JSON.stringify(attempts === 1 ? { error: 'temporary' } : { choices: [] }), {
            status: attempts === 1 ? 503 : 200, headers: { 'content-type': 'application/json' },
        });
    } });
    h.retry.installGenerateRetryFetchHook();
    await h.begin();
    const body = { type: 'normal', stream: false, messages: [] };
    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
    const response = h.context.fetch('/api/backends/chat-completions/generate', { method: 'POST', body: JSON.stringify(body) });
    await setImmediate();
    await h.advance(2000);
    assert.equal((await response).status, 200);
    assert.equal(attempts, 2);
});

for (const streaming of [false, true]) {
    test(`network, blacklist, network retries share one limit (${streaming ? 'streaming' : 'non-streaming'} completion)`, async () => {
        const h = await harness({
            apiResponses: [503, 'blocked', 429, 'accepted'],
            streamingRetries: streaming,
        });
        await h.begin();
        const run = h.run;
        const initial = h.requestReply().then(text => h.finish(text, { streaming }));
        await setImmediate();
        await h.advance(30_000);
        await initial;
        assert.equal(h.apiRequests.length, 4);
        assert.equal(h.calls.length, 1);
        assert.equal(run.retries, 3);
        assert.equal(h.st.chat.at(-1).mes, 'accepted');
        assert.equal(h.run, null);
        const retryNotices = h.notices.map(notice => notice.args[0]);
        for (const count of ['1/3', '2/3', '3/3']) {
            assert.equal(retryNotices.filter(message => message.includes(count)).length, 1);
        }
    });
}

test('blacklist, network, blacklist exhaustion discards the final hit without granting another request', async () => {
    const h = await harness({ apiResponses: ['blocked initial', 503, 'blocked again', 'blocked final'] });
    await h.begin();
    const run = h.run;
    await h.finish(await h.requestReply());
    await h.advance(30_000);
    assert.equal(h.apiRequests.length, 4);
    assert.equal(h.calls.length, 2);
    assert.equal(run.retries, 3);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt']);
    assert.equal(h.saves.length, 1);
    assert.equal(h.run, null);
});

for (const failure of [503, new TypeError('network offline'), { error: 'upstream failure' }]) {
    test(`request failures can use up the entire allowance before the first blacklist match (${typeof failure})`, async () => {
        const h = await harness({
            settings: { generateRetryMaxRetries: 2 },
            apiResponses: [failure, failure, 'blocked'],
        });
        await h.begin();
        const run = h.run;
        const initial = h.requestReply().then(text => h.finish(text));
        await setImmediate();
        await h.advance(30_000);
        await initial;
        assert.equal(run.retries, 2);
        assert.equal(h.apiRequests.length, 3);
        assert.equal(h.calls.length, 0);
        assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt']);
    });
}

test('a failed request after a blacklist retry receives only the remaining allowance', async () => {
    const h = await harness({
        settings: { generateRetryMaxRetries: 2 },
        apiResponses: ['blocked', 503, 503],
    });
    await h.begin();
    const run = h.run;
    await h.finish(await h.requestReply());
    await h.advance(30_000);
    assert.equal(h.apiRequests.length, 3);
    assert.equal(h.calls.length, 1);
    assert.equal(run.retries, 2);
    assert.equal(h.saves.length, 1);
    assert.equal(h.run, null);
});

test('a manually started new generation receives a fresh total allowance', async () => {
    const h = await harness({ apiResponses: [503, 'blocked', 429, 'accepted', 503, 503, 503, 'accepted again'] });
    await h.begin();
    const firstRun = h.run;
    let initial = h.requestReply().then(text => h.finish(text));
    await setImmediate();
    await h.advance(30_000);
    await initial;
    assert.equal(firstRun.retries, 3);

    h.st.chat.push({ is_user: true, mes: 'next prompt' });
    await h.begin();
    const nextRun = h.run;
    assert.notEqual(nextRun, firstRun);
    assert.equal(nextRun.retries, 0);
    initial = h.requestReply().then(text => h.finish(text));
    await setImmediate();
    await h.advance(30_000);
    await initial;
    assert.equal(nextRun.retries, 3);
    assert.equal(h.apiRequests.length, 8);
    assert.equal(h.st.chat.at(-1).mes, 'accepted again');
});

test('canceling a pending network retry does not spend its reserved-looking notice count', async () => {
    const h = await harness({ apiResponses: [503] });
    const controller = new AbortController();
    await h.begin();
    const run = h.run;
    const request = h.requestReply('normal', controller.signal);
    const rejected = assert.rejects(request);
    await setImmediate();
    controller.abort();
    await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
    await h.advance(5000);
    await rejected;
    assert.equal(run.retries, 0);
    assert.equal(h.apiRequests.length, 1);
});

test('blacklist retries use the common maximum even with request retries disabled', async () => {
    const h = await harness({
        settings: { generateRetryEnabled: false, generateRetryMaxRetries: 1 },
        apiResponses: ['blocked', 'blocked again'],
    });
    await h.begin();
    const run = h.run;
    await h.finish(await h.requestReply());
    await h.advance(5000);
    assert.equal(run.retries, 1);
    assert.equal(h.apiRequests.length, 2);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt']);
});

test('request-only retries are still bounded when blacklist detection is disabled', async () => {
    const h = await harness({
        settings: { generateBlacklistRetryEnabled: false, generateRetryMaxRetries: 1 },
        apiResponses: [503, 503],
    });
    await h.begin();
    const rejected = assert.rejects(h.requestReply());
    await setImmediate();
    await h.advance(5000);
    await rejected;
    assert.equal(h.apiRequests.length, 2);
    assert.equal(h.calls.length, 0);
});

test('legacy blacklist maximum is removed while the common maximum is preserved', async () => {
    const persisted = { generateRetryMaxRetries: 2, generateBlacklistRetryMaxRetries: 9 };
    const context = vm.createContext({ URL });
    const { exports: state } = await loadModule('state.js', context, {
        '@sillytavern/script': { saveSettingsDebounced() {} },
        '@sillytavern/scripts/extensions': { extension_settings: { toolkit: persisted } },
        './constants.js': {
            SETTINGS_KEY: 'toolkit', EXTENSION_KEY: '__extension',
            SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY: 'saveGenerateMigrated',
        },
    });
    state.initializeSettings();
    state.saveExtensionSettings();
    assert.equal(state.settings.generateRetryMaxRetries, 2);
    assert.equal(persisted.generateRetryMaxRetries, 2);
    assert.equal('generateBlacklistRetryMaxRetries' in state.settings, false);
    assert.equal('generateBlacklistRetryMaxRetries' in persisted, false);
});

test('background deletion handler is awaited and strict cleanup reports failures', async () => {
    const gate = deferred();
    const handlers = new Map();
    const state = {
        originalFetch: () => gate.promise,
        backendAvailable: true,
        pendingJobs: [],
        recoveryLocks: new Map(),
    };
    const context = vm.createContext({ Headers, AbortController, setTimeout, clearTimeout, console: { debug() {} }, __saveGenerate: state });
    const { exports: backend } = await loadModule('saveGenerate.js', context, {
        '@sillytavern/script': {
            eventSource: { on: (event, handler) => handlers.set(event, handler) },
            event_types: { MESSAGE_DELETED: 'deleted' },
            getCurrentChatId: () => 'test',
            getRequestHeaders: () => ({}),
        },
        '@sillytavern/scripts/group-chats': { selected_group: null },
        './constants.js': {
            SAVE_GENERATE_FETCH_KEY: '__saveGenerate',
            BAIBAOKU_SAVE_GENERATE_DISCARD_URL: '/discard',
            LOG_PREFIX: '[test]',
        },
    });
    backend.installSaveGenerateMessageDeleteHandler(state);
    let finished = false;
    const deletion = handlers.get('deleted')().then(() => { finished = true; });
    await setImmediate();
    assert.equal(finished, false);
    gate.resolve(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }));
    await deletion;
    await backend.waitForSaveGenerateMessageDelete('test');
    assert.equal(finished, true);
    state.originalFetch = async () => new Response('failed', { status: 500 });
    await assert.rejects(backend.discardSaveGenerateJobsBeforeRetry('test'), /cleanup failed/);
    await handlers.get('deleted')();
    await assert.rejects(backend.waitForSaveGenerateMessageDelete('test'), /cleanup failed/);

    let timeout;
    let cleared = false;
    context.setTimeout = callback => { timeout = callback; };
    context.clearTimeout = () => { cleared = true; };
    const timedOut = backend.discardSaveGenerateJobsForChat((url, { signal }) => new Promise((resolve, reject) => {
        signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }), 'test');
    timeout();
    await assert.rejects(timedOut, /aborted/);
    assert.equal(cleared, true);
});
