import { event_types, eventSource, getRequestHeaders } from '@sillytavern/script';
import { oai_settings } from '@sillytavern/scripts/openai';
import { schedulePresetBackupCleanup } from './backupRetention.js';
import { PRESET_AUTO_BACKUP_FETCH_KEY, PRESET_AUTO_BACKUP_RENAME_HANDLER_KEY, PRESET_BACKUP_SAVE_URL, PRESET_RENAME_SAVE_GATE_TIMEOUT_MS, PRESET_SAVE_URL } from './constants.js';
import { clearPendingPresetPromptChangesForSavedRevision, getPresetPromptSaveRevision } from './pendingChanges.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';
let presetAutoBackupBackendAvailable = true;

function applyPresetAutoBackup() {
    installPresetAutoBackupFetchHook();
    installPresetRenameBackupSuppressionListener();
}

// 独立监听 PRESET_RENAMED_BEFORE 来开启备份抑制窗口,只依赖自动备份本身是否可用,
// 与分组开关解耦(分组关闭、仅装了后端柏宝库时也能去重)。窗口关闭由 update guard 驱动。
function installPresetRenameBackupSuppressionListener() {
    if (extensionState[PRESET_AUTO_BACKUP_RENAME_HANDLER_KEY] || !event_types.PRESET_RENAMED_BEFORE) {
        return;
    }

    const handler = (event) => {
        if (event?.apiId !== 'openai' || !event.oldName || !event.newName) {
            return;
        }

        beginPresetRenameBackupSuppression();
    };

    extensionState[PRESET_AUTO_BACKUP_RENAME_HANDLER_KEY] = handler;
    eventSource.on(event_types.PRESET_RENAMED_BEFORE, handler);
}

function setPresetAutoBackupBackendAvailable(available) {
    presetAutoBackupBackendAvailable = available !== false;
    installPresetAutoBackupFetchHook();
}

function installPresetAutoBackupFetchHook() {
    const existing = globalThis[PRESET_AUTO_BACKUP_FETCH_KEY];

    if (existing?.wrappedFetch) {
        existing.isEnabled = () => settings.presetAutoBackupEnabled !== false && presetAutoBackupBackendAvailable;
        existing.skipCount = Number(existing.skipCount) || 0;
        return existing;
    }

    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        skipCount: 0,
        isEnabled: () => settings.presetAutoBackupEnabled !== false && presetAutoBackupBackendAvailable,
    };

    state.wrappedFetch = function baiBaiToolkitPresetAutoBackupFetch(input, init) {
        const isPresetSaveRequest = isPresetAutoBackupSourceRequest(input, init);
        const presetSaveBody = isPresetSaveRequest ? readPresetSaveBodySync(init) : null;

        if (state.isEnabled() && isPresetSaveRequest) {
            if (state.renameSuppress) {
                // 重命名进行中:不立即备份,只同步记住最后一次保存内容,窗口关闭时再补一次。
                capturePresetRenameBackupBodySync(state, presetSaveBody);
            } else if (state.skipCount > 0) {
                state.skipCount -= 1;
            } else {
                void schedulePresetAutoBackupFromRequest(state, input, init, presetSaveBody);
            }
        }

        const requestPromise = state.originalFetch(input, init);

        if (isOpenAiPresetSaveBody(presetSaveBody)) {
            trackOpenAiPresetSaveRequest(state, presetSaveBody, requestPromise);
        }

        return requestPromise;
    };

    state.wrappedFetch[PRESET_AUTO_BACKUP_FETCH_KEY] = true;
    globalThis[PRESET_AUTO_BACKUP_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function skipNextPresetAutoBackup() {
    const state = installPresetAutoBackupFetchHook();

    if (state) {
        state.skipCount += 1;
    }

    return state;
}

function isPresetAutoBackupSourceRequest(input, init) {
    if (getPresetAutoBackupFetchMethod(input, init) !== 'POST') {
        return false;
    }

    const url = getPresetAutoBackupFetchUrl(input);

    if (!url) {
        return false;
    }

    if (!url.includes(PRESET_SAVE_URL)) {
        return false;
    }

    try {
        return new URL(url, location.href).pathname === PRESET_SAVE_URL;
    } catch {
        return false;
    }
}

async function schedulePresetAutoBackupFromRequest(state, input, init, parsedBody = null) {
    const body = parsedBody ?? await readPresetAutoBackupJsonBody(input, init);

    if (!isPresetAutoBackupBody(body)) {
        return;
    }

    await sendPresetAutoBackup(state, body);
}

async function sendPresetAutoBackup(state, body) {
    try {
        const response = await state.originalFetch(PRESET_BACKUP_SAVE_URL, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (payload?.ok !== true || payload.error
            || typeof payload.data?.fileName !== 'string' || !payload.data.fileName.trim()) {
            throw new Error('Preset backup save was not confirmed');
        }
        void schedulePresetBackupCleanup();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to create preset auto backup`, error);
    }
}

// 重命名期间会连续触发多次 /api/presets/save(ST 的"先建空预设→写回扩展→update 落盘"流程)。
// 这里开一个抑制窗口:窗口内不逐次备份,只同步记住最后一次保存的内容;窗口由事件关闭
// (update 收尾 click,见 installPresetUpdatePendingChangesGuard),关闭时只补一次最终结果备份。
// 全程不依赖定时器。
function beginPresetRenameBackupSuppression() {
    const state = installPresetAutoBackupFetchHook();

    if (!state) {
        return;
    }

    state.renameSuppress = { lastBody: null };
}

// 同步记录本次保存内容。重命名期间的所有 /save 的 init.body 都是 JSON 字符串,可直接解析。
function capturePresetRenameBackupBodySync(state, body) {
    if (!state.renameSuppress) {
        return;
    }

    if (isPresetAutoBackupBody(body)) {
        state.renameSuppress.lastBody = body;
    }
}

function readPresetSaveBodySync(init) {
    try {
        const raw = init && typeof init.body === 'string' ? init.body : null;
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function isOpenAiPresetSaveBody(body) {
    return Boolean(isPresetAutoBackupBody(body) && body.apiId === 'openai');
}

function trackOpenAiPresetSaveRequest(state, body, requestPromise) {
    if (!(state.activeOpenAiPresetSaveRequests instanceof Map)) {
        state.activeOpenAiPresetSaveRequests = new Map();
    }

    const presetName = body.name;
    const requests = state.activeOpenAiPresetSaveRequests.get(presetName) ?? new Set();
    // The caller still has post-fetch work (response.json + in-memory preset cache updates).
    // Keep the request active through the next task so rename cannot overtake that continuation.
    const trackedPromise = Promise.resolve(requestPromise).then(
        response => new Promise(resolve => setTimeout(resolve, 0, response)),
        error => new Promise((_, reject) => setTimeout(reject, 0, error)),
    );
    requests.add(trackedPromise);
    state.activeOpenAiPresetSaveRequests.set(presetName, requests);

    const renameGate = getOpenAiPresetRenameSaveGate();

    if (renameGate && (presetName === renameGate.oldName || presetName === renameGate.newName)) {
        renameGate.latestSaveRequest = {
            presetName,
            revision: getPresetPromptSaveRevision(presetName),
            promise: trackedPromise,
        };
    }

    const cleanup = () => {
        requests.delete(trackedPromise);

        if (!requests.size) {
            state.activeOpenAiPresetSaveRequests.delete(presetName);
        }
    };

    trackedPromise.then(cleanup, cleanup);
}

function getActiveOpenAiPresetSaveRequests(presetName) {
    const state = globalThis[PRESET_AUTO_BACKUP_FETCH_KEY];
    const requests = state?.activeOpenAiPresetSaveRequests?.get(presetName);
    return requests instanceof Set ? Array.from(requests) : [];
}

// 关闭抑制窗口并补一次最终结果备份。幂等:重复调用时窗口已关,直接返回。
function flushPresetRenameBackup() {
    const state = globalThis[PRESET_AUTO_BACKUP_FETCH_KEY];

    if (!state?.renameSuppress) {
        return;
    }

    const body = state.renameSuppress.lastBody;
    state.renameSuppress = null;

    if (state.isEnabled() && isPresetAutoBackupBody(body)) {
        void sendPresetAutoBackup(state, body);
    }
}

function isPresetRenameInProgress() {
    return Boolean(globalThis[PRESET_AUTO_BACKUP_FETCH_KEY]?.renameSuppress);
}

function getOpenAiPresetRenameSaveGate() {
    const gate = extensionState.openAiPresetRenameSaveGate;
    return gate && typeof gate === 'object' ? gate : null;
}

function isOpenAiPresetRenameSaveGateActive() {
    return Boolean(getOpenAiPresetRenameSaveGate());
}

function beginOpenAiPresetRenameSaveGate(oldName, newName) {
    const existingGate = getOpenAiPresetRenameSaveGate();

    if (existingGate) {
        settleOpenAiPresetRenameSaveGate(existingGate, getOpenAiPresetRenameFallbackName(existingGate));
    }

    installPresetAutoBackupFetchHook();

    let resolveCompletion;
    const gate = {
        oldName,
        newName,
        renamed: false,
        latestSaveRequest: null,
        finalSavedRevision: null,
        deferredSaveTail: Promise.resolve(),
        completionPromise: new Promise(resolve => {
            resolveCompletion = resolve;
        }),
        resolveCompletion: null,
        timeout: 0,
    };

    gate.resolveCompletion = resolveCompletion;
    gate.timeout = setTimeout(() => {
        if (getOpenAiPresetRenameSaveGate() !== gate) {
            return;
        }

        console.debug(`${LOG_PREFIX} Preset rename save gate timed out`, {
            oldName: gate.oldName,
            newName: gate.newName,
            renamed: gate.renamed,
        });
        settleOpenAiPresetRenameSaveGate(gate, getOpenAiPresetRenameFallbackName(gate));
    }, PRESET_RENAME_SAVE_GATE_TIMEOUT_MS);
    extensionState.openAiPresetRenameSaveGate = gate;

    const activeRequests = [
        ...getActiveOpenAiPresetSaveRequests(oldName),
        ...getActiveOpenAiPresetSaveRequests(newName),
    ];

    return Promise.allSettled(Array.from(new Set(activeRequests)));
}

function markOpenAiPresetRenameSaveGateRenamed(oldName, newName) {
    const gate = getOpenAiPresetRenameSaveGate();

    if (!gate || gate.oldName !== oldName || gate.newName !== newName) {
        return false;
    }

    gate.renamed = true;
    return true;
}

function getOpenAiPresetRenameFallbackName(gate) {
    if (gate?.renamed || oai_settings?.preset_settings_openai === gate?.newName) {
        return gate?.newName;
    }

    return gate?.oldName;
}

function settleOpenAiPresetRenameSaveGate(gate, resolvedPresetName) {
    if (!gate || getOpenAiPresetRenameSaveGate() !== gate) {
        return false;
    }

    clearTimeout(gate.timeout);
    delete extensionState.openAiPresetRenameSaveGate;
    gate.resolveCompletion(resolvedPresetName);
    return true;
}

async function finishOpenAiPresetRenameSaveGateAfterFinalSave() {
    const gate = getOpenAiPresetRenameSaveGate();

    if (!gate || !gate.renamed) {
        return;
    }

    const finalSaveRequest = gate.latestSaveRequest;
    let saved = false;

    if (finalSaveRequest?.promise) {
        try {
            const response = await finalSaveRequest.promise;
            saved = response?.ok !== false;
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to finish the final renamed preset save`, error);
        }
    }

    if (saved && Number.isFinite(finalSaveRequest.revision)) {
        gate.finalSavedRevision = finalSaveRequest.revision;
        clearPendingPresetPromptChangesForSavedRevision(
            finalSaveRequest.presetName,
            finalSaveRequest.revision,
        );
    }

    settleOpenAiPresetRenameSaveGate(gate, gate.newName);
}

function getOpenAiPresetSaveStateName(presetName) {
    const gate = getOpenAiPresetRenameSaveGate();

    if (!gate || (presetName !== gate.oldName && presetName !== gate.newName)) {
        return presetName;
    }

    return gate.renamed ? gate.newName : gate.oldName;
}

function isPresetAutoBackupBody(body) {
    return Boolean(
        body
        && typeof body === 'object'
        && !Array.isArray(body)
        && typeof body.name === 'string'
        && body.name.trim()
        && body.preset
        && typeof body.preset === 'object',
    );
}

async function readPresetAutoBackupJsonBody(input, init) {
    if (Object.prototype.hasOwnProperty.call(init || {}, 'body')) {
        return readPresetAutoBackupJsonValue(init.body);
    }

    if (!isPresetAutoBackupRequest(input) || input.bodyUsed || !input.body) {
        return null;
    }

    try {
        return await input.clone().json().catch(() => null);
    } catch {
        return null;
    }
}

async function readPresetAutoBackupJsonValue(value) {
    if (typeof value === 'string') {
        return parsePresetAutoBackupJson(value);
    }

    if (typeof Blob === 'function' && value instanceof Blob) {
        return parsePresetAutoBackupJson(await value.text());
    }

    return null;
}

function parsePresetAutoBackupJson(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function getPresetAutoBackupFetchUrl(input) {
    if (typeof input === 'string') {
        return input;
    }

    if (input instanceof URL) {
        return input.href;
    }

    if (isPresetAutoBackupRequest(input)) {
        return input.url;
    }

    return '';
}

function getPresetAutoBackupFetchMethod(input, init) {
    return String(init?.method || (isPresetAutoBackupRequest(input) ? input.method : '') || 'GET').toUpperCase();
}

function isPresetAutoBackupRequest(value) {
    return typeof Request === 'function' && value instanceof Request;
}

export {
    applyPresetAutoBackup,
    beginOpenAiPresetRenameSaveGate,
    beginPresetRenameBackupSuppression,
    capturePresetRenameBackupBodySync,
    finishOpenAiPresetRenameSaveGateAfterFinalSave,
    flushPresetRenameBackup,
    getActiveOpenAiPresetSaveRequests,
    getOpenAiPresetRenameFallbackName,
    getOpenAiPresetRenameSaveGate,
    getOpenAiPresetSaveStateName,
    getPresetAutoBackupFetchMethod,
    getPresetAutoBackupFetchUrl,
    installPresetAutoBackupFetchHook,
    installPresetRenameBackupSuppressionListener,
    isOpenAiPresetRenameSaveGateActive,
    isOpenAiPresetSaveBody,
    isPresetAutoBackupBody,
    isPresetAutoBackupRequest,
    isPresetAutoBackupSourceRequest,
    isPresetRenameInProgress,
    markOpenAiPresetRenameSaveGateRenamed,
    parsePresetAutoBackupJson,
    presetAutoBackupBackendAvailable,
    readPresetAutoBackupJsonBody,
    readPresetAutoBackupJsonValue,
    readPresetSaveBodySync,
    schedulePresetAutoBackupFromRequest,
    sendPresetAutoBackup,
    setPresetAutoBackupBackendAvailable,
    settleOpenAiPresetRenameSaveGate,
    skipNextPresetAutoBackup,
    trackOpenAiPresetSaveRequest,
};
