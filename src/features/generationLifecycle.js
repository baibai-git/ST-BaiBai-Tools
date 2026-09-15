// 生成生命周期信号:给重试功能一个共享的「这一代是否已经被停止」判断。
//
// 酒馆的 Generate() 先 await unshallowCharacter 和 GENERATION_STARTED 的监听器,
// 之后才重建 abortController(见 public/script.js 的 Generate)。用户在这段窗口里
// 点停止时,GENERATION_STOPPED 已经发出、旧 controller 也被 abort,但酒馆随后会
// 拿着新 controller 把同一代继续跑下去;紧接着的 GENERATION_AFTER_COMMANDS 会
// 让重试功能以为这是一次全新的生成,于是重新武装重试窗口或重建黑名单链(次数清零)。
//
// 这里只维护一个停止序号:
//   - 每次 GENERATION_STARTED 记下当前序号,作为这一代的起点;
//   - 每次 GENERATION_STOPPED / CHAT_CHANGED 递增序号,并同步通知订阅者,
//     让正在等待的重试立刻知道这一代已经被停止。
import { event_types, eventSource } from '@sillytavern/script';
import { LOG_PREFIX } from './constants.js';
import { extensionState } from './state.js';

const GENERATION_LIFECYCLE_KEY = 'generationLifecycle';

function getGenerationLifecycleState() {
    return extensionState[GENERATION_LIFECYCLE_KEY] ??= {
        installed: false,
        stopEpoch: 0,
        stopEpochAtStart: 0,
        stopListeners: new Set(),
    };
}

function markGenerationStopped() {
    const state = getGenerationLifecycleState();
    state.stopEpoch += 1;
    for (const listener of [...state.stopListeners]) {
        try {
            listener();
        } catch (error) {
            console.debug(`${LOG_PREFIX} generation stop listener failed`, error);
        }
    }
}

function installGenerationLifecycle() {
    const state = getGenerationLifecycleState();
    if (state.installed || typeof eventSource?.on !== 'function') {
        return state;
    }

    state.installed = true;

    if (event_types.GENERATION_STARTED) {
        eventSource.on(event_types.GENERATION_STARTED, (type, options, dryRun) => {
            // dryRun 是酒馆的 token 计数,不该影响真实生成的生命周期。
            if (dryRun) return;
            state.stopEpochAtStart = state.stopEpoch;
        });
    }

    for (const event of [event_types.GENERATION_STOPPED, event_types.CHAT_CHANGED]) {
        if (event) {
            eventSource.on(event, () => markGenerationStopped());
        }
    }

    return state;
}

// 最近一次 GENERATION_STARTED 之后是否收到过停止。停止发生在启动窗口(controller
// 重建之前)时,酒馆可能仍会把这一代跑完,调用方据此不要为其重新武装重试。
function isCurrentGenerationStopped() {
    const state = getGenerationLifecycleState();
    return state.stopEpoch !== state.stopEpochAtStart;
}

function getGenerationStopEpoch() {
    return getGenerationLifecycleState().stopEpoch;
}

// 等待重试期间被停止时同步回调;返回取消订阅函数。
function subscribeGenerationStop(listener) {
    const state = getGenerationLifecycleState();
    state.stopListeners.add(listener);
    return () => state.stopListeners.delete(listener);
}

export {
    getGenerationStopEpoch,
    installGenerationLifecycle,
    isCurrentGenerationStopped,
    subscribeGenerationStop,
};
