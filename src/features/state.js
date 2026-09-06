import { saveSettingsDebounced } from '@sillytavern/script';
import { extension_settings } from '@sillytavern/scripts/extensions';
import { EXTENSION_KEY, SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY, SETTINGS_KEY } from './constants.js';
const MODULE_NAME = getModuleName();
const EXTENSION_ID = getExtensionId();
const defaultSettings = {
    updatePromptOnAvailableEnabled: true,
    resizeGuardEnabled: true,
    descriptionCodeMirrorEditorEnabled: false,
    customCssInputOptimizationEnabled: true,
    customCssShadowPropertyEnabled: true,
    worldInfoDrawerOptimizationEnabled: true,
    worldInfoPageOptimizationEnabled: true,
    worldInfoListOptimizationEnabled: true,
    worldInfoSearchReplaceEnabled: true,
    characterSearchInputOptimizationEnabled: true,
    baibaokuSettingsAccelerationEnabled: true,
    baibaokuLazyThemeLoadingEnabled: true,
    fastCharacterListEnabled: true,
    recentChatListAccelerationEnabled: true,
    progressiveChatLoadingEnabled: false,
    saveGenerateEnabled: true,
    tokenizerBulkCountEnabled: true,
    chatKeyboardScanReductionEnabled: true,
    extensionManifestBundleEnabled: true,
    presetAutoBackupEnabled: true,
    presetBackupAutoCleanupEnabled: true,
    presetBackupKeepCount: 200,
    characterListAvatarLazyLoadEnabled: true,
    fastChatListEnabled: true,
    welcomeRecentChatDirectOpenEnabled: true,
    saveRequestGzipEnabled: true,
    translateMessageUpdatedOptimizationEnabled: true,
    longChatDomRenderOptimizationEnabled: true,
    reduceLoadedFloorsEnabled: true,
    messageCompletionScrollToMiddleEnabled: true,
    chatListScrollOptimizationEnabled: true,
    chatListAutoClearEnabled: true,
    chatLossMitigationEnabled: true,
    mobileAutoKeyboardSuppressionEnabled: true,
    mobileMessageEditScrollGuardEnabled: true,
    presetScrollOptimizationEnabled: true,
    presetDragOptimizationEnabled: true,
    presetVueDragLocked: false,
    presetMobileWholeRowDragEnabled: true,
    presetSwitchOptimizationEnabled: true,
    presetToggleOptimizationEnabled: true,
    presetGroupingEnabled: true,
    presetGroupingEditButtonInMenuEnabled: false,
    presetInterfaceCollapseEnabled: true,
    presetPromptCodeMirrorEditorEnabled: false,
    presetAutoSaveAfterPromptEditEnabled: false,
    regexQuickOperationOptimizationEnabled: true,
    regexListGroups: {},
    chatDeleteEditFlowOptimizationEnabled: true,
    messageEditBottomActionsEnabled: true,
    messageDoubleClickEditEnabled: false,
    messageTripleClickEditEnabled: true,
    messageCompletionSoundEnabled: false,
    messageCompletionSoundSource: 'builtin',
    messageCompletionSoundBuiltinId: 'guoke-bell',
    messageCompletionSoundUrl: '',
    messageCompletionSoundVolume: 0.8,
    messageCompletionSoundLocalFileName: '',
    messageCompletionSoundKeepAliveEnabled: true,
    generateRetryEnabled: false,
    generateRetryMaxRetries: 3,
    generateBlacklistRetryEnabled: false,
    generateBlacklistRetryText: '',
};
const linkedPresetOptimizationSettingKeys = [
    'presetScrollOptimizationEnabled',
    'presetDragOptimizationEnabled',
    'presetMobileWholeRowDragEnabled',
    'presetToggleOptimizationEnabled',
];
const legacySettingsKeys = [
    'generateBlacklistRetryMaxRetries',
    'textareaScrollOptimizationEnabled',
    'descriptionShadowEditorEnabled',
    'descriptionInputBubbleOptimizationEnabled',
    'descriptionInputIdleSaveEnabled',
    'imeCommitOptimizationEnabled',
    'mobileChatEntryKeyboardSuppressionEnabled',
    'fastSettingsBootstrapEnabled',
    'fastCharacterListEnabled',
];
const settings = { ...defaultSettings };
const extensionState = getExtensionState();

function getExtensionState() {
    if (!globalThis[EXTENSION_KEY] || typeof globalThis[EXTENSION_KEY] !== 'object') {
        globalThis[EXTENSION_KEY] = {};
    }

    return globalThis[EXTENSION_KEY];
}

function getModuleName() {
    const extensionPathMarker = '/scripts/extensions/';
    const currentUrl = new URL(import.meta.url);
    const currentPath = decodeURIComponent(currentUrl.pathname.replace(/\\/g, '/'));
    const markerIndex = currentPath.indexOf(extensionPathMarker);

    if (markerIndex === -1) {
        return 'third-party/SillyTavern-Mobile-Resize-Guard';
    }

    return currentPath
        .slice(markerIndex + extensionPathMarker.length)
        .replace(/\/(?:dist\/)?index\.js$/i, '');
}

function getExtensionId() {
    return MODULE_NAME.split('/').pop() || MODULE_NAME;
}

function initializeSettings() {
    if (!extension_settings[SETTINGS_KEY] || typeof extension_settings[SETTINGS_KEY] !== 'object') {
        extension_settings[SETTINGS_KEY] = {};
    }

    let removedLegacySetting = false;
    let migratedSaveGenerateDefault = false;

    if (
        typeof extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled !== 'boolean'
        && typeof extension_settings[SETTINGS_KEY].fastSettingsBootstrapEnabled === 'boolean'
    ) {
        extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled = extension_settings[SETTINGS_KEY].fastSettingsBootstrapEnabled;
    }

    if (extension_settings[SETTINGS_KEY].progressiveChatLoadingEnabled === true) {
        extension_settings[SETTINGS_KEY].progressiveChatLoadingEnabled = false;
        removedLegacySetting = true;
    }

    for (const key of legacySettingsKeys) {
        if (Object.prototype.hasOwnProperty.call(extension_settings[SETTINGS_KEY], key)) {
            delete extension_settings[SETTINGS_KEY][key];
            removedLegacySetting = true;
        }
    }

    if (extension_settings[SETTINGS_KEY][SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY] !== true) {
        if (extension_settings[SETTINGS_KEY].saveGenerateEnabled === false) {
            extension_settings[SETTINGS_KEY].saveGenerateEnabled = true;
        }
        extension_settings[SETTINGS_KEY][SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY] = true;
        migratedSaveGenerateDefault = true;
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        if (typeof extension_settings[SETTINGS_KEY][key] !== typeof value) {
            extension_settings[SETTINGS_KEY][key] = value;
        }
    }

    Object.assign(settings, defaultSettings, extension_settings[SETTINGS_KEY]);
    delete settings[SAVE_GENERATE_DEFAULT_ENABLED_MIGRATION_KEY];
    const normalizedPresetLinkedOptimizationSettings = normalizeLinkedPresetOptimizationSettings();
    const normalizedMessageEditClickSetting = normalizeMessageEditClickSettings();

    if (
        removedLegacySetting
        || migratedSaveGenerateDefault
        || normalizedPresetLinkedOptimizationSettings
        || normalizedMessageEditClickSetting
    ) {
        saveSettingsDebounced();
    }
}

function normalizeMessageEditClickSettings() {
    if (settings.messageDoubleClickEditEnabled && settings.messageTripleClickEditEnabled) {
        settings.messageDoubleClickEditEnabled = false;
        extension_settings[SETTINGS_KEY].messageDoubleClickEditEnabled = false;
        return true;
    }

    return false;
}

function normalizeLinkedPresetOptimizationSettings() {
    const enabled = linkedPresetOptimizationSettingKeys.some(key => settings[key] === true);
    let changed = false;

    for (const key of linkedPresetOptimizationSettingKeys) {
        if (settings[key] !== enabled) {
            settings[key] = enabled;
            extension_settings[SETTINGS_KEY][key] = enabled;
            changed = true;
        }
    }

    return changed;
}

function saveExtensionSettings() {
    const persistedSettings = { ...settings };
    delete persistedSettings.baibaokuSettingsAccelerationEnabled;
    delete persistedSettings.baibaokuLazyThemeLoadingEnabled;
    delete persistedSettings.fastCharacterListEnabled;
    delete persistedSettings.recentChatListAccelerationEnabled;
    delete persistedSettings.progressiveChatLoadingEnabled;
    delete persistedSettings.extensionManifestBundleEnabled;
    Object.assign(extension_settings[SETTINGS_KEY], persistedSettings);
    delete extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled;
    delete extension_settings[SETTINGS_KEY].baibaokuLazyThemeLoadingEnabled;
    delete extension_settings[SETTINGS_KEY].fastCharacterListEnabled;
    delete extension_settings[SETTINGS_KEY].recentChatListAccelerationEnabled;
    delete extension_settings[SETTINGS_KEY].progressiveChatLoadingEnabled;
    delete extension_settings[SETTINGS_KEY].extensionManifestBundleEnabled;
    saveSettingsDebounced();
}

export {
    EXTENSION_ID,
    MODULE_NAME,
    defaultSettings,
    extensionState,
    getExtensionId,
    getExtensionState,
    getModuleName,
    initializeSettings,
    legacySettingsKeys,
    linkedPresetOptimizationSettingKeys,
    normalizeLinkedPresetOptimizationSettings,
    normalizeMessageEditClickSettings,
    saveExtensionSettings,
    settings,
};
