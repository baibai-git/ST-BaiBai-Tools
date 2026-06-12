import { event_types, eventSource, getRequestHeaders, saveSettingsDebounced } from '../../../../script.js';
import { oai_settings, openai_setting_names, promptManager } from '../../../openai.js';
import { getPresetManager } from '../../../preset-manager.js';
import { getTokenizerModel } from '../../../tokenizers.js';
import { t } from '../../../i18n.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { INJECTION_POSITION } from '../../../PromptManager.js';
import { isMobile } from '../../../RossAscends-mods.js';
import { renderTemplateAsync } from '../../../templates.js';
import { debounce, escapeHtml, getStringHash, uuidv4 } from '../../../utils.js';

const PRESET_PROMPT_CODEMIRROR_EDITOR_KEY = '__baiBaiToolkitPresetPromptCodeMirrorEditor';
const PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID = 'bai_bai_toolkit_preset_prompt_codemirror_editor_style';
const PRESET_SCROLL_STYLE_ID = 'bai_bai_toolkit_preset_scroll_style';
const PRESET_DRAG_STYLE_ID = 'bai_bai_toolkit_preset_drag_style';
const PRESET_DRAG_HANDLER_KEY = '__baiBaiToolkitPresetDragHandler';
const PRESET_DRAG_PATCH_KEY = '__baiBaiToolkitPresetDragPatch';
const PRESET_SWITCH_BEFORE_HANDLER_KEY = '__baiBaiToolkitPresetSwitchBeforeHandler';
const PRESET_SWITCH_HANDLER_KEY = '__baiBaiToolkitPresetSwitchHandler';
const PRESET_MODEL_CHANGE_HANDLER_KEY = '__baiBaiToolkitPresetModelChangeHandler';
const PRESET_CHAT_LOADED_HANDLER_KEY = '__baiBaiToolkitPresetChatLoadedHandler';
const PRESET_GROUP_PRESET_DELETED_HANDLER_KEY = '__baiBaiToolkitPresetGroupPresetDeletedHandler';
const PRESET_GROUP_PRESET_IMPORT_HANDLER_KEY = '__baiBaiToolkitPresetGroupPresetImportHandler';
const PRESET_SELECT_CHANGE_HANDLER_KEY = '__baiBaiToolkitPresetSelectChangeHandler';
const PRESET_DELETE_HANDLER_KEY = '__baiBaiToolkitPresetDeleteHandler';
const PRESET_LIST_ACTION_HANDLER_KEY = '__baiBaiToolkitPresetListActionHandler';
const PRESET_TOGGLE_HANDLER_KEY = '__baiBaiToolkitPresetToggleHandler';
const PRESET_SAVE_HANDLER_KEY = '__baiBaiToolkitPresetSaveHandler';
const PRESET_VUE_LIST_MANAGER_KEY = '__baiBaiToolkitPresetVueListManager';
const PRESET_VUE_LIST_RENDER_PATCH_KEY = '__baiBaiToolkitPresetVueListRenderPatch';
const PRESET_VUE_TOUCH_SCROLL_GUARD_KEY = '__baiBaiToolkitPresetVueTouchScrollGuard';
const PRESET_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY = '__baiBaiToolkitPresetPendingChangesLifecycleHandler';
const PRESET_VUE_LIST_HOST_CLASS = 'bai-bai-preset-vue-list-host';
const PRESET_VUE_DRAGGING_BODY_CLASS = 'bai-bai-preset-vue-dragging';
const PRESET_VUE_DRAG_READY_FEEDBACK_CLASS = 'bai-bai-preset-vue-drag-ready-feedback';
const PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS = 'bai-bai-preset-top-level-draggable';
const PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS = 'bai-bai-preset-group-child-draggable';
const PRESET_VUE_LIST_GAP_VARIABLE = '--bai-bai-preset-list-gap';
const PRESET_VUE_MODULE_PATH = './vendor/vue.esm-browser.prod.js';
const PRESET_VUE_DRAGGABLE_MODULE_PATH = './vendor/vue-draggable-next.esm-browser.prod.js';
const PRESET_VUE_HEADER_ENTRY_ID = '__bai_bai_preset_header';
const PRESET_VUE_SEPARATOR_ENTRY_ID = '__bai_bai_preset_separator';
const PRESET_GROUP_EXTENSION_PATH = 'baibaiToolkit.presetPromptGroups';
const PRESET_COMPAT_ENTRY_GROUPING_EXTENSION_PATH = 'entryGrouping';
const PRESET_VUE_EXPAND_ANIMATION_MS = 180;
const PRESET_VUE_COLLAPSE_ANIMATION_MS = 260;
const PRESET_VUE_DRAG_ANIMATION_MS = 180;
const PRESET_PENDING_CHANGES_VISIBILITY_CHECK_DELAY_MS = 120;
const PRESET_PENDING_CHANGES_VISIBILITY_FALLBACK_DELAY_MS = 1000;
const PRESET_GROUP_COMPAT_CHOICE_RESULT_BASE = 1001;
const PRESET_VUE_POINTER_START_THRESHOLD_PX = 4;
const PRESET_VUE_TOUCH_DRAG_DELAY_MS = 320;
const PRESET_VUE_TOUCH_START_THRESHOLD_PX = 10;
const PRESET_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX = 6;
const PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS = 350;
const PRESET_DRAG_LONG_PRESS_MS = 300;
const PRESET_DRAG_CANCEL_DISTANCE_PX = 12;
const PRESET_DRAG_CLICK_SUPPRESS_MS = 500;
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
const PRESET_DRAG_INTERACTIVE_SELECTOR = '.prompt_manager_prompt_controls, .bai-bai-preset-prompt-actions-hint, .bai-bai-preset-prompt-actions, .bai-bai-preset-prompt-action-button, [data-preset-prompt-action], .prompt-manager-detach-action, .prompt-manager-inspect-action, .prompt-manager-edit-action, .prompt-manager-toggle-action, .bai-bai-preset-group-actions, .bai-bai-preset-group-toggle, a, button, input, select, textarea, [contenteditable="true"]';
const BAIBAOKU_TOKENIZER_BULK_COUNT_URL = '/api/plugins/baibaoku/v1/tokenizers/bulk-count';
const OPENAI_TOKENIZER_BULK_BRIDGE_KEY = '__baibaokuTokenizerBulkBridge';
const OPENAI_TOKENIZER_BULK_CACHE_LIMIT = 5000;
const PRESET_CHAT_LOAD_RENDER_SUPPRESS_MS = 2000;
const PRESET_DRAG_READY_CLASS = 'bai-bai-toolkit-preset-drag-ready';
const PRESET_DRAG_ACTIVE_CLASS = 'bai-bai-toolkit-preset-drag-active';
const PRESET_DRAG_SOURCE_CLASS = 'bai-bai-toolkit-preset-drag-source';
const PRESET_DRAG_CLONE_CLASS = 'bai-bai-toolkit-preset-drag-clone';
const PRESET_DRAG_INDICATOR_CLASS = 'bai-bai-toolkit-preset-drag-indicator';
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

let settings = {};
let extensionState = {};
let LOG_PREFIX = '[BaiBaiToolkit]';
let loadCodeMirrorModules = null;
let codeMirrorHistoryMaxLength = 12000;
let savePresetOptimizationSettings = null;

export function configurePresetOptimizations(context = {}) {
    settings = context.settings ?? settings;
    delete settings.presetPromptGroups;
    extensionState = context.extensionState ?? extensionState;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    loadCodeMirrorModules = context.loadCodeMirrorModules ?? loadCodeMirrorModules;
    codeMirrorHistoryMaxLength = context.codeMirrorHistoryMaxLength ?? codeMirrorHistoryMaxLength;
    savePresetOptimizationSettings = context.saveSettings ?? savePresetOptimizationSettings;
}

export function installOpenAITokenizerBulkBridge() {
    const state = getOpenAITokenizerBulkState();
    const bridge = globalThis[OPENAI_TOKENIZER_BULK_BRIDGE_KEY] && typeof globalThis[OPENAI_TOKENIZER_BULK_BRIDGE_KEY] === 'object'
        ? globalThis[OPENAI_TOKENIZER_BULK_BRIDGE_KEY]
        : {};

    bridge.installed = true;
    bridge.version = '0.1';
    bridge.prepareOpenAIMessages = prepareOpenAITokenizerBulkMessages;
    bridge.clear = () => state.cache.clear();
    bridge.getStats = () => ({ ...state.stats, cacheSize: state.cache.size });
    bridge.isEnabled = isOpenAITokenizerBulkEnabled;
    globalThis[OPENAI_TOKENIZER_BULK_BRIDGE_KEY] = bridge;

    installOpenAITokenizerBulkAjaxPatch();
}

export function bindPresetOptimizationSettings({ saveSettings } = {}) {
    savePresetOptimizationSettings = saveSettings ?? savePresetOptimizationSettings;

    const persistSettings = () => {
        if (typeof saveSettings === 'function') {
            saveSettings();
        }
    };

    $('#bai_bai_toolkit_preset_scroll_optimization_enabled')
        .prop('checked', settings.presetScrollOptimizationEnabled)
        .on('input', function () {
            settings.presetScrollOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetScrollOptimization();
        });

    $('#bai_bai_toolkit_preset_drag_optimization_enabled')
        .prop('checked', settings.presetDragOptimizationEnabled)
        .on('input', function () {
            settings.presetDragOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetDragOptimization();
        });

    $('#bai_bai_toolkit_preset_mobile_whole_row_drag_enabled')
        .prop('checked', settings.presetMobileWholeRowDragEnabled)
        .on('input', function () {
            settings.presetMobileWholeRowDragEnabled = Boolean($(this).prop('checked'));
            cancelPromptManagerCustomDragPending();
            finishPromptManagerCustomDrag({ cancelled: true });
            persistSettings();
            applyPresetDragOptimization();
        });

    $('#bai_bai_toolkit_preset_switch_optimization_enabled')
        .prop('checked', settings.presetSwitchOptimizationEnabled)
        .on('input', function () {
            settings.presetSwitchOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetSwitchOptimization();
        });

    $('#bai_bai_toolkit_preset_toggle_optimization_enabled')
        .prop('checked', settings.presetToggleOptimizationEnabled)
        .on('input', function () {
            settings.presetToggleOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetToggleOptimization();
            applyPresetSaveOptimization();
        });

    $('#bai_bai_toolkit_preset_grouping_enabled')
        .prop('checked', settings.presetGroupingEnabled !== false)
        .on('input', function () {
            settings.presetGroupingEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetGrouping();
        });

    $('#bai_bai_toolkit_preset_prompt_codemirror_editor_enabled')
        .prop('checked', settings.presetPromptCodeMirrorEditorEnabled)
        .on('input', function () {
            settings.presetPromptCodeMirrorEditorEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyPresetPromptCodeMirrorEditorOptimization();
        });

    $('#bai_bai_toolkit_preset_auto_save_after_prompt_edit_enabled')
        .prop('checked', settings.presetAutoSaveAfterPromptEditEnabled)
        .on('input', function () {
            settings.presetAutoSaveAfterPromptEditEnabled = Boolean($(this).prop('checked'));
            persistSettings();
        });
}

function loadPresetCodeMirrorModules() {
    if (typeof loadCodeMirrorModules !== 'function') {
        return Promise.reject(new Error('CodeMirror module loader is not configured'));
    }

    return loadCodeMirrorModules();
}

function getPresetCodeMirrorHistoryMaxLength() {
    return Number(codeMirrorHistoryMaxLength) || 12000;
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
    if (!settings.presetDragOptimizationEnabled) {
        cancelPromptManagerCustomDragPending();
        finishPromptManagerCustomDrag({ cancelled: true });
        removePresetDragOptimizationHandlers();

        if (isPresetGroupingEnabled()) {
            applyPresetDragOptimizationCss();
        } else {
            clearPromptManagerCustomDragList();
            applyPresetDragOptimizationCss();
            restorePromptManagerStockDraggable();
        }
        return;
    }

    cancelPromptManagerCustomDragPending();
    finishPromptManagerCustomDrag({ cancelled: true });

    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();

    if (isPresetGroupingEnabled()) {
        removePresetDragOptimizationHandlers();
        return;
    }

    installPresetDragOptimizationHandlers();
    preparePromptManagerCustomDragList();
}

function applyPresetGrouping() {
    if (!isPresetGroupingEnabled()) {
        flushPendingPresetPromptChangesSafely();
        removePresetVuePromptListManager();
        applyPresetDragOptimizationCss();

        if (settings.presetDragOptimizationEnabled) {
            applyPresetDragOptimization();
        } else {
            restorePromptManagerStockDraggable();
        }
        return;
    }

    removePresetDragOptimizationHandlers();
    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();
    void installPresetVuePromptListManager();
}

function isPresetGroupingEnabled() {
    return settings.presetGroupingEnabled !== false;
}

function installPresetDragOptimizationHandlers() {
    if (extensionState[PRESET_DRAG_HANDLER_KEY]) {
        return;
    }

    const handlers = {
        pointerdown: handlePresetPromptDragPointerDown,
        mousedown: handlePresetPromptDragMouseDown,
        touchstart: handlePresetPromptDragTouchStart,
        click: handlePresetPromptDragClick,
    };

    document.addEventListener('pointerdown', handlers.pointerdown, true);
    document.addEventListener('mousedown', handlers.mousedown, true);
    document.addEventListener('touchstart', handlers.touchstart, { capture: true, passive: false });
    document.addEventListener('click', handlers.click, true);
    extensionState[PRESET_DRAG_HANDLER_KEY] = handlers;
}

function removePresetDragOptimizationHandlers() {
    const handlers = extensionState[PRESET_DRAG_HANDLER_KEY];

    if (!handlers) {
        return;
    }

    document.removeEventListener('pointerdown', handlers.pointerdown, true);
    document.removeEventListener('mousedown', handlers.mousedown, true);
    document.removeEventListener('touchstart', handlers.touchstart, true);
    document.removeEventListener('click', handlers.click, true);
    delete extensionState[PRESET_DRAG_HANDLER_KEY];
}

function applyPresetDragOptimizationCss() {
    const existingStyle = document.getElementById(PRESET_DRAG_STYLE_ID);

    if (!settings.presetDragOptimizationEnabled && !isPresetGroupingEnabled()) {
        existingStyle?.remove();
        return;
    }

    const css = `
${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} li.completion_prompt_manager_prompt {
    user-select: none;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} li.completion_prompt_manager_prompt .drag-handle {
    display: flex !important;
    touch-action: none !important;
    cursor: grab !important;
}

${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_ACTIVE_CLASS} li.completion_prompt_manager_prompt span span span,
.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt span span span {
    transition: none;
    filter: none;
}

.${PRESET_VUE_LIST_HOST_CLASS} {
    display: contents;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-list-head-actions,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-actions {
    display: flex;
    justify-content: flex-end;
    align-items: center;
    gap: 4px;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 45%, transparent);
    overflow: hidden;
    transition: gap ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease, opacity ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed {
    gap: 0;
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    padding: 10px 7px;
    border: 0;
    border-bottom: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 75%, transparent);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
    touch-action: manipulation;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed .bai-bai-preset-group-header {
    border-bottom-color: transparent;
}

@media (pointer: coarse) {
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-drag-surface {
        touch-action: none !important;
    }
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    white-space: normal;
    font-size: calc(var(--mainFontSize) * 1);
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-actions {
    gap: 3px;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-toggle,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-action-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 calc(var(--mainFontSize) * 1.65) !important;
    inline-size: calc(var(--mainFontSize) * 1.65) !important;
    block-size: calc(var(--mainFontSize) * 1.65) !important;
    min-inline-size: calc(var(--mainFontSize) * 1.65) !important;
    min-block-size: calc(var(--mainFontSize) * 1.65) !important;
    box-sizing: border-box !important;
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: calc(var(--mainFontSize) * 0.9) !important;
    line-height: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-enable-toggle {
    font-size: calc(var(--mainFontSize) * 1.05) !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-title strong {
    flex: 0 1 auto;
    min-width: 0;
    overflow: visible;
    overflow-wrap: anywhere;
    white-space: normal;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-count {
    flex: 0 0 auto;
    opacity: 0.65;
    white-space: nowrap;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt {
    grid-template-columns: minmax(0, 1fr) max-content max-content !important;
    column-gap: 6px !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head .prompt_manager_prompt_tokens,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .prompt_manager_prompt_tokens {
    inline-size: max-content !important;
    min-inline-size: 2.2em !important;
    width: auto !important;
    justify-self: end !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .prompt_manager_prompt_controls {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    flex-direction: row !important;
    gap: 4px !important;
    position: relative;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    min-inline-size: max-content !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-icon-button,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-action-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 calc(var(--mainFontSize) * 1.65) !important;
    inline-size: calc(var(--mainFontSize) * 1.65) !important;
    block-size: calc(var(--mainFontSize) * 1.65) !important;
    min-inline-size: calc(var(--mainFontSize) * 1.65) !important;
    min-block-size: calc(var(--mainFontSize) * 1.65) !important;
    box-sizing: border-box !important;
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: calc(var(--mainFontSize) * 1) !important;
    line-height: 1 !important;
    cursor: pointer !important;
    white-space: nowrap !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-hint-hidden {
    display: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions {
    display: none !important;
    align-items: center !important;
    justify-content: flex-end !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    flex: 0 0 auto !important;
    min-inline-size: max-content !important;
    white-space: nowrap !important;
    opacity: 0;
    transition: opacity var(--animation-duration-2x, 160ms) ease-in-out;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-visible {
    display: inline-flex !important;
    opacity: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-action-button.caution {
    color: var(--SmartThemeEmColor) !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-body {
    display: grid;
    grid-template-rows: 1fr;
    min-height: 0;
    overflow: hidden;
    transition: grid-template-rows ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed .bai-bai-preset-group-body {
    grid-template-rows: 0fr;
    pointer-events: none;
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-body-inner {
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-list {
    display: flex;
    flex-direction: column;
    gap: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    margin: 0;
    padding: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    list-style: none;
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-list:empty {
    min-height: 12px;
    border: 1px dashed color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-selectable {
    cursor: crosshair !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-selectable * {
    cursor: crosshair !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-selectable .prompt_manager_prompt_controls {
    pointer-events: none;
    opacity: 0.45;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-start,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-end,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-range-inside {
    outline: 2px solid var(--SmartThemeQuoteColor);
    outline-offset: -2px;
}

@media (prefers-reduced-motion: reduce) {
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group,
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-body,
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-list {
        transition: none !important;
    }
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

.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-actions {
    display: none !important;
    opacity: 0 !important;
}

.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-actions-hint,
.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-actions-hint-hidden,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-actions-hint,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-actions-hint-hidden,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-actions-hint,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-actions-hint-hidden,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-actions-hint,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-actions-hint-hidden {
    display: inline-flex !important;
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

.bai-bai-preset-vue-sortable-ghost {
    opacity: 0.35;
}

.bai-bai-preset-vue-sortable-ghost.bai-bai-preset-group .bai-bai-preset-group-body {
    visibility: hidden !important;
}

.bai-bai-preset-vue-sortable-fallback.bai-bai-preset-group {
    display: flex !important;
    flex-direction: column !important;
    gap: 0 !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    border: 1px solid var(--SmartThemeBorderColor) !important;
    border-radius: 8px !important;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 45%, transparent) !important;
    overflow: hidden !important;
    height: auto !important;
    min-height: 0 !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-header {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) auto !important;
    align-items: center !important;
    box-sizing: border-box !important;
    padding: 10px 7px !important;
    border: 0 !important;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 75%, transparent) !important;
    cursor: grabbing !important;
    user-select: none !important;
    -webkit-user-select: none !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-title {
    display: flex !important;
    align-items: center !important;
    flex-wrap: wrap !important;
    gap: 4px !important;
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: normal !important;
    font-size: calc(var(--mainFontSize) * 1) !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-title strong {
    flex: 0 1 auto !important;
    min-width: 0 !important;
    overflow: visible !important;
    overflow-wrap: anywhere !important;
    white-space: normal !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-actions {
    display: flex !important;
    justify-content: flex-end !important;
    align-items: center !important;
    gap: 3px !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-toggle,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-action-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 calc(var(--mainFontSize) * 1.65) !important;
    inline-size: calc(var(--mainFontSize) * 1.65) !important;
    block-size: calc(var(--mainFontSize) * 1.65) !important;
    min-inline-size: calc(var(--mainFontSize) * 1.65) !important;
    min-block-size: calc(var(--mainFontSize) * 1.65) !important;
    box-sizing: border-box !important;
    border: 0 !important;
    box-shadow: none !important;
    background: transparent !important;
    margin: 0 !important;
    padding: 0 !important;
    font-size: calc(var(--mainFontSize) * 0.9) !important;
    line-height: 1 !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-enable-toggle {
    font-size: calc(var(--mainFontSize) * 1.05) !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-count {
    flex: 0 0 auto !important;
    opacity: 0.65 !important;
    white-space: nowrap !important;
}

.bai-bai-preset-vue-sortable-fallback.bai-bai-preset-group .bai-bai-preset-group-body {
    display: none !important;
}

.bai-bai-preset-vue-sortable-chosen,
.bai-bai-preset-vue-sortable-drag {
    cursor: grabbing !important;
}

body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-vue-sortable-chosen,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .${PRESET_VUE_DRAG_READY_FEEDBACK_CLASS} {
    outline: 2px solid color-mix(in srgb, var(--SmartThemeQuoteColor) 75%, transparent) !important;
    outline-offset: -2px !important;
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--SmartThemeQuoteColor) 35%, transparent) !important;
}

body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-vue-sortable-chosen.bai-bai-preset-group .bai-bai-preset-group-header,
body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt.bai-bai-preset-vue-sortable-chosen,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .${PRESET_VUE_DRAG_READY_FEEDBACK_CLASS}.bai-bai-preset-group .bai-bai-preset-group-header,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt.${PRESET_VUE_DRAG_READY_FEEDBACK_CLASS} {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 18%, transparent) !important;
}

@media (pointer: coarse) {
    body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-vue-sortable-chosen,
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .${PRESET_VUE_DRAG_READY_FEEDBACK_CLASS} {
        transform: scale(0.995);
        transition: transform 120ms ease, outline-color 120ms ease, box-shadow 120ms ease;
    }
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
        if (isPresetVuePromptListManagerActive()) {
            const list = this?.listElement instanceof HTMLElement
                ? this.listElement
                : document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);
            disablePromptManagerStockSortable(list);
            preparePromptManagerCustomDragList(list);
            return undefined;
        }

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

    if (!settings.presetDragOptimizationEnabled && !isPresetGroupingEnabled()) {
        list.classList.remove(PRESET_DRAG_READY_CLASS, PRESET_DRAG_ACTIVE_CLASS);
        return false;
    }

    disablePromptManagerStockSortable(list);
    list.classList.add(PRESET_DRAG_READY_CLASS);
    syncPresetVuePromptListGapVariable(list);
    list.querySelectorAll('li.completion_prompt_manager_prompt .drag-handle')
        .forEach(handle => handle.classList.add('ui-sortable-handle'));
    return true;
}

function syncPresetVuePromptListGapVariable(list) {
    if (!(list instanceof HTMLElement)) {
        return;
    }

    const styles = getComputedStyle(list);
    const gap = styles.rowGap && styles.rowGap !== 'normal'
        ? styles.rowGap
        : styles.gap;

    if (gap && gap !== 'normal') {
        list.style.setProperty(PRESET_VUE_LIST_GAP_VARIABLE, gap);
    } else {
        list.style.removeProperty(PRESET_VUE_LIST_GAP_VARIABLE);
    }
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

async function installPresetVuePromptListManager() {
    if (!isPresetGroupingEnabled()) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    manager.enabled = true;
    installPresetVuePromptListRenderPatch();
    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();

    if (manager.installing) {
        return manager.installing;
    }

    manager.installing = (async () => {
        if (!isPromptManagerReadyForVuePromptList()) {
            schedulePresetVuePromptListManagerSync(250);
            return;
        }

        if (manager.app && manager.host?.isConnected && manager.root?.isConnected) {
            syncPresetVuePromptListManagerState();
            preparePromptManagerCustomDragList(manager.root);
            return;
        }

        if (manager.app) {
            unmountPresetVuePromptListApp(manager);
        }

        const list = getPromptManagerListElement() ?? ensurePromptManagerListAfterVueHost();

        if (!(list instanceof HTMLElement)) {
            schedulePresetVuePromptListManagerSync(250);
            return;
        }

        const { host, listClassName } = replacePromptManagerListWithVueHost(list);
        const vue = await loadPresetVueModule();
        const vueDraggableNext = await loadPresetVueDraggableModule();
        manager.vue = vue;
        manager.vueDraggableNext = vueDraggableNext;
        manager.host = host;
        manager.state = vue.reactive(createPresetVuePromptListModel());
        manager.state.listClassName = listClassName;
        manager.app = vue.createApp(createPresetVuePromptListRootComponent(vue, vueDraggableNext, manager.state));

        manager.app.mount(host);
        manager.root = host.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);
        if (manager.root instanceof HTMLElement && promptManager) {
            promptManager.listElement = manager.root;
        }
        syncPresetVuePromptListManagerState();
        preparePromptManagerCustomDragList(manager.root);
    })();

    try {
        await manager.installing;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to install preset Vue prompt list manager`, error);
        toastr.error(t`Failed to install preset prompt list manager. See console for details.`);
        removePresetVuePromptListManager();
    } finally {
        manager.installing = null;
    }
}

function removePresetVuePromptListManager({ skipRestore = false } = {}) {
    const manager = getPresetVuePromptListManagerState();
    const shouldRestoreList = !skipRestore && Boolean(
        manager.app
        || manager.host?.isConnected
        || document.querySelector(`.${PRESET_VUE_LIST_HOST_CLASS}`),
    );

    manager.enabled = false;
    clearTimeout(manager.syncTimer);
    manager.syncTimer = null;
    clearPresetVuePromptOrderSaveSchedule(manager);
    setPresetVuePromptDragScrollGuardEnabled(false);
    document.body?.classList.remove(PRESET_VUE_DRAGGING_BODY_CLASS);

    removePresetVuePromptListRenderPatch();

    unmountPresetVuePromptListApp(manager);

    manager.installing = null;
    document.getElementById(PRESET_DRAG_STYLE_ID)?.remove();

    if (shouldRestoreList) {
        void restorePromptManagerListAfterVueRemove();
    }
}

function unmountPresetVuePromptListApp(manager = getPresetVuePromptListManagerState()) {
    clearPresetVuePromptOrderSaveSchedule(manager);
    setPresetVuePromptDragScrollGuardEnabled(false);

    if (manager.app) {
        try {
            manager.app.unmount();
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to unmount preset Vue prompt list manager`, error);
        }
    }

    manager.app = null;
    manager.state = null;
    manager.root = null;
    manager.dragSnapshot = null;
    clearPresetVuePromptDragReadyFeedback(manager);
    manager.groupHeaderGesture = null;
    manager.lastGroupHeaderToggleAt = 0;
    manager.lastGroupHeaderGestureCanceledAt = 0;
    manager.lastDragStartedAt = 0;
    manager.lastDragEndedAt = 0;
}

function getPresetVuePromptListManagerState() {
    if (!extensionState[PRESET_VUE_LIST_MANAGER_KEY] || typeof extensionState[PRESET_VUE_LIST_MANAGER_KEY] !== 'object') {
        extensionState[PRESET_VUE_LIST_MANAGER_KEY] = {
            app: null,
            host: null,
            root: null,
            state: null,
            vue: null,
            vueDraggableNext: null,
            modulePromise: null,
            draggableModulePromise: null,
            installing: null,
            syncTimer: null,
            saveTimer: null,
            saveFrame: null,
            dragSnapshot: null,
            pendingServiceSettingsSave: false,
            pendingGroupSettingsSave: false,
            pendingChangesSavePromise: null,
            pendingChangesSaveInFlight: false,
            pendingPresetPromptServiceSaves: null,
            pendingPresetPromptGroupSaves: null,
            pendingVisibilityTimer: null,
            pendingVisibilityObserver: null,
            dragReadyFeedbackTimer: null,
            dragReadyFeedbackElement: null,
            dragReadyFeedbackNotified: false,
            groupHeaderGesture: null,
            lastGroupHeaderToggleAt: 0,
            lastGroupHeaderGestureCanceledAt: 0,
            lastDragStartedAt: 0,
            lastDragEndedAt: 0,
            enabled: false,
        };
    }

    return extensionState[PRESET_VUE_LIST_MANAGER_KEY];
}

function isPresetVuePromptListManagerActive() {
    const manager = getPresetVuePromptListManagerState();
    return Boolean(manager.app && manager.state);
}

function isPresetVuePromptListDragging() {
    return Boolean(getPresetVuePromptListManagerState().state?.dragging);
}

function isPromptManagerReadyForVuePromptList() {
    return Boolean(
        promptManager
        && promptManager.serviceSettings
        && typeof promptManager.getPromptOrderForCharacter === 'function'
        && typeof promptManager.removePromptOrderForCharacter === 'function'
        && typeof promptManager.addPromptOrderForCharacter === 'function'
        && typeof promptManager.saveServiceSettings === 'function'
        && (getPromptManagerListElement() instanceof HTMLElement || getPresetVueListHostElement() instanceof HTMLElement),
    );
}

function schedulePresetVuePromptListManagerSync(delayMs = 80) {
    if (!isPresetGroupingEnabled()) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    clearTimeout(manager.syncTimer);
    manager.syncTimer = setTimeout(() => {
        manager.syncTimer = null;
        void installPresetVuePromptListManager();
    }, delayMs);
}

async function loadPresetVueModule() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.modulePromise) {
        manager.modulePromise = import(new URL(PRESET_VUE_MODULE_PATH, import.meta.url).href);
    }

    return manager.modulePromise;
}

async function loadPresetVueDraggableModule() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.draggableModulePromise) {
        manager.draggableModulePromise = import(new URL(PRESET_VUE_DRAGGABLE_MODULE_PATH, import.meta.url).href);
    }

    return manager.draggableModulePromise;
}

function getPromptManagerListElement() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.root instanceof HTMLElement && manager.root.isConnected) {
        return manager.root;
    }

    if (promptManager?.listElement instanceof HTMLElement && promptManager.listElement.isConnected) {
        return promptManager.listElement;
    }

    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (list instanceof HTMLElement && promptManager) {
        promptManager.listElement = list;
    }

    return list;
}

function getPresetVueListHostElement() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.host instanceof HTMLElement && manager.host.isConnected) {
        return manager.host;
    }

    const host = document.querySelector(`.${PRESET_VUE_LIST_HOST_CLASS}`);
    return host instanceof HTMLElement ? host : null;
}

function replacePromptManagerListWithVueHost(list) {
    const host = document.createElement('div');
    host.className = PRESET_VUE_LIST_HOST_CLASS;
    list.replaceWith(host);
    return {
        host,
        listClassName: getPresetVuePromptListClassName(list),
    };
}

function getPresetVuePromptListClassName(list) {
    const classes = new Set(String(list?.className || 'text_pole').split(/\s+/).filter(Boolean));
    classes.add('text_pole');
    classes.add(PRESET_DRAG_READY_CLASS);
    return Array.from(classes).join(' ');
}

function ensurePromptManagerListAfterVueHost() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.root instanceof HTMLElement && manager.root.isConnected) {
        return manager.root;
    }

    const host = getPresetVueListHostElement();

    if (host instanceof HTMLElement) {
        const existingList = host.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

        if (existingList instanceof HTMLElement) {
            manager.host = host;
            manager.root = existingList;

            if (promptManager) {
                promptManager.listElement = existingList;
            }

            return existingList;
        }

        const list = document.createElement('ul');
        list.id = PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1);
        list.className = 'text_pole';
        host.replaceWith(list);
        manager.host = null;
        manager.root = list;

        if (promptManager) {
            promptManager.listElement = list;
        }

        return list;
    }

    return getPromptManagerListElement();
}

async function restorePromptManagerListAfterVueRemove() {
    const list = ensurePromptManagerListAfterVueHost();

    if (!(list instanceof HTMLElement) || !promptManager || typeof promptManager.renderPromptManagerListItems !== 'function') {
        return;
    }

    list.replaceChildren();

    try {
        await promptManager.renderPromptManagerListItems();
        restorePromptManagerDragAfterVueRemove();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to restore prompt manager list after Vue remove`, error);
    }
}

function restorePromptManagerDragAfterVueRemove() {
    if (isPresetGroupingEnabled()) {
        return;
    }

    const list = getPromptManagerListElement();

    if (settings.presetDragOptimizationEnabled) {
        patchPromptManagerDraggable();
        installPresetDragOptimizationHandlers();
        preparePromptManagerCustomDragList(list);
        return;
    }

    removePresetDragOptimizationHandlers();
    clearPromptManagerCustomDragList();
    restorePromptManagerStockDraggable();
}

function installPresetVuePromptListRenderPatch() {
    if (!promptManager || typeof promptManager.renderPromptManagerListItems !== 'function') {
        return false;
    }

    const existingPatch = extensionState[PRESET_VUE_LIST_RENDER_PATCH_KEY];

    if (existingPatch?.manager === promptManager && promptManager.renderPromptManagerListItems === existingPatch.patched) {
        return true;
    }

    if (promptManager.renderPromptManagerListItems.__baiBaiToolkitPresetVueListPatched) {
        extensionState[PRESET_VUE_LIST_RENDER_PATCH_KEY] = {
            manager: promptManager,
            original: promptManager.renderPromptManagerListItems.__baiBaiToolkitOriginalRenderPromptManagerListItems,
            patched: promptManager.renderPromptManagerListItems,
        };
        return true;
    }

    const originalRenderPromptManagerListItems = promptManager.renderPromptManagerListItems;
    const patchedRenderPromptManagerListItems = async function (...args) {
        if (!isPresetGroupingEnabled()) {
            return originalRenderPromptManagerListItems.apply(this, args);
        }

        await installPresetVuePromptListManager();
        syncPresetVuePromptListManagerState();
        preparePromptManagerCustomDragList(getPromptManagerListElement());
        return undefined;
    };

    patchedRenderPromptManagerListItems.__baiBaiToolkitPresetVueListPatched = true;
    patchedRenderPromptManagerListItems.__baiBaiToolkitOriginalRenderPromptManagerListItems = originalRenderPromptManagerListItems;
    promptManager.renderPromptManagerListItems = patchedRenderPromptManagerListItems;
    extensionState[PRESET_VUE_LIST_RENDER_PATCH_KEY] = {
        manager: promptManager,
        original: originalRenderPromptManagerListItems,
        patched: patchedRenderPromptManagerListItems,
    };
    return true;
}

function removePresetVuePromptListRenderPatch() {
    const patch = extensionState[PRESET_VUE_LIST_RENDER_PATCH_KEY];

    if (!patch) {
        return;
    }

    if (patch.manager?.renderPromptManagerListItems === patch.patched) {
        patch.manager.renderPromptManagerListItems = patch.original;
    }

    delete extensionState[PRESET_VUE_LIST_RENDER_PATCH_KEY];
}

function createPresetVuePromptListModel() {
    return {
        items: [],
        listClassName: `text_pole ${PRESET_DRAG_READY_CLASS}`,
        renderKey: 0,
        reclaimKey: 0,
        dragging: false,
        rangeSelection: {
            active: false,
            name: '',
            startId: null,
            endId: null,
            hoverId: null,
        },
    };
}

function syncPresetVuePromptListManagerState() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.state) {
        return false;
    }

    repairPresetPromptOrderDuplicatesIfNeeded();
    repairPresetPromptGroupStateIfNeeded();
    syncCurrentPresetPromptGroupStateToPresetExtensionField({ persist: false });
    manager.state.items = buildPresetVuePromptListItems();
    manager.state.renderKey += 1;
    return true;
}

function repairPresetPromptOrderDuplicatesIfNeeded() {
    if (!isPromptManagerReadyForCustomDrag()) {
        return false;
    }

    const promptOrder = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) ?? [];
    const seenPromptIds = new Set();
    const repairedPromptOrder = [];
    let changed = false;

    for (const entry of promptOrder) {
        const identifier = entry?.identifier;

        if (!identifier) {
            changed = true;
            continue;
        }

        if (seenPromptIds.has(identifier)) {
            changed = true;
            continue;
        }

        seenPromptIds.add(identifier);
        repairedPromptOrder.push(entry);
    }

    if (!changed) {
        return false;
    }

    promptManager.removePromptOrderForCharacter(promptManager.activeCharacter);
    promptManager.addPromptOrderForCharacter(promptManager.activeCharacter, repairedPromptOrder);
    markPresetPromptServiceSettingsSavePending();
    return true;
}

function repairPresetPromptGroupStateIfNeeded() {
    if (!isPromptManagerReadyForCustomDrag()) {
        return false;
    }

    const groupState = getPresetPromptGroupState();
    const validPromptIds = new Set(
        (promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) ?? [])
            .map(entry => entry?.identifier)
            .filter(Boolean),
    );
    const before = JSON.stringify({
        groups: groupState.groups,
        prompts: groupState.prompts,
    });

    normalizePresetPromptGroupState(groupState, validPromptIds);

    const after = JSON.stringify({
        groups: groupState.groups,
        prompts: groupState.prompts,
    });

    if (before === after) {
        return false;
    }

    savePresetPromptGroupSettings();
    return true;
}

function buildPresetVuePromptListItems() {
    const promptOrder = promptManager.getPromptOrderForCharacter?.(promptManager.activeCharacter) ?? [];
    const prompts = Array.isArray(promptManager.serviceSettings?.prompts)
        ? promptManager.serviceSettings.prompts.filter(Boolean)
        : [];
    const promptById = new Map(prompts.map(prompt => [prompt.identifier, prompt]));
    const groupState = getPresetPromptGroupState();
    normalizePresetPromptGroupState(groupState, new Set(promptOrder.map(entry => entry?.identifier).filter(Boolean)));
    const groupsById = new Map(groupState.groups.map(group => [group.id, group]));
    const counts = promptManager.tokenHandler?.getCounts?.() ?? {};
    const tokenBudget = promptManager.serviceSettings.openai_max_context - promptManager.serviceSettings.openai_max_tokens;
    const isTokenUsageWarning = promptManager.tokenUsage > tokenBudget * 0.8;
    const promptItems = promptOrder
        .map((orderEntry, index) => {
            const prompt = promptById.get(orderEntry?.identifier);

            if (!prompt?.identifier) {
                return null;
            }

            const listEntry = promptManager.getPromptOrderEntry?.(promptManager.activeCharacter, prompt.identifier) ?? orderEntry;
            const groupId = groupState.prompts?.[prompt.identifier]?.groupId;
            const group = groupsById.get(groupId) ?? null;
            const tokens = counts[prompt.identifier] ?? 0;
            const { warningClass, warningTitle } = getPromptTokenWarning({
                prompt,
                tokens,
                isTokenUsageWarning,
            });

            return {
                id: prompt.identifier,
                type: 'prompt',
                groupId: group?.id ?? null,
                prompt,
                orderEntry: listEntry,
                enabled: listEntry?.enabled !== false,
                tokens,
                calculatedTokens: tokens ? String(tokens) : '-',
                warningClass,
                warningTitle,
                index,
            };
        })
        .filter(Boolean);

    const items = [
        { id: PRESET_VUE_HEADER_ENTRY_ID, type: 'header' },
        { id: PRESET_VUE_SEPARATOR_ENTRY_ID, type: 'separator' },
    ];
    const groupItemsById = new Map();

    for (const item of promptItems) {
        if (item.groupId) {
            const group = groupsById.get(item.groupId);
            let groupItem = groupItemsById.get(item.groupId);

            if (!groupItem) {
                groupItem = {
                    id: `group:${item.groupId}`,
                    type: 'group',
                    groupId: item.groupId,
                    group,
                    name: group?.name ?? t`未命名分组`,
                    collapsed: Boolean(group?.collapsed),
                    count: 0,
                    children: [],
                };
                groupItemsById.set(item.groupId, groupItem);
                items.push(groupItem);
            }

            groupItem.children.push(item);
            groupItem.count = groupItem.children.length;
            continue;
        }

        items.push(item);
    }

    return items;
}

function createPresetVuePromptListRootComponent(vue, vueDraggableNext, model) {
    const { h } = vue;

    return {
        name: 'BaiBaiPresetPromptListRoot',
        render() {
            return renderPresetVuePromptDraggable(h, vueDraggableNext, model);
        },
    };
}

function renderPresetVuePromptListHeader(h, model) {
    const prefix = promptManager?.configuration?.prefix ?? '';
    const selecting = Boolean(model?.rangeSelection?.active);

    return h('li', { class: `${prefix}prompt_manager_list_head`, key: 'header' }, [
        h('span', { 'data-i18n': 'Name' }, 'Name'),
        h('span', { class: 'bai-bai-preset-list-head-actions' }, [
            selecting
                ? h('span', {
                    class: 'menu_button fa-solid fa-xmark',
                    title: t`取消分组选择`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        cancelPresetVuePromptGroupRangeSelection(model);
                    },
                })
                : h('span', {
                    class: 'menu_button fa-solid fa-folder-plus',
                    title: t`创建预设分组`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void startPresetVuePromptGroupRangeSelection(model);
                    },
                }),
        ]),
        h('span', {
            class: 'prompt_manager_prompt_tokens',
            'data-i18n': 'Tokens;prompt_manager_tokens',
        }, 'Tokens'),
    ]);
}

function renderPresetVuePromptListSeparator(h) {
    const prefix = promptManager?.configuration?.prefix ?? '';

    return h('li', { class: `${prefix}prompt_manager_list_separator`, key: 'separator' }, [
        h('hr'),
    ]);
}

function renderPresetVuePromptDraggable(h, vueDraggableNext, model) {
    const handleSelector = getPresetVuePromptDragHandleSelector();
    const draggableProps = {
        tag: 'ul',
        id: PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1),
        class: model.listClassName,
        list: model.items,
        group: {
            name: 'bai-bai-preset-prompts',
            pull: true,
            put: canPutPresetVuePromptIntoTopLevelList,
        },
        draggable: `li.${PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS}`,
        filter: PRESET_DRAG_INTERACTIVE_SELECTOR,
        preventOnFilter: false,
        animation: PRESET_VUE_DRAG_ANIMATION_MS,
        dragoverBubble: false,
        bubbleScroll: false,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'bai-bai-preset-vue-sortable-fallback',
        ghostClass: 'bai-bai-preset-vue-sortable-ghost',
        chosenClass: 'bai-bai-preset-vue-sortable-chosen',
        dragClass: 'bai-bai-preset-vue-sortable-drag',
        move: isPresetVuePromptTopLevelDragMoveAllowed,
        onChoose: () => {
            closePresetPromptActionMenus();
        },
        key: `draggable-${model.renderKey}`,
        onStart: () => {
            const manager = getPresetVuePromptListManagerState();
            manager.groupHeaderGesture = null;
            manager.lastDragStartedAt = Date.now();
            showPresetVuePromptDragReadyFeedback(manager, { notify: false });
            setPresetVuePromptDragging(model, true);
            notifyPresetVuePromptDragStarted();
            capturePresetVuePromptDragSnapshot(model);
        },
        onEnd: () => {
            const manager = getPresetVuePromptListManagerState();
            manager.lastDragEndedAt = Date.now();
            setPresetVuePromptDragging(model, false);
            if (consumePresetVuePromptDragChange(model)) {
                schedulePresetVuePromptOrderSaveAfterDrop();
            }
        },
    };
    applyPresetVueDragGestureOptions(draggableProps);

    if (handleSelector) {
        draggableProps.handle = handleSelector;
    }

    return h(vueDraggableNext.VueDraggableNext, draggableProps, {
        default: () => model.items.map(item => renderPresetVuePromptEntry(h, vueDraggableNext, item)),
    });
}

function isPresetVuePromptTopLevelDragMoveAllowed(event) {
    if (getPresetVuePromptListManagerState().state?.rangeSelection?.active) {
        return false;
    }

    const dragged = event?.draggedContext?.element;
    const futureIndex = Number(event?.draggedContext?.futureIndex);
    const to = event?.to;

    if (dragged?.type !== 'prompt' && dragged?.type !== 'group') {
        return false;
    }

    if (dragged.type === 'group' && !(to instanceof HTMLElement && to.id === PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1))) {
        return false;
    }

    if (!Number.isFinite(futureIndex)) {
        return true;
    }

    return futureIndex >= 2;
}

function isPresetVuePromptGroupDragMoveAllowed(event) {
    if (getPresetVuePromptListManagerState().state?.rangeSelection?.active) {
        return false;
    }

    const dragged = event?.draggedContext?.element;
    return dragged?.type === 'prompt';
}

function canPutPresetVuePromptIntoGroupList(to, from, dragElement) {
    return dragElement instanceof HTMLElement && dragElement.matches('li.completion_prompt_manager_prompt_draggable');
}

function canPutPresetVuePromptIntoTopLevelList(to, from, dragElement) {
    if (!(to instanceof HTMLElement) || to.id !== PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1)) {
        return false;
    }

    if (!(dragElement instanceof HTMLElement)) {
        return false;
    }

    if (dragElement.matches(`li.${PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS}`)) {
        return false;
    }

    return dragElement.matches(`li.${PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS}`);
}

function capturePresetVuePromptDragSnapshot(model) {
    getPresetVuePromptListManagerState().dragSnapshot = getPresetVuePromptListSnapshot(model);
}

function consumePresetVuePromptDragChange(model) {
    const manager = getPresetVuePromptListManagerState();
    const snapshot = manager.dragSnapshot;
    manager.dragSnapshot = null;

    if (!snapshot) {
        return false;
    }

    const sanitized = sanitizePresetVuePromptListModel(model);
    const current = getPresetVuePromptListSnapshot(model);
    return sanitized
        || !areStringArraysEqual(snapshot.order, current.order)
        || !arePresetVuePromptGroupAssignmentsEqual(snapshot.assignments, current.assignments);
}

function getPresetVuePromptListSnapshot(model) {
    return {
        order: getPresetVuePromptFlatIds(model),
        assignments: getPresetVuePromptGroupAssignmentsFromModel(model),
    };
}

function arePresetVuePromptGroupAssignmentsEqual(left = {}, right = {}) {
    const promptIds = new Set([...Object.keys(left), ...Object.keys(right)]);

    for (const promptId of promptIds) {
        if ((left[promptId] ?? null) !== (right[promptId] ?? null)) {
            return false;
        }
    }

    return true;
}

function renderPresetVuePromptEntry(h, vueDraggableNext, item) {
    if (item?.type === 'header') {
        return renderPresetVuePromptListHeader(h, getPresetVuePromptListManagerState().state);
    }

    if (item?.type === 'separator') {
        return renderPresetVuePromptListSeparator(h);
    }

    if (item?.type === 'group') {
        return renderPresetVuePromptGroup(h, vueDraggableNext, item);
    }

    return renderPresetVuePromptRow(h, item, { topLevel: true });
}

function renderPresetVuePromptGroup(h, vueDraggableNext, item) {
    const handleSelector = getPresetVuePromptDragHandleSelector();
    const groupFullyEnabled = isPresetVuePromptGroupFullyEnabled(item);
    const draggableProps = {
        tag: 'ul',
        class: 'bai-bai-preset-group-list',
        list: item.children,
        group: {
            name: 'bai-bai-preset-prompts',
            pull: true,
            put: canPutPresetVuePromptIntoGroupList,
        },
        draggable: `li.${PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS}`,
        filter: PRESET_DRAG_INTERACTIVE_SELECTOR,
        preventOnFilter: false,
        animation: PRESET_VUE_DRAG_ANIMATION_MS,
        dragoverBubble: false,
        bubbleScroll: false,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'bai-bai-preset-vue-sortable-fallback',
        ghostClass: 'bai-bai-preset-vue-sortable-ghost',
        chosenClass: 'bai-bai-preset-vue-sortable-chosen',
        dragClass: 'bai-bai-preset-vue-sortable-drag',
        move: isPresetVuePromptGroupDragMoveAllowed,
        onChoose: () => {
            closePresetPromptActionMenus();
        },
        onStart: () => {
            const manager = getPresetVuePromptListManagerState();
            const model = manager.state;
            manager.groupHeaderGesture = null;
            manager.lastDragStartedAt = Date.now();
            showPresetVuePromptDragReadyFeedback(manager, { notify: false });
            setPresetVuePromptDragging(model, true);
            notifyPresetVuePromptDragStarted();
            capturePresetVuePromptDragSnapshot(model);
        },
        onEnd: () => {
            const manager = getPresetVuePromptListManagerState();
            const model = manager.state;
            manager.lastDragEndedAt = Date.now();
            setPresetVuePromptDragging(model, false);
            if (consumePresetVuePromptDragChange(model)) {
                schedulePresetVuePromptOrderSaveAfterDrop();
            }
        },
    };
    applyPresetVueDragGestureOptions(draggableProps);

    if (handleSelector) {
        draggableProps.handle = handleSelector;
    }

    return h('li', {
        class: [
            PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS,
            'bai-bai-preset-group',
            item.collapsed ? 'bai-bai-preset-group-collapsed' : '',
        ],
        'data-preset-group-id': item.groupId,
        key: item.id,
    }, [
        h('div', {
            class: 'bai-bai-preset-group-header bai-bai-preset-group-drag-surface',
            onPointerdown: event => beginPresetVuePromptGroupHeaderGesture(event, item.groupId),
            onPointermoveCapture: event => movePresetVuePromptGroupHeaderGesture(event, item.groupId),
            onPointerup: event => finishPresetVuePromptGroupHeaderGesture(event, item.groupId),
            onPointercancel: () => cancelPresetVuePromptGroupHeaderGesture(item.groupId),
            onClick: event => handlePresetVuePromptGroupHeaderClickFallback(event, item.groupId),
        }, [
            h('span', { class: 'bai-bai-preset-group-title', title: item.name }, [
                h('span', {
                    class: [
                        'menu_button',
                        'bai-bai-preset-group-toggle',
                        'fa-solid',
                        item.collapsed ? 'fa-chevron-right' : 'fa-chevron-down',
                    ],
                    title: item.collapsed ? t`展开分组` : t`收起分组`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePresetVuePromptGroupCollapsed(item.groupId);
                    },
                }),
                h('strong', null, item.name),
                h('small', { class: 'bai-bai-preset-group-count' }, formatPresetVuePromptGroupCount(item)),
            ]),
            h('span', { class: 'bai-bai-preset-group-actions' }, [
                h('span', {
                    class: [
                        'menu_button',
                        'fa-solid',
                        'bai-bai-preset-group-action-button',
                        'bai-bai-preset-group-enable-toggle',
                        groupFullyEnabled ? 'fa-toggle-on' : 'fa-toggle-off',
                    ],
                    title: groupFullyEnabled ? t`关闭分组内所有条目` : t`开启分组内所有条目`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePresetVuePromptGroupEnabled(item.groupId);
                    },
                }),
                h('span', {
                    class: 'menu_button fa-solid fa-pencil bai-bai-preset-group-action-button',
                    title: t`重命名分组`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void renamePresetVuePromptGroup(item.groupId);
                    },
                }),
                h('span', {
                    class: 'menu_button fa-solid fa-trash bai-bai-preset-group-action-button',
                    title: t`删除分组`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        void deletePresetVuePromptGroup(item.groupId);
                    },
                }),
            ]),
        ]),
        renderPresetVuePromptGroupBody(h, vueDraggableNext, item, draggableProps),
    ]);
}

function isPresetVuePromptGroupFullyEnabled(item) {
    const children = Array.isArray(item?.children) ? item.children : [];
    return children.length > 0 && children.every(child => child?.enabled !== false && child?.orderEntry?.enabled !== false);
}

function formatPresetVuePromptGroupCount(item) {
    const children = Array.isArray(item?.children) ? item.children : [];
    const total = children.length || Number(item?.count) || 0;
    const enabled = children.filter(child => child?.enabled !== false && child?.orderEntry?.enabled !== false).length;
    return `(${enabled}/${total})`;
}

function beginPresetVuePromptGroupHeaderGesture(event, groupId) {
    if (isPresetVuePromptGroupHeaderInteractiveEvent(event)) {
        return;
    }

    if (event.pointerType === 'mouse' && event.button !== 0) {
        return;
    }

    if (event.isPrimary === false) {
        return;
    }

    const point = getPresetVuePointerEventPoint(event);

    if (!point) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    const feedbackElement = getPresetVuePromptGroupHeaderFeedbackElement(event.currentTarget);

    clearPresetVuePromptDragReadyFeedback(manager);
    schedulePresetVuePromptDragReadyFeedback(manager, feedbackElement);
    manager.groupHeaderGesture = {
        groupId,
        pointerId: event.pointerId,
        startedAt: Date.now(),
        x: point.clientX,
        y: point.clientY,
        lastY: point.clientY,
        scrolling: false,
        scrollTargets: getPresetVuePromptGroupHeaderScrollTargets(event.currentTarget),
    };
}

function movePresetVuePromptGroupHeaderGesture(event, groupId) {
    if (!isMobile()) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    const gesture = manager.groupHeaderGesture;

    if (!gesture || gesture.groupId !== groupId || gesture.pointerId !== event.pointerId || manager.state?.dragging) {
        return;
    }

    const point = getPresetVuePointerEventPoint(event);

    if (!point) {
        return;
    }

    const deltaX = point.clientX - gesture.x;
    const deltaY = point.clientY - gesture.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    const beforeLongPress = Date.now() - gesture.startedAt < PRESET_VUE_TOUCH_DRAG_DELAY_MS;

    if (!gesture.scrolling) {
        if (!beforeLongPress || absY <= PRESET_VUE_TOUCH_START_THRESHOLD_PX || absY < absX) {
            return;
        }

        gesture.scrolling = true;
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
        clearPresetVuePromptDragReadyFeedback(manager);
    }

    scrollPresetVuePromptGroupHeaderGesture(gesture, point);

    if (event.cancelable) {
        event.preventDefault();
    }

    event.stopPropagation();
}

function finishPresetVuePromptGroupHeaderGesture(event, groupId) {
    const manager = getPresetVuePromptListManagerState();
    const gesture = manager.groupHeaderGesture;

    if (!gesture || gesture.groupId !== groupId || gesture.pointerId !== event.pointerId) {
        return;
    }

    manager.groupHeaderGesture = null;
    clearPresetVuePromptDragReadyFeedback(manager);

    if (isPresetVuePromptGroupHeaderInteractiveEvent(event) || shouldSuppressPresetVuePromptGroupHeaderToggle(manager)) {
        return;
    }

    const point = getPresetVuePointerEventPoint(event);

    if (!point || gesture.scrolling || getPresetVuePointDistance(gesture, point) > PRESET_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX) {
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
        return;
    }

    if (event.cancelable) {
        event.preventDefault();
    }

    event.stopPropagation();
    manager.lastGroupHeaderToggleAt = Date.now();
    togglePresetVuePromptGroupCollapsed(groupId);
}

function cancelPresetVuePromptGroupHeaderGesture(groupId) {
    const manager = getPresetVuePromptListManagerState();

    if (manager.groupHeaderGesture?.groupId === groupId) {
        manager.groupHeaderGesture = null;
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
        clearPresetVuePromptDragReadyFeedback(manager);
    }
}

function handlePresetVuePromptGroupHeaderClickFallback(event, groupId) {
    const manager = getPresetVuePromptListManagerState();

    if (isPresetVuePromptGroupHeaderInteractiveEvent(event)) {
        return;
    }

    const now = Date.now();

    if (
        now - (manager.lastGroupHeaderToggleAt || 0) < PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS
        || now - (manager.lastGroupHeaderGestureCanceledAt || 0) < PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS
        || shouldSuppressPresetVuePromptGroupHeaderToggle(manager)
    ) {
        if (event.cancelable) {
            event.preventDefault();
        }

        event.stopPropagation();
        return;
    }

    manager.lastGroupHeaderToggleAt = now;
    togglePresetVuePromptGroupCollapsed(groupId);
}

function shouldSuppressPresetVuePromptGroupHeaderToggle(manager) {
    return Boolean(
        manager.state?.dragging
        || Date.now() - (manager.lastDragEndedAt || 0) < PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS,
    );
}

function isPresetVuePromptGroupHeaderInteractiveEvent(event) {
    const target = event.target instanceof Element ? event.target : null;
    return Boolean(target?.closest('.bai-bai-preset-group-actions, .bai-bai-preset-group-toggle'));
}

function getPresetVuePointerEventPoint(event) {
    if (typeof event?.clientX !== 'number' || typeof event?.clientY !== 'number') {
        return null;
    }

    return {
        clientX: event.clientX,
        clientY: event.clientY,
    };
}

function getPresetVuePointDistance(start, end) {
    return Math.hypot(end.clientX - start.x, end.clientY - start.y);
}

function getPresetVuePromptGroupHeaderFeedbackElement(source) {
    if (!(source instanceof Element)) {
        return null;
    }

    return source.closest(`li.${PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS}`);
}

function schedulePresetVuePromptDragReadyFeedback(manager, element) {
    if (!isMobile() || !(element instanceof HTMLElement)) {
        return;
    }

    manager.dragReadyFeedbackElement = element;
    manager.dragReadyFeedbackTimer = window.setTimeout(() => {
        if (manager.groupHeaderGesture?.scrolling) {
            clearPresetVuePromptDragReadyFeedback(manager);
            return;
        }

        showPresetVuePromptDragReadyFeedback(manager);
    }, PRESET_VUE_TOUCH_DRAG_DELAY_MS);
}

function showPresetVuePromptDragReadyFeedback(manager, { notify = true } = {}) {
    if (manager.dragReadyFeedbackTimer) {
        clearTimeout(manager.dragReadyFeedbackTimer);
        manager.dragReadyFeedbackTimer = null;
    }

    if (manager.dragReadyFeedbackElement instanceof HTMLElement) {
        manager.dragReadyFeedbackElement.classList.add(PRESET_VUE_DRAG_READY_FEEDBACK_CLASS);
    }

    if (notify && !manager.dragReadyFeedbackNotified) {
        manager.dragReadyFeedbackNotified = true;
        vibratePresetVuePromptDragFeedback();
    }
}

function clearPresetVuePromptDragReadyFeedback(manager = getPresetVuePromptListManagerState()) {
    if (manager.dragReadyFeedbackTimer) {
        clearTimeout(manager.dragReadyFeedbackTimer);
        manager.dragReadyFeedbackTimer = null;
    }

    if (manager.dragReadyFeedbackElement instanceof HTMLElement) {
        manager.dragReadyFeedbackElement.classList.remove(PRESET_VUE_DRAG_READY_FEEDBACK_CLASS);
    }

    manager.dragReadyFeedbackElement = null;
    manager.dragReadyFeedbackNotified = false;
}

function getPresetVuePromptGroupHeaderScrollTargets(source) {
    const targets = [];
    let current = source instanceof Element ? source.parentElement : null;

    while (current && current !== document.body && current !== document.documentElement) {
        const style = getComputedStyle(current);
        const canScrollY = /(auto|scroll|overlay)/.test(style.overflowY);

        if (canScrollY && current.scrollHeight > current.clientHeight) {
            targets.push(current);
        }

        current = current.parentElement;
    }

    targets.push(document.scrollingElement || document.documentElement);
    return targets;
}

function scrollPresetVuePromptGroupHeaderGesture(gesture, point) {
    const deltaY = gesture.lastY - point.clientY;
    gesture.lastY = point.clientY;

    if (!deltaY) {
        return;
    }

    let remaining = deltaY;

    for (const target of gesture.scrollTargets ?? []) {
        if (!(target instanceof Element)) {
            continue;
        }

        const before = target.scrollTop;
        target.scrollTop += remaining;
        remaining -= target.scrollTop - before;

        if (Math.abs(remaining) < 0.5) {
            return;
        }
    }
}

function renderPresetVuePromptGroupBody(h, vueDraggableNext, item, draggableProps) {
    return h('div', {
        class: 'bai-bai-preset-group-body',
        'aria-hidden': item.collapsed ? 'true' : 'false',
    }, [
        h('div', { class: 'bai-bai-preset-group-body-inner' }, [
            h(vueDraggableNext.VueDraggableNext, draggableProps, {
                default: () => (item.children ?? []).map(child => renderPresetVuePromptRow(h, child, { groupChild: true })),
            }),
        ]),
    ]);
}

function applyPresetVueDragGestureOptions(draggableProps) {
    if (isMobile()) {
        Object.assign(draggableProps, {
            delay: PRESET_VUE_TOUCH_DRAG_DELAY_MS,
            delayOnTouchOnly: true,
            touchStartThreshold: PRESET_VUE_TOUCH_START_THRESHOLD_PX,
            fallbackTolerance: PRESET_VUE_TOUCH_START_THRESHOLD_PX,
        });
        return;
    }

    Object.assign(draggableProps, {
        touchStartThreshold: PRESET_VUE_POINTER_START_THRESHOLD_PX,
        fallbackTolerance: PRESET_VUE_POINTER_START_THRESHOLD_PX,
    });
}

function notifyPresetVuePromptDragStarted() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.dragReadyFeedbackNotified) {
        return;
    }

    vibratePresetVuePromptDragFeedback();
}

function vibratePresetVuePromptDragFeedback() {
    if (!isMobile() || typeof navigator === 'undefined' || typeof navigator.vibrate !== 'function') {
        return;
    }

    try {
        navigator.vibrate(12);
    } catch {
        // Some embedded webviews expose vibrate but reject it.
    }
}

function getPresetVuePromptDragHandleSelector() {
    return isMobile() && !settings.presetMobileWholeRowDragEnabled
        ? '.drag-handle, .bai-bai-preset-group-drag-surface'
        : '';
}

function setPresetVuePromptDragging(model, dragging) {
    if (!model) {
        if (!dragging) {
            clearPresetVuePromptDragReadyFeedback();
            setPresetVuePromptDragScrollGuardEnabled(false);
            document.body?.classList.remove(PRESET_VUE_DRAGGING_BODY_CLASS);
            getPromptManagerListElement()?.classList.remove(PRESET_DRAG_ACTIVE_CLASS);
        }
        return;
    }

    if (dragging) {
        closePresetPromptActionMenus();
    }

    model.dragging = Boolean(dragging);
    document.body?.classList.toggle(PRESET_VUE_DRAGGING_BODY_CLASS, model.dragging);
    getPromptManagerListElement()?.classList.toggle(PRESET_DRAG_ACTIVE_CLASS, model.dragging);
    setPresetVuePromptDragScrollGuardEnabled(model.dragging);

    if (!model.dragging) {
        clearPresetVuePromptDragReadyFeedback();
    }

    if (!model.dragging && extensionState.promptManagerTokenRefreshPendingAfterDrag) {
        extensionState.promptManagerTokenRefreshPendingAfterDrag = false;
        refreshPromptManagerTokensDebounced();
    }
}

function setPresetVuePromptDragScrollGuardEnabled(enabled) {
    if (!isMobile()) {
        return;
    }

    const existing = extensionState[PRESET_VUE_TOUCH_SCROLL_GUARD_KEY];

    if (enabled) {
        if (existing?.touchmove) {
            return;
        }

        const touchmove = event => {
            if (!isPresetVuePromptListDragging()) {
                return;
            }

            if (event.cancelable) {
                event.preventDefault();
            }
        };

        document.addEventListener('touchmove', touchmove, { capture: true, passive: false });
        extensionState[PRESET_VUE_TOUCH_SCROLL_GUARD_KEY] = { touchmove };
        return;
    }

    if (!existing?.touchmove) {
        return;
    }

    document.removeEventListener('touchmove', existing.touchmove, true);
    delete extensionState[PRESET_VUE_TOUCH_SCROLL_GUARD_KEY];
}

function renderPresetVuePromptRow(h, item, { topLevel = false, groupChild = false } = {}) {
    const prefix = promptManager?.configuration?.prefix ?? '';
    const prompt = item.prompt;
    const isEnabled = item.enabled !== false && item.orderEntry?.enabled !== false;
    const markerClass = prompt.marker ? `${prefix}prompt_manager_marker` : '';
    const importantClass = getPromptImportantClass(prompt, prefix);
    const manager = getPresetVuePromptListManagerState();
    const rangeClasses = getPresetVuePromptRangeClasses(manager.state, item);

    return h('li', {
        class: [
            `${prefix}prompt_manager_prompt`,
            `${prefix}prompt_manager_prompt_draggable`,
            topLevel ? PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS : '',
            groupChild ? PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS : '',
            isEnabled ? '' : `${prefix}prompt_manager_prompt_disabled`,
            markerClass,
            importantClass,
            ...rangeClasses,
        ],
        'data-pm-identifier': prompt.identifier,
        'data-preset-group-id': item.groupId || '',
        key: prompt.identifier,
        onClickCapture: event => handlePresetVuePromptRangeSelectionClick(manager.state, item, event),
        onClick: event => handlePresetVuePromptRangeSelectionClick(manager.state, item, event),
        onMouseenter: () => updatePresetVuePromptRangeSelectionHover(manager.state, item),
    }, [
        h('span', { class: 'drag-handle ui-sortable-handle' }, '\u2630'),
        renderPresetVuePromptNameCell(h, prompt, prefix),
        h('span', null, [
            h('span', { class: 'prompt_manager_prompt_controls' }, renderPresetVuePromptControls(h, prompt, item)),
        ]),
        h('span', {
            class: 'prompt_manager_prompt_tokens',
            'data-pm-tokens': item.calculatedTokens,
        }, [
            h('span', {
                class: item.warningClass,
                title: item.warningTitle,
            }, ' '),
            item.calculatedTokens,
        ]),
    ]);
}

function renderPresetVuePromptNameCell(h, prompt, prefix) {
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
    const children = [];

    if (isMarkerPrompt) children.push(renderPresetVueIcon(h, 'fa-fw fa-solid fa-thumb-tack', 'Marker'), ' ');
    if (isSystemPrompt) children.push(renderPresetVueIcon(h, 'fa-fw fa-solid fa-square-poll-horizontal', 'Global Prompt'), ' ');
    if (isImportantPrompt) children.push(renderPresetVueIcon(h, 'fa-fw fa-solid fa-star', 'Important Prompt'), ' ');
    if (isUserPrompt) children.push(renderPresetVueIcon(h, 'fa-fw fa-solid fa-asterisk', 'Preset Prompt'), ' ');
    if (isInjectionPrompt) children.push(renderPresetVueIcon(h, 'fa-fw fa-solid fa-syringe', 'In-Chat Injection'), ' ');

    children.push(promptManager.isPromptInspectionAllowed?.(prompt)
        ? h('a', { title: promptName, class: 'prompt-manager-inspect-action' }, promptName)
        : h('span', { title: promptName }, promptName));

    if (role) {
        children.push(' ', h('span', {
            'data-role': prompt.role,
            class: `fa-xs fa-solid ${role.roleIcon}`,
            title: role.roleTitle,
        }));
    }

    if (isInjectionPrompt) {
        children.push(' ', h('small', { class: 'prompt-manager-injection-depth' }, `@ ${prompt.injection_depth?.toString?.() ?? ''}`));
    }

    if (isOverriddenPrompt) {
        children.push(' ', h('small', {
            class: 'fa-solid fa-address-card prompt-manager-overridden',
            title: 'Pulled from a character card',
        }));
    }

    return h('span', {
        class: `${prefix}prompt_manager_prompt_name`,
        'data-pm-name': promptName,
    }, children);
}

function renderPresetVueIcon(h, className, title) {
    return h('span', { class: className, title });
}

function getPresetPromptGroupState() {
    const presetName = getPresetPromptGroupRuntimePresetName();

    if (
        extensionState.presetPromptGroupRuntimePresetName !== presetName
        || !extensionState.presetPromptGroupRuntimeState
        || typeof extensionState.presetPromptGroupRuntimeState !== 'object'
    ) {
        const loaded = loadCurrentPresetPromptGroupStateFromPreset();
        extensionState.presetPromptGroupRuntimePresetName = presetName;
        extensionState.presetPromptGroupRuntimeState = loaded.state;

        if (loaded.shouldPersist) {
            savePresetPromptGroupSettings({ immediate: true });
        }
    }

    return extensionState.presetPromptGroupRuntimeState;
}

function getPresetPromptGroupRuntimePresetName() {
    return oai_settings?.preset_settings_openai || 'current';
}

function createEmptyPresetPromptGroupState() {
    return {
        groups: [],
        prompts: {},
    };
}

function loadCurrentPresetPromptGroupStateFromPreset() {
    const validPromptIds = getCurrentPresetPromptOrderIds();
    const importedState = readCurrentPresetPromptGroupExtensionState(validPromptIds);

    if (importedState) {
        return {
            state: importedState,
            shouldPersist: false,
        };
    }

    const compatCandidates = getCompatPresetPromptGroupStateCandidates(validPromptIds);

    if (compatCandidates.length > 1) {
        schedulePresetPromptGroupCompatChoice(compatCandidates, validPromptIds);
        return {
            state: createEmptyPresetPromptGroupState(),
            shouldPersist: false,
        };
    }

    const compatCandidate = compatCandidates[0];

    if (compatCandidate) {
        return {
            state: compatCandidate.state,
            shouldPersist: true,
        };
    }

    return {
        state: createEmptyPresetPromptGroupState(),
        shouldPersist: false,
    };
}

function hasPresetPromptGroupStateData(state) {
    return Boolean(
        Array.isArray(state?.groups) && state.groups.length > 0
        && state?.prompts && typeof state.prompts === 'object'
        && Object.keys(state.prompts).length > 0,
    );
}

function normalizePresetPromptGroupState(groupState, validPromptIds = null) {
    const seenGroupIds = new Set();
    groupState.groups = groupState.groups
        .filter(group => group && typeof group === 'object' && group.id)
        .map((group, index) => ({
            id: String(group.id),
            name: String(group.name || t`未命名分组`),
            order: Number.isFinite(Number(group.order)) ? Number(group.order) : index,
            collapsed: Boolean(group.collapsed),
        }))
        .sort((a, b) => a.order - b.order)
        .filter(group => {
            if (seenGroupIds.has(group.id)) {
                return false;
            }

            seenGroupIds.add(group.id);
            return true;
        })
        .map((group, index) => ({ ...group, order: index }));

    const validGroupIds = new Set(groupState.groups.map(group => group.id));
    const normalizedPrompts = {};

    for (const [promptId, meta] of Object.entries(groupState.prompts ?? {})) {
        const groupId = meta?.groupId;

        if (!groupId || !validGroupIds.has(groupId)) {
            continue;
        }

        if (validPromptIds instanceof Set && !validPromptIds.has(promptId)) {
            continue;
        }

        normalizedPrompts[promptId] = { groupId };
    }

    groupState.prompts = normalizedPrompts;
}

function readCurrentPresetPromptGroupExtensionState(validPromptIds = getCurrentPresetPromptOrderIds()) {
    const value = readCurrentPresetExtensionField(PRESET_GROUP_EXTENSION_PATH);

    if (!value || typeof value !== 'object') {
        return null;
    }

    const groupState = {
        groups: Array.isArray(value.groups)
            ? structuredClone(value.groups)
            : [],
        prompts: value.prompts && typeof value.prompts === 'object' ? structuredClone(value.prompts) : {},
    };

    normalizePresetPromptGroupState(groupState, new Set(validPromptIds));
    return hasPresetPromptGroupStateData(groupState) ? groupState : null;
}

function getCompatPresetPromptGroupStateCandidates(validPromptIds = getCurrentPresetPromptOrderIds()) {
    const entryGrouping = readCurrentPresetExtensionField(PRESET_COMPAT_ENTRY_GROUPING_EXTENSION_PATH);

    if (!entryGrouping || !validPromptIds.length) {
        return [];
    }

    return [
        {
            formatName: t`起止范围格式`,
            state: convertCompatEntryGroupingRangeToPresetPromptGroupState(entryGrouping, validPromptIds),
        },
        {
            formatName: t`成员列表格式`,
            state: convertCompatEntryGroupingMembersToPresetPromptGroupState(entryGrouping, validPromptIds),
        },
    ].filter(candidate => hasPresetPromptGroupStateData(candidate.state));
}

function getCompatEntryGroupingEntries(entryGrouping) {
    if (Array.isArray(entryGrouping)) {
        return entryGrouping;
    }

    if (!entryGrouping || typeof entryGrouping !== 'object') {
        return [];
    }

    for (const key of ['groups', 'entries', 'entryGroups', 'items']) {
        if (Array.isArray(entryGrouping[key])) {
            return entryGrouping[key];
        }
    }

    return [];
}

function convertCompatEntryGroupingRangeToPresetPromptGroupState(entryGrouping, promptIds = getCurrentPresetPromptOrderIds()) {
    const entries = getCompatEntryGroupingEntries(entryGrouping);

    if (!entries.length || !promptIds.length) {
        return null;
    }

    const validPromptIds = new Set(promptIds);
    const groupState = {
        groups: [],
        prompts: {},
    };
    const assignedPromptIds = new Set();

    for (const [index, entry] of entries.entries()) {
        if (!entry || typeof entry !== 'object') {
            continue;
        }

        const startIndex = promptIds.indexOf(entry.startIdentifier);
        const endIndex = promptIds.indexOf(entry.endIdentifier);

        if (startIndex < 0 || endIndex < 0) {
            continue;
        }

        const exclusive = String(entry.mode || 'inclusive').toLowerCase() === 'exclusive';
        const from = Math.min(startIndex, endIndex) + (exclusive ? 1 : 0);
        const to = Math.max(startIndex, endIndex) - (exclusive ? 1 : 0);

        if (from > to) {
            continue;
        }

        const groupId = String(entry.id || uuidv4());
        groupState.groups.push({
            id: groupId,
            name: String(entry.name || t`未命名分组`),
            order: index,
            collapsed: true,
        });

        for (const promptId of promptIds.slice(from, to + 1)) {
            if (!validPromptIds.has(promptId) || assignedPromptIds.has(promptId)) {
                continue;
            }

            assignedPromptIds.add(promptId);
            groupState.prompts[promptId] = { groupId };
        }
    }

    normalizePresetPromptGroupState(groupState, validPromptIds);
    return hasPresetPromptGroupStateData(groupState) ? groupState : null;
}

function convertCompatEntryGroupingMembersToPresetPromptGroupState(entryGrouping, promptIds = getCurrentPresetPromptOrderIds()) {
    const entries = getCompatEntryGroupingEntries(entryGrouping);

    if (!entries.length || !promptIds.length) {
        return null;
    }

    const validPromptIds = new Set(promptIds);
    const groupState = {
        groups: [],
        prompts: {},
    };
    const assignedPromptIds = new Set();

    for (const [index, entry] of entries.entries()) {
        if (!entry || typeof entry !== 'object' || !Array.isArray(entry.memberIdentifiers)) {
            continue;
        }

        const memberIds = entry.memberIdentifiers
            .map(identifier => String(identifier || ''))
            .filter(identifier => validPromptIds.has(identifier) && !assignedPromptIds.has(identifier));

        if (!memberIds.length) {
            continue;
        }

        const memberIdSet = new Set(memberIds);
        const groupId = String(entry.id || uuidv4());
        groupState.groups.push({
            id: groupId,
            name: String(entry.name || t`未命名分组`),
            order: index,
            collapsed: true,
        });

        for (const promptId of promptIds) {
            if (!memberIdSet.has(promptId)) {
                continue;
            }

            assignedPromptIds.add(promptId);
            groupState.prompts[promptId] = { groupId };
        }
    }

    normalizePresetPromptGroupState(groupState, validPromptIds);
    return hasPresetPromptGroupStateData(groupState) ? groupState : null;
}

function schedulePresetPromptGroupCompatChoice(candidates, validPromptIds = getCurrentPresetPromptOrderIds()) {
    const presetName = getPresetPromptGroupRuntimePresetName();
    const choiceKey = getPresetPromptGroupCompatChoiceKey(presetName, candidates, validPromptIds);

    if (
        extensionState.presetPromptGroupCompatChoicePendingKey === choiceKey
        || extensionState.presetPromptGroupCompatChoiceDismissedKey === choiceKey
    ) {
        return false;
    }

    extensionState.presetPromptGroupCompatChoicePendingKey = choiceKey;
    void choosePresetPromptGroupCompatCandidate(candidates, validPromptIds, presetName, choiceKey);
    return true;
}

function getPresetPromptGroupCompatChoiceKey(presetName, candidates, validPromptIds) {
    const candidateKey = candidates
        .map(candidate => {
            const groupNames = candidate.state.groups.map(group => group.name).join(',');
            return `${candidate.formatName}:${candidate.state.groups.length}:${Object.keys(candidate.state.prompts).length}:${groupNames}`;
        })
        .join('|');

    return `${presetName}:${validPromptIds.length}:${candidateKey}`;
}

async function choosePresetPromptGroupCompatCandidate(candidates, validPromptIds, presetName, choiceKey) {
    try {
        const popupResult = await callGenericPopup(
            renderPresetPromptGroupCompatChoicePopup(candidates),
            POPUP_TYPE.TEXT,
            '',
            {
                okButton: false,
                cancelButton: t`取消`,
                allowVerticalScrolling: true,
                wider: true,
                customButtons: candidates.map((candidate, index) => ({
                    text: t`使用分组${getPresetPromptGroupCompatChoiceLetter(index)}`,
                    result: PRESET_GROUP_COMPAT_CHOICE_RESULT_BASE + index,
                    tooltip: candidate.formatName,
                })),
            },
        );
        const selectedIndex = Number(popupResult) - PRESET_GROUP_COMPAT_CHOICE_RESULT_BASE;
        const selectedCandidate = candidates[selectedIndex];

        if (!selectedCandidate) {
            extensionState.presetPromptGroupCompatChoiceDismissedKey = choiceKey;
            return;
        }

        if (getPresetPromptGroupRuntimePresetName() !== presetName) {
            return;
        }

        extensionState.presetPromptGroupRuntimePresetName = presetName;
        extensionState.presetPromptGroupRuntimeState = selectedCandidate.state;
        normalizePresetPromptGroupState(extensionState.presetPromptGroupRuntimeState, new Set(validPromptIds));
        savePresetPromptGroupSettings({ immediate: true });
        syncPresetVuePromptListManagerState();
    } finally {
        if (extensionState.presetPromptGroupCompatChoicePendingKey === choiceKey) {
            delete extensionState.presetPromptGroupCompatChoicePendingKey;
        }
    }
}

function renderPresetPromptGroupCompatChoicePopup(candidates) {
    const lines = candidates
        .map((candidate, index) => {
            const letter = getPresetPromptGroupCompatChoiceLetter(index);
            const groups = candidate.state.groups ?? [];
            const groupNames = groups.map(group => group.name).filter(Boolean);
            const previewNames = groupNames.slice(0, 6).map(name => escapeHtml(name));
            const suffix = groupNames.length > previewNames.length ? '...' : '';
            const preview = [...previewNames, suffix].filter(Boolean).join('、') || t`无`;

            return `<p><strong>${t`分组`}${letter}</strong>${t`有${groups.length}个分组`}：${preview}</p>`;
        })
        .join('');

    return `
        <div class="bai-bai-preset-group-import-choice">
            <p>${t`检测到当前预设同时包含两种可兼容的分组格式，请选择要导入的分组。`}</p>
            ${lines}
        </div>
    `;
}

function getPresetPromptGroupCompatChoiceLetter(index) {
    return String.fromCharCode(65 + index);
}

function getCurrentPresetPromptOrderIds() {
    return (promptManager?.getPromptOrderForCharacter?.(promptManager.activeCharacter) ?? [])
        .map(entry => entry?.identifier)
        .filter(Boolean);
}

function readCurrentPresetExtensionField(path) {
    const presetName = oai_settings?.preset_settings_openai;
    const presetManager = getPresetManager('openai');

    if (presetManager && presetName) {
        const preset = presetManager.getCompletionPresetByName?.(presetName);
        const presetValue = getObjectPath(preset?.extensions, path);

        if (presetValue !== null && presetValue !== undefined) {
            return presetValue;
        }
    }

    const settingsValue = getObjectPath(oai_settings?.extensions, path);

    if (settingsValue !== null && settingsValue !== undefined) {
        return settingsValue;
    }

    return null;
}

function getObjectPath(source, path) {
    if (!source || typeof source !== 'object') {
        return null;
    }

    return String(path || '')
        .split('.')
        .filter(Boolean)
        .reduce((value, key) => (value && typeof value === 'object' ? value[key] : undefined), source) ?? null;
}

function setObjectPath(target, path, value) {
    if (!target || typeof target !== 'object') {
        return;
    }

    const parts = String(path || '').split('.').filter(Boolean);
    let cursor = target;

    for (let index = 0; index < parts.length - 1; index++) {
        const key = parts[index];

        if (!cursor[key] || typeof cursor[key] !== 'object') {
            cursor[key] = {};
        }

        cursor = cursor[key];
    }

    cursor[parts[parts.length - 1]] = value;
}

function savePresetPromptGroupSettings({ immediate = false, force = false } = {}) {
    const payload = getCurrentPresetPromptGroupExtensionPayload();
    const changed = syncCurrentPresetPromptGroupStateToPresetExtensionField({ force, persist: immediate, payload });

    if (changed && !immediate) {
        markPresetPromptGroupSettingsSavePending(payload);
    }

    return changed;
}

function getCurrentPresetPromptGroupExtensionPayload() {
    const presetName = oai_settings?.preset_settings_openai;
    const presetManager = getPresetManager('openai');

    if (!presetName) {
        return null;
    }

    const promptIds = getCurrentPresetPromptOrderIds();

    if (!promptIds.length) {
        return null;
    }

    const groupState = getSerializableCurrentPresetPromptGroupState(promptIds);
    const existingPresetGroupState = readCurrentPresetExtensionField(PRESET_GROUP_EXTENSION_PATH);

    if (!hasPresetPromptGroupStateData(groupState) && !existingPresetGroupState) {
        return null;
    }

    const serialized = JSON.stringify(groupState);
    return {
        presetName,
        presetManager,
        groupState,
        syncKey: `${presetName}:${serialized}`,
    };
}

function applyPresetPromptGroupExtensionPayloadToMemory(payload) {
    if (!payload) {
        return;
    }

    if (oai_settings?.preset_settings_openai === payload.presetName) {
        oai_settings.extensions = oai_settings.extensions && typeof oai_settings.extensions === 'object'
            ? oai_settings.extensions
            : {};
        setObjectPath(oai_settings.extensions, PRESET_GROUP_EXTENSION_PATH, payload.groupState);
    }

    const preset = payload.presetManager?.getCompletionPresetByName?.(payload.presetName);

    if (preset) {
        preset.extensions = preset.extensions && typeof preset.extensions === 'object'
            ? preset.extensions
            : {};
        setObjectPath(preset.extensions, PRESET_GROUP_EXTENSION_PATH, payload.groupState);
    }
}

function syncCurrentPresetPromptGroupStateToPresetExtensionField({ force = false, persist = true, payload = null } = {}) {
    payload ||= getCurrentPresetPromptGroupExtensionPayload();

    if (!payload) {
        return false;
    }

    if (!force && persist && extensionState.presetPromptGroupExtensionSyncKey === payload.syncKey) {
        return false;
    }

    applyPresetPromptGroupExtensionPayloadToMemory(payload);

    if (!persist) {
        return true;
    }

    extensionState.presetPromptGroupExtensionSyncKey = payload.syncKey;

    if (!payload.presetManager) {
        return false;
    }

    void payload.presetManager.writePresetExtensionField({
        name: payload.presetName,
        path: PRESET_GROUP_EXTENSION_PATH,
        value: payload.groupState,
    }).catch(error => {
        if (extensionState.presetPromptGroupExtensionSyncKey === payload.syncKey) {
            delete extensionState.presetPromptGroupExtensionSyncKey;
        }
        console.debug(`${LOG_PREFIX} Failed to save preset prompt groups to preset extension field`, error);
    });
    return true;
}

async function flushCurrentPresetPromptGroupSettings({ force = false } = {}) {
    const payload = getCurrentPresetPromptGroupExtensionPayload();

    if (!payload) {
        return false;
    }

    if (!force && extensionState.presetPromptGroupExtensionSyncKey === payload.syncKey) {
        return false;
    }

    applyPresetPromptGroupExtensionPayloadToMemory(payload);
    extensionState.presetPromptGroupExtensionSyncKey = payload.syncKey;

    if (!payload.presetManager) {
        return false;
    }

    try {
        await payload.presetManager.writePresetExtensionField({
            name: payload.presetName,
            path: PRESET_GROUP_EXTENSION_PATH,
            value: payload.groupState,
        });
        return true;
    } catch (error) {
        if (extensionState.presetPromptGroupExtensionSyncKey === payload.syncKey) {
            delete extensionState.presetPromptGroupExtensionSyncKey;
        }
        throw error;
    }
}

function getSerializableCurrentPresetPromptGroupState(promptIds = getCurrentPresetPromptOrderIds()) {
    const groupState = getPresetPromptGroupState();
    const serializable = {
        version: 1,
        groups: structuredClone(groupState.groups ?? []),
        prompts: structuredClone(groupState.prompts ?? {}),
    };

    normalizePresetPromptGroupState(serializable, new Set(promptIds));
    return serializable;
}

async function startPresetVuePromptGroupRangeSelection(model, { startId = null } = {}) {
    const promptIds = getPresetVuePromptFlatIds(model);

    if (promptIds.length === 0) {
        toastr.warning(t`没有可用于分组的预设条目。`);
        return;
    }

    if (startId && !promptIds.includes(startId)) {
        toastr.warning(t`不能将这个预设条目作为分组起点。`);
        return;
    }

    const name = await callGenericPopup(t`预设分组名称`, POPUP_TYPE.INPUT, '', {
        okButton: t`保存`,
        cancelButton: t`取消`,
    });

    if (typeof name !== 'string') {
        return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        toastr.warning(t`分组名称不能为空。`);
        return;
    }

    model.rangeSelection = {
        active: true,
        name: trimmedName,
        startId,
        endId: null,
        hoverId: startId,
    };
    getPresetVuePromptListManagerState().dragSnapshot = null;
    toastr.info(startId ? t`请选择分组的结束条目。` : t`请选择分组的起始条目。`);
}

function cancelPresetVuePromptGroupRangeSelection(model) {
    if (!model) {
        return;
    }

    model.rangeSelection = {
        active: false,
        name: '',
        startId: null,
        endId: null,
        hoverId: null,
    };
}

function handlePresetVuePromptRangeSelectionClick(model, item, event) {
    if (!model?.rangeSelection?.active || item?.type !== 'prompt') {
        return;
    }

    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();

    if (!model.rangeSelection.startId) {
        model.rangeSelection.startId = item.id;
        model.rangeSelection.hoverId = item.id;
        toastr.info(t`请选择分组的结束条目。`);
        return;
    }

    if (model.rangeSelection.startId === item.id && !model.rangeSelection.endId) {
        model.rangeSelection.startId = null;
        model.rangeSelection.hoverId = null;
        toastr.info(t`已取消起点选择，请重新选择分组的起始条目。`);
        return;
    }

    model.rangeSelection.endId = item.id;
    void finishPresetVuePromptGroupRangeSelection(model);
}

function updatePresetVuePromptRangeSelectionHover(model, item) {
    if (!model?.rangeSelection?.active || !model.rangeSelection.startId || model.rangeSelection.endId || item?.type !== 'prompt') {
        return;
    }

    model.rangeSelection.hoverId = item.id;
}

async function finishPresetVuePromptGroupRangeSelection(model) {
    const rangeIds = getPresetVuePromptRangeIds(model);

    if (rangeIds.length === 0) {
        toastr.warning(t`没有选中可分组的预设条目。`);
        cancelPresetVuePromptGroupRangeSelection(model);
        return;
    }

    const confirmed = await callGenericPopup(t`要用选中的预设条目创建分组吗？`, POPUP_TYPE.CONFIRM);

    if (!confirmed) {
        model.rangeSelection.endId = null;
        return;
    }

    const groupState = getPresetPromptGroupState();
    normalizePresetPromptGroupState(groupState, new Set(getPresetVuePromptFlatIds(model)));
    const groupId = uuidv4();
    groupState.groups.push({
        id: groupId,
        name: model.rangeSelection.name,
        order: groupState.groups.length,
        collapsed: false,
    });

    for (const promptId of rangeIds) {
        groupState.prompts[promptId] = { groupId };
    }

    removeUnusedPresetPromptGroups(groupState);
    getPresetVuePromptListManagerState().dragSnapshot = null;
    cancelPresetVuePromptGroupRangeSelection(model);
    savePresetPromptGroupSettings();
    syncPresetVuePromptListManagerState();
}

function getPresetVuePromptFlatIds(model = getPresetVuePromptListManagerState().state) {
    const seenPromptIds = new Set();
    const promptIds = [];

    for (const item of getPresetVuePromptItemsFromModel(model)) {
        if (!item?.id || seenPromptIds.has(item.id)) {
            continue;
        }

        seenPromptIds.add(item.id);
        promptIds.push(item.id);
    }

    return promptIds;
}

function getPresetVuePromptItemsFromModel(model = getPresetVuePromptListManagerState().state) {
    const promptItems = [];

    for (const item of model?.items ?? []) {
        if (item?.type === 'prompt') {
            promptItems.push(item);
            continue;
        }

        if (item?.type === 'group') {
            promptItems.push(...(item.children ?? []).filter(child => child?.type === 'prompt'));
        }
    }

    return promptItems;
}

function sanitizePresetVuePromptListModel(model) {
    if (!Array.isArray(model?.items)) {
        return false;
    }

    const nextItems = [];
    const seenPromptIds = new Set();
    const seenStaticIds = new Set();
    const groupById = new Map();
    let changed = false;

    const pushPromptOnce = (promptItem, targetItems) => {
        if (!promptItem?.id || promptItem.type !== 'prompt') {
            changed = true;
            return;
        }

        if (seenPromptIds.has(promptItem.id)) {
            changed = true;
            return;
        }

        seenPromptIds.add(promptItem.id);
        targetItems.push(promptItem);
    };

    for (const item of model.items) {
        if (item?.type === 'header' || item?.type === 'separator') {
            if (seenStaticIds.has(item.type)) {
                changed = true;
                continue;
            }

            seenStaticIds.add(item.type);
            nextItems.push(item);
            continue;
        }

        if (item?.type === 'prompt') {
            pushPromptOnce(item, nextItems);
            continue;
        }

        if (item?.type === 'group') {
            const children = Array.isArray(item.children) ? [...item.children] : [];

            if (!item.groupId) {
                changed = true;
                continue;
            }

            let groupItem = groupById.get(item.groupId);

            if (!groupItem) {
                groupItem = item;
                groupItem.children = [];
                groupById.set(item.groupId, groupItem);
                nextItems.push(groupItem);
            } else {
                changed = true;
            }

            for (const child of children) {
                pushPromptOnce(child, groupItem.children);
            }

            groupItem.count = groupItem.children.length;
            continue;
        }

        changed = true;
    }

    if (!changed && nextItems.length === model.items.length) {
        return false;
    }

    model.items = nextItems;
    return true;
}

function getPresetVuePromptRangeIds(model, { includeHover = false } = {}) {
    const selection = model?.rangeSelection;
    const rangeEndId = selection?.endId || (includeHover ? selection?.hoverId : null);

    if (!selection?.startId || !rangeEndId) {
        return [];
    }

    const ids = getPresetVuePromptFlatIds(model);
    const startIndex = ids.indexOf(selection.startId);
    const endIndex = ids.indexOf(rangeEndId);

    if (startIndex < 0 || endIndex < 0) {
        return [];
    }

    const from = Math.min(startIndex, endIndex);
    const to = Math.max(startIndex, endIndex);
    return ids.slice(from, to + 1);
}

function getPresetVuePromptRangeClasses(model, item) {
    const selection = model?.rangeSelection;

    if (!selection?.active || item?.type !== 'prompt') {
        return [];
    }

    const classes = ['bai-bai-preset-range-selectable'];

    if (selection.startId === item.id) {
        classes.push('bai-bai-preset-range-start');
    }

    if ((selection.endId || selection.hoverId) === item.id && selection.startId) {
        classes.push('bai-bai-preset-range-end');
    }

    const rangeIds = getPresetVuePromptRangeIds(model, { includeHover: true });

    if (rangeIds.includes(item.id)) {
        classes.push('bai-bai-preset-range-inside');
    }

    return classes;
}

function togglePresetVuePromptGroupCollapsed(groupId) {
    const groupState = getPresetPromptGroupState();
    const group = groupState.groups.find(group => group.id === groupId);

    if (!group) {
        return;
    }

    group.collapsed = !group.collapsed;
    const modelGroup = getPresetVuePromptListManagerState().state?.items?.find(item => item?.type === 'group' && item.groupId === groupId);

    if (modelGroup) {
        modelGroup.collapsed = group.collapsed;

        if (modelGroup.group) {
            modelGroup.group.collapsed = group.collapsed;
        }
    }

    savePresetPromptGroupSettings();
}

function togglePresetVuePromptGroupEnabled(groupId) {
    const manager = getPresetVuePromptListManagerState();
    const groupItem = manager.state?.items?.find(item => item?.type === 'group' && item.groupId === groupId);
    const children = Array.isArray(groupItem?.children) ? groupItem.children : [];

    if (!children.length || !promptManager?.activeCharacter || typeof promptManager.getPromptOrderEntry !== 'function') {
        return;
    }

    const nextEnabled = !isPresetVuePromptGroupFullyEnabled(groupItem);
    const counts = promptManager.tokenHandler?.getCounts?.();

    for (const child of children) {
        if (!child?.id) {
            continue;
        }

        const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, child.id) ?? child.orderEntry;

        if (!promptOrderEntry) {
            continue;
        }

        promptOrderEntry.enabled = nextEnabled;
        child.enabled = nextEnabled;
        child.orderEntry = promptOrderEntry;

        if (counts) {
            counts[child.id] = null;
        }
    }

    void Promise.resolve(promptManager.saveServiceSettings?.()).catch(error => {
        console.debug(`${LOG_PREFIX} Failed to save preset prompt group toggle state`, error);
    });

    refreshPromptManagerTokensDebounced();
}

async function renamePresetVuePromptGroup(groupId) {
    const groupState = getPresetPromptGroupState();
    const group = groupState.groups.find(group => group.id === groupId);

    if (!group) {
        return;
    }

    const name = await callGenericPopup(t`预设分组名称`, POPUP_TYPE.INPUT, group.name || '', {
        okButton: t`保存`,
        cancelButton: t`取消`,
    });

    if (typeof name !== 'string') {
        return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        toastr.warning(t`分组名称不能为空。`);
        return;
    }

    group.name = trimmedName;
    savePresetPromptGroupSettings();
    syncPresetVuePromptListManagerState();
}

async function deletePresetVuePromptGroup(groupId) {
    const groupState = getPresetPromptGroupState();
    const group = groupState.groups.find(group => group.id === groupId);

    if (!group) {
        return;
    }

    const confirmed = await callGenericPopup(t`要删除这个预设分组吗？预设条目会保留在原位置。`, POPUP_TYPE.CONFIRM);

    if (!confirmed) {
        return;
    }

    groupState.groups = groupState.groups.filter(group => group.id !== groupId);

    for (const [promptId, meta] of Object.entries(groupState.prompts ?? {})) {
        if (meta?.groupId === groupId) {
            delete groupState.prompts[promptId];
        }
    }

    normalizePresetPromptGroupState(groupState, new Set(getPresetVuePromptFlatIds()));
    savePresetPromptGroupSettings();
    syncPresetVuePromptListManagerState();
}

function renderPresetVuePromptControls(h, prompt, item) {
    const canDelete = promptManager.isPromptDeletionAllowed?.(prompt) ?? false === prompt.system_prompt;
    const canEdit = promptManager.isPromptEditAllowed?.(prompt) ?? (FORCE_EDIT_PROMPTS.has(prompt.identifier) || !prompt.marker);
    const canToggle = promptManager.isPromptToggleAllowed?.(prompt) ?? (
        prompt.marker && !FORCE_TOGGLE_PROMPTS.has(prompt.identifier)
            ? false
            : !(promptManager.configuration.toggleDisabled ?? []).includes(prompt.identifier)
    );
    const isEnabled = item.enabled !== false && item.orderEntry?.enabled !== false;

    return [
        h('span', {
            title: t`更多操作`,
            class: 'menu_button bai-bai-preset-prompt-icon-button bai-bai-preset-prompt-actions-hint fa-solid fa-ellipsis',
            onClick: event => {
                event.preventDefault();
                event.stopPropagation();
                event.stopImmediatePropagation?.();
                togglePresetPromptActionMenu(event.currentTarget);
            },
        }),
        h('span', { class: 'bai-bai-preset-prompt-actions' }, [
            canEdit
                ? renderPresetVuePromptActionButton(h, {
                    action: 'edit',
                    icon: 'fa-pencil',
                    text: t`编辑`,
                    onClick: event => handlePresetPromptActionButtonClick(event),
                })
                : null,
            renderPresetVuePromptActionButton(h, {
                action: 'copy',
                icon: 'fa-copy',
                text: t`复制`,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
            canDelete
                ? renderPresetVuePromptActionButton(h, {
                    action: 'delete',
                    icon: 'fa-trash',
                    text: t`删除`,
                    caution: true,
                    onClick: event => handlePresetPromptActionButtonClick(event),
                })
                : null,
        ].filter(Boolean)),
        canToggle
            ? h('span', {
                title: isEnabled ? t`关闭条目` : t`开启条目`,
                class: [
                    'menu_button',
                    'bai-bai-preset-prompt-icon-button',
                    'prompt-manager-toggle-action',
                    isEnabled ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off',
                ],
            })
            : null,
    ];
}

function renderPresetVuePromptActionButton(h, { action, icon, text, caution = false, onClick = null }) {
    return h('span', {
        class: [
            'menu_button',
            'bai-bai-preset-prompt-action-button',
            'fa-solid',
            icon,
            caution ? 'caution' : '',
        ],
        title: text,
        'data-preset-prompt-action': action,
        onClick,
    });
}

function renderPresetPromptControlsHtml({ canDelete, canEdit, canToggle, isEnabled }) {
    const toggleSpanHtml = canToggle
        ? `<span title="${escapeHtml(isEnabled ? t`关闭条目` : t`开启条目`)}" class="menu_button bai-bai-preset-prompt-icon-button prompt-manager-toggle-action fa-solid ${isEnabled ? 'fa-toggle-on' : 'fa-toggle-off'}"></span>`
        : '';
    const editItemHtml = canEdit
        ? renderPresetPromptActionButtonHtml({
            action: 'edit',
            icon: 'fa-pencil',
            text: t`编辑`,
        })
        : '';
    const copyItemHtml = renderPresetPromptActionButtonHtml({
        action: 'copy',
        icon: 'fa-copy',
        text: t`复制`,
    });
    const deleteItemHtml = canDelete
        ? renderPresetPromptActionButtonHtml({
            action: 'delete',
            icon: 'fa-trash',
            text: t`删除`,
            caution: true,
        })
        : '';

    return `
        <span title="${escapeHtml(t`更多操作`)}" class="menu_button bai-bai-preset-prompt-icon-button bai-bai-preset-prompt-actions-hint fa-solid fa-ellipsis"></span>
        <span class="bai-bai-preset-prompt-actions">
            ${editItemHtml}
            ${copyItemHtml}
            ${deleteItemHtml}
        </span>
        ${toggleSpanHtml}
    `;
}

function renderPresetPromptActionButtonHtml({ action, icon, text, caution = false }) {
    return `<span title="${escapeHtml(text)}" data-preset-prompt-action="${escapeHtml(action)}" class="menu_button bai-bai-preset-prompt-action-button fa-solid ${icon}${caution ? ' caution' : ''}"></span>`;
}

function schedulePresetVuePromptOrderSaveAfterDrop() {
    const manager = getPresetVuePromptListManagerState();
    clearPresetVuePromptOrderSaveSchedule(manager);
    savePresetVuePromptOrderFromModelSafely();
}

function clearPresetVuePromptOrderSaveSchedule(manager = getPresetVuePromptListManagerState()) {
    if (manager.saveFrame !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(manager.saveFrame);
    }

    if (manager.saveTimer !== null) {
        clearTimeout(manager.saveTimer);
    }

    manager.saveFrame = null;
    manager.saveTimer = null;
}

async function flushScheduledPresetVuePromptOrderSave() {
    const manager = getPresetVuePromptListManagerState();
    const hasScheduledSave = manager.saveFrame !== null || manager.saveTimer !== null;

    if (!hasScheduledSave) {
        return false;
    }

    clearPresetVuePromptOrderSaveSchedule(manager);
    await savePresetVuePromptOrderFromModel();
    return true;
}

function getPendingPresetPromptServiceSaves(manager = getPresetVuePromptListManagerState()) {
    if (!(manager.pendingPresetPromptServiceSaves instanceof Map)) {
        manager.pendingPresetPromptServiceSaves = new Map();
    }

    return manager.pendingPresetPromptServiceSaves;
}

function getPendingPresetPromptGroupSaves(manager = getPresetVuePromptListManagerState()) {
    if (!(manager.pendingPresetPromptGroupSaves instanceof Map)) {
        manager.pendingPresetPromptGroupSaves = new Map();
    }

    return manager.pendingPresetPromptGroupSaves;
}

function markPresetPromptServiceSettingsSavePending() {
    const manager = getPresetVuePromptListManagerState();
    const entry = createPendingPresetPromptServiceSaveEntry();

    if (!entry) {
        return;
    }

    getPendingPresetPromptServiceSaves(manager).set(entry.presetName, entry);
    manager.pendingServiceSettingsSave = true;
    markPresetPromptChangesSavePending();
}

function createPendingPresetPromptServiceSaveEntry() {
    const presetName = getPresetPromptGroupRuntimePresetName();
    const promptOrder = promptManager?.serviceSettings?.prompt_order ?? oai_settings?.prompt_order;

    if (!presetName || !promptOrder) {
        return null;
    }

    return {
        presetName,
        promptOrder: structuredClone(promptOrder),
    };
}

function markPresetPromptGroupSettingsSavePending(payload = null) {
    const manager = getPresetVuePromptListManagerState();
    payload ||= getCurrentPresetPromptGroupExtensionPayload();

    if (!payload) {
        return;
    }

    getPendingPresetPromptGroupSaves(manager).set(payload.presetName, {
        presetName: payload.presetName,
        groupState: structuredClone(payload.groupState),
        syncKey: payload.syncKey,
    });
    manager.pendingGroupSettingsSave = true;
    markPresetPromptChangesSavePending();
}

function markPresetPromptChangesSavePending() {
    installPresetPendingChangesLifecycleGuard();
    schedulePendingPresetPromptChangesFlushCheck(0);
}

function hasPendingPresetPromptChanges() {
    const manager = getPresetVuePromptListManagerState();
    return Boolean(
        manager.pendingServiceSettingsSave
        || manager.pendingGroupSettingsSave
        || getPendingPresetPromptServiceSaves(manager).size > 0
        || getPendingPresetPromptGroupSaves(manager).size > 0,
    );
}

function clearPendingPresetPromptChanges() {
    const manager = getPresetVuePromptListManagerState();
    manager.pendingServiceSettingsSave = false;
    manager.pendingGroupSettingsSave = false;
    getPendingPresetPromptServiceSaves(manager).clear();
    getPendingPresetPromptGroupSaves(manager).clear();
    removePresetPromptManagerVisibilityWatch();
}

function installPresetPendingChangesLifecycleGuard() {
    if (extensionState[PRESET_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY]) {
        return;
    }

    const beforeUnloadHandler = (event) => {
        const manager = getPresetVuePromptListManagerState();

        if (!hasPendingPresetPromptChanges() && !manager.pendingChangesSaveInFlight && !manager.pendingChangesSavePromise) {
            return;
        }

        void flushPendingPresetPromptChanges().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to flush preset prompt changes before unload`, error);
        });
        event.preventDefault();
        event.returnValue = '';
        return '';
    };

    const pageLifecycleHandler = (event) => {
        if (event?.type === 'visibilitychange' && document.visibilityState !== 'hidden') {
            return;
        }

        if (!hasPendingPresetPromptChanges()) {
            return;
        }

        void flushPendingPresetPromptChanges().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to flush preset prompt changes during page lifecycle event`, error);
        });
    };

    extensionState[PRESET_PENDING_CHANGES_LIFECYCLE_HANDLER_KEY] = {
        beforeUnloadHandler,
        pageLifecycleHandler,
    };

    window.addEventListener('beforeunload', beforeUnloadHandler);
    window.addEventListener('pagehide', pageLifecycleHandler);
    document.addEventListener('visibilitychange', pageLifecycleHandler);
}

function schedulePendingPresetPromptChangesFlushCheck(delayMs = PRESET_PENDING_CHANGES_VISIBILITY_CHECK_DELAY_MS) {
    const manager = getPresetVuePromptListManagerState();
    installPresetPromptManagerVisibilityObserver();
    clearTimeout(manager.pendingVisibilityTimer);
    manager.pendingVisibilityTimer = setTimeout(() => {
        manager.pendingVisibilityTimer = null;
        checkPendingPresetPromptChangesFlush();
    }, delayMs);
}

function installPresetPromptManagerVisibilityObserver() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.pendingVisibilityObserver || typeof MutationObserver !== 'function') {
        return;
    }

    const observer = new MutationObserver(() => {
        schedulePendingPresetPromptChangesFlushCheck();
    });

    manager.pendingVisibilityObserver = observer;

    for (const target of getPresetPromptManagerVisibilityTargets()) {
        observer.observe(target, {
            attributes: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden'],
        });
    }
}

function removePresetPromptManagerVisibilityWatch() {
    const manager = getPresetVuePromptListManagerState();
    clearTimeout(manager.pendingVisibilityTimer);
    manager.pendingVisibilityTimer = null;

    if (manager.pendingVisibilityObserver) {
        manager.pendingVisibilityObserver.disconnect();
        manager.pendingVisibilityObserver = null;
    }
}

function getPresetPromptManagerVisibilityTargets() {
    const targets = [];
    const seen = new Set();
    const add = element => {
        if (element instanceof HTMLElement && !seen.has(element)) {
            seen.add(element);
            targets.push(element);
        }
    };
    const container = promptManager?.containerElement instanceof HTMLElement
        ? promptManager.containerElement
        : document.querySelector('#completion_prompt_manager');

    add(container);

    if (container instanceof HTMLElement) {
        for (let element = container.parentElement; element && element !== document.body; element = element.parentElement) {
            add(element);
        }
    }

    return targets;
}

function checkPendingPresetPromptChangesFlush() {
    if (!hasPendingPresetPromptChanges()) {
        removePresetPromptManagerVisibilityWatch();
        return;
    }

    if (!isPresetPromptManagerVisible()) {
        flushPendingPresetPromptChangesSafely();
        return;
    }

    schedulePendingPresetPromptChangesFlushCheck(PRESET_PENDING_CHANGES_VISIBILITY_FALLBACK_DELAY_MS);
}

function isPresetPromptManagerVisible() {
    const container = promptManager?.containerElement instanceof HTMLElement
        ? promptManager.containerElement
        : document.querySelector('#completion_prompt_manager');

    return isPresetVisibilityElementVisible(container);
}

function isPresetVisibilityElementVisible(element) {
    if (!(element instanceof HTMLElement) || !element.isConnected || element.getClientRects().length === 0) {
        return false;
    }

    const style = getComputedStyle(element);
    return style.display !== 'none' && style.visibility !== 'hidden';
}

function flushPendingPresetPromptChangesSafely() {
    void flushPendingPresetPromptChanges().catch(error => {
        console.debug(`${LOG_PREFIX} Failed to flush preset prompt changes`, error);
        toastr.error(t`Failed to save preset prompt changes. See console for details.`);
    });
}

async function flushPendingPresetPromptChanges() {
    const manager = getPresetVuePromptListManagerState();

    if (manager.pendingChangesSavePromise) {
        return manager.pendingChangesSavePromise;
    }

    await flushScheduledPresetVuePromptOrderSave();

    const pendingServiceSaves = Array.from(getPendingPresetPromptServiceSaves(manager).values());
    const pendingGroupSaves = Array.from(getPendingPresetPromptGroupSaves(manager).values());
    const shouldSaveServiceSettings = pendingServiceSaves.length > 0 || Boolean(manager.pendingServiceSettingsSave);
    const shouldSaveGroups = pendingGroupSaves.length > 0 || Boolean(manager.pendingGroupSettingsSave);

    if (!shouldSaveServiceSettings && !shouldSaveGroups) {
        removePresetPromptManagerVisibilityWatch();
        return;
    }

    manager.pendingChangesSaveInFlight = true;
    const savePromise = (async () => {
        try {
            manager.pendingServiceSettingsSave = false;
            manager.pendingGroupSettingsSave = false;
            manager.pendingPresetPromptServiceSaves = new Map();
            manager.pendingPresetPromptGroupSaves = new Map();

            for (const entry of pendingServiceSaves) {
                await flushPendingPresetPromptServiceSave(entry);
            }

            for (const entry of pendingGroupSaves) {
                await flushPendingPresetPromptGroupSave(entry);
            }
        } catch (error) {
            manager.pendingServiceSettingsSave = manager.pendingServiceSettingsSave || shouldSaveServiceSettings;
            manager.pendingGroupSettingsSave = manager.pendingGroupSettingsSave || shouldSaveGroups;

            for (const entry of pendingServiceSaves) {
                getPendingPresetPromptServiceSaves(manager).set(entry.presetName, entry);
            }

            for (const entry of pendingGroupSaves) {
                getPendingPresetPromptGroupSaves(manager).set(entry.presetName, entry);
            }

            throw error;
        } finally {
            manager.pendingChangesSaveInFlight = false;
        }
    })();

    manager.pendingChangesSavePromise = savePromise;

    try {
        await savePromise;
    } finally {
        if (manager.pendingChangesSavePromise === savePromise) {
            manager.pendingChangesSavePromise = null;
        }

        if (hasPendingPresetPromptChanges()) {
            schedulePendingPresetPromptChangesFlushCheck();
        } else {
            removePresetPromptManagerVisibilityWatch();
        }
    }
}

async function flushPendingPresetPromptServiceSave(entry) {
    if (!entry?.presetName || !entry.promptOrder) {
        return;
    }

    const presetManager = getPresetManager('openai');
    const preset = presetManager?.getCompletionPresetByName?.(entry.presetName);

    if (preset) {
        preset.prompt_order = structuredClone(entry.promptOrder);
        await presetManager.savePreset(entry.presetName, preset, { skipUpdate: true });
    }

    if (oai_settings?.preset_settings_openai === entry.presetName && typeof promptManager?.saveServiceSettings === 'function') {
        oai_settings.prompt_order = structuredClone(entry.promptOrder);
        promptManager.serviceSettings = oai_settings;
        await Promise.resolve(promptManager.saveServiceSettings());
    }
}

async function flushPendingPresetPromptGroupSave(entry) {
    if (!entry?.presetName || !entry.groupState) {
        return;
    }

    const presetManager = getPresetManager('openai');
    const payload = {
        presetName: entry.presetName,
        presetManager,
        groupState: structuredClone(entry.groupState),
        syncKey: entry.syncKey || `${entry.presetName}:${JSON.stringify(entry.groupState)}`,
    };

    applyPresetPromptGroupExtensionPayloadToMemory(payload);
    extensionState.presetPromptGroupExtensionSyncKey = payload.syncKey;

    if (!presetManager) {
        return;
    }

    try {
        await presetManager.writePresetExtensionField({
            name: payload.presetName,
            path: PRESET_GROUP_EXTENSION_PATH,
            value: payload.groupState,
        });
    } catch (error) {
        if (extensionState.presetPromptGroupExtensionSyncKey === payload.syncKey) {
            delete extensionState.presetPromptGroupExtensionSyncKey;
        }
        throw error;
    }
}

function savePresetVuePromptOrderFromModelSafely() {
    void savePresetVuePromptOrderFromModel().catch(error => {
        console.debug(`${LOG_PREFIX} Failed to save preset prompt order`, error);
        toastr.error(t`Failed to save preset prompt order. See console for details.`);
        syncPresetVuePromptListManagerState();
    });
}

async function savePresetVuePromptOrderFromModel() {
    if (!isPromptManagerReadyForCustomDrag()) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    if (!manager.state) {
        return;
    }

    sanitizePresetVuePromptListModel(manager.state);
    const promptOrder = promptManager.getPromptOrderForCharacter(promptManager.activeCharacter) ?? [];
    const beforeOrder = promptOrder.map(entry => entry?.identifier).filter(Boolean);
    const nextAssignments = getPresetVuePromptGroupAssignmentsFromModel(manager.state);
    const afterOrder = getPresetVuePromptFlatIds(manager.state);

    if (areStringArraysEqual(beforeOrder, afterOrder)) {
        savePresetVuePromptGroupAssignments(nextAssignments);
        syncPresetVuePromptListManagerState();
        return;
    }

    const idToObjectMap = new Map(promptOrder.filter(Boolean).map(entry => [entry.identifier, entry]));
    const updatedPromptOrder = afterOrder
        .map(identifier => idToObjectMap.get(identifier))
        .filter(Boolean);

    promptManager.removePromptOrderForCharacter(promptManager.activeCharacter);
    promptManager.addPromptOrderForCharacter(promptManager.activeCharacter, updatedPromptOrder);
    promptManager.log?.(`Prompt order updated for ${promptManager.activeCharacter?.name ?? 'OpenAI preset'}.`);
    savePresetVuePromptGroupAssignments(nextAssignments, { persist: false });
    markPresetPromptServiceSettingsSavePending();
    savePresetPromptGroupSettings();
    syncPresetVuePromptListManagerState();
}

function getPresetVuePromptGroupAssignmentsFromModel(model) {
    const assignments = {};

    for (const item of model?.items ?? []) {
        if (item?.type === 'group') {
            for (const child of item.children ?? []) {
                if (child?.type === 'prompt' && !Object.prototype.hasOwnProperty.call(assignments, child.id)) {
                    assignments[child.id] = item.groupId;
                }
            }
            continue;
        }

        if (item?.type === 'prompt' && !Object.prototype.hasOwnProperty.call(assignments, item.id)) {
            assignments[item.id] = null;
        }
    }

    return assignments;
}

function savePresetVuePromptGroupAssignments(assignments, { persist = true } = {}) {
    const groupState = getPresetPromptGroupState();
    const validPromptIds = new Set(getPresetVuePromptFlatIds());
    normalizePresetPromptGroupState(groupState, validPromptIds);
    const validGroupIds = new Set(groupState.groups.map(group => group.id));
    const nextPrompts = {};
    const usedGroupIds = new Set();

    for (const promptId of validPromptIds) {
        const groupId = assignments?.[promptId];

        if (!groupId || !validGroupIds.has(groupId)) {
            continue;
        }

        nextPrompts[promptId] = { groupId };
        usedGroupIds.add(groupId);
    }

    groupState.prompts = nextPrompts;
    groupState.groups = groupState.groups.filter(group => usedGroupIds.has(group.id));
    normalizePresetPromptGroupState(groupState, validPromptIds);

    if (persist) {
        savePresetPromptGroupSettings();
    }
}

function removeUnusedPresetPromptGroups(groupState) {
    const usedGroupIds = new Set(
        Object.values(groupState.prompts ?? {})
            .map(meta => meta?.groupId)
            .filter(Boolean),
    );

    groupState.groups = groupState.groups.filter(group => usedGroupIds.has(group.id));
}

function updatePresetVuePromptItemEnabled(promptId, enabled) {
    const manager = getPresetVuePromptListManagerState();
    const item = getPresetVuePromptItemsFromModel(manager.state).find(item => item?.id === promptId);

    if (!item) {
        return;
    }

    item.enabled = Boolean(enabled);

    if (item.orderEntry) {
        item.orderEntry.enabled = Boolean(enabled);
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
    markPresetPromptServiceSettingsSavePending();
}

function areStringArraysEqual(left, right) {
    return left.length === right.length && left.every((value, index) => value === right[index]);
}

function preventPresetDragEvent(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
}

function applyPresetSwitchOptimization() {
    applyPresetSelectChangeDeferral();
    applyPresetDeleteSelectionOptimization();
    applyPresetListActionDelegation();
    applyPresetGroupDeletedCleanup();
    applyPresetGroupImportCleanup();
    applyPresetSwitchBeforeOptimization();
    applyPresetModelChangeTokenRefreshOptimization();
    applyPresetChatLoadedTokenRefreshOptimization();

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

function applyPresetGroupDeletedCleanup() {
    if (extensionState[PRESET_GROUP_PRESET_DELETED_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        if (event?.apiId !== 'openai' || !event?.name) {
            return;
        }

        resetPresetPromptGroupRuntimeState(event.name);
    };

    extensionState[PRESET_GROUP_PRESET_DELETED_HANDLER_KEY] = handler;
    eventSource.on(event_types.PRESET_DELETED, handler);
}

function applyPresetGroupImportCleanup() {
    if (extensionState[PRESET_GROUP_PRESET_IMPORT_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        const presetName = event?.presetName;

        if (!presetName) {
            return;
        }

        collapseImportedPresetPromptGroups(event?.data);
        resetPresetPromptGroupRuntimeState(presetName);
    };

    extensionState[PRESET_GROUP_PRESET_IMPORT_HANDLER_KEY] = handler;
    eventSource.on(event_types.OAI_PRESET_IMPORT_READY, handler);
}

function collapseImportedPresetPromptGroups(presetData) {
    const groups = getObjectPath(presetData?.extensions, PRESET_GROUP_EXTENSION_PATH)?.groups;

    if (!Array.isArray(groups)) {
        return false;
    }

    for (const group of groups) {
        if (group && typeof group === 'object') {
            group.collapsed = true;
        }
    }

    return true;
}

function resetPresetPromptGroupRuntimeState(presetName = null) {
    if (presetName && extensionState.presetPromptGroupRuntimePresetName !== presetName) {
        return;
    }

    delete extensionState.presetPromptGroupRuntimePresetName;
    delete extensionState.presetPromptGroupRuntimeState;
}

function applyPresetModelChangeTokenRefreshOptimization() {
    if (extensionState[PRESET_MODEL_CHANGE_HANDLER_KEY]) {
        return;
    }

    const handler = () => {
        void handleChatCompletionModelChangedForPromptManager();
    };

    extensionState[PRESET_MODEL_CHANGE_HANDLER_KEY] = handler;

    if (typeof eventSource.makeFirst === 'function') {
        eventSource.makeFirst(event_types.CHATCOMPLETION_MODEL_CHANGED, handler);
    } else {
        eventSource.on(event_types.CHATCOMPLETION_MODEL_CHANGED, handler);
    }
}

function applyPresetChatLoadedTokenRefreshOptimization() {
    if (extensionState[PRESET_CHAT_LOADED_HANDLER_KEY]) {
        return;
    }

    const handler = () => {
        void handleChatLoadedForPromptManager();
    };

    extensionState[PRESET_CHAT_LOADED_HANDLER_KEY] = handler;

    if (typeof eventSource.makeFirst === 'function') {
        eventSource.makeFirst(event_types.CHAT_LOADED, handler);
    } else {
        eventSource.on(event_types.CHAT_LOADED, handler);
    }
}

async function handleChatCompletionModelChangedForPromptManager() {
    if (!settings.presetSwitchOptimizationEnabled || !isPromptManagerReadyForFastPresetSwitch()) {
        return;
    }

    try {
        suppressPromptManagerDebouncedRender();
        await renderPromptManagerListWithoutTokenStats();
        markPromptManagerTokensPending();
        refreshPromptManagerTokensAfterPresetSwitchDebounced();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to fast-refresh prompt manager after model change`, error);
    }
}

async function handleChatLoadedForPromptManager() {
    if (!settings.presetSwitchOptimizationEnabled || !isPromptManagerReadyForFastPresetSwitch()) {
        return;
    }

    try {
        suppressPromptManagerDebouncedRender(PRESET_CHAT_LOAD_RENDER_SUPPRESS_MS);
        setTimeout(() => {
            void fastRefreshPromptManagerTokensAfterContextChange('chat load');
        }, 0);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to schedule fast prompt manager refresh after chat load`, error);
    }
}

async function fastRefreshPromptManagerTokensAfterContextChange(reason) {
    try {
        if (!isPromptManagerReadyForFastPresetSwitch()) {
            return;
        }

        await renderPromptManagerListWithoutTokenStats();
        markPromptManagerTokensPending();
        refreshPromptManagerTokensAfterPresetSwitchDebounced();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to fast-refresh prompt manager after ${reason}`, error);
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

    clearPendingPresetPromptChanges();

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
    if (!settings.presetSwitchOptimizationEnabled && !isPresetGroupingEnabled()) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
        closePresetPromptActionMenus();
        return;
    }

    const menuButton = target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-hint`);

    if (menuButton instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        togglePresetPromptActionMenu(menuButton);
        return;
    }

    if (!target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions, ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-hint`)) {
        closePresetPromptActionMenus();
    }

    if (!target.closest(PRESET_PROMPT_MANAGER_LIST_SELECTOR)) {
        return;
    }

    if (handlePresetVuePromptRangeSelectionDelegatedClick(event, target)) {
        return;
    }

    const action = target.closest('[data-preset-prompt-action], .prompt-manager-detach-action, .prompt-manager-inspect-action, .prompt-manager-edit-action');

    if (!action) {
        return;
    }

    handlePresetPromptActionButtonClick(event, action);
}

function handlePresetPromptActionButtonClick(event, action = null) {
    action ||= event?.currentTarget instanceof Element ? event.currentTarget : null;

    if (!(action instanceof Element)) {
        return;
    }

    const presetAction = action.getAttribute('data-preset-prompt-action');

    if (presetAction === 'copy') {
        event.preventDefault?.();
        event.stopPropagation?.();
        event.stopImmediatePropagation?.();
        closePresetPromptActionMenus();
        void copyPresetPromptEntryFromAction(action);
        return;
    }

    const handler = presetAction === 'delete' || action.classList.contains('prompt-manager-detach-action')
        ? promptManager?.handleDetach
        : presetAction === 'inspect' || action.classList.contains('prompt-manager-inspect-action')
            ? promptManager?.handleInspect
            : promptManager?.handleEdit;

    if (typeof handler !== 'function') {
        return;
    }

    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    closePresetPromptActionMenus();

    try {
        handler.call(promptManager, event);
        schedulePresetPromptCodeMirrorEditorRefresh(undefined, { forceFromSource: true });
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to handle prompt manager list action`, error);
    }
}

function togglePresetPromptActionMenu(button) {
    const wrapper = button.closest('.prompt_manager_prompt_controls');

    if (!(wrapper instanceof HTMLElement)) {
        return;
    }

    const actions = wrapper.querySelector('.bai-bai-preset-prompt-actions');

    if (!(actions instanceof HTMLElement)) {
        return;
    }

    const wasOpen = actions.classList.contains('bai-bai-preset-prompt-actions-visible');
    closePresetPromptActionMenus({ except: wrapper });
    actions.classList.toggle('bai-bai-preset-prompt-actions-visible', !wasOpen);
    wrapper.querySelector('.bai-bai-preset-prompt-actions-hint')?.classList.toggle('bai-bai-preset-prompt-actions-hint-hidden', !wasOpen);
}

function closePresetPromptActionMenus({ except = null } = {}) {
    document.querySelectorAll(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-visible`).forEach(actions => {
        const wrapper = actions.closest('.prompt_manager_prompt_controls');

        if (wrapper === except) {
            return;
        }

        actions.classList.remove('bai-bai-preset-prompt-actions-visible');
        wrapper?.querySelector('.bai-bai-preset-prompt-actions-hint')?.classList.remove('bai-bai-preset-prompt-actions-hint-hidden');
    });
}

async function copyPresetPromptEntryFromAction(action) {
    const row = action.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt[data-pm-identifier]`);
    const promptId = row?.dataset?.pmIdentifier;

    if (!promptId) {
        return;
    }

    await copyPresetPromptEntry(promptId);
}

async function copyPresetPromptEntry(promptId) {
    if (!promptManager?.activeCharacter || !Array.isArray(promptManager.serviceSettings?.prompts)) {
        toastr.warning(t`当前无法复制这个预设条目。`);
        return false;
    }

    const sourcePrompt = promptManager.getPromptById?.(promptId);
    const promptOrder = promptManager.getPromptOrderForCharacter?.(promptManager.activeCharacter);

    if (!sourcePrompt || !Array.isArray(promptOrder)) {
        toastr.warning(t`没有找到要复制的预设条目。`);
        return false;
    }

    const sourceOrderIndex = promptOrder.findIndex(entry => entry?.identifier === promptId);

    if (sourceOrderIndex < 0) {
        toastr.warning(t`这个预设条目不在当前列表中。`);
        return false;
    }

    const copyId = createUniquePresetPromptIdentifier();
    const sourcePromptIndex = promptManager.serviceSettings.prompts.findIndex(prompt => prompt?.identifier === promptId);
    const promptCopy = structuredClone(sourcePrompt);
    const sourceOrderEntry = promptOrder[sourceOrderIndex] ?? {};
    const orderCopy = {
        ...structuredClone(sourceOrderEntry),
        identifier: copyId,
        enabled: sourceOrderEntry.enabled !== false,
    };

    promptCopy.identifier = copyId;
    promptCopy.name = createPresetPromptCopyName(sourcePrompt.name);

    if (sourcePromptIndex >= 0) {
        promptManager.serviceSettings.prompts.splice(sourcePromptIndex + 1, 0, promptCopy);
    } else {
        promptManager.serviceSettings.prompts.push(promptCopy);
    }

    promptOrder.splice(sourceOrderIndex + 1, 0, orderCopy);
    copyPresetPromptGroupAssignment(promptId, copyId);

    const counts = promptManager.tokenHandler?.getCounts?.();

    if (counts) {
        counts[copyId] = null;
    }

    promptManager.log?.(`Copied prompt: ${promptId} -> ${copyId}.`);
    refreshPresetPromptListAfterCopy();

    try {
        await Promise.resolve(promptManager.saveServiceSettings?.());
        saveOpenAiPresetAfterPromptEdit();
        toastr.success(t`已复制预设条目。`);
        refreshPromptManagerTokensDebounced();
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to save copied preset prompt`, error);
        toastr.error(t`复制预设条目后保存失败。`);
        return false;
    }
}

function createUniquePresetPromptIdentifier() {
    let identifier = uuidv4();

    while (promptManager?.getPromptById?.(identifier)) {
        identifier = uuidv4();
    }

    return identifier;
}

function createPresetPromptCopyName(name) {
    const sourceName = String(name || t`未命名条目`);
    const baseName = `${sourceName} 副本`;
    const existingNames = new Set(
        (promptManager?.serviceSettings?.prompts ?? [])
            .map(prompt => prompt?.name)
            .filter(name => typeof name === 'string'),
    );

    if (!existingNames.has(baseName)) {
        return baseName;
    }

    for (let index = 2; index < 1000; index++) {
        const candidate = `${baseName} ${index}`;

        if (!existingNames.has(candidate)) {
            return candidate;
        }
    }

    return `${baseName} ${Date.now()}`;
}

function copyPresetPromptGroupAssignment(sourcePromptId, copiedPromptId) {
    if (!isPresetGroupingEnabled()) {
        return false;
    }

    const groupState = getPresetPromptGroupState();
    const groupId = groupState.prompts?.[sourcePromptId]?.groupId;

    if (!groupId) {
        return false;
    }

    groupState.prompts[copiedPromptId] = { groupId };
    normalizePresetPromptGroupState(groupState, new Set(getCurrentPresetPromptOrderIds()));
    savePresetPromptGroupSettings();
    return true;
}

function refreshPresetPromptListAfterCopy() {
    if (isPresetVuePromptListManagerActive()) {
        syncPresetVuePromptListManagerState();
        preparePromptManagerCustomDragList(getPromptManagerListElement());
        return;
    }

    if (settings.presetSwitchOptimizationEnabled && isPromptManagerReadyForFastPresetSwitch()) {
        void renderPromptManagerListWithoutTokenStats();
        return;
    }

    promptManager?.render?.();
}

async function handleOpenAiPresetChangedBefore(event) {
    extensionState.openAiPresetSwitchEarlyRendered = false;

    try {
        await flushPendingPresetPromptChanges();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to save preset prompt changes before preset switch`, error);
        toastr.error(t`Failed to save preset prompt changes. See console for details.`);
    }
    resetPresetPromptGroupRuntimeState();

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
        if (isPresetGroupingEnabled()) {
            syncPresetVuePromptListManagerState();
        }
        return;
    }

    try {
        if (!extensionState.openAiPresetSwitchEarlyRendered) {
            await renderPromptManagerListWithoutTokenStats();
            markPromptManagerTokensPending();
        }

        suppressPromptManagerDebouncedRender();
        if (isPresetGroupingEnabled()) {
            syncPresetVuePromptListManagerState();
        }
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

    oai_settings.extensions = preset.extensions && typeof preset.extensions === 'object'
        ? structuredClone(preset.extensions)
        : {};

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
    if (isPresetGroupingEnabled()) {
        await installPresetVuePromptListManager();

        if (syncPresetVuePromptListManagerState()) {
            preparePromptManagerCustomDragList(getPromptManagerListElement());
            return;
        }
    }

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
        const controlsHtml = renderPresetPromptControlsHtml({
            canDelete,
            canEdit,
            canToggle,
            isEnabled: listEntry?.enabled !== false,
        });

        listItemHtml += renderPromptManagerListRow({
            prefix,
            prompt,
            enabledClass,
            draggableClass,
            markerClass,
            importantClass: getPromptImportantClass(prompt, prefix),
            controlsHtml,
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
    controlsHtml,
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
                    ${controlsHtml}
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

function suppressPromptManagerDebouncedRender(restoreDelayMs = 0) {
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
    }, Math.max(0, Number(restoreDelayMs) || 0));
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
    updatePresetVuePromptItemEnabled(promptId, promptOrderEntry.enabled);
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

    if (extensionState.promptManagerCustomDragState || isPresetVuePromptListDragging()) {
        extensionState.promptManagerTokenRefreshPendingAfterDrag = true;
        return;
    }

    let refreshedWithBulkCount = false;

    if (settings.tokenizerBulkCountEnabled !== false) {
        try {
            refreshedWithBulkCount = await refreshPromptManagerTokensWithBaibaokuBulkCount();
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to refresh prompt manager token counts with BaiBaoKu bulk count`, error);
        }
    }

    try {
        if (!refreshedWithBulkCount) {
            await promptManager.tryGenerate();
        }

        updatePromptManagerTokenDisplay();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to refresh prompt manager token counts`, error);
    }
}

function handlePresetVuePromptRangeSelectionDelegatedClick(event, target) {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;

    if (!model?.rangeSelection?.active) {
        return false;
    }

    const row = target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt[data-pm-identifier]`);

    if (!(row instanceof HTMLElement)) {
        return false;
    }

    const item = getPresetVuePromptItemsFromModel(model).find(item => item?.id === row.dataset.pmIdentifier);

    if (!item) {
        return false;
    }

    handlePresetVuePromptRangeSelectionClick(model, item, event);
    return true;
}

async function refreshPromptManagerTokensWithBaibaokuBulkCount() {
    if (!promptManager?.tokenHandler || typeof promptManager.getPromptCollection !== 'function') {
        return false;
    }

    const tokenHandler = promptManager.tokenHandler;
    if (typeof tokenHandler.resetCounts !== 'function' || typeof tokenHandler.getCounts !== 'function') {
        return false;
    }

    const promptCollection = promptManager.getPromptCollection('normal');
    const prompts = Array.isArray(promptCollection?.collection) ? promptCollection.collection : [];
    const entries = prompts
        .filter(prompt => prompt?.identifier && typeof prompt.content === 'string' && prompt.content.length > 0)
        .map(prompt => ({
            identifier: prompt.identifier,
            message: {
                role: prompt.role || 'system',
                content: prompt.content,
            },
        }));

    if (entries.length === 0) {
        applyPromptManagerTokenCounts([]);
        return true;
    }

    const model = getTokenizerModel();
    const headers = new Headers(getRequestHeaders());
    headers.set('content-type', 'application/json');

    const response = await fetch(BAIBAOKU_TOKENIZER_BULK_COUNT_URL, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
            model,
            messages: entries.map(entry => entry.message),
        }),
    });
    const payload = await response.json().catch(() => null);
    const rawCounts = payload?.data?.counts;

    if (!response.ok || payload?.ok !== true || !Array.isArray(rawCounts) || rawCounts.length !== entries.length) {
        throw new Error(payload?.error?.message || `BaiBaoKu bulk count failed: HTTP ${response.status}`);
    }

    applyPromptManagerTokenCounts(entries.map((entry, index) => ({
        identifier: entry.identifier,
        tokens: normalizeBulkSingleMessageCount(rawCounts[index], model),
    })));

    return true;
}

function applyPromptManagerTokenCounts(entries) {
    const tokenHandler = promptManager.tokenHandler;
    tokenHandler.resetCounts();

    const counts = tokenHandler.getCounts();
    for (const prompt of promptManager.serviceSettings?.prompts || []) {
        if (prompt?.identifier) {
            counts[prompt.identifier] = 0;
        }
    }

    for (const entry of entries) {
        counts[entry.identifier] = entry.tokens;
    }

    promptManager.tokenUsage = typeof tokenHandler.getTotal === 'function' ? tokenHandler.getTotal() : 0;
}

function normalizeBulkSingleMessageCount(rawCount, model) {
    const count = Number(rawCount);
    if (!Number.isFinite(count)) {
        return 0;
    }

    const adjustment = model === 'claude' ? 1 : 3;
    return Math.max(0, count - adjustment);
}

function getOpenAITokenizerBulkState() {
    if (!extensionState.openAITokenizerBulkBridge || typeof extensionState.openAITokenizerBulkBridge !== 'object') {
        extensionState.openAITokenizerBulkBridge = {};
    }

    const state = extensionState.openAITokenizerBulkBridge;
    if (!(state.cache instanceof Map)) {
        state.cache = new Map();
    }
    if (!state.stats || typeof state.stats !== 'object') {
        state.stats = {
            prepareCalls: 0,
            prepareMessages: 0,
            prepareEmpty: 0,
            prepareErrors: 0,
            ajaxHits: 0,
            ajaxMisses: 0,
            ajaxFallbacks: 0,
            ajaxErrors: 0,
        };
    }

    return state;
}

function installOpenAITokenizerBulkAjaxPatch() {
    const state = getOpenAITokenizerBulkState();
    if (state.ajaxPatched) {
        return;
    }

    const jq = globalThis.jQuery;
    if (!jq || typeof jq.ajax !== 'function') {
        console.debug(`${LOG_PREFIX} jQuery.ajax unavailable; OpenAI tokenizer bulk bridge was not installed`);
        return;
    }

    const originalAjax = jq.ajax;
    state.originalAjax = originalAjax;
    jq.ajax = function baiBaiOpenAITokenizerBulkAjax(...args) {
        const request = normalizeJQueryAjaxRequest(args);
        if (!request || !shouldInterceptOpenAITokenizerCount(request.options)) {
            return originalAjax.apply(this, args);
        }

        const intercepted = handleOpenAITokenizerBulkAjax(this, args, request.options);
        return intercepted || originalAjax.apply(this, args);
    };

    state.ajaxPatched = true;
}

function normalizeJQueryAjaxRequest(args) {
    const first = args[0];
    if (typeof first === 'string') {
        return {
            options: {
                ...(args[1] && typeof args[1] === 'object' ? args[1] : {}),
                url: first,
            },
        };
    }

    if (first && typeof first === 'object') {
        return { options: first };
    }

    return null;
}

function shouldInterceptOpenAITokenizerCount(options) {
    if (!isOpenAITokenizerBulkEnabled() || options?.async === false) {
        return false;
    }

    const method = String(options?.method || options?.type || 'GET').toUpperCase();
    if (method !== 'POST') {
        return false;
    }

    const url = toOpenAITokenizerUrl(options?.url);
    return Boolean(url && url.origin === location.origin && url.pathname === '/api/tokenizers/openai/count');
}

function handleOpenAITokenizerBulkAjax(thisArg, args, options) {
    const hitPromise = getOpenAITokenizerBulkAjaxHit(options);
    if (!hitPromise) {
        return null;
    }

    const state = getOpenAITokenizerBulkState();
    return hitPromise
        .then(hit => {
            if (!hit) {
                state.stats.ajaxFallbacks += 1;
                return state.originalAjax.apply(thisArg, args);
            }

            state.stats.ajaxHits += 1;
            const payload = { token_count: hit.count };
            callJQueryAjaxCallback(options.success, payload, 'success', null);
            callJQueryAjaxCallback(options.complete, null, 'success');
            return payload;
        })
        .catch(error => {
            state.stats.ajaxErrors += 1;
            console.debug(`${LOG_PREFIX} OpenAI tokenizer bulk ajax fallback`, error);
            return state.originalAjax.apply(thisArg, args);
        });
}

function getOpenAITokenizerBulkAjaxHit(options) {
    const state = getOpenAITokenizerBulkState();
    const url = toOpenAITokenizerUrl(options?.url);
    const message = getOpenAITokenizerAjaxMessage(options);
    const model = url?.searchParams?.get('model') || getTokenizerModel();

    if (!message || !model) {
        state.stats.ajaxMisses += 1;
        return null;
    }

    const key = getOpenAITokenizerCacheKey(model, message);
    const cached = state.cache.get(key);
    if (typeof cached === 'number') {
        return Promise.resolve({ count: cached });
    }

    if (!state.pending) {
        state.stats.ajaxMisses += 1;
        return null;
    }

    return Promise.resolve(state.pending).then(() => {
        const next = state.cache.get(key);
        if (typeof next === 'number') {
            return { count: next };
        }

        state.stats.ajaxMisses += 1;
        return null;
    });
}

function getOpenAITokenizerAjaxMessage(options) {
    try {
        const data = typeof options?.data === 'string' ? JSON.parse(options.data) : options?.data;
        if (!Array.isArray(data) || data.length !== 1) {
            return null;
        }

        return normalizeOpenAITokenizerMessage(data[0], { allowEmptyContent: true });
    } catch {
        return null;
    }
}

async function prepareOpenAITokenizerBulkMessages(context = {}) {
    const state = getOpenAITokenizerBulkState();
    state.stats.prepareCalls += 1;

    if (!isOpenAITokenizerBulkEnabled()) {
        return false;
    }

    const model = getTokenizerModel();
    const messages = collectOpenAITokenizerBulkMessages(context);
    const uniqueMessages = [];
    const seen = new Set();

    for (const message of messages) {
        const key = getOpenAITokenizerCacheKey(model, message);
        if (seen.has(key) || state.cache.has(key)) {
            continue;
        }

        seen.add(key);
        uniqueMessages.push({ key, message });
    }

    if (uniqueMessages.length === 0) {
        state.stats.prepareEmpty += 1;
        return true;
    }

    const pending = fetchOpenAITokenizerBulkCounts(model, uniqueMessages)
        .then(counts => {
            counts.forEach((count, index) => {
                setOpenAITokenizerBulkCache(uniqueMessages[index].key, count);
            });
            state.stats.prepareMessages += uniqueMessages.length;
            return true;
        })
        .catch(error => {
            state.stats.prepareErrors += 1;
            throw error;
        })
        .finally(() => {
            if (state.pending === pending) {
                state.pending = null;
            }
        });

    state.pending = pending;
    return pending;
}

function collectOpenAITokenizerBulkMessages(context) {
    const entries = [];
    const add = (message, options = {}) => {
        const normalized = normalizeOpenAITokenizerMessage(message, options);
        if (normalized) {
            entries.push(normalized);
        }
    };

    add({ role: 'system', content: context.newChatContent });
    add({ role: 'user', content: context.sendIfEmpty });
    add({ role: 'system', content: context.newExampleChatContent });

    collectPromptCollectionTokenMessages(context.prompts, add);
    collectChatHistoryTokenMessages(context, add);
    collectDialogueExampleTokenMessages(context.messageExamples, add);

    return entries;
}

function collectPromptCollectionTokenMessages(prompts, add) {
    const collection = Array.isArray(prompts?.collection) ? prompts.collection : [];
    for (const prompt of collection) {
        add({
            role: prompt?.role || 'system',
            content: prompt?.content,
        });
    }
}

function collectChatHistoryTokenMessages(context, add) {
    const sourceMessages = Array.isArray(context.messages) ? context.messages : [];
    const namesInCompletion = Number(context.oaiSettings?.names_behavior) === 1;
    const manager = context.promptManager || promptManager;

    for (let index = 0; index < sourceMessages.length; index++) {
        const source = sourceMessages[index];
        if (!source || typeof source !== 'object') {
            continue;
        }

        const prompt = {
            ...source,
            identifier: `chatHistory-${sourceMessages.length - index}`,
        };
        const prepared = preparePromptForOpenAITokenizerBulk(prompt, manager);
        const message = {
            role: prepared?.role || source.role || 'system',
            content: prepared?.content ?? source.content,
        };

        add(message);

        if (namesInCompletion && source.name) {
            const name = typeof manager?.isValidName === 'function' && manager.isValidName(source.name)
                ? source.name
                : typeof manager?.sanitizeName === 'function'
                    ? manager.sanitizeName(source.name)
                    : source.name;
            add({ ...message, name });
        }

        if (Array.isArray(source.invocations)) {
            for (const invocation of source.invocations) {
                add({ role: 'tool', content: invocation?.result || '[No content]' });
            }
        }
    }
}

function collectDialogueExampleTokenMessages(messageExamples, add) {
    if (!Array.isArray(messageExamples)) {
        return;
    }

    for (const dialogue of messageExamples) {
        if (!Array.isArray(dialogue)) {
            continue;
        }

        for (const prompt of dialogue) {
            const message = {
                role: 'system',
                content: prompt?.content || '',
            };
            add(message);
            if (prompt?.name) {
                add({ ...message, name: prompt.name });
            }
        }
    }
}

function preparePromptForOpenAITokenizerBulk(prompt, manager) {
    try {
        if (typeof manager?.preparePrompt === 'function') {
            return manager.preparePrompt(prompt);
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to prepare OpenAI tokenizer bulk prompt`, error);
    }

    return prompt;
}

function normalizeOpenAITokenizerMessage(message, { allowEmptyContent = false } = {}) {
    if (!message || typeof message !== 'object') {
        return null;
    }

    const normalized = {};
    normalized.role = message.role || 'system';

    if (Object.prototype.hasOwnProperty.call(message, 'content') && message.content !== undefined) {
        normalized.content = message.content;
    }
    if (message.name !== undefined && message.name !== null && message.name !== '') {
        normalized.name = message.name;
    }
    if (message.tool_calls !== undefined) {
        normalized.tool_calls = message.tool_calls;
    }
    if (message.reasoning !== undefined && message.reasoning !== null && message.reasoning !== '') {
        normalized.reasoning = message.reasoning;
    }

    const hasContent = Object.prototype.hasOwnProperty.call(normalized, 'content');
    const hasToolCalls = Object.prototype.hasOwnProperty.call(normalized, 'tool_calls');
    if (!hasContent && !hasToolCalls) {
        return null;
    }

    if (!allowEmptyContent && typeof normalized.content === 'string' && normalized.content.length === 0 && !hasToolCalls && !normalized.name) {
        return null;
    }

    return normalized;
}

async function fetchOpenAITokenizerBulkCounts(model, entries) {
    const headers = new Headers(getRequestHeaders());
    headers.set('content-type', 'application/json');

    const response = await fetch(BAIBAOKU_TOKENIZER_BULK_COUNT_URL, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify({
            model,
            messages: entries.map(entry => entry.message),
        }),
    });
    const payload = await response.json().catch(() => null);
    const counts = payload?.data?.counts;

    if (!response.ok || payload?.ok !== true || !Array.isArray(counts) || counts.length !== entries.length) {
        throw new Error(payload?.error?.message || `BaiBaoKu bulk count failed: HTTP ${response.status}`);
    }

    return counts.map(count => Number(count));
}

function setOpenAITokenizerBulkCache(key, count) {
    const value = Number(count);
    if (!key || !Number.isFinite(value)) {
        return;
    }

    const state = getOpenAITokenizerBulkState();
    state.cache.set(key, value);
    while (state.cache.size > OPENAI_TOKENIZER_BULK_CACHE_LIMIT) {
        const oldestKey = state.cache.keys().next().value;
        state.cache.delete(oldestKey);
    }
}

function getOpenAITokenizerCacheKey(model, message) {
    return `${model}-${getStringHash(JSON.stringify(message))}`;
}

function isOpenAITokenizerBulkEnabled() {
    if (settings.tokenizerBulkCountEnabled === false) {
        return false;
    }

    const earlyBridge = globalThis.__baibaokuEarlyBridge;
    if (typeof earlyBridge?.isTokenizerBulkCountEnabled === 'function') {
        return earlyBridge.isTokenizerBulkCountEnabled() !== false;
    }

    return earlyBridge?.tokenizerBulkCountEnabled !== false;
}

function toOpenAITokenizerUrl(value) {
    try {
        if (typeof value === 'string') return new URL(value, location.href);
        if (value instanceof URL) return new URL(value.href, location.href);
        if (value && typeof value.url === 'string') return new URL(value.url, location.href);
    } catch {
        return null;
    }

    return null;
}

function callJQueryAjaxCallback(callback, ...args) {
    if (typeof callback !== 'function') {
        return;
    }

    try {
        callback(...args);
    } catch (error) {
        console.debug(`${LOG_PREFIX} OpenAI tokenizer bulk ajax callback failed`, error);
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
            || target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} [data-preset-prompt-action], ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-edit-action, ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-inspect-action, ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-detach-action`)
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

    void loadPresetCodeMirrorModules()
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
    const useHistory = source.value.length <= getPresetCodeMirrorHistoryMaxLength();
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
                textAlign: 'left',
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
                minHeight: 'min(34vh, 360px)',
            },
            '.cm-line': {
                padding: '0',
                textAlign: 'left',
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

#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID},
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID} .cm-editor,
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID} .cm-scroller,
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID} .cm-content,
#${PRESET_PROMPT_CODEMIRROR_EDITOR_ID} .cm-line {
    text-align: left !important;
}

.${PRESET_PROMPT_SOURCE_HIDDEN_CLASS} {
    display: none !important;
}
`;
}

function removePresetPromptCodeMirrorEditorStyle() {
    document.getElementById(PRESET_PROMPT_CODEMIRROR_EDITOR_STYLE_ID)?.remove();
}

export {
    applyPresetDragOptimization,
    applyPresetGrouping,
    applyPresetPromptCodeMirrorEditorOptimization,
    applyPresetSaveOptimization,
    applyPresetScrollOptimization,
    applyPresetSwitchOptimization,
    applyPresetToggleOptimization,
    cancelPromptManagerCustomDragPending,
    finishPromptManagerCustomDrag,
};
