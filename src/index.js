// 柏宝箱入口:模块装配与顶层接线(由原 index.js 拆分而来,功能实现在 features/ 下)
import * as chatOptimizations from './chat/index.js';
import * as floorDirectory from './floorDirectory.js';
import * as presetOptimizations from './preset/index.js';
import * as worldInfoPageOptimization from './worldinfo/index.js';
import { DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH, LOG_PREFIX } from './features/constants.js';
import { loadDescriptionCodeMirrorModules } from './features/descEditor.js';
import { disableFastCharacterListFetchHook, disableFastSettingsBootstrapFetchHook } from './features/fastBootstrap.js';
import { installGenerateBlacklistRetry } from './features/generateBlacklistRetry.js';
import { installGenerateRetryFetchHook } from './features/generateRetry.js';
import { installPageRestoreSelectionGuard } from './features/globalGuards.js';
import { installSaveRequestGzipFetchHook } from './features/gzipHook.js';
import { installPerformanceTraceFetchHook, recordPerformanceTraceLongDomRefresh } from './features/perfTrace.js';
import { installReloadGreetingGuard } from './features/reloadGuard.js';
import { installSaveGenerateFetchHook } from './features/saveGenerate.js';
import { applyFeatureSettings, renderSettingsPanel } from './features/settingsPanel.js';
import { extensionState, initializeSettings, saveExtensionSettings, settings } from './features/state.js';
import { initializeExtensionUpdateCheck } from './features/updateCheck.js';

chatOptimizations.configureChatOptimizations({
    settings,
    extensionState,
    logPrefix: LOG_PREFIX,
    recordLongDomRefresh: recordPerformanceTraceLongDomRefresh,
});
presetOptimizations.configurePresetOptimizations({
    settings,
    extensionState,
    logPrefix: LOG_PREFIX,
    loadCodeMirrorModules: loadDescriptionCodeMirrorModules,
    codeMirrorHistoryMaxLength: DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH,
    saveSettings: saveExtensionSettings,
});
worldInfoPageOptimization.configureWorldInfoPageOptimization({
    settings,
    extensionState,
    logPrefix: LOG_PREFIX,
    saveSettings: saveExtensionSettings,
});
presetOptimizations.installOpenAITokenizerBulkBridge();
floorDirectory.configureFloorDirectory({
    settings,
    extensionState,
    logPrefix: LOG_PREFIX,
});

initializeSettings();
initializeExtensionUpdateCheck();

if (!extensionState.installed) {
    extensionState.installed = true;
    chatOptimizations.patchFastChatSearchFetch();
    chatOptimizations.patchFastChatBackupsFetch();
    console.debug(`${LOG_PREFIX} Installed`);
}

disableFastSettingsBootstrapFetchHook();
disableFastCharacterListFetchHook();
installSaveRequestGzipFetchHook();
installPerformanceTraceFetchHook();
// 必须先于 save-generate 安装:重试要包在里层,这样它看到的是 save-generate 真正发出去的
// 那一次请求(接管时是 save-generate 地址,退回时是原生地址),重发不会重跑接管判定。
installGenerateRetryFetchHook();
installSaveGenerateFetchHook();
installGenerateBlacklistRetry();
installReloadGreetingGuard();
installPageRestoreSelectionGuard();
chatOptimizations.observeChatManagementPopupCleanup();
applyFeatureSettings();
jQuery(renderSettingsPanel);
jQuery(() => floorDirectory.installFloorDirectory());
