import {
    characters,
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    reloadCurrentChat,
    saveSettings,
    saveSettingsDebounced,
    this_chid,
} from '../../../../script.js';
import * as scriptModule from '../../../../script.js';
import { AutoComplete } from '../../../autocomplete/AutoComplete.js';
import { extension_settings, extensionTypes, renderExtensionTemplateAsync, writeExtensionField } from '../../../extensions.js';
import { selected_group } from '../../../group-chats.js';
import { t } from '../../../i18n.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { isMobile, favsToHotswap } from '../../../RossAscends-mods.js';
import { getPresetManager } from '../../../preset-manager.js';
import { power_user } from '../../../power-user.js';
import { isAdmin } from '../../../user.js';
import { debounce, download, getFileText, regexFromString, resetScrollHeight, setInfoBlock, uuidv4 } from '../../../utils.js';
import { getCurrentPresetAPI as getRegexCurrentPresetAPI, getCurrentPresetName as getRegexCurrentPresetName, getScriptsByType as getRegexScriptsByType, runRegexScript, SCRIPT_TYPES as REGEX_SCRIPT_TYPES, substitute_find_regex } from '../../regex/engine.js';
import * as chatOptimizations from './chatOptimizations.js';
import * as presetOptimizations from './presetOptimizations.js';

const LOG_PREFIX = '[柏宝箱]';
const MODULE_NAME = getModuleName();
const CURRENT_VERSION = '0.24.0';
const EXTENSION_ID = getExtensionId();
const SETTINGS_KEY = 'baiBaiToolkit';
const EXTENSION_KEY = '__baiBaiToolkitExtensionInstalled';
const FAST_SETTINGS_BOOTSTRAP_FETCH_KEY = '__baiBaiToolkitFastSettingsBootstrapFetchPatched';
const FAST_CHARACTER_LIST_FETCH_KEY = '__baiBaiToolkitFastCharacterListFetchPatched';
const BAIBAOKU_EARLY_BRIDGE_KEY = '__baibaokuEarlyBridge';
const BAIBAOKU_STATUS_URL = '/api/plugins/baibaoku/v1/status';
const BAIBAOKU_FAST_CONFIG_URL = '/api/plugins/baibaoku/v1/fast-config';
const BAIBAOKU_FAST_CHAT_GET_URL = '/api/plugins/baibaoku/v1/chats/fast-get';
const BAIBAOKU_STATUS_TIMEOUT_MS = 3000;
const BAIBAOKU_PANEL_STATUS_CACHE_MS = 5 * 60_000;
const SAVE_REQUEST_GZIP_FETCH_KEY = '__baiBaiToolkitSaveRequestGzipFetchPatched';
const FAST_CHAT_GET_FETCH_KEY = '__baiBaiToolkitFastChatGetFetchPatched';
const PERFORMANCE_TRACE_FETCH_KEY = '__baiBaiToolkitPerformanceTraceFetchPatched';
const TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY = '__baiBaiToolkitTranslateMessageUpdatedOptimized';
const CUSTOM_CSS_INPUT_OPTIMIZATION_KEY = '__baiBaiToolkitCustomCssInputOptimized';
const CUSTOM_CSS_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitCustomCssCodeMirrorEditor';
const DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_description_codemirror_editor_style';
const CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_custom_css_codemirror_editor_style';
const DESCRIPTION_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitDescriptionCodeMirrorEditor';
const DESCRIPTION_CODEMIRROR_MODULES_KEY = '__baiBaiToolkitDescriptionCodeMirrorModules';
const REGEX_QUICK_OPERATION_HANDLER_KEY = '__baiBaiToolkitRegexQuickOperationHandler';
const REGEX_QUICK_OPERATION_OBSERVER_KEY = '__baiBaiToolkitRegexQuickOperationObserver';
const REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY = '__baiBaiToolkitRegexQuickOperationImportHandler';
const REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY = '__baiBaiToolkitRegexPendingChangesLifecycleHandler';
const REGEX_VUE_MANAGER_CLICK_HANDLER_KEY = '__baiBaiToolkitRegexVueManagerClickHandler';
const REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY = '__baiBaiToolkitRegexVueScopedContextHandler';
const REGEX_VUE_NATIVE_RENDER_GUARD_KEY = '__baiBaiToolkitRegexVueNativeRenderGuard';
const REGEX_VUE_MANAGER_ROOT_ID = 'bai_bai_toolkit_regex_vue_manager_root';
const REGEX_VUE_MANAGER_STYLE_ID = 'bai_bai_toolkit_regex_vue_manager_style';
const REGEX_VUE_MANAGER_MODULE_PATH = './vendor/vue.esm-browser.prod.js';
const REGEX_VUE_DRAGGABLE_MODULE_PATH = './vendor/vue-draggable-next.esm-browser.prod.js';
const CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY = '__baiBaiToolkitCharacterListAvatarLazyLoad';
const CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID = 'bai_bai_toolkit_character_list_avatar_lazy_load_style';
const REGEX_UNGROUPED_GROUP_ID = '__ungrouped';
const REGEX_PENDING_ASSIGNMENT_GROUP_ID = '__pending_assignment';
const REGEX_VUE_GROUP_BODY_TRANSITION_KEY = '__baiBaiToolkitRegexVueGroupBodyTransition';
const REGEX_VUE_DROP_TARGET_CLASS = 'bai-bai-regex-drop-target';
const REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS = 180;
const DESCRIPTION_EDITOR_SOURCE_SELECTOR = '#description_textarea';
const DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS = 'bai-bai-toolkit-description-source-hidden';
const DESCRIPTION_CODEMIRROR_EDITOR_ID = 'bai_bai_description_codemirror_editor';
const DESCRIPTION_CODEMIRROR_EDITOR_CLASS = 'bai-bai-toolkit-description-codemirror-editor';
const DESCRIPTION_CODEMIRROR_BLUR_SAVE_DELAY_MS = 250;
const DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH = 12000;
const DESCRIPTION_CODEMIRROR_LOCAL_BUNDLE_PATH = './vendor/codemirror.bundle.js';
const CUSTOM_CSS_INPUT_ID = 'customCSS';
const CUSTOM_CSS_MAXIMIZED_SOURCE_SELECTOR = 'textarea.maximized_textarea[data-for="customCSS"]';
const CUSTOM_CSS_STYLE_ID = 'custom-style';
const CUSTOM_CSS_CODEMIRROR_EDITOR_ID = 'bai_bai_custom_css_codemirror_editor';
const CUSTOM_CSS_CODEMIRROR_EDITOR_CLASS = 'bai-bai-toolkit-custom-css-codemirror-editor';
const CUSTOM_CSS_SOURCE_HIDDEN_CLASS = 'bai-bai-toolkit-custom-css-source-hidden';
const CUSTOM_CSS_HOST_CLASS = 'bai-bai-toolkit-custom-css-host';
const CUSTOM_CSS_LAYOUT_CLASS = 'bai-bai-toolkit-custom-css-layout';
const CUSTOM_CSS_LIGHT_THEME_CLASS = 'bai-bai-toolkit-custom-css-theme-light';
const CUSTOM_CSS_DARK_THEME_CLASS = 'bai-bai-toolkit-custom-css-theme-dark';
const CUSTOM_CSS_MAXIMIZED_CLASS = 'bai-bai-toolkit-custom-css-maximized';
const CUSTOM_CSS_CODEMIRROR_EXTERNAL_READ_SELECTOR = [
    '#vce-btn-refresh-new',
    '#vce-btn-save-new',
    '#native-btn-save-new',
    '#native-btn-scroll-new',
    '#native-css-search-new',
    '#native-search-dropdown-new .vce-search-item-new',
].join(', ');
const CUSTOM_CSS_DARK_BACKGROUND_LUMINANCE_THRESHOLD = 0.45;
const DESCRIPTION_CODEMIRROR_CDN_MODULES = {
    state: 'https://esm.sh/@codemirror/state@6?bundle',
    view: 'https://esm.sh/@codemirror/view@6?bundle',
    commands: 'https://esm.sh/@codemirror/commands@6?bundle',
    css: 'https://esm.sh/@codemirror/lang-css@6?bundle',
    language: 'https://esm.sh/@codemirror/language@6?bundle',
    highlight: 'https://esm.sh/@lezer/highlight@1?bundle',
    oneDark: 'https://esm.sh/@codemirror/theme-one-dark@6?bundle',
};

const WORLD_INFO_DRAWER_HANDLER_KEY = '__baiBaiToolkitWorldInfoDrawerHandler';
const WORLD_INFO_LAZY_SELECT2_PATCH_KEY = '__baiBaiToolkitWorldInfoLazySelect2Patched';
const WORLD_INFO_CHARACTER_FILTER_APPEND_PATCH_KEY = '__baiBaiToolkitWorldInfoCharacterFilterAppendPatched';
const CHARACTER_SEARCH_OPTIMIZATION_KEY = 'baiBaiToolkitCharacterSearchOptimization';
const REGEX_CONTAINER_SELECTOR = '#regex_container';
const REGEX_EXTENSIONS_PANEL_SELECTOR = '#rm_extensions_block';
const REGEX_SCRIPT_ROW_SELECTOR = '.regex-script-label';
const REGEX_SCRIPT_LIST_SELECTOR = '#saved_regex_scripts, #saved_scoped_scripts, #saved_preset_scripts';
const REGEX_CHAT_RELOAD_VISIBILITY_CHECK_DELAY_MS = 120;
const REGEX_CHAT_RELOAD_VISIBILITY_FALLBACK_DELAY_MS = 1000;
const WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-header .inline-drawer-toggle';
const WORLD_INFO_ENTRY_DRAWER_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer';
const WORLD_INFO_LAZY_SELECT2_SELECTOR = '#world_popup_entries_list .world_entry_edit select[name="characterFilter"], #world_popup_entries_list .world_entry_edit select[name="triggers"]';
const WORLD_INFO_LAZY_SELECT2_DATASET_KEY = 'baiBaiToolkitLazySelect2';
const WORLD_INFO_DEFERRED_OPTIONS_DATASET_KEY = 'baiBaiToolkitDeferredOptions';
const CHARACTER_LIST_SELECTOR = '#rm_print_characters_block';
const CHARACTER_LIST_AVATAR_SELECTOR = `${CHARACTER_LIST_SELECTOR} .character_select .avatar img`;
const PERSONA_LIST_SELECTOR = '#user_avatar_block';
const PERSONA_LIST_AVATAR_SELECTOR = `${PERSONA_LIST_SELECTOR} .avatar-container .avatar img`;
const WELCOME_RECENT_CHAT_SELECTOR = '.welcomePanel .recentChat';
const WELCOME_RECENT_CHAT_AVATAR_SELECTOR = `${WELCOME_RECENT_CHAT_SELECTOR} .avatar img`;
const AVATAR_LAZY_LOAD_APPEND_TARGET_SELECTOR = `${CHARACTER_LIST_SELECTOR}, ${PERSONA_LIST_SELECTOR}`;
const AVATAR_LAZY_LOAD_NATIVE_APPEND_TARGET_SELECTOR = '#chat';
const AVATAR_LAZY_LOAD_SELECTOR = [
    CHARACTER_LIST_AVATAR_SELECTOR,
    PERSONA_LIST_AVATAR_SELECTOR,
    WELCOME_RECENT_CHAT_AVATAR_SELECTOR,
].join(', ');
const AVATAR_LAZY_LOAD_RELATIVE_SELECTOR = [
    '.character_select .avatar img',
    '.avatar-container .avatar img',
    `${WELCOME_RECENT_CHAT_SELECTOR} .avatar img`,
].join(', ');
const CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY = 'baiBaiToolkitLazyAvatarSrc';
const CHARACTER_LIST_LAZY_AVATAR_PLACEHOLDER_SRC = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
const CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS = 'bai-bai-toolkit-lazy-avatar-pending';
const CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS = 'bai-bai-toolkit-lazy-avatar-loaded';
const CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS = 'bai-bai-toolkit-lazy-avatar-shell';
const CHARACTER_LIST_LAZY_AVATAR_ROOT_MARGIN = '800px 0px 1200px 0px';
const SILENT_UPDATE_STORAGE_KEY = 'bai_bai_toolkit_silent_update';
const SILENT_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const SAVE_REQUEST_GZIP_PATHS = new Set([
    '/api/chats/save',
    '/api/chats/group/save',
]);
const FAST_CHAT_GET_PATHS = new Set([
    '/api/chats/get',
    '/api/chats/group/get',
]);
const FAST_CHAT_GET_SAVE_PATHS = new Set([
    '/api/chats/save',
    '/api/chats/group/save',
]);
const FAST_CHAT_GET_DEFAULT_THRESHOLD_BYTES = 2 * 1024 * 1024;
const FAST_CHAT_GET_DEFAULT_INITIAL_MESSAGES = 5;
const FAST_CHAT_GET_ACTION_SELECTOR = [
    '#send_but',
    '#option_regenerate',
    '#option_continue',
    '#option_impersonate',
    '#mes_continue',
    '#mes_impersonate',
    '#chat .mes_edit',
    '#chat .mes_edit_done',
    '#chat .mes_delete',
    '#chat .del_mes',
    '#chat .swipe_left',
    '#chat .swipe_right',
    '#show_more_messages',
].join(', ');
const FAST_SETTINGS_BOOTSTRAP_CACHE_MS = 15_000;
const PERFORMANCE_TRACE_FETCH_PATHS = new Set([
    '/api/chats/get',
    '/api/chats/group/get',
    '/api/chats/save',
    '/api/chats/group/save',
    '/api/chats/search',
    '/api/characters/chats',
]);
const PERFORMANCE_TRACE_MAX_LINES = 2000;
const PERFORMANCE_TRACE_MAX_LINE_LENGTH = 700;
const PERFORMANCE_TRACE_SLOW_MS = 16;
const PERFORMANCE_TRACE_LISTENER_LOG_MS = 8;
const PERFORMANCE_TRACE_DEDUPE_MS = 250;
const PERFORMANCE_TRACE_EVENTS = new Set([
    event_types.CHAT_LOADED,
    event_types.CHAT_CHANGED,
    event_types.MORE_MESSAGES_LOADED,
    event_types.MESSAGE_SENT,
    event_types.USER_MESSAGE_RENDERED,
    event_types.MESSAGE_RECEIVED,
    event_types.CHARACTER_MESSAGE_RENDERED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_UPDATED,
    event_types.MESSAGE_DELETED,
    event_types.MESSAGE_SWIPED,
    event_types.MESSAGE_SWIPE_DELETED,
    event_types.MESSAGE_FILE_EMBEDDED,
    event_types.MESSAGE_REASONING_EDITED,
    event_types.MESSAGE_REASONING_DELETED,
    event_types.GENERATION_STARTED,
    event_types.GENERATION_AFTER_COMMANDS,
    event_types.GENERATE_BEFORE_COMBINE_PROMPTS,
    event_types.GENERATE_AFTER_COMBINE_PROMPTS,
    event_types.GENERATE_AFTER_DATA,
    event_types.CHAT_COMPLETION_PROMPT_READY,
    event_types.GENERATION_STOPPED,
    event_types.GENERATION_ENDED,
    event_types.IMPERSONATE_READY,
].filter(Boolean));
const PERFORMANCE_TRACE_INTERACTION_SELECTOR = [
    '#send_but',
    '#option_regenerate',
    '#option_continue',
    '#option_impersonate',
    '#mes_continue',
    '#mes_impersonate',
    '#chat .mes_edit',
    '#chat .mes_edit_done',
    '#chat .mes_edit_cancel',
    '#chat .swipe_left',
    '#chat .swipe_right',
    '#chat .mes_translate',
    '#show_more_messages',
].join(', ');
const defaultSettings = {
    updatePromptOnAvailableEnabled: true,
    resizeGuardEnabled: true,
    descriptionCodeMirrorEditorEnabled: true,
    customCssInputOptimizationEnabled: true,
    customCssShadowPropertyEnabled: true,
    worldInfoDrawerOptimizationEnabled: true,
    characterSearchInputOptimizationEnabled: true,
    baibaokuSettingsAccelerationEnabled: true,
    fastCharacterListEnabled: true,
    recentChatListAccelerationEnabled: true,
    progressiveChatLoadingEnabled: true,
    tokenizerBulkCountEnabled: true,
    characterListAvatarLazyLoadEnabled: true,
    fastChatListEnabled: true,
    welcomeRecentChatDirectOpenEnabled: true,
    saveRequestGzipEnabled: true,
    translateMessageUpdatedOptimizationEnabled: true,
    longChatDomRenderOptimizationEnabled: true,
    chatListScrollOptimizationEnabled: true,
    chatListAutoClearEnabled: true,
    mobileAutoKeyboardSuppressionEnabled: true,
    mobileMessageEditScrollGuardEnabled: true,
    presetScrollOptimizationEnabled: true,
    presetDragOptimizationEnabled: true,
    presetMobileWholeRowDragEnabled: false,
    presetSwitchOptimizationEnabled: true,
    presetToggleOptimizationEnabled: true,
    presetPromptCodeMirrorEditorEnabled: true,
    presetAutoSaveAfterPromptEditEnabled: false,
    regexQuickOperationOptimizationEnabled: true,
    regexListGroups: {},
    chatDeleteEditFlowOptimizationEnabled: true,
    messageDoubleClickEditEnabled: false,
    messageTripleClickEditEnabled: true,
    messageCompletionSoundEnabled: false,
    messageCompletionSoundSource: 'builtin',
    messageCompletionSoundBuiltinId: 'guoke-bell',
    messageCompletionSoundUrl: '',
    messageCompletionSoundVolume: 0.8,
    messageCompletionSoundLocalFileName: '',
};
const legacySettingsKeys = [
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
});

initializeSettings();
initializeExtensionUpdateCheck();

if (!extensionState.installed) {
    extensionState.installed = true;
    chatOptimizations.patchFastChatSearchFetch();
    console.debug(`${LOG_PREFIX} Installed`);
}

disableFastSettingsBootstrapFetchHook();
disableFastCharacterListFetchHook();
installSaveRequestGzipFetchHook();
installPerformanceTraceFetchHook();
chatOptimizations.observeChatManagementPopupCleanup();
applyFeatureSettings();
jQuery(renderSettingsPanel);

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
        .replace(/\/index\.js$/i, '');
}

function getExtensionId() {
    return MODULE_NAME.split('/').pop() || MODULE_NAME;
}

function initializeSettings() {
    if (!extension_settings[SETTINGS_KEY] || typeof extension_settings[SETTINGS_KEY] !== 'object') {
        extension_settings[SETTINGS_KEY] = {};
    }

    let removedLegacySetting = false;

    if (
        typeof extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled !== 'boolean'
        && typeof extension_settings[SETTINGS_KEY].fastSettingsBootstrapEnabled === 'boolean'
    ) {
        extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled = extension_settings[SETTINGS_KEY].fastSettingsBootstrapEnabled;
    }

    for (const key of legacySettingsKeys) {
        if (Object.prototype.hasOwnProperty.call(extension_settings[SETTINGS_KEY], key)) {
            delete extension_settings[SETTINGS_KEY][key];
            removedLegacySetting = true;
        }
    }

    for (const [key, value] of Object.entries(defaultSettings)) {
        if (typeof extension_settings[SETTINGS_KEY][key] !== typeof value) {
            extension_settings[SETTINGS_KEY][key] = value;
        }
    }

    Object.assign(settings, defaultSettings, extension_settings[SETTINGS_KEY]);
    const normalizedMessageEditClickSetting = normalizeMessageEditClickSettings();

    if (removedLegacySetting || normalizedMessageEditClickSetting) {
        saveSettingsDebounced();
    }
}

function getBaibaokuEarlyBridge() {
    const bridge = globalThis[BAIBAOKU_EARLY_BRIDGE_KEY];
    return bridge && typeof bridge === 'object' ? bridge : null;
}

async function setBaibaokuSettingsAccelerationEnabled(enabled) {
    const next = Boolean(enabled);
    const previous = settings.baibaokuSettingsAccelerationEnabled !== false;
    settings.baibaokuSettingsAccelerationEnabled = next;

    const bridge = getBaibaokuEarlyBridge();
    if (typeof bridge?.setSettingsAccelerationEnabled === 'function') {
        bridge.setSettingsAccelerationEnabled(next);
    } else if (bridge) {
        bridge.settingsAccelerationEnabled = next;
    }

    try {
        const saved = await saveBaibaokuFastConfig({ settingsAccelerationEnabled: next });
        const savedEnabled = saved.settingsAccelerationEnabled !== false;
        settings.baibaokuSettingsAccelerationEnabled = savedEnabled;
        if (typeof bridge?.setSettingsAccelerationEnabled === 'function') {
            bridge.setSettingsAccelerationEnabled(savedEnabled);
        } else if (bridge) {
            bridge.settingsAccelerationEnabled = savedEnabled;
        }
        return saved;
    } catch (error) {
        settings.baibaokuSettingsAccelerationEnabled = previous;
        if (typeof bridge?.setSettingsAccelerationEnabled === 'function') {
            bridge.setSettingsAccelerationEnabled(previous);
        } else if (bridge) {
            bridge.settingsAccelerationEnabled = previous;
        }
        throw error;
    }
}

async function setBaibaokuCharacterListAccelerationEnabled(enabled) {
    const next = Boolean(enabled);
    const previous = settings.fastCharacterListEnabled !== false;
    settings.fastCharacterListEnabled = next;

    const bridge = getBaibaokuEarlyBridge();
    if (typeof bridge?.setCharacterListAccelerationEnabled === 'function') {
        bridge.setCharacterListAccelerationEnabled(next);
    } else if (bridge) {
        bridge.characterListAccelerationEnabled = next;
    }

    try {
        const saved = await saveBaibaokuFastConfig({ characterListAccelerationEnabled: next });
        const savedEnabled = saved.characterListAccelerationEnabled !== false;
        settings.fastCharacterListEnabled = savedEnabled;
        if (typeof bridge?.setCharacterListAccelerationEnabled === 'function') {
            bridge.setCharacterListAccelerationEnabled(savedEnabled);
        } else if (bridge) {
            bridge.characterListAccelerationEnabled = savedEnabled;
        }
        return saved;
    } catch (error) {
        settings.fastCharacterListEnabled = previous;
        if (typeof bridge?.setCharacterListAccelerationEnabled === 'function') {
            bridge.setCharacterListAccelerationEnabled(previous);
        } else if (bridge) {
            bridge.characterListAccelerationEnabled = previous;
        }
        throw error;
    }
}

async function setBaibaokuRecentChatListAccelerationEnabled(enabled) {
    const next = Boolean(enabled);
    const previous = settings.recentChatListAccelerationEnabled !== false;
    settings.recentChatListAccelerationEnabled = next;

    const bridge = getBaibaokuEarlyBridge();
    if (typeof bridge?.setRecentChatListAccelerationEnabled === 'function') {
        bridge.setRecentChatListAccelerationEnabled(next);
    } else if (bridge) {
        bridge.recentChatListAccelerationEnabled = next;
    }

    try {
        const saved = await saveBaibaokuFastConfig({ recentChatListAccelerationEnabled: next });
        const savedEnabled = saved.recentChatListAccelerationEnabled !== false;
        settings.recentChatListAccelerationEnabled = savedEnabled;
        if (typeof bridge?.setRecentChatListAccelerationEnabled === 'function') {
            bridge.setRecentChatListAccelerationEnabled(savedEnabled);
        } else if (bridge) {
            bridge.recentChatListAccelerationEnabled = savedEnabled;
        }
        return saved;
    } catch (error) {
        settings.recentChatListAccelerationEnabled = previous;
        if (typeof bridge?.setRecentChatListAccelerationEnabled === 'function') {
            bridge.setRecentChatListAccelerationEnabled(previous);
        } else if (bridge) {
            bridge.recentChatListAccelerationEnabled = previous;
        }
        throw error;
    }
}

async function setBaibaokuProgressiveChatLoadingEnabled(enabled) {
    const next = Boolean(enabled);
    const previous = settings.progressiveChatLoadingEnabled === true;
    settings.progressiveChatLoadingEnabled = next;
    applyFastChatGetOptimization();

    try {
        const saved = await saveBaibaokuFastConfig({ progressiveChatLoadingEnabled: next });
        const savedEnabled = saved.progressiveChatLoadingEnabled !== false;
        settings.progressiveChatLoadingEnabled = savedEnabled;
        applyFastChatGetOptimization();
        return saved;
    } catch (error) {
        settings.progressiveChatLoadingEnabled = previous;
        applyFastChatGetOptimization();
        throw error;
    }
}

async function setBaibaokuTokenizerBulkCountEnabled(enabled) {
    const next = Boolean(enabled);
    const previous = settings.tokenizerBulkCountEnabled !== false;
    settings.tokenizerBulkCountEnabled = next;

    const bridge = getBaibaokuEarlyBridge();
    if (typeof bridge?.setTokenizerBulkCountEnabled === 'function') {
        bridge.setTokenizerBulkCountEnabled(next);
    } else if (bridge) {
        bridge.tokenizerBulkCountEnabled = next;
    }

    try {
        const saved = await saveBaibaokuFastConfig({ tokenizerBulkCountEnabled: next });
        const savedEnabled = saved.tokenizerBulkCountEnabled !== false;
        settings.tokenizerBulkCountEnabled = savedEnabled;
        if (typeof bridge?.setTokenizerBulkCountEnabled === 'function') {
            bridge.setTokenizerBulkCountEnabled(savedEnabled);
        } else if (bridge) {
            bridge.tokenizerBulkCountEnabled = savedEnabled;
        }
        return saved;
    } catch (error) {
        settings.tokenizerBulkCountEnabled = previous;
        if (typeof bridge?.setTokenizerBulkCountEnabled === 'function') {
            bridge.setTokenizerBulkCountEnabled(previous);
        } else if (bridge) {
            bridge.tokenizerBulkCountEnabled = previous;
        }
        throw error;
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

function saveExtensionSettings() {
    const persistedSettings = { ...settings };
    delete persistedSettings.baibaokuSettingsAccelerationEnabled;
    delete persistedSettings.fastCharacterListEnabled;
    delete persistedSettings.recentChatListAccelerationEnabled;
    delete persistedSettings.progressiveChatLoadingEnabled;
    Object.assign(extension_settings[SETTINGS_KEY], persistedSettings);
    delete extension_settings[SETTINGS_KEY].baibaokuSettingsAccelerationEnabled;
    delete extension_settings[SETTINGS_KEY].fastCharacterListEnabled;
    delete extension_settings[SETTINGS_KEY].recentChatListAccelerationEnabled;
    delete extension_settings[SETTINGS_KEY].progressiveChatLoadingEnabled;
    saveSettingsDebounced();
}

function applyTranslateMessageUpdatedOptimization() {
    if (settings.translateMessageUpdatedOptimizationEnabled) {
        installTranslateMessageUpdatedOptimization();
    } else {
        restoreTranslateMessageUpdatedOptimization();
    }
}

function getTranslateMessageUpdatedOptimizationState() {
    if (!extensionState.translateMessageUpdatedOptimization || typeof extensionState.translateMessageUpdatedOptimization !== 'object') {
        extensionState.translateMessageUpdatedOptimization = {};
    }

    return extensionState.translateMessageUpdatedOptimization;
}

function installTranslateMessageUpdatedOptimization() {
    const listeners = eventSource?.events?.[event_types.MESSAGE_UPDATED];
    const state = getTranslateMessageUpdatedOptimizationState();

    if (!Array.isArray(listeners)) {
        scheduleTranslateMessageUpdatedOptimizationRetry();
        return;
    }

    let installed = 0;

    for (let index = 0; index < listeners.length; index++) {
        const listener = listeners[index];

        if (listener?.[TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY] || !isTranslateMessageUpdatedListener(listener)) {
            continue;
        }

        const wrapped = async function baiBaiToolkitTranslateMessageUpdatedGuard(messageId, ...args) {
            if (shouldSkipTranslateMessageUpdatedListener(messageId)) {
                console.debug(`${LOG_PREFIX} Skipped translate MESSAGE_UPDATED listener for message ${messageId}`);
                return;
            }

            return listener.apply(this, [messageId, ...args]);
        };

        wrapped[TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY] = true;
        wrapped.__baiBaiToolkitOriginalTranslateMessageUpdatedListener = listener;
        listeners[index] = wrapped;
        installed += 1;
    }

    state.installed = listeners.some(listener => listener?.[TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY]);

    if (!state.installed && !state.retryTimer) {
        scheduleTranslateMessageUpdatedOptimizationRetry();
    }

    if (installed > 0) {
        state.retryCount = 0;
        console.debug(`${LOG_PREFIX} Translate MESSAGE_UPDATED optimization installed (${installed})`);
    }
}

function restoreTranslateMessageUpdatedOptimization() {
    const listeners = eventSource?.events?.[event_types.MESSAGE_UPDATED];
    const state = getTranslateMessageUpdatedOptimizationState();

    if (state.retryTimer) {
        clearTimeout(state.retryTimer);
        state.retryTimer = null;
    }

    if (!Array.isArray(listeners)) {
        state.installed = false;
        return;
    }

    let restored = 0;

    for (let index = 0; index < listeners.length; index++) {
        const listener = listeners[index];

        if (!listener?.[TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY]) {
            continue;
        }

        const original = listener.__baiBaiToolkitOriginalTranslateMessageUpdatedListener;
        if (typeof original === 'function') {
            listeners[index] = original;
            restored += 1;
        }
    }

    state.installed = false;
    state.retryCount = 0;

    if (restored > 0) {
        console.debug(`${LOG_PREFIX} Translate MESSAGE_UPDATED optimization restored (${restored})`);
    }
}

function scheduleTranslateMessageUpdatedOptimizationRetry() {
    const state = getTranslateMessageUpdatedOptimizationState();

    if (state.retryTimer || !settings.translateMessageUpdatedOptimizationEnabled) {
        return;
    }

    state.retryCount = Number(state.retryCount || 0) + 1;
    if (state.retryCount > 30) {
        console.debug(`${LOG_PREFIX} Translate MESSAGE_UPDATED optimization listener was not found after retries`);
        return;
    }

    state.retryTimer = setTimeout(() => {
        state.retryTimer = null;
        if (settings.translateMessageUpdatedOptimizationEnabled) {
            installTranslateMessageUpdatedOptimization();
        }
    }, 1000);
}

function isTranslateMessageUpdatedListener(listener) {
    if (typeof listener !== 'function') {
        return false;
    }

    const source = getFunctionSource(listener);
    return source.includes('translateFunction')
        && source.includes('shouldTranslateFunction')
        && source.includes('await translateFunction');
}

function shouldSkipTranslateMessageUpdatedListener(messageId) {
    const autoMode = String(extension_settings?.translate?.auto_mode ?? '').toLowerCase();

    if (autoMode !== 'none') {
        return false;
    }

    const index = Number(messageId);
    if (!Number.isInteger(index) || index < 0) {
        return false;
    }

    const message = Array.isArray(scriptModule.chat) ? scriptModule.chat[index] : null;
    if (!message) {
        return false;
    }

    return !message.extra?.display_text;
}

function getPerformanceTraceState() {
    if (!extensionState.performanceTrace || typeof extensionState.performanceTrace !== 'object') {
        extensionState.performanceTrace = {};
    }

    return extensionState.performanceTrace;
}

function startPerformanceTrace() {
    const state = getPerformanceTraceState();

    if (state.active) {
        return;
    }

    Object.assign(state, {
        active: true,
        startedAt: performance.now(),
        startedAtIso: new Date().toISOString(),
        endedAtIso: '',
        lines: [],
        lastKeys: new Map(),
        responseInfo: new WeakMap(),
        counters: {
            dropped: 0,
            suppressed: 0,
            events: 0,
            fetches: 0,
            gzipCompression: 0,
            jsonStringify: 0,
            responseJson: 0,
            longTasks: 0,
            longDomRefreshes: 0,
            interactions: 0,
            listeners: 0,
        },
        activities: [],
        eventStats: new Map(),
        listenerStats: new Map(),
        fetchStats: new Map(),
        gzipStats: new Map(),
        jsonStats: new Map(),
        responseJsonStats: new Map(),
        longDomRefreshStats: new Map(),
    });

    installPerformanceTraceRuntimePatches(state);
    appendPerformanceTraceLine('trace', `start ${getPerformanceTraceSnapshot({ includeTextStats: true })}`);

    state.uiTimer = setInterval(updatePerformanceTraceControls, 1000);
    updatePerformanceTraceControls();
    notifyPerformanceTrace('Performance trace started.');
}

function stopPerformanceTraceAndExport() {
    const state = getPerformanceTraceState();

    if (!state.active) {
        return;
    }

    appendPerformanceTraceLine('trace', `stop ${getPerformanceTraceSnapshot({ includeTextStats: true })}`);
    state.active = false;
    state.endedAtIso = new Date().toISOString();

    restorePerformanceTraceRuntimePatches(state);
    clearInterval(state.uiTimer);
    state.uiTimer = null;

    const text = buildPerformanceTraceExport(state);
    const filename = `st-performance-trace-${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
    downloadTextFile(filename, text);

    updatePerformanceTraceControls();
    notifyPerformanceTrace('Performance trace exported.');
}

function installPerformanceTraceRuntimePatches(state) {
    installPerformanceTraceEventEmitPatch(state);
    installPerformanceTraceJsonStringifyPatch(state);
    installPerformanceTraceResponseJsonPatch(state);
    installPerformanceTraceLongTaskObserver(state);
    installPerformanceTraceInteractionListeners(state);
}

function restorePerformanceTraceRuntimePatches(state) {
    if (state.originalEventEmit) {
        eventSource.emit = state.originalEventEmit;
        state.originalEventEmit = null;
    }

    if (state.originalJsonStringify) {
        JSON.stringify = state.originalJsonStringify;
        state.originalJsonStringify = null;
    }

    if (state.originalResponseJson && typeof Response !== 'undefined') {
        Response.prototype.json = state.originalResponseJson;
        state.originalResponseJson = null;
    }

    if (state.longTaskObserver) {
        state.longTaskObserver.disconnect();
        state.longTaskObserver = null;
    }

    if (state.interactionClickHandler) {
        document.removeEventListener('click', state.interactionClickHandler, true);
        state.interactionClickHandler = null;
    }

    if (state.interactionKeydownHandler) {
        document.removeEventListener('keydown', state.interactionKeydownHandler, true);
        state.interactionKeydownHandler = null;
    }
}

function installPerformanceTraceEventEmitPatch(state) {
    if (state.originalEventEmit || typeof eventSource?.emit !== 'function') {
        return;
    }

    state.originalEventEmit = eventSource.emit;
    eventSource.emit = async function baiBaiToolkitPerformanceTraceEmit(event, ...args) {
        const traceState = getPerformanceTraceState();

        if (!traceState.active || !PERFORMANCE_TRACE_EVENTS.has(event)) {
            return traceState.originalEventEmit.apply(this, [event, ...args]);
        }

        const start = performance.now();
        const listeners = Array.isArray(this.events?.[event]) ? this.events[event].slice() : [];

        if (localStorage.getItem('eventTracing') === 'true') {
            console.trace('Event emitted: ' + event, args);
        } else {
            console.debug('Event emitted: ' + event);
        }

        for (let index = 0; index < listeners.length; index++) {
            const listener = listeners[index];
            const listenerStart = performance.now();
            let error = null;

            try {
                await listener.apply(this, args);
            } catch (err) {
                error = err;
                console.error(err);
                console.trace('Error in event listener');
            } finally {
                const listenerDuration = performance.now() - listenerStart;
                recordPerformanceTraceListener(event, listener, index, listenerDuration, error);
            }
        }

        if (this.autoFireAfterEmit?.has(event)) {
            this.autoFireLastArgs?.set(event, args);
        }

        const duration = performance.now() - start;
        recordPerformanceTraceEvent(event, args, duration, listeners.length);
    };
}

function installPerformanceTraceJsonStringifyPatch(state) {
    if (state.originalJsonStringify || typeof JSON.stringify !== 'function') {
        return;
    }

    state.originalJsonStringify = JSON.stringify;
    JSON.stringify = function baiBaiToolkitPerformanceTraceStringify(value, replacer, space) {
        const traceState = getPerformanceTraceState();
        const kind = traceState.active ? getJsonStringifyTraceKind(value) : null;
        const start = traceState.active ? performance.now() : 0;
        const result = traceState.originalJsonStringify.apply(this, [value, replacer, space]);

        if (traceState.active) {
            const duration = performance.now() - start;
            if (kind || duration >= PERFORMANCE_TRACE_SLOW_MS) {
                recordPerformanceTraceJsonStringify(kind || { name: 'slow-json', count: 0 }, duration, result);
            }
        }

        return result;
    };
}

function installPerformanceTraceResponseJsonPatch(state) {
    if (state.originalResponseJson || typeof Response === 'undefined' || typeof Response.prototype?.json !== 'function') {
        return;
    }

    state.originalResponseJson = Response.prototype.json;
    Response.prototype.json = async function baiBaiToolkitPerformanceTraceResponseJson(...args) {
        const traceState = getPerformanceTraceState();
        const info = traceState.active ? traceState.responseInfo?.get(this) : null;
        const start = traceState.active ? performance.now() : 0;
        const result = await traceState.originalResponseJson.apply(this, args);

        if (traceState.active) {
            const duration = performance.now() - start;
            if (info || duration >= PERFORMANCE_TRACE_SLOW_MS) {
                recordPerformanceTraceResponseJson(info, result, duration);
            }
        }

        return result;
    };
}

function installPerformanceTraceLongTaskObserver(state) {
    if (state.longTaskObserver || typeof PerformanceObserver !== 'function') {
        return;
    }

    const supported = PerformanceObserver.supportedEntryTypes || [];
    if (supported.length && !supported.includes('longtask')) {
        return;
    }

    try {
        state.longTaskObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
                recordPerformanceTraceLongTask(entry);
            }
        });
        state.longTaskObserver.observe({ entryTypes: ['longtask'] });
    } catch (error) {
        appendPerformanceTraceLine('trace', `longtask observer unavailable error=${sanitizeTraceValue(error?.message || error)}`);
    }
}

function installPerformanceTraceInteractionListeners(state) {
    if (state.interactionClickHandler || state.interactionKeydownHandler) {
        return;
    }

    state.interactionClickHandler = (event) => {
        const target = event.target instanceof Element
            ? event.target.closest(PERFORMANCE_TRACE_INTERACTION_SELECTOR)
            : null;

        if (!target) {
            return;
        }

        recordPerformanceTraceInteraction('click', getTraceElementLabel(target));
    };

    state.interactionKeydownHandler = (event) => {
        const target = event.target;
        if (!(target instanceof Element) || target.id !== 'send_textarea') {
            return;
        }

        if (event.key === 'Enter' && (event.ctrlKey || event.metaKey || !event.shiftKey)) {
            recordPerformanceTraceInteraction('keydown', `#send_textarea key=${event.key} ctrl=${event.ctrlKey} meta=${event.metaKey} shift=${event.shiftKey}`);
        }
    };

    document.addEventListener('click', state.interactionClickHandler, true);
    document.addEventListener('keydown', state.interactionKeydownHandler, true);
}

function installPerformanceTraceFetchHook() {
    const existing = globalThis[PERFORMANCE_TRACE_FETCH_KEY];
    if (existing?.wrappedFetch) {
        return existing;
    }

    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
    };

    state.wrappedFetch = async function baiBaiToolkitPerformanceTraceFetch(input, init) {
        const traceState = getPerformanceTraceState();
        const info = traceState.active ? getPerformanceTraceFetchInfo(input, init) : null;

        if (!info) {
            return state.originalFetch(input, init);
        }

        const start = performance.now();
        recordPerformanceTraceFetchStart(info);

        try {
            const response = await state.originalFetch(input, init);
            const duration = performance.now() - start;
            traceState.responseInfo?.set(response, {
                ...info,
                status: response?.status,
            });
            recordPerformanceTraceFetchEnd(info, duration, response?.status);
            return response;
        } catch (error) {
            const duration = performance.now() - start;
            recordPerformanceTraceFetchError(info, duration, error);
            throw error;
        }
    };

    state.wrappedFetch[PERFORMANCE_TRACE_FETCH_KEY] = true;
    globalThis[PERFORMANCE_TRACE_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function recordPerformanceTraceEvent(event, args, duration, listenerCount = 0) {
    const state = getPerformanceTraceState();
    state.counters.events += 1;
    updatePerformanceTraceStats(state.eventStats, event, duration);
    rememberPerformanceTraceActivity('event', event, performance.now() - duration);

    const slow = duration >= PERFORMANCE_TRACE_SLOW_MS;
    const key = `event:${event}:${summarizeTraceArgs(args, 1)}`;
    const argsSummary = summarizeTraceArgs(args);
    appendPerformanceTraceLine(
        'event',
        `${event} duration=${formatTraceMs(duration)} listeners=${listenerCount} args=${argsSummary}`,
        { key, dedupeMs: slow ? 0 : PERFORMANCE_TRACE_DEDUPE_MS },
    );
}

function recordPerformanceTraceListener(event, listener, index, duration, error = null) {
    const state = getPerformanceTraceState();
    const label = getPerformanceTraceListenerLabel(event, listener, index);
    const key = `${event} ${label}`;
    const shouldLog = duration >= PERFORMANCE_TRACE_LISTENER_LOG_MS || error;

    state.counters.listeners += 1;
    updatePerformanceTraceStats(state.listenerStats, key, duration);

    if (!shouldLog) {
        return;
    }

    appendPerformanceTraceLine(
        'listener',
        `${event} #${index + 1}/${getPerformanceTraceListenerCount(event)} ${label} duration=${formatTraceMs(duration)}${error ? ` error=${sanitizeTraceValue(error?.message || error)}` : ''}`,
        { key: `listener:${event}:${index}:${label}:${Math.round(duration / 10)}`, dedupeMs: 100 },
    );
}

function recordPerformanceTraceJsonStringify(kind, duration, result) {
    const state = getPerformanceTraceState();
    state.counters.jsonStringify += 1;
    updatePerformanceTraceStats(state.jsonStats, kind.name, duration);
    rememberPerformanceTraceActivity('json', kind.name, performance.now() - duration);

    const chars = typeof result === 'string' ? result.length : 0;
    appendPerformanceTraceLine(
        'json',
        `JSON.stringify kind=${kind.name} items=${kind.count || 0} chars=${chars} duration=${formatTraceMs(duration)}`,
        { key: `json:${kind.name}:${kind.count}:${chars}`, dedupeMs: 500 },
    );
}

function recordPerformanceTraceResponseJson(info, result, duration) {
    const state = getPerformanceTraceState();
    const path = info?.path || 'unknown';
    state.counters.responseJson += 1;
    updatePerformanceTraceStats(state.responseJsonStats, path, duration);
    appendPerformanceTraceLine(
        'response-json',
        `path=${path} result=${summarizeResponseJsonResult(result)} duration=${formatTraceMs(duration)}`,
        { key: `response-json:${path}:${summarizeResponseJsonResult(result)}`, dedupeMs: 500 },
    );
}

function recordPerformanceTraceLongTask(entry) {
    const state = getPerformanceTraceState();
    if (!state.active) {
        return;
    }

    state.counters.longTasks += 1;
    const relativeStart = Math.max(0, entry.startTime - state.startedAt);
    const nearby = getNearbyPerformanceTraceActivity(entry.startTime);
    const attribution = summarizePerformanceTraceLongTaskAttribution(entry);
    appendPerformanceTraceLine(
        'longtask',
        `duration=${formatTraceMs(entry.duration)} taskStart=+${formatTraceMs(relativeStart)}${nearby ? ` near=${nearby}` : ''}${attribution ? ` attr=${attribution}` : ''}`,
        { key: `longtask:${Math.round(entry.startTime)}`, dedupeMs: 0 },
    );
}

function recordPerformanceTraceLongDomRefresh(info) {
    const state = getPerformanceTraceState();
    if (!state.active || !info) {
        return;
    }

    state.counters.longDomRefreshes = Number(state.counters.longDomRefreshes || 0) + 1;
    if (!(state.longDomRefreshStats instanceof Map)) {
        state.longDomRefreshStats = new Map();
    }
    const reason = sanitizeTraceValue(info.reason || 'unknown');
    updatePerformanceTraceStats(state.longDomRefreshStats, reason, info.duration);

    if (info.duration < PERFORMANCE_TRACE_LISTENER_LOG_MS) {
        return;
    }

    appendPerformanceTraceLine(
        'longdom',
        [
            `refresh reason=${reason}`,
            `duration=${formatTraceMs(info.duration)}`,
            `messages=${info.messages || 0}`,
            `optimized=${info.optimized ? 'yes' : 'no'}`,
            `contained=${info.contained || 0}`,
            `editing=${info.editing || 0}`,
            `tail=${info.tail || 0}`,
            `cached=${info.cached || 0}`,
            `estimated=${info.estimated || 0}`,
        ].join(' '),
        { key: `longdom:${reason}`, dedupeMs: 80 },
    );
}

function recordPerformanceTraceInteraction(type, label) {
    const state = getPerformanceTraceState();
    if (!state.active) {
        return;
    }

    state.counters.interactions += 1;
    rememberPerformanceTraceActivity('interaction', `${type}:${label}`);
    appendPerformanceTraceLine(
        'interaction',
        `${type} ${sanitizeTraceValue(label)}`,
        { key: `interaction:${type}:${label}`, dedupeMs: 500 },
    );
}

function recordPerformanceTraceFetchStart(info) {
    const state = getPerformanceTraceState();
    state.counters.fetches += 1;
    rememberPerformanceTraceActivity('fetch-start', `${info.method} ${info.path}`);
    appendPerformanceTraceLine(
        'fetch-start',
        `${info.method} ${info.path} body=${info.bodySize} encoding=${info.encoding || 'none'}`,
        { key: `fetch-start:${info.method}:${info.path}:${info.bodySize}`, dedupeMs: 250 },
    );
}

function recordPerformanceTraceFetchEnd(info, duration, status) {
    const state = getPerformanceTraceState();
    updatePerformanceTraceStats(state.fetchStats, `${info.method} ${info.path}`, duration);
    rememberPerformanceTraceActivity('fetch-end', `${info.method} ${info.path}`, performance.now() - duration);
    appendPerformanceTraceLine(
        'fetch-end',
        `${info.method} ${info.path} status=${status || 'unknown'} duration=${formatTraceMs(duration)} body=${info.bodySize}`,
        { key: `fetch-end:${info.method}:${info.path}:${status}:${info.bodySize}`, dedupeMs: 250 },
    );
}

function recordPerformanceTraceFetchError(info, duration, error) {
    rememberPerformanceTraceActivity('fetch-error', `${info.method} ${info.path}`, performance.now() - duration);
    appendPerformanceTraceLine(
        'fetch-error',
        `${info.method} ${info.path} duration=${formatTraceMs(duration)} error=${sanitizeTraceValue(error?.message || error)}`,
        { key: `fetch-error:${info.method}:${info.path}`, dedupeMs: 250 },
    );
}

function recordPerformanceTraceGzipCompression(info) {
    const state = getPerformanceTraceState();
    if (!state.active) {
        return;
    }

    const duration = Number(info?.duration || 0);
    const label = `${info?.method || 'POST'} ${info?.path || '/api/chats/save'}`;
    const originalBytes = Number(info?.originalBytes || 0);
    const compressedBytes = Number(info?.compressedBytes || 0);
    const ratio = originalBytes > 0 && compressedBytes > 0
        ? `${Math.round((compressedBytes / originalBytes) * 100)}%`
        : 'n/a';

    state.counters.gzipCompression += 1;
    updatePerformanceTraceStats(state.gzipStats, label, duration);
    rememberPerformanceTraceActivity('gzip', label, info?.startedAt || performance.now() - duration);

    appendPerformanceTraceLine(
        'gzip',
        `${label} original=${formatTraceBytes(originalBytes)} compressed=${formatTraceBytes(compressedBytes)} ratio=${ratio} duration=${formatTraceMs(duration)}${info?.caller ? ` caller=${sanitizeTraceValue(info.caller)}` : ''}`,
        { key: `gzip:${label}:${originalBytes}:${compressedBytes}:${Math.round(duration / 10)}`, dedupeMs: 0 },
    );
}

function rememberPerformanceTraceActivity(type, label, at = performance.now()) {
    const state = getPerformanceTraceState();
    if (!state.active || !Array.isArray(state.activities)) {
        return;
    }

    state.activities.push({
        at,
        type: sanitizeTraceValue(type),
        label: sanitizeTraceValue(label),
    });

    while (state.activities.length > 80) {
        state.activities.shift();
    }
}

function getNearbyPerformanceTraceActivity(startTime) {
    const state = getPerformanceTraceState();
    const activities = Array.isArray(state.activities) ? state.activities : [];
    let nearest = null;
    let nearestDistance = Infinity;

    for (const activity of activities) {
        const distance = Math.abs(startTime - activity.at);
        if (distance < nearestDistance) {
            nearest = activity;
            nearestDistance = distance;
        }
    }

    if (!nearest || nearestDistance > 1200) {
        return '';
    }

    const delta = startTime - nearest.at;
    const sign = delta >= 0 ? '+' : '-';
    return `${nearest.type}:${nearest.label}${sign}${formatTraceMs(Math.abs(delta))}`;
}

function summarizePerformanceTraceLongTaskAttribution(entry) {
    const attribution = Array.isArray(entry?.attribution) ? entry.attribution[0] : null;
    if (!attribution) {
        return '';
    }

    return [
        attribution.name,
        attribution.containerType,
        attribution.containerName,
        attribution.containerSrc,
    ]
        .filter(Boolean)
        .map(sanitizeTraceValue)
        .join('/');
}

function appendPerformanceTraceLine(type, message, { key = '', dedupeMs = PERFORMANCE_TRACE_DEDUPE_MS } = {}) {
    const state = getPerformanceTraceState();
    if (!state.active || !Array.isArray(state.lines)) {
        return;
    }

    const now = performance.now();
    const elapsed = now - state.startedAt;

    if (key && dedupeMs > 0) {
        const previous = state.lastKeys.get(key) || 0;
        if (now - previous < dedupeMs) {
            state.counters.suppressed += 1;
            return;
        }
        state.lastKeys.set(key, now);
    }

    const snapshot = getPerformanceTraceSnapshot();
    let line = `+${formatTraceMs(elapsed)} ${type} ${message} | ${snapshot}`;

    if (line.length > PERFORMANCE_TRACE_MAX_LINE_LENGTH) {
        line = `${line.slice(0, PERFORMANCE_TRACE_MAX_LINE_LENGTH - 15)}...<truncated>`;
    }

    state.lines.push(line);

    while (state.lines.length > PERFORMANCE_TRACE_MAX_LINES) {
        state.lines.shift();
        state.counters.dropped += 1;
    }
}

function getPerformanceTraceFetchInfo(input, init) {
    const rawUrl = getFetchRequestUrl(input);
    if (!rawUrl) {
        return null;
    }

    try {
        const url = new URL(rawUrl, location.href);
        if (!PERFORMANCE_TRACE_FETCH_PATHS.has(url.pathname)) {
            return null;
        }

        const headers = buildFetchHeaders(input, init);
        return {
            path: url.pathname,
            method: getFetchRequestMethod(input, init),
            bodySize: getTraceFetchBodySize(init?.body),
            encoding: headers.get('Content-Encoding') || '',
        };
    } catch {
        return null;
    }
}

function getTraceFetchBodySize(body) {
    if (body == null) {
        return 'none';
    }

    if (typeof body === 'string') {
        return `${body.length}ch`;
    }

    if (body instanceof Blob) {
        return `${body.size}B`;
    }

    if (body instanceof URLSearchParams) {
        return `${String(body).length}ch`;
    }

    if (body instanceof ArrayBuffer) {
        return `${body.byteLength}B`;
    }

    if (ArrayBuffer.isView(body)) {
        return `${body.byteLength}B`;
    }

    if (body instanceof FormData) {
        return 'form-data';
    }

    return typeof body;
}

function getJsonStringifyTraceKind(value) {
    if (!value || typeof value !== 'object') {
        return null;
    }

    if (Array.isArray(value.chat)) {
        return {
            name: value.id ? 'group-chat-save-body' : 'chat-save-body',
            count: value.chat.length,
        };
    }

    if (Array.isArray(value) && value[0]?.chat_metadata) {
        return {
            name: 'chat-array',
            count: value.length,
        };
    }

    return null;
}

function getPerformanceTraceSnapshot({ includeTextStats = false } = {}) {
    const chat = Array.isArray(scriptModule.chat) ? scriptModule.chat : [];
    const visibleMessages = document.querySelectorAll('#chat .mes').length;
    const firstVisible = document.querySelector('#chat .mes')?.getAttribute('mesid') ?? 'none';
    const lastVisible = [...document.querySelectorAll('#chat .mes')].at(-1)?.getAttribute('mesid') ?? 'none';
    const memory = getPerformanceMemorySnapshot();
    const base = [
        `chat=${chat.length}`,
        `visible=${visibleMessages}`,
        `range=${firstVisible}-${lastVisible}`,
        `trunc=${power_user?.chat_truncation ?? 'unknown'}`,
        `chatId=${sanitizeTraceValue(getCurrentChatId() || 'none')}`,
        memory,
        chatOptimizations.getLongChatDomRenderSnapshot(),
    ].filter(Boolean);

    if (includeTextStats) {
        base.push(getChatTextStats(chat));
    }

    base.push(getVisibleMessageTextStats(chat));

    return base.join(' ');
}

function getChatTextStats(chat) {
    let textChars = 0;
    let mediaItems = 0;

    for (const message of chat) {
        textChars += typeof message?.mes === 'string' ? message.mes.length : 0;
        mediaItems += Array.isArray(message?.extra?.media) ? message.extra.media.length : 0;
        mediaItems += Array.isArray(message?.extra?.files) ? message.extra.files.length : 0;
    }

    return `textChars=${textChars} mediaItems=${mediaItems}`;
}

function getVisibleMessageTextStats(chat) {
    const stats = chatOptimizations.calculateVisibleMessageTextStats(chat);
    return `visibleTextChars=${stats.visibleTextChars} maxVisibleMes=${stats.maxVisibleMesId}:${stats.maxVisibleChars}`;
}

function getPerformanceMemorySnapshot() {
    const memory = performance.memory;
    if (!memory) {
        return '';
    }

    return `heap=${formatTraceBytes(memory.usedJSHeapSize)}/${formatTraceBytes(memory.jsHeapSizeLimit)}`;
}

function summarizeTraceArgs(args, limit = 3) {
    return args
        .slice(0, limit)
        .map((arg) => summarizeTraceArg(arg))
        .join(',');
}

function summarizeTraceArg(arg) {
    if (arg == null) {
        return String(arg);
    }

    if (['string', 'number', 'boolean'].includes(typeof arg)) {
        return sanitizeTraceValue(arg);
    }

    if (Array.isArray(arg)) {
        return `Array(${arg.length})`;
    }

    if (typeof arg === 'object') {
        if ('messageId' in arg || 'mesId' in arg || 'newSwipeId' in arg) {
            return `{messageId=${arg.messageId ?? arg.mesId ?? 'n/a'},newSwipeId=${arg.newSwipeId ?? 'n/a'}}`;
        }

        if (arg.detail?.id !== undefined) {
            return `{detail.id=${sanitizeTraceValue(arg.detail.id)}}`;
        }

        const keys = Object.keys(arg).slice(0, 5).join(',');
        return `{keys=${keys}}`;
    }

    return typeof arg;
}

function getPerformanceTraceListenerCount(event) {
    return Array.isArray(eventSource?.events?.[event]) ? eventSource.events[event].length : 0;
}

function getPerformanceTraceListenerLabel(event, listener, index) {
    const name = listener?.name || 'anonymous';
    const source = getFunctionSource(listener);
    const hint = inferPerformanceTraceListenerHint(event, listener, source);
    return `${hint || 'unknown'}:${name}#${index + 1}`;
}

function getFunctionSource(fn) {
    try {
        return Function.prototype.toString.call(fn).slice(0, 1600);
    } catch {
        return '';
    }
}

function inferPerformanceTraceListenerHint(event, listener, source) {
    const name = listener?.name || '';

    if (source.includes('translateFunction') || source.includes('translateIncomingMessage') || source.includes('translateMessageEdit')) {
        return 'translate';
    }

    if (source.includes('extension_settings.memory') || source.includes('getLatestMemoryFromChat') || source.includes('setMemoryContext')) {
        return 'memory';
    }

    if (source.includes('PromptReasoning') || source.includes('updateReasoningUI') || source.includes('eventHandler(event, idx)')) {
        return 'reasoning';
    }

    if (source.includes('renderDebounced') || source.includes('PromptManager')) {
        return 'prompt-manager';
    }

    if (source.includes('moduleWorker.update') || source.includes('vectors') || name.includes('vectors')) {
        return 'vectors';
    }

    if (source.includes('debouncedRender') || source.includes('logprobs')) {
        return 'logprobs';
    }

    if (source.includes('getContext().saveChat') || source.includes('saveChatConditional')) {
        return 'save-chat';
    }

    if (source.includes('baiBaiToolkit') || source.includes('MobileMessageEdit') || source.includes('mobileMessageEdit')) {
        return 'this-plugin';
    }

    if (name && name !== 'anonymous') {
        return 'named';
    }

    return '';
}

function summarizeResponseJsonResult(result) {
    if (Array.isArray(result)) {
        const first = result[0]?.chat_metadata ? 'chat-header' : typeof result[0];
        return `Array(${result.length},first=${first})`;
    }

    if (result && typeof result === 'object') {
        return `{keys=${Object.keys(result).slice(0, 5).join(',')}}`;
    }

    return sanitizeTraceValue(typeof result);
}

function updatePerformanceTraceStats(map, key, duration) {
    const stats = map.get(key) || { count: 0, total: 0, max: 0 };
    stats.count += 1;
    stats.total += duration;
    stats.max = Math.max(stats.max, duration);
    map.set(key, stats);
}

function buildPerformanceTraceExport(state) {
    const duration = state.endedAtIso
        ? new Date(state.endedAtIso).getTime() - new Date(state.startedAtIso).getTime()
        : 0;
    const lines = [
        'SillyTavern performance trace',
        `started=${state.startedAtIso || ''}`,
        `ended=${state.endedAtIso || ''}`,
        `duration=${duration}ms`,
        `finalSnapshot=${getPerformanceTraceSnapshot({ includeTextStats: true })}`,
        '',
        'Counters',
        `events=${state.counters?.events || 0}`,
        `fetches=${state.counters?.fetches || 0}`,
        `gzipCompression=${state.counters?.gzipCompression || 0}`,
        `jsonStringify=${state.counters?.jsonStringify || 0}`,
        `responseJson=${state.counters?.responseJson || 0}`,
        `longTasks=${state.counters?.longTasks || 0}`,
        `longDomRefreshes=${state.counters?.longDomRefreshes || 0}`,
        `interactions=${state.counters?.interactions || 0}`,
        `listeners=${state.counters?.listeners || 0}`,
        `suppressedDuplicates=${state.counters?.suppressed || 0}`,
        `droppedOldLines=${state.counters?.dropped || 0}`,
        '',
        'Top Events',
        ...formatTraceStatsMap(state.eventStats),
        '',
        'Top Listeners',
        ...formatTraceStatsMap(state.listenerStats),
        '',
        'Top Fetches',
        ...formatTraceStatsMap(state.fetchStats),
        '',
        'Top Gzip compression',
        ...formatTraceStatsMap(state.gzipStats),
        '',
        'Top JSON.stringify',
        ...formatTraceStatsMap(state.jsonStats),
        '',
        'Top Response.json',
        ...formatTraceStatsMap(state.responseJsonStats),
        '',
        'Top Long DOM Refresh',
        ...formatTraceStatsMap(state.longDomRefreshStats),
        '',
        'Log',
        ...(state.lines || []),
    ];

    return lines.join('\n');
}

function formatTraceStatsMap(map) {
    if (!map || !map.size) {
        return ['none'];
    }

    return [...map.entries()]
        .sort((a, b) => b[1].total - a[1].total)
        .slice(0, 12)
        .map(([key, stats]) => `${key} count=${stats.count} total=${formatTraceMs(stats.total)} max=${formatTraceMs(stats.max)}`);
}

function updatePerformanceTraceControls() {
    const state = getPerformanceTraceState();
    const active = Boolean(state.active);
    const lineCount = Array.isArray(state.lines) ? state.lines.length : 0;
    const dropped = state.counters?.dropped || 0;
    const suppressed = state.counters?.suppressed || 0;

    $('#bai_bai_toolkit_perf_trace_start').toggleClass('disabled', active);
    $('#bai_bai_toolkit_perf_trace_stop').toggleClass('disabled', !active);
    $('#bai_bai_toolkit_perf_trace_status').text(
        active
            ? `recording, lines=${lineCount}, suppressed=${suppressed}, dropped=${dropped}`
            : `idle, last lines=${lineCount}, suppressed=${suppressed}, dropped=${dropped}`,
    );
}

function downloadTextFile(filename, text) {
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function notifyPerformanceTrace(message) {
    if (globalThis.toastr?.info) {
        globalThis.toastr.info(message, 'Performance trace');
    }
}

function getTraceElementLabel(element) {
    if (element.id) {
        return `#${element.id}`;
    }

    const classes = [...element.classList].slice(0, 4).join('.');
    return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
}

function getPerformanceTraceStackSummary() {
    const state = getPerformanceTraceState();
    if (!state.active) {
        return '';
    }

    try {
        const stack = new Error().stack;
        if (!stack) {
            return '';
        }

        return stack
            .split('\n')
            .map(line => line.trim().replace(/^at\s+/, ''))
            .filter(line => line
                && !line.includes('getPerformanceTraceStackSummary')
                && !line.includes('baiBaiToolkitSaveRequestGzipFetch')
                && !line.includes('baiBaiToolkitPerformanceTraceFetch')
                && !line.includes('gzipFetchBody')
                && !line.includes('recordPerformanceTrace'))
            .slice(0, 4)
            .map(line => line.replace(location.origin, ''))
            .join(' <- ');
    } catch {
        return '';
    }
}

function sanitizeTraceValue(value) {
    return String(value)
        .replace(/\s+/g, ' ')
        .slice(0, 120);
}

function formatTraceMs(value) {
    return `${Number(value || 0).toFixed(1)}ms`;
}

function formatTraceBytes(value) {
    const bytes = Number(value || 0);
    if (bytes >= 1024 * 1024) {
        return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
    }
    if (bytes >= 1024) {
        return `${(bytes / 1024).toFixed(1)}KB`;
    }
    return `${bytes}B`;
}

function initializeExtensionUpdateCheck() {
    if (readSilentUpdateState()?.updateAvailable === true) {
        applyUpdateAvailableVisualState(true);
        queueExtensionUpdatePrompt();
        return;
    }

    void checkForSilentExtensionUpdate()
        .catch((error) => console.debug(`${LOG_PREFIX} Silent update failed`, error));
}

async function checkForSilentExtensionUpdate({ force = false } = {}) {
    if (!force && !shouldCheckForSilentExtensionUpdate()) {
        return null;
    }

    if (extensionState.silentUpdatePromise) {
        return extensionState.silentUpdatePromise;
    }

    extensionState.silentUpdatePromise = runSilentExtensionUpdate()
        .finally(() => {
            extensionState.silentUpdatePromise = null;
        });

    return extensionState.silentUpdatePromise;
}

async function runSilentExtensionUpdate() {
    try {
        const localVersion = CURRENT_VERSION;

        const remoteManifestUrl = `https://raw.githubusercontent.com/baibai-git/SillyTavern-Mobile-Resize-Guard/main/manifest.json?t=${Date.now()}`;
        const remoteManifestResponse = await fetch(remoteManifestUrl);
        if (!remoteManifestResponse.ok) {
            throw new Error(`Failed to fetch remote manifest: ${remoteManifestResponse.statusText}`);
        }
        const remoteManifest = await remoteManifestResponse.json();
        const remoteVersion = remoteManifest.version;

        const updateAvailable = isVersionGreater(remoteVersion, localVersion);

        setCachedUpdateAvailable(updateAvailable);
        applyUpdateAvailableVisualState(updateAvailable);

        if (updateAvailable) {
            queueExtensionUpdatePrompt();
        }

        return { isUpToDate: !updateAvailable };
    } catch (error) {
        console.error(`${LOG_PREFIX} Update check failed:`, error);
        throw error;
    }
}

function isVersionGreater(v1, v2) {
    if (!v1 || !v2) return false;
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return true;
        if (p1 < p2) return false;
    }
    return false;
}

async function getCurrentExtensionVersion() {
    return fetchCurrentExtensionEndpoint('/api/extensions/version');
}

async function updateCurrentExtension() {
    return fetchCurrentExtensionEndpoint('/api/extensions/update');
}

async function fetchCurrentExtensionEndpoint(endpoint) {
    const type = getInstalledExtensionType();

    if (!type || type === 'system') {
        return new Response('Extension is not installed as an updateable third-party extension.', { status: 404 });
    }

    if (type === 'global' && !isAdmin()) {
        return new Response('Forbidden: No permission to update global extensions.', { status: 403 });
    }

    return fetch(endpoint, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            extensionName: EXTENSION_ID,
            global: type === 'global',
        }),
    });
}

function setCachedUpdateAvailable(updateAvailable) {
    writeSilentUpdateState({
        ...readSilentUpdateState(),
        checkedAt: Date.now(),
        updateAvailable: Boolean(updateAvailable),
    });
}

function applyUpdateAvailableVisualState(updateAvailable) {
    const isAvailable = Boolean(updateAvailable);
    $('.bai_bai_toolkit_update_badge').toggle(isAvailable);
    $('.bai_bai_toolkit_update_button').toggle(isAvailable);
}

async function promptForExtensionUpdate(updateButton = null) {
    if (extensionState.updatePromptPromise) {
        return extensionState.updatePromptPromise;
    }

    extensionState.updatePromptPromise = runExtensionUpdatePrompt(updateButton)
        .finally(() => {
            extensionState.updatePromptPromise = null;
        });

    return extensionState.updatePromptPromise;
}

function queueExtensionUpdatePrompt() {
    if (!settings.updatePromptOnAvailableEnabled) {
        return;
    }

    jQuery(() => {
        if (!settings.updatePromptOnAvailableEnabled) {
            return;
        }

        void promptForExtensionUpdate()
            .catch((error) => console.debug(`${LOG_PREFIX} Update prompt failed`, error));
    });
}

async function runExtensionUpdatePrompt(updateButton) {
    const button = updateButton?.length ? updateButton : null;
    let shouldResetButton = Boolean(button);

    if (button) {
        button.addClass('disabled');
    }

    try {
        const confirmed = await confirmExtensionUpdate();
        if (!confirmed) {
            return false;
        }

        setUpdateButtonLoading(button);
        await performCurrentExtensionUpdate();
        shouldResetButton = false;
        return true;
    } catch (error) {
        console.error(`${LOG_PREFIX} Update failed:`, error);
        toastr.error(`更新失败: ${error.message}`);
        return false;
    } finally {
        if (shouldResetButton) {
            resetUpdateButton(button);
        }
    }
}

async function confirmExtensionUpdate() {
    const content = `
        <div class="bai_bai_toolkit_update_prompt">
            <h3>柏宝箱发现新版本</h3>
            <p>检测到插件有可用更新。要现在更新吗？</p>
            <p>更新完成后，SillyTavern 会自动刷新页面。</p>
        </div>
    `;
    const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
        okButton: '更新',
        cancelButton: '取消',
    });

    return result === POPUP_RESULT.AFFIRMATIVE;
}

async function performCurrentExtensionUpdate() {
    const response = await updateCurrentExtension();
    if (!response.ok) {
        throw new Error(await getResponseErrorMessage(response));
    }

    setCachedUpdateAvailable(false);
    applyUpdateAvailableVisualState(false);
    toastr.success(t`Extension updated successfully. Reloading...`);
    setTimeout(() => location.reload(), 1000);
}

function setUpdateButtonLoading(button) {
    if (!button?.length) {
        return;
    }

    button.addClass('disabled');
    button.find('span').text('更新中...');
    button.find('i').removeClass('fa-download').addClass('fa-spinner fa-spin');
}

function resetUpdateButton(button) {
    if (!button?.length) {
        return;
    }

    button.removeClass('disabled');
    button.find('span').text('更新');
    button.find('i').removeClass('fa-spinner fa-spin').addClass('fa-download');
}

function getInstalledExtensionType(extensionId = EXTENSION_ID) {
    const fullExtensionId = Object.keys(extensionTypes).find((id) => {
        return id === extensionId || (id.startsWith('third-party') && id.endsWith(extensionId));
    });

    return fullExtensionId ? extensionTypes[fullExtensionId] : null;
}

async function getResponseErrorMessage(response) {
    const text = await response.text();

    return text || response.statusText || `HTTP ${response.status}`;
}

function shouldCheckForSilentExtensionUpdate() {
    const state = readSilentUpdateState();
    const checkedAt = Number(state?.checkedAt ?? 0);

    if (typeof state?.updateAvailable !== 'boolean') {
        return true;
    }

    return !Number.isFinite(checkedAt) || Date.now() - checkedAt >= SILENT_UPDATE_INTERVAL_MS;
}

function readSilentUpdateState() {
    try {
        return JSON.parse(localStorage.getItem(SILENT_UPDATE_STORAGE_KEY) || '{}');
    } catch {
        return {};
    }
}

function writeSilentUpdateState(state) {
    try {
        localStorage.setItem(SILENT_UPDATE_STORAGE_KEY, JSON.stringify(state));
    } catch {
        // Ignore storage errors; updates should never block extension startup.
    }
}

async function renderSettingsPanel() {
    const root = $('#extensions_settings2');

    if (!root.length) {
        return;
    }

    let container = $('#bai_bai_toolkit_container');

    if (!container.length) {
        container = $('<div id="bai_bai_toolkit_container" class="extension_container"></div>');
        root.append(container);
    }

    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    container.empty().append(template);

    // 初始化版本信息和更新逻辑

    // Initialize tabs
    const tabs = container.find('.bai_bai_toolkit_tab');
    const tabContents = container.find('.bai_bai_toolkit_tab_content');

    tabs.on('click', function () {
        const tab = $(this);
        const targetId = tab.data('target');

        // Update active class on tabs
        tabs.removeClass('active').css({
            'color': '',
            'border-bottom': '2px solid transparent',
            'opacity': '0.6'
        });

        tab.addClass('active').css({
            'color': 'var(--SmartThemeQuoteColor)',
            'border-bottom': '2px solid var(--SmartThemeQuoteColor)',
            'opacity': '1'
        });

        // Show/hide contents
        tabContents.hide();
        container.find(`#${targetId}`).show();
    });

    initializeUpdateUI(container);
    initializeBaibaokuPanel(container);

    $('#bai_bai_toolkit_update_prompt_on_available_enabled')
        .prop('checked', settings.updatePromptOnAvailableEnabled)
        .on('input', function () {
            settings.updatePromptOnAvailableEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();

            if (settings.updatePromptOnAvailableEnabled && readSilentUpdateState()?.updateAvailable === true) {
                queueExtensionUpdatePrompt();
            }
        });

    $('#bai_bai_toolkit_resize_guard_enabled')
        .prop('checked', settings.resizeGuardEnabled)
        .on('input', function () {
            settings.resizeGuardEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyFeatureSettings();
        });

    $('#bai_bai_toolkit_description_codemirror_editor_enabled')
        .prop('checked', settings.descriptionCodeMirrorEditorEnabled)
        .on('input', function () {
            settings.descriptionCodeMirrorEditorEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyDescriptionCodeMirrorEditorOptimization();
        });

    $('#bai_bai_toolkit_custom_css_input_optimization_enabled')
        .prop('checked', settings.customCssInputOptimizationEnabled)
        .on('input', function () {
            settings.customCssInputOptimizationEnabled = Boolean($(this).prop('checked'));

            // Auto-disable shadow property optimization if CodeMirror editor is disabled
            if (!settings.customCssInputOptimizationEnabled && settings.customCssShadowPropertyEnabled) {
                settings.customCssShadowPropertyEnabled = false;
                $('#bai_bai_toolkit_custom_css_shadow_property_enabled').prop('checked', false);
            }

            saveExtensionSettings();
            applyCustomCssInputOptimization();
        });

    $('#bai_bai_toolkit_custom_css_shadow_property_enabled')
        .prop('checked', settings.customCssShadowPropertyEnabled)
        .on('input', function () {
            settings.customCssShadowPropertyEnabled = Boolean($(this).prop('checked'));

            // Auto-enable CodeMirror editor if shadow property optimization is enabled
            if (settings.customCssShadowPropertyEnabled && !settings.customCssInputOptimizationEnabled) {
                settings.customCssInputOptimizationEnabled = true;
                $('#bai_bai_toolkit_custom_css_input_optimization_enabled').prop('checked', true);
            }

            saveExtensionSettings();
            applyCustomCssInputOptimization();
        });

    $('#bai_bai_toolkit_world_info_drawer_optimization_enabled')
        .prop('checked', settings.worldInfoDrawerOptimizationEnabled)
        .on('input', function () {
            settings.worldInfoDrawerOptimizationEnabled = Boolean($(this).prop('checked'));
            if (!settings.worldInfoDrawerOptimizationEnabled) {
                initializeDeferredWorldInfoSelect2(document);
            }
            saveExtensionSettings();
            applyWorldInfoDrawerOptimization();
            applyWorldInfoLazySelect2Optimization();
            applyWorldInfoCharacterFilterOptionsOptimization();
        });

    $('#bai_bai_toolkit_character_search_input_optimization_enabled')
        .prop('checked', settings.characterSearchInputOptimizationEnabled)
        .on('input', function () {
            settings.characterSearchInputOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyCharacterSearchInputOptimization();
        });

    $('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuSettingsAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu settings acceleration config`, error);
                checkbox.prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_fast_character_list_enabled')
        .prop('checked', settings.fastCharacterListEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuCharacterListAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu character list acceleration config`, error);
                checkbox.prop('checked', settings.fastCharacterListEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_recent_chat_list_acceleration_enabled')
        .prop('checked', settings.recentChatListAccelerationEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuRecentChatListAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu recent chat list acceleration config`, error);
                checkbox.prop('checked', settings.recentChatListAccelerationEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_progressive_chat_loading_enabled')
        .prop('checked', settings.progressiveChatLoadingEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuProgressiveChatLoadingEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu progressive chat loading config`, error);
                checkbox.prop('checked', settings.progressiveChatLoadingEnabled === true);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_tokenizer_bulk_count_enabled')
        .prop('checked', settings.tokenizerBulkCountEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuTokenizerBulkCountEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu tokenizer bulk count config`, error);
                checkbox.prop('checked', settings.tokenizerBulkCountEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_character_list_avatar_lazy_load_enabled')
        .prop('checked', settings.characterListAvatarLazyLoadEnabled)
        .on('input', function () {
            settings.characterListAvatarLazyLoadEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyCharacterListAvatarLazyLoadOptimization();
        });

    chatOptimizations.bindChatOptimizationSettings({ saveSettings: saveExtensionSettings });

    $('#bai_bai_toolkit_save_request_gzip_enabled')
        .prop('checked', settings.saveRequestGzipEnabled)
        .on('input', function () {
            settings.saveRequestGzipEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });

    $('#bai_bai_toolkit_translate_message_updated_optimization_enabled')
        .prop('checked', settings.translateMessageUpdatedOptimizationEnabled)
        .on('input', function () {
            settings.translateMessageUpdatedOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyTranslateMessageUpdatedOptimization();
        });

    $('#bai_bai_toolkit_perf_trace_start')
        .on('click', function () {
            if ($(this).hasClass('disabled')) {
                return;
            }
            startPerformanceTrace();
        });

    $('#bai_bai_toolkit_perf_trace_stop')
        .on('click', function () {
            if ($(this).hasClass('disabled')) {
                return;
            }
            stopPerformanceTraceAndExport();
        });

    updatePerformanceTraceControls();

    presetOptimizations.bindPresetOptimizationSettings({ saveSettings: saveExtensionSettings });

    $('#bai_bai_toolkit_regex_quick_operation_enabled')
        .prop('checked', settings.regexQuickOperationOptimizationEnabled)
        .on('input', function () {
            settings.regexQuickOperationOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyRegexQuickOperationOptimization();
        });

    chatOptimizations.applyChatOptimizationCompatibilityIndicators(container);
}

function initializeBaibaokuPanel(container) {
    container.find('#bai_bai_toolkit_baibaoku_refresh_status')
        .off('click.baiBaiToolkitBaibaokuStatus')
        .on('click.baiBaiToolkitBaibaokuStatus', () => {
            refreshBaibaokuPanelStatus(container, { force: true });
        });

    refreshBaibaokuPanelStatus(container);
}

function getBaibaokuPanelState() {
    if (!extensionState.baibaokuPanel || typeof extensionState.baibaokuPanel !== 'object') {
        extensionState.baibaokuPanel = {
            cache: null,
            pending: null,
        };
    }

    return extensionState.baibaokuPanel;
}

function applyBaibaokuPanelLocalState(container) {
    const bridge = getBaibaokuEarlyBridge();
    const bridgeStatus = container.find('#bai_bai_toolkit_baibaoku_bridge_status');

    const bridgeLabel = bridge?.installed
        ? `已注入${bridge.version ? ` v${bridge.version}` : ''}`
        : '未注入';
    updateBaibaokuStatusText(bridgeStatus, bridgeLabel, Boolean(bridge?.installed));

    container.find('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false);
    container.find('#bai_bai_toolkit_fast_character_list_enabled')
        .prop('checked', settings.fastCharacterListEnabled !== false);
    container.find('#bai_bai_toolkit_recent_chat_list_acceleration_enabled')
        .prop('checked', settings.recentChatListAccelerationEnabled !== false);
    container.find('#bai_bai_toolkit_progressive_chat_loading_enabled')
        .prop('checked', settings.progressiveChatLoadingEnabled !== false);
    container.find('#bai_bai_toolkit_tokenizer_bulk_count_enabled')
        .prop('checked', settings.tokenizerBulkCountEnabled !== false);

    applyCachedBaibaokuPanelStatus(container, getBaibaokuPanelState().cache);
}

function applyCachedBaibaokuPanelStatus(container, cache) {
    if (!cache) {
        return false;
    }

    const serverStatus = container.find('#bai_bai_toolkit_baibaoku_server_status');
    const driverStatus = container.find('#bai_bai_toolkit_baibaoku_driver_status');
    const status = cache.status;
    const driver = status?.driver;

    if (status) {
        updateBaibaokuStatusText(serverStatus, `已连接${status?.version ? ` v${status.version}` : ''}`, true);
        updateBaibaokuStatusText(driverStatus, driver?.available
            ? `可用${driver.package ? ` (${driver.package})` : ''}`
            : '不可用', Boolean(driver?.available));
        return true;
    }

    if (cache.offline) {
        updateBaibaokuStatusText(serverStatus, '未连接', false);
        updateBaibaokuStatusText(driverStatus, '未知', false);
        return true;
    }

    return false;
}

async function refreshBaibaokuPanelStatus(container, { force = false } = {}) {
    const panelState = getBaibaokuPanelState();
    const cache = panelState.cache;
    const cacheFresh = cache && Date.now() - Number(cache.updatedAt || 0) < BAIBAOKU_PANEL_STATUS_CACHE_MS;
    let refreshed = false;
    applyBaibaokuPanelLocalState(container);
    if (!force && cacheFresh && applyCachedBaibaokuPanelStatus(container, cache)) {
        return;
    }

    if (!force && panelState.pending) {
        await panelState.pending.catch(() => null);
        applyCachedBaibaokuPanelStatus(container, panelState.cache);
        return;
    }

    const serverStatus = container.find('#bai_bai_toolkit_baibaoku_server_status');
    const driverStatus = container.find('#bai_bai_toolkit_baibaoku_driver_status');
    const bridgeStatus = container.find('#bai_bai_toolkit_baibaoku_bridge_status');
    const accelerationToggle = container.find('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled');
    const characterListToggle = container.find('#bai_bai_toolkit_fast_character_list_enabled');
    const recentChatListToggle = container.find('#bai_bai_toolkit_recent_chat_list_acceleration_enabled');
    const progressiveChatLoadingToggle = container.find('#bai_bai_toolkit_progressive_chat_loading_enabled');
    const tokenizerBulkCountToggle = container.find('#bai_bai_toolkit_tokenizer_bulk_count_enabled');
    const bridge = getBaibaokuEarlyBridge();

    updateBaibaokuStatusText(bridgeStatus, bridge?.installed
        ? `已注入${bridge.version ? ` v${bridge.version}` : ''}`
        : '未注入', Boolean(bridge?.installed));

    const bridgeEnabled = typeof bridge?.isSettingsAccelerationEnabled === 'function'
        ? bridge.isSettingsAccelerationEnabled()
        : null;
    if (typeof bridgeEnabled === 'boolean') {
        settings.baibaokuSettingsAccelerationEnabled = bridgeEnabled;
        accelerationToggle.prop('checked', bridgeEnabled);
    }

    const bridgeCharacterListEnabled = typeof bridge?.isCharacterListAccelerationEnabled === 'function'
        ? bridge.isCharacterListAccelerationEnabled()
        : null;
    if (typeof bridgeCharacterListEnabled === 'boolean') {
        settings.fastCharacterListEnabled = bridgeCharacterListEnabled;
        characterListToggle.prop('checked', bridgeCharacterListEnabled);
    }

    const bridgeRecentChatListEnabled = typeof bridge?.isRecentChatListAccelerationEnabled === 'function'
        ? bridge.isRecentChatListAccelerationEnabled()
        : null;
    if (typeof bridgeRecentChatListEnabled === 'boolean') {
        settings.recentChatListAccelerationEnabled = bridgeRecentChatListEnabled;
        recentChatListToggle.prop('checked', bridgeRecentChatListEnabled);
    }

    const bridgeTokenizerBulkCountEnabled = typeof bridge?.isTokenizerBulkCountEnabled === 'function'
        ? bridge.isTokenizerBulkCountEnabled()
        : null;
    if (typeof bridgeTokenizerBulkCountEnabled === 'boolean') {
        settings.tokenizerBulkCountEnabled = bridgeTokenizerBulkCountEnabled;
        tokenizerBulkCountToggle.prop('checked', bridgeTokenizerBulkCountEnabled);
    }

    updateBaibaokuStatusText(serverStatus, '检测中', null);
    updateBaibaokuStatusText(driverStatus, '检测中', null);

    try {
        const status = await fetchBaibaokuStatus();
        const driver = status?.driver;
        panelState.cache = {
            ...(panelState.cache || {}),
            status,
            offline: false,
            updatedAt: Date.now(),
        };
        refreshed = true;
        updateBaibaokuStatusText(serverStatus, `已连接${status?.version ? ` v${status.version}` : ''}`, true);
        updateBaibaokuStatusText(driverStatus, driver?.available
            ? `可用${driver.package ? ` (${driver.package})` : ''}`
            : '不可用', Boolean(driver?.available));

        try {
            const config = await fetchBaibaokuFastConfig();
            const settingsEnabled = config.settingsAccelerationEnabled !== false;
            const characterListEnabled = config.characterListAccelerationEnabled !== false;
            const recentChatListEnabled = config.recentChatListAccelerationEnabled !== false;
            const progressiveChatLoadingEnabled = config.progressiveChatLoadingEnabled !== false;
            const tokenizerBulkCountEnabled = config.tokenizerBulkCountEnabled !== false;
            panelState.cache = {
                ...(panelState.cache || {}),
                config,
                offline: false,
                updatedAt: Date.now(),
            };
            settings.baibaokuSettingsAccelerationEnabled = settingsEnabled;
            settings.fastCharacterListEnabled = characterListEnabled;
            settings.recentChatListAccelerationEnabled = recentChatListEnabled;
            settings.progressiveChatLoadingEnabled = progressiveChatLoadingEnabled;
            settings.tokenizerBulkCountEnabled = tokenizerBulkCountEnabled;
            accelerationToggle.prop('checked', settingsEnabled);
            characterListToggle.prop('checked', characterListEnabled);
            recentChatListToggle.prop('checked', recentChatListEnabled);
            progressiveChatLoadingToggle.prop('checked', progressiveChatLoadingEnabled);
            tokenizerBulkCountToggle.prop('checked', tokenizerBulkCountEnabled);
            applyFastChatGetOptimization();
            if (typeof bridge?.setSettingsAccelerationEnabled === 'function') {
                bridge.setSettingsAccelerationEnabled(settingsEnabled);
            } else if (bridge) {
                bridge.settingsAccelerationEnabled = settingsEnabled;
            }
            if (typeof bridge?.setCharacterListAccelerationEnabled === 'function') {
                bridge.setCharacterListAccelerationEnabled(characterListEnabled);
            } else if (bridge) {
                bridge.characterListAccelerationEnabled = characterListEnabled;
            }
            if (typeof bridge?.setRecentChatListAccelerationEnabled === 'function') {
                bridge.setRecentChatListAccelerationEnabled(recentChatListEnabled);
            } else if (bridge) {
                bridge.recentChatListAccelerationEnabled = recentChatListEnabled;
            }
            if (typeof bridge?.setTokenizerBulkCountEnabled === 'function') {
                bridge.setTokenizerBulkCountEnabled(tokenizerBulkCountEnabled);
            } else if (bridge) {
                bridge.tokenizerBulkCountEnabled = tokenizerBulkCountEnabled;
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to read BaiBaoKu fast config`, error);
        }
    } catch {
        updateBaibaokuStatusText(serverStatus, '未连接', false);
        updateBaibaokuStatusText(driverStatus, '未知', false);
    }
    if (!refreshed) {
        panelState.cache = {
            ...(panelState.cache || {}),
            status: null,
            offline: true,
            updatedAt: Date.now(),
        };
    }
}

async function fetchBaibaokuStatus() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BAIBAOKU_STATUS_TIMEOUT_MS);

    try {
        const response = await fetch(BAIBAOKU_STATUS_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error?.message || `HTTP ${response.status}`);
        }

        return payload.data;
    } finally {
        clearTimeout(timer);
    }
}

async function fetchBaibaokuFastConfig() {
    const response = await fetch(BAIBAOKU_FAST_CONFIG_URL, {
        method: 'GET',
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

async function saveBaibaokuFastConfig(config) {
    const headers = new Headers(getRequestHeaders());
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    const response = await fetch(BAIBAOKU_FAST_CONFIG_URL, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify(config || {}),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

function updateBaibaokuStatusText(element, text, ok) {
    element.text(text);
    element.css('color', ok === null
        ? ''
        : ok
            ? 'var(--SmartThemeQuoteColor)'
            : 'var(--SmartThemeEmColor)');
}

async function initializeUpdateUI(container) {
    const versionSpan = container.find('.bai_bai_toolkit_current_version');
    const updateButton = container.find('.bai_bai_toolkit_update_button');
    const updateStatus = container.find('.bai_bai_toolkit_update_status');
    const badge = container.find('.bai_bai_toolkit_update_badge');

    // 获取并显示当前版本号
    versionSpan.text(CURRENT_VERSION);

    // 检查更新
    updateStatus.text('检查更新中...');

    // 如果已经有缓存的更新状态，直接使用
    const state = readSilentUpdateState();
    if (state && state.updateAvailable) {
        showUpdateAvailable();
    } else if (!shouldCheckForSilentExtensionUpdate()) {
        showNoUpdateAvailable();
    } else {
        // 后台检查更新
        checkUpdateAndShowUI();
    }

    async function checkUpdateAndShowUI() {
        try {
            const data = await checkForSilentExtensionUpdate({ force: true });
            if (data?.isUpToDate === false) {
                showUpdateAvailable();
            } else {
                showNoUpdateAvailable();
            }
        } catch (e) {
            updateStatus.text('检查更新出错');
        }
    }

    function showUpdateAvailable() {
        updateStatus.text('');
        updateButton.show();
        badge.show();
    }

    function showNoUpdateAvailable() {
        updateButton.hide();
        badge.hide();
        updateStatus.text('已是最新版本');
        setTimeout(() => updateStatus.text(''), 3000);
    }

    // 绑定更新按钮点击事件
    updateButton.on('click', async function () {
        if ($(this).hasClass('disabled')) return;

        await promptForExtensionUpdate($(this));
    });
}

function applyFeatureSettings() {
    if (settings.resizeGuardEnabled) {
        patchAutoCompletePositioning();
        patchPowerUserResizeHandler();
    } else {
        restoreAutoCompletePositioning();
        restorePowerUserResizeHandler();
    }

    chatOptimizations.applyFastChatListScrollOptimization();
    applyWorldInfoDrawerOptimization();
    applyWorldInfoLazySelect2Optimization();
    applyWorldInfoCharacterFilterOptionsOptimization();
    applyCharacterSearchInputOptimization();
    applyCharacterListAvatarLazyLoadOptimization();
    applyFastChatGetOptimization();
    applyDescriptionCodeMirrorEditorOptimization();
    applyCustomCssInputOptimization();
    presetOptimizations.applyPresetScrollOptimization();
    presetOptimizations.applyPresetDragOptimization();
    presetOptimizations.applyPresetSwitchOptimization();
    presetOptimizations.applyPresetToggleOptimization();
    presetOptimizations.applyPresetPromptCodeMirrorEditorOptimization();
    presetOptimizations.applyPresetSaveOptimization();
    applyRegexQuickOperationOptimization();
    chatOptimizations.applyWelcomeRecentChatDirectOpenOptimization();
    chatOptimizations.applyChatDeleteEditFlowOptimization();
    applyTranslateMessageUpdatedOptimization();
    chatOptimizations.applyLongChatDomRenderOptimization();
    chatOptimizations.applyMobileAutoKeyboardSuppression();
    chatOptimizations.applyMobileMessageEditScrollGuard();
    chatOptimizations.applyMessageTripleClickEdit();
    chatOptimizations.applyMessageCompletionSound();
}

function applyCustomCssInputOptimization() {
    if (settings.customCssShadowPropertyEnabled) {
        installCustomCssShadowPropertyOptimization();
    } else {
        removeCustomCssShadowPropertyOptimization();
    }

    if (settings.customCssInputOptimizationEnabled) {
        installCustomCssInputOptimization();
        installCustomCssCodeMirrorEditorOptimization();
    } else {
        removeCustomCssCodeMirrorEditorOptimization();
        removeCustomCssInputOptimization();
    }
}

function installCustomCssShadowPropertyOptimization() {
    if (extensionState.customCssShadowPropertyInstalled) {
        return;
    }

    const input = document.getElementById(CUSTOM_CSS_INPUT_ID);
    if (!(input instanceof HTMLTextAreaElement)) {
        return;
    }

    const originalDescriptor = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value');
    if (!originalDescriptor || typeof originalDescriptor.get !== 'function' || typeof originalDescriptor.set !== 'function') {
        return;
    }

    let virtualValue = input.value || '';

    // Store original so we can restore later
    extensionState.customCssOriginalValueDescriptor = originalDescriptor;

    Object.defineProperty(input, 'value', {
        get: function () {
            return virtualValue;
        },
        set: function (newValue) {
            virtualValue = String(newValue);
            // Intentionally DO NOT call original setter to prevent DOM rendering
        },
        configurable: true,
        enumerable: true
    });

    extensionState.customCssShadowPropertyInstalled = true;
    console.debug(`${LOG_PREFIX} Custom CSS shadow property optimization installed`);
}

function removeCustomCssShadowPropertyOptimization() {
    if (!extensionState.customCssShadowPropertyInstalled) {
        return;
    }

    const input = document.getElementById(CUSTOM_CSS_INPUT_ID);
    const originalDescriptor = extensionState.customCssOriginalValueDescriptor;

    if (input instanceof HTMLTextAreaElement && originalDescriptor) {
        // Restore actual value to DOM before removing interception
        const currentValue = input.value;
        Object.defineProperty(input, 'value', originalDescriptor);
        input.value = currentValue;
    }

    extensionState.customCssOriginalValueDescriptor = null;
    extensionState.customCssShadowPropertyInstalled = false;
    console.debug(`${LOG_PREFIX} Custom CSS shadow property optimization removed`);
}

function installCustomCssInputOptimization() {
    if (extensionState[CUSTOM_CSS_INPUT_OPTIMIZATION_KEY]) {
        return;
    }

    const inputHandler = (event) => {
        const input = getCustomCssInputFromEvent(event);

        if (!input) {
            return;
        }

        event.stopImmediatePropagation();

        if (event.isComposing || extensionState.customCssInputComposing || extensionState.customCssInputCompositionCommitPending) {
            return;
        }

        const codeMirrorSynced = syncCustomCssCodeMirrorFromExternalSource(input);

        commitCustomCssInputValue(input);

        if (codeMirrorSynced || !event.isTrusted) {
            flushCustomCssApply();
        }
    };
    const compositionStartHandler = (event) => {
        if (getCustomCssInputFromEvent(event)) {
            clearCustomCssCompositionEndTimer();
            extensionState.customCssInputComposing = true;
            extensionState.customCssInputCompositionCommitPending = false;
        }
    };
    const compositionEndHandler = (event) => {
        const input = getCustomCssInputFromEvent(event);

        if (!input) {
            return;
        }

        clearCustomCssCompositionEndTimer();
        extensionState.customCssInputCompositionCommitPending = true;
        extensionState.customCssCompositionEndTimer = setTimeout(() => {
            extensionState.customCssCompositionEndTimer = null;
            extensionState.customCssInputComposing = false;
            extensionState.customCssInputCompositionCommitPending = false;
            syncCustomCssCodeMirrorFromExternalSource(input);
            commitCustomCssInputValue(input);
        }, 0);
    };
    const flushHandler = (event) => {
        const input = getCustomCssInputFromEvent(event);

        if (input) {
            extensionState.customCssInputComposing = false;
            extensionState.customCssInputCompositionCommitPending = false;
            clearCustomCssCompositionEndTimer();
            commitCustomCssInputValue(input);
            flushCustomCssApply();
        }
    };
    const pageLifecycleHandler = () => {
        flushCurrentCustomCssInput();
    };

    document.addEventListener('input', inputHandler, true);
    document.addEventListener('compositionstart', compositionStartHandler, true);
    document.addEventListener('compositionend', compositionEndHandler, true);
    document.addEventListener('change', flushHandler, true);
    document.addEventListener('blur', flushHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);

    extensionState[CUSTOM_CSS_INPUT_OPTIMIZATION_KEY] = {
        inputHandler,
        compositionStartHandler,
        compositionEndHandler,
        flushHandler,
        pageLifecycleHandler,
    };
}

function removeCustomCssInputOptimization() {
    const state = extensionState[CUSTOM_CSS_INPUT_OPTIMIZATION_KEY];

    if (!state) {
        return;
    }

    flushCurrentCustomCssInput();
    clearCustomCssCompositionEndTimer();
    extensionState.customCssInputComposing = false;
    extensionState.customCssInputCompositionCommitPending = false;
    document.removeEventListener('input', state.inputHandler, true);
    document.removeEventListener('compositionstart', state.compositionStartHandler, true);
    document.removeEventListener('compositionend', state.compositionEndHandler, true);
    document.removeEventListener('change', state.flushHandler, true);
    document.removeEventListener('blur', state.flushHandler, true);
    window.removeEventListener('pagehide', state.pageLifecycleHandler);
    document.removeEventListener('visibilitychange', state.pageLifecycleHandler);
    delete extensionState[CUSTOM_CSS_INPUT_OPTIMIZATION_KEY];
}

function getCustomCssInputFromEvent(event) {
    const target = event.target;

    if (!(target instanceof HTMLTextAreaElement) || target.id !== CUSTOM_CSS_INPUT_ID) {
        return null;
    }

    return target;
}

function commitCustomCssInputValue(input) {
    if (!(input instanceof HTMLTextAreaElement) || input.id !== CUSTOM_CSS_INPUT_ID) {
        return;
    }

    power_user.custom_css = String(input.value);
    saveSettingsDebounced();
}

function clearCustomCssCompositionEndTimer() {
    if (extensionState.customCssCompositionEndTimer) {
        clearTimeout(extensionState.customCssCompositionEndTimer);
        extensionState.customCssCompositionEndTimer = null;
    }
}

function flushCustomCssApply() {
    applyCustomCssStyleText();
}

function flushCurrentCustomCssInput() {
    if (flushCustomCssCodeMirrorEditor('current input flush', { apply: true, save: true })) {
        return;
    }

    const input = document.getElementById(CUSTOM_CSS_INPUT_ID);

    if (input instanceof HTMLTextAreaElement) {
        extensionState.customCssInputComposing = false;
        extensionState.customCssInputCompositionCommitPending = false;
        clearCustomCssCompositionEndTimer();
        commitCustomCssInputValue(input);
    }

    flushCustomCssApply();
}

function applyCustomCssStyleText() {
    let style = document.getElementById(CUSTOM_CSS_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.type = 'text/css';
        style.id = CUSTOM_CSS_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = power_user.custom_css;
}

function installCustomCssCodeMirrorEditorOptimization() {
    const state = getCustomCssCodeMirrorEditorState();
    state.enabled = true;

    applyCustomCssCodeMirrorEditorStyle();
    installCustomCssCodeMirrorEditorGlobalListeners(state);
    refreshCustomCssCodeMirrorEditorTarget(state);
    installCustomCssCodeMirrorEditorMutationObserver(state);
}

function removeCustomCssCodeMirrorEditorOptimization() {
    const state = extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY];

    if (!state) {
        return;
    }

    flushCustomCssCodeMirrorEditor('disable', { apply: true, save: true });
    state.enabled = false;

    if (state.refreshFrame) {
        cancelAnimationFrame(state.refreshFrame);
        state.refreshFrame = 0;
    }

    state.mutationObserver?.disconnect();
    state.mutationObserver = null;
    detachCustomCssCodeMirrorEditor(state);

    for (const listener of state.globalListeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.globalListeners = [];
    removeCustomCssCodeMirrorEditorStyle();
    delete extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY];
}

function getCustomCssCodeMirrorEditorState() {
    if (!extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY]) {
        extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY] = {
            enabled: false,
            source: null,
            wrapper: null,
            view: null,
            listeners: [],
            globalListeners: [],
            mutationObserver: null,
            refreshFrame: 0,
            dirty: false,
            flushing: false,
            syncingFromSource: false,
            loadingToken: null,
            colorScheme: 'light',
        };
    }

    return extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY];
}

function installCustomCssCodeMirrorEditorGlobalListeners(state) {
    if (state.globalListeners.length > 0) {
        return;
    }

    const clickHandler = (event) => {
        const target = event.target;

        if (!(target instanceof Element)) {
            return;
        }

        if (target.closest(CUSTOM_CSS_CODEMIRROR_EXTERNAL_READ_SELECTOR)) {
            syncCustomCssCodeMirrorToSourceForExternalRead(state);
        }

        const nativeScrollButton = target.closest('#native-btn-scroll-new');

        if (nativeScrollButton instanceof HTMLElement) {
            scrollCustomCssCodeMirrorForNativeToolbar(state, nativeScrollButton);
        }

        const nativeSearchItem = target.closest('#native-search-dropdown-new .vce-search-item-new');

        if (nativeSearchItem instanceof HTMLElement) {
            selectCustomCssCodeMirrorNativeSearchResultAfterThemeEditor(state, nativeSearchItem);
        }

        if (target.closest('#vce-css-inject-toggle')) {
            setTimeout(() => {
                syncCustomCssCodeMirrorThemeEditorHeight(state);
            }, 0);
        }

        if (target.closest(`.editor_maximize[data-for="${CUSTOM_CSS_INPUT_ID}"]`)) {
            flushCustomCssCodeMirrorEditor('maximize click', { apply: true, save: true });
            scheduleCustomCssCodeMirrorEditorRefresh(state);
        }
    };
    const pageLifecycleHandler = () => {
        flushCustomCssCodeMirrorEditor('page lifecycle', { apply: true, save: true });
    };

    document.addEventListener('click', clickHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);

    state.globalListeners.push(
        { target: document, type: 'click', handler: clickHandler, options: true },
        { target: window, type: 'pagehide', handler: pageLifecycleHandler, options: undefined },
        { target: document, type: 'visibilitychange', handler: pageLifecycleHandler, options: undefined },
    );
}

function installCustomCssCodeMirrorEditorMutationObserver(state) {
    if (state.mutationObserver || typeof MutationObserver !== 'function') {
        return;
    }

    const root = document.body || document.documentElement;

    if (!root) {
        return;
    }

    state.mutationObserver = new MutationObserver((mutations) => {
        if (areCustomCssCodeMirrorMutationsInternal(state, mutations)) {
            return;
        }

        scheduleCustomCssCodeMirrorEditorRefresh(state);
    });
    state.mutationObserver.observe(root, { childList: true, subtree: true });
}

function areCustomCssCodeMirrorMutationsInternal(state, mutations) {
    const wrapper = state.wrapper;

    if (!(wrapper instanceof HTMLElement)) {
        return false;
    }

    return mutations.every((mutation) => {
        if (mutation.target instanceof Node && wrapper.contains(mutation.target)) {
            return true;
        }

        for (const node of mutation.addedNodes) {
            if (!(node instanceof Node) || !wrapper.contains(node)) {
                return false;
            }
        }

        for (const node of mutation.removedNodes) {
            if (!(node instanceof Node) || !wrapper.contains(node)) {
                return false;
            }
        }

        return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
    });
}

function scheduleCustomCssCodeMirrorEditorRefresh(state = extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY]) {
    if (!state?.enabled || state.refreshFrame) {
        return;
    }

    state.refreshFrame = requestAnimationFrame(() => {
        state.refreshFrame = 0;
        refreshCustomCssCodeMirrorEditorTarget(state);
    });
}

function refreshCustomCssCodeMirrorEditorTarget(state) {
    if (!state?.enabled) {
        return;
    }

    const source = getCustomCssCodeMirrorSource();

    if (!(source instanceof HTMLTextAreaElement) || !source.isConnected) {
        flushCustomCssCodeMirrorEditor('target removed', { apply: true, save: true });
        detachCustomCssCodeMirrorEditor(state);
        return;
    }

    if (state.source === source && state.wrapper?.isConnected) {
        updateCustomCssCodeMirrorSourceClasses(state, source, state.wrapper);
        updateCustomCssCodeMirrorColorScheme(state, source, state.wrapper);
        syncCustomCssCodeMirrorFromSourceIfClean(state);
        return;
    }

    flushCustomCssCodeMirrorEditor('target switch', { apply: true, save: true });
    detachCustomCssCodeMirrorEditor(state);
    attachCustomCssCodeMirrorEditor(state, source);
}

function getCustomCssCodeMirrorSource() {
    const maximizedSource = document.querySelector(CUSTOM_CSS_MAXIMIZED_SOURCE_SELECTOR);

    if (maximizedSource instanceof HTMLTextAreaElement && maximizedSource.isConnected) {
        return maximizedSource;
    }

    return document.getElementById(CUSTOM_CSS_INPUT_ID);
}

function attachCustomCssCodeMirrorEditor(state, source) {
    const wrapper = document.createElement('div');

    wrapper.id = CUSTOM_CSS_CODEMIRROR_EDITOR_ID;
    wrapper.className = CUSTOM_CSS_CODEMIRROR_EDITOR_CLASS;
    wrapper.textContent = 'Loading CodeMirror...';
    updateCustomCssCodeMirrorSourceClasses(state, source, wrapper);
    updateCustomCssCodeMirrorColorScheme(state, source, wrapper);
    source.classList.add(CUSTOM_CSS_SOURCE_HIDDEN_CLASS);
    source.parentElement?.classList.add(CUSTOM_CSS_HOST_CLASS);
    if (!isCustomCssCodeMirrorMaximizedSource(source)) {
        source.closest('#UI-Customization')?.classList.add(CUSTOM_CSS_LAYOUT_CLASS);
    }
    source.insertAdjacentElement('afterend', wrapper);

    state.source = source;
    state.wrapper = wrapper;
    state.dirty = false;
    syncCustomCssCodeMirrorThemeEditorHeight(state);

    const focusOutHandler = () => {
        setTimeout(() => {
            if (state.dirty && state.wrapper && !state.wrapper.contains(document.activeElement)) {
                flushCustomCssCodeMirrorEditor('blur', { apply: true, save: true });
            }
        }, 0);
    };

    const stopPropagationHandler = (event) => {
        event.stopPropagation();
    };

    wrapper.addEventListener('mousedown', stopPropagationHandler);
    wrapper.addEventListener('pointerdown', stopPropagationHandler);
    wrapper.addEventListener('click', stopPropagationHandler);
    wrapper.addEventListener('focusout', focusOutHandler);

    state.listeners.push(
        { target: wrapper, type: 'mousedown', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'pointerdown', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'click', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'focusout', handler: focusOutHandler, options: undefined }
    );

    const loadingToken = {};
    state.loadingToken = loadingToken;

    void loadDescriptionCodeMirrorModules()
        .then((modules) => {
            if (!state.enabled || state.source !== source || state.wrapper !== wrapper || state.loadingToken !== loadingToken || !wrapper.isConnected) {
                return;
            }

            createCustomCssCodeMirrorView(state, source, wrapper, modules);
        })
        .catch((error) => {
            console.warn(`${LOG_PREFIX} CodeMirror custom CSS editor failed; falling back to stock textarea.`, error);

            if (state.enabled && state.source === source && state.wrapper === wrapper && state.loadingToken === loadingToken) {
                state.enabled = false;
                detachCustomCssCodeMirrorEditor(state);
                removeCustomCssCodeMirrorEditorStyle();
            }
        });
}

function updateCustomCssCodeMirrorColorScheme(state, source, wrapper) {
    const colorScheme = detectCustomCssCodeMirrorColorScheme(source);

    state.colorScheme = colorScheme;
    wrapper.classList.toggle(CUSTOM_CSS_DARK_THEME_CLASS, colorScheme === 'dark');
    wrapper.classList.toggle(CUSTOM_CSS_LIGHT_THEME_CLASS, colorScheme !== 'dark');
    wrapper.dataset.colorScheme = colorScheme;

    return colorScheme;
}

function updateCustomCssCodeMirrorSourceClasses(state, source, wrapper) {
    wrapper.classList.toggle(CUSTOM_CSS_MAXIMIZED_CLASS, isCustomCssCodeMirrorMaximizedSource(source));
}

function isCustomCssCodeMirrorMaximizedSource(source) {
    return source instanceof HTMLTextAreaElement && source.matches(CUSTOM_CSS_MAXIMIZED_SOURCE_SELECTOR);
}

function getCustomCssOriginalInput() {
    const input = document.getElementById(CUSTOM_CSS_INPUT_ID);

    return input instanceof HTMLTextAreaElement ? input : null;
}

function detectCustomCssCodeMirrorColorScheme(source) {
    const background = getElementBlendedBackgroundColor(source);
    const luminance = getRelativeColorLuminance(background);

    return luminance < CUSTOM_CSS_DARK_BACKGROUND_LUMINANCE_THRESHOLD ? 'dark' : 'light';
}

function getElementBlendedBackgroundColor(element) {
    const elements = [];

    for (let current = element; current instanceof Element; current = current.parentElement) {
        elements.push(current);
    }

    let blended = { r: 255, g: 255, b: 255, a: 1 };

    for (const current of elements.reverse()) {
        const background = parseCssRgbColor(getComputedStyle(current).backgroundColor);

        if (background?.a > 0) {
            blended = blendColors(background, blended);
        }
    }

    return blended;
}

function parseCssRgbColor(value) {
    if (!value || value === 'transparent') {
        return null;
    }

    const match = value.match(/^rgba?\((.+)\)$/i);

    if (!match) {
        return null;
    }

    const parts = match[1]
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (parts.length < 3) {
        return null;
    }

    const readChannel = (part) => {
        if (part.endsWith('%')) {
            return Math.max(0, Math.min(255, (Number.parseFloat(part) / 100) * 255));
        }

        return Math.max(0, Math.min(255, Number.parseFloat(part)));
    };
    const alpha = parts.length >= 4 ? Number.parseFloat(parts[3]) : 1;

    return {
        r: readChannel(parts[0]),
        g: readChannel(parts[1]),
        b: readChannel(parts[2]),
        a: Number.isFinite(alpha) ? Math.max(0, Math.min(1, alpha)) : 1,
    };
}

function blendColors(foreground, background) {
    const alpha = foreground.a + background.a * (1 - foreground.a);

    if (alpha <= 0) {
        return { r: 255, g: 255, b: 255, a: 1 };
    }

    return {
        r: (foreground.r * foreground.a + background.r * background.a * (1 - foreground.a)) / alpha,
        g: (foreground.g * foreground.a + background.g * background.a * (1 - foreground.a)) / alpha,
        b: (foreground.b * foreground.a + background.b * background.a * (1 - foreground.a)) / alpha,
        a: alpha,
    };
}

function getRelativeColorLuminance(color) {
    const normalize = (channel) => {
        const value = channel / 255;

        return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
    };

    return 0.2126 * normalize(color.r) + 0.7152 * normalize(color.g) + 0.0722 * normalize(color.b);
}

function createCustomCssCodeMirrorView(state, source, wrapper, modules) {
    const {
        EditorState,
        EditorView,
        keymap,
        defaultKeymap = [],
        history,
        historyKeymap = [],
        css,
        defaultHighlightStyle,
        HighlightStyle,
        syntaxHighlighting,
        classHighlighter,
        tags,
        oneDarkHighlightStyle,
    } = modules;
    const useHistory = source.value.length <= DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH;
    const colorScheme = updateCustomCssCodeMirrorColorScheme(state, source, wrapper);
    const highlightExtension = getCustomCssHighlightExtension({
        colorScheme,
        defaultHighlightStyle,
        HighlightStyle,
        syntaxHighlighting,
        classHighlighter,
        tags,
        oneDarkHighlightStyle,
    });

    const extensions = [
        EditorView.lineWrapping,
        ...(typeof css === 'function' ? [css()] : []),
        ...(highlightExtension ? [highlightExtension] : []),
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                if (state.syncingFromSource) {
                    return;
                }

                state.dirty = true;
                syncCustomCssCodeMirrorToSource(state);
            }
        }),
        EditorView.domEventHandlers({
            beforeinput(event) {
                event.stopPropagation();
                return false;
            },
            input(event) {
                event.stopPropagation();
                return false;
            },
            compositionstart(event) {
                event.stopPropagation();
                return false;
            },
            compositionupdate(event) {
                event.stopPropagation();
                return false;
            },
            compositionend(event) {
                event.stopPropagation();
                return false;
            },
            keydown(event) {
                event.stopPropagation();
                return false;
            },
            keyup(event) {
                event.stopPropagation();
                return false;
            },
            click(event) {
                event.stopPropagation();
                return false;
            },
            mousedown(event) {
                event.stopPropagation();
                return false;
            },
            pointerdown(event) {
                event.stopPropagation();
                return false;
            },
            scroll() {
                return false;
            },
        }),
        EditorView.theme({
            '&': {
                backgroundColor: 'var(--SmartThemeBlurTintColor)',
                border: '1px solid var(--SmartThemeBorderColor)',
                borderRadius: '4px',
                boxSizing: 'border-box',
                color: 'var(--SmartThemeBodyColor)',
                font: 'inherit',
                maxWidth: '100%',
                minHeight: '180px',
                minWidth: '0',
                overflow: 'hidden',
                textShadow: 'none',
                textAlign: 'left',
                width: '100%',
            },
            '&.cm-focused': {
                outline: 'none',
            },
            '.cm-scroller': {
                fontFamily: 'var(--monoFontFamily, monospace)',
                fontSize: '0.95em',
                lineHeight: '1.35',
                maxWidth: '100%',
                maxHeight: '55vh',
                minHeight: '180px',
                minWidth: '0',
                overflow: 'auto',
                overflowAnchor: 'none',
                overscrollBehavior: 'auto',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
            },
            '.cm-content': {
                caretColor: 'var(--SmartThemeBodyColor)',
                minWidth: '0',
                padding: '8px',
                textShadow: 'none',
                textAlign: 'left',
                minHeight: '180px',
            },
            '.cm-line': {
                padding: '0',
                textAlign: 'left',
            },
        }, { dark: colorScheme === 'dark' }),
    ];

    if (useHistory && typeof history === 'function') {
        extensions.push(history());
    }

    if (typeof keymap?.of === 'function') {
        extensions.push(keymap.of(useHistory ? [...defaultKeymap, ...historyKeymap] : defaultKeymap));
    }

    if (EditorView.contentAttributes?.of) {
        extensions.push(EditorView.contentAttributes.of({
            autocomplete: 'off',
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false',
            'aria-label': '自定义 CSS',
        }));
    }

    wrapper.textContent = '';
    state.view = new EditorView({
        state: EditorState.create({
            doc: source.value || '',
            extensions,
        }),
        parent: wrapper,
    });
    syncCustomCssCodeMirrorThemeEditorHeight(state);
}

function getCustomCssHighlightExtension({ colorScheme, defaultHighlightStyle, HighlightStyle, syntaxHighlighting, classHighlighter, tags, oneDarkHighlightStyle }) {
    if (typeof syntaxHighlighting !== 'function') {
        return null;
    }

    if (classHighlighter) {
        return syntaxHighlighting(classHighlighter, { fallback: true });
    }

    if (colorScheme === 'dark' && oneDarkHighlightStyle) {
        return syntaxHighlighting(oneDarkHighlightStyle, { fallback: true });
    }

    if (defaultHighlightStyle) {
        return syntaxHighlighting(defaultHighlightStyle, { fallback: true });
    }

    if (typeof HighlightStyle !== 'function' || !tags) {
        return null;
    }

    const rules = [];
    const add = (tag, style) => {
        if (Array.isArray(tag)) {
            const existingTags = tag.filter(Boolean);
            if (existingTags.length) {
                rules.push({ tag: existingTags, ...style });
            }
        } else if (tag) {
            rules.push({ tag, ...style });
        }
    };
    const derivedTag = (derive, baseTag) => (typeof derive === 'function' && baseTag ? derive(baseTag) : null);

    add(tags.meta, { color: '#404740' });
    add(tags.link, { textDecoration: 'underline' });
    add(tags.heading, { textDecoration: 'underline', fontWeight: 'bold' });
    add(tags.emphasis, { fontStyle: 'italic' });
    add(tags.strong, { fontWeight: 'bold' });
    add(tags.strikethrough, { textDecoration: 'line-through' });
    add(tags.keyword, { color: '#708' });
    add([tags.atom, tags.bool, tags.url, tags.contentSeparator, tags.labelName], { color: '#219' });
    add([tags.literal, tags.inserted], { color: '#164' });
    add([tags.string, tags.deleted], { color: '#a11' });
    add([tags.regexp, tags.escape, derivedTag(tags.special, tags.string)], { color: '#e40' });
    add(derivedTag(tags.definition, tags.variableName), { color: '#00f' });
    add(derivedTag(tags.local, tags.variableName), { color: '#30a' });
    add([tags.typeName, tags.namespace], { color: '#085' });
    add(tags.className, { color: '#167' });
    add([derivedTag(tags.special, tags.variableName), tags.macroName], { color: '#256' });
    add(derivedTag(tags.definition, tags.propertyName), { color: '#00c' });
    add(tags.comment, { color: '#940' });
    add(tags.invalid, { color: '#f00' });

    return syntaxHighlighting(HighlightStyle.define(rules), { fallback: true });
}

function detachCustomCssCodeMirrorEditor(state) {
    if (!state.source && !state.wrapper && !state.view) {
        return;
    }

    for (const listener of state.listeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.listeners = [];
    state.view?.destroy?.();
    state.source?.classList.remove(CUSTOM_CSS_SOURCE_HIDDEN_CLASS);
    state.source?.parentElement?.classList.remove(CUSTOM_CSS_HOST_CLASS);
    state.source?.closest('#UI-Customization')?.classList.remove(CUSTOM_CSS_LAYOUT_CLASS);
    state.wrapper?.remove();
    state.source = null;
    state.wrapper = null;
    state.view = null;
    state.dirty = false;
    state.syncingFromSource = false;
    state.loadingToken = null;
}

function getCustomCssCodeMirrorValue(state) {
    return state.view?.state?.doc?.toString?.() ?? '';
}

function getCustomCssCodeMirrorScroller(state) {
    return state.view?.scrollDOM || state.wrapper?.querySelector?.('.cm-scroller') || null;
}

function syncCustomCssCodeMirrorToSourceForExternalRead(state = extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY]) {
    if (!state?.enabled || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    return syncCustomCssCodeMirrorToSource(state);
}

function scrollCustomCssCodeMirrorForNativeToolbar(state, button) {
    if (!state?.enabled || !state.view) {
        return;
    }

    const scroller = getCustomCssCodeMirrorScroller(state);

    if (!(scroller instanceof HTMLElement)) {
        return;
    }

    const shouldScrollUp = button.querySelector('i')?.classList.contains('fa-arrow-up');
    const targetTop = shouldScrollUp ? 0 : scroller.scrollHeight;
    const diff = targetTop - scroller.scrollTop;

    if (Math.abs(diff) > 400) {
        scroller.scrollTop = diff > 0 ? targetTop - 400 : targetTop + 400;
    }

    scroller.scrollTo({
        top: targetTop,
        behavior: 'smooth',
    });
}

function selectCustomCssCodeMirrorNativeSearchResultAfterThemeEditor(state, item) {
    if (!state?.enabled || !state.view) {
        return;
    }

    const lineIndex = Number.parseInt(item.dataset.line || '', 10);

    if (!Number.isFinite(lineIndex) || lineIndex < 0) {
        return;
    }

    const query = String(document.getElementById('native-css-search-new')?.value || '');

    setTimeout(() => {
        selectCustomCssCodeMirrorNativeSearchResult(state, lineIndex, query);
    }, 0);
}

function selectCustomCssCodeMirrorNativeSearchResult(state, lineIndex, query) {
    if (!state?.enabled || !state.view) {
        return false;
    }

    const doc = state.view.state.doc;
    const lineNumber = Math.min(Math.max(lineIndex + 1, 1), doc.lines);
    const line = doc.line(lineNumber);
    const matchIndex = query ? line.text.toLowerCase().indexOf(query.toLowerCase()) : -1;
    const anchor = line.from + Math.max(matchIndex, 0);
    const head = matchIndex >= 0 ? Math.min(anchor + query.length, line.to) : anchor;

    state.view.focus();
    state.view.dispatch({
        selection: {
            anchor,
            head,
        },
        scrollIntoView: true,
    });

    return true;
}

function syncCustomCssCodeMirrorThemeEditorHeight(state) {
    if (!(state?.wrapper instanceof HTMLElement)) {
        return;
    }

    const heightValue = document.getElementById('vce-custom-css-height-inject') ? '60dvh' : '';
    const editor = state.wrapper.querySelector('.cm-editor');
    const scroller = getCustomCssCodeMirrorScroller(state);

    for (const element of [state.wrapper, editor, scroller]) {
        if (element instanceof HTMLElement) {
            element.style.minHeight = heightValue;
        }
    }

    if (scroller instanceof HTMLElement) {
        scroller.style.maxHeight = heightValue;
    }
}

function syncCustomCssCodeMirrorToSource(state) {
    if (!(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    const value = getCustomCssCodeMirrorValue(state);
    const sourceChanged = state.source.value !== value;
    let originalChanged = false;
    const settingsChanged = power_user.custom_css !== value;

    if (sourceChanged) {
        state.source.value = value;
    }

    if (isCustomCssCodeMirrorMaximizedSource(state.source)) {
        const originalInput = getCustomCssOriginalInput();
        originalChanged = Boolean(originalInput && originalInput.value !== value);

        if (originalChanged) {
            originalInput.value = value;
        }
    }

    if (settingsChanged) {
        power_user.custom_css = value;
    }

    return sourceChanged || originalChanged || settingsChanged;
}

function syncCustomCssCodeMirrorFromExternalSource(source) {
    const state = extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY];

    if (!state?.enabled || state.source !== source || !state.view) {
        return false;
    }

    return syncCustomCssCodeMirrorFromSource(state, { force: true });
}

function syncCustomCssCodeMirrorFromSourceIfClean(state) {
    return syncCustomCssCodeMirrorFromSource(state, { force: false });
}

function syncCustomCssCodeMirrorFromSource(state, { force = false } = {}) {
    if ((!force && state.dirty) || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return;
    }

    const value = state.source.value || '';
    const current = getCustomCssCodeMirrorValue(state);

    if (current !== value) {
        state.syncingFromSource = true;

        try {
            state.view.dispatch({
                changes: {
                    from: 0,
                    to: state.view.state.doc.length,
                    insert: value,
                },
            });
            state.dirty = false;
        } finally {
            state.syncingFromSource = false;
        }

        return true;
    }

    state.dirty = false;

    return false;
}

function flushCustomCssCodeMirrorEditor(reason, { apply = false, save = true } = {}) {
    const state = extensionState[CUSTOM_CSS_CODEMIRROR_EDITOR_KEY];

    if (!state?.enabled || state.flushing || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    state.flushing = true;

    try {
        const changed = syncCustomCssCodeMirrorToSource(state) || state.dirty;
        state.dirty = false;

        if (changed && save) {
            saveSettingsDebounced();
            console.debug(`${LOG_PREFIX} CodeMirror custom CSS editor flushed after ${reason}`);
        }

        if (apply) {
            flushCustomCssApply();
        }

        return changed;
    } finally {
        state.flushing = false;
    }
}

function applyCustomCssCodeMirrorEditorStyle() {
    let style = document.getElementById(CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} {
    box-sizing: border-box;
    display: block;
    flex: 1 1 auto;
    max-width: 100%;
    min-width: 0;
    overflow: hidden;
    width: 100%;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_MAXIMIZED_CLASS} {
    height: 100%;
    min-height: 0;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_MAXIMIZED_CLASS} .cm-editor,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_MAXIMIZED_CLASS} .cm-scroller {
    height: 100%;
    max-height: none !important;
    min-height: 0 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID},
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} .cm-editor,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} .cm-scroller,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} .cm-content,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} .cm-line {
    text-align: left !important;
}

#CustomCSS-textAreaBlock.${CUSTOM_CSS_HOST_CLASS},
#UI-Customization.${CUSTOM_CSS_LAYOUT_CLASS} {
    min-width: 0;
}

#CustomCSS-textAreaBlock.${CUSTOM_CSS_HOST_CLASS} {
    align-items: stretch;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID} .cm-content span {
    color: inherit !important;
    font-family: inherit !important;
    font-size: inherit !important;
    font-style: normal !important;
    font-weight: inherit !important;
    text-decoration: none !important;
    text-shadow: none !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-meta {
    color: #404740 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-link,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-link {
    text-decoration: underline !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-heading {
    font-weight: bold !important;
    text-decoration: underline !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-emphasis,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-emphasis {
    font-style: italic !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-strong,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-strong {
    font-weight: bold !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-strikethrough,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-strikethrough {
    text-decoration: line-through !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-keyword {
    color: #708 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-atom,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-bool,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-url,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-labelName {
    color: #219 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-literal,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-number,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-inserted {
    color: #164 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-string,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-deleted {
    color: #a11 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-string2 {
    color: #e40 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-variableName.tok-definition {
    color: #00f !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-variableName.tok-local {
    color: #30a !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-className {
    color: #167 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-typeName,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-namespace {
    color: #085 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-variableName2,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-macroName {
    color: #256 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-propertyName.tok-definition {
    color: #00c !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-comment {
    color: #940 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-propertyName {
    color: inherit !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-punctuation {
    color: #708 !important;
    font-weight: 600 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_LIGHT_THEME_CLASS} .cm-content .tok-invalid {
    color: #f00 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-keyword {
    color: #c678dd !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-variableName,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-propertyName,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-macroName,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-deleted {
    color: #e06c75 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-labelName {
    color: #61afef !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-literal {
    color: #d19a66 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-variableName.tok-definition,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-propertyName.tok-definition {
    color: #abb2bf !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-typeName,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-className,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-number,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-namespace {
    color: #e5c07b !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-operator,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-url,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-string2 {
    color: #56b6c2 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-meta,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-comment {
    color: #7d8799 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-atom,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-bool,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-variableName2 {
    color: #d19a66 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-string,
#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-inserted {
    color: #98c379 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-link {
    color: #7d8799 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-heading {
    color: #e06c75 !important;
    font-weight: bold !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-punctuation {
    color: #c678dd !important;
    font-weight: 600 !important;
}

#${CUSTOM_CSS_CODEMIRROR_EDITOR_ID}.${CUSTOM_CSS_DARK_THEME_CLASS} .cm-content .tok-invalid {
    color: #ffffff !important;
}

.${CUSTOM_CSS_SOURCE_HIDDEN_CLASS} {
    display: none !important;
}
`;
}

function removeCustomCssCodeMirrorEditorStyle() {
    document.getElementById(CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID)?.remove();
}

function applyRegexQuickOperationOptimization() {
    if (settings.regexQuickOperationOptimizationEnabled) {
        installRegexQuickOperationOptimization();
    } else {
        removeRegexQuickOperationOptimization();
    }
}

function installRegexQuickOperationOptimization() {
    if (!extensionState[REGEX_QUICK_OPERATION_HANDLER_KEY]) {
        const handler = (event) => {
            handleRegexQuickOperationClick(event);
        };

        extensionState[REGEX_QUICK_OPERATION_HANDLER_KEY] = handler;
        document.addEventListener('click', handler, true);
    }

    installRegexVueNativeRenderGuard();
    installRegexQuickOperationMutationObserver();
    installOptimizedRegexImportHandler();
    installRegexPendingChangesLifecycleGuard();
    installRegexVueManagerActionHandler();
    installRegexVueScopedContextHandler();
    scheduleNativeRegexSortableGuard();
    void installRegexVueManager();
}

function removeRegexQuickOperationOptimization() {
    const handler = extensionState[REGEX_QUICK_OPERATION_HANDLER_KEY];

    if (handler) {
        document.removeEventListener('click', handler, true);
        delete extensionState[REGEX_QUICK_OPERATION_HANDLER_KEY];
    }

    const observer = extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY];

    if (observer) {
        observer.disconnect();
        delete extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY];
    }

    const state = getRegexQuickOperationState();
    clearTimeout(state.nativeSortableGuardTimer);
    state.nativeSortableGuardTimer = null;
    state.nativeSortableGuardRetries = 0;
    state.scriptTemplate = null;
    void flushPendingRegexChatReload();
    removeRegexChatReloadVisibilityWatch();
    removeRegexPendingChangesLifecycleGuard();
    removeRegexVueNativeRenderGuard();
    removeRegexVueScopedContextHandler();
    removeOptimizedRegexImportHandler();
    removeRegexVueManagerActionHandler();
    removeRegexVueManager();
}

function getRegexQuickOperationState() {
    if (!extensionState.regexQuickOperationOptimization || typeof extensionState.regexQuickOperationOptimization !== 'object') {
        extensionState.regexQuickOperationOptimization = {};
    }

    const state = extensionState.regexQuickOperationOptimization;

    if (!(state.scriptTemplate instanceof DocumentFragment)) {
        state.scriptTemplate = null;
    }

    return state;
}

function installRegexPendingChangesLifecycleGuard() {
    if (extensionState[REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY]) {
        return;
    }

    const beforeUnloadHandler = (event) => {
        const state = getRegexQuickOperationState();

        if (!hasPendingRegexChanges() && !state.regexChangesSaveInFlight && !state.regexChangesSavePromise) {
            return;
        }

        void flushPendingRegexChanges().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to flush regex changes before unload`, error);
        });
        event.preventDefault();
        event.returnValue = '';
        return '';
    };

    const pageLifecycleHandler = (event) => {
        if (event?.type === 'visibilitychange' && document.visibilityState !== 'hidden') {
            return;
        }

        if (!hasPendingRegexChanges()) {
            return;
        }

        void flushPendingRegexChanges().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to flush regex changes during page lifecycle event`, error);
        });
    };

    extensionState[REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY] = {
        beforeUnloadHandler,
        pageLifecycleHandler,
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);
}

function removeRegexPendingChangesLifecycleGuard() {
    const entry = extensionState[REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY];

    if (!entry) {
        return;
    }

    window.removeEventListener('beforeunload', entry.beforeUnloadHandler);
    window.removeEventListener('pagehide', entry.pageLifecycleHandler);
    document.removeEventListener('visibilitychange', entry.pageLifecycleHandler);
    delete extensionState[REGEX_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY];
}

function installRegexQuickOperationMutationObserver() {
    if (extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY] || !document.body) {
        return;
    }

    const target = document.querySelector(REGEX_CONTAINER_SELECTOR) ?? document.body;
    const observer = new MutationObserver(() => {
        scheduleNativeRegexSortableGuard();
        scheduleRegexVueManagerSync();
    });

    observer.observe(target, { childList: true, subtree: true });
    extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY] = observer;
}

function installRegexVueManagerActionHandler() {
    if (extensionState[REGEX_VUE_MANAGER_CLICK_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handleRegexVueManagerActionClick(event);
    };

    extensionState[REGEX_VUE_MANAGER_CLICK_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function removeRegexVueManagerActionHandler() {
    const handler = extensionState[REGEX_VUE_MANAGER_CLICK_HANDLER_KEY];

    if (!handler) {
        return;
    }

    document.removeEventListener('click', handler, true);
    delete extensionState[REGEX_VUE_MANAGER_CLICK_HANDLER_KEY];
}

function installRegexVueScopedContextHandler() {
    if (extensionState[REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY]) {
        return;
    }

    const handler = () => {
        syncRegexVueScopedListFromContext();
    };
    const presetHandler = () => {
        syncRegexVuePresetListFromContext();
    };

    extensionState[REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY] = { handler, presetHandler };
    eventSource.on(event_types.CHAT_CHANGED, handler);
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, handler);
    eventSource.on(event_types.PRESET_CHANGED, presetHandler);
    eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, presetHandler);
}

function removeRegexVueScopedContextHandler() {
    const entry = extensionState[REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY];

    if (!entry) {
        return;
    }

    const { handler, presetHandler } = entry;
    eventSource.removeListener(event_types.CHAT_CHANGED, handler);
    eventSource.removeListener(event_types.CHARACTER_PAGE_LOADED, handler);
    eventSource.removeListener(event_types.PRESET_CHANGED, presetHandler);
    eventSource.removeListener(event_types.OAI_PRESET_CHANGED_AFTER, presetHandler);
    delete extensionState[REGEX_VUE_SCOPED_CONTEXT_HANDLER_KEY];
}

function installRegexVueNativeRenderGuard() {
    const jquery = globalThis.jQuery;

    if (extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY] || typeof jquery?.fn !== 'object') {
        if (extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY]) {
            extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY].enabled = true;
        }
        return;
    }

    const originalEmpty = jquery.fn.empty;
    const originalAppend = jquery.fn.append;

    if (typeof originalEmpty !== 'function' || typeof originalAppend !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery empty/append is unavailable; regex Vue native render guard was not installed`);
        return;
    }

    const guard = {
        enabled: true,
        originalEmpty,
        originalAppend,
        patchedEmpty: null,
        patchedAppend: null,
    };

    function patchedEmpty(...args) {
        if (guard.enabled && shouldBlockRegexVueNativeListMutation(this)) {
            return this;
        }

        return originalEmpty.apply(this, args);
    }

    function patchedAppend(...args) {
        if (guard.enabled && shouldBlockRegexVueNativeListMutation(this)) {
            return this;
        }

        return originalAppend.apply(this, args);
    }

    guard.patchedEmpty = patchedEmpty;
    guard.patchedAppend = patchedAppend;
    patchedEmpty.__baiBaiToolkitRegexVueNativeRenderGuard = true;
    patchedAppend.__baiBaiToolkitRegexVueNativeRenderGuard = true;
    patchedEmpty.__baiBaiToolkitOriginalEmpty = originalEmpty;
    patchedAppend.__baiBaiToolkitOriginalAppend = originalAppend;
    Object.assign(patchedEmpty, originalEmpty);
    Object.assign(patchedAppend, originalAppend);
    jquery.fn.empty = patchedEmpty;
    jquery.fn.append = patchedAppend;
    extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY] = guard;
}

function removeRegexVueNativeRenderGuard() {
    const guard = extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY];

    if (!guard) {
        return;
    }

    guard.enabled = false;

    if (globalThis.jQuery?.fn?.empty === guard.patchedEmpty) {
        globalThis.jQuery.fn.empty = guard.originalEmpty;
    }

    if (globalThis.jQuery?.fn?.append === guard.patchedAppend) {
        globalThis.jQuery.fn.append = guard.originalAppend;
    }

    if (globalThis.jQuery?.fn?.empty !== guard.patchedEmpty && globalThis.jQuery?.fn?.append !== guard.patchedAppend) {
        delete extensionState[REGEX_VUE_NATIVE_RENDER_GUARD_KEY];
    }
}

function shouldBlockRegexVueNativeListMutation(collection) {
    if (!settings.regexQuickOperationOptimizationEnabled || !isRegexVueManagerActive()) {
        return false;
    }

    return Array.from(collection ?? []).some(element => isRegexVueOwnedScriptListElement(element));
}

function isRegexVueOwnedScriptListElement(element) {
    return element instanceof HTMLElement
        && ['saved_regex_scripts', 'saved_scoped_scripts', 'saved_preset_scripts'].includes(element.id)
        && element.querySelector(':scope > .bai-bai-regex-vue-list');
}

function handleRegexVueManagerActionClick(event) {
    if (!settings.regexQuickOperationOptimizationEnabled || !isRegexVueManagerActive()) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest(REGEX_CONTAINER_SELECTOR)) {
        return;
    }

    const topAction = target.closest([
        '#open_regex_editor',
        '#open_scoped_editor',
        '#open_preset_editor',
        '#bulk_select_all_toggle',
        '#bulk_enable_regex',
        '#bulk_disable_regex',
        '#bulk_regex_move_to_global',
        '#bulk_regex_move_to_scoped',
        '#bulk_regex_move_to_preset',
        '#bulk_delete_regex',
        '#bulk_export_regex',
    ].join(', '));

    if (!(topAction instanceof HTMLElement)) {
        return;
    }

    preventRegexQuickOperationEvent(event);

    switch (topAction.id) {
        case 'open_regex_editor':
            void openOptimizedRegexEditorForType(REGEX_SCRIPT_TYPES.GLOBAL);
            break;
        case 'open_scoped_editor':
            void openOptimizedRegexEditorForType(REGEX_SCRIPT_TYPES.SCOPED);
            break;
        case 'open_preset_editor':
            void openOptimizedRegexEditorForType(REGEX_SCRIPT_TYPES.PRESET);
            break;
        case 'bulk_select_all_toggle':
            toggleRegexVueBulkSelection();
            break;
        case 'bulk_enable_regex':
            void bulkToggleRegexVueScripts(true);
            break;
        case 'bulk_disable_regex':
            void bulkToggleRegexVueScripts(false);
            break;
        case 'bulk_regex_move_to_global':
            void bulkMoveRegexVueScripts(REGEX_SCRIPT_TYPES.GLOBAL);
            break;
        case 'bulk_regex_move_to_scoped':
            void bulkMoveRegexVueScripts(REGEX_SCRIPT_TYPES.SCOPED);
            break;
        case 'bulk_regex_move_to_preset':
            void bulkMoveRegexVueScripts(REGEX_SCRIPT_TYPES.PRESET);
            break;
        case 'bulk_delete_regex':
            void bulkDeleteRegexVueScripts();
            break;
        case 'bulk_export_regex':
            exportRegexVueSelectedScripts();
            break;
        default:
            break;
    }
}

async function installRegexVueManager() {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const manager = getRegexVueManagerState();

    if (manager.installing) {
        return manager.installing;
    }

    manager.installing = (async () => {
        if (!areRegexVueManagerTargetsReady()) {
            scheduleRegexVueManagerSync(250);
            return;
        }

        installRegexVueManagerStyle();
        disableNativeRegexSortables();

        if (manager.app) {
            if (!areRegexVueManagerTargetsOwned()) {
                reclaimRegexVueManagerTargets();
                scheduleNativeRegexSortableGuard(250);
                return;
            }

            syncRegexVueManagerState();
            scheduleNativeRegexSortableGuard(250);
            return;
        }

        const vue = await loadRegexVueModule();
        const vueDraggableNext = await loadRegexVueDraggableModule();
        manager.vue = vue;
        manager.vueDraggableNext = vueDraggableNext;
        manager.root = ensureRegexVueManagerRoot();
        manager.state = vue.reactive(createRegexVueManagerModel());
        manager.app = vue.createApp(createRegexVueManagerRootComponent(vue, vueDraggableNext, manager.state));

        clearRegexVueManagerTargets();
        manager.app.mount(manager.root);
        syncRegexVueManagerState();
        scheduleNativeRegexSortableGuard(250);
        updateRegexBulkControls();
    })();

    try {
        await manager.installing;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to install regex Vue manager`, error);
        toastr.error(t`Failed to install regex list manager. See console for details.`);

        if (!manager.app) {
            enableNativeRegexSortables();
        }
    } finally {
        manager.installing = null;
    }
}

function removeRegexVueManager() {
    const manager = getRegexVueManagerState();

    clearTimeout(manager.syncTimer);
    manager.syncTimer = null;
    setRegexVueDragCursorActive(false);

    if (manager.app) {
        try {
            manager.app.unmount();
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to unmount regex Vue manager`, error);
        }
    }

    manager.app = null;
    manager.state = null;
    manager.root?.remove();
    manager.root = null;
    manager.installing = null;
    document.getElementById(REGEX_VUE_MANAGER_STYLE_ID)?.remove();
    void restoreRegexRowsAfterVueManagerRemove().finally(() => {
        enableNativeRegexSortables();
    });
}

function getRegexVueManagerState() {
    const state = getRegexQuickOperationState();

    if (!state.vueManager || typeof state.vueManager !== 'object') {
        state.vueManager = {
            app: null,
            root: null,
            state: null,
            vue: null,
            modulePromise: null,
            installing: null,
            syncTimer: null,
            suppressObserver: false,
        };
    }

    return state.vueManager;
}

function isRegexVueManagerActive() {
    return Boolean(getRegexVueManagerState().app && getRegexVueManagerState().state);
}

function areRegexVueManagerTargetsReady() {
    return getRegexScriptListDefinitions().every(({ selector }) => document.querySelector(selector) instanceof HTMLElement);
}

function scheduleRegexVueManagerSync(delayMs = 80) {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const manager = getRegexVueManagerState();

    if (manager.suppressObserver) {
        return;
    }

    clearTimeout(manager.syncTimer);
    manager.syncTimer = setTimeout(() => {
        manager.syncTimer = null;

        if (!areRegexVueManagerTargetsReady()) {
            scheduleRegexVueManagerSync(250);
            return;
        }

        if (isRegexVueManagerActive() && areRegexVueManagerTargetsOwned()) {
            return;
        }

        void installRegexVueManager();
    }, delayMs);
}

async function loadRegexVueModule() {
    const manager = getRegexVueManagerState();

    if (!manager.modulePromise) {
        manager.modulePromise = import(new URL(REGEX_VUE_MANAGER_MODULE_PATH, import.meta.url).href);
    }

    return manager.modulePromise;
}

async function loadRegexVueDraggableModule() {
    const manager = getRegexVueManagerState();

    if (!manager.draggableModulePromise) {
        manager.draggableModulePromise = import(new URL(REGEX_VUE_DRAGGABLE_MODULE_PATH, import.meta.url).href);
    }

    return manager.draggableModulePromise;
}

function ensureRegexVueManagerRoot() {
    let root = document.getElementById(REGEX_VUE_MANAGER_ROOT_ID);

    if (!root) {
        root = document.createElement('div');
        root.id = REGEX_VUE_MANAGER_ROOT_ID;
        root.className = 'displayNone';
        document.querySelector(REGEX_CONTAINER_SELECTOR)?.append(root);
    }

    return root;
}

function clearRegexVueManagerTargets() {
    const manager = getRegexVueManagerState();
    manager.suppressObserver = true;

    try {
        for (const { selector } of getRegexScriptListDefinitions()) {
            const target = document.querySelector(selector);

            if (target instanceof HTMLElement) {
                target.replaceChildren();
            }
        }
    } finally {
        setTimeout(() => {
            manager.suppressObserver = false;
        }, 0);
    }
}

function areRegexVueManagerTargetsOwned() {
    return getRegexScriptListDefinitions().every(({ selector }) => {
        const target = document.querySelector(selector);
        return target instanceof HTMLElement && target.querySelector(':scope > .bai-bai-regex-vue-list');
    });
}

function reclaimRegexVueManagerTargets() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    clearRegexVueManagerTargets();
    manager.state.reclaimKey += 1;
    updateRegexBulkControls();
}

function createRegexVueManagerModel() {
    return {
        renderKey: 0,
        reclaimKey: 0,
        lists: {
            global: createEmptyRegexVueListModel('global'),
            preset: createEmptyRegexVueListModel('preset'),
            scoped: createEmptyRegexVueListModel('scoped'),
        },
        selectedIds: {},
    };
}

function createEmptyRegexVueListModel(typeKey) {
    return {
        typeKey,
        scriptType: getRegexScriptTypeFromKey(typeKey),
        groups: [],
    };
}

function syncRegexVueManagerState() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    manager.state.lists.global = buildRegexVueListModel(REGEX_SCRIPT_TYPES.GLOBAL);
    manager.state.lists.preset = buildRegexVueListModel(REGEX_SCRIPT_TYPES.PRESET);
    manager.state.lists.scoped = buildRegexVueListModel(REGEX_SCRIPT_TYPES.SCOPED);
    pruneRegexVueSelection();
    manager.state.renderKey += 1;
    updateRegexBulkControls();
}

function syncRegexVueScopedListFromContext() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    manager.state.lists.scoped = buildRegexVueListModel(REGEX_SCRIPT_TYPES.SCOPED);
    pruneRegexVueSelection();
    updateRegexBulkControls();
}

function syncRegexVuePresetListFromContext() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    manager.state.lists.preset = buildRegexVueListModel(REGEX_SCRIPT_TYPES.PRESET);
    pruneRegexVueSelection();
    updateRegexBulkControls();
}

async function syncRegexVueManagerAfterDataChange() {
    if (isRegexVueManagerActive()) {
        syncRegexVueManagerState();
    }
}

function buildRegexVueListModel(scriptType) {
    const typeKey = getRegexScriptTypeKey(scriptType);
    const scripts = getRegexScriptsByType(scriptType);
    const groupState = getRegexGroupStateForScriptType(scriptType);
    normalizeRegexGroupState(groupState);

    const groupsById = new Map();
    const realGroups = groupState.groups
        .slice()
        .sort((a, b) => Number(a.order ?? 0) - Number(b.order ?? 0))
        .map(group => ({
            id: group.id,
            name: group.name || t`Unnamed group`,
            collapsed: Boolean(group.collapsed),
            isUngrouped: false,
            scripts: [],
        }));

    for (const group of realGroups) {
        groupsById.set(group.id, group);
    }

    const pendingAssignment = {
        id: REGEX_PENDING_ASSIGNMENT_GROUP_ID,
        name: '',
        collapsed: false,
        isUngrouped: false,
        isPendingAssignment: true,
        scripts: [],
    };

    const ungrouped = {
        id: REGEX_UNGROUPED_GROUP_ID,
        name: getRegexUngroupedGroupDisplayName(groupState.ungrouped?.name),
        collapsed: Boolean(groupState.ungrouped?.collapsed),
        isUngrouped: true,
        isPendingAssignment: false,
        scripts: [],
    };

    for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index];
        const meta = groupState.scripts?.[script?.id] ?? {};
        const targetGroup = meta.groupId === REGEX_PENDING_ASSIGNMENT_GROUP_ID
            ? pendingAssignment
            : groupsById.get(meta.groupId) ?? ungrouped;
        targetGroup.scripts.push({
            script,
            order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : index,
        });
    }

    const groups = [pendingAssignment, ...realGroups, ungrouped]
        .map(group => ({
            ...group,
            scripts: group.scripts
                .sort((a, b) => a.order - b.order)
                .map(item => item.script),
        }))
        .filter(group => !group.isPendingAssignment || group.scripts.length > 0)
        .filter(group => !group.isUngrouped || group.scripts.length > 0 || realGroups.length === 0);

    return {
        typeKey,
        scriptType,
        groups,
    };
}

function createRegexVueManagerRootComponent(vue, vueDraggableNext, model) {
    const { h, Teleport, Transition, Fragment } = vue;

    return {
        name: 'BaiBaiRegexManagerRoot',
        render() {
            return h(Fragment, null, [
                renderRegexVueTeleport(h, vueDraggableNext, Teleport, Transition, model, 'global', '#saved_regex_scripts'),
                renderRegexVueTeleport(h, vueDraggableNext, Teleport, Transition, model, 'preset', '#saved_preset_scripts'),
                renderRegexVueTeleport(h, vueDraggableNext, Teleport, Transition, model, 'scoped', '#saved_scoped_scripts'),
            ]);
        },
    };
}

function renderRegexVueTeleport(h, vueDraggableNext, Teleport, Transition, model, typeKey, selector) {
    return h(Teleport, { to: selector }, [
        renderRegexVueList(h, vueDraggableNext, Transition, model, typeKey),
    ]);
}

function renderRegexVueList(h, vueDraggableNext, Transition, model, typeKey) {
    const list = model.lists[typeKey];
    const scriptCount = list.groups.reduce((count, group) => count + group.scripts.length, 0);
    const children = [
        renderRegexVueListToolbar(h, model, list),
    ];

    if (scriptCount === 0) {
        children.push(h('div', { class: 'bai-bai-regex-empty-list', key: 'empty' }, t`No scripts found`));
    }

    const groupChildren = list.groups.map(group => {
        const showGroupHeader = !group.isPendingAssignment;
        const groupChildren = [];

        if (showGroupHeader) {
            groupChildren.push(renderRegexVueGroupHeader(h, list, group));
        }

        groupChildren.push(renderRegexVueGroupBodyTransition(h, vueDraggableNext, Transition, model, list, group));

        return h('div', {
            class: [
                'bai-bai-regex-group',
                showGroupHeader ? 'bai-bai-regex-group-framed' : '',
                group.isUngrouped ? 'bai-bai-regex-group-ungrouped' : '',
                group.isPendingAssignment ? 'bai-bai-regex-group-pending-assignment' : '',
            ],
            'data-regex-group-id': group.id,
            key: group.id,
        }, groupChildren);
    });

    children.push(h('div', {
        class: 'bai-bai-regex-groups flex-container flexFlowColumn',
        key: 'groups',
    }, groupChildren));

    return h('div', {
        class: 'bai-bai-regex-vue-list flex-container flexFlowColumn',
        'data-regex-type': typeKey,
        key: `${typeKey}-reclaim-${model.reclaimKey}`,
    }, children);
}

function renderRegexVueGroupBodyTransition(h, vueDraggableNext, Transition, model, list, group) {
    return h(Transition, {
        name: 'bai-bai-regex-group-collapse',
        css: false,
        key: `transition-${group.id}`,
        onBeforeEnter: prepareRegexVueGroupBodyEnter,
        onEnter: animateRegexVueGroupBodyEnter,
        onAfterEnter: cleanupRegexVueGroupBodyTransition,
        onEnterCancelled: cleanupRegexVueGroupBodyTransition,
        onBeforeLeave: prepareRegexVueGroupBodyLeave,
        onLeave: animateRegexVueGroupBodyLeave,
        onAfterLeave: cleanupRegexVueGroupBodyTransition,
        onLeaveCancelled: cleanupRegexVueGroupBodyTransition,
    }, {
        default: () => group.collapsed
            ? null
            : renderRegexVueGroupBody(h, vueDraggableNext, model, list, group),
    });
}

function renderRegexVueGroupBody(h, vueDraggableNext, model, list, group) {
    const rowRender = () => group.scripts.map(script => renderRegexVueScriptRow(h, model, list, script));

    return h(vueDraggableNext.VueDraggableNext, {
        class: [
            'bai-bai-regex-group-body flex-container flexFlowColumn',
            group.scripts.length === 0 ? 'bai-bai-regex-group-body-empty' : '',
        ],
        'data-regex-type': list.typeKey,
        'data-regex-group-id': group.id,
        list: group.scripts,
        group: { name: `bai-bai-regex-scripts-${list.typeKey}`, pull: true, put: true },
        draggable: '.regex-script-label',
        handle: '.bai-bai-regex-script-drag-handle',
        itemKey: 'id',
        animation: 0,
        emptyInsertThreshold: 40,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'bai-bai-regex-sortable-fallback',
        ghostClass: 'bai-bai-regex-sortable-ghost',
        chosenClass: 'bai-bai-regex-sortable-chosen',
        dragClass: 'bai-bai-regex-sortable-drag',
        move: event => handleRegexVueScriptDragMove(event, list.typeKey),
        key: `body-${group.id}`,
        onChoose: () => setRegexVueDragCursorActive(true),
        onStart: () => setRegexVueDragCursorActive(true),
        onUnchoose: () => setRegexVueDragCursorActive(false),
        onEnd: () => {
            setRegexVueDragCursorActive(false);
            saveRegexScriptsOrderFromModelSafely(list.typeKey);
        },
    }, { default: rowRender });
}

function renderRegexVueListToolbar(h, model, list) {
    const selectedCount = getRegexVueSelectedCountForList(model, list);
    const hasSelectedScripts = selectedCount > 0;

    return h('div', { class: 'bai-bai-regex-list-toolbar flex-container', key: 'toolbar' }, [
        h('div', {
            class: 'bai-bai-regex-list-toolbar-btn bai-bai-regex-create-group-btn',
            title: t`Create regex group`,
            onClick: () => void createRegexVueGroup(list.scriptType),
        }, [
            h('i', { class: 'fa-solid fa-folder-plus margin-r5' }),
            h('span', null, t`Create Group`),
        ]),
        h('div', {
            class: [
                'bai-bai-regex-list-toolbar-btn',
                'bai-bai-regex-bulk-move-group-btn',
                hasSelectedScripts ? '' : 'disabled',
            ],
            title: hasSelectedScripts
                ? t`将已选正则移动到分组`
                : t`先选择要移动的正则`,
            onClick: () => {
                if (!hasSelectedScripts) {
                    toastr.warning(t`No regex scripts selected for moving.`);
                    return;
                }

                void promptBulkMoveRegexVueSelectedScriptsToGroup(list.scriptType);
            },
        }, [
            h('i', { class: 'fa-solid fa-folder-tree margin-r5' }),
            h('span', null, t`移动到分组...`),
        ]),
    ]);
}

function renderRegexVueGroupHeader(h, list, group) {
    const scriptCount = group.scripts.length;
    const enabledCount = group.scripts.filter(script => !Boolean(script?.disabled ?? false)).length;
    const allDisabled = scriptCount > 0 && enabledCount === 0;
    const realGroupIds = list.groups
        .filter(item => !item.isUngrouped && !item.isPendingAssignment)
        .map(item => item.id);
    const groupIndex = realGroupIds.indexOf(group.id);
    const canMoveGroupUp = groupIndex > 0;
    const canMoveGroupDown = groupIndex >= 0 && groupIndex < realGroupIds.length - 1;

    return h('div', {
        class: ['bai-bai-regex-group-header', 'flex-container', 'flexnowrap', group.collapsed ? 'collapsed' : ''],
        key: `header-${group.id}`,
        onClick: (event) => {
            // Prevent collapsing when clicking on buttons inside the header
            if (event.target.closest('.menu_button, .checkbox, input, label')) {
                return;
            }
            toggleRegexVueGroupCollapsed(list.scriptType, group.id);
        }
    }, [
        h('span', {
            class: ['bai-bai-regex-group-toggle fa-solid fa-chevron-down'],
            title: group.collapsed ? t`Expand` : t`Collapse`,
        }),
        h('div', { class: 'bai-bai-regex-group-title flex-container flex1 overflow-hidden' }, [
            h('strong', { class: 'bai-bai-regex-group-name overflow-hidden', title: group.name }, group.name),
            h('small', { class: 'bai-bai-regex-group-count' }, String(group.scripts.length)),
        ]),
        h('label', {
            class: 'checkbox flex-container margin-r5',
            title: allDisabled ? t`Enable all scripts in group` : t`Disable all scripts in group`,
            onClick: event => event.stopPropagation(),
        }, [
            h('input', {
                type: 'checkbox',
                class: 'disable_regex',
                checked: allDisabled,
                disabled: scriptCount === 0,
                onChange: event => void setRegexVueGroupScriptsDisabled(list.scriptType, group.id, Boolean(event.target?.checked)),
            }),
            h('span', {
                class: 'regex-toggle-on fa-solid fa-toggle-on',
                title: t`Disable all scripts in group`,
                onClick: event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void setRegexVueGroupScriptsDisabled(list.scriptType, group.id, true);
                },
            }),
            h('span', {
                class: 'regex-toggle-off fa-solid fa-toggle-off',
                title: t`Enable all scripts in group`,
                onClick: event => {
                    event.preventDefault();
                    event.stopPropagation();
                    void setRegexVueGroupScriptsDisabled(list.scriptType, group.id, false);
                },
            }),
        ]),
        !group.isUngrouped && h('div', {
            class: ['menu_button', 'bai-bai-regex-group-move-btn', 'fa-solid', 'fa-arrow-up', canMoveGroupUp ? '' : 'disabled'],
            title: canMoveGroupUp ? t`Move group up` : t`Already first group`,
            onClick: event => {
                event.preventDefault();
                event.stopPropagation();
                moveRegexVueGroup(list.scriptType, group.id, -1);
            },
        }),
        !group.isUngrouped && h('div', {
            class: ['menu_button', 'bai-bai-regex-group-move-btn', 'fa-solid', 'fa-arrow-down', canMoveGroupDown ? '' : 'disabled'],
            title: canMoveGroupDown ? t`Move group down` : t`Already last group`,
            onClick: event => {
                event.preventDefault();
                event.stopPropagation();
                moveRegexVueGroup(list.scriptType, group.id, 1);
            },
        }),
        h('div', {
            class: 'menu_button fa-solid fa-pencil',
            title: t`Rename group`,
            onClick: () => void renameRegexVueGroup(list.scriptType, group.id),
        }),
        !group.isUngrouped && h('div', {
            class: 'menu_button fa-solid fa-trash',
            title: t`Delete group`,
            onClick: () => void deleteRegexVueGroup(list.scriptType, group.id),
        }),
    ].filter(Boolean));
}

function renderRegexVueScriptRow(h, model, list, script) {
    const checked = Boolean(model.selectedIds[script.id]);

    return h('div', {
        id: script.id,
        key: script.id,
        class: 'regex-script-label flex-container flexnowrap',
        'data-regex-script-id': script.id,
        'data-regex-type': list.typeKey,
    }, [
        h('input', {
            type: 'checkbox',
            class: 'regex_bulk_checkbox',
            checked,
            onChange: event => setRegexVueScriptSelected(script.id, Boolean(event.target?.checked)),
        }),
        h('span', { class: 'menu-handle bai-bai-regex-script-drag-handle' }, '\u2630'),
        h('div', {
            class: 'regex_script_name flex1 overflow-hidden',
            title: script.scriptName || '',
        }, script.scriptName || ''),
        h('div', { class: 'flex-container flexnowrap' }, [
            h('label', { class: 'checkbox flex-container margin-r5', for: 'regex_disable' }, [
                h('input', {
                    type: 'checkbox',
                    name: 'regex_disable',
                    class: 'disable_regex',
                    checked: Boolean(script.disabled ?? false),
                    onChange: event => void setRegexVueScriptDisabled(list.scriptType, script.id, Boolean(event.target?.checked)),
                }),
                h('span', {
                    class: 'regex-toggle-on fa-solid fa-toggle-on',
                    title: t`Disable script`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void setRegexVueScriptDisabled(list.scriptType, script.id, true);
                    },
                }),
                h('span', {
                    class: 'regex-toggle-off fa-solid fa-toggle-off',
                    title: t`Enable script`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void setRegexVueScriptDisabled(list.scriptType, script.id, false);
                    },
                }),
            ]),
            h('label', { class: 'menu_button regex_script_expand', title: t`Show more options` }, [
                h('input', { type: 'checkbox', name: 'regex_expand' }),
                h('span', { class: 'fa-solid fa-ellipsis' }),
            ]),
            h('div', { class: 'flex-container regex_script_buttons' }, [
                h('div', {
                    class: 'move_to_global menu_button',
                    title: t`Move to global scripts`,
                    onClick: () => void moveRegexVueScriptWithConfirmation(list.scriptType, script.id, REGEX_SCRIPT_TYPES.GLOBAL),
                }, [h('i', { class: 'fa-solid fa-globe' })]),
                h('div', {
                    class: 'move_to_preset menu_button',
                    title: t`Move to preset scripts`,
                    onClick: () => void moveRegexVueScriptWithConfirmation(list.scriptType, script.id, REGEX_SCRIPT_TYPES.PRESET),
                }, [h('i', { class: 'fa-solid fa-sliders' })]),
                h('div', {
                    class: 'move_to_scoped menu_button',
                    title: t`Move to scoped scripts`,
                    onClick: () => void moveRegexVueScriptWithConfirmation(list.scriptType, script.id, REGEX_SCRIPT_TYPES.SCOPED),
                }, [h('i', { class: 'fa-solid fa-address-card' })]),
                h('div', {
                    class: 'export_regex menu_button',
                    title: t`Export script`,
                    onClick: () => exportRegexVueScript(list.scriptType, script.id),
                }, [h('i', { class: 'fa-solid fa-file-export' })]),
            ]),
            h('div', {
                class: 'edit_existing_regex menu_button',
                title: t`Edit script`,
                onClick: () => void openOptimizedRegexEditorById(list.scriptType, script.id),
            }, [h('i', { class: 'fa-solid fa-pencil' })]),
            h('div', {
                class: 'delete_regex menu_button',
                title: t`Delete script`,
                onClick: () => void deleteRegexVueScriptWithConfirmation(list.scriptType, script.id),
            }, [h('i', { class: 'fa-solid fa-trash' })]),
        ]),
    ]);
}

function isRegexVueScriptDragMoveAllowed(event, typeKey) {
    const scriptType = getRegexScriptTypeFromKey(typeKey);
    const draggedScript = event?.draggedContext?.element;
    const to = event?.to;
    const from = event?.from;

    if (scriptType === null || !draggedScript?.id || !(to instanceof HTMLElement) || !(from instanceof HTMLElement)) {
        return false;
    }

    if (!to.matches('.bai-bai-regex-group-body') || !from.matches('.bai-bai-regex-group-body')) {
        return false;
    }

    if (to.dataset.regexType !== typeKey || from.dataset.regexType !== typeKey) {
        return false;
    }

    return getRegexScriptsByType(scriptType).some(script => script?.id === draggedScript.id);
}

function handleRegexVueScriptDragMove(event, typeKey) {
    const allowed = isRegexVueScriptDragMoveAllowed(event, typeKey);

    if (allowed) {
        setRegexVueDropTargetFromList(event?.to);
    } else {
        clearRegexVueDropTarget();
    }

    return allowed;
}

function prepareRegexVueGroupBodyEnter(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    stopRegexVueGroupBodyTransition(element);
    element.style.height = '0px';
    element.style.opacity = '0';
    element.style.overflow = 'hidden';
    element.style.willChange = 'height, opacity';

    // 强制重绘以确保初始状态被应用
    void element.offsetHeight;
}

function animateRegexVueGroupBodyEnter(element, done) {
    if (!(element instanceof HTMLElement)) {
        done();
        return;
    }

    const targetHeight = element.scrollHeight;
    const transition = startRegexVueGroupBodyTransition(element, done);
    if (!transition) {
        return;
    }

    transition.raf = requestAnimationFrame(() => {
        element.style.height = `${targetHeight}px`;
        element.style.opacity = '1';
    });
}

function prepareRegexVueGroupBodyLeave(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    stopRegexVueGroupBodyTransition(element);
    element.style.height = `${element.scrollHeight}px`;
    element.style.opacity = '1';
    element.style.overflow = 'hidden';
    element.style.willChange = 'height, opacity';

    // 强制重绘以确保初始状态被应用
    void element.offsetHeight;
}

function animateRegexVueGroupBodyLeave(element, done) {
    if (!(element instanceof HTMLElement)) {
        done();
        return;
    }

    const transition = startRegexVueGroupBodyTransition(element, done);
    if (!transition) {
        return;
    }

    transition.raf = requestAnimationFrame(() => {
        element.style.height = '0px';
        element.style.opacity = '0';
    });
}

function startRegexVueGroupBodyTransition(element, done) {
    stopRegexVueGroupBodyTransition(element);

    if (shouldSkipRegexVueGroupBodyTransition()) {
        done();
        return null;
    }

    let finished = false;
    const finish = () => {
        if (finished) {
            return;
        }

        finished = true;
        stopRegexVueGroupBodyTransition(element);
        done();
    };

    const onTransitionEnd = event => {
        if (event.target === element && (event.propertyName === 'height' || event.propertyName === 'opacity')) {
            finish();
        }
    };

    const transition = { timer: setTimeout(finish, REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS + 80), onTransitionEnd, raf: 0 };
    element[REGEX_VUE_GROUP_BODY_TRANSITION_KEY] = transition;
    element.addEventListener('transitionend', onTransitionEnd);
    element.style.transition = `height ${REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS}ms ease, opacity ${REGEX_VUE_GROUP_COLLAPSE_ANIMATION_MS}ms ease`;
    return transition;
}

function stopRegexVueGroupBodyTransition(element) {
    const transition = element?.[REGEX_VUE_GROUP_BODY_TRANSITION_KEY];

    if (!transition) {
        return;
    }

    clearTimeout(transition.timer);
    if (transition.raf) {
        cancelAnimationFrame(transition.raf);
    }
    element.removeEventListener('transitionend', transition.onTransitionEnd);
    delete element[REGEX_VUE_GROUP_BODY_TRANSITION_KEY];
}

function cleanupRegexVueGroupBodyTransition(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    stopRegexVueGroupBodyTransition(element);
    element.style.height = '';
    element.style.opacity = '';
    element.style.overflow = '';
    element.style.transition = '';
    element.style.willChange = '';
}

function shouldSkipRegexVueGroupBodyTransition() {
    return globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches === true;
}

function setRegexVueDragCursorActive(active) {
    document.body?.classList.toggle('bai-bai-regex-drag-cursor-active', Boolean(active));

    if (!active) {
        clearRegexVueDropTarget();
    }
}

function setRegexVueDropTargetFromList(listElement) {
    const target = listElement instanceof HTMLElement
        ? listElement.closest('.bai-bai-regex-group')
        : null;
    const currentTarget = document.querySelector(`.${REGEX_VUE_DROP_TARGET_CLASS}`);

    if (currentTarget === target) {
        return;
    }

    clearRegexVueDropTarget();

    if (target instanceof HTMLElement) {
        target.classList.add(REGEX_VUE_DROP_TARGET_CLASS);
    }
}

function clearRegexVueDropTarget() {
    document.querySelectorAll(`.${REGEX_VUE_DROP_TARGET_CLASS}`).forEach(element => {
        element.classList.remove(REGEX_VUE_DROP_TARGET_CLASS);
    });
}

function installRegexVueManagerStyle() {
    if (document.getElementById(REGEX_VUE_MANAGER_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = REGEX_VUE_MANAGER_STYLE_ID;
    style.textContent = `
.bai-bai-regex-vue-list {
    gap: 2px;
}

.bai-bai-regex-groups {
    gap: 2px;
}

.bai-bai-regex-list-toolbar {
    justify-content: stretch;
    margin-bottom: 4px;
    gap: 4px;
}

.bai-bai-regex-list-toolbar-btn {
    cursor: pointer;
    text-align: center;
    padding: 6px;
    border: 1px dashed var(--SmartThemeBorderColor);
    border-radius: 10px;
    opacity: 0.7;
    transition: opacity 0.2s, background-color 0.2s;
    flex: 1;
}

.bai-bai-regex-list-toolbar-btn:not(.disabled):hover {
    opacity: 1;
    background-color: var(--SmartThemeBlurTintColor);
}

.bai-bai-regex-list-toolbar-btn.disabled {
    cursor: default;
    opacity: 0.35;
}

.bai-bai-regex-move-group-popup {
    display: flex;
    flex-direction: column;
    gap: 8px;
}

.bai-bai-regex-move-group-label {
    display: flex;
    flex-direction: column;
    gap: 4px;
}

.bai-bai-regex-move-group-select {
    width: 100%;
}

.bai-bai-regex-empty-list {
    font-size: 0.95em;
    opacity: 0.7;
    text-align: center;
}

#regex_container #saved_regex_scripts,
#regex_container #saved_scoped_scripts,
#regex_container #saved_preset_scripts,
.bai-bai-regex-vue-list,
.bai-bai-regex-vue-list *,
.bai-bai-regex-sortable-ghost,
.bai-bai-regex-sortable-chosen,
.bai-bai-regex-sortable-drag,
.bai-bai-regex-sortable-fallback {
    cursor: default !important;
}

.bai-bai-regex-vue-list .regex-script-label,
.bai-bai-regex-vue-list .regex_script_name {
    cursor: default !important;
}

.bai-bai-regex-vue-list .bai-bai-regex-script-drag-handle {
    cursor: grab !important;
    touch-action: none;
    user-select: none;
}

.bai-bai-regex-vue-list .bai-bai-regex-script-drag-handle:active {
    cursor: grabbing !important;
}

.bai-bai-regex-vue-list .menu_button,
.bai-bai-regex-vue-list .regex-toggle-on,
.bai-bai-regex-vue-list .regex-toggle-off,
.bai-bai-regex-vue-list .regex_bulk_checkbox,
.bai-bai-regex-vue-list .regex_script_expand {
    cursor: pointer !important;
}

.bai-bai-regex-group {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.bai-bai-regex-group-framed {
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 10px;
    gap: 0;
    margin-top: 6px;
    transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.bai-bai-regex-group-framed .bai-bai-regex-group-body {
    padding: 0;
    min-height: 8px;
    border-bottom-left-radius: 10px;
    border-bottom-right-radius: 10px;
    transition: min-height 0.15s ease, background-color 0.15s ease;
}

body.bai-bai-regex-drag-cursor-active .bai-bai-regex-group-framed .bai-bai-regex-group-body-empty {
    min-height: 44px;
}

.bai-bai-regex-group.bai-bai-regex-drop-target {
    outline: 2px solid var(--SmartThemeQuoteColor);
    outline-offset: 1px;
}

.bai-bai-regex-group.bai-bai-regex-drop-target.bai-bai-regex-group-framed {
    border-color: var(--SmartThemeQuoteColor);
    box-shadow: 0 0 0 1px var(--SmartThemeQuoteColor);
}

.bai-bai-regex-group.bai-bai-regex-drop-target .bai-bai-regex-group-header,
.bai-bai-regex-group.bai-bai-regex-drop-target .bai-bai-regex-group-body {
    background-color: var(--SmartThemeChatTintColor);
}

.bai-bai-regex-group-framed .regex-script-label {
    border: none !important;
    border-radius: 0 !important;
    border-top: 1px solid var(--SmartThemeBorderColor) !important;
    margin: 0 !important;
    box-shadow: none !important;
    padding-left: 10px;
    padding-right: 10px;
}

.bai-bai-regex-group-framed .regex-script-label:first-child {
    border-top: none !important;
}

.bai-bai-regex-group-framed .regex-script-label:last-child {
    margin-bottom: 2px !important;
}

.bai-bai-regex-group-header {
    align-items: center;
    padding: 6px 10px;
    opacity: 0.95;
    background-color: var(--SmartThemeBlurTintColor);
    border-top-left-radius: 9px;
    border-top-right-radius: 9px;
    border-bottom: 1px solid var(--SmartThemeBorderColor);
    cursor: pointer;
    user-select: none;
}

.bai-bai-regex-group-header:hover {
    background-color: var(--SmartThemeChatTintColor);
}

.bai-bai-regex-group-toggle {
    width: 18px;
    text-align: center;
    transition: transform 0.2s ease;
    display: inline-block;
}

.bai-bai-regex-group-title {
    align-items: end;
    gap: 4px;
    min-width: 0;
}

.bai-bai-regex-group-name {
    min-width: 0;
    text-overflow: ellipsis;
    white-space: nowrap;
}

.bai-bai-regex-group-count {
    flex: 0 0 auto;
    opacity: 0.75;
}

.bai-bai-regex-group-move-btn {
    flex: 0 0 auto;
}

.bai-bai-regex-vue-list .bai-bai-regex-group-move-btn.disabled {
    cursor: default !important;
    opacity: 0.35;
}

.bai-bai-regex-group-header.collapsed .bai-bai-regex-group-toggle {
    transform: rotate(-90deg);
}

.bai-bai-regex-group-header.collapsed {
    border-bottom: none;
    border-bottom-left-radius: 9px;
    border-bottom-right-radius: 9px;
    transition: border-radius 0.2s;
}

.bai-bai-regex-sortable-ghost {
    opacity: 0.35;
}

.bai-bai-regex-sortable-chosen {
    cursor: grabbing !important;
}

.bai-bai-regex-sortable-drag {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
    cursor: grabbing !important;
    opacity: 0.95;
}

.bai-bai-regex-sortable-fallback {
    cursor: grabbing !important;
}

body.bai-bai-regex-drag-cursor-active #regex_container,
body.bai-bai-regex-drag-cursor-active #regex_container *,
body.bai-bai-regex-drag-cursor-active .bai-bai-regex-sortable-ghost,
body.bai-bai-regex-drag-cursor-active .bai-bai-regex-sortable-chosen,
body.bai-bai-regex-drag-cursor-active .bai-bai-regex-sortable-drag,
body.bai-bai-regex-drag-cursor-active .bai-bai-regex-sortable-fallback {
    cursor: grabbing !important;
}
`;
    document.head.append(style);
}

function getRegexScriptTypeKey(scriptType) {
    switch (scriptType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            return 'global';
        case REGEX_SCRIPT_TYPES.PRESET:
            return 'preset';
        case REGEX_SCRIPT_TYPES.SCOPED:
            return 'scoped';
        default:
            return 'unknown';
    }
}

function getRegexScriptTypeFromKey(typeKey) {
    switch (typeKey) {
        case 'global':
            return REGEX_SCRIPT_TYPES.GLOBAL;
        case 'preset':
            return REGEX_SCRIPT_TYPES.PRESET;
        case 'scoped':
            return REGEX_SCRIPT_TYPES.SCOPED;
        default:
            return null;
    }
}

function getRegexGroupSettingsRoot() {
    if (!settings.regexListGroups || typeof settings.regexListGroups !== 'object') {
        settings.regexListGroups = {};
    }

    if (!settings.regexListGroups.scopes || typeof settings.regexListGroups.scopes !== 'object') {
        settings.regexListGroups.scopes = {};
    }

    extension_settings[SETTINGS_KEY].regexListGroups = settings.regexListGroups;
    return settings.regexListGroups;
}

function getRegexGroupScopeKey(scriptType) {
    switch (scriptType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            return 'global';
        case REGEX_SCRIPT_TYPES.SCOPED: {
            const avatar = characters?.[this_chid]?.avatar;
            return `scoped:${avatar || 'none'}`;
        }
        case REGEX_SCRIPT_TYPES.PRESET:
            return `preset:${getRegexCurrentPresetAPI() || 'unknown'}:${getRegexCurrentPresetName() || 'unknown'}`;
        default:
            return `unknown:${scriptType}`;
    }
}

function getRegexDefaultUngroupedGroupName() {
    return t`默认分组`;
}

function getRegexUngroupedGroupDisplayName(name) {
    const value = typeof name === 'string' ? name.trim() : '';

    if (!value || value === 'Ungrouped') {
        return getRegexDefaultUngroupedGroupName();
    }

    return value;
}

function getRegexGroupStateForScriptType(scriptType) {
    const root = getRegexGroupSettingsRoot();
    const scopeKey = getRegexGroupScopeKey(scriptType);

    if (!root.scopes[scopeKey] || typeof root.scopes[scopeKey] !== 'object') {
        root.scopes[scopeKey] = {};
    }

    const state = root.scopes[scopeKey];

    if (!Array.isArray(state.groups)) {
        state.groups = [];
    }

    if (!state.scripts || typeof state.scripts !== 'object') {
        state.scripts = {};
    }

    if (!state.ungrouped || typeof state.ungrouped !== 'object') {
        state.ungrouped = {};
    }

    return state;
}

function normalizeRegexGroupState(groupState) {
    groupState.groups = groupState.groups
        .filter(group => group && typeof group === 'object' && group.id && group.id !== REGEX_UNGROUPED_GROUP_ID && group.id !== REGEX_PENDING_ASSIGNMENT_GROUP_ID)
        .map((group, index) => {
            return {
                id: String(group.id),
                name: String(group.name || t`Unnamed group`),
                order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
                collapsed: Boolean(group.collapsed),
            };
        })
        .sort((a, b) => a.order - b.order)
        .map((group, index) => ({ ...group, order: index }));

    if (!groupState.ungrouped || typeof groupState.ungrouped !== 'object') {
        groupState.ungrouped = {};
    }

    groupState.ungrouped = {
        name: getRegexUngroupedGroupDisplayName(groupState.ungrouped.name),
        collapsed: Boolean(groupState.ungrouped.collapsed),
    };
}

function saveRegexGroupSettings() {
    extension_settings[SETTINGS_KEY].regexListGroups = settings.regexListGroups;
    markRegexGroupSettingsSavePending();
}

async function createRegexVueGroup(scriptType) {
    const name = await callGenericPopup(t`Regex group name`, POPUP_TYPE.INPUT, '', {
        okButton: t`Save`,
        cancelButton: t`Cancel`,
    });

    if (typeof name !== 'string') {
        return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        toastr.warning(t`Group name cannot be empty.`);
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    groupState.groups.push({
        id: uuidv4(),
        name: trimmedName,
        order: groupState.groups.length,
        collapsed: false,
    });

    saveRegexGroupSettings();
    syncRegexVueManagerState();
}

async function renameRegexVueGroup(scriptType, groupId) {
    const groupState = getRegexGroupStateForScriptType(scriptType);
    const group = groupId === REGEX_UNGROUPED_GROUP_ID
        ? groupState.ungrouped
        : groupState.groups.find(item => item.id === groupId);

    if (!group) {
        return;
    }

    const name = await callGenericPopup(t`Regex group name`, POPUP_TYPE.INPUT, group.name || '', {
        okButton: t`Save`,
        cancelButton: t`Cancel`,
    });

    if (typeof name !== 'string') {
        return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        toastr.warning(t`Group name cannot be empty.`);
        return;
    }

    group.name = trimmedName;
    saveRegexGroupSettings();
    syncRegexVueManagerState();
}

function moveRegexVueGroup(scriptType, groupId, direction) {
    if (groupId === REGEX_UNGROUPED_GROUP_ID || groupId === REGEX_PENDING_ASSIGNMENT_GROUP_ID) {
        return;
    }

    const offset = Math.sign(Number(direction));

    if (offset === 0) {
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    normalizeRegexGroupState(groupState);

    const currentIndex = groupState.groups.findIndex(group => group.id === groupId);
    const targetIndex = currentIndex + offset;

    if (currentIndex < 0 || targetIndex < 0 || targetIndex >= groupState.groups.length) {
        return;
    }

    const [group] = groupState.groups.splice(currentIndex, 1);
    groupState.groups.splice(targetIndex, 0, group);
    groupState.groups = groupState.groups.map((item, index) => ({
        ...item,
        order: index,
    }));

    saveRegexGroupSettings();
    syncRegexVueManagerState();
}

async function deleteRegexVueGroup(scriptType, groupId) {
    if (groupId === REGEX_UNGROUPED_GROUP_ID) {
        return;
    }

    const result = await callGenericPopup('要删除这个正则分组吗？\n\n选择“否”会把组内正则移动到默认组。\n选择“是”会连同组内正则一起删除。', POPUP_TYPE.CONFIRM, '', {
        okButton: '是',
        cancelButton: '取消',
        defaultResult: POPUP_RESULT.NEGATIVE,
        customButtons: [
            {
                text: '否',
                result: POPUP_RESULT.CUSTOM1,
            },
        ],
    });

    if (result !== POPUP_RESULT.AFFIRMATIVE && result !== POPUP_RESULT.CUSTOM1) {
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    const shouldDeleteScripts = result === POPUP_RESULT.AFFIRMATIVE;

    groupState.groups = groupState.groups.filter(group => group.id !== groupId);

    if (shouldDeleteScripts) {
        const scripts = getRegexScriptsByType(scriptType);
        const removedScriptIds = new Set();

        for (let index = scripts.length - 1; index >= 0; index--) {
            const scriptId = scripts[index]?.id;

            if (groupState.scripts?.[scriptId]?.groupId === groupId) {
                removedScriptIds.add(scriptId);
                scripts.splice(index, 1);
            }
        }

        for (const scriptId of removedScriptIds) {
            delete groupState.scripts[scriptId];
            delete getRegexVueManagerState().state?.selectedIds?.[scriptId];
        }

        if (removedScriptIds.size > 0) {
            await saveRegexScriptList(scriptType, scripts);
            queueRegexChatReloadAfterPanelClose();
        }
    } else {
        for (const meta of Object.values(groupState.scripts)) {
            if (meta?.groupId === groupId) {
                meta.groupId = REGEX_UNGROUPED_GROUP_ID;
            }
        }
    }

    saveRegexGroupSettings();
    syncRegexVueManagerState();
}

function toggleRegexVueGroupCollapsed(scriptType, groupId) {
    const groupState = getRegexGroupStateForScriptType(scriptType);
    const group = groupId === REGEX_UNGROUPED_GROUP_ID
        ? groupState.ungrouped
        : groupState.groups.find(item => item.id === groupId);

    if (!group) {
        return;
    }

    group.collapsed = !group.collapsed;
    saveRegexGroupSettings();

    if (!setRegexVueGroupCollapsedInModel(scriptType, groupId, group.collapsed)) {
        syncRegexVueManagerState();
    }
}

function setRegexVueGroupCollapsedInModel(scriptType, groupId, collapsed) {
    const manager = getRegexVueManagerState();
    const typeKey = getRegexScriptTypeKey(scriptType);
    const group = manager.state?.lists?.[typeKey]?.groups?.find(item => item.id === groupId);

    if (!group) {
        return false;
    }

    group.collapsed = Boolean(collapsed);
    return true;
}

function setRegexVueScriptSelected(scriptId, selected) {
    const manager = getRegexVueManagerState();

    if (!manager.state || !scriptId) {
        return;
    }

    if (selected) {
        manager.state.selectedIds[scriptId] = true;
    } else {
        delete manager.state.selectedIds[scriptId];
    }

    updateRegexBulkControls();
}

function pruneRegexVueSelection() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    const validIds = new Set();

    for (const { scriptType } of getRegexScriptListDefinitions()) {
        for (const script of getRegexScriptsByType(scriptType)) {
            if (script?.id) {
                validIds.add(script.id);
            }
        }
    }

    for (const scriptId of Object.keys(manager.state.selectedIds)) {
        if (!validIds.has(scriptId)) {
            delete manager.state.selectedIds[scriptId];
        }
    }
}

function getRegexVueSelectedContexts() {
    const manager = getRegexVueManagerState();
    const selectedIds = manager.state?.selectedIds ?? {};
    const contexts = [];

    for (const { scriptType } of getRegexScriptListDefinitions()) {
        const scripts = getRegexScriptsByType(scriptType);

        for (let index = 0; index < scripts.length; index++) {
            const script = scripts[index];

            if (script?.id && selectedIds[script.id]) {
                contexts.push({ scriptType, scripts, index, script });
            }
        }
    }

    return contexts;
}

function getRegexVueSelectedCountForList(model, list) {
    const selectedIds = model?.selectedIds ?? {};

    return (list?.groups ?? []).reduce((count, group) => {
        return count + (group?.scripts ?? []).filter(script => script?.id && selectedIds[script.id]).length;
    }, 0);
}

function getRegexVueSelectedScriptsForType(scriptType) {
    const manager = getRegexVueManagerState();
    const typeKey = getRegexScriptTypeKey(scriptType);
    const list = manager.state?.lists?.[typeKey];
    const selectedIds = manager.state?.selectedIds ?? {};

    if (!list) {
        return getRegexVueSelectedContexts()
            .filter(context => context.scriptType === scriptType)
            .map(context => context.script);
    }

    const scripts = [];

    for (const group of list.groups ?? []) {
        for (const script of group.scripts ?? []) {
            if (script?.id && selectedIds[script.id]) {
                scripts.push(script);
            }
        }
    }

    return scripts;
}

function getAllRegexVueScriptIds() {
    return getRegexScriptListDefinitions()
        .flatMap(({ scriptType }) => getRegexScriptsByType(scriptType))
        .map(script => script?.id)
        .filter(Boolean);
}

function toggleRegexVueBulkSelection() {
    const manager = getRegexVueManagerState();

    if (!manager.state) {
        return;
    }

    const allIds = getAllRegexVueScriptIds();
    const allSelected = allIds.length > 0 && allIds.every(id => manager.state.selectedIds[id]);

    for (const id of Object.keys(manager.state.selectedIds)) {
        delete manager.state.selectedIds[id];
    }

    if (!allSelected) {
        for (const id of allIds) {
            manager.state.selectedIds[id] = true;
        }
    }

    updateRegexBulkControls();
}

async function setRegexVueScriptDisabled(scriptType, scriptId, disabled) {
    const context = getRegexScriptContextById(scriptType, scriptId);

    if (!context) {
        return;
    }

    const modelScript = getRegexVueScriptModelById(scriptType, scriptId);
    const previousDisabled = Boolean(context.script.disabled ?? false);
    const previousModelDisabled = modelScript ? Boolean(modelScript.disabled ?? false) : previousDisabled;

    if (previousModelDisabled === disabled) {
        return;
    }

    if (modelScript) {
        modelScript.disabled = disabled;
    } else {
        context.script.disabled = disabled;
    }

    try {
        await saveRegexScriptList(scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(scriptType);
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        if (modelScript) {
            modelScript.disabled = previousModelDisabled;
        } else {
            context.script.disabled = previousDisabled;
        }

        console.debug(`${LOG_PREFIX} Failed to save regex script toggle`, error);
        toastr.error(t`Failed to save regex script state. See console for details.`);
    }
}

async function setRegexVueGroupScriptsDisabled(scriptType, groupId, disabled) {
    const manager = getRegexVueManagerState();
    const typeKey = getRegexScriptTypeKey(scriptType);
    const group = manager.state?.lists?.[typeKey]?.groups?.find(item => item.id === groupId);

    if (!group || group.scripts.length === 0) {
        return;
    }

    const scripts = getRegexScriptsByType(scriptType);
    const changedScripts = group.scripts.filter(script => script?.id && Boolean(script.disabled ?? false) !== disabled);

    if (changedScripts.length === 0) {
        return;
    }

    const previousValues = new Map(changedScripts.map(script => [script.id, Boolean(script.disabled ?? false)]));

    for (const script of changedScripts) {
        script.disabled = disabled;
    }

    try {
        await saveRegexScriptList(scriptType, scripts);
        allowRegexScriptTypeAfterEditSave(scriptType);
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        for (const script of changedScripts) {
            script.disabled = previousValues.get(script.id) ?? Boolean(script.disabled ?? false);
        }

        console.debug(`${LOG_PREFIX} Failed to save regex group script state`, error);
        toastr.error(t`Failed to save regex script state. See console for details.`);
    }
}

function getRegexVueScriptModelById(scriptType, scriptId) {
    const manager = getRegexVueManagerState();
    const typeKey = getRegexScriptTypeKey(scriptType);
    const list = manager.state?.lists?.[typeKey];

    if (!list || !scriptId) {
        return null;
    }

    for (const group of list.groups ?? []) {
        const script = group.scripts?.find(item => item?.id === scriptId);

        if (script) {
            return script;
        }
    }

    return null;
}

async function bulkToggleRegexVueScripts(enable) {
    const contexts = getRegexVueSelectedContexts().filter(context => Boolean(context.script.disabled ?? false) === enable);

    if (contexts.length === 0) {
        toastr.warning(enable ? t`No regex scripts selected for enabling.` : t`No regex scripts selected for disabling.`);
        return;
    }

    const scriptTypesToSave = new Set();

    for (const context of contexts) {
        context.script.disabled = !enable;
        scriptTypesToSave.add(context.scriptType);
    }

    try {
        for (const scriptType of scriptTypesToSave) {
            await saveRegexScriptList(scriptType, getRegexScriptsByType(scriptType));
            allowRegexScriptTypeAfterEditSave(scriptType);
        }

        syncRegexVueManagerState();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to bulk toggle regex scripts`, error);
        toastr.error(t`Failed to save regex script state. See console for details.`);
        syncRegexVueManagerState();
    }
}

async function moveRegexVueScriptWithConfirmation(fromType, scriptId, toType) {
    if (fromType === toType) {
        return;
    }

    if (!canMoveRegexScriptsToType(toType)) {
        return;
    }

    const confirm = await callGenericPopup(getRegexMoveConfirmationMessage(toType), POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    await moveRegexVueScript(fromType, scriptId, toType);
}

async function moveRegexVueScript(fromType, scriptId, toType) {
    const context = getRegexScriptContextById(fromType, scriptId);

    if (!context || fromType === toType) {
        return;
    }

    const targetScripts = getRegexScriptsByType(toType);
    const [movedScript] = context.scripts.splice(context.index, 1);

    if (!movedScript) {
        return;
    }

    targetScripts.push(movedScript);
    moveRegexScriptGroupMeta(fromType, toType, movedScript.id);

    try {
        await saveRegexScriptList(fromType, context.scripts);
        await saveRegexScriptList(toType, targetScripts);
        allowRegexScriptTypeAfterEditSave(toType);
        delete getRegexVueManagerState().state?.selectedIds?.[movedScript.id];
        syncRegexVueManagerState();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        const targetIndex = targetScripts.indexOf(movedScript);

        if (targetIndex !== -1) {
            targetScripts.splice(targetIndex, 1);
        }

        context.scripts.splice(context.index, 0, movedScript);
        console.debug(`${LOG_PREFIX} Failed to move regex script`, error);
        toastr.error(t`Failed to move regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

async function bulkMoveRegexVueScripts(toType) {
    const contexts = getRegexVueSelectedContexts();

    if (contexts.length === 0) {
        toastr.warning(t`No regex scripts selected for moving.`);
        return;
    }

    if (!canMoveRegexScriptsToType(toType)) {
        return;
    }

    const confirm = await callGenericPopup(getRegexBulkMoveConfirmationMessage(toType), POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const selectedIds = new Set(contexts.map(context => context.script.id));
    const movedScripts = [];

    for (const { scriptType } of getRegexScriptListDefinitions()) {
        if (scriptType === toType) {
            continue;
        }

        const scripts = getRegexScriptsByType(scriptType);

        for (let index = scripts.length - 1; index >= 0; index--) {
            const script = scripts[index];

            if (script?.id && selectedIds.has(script.id)) {
                scripts.splice(index, 1);
                movedScripts.unshift({ fromType: scriptType, script });
            }
        }
    }

    if (movedScripts.length === 0) {
        return;
    }

    const targetScripts = getRegexScriptsByType(toType);

    for (const moved of movedScripts) {
        targetScripts.push(moved.script);
        moveRegexScriptGroupMeta(moved.fromType, toType, moved.script.id);
    }

    try {
        for (const { scriptType } of getRegexScriptListDefinitions()) {
            await saveRegexScriptList(scriptType, getRegexScriptsByType(scriptType));
        }

        for (const scriptId of selectedIds) {
            delete getRegexVueManagerState().state?.selectedIds?.[scriptId];
        }

        allowRegexScriptTypeAfterEditSave(toType);
        syncRegexVueManagerState();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to bulk move regex scripts`, error);
        toastr.error(t`Failed to move regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

async function promptBulkMoveRegexVueSelectedScriptsToGroup(scriptType) {
    const selectedScripts = getRegexVueSelectedScriptsForType(scriptType).filter(script => script?.id);

    if (selectedScripts.length === 0) {
        toastr.warning(t`No regex scripts selected for moving.`);
        return;
    }

    const targets = getRegexGroupMoveTargetOptions(scriptType);

    if (targets.length === 0) {
        toastr.warning(t`No regex groups available.`);
        return;
    }

    const template = $('<div class="bai-bai-regex-move-group-popup"></div>');
    const label = $('<label class="bai-bai-regex-move-group-label"></label>').text(t`目标分组`);
    const select = $('<select class="text_pole bai-bai-regex-move-group-select"></select>');

    for (const target of targets) {
        $('<option></option>')
            .val(target.id)
            .text(target.name)
            .appendTo(select);
    }

    template.append(
        $('<div class="bai-bai-regex-move-group-count"></div>').text(t`已选正则：${selectedScripts.length}`),
        label.append(select),
    );

    const confirmed = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', {
        okButton: t`移动`,
        cancelButton: t`取消`,
    });

    if (!confirmed) {
        return;
    }

    await bulkMoveRegexVueSelectedScriptsToGroup(scriptType, String(select.val() || ''));
}

function getRegexGroupMoveTargetOptions(scriptType) {
    const groupState = getRegexGroupStateForScriptType(scriptType);
    normalizeRegexGroupState(groupState);

    return [
        ...groupState.groups.map(group => ({
            id: group.id,
            name: group.name || t`Unnamed group`,
        })),
        {
            id: REGEX_UNGROUPED_GROUP_ID,
            name: getRegexUngroupedGroupDisplayName(groupState.ungrouped?.name),
        },
    ];
}

function isRegexGroupMoveTargetValid(scriptType, groupId) {
    if (groupId === REGEX_UNGROUPED_GROUP_ID) {
        return true;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    normalizeRegexGroupState(groupState);

    return groupState.groups.some(group => group.id === groupId);
}

async function bulkMoveRegexVueSelectedScriptsToGroup(scriptType, targetGroupId) {
    const selectedScripts = getRegexVueSelectedScriptsForType(scriptType).filter(script => script?.id);

    if (selectedScripts.length === 0) {
        toastr.warning(t`No regex scripts selected for moving.`);
        return;
    }

    if (!isRegexGroupMoveTargetValid(scriptType, targetGroupId)) {
        toastr.error(t`Target regex group was not found.`);
        return;
    }

    const scripts = getRegexScriptsByType(scriptType);
    const typeKey = getRegexScriptTypeKey(scriptType);
    const groupState = getRegexGroupStateForScriptType(scriptType);
    const previousScripts = scripts.slice();
    const previousGroupScripts = cloneRegexGroupScriptsMeta(groupState.scripts);
    const selectedIds = new Set(selectedScripts.map(script => script.id));
    const existingTargetOrders = Object.entries(groupState.scripts ?? {})
        .filter(([scriptId, meta]) => !selectedIds.has(scriptId) && meta?.groupId === targetGroupId)
        .map(([, meta]) => Number(meta.order))
        .filter(order => Number.isFinite(order));
    let nextOrder = existingTargetOrders.length > 0 ? Math.max(...existingTargetOrders) + 1 : 0;

    for (const script of selectedScripts) {
        groupState.scripts[script.id] = {
            groupId: targetGroupId,
            order: nextOrder,
        };
        nextOrder += 1;
    }

    try {
        saveRegexGroupSettings();
        syncRegexVueManagerState();
        await saveRegexScriptsOrderFromModel(typeKey);

        for (const scriptId of selectedIds) {
            delete getRegexVueManagerState().state?.selectedIds?.[scriptId];
        }

        syncRegexVueManagerState();
    } catch (error) {
        scripts.splice(0, scripts.length, ...previousScripts);
        restoreRegexGroupScriptsMeta(groupState, previousGroupScripts);
        saveRegexGroupSettings();
        console.debug(`${LOG_PREFIX} Failed to bulk move regex scripts to group`, error);
        toastr.error(t`Failed to move regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

function canMoveRegexScriptsToType(toType) {
    if (toType !== REGEX_SCRIPT_TYPES.SCOPED) {
        return true;
    }

    if (this_chid === undefined) {
        toastr.error(t`No character selected.`);
        return false;
    }

    if (selected_group) {
        toastr.error(t`Cannot edit scoped scripts in group chats.`);
        return false;
    }

    return true;
}

function getRegexBulkMoveConfirmationMessage(toType) {
    switch (toType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            return t`Are you sure you want to move the selected regex scripts to global?`;
        case REGEX_SCRIPT_TYPES.SCOPED:
            return t`Are you sure you want to move the selected regex scripts to scoped?`;
        case REGEX_SCRIPT_TYPES.PRESET:
            return t`Are you sure you want to move the selected regex scripts to preset?`;
        default:
            return t`Are you sure you want to move the selected regex scripts?`;
    }
}

function moveRegexScriptGroupMeta(fromType, toType, scriptId) {
    const fromGroupState = getRegexGroupStateForScriptType(fromType);
    const toGroupState = getRegexGroupStateForScriptType(toType);
    delete fromGroupState.scripts[scriptId];
    toGroupState.scripts[scriptId] = {
        groupId: REGEX_UNGROUPED_GROUP_ID,
        order: Object.keys(toGroupState.scripts).length,
    };
    saveRegexGroupSettings();
}

async function deleteRegexVueScriptWithConfirmation(scriptType, scriptId) {
    const confirm = await callGenericPopup(t`Are you sure you want to delete this regex script?`, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    await deleteRegexVueScript(scriptType, scriptId);
}

async function deleteRegexVueScript(scriptType, scriptId) {
    const context = getRegexScriptContextById(scriptType, scriptId);

    if (!context) {
        return;
    }

    const [removedScript] = context.scripts.splice(context.index, 1);

    try {
        await saveRegexScriptList(scriptType, context.scripts);
        delete getRegexGroupStateForScriptType(scriptType).scripts[scriptId];
        delete getRegexVueManagerState().state?.selectedIds?.[scriptId];
        saveRegexGroupSettings();
        syncRegexVueManagerState();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        if (removedScript) {
            context.scripts.splice(context.index, 0, removedScript);
        }

        console.debug(`${LOG_PREFIX} Failed to delete regex script`, error);
        toastr.error(t`Failed to delete regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

async function bulkDeleteRegexVueScripts() {
    const contexts = getRegexVueSelectedContexts();

    if (contexts.length === 0) {
        toastr.warning(t`No regex scripts selected for deletion.`);
        return;
    }

    const confirm = await callGenericPopup(t`Are you sure you want to delete the selected regex scripts?`, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const selectedIds = new Set(contexts.map(context => context.script.id));

    try {
        for (const { scriptType } of getRegexScriptListDefinitions()) {
            const scripts = getRegexScriptsByType(scriptType);

            for (let index = scripts.length - 1; index >= 0; index--) {
                if (selectedIds.has(scripts[index]?.id)) {
                    scripts.splice(index, 1);
                }
            }

            const groupState = getRegexGroupStateForScriptType(scriptType);

            for (const scriptId of selectedIds) {
                delete groupState.scripts[scriptId];
            }

            await saveRegexScriptList(scriptType, scripts);
        }

        for (const scriptId of selectedIds) {
            delete getRegexVueManagerState().state?.selectedIds?.[scriptId];
        }

        saveRegexGroupSettings();
        syncRegexVueManagerState();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to bulk delete regex scripts`, error);
        toastr.error(t`Failed to delete regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

function exportRegexVueScript(scriptType, scriptId) {
    const context = getRegexScriptContextById(scriptType, scriptId);

    if (!context) {
        return;
    }

    const fileName = `regex-${sanitizeRegexExportFileName(context.script.scriptName || 'script')}.json`;
    download(JSON.stringify(context.script, null, 4), fileName, 'application/json');
}

function exportRegexVueSelectedScripts() {
    const scripts = getRegexVueSelectedContexts().map(context => context.script);

    if (scripts.length === 0) {
        toastr.warning(t`No regex scripts selected for export.`);
        return;
    }

    const fileName = `regex-${new Date().toISOString()}.json`;
    download(JSON.stringify(scripts, null, 4), fileName, 'application/json');
}

function getRegexScriptContextById(scriptType, scriptId) {
    const scripts = getRegexScriptsByType(scriptType);
    const index = scripts.findIndex(script => script?.id === scriptId);

    if (index === -1) {
        return null;
    }

    return {
        scriptType,
        scripts,
        index,
        script: scripts[index],
    };
}

async function openOptimizedRegexEditorForType(scriptType) {
    if (scriptType === REGEX_SCRIPT_TYPES.SCOPED && !canMoveRegexScriptsToType(scriptType)) {
        return;
    }

    await openOptimizedRegexEditorWithScript(scriptType, createDefaultRegexEditorScript());
}

async function openOptimizedRegexEditorById(scriptType, scriptId) {
    const context = getRegexScriptContextById(scriptType, scriptId);

    if (!context) {
        return;
    }

    await openOptimizedRegexEditorWithScript(scriptType, context.script);
}

function createDefaultRegexEditorScript() {
    return {
        id: uuidv4(),
        scriptName: '',
        findRegex: '',
        replaceString: '',
        trimStrings: [],
        placement: [1],
        disabled: false,
        markdownOnly: true,
        promptOnly: false,
        runOnEdit: true,
        substituteRegex: substitute_find_regex.NONE,
        minDepth: null,
        maxDepth: null,
    };
}

async function openOptimizedRegexEditorWithScript(scriptType, script) {
    const isExisting = Boolean(getRegexScriptContextById(scriptType, script.id));

    if (isExisting && !script.scriptName) {
        toastr.error('This script doesn\'t have a name! Please delete it.');
        return;
    }

    const editorHtml = $(await renderExtensionTemplateAsync('regex', 'editor'));
    fillOptimizedRegexEditor(editorHtml, script);
    installOptimizedRegexEditorPreview(editorHtml);

    const popupResult = await callGenericPopup(editorHtml, POPUP_TYPE.CONFIRM, '', {
        okButton: t`Save`,
        cancelButton: t`Cancel`,
        allowVerticalScrolling: true,
    });

    if (!popupResult) {
        return;
    }

    const updatedScript = readOptimizedRegexEditorScript(editorHtml, script);

    if (!updatedScript.scriptName) {
        toastr.error(t`Could not save regex script: The script name was undefined or empty!`);
        return;
    }

    if (updatedScript.findRegex.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: A find regex isn't present.`);
    }

    if (updatedScript.placement.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: One "Affects" checkbox must be selected!`);
    }

    const scripts = getRegexScriptsByType(scriptType);
    const existingIndex = scripts.findIndex(item => item?.id === updatedScript.id);
    const previousScript = existingIndex === -1 ? null : scripts[existingIndex];

    if (existingIndex === -1) {
        scripts.push(updatedScript);
    } else {
        scripts[existingIndex] = updatedScript;
    }

    try {
        await saveRegexScriptList(scriptType, scripts);
        allowRegexScriptTypeAfterEditSave(scriptType);
        ensureRegexScriptGroupMeta(scriptType, updatedScript.id, { pendingAssignment: existingIndex === -1 });
        saveRegexGroupSettings();
        await syncRegexVueManagerAfterDataChange();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        if (existingIndex === -1) {
            const insertedIndex = scripts.findIndex(item => item?.id === updatedScript.id);

            if (insertedIndex !== -1) {
                scripts.splice(insertedIndex, 1);
            }
        } else {
            scripts[existingIndex] = previousScript;
        }

        console.debug(`${LOG_PREFIX} Failed to save regex script`, error);
        toastr.error(t`Failed to save regex script. See console for details.`);
        syncRegexVueManagerState();
    }
}

function ensureRegexScriptGroupMeta(scriptType, scriptId, { pendingAssignment = false } = {}) {
    if (!scriptId) {
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    const existingMeta = groupState.scripts[scriptId];

    if (!existingMeta || typeof existingMeta !== 'object') {
        groupState.scripts[scriptId] = {
            groupId: pendingAssignment ? REGEX_PENDING_ASSIGNMENT_GROUP_ID : REGEX_UNGROUPED_GROUP_ID,
            order: Object.keys(groupState.scripts).length,
        };
        return;
    }

    if (!existingMeta.groupId) {
        existingMeta.groupId = REGEX_UNGROUPED_GROUP_ID;
    }

    if (!Number.isFinite(Number(existingMeta.order))) {
        existingMeta.order = Object.keys(groupState.scripts).length;
    }
}

async function restoreRegexRowsAfterVueManagerRemove() {
    if (!areRegexVueManagerTargetsReady()) {
        return;
    }

    for (const { selector, scriptType } of getRegexScriptListDefinitions()) {
        const list = document.querySelector(selector);

        if (!(list instanceof HTMLElement)) {
            continue;
        }

        list.replaceChildren();

        for (const script of getRegexScriptsByType(scriptType)) {
            await appendOptimizedRegexScriptRow(script, scriptType);
        }
    }

    updateRegexBulkControls();
}

function installOptimizedRegexImportHandler() {
    if (extensionState[REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        if (!settings.regexQuickOperationOptimizationEnabled) {
            return;
        }

        const input = event.target instanceof HTMLInputElement ? event.target : null;

        if (!input || input.id !== 'import_regex_file') {
            return;
        }

        preventRegexQuickOperationEvent(event);
        void importRegexFilesOptimized(input);
    };

    extensionState[REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY] = handler;
    document.addEventListener('change', handler, true);
}

function removeOptimizedRegexImportHandler() {
    const handler = extensionState[REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY];

    if (!handler) {
        return;
    }

    document.removeEventListener('change', handler, true);
    delete extensionState[REGEX_QUICK_OPERATION_IMPORT_HANDLER_KEY];
}

async function importRegexFilesOptimized(inputElement) {
    const files = Array.from(inputElement.files ?? []);

    if (files.length === 0) {
        inputElement.value = '';
        return;
    }

    let target = REGEX_SCRIPT_TYPES.GLOBAL;

    try {
        const template = $(await renderExtensionTemplateAsync('regex', 'importTarget'));
        template.find('#regex_import_target_global').on('input', () => (target = REGEX_SCRIPT_TYPES.GLOBAL));
        template.find('#regex_import_target_scoped').on('input', () => (target = REGEX_SCRIPT_TYPES.SCOPED));
        template.find('#regex_import_target_preset').on('input', () => (target = REGEX_SCRIPT_TYPES.PRESET));

        await callGenericPopup(template, POPUP_TYPE.TEXT);

        const importedScripts = [];

        for (const file of files) {
            importedScripts.push(...await readOptimizedRegexImportFile(file));
        }

        if (importedScripts.length === 0) {
            return;
        }

        const scripts = getRegexScriptsByType(target);
        const validScripts = [];

        for (const importedScript of importedScripts) {
            const normalizedScript = normalizeOptimizedRegexImportScript(importedScript);

            if (!normalizedScript) {
                continue;
            }

            scripts.push(normalizedScript);
            validScripts.push(normalizedScript);
        }

        if (validScripts.length === 0) {
            return;
        }

        try {
            await saveRegexScriptList(target, scripts);
        } catch (error) {
            for (const script of validScripts) {
                const scriptIndex = scripts.indexOf(script);

                if (scriptIndex !== -1) {
                    scripts.splice(scriptIndex, 1);
                }
            }

            throw error;
        }

        if (isRegexVueManagerActive()) {
            for (const script of validScripts) {
                ensureRegexScriptGroupMeta(target, script.id);
                toastr.success(t`Regex script "${script.scriptName}" imported.`);
            }

            saveRegexGroupSettings();
            await syncRegexVueManagerAfterDataChange();
        } else {
            for (const script of validScripts) {
                await appendOptimizedRegexScriptRow(script, target);
                toastr.success(t`Regex script "${script.scriptName}" imported.`);
            }
        }

        updateRegexBulkControls();
        console.debug(`${LOG_PREFIX} Imported ${validScripts.length} regex scripts without list rebuild`);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to import regex scripts`, error);
        toastr.error(t`Failed to import regex scripts. See console for details.`);
    } finally {
        inputElement.value = '';
    }
}

async function readOptimizedRegexImportFile(file) {
    if (!file) {
        toastr.error('No file provided.');
        return [];
    }

    try {
        const regexScripts = JSON.parse(await getFileText(file));
        return Array.isArray(regexScripts) ? regexScripts : [regexScripts];
    } catch (error) {
        console.log(error);
        toastr.error('Invalid JSON file.');
        return [];
    }
}

function normalizeOptimizedRegexImportScript(regexScript) {
    try {
        if (!regexScript || typeof regexScript !== 'object' || Array.isArray(regexScript)) {
            throw new Error('Invalid regex object.');
        }

        if (!regexScript.scriptName) {
            throw new Error('No script name provided.');
        }

        return {
            ...regexScript,
            id: uuidv4(),
        };
    } catch (error) {
        console.log(error);
        toastr.error(t`Invalid regex object.`);
        return null;
    }
}

async function appendOptimizedRegexScriptRow(script, scriptType) {
    const containerSelector = getRegexListSelectorForScriptType(scriptType);
    const container = containerSelector ? document.querySelector(containerSelector) : null;

    if (!(container instanceof HTMLElement)) {
        return;
    }

    const template = await getOptimizedRegexScriptTemplate();
    const scriptHtml = template.clone();
    hydrateOptimizedRegexScriptRow(scriptHtml, script);
    $(container).append(scriptHtml);
}

async function getOptimizedRegexScriptTemplate() {
    const state = getRegexQuickOperationState();

    if (!state.scriptTemplate) {
        state.scriptTemplate = $(await renderExtensionTemplateAsync('regex', 'scriptTemplate'));
    }

    return state.scriptTemplate;
}

function hydrateOptimizedRegexScriptRow(scriptHtml, script) {
    if (!script.id) {
        script.id = uuidv4();
    }

    scriptHtml.attr('id', script.id);
    updateRegexScriptRowFromScript(scriptHtml.get(0), script);

    scriptHtml.find('.disable_regex').on('input', async function () {
        const row = scriptHtml.get(0);

        if (!(row instanceof HTMLElement)) {
            return;
        }

        await setRegexScriptRowDisabled(row, Boolean($(this).prop('checked')));
    });

    scriptHtml.find('.regex-toggle-on').on('click', function () {
        scriptHtml.find('.disable_regex').prop('checked', true).trigger('input');
    });

    scriptHtml.find('.regex-toggle-off').on('click', function () {
        scriptHtml.find('.disable_regex').prop('checked', false).trigger('input');
    });

    scriptHtml.find('.edit_existing_regex').on('click', async function () {
        const row = scriptHtml.get(0);

        if (row instanceof HTMLElement) {
            await openOptimizedRegexEditor(row);
        }
    });

    scriptHtml.find('.move_to_global').on('click', async function () {
        await moveOptimizedRegexScriptRowWithConfirmation(scriptHtml.get(0), REGEX_SCRIPT_TYPES.GLOBAL);
    });

    scriptHtml.find('.move_to_scoped').on('click', async function () {
        await moveOptimizedRegexScriptRowWithConfirmation(scriptHtml.get(0), REGEX_SCRIPT_TYPES.SCOPED);
    });

    scriptHtml.find('.move_to_preset').on('click', async function () {
        await moveOptimizedRegexScriptRowWithConfirmation(scriptHtml.get(0), REGEX_SCRIPT_TYPES.PRESET);
    });

    scriptHtml.find('.export_regex').on('click', function () {
        exportOptimizedRegexScriptRow(scriptHtml.get(0));
    });

    scriptHtml.find('.delete_regex').on('click', async function () {
        const row = scriptHtml.get(0);

        if (row instanceof HTMLElement) {
            await deleteRegexScriptRow(row);
        }
    });

    scriptHtml.find('.regex_bulk_checkbox').on('change', function () {
        updateRegexBulkControls();
    });

    scriptHtml.find('input[name="regex_expand"]').on('change', function () {
        if (!(this instanceof HTMLInputElement) || !this.checked) {
            return;
        }

        const closeMenuHandler = (event) => {
            if (event.target instanceof HTMLElement && event.target.closest('.regex-script-label')) {
                return;
            }

            this.checked = false;
            document.removeEventListener('click', closeMenuHandler);
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenuHandler, { passive: true, once: false });
        }, 0);
    });
}

async function moveOptimizedRegexScriptRowWithConfirmation(row, toType) {
    if (!(row instanceof HTMLElement)) {
        return;
    }

    const context = getRegexScriptContextFromRow(row);

    if (!context || context.scriptType === toType) {
        return;
    }

    if (toType === REGEX_SCRIPT_TYPES.SCOPED) {
        if (this_chid === undefined) {
            toastr.error(t`No character selected.`);
            return;
        }

        if (selected_group) {
            toastr.error(t`Cannot edit scoped scripts in group chats.`);
            return;
        }
    }

    const confirm = await callGenericPopup(getRegexMoveConfirmationMessage(toType), POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    await moveOptimizedRegexScriptRow(row, toType);
}

function getRegexMoveConfirmationMessage(toType) {
    switch (toType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            return t`Are you sure you want to move this regex script to global?`;
        case REGEX_SCRIPT_TYPES.SCOPED:
            return t`Are you sure you want to move this regex script to scoped?`;
        case REGEX_SCRIPT_TYPES.PRESET:
            return t`Are you sure you want to move this regex script to preset?`;
        default:
            return t`Are you sure you want to move this regex script?`;
    }
}

async function moveOptimizedRegexScriptRow(row, toType) {
    const context = getRegexScriptContextFromRow(row);
    const targetSelector = getRegexListSelectorForScriptType(toType);
    const targetList = targetSelector ? document.querySelector(targetSelector) : null;

    if (!context || !(targetList instanceof HTMLElement)) {
        return;
    }

    const targetScripts = getRegexScriptsByType(toType);
    const [movedScript] = context.scripts.splice(context.index, 1);

    if (!movedScript) {
        return;
    }

    targetScripts.push(movedScript);

    try {
        await saveRegexScriptList(toType, targetScripts);
        await saveRegexScriptList(context.scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(toType);

        const bulkCheckbox = row.querySelector('.regex_bulk_checkbox');

        if (bulkCheckbox instanceof HTMLInputElement) {
            bulkCheckbox.checked = false;
        }

        targetList.append(row);
        updateRegexBulkControls();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        const targetIndex = targetScripts.indexOf(movedScript);

        if (targetIndex !== -1) {
            targetScripts.splice(targetIndex, 1);
        }

        if (!context.scripts.includes(movedScript)) {
            context.scripts.splice(context.index, 0, movedScript);
        }

        try {
            await saveRegexScriptList(context.scriptType, context.scripts);
            await saveRegexScriptList(toType, targetScripts);
        } catch (rollbackError) {
            console.debug(`${LOG_PREFIX} Failed to roll back regex script move`, rollbackError);
        }

        console.debug(`${LOG_PREFIX} Failed to move regex script`, error);
        toastr.error(t`Failed to move regex script. See console for details.`);
    }
}

function exportOptimizedRegexScriptRow(row) {
    if (!(row instanceof HTMLElement)) {
        return;
    }

    const context = getRegexScriptContextFromRow(row);

    if (!context) {
        return;
    }

    const fileName = `regex-${sanitizeRegexExportFileName(context.script.scriptName || 'script')}.json`;
    const fileData = JSON.stringify(context.script, null, 4);
    download(fileData, fileName, 'application/json');
}

function sanitizeRegexExportFileName(name) {
    return String(name).replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase();
}

function scheduleNativeRegexSortableGuard(delayMs = 80) {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const state = getRegexQuickOperationState();
    clearTimeout(state.nativeSortableGuardTimer);
    state.nativeSortableGuardTimer = setTimeout(() => {
        state.nativeSortableGuardTimer = null;
        guardNativeRegexSortables();
    }, delayMs);
}

function guardNativeRegexSortables() {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const manager = getRegexVueManagerState();
    const shouldDisable = Boolean(manager.installing || manager.app || areRegexVueManagerTargetsOwned());

    if (!shouldDisable) {
        return;
    }

    const waitingForNativeSortable = disableNativeRegexSortables();
    const state = getRegexQuickOperationState();

    if (waitingForNativeSortable && (state.nativeSortableGuardRetries ?? 0) < 40) {
        state.nativeSortableGuardRetries = (state.nativeSortableGuardRetries ?? 0) + 1;
        scheduleNativeRegexSortableGuard(250);
    } else {
        state.nativeSortableGuardRetries = 0;
    }
}

function disableNativeRegexSortables() {
    if (typeof $ !== 'function' || typeof $.fn?.sortable !== 'function') {
        return true;
    }

    let waitingForNativeSortable = false;

    for (const { selector } of getRegexScriptListDefinitions()) {
        const list = document.querySelector(selector);

        if (!(list instanceof HTMLElement)) {
            waitingForNativeSortable = true;
            continue;
        }

        try {
            if (!isRegexSortableInitialized(list)) {
                waitingForNativeSortable = true;
                continue;
            }

            if ($(list).sortable('option', 'disabled') !== true) {
                $(list).sortable('disable');
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to disable native regex sortable`, error);
        }
    }

    return waitingForNativeSortable;
}

function enableNativeRegexSortables() {
    if (typeof $ !== 'function' || typeof $.fn?.sortable !== 'function') {
        return;
    }

    for (const { selector } of getRegexScriptListDefinitions()) {
        const list = document.querySelector(selector);

        try {
            if (list instanceof HTMLElement && isRegexSortableInitialized(list)) {
                $(list).sortable('enable');
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to enable native regex sortable`, error);
        }
    }
}

function isRegexSortableInitialized(list) {
    if (typeof $ !== 'function') {
        return false;
    }

    return Boolean($(list).data('ui-sortable') || $(list).data('sortable'));
}

function getRegexScriptListDefinitions() {
    return [
        { selector: '#saved_regex_scripts', scriptType: REGEX_SCRIPT_TYPES.GLOBAL },
        { selector: '#saved_scoped_scripts', scriptType: REGEX_SCRIPT_TYPES.SCOPED },
        { selector: '#saved_preset_scripts', scriptType: REGEX_SCRIPT_TYPES.PRESET },
    ];
}

function getRegexListSelectorForScriptType(scriptType) {
    return getRegexScriptListDefinitions().find(definition => definition.scriptType === scriptType)?.selector ?? null;
}

function handleRegexQuickOperationClick(event) {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    if (isRegexVueManagerActive()) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const row = target?.closest(`${REGEX_CONTAINER_SELECTOR} ${REGEX_SCRIPT_ROW_SELECTOR}`);

    if (!(row instanceof HTMLElement)) {
        return;
    }

    const editButton = target.closest('.edit_existing_regex');

    if (editButton && row.contains(editButton)) {
        preventRegexQuickOperationEvent(event);
        void openOptimizedRegexEditor(row);
        return;
    }

    const toggle = target.closest('.regex-toggle-on, .regex-toggle-off');

    if (toggle && row.contains(toggle)) {
        preventRegexQuickOperationEvent(event);
        void toggleRegexScriptRow(row, toggle);
        return;
    }

    const deleteButton = target.closest('.delete_regex');

    if (deleteButton && row.contains(deleteButton)) {
        preventRegexQuickOperationEvent(event);
        void deleteRegexScriptRow(row);
    }
}

function preventRegexQuickOperationEvent(event) {
    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();
}

async function toggleRegexScriptRow(row, toggle) {
    const nextDisabled = toggle.classList.contains('regex-toggle-on');

    await setRegexScriptRowDisabled(row, nextDisabled);
}

async function setRegexScriptRowDisabled(row, nextDisabled) {
    const context = getRegexScriptContextFromRow(row);

    if (!context) {
        return;
    }

    const previousDisabled = Boolean(context.script.disabled ?? false);

    context.script.disabled = nextDisabled;
    updateRegexScriptRowDisabled(row, nextDisabled);

    try {
        await saveRegexScriptList(context.scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(context.scriptType);
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        context.script.disabled = previousDisabled;
        updateRegexScriptRowDisabled(row, previousDisabled);
        console.debug(`${LOG_PREFIX} Failed to save regex script toggle`, error);
        toastr.error(t`Failed to save regex script state. See console for details.`);
    }
}

async function deleteRegexScriptRow(row) {
    const confirm = await callGenericPopup(t`Are you sure you want to delete this regex script?`, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const context = getRegexScriptContextFromRow(row);

    if (!context) {
        return;
    }

    const [removedScript] = context.scripts.splice(context.index, 1);

    try {
        await saveRegexScriptList(context.scriptType, context.scripts);
        row.remove();
        updateRegexBulkControls();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        if (removedScript) {
            context.scripts.splice(context.index, 0, removedScript);
        }

        console.debug(`${LOG_PREFIX} Failed to delete regex script`, error);
        toastr.error(t`Failed to delete regex script. See console for details.`);
    }
}

async function openOptimizedRegexEditor(row) {
    const context = getRegexScriptContextFromRow(row);

    if (!context) {
        return;
    }

    if (isRegexVueManagerActive()) {
        await openOptimizedRegexEditorById(context.scriptType, context.scriptId);
        return;
    }

    if (!context.script.scriptName) {
        toastr.error('This script doesn\'t have a name! Please delete it.');
        return;
    }

    const editorHtml = $(await renderExtensionTemplateAsync('regex', 'editor'));
    fillOptimizedRegexEditor(editorHtml, context.script);
    installOptimizedRegexEditorPreview(editorHtml);

    const popupResult = await callGenericPopup(editorHtml, POPUP_TYPE.CONFIRM, '', {
        okButton: t`Save`,
        cancelButton: t`Cancel`,
        allowVerticalScrolling: true,
    });

    if (!popupResult) {
        return;
    }

    const updatedScript = readOptimizedRegexEditorScript(editorHtml, context.script);

    if (!updatedScript.scriptName) {
        toastr.error(t`Could not save regex script: The script name was undefined or empty!`);
        return;
    }

    if (updatedScript.findRegex.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: A find regex isn't present.`);
    }

    if (updatedScript.placement.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: One "Affects" checkbox must be selected!`);
    }

    const previousScript = context.scripts[context.index];
    context.scripts[context.index] = updatedScript;

    try {
        await saveRegexScriptList(context.scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(context.scriptType);
        updateRegexScriptRowFromScript(row, updatedScript);
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        context.scripts[context.index] = previousScript;
        console.debug(`${LOG_PREFIX} Failed to save regex script edit`, error);
        toastr.error(t`Failed to save regex script. See console for details.`);
    }
}

function fillOptimizedRegexEditor(editorHtml, script) {
    editorHtml.find('.regex_script_name').val(script.scriptName || '');
    editorHtml.find('.find_regex').val(script.findRegex || '');
    editorHtml.find('.regex_replace_string').val(script.replaceString || '');
    editorHtml.find('.regex_trim_strings').val(Array.isArray(script.trimStrings) ? script.trimStrings.join('\n') : '');
    editorHtml.find('input[name="disabled"]').prop('checked', Boolean(script.disabled ?? false));
    editorHtml.find('input[name="only_format_display"]').prop('checked', Boolean(script.markdownOnly ?? false));
    editorHtml.find('input[name="only_format_prompt"]').prop('checked', Boolean(script.promptOnly ?? false));
    editorHtml.find('input[name="run_on_edit"]').prop('checked', Boolean(script.runOnEdit ?? false));
    editorHtml.find('select[name="substitute_regex"]').val(script.substituteRegex ?? substitute_find_regex.NONE);
    editorHtml.find('input[name="min_depth"]').val(Number.isNaN(script.minDepth) ? '' : script.minDepth ?? '');
    editorHtml.find('input[name="max_depth"]').val(Number.isNaN(script.maxDepth) ? '' : script.maxDepth ?? '');

    for (const placement of Array.isArray(script.placement) ? script.placement : []) {
        editorHtml.find(`input[name="replace_position"][value="${placement}"]`).prop('checked', true);
    }
}

function installOptimizedRegexEditorPreview(editorHtml) {
    const updateTestResult = () => {
        updateOptimizedRegexInfoBlock(editorHtml);

        if (!editorHtml.find('#regex_test_mode').is(':visible')) {
            return;
        }

        const testScript = {
            id: 'bai-bai-toolkit-regex-test',
            scriptName: String(editorHtml.find('.regex_script_name').val()),
            findRegex: String(editorHtml.find('.find_regex').val()),
            replaceString: String(editorHtml.find('.regex_replace_string').val()),
            trimStrings: splitRegexTrimStrings(editorHtml.find('.regex_trim_strings').val()),
            substituteRegex: Number(editorHtml.find('select[name="substitute_regex"]').val()),
            disabled: false,
            promptOnly: false,
            markdownOnly: false,
            runOnEdit: false,
            minDepth: null,
            maxDepth: null,
            placement: null,
        };
        const rawTestString = String(editorHtml.find('#regex_test_input').val());
        const result = runRegexScript(testScript, rawTestString);
        editorHtml.find('#regex_test_output').text(result);
    };

    editorHtml.find('#regex_test_mode_toggle').on('click', function () {
        editorHtml.find('#regex_test_mode').toggleClass('displayNone');
        updateTestResult();
    });

    editorHtml.find('input, textarea, select').on('input', updateTestResult);
    updateOptimizedRegexInfoBlock(editorHtml);
}

function updateOptimizedRegexInfoBlock(editorHtml) {
    const infoBlock = editorHtml.find('.info-block').get(0);
    const infoBlockFlagsHint = editorHtml.find('#regex_info_block_flags_hint');
    const findRegex = String(editorHtml.find('.find_regex').val());

    infoBlockFlagsHint.hide();

    if (!findRegex) {
        setInfoBlock(infoBlock, t`Find Regex is empty`, 'info');
        return;
    }

    try {
        const regex = regexFromString(findRegex);

        if (!regex) {
            throw new Error(t`Invalid Find Regex`);
        }

        const flagInfo = [];
        flagInfo.push(regex.flags.includes('g') ? t`Applies to all matches` : t`Applies to the first match`);
        flagInfo.push(regex.flags.includes('i') ? t`Case insensitive` : t`Case sensitive`);

        setInfoBlock(infoBlock, flagInfo.join('. '), 'hint');
        infoBlockFlagsHint.show();
    } catch (error) {
        setInfoBlock(infoBlock, error.message, 'error');
    }
}

function readOptimizedRegexEditorScript(editorHtml, existingScript) {
    return {
        ...existingScript,
        id: String(existingScript.id),
        scriptName: String(editorHtml.find('.regex_script_name').val()),
        findRegex: String(editorHtml.find('.find_regex').val()),
        replaceString: String(editorHtml.find('.regex_replace_string').val()),
        trimStrings: splitRegexTrimStrings(editorHtml.find('.regex_trim_strings').val()),
        placement: editorHtml
            .find('input[name="replace_position"]')
            .filter(':checked')
            .map(function () { return parseInt($(this).val().toString()); })
            .get()
            .filter(value => !isNaN(value)) || [],
        disabled: Boolean(editorHtml.find('input[name="disabled"]').prop('checked')),
        markdownOnly: Boolean(editorHtml.find('input[name="only_format_display"]').prop('checked')),
        promptOnly: Boolean(editorHtml.find('input[name="only_format_prompt"]').prop('checked')),
        runOnEdit: Boolean(editorHtml.find('input[name="run_on_edit"]').prop('checked')),
        substituteRegex: Number(editorHtml.find('select[name="substitute_regex"]').val()),
        minDepth: parseInt(String(editorHtml.find('input[name="min_depth"]').val())),
        maxDepth: parseInt(String(editorHtml.find('input[name="max_depth"]').val())),
    };
}

function splitRegexTrimStrings(value) {
    return String(value).split('\n').filter(item => item.length !== 0) || [];
}

function getRegexScriptContextFromRow(row) {
    const scriptId = row.id;
    const list = row.closest(REGEX_SCRIPT_LIST_SELECTOR);
    const scriptType = getRegexScriptTypeFromList(list);

    if (!scriptId || scriptType === null) {
        return null;
    }

    const scripts = getRegexScriptsByType(scriptType);
    const index = scripts.findIndex(script => script?.id === scriptId);

    if (index === -1) {
        return null;
    }

    return {
        row,
        list,
        scriptId,
        scriptType,
        scripts,
        index,
        script: scripts[index],
    };
}

function getRegexScriptTypeFromList(list) {
    if (!(list instanceof HTMLElement)) {
        return null;
    }

    switch (list.id) {
        case 'saved_regex_scripts':
            return REGEX_SCRIPT_TYPES.GLOBAL;
        case 'saved_scoped_scripts':
            return REGEX_SCRIPT_TYPES.SCOPED;
        case 'saved_preset_scripts':
            return REGEX_SCRIPT_TYPES.PRESET;
        default:
            return null;
    }
}

async function saveRegexScriptsOrderFromModel(typeKey) {
    const scriptType = getRegexScriptTypeFromKey(typeKey);

    if (scriptType === null) {
        return;
    }

    const manager = getRegexVueManagerState();
    if (!manager.state) return;

    const list = manager.state.lists[typeKey];
    if (!list) return;

    const scripts = getRegexScriptsByType(scriptType);
    const scriptIds = new Set(scripts.map(script => script?.id).filter(Boolean));
    const scriptById = new Map(scripts.filter(script => script?.id).map(script => [script.id, script]));
    const seen = new Set();
    const reorderedScripts = [];
    const groupState = getRegexGroupStateForScriptType(scriptType);
    const previousScripts = scripts.slice();
    const previousGroupScripts = cloneRegexGroupScriptsMeta(groupState.scripts);
    let mappedScriptCount = 0;

    for (const group of list.groups) {
        let order = 0;
        const groupId = group.isPendingAssignment
            ? REGEX_PENDING_ASSIGNMENT_GROUP_ID
            : group.isUngrouped
                ? REGEX_UNGROUPED_GROUP_ID
                : group.id;

        for (const script of group.scripts) {
            if (!script?.id || !scriptIds.has(script.id) || seen.has(script.id)) {
                continue;
            }

            const sourceScript = scriptById.get(script.id);

            if (!sourceScript) {
                continue;
            }

            seen.add(script.id);
            reorderedScripts.push(sourceScript);
            groupState.scripts[script.id] = { groupId, order };
            order += 1;
            mappedScriptCount += 1;
        }
    }

    if (scripts.length > 0 && mappedScriptCount === 0) {
        console.debug(`${LOG_PREFIX} Regex Vue order save skipped because the drag model contains no known scripts`);
        toastr.error(t`Regex order was not saved because the drag result was invalid.`);
        restoreRegexGroupScriptsMeta(groupState, previousGroupScripts);
        syncRegexVueManagerState();
        return;
    }

    for (const script of scripts) {
        if (script?.id && !seen.has(script.id)) {
            reorderedScripts.push(script);
        }
    }

    if (reorderedScripts.length !== scripts.length) {
        console.debug(`${LOG_PREFIX} Regex Vue order save skipped because model and data lengths differ`);
        restoreRegexGroupScriptsMeta(groupState, previousGroupScripts);
        syncRegexVueManagerState();
        return;
    }

    scripts.splice(0, scripts.length, ...reorderedScripts);

    try {
        await saveRegexScriptList(scriptType, scripts);
        saveRegexGroupSettings();
        queueRegexChatReloadAfterPanelClose();
    } catch (error) {
        scripts.splice(0, scripts.length, ...previousScripts);
        restoreRegexGroupScriptsMeta(groupState, previousGroupScripts);
        throw error;
    }
}

function cloneRegexGroupScriptsMeta(scriptsMeta) {
    const clone = {};

    for (const [scriptId, meta] of Object.entries(scriptsMeta ?? {})) {
        clone[scriptId] = meta && typeof meta === 'object' ? { ...meta } : meta;
    }

    return clone;
}

function restoreRegexGroupScriptsMeta(groupState, scriptsMeta) {
    groupState.scripts = cloneRegexGroupScriptsMeta(scriptsMeta);
}

function saveRegexScriptsOrderFromModelSafely(typeKey) {
    void saveRegexScriptsOrderFromModel(typeKey).catch(error => {
        console.debug(`${LOG_PREFIX} Failed to save regex script order`, error);
        toastr.error(t`Failed to save regex script order. See console for details.`);
        syncRegexVueManagerState();
    });
}

function updateRegexScriptRowDisabled(row, disabled) {
    const checkbox = row.querySelector('.disable_regex');

    if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = disabled;
    }
}

function updateRegexScriptRowFromScript(row, script) {
    row.id = script.id;
    const name = script.scriptName || '';
    const nameElement = row.querySelector('.regex_script_name');

    if (nameElement instanceof HTMLElement) {
        nameElement.textContent = name;
        nameElement.title = name;
    }

    updateRegexScriptRowDisabled(row, Boolean(script.disabled ?? false));
}

async function saveRegexScriptList(scriptType, scripts) {
    markRegexScriptListSavePending(scriptType, scripts);
}

function markRegexScriptListSavePending(scriptType, scripts) {
    const state = getRegexQuickOperationState();

    if (!state.pendingRegexScriptSaves || !(state.pendingRegexScriptSaves instanceof Map)) {
        state.pendingRegexScriptSaves = new Map();
    }

    const entry = createPendingRegexScriptSaveEntry(scriptType, scripts);

    if (!entry) {
        return;
    }

    state.pendingRegexScriptSaves.set(entry.scopeKey, entry);
    schedulePendingRegexChangesFlushCheck();
}

function createPendingRegexScriptSaveEntry(scriptType, scripts) {
    const safeScripts = Array.isArray(scripts) ? scripts : [];

    switch (scriptType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            return {
                scriptType,
                scopeKey: getRegexGroupScopeKey(scriptType),
                scripts: safeScripts,
            };
        case REGEX_SCRIPT_TYPES.SCOPED: {
            if (this_chid === undefined || !characters?.[this_chid]) {
                return null;
            }

            return {
                scriptType,
                scopeKey: getRegexGroupScopeKey(scriptType),
                scripts: safeScripts,
                characterId: this_chid,
            };
        }
        case REGEX_SCRIPT_TYPES.PRESET: {
            const apiId = getRegexCurrentPresetAPI();
            const presetName = getRegexCurrentPresetName();

            if (!apiId || !presetName) {
                return null;
            }

            return {
                scriptType,
                scopeKey: getRegexGroupScopeKey(scriptType),
                scripts: safeScripts,
                apiId,
                presetName,
            };
        }
        default:
            return null;
    }
}

function markRegexGroupSettingsSavePending() {
    const state = getRegexQuickOperationState();
    extension_settings[SETTINGS_KEY].regexListGroups = settings.regexListGroups;
    state.pendingRegexGroupSettingsSave = true;
    schedulePendingRegexChangesFlushCheck();
}

function schedulePendingRegexChangesFlushCheck() {
    installRegexChatReloadVisibilityObserver();
    scheduleRegexChatReloadVisibilityCheck(0);
}

function allowRegexScriptTypeAfterEditSave(scriptType) {
    if (scriptType === REGEX_SCRIPT_TYPES.SCOPED) {
        const avatar = characters?.[this_chid]?.avatar;

        if (!avatar) {
            return;
        }

        if (!Array.isArray(extension_settings.character_allowed_regex)) {
            extension_settings.character_allowed_regex = [];
        }

        if (!extension_settings.character_allowed_regex.includes(avatar)) {
            extension_settings.character_allowed_regex.push(avatar);
            markRegexGroupSettingsSavePending();
        }

        return;
    }

    if (scriptType === REGEX_SCRIPT_TYPES.PRESET) {
        const apiId = getRegexCurrentPresetAPI();
        const presetName = getRegexCurrentPresetName();

        if (!apiId || !presetName) {
            return;
        }

        if (!extension_settings.preset_allowed_regex || typeof extension_settings.preset_allowed_regex !== 'object') {
            extension_settings.preset_allowed_regex = {};
        }

        if (!Array.isArray(extension_settings.preset_allowed_regex[apiId])) {
            extension_settings.preset_allowed_regex[apiId] = [];
        }

        if (!extension_settings.preset_allowed_regex[apiId].includes(presetName)) {
            extension_settings.preset_allowed_regex[apiId].push(presetName);
            markRegexGroupSettingsSavePending();
        }
    }
}

function queueRegexChatReloadAfterPanelClose() {
    if (!getCurrentChatId()) {
        return;
    }

    const state = getRegexQuickOperationState();
    state.pendingChatReload = true;
    installRegexChatReloadVisibilityObserver();
    scheduleRegexChatReloadVisibilityCheck(0);
}

function installRegexChatReloadVisibilityObserver() {
    const state = getRegexQuickOperationState();

    if (state.chatReloadVisibilityObserver || typeof MutationObserver !== 'function') {
        return;
    }

    const observer = new MutationObserver(() => {
        scheduleRegexChatReloadVisibilityCheck();
    });

    state.chatReloadVisibilityObserver = observer;

    for (const target of getRegexChatReloadVisibilityTargets()) {
        observer.observe(target, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
        });
    }
}

function getRegexChatReloadVisibilityTargets() {
    const targets = [];
    const seen = new Set();
    const add = element => {
        if (element instanceof HTMLElement && !seen.has(element)) {
            seen.add(element);
            targets.push(element);
        }
    };

    const regexContainer = document.querySelector(REGEX_CONTAINER_SELECTOR);
    const extensionsPanel = document.querySelector(REGEX_EXTENSIONS_PANEL_SELECTOR);

    add(regexContainer);
    add(extensionsPanel);

    if (regexContainer instanceof HTMLElement) {
        for (let element = regexContainer.parentElement; element && element !== document.body; element = element.parentElement) {
            add(element);

            if (element.matches(REGEX_EXTENSIONS_PANEL_SELECTOR)) {
                break;
            }
        }
    }

    return targets;
}

function scheduleRegexChatReloadVisibilityCheck(delayMs = REGEX_CHAT_RELOAD_VISIBILITY_CHECK_DELAY_MS) {
    const state = getRegexQuickOperationState();
    clearTimeout(state.chatReloadVisibilityTimer);
    state.chatReloadVisibilityTimer = setTimeout(() => {
        state.chatReloadVisibilityTimer = null;
        checkPendingRegexChatReload();
    }, delayMs);
}

function checkPendingRegexChatReload() {
    const state = getRegexQuickOperationState();

    if (!state.pendingChatReload && !hasPendingRegexChanges()) {
        removeRegexChatReloadVisibilityWatch();
        return;
    }

    if (!isRegexPanelVisible()) {
        void flushPendingRegexChatReload();
        return;
    }

    scheduleRegexChatReloadVisibilityCheck(REGEX_CHAT_RELOAD_VISIBILITY_FALLBACK_DELAY_MS);
}

async function flushPendingRegexChatReload() {
    const state = getRegexQuickOperationState();

    if ((!state.pendingChatReload && !hasPendingRegexChanges()) || state.chatReloadInFlight) {
        return;
    }

    const shouldReload = Boolean(state.pendingChatReload);
    state.pendingChatReload = false;
    state.chatReloadInFlight = true;
    removeRegexChatReloadVisibilityWatch();

    try {
        await flushPendingRegexChanges();

        if (shouldReload) {
            await reloadCurrentChatForRegexChange();
        }
    } catch (error) {
        if (shouldReload) {
            state.pendingChatReload = true;
        }

        console.debug(`${LOG_PREFIX} Failed to flush regex changes`, error);
        toastr.error(t`Failed to save regex changes. See console for details.`);
    } finally {
        state.chatReloadInFlight = false;

        if (state.pendingChatReload || hasPendingRegexChanges()) {
            installRegexChatReloadVisibilityObserver();
            scheduleRegexChatReloadVisibilityCheck();
        }
    }
}

function hasPendingRegexChanges() {
    const state = getRegexQuickOperationState();
    return Boolean(state.pendingRegexGroupSettingsSave || state.pendingRegexScriptSaves?.size > 0);
}

async function flushPendingRegexChanges() {
    const state = getRegexQuickOperationState();

    if (state.regexChangesSavePromise) {
        return state.regexChangesSavePromise;
    }

    const pendingScriptSaves = state.pendingRegexScriptSaves instanceof Map
        ? Array.from(state.pendingRegexScriptSaves.values())
        : [];
    const shouldSaveGroups = Boolean(state.pendingRegexGroupSettingsSave);

    if (pendingScriptSaves.length === 0 && !shouldSaveGroups) {
        return;
    }

    state.regexChangesSaveInFlight = true;
    const shouldSaveSettings = shouldSaveGroups || pendingScriptSaves.some(entry => entry.scriptType === REGEX_SCRIPT_TYPES.GLOBAL);
    const savePromise = (async () => {
        try {
            state.pendingRegexScriptSaves = new Map();
            state.pendingRegexGroupSettingsSave = false;

            for (const entry of pendingScriptSaves) {
                await flushPendingRegexScriptSave(entry);
            }

            if (shouldSaveSettings) {
                extension_settings[SETTINGS_KEY].regexListGroups = settings.regexListGroups;
                await saveSettings();
            }
        } catch (error) {
            if (!state.pendingRegexScriptSaves || !(state.pendingRegexScriptSaves instanceof Map)) {
                state.pendingRegexScriptSaves = new Map();
            }

            for (const entry of pendingScriptSaves) {
                state.pendingRegexScriptSaves.set(entry.scopeKey, entry);
            }

            state.pendingRegexGroupSettingsSave = state.pendingRegexGroupSettingsSave || shouldSaveGroups;
            throw error;
        } finally {
            state.regexChangesSaveInFlight = false;
        }
    })();

    state.regexChangesSavePromise = savePromise;

    try {
        await savePromise;
    } finally {
        if (state.regexChangesSavePromise === savePromise) {
            state.regexChangesSavePromise = null;
        }

        if (hasPendingRegexChanges()) {
            installRegexChatReloadVisibilityObserver();
            scheduleRegexChatReloadVisibilityCheck();
        }
    }
}

async function flushPendingRegexScriptSave(entry) {
    switch (entry.scriptType) {
        case REGEX_SCRIPT_TYPES.GLOBAL:
            extension_settings.regex = entry.scripts;
            break;
        case REGEX_SCRIPT_TYPES.SCOPED:
            await writeExtensionField(entry.characterId, 'regex_scripts', entry.scripts);
            break;
        case REGEX_SCRIPT_TYPES.PRESET: {
            const presetManager = getPresetManager(entry.apiId);

            if (!presetManager) {
                throw new Error(`Preset manager not found for API: ${entry.apiId}`);
            }

            await presetManager.writePresetExtensionField({
                name: entry.presetName,
                path: 'regex_scripts',
                value: entry.scripts,
            });
            break;
        }
        default:
            break;
    }
}

function removeRegexChatReloadVisibilityWatch() {
    const state = getRegexQuickOperationState();
    clearTimeout(state.chatReloadVisibilityTimer);
    state.chatReloadVisibilityTimer = null;

    if (state.chatReloadVisibilityObserver) {
        state.chatReloadVisibilityObserver.disconnect();
        state.chatReloadVisibilityObserver = null;
    }
}

function isRegexPanelVisible() {
    const extensionsPanel = document.querySelector(REGEX_EXTENSIONS_PANEL_SELECTOR);

    if (!isRegexReloadVisibilityElementVisible(extensionsPanel)) {
        return false;
    }

    return true;
}

function isRegexReloadVisibilityElementVisible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || element.getClientRects().length === 0) {
        return false;
    }

    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

async function reloadCurrentChatForRegexChange() {
    if (getCurrentChatId()) {
        await reloadCurrentChat();
    }
}

function updateRegexBulkControls() {
    if (isRegexVueManagerActive()) {
        updateRegexVueBulkControls();
        return;
    }

    const checkboxes = $(`${REGEX_CONTAINER_SELECTOR} .regex_bulk_checkbox`);
    const allAreChecked = checkboxes.length > 0 && checkboxes.length === checkboxes.filter(':checked').length;
    const selectAllIcon = $('#bulk_select_all_toggle').find('i');

    selectAllIcon.toggleClass('fa-check-double', !allAreChecked);
    selectAllIcon.toggleClass('fa-minus', allAreChecked);

    const hasGlobalScripts = $('#saved_regex_scripts .regex-script-label:has(.regex_bulk_checkbox:checked)').length > 0;
    const hasScopedScripts = $('#saved_scoped_scripts .regex-script-label:has(.regex_bulk_checkbox:checked)').length > 0;
    const hasPresetScripts = $('#saved_preset_scripts .regex-script-label:has(.regex_bulk_checkbox:checked)').length > 0;

    $('#bulk_regex_move_to_global').toggle(hasScopedScripts || hasPresetScripts);
    $('#bulk_regex_move_to_scoped').toggle(hasGlobalScripts || hasPresetScripts);
    $('#bulk_regex_move_to_preset').toggle(hasGlobalScripts || hasScopedScripts);
}

function updateRegexVueBulkControls() {
    const manager = getRegexVueManagerState();
    const selectedContexts = getRegexVueSelectedContexts();
    const allIds = getAllRegexVueScriptIds();
    const selectedIds = manager.state?.selectedIds ?? {};
    const allAreChecked = allIds.length > 0 && allIds.every(id => selectedIds[id]);
    const selectAllIcon = $('#bulk_select_all_toggle').find('i');

    selectAllIcon.toggleClass('fa-check-double', !allAreChecked);
    selectAllIcon.toggleClass('fa-minus', allAreChecked);

    const hasGlobalScripts = selectedContexts.some(context => context.scriptType === REGEX_SCRIPT_TYPES.GLOBAL);
    const hasScopedScripts = selectedContexts.some(context => context.scriptType === REGEX_SCRIPT_TYPES.SCOPED);
    const hasPresetScripts = selectedContexts.some(context => context.scriptType === REGEX_SCRIPT_TYPES.PRESET);

    $('#bulk_regex_move_to_global').toggle(hasScopedScripts || hasPresetScripts);
    $('#bulk_regex_move_to_scoped').toggle(hasGlobalScripts || hasPresetScripts);
    $('#bulk_regex_move_to_preset').toggle(hasGlobalScripts || hasScopedScripts);
}

function applyWorldInfoDrawerOptimization() {
    if (extensionState[WORLD_INFO_DRAWER_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handleWorldInfoDrawerToggleClick(event);
    };

    extensionState[WORLD_INFO_DRAWER_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function applyWorldInfoLazySelect2Optimization() {
    if (extensionState[WORLD_INFO_LAZY_SELECT2_PATCH_KEY]) {
        return;
    }

    const originalSelect2 = globalThis.jQuery?.fn?.select2;

    if (typeof originalSelect2 !== 'function') {
        console.warn(`${LOG_PREFIX} Select2 is unavailable; World Info lazy select2 optimization was not installed`);
        return;
    }

    function patchedSelect2(...args) {
        if (!shouldAttemptWorldInfoLazySelect2(args)) {
            return originalSelect2.apply(this, args);
        }

        const elements = this.toArray();

        if (!elements.some(element => shouldDeferWorldInfoSelect2(element))) {
            return originalSelect2.apply(this, args);
        }

        elements.forEach(element => {
            const control = $(element);

            if (shouldDeferWorldInfoSelect2(element)) {
                deferWorldInfoSelect2(element, args, originalSelect2);
            } else {
                originalSelect2.apply(control, args);
            }
        });

        return this;
    }

    patchedSelect2.__baiBaiToolkitWorldInfoLazySelect2Patched = true;
    patchedSelect2.__baiBaiToolkitOriginalSelect2 = originalSelect2;
    Object.assign(patchedSelect2, originalSelect2);
    globalThis.jQuery.fn.select2 = patchedSelect2;
    extensionState[WORLD_INFO_LAZY_SELECT2_PATCH_KEY] = true;
}

function applyWorldInfoCharacterFilterOptionsOptimization() {
    if (extensionState[WORLD_INFO_CHARACTER_FILTER_APPEND_PATCH_KEY]) {
        return;
    }

    const originalAppend = globalThis.jQuery?.fn?.append;

    if (typeof originalAppend !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery.append is unavailable; World Info character filter option optimization was not installed`);
        return;
    }

    function patchedAppend(...args) {
        if (shouldDeferWorldInfoCharacterFilterAppend(this, args)) {
            deferWorldInfoCharacterFilterOption(this[0], args[0]);
            return this;
        }

        return originalAppend.apply(this, args);
    }

    patchedAppend.__baiBaiToolkitWorldInfoCharacterFilterAppendPatched = true;
    patchedAppend.__baiBaiToolkitOriginalAppend = originalAppend;
    Object.assign(patchedAppend, originalAppend);
    globalThis.jQuery.fn.append = patchedAppend;
    extensionState[WORLD_INFO_CHARACTER_FILTER_APPEND_PATCH_KEY] = true;
}

function applyCharacterSearchInputOptimization() {
    const state = extensionState[CHARACTER_SEARCH_OPTIMIZATION_KEY] || {
        installed: false,
        isComposing: false,
        debounceTimer: null,
    };
    extensionState[CHARACTER_SEARCH_OPTIMIZATION_KEY] = state;

    // Retry finding the input if it's not available immediately (e.g. ST not fully initialized)
    const originalInput = document.getElementById('character_search_bar');
    if (!originalInput) {
        if (!state.retryTimer) {
            state.retryTimer = setTimeout(() => {
                state.retryTimer = null;
                applyCharacterSearchInputOptimization();
            }, 1000);
        }
        return;
    }

    if (settings.characterSearchInputOptimizationEnabled) {
        if (!state.installed) {
            installCharacterSearchInputOptimization(state, originalInput);
        }
    } else {
        if (state.installed) {
            removeCharacterSearchInputOptimization(state, originalInput);
        }
    }
}

function installCharacterSearchInputOptimization(state, originalInput) {
    if (state.installed) return;

    state.installed = true;
    state.isComposing = false;
    state.isBypassingSync = false;

    state.compositionStartHandler = (e) => {
        if (e.target === originalInput) {
            state.isComposing = true;
        }
    };

    state.compositionEndHandler = (e) => {
        if (e.target === originalInput) {
            state.isComposing = false;
            triggerCharacterSearch(state, originalInput);
        }
    };

    state.inputCaptureHandler = (e) => {
        if (e.target !== originalInput) return;

        // If we fired this event intentionally, let it pass to ST's handler
        if (state.isBypassingSync) return;

        // If this event was not triggered by user interaction (e.g. ST clears input using val('').trigger('input'))
        // we should let it pass immediately, so other UI logic isn't artificially delayed by 300ms.
        if (!e.isTrusted) return;

        // Otherwise intercept and stop it
        e.stopImmediatePropagation();
        e.stopPropagation();

        if (!state.isComposing) {
            triggerCharacterSearch(state, originalInput);
        }
    };

    // We must use capture: true to intercept the events before ST's jQuery listeners get them
    originalInput.addEventListener('compositionstart', state.compositionStartHandler, true);
    originalInput.addEventListener('compositionend', state.compositionEndHandler, true);
    originalInput.addEventListener('input', state.inputCaptureHandler, true);
}

function triggerCharacterSearch(state, originalInput, timeout = 300) {
    clearTimeout(state.debounceTimer);

    state.debounceTimer = setTimeout(() => {
        if (!state.installed) return;

        // Fire a synthetic input event that our capture handler will let through
        state.isBypassingSync = true;

        if (window.jQuery) {
            window.jQuery(originalInput).trigger('input');
        } else {
            originalInput.dispatchEvent(new Event('input', { bubbles: true }));
        }

        state.isBypassingSync = false;
    }, timeout);
}

function removeCharacterSearchInputOptimization(state, originalInput) {
    if (state.retryTimer) {
        clearTimeout(state.retryTimer);
        state.retryTimer = null;
    }

    if (!state.installed) return;

    originalInput.removeEventListener('compositionstart', state.compositionStartHandler, true);
    originalInput.removeEventListener('compositionend', state.compositionEndHandler, true);
    originalInput.removeEventListener('input', state.inputCaptureHandler, true);

    clearTimeout(state.debounceTimer);

    state.installed = false;
}

function getCharacterListAvatarLazyLoadState() {
    if (!extensionState[CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY] || typeof extensionState[CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY] !== 'object') {
        extensionState[CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY] = {};
    }

    return extensionState[CHARACTER_LIST_AVATAR_LAZY_LOAD_KEY];
}

function applyCharacterListAvatarLazyLoadOptimization() {
    if (settings.characterListAvatarLazyLoadEnabled) {
        installCharacterListAvatarLazyLoadOptimization();
    } else {
        restoreCharacterListAvatarLazyLoadOptimization();
    }
}

function installCharacterListAvatarLazyLoadOptimization() {
    const state = getCharacterListAvatarLazyLoadState();
    state.enabled = true;

    installCharacterListAvatarLazyLoadStyle();

    if (typeof IntersectionObserver !== 'function') {
        applyNativeCharacterListImageHints();
        console.warn(`${LOG_PREFIX} IntersectionObserver is unavailable; character list avatar lazy loading fell back to native image hints`);
        return;
    }

    installCharacterListAvatarIntersectionObserver(state);
    installCharacterListAvatarAppendPatch(state);
    installCharacterListAvatarNativeAppendPatch(state);
    installCharacterListAvatarMutationObserver(state);
    installCharacterListAvatarPageLoadedHandler(state);
    scheduleProcessCharacterListAvatars(state);
}

function restoreCharacterListAvatarLazyLoadOptimization() {
    const state = getCharacterListAvatarLazyLoadState();
    state.enabled = false;

    if (state.processTimer) {
        clearTimeout(state.processTimer);
        state.processTimer = null;
    }

    state.mutationObserver?.disconnect();
    state.mutationObserver = null;
    state.intersectionObserver?.disconnect();
    state.intersectionObserver = null;

    if (state.characterPageLoadedHandler) {
        eventSource.removeListener?.(event_types.CHARACTER_PAGE_LOADED, state.characterPageLoadedHandler);
        state.characterPageLoadedHandler = null;
    }

    restoreCharacterListAvatarAppendPatch(state);
    restoreCharacterListAvatarNativeAppendPatch(state);
    restorePendingCharacterListAvatars();
    removeCharacterListAvatarLazyLoadStyle();
}

function installCharacterListAvatarAppendPatch(state) {
    const originalAppend = globalThis.jQuery?.fn?.append;

    if (typeof originalAppend !== 'function' || state.patchedAppend === originalAppend) {
        return;
    }

    if (state.patchedAppend && globalThis.jQuery.fn.append === state.patchedAppend) {
        return;
    }

    function patchedAppend(...args) {
        if (settings.characterListAvatarLazyLoadEnabled && shouldPrepareCharacterListAppend(this)) {
            prepareCharacterListAvatarAppendArguments(args, state);
        }

        const result = originalAppend.apply(this, args);

        if (settings.characterListAvatarLazyLoadEnabled && shouldPrepareCharacterListAppend(this)) {
            scheduleProcessCharacterListAvatars(state);
        }

        return result;
    }

    patchedAppend.__baiBaiToolkitCharacterListAvatarLazyLoadPatched = true;
    patchedAppend.__baiBaiToolkitOriginalAppend = originalAppend;
    Object.assign(patchedAppend, originalAppend);

    state.originalAppend = originalAppend;
    state.patchedAppend = patchedAppend;
    globalThis.jQuery.fn.append = patchedAppend;
}

function restoreCharacterListAvatarAppendPatch(state) {
    if (!state.patchedAppend || !globalThis.jQuery?.fn) {
        return;
    }

    if (globalThis.jQuery.fn.append === state.patchedAppend && typeof state.originalAppend === 'function') {
        globalThis.jQuery.fn.append = state.originalAppend;
    }

    state.originalAppend = null;
    state.patchedAppend = null;
}

function installCharacterListAvatarNativeAppendPatch(state) {
    const originalAppend = typeof Element !== 'undefined' ? Element.prototype.append : null;

    if (typeof originalAppend !== 'function' || state.patchedNativeAppend === originalAppend) {
        return;
    }

    if (state.patchedNativeAppend && Element.prototype.append === state.patchedNativeAppend) {
        return;
    }

    function patchedNativeAppend(...args) {
        if (settings.characterListAvatarLazyLoadEnabled && shouldPrepareCharacterListNativeAppend(this)) {
            prepareCharacterListAvatarAppendArguments(args, state);
        }

        const result = originalAppend.apply(this, args);

        if (settings.characterListAvatarLazyLoadEnabled && shouldPrepareCharacterListNativeAppend(this)) {
            scheduleProcessCharacterListAvatars(state);
        }

        return result;
    }

    patchedNativeAppend.__baiBaiToolkitCharacterListAvatarLazyLoadPatched = true;
    patchedNativeAppend.__baiBaiToolkitOriginalAppend = originalAppend;

    state.originalNativeAppend = originalAppend;
    state.patchedNativeAppend = patchedNativeAppend;
    Element.prototype.append = patchedNativeAppend;
}

function restoreCharacterListAvatarNativeAppendPatch(state) {
    if (!state.patchedNativeAppend || typeof Element === 'undefined') {
        return;
    }

    if (Element.prototype.append === state.patchedNativeAppend && typeof state.originalNativeAppend === 'function') {
        Element.prototype.append = state.originalNativeAppend;
    }

    state.originalNativeAppend = null;
    state.patchedNativeAppend = null;
}

function shouldPrepareCharacterListAppend(targets) {
    if (!targets || typeof targets.length !== 'number') {
        return false;
    }

    for (const target of targets) {
        if (target instanceof Element && target.matches(AVATAR_LAZY_LOAD_APPEND_TARGET_SELECTOR)) {
            return true;
        }
    }

    return false;
}

function shouldPrepareCharacterListNativeAppend(target) {
    return target instanceof Element && target.matches(AVATAR_LAZY_LOAD_NATIVE_APPEND_TARGET_SELECTOR);
}

function prepareCharacterListAvatarAppendArguments(args, state) {
    for (const arg of args) {
        prepareCharacterListAvatarAppendArgument(arg, state);
    }
}

function prepareCharacterListAvatarAppendArgument(arg, state) {
    if (!arg) {
        return;
    }

    if (arg instanceof Node) {
        deferCharacterListAvatarNode(arg, state, { requireListContainer: false, observe: false });
        return;
    }

    if (arg.jquery && typeof arg.each === 'function') {
        arg.each((_, element) => {
            if (element instanceof Node) {
                deferCharacterListAvatarNode(element, state, { requireListContainer: false, observe: false });
            }
        });
        return;
    }

    if (Array.isArray(arg)) {
        for (const item of arg) {
            prepareCharacterListAvatarAppendArgument(item, state);
        }
    }
}

function installCharacterListAvatarMutationObserver(state) {
    if (state.mutationObserver) {
        return;
    }

    const root = document.body || document.documentElement;

    if (!root) {
        return;
    }

    state.mutationObserver = new MutationObserver((mutations) => {
        if (!settings.characterListAvatarLazyLoadEnabled || !state.enabled) {
            return;
        }

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                deferCharacterListAvatarNode(node, state);
            }
        }
    });

    state.mutationObserver.observe(root, { childList: true, subtree: true });
}

function installCharacterListAvatarPageLoadedHandler(state) {
    if (state.characterPageLoadedHandler) {
        return;
    }

    state.characterPageLoadedHandler = () => scheduleProcessCharacterListAvatars(state);
    eventSource.on(event_types.CHARACTER_PAGE_LOADED, state.characterPageLoadedHandler);
}

function installCharacterListAvatarIntersectionObserver(state) {
    if (state.intersectionObserver) {
        return;
    }

    state.intersectionObserver = new IntersectionObserver((entries) => {
        for (const entry of entries) {
            if (entry.isIntersecting || entry.intersectionRatio > 0) {
                loadCharacterListAvatar(entry.target, state);
            }
        }
    }, {
        root: null,
        rootMargin: CHARACTER_LIST_LAZY_AVATAR_ROOT_MARGIN,
        threshold: 0,
    });
}

function scheduleProcessCharacterListAvatars(state) {
    if (state.processTimer) {
        clearTimeout(state.processTimer);
    }

    state.processTimer = setTimeout(() => {
        state.processTimer = null;
        processCharacterListAvatars(state);
    }, 0);
}

function processCharacterListAvatars(state) {
    if (!settings.characterListAvatarLazyLoadEnabled || !state.enabled) {
        return;
    }

    if (typeof IntersectionObserver !== 'function') {
        applyNativeCharacterListImageHints();
        return;
    }

    if (!state.intersectionObserver) {
        installCharacterListAvatarIntersectionObserver(state);
    }

    document.querySelectorAll(AVATAR_LAZY_LOAD_SELECTOR).forEach(img => {
        deferCharacterListAvatarImage(img, state, { requireListContainer: true, observe: true });
    });
}

function deferCharacterListAvatarNode(node, state, { requireListContainer = true, observe = true } = {}) {
    if (!(node instanceof Element)) {
        return;
    }

    if (node instanceof HTMLImageElement) {
        deferCharacterListAvatarImage(node, state, { requireListContainer, observe });
    }

    const selector = requireListContainer ? AVATAR_LAZY_LOAD_SELECTOR : AVATAR_LAZY_LOAD_RELATIVE_SELECTOR;
    node.querySelectorAll?.(selector).forEach(img => {
        deferCharacterListAvatarImage(img, state, { requireListContainer, observe });
    });
}

function deferCharacterListAvatarImage(img, state, { requireListContainer = true, observe = true } = {}) {
    if (!(img instanceof HTMLImageElement)) {
        return;
    }

    if (requireListContainer && !img.matches(AVATAR_LAZY_LOAD_SELECTOR)) {
        return;
    }

    if (!requireListContainer && !img.matches(AVATAR_LAZY_LOAD_RELATIVE_SELECTOR)) {
        return;
    }

    const pendingSrc = img.dataset[CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY];

    if (pendingSrc) {
        observeCharacterListAvatar(img, state, observe);
        return;
    }

    const src = img.getAttribute('src') || '';

    if (!isCharacterListAvatarThumbnailUrl(src)) {
        applyCharacterListImageHints(img);
        return;
    }

    img.dataset[CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY] = src;
    img.setAttribute('src', CHARACTER_LIST_LAZY_AVATAR_PLACEHOLDER_SRC);
    img.classList.add(CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS);
    img.classList.remove(CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS);
    img.closest('.avatar')?.classList.add(CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS);
    applyCharacterListImageHints(img);
    observeCharacterListAvatar(img, state, observe);
}

function observeCharacterListAvatar(img, state, observe) {
    if (!observe || !state?.intersectionObserver || !document.documentElement.contains(img)) {
        return;
    }

    state.intersectionObserver.observe(img);
}

function loadCharacterListAvatar(target, state = getCharacterListAvatarLazyLoadState()) {
    if (!(target instanceof HTMLImageElement)) {
        return;
    }

    const src = target.dataset[CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY];

    if (!src) {
        state?.intersectionObserver?.unobserve(target);
        return;
    }

    state?.intersectionObserver?.unobserve(target);
    target.dataset[CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY] = '';
    delete target.dataset[CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY];
    target.classList.remove(CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS);
    target.classList.add(CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS);
    target.closest('.avatar')?.classList.remove(CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS);
    target.setAttribute('src', src);
    applyCharacterListImageHints(target);
}

function restorePendingCharacterListAvatars() {
    const datasetSelector = `img[data-${toKebabCase(CHARACTER_LIST_LAZY_AVATAR_SRC_DATASET_KEY)}]`;
    document.querySelectorAll(datasetSelector).forEach(img => loadCharacterListAvatar(img));
    document.querySelectorAll(`.${CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS}`).forEach(img => {
        img.classList.remove(CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS);
    });
    document.querySelectorAll(`.${CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS}`).forEach(element => {
        element.classList.remove(CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS);
    });
}

function applyNativeCharacterListImageHints() {
    document.querySelectorAll(AVATAR_LAZY_LOAD_SELECTOR).forEach(img => {
        if (img instanceof HTMLImageElement) {
            applyCharacterListImageHints(img);
        }
    });
}

function applyCharacterListImageHints(img) {
    img.loading = 'lazy';
    img.decoding = 'async';
    img.setAttribute('fetchpriority', 'low');
}

function isCharacterListAvatarThumbnailUrl(src) {
    if (!src || src === CHARACTER_LIST_LAZY_AVATAR_PLACEHOLDER_SRC) {
        return false;
    }

    try {
        const url = new URL(src, location.origin);
        const type = url.searchParams.get('type');
        return url.origin === location.origin
            && url.pathname === '/thumbnail'
            && (type === 'avatar' || type === 'persona')
            && url.searchParams.has('file');
    } catch {
        return false;
    }
}

function installCharacterListAvatarLazyLoadStyle() {
    let style = document.getElementById(CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
${CHARACTER_LIST_SELECTOR} .character_select {
    content-visibility: auto;
    contain-intrinsic-size: 72px;
}

${PERSONA_LIST_SELECTOR} .avatar-container,
${WELCOME_RECENT_CHAT_SELECTOR} {
    content-visibility: auto;
    contain-intrinsic-size: 72px;
}

body.charListGrid ${CHARACTER_LIST_SELECTOR} .character_select {
    contain-intrinsic-size: 160px 120px;
}

${CHARACTER_LIST_SELECTOR} .${CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS},
${PERSONA_LIST_SELECTOR} .${CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS},
${WELCOME_RECENT_CHAT_SELECTOR} .${CHARACTER_LIST_LAZY_AVATAR_SHELL_CLASS} {
    background: var(--SmartThemeBlurTintColor);
}

${CHARACTER_LIST_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS},
${PERSONA_LIST_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS},
${WELCOME_RECENT_CHAT_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_PENDING_CLASS} {
    opacity: 0.01;
}

${CHARACTER_LIST_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS},
${PERSONA_LIST_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS},
${WELCOME_RECENT_CHAT_SELECTOR} img.${CHARACTER_LIST_LAZY_AVATAR_LOADED_CLASS} {
    opacity: 1;
    transition: opacity 120ms ease;
}
`;
}

function removeCharacterListAvatarLazyLoadStyle() {
    document.getElementById(CHARACTER_LIST_AVATAR_LAZY_LOAD_STYLE_ID)?.remove();
}

function shouldDeferWorldInfoCharacterFilterAppend(targets, args) {
    if (!settings.worldInfoDrawerOptimizationEnabled) {
        return false;
    }

    if (targets.length !== 1 || args.length !== 1) {
        return false;
    }

    const element = targets[0];
    const option = args[0];

    return element instanceof HTMLSelectElement
        && option instanceof HTMLOptionElement
        && element.matches('#world_popup_entries_list .world_entry_edit select[name="characterFilter"]')
        && element.dataset[WORLD_INFO_LAZY_SELECT2_DATASET_KEY] === 'true';
}

function deferWorldInfoCharacterFilterOption(select, option) {
    extensionState.worldInfoDeferredCharacterFilterOptions ??= new WeakMap();

    const options = extensionState.worldInfoDeferredCharacterFilterOptions.get(select) ?? [];
    options.push(option);
    extensionState.worldInfoDeferredCharacterFilterOptions.set(select, options);
    select.dataset[WORLD_INFO_DEFERRED_OPTIONS_DATASET_KEY] = 'true';
}

function initializeDeferredWorldInfoCharacterFilterOptions(select) {
    const options = extensionState.worldInfoDeferredCharacterFilterOptions?.get(select);

    if (!options?.length) {
        return;
    }

    const fragment = document.createDocumentFragment();

    for (const option of options) {
        fragment.append(option);
    }

    extensionState.worldInfoDeferredCharacterFilterOptions.delete(select);
    delete select.dataset[WORLD_INFO_DEFERRED_OPTIONS_DATASET_KEY];
    select.append(fragment);
}

function shouldAttemptWorldInfoLazySelect2(args) {
    if (!settings.worldInfoDrawerOptimizationEnabled) {
        return false;
    }

    const firstArg = args[0];
    return typeof firstArg === 'object' && firstArg !== null && !Array.isArray(firstArg);
}

function shouldDeferWorldInfoSelect2(element) {
    if (!(element instanceof HTMLSelectElement)) {
        return false;
    }

    if (!element.matches(WORLD_INFO_LAZY_SELECT2_SELECTOR)) {
        return false;
    }

    if ($(element).data('select2')) {
        return false;
    }

    return element.dataset[WORLD_INFO_LAZY_SELECT2_DATASET_KEY] !== 'true';
}

function deferWorldInfoSelect2(element, args, originalSelect2) {
    element.dataset[WORLD_INFO_LAZY_SELECT2_DATASET_KEY] = 'true';
    element.classList.add('bai-bai-toolkit-lazy-select2');

    const state = {
        args: [...args],
        originalSelect2,
    };

    const activate = (event) => {
        initializeDeferredWorldInfoSelect2(element, { open: event?.type === 'pointerdown' || event?.type === 'mousedown' });
    };

    state.activate = activate;
    extensionState.worldInfoLazySelect2State ??= new WeakMap();
    extensionState.worldInfoLazySelect2State.set(element, state);

    element.addEventListener('pointerdown', activate, { capture: true });
    element.addEventListener('mousedown', activate, { capture: true });
    element.addEventListener('focus', activate, { capture: true });
}

function initializeDeferredWorldInfoSelect2(target, { open = false } = {}) {
    const elements = target instanceof Element
        ? [target]
        : Array.from(target.querySelectorAll?.(`select[data-${toKebabCase(WORLD_INFO_LAZY_SELECT2_DATASET_KEY)}="true"]`) ?? []);

    for (const element of elements) {
        const state = extensionState.worldInfoLazySelect2State?.get(element);

        if (!state) {
            continue;
        }

        element.removeEventListener('pointerdown', state.activate, true);
        element.removeEventListener('mousedown', state.activate, true);
        element.removeEventListener('focus', state.activate, true);
        delete element.dataset[WORLD_INFO_LAZY_SELECT2_DATASET_KEY];
        element.classList.remove('bai-bai-toolkit-lazy-select2');
        extensionState.worldInfoLazySelect2State.delete(element);

        initializeDeferredWorldInfoCharacterFilterOptions(element);
        state.originalSelect2.apply($(element), state.args);

        if (open && $(element).data('select2')) {
            setTimeout(() => {
                try {
                    $(element).select2('open');
                } catch {
                    // Ignore controls that were detached while the open was queued.
                }
            }, 0);
        }
    }
}

function toKebabCase(value) {
    return String(value).replace(/[A-Z]/g, match => `-${match.toLowerCase()}`);
}

function handleWorldInfoDrawerToggleClick(event) {
    if (!settings.worldInfoDrawerOptimizationEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest(WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR);

    if (!target || !toggle || !toggle.contains(target)) {
        return;
    }

    if (target.classList.contains('text_pole')) {
        return;
    }

    const drawer = toggle.closest(WORLD_INFO_ENTRY_DRAWER_SELECTOR);
    const icon = drawer?.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
    const content = drawer?.querySelector(':scope > .inline-drawer-content');

    if (!drawer || !icon || !content) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    $(content).stop(true, true);

    const expand = getComputedStyle(content).display === 'none';

    icon.classList.toggle('down', !expand);
    icon.classList.toggle('up', expand);
    icon.classList.toggle('fa-circle-chevron-down', !expand);
    icon.classList.toggle('fa-circle-chevron-up', expand);

    if (expand && !content.querySelector(':scope > .world_entry_edit')) {
        $(drawer).trigger('inline-drawer-toggle');
    }

    content.style.display = expand ? 'block' : 'none';
    content.style.height = '';

    if (!CSS.supports('field-sizing', 'content')) {
        content.querySelectorAll('textarea.autoSetHeight').forEach(textarea => {
            void resetScrollHeight(textarea);
        });
    }
}

function dispatchDescriptionEditorSourceInput(source) {
    let event = null;

    try {
        event = typeof InputEvent === 'function'
            ? new InputEvent('input', {
                bubbles: true,
                inputType: 'insertReplacementText',
                data: '',
            })
            : null;
    } catch {
        event = null;
    }

    event ||= new Event('input', { bubbles: true });

    source.dispatchEvent(event);
}

function applyDescriptionCodeMirrorEditorOptimization() {
    if (settings.descriptionCodeMirrorEditorEnabled) {
        installDescriptionCodeMirrorEditorOptimization();
    } else {
        removeDescriptionCodeMirrorEditorOptimization();
    }
}

function installDescriptionCodeMirrorEditorOptimization() {
    const state = getDescriptionCodeMirrorEditorState();
    state.enabled = true;

    applyDescriptionCodeMirrorEditorStyle();
    installDescriptionCodeMirrorEditorGlobalListeners(state);
    refreshDescriptionCodeMirrorEditorTarget(state);
    installDescriptionCodeMirrorEditorMutationObserver(state);
}

function removeDescriptionCodeMirrorEditorOptimization() {
    const state = extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY];

    if (!state) {
        return;
    }

    flushDescriptionCodeMirrorEditor('disable', { dispatchInput: false, save: false });
    state.enabled = false;
    clearDescriptionCodeMirrorEditorTimer(state);

    if (state.refreshFrame) {
        cancelAnimationFrame(state.refreshFrame);
        state.refreshFrame = 0;
    }

    state.mutationObserver?.disconnect();
    state.mutationObserver = null;
    detachDescriptionCodeMirrorEditor(state);

    for (const listener of state.globalListeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.globalListeners = [];
    removeDescriptionCodeMirrorEditorStyle();
    delete extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY];
}

function getDescriptionCodeMirrorEditorState() {
    if (!extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY]) {
        extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY] = {
            enabled: false,
            source: null,
            wrapper: null,
            view: null,
            listeners: [],
            globalListeners: [],
            mutationObserver: null,
            refreshFrame: 0,
            timer: 0,
            dirty: false,
            flushing: false,
            loadingToken: null,
        };
    }

    return extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY];
}

function installDescriptionCodeMirrorEditorGlobalListeners(state) {
    if (state.globalListeners.length > 0) {
        return;
    }

    const clickHandler = (event) => {
        if (event.target instanceof Element && event.target.closest('#create_button')) {
            flushDescriptionCodeMirrorEditor('manual save click', { dispatchInput: false, save: false });
        }
    };
    const submitHandler = (event) => {
        if (event.target instanceof HTMLFormElement && event.target.matches('#form_create')) {
            flushDescriptionCodeMirrorEditor('form submit', { dispatchInput: false, save: false });
        }
    };
    const pageLifecycleHandler = () => {
        flushDescriptionCodeMirrorEditor('page lifecycle', { dispatchInput: false, save: false });
    };

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('submit', submitHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);

    state.globalListeners.push(
        { target: document, type: 'click', handler: clickHandler, options: true },
        { target: document, type: 'submit', handler: submitHandler, options: true },
        { target: window, type: 'pagehide', handler: pageLifecycleHandler, options: undefined },
        { target: document, type: 'visibilitychange', handler: pageLifecycleHandler, options: undefined },
    );
}

function installDescriptionCodeMirrorEditorMutationObserver(state) {
    if (state.mutationObserver || typeof MutationObserver !== 'function') {
        return;
    }

    const root = document.body || document.documentElement;

    if (!root) {
        return;
    }

    state.mutationObserver = new MutationObserver((mutations) => {
        if (areDescriptionCodeMirrorMutationsInternal(state, mutations)) {
            return;
        }

        scheduleDescriptionCodeMirrorEditorRefresh(state);
    });
    state.mutationObserver.observe(root, { childList: true, subtree: true });
}

function areDescriptionCodeMirrorMutationsInternal(state, mutations) {
    const wrapper = state.wrapper;

    if (!(wrapper instanceof HTMLElement)) {
        return false;
    }

    return mutations.every((mutation) => {
        if (mutation.target instanceof Node && wrapper.contains(mutation.target)) {
            return true;
        }

        for (const node of mutation.addedNodes) {
            if (!(node instanceof Node) || !wrapper.contains(node)) {
                return false;
            }
        }

        for (const node of mutation.removedNodes) {
            if (!(node instanceof Node) || !wrapper.contains(node)) {
                return false;
            }
        }

        return mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0;
    });
}

function scheduleDescriptionCodeMirrorEditorRefresh(state = extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY]) {
    if (!state?.enabled || state.refreshFrame) {
        return;
    }

    state.refreshFrame = requestAnimationFrame(() => {
        state.refreshFrame = 0;
        refreshDescriptionCodeMirrorEditorTarget(state);
    });
}

function refreshDescriptionCodeMirrorEditorTarget(state) {
    if (!state?.enabled) {
        return;
    }

    const source = document.querySelector(DESCRIPTION_EDITOR_SOURCE_SELECTOR);

    if (!(source instanceof HTMLTextAreaElement) || !source.isConnected) {
        detachDescriptionCodeMirrorEditor(state);
        return;
    }

    if (state.source === source && state.wrapper?.isConnected) {
        syncDescriptionCodeMirrorFromSourceIfClean(state);
        return;
    }

    detachDescriptionCodeMirrorEditor(state);
    attachDescriptionCodeMirrorEditor(state, source);
}

function attachDescriptionCodeMirrorEditor(state, source) {
    const wrapper = document.createElement('div');

    wrapper.id = DESCRIPTION_CODEMIRROR_EDITOR_ID;
    wrapper.className = DESCRIPTION_CODEMIRROR_EDITOR_CLASS;
    wrapper.textContent = 'Loading CodeMirror...';
    source.classList.add(DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS);
    source.insertAdjacentElement('afterend', wrapper);

    state.source = source;
    state.wrapper = wrapper;
    state.dirty = false;

    const focusOutHandler = () => {
        setTimeout(() => {
            if (state.dirty && state.wrapper && !state.wrapper.contains(document.activeElement)) {
                scheduleDescriptionCodeMirrorEditorFlush(state, 'blur', DESCRIPTION_CODEMIRROR_BLUR_SAVE_DELAY_MS);
            }
        }, 0);
    };

    const stopPropagationHandler = (event) => {
        event.stopPropagation();
    };

    wrapper.addEventListener('mousedown', stopPropagationHandler);
    wrapper.addEventListener('pointerdown', stopPropagationHandler);
    wrapper.addEventListener('click', stopPropagationHandler);
    wrapper.addEventListener('focusout', focusOutHandler);

    state.listeners.push(
        { target: wrapper, type: 'mousedown', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'pointerdown', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'click', handler: stopPropagationHandler, options: undefined },
        { target: wrapper, type: 'focusout', handler: focusOutHandler, options: undefined }
    );

    const loadingToken = {};
    state.loadingToken = loadingToken;

    void loadDescriptionCodeMirrorModules()
        .then((modules) => {
            if (!state.enabled || state.source !== source || state.wrapper !== wrapper || state.loadingToken !== loadingToken || !wrapper.isConnected) {
                return;
            }

            createDescriptionCodeMirrorView(state, source, wrapper, modules);
        })
        .catch((error) => {
            console.warn(`${LOG_PREFIX} CodeMirror description editor failed; falling back to stock textarea.`, error);

            if (state.enabled && state.source === source && state.wrapper === wrapper && state.loadingToken === loadingToken) {
                settings.descriptionCodeMirrorEditorEnabled = false;
                saveExtensionSettings();
                $('#bai_bai_toolkit_description_codemirror_editor_enabled').prop('checked', false);
                removeDescriptionCodeMirrorEditorOptimization();
            }
        });
}

async function loadDescriptionCodeMirrorModules() {
    if (extensionState[DESCRIPTION_CODEMIRROR_MODULES_KEY]) {
        return extensionState[DESCRIPTION_CODEMIRROR_MODULES_KEY];
    }

    const localUrl = new URL(DESCRIPTION_CODEMIRROR_LOCAL_BUNDLE_PATH, import.meta.url).href;

    try {
        const localBundle = await import(localUrl);

        if (localBundle.EditorState && localBundle.EditorView) {
            extensionState[DESCRIPTION_CODEMIRROR_MODULES_KEY] = localBundle;
            return localBundle;
        }
    } catch {
        // No local bundle is expected during early testing.
    }

    const [stateModule, viewModule, commandsModule, cssModule, languageModule, highlightModule, oneDarkModule] = await Promise.all([
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.state),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.view),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.commands),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.css).catch(() => ({})),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.language).catch(() => ({})),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.highlight).catch(() => ({})),
        import(DESCRIPTION_CODEMIRROR_CDN_MODULES.oneDark).catch(() => ({})),
    ]);

    const modules = {
        EditorState: stateModule.EditorState,
        EditorView: viewModule.EditorView,
        keymap: viewModule.keymap,
        defaultKeymap: commandsModule.defaultKeymap,
        history: commandsModule.history,
        historyKeymap: commandsModule.historyKeymap,
        css: cssModule.css,
        defaultHighlightStyle: languageModule.defaultHighlightStyle,
        HighlightStyle: languageModule.HighlightStyle,
        syntaxHighlighting: languageModule.syntaxHighlighting,
        classHighlighter: highlightModule.classHighlighter,
        tags: highlightModule.tags,
        oneDarkHighlightStyle: oneDarkModule.oneDarkHighlightStyle,
        oneDarkTheme: oneDarkModule.oneDarkTheme,
        oneDarkColor: oneDarkModule.color,
    };

    if (!modules.EditorState || !modules.EditorView) {
        throw new Error('CodeMirror modules did not expose EditorState/EditorView');
    }

    extensionState[DESCRIPTION_CODEMIRROR_MODULES_KEY] = modules;
    return modules;
}

function createDescriptionCodeMirrorView(state, source, wrapper, modules) {
    const {
        EditorState,
        EditorView,
        keymap,
        defaultKeymap = [],
        history,
        historyKeymap = [],
    } = modules;
    const useHistory = source.value.length <= DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH;

    const extensions = [
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
            if (update.docChanged) {
                state.dirty = true;
            }
        }),
        EditorView.domEventHandlers({
            beforeinput(event) {
                event.stopPropagation();
                return false;
            },
            input(event) {
                event.stopPropagation();
                return false;
            },
            keydown(event) {
                event.stopPropagation();
                return false;
            },
            keyup(event) {
                event.stopPropagation();
                return false;
            },
            click(event) {
                event.stopPropagation();
                return false;
            },
            mousedown(event) {
                event.stopPropagation();
                return false;
            },
            pointerdown(event) {
                event.stopPropagation();
                return false;
            },
            scroll() {
                return false;
            },
        }),
        EditorView.theme({
            '&': {
                backgroundColor: 'var(--SmartThemeBlurTintColor)',
                border: '1px solid var(--SmartThemeBorderColor)',
                borderRadius: '4px',
                contain: 'layout paint style',
                color: 'var(--SmartThemeBodyColor)',
                font: 'inherit',
                minHeight: 'min(42vh, 420px)',
                textShadow: 'none',
            },
            '&.cm-focused': {
                outline: 'none',
            },
            '.cm-scroller': {
                fontFamily: 'inherit',
                lineHeight: '1.35',
                maxHeight: '55vh',
                minHeight: 'min(42vh, 420px)',
                overflow: 'auto',
                overflowAnchor: 'none',
                overscrollBehavior: 'auto',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
            },
            '.cm-content': {
                caretColor: 'var(--SmartThemeBodyColor)',
                contain: 'layout paint style',
                padding: '8px',
                textShadow: 'none',
                minHeight: 'min(42vh, 420px)',
            },
            '.cm-line': {
                padding: '0',
            },
        }),
    ];

    if (useHistory && typeof history === 'function') {
        extensions.push(history());
    }

    if (typeof keymap?.of === 'function') {
        extensions.push(keymap.of(useHistory ? [...defaultKeymap, ...historyKeymap] : defaultKeymap));
    }

    if (EditorView.contentAttributes?.of) {
        extensions.push(EditorView.contentAttributes.of({
            autocomplete: 'off',
            autocapitalize: 'off',
            autocorrect: 'off',
            spellcheck: 'false',
            'aria-label': source.getAttribute('aria-label') || '角色描述',
        }));
    }

    wrapper.textContent = '';
    state.view = new EditorView({
        state: EditorState.create({
            doc: source.value || '',
            extensions,
        }),
        parent: wrapper,
    });
}

function detachDescriptionCodeMirrorEditor(state) {
    if (!state.source && !state.wrapper && !state.view) {
        return;
    }

    clearDescriptionCodeMirrorEditorTimer(state);

    for (const listener of state.listeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.listeners = [];
    state.view?.destroy?.();
    state.source?.classList.remove(DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS);
    state.wrapper?.remove();
    state.source = null;
    state.wrapper = null;
    state.view = null;
    state.dirty = false;
    state.loadingToken = null;
}

function getDescriptionCodeMirrorValue(state) {
    return state.view?.state?.doc?.toString?.() ?? '';
}

function syncDescriptionCodeMirrorToSourceSilently(state) {
    if (!(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    const value = getDescriptionCodeMirrorValue(state);
    const changed = state.source.value !== value;

    if (changed) {
        state.source.value = value;
    }

    return changed;
}

function syncDescriptionCodeMirrorFromSourceIfClean(state) {
    if (state.dirty || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return;
    }

    const value = state.source.value || '';
    const current = getDescriptionCodeMirrorValue(state);

    if (current !== value) {
        state.view.dispatch({
            changes: {
                from: 0,
                to: state.view.state.doc.length,
                insert: value,
            },
        });
        state.dirty = false;
    }
}

function scheduleDescriptionCodeMirrorEditorFlush(state, reason, delayMs) {
    if (!state?.enabled || state.flushing) {
        return;
    }

    clearDescriptionCodeMirrorEditorTimer(state);
    state.timer = setTimeout(() => {
        state.timer = 0;
        flushDescriptionCodeMirrorEditor(`deferred ${reason}`, { dispatchInput: true, save: true });
    }, delayMs);
}

function clearDescriptionCodeMirrorEditorTimer(state) {
    if (state?.timer) {
        clearTimeout(state.timer);
        state.timer = 0;
    }
}

function flushDescriptionCodeMirrorEditor(reason, { dispatchInput = true, save = true } = {}) {
    const state = extensionState[DESCRIPTION_CODEMIRROR_EDITOR_KEY];

    if (!state?.enabled || state.flushing || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    clearDescriptionCodeMirrorEditorTimer(state);
    state.flushing = true;

    try {
        const changed = syncDescriptionCodeMirrorToSourceSilently(state) || state.dirty;
        state.dirty = false;

        if (changed && dispatchInput) {
            dispatchDescriptionEditorSourceInput(state.source);
        }

        if (changed && save && isExistingCharacterEditForm()) {
            document.querySelector('#create_button')?.click();
            console.debug(`${LOG_PREFIX} CodeMirror description editor flushed after ${reason}`);
        }

        return changed;
    } finally {
        state.flushing = false;
    }
}

function applyDescriptionCodeMirrorEditorStyle() {
    let style = document.getElementById(DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#${DESCRIPTION_CODEMIRROR_EDITOR_ID} {
    box-sizing: border-box;
    display: block;
    width: 100%;
}

.${DESCRIPTION_EDITOR_SOURCE_HIDDEN_CLASS} {
    display: none !important;
}
`;
}

function removeDescriptionCodeMirrorEditorStyle() {
    document.getElementById(DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID)?.remove();
}

function isExistingCharacterEditForm() {
    return document.querySelector('#form_create')?.getAttribute('actiontype') === 'editcharacter';
}

function patchAutoCompletePositioning() {
    const originalUpdatePosition = AutoComplete.prototype.updatePosition;

    if (typeof originalUpdatePosition !== 'function' || originalUpdatePosition.__mobileResizeGuardPatched) {
        return;
    }

    function guardedUpdatePosition(...args) {
        if (!this.isActive) {
            return;
        }

        return originalUpdatePosition.apply(this, args);
    }

    guardedUpdatePosition.__mobileResizeGuardPatched = true;
    guardedUpdatePosition.__mobileResizeGuardOriginal = originalUpdatePosition;
    extensionState.originalAutoCompleteUpdatePosition = originalUpdatePosition;
    AutoComplete.prototype.updatePosition = guardedUpdatePosition;
}

function restoreAutoCompletePositioning() {
    const currentUpdatePosition = AutoComplete.prototype.updatePosition;

    if (currentUpdatePosition?.__mobileResizeGuardPatched) {
        AutoComplete.prototype.updatePosition = currentUpdatePosition.__mobileResizeGuardOriginal;
    }
}

function patchPowerUserResizeHandler() {
    if (extensionState.powerUserResizeReplacement) {
        return;
    }

    const resizeHandlers = $._data(window, 'events')?.resize;

    if (!Array.isArray(resizeHandlers)) {
        console.warn(`${LOG_PREFIX} Window resize handlers are unavailable`);
        return;
    }

    const stockHandlerEntry = resizeHandlers.find(({ handler }) => isPowerUserResizeHandler(handler));

    if (!stockHandlerEntry) {
        console.warn(`${LOG_PREFIX} Could not locate the stock power-user resize handler`);
        return;
    }

    $(window).off('resize', stockHandlerEntry.handler);
    extensionState.originalPowerUserResizeHandler = stockHandlerEntry.handler;

    const adjustAutocompleteDebounced = debounce(() => {
        $('.ui-autocomplete-input').each(function () {
            try {
                const widget = $(this).autocomplete('widget')?.[0];
                const isOpen = widget?.style.display !== 'none';

                if (isOpen) {
                    $(this).autocomplete('search');
                }
            } catch {
                // Ignore detached or no-longer-initialized widgets.
            }
        });
    });

    const setHotswapsDebounced = debounce(favsToHotswap);
    const reportZoomLevelDebounced = debounce(() => {
        const zoomLevel = parseFloat(Number(window.devicePixelRatio).toFixed(2)) || 1;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const originalWidth = winWidth * zoomLevel;
        const originalHeight = winHeight * zoomLevel;
        console.debug(`${LOG_PREFIX} Window resize: ${coreTruthWinWidth}x${coreTruthWinHeight} -> ${window.innerWidth}x${window.innerHeight}`);
        console.debug(`${LOG_PREFIX} Zoom: ${zoomLevel}, X:${winWidth}, Y:${winHeight}, original: ${originalWidth}x${originalHeight}`);
        return zoomLevel;
    });

    let coreTruthWinWidth = window.innerWidth;
    let coreTruthWinHeight = window.innerHeight;

    const replacementHandler = async () => {
        if (isMobile()) {
            return;
        }

        adjustAutocompleteDebounced();
        setHotswapsDebounced();
        reportZoomLevelDebounced();

        const scaleY = parseFloat(Number(window.innerHeight / coreTruthWinHeight).toFixed(4));
        const scaleX = parseFloat(Number(window.innerWidth / coreTruthWinWidth).toFixed(4));

        if (Object.keys(power_user.movingUIState).length > 0) {
            for (const elmntName of Object.keys(power_user.movingUIState)) {
                const elmntState = power_user.movingUIState[elmntName];
                const oldHeight = elmntState.height;
                const oldWidth = elmntState.width;
                const oldLeft = elmntState.left;
                const oldTop = elmntState.top;
                const oldBottom = elmntState.bottom;
                const oldRight = elmntState.right;

                const newHeight = Number(oldHeight * scaleY).toFixed(0);
                const newWidth = Number(oldWidth * scaleX).toFixed(0);
                const newLeft = Number(oldLeft * scaleX).toFixed(0);
                const newTop = Number(oldTop * scaleY).toFixed(0);
                const newBottom = Number(oldBottom * scaleY).toFixed(0);
                const newRight = Number(oldRight * scaleX).toFixed(0);

                try {
                    const elmnt = $('#' + $.escapeSelector(elmntName));

                    if (elmnt.length) {
                        elmnt.css('height', newHeight);
                        elmnt.css('width', newWidth);
                        elmnt.css('inset', `${newTop}px ${newRight}px ${newBottom}px ${newLeft}px`);
                        power_user.movingUIState[elmntName].height = newHeight;
                        power_user.movingUIState[elmntName].width = newWidth;
                        power_user.movingUIState[elmntName].top = newTop;
                        power_user.movingUIState[elmntName].bottom = newBottom;
                        power_user.movingUIState[elmntName].left = newLeft;
                        power_user.movingUIState[elmntName].right = newRight;
                    }
                } catch (error) {
                    console.debug(`${LOG_PREFIX} Failed to rescale moving UI element`, elmntName, error);
                }
            }
        }

        saveSettingsDebounced();
        coreTruthWinWidth = window.innerWidth;
        coreTruthWinHeight = window.innerHeight;
    };

    replacementHandler.__mobileResizeGuardReplacement = true;
    extensionState.powerUserResizeReplacement = replacementHandler;
    $(window).on('resize', replacementHandler);
}

function restorePowerUserResizeHandler() {
    const replacementHandler = extensionState.powerUserResizeReplacement;
    const originalHandler = extensionState.originalPowerUserResizeHandler;

    if (replacementHandler) {
        $(window).off('resize', replacementHandler);
        extensionState.powerUserResizeReplacement = null;
    }

    if (typeof originalHandler !== 'function') {
        return;
    }

    const resizeHandlers = $._data(window, 'events')?.resize;
    const hasOriginalHandler = Array.isArray(resizeHandlers)
        && resizeHandlers.some(({ handler }) => handler === originalHandler);

    if (!hasOriginalHandler) {
        $(window).on('resize', originalHandler);
    }
}

function isPowerUserResizeHandler(handler) {
    if (typeof handler !== 'function') {
        return false;
    }

    if (handler.__mobileResizeGuardReplacement) {
        return false;
    }

    const source = String(handler);
    return source.includes('adjustAutocompleteDebounced')
        && source.includes('setHotswapsDebounced')
        && source.includes('power_user.movingUIState');
}

function applyFastChatGetOptimization() {
    const hook = installFastChatGetFetchHook();
    if (hook) {
        hook.isEnabled = () => settings.progressiveChatLoadingEnabled === true;
    }

    installFastChatGetInteractionGuard();
}

function getFastChatGetState() {
    if (!extensionState.fastChatGet || typeof extensionState.fastChatGet !== 'object') {
        extensionState.fastChatGet = {
            requestId: 0,
            current: null,
            lastNoticeAt: 0,
        };
    }

    return extensionState.fastChatGet;
}

function installFastChatGetInteractionGuard() {
    const state = getFastChatGetState();
    if (state.interactionGuardInstalled) {
        return;
    }

    state.interactionGuardInstalled = true;

    document.addEventListener('click', (event) => {
        if (!isFastChatGetHydrating()) {
            return;
        }

        const target = event.target instanceof Element
            ? event.target.closest(FAST_CHAT_GET_ACTION_SELECTOR)
            : null;
        const messageMultiClick = event.target instanceof Element
            && event.detail >= 2
            && Boolean(event.target.closest('#chat .mes[mesid]'));

        if (!target && !messageMultiClick) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        notifyFastChatGetBlocked();
    }, true);

    document.addEventListener('keydown', (event) => {
        if (!isFastChatGetHydrating()) {
            return;
        }

        const target = event.target;
        const isSendEnter = target instanceof HTMLElement
            && target.id === 'send_textarea'
            && event.key === 'Enter'
            && (event.ctrlKey || event.metaKey || !event.shiftKey);

        if (!isSendEnter) {
            return;
        }

        event.preventDefault();
        event.stopImmediatePropagation();
        notifyFastChatGetBlocked();
    }, true);
}

function isFastChatGetHydrating() {
    const current = getFastChatGetState().current;
    return settings.progressiveChatLoadingEnabled === true
        && Boolean(current?.loadingFull);
}

function notifyFastChatGetBlocked() {
    const state = getFastChatGetState();
    const now = Date.now();
    if (now - Number(state.lastNoticeAt || 0) < 1500) {
        return;
    }

    state.lastNoticeAt = now;
    if (globalThis.toastr?.info) {
        globalThis.toastr.info('聊天记录正在补全，请稍候再操作。', '柏宝库');
    }
}

function installFastChatGetFetchHook() {
    const existing = globalThis[FAST_CHAT_GET_FETCH_KEY];
    if (existing?.wrappedFetch) {
        return existing;
    }

    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        isEnabled: () => settings.progressiveChatLoadingEnabled === true,
    };

    state.wrappedFetch = async function baiBaiToolkitFastChatGetFetch(input, init) {
        try {
            if (isFastChatGetSaveRequest(input, init) && isFastChatGetHydrating()) {
                notifyFastChatGetBlocked();
                return buildFastChatGetBlockedResponse();
            }

            if (!state.isEnabled()) {
                return state.originalFetch(input, init);
            }

            const requestInfo = await getFastChatGetRequestInfo(input, init);
            if (!requestInfo) {
                return state.originalFetch(input, init);
            }

            return await fetchFastChatInitial(state.originalFetch, requestInfo, input, init);
        } catch (error) {
            console.debug(`${LOG_PREFIX} Fast chat get path failed; falling back to native chat get`, error);
            return state.originalFetch(input, init);
        }
    };

    state.wrappedFetch[FAST_CHAT_GET_FETCH_KEY] = true;
    globalThis[FAST_CHAT_GET_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function isFastChatGetSaveRequest(input, init) {
    const rawUrl = getFetchRequestUrl(input);
    if (!rawUrl || getFetchRequestMethod(input, init) !== 'POST') {
        return false;
    }

    try {
        const url = new URL(rawUrl, location.href);
        return url.origin === location.origin && FAST_CHAT_GET_SAVE_PATHS.has(url.pathname);
    } catch {
        return false;
    }
}

async function getFastChatGetRequestInfo(input, init) {
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

    if (url.origin !== location.origin || !FAST_CHAT_GET_PATHS.has(url.pathname)) {
        return null;
    }

    const body = await readFetchJsonBody(input, init);
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
        return null;
    }

    return {
        path: url.pathname,
        body,
    };
}

async function fetchFastChatInitial(fetchFn, requestInfo, input, init) {
    const response = await fetchFastChatPayload(fetchFn, input, init, {
        source: requestInfo.path,
        mode: 'initial',
        originalRequest: requestInfo.body,
        thresholdBytes: FAST_CHAT_GET_DEFAULT_THRESHOLD_BYTES,
        initialMessages: getFastChatInitialMessageCount(),
    });

    const data = normalizeFastChatGetPayload(response);
    if (!Array.isArray(data.chat)) {
        throw new Error('BaiBaoKu fast chat get returned a non-array chat payload');
    }

    if (data.kind === 'partial' || data.meta?.partial === true) {
        beginFastChatHydration(fetchFn, requestInfo, input, init, data);
    } else {
        clearFastChatHydration();
    }

    return buildFastChatGetArrayResponse(data.chat);
}

async function fetchFastChatPayload(fetchFn, input, init, payload) {
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
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify(payload),
    };

    const response = await fetchFn(BAIBAOKU_FAST_CHAT_GET_URL, fastInit);
    const json = await response.clone().json().catch(() => null);
    if (!response?.ok || !json) {
        throw new Error(`Unexpected status ${response?.status || 'unknown'}`);
    }

    const data = json?.data && typeof json.data === 'object' ? json.data : json;
    if (json?.ok === false || data?.ok === false) {
        throw new Error(json?.message || json?.error?.message || data?.message || data?.error?.message || 'BaiBaoKu fast chat get failed');
    }

    return data;
}

function normalizeFastChatGetPayload(data) {
    if (!data || typeof data !== 'object') {
        throw new Error('BaiBaoKu fast chat get returned an invalid payload');
    }

    return {
        kind: String(data.kind || (data.meta?.partial ? 'partial' : 'complete')),
        chat: data.chat,
        meta: data.meta && typeof data.meta === 'object' ? data.meta : {},
    };
}

function beginFastChatHydration(fetchFn, requestInfo, input, init, data) {
    const state = getFastChatGetState();
    const meta = data.meta || {};
    const hydration = {
        requestId: Number(state.requestId || 0) + 1,
        loadingFull: true,
        source: requestInfo.path,
        originalRequest: requestInfo.body,
        chatKey: String(meta.chatKey || ''),
        version: String(meta.version || ''),
        messageStartIndex: Math.max(0, Number(meta.messageStartIndex || 0)),
        returnedMessages: Math.max(0, Number(meta.returnedMessages || getChatMessagesFromResponseChat(data.chat).length || 0)),
        currentChatId: getCurrentChatId?.() ?? '',
        startedAt: Date.now(),
    };

    state.requestId = hydration.requestId;
    state.current = hydration;
    document.body?.classList.add('bai-bai-toolkit-fast-chat-hydrating');

    void hydrateFastChatInBackground(fetchFn, input, init, hydration)
        .catch((error) => {
            console.warn(`${LOG_PREFIX} Fast chat hydration failed`, error);
            if (getFastChatGetState().current?.requestId === hydration.requestId && globalThis.toastr?.error) {
                globalThis.toastr.error('聊天记录补全失败，请重新进入当前聊天。', '柏宝库');
            }
        });
}

async function hydrateFastChatInBackground(fetchFn, input, init, hydration) {
    const payload = {
        source: hydration.source,
        mode: 'full',
        originalRequest: hydration.originalRequest,
        chatKey: hydration.chatKey,
        version: hydration.version,
    };

    let data;
    try {
        data = normalizeFastChatGetPayload(await fetchFastChatPayload(fetchFn, input, init, payload));
    } catch (error) {
        console.debug(`${LOG_PREFIX} BaiBaoKu full chat get failed; trying native chat get`, error);
        data = {
            kind: 'full',
            chat: await fetchNativeFullChat(fetchFn, hydration),
            meta: {
                chatKey: hydration.chatKey,
                version: hydration.version,
            },
        };
    }

    if (!isCurrentFastChatHydration(hydration, data.meta)) {
        if (getFastChatGetState().current?.requestId === hydration.requestId) {
            clearFastChatHydration(hydration.requestId);
            if (globalThis.toastr?.warning) {
                globalThis.toastr.warning('聊天记录补全状态已过期，请重新进入当前聊天。', '柏宝库');
            }
        }
        return;
    }

    completeFastChatHydration(hydration, data);
}

async function fetchNativeFullChat(fetchFn, hydration) {
    const headers = new Headers(getRequestHeaders());
    if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json');
    }

    const response = await fetchFn(hydration.source, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify(hydration.originalRequest || {}),
    });
    const data = await response.clone().json().catch(() => null);
    if (!response?.ok || !Array.isArray(data)) {
        throw new Error(`Native chat get returned ${response?.status || 'invalid data'}`);
    }

    return data;
}

function isCurrentFastChatHydration(hydration, meta = {}) {
    const current = getFastChatGetState().current;
    if (!current || current.requestId !== hydration.requestId || !current.loadingFull) {
        return false;
    }

    if (hydration.chatKey && meta?.chatKey && String(meta.chatKey) !== hydration.chatKey) {
        return false;
    }

    if (hydration.version && meta?.version && String(meta.version) !== hydration.version) {
        return false;
    }

    const currentChatId = getCurrentChatId?.() ?? '';
    return String(currentChatId) === String(hydration.currentChatId);
}

function completeFastChatHydration(hydration, data) {
    const messages = getChatMessagesFromResponseChat(data.chat);
    if (!messages.length && Array.isArray(data.chat) && data.chat.length > 0) {
        throw new Error('Full chat payload did not contain messages');
    }

    const chatArray = Array.isArray(scriptModule.chat) ? scriptModule.chat : null;
    if (!chatArray) {
        throw new Error('SillyTavern chat array is unavailable');
    }

    const chatElement = document.querySelector('#chat');
    const scrollSnapshot = getFastChatScrollSnapshot(chatElement);

    chatArray.splice(0, chatArray.length, ...messages);
    scheduleFastChatDomCorrection(hydration);
    syncFastChatShowMoreButton(messages.length);
    emitFastChatHydratedEvents();
    restoreFastChatScrollSnapshot(chatElement, scrollSnapshot);
    clearFastChatHydration(hydration.requestId);

    console.debug(`${LOG_PREFIX} Fast chat hydration completed`, {
        messages: messages.length,
        start: hydration.messageStartIndex,
        returned: hydration.returnedMessages,
    });
}

function getChatMessagesFromResponseChat(chat) {
    if (!Array.isArray(chat)) {
        return [];
    }

    if (chat[0]?.chat_metadata) {
        return chat.slice(1);
    }

    return chat;
}

function correctFastChatDomMessageIds(hydration) {
    const messages = [...document.querySelectorAll('#chat .mes[mesid]')]
        .filter(element => element instanceof HTMLElement);

    messages.forEach((element, index) => {
        const realId = hydration.messageStartIndex + index;
        element.setAttribute('mesid', String(realId));
        element.dataset.mesid = String(realId);
        element.dataset.messageId = String(realId);

        const display = element.querySelector('.mesIDDisplay');
        if (display instanceof HTMLElement) {
            display.textContent = `#${realId}`;
        }
    });
}

function scheduleFastChatDomCorrection(hydration) {
    correctFastChatDomMessageIds(hydration);
    requestAnimationFrame(() => correctFastChatDomMessageIds(hydration));
    setTimeout(() => correctFastChatDomMessageIds(hydration), 100);
    setTimeout(() => correctFastChatDomMessageIds(hydration), 500);
}

function syncFastChatShowMoreButton(fullMessageCount) {
    const button = document.querySelector('#show_more_messages');
    if (!(button instanceof HTMLElement)) {
        return;
    }

    const renderedMessages = document.querySelectorAll('#chat .mes[mesid]').length;
    if (renderedMessages <= 0 || renderedMessages >= fullMessageCount) {
        return;
    }

    button.classList.remove('disabled', 'displayNone', 'hidden');
    button.removeAttribute('disabled');
    button.removeAttribute('aria-disabled');
    button.style.display = '';
}

function emitFastChatHydratedEvents() {
    try {
        if (event_types.MORE_MESSAGES_LOADED) {
            eventSource.emit(event_types.MORE_MESSAGES_LOADED);
        }
        if (event_types.CHAT_LOADED) {
            eventSource.emit(event_types.CHAT_LOADED);
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to emit fast chat hydration events`, error);
    }
}

function clearFastChatHydration(requestId = null) {
    const state = getFastChatGetState();
    if (requestId !== null && state.current?.requestId !== requestId) {
        return;
    }

    state.current = null;
    document.body?.classList.remove('bai-bai-toolkit-fast-chat-hydrating');
}

function getFastChatInitialMessageCount() {
    const truncation = Number(power_user?.chat_truncation);
    if (Number.isInteger(truncation) && truncation > 0) {
        return truncation;
    }

    return FAST_CHAT_GET_DEFAULT_INITIAL_MESSAGES;
}

function buildFastChatGetArrayResponse(chat) {
    return new Response(JSON.stringify(chat), {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function buildFastChatGetBlockedResponse() {
    return new Response(JSON.stringify({
        error: true,
        message: 'Chat is still hydrating. Please wait for the full chat to load.',
    }), {
        status: 409,
        statusText: 'Conflict',
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

function getFastChatScrollSnapshot(chatElement) {
    if (!(chatElement instanceof HTMLElement)) {
        return null;
    }

    return {
        top: chatElement.scrollTop,
        height: chatElement.scrollHeight,
    };
}

function restoreFastChatScrollSnapshot(chatElement, snapshot) {
    if (!(chatElement instanceof HTMLElement) || !snapshot) {
        return;
    }

    const restore = () => {
        const delta = chatElement.scrollHeight - snapshot.height;
        chatElement.scrollTop = Math.max(0, snapshot.top + delta);
    };

    restore();
    requestAnimationFrame(restore);
}

function disableFastSettingsBootstrapFetchHook() {
    const existing = globalThis[FAST_SETTINGS_BOOTSTRAP_FETCH_KEY];

    if (!existing?.wrappedFetch) {
        return;
    }

    existing.isEnabled = () => false;
    existing.cachedBootstrapTextPromise = null;
    existing.cachedBootstrapTextExpiresAt = 0;

    if (globalThis.fetch === existing.wrappedFetch && typeof existing.originalFetch === 'function') {
        globalThis.fetch = existing.originalFetch;
    }
}

function installFastSettingsBootstrapFetchHook() {
    const existing = globalThis[FAST_SETTINGS_BOOTSTRAP_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => false;
        return existing;
    }

    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        cachedBootstrapTextPromise: null,
        cachedBootstrapTextExpiresAt: 0,
        hitCount: 0,
        isEnabled: () => false,
    };

    state.wrappedFetch = async function baiBaiToolkitFastSettingsBootstrapFetch(input, init) {
        try {
            if (!state.isEnabled()) {
                return state.originalFetch(input, init);
            }

            if (!(await isFastSettingsBootstrapRequest(input, init))) {
                return state.originalFetch(input, init);
            }

            state.hitCount += 1;
            console.debug(`${LOG_PREFIX} Fast settings bootstrap intercept #${state.hitCount}`);
            return await fetchFastSettingsBootstrap(state.originalFetch, input, init, state);
        } catch (error) {
            console.debug(`${LOG_PREFIX} Fast settings bootstrap path failed; falling back to /api/settings/get`, error);
            return state.originalFetch(input, init);
        }
    };

    state.wrappedFetch[FAST_SETTINGS_BOOTSTRAP_FETCH_KEY] = true;
    globalThis[FAST_SETTINGS_BOOTSTRAP_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

async function isFastSettingsBootstrapRequest(input, init) {
    const rawUrl = getFetchRequestUrl(input);

    if (!rawUrl || getFetchRequestMethod(input, init) !== 'POST') {
        return false;
    }

    try {
        const url = new URL(rawUrl, location.href);
        if (url.origin !== location.origin || url.pathname !== '/api/settings/get') {
            return false;
        }
    } catch {
        return false;
    }

    const body = await readFetchJsonBody(input, init);
    if (body === null) {
        return !hasFetchBody(input, init);
    }

    return isPlainEmptyObject(body);
}

async function fetchFastSettingsBootstrap(fetchFn, input, init, state) {
    const text = await getFastSettingsBootstrapText(fetchFn, input, init, state);
    return new Response(text, {
        status: 200,
        statusText: 'OK',
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

async function getFastSettingsBootstrapText(fetchFn, input, init, state) {
    const cacheExpired = state.cachedBootstrapTextExpiresAt > 0 && Date.now() > state.cachedBootstrapTextExpiresAt;
    if (!state.cachedBootstrapTextPromise || cacheExpired) {
        state.cachedBootstrapTextPromise = fetchFastSettingsBootstrapText(fetchFn, input, init)
            .then((text) => {
                state.cachedBootstrapTextExpiresAt = Date.now() + FAST_SETTINGS_BOOTSTRAP_CACHE_MS;
                return text;
            })
            .catch((error) => {
                state.cachedBootstrapTextPromise = null;
                state.cachedBootstrapTextExpiresAt = 0;
                throw error;
            });
    }

    return await state.cachedBootstrapTextPromise;
}

async function fetchFastSettingsBootstrapText(fetchFn, input, init) {
    const headers = buildFetchHeaders(input, init);
    const requestHeaders = getRequestHeaders();
    for (const [key, value] of Object.entries(requestHeaders || {})) {
        if (!headers.has(key)) {
            headers.set(key, value);
        }
    }

    const fastInit = {
        ...copyFetchRequestOptions(input, init),
        ...(init || {}),
        method: 'POST',
        headers,
    };
    delete fastInit.body;

    const response = await fetchFn('/api/plugins/baibaoku/v1/settings/fast-bootstrap', fastInit);
    if (!response?.ok) {
        throw new Error(`Unexpected status ${response?.status || 'unknown'}`);
    }

    const text = await response.text();
    const data = parseJsonOrNull(text);
    if (!data || typeof data.settings !== 'string' || !data.bootstrap?.partial) {
        throw new Error('Fast settings bootstrap returned an invalid payload');
    }

    return text;
}

function installFastCharacterListFetchHook() {
    const existing = globalThis[FAST_CHARACTER_LIST_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => false;
        return existing;
    }

    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        isEnabled: () => false,
    };

    state.wrappedFetch = async function baiBaiToolkitFastCharacterListFetch(input, init) {
        try {
            if (!state.isEnabled()) {
                return state.originalFetch(input, init);
            }

            if (!(await isFastCharacterListRequest(input, init))) {
                return state.originalFetch(input, init);
            }

            return await fetchFastCharacterList(state.originalFetch, input, init);
        } catch (error) {
            console.debug(`${LOG_PREFIX} Fast character list path failed; falling back to /api/characters/all`, error);
            return state.originalFetch(input, init);
        }
    };

    state.wrappedFetch[FAST_CHARACTER_LIST_FETCH_KEY] = true;
    globalThis[FAST_CHARACTER_LIST_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function disableFastCharacterListFetchHook() {
    const existing = globalThis[FAST_CHARACTER_LIST_FETCH_KEY];

    if (!existing?.wrappedFetch) {
        return;
    }

    existing.isEnabled = () => false;

    if (globalThis.fetch === existing.wrappedFetch && typeof existing.originalFetch === 'function') {
        globalThis.fetch = existing.originalFetch;
    }
}

async function isFastCharacterListRequest(input, init) {
    const rawUrl = getFetchRequestUrl(input);

    if (!rawUrl || getFetchRequestMethod(input, init) !== 'POST') {
        return false;
    }

    try {
        const url = new URL(rawUrl, location.href);
        if (url.origin !== location.origin || url.pathname !== '/api/characters/all') {
            return false;
        }
    } catch {
        return false;
    }

    const body = await readFetchJsonBody(input, init);
    return isPlainEmptyObject(body);
}

async function fetchFastCharacterList(fetchFn, input, init) {
    const headers = buildFetchHeaders(input, init);
    const requestHeaders = getRequestHeaders();
    for (const [key, value] of Object.entries(requestHeaders || {})) {
        if (!headers.has(key)) {
            headers.set(key, value);
        }
    }

    const fastInit = {
        ...copyFetchRequestOptions(input, init),
        ...(init || {}),
        method: 'POST',
        headers,
    };
    delete fastInit.body;

    const response = await fetchFn('/api/plugins/baibaoku/v1/characters/fast-all', fastInit);
    if (!response?.ok) {
        throw new Error(`Unexpected status ${response?.status || 'unknown'}`);
    }

    const data = await response.clone().json().catch(() => null);
    if (!Array.isArray(data)) {
        throw new Error('Fast character list returned a non-array payload');
    }

    return response;
}

async function readFetchJsonBody(input, init) {
    if (Object.prototype.hasOwnProperty.call(init || {}, 'body')) {
        const body = init.body;
        if (typeof body === 'string') {
            return parseJsonOrNull(body);
        }

        if (isFetchBlob(body)) {
            return parseJsonOrNull(await body.text());
        }
    }

    if (!isFetchRequest(input) || input.bodyUsed || !input.body) {
        return null;
    }

    try {
        return await input.clone().json().catch(() => null);
    } catch {
        return null;
    }
}

function hasFetchBody(input, init) {
    if (Object.prototype.hasOwnProperty.call(init || {}, 'body')) {
        const body = init.body;
        return body !== undefined && body !== null && body !== '';
    }

    return isFetchRequest(input) && Boolean(input.body);
}

function parseJsonOrNull(text) {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
}

function isPlainEmptyObject(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return false;
    }

    return Object.getPrototypeOf(value) === Object.prototype && Object.keys(value).length === 0;
}

function installSaveRequestGzipFetchHook() {
    const existing = globalThis[SAVE_REQUEST_GZIP_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => settings.saveRequestGzipEnabled !== false;
        return existing;
    }

    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        isEnabled: () => settings.saveRequestGzipEnabled !== false,
    };

    state.wrappedFetch = async function baiBaiToolkitSaveRequestGzipFetch(input, init) {
        try {
            if (!state.isEnabled()) {
                return state.originalFetch(input, init);
            }

            const gzipUrl = getSaveRequestGzipUrl(input);
            if (!gzipUrl) {
                return state.originalFetch(input, init);
            }

            const method = getFetchRequestMethod(input, init);
            if (!['POST', 'PUT', 'PATCH'].includes(method)) {
                return state.originalFetch(input, init);
            }

            const originalHeaders = buildFetchHeaders(input, init);
            if (originalHeaders.has('Content-Encoding')) {
                return state.originalFetch(input, init);
            }

            const bodyInfo = await getCompressibleFetchBody(input, init);
            if (!bodyInfo) {
                return state.originalFetch(input, init);
            }

            const compressedBody = await gzipFetchBody(bodyInfo.body, {
                method,
                path: gzipUrl.pathname,
                caller: getPerformanceTraceStackSummary(),
            });
            if (!compressedBody) {
                return state.originalFetch(input, init);
            }

            const headers = new Headers(originalHeaders);
            if (bodyInfo.contentType && !headers.has('Content-Type')) {
                headers.set('Content-Type', bodyInfo.contentType);
            }
            headers.set('Content-Encoding', 'gzip');
            headers.delete('Content-Length');

            const compressedInit = {
                ...(init || {}),
                method,
                headers,
                body: compressedBody,
            };

            try {
                const response = await state.originalFetch(input, compressedInit);
                if (!response?.ok) {
                    console.warn(`${LOG_PREFIX} Gzip save request returned ${response?.status || 'non-OK'}, retrying uncompressed.`);
                    const retry = buildUncompressedSaveRequestRetry(input, init, method, originalHeaders, bodyInfo);
                    return state.originalFetch(retry.input, retry.init);
                }
                return response;
            } catch (error) {
                console.warn(`${LOG_PREFIX} Gzip save request failed, retrying uncompressed:`, error);
                const retry = buildUncompressedSaveRequestRetry(input, init, method, originalHeaders, bodyInfo);
                return state.originalFetch(retry.input, retry.init);
            }
        } catch (error) {
            console.warn(`${LOG_PREFIX} Gzip save request skipped:`, error);
            return state.originalFetch(input, init);
        }
    };

    state.wrappedFetch[SAVE_REQUEST_GZIP_FETCH_KEY] = true;
    globalThis[SAVE_REQUEST_GZIP_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function getSaveRequestGzipUrl(input) {
    const rawUrl = getFetchRequestUrl(input);

    if (!rawUrl) {
        return null;
    }

    try {
        const url = new URL(rawUrl, location.href);
        const isSavePath = [...SAVE_REQUEST_GZIP_PATHS].some((path) => {
            return url.pathname === path || url.pathname.endsWith(path);
        });

        if (!isSavePath || isLocalOrPrivateHost(url.hostname)) {
            return null;
        }

        return url;
    } catch {
        return null;
    }
}

function getFetchRequestUrl(input) {
    if (typeof input === 'string') {
        return input;
    }

    if (typeof URL !== 'undefined' && input instanceof URL) {
        return input.href;
    }

    if (isFetchRequest(input)) {
        return input.url;
    }

    return '';
}

function getFetchRequestMethod(input, init) {
    return String(init?.method || (isFetchRequest(input) ? input.method : '') || 'GET').toUpperCase();
}

function buildFetchHeaders(input, init) {
    if (init?.headers) {
        return new Headers(init.headers);
    }

    if (isFetchRequest(input)) {
        return new Headers(input.headers);
    }

    return new Headers();
}

function copyFetchRequestOptions(input, init) {
    const requestOptions = {};
    if (!isFetchRequest(input)) {
        return requestOptions;
    }

    const optionKeys = [
        'cache',
        'credentials',
        'integrity',
        'keepalive',
        'mode',
        'redirect',
        'referrer',
        'referrerPolicy',
        'signal',
    ];

    for (const key of optionKeys) {
        if (init && Object.prototype.hasOwnProperty.call(init, key)) {
            continue;
        }

        const value = input[key];
        if (value !== undefined) {
            requestOptions[key] = value;
        }
    }

    return requestOptions;
}

function normalizeFetchBody(body) {
    if (body == null) {
        return null;
    }

    if (typeof body === 'string') {
        return body.length > 0 ? { body, contentType: 'text/plain;charset=UTF-8' } : null;
    }

    if (isFetchBlob(body)) {
        return body.size > 0 ? { body, contentType: body.type || '' } : null;
    }

    if (typeof ArrayBuffer !== 'undefined' && body instanceof ArrayBuffer) {
        return body.byteLength > 0 ? { body, contentType: '' } : null;
    }

    if (typeof ArrayBuffer !== 'undefined' && ArrayBuffer.isView(body)) {
        return body.byteLength > 0 ? { body, contentType: '' } : null;
    }

    if (isFetchUrlSearchParams(body)) {
        const text = body.toString();
        return text.length > 0 ? { body: text, contentType: 'application/x-www-form-urlencoded;charset=UTF-8' } : null;
    }

    if (isFetchFormData(body) || isFetchReadableStream(body)) {
        return null;
    }

    return null;
}

async function getCompressibleFetchBody(input, init) {
    if (Object.prototype.hasOwnProperty.call(init || {}, 'body')) {
        return normalizeFetchBody(init.body);
    }

    if (!isFetchRequest(input) || input.bodyUsed || !input.body) {
        return null;
    }

    const bodyBlob = await input.clone().blob();
    return bodyBlob.size > 0 ? { body: bodyBlob, contentType: bodyBlob.type || '' } : null;
}

async function gzipFetchBody(body, traceInfo = {}) {
    if (typeof CompressionStream !== 'function') {
        return null;
    }

    const source = isFetchBlob(body) ? body : new Blob([body]);
    const startedAt = performance.now();

    try {
        const compressedStream = source.stream().pipeThrough(new CompressionStream('gzip'));
        const compressedBlob = await new Response(compressedStream).blob();
        recordPerformanceTraceGzipCompression({
            ...traceInfo,
            startedAt,
            duration: performance.now() - startedAt,
            originalBytes: source.size,
            compressedBytes: compressedBlob.size,
        });

        return compressedBlob.size > 0 ? compressedBlob : null;
    } catch (error) {
        recordPerformanceTraceGzipCompression({
            ...traceInfo,
            startedAt,
            duration: performance.now() - startedAt,
            originalBytes: source.size,
            compressedBytes: 0,
            caller: `${traceInfo?.caller || ''} error=${error?.message || error}`,
        });
        throw error;
    }
}

function buildUncompressedSaveRequestRetry(input, init, method, originalHeaders, bodyInfo) {
    const headers = new Headers(originalHeaders);
    headers.delete('Content-Encoding');
    headers.delete('Content-Length');

    if (bodyInfo.contentType && !headers.has('Content-Type')) {
        headers.set('Content-Type', bodyInfo.contentType);
    }

    return {
        input: isFetchRequest(input) ? input.url : input,
        init: {
            ...copyFetchRequestOptions(input, init),
            ...(init || {}),
            method,
            headers,
            body: bodyInfo.body,
        },
    };
}

function isFetchRequest(value) {
    return typeof Request !== 'undefined' && value instanceof Request;
}

function isFetchBlob(value) {
    return typeof Blob !== 'undefined' && value instanceof Blob;
}

function isFetchUrlSearchParams(value) {
    return typeof URLSearchParams !== 'undefined' && value instanceof URLSearchParams;
}

function isFetchFormData(value) {
    return typeof FormData !== 'undefined' && value instanceof FormData;
}

function isFetchReadableStream(value) {
    return typeof ReadableStream !== 'undefined' && value instanceof ReadableStream;
}

function isLocalOrPrivateHost(hostname) {
    const host = normalizeHostname(hostname);

    if (!host) {
        return false;
    }

    if (host === 'localhost' || host.endsWith('.localhost')) {
        return true;
    }

    const ipv4Parts = parseIpv4Address(host);
    if (ipv4Parts) {
        return isLocalOrPrivateIpv4(ipv4Parts);
    }

    return isLocalOrPrivateIpv6(host);
}

function normalizeHostname(hostname) {
    return String(hostname || '')
        .trim()
        .toLowerCase()
        .replace(/^\[|\]$/g, '')
        .replace(/\.+$/g, '');
}

function parseIpv4Address(host) {
    const parts = host.split('.');

    if (parts.length !== 4) {
        return null;
    }

    const octets = [];
    for (const part of parts) {
        if (!/^\d{1,3}$/.test(part)) {
            return null;
        }

        const value = Number(part);
        if (!Number.isInteger(value) || value < 0 || value > 255) {
            return null;
        }

        octets.push(value);
    }

    return octets;
}

function isLocalOrPrivateIpv4([first, second]) {
    return first === 0
        || first === 10
        || first === 127
        || (first === 169 && second === 254)
        || (first === 172 && second >= 16 && second <= 31)
        || (first === 192 && second === 168);
}

function isLocalOrPrivateIpv6(host) {
    if (!host.includes(':')) {
        return false;
    }

    if (host === '::1' || host === '0:0:0:0:0:0:0:1') {
        return true;
    }

    if (host.startsWith('::ffff:')) {
        const ipv4Parts = parseIpv4Address(host.slice(7));
        return ipv4Parts ? isLocalOrPrivateIpv4(ipv4Parts) : false;
    }

    const firstGroup = host.split(':')[0];
    if (!/^[0-9a-f]{1,4}$/.test(firstGroup)) {
        return false;
    }

    const firstValue = parseInt(firstGroup, 16);
    return (firstValue & 0xfe00) === 0xfc00
        || (firstValue & 0xffc0) === 0xfe80;
}

