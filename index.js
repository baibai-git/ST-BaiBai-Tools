import {
    characters,
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    saveSettingsDebounced,
    this_chid,
} from '../../../../script.js';
import * as scriptModule from '../../../../script.js';
import { AutoComplete } from '../../../autocomplete/AutoComplete.js';
import { extension_settings, extensionTypes, renderExtensionTemplateAsync } from '../../../extensions.js';
import { selected_group } from '../../../group-chats.js';
import { t } from '../../../i18n.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../../popup.js';
import { isMobile, favsToHotswap } from '../../../RossAscends-mods.js';
import { power_user } from '../../../power-user.js';
import { isAdmin } from '../../../user.js';
import { debounce, download, getFileText, regexFromString, resetScrollHeight, setInfoBlock, uuidv4 } from '../../../utils.js';
import { allowPresetScripts as allowRegexPresetScripts, allowScopedScripts as allowRegexScopedScripts, getCurrentPresetAPI as getRegexCurrentPresetAPI, getCurrentPresetName as getRegexCurrentPresetName, getScriptsByType as getRegexScriptsByType, runRegexScript, saveScriptsByType as saveRegexScriptsByType, SCRIPT_TYPES as REGEX_SCRIPT_TYPES, substitute_find_regex } from '../../regex/engine.js';
import * as chatOptimizations from './chatOptimizations.js';
import * as presetOptimizations from './presetOptimizations.js';

const LOG_PREFIX = '[柏宝箱]';
const MODULE_NAME = getModuleName();
const CURRENT_VERSION = '0.22.1';
const EXTENSION_ID = getExtensionId();
const SETTINGS_KEY = 'baiBaiToolkit';
const EXTENSION_KEY = '__baiBaiToolkitExtensionInstalled';
const SAVE_REQUEST_GZIP_FETCH_KEY = '__baiBaiToolkitSaveRequestGzipFetchPatched';
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
const REGEX_VUE_MANAGER_CLICK_HANDLER_KEY = '__baiBaiToolkitRegexVueManagerClickHandler';
const REGEX_VUE_MANAGER_ROOT_ID = 'bai_bai_toolkit_regex_vue_manager_root';
const REGEX_VUE_MANAGER_STYLE_ID = 'bai_bai_toolkit_regex_vue_manager_style';
const REGEX_VUE_MANAGER_MODULE_PATH = './vendor/vue.esm-browser.prod.js';
const REGEX_UNGROUPED_GROUP_ID = '__ungrouped';
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
const REGEX_SCRIPT_ROW_SELECTOR = '.regex-script-label';
const REGEX_SCRIPT_LIST_SELECTOR = '#saved_regex_scripts, #saved_scoped_scripts, #saved_preset_scripts';
const WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-header .inline-drawer-toggle';
const WORLD_INFO_ENTRY_DRAWER_SELECTOR = '#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer';
const WORLD_INFO_LAZY_SELECT2_SELECTOR = '#world_popup_entries_list .world_entry_edit select[name="characterFilter"], #world_popup_entries_list .world_entry_edit select[name="triggers"]';
const WORLD_INFO_LAZY_SELECT2_DATASET_KEY = 'baiBaiToolkitLazySelect2';
const WORLD_INFO_DEFERRED_OPTIONS_DATASET_KEY = 'baiBaiToolkitDeferredOptions';
const SILENT_UPDATE_STORAGE_KEY = 'bai_bai_toolkit_silent_update';
const SILENT_UPDATE_INTERVAL_MS = 60 * 60 * 1000;
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
    updatePromptOnAvailableEnabled: true,
    resizeGuardEnabled: true,
    descriptionCodeMirrorEditorEnabled: true,
    customCssInputOptimizationEnabled: true,
    customCssShadowPropertyEnabled: true,
    worldInfoDrawerOptimizationEnabled: true,
    characterSearchInputOptimizationEnabled: true,
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

function normalizeMessageEditClickSettings() {
    if (settings.messageDoubleClickEditEnabled && settings.messageTripleClickEditEnabled) {
        settings.messageDoubleClickEditEnabled = false;
        extension_settings[SETTINGS_KEY].messageDoubleClickEditEnabled = false;
        return true;
    }

    return false;
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
    installOptimizedRegexImportHandler();
    installRegexVueManagerActionHandler();
    void installRegexVueManager();
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
    state.scriptTemplate = null;
    restoreRegexSortableStops(state);
    removeOptimizedRegexImportHandler();
    removeRegexVueManagerActionHandler();
    removeRegexVueManager();
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
                clearRegexVueManagerTargets();
            }

            syncRegexVueManagerState();
            await refreshRegexVueManagerSortables();
            return;
        }

        const vue = await loadRegexVueModule();
        manager.vue = vue;
        manager.root = ensureRegexVueManagerRoot();
        manager.state = vue.reactive(createRegexVueManagerModel());
        manager.app = vue.createApp(createRegexVueManagerRootComponent(vue, manager.state));

        clearRegexVueManagerTargets();
        manager.app.mount(manager.root);
        syncRegexVueManagerState();
        await refreshRegexVueManagerSortables();
        updateRegexBulkControls();
    })();

    try {
        await manager.installing;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to install regex Vue manager`, error);
        toastr.error(t`Failed to install regex list manager. See console for details.`);
    } finally {
        manager.installing = null;
    }
}

function removeRegexVueManager() {
    const manager = getRegexVueManagerState();

    clearTimeout(manager.syncTimer);
    manager.syncTimer = null;
    destroyRegexVueManagerSortables();

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
    enableNativeRegexSortables();
    void restoreRegexRowsAfterVueManagerRemove();
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
            sortableInstances: [],
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

function createRegexVueManagerModel() {
    return {
        renderKey: 0,
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
    void refreshRegexVueManagerSortables();
    updateRegexBulkControls();
}

async function syncRegexVueManagerAfterDataChange() {
    if (isRegexVueManagerActive()) {
        syncRegexVueManagerState();
        await refreshRegexVueManagerSortables();
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

    const ungrouped = {
        id: REGEX_UNGROUPED_GROUP_ID,
        name: t`Ungrouped`,
        collapsed: false,
        isUngrouped: true,
        scripts: [],
    };

    for (let index = 0; index < scripts.length; index++) {
        const script = scripts[index];
        const meta = groupState.scripts?.[script?.id] ?? {};
        const targetGroup = groupsById.get(meta.groupId) ?? ungrouped;
        targetGroup.scripts.push({
            script,
            order: Number.isFinite(Number(meta.order)) ? Number(meta.order) : index,
        });
    }

    const groups = [...realGroups, ungrouped]
        .map(group => ({
            ...group,
            scripts: group.scripts
                .sort((a, b) => a.order - b.order)
                .map(item => item.script),
        }))
        .filter(group => !group.isUngrouped || group.scripts.length > 0 || realGroups.length === 0);

    return {
        typeKey,
        scriptType,
        groups,
    };
}

function createRegexVueManagerRootComponent(vue, model) {
    const { h, Teleport, Fragment } = vue;

    return {
        name: 'BaiBaiRegexManagerRoot',
        render() {
            return h(Fragment, null, [
                renderRegexVueTeleport(h, Teleport, model, 'global', '#saved_regex_scripts'),
                renderRegexVueTeleport(h, Teleport, model, 'preset', '#saved_preset_scripts'),
                renderRegexVueTeleport(h, Teleport, model, 'scoped', '#saved_scoped_scripts'),
            ]);
        },
    };
}

function renderRegexVueTeleport(h, Teleport, model, typeKey, selector) {
    return h(Teleport, { to: selector }, [
        renderRegexVueList(h, model, typeKey),
    ]);
}

function renderRegexVueList(h, model, typeKey) {
    const list = model.lists[typeKey];
    const hasRealGroups = list.groups.some(group => !group.isUngrouped);
    const scriptCount = list.groups.reduce((count, group) => count + group.scripts.length, 0);
    const children = [
        renderRegexVueListToolbar(h, list),
    ];

    if (scriptCount === 0) {
        children.push(h('div', { class: 'bai-bai-regex-empty-list' }, t`No scripts found`));
    }

    for (const group of list.groups) {
        const groupChildren = [];

        if (!group.isUngrouped || hasRealGroups) {
            groupChildren.push(renderRegexVueGroupHeader(h, list, group));
        }

        if (!group.collapsed) {
            const rows = group.scripts.map(script => renderRegexVueScriptRow(h, model, list, script));
            groupChildren.push(h('div', {
                class: 'bai-bai-regex-group-body flex-container flexFlowColumn',
                'data-regex-type': list.typeKey,
                'data-regex-group-id': group.id,
            }, rows));
        }

        children.push(h('div', {
            class: ['bai-bai-regex-group', group.isUngrouped ? 'bai-bai-regex-group-ungrouped' : ''],
            'data-regex-group-id': group.id,
        }, groupChildren));
    }

    return h('div', {
        class: 'bai-bai-regex-vue-list flex-container flexFlowColumn',
        'data-regex-type': typeKey,
        key: `${typeKey}-${model.renderKey}`,
    }, children);
}

function renderRegexVueListToolbar(h, list) {
    return h('div', { class: 'bai-bai-regex-list-toolbar flex-container' }, [
        h('div', {
            class: 'menu_button menu_button_icon',
            title: t`Create regex group`,
            onClick: () => void createRegexVueGroup(list.scriptType),
        }, [
            h('i', { class: 'fa-solid fa-folder-plus' }),
            h('small', null, t`Group`),
        ]),
    ]);
}

function renderRegexVueGroupHeader(h, list, group) {
    return h('div', { class: 'bai-bai-regex-group-header flex-container flexnowrap' }, [
        h('span', {
            class: ['bai-bai-regex-group-toggle fa-solid', group.collapsed ? 'fa-chevron-right' : 'fa-chevron-down'],
            title: group.collapsed ? t`Expand` : t`Collapse`,
            onClick: () => toggleRegexVueGroupCollapsed(list.scriptType, group.id),
        }),
        h('strong', { class: 'bai-bai-regex-group-name flex1 overflow-hidden', title: group.name }, group.name),
        h('small', { class: 'bai-bai-regex-group-count' }, String(group.scripts.length)),
        !group.isUngrouped && h('div', {
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
        h('span', { class: 'drag-handle menu-handle' }, '\u2630'),
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

.bai-bai-regex-list-toolbar {
    justify-content: flex-end;
    margin-bottom: 4px;
}

.bai-bai-regex-empty-list {
    font-size: 0.95em;
    opacity: 0.7;
    text-align: center;
}

.bai-bai-regex-vue-list .regex-script-label,
.bai-bai-regex-vue-list .regex_script_name {
    cursor: default !important;
}

.bai-bai-regex-vue-list .drag-handle {
    cursor: grab !important;
}

.bai-bai-regex-vue-list .drag-handle:active {
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

.bai-bai-regex-group-header {
    align-items: center;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 10px;
    padding: 2px 6px;
    margin-top: 4px;
    opacity: 0.95;
}

.bai-bai-regex-group-toggle {
    cursor: pointer;
    width: 18px;
    text-align: center;
}

.bai-bai-regex-group-name {
    margin-left: 4px;
}

.bai-bai-regex-group-count {
    opacity: 0.7;
    min-width: 2em;
    text-align: right;
}

.bai-bai-regex-group-body.ui-sortable {
    min-height: 8px;
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

    return state;
}

function normalizeRegexGroupState(groupState) {
    groupState.groups = groupState.groups
        .filter(group => group && typeof group === 'object' && group.id && group.id !== REGEX_UNGROUPED_GROUP_ID)
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
}

function saveRegexGroupSettings() {
    extension_settings[SETTINGS_KEY].regexListGroups = settings.regexListGroups;
    saveSettingsDebounced();
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
    const group = groupState.groups.find(item => item.id === groupId);

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

async function deleteRegexVueGroup(scriptType, groupId) {
    const confirm = await callGenericPopup(t`Delete this regex group? Scripts in this group will be moved to Ungrouped.`, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    groupState.groups = groupState.groups.filter(group => group.id !== groupId);

    for (const meta of Object.values(groupState.scripts)) {
        if (meta?.groupId === groupId) {
            meta.groupId = REGEX_UNGROUPED_GROUP_ID;
        }
    }

    saveRegexGroupSettings();
    syncRegexVueManagerState();
}

function toggleRegexVueGroupCollapsed(scriptType, groupId) {
    if (groupId === REGEX_UNGROUPED_GROUP_ID) {
        return;
    }

    const groupState = getRegexGroupStateForScriptType(scriptType);
    const group = groupState.groups.find(item => item.id === groupId);

    if (!group) {
        return;
    }

    group.collapsed = !group.collapsed;
    saveRegexGroupSettings();
    syncRegexVueManagerState();
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

    if (modelScript) {
        modelScript.disabled = disabled;
    } else {
        context.script.disabled = disabled;
    }

    try {
        await saveRegexScriptList(scriptType, context.scripts);
        allowRegexScriptTypeAfterEditSave(scriptType);
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to bulk move regex scripts`, error);
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
        await reloadCurrentChatForRegexChange();
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
        await reloadCurrentChatForRegexChange();
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
        ensureRegexScriptGroupMeta(scriptType, updatedScript.id);
        saveRegexGroupSettings();
        await syncRegexVueManagerAfterDataChange();
        await reloadCurrentChatForRegexChange();
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

function ensureRegexScriptGroupMeta(scriptType, scriptId) {
    const groupState = getRegexGroupStateForScriptType(scriptType);

    if (!groupState.scripts[scriptId]) {
        groupState.scripts[scriptId] = {
            groupId: REGEX_UNGROUPED_GROUP_ID,
            order: Object.keys(groupState.scripts).length,
        };
    }
}

async function refreshRegexVueManagerSortables() {
    const manager = getRegexVueManagerState();

    if (!manager.vue || !manager.state) {
        return;
    }

    await manager.vue.nextTick();
    destroyRegexVueManagerSortables();

    for (const typeKey of ['global', 'preset', 'scoped']) {
        const bodies = Array.from(document.querySelectorAll(`.bai-bai-regex-group-body[data-regex-type="${typeKey}"]`));

        for (const body of bodies) {
            const sortable = $(body).sortable;

            if (typeof sortable !== 'function') {
                continue;
            }

            $(body).sortable({
                connectWith: `.bai-bai-regex-group-body[data-regex-type="${typeKey}"]`,
                handle: '.drag-handle',
                stop: () => {
                    void saveRegexVueOrderFromDom(typeKey);
                },
            });

            manager.sortableInstances.push(body);
        }
    }
}

function destroyRegexVueManagerSortables() {
    const manager = getRegexVueManagerState();

    for (const body of manager.sortableInstances ?? []) {
        try {
            if (body instanceof HTMLElement && isRegexSortableInitialized(body)) {
                $(body).sortable('destroy');
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to destroy regex Vue sortable`, error);
        }
    }

    manager.sortableInstances = [];
}

async function saveRegexVueOrderFromDom(typeKey) {
    const scriptType = getRegexScriptTypeFromKey(typeKey);

    if (scriptType === null) {
        return;
    }

    const listSelector = getRegexListSelectorForScriptType(scriptType);
    const list = listSelector ? document.querySelector(listSelector) : null;

    if (!(list instanceof HTMLElement)) {
        return;
    }

    const scripts = getRegexScriptsByType(scriptType);
    const scriptById = new Map(scripts.filter(Boolean).map(script => [script.id, script]));
    const seen = new Set();
    const reorderedScripts = [];
    const groupState = getRegexGroupStateForScriptType(scriptType);

    for (const body of list.querySelectorAll('.bai-bai-regex-group-body[data-regex-group-id]')) {
        const groupId = body.getAttribute('data-regex-group-id') || REGEX_UNGROUPED_GROUP_ID;
        let order = 0;

        for (const row of body.querySelectorAll(':scope > .regex-script-label')) {
            const scriptId = row.id;
            const script = scriptById.get(scriptId);

            if (!script || seen.has(scriptId)) {
                continue;
            }

            seen.add(scriptId);
            reorderedScripts.push(script);
            groupState.scripts[scriptId] = { groupId, order };
            order += 1;
        }
    }

    for (const script of scripts) {
        if (script?.id && !seen.has(script.id)) {
            reorderedScripts.push(script);
        }
    }

    if (reorderedScripts.length !== scripts.length) {
        console.debug(`${LOG_PREFIX} Regex Vue order save skipped because DOM and data lengths differ`);
        syncRegexVueManagerState();
        return;
    }

    await saveRegexScriptList(scriptType, reorderedScripts);
    saveRegexGroupSettings();
    syncRegexVueManagerState();
    await reloadCurrentChatForRegexChange();
}

function disableNativeRegexSortables() {
    for (const { selector } of getRegexScriptListDefinitions()) {
        const list = document.querySelector(selector);

        try {
            if (list instanceof HTMLElement && isRegexSortableInitialized(list)) {
                $(list).sortable('disable');
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to disable native regex sortable`, error);
        }
    }
}

function enableNativeRegexSortables() {
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
    scheduleRegexSortablePatch();
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
        scheduleRegexSortablePatch();
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
        scheduleRegexSortablePatch();
        await reloadCurrentChatForRegexChange();
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

    if (isRegexVueManagerActive()) {
        disableNativeRegexSortables();
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

function getRegexListSelectorForScriptType(scriptType) {
    return getRegexScriptListDefinitions().find(definition => definition.scriptType === scriptType)?.selector ?? null;
}

function isRegexSortableInitialized(list) {
    return Boolean($(list).data('ui-sortable') || $(list).data('sortable'));
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

