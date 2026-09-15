import * as script from '@sillytavern/script';
import { getContext } from '@sillytavern/scripts/extensions';
import { GENERATE_BLACKLIST_SETTLED_EVENT, GENERATE_RETRY_BASE_DELAY_MS, LOG_PREFIX } from './constants.js';
import { consumeGenerateRetryAttempt, getGenerateRetryMaxRetries } from './generateRetry.js';
import { isCurrentGenerationStopped } from './generationLifecycle.js';
import { extensionState, settings } from './state.js';

const SUPPORTED_TYPES = new Set(['normal', 'regenerate']);
const SETTLE_TIMEOUT_MS = 60_000;
const STOPPED_LAUNCH_TTL_MS = 15_000;
const BLACKLIST_RETRY_TOAST_TITLE = '黑名单命中自动重试';

function getBlacklistRetryState() {
    return extensionState.generateBlacklistRetry ??= {
        installed: false,
        run: null,
        timer: null,
        launching: null,
        stoppedLaunch: null,
        stoppedLaunchDeadline: 0,
    };
}

function clearStoppedLaunch(state = getBlacklistRetryState()) {
    state.stoppedLaunch = null;
    state.stoppedLaunchDeadline = 0;
}

function takeStoppedLaunch(state, context) {
    const run = state.stoppedLaunch;
    if (!run) return null;
    const expired = Date.now() > Number(state.stoppedLaunchDeadline || 0);
    clearStoppedLaunch(state);
    const sameTarget = run.chat === context.chat && run.characterId === context.characterId
        && run.chatId === context.chatId;
    if (expired || !sameTarget) return null;
    console.debug(`${LOG_PREFIX} [黑名单重试] 复用被停止打断的重试预算（第 ${run.retries}/${run.maxRetries} 次）`);
    return run;
}

const BLACKLIST_REGEX_LINE_PATTERN = /^\/(.+)\/([a-z]*)$/i;
const BLACKLIST_ENTRY_CACHE_LIMIT = 200;
const blacklistEntryCache = new Map();
const warnedBlacklistRegex = new Set();

function parseGenerateBlacklist(text) {
    return [...new Set(String(text || '').split(/\r?\n/).map(line => line.trim()).filter(Boolean))];
}

// 普通行保持历史行为:按包含文本匹配、忽略英文大小写;只有 /正则/标志 形式才当正则。
// 解析和编译都在插件内完成,不依赖酒馆的 regexFromString / 正则扩展是否启用;
// 与酒馆的区别:不带斜杠的行不按正则解释(兼容老配置),无效正则退化为普通文本而不是静默跳过。
function compileGenerateBlacklistEntry(entry) {
    const cached = blacklistEntryCache.get(entry);
    if (cached) return cached;
    const compiled = { source: entry, literal: entry.toLowerCase(), regex: null };
    const match = entry.match(BLACKLIST_REGEX_LINE_PATTERN);
    if (match) {
        try {
            compiled.regex = new RegExp(match[1], match[2].toLowerCase());
        } catch (error) {
            if (!warnedBlacklistRegex.has(entry)) {
                warnedBlacklistRegex.add(entry);
                console.warn(`${LOG_PREFIX} [黑名单重试] 正则表达式无效，已按普通文本匹配：${entry}`, error);
            }
        }
    }
    if (blacklistEntryCache.size >= BLACKLIST_ENTRY_CACHE_LIMIT) {
        blacklistEntryCache.delete(blacklistEntryCache.keys().next().value);
    }
    blacklistEntryCache.set(entry, compiled);
    return compiled;
}

function findGenerateBlacklistMatch(text, entries) {
    const haystack = String(text || '');
    const normalized = haystack.toLowerCase();
    for (const entry of entries) {
        const compiled = compileGenerateBlacklistEntry(entry);
        if (compiled.regex) {
            // g/y 会推进 lastIndex,每次匹配前重置,保证同一规则反复检测结果一致。
            compiled.regex.lastIndex = 0;
            if (compiled.regex.test(haystack)) return compiled.source;
        } else if (normalized.includes(compiled.literal)) {
            return compiled.source;
        }
    }
    return '';
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
        const isAutomaticRegenerate = type === 'regenerate' && options?.automatic_trigger === true;
        if (run && state.launching === run && isAutomaticRegenerate) {
            state.launching = null;
            return;
        }
        // 停止打断了我们刚发起的 regenerate 时,酒馆可能仍会把这一代跑完;
        // 留着它的次数,等 AFTER_COMMANDS 复用而不是从零开始。
        if (!run && isAutomaticRegenerate && state.stoppedLaunch) {
            return;
        }
        clearStoppedLaunch(state);
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
    if (event_types.GENERATION_STOPPED) {
        eventSource.on(event_types.GENERATION_STOPPED, () => {
            const run = state.run;
            // 停止落在我们发起的 regenerate 启动窗口里:保留共享次数,防止酒馆把
            // 这一代继续跑完后 AFTER_COMMANDS 重建 run 并把次数清零。
            if (run && state.launching === run) {
                state.stoppedLaunch = run;
                state.stoppedLaunchDeadline = Date.now() + STOPPED_LAUNCH_TTL_MS;
            }
            cancelGenerateBlacklistRetry(run);
        });
    }
    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            clearStoppedLaunch(state);
            cancelGenerateBlacklistRetry(state.run);
        });
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
        clearStoppedLaunch(state);
        cancelGenerateBlacklistRetry(state.run);
        return;
    }
    const context = getContext();
    const entries = parseGenerateBlacklist(settings.generateBlacklistRetryText);
    const normalizedType = String(type || 'normal');
    if (!entries.length || !SUPPORTED_TYPES.has(normalizedType) || context.groupId
        || context.characterId === undefined || !context.chatId || options?.quietToLoud) {
        clearStoppedLaunch(state);
        cancelGenerateBlacklistRetry(state.run);
        return;
    }
    if (context.powerUserSettings?.auto_swipe) {
        clearStoppedLaunch(state);
        cancelGenerateBlacklistRetry(state.run);
        globalThis.toastr?.warning('酒馆原生自动切换回复已开启，黑名单重试本轮暂停。', BLACKLIST_RETRY_TOAST_TITLE);
        return;
    }
    // STARTED 之后、AFTER_COMMANDS 之前被停止时,酒馆可能已经重建 controller 把这一代
    // 继续跑;这种被吞掉的停止不应重新武装重试链。
    if (isCurrentGenerationStopped()) {
        clearStoppedLaunch(state);
        cancelGenerateBlacklistRetry(state.run);
        console.debug(`${LOG_PREFIX} [黑名单重试] 启动窗口内已停止,本轮不再重新武装`);
        return;
    }

    const run = state.run || takeStoppedLaunch(state, context) || {
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
    if (!isGenerateBlacklistRunCurrent(run, context) || isCurrentGenerationStopped()
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
            globalThis.toastr?.warning('等待酒馆收尾超时，已停止黑名单重试，当前回复已保留。', BLACKLIST_RETRY_TOAST_TITLE);
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
        globalThis.toastr?.warning(`总重试次数已达 ${run.maxRetries} 次，已停止重试并保留最后回复。`, BLACKLIST_RETRY_TOAST_TITLE);
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
            BLACKLIST_RETRY_TOAST_TITLE,
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
