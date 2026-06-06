import {
    characters,
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    openCharacterChat,
    saveSettingsDebounced,
    selectCharacterById,
    setActiveCharacter,
    this_chid,
} from '../../../../script.js';
import * as scriptModule from '../../../../script.js';
import { AutoComplete } from '../../../autocomplete/AutoComplete.js';
import { extension_settings, extensionTypes, renderExtensionTemplateAsync } from '../../../extensions.js';
import { oai_settings, openai_setting_names, promptManager } from '../../../openai.js';
import { t } from '../../../i18n.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { INJECTION_POSITION } from '../../../PromptManager.js';
import { isMobile, favsToHotswap } from '../../../RossAscends-mods.js';
import { power_user } from '../../../power-user.js';
import { renderTemplateAsync } from '../../../templates.js';
import { isAdmin } from '../../../user.js';
import { debounce, escapeHtml, regexFromString, resetScrollHeight, setInfoBlock, timestampToMoment } from '../../../utils.js';
import { allowPresetScripts as allowRegexPresetScripts, allowScopedScripts as allowRegexScopedScripts, getCurrentPresetAPI as getRegexCurrentPresetAPI, getCurrentPresetName as getRegexCurrentPresetName, getScriptsByType as getRegexScriptsByType, runRegexScript, saveScriptsByType as saveRegexScriptsByType, SCRIPT_TYPES as REGEX_SCRIPT_TYPES, substitute_find_regex } from '../../regex/engine.js';

const LOG_PREFIX = '[柏宝箱]';
const MODULE_NAME = getModuleName();
const CURRENT_VERSION = '0.22.0';
const EXTENSION_ID = getExtensionId();
const SETTINGS_KEY = 'baiBaiToolkit';
const EXTENSION_KEY = '__baiBaiToolkitExtensionInstalled';
const FAST_CHAT_SEARCH_FETCH_KEY = '__baiBaiToolkitFastChatSearchFetchPatched';
const SAVE_REQUEST_GZIP_FETCH_KEY = '__baiBaiToolkitSaveRequestGzipFetchPatched';
const PERFORMANCE_TRACE_FETCH_KEY = '__baiBaiToolkitPerformanceTraceFetchPatched';
const TRANSLATE_MESSAGE_UPDATED_OPTIMIZATION_KEY = '__baiBaiToolkitTranslateMessageUpdatedOptimized';
const CUSTOM_CSS_INPUT_OPTIMIZATION_KEY = '__baiBaiToolkitCustomCssInputOptimized';
const CUSTOM_CSS_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitCustomCssCodeMirrorEditor';
const PRESET_PROMPT_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitPresetPromptCodeMirrorEditor';
const FAST_CHAT_LIST_SCROLL_STYLE_ID = 'bai_bai_toolkit_fast_chat_list_scroll_style';
const DESCRIPTION_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_description_codemirror_editor_style';
const CUSTOM_CSS_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_custom_css_codemirror_editor_style';
const PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_preset_prompt_codemirror_editor_style';
const PRESET_SCROLL_STYLE_ID = 'bai_bai_toolkit_preset_scroll_style';
const PRESET_DRAG_STYLE_ID = 'bai_bai_toolkit_preset_drag_style';
const LONG_CHAT_DOM_RENDER_STYLE_ID = 'bai_bai_toolkit_long_chat_dom_render_style';
const DESCRIPTION_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitDescriptionCodeMirrorEditor';
const DESCRIPTION_CODEMIRROR_MODULES_KEY = '__baiBaiToolkitDescriptionCodeMirrorModules';
const PRESET_DRAG_HANDLER_KEY = '__baiBaiToolkitPresetDragHandler';
const PRESET_DRAG_PATCH_KEY = '__baiBaiToolkitPresetDragPatch';
const PRESET_SWITCH_BEFORE_HANDLER_KEY = '__baiBaiToolkitPresetSwitchBeforeHandler';
const PRESET_SWITCH_HANDLER_KEY = '__baiBaiToolkitPresetSwitchHandler';
const PRESET_SELECT_CHANGE_HANDLER_KEY = '__baiBaiToolkitPresetSelectChangeHandler';
const PRESET_DELETE_HANDLER_KEY = '__baiBaiToolkitPresetDeleteHandler';
const PRESET_LIST_ACTION_HANDLER_KEY = '__baiBaiToolkitPresetListActionHandler';
const PRESET_TOGGLE_HANDLER_KEY = '__baiBaiToolkitPresetToggleHandler';
const PRESET_SAVE_HANDLER_KEY = '__baiBaiToolkitPresetSaveHandler';
const REGEX_QUICK_OPERATION_HANDLER_KEY = '__baiBaiToolkitRegexQuickOperationHandler';
const REGEX_QUICK_OPERATION_OBSERVER_KEY = '__baiBaiToolkitRegexQuickOperationObserver';
const CHAT_DELETE_EDIT_HANDLER_KEY = '__baiBaiToolkitChatDeleteEditHandler';
const CHAT_DELETE_MESSAGE_DELETED_HANDLER_KEY = '__baiBaiToolkitChatDeleteMessageDeletedHandler';
const CHAT_DELETE_GENERATION_ACTION_HANDLER_KEY = '__baiBaiToolkitChatDeleteGenerationActionHandler';
const WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY = '__baiBaiToolkitWelcomeRecentChatDirectOpenHandler';
const MOBILE_AUTO_KEYBOARD_HANDLER_KEY = '__baiBaiToolkitMobileAutoKeyboardHandler';
const MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardFocusPatched';
const MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardJQueryFocusPatched';
const MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardJQueryTriggerPatched';
const MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY = '__baiBaiToolkitMessageEditScrollTopPatched';
const LONG_CHAT_DOM_RENDER_TEXT_THRESHOLD = 60000;
const LONG_CHAT_DOM_RENDER_SINGLE_MESSAGE_THRESHOLD = 12000;
const LONG_CHAT_DOM_RENDER_MIN_TEXT_THRESHOLD = 24000;
const LONG_CHAT_DOM_RENDER_MESSAGE_COUNT_THRESHOLD = 20;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS = 900;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES = 6;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE = 8;
const LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES = 3;
const LONG_CHAT_DOM_RENDER_GENERATION_ANCHOR_RELEASE_MS = 1200;
const LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS = 'bai-bai-toolkit-long-chat-bottom-anchor';
const LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS = 'bai-bai-toolkit-long-chat-bottom-anchored';
const LONG_CHAT_DOM_RENDER_HEIGHT_VAR = '--bai-bai-toolkit-long-chat-mes-height';
const CHAT_DELETE_EDIT_WINDOW_MS = 5000;
const MOBILE_AUTO_KEYBOARD_DIRECT_FOCUS_WINDOW_MS = 1500;
const MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE = 2;
const MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_DELAYS = [0, 50, 160];
const PRESET_DRAG_LONG_PRESS_MS = 300;
const PRESET_DRAG_CANCEL_DISTANCE_PX = 12;
const PRESET_DRAG_CLICK_SUPPRESS_MS = 500;
const CHAT_GENERATION_ACTION_SELECTOR = '#send_but, #option_regenerate, #option_continue, #option_impersonate, #mes_continue, #mes_impersonate';
const CHAT_MESSAGE_EDIT_SELECTOR = '#chat .mes_edit';
const WELCOME_PANEL_SELECTOR = '#chat .welcomePanel';
const WELCOME_RECENT_CHAT_SELECTOR = '#chat .welcomePanel .recentChat';
const WELCOME_RECENT_CHAT_ACTION_SELECTOR = '.renameChat, .deleteChat, .pinChat, button, a, input, select, textarea';
const MOBILE_MESSAGE_EDIT_SELECTOR = '#curEditTextarea, .reasoning_edit_textarea';
const MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR = '#curEditTextarea, #select_chat_search';
const MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR = '#send_textarea';
const MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR = `${MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR}, ${MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR}`;
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

const createOrEditCharacter = scriptModule.createOrEditCharacter;
const messageEdit = scriptModule.messageEdit;
const COMPATIBILITY_MODE_BADGE_TEXT = '（兼容模式）';
const LOW_ST_VERSION_DISABLED_BADGE_TEXT = '（当前酒馆版本过低，请更新）';
const WORLD_INFO_DRAWER_HANDLER_KEY = '__baiBaiToolkitWorldInfoDrawerHandler';
const WORLD_INFO_LAZY_SELECT2_PATCH_KEY = '__baiBaiToolkitWorldInfoLazySelect2Patched';
const WORLD_INFO_CHARACTER_FILTER_APPEND_PATCH_KEY = '__baiBaiToolkitWorldInfoCharacterFilterAppendPatched';
const CHAT_MANAGEMENT_POPUP_SELECTOR = '#shadow_select_chat_popup';
const CHAT_MANAGEMENT_LIST_SELECTOR = '#select_chat_div';
const OPENAI_PRESET_SELECT_SELECTOR = '#settings_preset_openai';
const OPENAI_PRESET_DELETE_SELECTOR = '#delete_oai_preset';
const OPENAI_PRESET_UPDATE_SELECTOR = '#update_oai_preset';
const PRESET_PROMPT_MANAGER_LIST_SELECTOR = '#completion_prompt_manager_list';
const PRESET_PROMPT_MANAGER_SAVE_SELECTOR = '#completion_prompt_manager_popup_entry_form_save';
const PRESET_PROMPT_MANAGER_RESET_SELECTOR = '#completion_prompt_manager_popup_entry_form_reset';
const PRESET_PROMPT_MANAGER_CLOSE_SELECTOR = '#completion_prompt_manager_popup_entry_form_close, #completion_prompt_manager_popup_close_button';
const PRESET_PROMPT_EDITOR_SOURCE_ID = 'completion_prompt_manager_popup_entry_form_prompt';
const PRESET_PROMPT_EDITOR_SOURCE_SELECTOR = '#completion_prompt_manager_popup_entry_form_prompt';
const PRESET_PROMPT_MAXIMIZED_SOURCE_SELECTOR = 'textarea.maximized_textarea[data-for="completion_prompt_manager_popup_entry_form_prompt"]';
const PRESET_PROMPT_CODEMIRROR_EDITOR_ID = 'bai_bai_preset_prompt_codemirror_editor';
const PRESET_PROMPT_CODEMIRROR_EDITOR_CLASS = 'bai-bai-toolkit-preset-prompt-codemirror-editor';
const PRESET_PROMPT_SOURCE_HIDDEN_CLASS = 'bai-bai-toolkit-preset-prompt-source-hidden';
const PRESET_PROMPT_CODEMIRROR_READONLY_CLASS = 'bai-bai-toolkit-preset-prompt-readonly';
const PRESET_PROMPT_CODEMIRROR_MAXIMIZED_CLASS = 'bai-bai-toolkit-preset-prompt-maximized';
const PRESET_DRAG_INTERACTIVE_SELECTOR = '.prompt_manager_prompt_controls, .prompt-manager-detach-action, .prompt-manager-inspect-action, .prompt-manager-edit-action, .prompt-manager-toggle-action, a, button, input, select, textarea, [contenteditable="true"]';
const PRESET_DRAG_READY_CLASS = 'bai-bai-toolkit-preset-drag-ready';
const PRESET_DRAG_ACTIVE_CLASS = 'bai-bai-toolkit-preset-drag-active';
const PRESET_DRAG_SOURCE_CLASS = 'bai-bai-toolkit-preset-drag-source';
const PRESET_DRAG_CLONE_CLASS = 'bai-bai-toolkit-preset-drag-clone';
const PRESET_DRAG_INDICATOR_CLASS = 'bai-bai-toolkit-preset-drag-indicator';
const REGEX_CONTAINER_SELECTOR = '#regex_container';
const REGEX_SCRIPT_ROW_SELECTOR = '.regex-script-label';
const REGEX_SCRIPT_LIST_SELECTOR = '#saved_regex_scripts, #saved_scoped_scripts, #saved_preset_scripts';
const WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-header .inline-drawer-toggle';
const WORLD_INFO_ENTRY_DRAWER_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer';
const WORLD_INFO_LAZY_SELECT2_SELECTOR = '#world_popup_entries_list .world_entry_edit select[name="characterFilter"], #world_popup_entries_list .world_entry_edit select[name="triggers"]';
const WORLD_INFO_LAZY_SELECT2_DATASET_KEY = 'baiBaiToolkitLazySelect2';
const WORLD_INFO_DEFERRED_OPTIONS_DATASET_KEY = 'baiBaiToolkitDeferredOptions';
const SILENT_UPDATE_STORAGE_KEY = 'bai_bai_toolkit_silent_update';
const SILENT_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
const FORCE_EDIT_PROMPTS = new Set([
    'charDescription',
    'charPersonality',
    'scenario',
    'personaDescription',
    'worldInfoBefore',
    'worldInfoAfter',
]);
const FORCE_TOGGLE_PROMPTS = new Set([
    'charDescription',
    'charPersonality',
    'scenario',
    'personaDescription',
    'worldInfoBefore',
    'worldInfoAfter',
    'main',
    'chatHistory',
    'dialogueExamples',
]);
const SAVE_REQUEST_GZIP_PATHS = new Set([
    '/api/chats/save',
    '/api/chats/group/save',
]);
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
    resizeGuardEnabled: true,
    descriptionCodeMirrorEditorEnabled: true,
    customCssInputOptimizationEnabled: true,
    customCssShadowPropertyEnabled: true,
    worldInfoDrawerOptimizationEnabled: true,
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
    chatDeleteEditFlowOptimizationEnabled: true,
    messageTripleClickEditEnabled: true,
};
const legacySettingsKeys = [
    'textareaScrollOptimizationEnabled',
    'descriptionShadowEditorEnabled',
    'descriptionInputBubbleOptimizationEnabled',
    'descriptionInputIdleSaveEnabled',
    'imeCommitOptimizationEnabled',
    'mobileChatEntryKeyboardSuppressionEnabled',
];
const settings = { ...defaultSettings };
let fastChatListRequestId = 0;

const extensionState = getExtensionState();

initializeSettings();
initializeExtensionUpdateCheck();

if (!extensionState.installed) {
    extensionState.installed = true;
    patchFastChatSearchFetch();
    console.debug(`${LOG_PREFIX} Installed`);
}

installSaveRequestGzipFetchHook();
installPerformanceTraceFetchHook();
observeChatManagementPopupCleanup();
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

    if (removedLegacySetting) {
        saveSettingsDebounced();
    }
}

function saveExtensionSettings() {
    Object.assign(extension_settings[SETTINGS_KEY], settings);
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
        getLongChatDomRenderSnapshot(),
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
    const stats = calculateVisibleMessageTextStats(chat);
    return `visibleTextChars=${stats.visibleTextChars} maxVisibleMes=${stats.maxVisibleMesId}:${stats.maxVisibleChars}`;
}

function calculateVisibleMessageTextStats(chat, visibleMessages = [...document.querySelectorAll('#chat .mes')]) {
    let visibleTextChars = 0;
    let maxVisibleChars = 0;
    let maxVisibleMesId = 'none';

    for (const element of visibleMessages) {
        const mesId = element.getAttribute('mesid') ?? '';
        const index = Number(mesId);
        const message = Number.isInteger(index) ? chat[index] : null;
        const chars = getLongChatMessageTextLength(message);

        visibleTextChars += chars;
        if (chars > maxVisibleChars) {
            maxVisibleChars = chars;
            maxVisibleMesId = mesId || 'none';
        }
    }

    return { visibleTextChars, maxVisibleChars, maxVisibleMesId };
}

function getPerformanceMemorySnapshot() {
    const memory = performance.memory;
    if (!memory) {
        return '';
    }

    return `heap=${formatTraceBytes(memory.usedJSHeapSize)}/${formatTraceBytes(memory.jsHeapSizeLimit)}`;
}

function getLongChatDomRenderSnapshot() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return 'longDom=off';
    }

    const chat = document.querySelector('#chat');
    if (!(chat instanceof HTMLElement)) {
        return 'longDom=pending';
    }

    const optimized = chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized');
    const contained = chat.querySelectorAll('.mes.bai-bai-toolkit-long-chat-contained').length;
    return `longDom=${optimized ? 'on' : 'idle'}:${contained}`;
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
    jQuery(() => {
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

    $('#bai_bai_toolkit_fast_chat_list_enabled')
        .prop('checked', settings.fastChatListEnabled)
        .on('input', function () {
            settings.fastChatListEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });

    $('#bai_bai_toolkit_welcome_recent_chat_direct_open_enabled')
        .prop('checked', settings.welcomeRecentChatDirectOpenEnabled)
        .on('input', function () {
            settings.welcomeRecentChatDirectOpenEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyWelcomeRecentChatDirectOpenOptimization();
        });

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

    $('#bai_bai_toolkit_long_chat_dom_render_optimization_enabled')
        .prop('checked', settings.longChatDomRenderOptimizationEnabled)
        .on('input', function () {
            settings.longChatDomRenderOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyLongChatDomRenderOptimization();
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

    $('#bai_bai_toolkit_chat_list_scroll_optimization_enabled')
        .prop('checked', settings.chatListScrollOptimizationEnabled)
        .on('input', function () {
            settings.chatListScrollOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyFastChatListScrollOptimization();
        });

    $('#bai_bai_toolkit_chat_list_auto_clear_enabled')
        .prop('checked', settings.chatListAutoClearEnabled)
        .on('input', function () {
            settings.chatListAutoClearEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });

    $('#bai_bai_toolkit_mobile_auto_keyboard_suppression_enabled')
        .prop('checked', settings.mobileAutoKeyboardSuppressionEnabled)
        .on('input', function () {
            settings.mobileAutoKeyboardSuppressionEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyMobileAutoKeyboardSuppression();
        });

    $('#bai_bai_toolkit_mobile_message_edit_scroll_guard_enabled')
        .prop('checked', settings.mobileMessageEditScrollGuardEnabled)
        .on('input', function () {
            settings.mobileMessageEditScrollGuardEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyMobileMessageEditScrollGuard();
        });

    $('#bai_bai_toolkit_chat_delete_edit_flow_optimization_enabled')
        .prop('checked', settings.chatDeleteEditFlowOptimizationEnabled)
        .on('input', function () {
            settings.chatDeleteEditFlowOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyChatDeleteEditFlowOptimization();
        });

    $('#bai_bai_toolkit_preset_scroll_optimization_enabled')
        .prop('checked', settings.presetScrollOptimizationEnabled)
        .on('input', function () {
            settings.presetScrollOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyPresetScrollOptimization();
        });

    $('#bai_bai_toolkit_preset_drag_optimization_enabled')
        .prop('checked', settings.presetDragOptimizationEnabled)
        .on('input', function () {
            settings.presetDragOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyPresetDragOptimization();
        });

    $('#bai_bai_toolkit_preset_mobile_whole_row_drag_enabled')
        .prop('checked', settings.presetMobileWholeRowDragEnabled)
        .on('input', function () {
            settings.presetMobileWholeRowDragEnabled = Boolean($(this).prop('checked'));
            cancelPromptManagerCustomDragPending();
            finishPromptManagerCustomDrag({ cancelled: true });
            saveExtensionSettings();
            applyPresetDragOptimization();
        });

    $('#bai_bai_toolkit_preset_switch_optimization_enabled')
        .prop('checked', settings.presetSwitchOptimizationEnabled)
        .on('input', function () {
            settings.presetSwitchOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyPresetSwitchOptimization();
        });

    $('#bai_bai_toolkit_preset_toggle_optimization_enabled')
        .prop('checked', settings.presetToggleOptimizationEnabled)
        .on('input', function () {
            settings.presetToggleOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyPresetToggleOptimization();
            applyPresetSaveOptimization();
        });

    $('#bai_bai_toolkit_preset_prompt_codemirror_editor_enabled')
        .prop('checked', settings.presetPromptCodeMirrorEditorEnabled)
        .on('input', function () {
            settings.presetPromptCodeMirrorEditorEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyPresetPromptCodeMirrorEditorOptimization();
        });

    $('#bai_bai_toolkit_preset_auto_save_after_prompt_edit_enabled')
        .prop('checked', settings.presetAutoSaveAfterPromptEditEnabled)
        .on('input', function () {
            settings.presetAutoSaveAfterPromptEditEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });

    $('#bai_bai_toolkit_regex_quick_operation_enabled')
        .prop('checked', settings.regexQuickOperationOptimizationEnabled)
        .on('input', function () {
            settings.regexQuickOperationOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyRegexQuickOperationOptimization();
        });

    $('#bai_bai_toolkit_message_triple_click_edit_enabled')
        .prop('checked', settings.messageTripleClickEditEnabled)
        .on('input', function () {
            settings.messageTripleClickEditEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyMessageTripleClickEdit();
        });

    applyCompatibilityIndicators(container);
}

function applyCompatibilityIndicators(container) {
    if (isWelcomeRecentChatDirectOpenCompatibilityMode()) {
        markSettingCompatibility(
            container,
            '#bai_bai_toolkit_welcome_recent_chat_direct_open_enabled',
            COMPATIBILITY_MODE_BADGE_TEXT,
            false,
            '当前酒馆版本未导出 createOrEditCharacter，已使用兼容模式。',
        );
    }

    if (!isChatDeleteEditFlowSupported()) {
        markSettingCompatibility(
            container,
            '#bai_bai_toolkit_chat_delete_edit_flow_optimization_enabled',
            LOW_ST_VERSION_DISABLED_BADGE_TEXT,
            true,
            '当前酒馆版本未导出 messageEdit，请更新酒馆后使用。',
        );
    }
}

function markSettingCompatibility(container, inputSelector, badgeText, disabled, titleNote) {
    const input = container.find(inputSelector);
    const label = input.closest('label');
    const text = label.find('span').first();

    if (!input.length || !label.length || !text.length) {
        return;
    }

    const badgeClass = `${input.attr('id')}_compat_badge`;
    let badge = text.find(`.${badgeClass}`);

    if (!badge.length) {
        badge = $(`<small class="${badgeClass} bai_bai_toolkit_compat_badge"></small>`);
        text.append(' ', badge);
    }

    badge
        .text(badgeText)
        .css({
            opacity: 0.75,
            'font-size': '0.9em',
            'white-space': 'nowrap',
        });

    if (titleNote) {
        const currentTitle = String(label.attr('title') || '');
        if (!currentTitle.includes(titleNote)) {
            label.attr('title', currentTitle ? `${currentTitle} ${titleNote}` : titleNote);
        }
    }

    if (disabled) {
        input.prop('checked', false).prop('disabled', true);
        label.css('opacity', 0.65);
    }
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

    applyFastChatListScrollOptimization();
    applyWorldInfoDrawerOptimization();
    applyWorldInfoLazySelect2Optimization();
    applyWorldInfoCharacterFilterOptionsOptimization();
    applyDescriptionCodeMirrorEditorOptimization();
    applyCustomCssInputOptimization();
    applyPresetScrollOptimization();
    applyPresetDragOptimization();
    applyPresetSwitchOptimization();
    applyPresetToggleOptimization();
    applyPresetPromptCodeMirrorEditorOptimization();
    applyPresetSaveOptimization();
    applyRegexQuickOperationOptimization();
    applyWelcomeRecentChatDirectOpenOptimization();
    applyChatDeleteEditFlowOptimization();
    applyTranslateMessageUpdatedOptimization();
    applyLongChatDomRenderOptimization();
    applyMobileAutoKeyboardSuppression();
    applyMobileMessageEditScrollGuard();
    applyMessageTripleClickEdit();
}

function applyLongChatDomRenderOptimization() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        removeLongChatDomRenderOptimization();
        return;
    }

    installLongChatDomRenderOptimization();
    scheduleLongChatDomRenderRefresh({ autoScroll: true, reason: 'apply' });
}

function getLongChatDomRenderState() {
    if (!extensionState.longChatDomRenderOptimization || typeof extensionState.longChatDomRenderOptimization !== 'object') {
        extensionState.longChatDomRenderOptimization = {};
    }

    const state = extensionState.longChatDomRenderOptimization;
    if (!(state.heightCache instanceof Map)) {
        state.heightCache = new Map();
    }
    if (!Array.isArray(state.eventHandlers)) {
        state.eventHandlers = [];
    }

    return state;
}

function installLongChatDomRenderOptimization() {
    const state = getLongChatDomRenderState();

    applyLongChatDomRenderOptimizationStyle();
    ensureLongChatDomRenderObservers();

    if (!state.installed) {
        const chatLoadHandler = () => {
            state.userScrolledAway = false;
            scheduleLongChatDomRenderRefresh({ autoScroll: true, reason: 'chat-load' });
        };
        const chatMutationHandler = () => {
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'chat-update' });
            scheduleLongChatDomRenderGenerationAnchor('chat-update');
        };
        const generationStartedHandler = () => {
            state.generationActive = true;
            state.generationAnchorEnabled = shouldStartLongChatDomRenderGenerationAnchor();
            if (state.generationAnchorEnabled) {
                state.userScrolledAway = false;
                scheduleLongChatDomRenderGenerationAnchor('generation-started');
            }
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'generation-started' });
        };
        const generationEndedHandler = () => {
            state.generationActive = false;
            releaseLongChatDomRenderGenerationAnchor();
        };

        addLongChatDomRenderEventHandler(event_types.CHAT_CHANGED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.CHAT_LOADED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.MORE_MESSAGES_LOADED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.USER_MESSAGE_RENDERED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.CHARACTER_MESSAGE_RENDERED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.MESSAGE_UPDATED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.MESSAGE_DELETED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_STARTED, generationStartedHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_STOPPED, generationEndedHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_ENDED, generationEndedHandler);

        state.installed = true;
    }
}

function addLongChatDomRenderEventHandler(event, handler) {
    if (!event || typeof eventSource?.on !== 'function') {
        return;
    }

    const state = getLongChatDomRenderState();
    eventSource.on(event, handler);
    state.eventHandlers.push({ event, handler });
}

function removeLongChatDomRenderOptimization() {
    const state = getLongChatDomRenderState();

    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    clearLongChatDomRenderAutoScrollTimers();

    for (const entry of state.eventHandlers || []) {
        eventSource.removeListener?.(entry.event, entry.handler);
    }
    state.eventHandlers = [];
    state.installed = false;
    state.userScrolledAway = false;
    state.generationActive = false;
    state.generationAnchorEnabled = false;
    clearTimeout(state.generationAnchorTimer);
    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorTimer = null;
    state.generationAnchorReleaseTimer = null;

    detachLongChatDomRenderChatObservers();
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.mutationObserver?.disconnect();
    state.mutationObserver = null;

    document.getElementById(LONG_CHAT_DOM_RENDER_STYLE_ID)?.remove();
    cleanupLongChatDomRenderMessages();
}

function applyLongChatDomRenderOptimizationStyle() {
    let style = document.getElementById(LONG_CHAT_DOM_RENDER_STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = LONG_CHAT_DOM_RENDER_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#chat.bai-bai-toolkit-long-chat-render-optimized > .mes.bai-bai-toolkit-long-chat-contained {
    content-visibility: auto;
    contain: layout paint style;
    contain-intrinsic-size: auto var(${LONG_CHAT_DOM_RENDER_HEIGHT_VAR}, 640px);
    contain-intrinsic-block-size: auto var(${LONG_CHAT_DOM_RENDER_HEIGHT_VAR}, 640px);
}

#chat.${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS} > :not(.${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS}) {
    overflow-anchor: none;
}

#chat > .${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS} {
    display: block;
    width: 1px;
    height: 1px;
    flex: 0 0 auto;
    overflow-anchor: auto;
    pointer-events: none;
}
`;
}

function ensureLongChatDomRenderObservers() {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)) {
        return;
    }

    if (state.chatElement !== chat) {
        detachLongChatDomRenderChatObservers();
        state.mutationObserver?.disconnect();
        state.mutationObserver = null;
        state.chatElement = chat;
        state.scrollHandler = () => {
            handleLongChatDomRenderScroll(chat);
        };
        chat.addEventListener('scroll', state.scrollHandler, { passive: true });
    }

    if (!state.resizeObserver && typeof ResizeObserver === 'function') {
        state.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                updateLongChatDomRenderHeightCache(entry.target, entry.contentRect?.height);
            }
        });
    }

    if (!state.mutationObserver && typeof MutationObserver === 'function') {
        state.mutationObserver = new MutationObserver((mutations) => {
            if (mutations.some(isLongChatDomRenderRelevantChildMutation)) {
                if (!chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized')) {
                    return;
                }
                scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'mutation' });
            }
        });
        state.mutationObserver.observe(chat, { childList: true });
    }
}

function isLongChatDomRenderRelevantChildMutation(mutation) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.some(node => !(node instanceof HTMLElement && node.classList.contains(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS)));
}

function detachLongChatDomRenderChatObservers() {
    const state = getLongChatDomRenderState();
    if (state.chatElement && state.scrollHandler) {
        state.chatElement.removeEventListener('scroll', state.scrollHandler);
    }
    state.chatElement = null;
    state.scrollHandler = null;
}

function scheduleLongChatDomRenderRefresh({ autoScroll = false, reason = '' } = {}) {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const state = getLongChatDomRenderState();
    state.pendingAutoScroll = Boolean(state.pendingAutoScroll || autoScroll);
    state.pendingReason = reason || state.pendingReason || '';

    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
        state.refreshTimer = null;
        const pendingReason = state.pendingReason || 'refresh';
        refreshLongChatDomRenderOptimization({ reason: pendingReason });

        if (state.pendingAutoScroll) {
            state.pendingAutoScroll = false;
            scheduleLongChatDomRenderScrollToBottom(pendingReason);
        }
        state.pendingReason = '';
    }, 40);
}

function refreshLongChatDomRenderOptimization({ reason = '' } = {}) {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const chatElement = document.querySelector('#chat');
    if (!(chatElement instanceof HTMLElement)) {
        return;
    }

    if (isWelcomePageDisplayed(chatElement)) {
        cleanupLongChatDomRenderMessages();
        return;
    }

    const startedAt = performance.now();
    const refreshStats = {
        reason,
        duration: 0,
        messages: 0,
        optimized: false,
        contained: 0,
        editing: 0,
        tail: 0,
        cached: 0,
        estimated: 0,
    };

    ensureLongChatDomRenderObservers();

    const messages = [...chatElement.querySelectorAll('.mes')].filter(element => element instanceof HTMLElement);
    const chat = Array.isArray(scriptModule.chat) ? scriptModule.chat : [];
    const stats = calculateVisibleMessageTextStats(chat, messages);
    const shouldOptimize = shouldOptimizeLongChatDomRender(stats, messages.length);

    refreshStats.messages = messages.length;
    refreshStats.optimized = shouldOptimize;
    chatElement.classList.toggle('bai-bai-toolkit-long-chat-render-optimized', shouldOptimize);

    const state = getLongChatDomRenderState();
    const editingMessages = getLongChatDomRenderEditingMessages(chatElement);
    const uncontainedTailMessages = getLongChatDomRenderUncontainedTailMessages(messages, chat.length);
    const chatWidth = chatElement.clientWidth || window.innerWidth;
    for (const element of messages) {
        if (shouldOptimize && !uncontainedTailMessages.has(element)) {
            applyLongChatDomRenderToMessage(element, chat, refreshStats, { editingMessages, chatWidth });
            state.resizeObserver?.observe(element);
        } else {
            if (shouldOptimize && uncontainedTailMessages.has(element)) {
                refreshStats.tail += 1;
            }
            cleanupLongChatDomRenderMessage(element);
            state.resizeObserver?.unobserve(element);
        }
    }

    if (shouldOptimize && isLongChatDomRenderGenerationActive()) {
        scheduleLongChatDomRenderGenerationAnchor(reason || 'refresh');
    } else if (!shouldOptimize && state.generationAnchorEnabled) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
    }

    refreshStats.duration = performance.now() - startedAt;
    recordPerformanceTraceLongDomRefresh(refreshStats);
}

function shouldOptimizeLongChatDomRender(stats, messageCount) {
    return stats.visibleTextChars >= LONG_CHAT_DOM_RENDER_TEXT_THRESHOLD
        || stats.maxVisibleChars >= LONG_CHAT_DOM_RENDER_SINGLE_MESSAGE_THRESHOLD
        || (messageCount >= LONG_CHAT_DOM_RENDER_MESSAGE_COUNT_THRESHOLD && stats.visibleTextChars >= LONG_CHAT_DOM_RENDER_MIN_TEXT_THRESHOLD);
}

function applyLongChatDomRenderToMessage(element, chat, refreshStats = null, options = {}) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    if (options.editingMessages?.has(element)) {
        cleanupLongChatDomRenderMessage(element);
        if (refreshStats) {
            refreshStats.editing += 1;
        }
        return;
    }

    const mesId = element.getAttribute('mesid') || '';
    const index = Number(mesId);
    const message = Number.isInteger(index) ? chat[index] : null;
    const chars = getLongChatMessageTextLength(message);
    const cachedHeight = getLongChatDomRenderCachedHeight(mesId);
    const estimatedHeight = estimateLongChatDomRenderMessageHeight(chars, options.chatWidth);
    const height = Math.max(cachedHeight || 0, estimatedHeight);

    if (refreshStats) {
        if (cachedHeight) {
            refreshStats.cached += 1;
        } else {
            refreshStats.estimated += 1;
        }
    }

    if (height > 0) {
        setLongChatDomRenderCachedHeight(mesId, height);
        element.style.setProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR, `${Math.round(height)}px`);
    }

    element.classList.add('bai-bai-toolkit-long-chat-contained');
    if (refreshStats) {
        refreshStats.contained += 1;
    }
}

function getLongChatDomRenderUncontainedTailMessages(messages, chatLength = 0) {
    const tailMessages = new Set();
    const tailCount = LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES;
    const numericChatLength = Number(chatLength || 0);
    const tailStartIndex = Math.max(0, numericChatLength - tailCount);

    for (const element of messages) {
        const mesIdValue = element.getAttribute('mesid');
        const mesId = Number(mesIdValue);
        if (mesIdValue && Number.isInteger(mesId) && mesId >= tailStartIndex) {
            tailMessages.add(element);
        }
    }

    for (const element of messages.slice(-tailCount)) {
        tailMessages.add(element);
    }

    return tailMessages;
}

function getLongChatDomRenderEditingMessages(chatElement) {
    const messages = new Set();

    if (!(chatElement instanceof HTMLElement)) {
        return messages;
    }

    for (const editor of chatElement.querySelectorAll(MOBILE_MESSAGE_EDIT_SELECTOR)) {
        const message = editor.closest('.mes');
        if (message instanceof HTMLElement) {
            messages.add(message);
        }
    }

    return messages;
}

function estimateLongChatDomRenderMessageHeight(chars, width = window.innerWidth) {
    const charsPerLine = Math.max(22, Math.min(80, Math.floor((width || 720) / 16)));
    const lines = Math.max(1, Math.ceil(Number(chars || 0) / charsPerLine));
    const estimated = 230 + (lines * 28);

    return Math.max(120, Math.min(12000, estimated));
}

function updateLongChatDomRenderHeightCache(target, observedHeight) {
    if (!(target instanceof HTMLElement) || !target.classList.contains('mes')) {
        return;
    }

    const mesId = target.getAttribute('mesid') || '';
    const height = Number(observedHeight || 0);
    if (!mesId || height < 24 || !isLongChatDomRenderNearViewport(target)) {
        return;
    }

    setLongChatDomRenderCachedHeight(mesId, height);
    target.style.setProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR, `${Math.round(height)}px`);
}

function isLongChatDomRenderNearViewport(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.bottom >= -viewportHeight && rect.top <= viewportHeight * 2;
}

function getLongChatDomRenderCachedHeight(mesId) {
    if (!mesId) {
        return 0;
    }

    const state = getLongChatDomRenderState();
    return Number(state.heightCache.get(String(mesId)) || 0);
}

function setLongChatDomRenderCachedHeight(mesId, height) {
    if (!mesId || !Number.isFinite(height) || height <= 0) {
        return;
    }

    const state = getLongChatDomRenderState();
    state.heightCache.set(String(mesId), Math.round(height));

    while (state.heightCache.size > 1000) {
        const oldestKey = state.heightCache.keys().next().value;
        state.heightCache.delete(oldestKey);
    }
}

function cleanupLongChatDomRenderMessages() {
    removeLongChatDomRenderBottomAnchor();
    document.querySelector('#chat')?.classList.remove('bai-bai-toolkit-long-chat-render-optimized');
    for (const element of document.querySelectorAll('#chat .mes.bai-bai-toolkit-long-chat-contained')) {
        cleanupLongChatDomRenderMessage(element);
    }
}

function cleanupLongChatDomRenderMessage(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.classList.remove('bai-bai-toolkit-long-chat-contained');
    element.style.removeProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR);
}

function isLongChatDomRenderGenerationActive() {
    const state = getLongChatDomRenderState();
    if (state.generationActive) {
        return true;
    }

    if (typeof scriptModule.isGenerating === 'function') {
        try {
            return Boolean(scriptModule.isGenerating());
        } catch {
            return false;
        }
    }

    return false;
}

function isLongChatDomRenderOptimizedChat(chat) {
    return chat instanceof HTMLElement
        && (chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized')
            || Boolean(chat.querySelector('.mes.bai-bai-toolkit-long-chat-contained')));
}

function shouldStartLongChatDomRenderGenerationAnchor() {
    const chat = document.querySelector('#chat');
    return chat instanceof HTMLElement
        && settings.longChatDomRenderOptimizationEnabled
        && !isWelcomePageDisplayed(chat)
        && isLongChatDomRenderOptimizedChat(chat)
        && isLongChatDomRenderAtBottom(chat);
}

function scheduleLongChatDomRenderGenerationAnchor() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const state = getLongChatDomRenderState();
    if (!state.generationAnchorEnabled && !isLongChatDomRenderGenerationActive()) {
        return;
    }

    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorReleaseTimer = null;
    clearTimeout(state.generationAnchorTimer);
    state.generationAnchorTimer = setTimeout(() => {
        state.generationAnchorTimer = null;
        updateLongChatDomRenderGenerationAnchor();
    }, 40);
}

function updateLongChatDomRenderGenerationAnchor() {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)
        || !settings.longChatDomRenderOptimizationEnabled
        || isWelcomePageDisplayed(chat)
        || !isLongChatDomRenderGenerationActive()
        || !isLongChatDomRenderOptimizedChat(chat)) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
        return;
    }

    const atBottom = isLongChatDomRenderAtBottom(chat);
    if (!state.generationAnchorEnabled && !atBottom) {
        return;
    }

    if (!atBottom) {
        if (!state.generationAnchorAwayStartedAt) {
            state.generationAnchorAwayStartedAt = performance.now();
        }
        if (performance.now() - Number(state.generationAnchorAwayStartedAt || 0) > 250) {
            state.generationAnchorEnabled = false;
            removeLongChatDomRenderBottomAnchorIfIdle(state);
        } else {
            scheduleLongChatDomRenderGenerationAnchor('scroll-away');
        }
        return;
    }

    state.generationAnchorAwayStartedAt = 0;
    state.generationAnchorEnabled = true;
    ensureLongChatDomRenderBottomAnchor(chat, state);
}

function releaseLongChatDomRenderGenerationAnchor() {
    const state = getLongChatDomRenderState();
    state.generationAnchorEnabled = false;
    state.generationAnchorAwayStartedAt = 0;
    clearTimeout(state.generationAnchorTimer);
    state.generationAnchorTimer = null;
    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorReleaseTimer = setTimeout(() => {
        state.generationAnchorReleaseTimer = null;
        if (!isLongChatDomRenderGenerationActive()) {
            removeLongChatDomRenderBottomAnchorIfIdle(state);
        }
    }, LONG_CHAT_DOM_RENDER_GENERATION_ANCHOR_RELEASE_MS);
}

function removeLongChatDomRenderBottomAnchorIfIdle(state = getLongChatDomRenderState()) {
    if (state.autoScrollChatElement instanceof HTMLElement) {
        return;
    }

    removeLongChatDomRenderBottomAnchor(state);
}

function scheduleLongChatDomRenderScrollToBottom(reason = '') {
    const state = getLongChatDomRenderState();
    clearLongChatDomRenderAutoScrollTimers();
    state.autoScrollToken = Number(state.autoScrollToken || 0) + 1;
    const token = state.autoScrollToken;
    state.autoScrollStartedAt = performance.now();
    state.autoScrollLastHeight = 0;
    state.autoScrollStableFrames = 0;
    state.autoScrollLogged = false;

    settleLongChatDomRenderScrollToBottom(token, reason);
}

function clearLongChatDomRenderAutoScrollTimers() {
    const state = getLongChatDomRenderState();
    for (const timer of state.autoScrollTimers || []) {
        clearTimeout(timer);
    }
    state.autoScrollTimers = [];

    if (state.autoScrollFrame) {
        cancelAnimationFrame(state.autoScrollFrame);
        state.autoScrollFrame = 0;
    }

    restoreLongChatDomRenderScrollBehavior(state);
}

function settleLongChatDomRenderScrollToBottom(token, reason = '') {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)
        || token !== state.autoScrollToken
        || !settings.longChatDomRenderOptimizationEnabled
        || isWelcomePageDisplayed(chat)
        || state.userScrolledAway) {
        restoreLongChatDomRenderScrollBehavior(state);
        return;
    }

    ensureLongChatDomRenderInstantScroll(chat, state);
    ensureLongChatDomRenderBottomAnchor(chat, state);

    const now = performance.now();
    state.programmaticScrollUntil = now + 250;

    const desiredTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
    const distance = Math.abs(chat.scrollTop - desiredTop);
    const heightDelta = Math.abs(Number(state.autoScrollLastHeight || 0) - chat.scrollHeight);

    if (distance > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        chat.scrollTop = desiredTop;
        state.autoScrollStableFrames = 0;
    } else if (heightDelta > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        state.autoScrollStableFrames = 0;
    } else {
        state.autoScrollStableFrames = Number(state.autoScrollStableFrames || 0) + 1;
    }

    state.autoScrollLastHeight = chat.scrollHeight;

    const elapsed = now - Number(state.autoScrollStartedAt || now);
    if (elapsed < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS
        && Number(state.autoScrollStableFrames || 0) < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES) {
        state.autoScrollFrame = requestAnimationFrame(() => {
            state.autoScrollFrame = 0;
            settleLongChatDomRenderScrollToBottom(token, reason);
        });
        return;
    }

    restoreLongChatDomRenderScrollBehavior(state, { finalScrollToBottom: true });

    if (!state.autoScrollLogged) {
        state.autoScrollLogged = true;
        console.debug(`${LOG_PREFIX} Long chat DOM render optimization scrolled to bottom (${reason})`);
    }
}

function ensureLongChatDomRenderInstantScroll(chat, state) {
    if (!(chat instanceof HTMLElement) || state.autoScrollChatElement === chat) {
        return;
    }

    restoreLongChatDomRenderScrollBehavior(state);
    state.autoScrollChatElement = chat;
    state.autoScrollPreviousScrollBehavior = chat.style.scrollBehavior || '';
    chat.style.scrollBehavior = 'auto';
}

function ensureLongChatDomRenderBottomAnchor(chat, state) {
    if (!(chat instanceof HTMLElement)) {
        return;
    }

    let anchor = state.bottomAnchorElement;
    if (!(anchor instanceof HTMLElement)) {
        anchor = document.createElement('div');
        anchor.className = LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS;
        anchor.setAttribute('aria-hidden', 'true');
        state.bottomAnchorElement = anchor;
    }

    if (anchor.parentElement !== chat || chat.lastElementChild !== anchor) {
        chat.append(anchor);
    }

    chat.classList.add(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
}

function removeLongChatDomRenderBottomAnchor(state = getLongChatDomRenderState()) {
    const anchor = state.bottomAnchorElement;
    if (anchor instanceof HTMLElement) {
        anchor.parentElement?.classList.remove(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
        anchor.remove();
    }

    document.querySelector('#chat')?.classList.remove(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
    state.bottomAnchorElement = null;
}

function restoreLongChatDomRenderScrollBehavior(state = getLongChatDomRenderState(), { finalScrollToBottom = false } = {}) {
    const chat = state.autoScrollChatElement;
    if (chat instanceof HTMLElement) {
        if (finalScrollToBottom) {
            chat.scrollTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
        }
        removeLongChatDomRenderBottomAnchor(state);
        if (finalScrollToBottom) {
            chat.scrollTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
        }
        chat.style.scrollBehavior = state.autoScrollPreviousScrollBehavior || '';
    } else {
        removeLongChatDomRenderBottomAnchor(state);
    }

    state.autoScrollChatElement = null;
    state.autoScrollPreviousScrollBehavior = '';
}

function handleLongChatDomRenderScroll(chat) {
    const state = getLongChatDomRenderState();
    if (performance.now() < Number(state.programmaticScrollUntil || 0)) {
        return;
    }

    const atBottom = isLongChatDomRenderAtBottom(chat);
    state.userScrolledAway = !atBottom;
    if (state.generationAnchorEnabled) {
        if (atBottom) {
            state.generationAnchorAwayStartedAt = 0;
        } else {
            if (!state.generationAnchorAwayStartedAt) {
                state.generationAnchorAwayStartedAt = performance.now();
            }
            scheduleLongChatDomRenderGenerationAnchor('scroll');
        }
    }
}

function isLongChatDomRenderAtBottom(chat) {
    if (!(chat instanceof HTMLElement)) {
        return true;
    }

    return chat.scrollHeight - chat.scrollTop - chat.clientHeight <= 48;
}

function getLongChatMessageTextLength(message) {
    if (!message || typeof message !== 'object') {
        return 0;
    }

    let rawText = '';

    // Prefer translated text if available, fallback to original message
    if (typeof message.extra?.display_text === 'string' && message.extra.display_text.trim().length > 0) {
        rawText = message.extra.display_text;
    } else if (typeof message.mes === 'string') {
        rawText = message.mes;
    }

    let length = 0;
    if (rawText) {
        // Strip <think> and <details> blocks out of the length calculation
        // since they are usually folded/hidden and don't contribute to standard reading height
        let processedText = rawText
            .replace(/<think[ing]*>[\s\S]*?<\/think[ing]*>/gi, '')
            .replace(/<details[\s\S]*?>[\s\S]*?<\/details>/gi, '');

        length += processedText.length;
    }

    // Add a fixed small length penalty if reasoning text exists (representing folded summary)
    if (typeof message.extra?.reasoning === 'string' || typeof message.extra?.reasoning_display_text === 'string') {
        length += 50;
    }

    return length;
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
                minHeight: '180px',
            },
            '.cm-line': {
                padding: '0',
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

function isWelcomeRecentChatDirectOpenCompatibilityMode() {
    return typeof createOrEditCharacter !== 'function';
}

function isChatDeleteEditFlowSupported() {
    return typeof messageEdit === 'function';
}

function applyChatDeleteEditFlowOptimization() {
    if (!isChatDeleteEditFlowSupported()) {
        endChatDeleteEditWindow();
        return;
    }

    if (extensionState[CHAT_DELETE_EDIT_HANDLER_KEY]) {
        return;
    }

    const clickHandler = (event) => {
        handleChatDeleteEditFlowClick(event);
    };
    const generationActionHandler = (event) => {
        handleChatGenerationActionClick(event);
    };
    const messageDeletedHandler = () => {
        scheduleChatDeleteEditWindowEnd(1500);
    };

    extensionState[CHAT_DELETE_EDIT_HANDLER_KEY] = clickHandler;
    extensionState[CHAT_DELETE_GENERATION_ACTION_HANDLER_KEY] = generationActionHandler;
    extensionState[CHAT_DELETE_MESSAGE_DELETED_HANDLER_KEY] = messageDeletedHandler;

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('click', generationActionHandler, true);
    eventSource.on(event_types.MESSAGE_DELETED, messageDeletedHandler);
}

function applyMobileAutoKeyboardSuppression() {
    patchMobileAutoKeyboardFocus();
    patchMobileAutoKeyboardJQueryFocus();

    if (extensionState[MOBILE_AUTO_KEYBOARD_HANDLER_KEY]) {
        return;
    }

    const directFocusIntentHandler = (event) => {
        markMobileAutoKeyboardDirectFocusIntent(event);
    };
    const pointerUpHandler = (event) => {
        handleMobileAutoKeyboardPointerUp(event);
    };
    const focusInHandler = (event) => {
        handleMobileAutoKeyboardFocusIn(event);
    };
    const pageLifecycleHandler = (event) => {
        handleMobileAutoKeyboardPageLifecycle(event);
    };

    extensionState[MOBILE_AUTO_KEYBOARD_HANDLER_KEY] = {
        directFocusIntentHandler,
        pointerUpHandler,
        focusInHandler,
        pageLifecycleHandler,
    };

    document.addEventListener('pointerdown', directFocusIntentHandler, true);
    document.addEventListener('mousedown', directFocusIntentHandler, true);
    document.addEventListener('touchstart', directFocusIntentHandler, true);
    document.addEventListener('pointerup', pointerUpHandler, true);
    document.addEventListener('touchend', pointerUpHandler, true);
    document.addEventListener('mouseup', pointerUpHandler, true);
    document.addEventListener('focusin', focusInHandler, true);
    document.addEventListener('visibilitychange', pageLifecycleHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler, true);
    window.addEventListener('pageshow', pageLifecycleHandler, true);
    window.addEventListener('focus', pageLifecycleHandler, true);
}

function applyMobileMessageEditScrollGuard() {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    patchMobileMessageEditChatScrollTop();
    installMobileMessageEditScrollGuardObservers();
    ensureMobileMessageEditChatResizeObserver();
    captureMobileMessageEditScrollGuard('apply');
}

function applyWelcomeRecentChatDirectOpenOptimization() {
    if (extensionState[WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY]) {
        return;
    }

    const clickHandler = (event) => {
        handleWelcomeRecentChatDirectOpenClick(event);
    };

    extensionState[WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY] = clickHandler;
    document.addEventListener('click', clickHandler, true);
}

function handleWelcomeRecentChatDirectOpenClick(event) {
    if (!settings.welcomeRecentChatDirectOpenEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(WELCOME_RECENT_CHAT_ACTION_SELECTOR)) {
        return;
    }

    const item = target.closest(WELCOME_RECENT_CHAT_SELECTOR);
    if (!(item instanceof HTMLElement)) {
        return;
    }

    const avatarId = item.getAttribute('data-avatar');
    const groupId = item.getAttribute('data-group');
    const fileName = item.getAttribute('data-file');

    if (!avatarId || !fileName || groupId) {
        return;
    }

    const characterId = characters.findIndex(character => character?.avatar === avatarId);
    if (characterId === -1) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (extensionState.welcomeRecentChatDirectOpenPromise) {
        return;
    }

    extensionState.welcomeRecentChatDirectOpenPromise = openWelcomeRecentCharacterChatDirectly(characterId, avatarId, fileName)
        .finally(() => {
            extensionState.welcomeRecentChatDirectOpenPromise = null;
        });
}

async function openWelcomeRecentCharacterChatDirectly(characterId, avatarId, fileName) {
    const character = characters[characterId];
    if (!character) {
        console.error(`${LOG_PREFIX} Character not found for avatar ID: ${avatarId}`);
        return;
    }

    try {
        if (String(this_chid) === String(characterId)) {
            setActiveCharacter(avatarId);
            saveSettingsDebounced();

            if (isWelcomeRecentChatAlreadyDisplayed(fileName)) {
                console.debug(`${LOG_PREFIX} Chat ${fileName} is already open.`);
                return;
            }

            await openCharacterChat(fileName);
            return;
        }

        const previousChat = character.chat;
        character.chat = fileName;

        await selectCharacterById(characterId);

        if (String(this_chid) !== String(characterId)) {
            if (character.chat === fileName && previousChat !== fileName) {
                character.chat = previousChat;
            }
            return;
        }

        setActiveCharacter(avatarId);
        saveSettingsDebounced();

        if (getCurrentChatId() !== fileName) {
            await openCharacterChat(fileName);
            return;
        }

        if (previousChat !== fileName) {
            if (typeof createOrEditCharacter === 'function') {
                await createOrEditCharacter(new CustomEvent('newChat'));
            } else {
                await openCharacterChat(fileName);
            }
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Error opening recent chat`, error);
        toastr.error(t`Failed to open recent chat. See console for details.`);
    }
}

function isWelcomeRecentChatAlreadyDisplayed(fileName) {
    return getCurrentChatId() === fileName && !isWelcomePageDisplayed();
}

function isWelcomePageDisplayed(root = document) {
    if (!(root instanceof Document || root instanceof Element)) {
        return false;
    }

    return Boolean(root.querySelector(WELCOME_PANEL_SELECTOR));
}

function patchMobileMessageEditChatScrollTop() {
    const target = getMobileMessageEditScrollTopDescriptorTarget();

    if (
        !target?.descriptor?.get
        || !target.descriptor?.set
        || target.descriptor.set[MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY]
    ) {
        return;
    }

    const { prototype, descriptor } = target;

    function guardedScrollTopSetter(value) {
        if (shouldBlockMobileMessageEditChatScrollTop(this, value)) {
            return;
        }

        return descriptor.set.call(this, value);
    }

    guardedScrollTopSetter[MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY] = true;
    guardedScrollTopSetter.__baiBaiToolkitOriginalScrollTopSetter = descriptor.set;

    Object.defineProperty(prototype, 'scrollTop', {
        ...descriptor,
        set: guardedScrollTopSetter,
    });
}

function getMobileMessageEditScrollTopDescriptorTarget() {
    const prototypes = [
        globalThis.Element?.prototype,
        globalThis.HTMLElement?.prototype,
    ].filter(Boolean);

    for (const prototype of prototypes) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'scrollTop');

        if (descriptor?.get && descriptor?.set) {
            return { prototype, descriptor };
        }
    }

    return null;
}

function shouldBlockMobileMessageEditChatScrollTop(element, value) {
    if (extensionState.mobileMessageEditScrollRestoreActive) {
        return false;
    }

    if (!(element instanceof HTMLElement) || element.id !== 'chat') {
        return false;
    }

    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard || guard.chat !== element || Date.now() < Number(guard.userScrollIntentUntil || 0)) {
        return false;
    }

    const nextScrollTop = Number(value);

    if (!Number.isFinite(nextScrollTop)) {
        return false;
    }

    return Math.abs(nextScrollTop - Number(guard.scrollTop || 0)) > MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE;
}

function installMobileMessageEditScrollGuardObservers() {
    if (extensionState.mobileMessageEditScrollGuardObserversInstalled) {
        return;
    }

    const updateHandler = () => {
        scheduleMobileMessageEditScrollGuardUpdate();
    };
    const resizeHandler = () => {
        handleMobileMessageEditViewportResize();
    };
    const userScrollIntentHandler = () => {
        handleMobileMessageEditUserScrollIntent();
    };
    const mutationObserver = new MutationObserver(updateHandler);

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    document.addEventListener('focusin', updateHandler, true);
    document.addEventListener('focusout', updateHandler, true);
    document.addEventListener('touchmove', userScrollIntentHandler, { capture: true, passive: true });
    document.addEventListener('wheel', userScrollIntentHandler, { capture: true, passive: true });
    window.addEventListener('resize', resizeHandler, true);
    window.visualViewport?.addEventListener('resize', resizeHandler, true);

    extensionState.mobileMessageEditScrollGuardMutationObserver = mutationObserver;
    extensionState.mobileMessageEditScrollGuardUpdateHandler = updateHandler;
    extensionState.mobileMessageEditScrollGuardResizeHandler = resizeHandler;
    extensionState.mobileMessageEditScrollGuardUserScrollIntentHandler = userScrollIntentHandler;
    extensionState.mobileMessageEditScrollGuardObserversInstalled = true;
}

function ensureMobileMessageEditChatResizeObserver() {
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement) || typeof ResizeObserver !== 'function') {
        return;
    }

    if (extensionState.mobileMessageEditScrollGuardResizeElement === chat) {
        return;
    }

    extensionState.mobileMessageEditScrollGuardResizeObserver?.disconnect();

    const resizeObserver = new ResizeObserver(() => {
        handleMobileMessageEditChatResize();
    });

    resizeObserver.observe(chat);
    extensionState.mobileMessageEditScrollGuardResizeObserver = resizeObserver;
    extensionState.mobileMessageEditScrollGuardResizeElement = chat;
}

function scheduleMobileMessageEditScrollGuardUpdate() {
    if (extensionState.mobileMessageEditScrollGuardUpdateFrame) {
        return;
    }

    extensionState.mobileMessageEditScrollGuardUpdateFrame = requestAnimationFrame(() => {
        extensionState.mobileMessageEditScrollGuardUpdateFrame = 0;
        ensureMobileMessageEditChatResizeObserver();
        captureMobileMessageEditScrollGuard('scheduled update');
    });
}

function captureMobileMessageEditScrollGuard(reason, editor = null, { force = false } = {}) {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    const targetEditor = editor instanceof HTMLElement && editor.matches(MOBILE_MESSAGE_EDIT_SELECTOR)
        ? editor
        : document.querySelector(MOBILE_MESSAGE_EDIT_SELECTOR);
    const chat = document.querySelector('#chat');

    if (!(targetEditor instanceof HTMLElement) || !(chat instanceof HTMLElement)) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    const existingGuard = extensionState.mobileMessageEditScrollGuard;

    if (
        !force
        && existingGuard?.editor === targetEditor
        && existingGuard?.chat === chat
    ) {
        return;
    }

    extensionState.mobileMessageEditScrollGuard = {
        editor: targetEditor,
        chat,
        scrollTop: chat.scrollTop,
        chatHeight: chat.offsetHeight,
        capturedAt: Date.now(),
        reason,
        restoreTimers: [],
        userScrollIntentUntil: 0,
    };
}

function stopMobileMessageEditScrollGuard() {
    const guard = extensionState.mobileMessageEditScrollGuard;

    if (guard?.restoreTimers?.length) {
        guard.restoreTimers.forEach(timer => clearTimeout(timer));
    }

    extensionState.mobileMessageEditScrollGuard = null;
}

function handleMobileMessageEditChatResize() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        captureMobileMessageEditScrollGuard('chat resize without guard');
        return;
    }

    const nextHeight = guard.chat.offsetHeight;
    const heightDelta = nextHeight - Number(guard.chatHeight || 0);
    guard.chatHeight = nextHeight;

    if (Math.abs(heightDelta) <= MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE) {
        return;
    }

    scheduleMobileMessageEditScrollRestore(`chat resize ${heightDelta}`);
}

function handleMobileMessageEditViewportResize() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    scheduleMobileMessageEditScrollRestore('viewport resize');
}

function handleMobileMessageEditUserScrollIntent() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    guard.userScrollIntentUntil = Date.now() + 700;
}

function scheduleMobileMessageEditScrollRestore(reason) {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    queueMicrotask(() => restoreMobileMessageEditScroll(reason));
    requestAnimationFrame(() => restoreMobileMessageEditScroll(reason));

    for (const delay of MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_DELAYS) {
        const timer = setTimeout(() => {
            guard.restoreTimers = guard.restoreTimers.filter(value => value !== timer);
            restoreMobileMessageEditScroll(reason);
        }, delay);

        guard.restoreTimers.push(timer);
    }
}

function restoreMobileMessageEditScroll(reason) {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard || Date.now() < Number(guard.userScrollIntentUntil || 0)) {
        return;
    }

    const desiredScrollTop = Number(guard.scrollTop || 0);

    if (Math.abs(guard.chat.scrollTop - desiredScrollTop) <= MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE) {
        return;
    }

    try {
        extensionState.mobileMessageEditScrollRestoreActive = true;
        guard.chat.scrollTop = desiredScrollTop;
        console.debug(`${LOG_PREFIX} Restored message edit chat scroll after ${reason}: ${desiredScrollTop}`);
    } finally {
        extensionState.mobileMessageEditScrollRestoreActive = false;
    }
}

function getActiveMobileMessageEditScrollGuard() {
    const guard = extensionState.mobileMessageEditScrollGuard;

    if (
        !guard
        || !isMobileMessageEditScrollGuardEnabled()
        || !(guard.editor instanceof HTMLElement)
        || !(guard.chat instanceof HTMLElement)
        || !guard.editor.isConnected
        || !guard.chat.isConnected
        || !document.querySelector(MOBILE_MESSAGE_EDIT_SELECTOR)
    ) {
        stopMobileMessageEditScrollGuard();
        return null;
    }

    return guard;
}

function isMobileMessageEditScrollGuardEnabled() {
    return Boolean(settings.mobileMessageEditScrollGuardEnabled);
}

function patchMobileAutoKeyboardFocus() {
    const originalFocus = HTMLElement.prototype.focus;

    if (typeof originalFocus !== 'function' || originalFocus[MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY]) {
        return;
    }

    function guardedFocus(...args) {
        if (shouldSuppressMobileAutoKeyboardFocus(this)) {
            return undefined;
        }

        return originalFocus.apply(this, args);
    }

    guardedFocus[MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY] = true;
    guardedFocus.__baiBaiToolkitOriginalFocus = originalFocus;
    HTMLElement.prototype.focus = guardedFocus;
}

function patchMobileAutoKeyboardJQueryFocus() {
    const jQueryPrototype = globalThis.jQuery?.fn || globalThis.$?.fn;

    if (!jQueryPrototype) {
        return;
    }

    const originalFocus = jQueryPrototype.focus;
    if (typeof originalFocus === 'function' && !originalFocus[MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY]) {
        function guardedJQueryFocus(...args) {
            if (args.length === 0 && shouldSuppressMobileAutoKeyboardJQueryCollection(this)) {
                return this;
            }

            // PC Auto-Scroll Guard: Inject {preventScroll: true} for `#curEditTextarea` on PC or Mobile
            if (this.length > 0 && this[0].id === 'curEditTextarea' && isMobileMessageEditScrollGuardEnabled()) {
                args = [{ preventScroll: true }];
            }

            return originalFocus.apply(this, args);
        }

        guardedJQueryFocus[MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY] = true;
        guardedJQueryFocus.__baiBaiToolkitOriginalFocus = originalFocus;
        jQueryPrototype.focus = guardedJQueryFocus;
    }

    const originalTrigger = jQueryPrototype.trigger;
    if (typeof originalTrigger === 'function' && !originalTrigger[MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY]) {
        function guardedJQueryTrigger(...args) {
            if (isMobileAutoKeyboardFocusTrigger(args[0]) && shouldSuppressMobileAutoKeyboardJQueryCollection(this)) {
                return this;
            }

            return originalTrigger.apply(this, args);
        }

        guardedJQueryTrigger[MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY] = true;
        guardedJQueryTrigger.__baiBaiToolkitOriginalTrigger = originalTrigger;
        jQueryPrototype.trigger = guardedJQueryTrigger;
    }
}

function markMobileAutoKeyboardDirectFocusIntent(event) {
    const keyboardTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR)
        : null;
    const editTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_MESSAGE_EDIT_SELECTOR)
        : null;

    if (isMobileMessageEditScrollGuardEnabled() && editTarget instanceof HTMLElement) {
        captureMobileMessageEditScrollGuard('direct edit focus intent', editTarget, { force: true });

        // Record coordinates to distinguish between scroll and click
        const touch = event.touches?.[0] || event;
        extensionState.mobileAutoKeyboardTouchStartX = touch.clientX;
        extensionState.mobileAutoKeyboardTouchStartY = touch.clientY;
    }

    if (!isMobile()) {
        return;
    }

    if (keyboardTarget instanceof HTMLElement && shouldTrackMobileAutoKeyboardDirectFocusIntent(keyboardTarget)) {
        extensionState.mobileAutoKeyboardDirectFocusTarget = keyboardTarget;
        extensionState.mobileAutoKeyboardDirectFocusAt = Date.now();
    }
}

function handleMobileAutoKeyboardPointerUp(event) {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        return;
    }

    const editTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_MESSAGE_EDIT_SELECTOR)
        : null;

    if (editTarget instanceof HTMLElement) {
        // Only focus if the pointer didn't move significantly (it was a click, not a swipe)
        let isSwipe = false;

        if (event.type === 'touchend' && typeof extensionState.mobileAutoKeyboardTouchStartX === 'number') {
            const touch = event.changedTouches?.[0] || event;
            const deltaX = Math.abs(touch.clientX - extensionState.mobileAutoKeyboardTouchStartX);
            const deltaY = Math.abs(touch.clientY - extensionState.mobileAutoKeyboardTouchStartY);

            // If moved more than 10 pixels, consider it a swipe
            if (deltaX > 10 || deltaY > 10) {
                isSwipe = true;
            }
        }

        extensionState.mobileAutoKeyboardTouchStartX = null;
        extensionState.mobileAutoKeyboardTouchStartY = null;

        if (!isSwipe) {
            focusMobileMessageEditWithoutScroll(event, editTarget);
        }
    }
}

function focusMobileMessageEditWithoutScroll(event, editor) {
    if (
        document.activeElement === editor
        || Date.now() - Number(extensionState.mobileMessageEditPreventScrollFocusAt || 0) <= 300
    ) {
        return;
    }

    extensionState.mobileMessageEditPreventScrollFocusAt = Date.now();

    try {
        editor.focus({ preventScroll: true });
    } catch {
        editor.focus();
    }
}

function handleMobileAutoKeyboardFocusIn(event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
        return;
    }

    if (isMobileMessageEditScrollGuardEnabled() && target.matches(MOBILE_MESSAGE_EDIT_SELECTOR)) {
        captureMobileMessageEditScrollGuard('edit focusin', target, { force: true });
    }

    if (!shouldSuppressMobileAutoKeyboardFocus(target)) {
        return;
    }

    blurMobileAutoKeyboardTarget(target);
}

function blurMobileAutoKeyboardTarget(target) {
    if (document.activeElement === target) {
        target.blur();
    }

    const blurAgain = () => {
        if (document.activeElement === target && shouldSuppressMobileAutoKeyboardFocus(target)) {
            target.blur();
        }
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(blurAgain);
    } else {
        setTimeout(blurAgain, 0);
    }
}

function shouldSuppressMobileAutoKeyboardFocus(element) {
    return Boolean(
        isMobile()
        && element instanceof HTMLElement
        && isMobileAutoKeyboardSuppressionTarget(element)
        && !isRecentMobileAutoKeyboardDirectFocusIntent(element),
    );
}

function shouldTrackMobileAutoKeyboardDirectFocusIntent(element) {
    return Boolean(
        settings.mobileAutoKeyboardSuppressionEnabled
        && element.matches(MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR)
    );
}

function isMobileAutoKeyboardSuppressionTarget(element) {
    return Boolean(
        settings.mobileAutoKeyboardSuppressionEnabled
        && (
            element.matches(MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR)
            || element.matches(MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR)
        )
    );
}

function isRecentMobileAutoKeyboardDirectFocusIntent(element) {
    return Boolean(
        extensionState.mobileAutoKeyboardDirectFocusTarget === element
        && Date.now() - Number(extensionState.mobileAutoKeyboardDirectFocusAt || 0) <= MOBILE_AUTO_KEYBOARD_DIRECT_FOCUS_WINDOW_MS,
    );
}

function shouldSuppressMobileAutoKeyboardJQueryCollection(collection) {
    const element = collection?.[0];
    return element instanceof HTMLElement && shouldSuppressMobileAutoKeyboardFocus(element);
}

function isMobileAutoKeyboardFocusTrigger(type) {
    const eventType = typeof type === 'string'
        ? type
        : typeof type?.type === 'string'
            ? type.type
            : '';
    const normalizedType = eventType.split('.')[0];

    return normalizedType === 'focus' || normalizedType === 'focusin';
}

function handleMobileAutoKeyboardPageLifecycle(event) {
    if (!settings.mobileAutoKeyboardSuppressionEnabled || !isMobile()) {
        return;
    }

    if (event?.type === 'pagehide' || document.visibilityState === 'hidden') {
        clearMobileAutoKeyboardDirectFocusIntent();
    }

    scheduleMobileChatEntryKeyboardBlur();
}

function scheduleMobileChatEntryKeyboardBlur() {
    blurMobileChatEntryKeyboardTargetIfNeeded();

    const blurAgain = () => {
        blurMobileChatEntryKeyboardTargetIfNeeded();
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(blurAgain);
    } else {
        setTimeout(blurAgain, 0);
    }

    setTimeout(blurAgain, 100);
}

function blurMobileChatEntryKeyboardTargetIfNeeded() {
    const target = document.activeElement;
    if (target instanceof HTMLElement && target.matches(MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR) && shouldSuppressMobileAutoKeyboardFocus(target)) {
        target.blur();
    }
}

function clearMobileAutoKeyboardDirectFocusIntent() {
    extensionState.mobileAutoKeyboardDirectFocusTarget = null;
    extensionState.mobileAutoKeyboardDirectFocusAt = 0;
}

function handleChatDeleteEditFlowClick(event) {
    if (!settings.chatDeleteEditFlowOptimizationEnabled || !isChatDeleteEditFlowSupported()) {
        endChatDeleteEditWindow();
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
        return;
    }

    if (target.closest('#dialogue_del_mes_ok')) {
        if (hasSelectedMessageForDeletion()) {
            startChatDeleteEditWindow();
        }
        return;
    }

    const editButton = target.closest(CHAT_MESSAGE_EDIT_SELECTOR);
    if (!editButton || !isChatDeleteEditWindowActive()) {
        return;
    }

    if (hasActiveMessageEditor()) {
        return;
    }

    const messageElement = editButton.closest('.mes[mesid]');
    const messageId = Number(messageElement?.getAttribute('mesid'));
    if (!Number.isInteger(messageId) || messageId < 0) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void openMessageEditorDuringDeleteFlow(messageId);
}

function hasSelectedMessageForDeletion() {
    return Boolean(document.querySelector('#chat .mes.selected, #chat .del_checkbox:checked'));
}

function startChatDeleteEditWindow() {
    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowActive = true;
    extensionState.chatDeleteEditWindowStartedAt = Date.now();
    extensionState.chatDeleteEditWindowTimer = setTimeout(endChatDeleteEditWindow, CHAT_DELETE_EDIT_WINDOW_MS);
}

function scheduleChatDeleteEditWindowEnd(delayMs) {
    if (!extensionState.chatDeleteEditWindowActive) {
        return;
    }

    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowTimer = setTimeout(endChatDeleteEditWindow, delayMs);
}

function endChatDeleteEditWindow() {
    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowActive = false;
    extensionState.chatDeleteEditWindowStartedAt = 0;
}

function isChatDeleteEditWindowActive() {
    return Boolean(
        extensionState.chatDeleteEditWindowActive
        && Date.now() - Number(extensionState.chatDeleteEditWindowStartedAt || 0) <= CHAT_DELETE_EDIT_WINDOW_MS,
    );
}

async function openMessageEditorDuringDeleteFlow(messageId) {
    if (!isChatDeleteEditFlowSupported()) {
        return;
    }

    try {
        await messageEdit(messageId);
        const editor = document.querySelector('#curEditTextarea');
        const editedMessage = editor?.closest('.mes[mesid]');
        const editedMessageId = Number(editedMessage?.getAttribute('mesid'));

        if (Number.isInteger(editedMessageId)) {
            extensionState.chatDeleteFastEditorMesId = editedMessageId;
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to open message editor after message deletion`, error);
    }
}

function handleChatGenerationActionClick(event) {
    if (!settings.chatDeleteEditFlowOptimizationEnabled || !isChatDeleteEditFlowSupported() || extensionState.chatDeleteEditReplayingAction) {
        return;
    }

    if (!isFastDeleteEditorActive()) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest(CHAT_GENERATION_ACTION_SELECTOR);
    if (!action) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void commitFastDeleteEditorAndReplayAction(action);
}

function hasActiveMessageEditor() {
    return Boolean(document.querySelector('#curEditTextarea') || document.querySelector('.reasoning_edit_textarea'));
}

function isFastDeleteEditorActive() {
    const editor = document.querySelector('#curEditTextarea');
    const message = editor?.closest('.mes[mesid]');
    const messageId = Number(message?.getAttribute('mesid'));

    return Boolean(
        editor
        && Number.isInteger(messageId)
        && Number(extensionState.chatDeleteFastEditorMesId) === messageId,
    );
}

async function commitFastDeleteEditorAndReplayAction(action) {
    if (!(action instanceof HTMLElement)) {
        return;
    }

    try {
        await commitFastDeleteEditor();
        await waitForNextPaint();
        replayChatGenerationAction(action);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to commit message edit before generation action`, error);
    }
}

async function commitFastDeleteEditor() {
    if (extensionState.chatDeleteEditCommitPromise) {
        return extensionState.chatDeleteEditCommitPromise;
    }

    const doneButton = $('#chat .mes_edit_done:visible').last();
    if (!doneButton.length) {
        extensionState.chatDeleteFastEditorMesId = null;
        return;
    }

    const messageId = Number(doneButton.closest('.mes[mesid]').attr('mesid'));
    const updatedPromise = waitForMessageUpdated(messageId, 3000);

    extensionState.chatDeleteEditCommitPromise = updatedPromise
        .finally(() => {
            extensionState.chatDeleteEditCommitPromise = null;
            extensionState.chatDeleteFastEditorMesId = null;
        });

    doneButton.trigger('click');
    await extensionState.chatDeleteEditCommitPromise;
}

function waitForMessageUpdated(messageId, timeoutMs) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            eventSource.removeListener?.(event_types.MESSAGE_UPDATED, handler);
            resolve();
        };
        const handler = (updatedMessageId) => {
            if (!Number.isInteger(messageId) || Number(updatedMessageId) === messageId) {
                finish();
            }
        };
        const timeout = setTimeout(finish, timeoutMs);

        eventSource.on(event_types.MESSAGE_UPDATED, handler);
    });
}

function replayChatGenerationAction(action) {
    if (!action.isConnected) {
        return;
    }

    extensionState.chatDeleteEditReplayingAction = true;
    try {
        action.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    } finally {
        setTimeout(() => {
            extensionState.chatDeleteEditReplayingAction = false;
        }, 0);
    }
}

function applyFastChatListScrollOptimization() {
    const existingStyle = document.getElementById(FAST_CHAT_LIST_SCROLL_STYLE_ID);

    if (!settings.chatListScrollOptimizationEnabled) {
        existingStyle?.remove();
        return;
    }

    if (existingStyle) {
        return;
    }

    const style = document.createElement('style');
    style.id = FAST_CHAT_LIST_SCROLL_STYLE_ID;
    style.textContent = `
${CHAT_MANAGEMENT_POPUP_SELECTOR} ${CHAT_MANAGEMENT_LIST_SELECTOR} > .select_chat_block_wrapper {
    content-visibility: auto;
    contain: layout paint style;
    contain-intrinsic-size: 72px;
}
`;
    document.head.append(style);
}

function applyPresetScrollOptimization() {
    const existingStyle = document.getElementById(PRESET_SCROLL_STYLE_ID);

    if (!settings.presetScrollOptimizationEnabled) {
        existingStyle?.remove();
        return;
    }

    if (existingStyle) {
        existingStyle.textContent = getPresetScrollOptimizationCss();
        return;
    }

    const style = document.createElement('style');
    style.id = PRESET_SCROLL_STYLE_ID;
    style.textContent = getPresetScrollOptimizationCss();
    document.head.append(style);
}

function getPresetScrollOptimizationCss() {
    return `
${PRESET_PROMPT_MANAGER_LIST_SELECTOR} > li.completion_prompt_manager_prompt {
    contain: paint style;
}
`;
}

function applyPresetDragOptimization() {
    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();

    const handlers = extensionState[PRESET_DRAG_HANDLER_KEY];

    if (!settings.presetDragOptimizationEnabled) {
        cancelPromptManagerCustomDragPending();
        finishPromptManagerCustomDrag({ cancelled: true });
        clearPromptManagerCustomDragList();

        if (handlers) {
            document.removeEventListener('pointerdown', handlers.pointerdown, true);
            document.removeEventListener('mousedown', handlers.mousedown, true);
            document.removeEventListener('touchstart', handlers.touchstart, true);
            document.removeEventListener('click', handlers.click, true);
            delete extensionState[PRESET_DRAG_HANDLER_KEY];
        }

        restorePromptManagerStockDraggable();
        return;
    }

    if (!handlers) {
        const nextHandlers = {
            pointerdown: handlePresetPromptDragPointerDown,
            mousedown: handlePresetPromptDragMouseDown,
            touchstart: handlePresetPromptDragTouchStart,
            click: handlePresetPromptDragClick,
        };

        extensionState[PRESET_DRAG_HANDLER_KEY] = nextHandlers;
        document.addEventListener('pointerdown', nextHandlers.pointerdown, true);
        document.addEventListener('mousedown', nextHandlers.mousedown, true);
        document.addEventListener('touchstart', nextHandlers.touchstart, { capture: true, passive: false });
        document.addEventListener('click', nextHandlers.click, true);
    }

    preparePromptManagerCustomDragList();
}

function applyPresetDragOptimizationCss() {
    const existingStyle = document.getElementById(PRESET_DRAG_STYLE_ID);

    if (!settings.presetDragOptimizationEnabled) {
        existingStyle?.remove();
        return;
    }

    const css = `
${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} > li.completion_prompt_manager_prompt {
    user-select: none;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} > li.completion_prompt_manager_prompt .drag-handle {
    display: flex !important;
    touch-action: none !important;
    cursor: grab !important;
}

${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_ACTIVE_CLASS} > li.completion_prompt_manager_prompt span span span {
    transition: none;
    filter: none;
}

.${PRESET_DRAG_SOURCE_CLASS} {
    visibility: hidden !important;
}

.${PRESET_DRAG_CLONE_CLASS} {
    position: fixed !important;
    box-sizing: border-box !important;
    margin: 0 !important;
    pointer-events: none !important;
    z-index: 50000 !important;
    cursor: grabbing !important;
    opacity: 0.96;
    box-shadow: 0 8px 22px rgba(0, 0, 0, 0.35);
    will-change: transform;
}

.${PRESET_DRAG_CLONE_CLASS} .drag-handle {
    cursor: grabbing !important;
}

.${PRESET_DRAG_INDICATOR_CLASS} {
    position: fixed;
    height: 2px;
    border-radius: 999px;
    pointer-events: none;
    z-index: 50001;
    background: var(--SmartThemeQuoteColor);
    box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.25), 0 0 10px var(--SmartThemeQuoteColor);
}
`;

    if (existingStyle) {
        existingStyle.textContent = css;
        return;
    }

    const style = document.createElement('style');
    style.id = PRESET_DRAG_STYLE_ID;
    style.textContent = css;
    document.head.append(style);
}

function patchPromptManagerDraggable() {
    const manager = promptManager;

    if (!manager || typeof manager.makeDraggable !== 'function') {
        return false;
    }

    const existingPatch = extensionState[PRESET_DRAG_PATCH_KEY];

    if (existingPatch?.manager === manager && manager.makeDraggable === existingPatch.patched) {
        return true;
    }

    if (manager.makeDraggable.__baiBaiToolkitPresetDragPatched) {
        extensionState[PRESET_DRAG_PATCH_KEY] = {
            manager,
            original: manager.makeDraggable.__baiBaiToolkitOriginalMakeDraggable,
            patched: manager.makeDraggable,
        };
        return true;
    }

    const originalMakeDraggable = manager.makeDraggable;
    const patchedMakeDraggable = function (...args) {
        if (!settings.presetDragOptimizationEnabled) {
            return originalMakeDraggable.apply(this, args);
        }

        const list = this?.listElement instanceof HTMLElement
            ? this.listElement
            : document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);
        preparePromptManagerCustomDragList(list);
        return undefined;
    };

    patchedMakeDraggable.__baiBaiToolkitPresetDragPatched = true;
    patchedMakeDraggable.__baiBaiToolkitOriginalMakeDraggable = originalMakeDraggable;
    manager.makeDraggable = patchedMakeDraggable;
    extensionState[PRESET_DRAG_PATCH_KEY] = {
        manager,
        original: originalMakeDraggable,
        patched: patchedMakeDraggable,
    };

    return true;
}

function restorePromptManagerStockDraggable() {
    if (!promptManager || typeof promptManager.makeDraggable !== 'function') {
        return;
    }

    try {
        promptManager.makeDraggable();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to restore prompt manager sorting`, error);
    }
}

function preparePromptManagerCustomDragList(list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR)) {
    if (!(list instanceof HTMLElement)) {
        return false;
    }

    if (!settings.presetDragOptimizationEnabled) {
        list.classList.remove(PRESET_DRAG_READY_CLASS, PRESET_DRAG_ACTIVE_CLASS);
        return false;
    }

    disablePromptManagerStockSortable(list);
    list.classList.add(PRESET_DRAG_READY_CLASS);
    list.querySelectorAll('li.completion_prompt_manager_prompt .drag-handle')
        .forEach(handle => handle.classList.add('ui-sortable-handle'));
    return true;
}

function clearPromptManagerCustomDragList() {
    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (!(list instanceof HTMLElement)) {
        return;
    }

    list.classList.remove(PRESET_DRAG_READY_CLASS, PRESET_DRAG_ACTIVE_CLASS);
}

function disablePromptManagerStockSortable(list) {
    if (!(list instanceof HTMLElement) || typeof globalThis.jQuery?.fn?.sortable !== 'function') {
        return;
    }

    try {
        const sortableList = $(list);

        if (sortableList.sortable('instance') !== undefined) {
            sortableList.sortable('destroy');
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to disable stock prompt manager sorting`, error);
    }
}

function handlePresetPromptDragPointerDown(event) {
    if (!settings.presetDragOptimizationEnabled || !isPrimaryPresetDragButton(event)) {
        return;
    }

    if (isMobile()) {
        return;
    }

    const dragTarget = getPresetPromptDragTarget(event.target);

    if (!dragTarget) {
        return;
    }

    if (beginPromptManagerCustomDrag(event, dragTarget, getPresetDragPoint(event))) {
        extensionState.promptManagerCustomDragSuppressCompatUntil = Date.now() + 300;
        preventPresetDragEvent(event);
    }
}

function handlePresetPromptDragMouseDown(event) {
    if (!settings.presetDragOptimizationEnabled || !isPrimaryPresetDragButton(event)) {
        return;
    }

    if (isMobile()) {
        return;
    }

    const dragTarget = getPresetPromptDragTarget(event.target);

    if (!dragTarget) {
        return;
    }

    if (extensionState.promptManagerCustomDragState || shouldSuppressPromptManagerCompatDragEvent()) {
        preventPresetDragEvent(event);
        return;
    }

    if (typeof PointerEvent === 'function') {
        return;
    }

    if (beginPromptManagerCustomDrag(event, dragTarget, getPresetDragPoint(event))) {
        preventPresetDragEvent(event);
    }
}

function handlePresetPromptDragTouchStart(event) {
    if (!settings.presetDragOptimizationEnabled) {
        return;
    }

    const dragTarget = getPresetPromptDragTarget(event.target);

    if (!dragTarget) {
        return;
    }

    if (isMobile()) {
        startPromptManagerCustomDragPending(event, dragTarget, getPresetDragPoint(event));
        return;
    }

    if (extensionState.promptManagerCustomDragState || shouldSuppressPromptManagerCompatDragEvent()) {
        preventPresetDragEvent(event);
        return;
    }

    if (beginPromptManagerCustomDrag(event, dragTarget, getPresetDragPoint(event))) {
        preventPresetDragEvent(event);
    }
}

function shouldSuppressPromptManagerCompatDragEvent() {
    return Date.now() < (extensionState.promptManagerCustomDragSuppressCompatUntil ?? 0);
}

function handlePresetPromptDragClick(event) {
    if (Date.now() >= (extensionState.promptManagerCustomDragSuppressClickUntil ?? 0)) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest(PRESET_PROMPT_MANAGER_LIST_SELECTOR)) {
        return;
    }

    preventPresetDragEvent(event);
}

function startPromptManagerCustomDragPending(event, dragTarget, point) {
    if (!point || extensionState.promptManagerCustomDragState || extensionState.promptManagerCustomDragPendingState) {
        return false;
    }

    const pendingState = {
        dragTarget,
        sourceEvent: event,
        pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
        startX: point.clientX,
        startY: point.clientY,
        timer: 0,
    };

    pendingState.timer = setTimeout(() => {
        activatePromptManagerCustomDragPending();
    }, PRESET_DRAG_LONG_PRESS_MS);

    extensionState.promptManagerCustomDragPendingState = pendingState;
    document.addEventListener('pointermove', handlePromptManagerCustomDragPendingPointerMove, true);
    document.addEventListener('pointerup', handlePromptManagerCustomDragPendingPointerEnd, true);
    document.addEventListener('pointercancel', handlePromptManagerCustomDragPendingPointerCancel, true);
    document.addEventListener('touchmove', handlePromptManagerCustomDragPendingTouchMove, { capture: true, passive: true });
    document.addEventListener('touchend', handlePromptManagerCustomDragPendingTouchEnd, true);
    document.addEventListener('touchcancel', handlePromptManagerCustomDragPendingTouchCancel, true);
    document.addEventListener('keydown', handlePromptManagerCustomDragPendingKeyDown, true);
    return true;
}

function activatePromptManagerCustomDragPending() {
    const pendingState = extensionState.promptManagerCustomDragPendingState;

    if (!pendingState) {
        return;
    }

    clearPromptManagerCustomDragPending();

    const started = beginPromptManagerCustomDrag(
        pendingState.sourceEvent,
        pendingState.dragTarget,
        {
            clientX: pendingState.startX,
            clientY: pendingState.startY,
        },
        {
            suppressNextClick: true,
        },
    );

    if (started) {
        extensionState.promptManagerCustomDragSuppressCompatUntil = Date.now() + 300;
    }
}

function handlePromptManagerCustomDragPendingPointerMove(event) {
    const pendingState = extensionState.promptManagerCustomDragPendingState;

    if (!pendingState || pendingState.pointerId === null || event.pointerId !== pendingState.pointerId) {
        return;
    }

    updatePromptManagerCustomDragPendingFromEvent(event);
}

function handlePromptManagerCustomDragPendingTouchMove(event) {
    if (extensionState.promptManagerCustomDragPendingState?.pointerId !== null) {
        return;
    }

    updatePromptManagerCustomDragPendingFromEvent(event);
}

function updatePromptManagerCustomDragPendingFromEvent(event) {
    const pendingState = extensionState.promptManagerCustomDragPendingState;
    const point = getPresetDragPoint(event);

    if (!pendingState || !point) {
        return;
    }

    const distance = Math.hypot(point.clientX - pendingState.startX, point.clientY - pendingState.startY);

    if (distance > PRESET_DRAG_CANCEL_DISTANCE_PX) {
        cancelPromptManagerCustomDragPending();
    }
}

function handlePromptManagerCustomDragPendingPointerEnd(event) {
    const pendingState = extensionState.promptManagerCustomDragPendingState;

    if (!pendingState || pendingState.pointerId === null || event.pointerId !== pendingState.pointerId) {
        return;
    }

    cancelPromptManagerCustomDragPending();
}

function handlePromptManagerCustomDragPendingPointerCancel(event) {
    handlePromptManagerCustomDragPendingPointerEnd(event);
}

function handlePromptManagerCustomDragPendingTouchEnd() {
    if (extensionState.promptManagerCustomDragPendingState?.pointerId !== null) {
        return;
    }

    cancelPromptManagerCustomDragPending();
}

function handlePromptManagerCustomDragPendingTouchCancel() {
    handlePromptManagerCustomDragPendingTouchEnd();
}

function handlePromptManagerCustomDragPendingKeyDown(event) {
    if (event.key === 'Escape') {
        cancelPromptManagerCustomDragPending();
    }
}

function cancelPromptManagerCustomDragPending() {
    clearPromptManagerCustomDragPending();
}

function clearPromptManagerCustomDragPending() {
    const pendingState = extensionState.promptManagerCustomDragPendingState;

    if (!pendingState) {
        return;
    }

    clearTimeout(pendingState.timer);
    delete extensionState.promptManagerCustomDragPendingState;
    document.removeEventListener('pointermove', handlePromptManagerCustomDragPendingPointerMove, true);
    document.removeEventListener('pointerup', handlePromptManagerCustomDragPendingPointerEnd, true);
    document.removeEventListener('pointercancel', handlePromptManagerCustomDragPendingPointerCancel, true);
    document.removeEventListener('touchmove', handlePromptManagerCustomDragPendingTouchMove, true);
    document.removeEventListener('touchend', handlePromptManagerCustomDragPendingTouchEnd, true);
    document.removeEventListener('touchcancel', handlePromptManagerCustomDragPendingTouchCancel, true);
    document.removeEventListener('keydown', handlePromptManagerCustomDragPendingKeyDown, true);
}

function getPresetPromptDragTarget(target) {
    if (!(target instanceof Element)) {
        return null;
    }

    const row = target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt[data-pm-identifier]`);
    const list = row?.closest(PRESET_PROMPT_MANAGER_LIST_SELECTOR);
    const handle = row?.querySelector('.drag-handle') ?? row;
    const touchedHandle = target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .drag-handle`);

    if (!(handle instanceof HTMLElement) || !(row instanceof HTMLElement) || !(list instanceof HTMLElement)) {
        return null;
    }

    if (isMobile() && !settings.presetMobileWholeRowDragEnabled && !(touchedHandle instanceof HTMLElement)) {
        return null;
    }

    if (target.closest(PRESET_DRAG_INTERACTIVE_SELECTOR)) {
        return null;
    }

    if (!row.classList.contains('completion_prompt_manager_prompt_draggable')) {
        return null;
    }

    return { handle, row, list };
}

function isPrimaryPresetDragButton(event) {
    return typeof event.button !== 'number' || event.button === 0;
}

function getPresetDragPoint(event) {
    const touch = event?.touches?.[0] ?? event?.changedTouches?.[0];

    if (touch) {
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
        };
    }

    if (typeof event?.clientX === 'number' && typeof event?.clientY === 'number') {
        return {
            clientX: event.clientX,
            clientY: event.clientY,
        };
    }

    return null;
}

function preparePromptManagerDragClone(sourceRow, clone, rect) {
    copyComputedStylesForDragClone(sourceRow, clone);
    clone.classList.remove(PRESET_DRAG_SOURCE_CLASS);
    clone.classList.add(PRESET_DRAG_CLONE_CLASS);
    clone.style.setProperty('position', 'fixed', 'important');
    clone.style.setProperty('box-sizing', 'border-box', 'important');
    clone.style.setProperty('left', `${rect.left}px`, 'important');
    clone.style.setProperty('top', `${rect.top}px`, 'important');
    clone.style.setProperty('width', `${rect.width}px`, 'important');
    clone.style.setProperty('height', `${rect.height}px`, 'important');
    clone.style.setProperty('margin', '0', 'important');
    clone.style.setProperty('pointer-events', 'none', 'important');
    clone.style.setProperty('z-index', '50000', 'important');
    clone.style.setProperty('cursor', 'grabbing', 'important');
    clone.style.setProperty('transform', 'translate3d(0, 0, 0)', 'important');
    clone.querySelectorAll('.drag-handle').forEach(handle => {
        if (handle instanceof HTMLElement) {
            handle.style.setProperty('cursor', 'grabbing', 'important');
        }
    });
}

function copyComputedStylesForDragClone(source, clone) {
    const sourceElements = [source, ...source.querySelectorAll('*')];
    const cloneElements = [clone, ...clone.querySelectorAll('*')];

    for (let index = 0; index < sourceElements.length; index++) {
        const sourceElement = sourceElements[index];
        const cloneElement = cloneElements[index];

        if (!(sourceElement instanceof Element) || !(cloneElement instanceof HTMLElement)) {
            continue;
        }

        const computed = getComputedStyle(sourceElement);

        for (let propertyIndex = 0; propertyIndex < computed.length; propertyIndex++) {
            const property = computed[propertyIndex];

            cloneElement.style.setProperty(
                property,
                computed.getPropertyValue(property),
                computed.getPropertyPriority(property),
            );
        }
    }
}

function beginPromptManagerCustomDrag(event, { handle, row, list }, point, { suppressNextClick = false } = {}) {
    if (!point || extensionState.promptManagerCustomDragState || !isPromptManagerReadyForCustomDrag()) {
        return false;
    }

    if (!preparePromptManagerCustomDragList(list)) {
        return false;
    }

    const rows = getPromptManagerDraggableRows(list);
    const sourceIndex = rows.indexOf(row);

    if (sourceIndex < 0 || rows.length < 2) {
        return false;
    }

    const rowRect = row.getBoundingClientRect();
    const clone = row.cloneNode(true);
    const indicator = document.createElement('div');
    const scrollContainer = getPromptManagerDragScrollContainer(list);

    preparePromptManagerDragClone(row, clone, rowRect);
    indicator.className = PRESET_DRAG_INDICATOR_CLASS;

    document.body.append(clone, indicator);
    row.classList.add(PRESET_DRAG_SOURCE_CLASS);
    list.classList.add(PRESET_DRAG_ACTIVE_CLASS);

    const state = {
        list,
        row,
        rows,
        clone,
        indicator,
        handle,
        pointerId: typeof event.pointerId === 'number' ? event.pointerId : null,
        sourceIndex,
        dropIndex: sourceIndex,
        startLeft: rowRect.left,
        startTop: rowRect.top,
        offsetX: point.clientX - rowRect.left,
        offsetY: point.clientY - rowRect.top,
        clientX: point.clientX,
        clientY: point.clientY,
        scrollContainer,
        frame: 0,
        autoScrollFrame: 0,
        moved: false,
        suppressNextClick,
        originalBodyCursor: document.body.style.cursor,
    };

    extensionState.promptManagerCustomDragState = state;
    document.body.style.cursor = 'grabbing';

    if (typeof handle.setPointerCapture === 'function' && state.pointerId !== null) {
        try {
            handle.setPointerCapture(state.pointerId);
        } catch {
            // Pointer capture is opportunistic; document listeners handle the fallback.
        }
    }

    document.addEventListener('pointermove', handlePromptManagerCustomDragPointerMove, true);
    document.addEventListener('pointerup', handlePromptManagerCustomDragPointerUp, true);
    document.addEventListener('pointercancel', handlePromptManagerCustomDragPointerCancel, true);
    document.addEventListener('mousemove', handlePromptManagerCustomDragMouseMove, true);
    document.addEventListener('mouseup', handlePromptManagerCustomDragMouseUp, true);
    document.addEventListener('touchmove', handlePromptManagerCustomDragTouchMove, { capture: true, passive: false });
    document.addEventListener('touchend', handlePromptManagerCustomDragTouchEnd, true);
    document.addEventListener('touchcancel', handlePromptManagerCustomDragTouchCancel, true);
    document.addEventListener('keydown', handlePromptManagerCustomDragKeyDown, true);

    schedulePromptManagerDragFrame(state);
    return true;
}

function isPromptManagerReadyForCustomDrag() {
    return Boolean(
        promptManager
        && typeof promptManager.getPromptOrderForCharacter === 'function'
        && typeof promptManager.removePromptOrderForCharacter === 'function'
        && typeof promptManager.addPromptOrderForCharacter === 'function'
        && typeof promptManager.saveServiceSettings === 'function'
        && promptManager.activeCharacter,
    );
}

function getPromptManagerDraggableRows(list) {
    return Array.from(list.querySelectorAll('li.completion_prompt_manager_prompt[data-pm-identifier].completion_prompt_manager_prompt_draggable'))
        .filter(row => !row.classList.contains(PRESET_DRAG_CLONE_CLASS));
}

function handlePromptManagerCustomDragPointerMove(event) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state || state.pointerId === null || event.pointerId !== state.pointerId) {
        return;
    }

    updatePromptManagerCustomDragFromEvent(event);
}

function handlePromptManagerCustomDragMouseMove(event) {
    if (extensionState.promptManagerCustomDragState?.pointerId !== null) {
        return;
    }

    updatePromptManagerCustomDragFromEvent(event);
}

function handlePromptManagerCustomDragTouchMove(event) {
    if (extensionState.promptManagerCustomDragState?.pointerId !== null) {
        return;
    }

    updatePromptManagerCustomDragFromEvent(event);
}

function updatePromptManagerCustomDragFromEvent(event) {
    const state = extensionState.promptManagerCustomDragState;
    const point = getPresetDragPoint(event);

    if (!state || !point) {
        return;
    }

    preventPresetDragEvent(event);
    state.clientX = point.clientX;
    state.clientY = point.clientY;
    state.moved = true;
    schedulePromptManagerDragFrame(state);
}

function handlePromptManagerCustomDragPointerUp(event) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state || state.pointerId === null || event.pointerId !== state.pointerId) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag();
}

function handlePromptManagerCustomDragMouseUp(event) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state || state.pointerId !== null) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag();
}

function handlePromptManagerCustomDragTouchEnd(event) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state || state.pointerId !== null) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag();
}

function handlePromptManagerCustomDragPointerCancel(event) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state || state.pointerId === null || event.pointerId !== state.pointerId) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag({ cancelled: true });
}

function handlePromptManagerCustomDragTouchCancel(event) {
    if (!extensionState.promptManagerCustomDragState) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag({ cancelled: true });
}

function handlePromptManagerCustomDragKeyDown(event) {
    if (event.key !== 'Escape' || !extensionState.promptManagerCustomDragState) {
        return;
    }

    preventPresetDragEvent(event);
    finishPromptManagerCustomDrag({ cancelled: true });
}

function schedulePromptManagerDragFrame(state) {
    if (state.frame) {
        return;
    }

    state.frame = requestAnimationFrame(() => {
        state.frame = 0;
        updatePromptManagerDragFrame(state);
    });
}

function updatePromptManagerDragFrame(state) {
    if (extensionState.promptManagerCustomDragState !== state) {
        return;
    }

    const nextLeft = state.clientX - state.offsetX;
    const nextTop = state.clientY - state.offsetY;
    const translateX = nextLeft - state.startLeft;
    const translateY = nextTop - state.startTop;

    state.clone.style.setProperty('transform', `translate3d(${translateX}px, ${translateY}px, 0)`, 'important');
    state.dropIndex = getPromptManagerDropIndex(state, state.clientY);
    updatePromptManagerDragIndicator(state);
    schedulePromptManagerDragAutoScroll(state);
}

function getPromptManagerDropIndex(state, clientY) {
    const candidates = state.rows.filter(row => row !== state.row);

    for (let index = 0; index < candidates.length; index++) {
        const rect = candidates[index].getBoundingClientRect();

        if (clientY < rect.top + rect.height / 2) {
            return index;
        }
    }

    return candidates.length;
}

function updatePromptManagerDragIndicator(state) {
    const candidates = state.rows.filter(row => row !== state.row);
    const listRect = state.list.getBoundingClientRect();
    const target = candidates[state.dropIndex];
    let top = listRect.top;

    if (target instanceof HTMLElement) {
        top = target.getBoundingClientRect().top;
    } else if (candidates.length) {
        const lastRect = candidates[candidates.length - 1].getBoundingClientRect();
        top = lastRect.bottom;
    }

    state.indicator.style.left = `${listRect.left}px`;
    state.indicator.style.top = `${Math.round(top - 1)}px`;
    state.indicator.style.width = `${listRect.width}px`;
}

function schedulePromptManagerDragAutoScroll(state) {
    if (state.autoScrollFrame) {
        return;
    }

    state.autoScrollFrame = requestAnimationFrame(() => {
        state.autoScrollFrame = 0;

        if (extensionState.promptManagerCustomDragState !== state) {
            return;
        }

        const scrolled = autoScrollPromptManagerDragContainer(state);

        if (scrolled) {
            schedulePromptManagerDragFrame(state);
            schedulePromptManagerDragAutoScroll(state);
        }
    });
}

function autoScrollPromptManagerDragContainer(state) {
    const container = state.scrollContainer;

    if (!container) {
        return false;
    }

    const edgeSize = 56;
    const maxStep = 18;
    const rect = container === document.scrollingElement
        ? { top: 0, bottom: window.innerHeight }
        : container.getBoundingClientRect();
    let delta = 0;

    if (state.clientY < rect.top + edgeSize) {
        delta = -Math.ceil((1 - ((state.clientY - rect.top) / edgeSize)) * maxStep);
    } else if (state.clientY > rect.bottom - edgeSize) {
        delta = Math.ceil((1 - ((rect.bottom - state.clientY) / edgeSize)) * maxStep);
    }

    if (!delta) {
        return false;
    }

    if (container === document.scrollingElement) {
        const before = window.scrollY;
        window.scrollBy(0, delta);
        return window.scrollY !== before;
    }

    const before = container.scrollTop;
    container.scrollTop += delta;
    return container.scrollTop !== before;
}

function getPromptManagerDragScrollContainer(list) {
    const candidates = [
        promptManager?.containerElement?.closest?.('.scrollableInner'),
        list.closest('.scrollableInner'),
        list.closest('.drawer-content'),
        document.scrollingElement,
    ];

    return candidates.find(element => element instanceof HTMLElement) ?? document.scrollingElement;
}

function finishPromptManagerCustomDrag({ cancelled = false } = {}) {
    const state = extensionState.promptManagerCustomDragState;

    if (!state) {
        return;
    }

    delete extensionState.promptManagerCustomDragState;
    document.removeEventListener('pointermove', handlePromptManagerCustomDragPointerMove, true);
    document.removeEventListener('pointerup', handlePromptManagerCustomDragPointerUp, true);
    document.removeEventListener('pointercancel', handlePromptManagerCustomDragPointerCancel, true);
    document.removeEventListener('mousemove', handlePromptManagerCustomDragMouseMove, true);
    document.removeEventListener('mouseup', handlePromptManagerCustomDragMouseUp, true);
    document.removeEventListener('touchmove', handlePromptManagerCustomDragTouchMove, true);
    document.removeEventListener('touchend', handlePromptManagerCustomDragTouchEnd, true);
    document.removeEventListener('touchcancel', handlePromptManagerCustomDragTouchCancel, true);
    document.removeEventListener('keydown', handlePromptManagerCustomDragKeyDown, true);

    if (state.frame) {
        cancelAnimationFrame(state.frame);
    }

    if (state.autoScrollFrame) {
        cancelAnimationFrame(state.autoScrollFrame);
    }

    if (typeof state.handle.releasePointerCapture === 'function' && state.pointerId !== null) {
        try {
            state.handle.releasePointerCapture(state.pointerId);
        } catch {
            // Pointer capture may already be released by the browser.
        }
    }

    state.clone.remove();
    state.indicator.remove();
    state.row.classList.remove(PRESET_DRAG_SOURCE_CLASS);
    state.list.classList.remove(PRESET_DRAG_ACTIVE_CLASS);
    document.body.style.cursor = state.originalBodyCursor;

    if (state.suppressNextClick) {
        extensionState.promptManagerCustomDragSuppressClickUntil = Date.now() + PRESET_DRAG_CLICK_SUPPRESS_MS;
    }

    if (!cancelled && state.moved) {
        movePromptManagerDraggedRow(state);
    }

    if (extensionState.promptManagerTokenRefreshPendingAfterDrag) {
        extensionState.promptManagerTokenRefreshPendingAfterDrag = false;
        refreshPromptManagerTokensDebounced();
    }
}

function movePromptManagerDraggedRow(state) {
    const candidates = state.rows.filter(row => row !== state.row);
    const reference = candidates[state.dropIndex] ?? null;

    if (reference === state.row) {
        return;
    }

    const beforeOrder = state.rows.map(row => row.dataset.pmIdentifier).filter(Boolean);

    if (reference) {
        state.list.insertBefore(state.row, reference);
    } else {
        state.list.append(state.row);
    }

    const afterOrder = getPromptManagerDraggableRows(state.list).map(row => row.dataset.pmIdentifier).filter(Boolean);

    if (!areStringArraysEqual(beforeOrder, afterOrder)) {
        savePromptManagerDraggedOrder(state.list);
    }
}

function savePromptManagerDraggedOrder(list) {
    if (!isPromptManagerReadyForCustomDrag()) {
        return;
    }

    const promptOrder = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) ?? [];
    const idToObjectMap = new Map(promptOrder.filter(Boolean).map(prompt => [prompt.identifier, prompt]));
    const updatedPromptOrder = getPromptManagerDraggableRows(list)
        .map(row => idToObjectMap.get(row.dataset.pmIdentifier))
        .filter(Boolean);

    promptManager.removePromptOrderForCharacter(promptManager.activeCharacter);
    promptManager.addPromptOrderForCharacter(promptManager.activeCharacter, updatedPromptOrder);
    promptManager.log?.(`Prompt order updated for ${promptManager.activeCharacter?.name ?? 'OpenAI preset'}.`);

    Promise.resolve(promptManager.saveServiceSettings())
        .catch(error => {
            console.debug(`${LOG_PREFIX} Failed to save prompt order after drag`, error);
        });
}

function areStringArraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function preventPresetDragEvent(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
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

    installRegexQuickOperationMutationObserver();
    scheduleRegexSortablePatch();
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
    clearTimeout(state.sortablePatchTimer);
    state.sortablePatchTimer = null;
    state.sortablePatchRetries = 0;
    restoreRegexSortableStops(state);
}

function getRegexQuickOperationState() {
    if (!extensionState.regexQuickOperationOptimization || typeof extensionState.regexQuickOperationOptimization !== 'object') {
        extensionState.regexQuickOperationOptimization = {};
    }

    const state = extensionState.regexQuickOperationOptimization;

    if (!(state.sortableOriginalStops instanceof Map)) {
        state.sortableOriginalStops = new Map();
    }

    return state;
}

function installRegexQuickOperationMutationObserver() {
    if (extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY] || !document.body) {
        return;
    }

    const target = document.querySelector(REGEX_CONTAINER_SELECTOR) ?? document.body;
    const observer = new MutationObserver(() => {
        scheduleRegexSortablePatch();
    });

    observer.observe(target, { childList: true, subtree: true });
    extensionState[REGEX_QUICK_OPERATION_OBSERVER_KEY] = observer;
}

function scheduleRegexSortablePatch(delayMs = 80) {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const state = getRegexQuickOperationState();
    clearTimeout(state.sortablePatchTimer);
    state.sortablePatchTimer = setTimeout(() => {
        state.sortablePatchTimer = null;
        patchRegexSortableStops();
    }, delayMs);
}

function patchRegexSortableStops() {
    if (!settings.regexQuickOperationOptimizationEnabled) {
        return;
    }

    const state = getRegexQuickOperationState();
    let waitingForSortableInit = false;

    for (const { selector, scriptType } of getRegexScriptListDefinitions()) {
        const list = document.querySelector(selector);

        if (!(list instanceof HTMLElement)) {
            continue;
        }

        const sortable = $(list).sortable;

        if (typeof sortable !== 'function') {
            continue;
        }

        if (!isRegexSortableInitialized(list)) {
            waitingForSortableInit = true;
            continue;
        }

        const currentStop = $(list).sortable('option', 'stop');

        if (currentStop?.__baiBaiToolkitRegexQuickOperationStop) {
            continue;
        }

        if (!state.sortableOriginalStops.has(list)) {
            state.sortableOriginalStops.set(list, currentStop);
        }

        const optimizedStop = function () {
            void saveRegexScriptOrderFromDom(list, scriptType).catch(error => {
                console.debug(`${LOG_PREFIX} Failed to save regex script order`, error);
                toastr.error(t`Failed to save regex script order. See console for details.`);
            });
        };

        optimizedStop.__baiBaiToolkitRegexQuickOperationStop = true;
        optimizedStop.__baiBaiToolkitOriginalRegexStop = currentStop;
        $(list).sortable('option', 'stop', optimizedStop);
    }

    if (waitingForSortableInit) {
        state.sortablePatchRetries = (state.sortablePatchRetries ?? 0) + 1;

        if (state.sortablePatchRetries <= 20) {
            scheduleRegexSortablePatch(250);
        }
    } else {
        state.sortablePatchRetries = 0;
    }
}

function restoreRegexSortableStops(state = getRegexQuickOperationState()) {
    for (const [list, originalStop] of state.sortableOriginalStops) {
        try {
            if (list instanceof HTMLElement && isRegexSortableInitialized(list)) {
                $(list).sortable('option', 'stop', originalStop ?? null);
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to restore regex sortable handler`, error);
        }
    }

    state.sortableOriginalStops.clear();
}

function getRegexScriptListDefinitions() {
    return [
        { selector: '#saved_regex_scripts', scriptType: REGEX_SCRIPT_TYPES.GLOBAL },
        { selector: '#saved_scoped_scripts', scriptType: REGEX_SCRIPT_TYPES.SCOPED },
        { selector: '#saved_preset_scripts', scriptType: REGEX_SCRIPT_TYPES.PRESET },
    ];
}

function isRegexSortableInitialized(list) {
    return Boolean($(list).data('ui-sortable') || $(list).data('sortable'));
}

function handleRegexQuickOperationClick(event) {
    if (!settings.regexQuickOperationOptimizationEnabled) {
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
    const context = getRegexScriptContextFromRow(row);

    if (!context) {
        return;
    }

    const nextDisabled = toggle.classList.contains('regex-toggle-on');
    const previousDisabled = Boolean(context.script.disabled ?? false);

    context.script.disabled = nextDisabled;
    updateRegexScriptRowDisabled(row, nextDisabled);

    try {
        await saveRegexScriptList(context.scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(context.scriptType);
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
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

async function saveRegexScriptOrderFromDom(list, scriptType) {
    const scripts = getRegexScriptsByType(scriptType);
    const scriptById = new Map(scripts.filter(Boolean).map(script => [script.id, script]));
    const seen = new Set();
    const reorderedScripts = [];

    for (const row of list.querySelectorAll(`:scope > ${REGEX_SCRIPT_ROW_SELECTOR}`)) {
        const scriptId = row.id;
        const script = scriptById.get(scriptId);

        if (!script || seen.has(scriptId)) {
            continue;
        }

        seen.add(scriptId);
        reorderedScripts.push(script);
    }

    for (const script of scripts) {
        if (script?.id && !seen.has(script.id)) {
            reorderedScripts.push(script);
        }
    }

    if (reorderedScripts.length !== scripts.length) {
        console.debug(`${LOG_PREFIX} Regex order save skipped because DOM and data lengths differ`);
        return;
    }

    await saveRegexScriptList(scriptType, reorderedScripts);
    console.debug(`${LOG_PREFIX} Regex scripts in ${list.id} reordered without list rebuild`);
    await reloadCurrentChatForRegexChange();
}

async function saveRegexScriptList(scriptType, scripts) {
    await saveRegexScriptsByType(scripts, scriptType);
    saveSettingsDebounced();
}

function allowRegexScriptTypeAfterEditSave(scriptType) {
    if (scriptType === REGEX_SCRIPT_TYPES.SCOPED) {
        allowRegexScopedScripts(characters?.[this_chid]);
        return;
    }

    if (scriptType === REGEX_SCRIPT_TYPES.PRESET) {
        allowRegexPresetScripts(getRegexCurrentPresetAPI(), getRegexCurrentPresetName());
    }
}

async function reloadCurrentChatForRegexChange() {
    if (getCurrentChatId()) {
        await reloadCurrentChat();
    }
}

function updateRegexBulkControls() {
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

function applyPresetSwitchOptimization() {
    applyPresetSelectChangeDeferral();
    applyPresetDeleteSelectionOptimization();
    applyPresetListActionDelegation();
    applyPresetSwitchBeforeOptimization();

    if (extensionState[PRESET_SWITCH_HANDLER_KEY]) {
        return;
    }

    const handler = async () => {
        await handleOpenAiPresetChangedAfter();
    };

    extensionState[PRESET_SWITCH_HANDLER_KEY] = handler;

    if (typeof eventSource.makeFirst === 'function') {
        eventSource.makeFirst(event_types.OAI_PRESET_CHANGED_AFTER, handler);
    } else {
        eventSource.on(event_types.OAI_PRESET_CHANGED_AFTER, handler);
    }
}

function applyPresetDeleteSelectionOptimization() {
    if (extensionState[PRESET_DELETE_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handleOpenAiPresetDeleteClick(event);
    };

    extensionState[PRESET_DELETE_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function applyPresetListActionDelegation() {
    if (extensionState[PRESET_LIST_ACTION_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handlePresetListActionClick(event);
    };

    extensionState[PRESET_LIST_ACTION_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function applyPresetSwitchBeforeOptimization() {
    if (extensionState[PRESET_SWITCH_BEFORE_HANDLER_KEY]) {
        return;
    }

    const handler = async (event) => {
        await handleOpenAiPresetChangedBefore(event);
    };

    extensionState[PRESET_SWITCH_BEFORE_HANDLER_KEY] = handler;

    if (typeof eventSource.makeLast === 'function') {
        eventSource.makeLast(event_types.OAI_PRESET_CHANGED_BEFORE, handler);
    } else {
        eventSource.on(event_types.OAI_PRESET_CHANGED_BEFORE, handler);
    }
}

function applyPresetSelectChangeDeferral() {
    if (extensionState[PRESET_SELECT_CHANGE_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        deferOpenAiPresetSelectChangeOnMobile(event);
    };

    extensionState[PRESET_SELECT_CHANGE_HANDLER_KEY] = handler;
    document.addEventListener('change', handler, true);
}

function deferOpenAiPresetSelectChangeOnMobile(event) {
    if (!settings.presetSwitchOptimizationEnabled || !isMobile()) {
        return;
    }

    const select = event.target instanceof HTMLSelectElement ? event.target : null;

    if (!select?.matches(OPENAI_PRESET_SELECT_SELECTOR) || extensionState.allowOpenAiPresetSelectChange) {
        return;
    }

    event.stopPropagation();
    event.stopImmediatePropagation();
    select.blur();

    setTimeout(() => {
        extensionState.allowOpenAiPresetSelectChange = true;
        try {
            $(select).trigger('change');
        } finally {
            extensionState.allowOpenAiPresetSelectChange = false;
        }
    }, 0);
}

function handleOpenAiPresetDeleteClick(event) {
    if (!settings.presetSwitchOptimizationEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const button = target?.closest(OPENAI_PRESET_DELETE_SELECTOR);

    if (!button) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void deleteOpenAiPresetSelectingNext();
}

async function deleteOpenAiPresetSelectingNext() {
    const confirm = await callGenericPopup(t`Delete the preset? This action is irreversible and your current settings will be overwritten.`, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const select = document.querySelector(OPENAI_PRESET_SELECT_SELECTOR);
    const nameToDelete = oai_settings.preset_settings_openai;

    if (!(select instanceof HTMLSelectElement) || !nameToDelete) {
        return;
    }

    const deletedIndex = Math.max(0, select.selectedIndex);
    const value = openai_setting_names?.[nameToDelete];

    if (value !== undefined) {
        select.querySelector(`option[value="${escapeCssSelectorValue(value)}"]`)?.remove();
    } else if (select.selectedIndex >= 0) {
        select.options[select.selectedIndex]?.remove();
    }

    delete openai_setting_names[nameToDelete];
    oai_settings.preset_settings_openai = null;

    if (Object.keys(openai_setting_names).length && select.options.length) {
        const nextIndex = deletedIndex < select.options.length ? deletedIndex : 0;
        select.selectedIndex = nextIndex;
        oai_settings.preset_settings_openai = select.options[nextIndex]?.text ?? null;
        $(select).trigger('change');
    }

    const response = await fetch('/api/presets/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ apiId: 'openai', name: nameToDelete }),
    });

    if (!response.ok) {
        toastr.warning(t`Preset was not deleted from server`);
    } else {
        toastr.success(t`Preset deleted`);
        await eventSource.emit(event_types.PRESET_DELETED, { apiId: 'openai', name: nameToDelete });
    }

    saveSettingsDebounced();
}

function escapeCssSelectorValue(value) {
    const text = String(value);
    return typeof globalThis.CSS?.escape === 'function'
        ? globalThis.CSS.escape(text)
        : text.replace(/["\\]/g, '\\$&');
}

function handlePresetListActionClick(event) {
    if (!settings.presetSwitchOptimizationEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target?.closest(PRESET_PROMPT_MANAGER_LIST_SELECTOR)) {
        return;
    }

    const action = target.closest('.prompt-manager-detach-action, .prompt-manager-inspect-action, .prompt-manager-edit-action');

    if (!action) {
        return;
    }

    const handler = action.classList.contains('prompt-manager-detach-action')
        ? promptManager?.handleDetach
        : action.classList.contains('prompt-manager-inspect-action')
            ? promptManager?.handleInspect
            : promptManager?.handleEdit;

    if (typeof handler !== 'function') {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    try {
        handler.call(promptManager, event);
        schedulePresetPromptCodeMirrorEditorRefresh(undefined, { forceFromSource: true });
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to handle prompt manager list action`, error);
    }
}

async function handleOpenAiPresetChangedBefore(event) {
    extensionState.openAiPresetSwitchEarlyRendered = false;

    if (!settings.presetSwitchOptimizationEnabled || !isPromptManagerReadyForFastPresetSwitch()) {
        return;
    }

    const preset = event?.preset;

    if (!preset || typeof preset !== 'object' || (!Array.isArray(preset.prompts) && !Array.isArray(preset.prompt_order))) {
        return;
    }

    try {
        applyPromptManagerPresetFieldsEarly(preset);
        await renderPromptManagerListWithoutTokenStats();
        markPromptManagerTokensPending();
        extensionState.openAiPresetSwitchEarlyRendered = true;
        await waitForNextPaint();
    } catch (error) {
        extensionState.openAiPresetSwitchEarlyRendered = false;
        console.debug(`${LOG_PREFIX} Failed to early-render prompt manager after preset switch`, error);
    }
}

async function handleOpenAiPresetChangedAfter() {
    if (!settings.presetSwitchOptimizationEnabled || !isPromptManagerReadyForFastPresetSwitch()) {
        return;
    }

    try {
        if (!extensionState.openAiPresetSwitchEarlyRendered) {
            await renderPromptManagerListWithoutTokenStats();
            markPromptManagerTokensPending();
        }

        suppressPromptManagerDebouncedRenderForCurrentTick();
        refreshPromptManagerTokensAfterPresetSwitchDebounced();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to fast-render prompt manager after preset switch`, error);
    } finally {
        extensionState.openAiPresetSwitchEarlyRendered = false;
    }
}

function isPromptManagerReadyForFastPresetSwitch() {
    return Boolean(
        promptManager
        && typeof promptManager.renderDebounced === 'function'
        && typeof promptManager.renderPromptManager === 'function'
        && typeof promptManager.renderPromptManagerListItems === 'function'
        && promptManager.containerElement
        && promptManager.serviceSettings,
    );
}

function applyPromptManagerPresetFieldsEarly(preset) {
    if (Array.isArray(preset.prompts)) {
        oai_settings.prompts = structuredClone(preset.prompts);
    }

    if (Array.isArray(preset.prompt_order)) {
        oai_settings.prompt_order = structuredClone(preset.prompt_order);
    }

    promptManager.serviceSettings = oai_settings;
    promptManager.sanitizeServiceSettings?.();
}

async function renderPromptManagerListWithoutTokenStats() {
    const scrollContainer = promptManager.containerElement.closest('.scrollableInner');
    const scrollTop = scrollContainer?.scrollTop;

    promptManager.error = null;
    await promptManager.renderPromptManager();
    await renderPromptManagerListItemsFast();
    schedulePromptManagerDraggableInit();

    if (typeof scrollTop === 'number') {
        scrollContainer?.scrollTo(0, scrollTop);
    }
}

async function renderPromptManagerListItemsFast() {
    const promptManagerList = promptManager.listElement;

    if (!promptManager.serviceSettings?.prompts || !promptManagerList) {
        return;
    }

    const { prefix } = promptManager.configuration;
    const promptOrder = promptManager.getPromptOrderForCharacter?.(promptManager.activeCharacter) ?? [];
    const prompts = promptManager.serviceSettings.prompts.filter(Boolean);
    const promptById = new Map(prompts.map(prompt => [prompt.identifier, prompt]));
    const orderEntryById = new Map(promptOrder.filter(Boolean).map(entry => [entry.identifier, entry]));
    const counts = promptManager.tokenHandler?.getCounts?.() ?? {};
    const toggleDisabled = new Set(promptManager.configuration.toggleDisabled ?? []);
    const overriddenPrompts = new Set(Array.isArray(promptManager.overriddenPrompts) ? promptManager.overriddenPrompts : []);
    const tokenBudget = promptManager.serviceSettings.openai_max_context - promptManager.serviceSettings.openai_max_tokens;
    const isTokenUsageWarning = promptManager.tokenUsage > tokenBudget * 0.8;

    let listItemHtml = await renderTemplateAsync('promptManagerListHeader', { prefix });

    for (const orderEntry of promptOrder) {
        const prompt = promptById.get(orderEntry?.identifier);

        if (!prompt) {
            continue;
        }

        const listEntry = orderEntryById.get(prompt.identifier) ?? orderEntry;
        const enabledClass = listEntry?.enabled ? '' : `${prefix}prompt_manager_prompt_disabled`;
        const draggableClass = `${prefix}prompt_manager_prompt_draggable`;
        const markerClass = prompt.marker ? `${prefix}prompt_manager_marker` : '';
        const tokens = counts[prompt.identifier] ?? 0;
        const { warningClass, warningTitle } = getPromptTokenWarning({
            prompt,
            tokens,
            isTokenUsageWarning,
        });

        const calculatedTokens = tokens ? tokens : '-';
        const canDelete = false === prompt.system_prompt;
        const canEdit = FORCE_EDIT_PROMPTS.has(prompt.identifier) || !prompt.marker;
        const canToggle = prompt.marker && !FORCE_TOGGLE_PROMPTS.has(prompt.identifier)
            ? false
            : !toggleDisabled.has(prompt.identifier);
        const detachSpanHtml = canDelete
            ? '<span title="Remove" class="prompt-manager-detach-action caution fa-solid fa-chain-broken fa-xs"></span>'
            : '<span class="fa-solid"></span>';
        const editSpanHtml = canEdit
            ? '<span title="edit" class="prompt-manager-edit-action fa-solid fa-pencil fa-xs"></span>'
            : '<span class="fa-solid"></span>';
        const toggleSpanHtml = canToggle
            ? `<span class="prompt-manager-toggle-action ${listEntry?.enabled ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'}"></span>`
            : '<span class="fa-solid"></span>';

        listItemHtml += renderPromptManagerListRow({
            prefix,
            prompt,
            enabledClass,
            draggableClass,
            markerClass,
            importantClass: getPromptImportantClass(prompt, prefix),
            detachSpanHtml,
            editSpanHtml,
            toggleSpanHtml,
            warningClass,
            warningTitle,
            calculatedTokens,
            isOverriddenPrompt: overriddenPrompts.has(prompt.identifier),
        });
    }

    promptManagerList.innerHTML = listItemHtml;
}

function renderPromptManagerListRow({
    prefix,
    prompt,
    enabledClass,
    draggableClass,
    markerClass,
    importantClass,
    detachSpanHtml,
    editSpanHtml,
    toggleSpanHtml,
    warningClass,
    warningTitle,
    calculatedTokens,
    isOverriddenPrompt,
}) {
    const encodedId = escapeHtml(prompt.identifier);
    const encodedName = escapeHtml(prompt.name ?? '');
    const isMarkerPrompt = prompt.marker && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE;
    const isSystemPrompt = !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && !prompt.forbid_overrides;
    const isImportantPrompt = !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && prompt.forbid_overrides;
    const isUserPrompt = !prompt.marker && !prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE;
    const isInjectionPrompt = prompt.injection_position === INJECTION_POSITION.ABSOLUTE;
    const iconLookup = prompt.role === 'system' && (prompt.marker || prompt.system_prompt) ? '' : prompt.role;
    const promptRoles = {
        assistant: { roleIcon: 'fa-robot', roleTitle: 'Prompt will be sent as Assistant' },
        user: { roleIcon: 'fa-user', roleTitle: 'Prompt will be sent as User' },
    };
    const roleIcon = promptRoles[iconLookup]?.roleIcon || '';
    const roleTitle = promptRoles[iconLookup]?.roleTitle || '';

    return `
        <li class="${prefix}prompt_manager_prompt ${draggableClass} ${enabledClass} ${markerClass} ${importantClass}" data-pm-identifier="${encodedId}">
            <span class="drag-handle">☰</span>
            <span class="${prefix}prompt_manager_prompt_name" data-pm-name="${encodedName}">
                ${isMarkerPrompt ? '<span class="fa-fw fa-solid fa-thumb-tack" title="Marker"></span>' : ''}
                ${isSystemPrompt ? '<span class="fa-fw fa-solid fa-square-poll-horizontal" title="Global Prompt"></span>' : ''}
                ${isImportantPrompt ? '<span class="fa-fw fa-solid fa-star" title="Important Prompt"></span>' : ''}
                ${isUserPrompt ? '<span class="fa-fw fa-solid fa-asterisk" title="Preset Prompt"></span>' : ''}
                ${isInjectionPrompt ? '<span class="fa-fw fa-solid fa-syringe" title="In-Chat Injection"></span>' : ''}
                ${promptManager.isPromptInspectionAllowed?.(prompt) ? `<a title="${encodedName}" class="prompt-manager-inspect-action">${encodedName}</a>` : `<span title="${encodedName}">${encodedName}</span>`}
                ${roleIcon ? `<span data-role="${escapeHtml(prompt.role)}" class="fa-xs fa-solid ${roleIcon}" title="${roleTitle}"></span>` : ''}
                ${isInjectionPrompt ? `<small class="prompt-manager-injection-depth">@ ${escapeHtml(prompt.injection_depth?.toString?.() ?? '')}</small>` : ''}
                ${isOverriddenPrompt ? '<small class="fa-solid fa-address-card prompt-manager-overridden" title="Pulled from a character card"></small>' : ''}
            </span>
            <span>
                <span class="prompt_manager_prompt_controls">
                    ${detachSpanHtml}
                    ${editSpanHtml}
                    ${toggleSpanHtml}
                </span>
            </span>
            <span class="prompt_manager_prompt_tokens" data-pm-tokens="${calculatedTokens}"><span class="${warningClass}" title="${warningTitle}"> </span>${calculatedTokens}</span>
        </li>
    `;
}

function getPromptImportantClass(prompt, prefix) {
    return !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && prompt.forbid_overrides
        ? `${prefix}prompt_manager_important`
        : '';
}

function getPromptTokenWarning({ prompt, tokens, isTokenUsageWarning }) {
    const result = { warningClass: '', warningTitle: '' };

    if (!isTokenUsageWarning || prompt.identifier !== 'chatHistory') {
        return result;
    }

    if (tokens <= promptManager.configuration.dangerTokenThreshold) {
        result.warningClass = 'fa-solid tooltip fa-triangle-exclamation text_danger';
        result.warningTitle = 'Very little of your chat history is being sent, consider deactivating some other prompts.';
    } else if (tokens <= promptManager.configuration.warningTokenThreshold) {
        result.warningClass = 'fa-solid tooltip fa-triangle-exclamation text_warning';
        result.warningTitle = 'Only a few messages worth chat history is being sent.';
    }

    return result;
}

function schedulePromptManagerDraggableInit() {
    const initId = (extensionState.promptManagerDraggableInitId ?? 0) + 1;
    extensionState.promptManagerDraggableInitId = initId;

    setTimeout(() => {
        if (extensionState.promptManagerDraggableInitId !== initId) {
            return;
        }

        try {
            patchPromptManagerDraggable();
            promptManager.makeDraggable?.();
            preparePromptManagerCustomDragList();
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to initialize prompt manager sorting`, error);
        }
    }, 0);
}

function waitForNextPaint() {
    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(fallback);
            resolve();
        };
        const fallback = setTimeout(finish, 80);

        if (typeof requestAnimationFrame !== 'function') {
            finish();
            return;
        }

        requestAnimationFrame(() => setTimeout(finish, 0));
    });
}

function suppressPromptManagerDebouncedRenderForCurrentTick() {
    const originalRenderDebounced = promptManager.renderDebounced;

    if (typeof originalRenderDebounced !== 'function' || originalRenderDebounced.__baiBaiToolkitPresetSwitchSuppressed) {
        return;
    }

    const suppressedRenderDebounced = () => { };
    suppressedRenderDebounced.__baiBaiToolkitPresetSwitchSuppressed = true;
    suppressedRenderDebounced.__baiBaiToolkitOriginalRenderDebounced = originalRenderDebounced;
    promptManager.renderDebounced = suppressedRenderDebounced;

    setTimeout(() => {
        if (promptManager?.renderDebounced === suppressedRenderDebounced) {
            promptManager.renderDebounced = originalRenderDebounced;
        }
    }, 0);
}

function applyPresetToggleOptimization() {
    if (extensionState[PRESET_TOGGLE_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handlePresetPromptToggleClick(event);
    };

    extensionState[PRESET_TOGGLE_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function applyPresetSaveOptimization() {
    if (extensionState[PRESET_SAVE_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handlePresetPromptSaveClick(event);
    };

    extensionState[PRESET_SAVE_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function handlePresetPromptToggleClick(event) {
    if (!settings.presetToggleOptimizationEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-toggle-action`);

    if (!toggle) {
        return;
    }

    const row = toggle.closest('li.completion_prompt_manager_prompt');
    const promptId = row?.dataset?.pmIdentifier;

    if (!row || !promptId || !promptManager?.activeCharacter || typeof promptManager.getPromptOrderEntry !== 'function') {
        return;
    }

    const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, promptId);

    if (!promptOrderEntry) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    promptOrderEntry.enabled = !promptOrderEntry.enabled;

    const counts = promptManager.tokenHandler?.getCounts?.();

    if (counts) {
        counts[promptId] = null;
    }

    updatePromptToggleRow(row, toggle, promptOrderEntry.enabled);
    updatePromptTokenCell(row, null);
    void Promise.resolve(promptManager.saveServiceSettings?.()).catch(error => {
        console.debug(`${LOG_PREFIX} Failed to save prompt toggle state`, error);
    });

    refreshPromptManagerTokensDebounced();
}

function handlePresetPromptSaveClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    const saveButton = target?.closest(PRESET_PROMPT_MANAGER_SAVE_SELECTOR);

    if (!saveButton) {
        return;
    }

    flushPresetPromptCodeMirrorEditor('optimized save click');

    if (!settings.presetToggleOptimizationEnabled || !promptManager || typeof promptManager.getPromptById !== 'function') {
        scheduleOpenAiPresetSaveAfterPromptEdit();
        return;
    }

    const promptId = saveButton.dataset.pmPrompt;
    const prompt = promptId ? promptManager.getPromptById(promptId) : null;

    if (!prompt || typeof promptManager.updatePromptWithPromptEditForm !== 'function') {
        scheduleOpenAiPresetSaveAfterPromptEdit();
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    promptManager.updatePromptWithPromptEditForm(prompt);
    updateQuickEditPrompt(promptId, prompt);
    updatePromptManagerRowFromPrompt(prompt);
    promptManager.hidePopup?.();
    promptManager.clearEditForm?.();

    void Promise.resolve(promptManager.saveServiceSettings?.())
        .then(saveOpenAiPresetAfterPromptEdit)
        .catch(error => {
            console.debug(`${LOG_PREFIX} Failed to save prompt edits`, error);
        });

    refreshPromptManagerTokensDebounced();
}

function scheduleOpenAiPresetSaveAfterPromptEdit() {
    if (!settings.presetAutoSaveAfterPromptEditEnabled) {
        return;
    }

    setTimeout(() => {
        void Promise.resolve(promptManager?.saveServiceSettings?.())
            .then(saveOpenAiPresetAfterPromptEdit)
            .catch(error => {
                console.debug(`${LOG_PREFIX} Failed to prepare prompt edit preset save`, error);
            });
    }, 0);
}

function saveOpenAiPresetAfterPromptEdit() {
    if (!settings.presetAutoSaveAfterPromptEditEnabled) {
        return;
    }

    $(OPENAI_PRESET_UPDATE_SELECTOR).trigger('click');
}

function updatePromptToggleRow(row, toggle, isEnabled) {
    row.classList.toggle('completion_prompt_manager_prompt_disabled', !isEnabled);
    toggle.classList.toggle('fa-toggle-on', isEnabled);
    toggle.classList.toggle('fa-toggle-off', !isEnabled);
}

function updatePromptTokenCell(row, value) {
    const tokenCell = row.querySelector('.prompt_manager_prompt_tokens');

    if (!tokenCell) {
        return;
    }

    const displayValue = value ? String(value) : '-';
    const warningSpan = tokenCell.querySelector('span') ?? document.createElement('span');
    warningSpan.className = '';
    warningSpan.title = '';
    warningSpan.textContent = ' ';
    tokenCell.dataset.pmTokens = displayValue;
    tokenCell.replaceChildren(warningSpan, document.createTextNode(displayValue));
}

function updateQuickEditPrompt(promptId, prompt) {
    if (!['main', 'nsfw', 'jailbreak'].includes(promptId)) {
        return;
    }

    promptManager.updateQuickEdit?.(promptId, prompt);
}

function updatePromptManagerRowFromPrompt(prompt) {
    const row = findPromptManagerRow(prompt.identifier);

    if (!row) {
        return;
    }

    const listEntry = promptManager.getPromptOrderEntry?.(promptManager.activeCharacter, prompt.identifier);
    const isEnabled = listEntry?.enabled ?? true;
    const isImportantPrompt = !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && prompt.forbid_overrides;

    row.classList.toggle('completion_prompt_manager_prompt_disabled', !isEnabled);
    row.classList.toggle('completion_prompt_manager_marker', Boolean(prompt.marker));
    row.classList.toggle('completion_prompt_manager_important', Boolean(isImportantPrompt));

    const nameContainer = row.querySelector('.completion_prompt_manager_prompt_name');

    if (nameContainer) {
        renderPromptNameCell(nameContainer, prompt);
    }

    updatePromptTokenCell(row, null);
}

function findPromptManagerRow(promptId) {
    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (!list) {
        return null;
    }

    return Array.from(list.querySelectorAll('li.completion_prompt_manager_prompt[data-pm-identifier]'))
        .find(row => row.dataset.pmIdentifier === promptId) ?? null;
}

function renderPromptNameCell(container, prompt) {
    const promptName = prompt.name ?? '';
    const isMarkerPrompt = prompt.marker && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE;
    const isSystemPrompt = !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && !prompt.forbid_overrides;
    const isImportantPrompt = !prompt.marker && prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE && prompt.forbid_overrides;
    const isUserPrompt = !prompt.marker && !prompt.system_prompt && prompt.injection_position !== INJECTION_POSITION.ABSOLUTE;
    const isInjectionPrompt = prompt.injection_position === INJECTION_POSITION.ABSOLUTE;
    const isOverriddenPrompt = Array.isArray(promptManager.overriddenPrompts) && promptManager.overriddenPrompts.includes(prompt.identifier);
    const iconLookup = prompt.role === 'system' && (prompt.marker || prompt.system_prompt) ? '' : prompt.role;
    const promptRoles = {
        assistant: { roleIcon: 'fa-robot', roleTitle: 'Prompt will be sent as Assistant' },
        user: { roleIcon: 'fa-user', roleTitle: 'Prompt will be sent as User' },
    };
    const role = promptRoles[iconLookup];

    container.dataset.pmName = promptName;
    container.replaceChildren();

    if (isMarkerPrompt) appendIcon(container, 'fa-fw fa-solid fa-thumb-tack', 'Marker');
    if (isSystemPrompt) appendIcon(container, 'fa-fw fa-solid fa-square-poll-horizontal', 'Global Prompt');
    if (isImportantPrompt) appendIcon(container, 'fa-fw fa-solid fa-star', 'Important Prompt');
    if (isUserPrompt) appendIcon(container, 'fa-fw fa-solid fa-asterisk', 'Preset Prompt');
    if (isInjectionPrompt) appendIcon(container, 'fa-fw fa-solid fa-syringe', 'In-Chat Injection');

    const nameElement = document.createElement(promptManager.isPromptInspectionAllowed?.(prompt) ? 'a' : 'span');
    nameElement.title = promptName;
    nameElement.textContent = promptName;

    if (nameElement instanceof HTMLAnchorElement) {
        nameElement.className = 'prompt-manager-inspect-action';
        nameElement.addEventListener('click', promptManager.handleInspect);
    }

    container.append(nameElement);

    if (role) {
        const roleIcon = document.createElement('span');
        roleIcon.dataset.role = prompt.role;
        roleIcon.className = `fa-xs fa-solid ${role.roleIcon}`;
        roleIcon.title = role.roleTitle;
        container.append(document.createTextNode(' '), roleIcon);
    }

    if (isInjectionPrompt) {
        const depth = document.createElement('small');
        depth.className = 'prompt-manager-injection-depth';
        depth.textContent = `@ ${prompt.injection_depth}`;
        container.append(document.createTextNode(' '), depth);
    }

    if (isOverriddenPrompt) {
        const overridden = document.createElement('small');
        overridden.className = 'fa-solid fa-address-card prompt-manager-overridden';
        overridden.title = 'Pulled from a character card';
        container.append(document.createTextNode(' '), overridden);
    }
}

function appendIcon(container, className, title) {
    const icon = document.createElement('span');
    icon.className = className;
    icon.title = title;
    container.append(icon, document.createTextNode(' '));
}

const refreshPromptManagerTokensDebounced = debounce(refreshPromptManagerTokens, 1000);
const refreshPromptManagerTokensAfterPresetSwitchDebounced = debounce(refreshPromptManagerTokens, 250);

async function refreshPromptManagerTokens() {
    if (!isPromptManagerTokenRefreshEnabled()) {
        return;
    }

    if (extensionState.promptManagerCustomDragState) {
        extensionState.promptManagerTokenRefreshPendingAfterDrag = true;
        return;
    }

    try {
        await promptManager.tryGenerate();
        updatePromptManagerTokenDisplay();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to refresh prompt manager token counts`, error);
    }
}

function isPromptManagerTokenRefreshEnabled() {
    return Boolean(
        promptManager?.tryGenerate
        && (settings.presetToggleOptimizationEnabled || settings.presetSwitchOptimizationEnabled),
    );
}

function markPromptManagerTokensPending() {
    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (!list) {
        return;
    }

    for (const row of list.querySelectorAll('li.completion_prompt_manager_prompt[data-pm-identifier]')) {
        updatePromptTokenCell(row, null);
    }

    const header = document.querySelector('.completion_prompt_manager_header');
    const totalContainer = header?.querySelector(':scope > div:last-child');
    const totalLabel = totalContainer?.querySelector('span');

    if (totalContainer && totalLabel) {
        totalContainer.replaceChildren(totalLabel, document.createTextNode(' - '));
    }
}

function updatePromptManagerTokenDisplay() {
    const counts = promptManager?.tokenHandler?.getCounts?.();
    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (!counts || !list) {
        return;
    }

    for (const row of list.querySelectorAll('li.completion_prompt_manager_prompt[data-pm-identifier]')) {
        updatePromptTokenCell(row, counts[row.dataset.pmIdentifier] ?? 0);
    }

    const header = document.querySelector('.completion_prompt_manager_header');
    const totalContainer = header?.querySelector(':scope > div:last-child');
    const totalLabel = totalContainer?.querySelector('span');

    if (totalContainer && totalLabel) {
        totalContainer.replaceChildren(totalLabel, document.createTextNode(` ${promptManager.tokenUsage ?? 0} `));
    }
}

function applyPresetPromptCodeMirrorEditorOptimization() {
    if (settings.presetPromptCodeMirrorEditorEnabled) {
        installPresetPromptCodeMirrorEditorOptimization();
    } else {
        removePresetPromptCodeMirrorEditorOptimization();
    }
}

function installPresetPromptCodeMirrorEditorOptimization() {
    const state = getPresetPromptCodeMirrorEditorState();
    state.enabled = true;

    applyPresetPromptCodeMirrorEditorStyle();
    installPresetPromptCodeMirrorEditorGlobalListeners(state);
    refreshPresetPromptCodeMirrorEditorTarget(state);
    installPresetPromptCodeMirrorEditorMutationObserver(state);
}

function removePresetPromptCodeMirrorEditorOptimization() {
    const state = extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY];

    if (!state) {
        return;
    }

    flushPresetPromptCodeMirrorEditor('disable');
    state.enabled = false;

    if (state.refreshFrame) {
        cancelAnimationFrame(state.refreshFrame);
        state.refreshFrame = 0;
    }

    state.mutationObserver?.disconnect();
    state.mutationObserver = null;
    detachPresetPromptCodeMirrorEditor(state);

    for (const listener of state.globalListeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.globalListeners = [];
    removePresetPromptCodeMirrorEditorStyle();
    delete extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY];
}

function getPresetPromptCodeMirrorEditorState() {
    if (!extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY]) {
        extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY] = {
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
            sourceValue: '',
            disabled: false,
            forceSyncFromSource: false,
        };
    }

    return extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY];
}

function installPresetPromptCodeMirrorEditorGlobalListeners(state) {
    if (state.globalListeners.length > 0) {
        return;
    }

    const clickHandler = (event) => {
        const target = event.target instanceof Element ? event.target : null;

        if (!target) {
            return;
        }

        if (target.closest(PRESET_PROMPT_MANAGER_SAVE_SELECTOR)) {
            flushPresetPromptCodeMirrorEditor('save click');
        }

        if (target.closest(`.editor_maximize[data-for="${PRESET_PROMPT_EDITOR_SOURCE_ID}"]`)) {
            flushPresetPromptCodeMirrorEditor('maximize click');
            schedulePresetPromptCodeMirrorEditorRefresh(state, { forceFromSource: true });
        }

        if (
            target.closest(PRESET_PROMPT_MANAGER_RESET_SELECTOR)
            || target.closest(PRESET_PROMPT_MANAGER_CLOSE_SELECTOR)
            || target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-edit-action, ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-inspect-action, ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-detach-action`)
            || target.closest('#completion_prompt_manager .completion_prompt_manager_footer .menu_button')
        ) {
            schedulePresetPromptCodeMirrorEditorRefresh(state, { forceFromSource: true });
        }
    };
    const inputHandler = (event) => {
        if (event.target === state.source) {
            schedulePresetPromptCodeMirrorEditorRefresh(state, { forceFromSource: true });
        }
    };
    const blurHandler = (event) => {
        const target = event.target instanceof HTMLTextAreaElement ? event.target : null;

        if (target?.id?.endsWith('_prompt_quick_edit_textarea')) {
            schedulePresetPromptCodeMirrorEditorRefresh(state, { forceFromSource: true });
        }
    };
    const pageLifecycleHandler = () => {
        flushPresetPromptCodeMirrorEditor('page lifecycle');
    };

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('input', inputHandler, true);
    document.addEventListener('blur', blurHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);

    state.globalListeners.push(
        { target: document, type: 'click', handler: clickHandler, options: true },
        { target: document, type: 'input', handler: inputHandler, options: true },
        { target: document, type: 'blur', handler: blurHandler, options: true },
        { target: window, type: 'pagehide', handler: pageLifecycleHandler, options: undefined },
        { target: document, type: 'visibilitychange', handler: pageLifecycleHandler, options: undefined },
    );
}

function installPresetPromptCodeMirrorEditorMutationObserver(state) {
    if (state.mutationObserver || typeof MutationObserver !== 'function') {
        return;
    }

    const root = document.body || document.documentElement;

    if (!root) {
        return;
    }

    state.mutationObserver = new MutationObserver((mutations) => {
        if (arePresetPromptCodeMirrorMutationsInternal(state, mutations)) {
            return;
        }

        schedulePresetPromptCodeMirrorEditorRefresh(state);
    });
    state.mutationObserver.observe(root, { childList: true, subtree: true });
}

function arePresetPromptCodeMirrorMutationsInternal(state, mutations) {
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

function schedulePresetPromptCodeMirrorEditorRefresh(state = extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY], { forceFromSource = false } = {}) {
    if (!state?.enabled) {
        return;
    }

    if (forceFromSource) {
        state.forceSyncFromSource = true;
    }

    if (state.refreshFrame) {
        return;
    }

    state.refreshFrame = requestAnimationFrame(() => {
        state.refreshFrame = 0;
        refreshPresetPromptCodeMirrorEditorTarget(state);
    });
}

function refreshPresetPromptCodeMirrorEditorTarget(state) {
    if (!state?.enabled) {
        return;
    }

    const source = getPresetPromptCodeMirrorSource();

    if (!(source instanceof HTMLTextAreaElement) || !source.isConnected) {
        detachPresetPromptCodeMirrorEditor(state);
        return;
    }

    if (state.source === source && state.wrapper?.isConnected) {
        const disabled = isPresetPromptCodeMirrorSourceDisabled(source);

        if (state.disabled !== disabled) {
            detachPresetPromptCodeMirrorEditor(state);
            attachPresetPromptCodeMirrorEditor(state, source);
            return;
        }

        updatePresetPromptCodeMirrorSourceClasses(state, source, state.wrapper);

        if (state.forceSyncFromSource) {
            state.forceSyncFromSource = false;
            syncPresetPromptCodeMirrorFromSource(state, { force: true });
            return;
        }

        syncPresetPromptCodeMirrorFromSourceIfClean(state);
        return;
    }

    detachPresetPromptCodeMirrorEditor(state);
    attachPresetPromptCodeMirrorEditor(state, source);
}

function getPresetPromptCodeMirrorSource() {
    const maximizedSource = document.querySelector(PRESET_PROMPT_MAXIMIZED_SOURCE_SELECTOR);

    if (maximizedSource instanceof HTMLTextAreaElement && maximizedSource.isConnected) {
        return maximizedSource;
    }

    return document.querySelector(PRESET_PROMPT_EDITOR_SOURCE_SELECTOR);
}

function attachPresetPromptCodeMirrorEditor(state, source) {
    const wrapper = document.createElement('div');

    wrapper.id = PRESET_PROMPT_CODEMIRROR_EDITOR_ID;
    wrapper.className = PRESET_PROMPT_CODEMIRROR_EDITOR_CLASS;
    wrapper.textContent = 'Loading CodeMirror...';
    updatePresetPromptCodeMirrorSourceClasses(state, source, wrapper);
    source.classList.add(PRESET_PROMPT_SOURCE_HIDDEN_CLASS);
    source.insertAdjacentElement('afterend', wrapper);

    state.source = source;
    state.wrapper = wrapper;
    state.dirty = false;
    state.sourceValue = source.value || '';
    state.disabled = isPresetPromptCodeMirrorSourceDisabled(source);
    state.forceSyncFromSource = false;

    const focusOutHandler = () => {
        setTimeout(() => {
            if (state.dirty && state.wrapper && !state.wrapper.contains(document.activeElement)) {
                flushPresetPromptCodeMirrorEditor('blur');
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

            createPresetPromptCodeMirrorView(state, source, wrapper, modules);
        })
        .catch((error) => {
            console.warn(`${LOG_PREFIX} CodeMirror preset prompt editor failed; falling back to stock textarea.`, error);

            if (state.enabled && state.source === source && state.wrapper === wrapper && state.loadingToken === loadingToken) {
                settings.presetPromptCodeMirrorEditorEnabled = false;
                saveExtensionSettings();
                $('#bai_bai_toolkit_preset_prompt_codemirror_editor_enabled').prop('checked', false);
                removePresetPromptCodeMirrorEditorOptimization();
            }
        });
}

function updatePresetPromptCodeMirrorSourceClasses(state, source, wrapper) {
    const disabled = isPresetPromptCodeMirrorSourceDisabled(source);
    const maximized = isPresetPromptCodeMirrorMaximizedSource(source);

    state.disabled = disabled;
    wrapper.classList.toggle(PRESET_PROMPT_CODEMIRROR_READONLY_CLASS, disabled);
    wrapper.classList.toggle(PRESET_PROMPT_CODEMIRROR_MAXIMIZED_CLASS, maximized);
    wrapper.setAttribute('aria-disabled', String(disabled));
}

function isPresetPromptCodeMirrorSourceDisabled(source) {
    if (!(source instanceof HTMLTextAreaElement)) {
        return false;
    }

    if (source.disabled) {
        return true;
    }

    if (!isPresetPromptCodeMirrorMaximizedSource(source)) {
        return false;
    }

    return document.getElementById(PRESET_PROMPT_EDITOR_SOURCE_ID)?.disabled === true;
}

function isPresetPromptCodeMirrorMaximizedSource(source) {
    return source instanceof HTMLTextAreaElement && source.matches(PRESET_PROMPT_MAXIMIZED_SOURCE_SELECTOR);
}

function createPresetPromptCodeMirrorView(state, source, wrapper, modules) {
    const {
        EditorState,
        EditorView,
        keymap,
        defaultKeymap = [],
        history,
        historyKeymap = [],
    } = modules;
    const useHistory = source.value.length <= DESCRIPTION_CODEMIRROR_HISTORY_MAX_LENGTH;
    const disabled = isPresetPromptCodeMirrorSourceDisabled(source);
    const extensions = [
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
            if (!update.docChanged || state.syncingFromSource) {
                return;
            }

            state.dirty = true;
            if (syncPresetPromptCodeMirrorToSource(state) && isPresetPromptCodeMirrorMaximizedSource(state.source)) {
                dispatchDescriptionEditorSourceInput(state.source);
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
                minHeight: 'min(34vh, 360px)',
                minWidth: '0',
                overflow: 'hidden',
                textShadow: 'none',
                width: '100%',
            },
            '&.cm-focused': {
                outline: 'none',
            },
            '.cm-scroller': {
                fontFamily: 'inherit',
                lineHeight: '1.35',
                maxHeight: 'min(44vh, 440px)',
                minHeight: 'min(34vh, 360px)',
                minWidth: '0',
                overflow: 'auto',
                overflowAnchor: 'none',
                overscrollBehavior: 'contain',
                touchAction: 'pan-y',
                WebkitOverflowScrolling: 'touch',
            },
            '.cm-content': {
                caretColor: 'var(--SmartThemeBodyColor)',
                minWidth: '0',
                padding: '8px',
                textShadow: 'none',
                minHeight: 'min(34vh, 360px)',
            },
            '.cm-line': {
                padding: '0',
            },
        }),
    ];

    if (disabled && EditorState.readOnly?.of) {
        extensions.push(EditorState.readOnly.of(true));
    }

    if (EditorView.editable?.of) {
        extensions.push(EditorView.editable.of(!disabled));
    }

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
            'aria-label': source.getAttribute('aria-label') || 'Preset prompt',
            'aria-readonly': String(disabled),
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

function detachPresetPromptCodeMirrorEditor(state) {
    if (!state.source && !state.wrapper && !state.view) {
        return;
    }

    for (const listener of state.listeners || []) {
        listener.target.removeEventListener(listener.type, listener.handler, listener.options);
    }

    state.listeners = [];
    state.view?.destroy?.();
    state.source?.classList.remove(PRESET_PROMPT_SOURCE_HIDDEN_CLASS);
    state.wrapper?.remove();
    state.source = null;
    state.wrapper = null;
    state.view = null;
    state.dirty = false;
    state.syncingFromSource = false;
    state.loadingToken = null;
    state.sourceValue = '';
    state.disabled = false;
    state.forceSyncFromSource = false;
}

function getPresetPromptCodeMirrorValue(state) {
    return state.view?.state?.doc?.toString?.() ?? '';
}

function syncPresetPromptCodeMirrorToSource(state) {
    if (!(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    const value = getPresetPromptCodeMirrorValue(state);
    const changed = state.source.value !== value;

    if (changed) {
        state.source.value = value;
    }

    state.sourceValue = value;

    return changed;
}

function syncPresetPromptCodeMirrorFromSourceIfClean(state) {
    return syncPresetPromptCodeMirrorFromSource(state, { force: false });
}

function syncPresetPromptCodeMirrorFromSource(state, { force = false } = {}) {
    if ((!force && state.dirty) || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    const value = state.source.value || '';
    const current = getPresetPromptCodeMirrorValue(state);

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
            state.sourceValue = value;
        } finally {
            state.syncingFromSource = false;
        }

        return true;
    }

    state.dirty = false;
    state.sourceValue = value;

    return false;
}

function flushPresetPromptCodeMirrorEditor(reason, { dispatchInput = false } = {}) {
    const state = extensionState[PRESET_PROMPT_CODEMIRROR_EDITOR_KEY];

    if (!state?.enabled || state.flushing || !(state.source instanceof HTMLTextAreaElement) || !state.view) {
        return false;
    }

    state.flushing = true;

    try {
        const changed = syncPresetPromptCodeMirrorToSource(state) || state.dirty;
        state.dirty = false;

        if (changed && dispatchInput) {
            dispatchDescriptionEditorSourceInput(state.source);
        }

        if (changed) {
            console.debug(`${LOG_PREFIX} CodeMirror preset prompt editor flushed after ${reason}`);
        }

        return changed;
    } finally {
        state.flushing = false;
    }
}

function applyPresetPromptCodeMirrorEditorStyle() {
    let style = document.getElementById(PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID} {
    box-sizing: border-box;
    display: block;
    width: 100%;
}

#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID}.${PRESET_PROMPT_CODEMIRROR_READONLY_CLASS} {
    opacity: 0.72;
}

#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID}.${PRESET_PROMPT_CODEMIRROR_MAXIMIZED_CLASS} {
    flex: 1 1 auto;
    height: 100%;
    min-height: 0;
}

#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID}.${PRESET_PROMPT_CODEMIRROR_MAXIMIZED_CLASS} .cm-editor,
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID}.${PRESET_PROMPT_CODEMIRROR_MAXIMIZED_CLASS} .cm-scroller {
    height: 100%;
    max-height: none !important;
    min-height: 0 !important;
}

.${PRESET_PROMPT_SOURCE_HIDDEN_CLASS} {
    display: none !important;
}
`;
}

function removePresetPromptCodeMirrorEditorStyle() {
    document.getElementById(PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID)?.remove();
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
                overscrollBehavior: 'contain',
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

function observeChatManagementPopupCleanup() {
    if (extensionState.chatManagementPopupObserver) {
        return;
    }

    const attachObserver = () => {
        const popup = document.querySelector(CHAT_MANAGEMENT_POPUP_SELECTOR);

        if (!popup) {
            return false;
        }

        let wasVisible = isElementDisplayed(popup);
        const observer = new MutationObserver(() => {
            const isVisible = isElementDisplayed(popup);

            if (wasVisible && !isVisible) {
                clearChatManagementPopupContent(popup);
            }

            wasVisible = isVisible;
        });

        observer.observe(popup, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });

        extensionState.chatManagementPopupObserver = observer;
        return true;
    };

    if (attachObserver()) {
        return;
    }

    const bodyObserver = new MutationObserver(() => {
        if (attachObserver()) {
            bodyObserver.disconnect();
            extensionState.chatManagementPopupAttachObserver = null;
        }
    });

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    extensionState.chatManagementPopupAttachObserver = bodyObserver;
}

function isElementDisplayed(element) {
    return getComputedStyle(element).display !== 'none';
}

function clearChatManagementPopupContent(popup) {
    if (!settings.chatListAutoClearEnabled) {
        return;
    }

    fastChatListRequestId += 1;

    const list = popup.querySelector(CHAT_MANAGEMENT_LIST_SELECTOR);

    if (!list || !list.children.length) {
        return;
    }

    list.replaceChildren();
}

function patchFastChatSearchFetch() {
    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function' || originalFetch[FAST_CHAT_SEARCH_FETCH_KEY]) {
        return;
    }

    async function baiBaiToolkitFetch(input, init) {
        const requestData = await getFastChatSearchRequestData(input, init);

        if (requestData) {
            try {
                return await fetchFastCharacterChatList(originalFetch, requestData);
            } catch (error) {
                console.debug(`${LOG_PREFIX} Fast chat list path failed; falling back to /api/chats/search`, error);
            }
        }

        return originalFetch.apply(this, arguments);
    }

    baiBaiToolkitFetch[FAST_CHAT_SEARCH_FETCH_KEY] = true;
    baiBaiToolkitFetch.__baiBaiToolkitOriginalFetch = originalFetch;
    globalThis.fetch = baiBaiToolkitFetch;
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

async function getFastChatSearchRequestData(input, init) {
    if (!settings.fastChatListEnabled) {
        return null;
    }

    if (!isChatSearchUrl(input)) {
        return null;
    }

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (method !== 'POST') {
        return null;
    }

    const body = await readJsonRequestBody(input, init);

    if (!body || typeof body !== 'object') {
        return null;
    }

    const query = String(body.query ?? '');
    const avatarUrl = body.avatar_url;
    const groupId = body.group_id;

    if (query.trim().length !== 0 || groupId || typeof avatarUrl !== 'string' || avatarUrl.length === 0) {
        return null;
    }

    return { avatarUrl };
}

function isChatSearchUrl(input) {
    try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const url = new URL(rawUrl, location.origin);
        return url.origin === location.origin && url.pathname === '/api/chats/search';
    } catch {
        return false;
    }
}

async function readJsonRequestBody(input, init) {
    const initBody = init?.body;

    if (typeof initBody === 'string') {
        return tryParseJson(initBody);
    }

    if (input instanceof Request) {
        try {
            return await input.clone().json().catch(() => null);
        } catch {
            return null;
        }
    }

    return null;
}

async function fetchFastCharacterChatList(fetchFn, { avatarUrl }) {
    const response = await fetchFn('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatarUrl, simple: true }),
    });

    if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
    }

    const chats = await response.json();
    const searchResults = Array.isArray(chats) ? chats.map(toPlaceholderChatSearchResult).filter(Boolean) : [];
    searchResults.sort((a, b) => getTimestampValue(b.last_mes) - getTimestampValue(a.last_mes));
    const requestId = ++fastChatListRequestId;

    setTimeout(() => {
        markFastChatRowsAsLoading(searchResults, requestId);
        void hydrateFastCharacterChatList(fetchFn, avatarUrl, requestId);
    }, 0);

    return new Response(JSON.stringify(searchResults), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

async function hydrateFastCharacterChatList(fetchFn, avatarUrl, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    try {
        const chats = await fetchFullCharacterChatList(fetchFn, avatarUrl);
        applyHydratedChatRows(chats, requestId);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to hydrate full chat list metadata`, error);
    }
}

async function fetchFullCharacterChatList(fetchFn, avatarUrl) {
    const response = await fetchFn('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatarUrl }),
    });

    if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
    }

    const chats = await response.json();
    return Array.isArray(chats) ? chats.map(toChatSearchResult).filter(Boolean) : [];
}

function markFastChatRowsAsLoading(chats, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    for (const chat of chats) {
        const row = findChatListRow(chat.file_name);

        if (!row.length) {
            continue;
        }

        row.find('.chat_file_size').text('(...,');
        row.find('.chat_messages_num').text('... 💬)');
    }
}

function applyHydratedChatRow(chat, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    const row = findChatListRow(chat.file_name);

    if (!row.length) {
        return;
    }

    row.find('.chat_file_size').text(`(${chat.file_size},`);
    row.find('.chat_messages_num').text(`${chat.message_count} 💬)`);
    row.find('.select_chat_block_mes').text(chat.preview_message);
    row.find('.chat_messages_date').text(timestampToMoment(chat.last_mes).format('lll'));
}

function applyHydratedChatRows(chats, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    const order = new Map();

    chats.forEach((chat, index) => {
        applyHydratedChatRow(chat, requestId);
        order.set(chat.file_name, {
            index,
            time: getTimestampValue(chat.last_mes),
        });
    });

    sortHydratedChatRows(order);
}

function sortHydratedChatRows(order) {
    const container = $('#select_chat_div');
    const rows = container.children('.select_chat_block_wrapper').get();

    rows.sort((left, right) => {
        const leftName = $(left).find('.select_chat_block').attr('file_name');
        const rightName = $(right).find('.select_chat_block').attr('file_name');
        const leftOrder = order.get(leftName) ?? { time: 0, index: Number.MAX_SAFE_INTEGER };
        const rightOrder = order.get(rightName) ?? { time: 0, index: Number.MAX_SAFE_INTEGER };

        return rightOrder.time - leftOrder.time || leftOrder.index - rightOrder.index;
    });

    container.append(rows);
}

function findChatListRow(fileName) {
    return $('#select_chat_div .select_chat_block')
        .filter((_, element) => $(element).attr('file_name') === fileName)
        .closest('.select_chat_block_wrapper');
}

function isCurrentFastChatListRequest(requestId) {
    return requestId === fastChatListRequestId && String($('#select_chat_search').val() ?? '').trim().length === 0;
}

function toPlaceholderChatSearchResult(chat) {
    if (!chat || typeof chat !== 'object') {
        return null;
    }

    const fileName = getChatSearchFileName(chat);

    if (!fileName) {
        return null;
    }

    return {
        file_name: fileName,
        file_size: '...',
        message_count: '...',
        last_mes: guessLastMesFromFileName(fileName),
        preview_message: '',
    };
}

function toChatSearchResult(chat) {
    if (!chat || typeof chat !== 'object') {
        return null;
    }

    const fileName = getChatSearchFileName(chat);

    if (!fileName) {
        return null;
    }

    const messageCount = Number(chat.chat_items);

    return {
        file_name: fileName,
        file_size: chat.file_size ?? '',
        message_count: Number.isFinite(messageCount) ? messageCount : 0,
        last_mes: normalizeLastMes(chat.last_mes),
        preview_message: getPreviewMessage(chat.mes),
    };
}

function getChatSearchFileName(chat) {
    const value = typeof chat.file_id === 'string' && chat.file_id
        ? chat.file_id
        : chat.file_name;

    if (typeof value !== 'string') {
        return '';
    }

    return value.replace(/\.jsonl$/i, '');
}

function guessLastMesFromFileName(fileName) {
    const text = String(fileName).replace(/\.jsonl$/i, '');
    const match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s*@|@|\s+)?(\d{1,2})h\s*(\d{1,2})m(?:\s*(\d{1,2})s)?(?:\s*(\d{1,3})ms)?/i);

    if (match) {
        const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match;
        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            Number(millisecond),
        );

        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }

    return new Date().toISOString();
}

function normalizeLastMes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    return value;
}

function getTimestampValue(value) {
    const timestamp = timestampToMoment(value).valueOf();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getPreviewMessage(message) {
    const strlen = 400;

    if (typeof message !== 'string' || message === '[The chat is empty]' || message === '[The message is empty]') {
        return '';
    }

    return message.length > strlen
        ? '...' + message.substring(message.length - strlen)
        : message;
}

function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function applyMessageTripleClickEdit() {
    const chatElement = document.getElementById('chat');
    if (!chatElement) return;

    chatElement.removeEventListener('click', handleMessageTripleClickEdit);

    if (settings.messageTripleClickEditEnabled) {
        chatElement.addEventListener('click', handleMessageTripleClickEdit);
    }
}

function handleMessageTripleClickEdit(e) {
    if (e.detail === 3) {
        const mesText = e.target.closest('.mes_text');
        if (mesText) {
            const mes = mesText.closest('.mes');
            if (mes) {
                const editBtn = mes.querySelector('.mes_button.mes_edit');
                if (editBtn) {
                    editBtn.click();

                    // Clear text selection created by triple clicking
                    const selection = window.getSelection();
                    if (selection) {
                        selection.removeAllRanges();
                    }
                }
            }
        }
    }
}
