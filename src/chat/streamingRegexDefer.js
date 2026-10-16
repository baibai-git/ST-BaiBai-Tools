// 流式生成时跳过美化正则:流式期间每个 tick 都会把正在生成的整条消息重新跑一遍显示正则。
//
// 状态栏/前端美化面板这类正则的替换内容里带 ``` 代码块,一条十几 KB 的回复套上几个面板
// 就能膨胀到几百 KB,排在后面的正则(比如预设里的思维链标签处理)每个 tick 都要在膨胀后的
// 字符串上重跑一遍,回复越长越卡。
//
// 柏宝库在 engine.js 的 getRegexedString 里补了一个桥接(见柏宝库
// src/regex-bridge-installer.js):每条正则执行前先问 beforeScript,返回字符串就把它当作这条
// 正则的结果。这里只在「正在流式生成的那条消息的显示渲染」里跳过替换内容带 ``` 的正则,
// 直接显示原始生成内容;提示词、存档文本和其它楼层一律照常。
//
// 正常结束和用户停止时,酒馆会先置 isFinished 再做最终渲染,那次渲染不会跳过;
// 只有出错中断(onErrorStreaming 置 isStopped)时酒馆不做最终渲染,这里补渲一次。
import { chat, event_types, eventSource, streamingProcessor, updateMessageBlock } from '@sillytavern/script';
import { getRegexedString, regex_placement } from '@sillytavern/scripts/extensions/regex/engine';
import { STREAMING_REGEX_DEFER_BRIDGE_KEY, STREAMING_REGEX_DEFER_REPLACE_MARKER, STREAMING_REGEX_DEFER_STATE_KEY } from './constants.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';

function getStreamingRegexDeferState() {
    return extensionState[STREAMING_REGEX_DEFER_STATE_KEY] ??= {
        installed: false,
        pending: null,
    };
}

// 开关在 beforeScript 里实时读取,这里只负责装一次桥接和监听。
function applyStreamingRegexDefer() {
    installStreamingRegexDeferBridge();

    const state = getStreamingRegexDeferState();
    if (state.installed || typeof eventSource?.makeFirst !== 'function') {
        return;
    }

    state.installed = true;

    // 抢在其它监听器(酒馆助手重建 iframe、生成结束定位等)之前补渲,让它们拿到完整渲染后的楼层。
    for (const event of [event_types.GENERATION_ENDED, event_types.CHARACTER_MESSAGE_RENDERED]) {
        if (event) {
            eventSource.makeFirst(event, flushStreamingRegexDeferredRender);
        }
    }

    if (event_types.CHAT_CHANGED) {
        eventSource.on(event_types.CHAT_CHANGED, () => {
            state.pending = null;
        });
    }
}

function installStreamingRegexDeferBridge() {
    const existing = globalThis[STREAMING_REGEX_DEFER_BRIDGE_KEY];
    const bridge = existing && typeof existing === 'object' ? existing : {};

    bridge.installed = true;
    bridge.version = 1;
    bridge.beforeScript = beforeStreamingRegexScript;
    globalThis[STREAMING_REGEX_DEFER_BRIDGE_KEY] = bridge;
}

// 返回 text 表示跳过这条正则,返回 undefined 照常执行。提示词构建和整页渲染也会走到这里,
// 便宜的判断放前面。
function beforeStreamingRegexScript(script, text, context) {
    if (settings.streamingRegexDeferEnabled === false
        || context?.isMarkdown !== true
        || context.depth !== 0
        || context.placement !== regex_placement.AI_OUTPUT
        || script?.disabled
        || typeof script?.replaceString !== 'string'
        || !script.replaceString.includes(STREAMING_REGEX_DEFER_REPLACE_MARKER)) {
        return undefined;
    }

    const processor = streamingProcessor;
    if (!processor || processor.isFinished || processor.isStopped || !(processor.messageId >= 0)) {
        return undefined;
    }

    const message = chat[processor.messageId];
    if (!message || context.characterOverride !== message.name) {
        return undefined;
    }

    const state = getStreamingRegexDeferState();
    if (state.pending?.processor !== processor) {
        state.pending = { processor, messageId: processor.messageId, message };
    }

    return text;
}

function flushStreamingRegexDeferredRender() {
    const state = getStreamingRegexDeferState();
    const pending = state.pending;
    if (!pending) {
        return;
    }

    const { processor, messageId, message } = pending;
    if (!processor.isStopped) {
        // 还在生成就继续等;已经 isFinished 的那次最终渲染不会跳过,不用补。
        if (processor.isFinished) {
            state.pending = null;
        }
        return;
    }

    state.pending = null;
    if (chat[messageId] !== message) {
        return;
    }

    try {
        updateMessageBlock(messageId, message);
    } catch (error) {
        console.debug(`${LOG_PREFIX} streaming regex deferred render failed`, error);
    }
}

// 桥接是柏宝库直接写进 engine.js 的,看当前页面加载的 getRegexedString 源码就知道是否生效
// (没装/没更新柏宝库,或者更新后还没重启酒馆、刷新页面,都会是 false)。
function isStreamingRegexDeferSupported() {
    try {
        return Function.prototype.toString.call(getRegexedString).includes(STREAMING_REGEX_DEFER_BRIDGE_KEY);
    } catch {
        return false;
    }
}

export {
    applyStreamingRegexDefer,
    isStreamingRegexDeferSupported,
};
