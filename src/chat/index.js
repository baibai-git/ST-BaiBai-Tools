// 聊天优化功能的公共出口(由原 chatOptimizations.js 拆分而来)
export { applyFastChatListScrollOptimization, observeChatManagementPopupCleanup, patchFastChatBackupsFetch, patchFastChatSearchFetch } from './chatList.js';
export { applyMessageCompletionScrollToMiddle } from './completionScroll.js';
export { applyMessageCompletionSound } from './completionSound.js';
export { applyChatDeleteEditFlowOptimization, isChatDeleteEditFlowSupported, isWelcomeRecentChatDirectOpenCompatibilityMode } from './deleteEditFlow.js';
export { applyMessageEditBottomActions } from './editBottomActions.js';
export { applyLongChatDomRenderOptimization } from './longChatRender.js';
export { applyMobileAutoKeyboardSuppression, applyMobileMessageEditScrollGuard } from './mobileKeyboard.js';
export { applyChatOptimizationCompatibilityIndicators, applyReduceLoadedFloors, bindChatOptimizationSettings } from './settingsBind.js';
export { configureChatOptimizations } from './state.js';
export { applyStreamingRegexDefer } from './streamingRegexDefer.js';
export { applyMessageTripleClickEdit } from './tripleClickEdit.js';
export { calculateVisibleMessageTextStats, getLongChatDomRenderSnapshot } from './util.js';
export { applyWelcomeRecentChatDirectOpenOptimization } from './welcomeRecent.js';
