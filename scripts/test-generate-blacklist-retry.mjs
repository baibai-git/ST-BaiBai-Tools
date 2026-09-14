import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'espree';
import * as generateRequest from '../src/features/generateRequest.js';
import * as soundConstants from '../src/chat/constants.js';
const GENERATE_BLACKLIST_SETTLED_EVENT = 'bai_bai_toolkit_blacklist_settled';

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
        listenerCount(event) { return (listeners.get(event) || []).length; },
        removeListener(event, listener) {
            listeners.set(event, (listeners.get(event) || []).filter(entry => entry !== listener));
        },
        async emit(event, ...args) {
            for (const listener of [...(listeners.get(event) || [])]) await listener(...args);
        },
    };
    const settings = {
        messageCompletionSoundEnabled: false,
        messageCompletionSoundSource: 'url',
        messageCompletionSoundUrl: 'https://example.invalid/completion.mp3',
        messageCompletionSoundVolume: 0.5,
        generateBlacklistRetryEnabled: true,
        generateBlacklistRetryText: 'blocked\n\u62b1\u6b49',
        generateRetryEnabled: true,
        generateRetryMaxRetries: 3,
        ...options.settings,
    };
    const extensionState = {};
    const work = { contextReads: 0, timersScheduled: 0, timersFired: 0, maxPendingTimers: 0 };
    const soundPlays = [];
    class MockAudio {
        constructor(src = '') { this.src = src; this.currentTime = 0; this.paused = true; }
        pause() { this.paused = true; }
        load() {}
        setAttribute() {}
        removeAttribute(name) { if (name === 'src') this.src = ''; }
        async play() {
            this.paused = false;
            if (!this.loop) soundPlays.push({ src: this.src, at: now });
        }
    }
    const notices = [];
    const logEntries = [];
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
        // Real script.js does not export getContext; it belongs to extensions.js.
        setSendButtonState: value => setFlag('is_send_press', value),
        is_send_press: false,
        isChatSaving: false,
    };
    const constants = {
        GENERATE_BLACKLIST_SETTLED_EVENT,
        LOG_PREFIX: '[test]',
        CURRENT_VERSION: 'test',
        GENERATE_RETRY_BASE_DELAY_MS: 1500,
        GENERATE_RETRY_DEFAULT_RETRIES: 3,
        GENERATE_RETRY_MIN_RETRIES: 1,
        GENERATE_RETRY_MAX_RETRIES: 10,
        GENERATE_RETRY_MAX_DELAY_MS: 15_000,
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
            work.timersScheduled++;
            work.maxPendingTimers = Math.max(work.maxPendingTimers, timers.size);
            return serial;
        },
        clearTimeout: id => timers.delete(id),
        console: Object.fromEntries(['debug', 'log', 'info', 'warn', 'error'].map(level => [level, (...args) => logEntries.push({ level, args })])),
        Audio: MockAudio, HTMLAudioElement: MockAudio, document: new EventTarget(),
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
            return { ok: true, status: 200 };
        },
    });
    const retry = await loadModule('generateRetry.js', context, {
        '@sillytavern/script': script,
        './generateRequest.js': generateRequest,
        './constants.js': constants,
        './state.js': { settings, extensionState },
        './gzipHook.js': {
            getFetchRequestMethod: (input, init) => init?.method || 'GET',
            getFetchRequestUrl: input => String(input),
            isFetchRequest: input => input instanceof Request,
        },
        './util.js': { readFetchJsonBody: async (input, init) => {
            try { return JSON.parse(init?.body ?? await input.clone().text()); } catch { return null; }
        } },
    });
    scriptModules.push(retry.dependencies.get('@sillytavern/script'));
    retry.exports.installGenerateRetryFetchHook();
    const feature = await loadModule('generateBlacklistRetry.js', context, {
        '@sillytavern/script': script,
        '@sillytavern/scripts/extensions': { getContext: () => { work.contextReads++; return st; } },
        './constants.js': constants,
        './state.js': { settings, extensionState },
        './generateRetry.js': retry.exports,
    });
    scriptModules.push(feature.dependencies.get('@sillytavern/script'));
    const sound = await loadModule('../chat/completionSound.js', context, {
        '@sillytavern/script': script,
        '@sillytavern/scripts/RossAscends-mods': { isMobile: () => Boolean(options.mobile) },
        '../features/constants.js': constants,
        './constants.js': soundConstants,
        './state.js': { settings, extensionState, LOG_PREFIX: '[test]' },
    });
    if (options.soundFirst) sound.exports.applyMessageCompletionSound();
    feature.exports.installGenerateBlacklistRetry();
    if (!options.soundFirst) sound.exports.applyMessageCompletionSound();

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
            work.timersFired++;
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
        eventSource, event_types, calls, saves, deletions, notices, logEntries, setFlag, context, timers, apiRequests, requestReply,
        sound: sound.exports, soundPlays, extensionState, work,
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
    h.setFlag('isChatSaving', false);
    await h.advance(2000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
    h.st.streamingProcessor = null;
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
});

test('enforces a finite chain and retains the final rejected reply without extra deletion or saving', async () => {
    const h = await harness({ responses: ['blocked 1', 'blocked 2', 'blocked 3'] });
    await h.begin();
    await h.finish('blocked initial');
    await h.advance(10_000);
    assert.equal(h.calls.length, 3);
    assert.equal(h.deletions.length, 3); // Only native regenerate replaces a reply.
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'blocked 3']);
    assert.equal(h.saves.length, 0);
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
    assert.ok(h.notices.some(notice => notice.args[0].includes('保留最后回复')));
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

test('a save starting during the retry delay postpones regeneration instead of cancelling it', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked response');
    await h.advance(100);
    assert.equal(h.run.phase, 'waiting');
    h.setFlag('isChatSaving', true);
    await h.advance(3000);
    assert.equal(h.calls.length, 0);
    assert.equal(h.run.phase, 'waiting');
    h.setFlag('isChatSaving', false);
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.st.chat.at(-1).mes, 'accepted');
});

for (const event of ['MESSAGE_UPDATED', 'MESSAGE_SWIPED']) {
    test(`only changes to the generated floor cancel retries (${event})`, async () => {
        for (const messageId of [0, 1]) {
            const h = await harness();
            await h.begin();
            await h.finish('blocked response');
            await h.advance(100);
            await h.eventSource.emit(h.event_types[event], messageId);
            await h.advance(2000);
            assert.equal(h.calls.length, messageId === 0 ? 1 : 0);
        }
    });
}

for (const when of ['before-check', 'during-delay']) {
    test(`reads the current floor instead of a stale message snapshot (${when})`, async () => {
        for (const text of ['blocked replacement', 'accepted replacement']) {
            const h = await harness();
            await h.begin();
            await h.finish('blocked original');
            if (when === 'during-delay') await h.advance(100);
            h.st.chat[h.st.chat.length - 1] = { ...h.st.chat.at(-1), mes: text };
            await h.advance(3000);
            assert.equal(h.calls.length, text.startsWith('blocked') ? 1 : 0);
            assert.equal(h.run, null);
        }
    });
}

for (const type of ['normal', 'regenerate']) {
    test(`does not rescan history when ${type} ends without a new reply`, async () => {
        const h = await harness({ chat: [{ is_user: true, mes: 'prompt' }, { is_user: false, mes: 'blocked history' }] });
        await h.begin(type);
        h.setFlag('is_send_press', false);
        await h.eventSource.emit(h.event_types.GENERATION_ENDED);
        await h.advance(3000);
        assert.equal(h.calls.length, 0);
        assert.equal(h.st.chat.at(-1).mes, 'blocked history');
        assert.equal(h.run, null);
    });
}

for (const phase of ['settling', 'waiting']) {
    test(`a stuck save times out safely while ${phase}`, async () => {
        const h = await harness();
        await h.begin();
        await h.finish('blocked response');
        if (phase === 'waiting') await h.advance(100);
        h.setFlag('isChatSaving', true);
        await h.advance(65_000);
        assert.equal(h.calls.length, 0);
        assert.equal(h.saves.length, 0);
        assert.equal(h.run, null);
        assert.equal(h.timers.size, 0);
        assert.equal(h.st.chat.at(-1).mes, 'blocked response');
        assert.ok(h.notices.some(notice => notice.args[0].includes('超时')));
    });
}

test('duplicate end events do not shorten the retry delay or start multiple regenerations', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked response');
    await h.advance(100);
    for (let i = 0; i < 3; i++) await h.eventSource.emit(h.event_types.GENERATION_ENDED);
    await h.advance(1400);
    assert.equal(h.calls.length, 0);
    await h.advance(200);
    assert.equal(h.calls.length, 1);
    await h.advance(5000);
    assert.equal(h.calls.length, 1);
});

test('native regenerate awaits its deletion handlers without a separate blacklist cleanup', async () => {
    const gate = deferred();
    let cleanups = 0;
    const h = await harness();
    h.eventSource.on(h.event_types.MESSAGE_DELETED, async () => { cleanups++; await gate.promise; });
    await h.begin();
    await h.finish('blocked response');
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(cleanups, 1);
    assert.equal(h.st.chat.length, 1);
    gate.resolve();
    await setImmediate();
    await h.advance(2000);
    assert.equal(h.st.chat.at(-1).mes, 'accepted');
    assert.equal(h.saves.length, 0);
});

test('failed regeneration leaves deletion and persistence to ST without deleting earlier replies', async () => {
    const prior = { is_user: false, mes: 'earlier valid reply' };
    const h = await harness({ chat: [{ is_user: true, mes: 'prompt' }, prior], responses: [new Error('network')] });
    await h.begin();
    await h.finish('blocked response');
    await h.advance(5000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.deletions.length, 1);
    assert.equal(h.st.chat.at(-1), prior);
    assert.equal(h.saves.length, 0);
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
    assert.equal(h.logEntries.length, 1);
    assert.equal(h.logEntries[0].level, 'warn');
    assert.ok(h.logEntries[0].args[0].includes('原生重新生成抛出异常'));
    assert.equal(h.logEntries[0].args[1].message, 'network');
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

for (const streaming of [false, true]) {
    test(`token-count dry runs do not interrupt native blacklist regeneration (streaming=${streaming})`, async () => {
        const h = await harness({ apiResponses: ['blocked', 503, 'accepted'], streamingRetries: streaming,
            settings: { generateRetryMaxRetries: 2 } });
        const countTokens = async () => {
            await h.begin('normal', {}, true);
            await h.eventSource.emit(h.event_types.GENERATE_AFTER_DATA, { prompt: 'count tokens' }, true);
        };
        // Insert a token count after preparation on every real API request,
        // including the native regenerate started by the blacklist check.
        h.eventSource.on(h.event_types.CHAT_COMPLETION_SETTINGS_READY, countTokens);
        await h.begin();
        const run = h.run;
        await h.finish(await h.requestReply(), { streaming });
        await h.advance(100);
        assert.equal(run.phase, 'waiting');
        await countTokens();
        assert.equal(h.run, run, 'a token count during the retry delay must not reset its budget');
        await h.advance(30_000);
        assert.equal(h.calls.length, 1);
        assert.equal(h.calls[0].type, 'regenerate');
        assert.equal(h.apiRequests.length, 3);
        assert.equal(run.retries, 2, 'blacklist and HTTP retries keep their shared allowance');
        assert.deepEqual(h.st.chat.map(m => m.mes), ['prompt', 'accepted']);
        assert.equal(h.run, null);
    });
}

test('blacklist, network, blacklist exhaustion keeps the final hit without granting another request', async () => {
    const h = await harness({ apiResponses: ['blocked initial', 503, 'blocked again', 'blocked final'] });
    await h.begin();
    const run = h.run;
    await h.finish(await h.requestReply());
    await h.advance(30_000);
    assert.equal(h.apiRequests.length, 4);
    assert.equal(h.calls.length, 2);
    assert.equal(run.retries, 3);
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'blocked final']);
    assert.equal(h.saves.length, 0);
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
        assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'blocked']);
        assert.equal(h.deletions.length, 0);
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
    assert.equal(h.saves.length, 0);
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
    assert.deepEqual(h.st.chat.map(message => message.mes), ['prompt', 'blocked again']);
    assert.equal(h.saves.length, 0);
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

test('background deletion handler is awaited and its cleanup remains bounded', async () => {
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
    const deletion = handlers.get('deleted')().then(result => { finished = true; return result; });
    await setImmediate();
    assert.equal(finished, false);
    gate.resolve(new Response(JSON.stringify({ ok: true, data: {} }), { status: 200 }));
    assert.equal(await deletion, true);
    assert.equal(finished, true);
    state.originalFetch = async () => new Response('failed', { status: 500 });
    assert.equal(await handlers.get('deleted')(), false);

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

// Representative proxy error only: never copy real prompts or proxy credentials.
const proxyErrorReply = `### **Proxy error (HTTP 503 Service Unavailable)**

The proxy encountered an error while trying to send your prompt to the API.

----
*Upstream service unavailable. Try again later.*

\`\`\`
{"error":{"code":503,"message":"Please try again later.","status":"UNAVAILABLE"}}
\`\`\`
<!-- oai-proxy-error -->`;

for (const mode of ['nonstream', 'stream', 'stream-error', 'stream-error-retained', 'user-stop', 'user-stop-retained']) {
    test(`proxy 503 blacklist: ${mode}`, async () => {
        const h = await harness({ settings: {
            generateBlacklistRetryText: 'Too Many Requests\nHTTP 503 Service Unavailable',
        } });
        await h.begin();
        await h.finish(proxyErrorReply, { streaming: mode !== 'nonstream', holdSave: true });
        if (mode.startsWith('stream-error') || mode.startsWith('user-stop')) {
            h.st.streamingProcessor.isStopped = true;
            h.st.streamingProcessor.isFinished = false;
            h.st.streamingProcessor.abortController.abort();
        }
        if (mode.startsWith('user-stop')) await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
        if (!mode.endsWith('-retained')) h.st.streamingProcessor = null;
        h.setFlag('isChatSaving', false);
        await h.advance(2000);
        assert.equal(h.calls.length, mode.startsWith('user-stop') ? 0 : 1);
        if (!mode.startsWith('user-stop')) assert.equal(h.st.chat.at(-1).mes, 'accepted');
    });
}

test('retained failed stream waits for chat save before blacklist retry', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked response', { streaming: true, holdSave: true });
    const processor = h.st.streamingProcessor;
    Object.assign(processor, { isStopped: true, isFinished: false });
    processor.abortController.abort();
    await h.advance(2000);
    assert.equal(h.run.phase, 'generating');
    assert.equal(h.calls.length, 0);
    assert.equal(h.deletions.length, 0);
    h.setFlag('isChatSaving', false);
    await h.advance(100);
    assert.equal(h.run.phase, 'waiting');
    assert.equal(h.st.streamingProcessor, processor);
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.st.chat.at(-1).mes, 'accepted');
});

for (const phase of ['settling', 'waiting']) {
    test(`replacement stream blocks blacklist retry while ${phase}`, async () => {
        const h = await harness();
        await h.begin();
        await h.finish('blocked response', { streaming: true, holdSave: true });
        Object.assign(h.st.streamingProcessor, { isStopped: true, isFinished: false });
        h.st.streamingProcessor.abortController.abort();
        h.setFlag('isChatSaving', false);
        if (phase === 'waiting') {
            await h.advance(100);
            assert.equal(h.run.phase, 'waiting');
        }
        // Even another failed processor must not be mistaken for this run's stream.
        h.st.streamingProcessor = { ...h.st.streamingProcessor };
        await h.advance(2000);
        assert.equal(h.calls.length, 0);
        assert.equal(h.deletions.length, 0);
        assert.equal(h.st.chat.at(-1).mes, 'blocked response');
    });
}

async function saveGenerateHarness({ install = false, responses = [200], modernBackend = true, backendAvailable = true, beforeInstall } = {}) {
    const event_types = Object.fromEntries(['GENERATION_AFTER_COMMANDS', 'GENERATE_AFTER_DATA', 'CHAT_COMPLETION_SETTINGS_READY',
        'GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED', 'MESSAGE_DELETED'].map(e => [e, e]));
    const listeners = new Map();
    const eventSource = {
        on(event, fn) { listeners.set(event, [...(listeners.get(event) || []), fn]); },
        async emit(event, ...args) { for (const fn of listeners.get(event) || []) await fn(...args); },
    };
    const requests = [];
    const statusRequests = [];
    const logs = [];
    const logEntries = [];
    const timers = new Map();
    let serial = 0;
    let now = Date.now();
    let chatId = 'test-chat';
    const settings = { saveGenerateEnabled: true, generateRetryEnabled: true, generateRetryMaxRetries: 1 };
    const script = { main_api: 'openai', this_chid: 0, is_send_press: true, event_types, eventSource,
        characters: [{ avatar: 'test.png', chat: 'test-chat', name: 'Test' }],
        chat: [{ is_user: true, mes: 'prompt' }], getCurrentChatId: () => chatId,
        getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'test-only' }) };
    const context = vm.createContext({ URL, Headers, Request, Response, ReadableStream, AbortController, AbortSignal,
        __BBT_VERSION__: 'test',
        Date: class extends Date { static now() { return now; } },
        // Only zero-delay retry timers need to execute; resume/status deadlines remain under test control.
        setTimeout(fn, ms) { if (ms === 0) return setTimeout(fn, 0); timers.set(++serial, fn); return serial; },
        clearTimeout(id) { if (typeof id === 'number') timers.delete(id); else clearTimeout(id); },
        console: Object.fromEntries(['debug', 'log', 'info', 'warn', 'error'].map(level => [level, (...args) => { logs.push(args); logEntries.push({ level, args }); }])),
        toastr: { warning() {} },
        document: { getElementById: () => null, createElement: () => ({}), head: { appendChild() {} },
            addEventListener() {}, querySelectorAll: () => [] },
        window: { addEventListener() {} },
        location: { href: 'http://127.0.0.1:8000/', origin: 'http://127.0.0.1:8000' },
        fetch: async (url, init) => {
            const pathname = new URL(url instanceof Request ? url.url : url, 'http://127.0.0.1:8000').pathname;
            if (pathname.endsWith('/status')) {
                statusRequests.push({ pathname, init });
                return Response.json({ ok: backendAvailable, data: { installed: backendAvailable,
                    capabilities: { saveGenerateCompleteResponseTool: modernBackend } } });
            }
            requests.push({ pathname, input: url, init, body: JSON.parse(init?.body ?? await url.clone().text()) });
            assert.ok(responses.length, 'unexpected extra generation request');
            const status = responses.shift();
            if (status instanceof Error) throw status;
            if (status !== 200) return Response.json({ error: 'temporary failure' }, { status });
            return Response.json({ choices: [{ message: { content: 'accepted' } }] });
        },
    });
    const constants = (await loadModule('constants.js', context, { '@sillytavern/script': script })).exports;
    const mocks = { './generateRequest.js': generateRequest, '@sillytavern/script': script, '@sillytavern/scripts/group-chats': { selected_group: null },
        './state.js': { settings, extensionState: {} }, './constants.js': { ...constants, GENERATE_RETRY_BASE_DELAY_MS: 0 } };
    mocks['./gzipHook.js'] = (await loadModule('gzipHook.js', context, mocks)).exports;
    mocks['./util.js'] = (await loadModule('util.js', context, mocks)).exports;
    const { exports: feature, dependencies } = await loadModule('saveGenerate.js', context, mocks);
    if (beforeInstall) beforeInstall(context);
    let retryState;
    let saveState;
    if (install) {
        const retry = (await loadModule('generateRetry.js', context, mocks)).exports;
        retryState = retry.installGenerateRetryFetchHook();
        saveState = feature.installSaveGenerateFetchHook();
    }
    const body = { type: 'normal', stream: true, chat_completion_source: 'openai', tool_choice: 'auto',
        messages: [{ role: 'system', content: 'test instructions' }, { role: 'user', content: 'prompt' }],
        tools: [{ type: 'function', function: { name: 'emit_complete_response_test123', parameters: {
            type: 'object', properties: { content: { type: 'string' } }, required: ['content'],
        } } }] };
    return { feature, body, context, eventSource, event_types, requests, statusRequests, logs, logEntries, script, settings, constants,
        retryState, saveState, advance: ms => { now += ms; }, setChatId: id => { chatId = id; },
        setGroup: id => dependencies.get('@sillytavern/scripts/group-chats').setExport('selected_group', id) };
}

// The preset's outer fetch hook clones the JSON AFTER SETTINGS_READY and adds
// an envelope tool plus one control message. No private preset/chat is included.
function wrapCompleteResponseBody(native, tool, { at = native.messages.length, role = 'system' } = {}) {
    const body = JSON.parse(JSON.stringify(native));
    body.tools = [tool];
    body.tool_choice = 'auto';
    body.messages.splice(at, 0, { role, content: `Call the \`${tool.function.name}\` function exactly once and put your complete final reply in its \`content\` argument. Do not write any of the final reply outside that call. Use any other available tools normally when they are needed.` });
    return body;
}

test('background eligibility supports complete-response envelopes, not arbitrary tools', async () => {
    const { feature, body } = await saveGenerateHarness();
    assert.equal(feature.isEligibleSaveGenerateBody(body), true);
    assert.equal(feature.isEligibleSaveGenerateBody({ ...body, tools: [] }), true);
    for (const change of [b => b.tools.push(b.tools[0]), b => b.tools[0].function.name = 'search',
        b => b.tools[0].function.parameters.properties.content.type = 'number',
        b => b.chat_completion_source = 'claude', b => b.n = 2, b => b.type = 'quiet']) {
        const copy = structuredClone(body); change(copy);
        assert.equal(feature.isEligibleSaveGenerateBody(copy), false);
    }
});

test('tool request is bound to the main generation intent and matches the supplied native URL', async () => {
    const { feature, body } = await saveGenerateHarness();
    const state = {};
    feature.recordSaveGenerateIntentFromGenerationEvent(state, 'normal');
    feature.bindSaveGenerateIntentToRequestBody(state, body);
    assert.equal(state.saveGenerateIntent.requestId, generateRequest.getGenerationRequestId(body));
    assert.deepEqual(Object.keys(state.saveGenerateIntent).sort(), ['chatId', 'requestId', 'type']);
    const init = { method: 'POST', body: JSON.stringify(body) };
    const info = await feature.getSaveGenerateRequestInfo(state, 'http://127.0.0.1:8000/api/backends/chat-completions/generate', init);
    assert.ok(info);
    assert.equal(state.saveGenerateIntent, null, 'consume the intent once');
    assert.equal(JSON.stringify(info.body), JSON.stringify(body));
    assert.equal(info.save.expectedFloor, 1);
    assert.equal(await feature.getSaveGenerateRequestInfo(state, 'http://other.test/api/backends/chat-completions/generate', init), null);
    assert.equal(await feature.getSaveGenerateRequestInfo({}, 'http://127.0.0.1:8000/api/backends/chat-completions/generate', init), null);
});

test('backend capability is opt-in, cached, and cleared when querying an older backend', async () => {
    const { feature } = await saveGenerateHarness();
    let modern = true;
    let queries = 0;
    const state = { originalFetch: async () => {
        queries++;
        return Response.json({ ok: true, data: { installed: true,
            ...(modern ? { capabilities: { saveGenerateCompleteResponseTool: true } } : {}),
        } });
    } };
    assert.equal(await feature.isSaveGenerateBackendAvailable(state), true);
    assert.equal(state.backendSupportsCompleteResponseTool, true);
    assert.equal(await feature.isSaveGenerateBackendAvailable(state), true);
    assert.equal(queries, 1);
    modern = false;
    state.backendCheckedAt = 0;
    assert.equal(await feature.isSaveGenerateBackendAvailable(state), true);
    assert.equal(state.backendSupportsCompleteResponseTool, false);
});

// Reproduce page startup: the settings panel can finish its status fetch before
// the generation hook's own status probe. Exercise the real panel, not its marker alone.
for (const modernBackend of [true, false]) {
    test(`panel-first status refresh preserves tool capability (modern=${modernBackend})`, async () => {
        const h = await saveGenerateHarness({ install: true, modernBackend });
        const fetch = h.context.fetch;
        h.context.fetch = (url, init) => url === h.constants.BAIBAOKU_FAST_CONFIG_URL
            ? Promise.resolve(Response.json({ ok: true, data: {} })) : fetch(url, init);
        const { exports: panel } = await loadModule('baibaokuPanel.js', h.context, {
            './constants.js': h.constants, './saveGenerate.js': h.feature,
            './state.js': { settings: h.settings, extensionState: {} },
            '../preset/index.js': { setPresetAutoBackupBackendAvailable() {} },
            './theme.js': { getBaibaokuEarlyBridge: () => null },
            './updateCheck.js': { isVersionGreater: () => false },
            './fastChat.js': { applyFastChatGetOptimization() {} },
        });
        const container = Object.fromEntries(['find', 'closest', 'prop', 'data', 'attr', 'toggleClass', 'css', 'text', 'each']
            .map(name => [name, function () { return this; }]));
        await panel.refreshBaibaokuPanelStatus(container);
        assert.equal(h.saveState.backendAvailable, true);
        assert.equal(h.statusRequests.length, 1);
        const body = await prepareMainRequest(h);
        body.tools = h.body.tools;
        assert.equal(await dispatchMainRequest(h, body), 200);
        assert.equal(h.requests[0].pathname, modernBackend
            ? h.constants.BAIBAOKU_SAVE_GENERATE_URL : h.constants.SAVE_GENERATE_PATH);
        assert.equal(h.saveState.backendSupportsCompleteResponseTool, modernBackend);
        assert.equal(h.statusRequests.length, 1, 'reuse complete panel status without a redundant probe');
        assertNoRequestMarker(h);
    });
}

test('availability-only cache must not suppress the first capability probe', async () => {
    const h = await saveGenerateHarness({ install: true });
    h.feature.markSaveGenerateBackendAvailable(h.saveState, true);
    const body = await prepareMainRequest(h);
    body.tools = h.body.tools;
    assert.equal(await dispatchMainRequest(h, body), 200);
    assert.equal(h.statusRequests.length, 1);
    assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL);
    assert.equal(h.saveState.backendSupportsCompleteResponseTool, true);
});

test('shared backend status updates capability, preserves it on generation, and clears it offline', async () => {
    const h = await saveGenerateHarness({ install: true });
    const state = h.saveState;
    const mark = h.feature.markSaveGenerateBackendAvailable;
    assert.equal(await h.feature.isSaveGenerateBackendAvailable(state), true);
    mark(state, true);
    assert.equal(state.backendSupportsCompleteResponseTool, true, 'generation response has no capability payload');
    mark(state, true, { installed: true });
    assert.equal(state.backendSupportsCompleteResponseTool, false, 'old status must clear previously known support');
    mark(state, true, { capabilities: { saveGenerateCompleteResponseTool: true } });
    assert.equal(state.backendSupportsCompleteResponseTool, true, 'panel refresh discovers an updated backend');
    mark(state, false);
    assert.equal(state.backendSupportsCompleteResponseTool, false);
    assert.equal(await h.feature.isSaveGenerateBackendAvailable(state), false, 'negative availability remains cached');
    assert.equal(h.statusRequests.length, 1);
});

for (const placement of ['anchored', 'appended', 'assistant-tail']) {
    test(`full fetch chain routes post-event envelope to save-generate (${placement})`, async () => {
        const h = await saveGenerateHarness({ install: true });
        const native = structuredClone(h.body);
        delete native.tools;
        delete native.tool_choice;
        if (placement === 'assistant-tail') native.messages.at(-1).role = 'assistant';
        const before = JSON.stringify(native);
        const originalFetch = h.context.fetch;
        const controller = new AbortController();
        let transformed;
        h.context.fetch = (url, init) => {
            transformed = wrapCompleteResponseBody(JSON.parse(init.body), h.body.tools[0], {
                at: placement === 'anchored' ? 1 : native.messages.length,
                role: placement === 'assistant-tail' ? 'user' : 'system',
            });
            return originalFetch(url, { ...init, body: JSON.stringify(transformed) });
        };
        h.script.chat.splice(0, h.script.chat.length, { is_user: false, mes: 'greeting' });
        await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        h.script.chat.push({ is_user: true, mes: 'prompt' });
        await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, native);
        const response = await h.context.fetch('http://127.0.0.1:8000/api/backends/chat-completions/generate', {
            method: 'POST', body: JSON.stringify(native), signal: controller.signal,
        });
        await response.text();
        assert.equal(h.requests.length, 1);
        assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL, JSON.stringify(h.logs));
        assert.deepEqual(h.requests[0].body.generate, generateRequest.stripGenerationRequestId(transformed));
        assert.equal(h.requests[0].body.save.expectedFloor, 2);
        assert.equal(h.requests[0].init.signal, controller.signal);
        assert.equal(h.requests[0].init.headers.get('X-CSRF-Token'), 'test-only');
        assert.equal(JSON.stringify(generateRequest.stripGenerationRequestId(native)), before, 'only the local marker changes the event body');
    });
}

test('post-event envelopes still retry HTTP 503 with background on, off, or an older backend', async () => {
    for (const mode of ['background', 'disabled', 'old-backend']) {
        const h = await saveGenerateHarness({ install: true, responses: [503, 200], modernBackend: mode !== 'old-backend' });
        h.settings.saveGenerateEnabled = mode !== 'disabled';
        const native = structuredClone(h.body);
        delete native.tools;
        delete native.tool_choice;
        await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, native);
        const actual = wrapCompleteResponseBody(native, h.body.tools[0]);
        const response = await h.context.fetch('/api/backends/chat-completions/generate', {
            method: 'POST', body: JSON.stringify(actual), signal: new AbortController().signal,
        });
        assert.equal(response.status, 200, JSON.stringify(h.logs));
        await response.text();
        assert.equal(h.requests.length, 2, mode);
        const path = mode === 'background' ? h.constants.BAIBAOKU_SAVE_GENERATE_URL : h.constants.SAVE_GENERATE_PATH;
        assert.ok(h.requests.every(r => r.pathname === path), mode);
        assert.equal(h.requests[0].init.body, h.requests[1].init.body, 'retry the exact transformed request');
    }
});

test('request identity survives cloning and parameter edits, without retaining content', () => {
    const body = { type: 'normal', messages: [{ role: 'user', content: 'prompt' }] };
    const id = generateRequest.markGenerationRequest(body);
    const copy = JSON.parse(JSON.stringify(body));
    copy.messages[0].content = 'prompt changed by a preset';
    copy.temperature = 0.7;
    copy.model = 'other-model';
    assert.equal(generateRequest.getGenerationRequestId(copy), id);
    assert.equal(generateRequest.markGenerationRequest(copy), id);
    const clean = generateRequest.stripGenerationRequestId(copy);
    assert.equal(generateRequest.getGenerationRequestId(clean), '');
    assert.equal(generateRequest.getGenerationRequestId(copy), id, 'strip without mutating source');
    assert.notEqual(generateRequest.markGenerationRequest(clean), id);
});

test('independent transformed requests are neither saved nor retried without a matching native intent', async () => {
    for (const mode of ['no-event', 'dry-run', 'other-prompt', 'quiet']) {
        const h = await saveGenerateHarness({ install: true, responses: [503] });
        const native = { ...h.body, tools: [] };
        if (mode === 'quiet') native.type = 'quiet';
        if (mode !== 'no-event') {
            await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, native.type, {}, mode === 'dry-run');
            await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, native);
        }
        const actual = wrapCompleteResponseBody(native, h.body.tools[0]);
        if (mode === 'other-prompt') {
            delete actual.__baibai_generation_id;
            actual.messages[0].content = 'another plugin request';
        }
        const response = await h.context.fetch('/api/backends/chat-completions/generate', {
            method: 'POST', body: JSON.stringify(actual), signal: new AbortController().signal,
        });
        assert.equal(response.status, 503);
        assert.equal(h.requests.length, 1, mode);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH, mode);
    }
});

test('a disconnected background submission never falls back to a second native generation', async () => {
    const offline = new TypeError('test disconnect');
    const h = await saveGenerateHarness({ install: true, responses: [offline, 200] });
    const native = { ...h.body, tools: [] };
    await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, native);
    const actual = wrapCompleteResponseBody(native, h.body.tools[0]);
    await assert.rejects(h.context.fetch('/api/backends/chat-completions/generate', {
        method: 'POST', body: JSON.stringify(actual), signal: new AbortController().signal,
    }), error => error === offline);
    assert.equal(h.requests.length, 1);
    assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL);
});

async function prepareMainRequest(h, type = 'normal', stream = true) {
    const body = { ...structuredClone(h.body), type, stream, tools: [] };
    await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, type, {}, false);
    // ST emits both events for chat completions, with different payload objects.
    await h.eventSource.emit(h.event_types.GENERATE_AFTER_DATA, { prompt: 'outer prompt' }, false);
    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
    return body;
}

async function dispatchMainRequest(h, body) {
    const response = await h.context.fetch(h.constants.SAVE_GENERATE_PATH, {
        method: 'POST', body: JSON.stringify(body), signal: new AbortController().signal,
    });
    await response.text();
    return response.status;
}

function assertNoRequestMarker(h) {
    for (const request of h.requests) {
        assert.equal('__baibai_generation_id' in request.body, false);
        if (request.body.generate) assert.equal('__baibai_generation_id' in request.body.generate, false);
    }
}

for (const type of ['normal', 'regenerate']) {
    for (const stream of [false, true]) {
        test(`late preset parameter changes route by identity (${type}, stream=${stream})`, async () => {
            const h = await saveGenerateHarness({ install: true });
            if (type === 'regenerate') h.script.chat.push({ is_user: false, mes: 'old reply' });
            const original = await prepareMainRequest(h, type, stream);
            if (type === 'regenerate') h.script.chat.pop(); // Native ST removes the old assistant before fetch.
            const actual = wrapCompleteResponseBody(original, h.body.tools[0]);
            actual.temperature = 0.65;
            actual.seed = 123;
            actual.model = 'test-model';
            actual.reverse_proxy = 'https://proxy.invalid';
            actual.messages[0].content += '\n';
            actual.messages.at(-1).content += '\nPreset control instructions may also change.';
            assert.equal(await dispatchMainRequest(h, actual), 200, JSON.stringify(h.logs));
            assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL);
            assert.deepEqual(h.requests[0].body.generate, generateRequest.stripGenerationRequestId(actual));
            assert.equal(h.saveState.saveGenerateIntent, null);
            assert.equal(h.retryState.nativeWindow, null);
            assertNoRequestMarker(h);
        });
    }
}

test('fresh page hooks route correctly with a preset wrapper installed before or after the toolkit', async () => {
    const wrap = context => {
        const previous = context.fetch;
        context.fetch = (url, init) => {
            if (String(url).endsWith('/api/backends/chat-completions/generate')) {
                const body = JSON.parse(init.body);
                body.temperature = 0.42;
                return previous(url, { ...init, body: JSON.stringify(body) });
            }
            return previous(url, init);
        };
    };
    for (const before of [true, false]) {
        // A second isolated global represents refresh, not reuse of a persisted intent.
        const first = await saveGenerateHarness({ install: true });
        const stale = await prepareMainRequest(first);
        const h = await saveGenerateHarness({ install: true, responses: [503, 200], beforeInstall: before ? wrap : undefined });
        if (!before) wrap(h.context);
        const current = await prepareMainRequest(h);
        assert.notEqual(generateRequest.getGenerationRequestId(current), generateRequest.getGenerationRequestId(stale));
        assert.equal(await dispatchMainRequest(h, stale), 503, 'previous-page identity must neither save nor retry');
        assert.equal(await dispatchMainRequest(h, current), 200, JSON.stringify(h.logs));
        assert.deepEqual(h.requests.map(r => r.pathname), [h.constants.SAVE_GENERATE_PATH, h.constants.BAIBAOKU_SAVE_GENERATE_URL]);
        // An inner native-only wrapper no longer targets a request already routed to the backend.
        if (!before) assert.equal(h.requests[1].body.generate.temperature, 0.42);
        assertNoRequestMarker(h);
    }
});

// Settings-ready is an identity handoff, not the final wire payload: other
// listeners and preset fetch hooks may still replace tools/provider/n afterward.
for (const change of ['tools', 'source', 'n']) {
    test(`preparation binds identity before late compatibility changes (${change})`, async () => {
        const h = await saveGenerateHarness({ install: true });
        h.settings.generateRetryEnabled = false;
        const body = { ...structuredClone(h.body), tools: [] };
        if (change === 'tools') body.tools = [{ type: 'function', function: { name: 'search' } }];
        if (change === 'source') delete body.chat_completion_source;
        if (change === 'n') body.n = 2;
        await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
        const innerFetch = h.context.fetch;
        h.context.fetch = (url, init) => {
            const final = wrapCompleteResponseBody(JSON.parse(init.body), h.body.tools[0]);
            final.chat_completion_source = 'openai';
            final.n = 1;
            return innerFetch(url, { ...init, body: JSON.stringify(final) });
        };
        assert.equal(await dispatchMainRequest(h, body), 200);
        assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL, JSON.stringify(h.logs));
        assertNoRequestMarker(h);
    });
}

test('unsupported prepared tools still use native dispatch when the final payload remains unsupported', async () => {
    const h = await saveGenerateHarness({ install: true });
    const body = { ...structuredClone(h.body), tools: [{ type: 'function', function: { name: 'search' } }] };
    await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
    assert.ok(h.saveState.saveGenerateIntent.requestId, 'binding must not depend on final tool eligibility');
    assert.equal(await dispatchMainRequest(h, body), 200);
    assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH);
    assert.equal(h.saveState.saveGenerateIntent, null, 'native fallback also consumes the marked dispatch');
    assert.deepEqual(h.logEntries, []);
    assertNoRequestMarker(h);
});

test('unprepared dispatch falls back silently for every preparation branch', async () => {
    for (const reason of ['event-missing', 'invalid-body', 'type-mismatch', 'chat-changed', 'disabled', 'group']) {
        const h = await saveGenerateHarness({ install: true, responses: [503] });
        await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        const prepared = structuredClone(h.body);
        if (reason === 'type-mismatch') prepared.type = 'quiet';
        if (reason === 'chat-changed') h.setChatId('other-chat');
        if (reason === 'disabled') { h.settings.saveGenerateEnabled = false; h.settings.generateRetryEnabled = false; }
        if (reason === 'group') h.setGroup('group-id');
        if (reason !== 'event-missing') {
            await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, reason === 'invalid-body' ? null : prepared);
        }
        h.setChatId('test-chat');
        h.setGroup(null);
        h.settings.saveGenerateEnabled = true;
        assert.equal(await dispatchMainRequest(h, h.body), 503, 'unprepared requests are not claimed');
        assert.equal(h.requests.length, 1);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH);
        assert.deepEqual(h.logEntries, []);
        assertNoRequestMarker(h);
    }
});

test('slow preparation and delayed fetch do not expire an active main generation', async () => {
    const h = await saveGenerateHarness({ install: true });
    await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
    h.advance(180_000);
    const body = { ...h.body, tools: [] };
    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
    h.advance(300_000);
    assert.equal(await dispatchMainRequest(h, body), 200, JSON.stringify(h.logs));
    assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL);
    assertNoRequestMarker(h);
});

// PromptManager.tryGenerate calls Generate('normal', {}, true), including the
// generation events. It must not replace a live request, even during regenerate.
for (const type of ['normal', 'regenerate']) {
    for (const phase of ['before-settings', 'before-fetch']) {
        for (const enabled of ['both', 'background-only', 'retry-only']) {
            test(`token-count dry run preserves main request (${type}, ${phase}, ${enabled})`, async () => {
                const h = await saveGenerateHarness({ install: true,
                    responses: enabled === 'background-only' ? [200] : [503, 200] });
                h.settings.saveGenerateEnabled = enabled !== 'retry-only';
                h.settings.generateRetryEnabled = enabled !== 'background-only';
                const body = { ...structuredClone(h.body), type, tools: [] };
                await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, type, { automatic_trigger: type === 'regenerate' }, false);
                if (phase === 'before-fetch') {
                    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
                }
                const intent = h.saveState.saveGenerateIntent;
                const nativeWindow = h.retryState.nativeWindow;
                // Match ST's dry-run events: no completion request/settings event
                // is dispatched, but GENERATION_AFTER_COMMANDS still fires.
                await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, true);
                const dryBody = { prompt: 'token counting only' };
                await h.eventSource.emit(h.event_types.GENERATE_AFTER_DATA, dryBody, true);
                if (phase === 'before-settings') {
                    await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, body);
                }
                assert.equal(await dispatchMainRequest(h, body), 200, JSON.stringify(h.logs));
                const target = enabled === 'retry-only' ? h.constants.SAVE_GENERATE_PATH : h.constants.BAIBAOKU_SAVE_GENERATE_URL;
                assert.deepEqual(h.requests.map(r => r.pathname), enabled === 'background-only' ? [target] : [target, target]);
                assert.equal(generateRequest.getGenerationRequestId(dryBody), '', 'dry-run body must remain unmarked');
                assert.equal(generateRequest.getGenerationRequestId(body), nativeWindow.requestId, 'preserve the original identity');
                if (intent) assert.equal(intent.requestId, nativeWindow.requestId);
                assert.equal(h.saveState.saveGenerateIntent, null, 'the real dispatch still consumes the claim once');
                assert.equal(h.retryState.nativeWindow, null);
                assertNoRequestMarker(h);
            });
        }
    }
}

test('end, stop, chat change and new generation invalidate previous identities', async () => {
    for (const event of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED', 'GENERATION_AFTER_COMMANDS']) {
        const h = await saveGenerateHarness({ install: true, responses: [503] });
        const body = await prepareMainRequest(h);
        await h.eventSource.emit(h.event_types[event], 'normal', {}, false);
        assert.equal(await dispatchMainRequest(h, body), 503, event);
        assert.equal(h.requests.length, 1);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH, event);
        assertNoRequestMarker(h);
    }
});

test('identity is single-use for both background dispatch and native HTTP retries', async () => {
    for (const enabled of [false, true]) {
        const h = await saveGenerateHarness({ install: true, responses: [503, 200, 503] });
        h.settings.saveGenerateEnabled = enabled;
        const body = await prepareMainRequest(h);
        assert.equal(await dispatchMainRequest(h, body), 200);
        assert.equal(await dispatchMainRequest(h, body), 503, 'replay cannot claim another retry allowance');
        const target = enabled ? h.constants.BAIBAOKU_SAVE_GENERATE_URL : h.constants.SAVE_GENERATE_PATH;
        assert.deepEqual(h.requests.map(r => r.pathname), [target, target, h.constants.SAVE_GENERATE_PATH]);
        assert.equal(h.requests[0].init.body, h.requests[1].init.body);
        assertNoRequestMarker(h);
    }
});

test('auxiliary or unmarked requests cannot steal the prepared main request', async () => {
    for (const mode of ['missing', 'wrong', 'quiet']) {
        const h = await saveGenerateHarness({ install: true, responses: [503, 200] });
        const main = await prepareMainRequest(h);
        const other = structuredClone(main);
        if (mode === 'missing') delete other.__baibai_generation_id;
        if (mode === 'wrong') generateRequest.markGenerationRequest(other, generateRequest.createGenerationRequestId());
        if (mode === 'quiet') {
            delete other.__baibai_generation_id;
            other.type = 'quiet';
            await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, other);
            assert.equal(generateRequest.getGenerationRequestId(other), '', 'quiet cannot acquire the main marker');
        }
        assert.equal(await dispatchMainRequest(h, other), 503);
        assert.equal(await dispatchMainRequest(h, main), 200, JSON.stringify(h.logs));
        assert.deepEqual(h.requests.map(r => r.pathname), [h.constants.SAVE_GENERATE_PATH, h.constants.BAIBAOKU_SAVE_GENERATE_URL]);
        assertNoRequestMarker(h);
    }
});

test('safe native fallbacks remove markers without process diagnostics', async () => {
    for (const mode of ['assistant-tail', 'chat-mismatch', 'unsupported-tool', 'multi-swipe', 'group']) {
        const h = await saveGenerateHarness({ install: true });
        h.settings.generateRetryEnabled = false;
        const body = await prepareMainRequest(h);
        if (mode === 'assistant-tail') h.script.chat.push({ is_user: false, mes: 'unrelated assistant' });
        if (mode === 'chat-mismatch') h.setChatId('other-chat');
        if (mode === 'unsupported-tool') body.tools = [{ type: 'function', function: { name: 'search' } }];
        if (mode === 'multi-swipe') body.n = 2;
        if (mode === 'group') h.setGroup('group-id');
        assert.equal(await dispatchMainRequest(h, body), 200);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH, mode);
        assert.deepEqual(h.logEntries, []);
        assertNoRequestMarker(h);
    }
});

test('markers never reach the server when switches change or the backend is missing', async () => {
    for (const mode of ['retry-off', 'background-off', 'both-off', 'backend-missing', 'old-backend', 'endpoint-missing']) {
        const h = await saveGenerateHarness({ install: true, modernBackend: mode !== 'old-backend',
            backendAvailable: mode !== 'backend-missing', responses: mode === 'endpoint-missing' ? [404, 200] : [200] });
        h.settings.generateRetryEnabled = false;
        const body = await prepareMainRequest(h);
        assert.ok(generateRequest.getGenerationRequestId(body), 'background needs a marker even without retry');
        if (mode === 'background-off' || mode === 'both-off') h.settings.saveGenerateEnabled = false;
        if (mode === 'background-off') h.settings.generateRetryEnabled = true;
        if (mode === 'old-backend') body.tools = h.body.tools;
        assert.equal(await dispatchMainRequest(h, body), 200, mode);
        assertNoRequestMarker(h);
        assert.equal(h.requests.at(-1).pathname, mode === 'retry-off'
            ? h.constants.BAIBAOKU_SAVE_GENERATE_URL : h.constants.SAVE_GENERATE_PATH, mode);
    }
});

test('Request input keeps its headers, signal and original body while removing network markers', async () => {
    for (const enabled of [false, true]) {
        const h = await saveGenerateHarness({ install: true, responses: enabled ? [200] : [503] });
        h.settings.saveGenerateEnabled = enabled;
        const body = await prepareMainRequest(h);
        const controller = new AbortController();
        const input = new Request('http://127.0.0.1:8000' + h.constants.SAVE_GENERATE_PATH, {
            method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json', 'X-Test': 'request' },
            signal: controller.signal,
        });
        const response = await h.context.fetch(input);
        await response.text();
        assert.equal(response.status, enabled ? 200 : 503, 'native Request inputs deliberately remain non-retryable');
        assert.equal(h.requests.length, 1);
        assertNoRequestMarker(h);
        const outgoing = new Request(new URL(h.requests[0].pathname, 'http://127.0.0.1:8000'),
            enabled ? h.requests[0].init : new Request(input, h.requests[0].init));
        assert.equal(outgoing.headers.get('X-Test'), 'request');
        assert.equal(outgoing.signal.aborted, false);
        controller.abort();
        assert.equal(outgoing.signal.aborted, true, 'request cancellation propagates');
        assert.equal(input.bodyUsed, false);
        assert.ok(generateRequest.getGenerationRequestId(await input.clone().json()));
    }
});

test('unmarked native request bytes and fetch options are left unchanged', async () => {
    const h = await saveGenerateHarness({ install: true });
    const init = { method: 'POST', body: '{ "type": "quiet", "messages": [] }',
        headers: { 'X-Test': 'unchanged' }, signal: new AbortController().signal };
    await h.context.fetch(h.constants.SAVE_GENERATE_PATH, init);
    assert.equal(h.requests[0].init, init);
});

test('raw text-completion endpoints also correlate once and strip their marker', async () => {
    const h = await saveGenerateHarness({ install: true, responses: [503, 200, 503, 200, 503, 200] });
    for (const path of [...h.constants.GENERATE_RETRY_PATHS].filter(path => path !== h.constants.SAVE_GENERATE_PATH)) {
        await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
        const body = { prompt: 'test raw prompt', streaming: true };
        await h.eventSource.emit(h.event_types.GENERATE_AFTER_DATA, body, false);
        body.temperature = 0.5; // Late text-completion preset change.
        const response = await h.context.fetch(path, { method: 'POST', body: JSON.stringify(body) });
        assert.equal(response.status, 200, path);
        assert.equal(h.requests.at(-1).pathname, path);
    }
    assert.equal(h.requests.length, 6);
    assertNoRequestMarker(h);
});

test('a native fallback also consumes the background claim, including ineligible payloads', async () => {
    for (const mode of ['unsupported-tool', 'type-mismatch', 'disabled']) {
        const h = await saveGenerateHarness({ install: true, responses: [200, 503] });
        const main = await prepareMainRequest(h);
        const actual = structuredClone(main);
        if (mode === 'unsupported-tool') actual.tools = [{ type: 'function', function: { name: 'search' } }];
        if (mode === 'type-mismatch') actual.type = 'quiet';
        if (mode === 'disabled') h.settings.saveGenerateEnabled = false;
        assert.equal(await dispatchMainRequest(h, actual), 200);
        h.settings.saveGenerateEnabled = true;
        assert.equal(h.saveState.saveGenerateIntent, null, mode);
        assert.equal(await dispatchMainRequest(h, main), 503, mode);
        assert.ok(h.requests.every(r => r.pathname === h.constants.SAVE_GENERATE_PATH));
        assertNoRequestMarker(h);
    }
});


// Routine paths stay silent, including Verbose; actual failures retain warnings.
test('blacklist native regenerate keeps prompt and reply contents out of the console', async () => {
    const h = await harness({ chat: [{ is_user: true, mes: 'PRIVATE_PROMPT_123' }], responses: ['PRIVATE_ACCEPTED_456'] });
    await h.begin();
    await h.finish('blocked PRIVATE_REPLY_789');
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.st.chat.at(-1).mes, 'PRIVATE_ACCEPTED_456');
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.logEntries, []);
});

test('blacklist wait polling is silent, uses one timer and warns once on timeout', async () => {
    const h = await harness();
    await h.begin();
    await h.finish('blocked', { streaming: true, holdSave: true });
    await h.advance(10_000);
    assert.deepEqual(h.logEntries, []);
    assert.equal(h.timers.size, 1);
    h.setFlag('isChatSaving', false);
    await h.advance(100);
    assert.deepEqual(h.logEntries, []);
    await h.advance(50_000);
    assert.equal(h.logEntries.length, 1);
    assert.equal(h.logEntries[0].level, 'warn');
    assert.ok(h.logEntries[0].args[0].includes('等待 ST 收尾超时：streamingProcessor'));
    assert.equal(h.work.maxPendingTimers, 1);
    assert.equal(h.run, null);
    assert.equal(h.calls.length, 0);
    assert.equal(h.timers.size, 0);
    const fired = h.work.timersFired;
    await h.advance(60_000);
    assert.equal(h.work.timersFired, fired, 'timeout leaves no idle polling');
    assert.equal(h.logEntries.length, 1);
});

test('absent floor and explicit target-message cancellation leave no retry or timer', async () => {
    for (const mode of ['no-floor', 'MESSAGE_UPDATED', 'MESSAGE_SWIPED', 'MESSAGE_DELETED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) {
        const h = await harness();
        await h.begin();
        if (mode === 'no-floor') {
            h.setFlag('is_send_press', false);
            await h.eventSource.emit(h.event_types.GENERATION_ENDED);
        } else {
            await h.finish('blocked');
            await h.eventSource.emit(h.event_types[mode], 1);
        }
        await h.advance(2000);
        assert.equal(h.calls.length, 0, mode);
        assert.equal(h.run, null, mode);
        assert.equal(h.timers.size, 0, mode);
        assert.deepEqual(h.logEntries, [], mode);
    }
});

test('blacklist skipped events and dry runs stay silent without scheduling checks', async () => {
    const h = await harness({ settings: { generateBlacklistRetryEnabled: false } });
    await h.begin();
    h.settings.generateBlacklistRetryEnabled = true;
    for (let floor = 0; floor < 100; floor++) await h.eventSource.emit(h.event_types.CHARACTER_MESSAGE_RENDERED, floor, 'normal');
    await h.eventSource.emit(h.event_types.GENERATION_ENDED);
    await h.begin();
    const run = h.run;
    await h.begin('normal', {}, true);
    assert.equal(h.run, run, 'dry run must preserve the active generation');
    await h.eventSource.emit(h.event_types.CHARACTER_MESSAGE_RENDERED, { mes: 'PRIVATE_EVENT_TEXT' }, 'normal');
    assert.deepEqual(h.logEntries, []);
    assert.equal(h.run.messageId, null);
    assert.equal(h.work.timersScheduled, 0);
});

test('background dispatch without an intent silently uses native fetch', async () => {
    const h = await saveGenerateHarness({ install: true });
    h.settings.generateRetryEnabled = false;
    assert.equal(await dispatchMainRequest(h, h.body), 200);
    assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH);
    assert.deepEqual(h.logEntries, []);
});

test('background intent cleared by end, stop or chat change cannot claim a dispatch', async () => {
    for (const event of ['GENERATION_ENDED', 'GENERATION_STOPPED', 'CHAT_CHANGED']) {
        const h = await saveGenerateHarness({ install: true });
        h.settings.generateRetryEnabled = false;
        const body = await prepareMainRequest(h);
        await h.eventSource.emit(h.event_types[event]);
        assert.equal(h.saveState.saveGenerateIntent, null);
        assert.equal(await dispatchMainRequest(h, body), 200);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH);
        assert.deepEqual(h.logEntries, []);
    }
});

test('background consumed intent stays cleared through end events and token-count dry runs', async () => {
    const h = await saveGenerateHarness({ install: true, responses: [200, 200] });
    h.settings.generateRetryEnabled = false;
    const body = await prepareMainRequest(h);
    assert.equal(await dispatchMainRequest(h, body), 200);
    assert.equal(h.requests[0].pathname, h.constants.BAIBAOKU_SAVE_GENERATE_URL);
    await h.eventSource.emit(h.event_types.GENERATION_ENDED);
    await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, true);
    assert.equal(h.saveState.saveGenerateIntent, null);
    assert.equal(await dispatchMainRequest(h, body), 200);
    assert.equal(h.requests[1].pathname, h.constants.SAVE_GENERATE_PATH);
    assert.deepEqual(h.logEntries, []);
});

test('background unsupported generation and preparation mismatch both fall back silently', async () => {
    for (const mode of ['unsupported', 'preparation']) {
        const h = await saveGenerateHarness({ install: true });
        h.settings.generateRetryEnabled = false;
        if (mode === 'unsupported') {
            await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'quiet', {}, false);
        } else {
            await h.eventSource.emit(h.event_types.GENERATION_AFTER_COMMANDS, 'normal', {}, false);
            await h.eventSource.emit(h.event_types.CHAT_COMPLETION_SETTINGS_READY, { ...h.body, type: 'quiet' });
        }
        assert.equal(await dispatchMainRequest(h, h.body), 200);
        assert.equal(h.requests[0].pathname, h.constants.SAVE_GENERATE_PATH);
        assert.deepEqual(h.logEntries, []);
    }
});

test('blacklist uses the real extensions context API through start, render, retry and unlock', async () => {
    const h = await harness({ streamingRetries: true });
    await h.begin();
    assert.ok(h.run, 'GENERATION_AFTER_COMMANDS must establish the blacklist run');
    await h.finish('blocked response', { streaming: true, holdSave: true });
    await h.advance(500);
    assert.equal(h.calls.length, 0, 'wait until native saving and streaming settle');
    h.setFlag('isChatSaving', false);
    h.st.streamingProcessor = null;
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].type, 'regenerate');
    assert.equal(h.st.chat.at(-1).mes, 'accepted');
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
    assert.deepEqual(h.logEntries, []);

    const cancelled = await harness();
    await cancelled.begin();
    await cancelled.finish('blocked');
    await cancelled.advance(100);
    assert.equal(cancelled.run.uiLocked, true);
    await cancelled.eventSource.emit(cancelled.event_types.GENERATION_STOPPED);
    assert.equal(cancelled.run, null, 'cancelling a pending retry also uses the real context API to unlock');
    assert.equal(cancelled.timers.size, 0);
    assert.equal(cancelled.calls.length, 0);
});


for (const streaming of [false, true]) {
    for (const soundFirst of [false, true]) {
        test(`completion sound waits for final acceptance (streaming=${streaming}, soundFirst=${soundFirst})`, async () => {
            const h = await harness({ streamingRetries: streaming, soundFirst,
                settings: { messageCompletionSoundEnabled: true } });
            await h.advance(1000); // The real clock is past the audio cooldown's zero baseline.
            await h.begin();
            await h.finish('blocked', { streaming });
            await h.advance(100);
            assert.equal(h.run.phase, 'waiting');
            assert.equal(h.soundPlays.length, 0, 'a reply scheduled for retry must not ring');
            await h.advance(1500);
            assert.equal(h.calls.length, 1);
            assert.equal(h.soundPlays.length, 0, 'the retry also waits for its own blacklist check');
            await h.advance(100);
            assert.equal(h.run, null);
            assert.equal(h.soundPlays.length, 1);
            await h.eventSource.emit(h.event_types.GENERATION_ENDED);
            await h.advance(3000);
            assert.equal(h.soundPlays.length, 1, 'repeated end events must not replay the notification');
        });
    }
    test(`completion sound rings once on an exhausted blacklist budget (streaming=${streaming})`, async () => {
        const h = await harness({ responses: ['blocked again', 'still blocked'], streamingRetries: streaming,
            settings: { messageCompletionSoundEnabled: true, generateRetryMaxRetries: 2 } });
        await h.advance(1000);
        await h.begin();
        await h.finish('blocked', { streaming });
        await h.advance(1700);
        assert.equal(h.calls.length, 1);
        assert.equal(h.soundPlays.length, 0);
        await h.advance(1600);
        assert.equal(h.calls.length, 2);
        assert.equal(h.run, null);
        assert.equal(h.st.chat.at(-1).mes, 'still blocked');
        assert.equal(h.soundPlays.length, 1);
    });
}

for (const mode of ['disabled', 'empty', 'accepted']) {
    test(`completion sound keeps normal completion behavior: ${mode}`, async () => {
        const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
        if (mode === 'disabled') h.settings.generateBlacklistRetryEnabled = false;
        if (mode === 'empty') h.settings.generateBlacklistRetryText = '';
        await h.advance(1000);
        await h.begin();
        await h.finish(mode === 'accepted' ? 'accepted' : 'blocked');
        await h.advance(200);
        assert.equal(h.calls.length, 0);
        assert.equal(h.soundPlays.length, 1);
    });
}

for (const mode of ['off', 'disable-while-waiting', 'disable-before-final-check']) {
    test(`completion sound never auto-plays when disabled: ${mode}`, async () => {
        const h = await harness({ settings: { messageCompletionSoundEnabled: mode !== 'off' } });
        await h.advance(1000);
        await h.begin();
        await h.finish('blocked');
        await h.advance(100);
        if (mode === 'disable-before-final-check') await h.advance(1500);
        h.settings.messageCompletionSoundEnabled = false;
        h.sound.applyMessageCompletionSound();
        await h.advance(4000);
        assert.equal(h.calls.length, 1, 'disabling sound must not cancel blacklist retries');
        assert.equal(h.run, null);
        assert.equal(h.soundPlays.length, 0);
        // Re-enabling does not play the old result or leave duplicate listeners.
        h.settings.messageCompletionSoundEnabled = true;
        h.sound.applyMessageCompletionSound();
        h.sound.applyMessageCompletionSound();
        await h.eventSource.emit(h.event_types.GENERATION_ENDED);
        await h.advance(100);
        assert.equal(h.soundPlays.length, 0);
        await h.begin('regenerate');
        await h.st.deleteLastMessage();
        await h.finish('accepted new generation');
        await h.advance(100);
        assert.equal(h.soundPlays.length, 1);
    });
}

test('completion sound also stays silent at the retry limit when its switch is off', async () => {
    const h = await harness({ responses: ['blocked'], settings: { generateRetryMaxRetries: 1 } });
    await h.advance(1000);
    await h.begin();
    await h.finish('blocked');
    await h.advance(4000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.run, null);
    assert.equal(h.soundPlays.length, 0);
});

for (const event of ['GENERATION_STOPPED', 'CHAT_CHANGED', 'MESSAGE_UPDATED']) {
    for (const soundFirst of [false, true]) {
        test(`completion sound discards a cancelled retry: ${event}, soundFirst=${soundFirst}`, async () => {
            const h = await harness({ soundFirst, settings: { messageCompletionSoundEnabled: true } });
            await h.advance(1000);
            await h.begin();
            await h.finish('blocked');
            await h.advance(100);
            await h.eventSource.emit(h.event_types[event], h.st.chat.length - 1);
            await h.eventSource.emit(h.event_types.GENERATION_ENDED);
            await h.advance(4000);
            assert.equal(h.run, null);
            assert.equal(h.calls.length, 0);
            assert.equal(h.soundPlays.length, 0, 'cancelling must not turn button-unlock end events into a completion');
            assert.equal(h.extensionState.messageCompletionSound.waitingForBlacklist, false);
        });
    }
}

for (const soundFirst of [false, true]) {
    test(`completion sound belongs to the new manual generation, not the cancelled chain (soundFirst=${soundFirst})`, async () => {
        const h = await harness({ soundFirst, settings: { messageCompletionSoundEnabled: true } });
        await h.advance(1000);
        await h.begin();
        await h.finish('blocked');
        await h.advance(100);
        await h.begin('regenerate');
        await h.st.deleteLastMessage();
        await h.finish('accepted manual retry');
        await h.advance(200);
        assert.equal(h.calls.length, 0);
        assert.equal(h.soundPlays.length, 1);
    });
}

test('completion sound waits for stream/save cleanup and preserves pending notification across dry runs', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    await h.advance(1000);
    await h.begin();
    await h.finish('accepted', { streaming: true, holdSave: true });
    await h.advance(2500);
    assert.equal(h.soundPlays.length, 0);
    await h.begin('normal', {}, true);
    h.setFlag('isChatSaving', false);
    h.st.streamingProcessor = null;
    await h.advance(100);
    assert.equal(h.soundPlays.length, 1);
});

test('completion sound never treats a dry run or a manually stopped generation as completion', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    await h.advance(1000);
    await h.begin('normal', {}, true);
    await h.eventSource.emit(h.event_types.GENERATION_ENDED);
    await h.advance(100);
    assert.equal(h.soundPlays.length, 0);
    await h.begin();
    await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
    await h.finish('accepted partial reply');
    await h.advance(2000);
    assert.equal(h.soundPlays.length, 0);
});

test('completion sound handles exhausted shared HTTP/blacklist budget', async () => {
    const h = await harness({ apiResponses: [503, 'blocked'],
        settings: { messageCompletionSoundEnabled: true, generateRetryMaxRetries: 1 } });
    await h.advance(1000);
    await h.begin();
    const pending = h.requestReply();
    await setImmediate(); // Let the mocked fetch schedule its retry before advancing the clock.
    await h.advance(3000);
    await h.finish(await pending);
    assert.equal(h.soundPlays.length, 0);
    await h.advance(100);
    assert.equal(h.calls.length, 0, 'HTTP retries already spent the shared budget');
    assert.equal(h.run, null);
    assert.equal(h.soundPlays.length, 1);
});

test('completion sound rechecks its switch after async audio loading, while explicit preview still works', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    await h.advance(1000);
    const pending = h.sound.playSelectedMessageCompletionSound();
    h.settings.messageCompletionSoundEnabled = false;
    h.sound.applyMessageCompletionSound();
    assert.equal(await pending, false);
    assert.equal(h.soundPlays.length, 0);
    assert.equal(await h.sound.playSelectedMessageCompletionSound({ preview: true }), true);
    assert.equal(h.soundPlays.length, 1);
});

for (const outcome of ['accepted', 'stopped', 'disabled', 'timeout']) {
    test(`mobile silent keep-alive survives blacklist waiting and is cleaned up: ${outcome}`, async () => {
        const h = await harness({ mobile: true, settings: { messageCompletionSoundEnabled: true } });
        await h.advance(1000);
        await h.begin();
        await h.finish('blocked', { holdSave: outcome === 'timeout' });
        await h.advance(100);
        const state = h.extensionState.messageCompletionSound;
        assert.equal(state.keepAlivePlaying, true);
        assert.equal(state.keepAliveAudio.paused, false);
        assert.equal(h.soundPlays.length, 0);
        if (outcome === 'stopped') await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
        if (outcome === 'disabled') {
            h.settings.messageCompletionSoundEnabled = false;
            h.sound.applyMessageCompletionSound();
        }
        await h.advance(outcome === 'timeout' ? 60_000 : 4000);
        assert.equal(state.keepAlivePlaying, false);
        assert.equal(state.keepAliveRequested, false);
        assert.equal(state.keepAliveAudio.paused, true);
        assert.equal(h.soundPlays.length, outcome === 'accepted' ? 1 : 0);
    });
}


test('normal retry and completion sound run without process diagnostics', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    await h.advance(1000);
    await h.begin();
    await h.finish('blocked');
    await h.advance(2000);
    assert.equal(h.calls.length, 1);
    assert.equal(h.soundPlays.length, 1);
    assert.deepEqual(h.logEntries, [], 'routine paths must not log, including at Verbose level');
});

test('disabled blacklist avoids reading settings text or constructing a chat context', async () => {
    const h = await harness({ settings: { generateBlacklistRetryEnabled: false } });
    Object.defineProperty(h.settings, 'generateBlacklistRetryText', {
        get() { assert.fail('disabled blacklist must not parse its text'); },
    });
    await h.begin();
    await h.finish('accepted');
    await h.advance(1000);
    assert.equal(h.work.contextReads, 0);
    assert.equal(h.work.timersScheduled, 0);
    assert.equal(h.run, null);
});


test('repeated blacklist install and sound toggles never accumulate event listeners', async () => {
    const h = await harness();
    const events = [...Object.values(h.event_types), GENERATE_BLACKLIST_SETTLED_EVENT];
    const counts = () => events.map(event => h.eventSource.listenerCount(event));
    const disabled = counts();
    h.settings.messageCompletionSoundEnabled = true;
    h.sound.applyMessageCompletionSound();
    const enabled = counts();
    assert.equal(h.eventSource.listenerCount(GENERATE_BLACKLIST_SETTLED_EVENT), 1);
    for (let i = 0; i < 100; i++) {
        h.feature.installGenerateBlacklistRetry();
        h.sound.applyMessageCompletionSound();
        assert.deepEqual(counts(), enabled);
        h.settings.messageCompletionSoundEnabled = false;
        h.sound.applyMessageCompletionSound();
        assert.deepEqual(counts(), disabled);
        h.settings.messageCompletionSoundEnabled = true;
        h.sound.applyMessageCompletionSound();
        assert.deepEqual(counts(), enabled);
    }
    assert.equal(h.work.timersScheduled, 0);
    await h.advance(1000);
    await h.begin();
    await h.finish('accepted');
    await h.advance(200);
    assert.equal(h.soundPlays.length, 1);
    assert.equal(h.timers.size, 0);
});

test('repeated completion, retry and cancellation cycles leave no background work', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    const events = [...Object.values(h.event_types), GENERATE_BLACKLIST_SETTLED_EVENT];
    const counts = events.map(event => h.eventSource.listenerCount(event));
    for (let i = 0; i < 90; i++) {
        await h.advance(1000);
        await h.begin();
        await h.finish(i % 3 === 0 ? 'accepted' : 'blocked');
        if (i % 3 === 2) {
            await h.advance(100);
            await h.eventSource.emit(h.event_types.GENERATION_STOPPED);
        }
        await h.advance(2000);
        assert.equal(h.run, null);
        assert.equal(h.extensionState.generateBlacklistRetry.timer, null);
        assert.equal(h.timers.size, 0);
        assert.deepEqual(events.map(event => h.eventSource.listenerCount(event)), counts);
    }
    assert.equal(h.calls.length, 30);
    assert.equal(h.soundPlays.length, 60);
    assert.equal(h.work.maxPendingTimers, 1);
    const work = { ...h.work };
    await h.advance(600_000);
    assert.deepEqual(h.work, work, 'nothing runs after the last cycle finishes');
    assert.deepEqual(h.logEntries, []);
});

test('idle render and end event bursts do not construct contexts or schedule timers', async () => {
    const h = await harness({ settings: { messageCompletionSoundEnabled: true } });
    for (let floor = 0; floor < 2000; floor++) {
        await h.eventSource.emit(h.event_types.CHARACTER_MESSAGE_RENDERED, floor, 'normal');
        await h.eventSource.emit(h.event_types.GENERATION_ENDED);
    }
    assert.equal(h.work.contextReads, 0);
    assert.equal(h.work.timersScheduled, 0);
    assert.equal(h.soundPlays.length, 0);
    assert.deepEqual(h.logEntries, []);
});

test('blacklist scans only the latest generated body, never historical messages', async () => {
    const chat = Array.from({ length: 10_000 }, () => ({
        is_user: true,
        get mes() { throw new Error('historical body must not be scanned'); },
    }));
    const h = await harness({ chat, settings: { messageCompletionSoundEnabled: true } });
    await h.advance(1000);
    await h.begin();
    await h.finish('accepted');
    await h.advance(200);
    assert.equal(h.calls.length, 0);
    assert.equal(h.soundPlays.length, 1);
    assert.equal(h.run, null);
    assert.equal(h.timers.size, 0);
    assert.equal(h.work.timersFired, 1);
    assert.deepEqual(h.logEntries, []);
});
