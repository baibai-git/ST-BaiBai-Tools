import * as script from '@sillytavern/script';
import { getContext } from '@sillytavern/scripts/extensions';
import { GENERATE_BLACKLIST_SETTLED_EVENT, GENERATE_RETRY_BASE_DELAY_MS, LOG_PREFIX } from './constants.js';
import { consumeGenerateRetryAttempt, getGenerateRetryMaxRetries } from './generateRetry.js';
import { extensionState, settings } from './state.js';

const SUPPORTED_TYPES = new Set(['normal', 'regenerate']);
const SETTLE_TIMEOUT_MS = 60_000;

function getBlacklistRetryState() {
    return extensionState.generateBlacklistRetry ??= { installed: false, run: null, timer: null, launching: null };
}

function parseGenerateBlacklist(text) {
    return [...new Set(String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
}

function findGenerateBlacklistMatch(text, entries) {
    const normalized = String(text || '').toLowerCase();
    return entries.find(entry => normalized.includes(entry.toLowerCase())) || '';
}

function isGenerateBlacklistRunCurrent(run, context) {
    return getBlacklistRetryState().run === run
        && settings.generateBlacklistRetryEnabled === true
        && context.chat === run.chat
        && context.characterId === run.characterId
        && context.chatId === run.chatId
        && !context.groupId
        && !context.powerUserSettings?.auto_swipe;
}

function cancelGenerateBlacklistRetry(run = getBlacklistRetryState().run, completed = false) {
    const state = getBlacklistRetryState();
    if (!run || state.run !== run) return;
    state.run = null;
    state.launching = null;
    clearTimeout(state.timer);
    state.timer = null;
    // Notify before unlocking: activateSendButtons can emit another GENERATION_ENDED.
    void script.eventSource.emit(GENERATE_BLACKLIST_SETTLED_EVENT, completed);
    if (run.uiLocked) {
        run.uiLocked = false;
        getContext().activateSendButtons();
    }
}

function installGenerateBlacklistRetry() {
    const state = getBlacklistRetryState();
    if (state.installed) return;
    state.installed = true;
    const { eventSource, event_types } = script;

    eventSource.on(event_types.GENERATION_STARTED, (type, options, dryRun) => {
        if (dryRun) return;
        const run = state.run;
        // A new generation owns the buttons; only our own regenerate keeps the budget.
        if (run) run.uiLocked = false;
        if (run && state.launching === run && type === 'regenerate' && options?.automatic_trigger === true) {
            state.launching = null;
            return;
        }
        cancelGenerateBlacklistRetry(run);
    });
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, startGenerateBlacklistRetry);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (messageId, type) => {
        const run = state.run;
        if (!run || run.phase !== 'generating' || !SUPPORTED_TYPES.has(String(type || 'normal'))
            || !Number.isInteger(messageId) || messageId < run.minimumId) return;
        if (run.messageId !== null && run.messageId !== messageId) {
            cancelGenerateBlacklistRetry(run);
            return;
        }
        // Only remember which floor this generation produced, not a snapshot of its text/object.
        run.messageId = messageId;
        run.processor ??= getContext().streamingProcessor;
        queueGenerateBlacklistCheck(run);
    });
    eventSource.on(event_types.GENERATION_ENDED, () => {
        if (state.run?.phase === 'generating') {
            state.run.ended = true;
            queueGenerateBlacklistCheck(state.run);
        }
    });
    for (const event of [event_types.GENERATION_STOPPED, event_types.CHAT_CHANGED]) {
        eventSource.on(event, () => cancelGenerateBlacklistRetry(state.run));
    }
    for (const event of [event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED]) {
        eventSource.on(event, messageId => {
            const run = state.run;
            if (run?.messageId != null && Number(messageId) === run.messageId) cancelGenerateBlacklistRetry(run);
        });
    }
    eventSource.on(event_types.MESSAGE_DELETED, () => {
        if (state.run?.messageId != null) cancelGenerateBlacklistRetry(state.run);
    });
}

function startGenerateBlacklistRetry(type, options, dryRun) {
    if (dryRun) return;
    const state = getBlacklistRetryState();
    // Disabled means no context construction, parsing or background checks.
    if (settings.generateBlacklistRetryEnabled !== true) {
        cancelGenerateBlacklistRetry(state.run);
        return;
    }
    const context = getContext();
    const entries = parseGenerateBlacklist(settings.generateBlacklistRetryText);
    const normalizedType = String(type || 'normal');
    if (!entries.length || !SUPPORTED_TYPES.has(normalizedType) || context.groupId
        || context.characterId === undefined || !context.chatId || options?.quietToLoud) {
        cancelGenerateBlacklistRetry(state.run);
        return;
    }
    if (context.powerUserSettings?.auto_swipe) {
        cancelGenerateBlacklistRetry(state.run);
        globalThis.toastr?.warning('酒馆原生自动切换回复已开启，黑名单重试本轮暂停。', '生成失败自动重试');
        return;
    }

    const run = state.run || {
        chat: context.chat,
        characterId: context.characterId,
        chatId: context.chatId,
        retries: 0,
        maxRetries: getGenerateRetryMaxRetries(),
        entries,
    };
    const tail = context.chat.at(-1);
    Object.assign(run, {
        phase: 'generating',
        minimumId: context.chat.length - (normalizedType === 'regenerate' && tail && !tail.is_user ? 1 : 0),
        messageId: null,
        processor: null,
        ended: false,
        settleDeadline: 0,
    });
    state.run = run;
}

function queueGenerateBlacklistCheck(run, delay = 100) {
    if (getBlacklistRetryState().run !== run || !run.ended) return;
    const state = getBlacklistRetryState();
    clearTimeout(state.timer);
    run.settleDeadline ||= Date.now() + SETTLE_TIMEOUT_MS;
    state.timer = setTimeout(() => checkGenerateBlacklistReply(run), delay);
}

async function checkGenerateBlacklistReply(run) {
    const context = getContext();
    const failedStream = run.processor?.isStopped === true && run.processor?.isFinished === false;
    if (!isGenerateBlacklistRunCurrent(run, context)
        || (!failedStream && (run.processor?.abortController?.signal?.aborted || run.processor?.isStopped))) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    // ST's stream end event precedes message events and saving. Keep waiting even
    // if another save starts during the retry delay; our own button lock is not a new generation.
    const processor = context.streamingProcessor;
    const waitingForSave = script.isChatSaving;
    const waitingForSend = script.is_send_press && !run.uiLocked;
    const waitingForStream = processor && !(processor === run.processor && failedStream);
    if (waitingForSave || waitingForSend || waitingForStream) {
        if (Date.now() >= run.settleDeadline) {
            const waitReason = [waitingForSave && 'isChatSaving', waitingForSend && 'is_send_press',
                waitingForStream && 'streamingProcessor'].filter(Boolean).join(', ');
            globalThis.toastr?.warning('等待酒馆收尾超时，已停止黑名单重试，当前回复已保留。', '生成失败自动重试');
            console.warn(`${LOG_PREFIX} [黑名单重试] 等待 ST 收尾超时：${waitReason}`);
            cancelGenerateBlacklistRetry(run);
        } else {
            queueGenerateBlacklistCheck(run);
        }
        return;
    }

    const message = context.chat.at(-1);
    if (run.messageId === null || run.messageId !== context.chat.length - 1
        || !message || message.is_user || message.is_system) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    const match = findGenerateBlacklistMatch(message.mes, run.entries);
    if (!match) {
        cancelGenerateBlacklistRetry(run, true);
        return;
    }
    if (run.retries >= run.maxRetries) {
        globalThis.toastr?.warning(`总重试次数已达 ${run.maxRetries} 次，已停止重试并保留最后回复。`, '生成失败自动重试');
        cancelGenerateBlacklistRetry(run, true);
        return;
    }
    if (run.phase === 'generating') {
        run.phase = 'waiting';
        run.uiLocked = true;
        script.setSendButtonState(true);
        context.deactivateSendButtons();
        globalThis.toastr?.warning(
            `命中黑名单「${match.slice(0, 60)}」，1.5 秒后重试（第 ${run.retries + 1}/${run.maxRetries} 次）。`,
            '生成失败自动重试',
            { escapeHtml: true, timeOut: 2500 },
        );
        run.settleDeadline = Date.now() + GENERATE_RETRY_BASE_DELAY_MS + SETTLE_TIMEOUT_MS;
        queueGenerateBlacklistCheck(run, GENERATE_RETRY_BASE_DELAY_MS);
        return;
    }

    if (!consumeGenerateRetryAttempt(run)) return cancelGenerateBlacklistRetry(run, true);
    const state = getBlacklistRetryState();
    state.launching = run;
    try {
        // ponytail: ST owns replacement, MESSAGE_DELETED cleanup and saving, just like manual regenerate.
        await context.generate('regenerate', { automatic_trigger: true });
    } catch (error) {
        console.warn(`${LOG_PREFIX} [黑名单重试] 原生重新生成抛出异常`, error);
        cancelGenerateBlacklistRetry(run);
    } finally {
        if (state.launching === run) cancelGenerateBlacklistRetry(run);
    }
}

function bindGenerateBlacklistRetrySettings({ saveSettings } = {}) {
    const syncVisibility = () => $('#bai_bai_toolkit_generate_blacklist_retry_text').toggle(settings.generateBlacklistRetryEnabled === true);
    const bind = (id, key, event, readValue) => {
        const element = $(id);
        if (typeof settings[key] === 'boolean') {
            element.prop('checked', settings[key]);
        } else {
            element.val(settings[key]);
        }
        element.off(`${event}.baiBaiToolkitBlacklistRetry`).on(`${event}.baiBaiToolkitBlacklistRetry`, function () {
            settings[key] = readValue($(this));
            syncVisibility();
            cancelGenerateBlacklistRetry(undefined);
            saveSettings?.();
        });
    };
    bind('#bai_bai_toolkit_generate_blacklist_retry_enabled', 'generateBlacklistRetryEnabled', 'input', element => Boolean(element.prop('checked')));
    bind('#bai_bai_toolkit_generate_blacklist_retry_text', 'generateBlacklistRetryText', 'input', element => String(element.val() || ''));
    syncVisibility();
}

export {
    bindGenerateBlacklistRetrySettings,
    cancelGenerateBlacklistRetry,
    findGenerateBlacklistMatch,
    installGenerateBlacklistRetry,
    parseGenerateBlacklist,
};
