import { event_types, eventSource, getRequestHeaders, saveSettingsDebounced } from '../../../../script.js';
import { oai_settings, openai_setting_names, promptManager } from '../../../openai.js';
import { getTokenizerModel } from '../../../tokenizers.js';
import { t } from '../../../i18n.js';
import { callGenericPopup, POPUP_TYPE } from '../../../popup.js';
import { INJECTION_POSITION } from '../../../PromptManager.js';
import { isMobile } from '../../../RossAscends-mods.js';
import { renderTemplateAsync } from '../../../templates.js';
import { debounce, escapeHtml, getStringHash } from '../../../utils.js';

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
const PRESET_SELECT_CHANGE_HANDLER_KEY = '__baiBaiToolkitPresetSelectChangeHandler';
const PRESET_DELETE_HANDLER_KEY = '__baiBaiToolkitPresetDeleteHandler';
const PRESET_LIST_ACTION_HANDLER_KEY = '__baiBaiToolkitPresetListActionHandler';
const PRESET_TOGGLE_HANDLER_KEY = '__baiBaiToolkitPresetToggleHandler';
const PRESET_SAVE_HANDLER_KEY = '__baiBaiToolkitPresetSaveHandler';
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
const PRESET_DRAG_INTERACTIVE_SELECTOR = '.prompt_manager_prompt_controls, .prompt-manager-detach-action, .prompt-manager-inspect-action, .prompt-manager-edit-action, .prompt-manager-toggle-action, a, button, input, select, textarea, [contenteditable="true"]';
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

export function configurePresetOptimizations(context = {}) {
    settings = context.settings ?? settings;
    extensionState = context.extensionState ?? extensionState;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    loadCodeMirrorModules = context.loadCodeMirrorModules ?? loadCodeMirrorModules;
    codeMirrorHistoryMaxLength = context.codeMirrorHistoryMaxLength ?? codeMirrorHistoryMaxLength;
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

function applyPresetSwitchOptimization() {
    applyPresetSelectChangeDeferral();
    applyPresetDeleteSelectionOptimization();
    applyPresetListActionDelegation();
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

        suppressPromptManagerDebouncedRender();
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
    applyPresetPromptCodeMirrorEditorOptimization,
    applyPresetSaveOptimization,
    applyPresetScrollOptimization,
    applyPresetSwitchOptimization,
    applyPresetToggleOptimization,
    cancelPromptManagerCustomDragPending,
    finishPromptManagerCustomDrag,
};
