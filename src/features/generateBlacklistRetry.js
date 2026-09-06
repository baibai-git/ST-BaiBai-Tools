import * as script from '@sillytavern/script';
import { waitUntilCondition } from '@sillytavern/scripts/utils';
import { GENERATE_RETRY_BASE_DELAY_MS, LOG_PREFIX } from './constants.js';
import { consumeGenerateRetryAttempt, getGenerateRetryMaxRetries } from './generateRetry.js';
import { discardSaveGenerateJobsBeforeRetry, waitForSaveGenerateMessageDelete } from './saveGenerate.js';
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

function isBlacklistRetryChatCurrent(run, context = script.getContext()) {
    return context.chat === run.chat
        && context.characterId === run.characterId
        && context.chatId === run.chatId
        && !context.groupId;
}

function isBlacklistRetryCurrent(run) {
    return getBlacklistRetryState().run === run
        && settings.generateBlacklistRetryEnabled === true
        && isBlacklistRetryChatCurrent(run)
        && !script.getContext().powerUserSettings?.auto_swipe;
}

function isBlacklistRetryReplyCurrent(run) {
    return isBlacklistRetryCurrent(run)
        && run.chat.length === run.messageId + 1
        && run.chat.at(-1) === run.message
        && run.message.mes === run.text
        && run.message.swipe_id === run.swipeId;
}

function cancelGenerateBlacklistRetry(run = getBlacklistRetryState().run) {
    const state = getBlacklistRetryState();
    if (!run || state.run !== run) {
        return;
    }

    state.run = null;
    state.launching = null;
    clearTimeout(state.timer);
    state.timer = null;
    if (run.uiLocked) {
        run.uiLocked = false;
        script.getContext().activateSendButtons();
    }
}

function installGenerateBlacklistRetry() {
    const state = getBlacklistRetryState();
    if (state.installed) {
        return;
    }
    state.installed = true;
    const { eventSource, event_types } = script;

    eventSource.on(event_types.GENERATION_STARTED, (type, options, dryRun) => {
        if (dryRun) {
            return;
        }
        const run = state.run;
        if (run && state.launching === run && type === 'regenerate' && options?.automatic_trigger === true) {
            state.launching = null;
            run.uiLocked = false;
            return;
        }
        // A new generation now owns the buttons, including unsupported generation types.
        if (run) {
            run.uiLocked = false;
        }
        cancelGenerateBlacklistRetry();
    });
    eventSource.on(event_types.GENERATION_AFTER_COMMANDS, startGenerateBlacklistRetry);
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, recordGenerateBlacklistReply);
    eventSource.on(event_types.GENERATION_ENDED, () => {
        if (state.run) {
            state.run.ended = true;
            queueGenerateBlacklistCheck(state.run);
        }
    });
    for (const event of [event_types.GENERATION_STOPPED, event_types.CHAT_CHANGED]) {
        eventSource.on(event, () => cancelGenerateBlacklistRetry());
    }
    for (const event of [event_types.MESSAGE_UPDATED, event_types.MESSAGE_SWIPED, event_types.MESSAGE_DELETED]) {
        eventSource.on(event, () => {
            const run = state.run;
            if (run?.message && !run.deleting) {
                cancelGenerateBlacklistRetry(run);
            }
        });
    }
}

function startGenerateBlacklistRetry(type, options, dryRun) {
    if (dryRun) {
        return;
    }
    const state = getBlacklistRetryState();
    const context = script.getContext();
    const entries = parseGenerateBlacklist(settings.generateBlacklistRetryText);
    const normalizedType = String(type || 'normal');
    if (settings.generateBlacklistRetryEnabled !== true || !entries.length
        || !SUPPORTED_TYPES.has(normalizedType) || context.groupId
        || context.characterId === undefined || !context.chatId || options?.quietToLoud) {
        cancelGenerateBlacklistRetry();
        return;
    }
    if (context.powerUserSettings?.auto_swipe) {
        cancelGenerateBlacklistRetry();
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
        previousTail: tail,
        message: null,
        processor: null,
        ended: false,
        settleDeadline: 0,
        removed: false,
        removalSaved: false,
    });
    state.run = run;
}

function recordGenerateBlacklistReply(messageId, type) {
    const run = getBlacklistRetryState().run;
    if (!run || run.phase !== 'generating' || !SUPPORTED_TYPES.has(String(type || 'normal'))) {
        return;
    }
    const context = script.getContext();
    const message = context.chat[messageId];
    if (!isBlacklistRetryCurrent(run) || messageId < run.minimumId
        || messageId !== context.chat.length - 1 || !message || message === run.previousTail
        || message.is_user || message.is_system) {
        return;
    }
    if (run.message && run.message !== message) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    run.message = message;
    run.messageId = messageId;
    run.processor = context.streamingProcessor;
    queueGenerateBlacklistCheck(run);
}

function queueGenerateBlacklistCheck(run) {
    if (!run.ended || run.phase !== 'generating') {
        return;
    }
    const state = getBlacklistRetryState();
    clearTimeout(state.timer);
    run.settleDeadline ||= Date.now() + SETTLE_TIMEOUT_MS;
    state.timer = setTimeout(() => checkGenerateBlacklistReply(run), 100);
}

function checkGenerateBlacklistReply(run) {
    if (!isBlacklistRetryCurrent(run) || run.processor?.abortController?.signal?.aborted || run.processor?.isStopped) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    const context = script.getContext();
    // Streaming emits GENERATION_ENDED before message events and the final save.
    if (script.is_send_press || script.isChatSaving || context.streamingProcessor) {
        if (Date.now() >= run.settleDeadline) {
            cancelGenerateBlacklistRetry(run);
            return;
        }
        queueGenerateBlacklistCheck(run);
        return;
    }
    if (!run.message || context.chat.at(-1) !== run.message || context.chat.length !== run.messageId + 1) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    const match = findGenerateBlacklistMatch(run.message.mes, run.entries);
    if (!match) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    run.phase = 'discarding';
    run.text = run.message.mes;
    run.swipeId = run.message.swipe_id;
    run.prefixTail = run.chat[run.messageId - 1];
    run.uiLocked = true;
    script.setSendButtonState(true);
    context.deactivateSendButtons();
    void handleBlacklistedReply(run, match);
}

function isBlacklistRetryPrefixCurrent(run) {
    return isBlacklistRetryChatCurrent(run)
        && run.chat.length === run.messageId
        && run.chat.at(-1) === run.prefixTail;
}

function restoreUncommittedBlacklistReply(run) {
    if (run.removed && !run.removalSaved && isBlacklistRetryPrefixCurrent(run)) {
        run.chat.push(run.message);
        script.getContext().addOneMessage(run.message);
    }
}

async function saveBlacklistReplyRemoval(run) {
    if (script.isChatSaving) {
        await waitUntilCondition(() => !script.isChatSaving, SETTLE_TIMEOUT_MS, 100);
    }
    if (!isBlacklistRetryPrefixCurrent(run)) {
        throw new Error('Chat changed before saving rejected reply removal');
    }
    const context = script.getContext();
    // Native saveChat() swallows save errors. Check this deletion's response so a
    // failed save cannot silently start another background job from stale history.
    const character = context.characters[run.characterId];
    const response = await globalThis.fetch('/api/chats/save', {
        method: 'POST',
        headers: context.getRequestHeaders(),
        body: JSON.stringify({
            ch_name: character.name,
            file_name: run.chatId,
            avatar_url: character.avatar,
            chat: [{ chat_metadata: context.chatMetadata, user_name: 'unused', character_name: 'unused' }, ...run.chat],
            force: false,
        }),
    });
    if (!response.ok) {
        throw new Error(`Chat save failed: HTTP ${response.status}`);
    }
    run.removalSaved = true;
}

async function handleBlacklistedReply(run, match) {
    try {
        const context = script.getContext();
        const backendChatId = context.getCurrentChatId();
        await discardSaveGenerateJobsBeforeRetry(backendChatId);
        if (!isBlacklistRetryReplyCurrent(run)) {
            cancelGenerateBlacklistRetry(run);
            return;
        }

        if (run.retries >= run.maxRetries) {
            run.deleting = true;
            run.removed = true;
            try {
                await context.deleteLastMessage();
            } finally {
                run.deleting = false;
            }
            await waitForSaveGenerateMessageDelete(backendChatId);
            if (!isBlacklistRetryCurrent(run) || !isBlacklistRetryPrefixCurrent(run)) {
                restoreUncommittedBlacklistReply(run);
                cancelGenerateBlacklistRetry(run);
                return;
            }
            await saveBlacklistReplyRemoval(run);
            globalThis.toastr?.warning(`总重试次数已达 ${run.maxRetries} 次，命中回复已丢弃，生成已停止。`, '生成失败自动重试');
            cancelGenerateBlacklistRetry(run);
            return;
        }

        run.phase = 'waiting';
        globalThis.toastr?.warning(
            `命中黑名单「${match.slice(0, 60)}」，1.5 秒后重试（第 ${run.retries + 1}/${run.maxRetries} 次）。`,
            '生成失败自动重试',
            { escapeHtml: true, timeOut: 2500 },
        );
        getBlacklistRetryState().timer = setTimeout(() => restartBlacklistedGeneration(run), GENERATE_RETRY_BASE_DELAY_MS);
    } catch (error) {
        restoreUncommittedBlacklistReply(run);
        console.warn(`${LOG_PREFIX} blacklist retry stopped`, error);
        globalThis.toastr?.error('无法安全清理或保存命中回复，已停止黑名单重试。', '生成失败自动重试');
        cancelGenerateBlacklistRetry(run);
    }
}

async function restartBlacklistedGeneration(run) {
    if (!isBlacklistRetryReplyCurrent(run)
        || script.isChatSaving || script.getContext().streamingProcessor) {
        cancelGenerateBlacklistRetry(run);
        return;
    }
    const state = getBlacklistRetryState();
    const rejected = { ...run };
    if (!consumeGenerateRetryAttempt(run)) {
        run.phase = 'discarding';
        await handleBlacklistedReply(run, '');
        return;
    }
    state.launching = run;
    try {
        // Keep the rejected tail until Generate deletes it. Deleting it first would
        // let regenerate delete an earlier, valid assistant message as well.
        await script.getContext().generate('regenerate', { automatic_trigger: true });
    } catch (error) {
        console.warn(`${LOG_PREFIX} blacklist regeneration failed`, error);
        cancelGenerateBlacklistRetry(run);
    } finally {
        // Generation may fail after removing the rejected reply but before saving.
        if (isBlacklistRetryPrefixCurrent(rejected) && !script.isChatSaving && !script.is_send_press) {
            try {
                await saveBlacklistReplyRemoval(rejected);
            } catch (error) {
                console.warn(`${LOG_PREFIX} blacklist removal save failed`, error);
                globalThis.toastr?.error('命中回复的删除未能保存，请检查连接。', '生成失败自动重试');
            }
        }
        if (state.launching === run) {
            cancelGenerateBlacklistRetry(run);
        }
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
            cancelGenerateBlacklistRetry();
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
