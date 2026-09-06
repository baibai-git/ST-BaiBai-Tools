import { SaveGenerateDisplay } from '../saveGenerateDisplay.js';
import * as scriptModule from '@sillytavern/script';
import { characters, event_types, eventSource, getCurrentChatId, getRequestHeaders, reloadCurrentChat, this_chid } from '@sillytavern/script';
import { selected_group } from '@sillytavern/scripts/group-chats';
import { sendMessageAs } from '@sillytavern/scripts/slash-commands';
import { BAIBAOKU_SAVE_GENERATE_DISCARD_URL, BAIBAOKU_SAVE_GENERATE_URL, BAIBAOKU_STATUS_URL, LOG_PREFIX, SAVE_GENERATE_BACKEND_CHECK_TIMEOUT_MS, SAVE_GENERATE_BACKEND_CHECK_TTL_MS, SAVE_GENERATE_BACKEND_MISSING_RECHECK_MS, SAVE_GENERATE_DISPLAY_CLASS, SAVE_GENERATE_DISPLAY_STYLE_ID, SAVE_GENERATE_FETCH_KEY, SAVE_GENERATE_INTENT_TTL_MS, SAVE_GENERATE_JOB_ID_HEADER, SAVE_GENERATE_LOCAL_REQUEST_GUARD_RELEASE_DELAY_MS, SAVE_GENERATE_MAX_INTENTS, SAVE_GENERATE_PATH, SAVE_GENERATE_POLL_INTERVAL_MS, SAVE_GENERATE_POLL_TIMEOUT_MS, SAVE_GENERATE_RECOVERY_BLOCK_SELECTOR, SAVE_GENERATE_RECOVERY_BLOCK_TOAST_INTERVAL_MS, SAVE_GENERATE_RECOVERY_CHAT_READY_INTERVAL_MS, SAVE_GENERATE_RECOVERY_CHAT_READY_TIMEOUT_MS, SAVE_GENERATE_RESUME_CHECK_COOLDOWN_MS, SAVE_GENERATE_RESUME_CHECK_DELAY_MS, SAVE_GENERATE_SAVE_PATH, SAVE_GENERATE_SEEN_STORAGE_PREFIX, SAVE_GENERATE_STATUS_HEADER } from './constants.js';
import { buildFetchHeaders, copyFetchRequestOptions, getFetchRequestMethod, getFetchRequestUrl } from './gzipHook.js';
import { settings } from './state.js';
import { readFetchJsonBody } from './util.js';

function installSaveGenerateFetchHook() {
    installSaveGenerateDisplayStyle();

    const existing = globalThis[SAVE_GENERATE_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => settings.saveGenerateEnabled === true;
        if (!(existing.monitoredJobIds instanceof Set)) {
            existing.monitoredJobIds = new Set();
        }
        if (!(existing.resumeDisplays instanceof Map)) {
            existing.resumeDisplays = new Map();
        }
        if (!(existing.activeGenerateChatIds instanceof Set)) {
            existing.activeGenerateChatIds = new Set();
        }
        if (!(existing.resumeCheckPromises instanceof Map)) {
            existing.resumeCheckPromises = new Map();
        }
        if (!(existing.recoveryLocks instanceof Map)) {
            existing.recoveryLocks = new Map();
        }
        if (!(existing.localTerminalWatchJobIds instanceof Set)) {
            existing.localTerminalWatchJobIds = new Set();
        }
        if (!(existing.localRequestGuards instanceof Map)) {
            existing.localRequestGuards = new Map();
        }
        existing.localRequestGuardSerial = Number(existing.localRequestGuardSerial || 0);
        if (!Array.isArray(existing.saveGenerateIntents)) {
            existing.saveGenerateIntents = [];
        }
        existing.saveGenerateIntentSerial = Number(existing.saveGenerateIntentSerial || 0);
        existing.backendAvailable = existing.backendAvailable === true ? true : existing.backendAvailable === false ? false : null;
        existing.backendCheckedAt = Number(existing.backendCheckedAt || 0);
        existing.backendCheckPromise = null;
        if (existing.activeSaveGenerateCancelTarget && typeof existing.activeSaveGenerateCancelTarget !== 'object') {
            existing.activeSaveGenerateCancelTarget = null;
        }
        existing.resumeCheckScheduledChatId = String(existing.resumeCheckScheduledChatId || '');
        existing.resumeCheckScheduledLastMessageHash = String(existing.resumeCheckScheduledLastMessageHash || '');
        existing.resumeCheckInFlightChatId = String(existing.resumeCheckInFlightChatId || '');
        existing.lastResumeCheckChatId = String(existing.lastResumeCheckChatId || '');
        existing.lastResumeCheckAt = Number(existing.lastResumeCheckAt || 0);
        existing.lastRecoveryBlockToastAt = Number(existing.lastRecoveryBlockToastAt || 0);
        installSaveGenerateIntentHandlers(existing);
        installSaveGenerateNativeStopHandler(existing);
        installSaveGenerateRecoveryInputBlocker(existing);
        installSaveGenerateResumeHandlers(existing);
        installSaveGenerateMessageDeleteHandler(existing);
        refreshSaveGenerateRecoveryUiLock(existing);
        queueSaveGenerateResumeCheck(existing, 'existing-hook', 500);
        return existing;
    }

    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        pendingJobs: [],
        monitoredJobIds: new Set(),
        resumeDisplays: new Map(),
        activeGenerateChatIds: new Set(),
        activeSaveGenerateCancelTarget: null,
        resumeCheckPromises: new Map(),
        recoveryLocks: new Map(),
        localTerminalWatchJobIds: new Set(),
        localRequestGuards: new Map(),
        localRequestGuardSerial: 0,
        saveGenerateIntents: [],
        saveGenerateIntentSerial: 0,
        backendAvailable: null,
        backendCheckedAt: 0,
        backendCheckPromise: null,
        resumeCheckTimer: null,
        resumeCheckScheduledChatId: '',
        resumeCheckScheduledLastMessageHash: '',
        resumeCheckInFlightChatId: '',
        lastResumeCheckChatId: '',
        lastResumeCheckAt: 0,
        lastRecoveryBlockToastAt: 0,
        nativeStopHandlerInstalled: false,
        recoveryInputBlockerInstalled: false,
        resumeHandlersInstalled: false,
        messageDeleteHandlerInstalled: false,
        isEnabled: () => settings.saveGenerateEnabled === true,
    };

    state.wrappedFetch = async function baiBaiToolkitSaveGenerateFetch(input, init) {
        let localRequestGuard = null;
        try {
            const skippedSaveResponse = await maybeHandleSaveGenerateSaveRequest(state, input, init);
            if (skippedSaveResponse) {
                return skippedSaveResponse;
            }

            if (!state.isEnabled()) {
                return state.originalFetch(input, init);
            }

            const requestInfo = await getSaveGenerateRequestInfo(state, input, init);
            if (!requestInfo) {
                return state.originalFetch(input, init);
            }

            localRequestGuard = markSaveGenerateLocalRequestGuard(state, requestInfo.save?.chatId);

            if (!await isSaveGenerateBackendAvailable(state)) {
                console.debug(`${LOG_PREFIX} save-generate skipped: BaiBaoKu backend is unavailable`);
                const response = await state.originalFetch(input, init);
                return guardSaveGenerateResponseUntilBodyDone(state, localRequestGuard, response);
            }

            const recoveryBlockResponse = await maybeBlockSaveGenerateRequestForRecovery(state, requestInfo);
            if (recoveryBlockResponse) {
                return guardSaveGenerateResponseUntilBodyDone(state, localRequestGuard, recoveryBlockResponse);
            }

            const response = await fetchSaveGenerate(state, requestInfo, input, init);
            return guardSaveGenerateResponseUntilBodyDone(state, localRequestGuard, response);
        } catch (error) {
            console.debug(`${LOG_PREFIX} save-generate path failed; falling back to native fetch`, error);
            try {
                const response = await state.originalFetch(input, init);
                return guardSaveGenerateResponseUntilBodyDone(state, localRequestGuard, response);
            } catch (fallbackError) {
                clearSaveGenerateLocalRequestGuard(state, localRequestGuard);
                throw fallbackError;
            }
        }
    };

    state.wrappedFetch[SAVE_GENERATE_FETCH_KEY] = true;
    globalThis[SAVE_GENERATE_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    installSaveGenerateIntentHandlers(state);
    installSaveGenerateNativeStopHandler(state);
    installSaveGenerateRecoveryInputBlocker(state);
    installSaveGenerateResumeHandlers(state);
    installSaveGenerateMessageDeleteHandler(state);
    queueSaveGenerateResumeCheck(state, 'install', 500);
    console.debug(`${LOG_PREFIX} save-generate fetch hook installed`);
    return state;
}

async function isSaveGenerateBackendAvailable(state) {
    if (!state?.originalFetch) {
        return false;
    }

    const now = Date.now();
    const checkedAt = Number(state.backendCheckedAt || 0);
    const ttl = state.backendAvailable === false
        ? SAVE_GENERATE_BACKEND_MISSING_RECHECK_MS
        : SAVE_GENERATE_BACKEND_CHECK_TTL_MS;
    if (typeof state.backendAvailable === 'boolean' && now - checkedAt < ttl) {
        return state.backendAvailable;
    }

    if (state.backendCheckPromise) {
        return state.backendCheckPromise;
    }

    state.backendCheckPromise = checkSaveGenerateBackendAvailable(state.originalFetch)
        .then(available => {
            state.backendAvailable = available;
            state.backendCheckedAt = Date.now();
            return available;
        })
        .catch(error => {
            console.debug(`${LOG_PREFIX} save-generate backend check failed`, error);
            state.backendAvailable = false;
            state.backendCheckedAt = Date.now();
            return false;
        })
        .finally(() => {
            state.backendCheckPromise = null;
        });

    return state.backendCheckPromise;
}

async function checkSaveGenerateBackendAvailable(fetchFn) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), SAVE_GENERATE_BACKEND_CHECK_TIMEOUT_MS);

    try {
        const response = await fetchFn(BAIBAOKU_STATUS_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        return Boolean(response.ok && payload?.ok === true && payload?.data?.installed === true);
    } finally {
        clearTimeout(timer);
    }
}

function markSaveGenerateBackendAvailable(state, available) {
    if (!state) {
        return;
    }

    state.backendAvailable = Boolean(available);
    state.backendCheckedAt = Date.now();
}

async function getSaveGenerateRequestInfo(state, input, init) {
    const rawUrl = getFetchRequestUrl(input);
    if (!rawUrl || getFetchRequestMethod(input, init) !== 'POST') {
        return null;
    }

    let url;
    try {
        url = new URL(rawUrl, location.href);
    } catch {
        return null;
    }

    if (url.origin !== location.origin || url.pathname !== SAVE_GENERATE_PATH) {
        return null;
    }

    const skip = (reason, detail = '') => {
        console.debug(`${LOG_PREFIX} save-generate skipped: ${reason}${detail ? ` (${detail})` : ''}`);
        return null;
    };

    if (selected_group) {
        return skip('group chat is not supported');
    }

    if (scriptModule.main_api !== 'openai') {
        return skip('main_api is not chat-completions', String(scriptModule.main_api || 'unknown'));
    }

    if (settings.saveGenerateEnabled !== true) {
        return skip('setting disabled');
    }

    const body = await readFetchJsonBody(input, init);
    if (!isEligibleSaveGenerateBody(body)) {
        return skip('request body is not eligible', describeSaveGenerateBody(body));
    }

    const save = getCurrentSaveGenerateDescriptor(body);
    if (!save) {
        return skip('current chat identity is unavailable');
    }

    const intent = consumeSaveGenerateIntentForRequest(state, save, body);
    if (!intent) {
        return skip('no matching main chat generation intent');
    }

    return { body, save, intent };
}

function describeSaveGenerateBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return typeof body;
    }

    return [
        `type=${String(body.type || 'normal')}`,
        `n=${String(body.n || 1)}`,
        `source=${String(body.chat_completion_source || '')}`,
        `tools=${Array.isArray(body.tools) ? body.tools.length : 0}`,
    ].join(' ');
}

function isEligibleSaveGenerateBody(body) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return false;
    }

    if (!['normal', 'regenerate'].includes(String(body.type || 'normal'))) {
        return false;
    }

    if (Number(body.n || 1) > 1) {
        return false;
    }

    if (Array.isArray(body.tools) && body.tools.length > 0) {
        return false;
    }

    return Boolean(body.chat_completion_source);
}

function installSaveGenerateIntentHandlers(state) {
    if (!state || state.saveGenerateIntentHandlersInstalled || typeof eventSource?.on !== 'function') {
        return;
    }

    state.saveGenerateIntentHandlersInstalled = true;

    if (event_types.GENERATION_AFTER_COMMANDS) {
        eventSource.on(event_types.GENERATION_AFTER_COMMANDS, (type, options, dryRun) => {
            recordSaveGenerateIntentFromGenerationEvent(state, type, options, dryRun);
        });
    }

    if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
        eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, body => {
            bindSaveGenerateIntentToRequestBody(state, body);
        });
    }
}

function recordSaveGenerateIntentFromGenerationEvent(state, type, options = {}, dryRun = false) {
    cleanupSaveGenerateIntents(state);

    if (settings.saveGenerateEnabled !== true || selected_group || dryRun) {
        return;
    }

    const normalizedType = String(type || 'normal');
    if (!['normal', 'regenerate'].includes(normalizedType)) {
        return;
    }

    if (!isSaveGenerateMainChatGenerationOptions(options)) {
        return;
    }

    const save = getCurrentSaveGenerateDescriptor({ type: normalizedType });
    if (!save) {
        return;
    }

    state.saveGenerateIntentSerial = Number(state.saveGenerateIntentSerial || 0) + 1;
    state.saveGenerateIntents.push({
        id: state.saveGenerateIntentSerial,
        type: normalizedType,
        chatId: save.chatId,
        createdAt: Date.now(),
        preparedAt: 0,
        expectedBody: null,
        expectedBodyHash: '',
        lastMessageHashAtStart: getCurrentSaveGenerateLastMessageHash(),
    });
    cleanupSaveGenerateIntents(state);
}

function isSaveGenerateMainChatGenerationOptions(options) {
    if (!options || typeof options !== 'object') {
        return true;
    }

    if (options.force_chid !== undefined && options.force_chid !== null && options.force_chid !== '') {
        return false;
    }

    if (Number(options.depth || 0) > 0) {
        return false;
    }

    return !options.quiet_prompt && !options.quietToLoud && !options.quietImage && !options.quietName;
}

function bindSaveGenerateIntentToRequestBody(state, body) {
    cleanupSaveGenerateIntents(state);

    if (settings.saveGenerateEnabled !== true || selected_group || !isEligibleSaveGenerateBody(body)) {
        return;
    }

    const type = String(body.type || 'normal');
    const chatId = getCurrentSaveGenerateChatId();
    if (!chatId) {
        return;
    }

    const intents = Array.isArray(state?.saveGenerateIntents) ? state.saveGenerateIntents : [];
    const intent = [...intents].reverse().find(item => {
        return item
            && !item.expectedBody
            && item.type === type
            && item.chatId === chatId;
    });

    if (!intent) {
        return;
    }

    intent.expectedBody = body;
    intent.preparedAt = Date.now();
}

function consumeSaveGenerateIntentForRequest(state, save, body) {
    cleanupSaveGenerateIntents(state);

    const chatId = String(save?.chatId || '').trim();
    const type = String(save?.type || body?.type || 'normal');
    if (!chatId || !isCurrentSaveGenerateChatTailReadyForAssistantReply()) {
        return null;
    }

    const bodyHash = makeSaveGenerateRequestBodyHash(body);
    const now = Date.now();
    const intents = Array.isArray(state?.saveGenerateIntents) ? state.saveGenerateIntents : [];
    const intent = intents.find(item => {
        if (!item || item.chatId !== chatId || item.type !== type || !item.expectedBody) {
            return false;
        }
        if (now - Number(item.preparedAt || item.createdAt || 0) > SAVE_GENERATE_INTENT_TTL_MS) {
            return false;
        }

        const expectedHash = item.expectedBodyHash || makeSaveGenerateRequestBodyHash(item.expectedBody);
        item.expectedBodyHash = expectedHash;
        return expectedHash === bodyHash;
    });

    if (!intent) {
        return null;
    }

    return intent;
}

function cleanupSaveGenerateIntents(state) {
    if (!state) {
        return;
    }

    if (!Array.isArray(state.saveGenerateIntents)) {
        state.saveGenerateIntents = [];
        return;
    }

    const now = Date.now();
    state.saveGenerateIntents = state.saveGenerateIntents.filter(intent => {
        return intent
            && now - Number(intent.createdAt || 0) <= SAVE_GENERATE_INTENT_TTL_MS;
    });

    if (state.saveGenerateIntents.length > SAVE_GENERATE_MAX_INTENTS) {
        state.saveGenerateIntents = state.saveGenerateIntents.slice(-SAVE_GENERATE_MAX_INTENTS);
    }
}

function isCurrentSaveGenerateChatTailReadyForAssistantReply() {
    const tail = getCurrentSaveGenerateChatTailMessage();
    return Boolean(tail?.message && tail.message.is_user === true);
}

function getCurrentSaveGenerateChatTailMessage() {
    const messages = scriptModule.chat;
    if (!Array.isArray(messages) || messages.length === 0) {
        return null;
    }

    let lastMessage = null;
    let lastFloor = -1;
    let floor = -1;
    for (const message of messages) {
        if (!message || message.chat_metadata) {
            continue;
        }
        floor += 1;
        lastMessage = message;
        lastFloor = floor;
    }

    return lastMessage ? { message: lastMessage, floor: lastFloor } : null;
}

function makeSaveGenerateRequestBodyHash(body) {
    const text = stringifySaveGenerateStableJson(body);
    let hash = 0x811c9dc5;
    for (let index = 0; index < text.length; index += 1) {
        hash ^= text.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `r${text.length.toString(36)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function stringifySaveGenerateStableJson(value) {
    return JSON.stringify(normalizeSaveGenerateStableJson(value));
}

function normalizeSaveGenerateStableJson(value) {
    if (!value || typeof value !== 'object') {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map(item => normalizeSaveGenerateStableJson(item));
    }

    const output = {};
    for (const key of Object.keys(value).sort()) {
        const normalized = normalizeSaveGenerateStableJson(value[key]);
        if (normalized !== undefined) {
            output[key] = normalized;
        }
    }
    return output;
}

function getCurrentSaveGenerateDescriptor(body = null) {
    if (this_chid === undefined || selected_group) {
        return null;
    }

    const character = characters?.[this_chid];
    if (!character?.avatar || !character?.chat) {
        return null;
    }

    const chatId = getCurrentSaveGenerateChatId();
    if (!chatId) {
        return null;
    }

    const type = String(body?.type || 'normal');
    return {
        kind: 'character',
        type,
        chatId,
        avatar_url: character.avatar,
        file_name: character.chat,
        ch_name: character.name || '',
        expectedFloor: computeSaveGenerateExpectedFloor(type),
    };
}

// The floor index the assistant reply is expected to occupy in the open chat,
// measured against the page's in-memory chat array (the same basis used by every
// other front-end floor check). The back-end stores this verbatim and echoes it
// back, so the duplicate/recovery decision compares one consistent basis instead
// of the front-end's array index against the back-end's on-disk line count.
//
// A 'normal' reply always appends after the tail → tailFloor + 1.
// A 'regenerate' first deletes the trailing assistant reply (if any), then
// generates in its place:
//   - tail is the assistant reply  → it gets replaced in place  → tailFloor
//   - tail is a user message       → nothing to delete, append  → tailFloor + 1
function computeSaveGenerateExpectedFloor(type) {
    const tail = getCurrentSaveGenerateChatTailMessage();
    const tailFloor = tail && Number.isInteger(tail.floor) ? tail.floor : -1;
    const tailIsAssistant = Boolean(tail?.message && tail.message.is_user !== true);
    if (String(type || 'normal') === 'regenerate' && tailIsAssistant) {
        return tailFloor;
    }
    return tailFloor + 1;
}

function getCurrentSaveGenerateChatId() {
    if (selected_group) {
        return '';
    }

    return String(getCurrentChatId?.() || characters?.[this_chid]?.chat || '').trim();
}

async function fetchSaveGenerate(state, requestInfo, input, init) {
    const headers = buildFetchHeaders(input, init);
    const requestHeaders = getRequestHeaders();
    for (const [key, value] of Object.entries(requestHeaders || {})) {
        if (!headers.has(key)) {
            headers.set(key, value);
        }
    }
    headers.set('Content-Type', 'application/json');

    const fastInit = {
        ...copyFetchRequestOptions(input, init),
        ...(init || {}),
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
            save: requestInfo.save,
            generate: requestInfo.body,
        }),
    };

    const activeChatId = String(requestInfo.save?.chatId || '').trim();
    const isStream = requestInfo.body?.stream === true;
    const currentTail = getCurrentSaveGenerateChatTailMessage();
    console.log(`${LOG_PREFIX} [楼层日志] 发送生成请求 type=${requestInfo.save?.type} chatId=${activeChatId} 当前末尾楼层=${currentTail?.floor ?? -1} 期望楼层=${requestInfo.save?.expectedFloor}`);
    const cancelTarget = setActiveSaveGenerateCancelTarget(state, {
        jobId: '',
        chatId: activeChatId,
    });
    markSaveGenerateActiveChat(state, activeChatId);

    try {
        const response = await state.originalFetch(BAIBAOKU_SAVE_GENERATE_URL, fastInit);
        if (response?.status === 404) {
            markSaveGenerateBackendAvailable(state, false);
            clearActiveSaveGenerateCancelTarget(state, cancelTarget);
            console.debug(`${LOG_PREFIX} save-generate endpoint unavailable; falling back to native generate`);
            return state.originalFetch(input, init);
        }
        markSaveGenerateBackendAvailable(state, response?.ok || response?.status !== 404);

        const jobId = response?.headers?.get(SAVE_GENERATE_JOB_ID_HEADER) || '';
        if (cancelTarget) {
            cancelTarget.jobId = jobId;
        }
        if (jobId && response.ok) {
            console.debug(`${LOG_PREFIX} save-generate intercepted ${requestInfo.save.file_name}; job=${jobId}`);
            rememberSaveGenerateJob(state, {
                id: jobId,
                save: requestInfo.save,
                status: response.headers.get(SAVE_GENERATE_STATUS_HEADER) || '',
                createdAt: Date.now(),
                consumed: false,
            });
            watchLocalSaveGenerateTerminalStatus(state, jobId);
        } else if (jobId && !response.ok) {
            markSaveGenerateJobSeen({ id: jobId });
        }

        return response;
    } finally {
        forgetSaveGenerateActiveChat(state, activeChatId);
        if (!isStream || !cancelTarget?.jobId) {
            clearActiveSaveGenerateCancelTarget(state, cancelTarget);
        }
    }
}

function installSaveGenerateNativeStopHandler(state) {
    if (!state || state.nativeStopHandlerInstalled) {
        return;
    }

    state.nativeStopHandlerInstalled = true;
    const handler = event => {
        if (!isSaveGenerateNativeStopEvent(event)) {
            return;
        }
        void cancelActiveSaveGenerateJobFromNativeStop(state);
    };

    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
}

function isSaveGenerateNativeStopEvent(event) {
    const target = event?.target;
    const element = target instanceof Element ? target : target?.parentElement;
    return Boolean(element?.closest?.('#mes_stop'));
}

function setActiveSaveGenerateCancelTarget(state, target) {
    if (!state || !target?.chatId) {
        return null;
    }

    const activeTarget = {
        jobId: String(target.jobId || ''),
        chatId: String(target.chatId || ''),
        startedAt: Date.now(),
        cancelRequested: false,
    };
    state.activeSaveGenerateCancelTarget = activeTarget;
    return activeTarget;
}

function getActiveSaveGenerateCancelTarget(state) {
    const target = state?.activeSaveGenerateCancelTarget;
    if (!target?.chatId && !target?.jobId) {
        return null;
    }

    if (Date.now() - Number(target.startedAt || 0) > SAVE_GENERATE_POLL_TIMEOUT_MS * 2) {
        state.activeSaveGenerateCancelTarget = null;
        return null;
    }

    return target;
}

function clearActiveSaveGenerateCancelTarget(state, target = null) {
    const activeTarget = state?.activeSaveGenerateCancelTarget;
    if (!state || !activeTarget) {
        return;
    }

    if (!target || target === activeTarget) {
        state.activeSaveGenerateCancelTarget = null;
        return;
    }

    const activeJobId = String(activeTarget.jobId || '');
    const targetJobId = String(target.jobId || target.id || '');
    const activeChatId = String(activeTarget.chatId || '');
    const targetChatId = String(target.chatId || target.save?.chatId || '');

    if (targetJobId && activeJobId && targetJobId !== activeJobId) {
        return;
    }
    if (targetChatId && activeChatId && targetChatId !== activeChatId) {
        return;
    }
    if (!targetJobId && !targetChatId) {
        return;
    }

    state.activeSaveGenerateCancelTarget = null;
}

async function cancelActiveSaveGenerateJobFromNativeStop(state) {
    if (!state?.originalFetch) {
        return;
    }

    const target = getActiveSaveGenerateCancelTarget(state);
    if (!target || target.cancelRequested) {
        return;
    }

    target.cancelRequested = true;
    try {
        const job = await cancelSaveGenerateJobWithRetry(state.originalFetch, target);
        const canceledJob = {
            id: target.jobId || job?.id || '',
            ...(job || {}),
            status: job?.status || 'canceled',
            chatId: target.chatId,
        };
        clearActiveSaveGenerateCancelTarget(state, canceledJob);
        if (canceledJob.id) {
            finishSaveGenerateCanceledDisplay(state, canceledJob);
        } else {
            showSaveGenerateInfoToast('柏宝库后台生成已停止');
        }
    } catch (error) {
        target.cancelRequested = false;
        console.debug(`${LOG_PREFIX} save-generate native stop cancel failed`, error);
    }
}

async function cancelSaveGenerateJobWithRetry(fetchFn, target) {
    const chatId = String(target?.chatId || '').trim();
    const maxAttempts = target?.jobId || !chatId ? 1 : 6;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const jobId = String(target?.jobId || '').trim();
        try {
            return await cancelSaveGenerateJob(fetchFn, jobId, { chatId });
        } catch (error) {
            if (jobId || attempt >= maxAttempts - 1 || !isRetryableSaveGenerateCancelError(error)) {
                throw error;
            }
            await delaySaveGeneratePoll(250);
        }
    }

    return null;
}

function isRetryableSaveGenerateCancelError(error) {
    return Number(error?.status || 0) === 404
        || /not found|HTTP 404|cancelable save-generate job was not found/i.test(String(error?.message || ''));
}

function rememberSaveGenerateJob(state, record) {
    cleanupSaveGenerateRecords(state);
    state.pendingJobs.push(record);
}

function markSaveGenerateActiveChat(state, chatId) {
    if (!state || !chatId) {
        return;
    }
    if (!(state.activeGenerateChatIds instanceof Set)) {
        state.activeGenerateChatIds = new Set();
    }
    state.activeGenerateChatIds.add(chatId);
}

function forgetSaveGenerateActiveChat(state, chatId) {
    if (!state || !chatId || !(state.activeGenerateChatIds instanceof Set)) {
        return;
    }
    state.activeGenerateChatIds.delete(chatId);
}

function markSaveGenerateLocalRequestGuard(state, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!state || !normalizedChatId) {
        return null;
    }

    if (!(state.localRequestGuards instanceof Map)) {
        state.localRequestGuards = new Map();
    }

    state.localRequestGuardSerial = Number(state.localRequestGuardSerial || 0) + 1;
    const guard = {
        id: state.localRequestGuardSerial,
        chatId: normalizedChatId,
        createdAt: Date.now(),
    };
    state.localRequestGuards.set(normalizedChatId, guard);
    return guard;
}

function clearSaveGenerateLocalRequestGuard(state, guard) {
    if (!state || !guard?.chatId || !(state.localRequestGuards instanceof Map)) {
        return;
    }

    const activeGuard = state.localRequestGuards.get(guard.chatId);
    if (!activeGuard || activeGuard.id !== guard.id) {
        return;
    }

    state.localRequestGuards.delete(guard.chatId);
}

function isSaveGenerateLocalRequestGuarded(state, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId || !(state?.localRequestGuards instanceof Map)) {
        return false;
    }

    const guard = state.localRequestGuards.get(normalizedChatId);
    if (!guard) {
        return false;
    }

    if (Date.now() - Number(guard.createdAt || 0) > SAVE_GENERATE_POLL_TIMEOUT_MS) {
        state.localRequestGuards.delete(normalizedChatId);
        return false;
    }

    return true;
}

function guardSaveGenerateResponseUntilBodyDone(state, guard, response) {
    if (!guard) {
        return response;
    }

    if (!(response instanceof Response) || !response.ok || !response.body || typeof ReadableStream === 'undefined') {
        clearSaveGenerateLocalRequestGuard(state, guard);
        return response;
    }

    const reader = response.body.getReader();
    let released = false;
    const release = (delayMs = 0) => {
        if (released) {
            return;
        }
        released = true;
        setTimeout(() => clearSaveGenerateLocalRequestGuard(state, guard), Math.max(0, Number(delayMs || 0)));
    };

    const guardedBody = new ReadableStream({
        async pull(controller) {
            try {
                const { done, value } = await reader.read();
                if (done) {
                    controller.close();
                    release(SAVE_GENERATE_LOCAL_REQUEST_GUARD_RELEASE_DELAY_MS);
                    return;
                }
                controller.enqueue(value);
            } catch (error) {
                release();
                controller.error(error);
            }
        },
        async cancel(reason) {
            release();
            try {
                await reader.cancel(reason);
            } catch {
                // Ignore cancel cleanup failures from the browser stream.
            }
        },
    });

    return new Response(guardedBody, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
    });
}

function cleanupSaveGenerateRecords(state) {
    const now = Date.now();
    state.pendingJobs = state.pendingJobs.filter(record => {
        return record && !record.consumed && now - Number(record.createdAt || 0) < SAVE_GENERATE_POLL_TIMEOUT_MS * 2;
    });
}

async function maybeHandleSaveGenerateSaveRequest(state, input, init) {
    const rawUrl = getFetchRequestUrl(input);
    if (!rawUrl || getFetchRequestMethod(input, init) !== 'POST') {
        return null;
    }

    let url;
    try {
        url = new URL(rawUrl, location.href);
    } catch {
        return null;
    }

    if (url.origin !== location.origin || url.pathname !== SAVE_GENERATE_SAVE_PATH) {
        return null;
    }

    const body = await readFetchJsonBody(input, init);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return null;
    }

    cleanupSaveGenerateRecords(state);
    const record = findMatchingSaveGenerateRecord(state, body);
    if (!record) {
        return null;
    }

    const job = await waitSaveGenerateJobTerminal(state, record);
    if (job?.status) {
        record.status = job.status;
    }
    clearActiveSaveGenerateCancelTarget(state, {
        id: record.id,
        chatId: record.save?.chatId,
    });

    if (job && isSaveGenerateChatAlreadySavedStatus(job)) {
        console.debug(`${LOG_PREFIX} save-generate saved ${record.save.file_name}; skipping native /api/chats/save`);
        record.consumed = true;
        markSaveGenerateJobSeen(job);
        cleanupSaveGenerateRecords(state);
        return buildSkippedSaveGenerateSaveResponse(job);
    }

    console.debug(`${LOG_PREFIX} save-generate did not save ${record.save.file_name}; native /api/chats/save will run`, job);
    return fetchNativeSaveForSaveGenerateRecord(state, input, init, record, job);
}

async function fetchNativeSaveForSaveGenerateRecord(state, input, init, record, job = null) {
    const saveGuard = markSaveGenerateLocalRequestGuard(state, record?.save?.chatId);
    try {
        const response = await state.originalFetch(input, init);
        if (response?.ok) {
            finishSaveGenerateNativeSave(state, record, job);
        } else {
            forgetSaveGenerateLocalJobOwnership(state, record);
        }
        releaseSaveGenerateLocalRequestGuard(state, saveGuard, SAVE_GENERATE_LOCAL_REQUEST_GUARD_RELEASE_DELAY_MS);
        return response;
    } catch (error) {
        forgetSaveGenerateLocalJobOwnership(state, record);
        releaseSaveGenerateLocalRequestGuard(state, saveGuard);
        throw error;
    }
}

function finishSaveGenerateNativeSave(state, record, job = null) {
    if (!state || !record) {
        return;
    }

    record.consumed = true;
    markSaveGenerateJobSeen(job?.id ? job : { id: record.id });
    cleanupSaveGenerateRecords(state);
}

function forgetSaveGenerateLocalJobOwnership(state, record) {
    if (!state || !record) {
        return;
    }

    record.consumed = true;
    cleanupSaveGenerateRecords(state);
}

function releaseSaveGenerateLocalRequestGuard(state, guard, delayMs = 0) {
    if (!guard) {
        return;
    }

    setTimeout(() => clearSaveGenerateLocalRequestGuard(state, guard), Math.max(0, Number(delayMs || 0)));
}

function findMatchingSaveGenerateRecord(state, saveBody) {
    const avatarUrl = String(saveBody.avatar_url || '');
    const fileName = String(saveBody.file_name || '');
    const chName = String(saveBody.ch_name || '');

    for (let index = state.pendingJobs.length - 1; index >= 0; index -= 1) {
        const record = state.pendingJobs[index];
        if (!record || record.consumed) {
            continue;
        }

        const save = record.save || {};
        if (String(save.avatar_url || '') !== avatarUrl) {
            continue;
        }
        if (String(save.file_name || '') !== fileName) {
            continue;
        }
        if (save.ch_name && chName && String(save.ch_name) !== chName) {
            continue;
        }

        return record;
    }

    return null;
}

async function waitSaveGenerateJobTerminal(state, record, { onUpdate = null } = {}) {
    if (isSaveGenerateTerminalStatus(record.status)) {
        onUpdate?.({ id: record.id, status: record.status });
        return { id: record.id, status: record.status };
    }

    const streamedJob = await waitSaveGenerateJobTerminalEventStream(state, record, { onUpdate }).catch(error => {
        console.debug(`${LOG_PREFIX} save-generate event stream failed; falling back to polling`, error);
        return null;
    });
    if (streamedJob && isSaveGenerateTerminalStatus(streamedJob.status)) {
        return streamedJob;
    }

    return waitSaveGenerateJobTerminalPolling(state, record, { onUpdate });
}

async function waitSaveGenerateJobTerminalPolling(state, record, { onUpdate = null } = {}) {
    const deadline = Date.now() + SAVE_GENERATE_POLL_TIMEOUT_MS;
    while (Date.now() < deadline) {
        const job = await fetchSaveGenerateJobStatus(state.originalFetch, record.id).catch(error => {
            console.debug(`${LOG_PREFIX} save-generate status polling failed`, error);
            return null;
        });

        if (job?.status) {
            record.status = job.status;
            onUpdate?.(job);
        }

        if (job && isSaveGenerateTerminalStatus(job.status)) {
            return job;
        }

        await delaySaveGeneratePoll(SAVE_GENERATE_POLL_INTERVAL_MS);
    }

    return { id: record.id, status: 'timeout' };
}

async function waitSaveGenerateJobTerminalEventStream(state, record, { onUpdate = null } = {}) {
    if (!state?.originalFetch || !record?.id || typeof TextDecoder === 'undefined') {
        return null;
    }

    const headers = new Headers(getRequestHeaders());
    const response = await state.originalFetch(`${BAIBAOKU_SAVE_GENERATE_URL}/${encodeURIComponent(record.id)}/events`, {
        method: 'GET',
        headers,
        cache: 'no-store',
    });

    if (response.status === 404 || response.status === 405 || response.status === 501) {
        return null;
    }
    if (!response.ok || !response.body || typeof response.body.getReader !== 'function') {
        throw new Error(`HTTP ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let latestJob = null;

    const processBlock = block => {
        const event = parseSaveGenerateEventStreamBlock(block);
        if (!event.data) {
            return null;
        }

        let payload = null;
        try {
            payload = JSON.parse(event.data);
        } catch {
            return null;
        }

        if (!payload?.status) {
            return null;
        }

        latestJob = payload;
        record.status = payload.status;
        onUpdate?.(payload);
        return payload;
    };

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }

            buffer += decoder.decode(value, { stream: true });
            buffer = buffer.replace(/\r\n/g, '\n');

            let separator = buffer.indexOf('\n\n');
            while (separator >= 0) {
                const block = buffer.slice(0, separator);
                buffer = buffer.slice(separator + 2);
                const job = processBlock(block);
                if (job && isSaveGenerateTerminalStatus(job.status)) {
                    return job;
                }
                separator = buffer.indexOf('\n\n');
            }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
            const job = processBlock(buffer);
            if (job && isSaveGenerateTerminalStatus(job.status)) {
                return job;
            }
        }
    } finally {
        reader.releaseLock?.();
    }

    return latestJob && isSaveGenerateTerminalStatus(latestJob.status) ? latestJob : null;
}

function parseSaveGenerateEventStreamBlock(block) {
    const event = {
        type: 'message',
        data: '',
    };
    const dataLines = [];
    for (const rawLine of String(block || '').split('\n')) {
        const line = rawLine.replace(/\r$/, '');
        if (!line || line.startsWith(':')) {
            continue;
        }

        const separator = line.indexOf(':');
        const field = separator >= 0 ? line.slice(0, separator) : line;
        const value = separator >= 0 ? line.slice(separator + 1).replace(/^ /, '') : '';
        if (field === 'event') {
            event.type = value || 'message';
        } else if (field === 'data') {
            dataLines.push(value);
        }
    }
    event.data = dataLines.join('\n');
    return event;
}

function watchLocalSaveGenerateTerminalStatus(state, jobId) {
    if (!state?.originalFetch || !jobId) {
        return;
    }

    if (!(state.localTerminalWatchJobIds instanceof Set)) {
        state.localTerminalWatchJobIds = new Set();
    }

    if (state.localTerminalWatchJobIds.has(jobId)) {
        return;
    }

    state.localTerminalWatchJobIds.add(jobId);
    void waitSaveGenerateJobTerminal(state, {
        id: jobId,
        status: '',
        createdAt: Date.now(),
    })
        .then(job => {
            const status = String(job?.status || '');
            if (status === 'failed' || status === 'canceled') {
                markSaveGenerateJobSeen(job);
                return;
            }

            // For a locally-owned job that finished generating, the current page
            // received this reply itself. Once we can confirm the reply is already
            // rendered in the open chat, mark it seen so a resume check fired in the
            // window before ST's /api/chats/save — e.g. tab refocus on mobile —
            // never re-inserts it as a "recovered" message (the duplicate bug).
            // We intentionally do NOT mark seen when the message is absent: that is
            // the page-closed-before-save case the recovery feature must still cover.
            if (isSaveGenerateSavedStatus(status) && job?.id
                && isCurrentSaveGenerateMessageAlreadyInserted({ id: job.id, ...job })) {
                markSaveGenerateLocalJobConsumed(state, job.id);
                markSaveGenerateJobSeen(job);
            }
        })
        .catch(error => {
            console.debug(`${LOG_PREFIX} save-generate local terminal watch failed`, error);
        })
        .finally(() => {
            state.localTerminalWatchJobIds?.delete(jobId);
        });
}

async function fetchSaveGenerateJobStatus(fetchFn, jobId) {
    const headers = new Headers(getRequestHeaders());
    const response = await fetchFn(`${BAIBAOKU_SAVE_GENERATE_URL}/${encodeURIComponent(jobId)}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }
    return payload.data || null;
}

async function cancelSaveGenerateJob(fetchFn, jobId, { chatId = '' } = {}) {
    const normalizedJobId = String(jobId || '').trim();
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedJobId && !normalizedChatId) {
        throw new Error('save-generate cancel requires jobId or chatId');
    }

    const headers = new Headers(getRequestHeaders());
    headers.set('Content-Type', 'application/json');
    const url = normalizedJobId
        ? `${BAIBAOKU_SAVE_GENERATE_URL}/${encodeURIComponent(normalizedJobId)}/cancel`
        : `${BAIBAOKU_SAVE_GENERATE_URL}/cancel`;
    const body = {};
    if (normalizedJobId) {
        body.jobId = normalizedJobId;
    }
    if (normalizedChatId) {
        body.chatId = normalizedChatId;
    }

    const response = await fetchFn(url, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify(body),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
        const error = new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
        error.status = response.status;
        throw error;
    }
    return payload.data || { id: normalizedJobId, status: 'canceled' };
}

function buildSkippedSaveGenerateSaveResponse(job) {
    return new Response(JSON.stringify({
        ok: true,
        skipped: true,
        baibaokuSaveGenerate: true,
        jobId: job.id,
        status: job.status,
    }), {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Baibaoku-Save-Generate-Skipped': 'true',
        },
    });
}

function delaySaveGeneratePoll(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function installSaveGenerateResumeHandlers(state) {
    if (!state || state.resumeHandlersInstalled) {
        return;
    }

    state.resumeHandlersInstalled = true;

    const queue = reason => queueSaveGenerateResumeCheck(state, reason);

    if (event_types.CHAT_LOADED) {
        eventSource.on(event_types.CHAT_LOADED, () => queue('chat-loaded'));
    }
    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => queue('chat-changed'));
    }

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState !== 'hidden') {
            queue('visibility');
        }
    });
    window.addEventListener('focus', () => queue('focus'));
    window.addEventListener('pageshow', () => queue('pageshow'));
}

function installSaveGenerateMessageDeleteHandler(state) {
    if (!state || state.messageDeleteHandlerInstalled || typeof eventSource?.on !== 'function') {
        return;
    }

    state.messageDeleteHandlerInstalled = true;
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        const cleanup = {
            chatId: getCurrentSaveGenerateChatId(),
            promise: discardCurrentChatSaveGenerateJobsAfterMessageDelete(state),
        };
        state.messageDeleteCleanup = cleanup;
        return cleanup.promise;
    });
}

async function waitForSaveGenerateMessageDelete(chatId) {
    const state = globalThis[SAVE_GENERATE_FETCH_KEY];
    if (!state || state.backendAvailable !== true) {
        return;
    }

    const cleanup = state.messageDeleteCleanup;
    if (!cleanup || cleanup.chatId !== chatId || await cleanup.promise !== true) {
        throw new Error('Background generation cleanup failed');
    }
}

async function discardSaveGenerateJobsBeforeRetry(chatId) {
    const state = globalThis[SAVE_GENERATE_FETCH_KEY];
    if (!state || state.backendAvailable !== true) {
        return;
    }
    if (chatId !== getCurrentSaveGenerateChatId() || await discardCurrentChatSaveGenerateJobsAfterMessageDelete(state) !== true) {
        throw new Error('Background generation cleanup failed');
    }
}

async function discardCurrentChatSaveGenerateJobsAfterMessageDelete(state) {
    if (!state?.originalFetch || selected_group) {
        return;
    }

    const chatId = getCurrentSaveGenerateChatId();
    if (!chatId) {
        return;
    }

    try {
        const result = await discardSaveGenerateJobsForChat(state.originalFetch, chatId);
        markSaveGenerateLocalChatJobsConsumed(state, chatId);
        clearActiveSaveGenerateCancelTarget(state, { chatId });
        clearSaveGenerateRecoveryLock(state, chatId);
        state.lastResumeCheckChatId = chatId;
        state.lastResumeCheckAt = Date.now();
        console.debug(`${LOG_PREFIX} save-generate discarded jobs after message delete`, result);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} save-generate discard after message delete failed`, error);
        return false;
    }
}

async function discardSaveGenerateJobsForChat(fetchFn, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
        return null;
    }

    const headers = new Headers(getRequestHeaders());
    headers.set('Content-Type', 'application/json');
    // Deletion now waits for cleanup; a dead connection must not block it forever.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    try {
        const response = await fetchFn(BAIBAOKU_SAVE_GENERATE_DISCARD_URL, {
            method: 'POST',
            headers,
            cache: 'no-store',
            body: JSON.stringify({ chatId: normalizedChatId }),
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (!response.ok || payload?.ok !== true) {
            const error = new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
            error.status = response.status;
            throw error;
        }
        return payload.data || null;
    } finally {
        clearTimeout(timer);
    }
}

function queueSaveGenerateResumeCheck(state, reason = 'unknown', delayMs = SAVE_GENERATE_RESUME_CHECK_DELAY_MS) {
    if (!state) {
        return;
    }

    if (state.resumeCheckTimer) {
        clearTimeout(state.resumeCheckTimer);
    }

    state.resumeCheckScheduledChatId = getCurrentSaveGenerateChatId();
    state.resumeCheckScheduledLastMessageHash = getCurrentSaveGenerateLastMessageHash();
    refreshSaveGenerateRecoveryUiLock(state);

    state.resumeCheckTimer = setTimeout(() => {
        state.resumeCheckTimer = null;
        state.resumeCheckScheduledChatId = '';
        state.resumeCheckScheduledLastMessageHash = '';
        refreshSaveGenerateRecoveryUiLock(state);
        void checkCurrentSaveGenerateJob(state, reason);
    }, delayMs);
}

async function checkCurrentSaveGenerateJob(state, reason = 'unknown', { force = false, lastMessageHash = null } = {}) {
    if (!state?.isEnabled?.() || selected_group) {
        return null;
    }

    const chatId = getCurrentSaveGenerateChatId();
    if (!chatId) {
        return null;
    }

    if (!(state.resumeCheckPromises instanceof Map)) {
        state.resumeCheckPromises = new Map();
    }

    const existingPromise = state.resumeCheckPromises.get(chatId);
    if (existingPromise) {
        return existingPromise;
    }

    const promise = runCurrentSaveGenerateJobCheck(state, chatId, reason, { force, lastMessageHash });
    state.resumeCheckPromises.set(chatId, promise);
    refreshSaveGenerateRecoveryUiLock(state);

    try {
        return await promise;
    } finally {
        if (state.resumeCheckPromises?.get(chatId) === promise) {
            state.resumeCheckPromises.delete(chatId);
        }
        if (state.resumeCheckInFlightChatId === chatId) {
            state.resumeCheckInFlightChatId = '';
        }
        refreshSaveGenerateRecoveryUiLock(state);
    }
}

async function runCurrentSaveGenerateJobCheck(state, chatId, reason = 'unknown', { force = false, lastMessageHash = null } = {}) {
    if (!state?.isEnabled?.() || selected_group || !chatId) {
        return null;
    }

    if (isSaveGenerateActiveLocalChat(state, chatId)) {
        console.debug(`${LOG_PREFIX} save-generate resume check skipped: current page is generating this chat (${reason})`);
        return null;
    }

    if (scriptModule.is_send_press) {
        console.debug(`${LOG_PREFIX} save-generate resume check skipped: SillyTavern generation is still active (${reason})`);
        return null;
    }

    if (reason !== 'generate-fetch' && isSaveGenerateLocalRequestGuarded(state, chatId)) {
        console.debug(`${LOG_PREFIX} save-generate resume check skipped: local generate request is pending (${reason})`);
        return null;
    }

    const now = Date.now();
    if (!force && state.lastResumeCheckChatId === chatId && now - Number(state.lastResumeCheckAt || 0) < SAVE_GENERATE_RESUME_CHECK_COOLDOWN_MS) {
        console.debug(`${LOG_PREFIX} save-generate resume check skipped: same chat cooldown (${reason})`);
        return null;
    }

    state.resumeCheckInFlightChatId = chatId;
    try {
        if (!await isSaveGenerateBackendAvailable(state)) {
            console.debug(`${LOG_PREFIX} save-generate resume check skipped: BaiBaoKu backend is unavailable (${reason})`);
            return null;
        }

        const effectiveLastMessageHash = typeof lastMessageHash === 'string'
            ? lastMessageHash
            : getCurrentSaveGenerateLastMessageHash();
        const resumeLastMessageInfo = getCurrentSaveGenerateLastMessageInfo();
        const job = await fetchSaveGenerateJobByChatId(state.originalFetch, chatId, {
            lastMessageHash: effectiveLastMessageHash,
            lastMessageInfo: resumeLastMessageInfo,
        }).catch(error => {
            console.debug(`${LOG_PREFIX} save-generate resume check failed`, error);
            return null;
        });

        console.log(`${LOG_PREFIX} [楼层日志] resume检查(${reason}) 上报末尾楼层=${resumeLastMessageInfo.floor} role=${resumeLastMessageInfo.role} → 后端${job?.id ? `返回job=${job.id} status=${job.status} 期望楼层=${job.save?.expectedFloor}` : '未返回job(已被后端拦截或无job)'}`);

        state.lastResumeCheckChatId = chatId;
        state.lastResumeCheckAt = Date.now();

        if (!job?.id) {
            return null;
        }

        if (isSaveGenerateJobSeen(job)) {
            markSaveGenerateLocalJobConsumed(state, job.id);
            return job;
        }

        if (isSaveGenerateKnownLocalJob(state, job.id)) {
            const status = String(job.status || '');
            if (isSaveGenerateTerminalStatus(status) && status !== 'completed') {
                markSaveGenerateLocalJobConsumed(state, job.id);
                markSaveGenerateJobSeen(job);
                console.debug(`${LOG_PREFIX} save-generate resume check skipped: job is owned by current page job=${job.id} (${reason})`);
                return job;
            }

            // For 'completed' (and still-running) local jobs the current page owns
            // persistence through its own /api/chats/save flow. Re-inserting here would
            // duplicate the reply ST is about to (or already did) save. If the page
            // somehow never saves it, the local record ages out and a later resume
            // check recovers it as a foreign job — so nothing is lost by skipping now.
            console.debug(`${LOG_PREFIX} save-generate resume check skipped: job is owned by current page job=${job.id} status=${status} (${reason})`);
            return job;
        }

        console.debug(`${LOG_PREFIX} save-generate resume check found job=${job.id} status=${job.status} reason=${reason}`);
        handleSaveGenerateJobForCurrentChat(state, job, chatId, reason);
        return job;
    } finally {
        if (state.resumeCheckInFlightChatId === chatId) {
            state.resumeCheckInFlightChatId = '';
        }
    }
}

function isSaveGenerateActiveLocalChat(state, chatId) {
    return Boolean(chatId && state?.activeGenerateChatIds instanceof Set && state.activeGenerateChatIds.has(chatId));
}

function installSaveGenerateRecoveryInputBlocker(state) {
    if (!state || state.recoveryInputBlockerInstalled) {
        return;
    }

    state.recoveryInputBlockerInstalled = true;
    const handler = event => {
        if (!state?.isEnabled?.()) {
            return;
        }

        const target = event?.target;
        const element = target instanceof Element ? target : target?.parentElement;
        if (!element?.closest?.(SAVE_GENERATE_RECOVERY_BLOCK_SELECTOR)) {
            return;
        }

        const chatId = getCurrentSaveGenerateChatId();
        if (!chatId || !shouldBlockSaveGenerateUserInput(state, chatId)) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        showSaveGenerateRecoveryBlockToast(state);
        void waitForSaveGenerateRecoveryGate(state, chatId, 'blocked-input');
    };

    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);
}

function shouldBlockSaveGenerateUserInput(state, chatId) {
    return Boolean(getSaveGenerateRecoveryLock(state, chatId));
}

async function maybeBlockSaveGenerateRequestForRecovery(state, requestInfo) {
    const chatId = String(requestInfo?.save?.chatId || '').trim();
    if (!chatId) {
        return null;
    }

    const lock = await waitForSaveGenerateRecoveryGate(state, chatId, 'generate-fetch');
    if (!lock) {
        return null;
    }

    console.debug(`${LOG_PREFIX} save-generate blocked native generate while recovering job=${lock.jobId || ''}`);
    showSaveGenerateRecoveryBlockToast(state);
    return buildSaveGenerateRecoveryBlockedResponse(lock);
}

async function waitForSaveGenerateRecoveryGate(state, chatId, reason = 'unknown') {
    const normalizedChatId = String(chatId || '').trim();
    if (!state || !normalizedChatId) {
        return null;
    }

    const existingLock = getSaveGenerateRecoveryLock(state, normalizedChatId);
    if (existingLock) {
        return existingLock;
    }

    const pendingCheck = getSaveGenerateResumeCheckPromise(state, normalizedChatId);
    if (pendingCheck) {
        await pendingCheck.catch(error => {
            console.debug(`${LOG_PREFIX} save-generate pending resume check failed`, error);
        });
        return getSaveGenerateRecoveryLock(state, normalizedChatId);
    }

    if (state.resumeCheckTimer && state.resumeCheckScheduledChatId === normalizedChatId) {
        const scheduledLastMessageHash = String(state.resumeCheckScheduledLastMessageHash || '');
        clearTimeout(state.resumeCheckTimer);
        state.resumeCheckTimer = null;
        state.resumeCheckScheduledChatId = '';
        state.resumeCheckScheduledLastMessageHash = '';
        refreshSaveGenerateRecoveryUiLock(state);
        await checkCurrentSaveGenerateJob(state, reason, { force: true, lastMessageHash: scheduledLastMessageHash }).catch(error => {
            console.debug(`${LOG_PREFIX} save-generate forced resume check failed`, error);
        });
    }

    return getSaveGenerateRecoveryLock(state, normalizedChatId);
}

function getSaveGenerateResumeCheckPromise(state, chatId) {
    if (!chatId || !(state?.resumeCheckPromises instanceof Map)) {
        return null;
    }
    return state.resumeCheckPromises.get(chatId) || null;
}

function isSaveGenerateResumeCheckPendingForChat(state, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId) {
        return false;
    }
    if (state?.resumeCheckScheduledChatId === normalizedChatId && state.resumeCheckTimer) {
        return true;
    }
    return Boolean(getSaveGenerateResumeCheckPromise(state, normalizedChatId));
}

function setSaveGenerateRecoveryLock(state, job, chatId) {
    const normalizedChatId = String(chatId || job?.chatId || job?.save?.chatId || '').trim();
    const jobId = String(job?.id || '').trim();
    if (!state || !normalizedChatId || !jobId) {
        return null;
    }

    if (!(state.recoveryLocks instanceof Map)) {
        state.recoveryLocks = new Map();
    }

    const lock = {
        chatId: normalizedChatId,
        jobId,
        status: String(job?.status || ''),
        createdAt: Date.now(),
    };
    state.recoveryLocks.set(normalizedChatId, lock);
    refreshSaveGenerateRecoveryUiLock(state);
    return lock;
}

function getSaveGenerateRecoveryLock(state, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId || !(state?.recoveryLocks instanceof Map)) {
        return null;
    }

    const lock = state.recoveryLocks.get(normalizedChatId) || null;
    if (!lock) {
        return null;
    }

    if (Date.now() - Number(lock.createdAt || 0) > SAVE_GENERATE_POLL_TIMEOUT_MS * 2) {
        state.recoveryLocks.delete(normalizedChatId);
        refreshSaveGenerateRecoveryUiLock(state);
        return null;
    }

    return lock;
}

function clearSaveGenerateRecoveryLock(state, jobOrChatId) {
    if (!state || !(state.recoveryLocks instanceof Map)) {
        return;
    }

    const chatId = typeof jobOrChatId === 'string'
        ? jobOrChatId
        : String(jobOrChatId?.chatId || jobOrChatId?.save?.chatId || '').trim();
    const jobId = typeof jobOrChatId === 'string'
        ? ''
        : String(jobOrChatId?.jobId || jobOrChatId?.id || '').trim();

    if (!chatId && !jobId) {
        return;
    }

    for (const [lockedChatId, lock] of state.recoveryLocks.entries()) {
        if (chatId && lockedChatId !== chatId) {
            continue;
        }
        if (jobId && lock.jobId && lock.jobId !== jobId) {
            continue;
        }
        state.recoveryLocks.delete(lockedChatId);
    }

    refreshSaveGenerateRecoveryUiLock(state);
}

function refreshSaveGenerateRecoveryUiLock(state) {
    const chatId = getCurrentSaveGenerateChatId();
    const shouldBlock = Boolean(chatId && shouldBlockSaveGenerateUserInput(state, chatId));
    const elements = document.querySelectorAll(SAVE_GENERATE_RECOVERY_BLOCK_SELECTOR);
    for (const element of elements) {
        if (!(element instanceof HTMLElement)) {
            continue;
        }

        if (shouldBlock) {
            if (!element.dataset.baibaokuSaveGenerateRecoveryTitle) {
                element.dataset.baibaokuSaveGenerateRecoveryTitle = element.getAttribute('title') || '';
            }
            element.setAttribute('title', '柏宝库后台生成恢复中，请稍后再发送');
            element.setAttribute('aria-disabled', 'true');
            element.classList.add('bai-bai-save-generate-recovery-disabled');
            continue;
        }

        if (element.classList.contains('bai-bai-save-generate-recovery-disabled')) {
            const title = element.dataset.baibaokuSaveGenerateRecoveryTitle || '';
            if (title) {
                element.setAttribute('title', title);
            } else {
                element.removeAttribute('title');
            }
            delete element.dataset.baibaokuSaveGenerateRecoveryTitle;
            element.removeAttribute('aria-disabled');
            element.classList.remove('bai-bai-save-generate-recovery-disabled');
        }
    }
}

function buildSaveGenerateRecoveryBlockedResponse(lock) {
    return new Response(JSON.stringify({
        error: {
            message: '柏宝库后台生成恢复中，请稍后再发送。',
        },
        baibaokuSaveGenerateRecoveryBlocked: true,
        jobId: lock?.jobId || '',
    }), {
        status: 409,
        statusText: 'Conflict',
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'X-Baibaoku-Save-Generate-Recovery-Blocked': 'true',
        },
    });
}

function showSaveGenerateRecoveryBlockToast(state) {
    const now = Date.now();
    if (now - Number(state?.lastRecoveryBlockToastAt || 0) < SAVE_GENERATE_RECOVERY_BLOCK_TOAST_INTERVAL_MS) {
        return;
    }
    if (state) {
        state.lastRecoveryBlockToastAt = now;
    }
    showSaveGenerateInfoToast('柏宝库后台生成恢复中，请稍后再发送');
}

function isSaveGenerateKnownLocalJob(state, jobId) {
    if (!jobId || !Array.isArray(state?.pendingJobs)) {
        return false;
    }
    cleanupSaveGenerateRecords(state);
    return state.pendingJobs.some(record => String(record?.id || '') === String(jobId));
}

function markSaveGenerateLocalJobConsumed(state, jobId) {
    if (!jobId || !Array.isArray(state?.pendingJobs)) {
        return;
    }

    for (const record of state.pendingJobs) {
        if (String(record?.id || '') === String(jobId)) {
            record.consumed = true;
        }
    }
    cleanupSaveGenerateRecords(state);
}

function markSaveGenerateLocalChatJobsConsumed(state, chatId) {
    const normalizedChatId = String(chatId || '').trim();
    if (!normalizedChatId || !Array.isArray(state?.pendingJobs)) {
        return;
    }

    for (const record of state.pendingJobs) {
        const recordChatId = String(record?.save?.chatId || record?.chatId || '').trim();
        if (recordChatId === normalizedChatId) {
            record.consumed = true;
            if (record.id) {
                markSaveGenerateJobSeen(record);
            }
        }
    }
    cleanupSaveGenerateRecords(state);
}

async function fetchSaveGenerateJobByChatId(fetchFn, chatId, { lastMessageHash = '', lastMessageInfo = null } = {}) {
    const headers = new Headers(getRequestHeaders());
    const query = new URLSearchParams({ chatId });
    if (lastMessageHash) {
        query.set('lastMessageHash', lastMessageHash);
    }
    if (lastMessageInfo && Number.isInteger(lastMessageInfo.floor) && lastMessageInfo.floor >= 0) {
        query.set('lastMessageFloor', String(lastMessageInfo.floor));
        query.set('lastMessageRole', lastMessageInfo.role || '');
    }
    const response = await fetchFn(`${BAIBAOKU_SAVE_GENERATE_URL}/pending?${query.toString()}`, {
        method: 'GET',
        headers,
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }
    return payload.data || null;
}

function getCurrentSaveGenerateLastMessageHash() {
    return getCurrentSaveGenerateLastMessageInfo().hash;
}

function getCurrentSaveGenerateLastMessageInfo() {
    const tail = getCurrentSaveGenerateChatTailMessage();
    if (!tail?.message) {
        return { hash: '', floor: -1, role: '' };
    }

    return {
        hash: makeSaveGenerateMessageContentHash(tail.message.mes ?? '', tail.floor),
        floor: tail.floor,
        role: tail.message.is_user === true ? 'user' : 'assistant',
    };
}

function makeSaveGenerateMessageContentHash(value, floor) {
    const text = String(value ?? '');
    const numericFloor = floor === null || floor === undefined ? -1 : Number(floor);
    const normalizedFloor = Number.isInteger(numericFloor) && numericFloor >= 0 ? numericFloor : -1;
    const hashInput = `${normalizedFloor}\n${text}`;
    let hash = 0x811c9dc5;
    for (let index = 0; index < hashInput.length; index += 1) {
        hash ^= hashInput.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }
    return `m${normalizedFloor}:${text.length.toString(36)}:${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function installSaveGenerateDisplayStyle() {
    if (document.getElementById(SAVE_GENERATE_DISPLAY_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = SAVE_GENERATE_DISPLAY_STYLE_ID;
    style.textContent = `
.${SAVE_GENERATE_DISPLAY_CLASS} {
    position: fixed !important;
    top: auto !important;
    right: 18px !important;
    bottom: 18px !important;
    left: auto !important;
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    width: min(520px, calc(100vw - 36px)) !important;
    max-height: min(70vh, 620px) !important;
    box-sizing: border-box !important;
    overflow: hidden !important;
    padding: 10px 12px !important;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18)) !important;
    border-radius: 8px !important;
    background: var(--SmartThemeBlurTintColor, rgba(32, 32, 32, 0.96)) !important;
    color: var(--SmartThemeBodyColor, #f1f1f1) !important;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.28) !important;
    opacity: 0 !important;
    transform: translateY(8px) !important;
    transition: opacity 220ms ease, transform 220ms ease !important;
    z-index: 50000 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS}.bai-bai-save-generate-display-visible {
    opacity: 1 !important;
    transform: translateY(0) !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS}.bai-bai-save-generate-display-minimized .bai-bai-save-generate-display-content {
    display: none !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-label {
    display: flex !important;
    align-items: center !important;
    gap: 8px !important;
    min-height: 28px !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-led {
    flex: 0 0 auto !important;
    width: 9px !important;
    height: 9px !important;
    border-radius: 50% !important;
    background: #ffb020 !important;
    box-shadow: 0 0 0 0 rgba(255, 176, 32, 0.7) !important;
    animation: bai-bai-save-generate-pulse 1.4s infinite !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS}.bai-bai-save-generate-display-complete .bai-bai-save-generate-display-led {
    background: #35c759 !important;
    box-shadow: 0 0 8px rgba(53, 199, 89, 0.8) !important;
    animation: none !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS}.bai-bai-save-generate-display-stopped .bai-bai-save-generate-display-led {
    background: #ff453a !important;
    box-shadow: 0 0 8px rgba(255, 69, 58, 0.75) !important;
    animation: none !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-label-text {
    flex: 1 1 auto !important;
    min-width: 0 !important;
    overflow-wrap: anywhere !important;
    font-weight: 600 !important;
    line-height: 1.35 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-controls {
    display: flex !important;
    flex: 0 0 auto !important;
    align-items: center !important;
    gap: 4px !important;
    margin-left: auto !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-btn {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 26px !important;
    height: 26px !important;
    min-width: 26px !important;
    min-height: 26px !important;
    padding: 0 !important;
    border: 1px solid var(--SmartThemeBorderColor, rgba(255, 255, 255, 0.18)) !important;
    border-radius: 6px !important;
    background: rgba(255, 255, 255, 0.08) !important;
    color: inherit !important;
    line-height: 1 !important;
    cursor: pointer !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-btn:hover {
    background: rgba(255, 255, 255, 0.14) !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-btn:disabled {
    cursor: default !important;
    opacity: 0.55 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-content {
    display: flex !important;
    flex-direction: column !important;
    gap: 8px !important;
    min-height: 0 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-reasoning,
.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-text {
    min-height: 0 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-reasoning-label {
    margin-bottom: 4px !important;
    opacity: 0.75 !important;
    font-size: 0.9em !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-reasoning-content,
.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-text-content {
    max-height: 42vh !important;
    overflow: auto !important;
    overflow-wrap: anywhere !important;
    line-height: 1.45 !important;
}

.${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-reasoning-content {
    max-height: 22vh !important;
    opacity: 0.88 !important;
}

@keyframes bai-bai-save-generate-pulse {
    0% {
        box-shadow: 0 0 0 0 rgba(255, 176, 32, 0.7);
    }
    70% {
        box-shadow: 0 0 0 8px rgba(255, 176, 32, 0);
    }
    100% {
        box-shadow: 0 0 0 0 rgba(255, 176, 32, 0);
    }
}

@media (max-width: 768px), (pointer: coarse) {
    .${SAVE_GENERATE_DISPLAY_CLASS} {
        top: clamp(max(16px, env(safe-area-inset-top)), 24dvh, 180px) !important;
        right: auto !important;
        bottom: auto !important;
        left: 50% !important;
        width: calc(100dvw - 16px) !important;
        max-width: 560px !important;
        max-height: min(58dvh, 420px) !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        padding: 10px 12px !important;
        border-radius: 8px !important;
        transform: translate(-50%, -12px) !important;
    }

    .${SAVE_GENERATE_DISPLAY_CLASS}.bai-bai-save-generate-display-visible {
        transform: translate(-50%, 0) !important;
    }

    .${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-label {
        min-height: 28px !important;
    }

    .${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-label-text {
        white-space: normal !important;
        line-height: 1.35 !important;
    }

    .${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-text-content {
        max-height: 42dvh !important;
    }

    .${SAVE_GENERATE_DISPLAY_CLASS} .bai-bai-save-generate-display-reasoning-content {
        max-height: 22dvh !important;
    }
}
`;
    document.head.appendChild(style);
}

function markSaveGenerateDisplayElement(jobId) {
    const displays = Array.from(document.querySelectorAll(`.${SAVE_GENERATE_DISPLAY_CLASS}`));
    const element = displays.find(item => item instanceof HTMLElement && item.dataset.baibaokuSaveGenerateJobId === String(jobId || ''))
        || displays[displays.length - 1];
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.classList.add(SAVE_GENERATE_DISPLAY_CLASS);
    element.dataset.baibaokuSaveGenerateJobId = String(jobId || '');
}

function handleSaveGenerateJobForCurrentChat(state, job, chatId, reason = 'unknown') {
    setSaveGenerateRecoveryLock(state, job, chatId);

    if (isSaveGenerateSavedStatus(job.status)) {
        updateSaveGenerateResumeDisplay(state, job);
        void maybeRecoverCurrentChatForSaveGenerateJob(job, chatId, reason)
            .catch(error => {
                console.debug(`${LOG_PREFIX} save-generate recovery failed`, error);
            })
            .finally(() => clearSaveGenerateRecoveryLock(state, job));
        return;
    }

    if (isSaveGenerateTerminalStatus(job.status)) {
        updateSaveGenerateResumeDisplay(state, job);
        markSaveGenerateJobSeen(job);
        clearSaveGenerateRecoveryLock(state, job);
        return;
    }

    monitorSaveGenerateJob(state, job, chatId, reason);
}

function updateSaveGenerateResumeDisplay(state, job) {
    if (!state || !job?.id || isSaveGenerateJobSeen(job)) {
        return;
    }

    if (!(state.resumeDisplays instanceof Map)) {
        state.resumeDisplays = new Map();
    }

    let display = state.resumeDisplays.get(job.id);
    if (!display) {
        display = new SaveGenerateDisplay();
        display.show({
            label: getSaveGenerateDisplayLabel(job),
            onStop: () => stopSaveGenerateResumeJob(state, job.id),
        });
        state.resumeDisplays.set(job.id, display);
    } else {
        display.setLabel(getSaveGenerateDisplayLabel(job));
    }
    markSaveGenerateDisplayElement(job.id);

    if (job.reasoning) {
        display.updateReasoning(job.reasoning);
    }
    if (job.resultText) {
        display.updateContent(job.resultText);
    }

    if (isSaveGenerateSavedStatus(job.status)) {
        display.complete({ label: '柏宝库生成已保存，正在恢复消息...', delay: 1500 });
        scheduleSaveGenerateDisplayCleanup(state, job.id);
        return;
    }

    if (String(job.status || '') === 'canceled') {
        finishSaveGenerateCanceledDisplay(state, job);
        return;
    }

    if (isSaveGenerateTerminalStatus(job.status)) {
        display.markStopped({ label: getSaveGenerateDisplayLabel(job) });
        scheduleSaveGenerateDisplayCleanup(state, job.id);
    }
}

async function stopSaveGenerateResumeJob(state, jobId) {
    const display = state?.resumeDisplays?.get(jobId);
    if (!state?.originalFetch || !jobId) {
        display?.setLabel('柏宝库无法停止后台生成');
        return;
    }

    try {
        display?.setLabel('柏宝库正在停止后台生成...');
        const canceledJob = await cancelSaveGenerateJob(state.originalFetch, jobId);
        const job = {
            id: jobId,
            ...(canceledJob || {}),
            status: canceledJob?.status || 'canceled',
        };
        finishSaveGenerateCanceledDisplay(state, job);
    } catch (error) {
        console.debug(`${LOG_PREFIX} save-generate cancel failed`, error);
        display?.setLabel('柏宝库停止失败，后台生成仍在继续...');
    }
}

function finishSaveGenerateCanceledDisplay(state, job) {
    if (!job?.id) {
        return;
    }

    clearActiveSaveGenerateCancelTarget(state, job);
    clearSaveGenerateRecoveryLock(state, job);

    if (isSaveGenerateJobSeen(job)) {
        markSaveGenerateLocalJobConsumed(state, job.id);
        const existingDisplay = state?.resumeDisplays?.get(job.id);
        existingDisplay?.hide();
        state?.resumeDisplays?.delete(job.id);
        return;
    }

    markSaveGenerateJobSeen(job);
    markSaveGenerateLocalJobConsumed(state, job.id);
    const display = state?.resumeDisplays?.get(job.id);
    display?.hide();
    state?.resumeDisplays?.delete(job.id);
    showSaveGenerateInfoToast('柏宝库后台生成已停止');
}

function showSaveGenerateInfoToast(message) {
    if (typeof globalThis.toastr?.info === 'function') {
        globalThis.toastr.info(message, '柏宝库');
    }
}

function scheduleSaveGenerateDisplayCleanup(state, jobId) {
    setTimeout(() => {
        const display = state?.resumeDisplays?.get(jobId);
        if (!display || display.isComplete || display.isStopped) {
            state?.resumeDisplays?.delete(jobId);
        }
    }, 5000);
}

function getSaveGenerateDisplayLabel(job) {
    const status = String(job?.status || '');
    if (isSaveGenerateSavedStatus(status)) {
        return '柏宝库生成已保存，正在恢复消息...';
    }
    if (status === 'failed') {
        return '柏宝库后台生成失败';
    }
    if (status === 'canceled') {
        return '柏宝库后台生成已停止';
    }
    if (status === 'conflict') {
        return '柏宝库已生成内容，但未能自动保存';
    }
    if (status === 'saving') {
        return '柏宝库正在保存生成内容...';
    }
    return '柏宝库后台生成中...';
}

function monitorSaveGenerateJob(state, job, chatId, reason = 'unknown') {
    if (!job?.id || state.monitoredJobIds?.has(job.id)) {
        return;
    }

    if (!(state.monitoredJobIds instanceof Set)) {
        state.monitoredJobIds = new Set();
    }

    state.monitoredJobIds.add(job.id);
    const record = {
        id: job.id,
        save: job.save || { file_name: chatId, chatId },
        status: job.status || '',
        createdAt: Date.now(),
        consumed: false,
    };

    updateSaveGenerateResumeDisplay(state, job);

    void waitSaveGenerateJobTerminal(state, record, {
        onUpdate: updatedJob => updateSaveGenerateResumeDisplay(state, updatedJob),
    })
        .then(terminalJob => {
            if (String(terminalJob?.status || '') === 'timeout') {
                console.debug(`${LOG_PREFIX} save-generate monitor timed out job=${job.id} reason=${reason}`);
                clearSaveGenerateRecoveryLock(state, job);
                return;
            }
            handleSaveGenerateJobForCurrentChat(state, terminalJob, chatId, `monitor:${reason}`);
        })
        .catch(error => {
            console.debug(`${LOG_PREFIX} save-generate monitor failed`, error);
            clearSaveGenerateRecoveryLock(state, job);
        })
        .finally(() => {
            state.monitoredJobIds.delete(job.id);
        });
}

async function maybeRecoverCurrentChatForSaveGenerateJob(job, chatId, reason = 'unknown') {
    if (!job?.id || isSaveGenerateJobSeen(job)) {
        return;
    }

    if (getCurrentSaveGenerateChatId() !== String(chatId || '')) {
        return;
    }

    await waitForSaveGenerateCurrentChatReady(chatId);
    if (getCurrentSaveGenerateChatId() !== String(chatId || '')) {
        return;
    }

    if (isCurrentSaveGenerateMessageAlreadyInserted(job)) {
        markSaveGenerateJobSeen(job);
        return;
    }

    if (isSaveGenerateSendAsRecoverableType(job.save?.type)) {
        await insertSaveGenerateJobWithSendAs(job, chatId, reason);
        return;
    }

    markSaveGenerateJobSeen(job);
    console.debug(`${LOG_PREFIX} save-generate saved non-normal job while page was away; reloading chat job=${job.id} reason=${reason}`);
    await reloadCurrentChat().catch(error => {
        console.debug(`${LOG_PREFIX} save-generate chat reload failed`, error);
    });
}

async function waitForSaveGenerateCurrentChatReady(chatId) {
    const normalizedChatId = String(chatId || '');
    const deadline = Date.now() + SAVE_GENERATE_RECOVERY_CHAT_READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
        if (getCurrentSaveGenerateChatId() !== normalizedChatId) {
            return false;
        }
        if (isSaveGenerateCurrentChatContentReady()) {
            return true;
        }
        await delaySaveGeneratePoll(SAVE_GENERATE_RECOVERY_CHAT_READY_INTERVAL_MS);
    }

    return getCurrentSaveGenerateChatId() === normalizedChatId && isSaveGenerateCurrentChatContentReady();
}

function isSaveGenerateCurrentChatContentReady() {
    const messages = scriptModule.chat;
    return Array.isArray(messages) && messages.some(message => message && !message.chat_metadata);
}

async function insertSaveGenerateJobWithSendAs(job, chatId, reason = 'unknown') {
    if (!job?.id || isSaveGenerateJobSeen(job)) {
        return;
    }

    const text = String(job.savedMessage?.mes ?? job.resultText ?? '');
    if (!text) {
        markSaveGenerateJobSeen(job);
        console.debug(`${LOG_PREFIX} save-generate saved empty job; reloading chat job=${job.id} reason=${reason}`);
        await reloadCurrentChat().catch(error => {
            console.debug(`${LOG_PREFIX} save-generate chat reload failed`, error);
        });
        return;
    }

    if (isCurrentSaveGenerateMessageAlreadyInserted(job)) {
        markSaveGenerateJobSeen(job);
        return;
    }

    const name = String(job.savedMessage?.name || characters?.[this_chid]?.name || job.save?.ch_name || scriptModule.name2 || '').trim();
    if (!name) {
        markSaveGenerateJobSeen(job);
        console.debug(`${LOG_PREFIX} save-generate could not resolve character name; reloading chat job=${job.id} reason=${reason}`);
        await reloadCurrentChat().catch(error => {
            console.debug(`${LOG_PREFIX} save-generate chat reload failed`, error);
        });
        return;
    }

    try {
        console.debug(`${LOG_PREFIX} save-generate saved while page was away; inserting with sendas job=${job.id} reason=${reason}`);
        await sendMessageAs({ name, return: 'none' }, text);
        markSaveGenerateJobSeen(job);
    } catch (error) {
        console.debug(`${LOG_PREFIX} save-generate sendas recovery failed; reloading chat job=${job.id}`, error);
        markSaveGenerateJobSeen(job);
        await reloadCurrentChat().catch(reloadError => {
            console.debug(`${LOG_PREFIX} save-generate chat reload failed`, reloadError);
        });
    }
}

// The reply may only be inserted when the open chat's current tail sits exactly
// one floor below where this job expected its reply to land. If the tail is at or
// past that floor the reply is already present (the duplicate case); if it is more
// than one floor short something else changed and inserting would be wrong. Both
// sides of this comparison use the page's in-memory chat array — the same basis
// the front end used to compute expectedFloor at request time — so there is no
// drift against the back end's on-disk line count. Returns null when the job
// carries no expectedFloor (legacy jobs), letting callers fall back.
function isSaveGenerateExpectedFloorInsertable(job) {
    const expectedFloor = Number.isInteger(job?.save?.expectedFloor) ? job.save.expectedFloor : -1;
    if (expectedFloor < 0) {
        console.log(`${LOG_PREFIX} [楼层日志] 恢复判定 job=${job?.id} 期望楼层=缺失(旧job) → 回退旧逻辑`);
        return null;
    }

    const tail = getCurrentSaveGenerateChatTailMessage();
    const tailFloor = tail && Number.isInteger(tail.floor) ? tail.floor : -1;
    const insertable = tailFloor + 1 === expectedFloor;
    console.log(`${LOG_PREFIX} [楼层日志] 恢复判定 job=${job?.id} 当前末尾楼层=${tailFloor} 期望楼层=${expectedFloor} 末尾+1=${tailFloor + 1} → ${insertable ? '一致,允许插入(恢复)' : '不一致,不插入(挡重复)'}`);
    return insertable;
}

function isCurrentSaveGenerateMessageAlreadyInserted(job) {
    // Prefer the single-basis expectedFloor decision when the job carries one:
    // if the reply is not insertable at the current tail, treat it as already
    // present so callers suppress the insert.
    const insertable = isSaveGenerateExpectedFloorInsertable(job);
    if (insertable !== null) {
        return !insertable;
    }

    const messages = scriptModule.chat;
    if (!Array.isArray(messages) || messages.length === 0) {
        return false;
    }

    const expectedText = String(job.savedMessage?.mes ?? job.resultText ?? '');
    if (!expectedText) {
        return false;
    }

    const savedFloor = Number.isInteger(job.savedMessageFloor) ? job.savedMessageFloor : -1;
    const tail = getCurrentSaveGenerateChatTailMessage();
    if (tail?.message
        && tail.message.is_user !== true
        && Number.isInteger(savedFloor)
        && savedFloor >= 0
        && tail.floor >= savedFloor) {
        return true;
    }

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index];
        if (!message || message.chat_metadata) {
            continue;
        }
        return message.is_user !== true
            && isSaveGenerateTextIncludedInMessage(message.mes, expectedText);
    }

    return false;
}

function normalizeSaveGenerateComparableText(value) {
    return String(value ?? '')
        .replace(/^\uFEFF/, '')
        .replace(/\r\n/g, '\n')
        .replace(/\r/g, '\n')
        .replace(/\n?data:\s*\[DONE\]\s*$/i, '')
        .trim();
}

function isSaveGenerateTextIncludedInMessage(messageText, jobText) {
    const normalizedMessage = normalizeSaveGenerateComparableText(messageText);
    const normalizedJobText = normalizeSaveGenerateComparableText(jobText);
    return Boolean(normalizedJobText && normalizedMessage.includes(normalizedJobText));
}

function isSaveGenerateSendAsRecoverableType(type) {
    return ['normal', 'regenerate'].includes(String(type || 'normal'));
}

function isSaveGenerateTerminalStatus(status) {
    return ['completed', 'saved', 'already_saved', 'conflict', 'failed', 'canceled'].includes(String(status || ''));
}

function isSaveGenerateSavedStatus(status) {
    return ['completed', 'saved', 'already_saved'].includes(String(status || ''));
}

function isSaveGenerateChatAlreadySavedStatus(job) {
    const status = String(job?.status || '');
    if (!['saved', 'already_saved'].includes(status)) {
        return false;
    }

    return job.chatSaved === true || job.chatSaved === undefined;
}

function getSaveGenerateSeenStorageKey(job) {
    return `${SAVE_GENERATE_SEEN_STORAGE_PREFIX}:${job?.id || ''}`;
}

function isSaveGenerateJobSeen(job) {
    if (!job?.id) {
        return true;
    }

    try {
        return localStorage.getItem(getSaveGenerateSeenStorageKey(job)) === '1';
    } catch {
        return false;
    }
}

function markSaveGenerateJobSeen(job) {
    if (!job?.id) {
        return;
    }

    try {
        localStorage.setItem(getSaveGenerateSeenStorageKey(job), '1');
    } catch {
        // Ignore storage failures, e.g. private mode quota errors.
    }
}

export {
    bindSaveGenerateIntentToRequestBody,
    buildSaveGenerateRecoveryBlockedResponse,
    buildSkippedSaveGenerateSaveResponse,
    cancelActiveSaveGenerateJobFromNativeStop,
    cancelSaveGenerateJob,
    cancelSaveGenerateJobWithRetry,
    checkCurrentSaveGenerateJob,
    checkSaveGenerateBackendAvailable,
    cleanupSaveGenerateIntents,
    cleanupSaveGenerateRecords,
    clearActiveSaveGenerateCancelTarget,
    clearSaveGenerateLocalRequestGuard,
    clearSaveGenerateRecoveryLock,
    computeSaveGenerateExpectedFloor,
    consumeSaveGenerateIntentForRequest,
    delaySaveGeneratePoll,
    describeSaveGenerateBody,
    discardCurrentChatSaveGenerateJobsAfterMessageDelete,
    discardSaveGenerateJobsBeforeRetry,
    discardSaveGenerateJobsForChat,
    fetchNativeSaveForSaveGenerateRecord,
    fetchSaveGenerate,
    fetchSaveGenerateJobByChatId,
    fetchSaveGenerateJobStatus,
    findMatchingSaveGenerateRecord,
    finishSaveGenerateCanceledDisplay,
    finishSaveGenerateNativeSave,
    forgetSaveGenerateActiveChat,
    forgetSaveGenerateLocalJobOwnership,
    getActiveSaveGenerateCancelTarget,
    getCurrentSaveGenerateChatId,
    getCurrentSaveGenerateChatTailMessage,
    getCurrentSaveGenerateDescriptor,
    getCurrentSaveGenerateLastMessageHash,
    getCurrentSaveGenerateLastMessageInfo,
    getSaveGenerateDisplayLabel,
    getSaveGenerateRecoveryLock,
    getSaveGenerateRequestInfo,
    getSaveGenerateResumeCheckPromise,
    getSaveGenerateSeenStorageKey,
    guardSaveGenerateResponseUntilBodyDone,
    handleSaveGenerateJobForCurrentChat,
    insertSaveGenerateJobWithSendAs,
    installSaveGenerateDisplayStyle,
    installSaveGenerateFetchHook,
    installSaveGenerateIntentHandlers,
    installSaveGenerateMessageDeleteHandler,
    installSaveGenerateNativeStopHandler,
    installSaveGenerateRecoveryInputBlocker,
    installSaveGenerateResumeHandlers,
    isCurrentSaveGenerateChatTailReadyForAssistantReply,
    isCurrentSaveGenerateMessageAlreadyInserted,
    isEligibleSaveGenerateBody,
    isRetryableSaveGenerateCancelError,
    isSaveGenerateActiveLocalChat,
    isSaveGenerateBackendAvailable,
    isSaveGenerateChatAlreadySavedStatus,
    isSaveGenerateCurrentChatContentReady,
    isSaveGenerateExpectedFloorInsertable,
    isSaveGenerateJobSeen,
    isSaveGenerateKnownLocalJob,
    isSaveGenerateLocalRequestGuarded,
    isSaveGenerateMainChatGenerationOptions,
    isSaveGenerateNativeStopEvent,
    isSaveGenerateResumeCheckPendingForChat,
    isSaveGenerateSavedStatus,
    isSaveGenerateSendAsRecoverableType,
    isSaveGenerateTerminalStatus,
    isSaveGenerateTextIncludedInMessage,
    makeSaveGenerateMessageContentHash,
    makeSaveGenerateRequestBodyHash,
    markSaveGenerateActiveChat,
    markSaveGenerateBackendAvailable,
    markSaveGenerateDisplayElement,
    markSaveGenerateJobSeen,
    markSaveGenerateLocalChatJobsConsumed,
    markSaveGenerateLocalJobConsumed,
    markSaveGenerateLocalRequestGuard,
    maybeBlockSaveGenerateRequestForRecovery,
    maybeHandleSaveGenerateSaveRequest,
    maybeRecoverCurrentChatForSaveGenerateJob,
    monitorSaveGenerateJob,
    normalizeSaveGenerateComparableText,
    normalizeSaveGenerateStableJson,
    parseSaveGenerateEventStreamBlock,
    queueSaveGenerateResumeCheck,
    recordSaveGenerateIntentFromGenerationEvent,
    refreshSaveGenerateRecoveryUiLock,
    releaseSaveGenerateLocalRequestGuard,
    rememberSaveGenerateJob,
    runCurrentSaveGenerateJobCheck,
    scheduleSaveGenerateDisplayCleanup,
    setActiveSaveGenerateCancelTarget,
    setSaveGenerateRecoveryLock,
    shouldBlockSaveGenerateUserInput,
    showSaveGenerateInfoToast,
    showSaveGenerateRecoveryBlockToast,
    stopSaveGenerateResumeJob,
    stringifySaveGenerateStableJson,
    updateSaveGenerateResumeDisplay,
    waitForSaveGenerateCurrentChatReady,
    waitForSaveGenerateRecoveryGate,
    waitForSaveGenerateMessageDelete,
    waitSaveGenerateJobTerminal,
    waitSaveGenerateJobTerminalEventStream,
    waitSaveGenerateJobTerminalPolling,
    watchLocalSaveGenerateTerminalStatus,
};
