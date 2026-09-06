import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { setImmediate } from 'node:timers/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'espree';

// Real frontend modules, in-memory API responses only. Never contact ST or delete real backups.
async function loadModule(file, context, mocks) {
    const code = await readFile(new URL(`../src/preset/${file}`, import.meta.url), 'utf8');
    const imports = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body
        .filter(node => node.type === 'ImportDeclaration');
    const dependencies = new Map();
    const module = new vm.SourceTextModule(code, {
        context, identifier: file,
        initializeImportMeta: meta => { meta.url = new URL(`../src/preset/${file}`, import.meta.url).href; },
    });
    await module.link(source => {
        if (!dependencies.has(source)) {
            const values = mocks[source] || {};
            const names = new Set(Object.keys(values));
            for (const entry of imports.filter(entry => entry.source.value === source)) {
                for (const specifier of entry.specifiers) {
                    if (specifier.type === 'ImportSpecifier') names.add(specifier.imported.name);
                }
            }
            dependencies.set(source, new vm.SyntheticModule([...names], function () {
                for (const name of names) this.setExport(name, values[name]);
            }, { context }));
        }
        return dependencies.get(source);
    });
    await module.evaluate();
    return module.namespace;
}

const constants = {
    PRESET_BACKUP_PREVIEW_LIST_URL: '/backups/list',
    PRESET_BACKUP_PREVIEW_DELETE_URL: '/backups/delete',
    PRESET_BACKUP_PREVIEW_NOTE_URL: '/backups/note',
    PRESET_BACKUP_SAVE_URL: '/backups/save',
    PRESET_SAVE_URL: '/api/presets/save',
    PRESET_AUTO_BACKUP_FETCH_KEY: '__backupFetch',
    PRESET_BACKUP_PREVIEW_APP_KEY: '__preview',
    PRESET_BACKUP_PREVIEW_PAGE_SIZE: 5,
};
const item = (id, note = '') => ({
    fileName: `${id}.json`, showName: 'preset',
    createdAt: new Date(1_700_000_000_000 + id * 1000).toISOString(), note,
});
const json = (data, status = 200) => new Response(JSON.stringify({ ok: status < 400, data }), { status });
const deferred = () => {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
};

async function harness(options = {}) {
    const settings = {
        presetAutoBackupEnabled: true,
        presetBackupAutoCleanupEnabled: true,
        presetBackupKeepCount: 2,
        ...options.settings,
    };
    const extensionState = { __preview: { state: {} } };
    const state = { items: options.items || [item(1), item(2), item(3)] };
    const calls = [];
    const deleted = [];
    const notices = [];
    const events = [];
    const confirmations = [];
    let saved = 0;
    const document = new EventTarget();
    document.addEventListener('bai-bai-preset-backups-cleaned', event => events.push(event.detail));
    const fetch = async (url, init) => {
        const body = JSON.parse(init.body);
        calls.push({ url, body });
        const override = await options.fetch?.(url, body, state);
        if (override) return override;
        if (url === constants.PRESET_BACKUP_PREVIEW_LIST_URL) return json({ items: state.items });
        if (url === constants.PRESET_BACKUP_PREVIEW_DELETE_URL) {
            deleted.push(body.fileName);
            state.items = state.items.filter(entry => entry.fileName !== body.fileName);
            return json({ fileName: body.fileName, deleted: true });
        }
        if (url === constants.PRESET_BACKUP_PREVIEW_NOTE_URL) {
            const entry = state.items.find(entry => entry.fileName === body.fileName);
            entry.note = body.note;
            return json(entry);
        }
        if (url === constants.PRESET_BACKUP_SAVE_URL) return json(item(3));
        if (url === constants.PRESET_SAVE_URL) return json({ name: body.name });
        throw new Error(`Unexpected request: ${url}`);
    };
    const context = vm.createContext({
        fetch, document, CustomEvent, AbortController, setTimeout, clearTimeout, URL, Request,
        location: new URL('http://localhost/'),
        console: { warn() {}, debug() {} },
        toastr: { warning: (...args) => notices.push(args) },
    });
    const mocks = {
        '@sillytavern/script': { getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) },
        '@sillytavern/scripts/popup': {
            POPUP_TYPE: { CONFIRM: 1 }, POPUP_RESULT: { AFFIRMATIVE: 1 },
            callGenericPopup: async content => {
                confirmations.push(content);
                return options.confirm ? options.confirm(content, state) : 1;
            },
        },
        './constants.js': constants,
        './state.js': {
            settings, extensionState, LOG_PREFIX: '[test]',
            savePresetOptimizationSettings: () => { saved++; },
        },
    };
    const retention = await loadModule('backupRetention.js', context, mocks);
    mocks['./backupRetention.js'] = retention;
    const autoBackup = await loadModule('autoBackup.js', context, mocks);
    mocks['./autoBackup.js'] = autoBackup;
    const preview = await loadModule('backupPreview.js', context, mocks);
    return {
        retention, autoBackup, preview, settings, extensionState, state, calls, deleted,
        notices, events, confirmations, fetch, context, get saved() { return saved; },
    };
}

test('retains newest N ordinary backups across presets, excludes notes, deterministic ties', async () => {
    const { retention } = await harness();
    const items = [item(5, 'important'), item(1), item(4), item(2, ' \n '), item(3)];
    const original = JSON.stringify(items);
    const plan = retention.getPresetBackupCleanupPlan(items, 2);
    assert.equal(plan.ordinaryCount, 4);
    assert.equal(plan.protectedCount, 1);
    assert.deepEqual(Array.from(plan.targets, entry => entry.fileName), ['1.json', '2.json']);
    assert.equal(JSON.stringify(items), original);
    const tied = [item(1), { ...item(1), fileName: '2.json' }];
    assert.equal(retention.getPresetBackupCleanupPlan(tied, 1).targets[0].fileName, '1.json');
    assert.equal(retention.getPresetBackupCleanupPlan(tied.reverse(), 1).targets[0].fileName, '1.json');
});

test('invalid counts cannot enable cleanup or silently turn into a destructive default', async () => {
    for (const count of [0, -1, 1.5, NaN, Infinity, '2', null, Number.MAX_SAFE_INTEGER + 1]) {
        const h = await harness();
        await assert.rejects(h.retention.changePresetBackupRetentionSettings(true, count));
        assert.equal(h.calls.length, 0);
        assert.equal(h.saved, 0);
    }
});

test('rejects malformed, duplicate, unknown-note and unsafe metadata before any deletion', async () => {
    const invalidRows = [
        null, { ...item(1), note: undefined }, { ...item(1), note: null },
        { ...item(1), createdAt: 'invalid' }, { ...item(1), createdAt: null },
        { ...item(1), fileName: '../1.json' }, { ...item(1), fileName: 'a\\1.json' },
        { ...item(1), fileName: 'index.json' }, { ...item(1), fileName: '' },
        item(3),
    ];
    for (const row of invalidRows) {
        const h = await harness({ items: [item(2), item(3), row], settings: { presetBackupKeepCount: 1 } });
        await h.retention.schedulePresetBackupCleanup();
        assert.equal(h.deleted.length, 0);
        assert.equal(h.notices.length, 1);
    }
});

test('disabled cleanup makes no requests; defaults do not remove existing backups on load', async () => {
    const h = await harness({ settings: { presetBackupAutoCleanupEnabled: false } });
    await h.retention.schedulePresetBackupCleanup();
    assert.equal(h.calls.length, 0);
    const source = await readFile(new URL('../src/features/state.js', import.meta.url), 'utf8');
    assert.match(source, /presetBackupAutoCleanupEnabled:\s*true/);
    assert.match(source, /presetBackupKeepCount:\s*200/);
});

test('cleanup deletes only excess ordinary backups and notifies the list', async () => {
    const h = await harness({ items: [item(4), item(1, 'keep'), item(3), item(2)] });
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['2.json']);
    assert.deepEqual(Array.from(h.events[0].deletedFileNames), ['2.json']);
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['2.json']);
});

test('all protected backups are preserved even beyond the ordinary quota', async () => {
    const h = await harness({ items: [item(1, 'a'), item(2, 'b'), item(3, 'c')] });
    await h.retention.schedulePresetBackupCleanup();
    assert.equal(h.deleted.length, 0);
});

test('first enable previews counts; cancel and popup close do not persist or delete', async () => {
    for (const result of [0, null, undefined]) {
        const h = await harness({
            settings: { presetBackupAutoCleanupEnabled: false },
            items: [item(1), item(2), item(3), item(4, 'important')],
            confirm: () => result,
        });
        assert.equal(await h.retention.changePresetBackupRetentionSettings(true, 2), false);
        assert.match(h.confirmations[0], /<strong>1<\/strong>/);
        assert.equal(h.settings.presetBackupAutoCleanupEnabled, false);
        assert.equal(h.saved, 0);
        assert.equal(h.deleted.length, 0);
    }
});

test('confirmed enable persists and refetches notes before immediate cleanup', async () => {
    const h = await harness({
        settings: { presetBackupAutoCleanupEnabled: false },
        confirm: (_, state) => { state.items[0].note = 'protected during confirmation'; return 1; },
    });
    assert.equal(await h.retention.changePresetBackupRetentionSettings(true, 2), true);
    await setImmediate();
    assert.equal(h.saved, 1);
    assert.equal(h.deleted.length, 0);
    assert.equal(h.calls.filter(call => call.url === constants.PRESET_BACKUP_PREVIEW_LIST_URL).length, 2);
});

test('lowering active quota requires confirmation; raising or changing disabled quota does not delete', async () => {
    const cancelled = await harness({ confirm: () => 0 });
    await cancelled.retention.changePresetBackupRetentionSettings(true, 1);
    assert.equal(cancelled.settings.presetBackupKeepCount, 2);
    assert.equal(cancelled.deleted.length, 0);
    const accepted = await harness();
    await accepted.retention.changePresetBackupRetentionSettings(true, 1);
    await accepted.retention.schedulePresetBackupCleanup();
    assert.deepEqual(accepted.deleted, ['1.json', '2.json']);
    const raised = await harness();
    await raised.retention.changePresetBackupRetentionSettings(true, 4);
    assert.equal(raised.calls.length, 0);
    const disabled = await harness({ settings: { presetBackupAutoCleanupEnabled: false } });
    await disabled.retention.changePresetBackupRetentionSettings(false, 1);
    assert.equal(disabled.calls.length, 0);
});

test('failed confirmation-list request leaves settings unchanged', async () => {
    const h = await harness({
        settings: { presetBackupAutoCleanupEnabled: false },
        fetch: () => json({}, 500),
    });
    await assert.rejects(h.retention.changePresetBackupRetentionSettings(true, 1));
    assert.equal(h.saved, 0);
    assert.equal(h.settings.presetBackupAutoCleanupEnabled, false);
    assert.equal(h.deleted.length, 0);
});

test('HTTP failures, malformed JSON and false success responses never trigger deletes', async () => {
    for (const response of [
        () => json({}, 500), () => new Response('bad json'),
        () => new Response('{"ok":false,"data":{"items":[]}}'),
        () => json({}), () => json({ items: null }),
    ]) {
        const h = await harness({ fetch: url => url === constants.PRESET_BACKUP_PREVIEW_LIST_URL ? response() : undefined });
        await h.retention.schedulePresetBackupCleanup();
        assert.equal(h.deleted.length, 0);
        assert.equal(h.notices.length, 1);
    }
});

test('stops after a deletion failure, reports partial deletions, retries on next trigger', async () => {
    let fail = true;
    const h = await harness({
        items: [item(1), item(2), item(3), item(4)],
        settings: { presetBackupKeepCount: 1 },
        fetch: (url, body) => url === constants.PRESET_BACKUP_PREVIEW_DELETE_URL && body.fileName === '2.json' && fail
            ? json({}, 500) : undefined,
    });
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['1.json']);
    assert.deepEqual(Array.from(h.events[0].deletedFileNames), ['1.json']);
    assert.equal(h.notices.length, 1);
    fail = false;
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['1.json', '2.json', '3.json']);
});

test('coalesces simultaneous triggers and checks again if a backup arrives mid-pass', async () => {
    const gate = deferred();
    let blocked = false;
    const h = await harness({
        fetch: async url => {
            if (url === constants.PRESET_BACKUP_PREVIEW_LIST_URL && !blocked) {
                blocked = true;
                await gate.promise;
            }
        },
    });
    const first = h.retention.schedulePresetBackupCleanup();
    assert.equal(h.retention.schedulePresetBackupCleanup(), first);
    await setImmediate();
    h.state.items.push(item(4));
    assert.equal(h.retention.schedulePresetBackupCleanup(), first);
    gate.resolve();
    await first;
    assert.deepEqual(h.deleted, ['1.json', '2.json']);
    assert.equal(h.calls.filter(call => call.url === constants.PRESET_BACKUP_PREVIEW_LIST_URL).length, 2);
});

test('disabling while deleting waits for the active request and cancels remaining deletions', async () => {
    const gate = deferred();
    const h = await harness({
        settings: { presetBackupKeepCount: 1 },
        fetch: async url => { if (url === constants.PRESET_BACKUP_PREVIEW_DELETE_URL) await gate.promise; },
    });
    const cleaning = h.retention.schedulePresetBackupCleanup();
    await setImmediate();
    const change = h.retention.changePresetBackupRetentionSettings(false, 1);
    gate.resolve();
    await Promise.all([cleaning, change]);
    assert.deepEqual(h.deleted, ['1.json']);
    assert.equal(h.settings.presetBackupAutoCleanupEnabled, false);
});

test('open note dialog pauses cleanup; real queued note save protects a backup', async () => {
    const h = await harness();
    h.extensionState.__preview.state.noteDialogOpen = true;
    await h.retention.schedulePresetBackupCleanup();
    assert.equal(h.calls.length, 0);
    h.extensionState.__preview.state.noteDialogOpen = false;
    const note = h.preview.updatePresetBackupPreviewNote('1.json', 'keep');
    const cleanup = h.retention.schedulePresetBackupCleanup();
    await Promise.all([note, cleanup]);
    assert.equal(h.deleted.length, 0);
    assert.equal(h.state.items[0].note, 'keep');
});

test('save must be acknowledged before automatic cleanup, including rename flush', async () => {
    for (const response of [
        () => json({}, 500), () => new Response('bad'),
        () => new Response('{"ok":false,"data":{"fileName":"3.json"}}'),
        () => new Response('{"ok":true,"error":"failed","data":{"fileName":"3.json"}}'),
        () => json({}), () => json({ fileName: '' }),
    ]) {
        const h = await harness();
        await h.autoBackup.sendPresetAutoBackup({ originalFetch: response }, { name: 'preset', preset: {} });
        await setImmediate();
        assert.equal(h.calls.length, 0);
    }
    const h = await harness();
    await h.autoBackup.sendPresetAutoBackup({ originalFetch: h.fetch }, { name: 'preset', preset: {} });
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['1.json']);
    h.state.items.push(item(4));
    h.autoBackup.beginPresetRenameBackupSuppression();
    h.autoBackup.capturePresetRenameBackupBodySync(h.context.__backupFetch, { name: 'renamed', preset: {} });
    h.autoBackup.flushPresetRenameBackup();
    await setImmediate();
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['1.json', '2.json']);
});

test('a slow backup does not block the original preset save', async () => {
    const gate = deferred();
    const h = await harness({
        fetch: async url => url === constants.PRESET_BACKUP_SAVE_URL ? gate.promise : undefined,
    });
    h.autoBackup.installPresetAutoBackupFetchHook();
    const response = await h.context.fetch(constants.PRESET_SAVE_URL, {
        method: 'POST', body: JSON.stringify({ name: 'preset', preset: {} }),
    });
    assert.equal(response.ok, true);
    assert.equal(h.deleted.length, 0);
    gate.resolve(json(item(3)));
    await setImmediate();
    await h.retention.schedulePresetBackupCleanup();
    assert.deepEqual(h.deleted, ['1.json']);
});

test('preview counts and deletion events keep selection consistent', async () => {
    const h = await harness();
    const model = h.preview.createPresetBackupPreviewModel();
    model.items = [item(1), item(2, 'keep')];
    model.selectedFileNames = ['1.json', '2.json'];
    const component = h.preview.createPresetBackupPreviewRootComponent({ h() {} }, model);
    assert.equal(component.computed.protectedCount.call(model), 1);
    component.methods.onBackupsCleaned.call(model, { detail: { deletedFileNames: ['1.json'] } });
    assert.deepEqual(Array.from(model.items, entry => entry.fileName), ['2.json']);
    assert.deepEqual(Array.from(model.selectedFileNames), ['2.json']);
});

test('manual batch deletion keeps its concurrent workers', async () => {
    const gate = deferred();
    let started = 0;
    const h = await harness({
        fetch: async url => {
            if (url === constants.PRESET_BACKUP_PREVIEW_DELETE_URL) {
                started++;
                await gate.promise;
            }
        },
    });
    const requests = ['1.json', '2.json'].map(name => h.preview.deletePresetBackupPreviewItem(name));
    await setImmediate();
    assert.equal(started, 2);
    gate.resolve();
    await Promise.all(requests);
});

test('real settings initialization enables cleanup by default but preserves a saved opt-out', async () => {
    for (const existing of [{}, { presetBackupAutoCleanupEnabled: false }]) {
        const extension_settings = { toolkit: { ...existing } };
        const state = await loadModule('../features/state.js', vm.createContext({ URL }), {
            '@sillytavern/script': { saveSettingsDebounced() {} },
            '@sillytavern/scripts/extensions': { extension_settings },
            './constants.js': { SETTINGS_KEY: 'toolkit', EXTENSION_KEY: '__toolkit', SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY: '__migration' },
        });
        state.initializeSettings();
        assert.equal(state.settings.presetBackupAutoCleanupEnabled, existing.presetBackupAutoCleanupEnabled !== false);
        assert.equal(state.settings.presetBackupKeepCount, 200);
    }
});

test('default-enabled cleanup below or at the limit does not prompt, delete or save settings', async () => {
    for (const items of [[item(1)], [item(1), item(2)]]) {
        const h = await harness({ items });
        await h.retention.schedulePresetBackupCleanup();
        assert.equal(h.confirmations.length, 0);
        assert.equal(h.deleted.length, 0);
        assert.equal(h.saved, 0);
    }
});

test('automatic overflow and repeated saves at the quota clean silently regardless of legacy consent', async () => {
    for (const confirmed of [undefined, false, true]) {
        const h = await harness({
            items: [item(0, 'protected'), item(1), item(2), item(3)],
            settings: { presetBackupCleanupConfirmed: confirmed },
        });
        await h.retention.schedulePresetBackupCleanup();
        assert.deepEqual(h.deleted, ['1.json']);
        for (let id = 4; id <= 6; id++) {
            h.state.items.push(item(id));
            await h.autoBackup.sendPresetAutoBackup({ originalFetch: h.fetch }, { name: 'preset', preset: {} });
            await setImmediate();
            assert.deepEqual(h.state.items.map(entry => entry.fileName), ['0.json', `${id - 1}.json`, `${id}.json`]);
        }
        assert.deepEqual(h.deleted, ['1.json', '2.json', '3.json', '4.json']);
        assert.equal(h.settings.presetBackupAutoCleanupEnabled, true);
        assert.equal(h.confirmations.length, 0);
        assert.equal(h.notices.length, 0);
        assert.equal(h.saved, 0);

        const reloaded = await harness({ settings: h.settings, items: [...h.state.items, item(7)] });
        await reloaded.retention.schedulePresetBackupCleanup();
        assert.deepEqual(reloaded.deleted, ['5.json']);
        assert.equal(reloaded.confirmations.length, 0);
        assert.equal(reloaded.notices.length, 0);
        assert.equal(reloaded.saved, 0);
    }
});
