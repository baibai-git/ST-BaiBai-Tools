import { promptManager } from '@sillytavern/scripts/openai';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { PRESET_DRAG_ACTIVE_CLASS, PRESET_DRAG_CANCEL_DISTANCE_PX, PRESET_DRAG_CLICK_SUPPRESS_MS, PRESET_DRAG_CLONE_CLASS, PRESET_DRAG_HANDLER_KEY, PRESET_DRAG_INDICATOR_CLASS, PRESET_DRAG_INTERACTIVE_SELECTOR, PRESET_DRAG_LONG_PRESS_MS, PRESET_DRAG_PATCH_KEY, PRESET_DRAG_READY_CLASS, PRESET_DRAG_SOURCE_CLASS, PRESET_DRAG_STYLE_ID, PRESET_PROMPT_MANAGER_LIST_SELECTOR, PRESET_VUE_BODY_HEIGHT_ANIMATION_MS, PRESET_VUE_BODY_HEIGHT_EASING, PRESET_VUE_COLLAPSE_ANIMATION_MS, PRESET_VUE_DRAGGING_BODY_CLASS, PRESET_VUE_DRAG_READY_FEEDBACK_CLASS, PRESET_VUE_EXPAND_ANIMATION_MS, PRESET_VUE_GROUP_DROP_TARGET_CLASS, PRESET_VUE_GROUP_DROP_TARGET_MIN_HEIGHT_PX, PRESET_VUE_LIST_GAP_VARIABLE, PRESET_VUE_LIST_HOST_CLASS, refreshPromptManagerTokensDebounced } from './constants.js';
import { markPresetPromptServiceSettingsSavePending } from './pendingChanges.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';
import { areStringArraysEqual, isPresetGroupingEnabled } from './util.js';
import { getPresetVuePromptListManagerState, invalidatePresetVuePromptListGapCache, isPresetVuePromptListManagerActive, syncPresetVuePromptListGapVariable } from './vueList.js';

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

// TauriTavern 宿主检测(issue #50):TT 的 promptmanager.css 把拖拽手柄从绝对
// 定位改成流内网格第 1 列,在条目上定义该变量(无手柄 0px、有手柄 28px),并给
// 名称/控件/token 显式指定 grid-column 2/3/4。原生 ST 不定义此变量。
const PRESET_PROMPT_HANDLE_COLUMN_VARIABLE = '--completion-prompt-manager-handle-column';

// null = 尚未成功检测(列表还不存在),true/false = 已确认的宿主形态。
let presetPromptHandleColumnHostState = null;

function detectPresetPromptHandleColumnHost() {
    if (presetPromptHandleColumnHostState !== null) {
        return presetPromptHandleColumnHostState;
    }

    const list = document.querySelector(`#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}`);
    if (!list) {
        return false;
    }

    let probe = null;
    let row = list.querySelector('li.completion_prompt_manager_prompt');
    if (!row) {
        probe = document.createElement('li');
        probe.className = 'completion_prompt_manager_prompt';
        probe.style.display = 'none';
        list.append(probe);
        row = probe;
    }

    try {
        const value = getComputedStyle(row).getPropertyValue(PRESET_PROMPT_HANDLE_COLUMN_VARIABLE);
        presetPromptHandleColumnHostState = String(value || '').trim() !== '';
    } catch {
        presetPromptHandleColumnHostState = false;
    } finally {
        probe?.remove();
    }

    return presetPromptHandleColumnHostState;
}

function applyPresetDragOptimizationCss() {
    const existingStyle = document.getElementById(PRESET_DRAG_STYLE_ID);

    if (!settings.presetDragOptimizationEnabled && !isPresetGroupingEnabled()) {
        existingStyle?.remove();
        return;
    }

    // TT 宿主上手柄占流内第 1 列,条目行需要四列模板与其 grid-column 2/3/4 的
    // 子元素指定对齐;原生 ST 手柄绝对定位不占列,维持三列。列表头两边都无手柄
    // 列,始终三列。
    const hostHandleColumnInflow = detectPresetPromptHandleColumnHost();
    const promptRowGridColumns = hostHandleColumnInflow
        ? `var(${PRESET_PROMPT_HANDLE_COLUMN_VARIABLE}, 28px) minmax(0, 1fr) max-content max-content`
        : 'minmax(0, 1fr) max-content max-content';

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

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-list-head-actions .menu_button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 calc(var(--mainFontSize) * 1.65) !important;
    inline-size: calc(var(--mainFontSize) * 1.65) !important;
    block-size: calc(var(--mainFontSize) * 1.65) !important;
    min-inline-size: calc(var(--mainFontSize) * 1.65) !important;
    min-block-size: calc(var(--mainFontSize) * 1.65) !important;
    margin: 0 !important;
    padding: 0 !important;
    line-height: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-drag-locked li.completion_prompt_manager_prompt .drag-handle,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-drag-locked .bai-bai-preset-group-header {
    cursor: default !important;
}
${hostHandleColumnInflow ? '' : `
/* 原生布局的手柄绝对定位、按整行高度居中,正好叠在条目名第一个图标上;行一变高(长名字换行、
   搜索片段)就滑到中间露出来。电脑端整行直接拖、或者不能拖时手柄没用,直接隐藏;手机上显示
   (整条拖时按住它能立刻拖),放进左侧留白并只对齐第一行。全局库条目有自己的手柄,不动。 */
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-drag-handle-hidden li.completion_prompt_manager_prompt:not(.bai-bai-preset-global-library-prompt) > .drag-handle {
    display: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-drag-handle-visible li.completion_prompt_manager_prompt:not(.bai-bai-preset-global-library-prompt) {
    padding-left: 20px !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-drag-handle-visible li.completion_prompt_manager_prompt:not(.bai-bai-preset-global-library-prompt) > .drag-handle {
    left: 0 !important;
    grid-row: 1 / 2 !important;
}
`}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 45%, transparent);
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-collapsed {
    gap: 0;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-header {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    align-items: center;
    padding: 10px 7px;
    border-bottom: 1px solid color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 75%, transparent);
    cursor: pointer;
    user-select: none;
    -webkit-user-select: none;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-collapsed .bai-bai-preset-favorites-header {
    border-bottom-color: transparent;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-title {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 5px;
    min-width: 0;
    overflow: hidden;
    white-space: normal;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-title strong {
    overflow-wrap: anywhere;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-count {
    opacity: 0.65;
    white-space: nowrap;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-toggle {
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
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-collapsed .bai-bai-preset-favorites-toggle {
    transform: rotate(-90deg);
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-body {
    display: grid;
    grid-template-rows: 1fr;
    min-height: 0;
    overflow: hidden;
    transition: grid-template-rows ${PRESET_VUE_BODY_HEIGHT_ANIMATION_MS}ms ${PRESET_VUE_BODY_HEIGHT_EASING};
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-collapsed .bai-bai-preset-favorites-body {
    grid-template-rows: 0fr;
    pointer-events: none;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-body-inner {
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorites-list {
    display: flex;
    flex-direction: column;
    gap: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    margin: 0;
    padding: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    list-style: none;
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-favorite-prompt .bai-bai-preset-favorite-row-marker {
    cursor: default !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} .bai-bai-preset-favorite-prompt .bai-bai-preset-favorite-row-marker {
    cursor: default !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-prompt .bai-bai-preset-global-library-row-marker {
    cursor: default !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.${PRESET_DRAG_READY_CLASS} .bai-bai-preset-global-library-prompt .bai-bai-preset-global-library-row-marker {
    cursor: default !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-favorite-toggle-active {
    color: #f5c542 !important;
    opacity: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-favorite-toggle:not(.bai-bai-preset-prompt-favorite-toggle-active) {
    opacity: 0.48;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group {
    display: flex;
    flex-direction: column;
    gap: 0;
    padding: 0;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 45%, transparent);
    overflow: hidden;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-collapsed,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed {
    gap: 0;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-powered-off {
    opacity: 0.72;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-powered-off .bai-bai-preset-group-header {
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 52%, transparent);
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

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-collapsed .bai-bai-preset-group-header,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed .bai-bai-preset-group-header {
    border-bottom-color: transparent;
}

@media (pointer: coarse) {
    #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-drag-surface {
        touch-action: pan-y !important;
    }
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-title {
    display: flex;
    align-items: center;
    gap: 4px;
    min-width: 0;
    overflow: hidden;
    white-space: normal;
    font-size: calc(var(--mainFontSize) * 1);
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-title-content {
    display: flex;
    align-items: flex-end;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: normal;
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

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-toggle {
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-collapsed .bai-bai-preset-group-toggle,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed .bai-bai-preset-group-toggle {
    transform: rotate(-90deg);
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-enable-toggle {
    font-size: calc(var(--mainFontSize) * 1.05) !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-title-content strong {
    flex: 0 1 auto;
    min-width: 0;
    overflow: visible;
    overflow-wrap: anywhere;
    white-space: normal;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-count {
    flex: 0 0 auto;
    opacity: 0.65;
    font-size: calc(var(--mainFontSize) * 0.82);
    white-space: nowrap;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head {
    grid-template-columns: minmax(0, 1fr) max-content max-content !important;
    column-gap: 6px !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt {
    grid-template-columns: ${promptRowGridColumns} !important;
    column-gap: 6px !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .completion_prompt_manager_prompt_name {
    min-width: 0 !important;
    white-space: normal !important;
    overflow: visible !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt.bai-bai-preset-prompt-actions-open .completion_prompt_manager_prompt_name {
    visibility: hidden !important;
    pointer-events: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .prompt-manager-inspect-action {
    display: inline;
    min-width: 0;
    max-width: 100%;
    white-space: normal !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-name-visual-only {
    pointer-events: none !important;
    cursor: inherit !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head {
    grid-template-columns: minmax(0, 1fr) max-content !important;
    align-items: center !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head .bai-bai-preset-list-head-actions {
    justify-self: end !important;
    align-self: center !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_list_head.bai-bai-preset-list-head-searching {
    row-gap: 6px !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-bar,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-empty {
    grid-column: 1 / -1;
    min-width: 0;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-bar {
    display: flex;
    align-items: center;
    gap: 6px;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-field {
    position: relative;
    display: flex;
    flex: 1 1 auto;
    min-width: 0;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-input {
    flex: 1 1 auto;
    width: auto !important;
    min-width: 0;
    margin: 0 !important;
    padding-inline-end: calc(var(--mainFontSize) * 1.9) !important;
    -webkit-user-select: text;
    user-select: text;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-clear {
    position: absolute;
    inset-block: 0;
    inset-inline-end: 0;
    display: flex;
    align-items: center;
    padding: 0 calc(var(--mainFontSize) * 0.55);
    opacity: 0.55;
    cursor: pointer;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-clear:hover {
    opacity: 0.9;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-count,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-empty {
    opacity: 0.65;
    font-size: calc(var(--mainFontSize) * 0.82);
    white-space: nowrap;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-count {
    flex: 0 0 auto;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-empty {
    padding: 4px 0;
    text-align: center;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-list-head-actions .bai-bai-preset-search-toggle-active {
    color: var(--SmartThemeQuoteColor) !important;
    opacity: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt.bai-bai-preset-search-miss,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.bai-bai-preset-group.bai-bai-preset-search-miss {
    display: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-search-open .bai-bai-preset-group-body,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR}.bai-bai-preset-search-open .bai-bai-preset-group-toggle {
    transition: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-search-mark {
    padding: 0 1px;
    border-radius: 3px;
    background-color: color-mix(in srgb, var(--SmartThemeQuoteColor) 40%, transparent);
    color: inherit;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt .bai-bai-preset-search-snippet {
    grid-column: ${hostHandleColumnInflow ? '2 / -1' : '1 / -1'};
    min-width: 0;
    overflow: hidden;
    white-space: nowrap;
    text-overflow: ellipsis;
    opacity: 0.7;
    font-size: calc(var(--mainFontSize) * 0.8);
    line-height: 1.4;
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
    filter: none !important;
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
    filter: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-hint-hidden {
    display: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions {
    display: none !important;
    position: absolute !important;
    inset-inline-end: calc(100% + 4px) !important;
    inset-block-start: 50% !important;
    transform: translateY(-50%) !important;
    z-index: 8 !important;
    align-items: center !important;
    justify-content: flex-end !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    gap: 4px !important;
    flex: 0 0 auto !important;
    inline-size: max-content !important;
    min-inline-size: 0 !important;
    max-inline-size: calc(100vw - 48px) !important;
    box-sizing: border-box !important;
    padding: 0 !important;
    border: 0 !important;
    border-radius: 0 !important;
    background: transparent !important;
    box-shadow: none !important;
    white-space: nowrap !important;
    opacity: 0;
    transition: opacity var(--animation-duration-2x, 160ms) ease-in-out;
    filter: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-actions-visible {
    display: inline-flex !important;
    opacity: 1 !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-action-button.caution {
    color: var(--SmartThemeEmColor) !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-prompt-action-button[data-preset-prompt-action="delete"] {
    color: #ff4d4f !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-remove-action,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .prompt-manager-copy-action {
    display: none !important;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-body {
    display: grid;
    grid-template-rows: 1fr;
    min-height: 0;
    overflow: hidden;
    transition: grid-template-rows ${PRESET_VUE_BODY_HEIGHT_ANIMATION_MS}ms ${PRESET_VUE_BODY_HEIGHT_EASING};
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-collapsed .bai-bai-preset-group-body,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-collapsed .bai-bai-preset-group-body {
    grid-template-rows: 0fr;
    pointer-events: none;
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

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-list-empty {
    min-height: 12px;
    border: 1px dashed color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-global-library-empty {
    padding: 8px 10px;
    color: var(--SmartThemeBodyColor);
    opacity: 0.65;
    font-size: calc(var(--mainFontSize) * 0.92);
    overflow-wrap: anywhere;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside {
    display: flex;
    flex-direction: column;
    gap: 0;
    width: 100%;
    inline-size: 100%;
    max-width: 100%;
    box-sizing: border-box;
    margin: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px) 0 var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    padding: 0;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 45%, transparent);
    overflow: hidden;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside.bai-bai-preset-global-library-collapsed {
    gap: 0;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-header {
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

#completion_prompt_manager .bai-bai-preset-global-library-outside.bai-bai-preset-global-library-collapsed .bai-bai-preset-group-header {
    border-bottom-color: transparent;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-title,
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-title-content {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    white-space: normal;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-title-content {
    flex-wrap: wrap;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-toggle,
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-prompt-action-button {
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
    line-height: 1 !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-toggle {
    transform: rotate(0deg);
    transform-origin: center;
    transition: transform ${PRESET_VUE_EXPAND_ANIMATION_MS}ms ease;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside.bai-bai-preset-global-library-collapsed .bai-bai-preset-group-toggle {
    transform: rotate(-90deg);
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-body {
    display: grid;
    grid-template-rows: 1fr;
    min-height: 0;
    overflow: hidden;
    transition: grid-template-rows ${PRESET_VUE_BODY_HEIGHT_ANIMATION_MS}ms ${PRESET_VUE_BODY_HEIGHT_EASING};
}

#completion_prompt_manager .bai-bai-preset-global-library-outside.bai-bai-preset-global-library-collapsed .bai-bai-preset-group-body {
    grid-template-rows: 0fr;
    pointer-events: none;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-group-body-inner {
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-list {
    display: flex;
    flex-direction: column;
    gap: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    margin: 0;
    padding: var(${PRESET_VUE_LIST_GAP_VARIABLE}, 6px);
    list-style: none;
    min-height: 0;
    overflow: hidden;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) max-content max-content !important;
    align-items: center !important;
    column-gap: 6px !important;
    width: 100%;
    box-sizing: border-box;
    padding: 0.5em 0.5em 0.5em 20px;
    border: 1px solid var(--SmartThemeBorderColor);
    position: relative;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt .completion_prompt_manager_prompt_name {
    min-width: 0 !important;
    white-space: normal !important;
    overflow: visible !important;
    overflow-wrap: anywhere !important;
    word-break: break-word !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt .prompt_manager_prompt_controls {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    gap: 4px !important;
    min-inline-size: max-content !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt .prompt_manager_prompt_tokens {
    inline-size: max-content !important;
    min-inline-size: 2.2em !important;
    width: auto !important;
    justify-self: end !important;
    text-align: right;
}

/* TT 宿主给条目子元素显式指定了 grid-column 2/3/4(手柄占第 1 列);全局库条目
   的标记是绝对定位不占列、行模板保持三列,这里把子元素归位到自然流。原生 ST
   不设置 grid-column,auto 即默认值,无影响。 */
#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt > .completion_prompt_manager_prompt_name,
#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt > span:nth-of-type(3),
#completion_prompt_manager .bai-bai-preset-global-library-outside li.completion_prompt_manager_prompt > .prompt_manager_prompt_tokens {
    grid-column: auto !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-row-marker {
    position: absolute;
    height: 100%;
    top: 0;
    padding: 0 5px;
    display: flex !important;
    align-items: center;
    cursor: default !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-empty {
    padding: 8px 10px;
    color: var(--SmartThemeBodyColor);
    opacity: 0.65;
    font-size: calc(var(--mainFontSize) * 0.92);
    overflow-wrap: anywhere;
}

/* 空分组作为拖放目标需要一点高度 */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-list.bai-bai-preset-group-list-empty {
    min-height: 24px;
    border: 1px dashed color-mix(in srgb, var(--SmartThemeBorderColor) 70%, transparent);
    border-radius: 4px;
}

/* 库内分组文件夹 */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group {
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 6px;
    overflow: hidden;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
    padding: 6px 8px;
    cursor: pointer;
    background: color-mix(in srgb, var(--SmartThemeBodyColor) 6%, transparent);
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-header .bai-bai-preset-group-title {
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-header .bai-bai-preset-group-title-content {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-header strong {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-icon {
    opacity: 0.75;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group-header .bai-bai-preset-group-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
}

/* 分组折叠(纯 CSS,复用外层库的 grid-template-rows 动画约束) */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group.bai-bai-preset-group-collapsed .bai-bai-preset-group-body {
    grid-template-rows: 0fr;
    pointer-events: none;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-group.bai-bai-preset-group-collapsed .bai-bai-preset-group-toggle {
    transform: rotate(-90deg);
    transition-duration: ${PRESET_VUE_COLLAPSE_ANIMATION_MS}ms;
}

/* 顶部库 header 的按钮区 */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 6px;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-header .bai-bai-preset-group-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: none;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-select-active {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 30%, transparent);
}

/* 多选操作条 */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-selection-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    flex-wrap: wrap;
    padding: 6px 8px;
    margin-bottom: 6px;
    border: 1px dashed var(--SmartThemeBorderColor);
    border-radius: 6px;
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 14%, transparent);
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-selection-count {
    font-size: calc(var(--mainFontSize) * 0.92);
    opacity: 0.85;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-selection-actions {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

/* 行内复选框 */
#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-select-box {
    cursor: pointer !important;
    opacity: 0.8;
}

#completion_prompt_manager .bai-bai-preset-global-library-outside .bai-bai-preset-global-library-select-box-checked {
    opacity: 1;
    color: var(--SmartThemeQuoteColor);
}

#completion_prompt_manager .bai-bai-preset-global-library-outside li.bai-bai-preset-global-library-prompt-selected {
    background: color-mix(in srgb, var(--SmartThemeQuoteColor) 16%, transparent);
    border-color: var(--SmartThemeQuoteColor);
}

#completion_prompt_manager.bai-bai-preset-global-library-dialog-host {
    position: relative;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-layer {
    position: fixed;
    inset: auto;
    top: var(--bai-bai-preset-global-library-dialog-top, 0);
    left: var(--bai-bai-preset-global-library-dialog-left, 0);
    z-index: 40;
    display: flex;
    align-items: center;
    justify-content: center;
    inline-size: var(--bai-bai-preset-global-library-dialog-width, 100vw);
    block-size: var(--bai-bai-preset-global-library-dialog-height, 100dvh);
    min-height: 0;
    padding: 10px;
    background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 46%, transparent);
    backdrop-filter: blur(2px);
    animation: bai-bai-preset-global-library-layer-in 0.14s ease both;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog {
    display: flex;
    flex-direction: column;
    gap: 10px;
    width: min(100%, 420px);
    max-height: min(78vh, 560px);
    padding: 12px;
    border: 1px solid var(--SmartThemeBorderColor);
    border-radius: 8px;
    background: var(--SmartThemeBlurTintColor);
    box-shadow: 0 12px 32px color-mix(in srgb, #000 28%, transparent);
    animation: bai-bai-preset-global-library-dialog-in 0.18s ease both;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-head,
#completion_prompt_manager .bai-bai-preset-global-library-dialog-actions {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-head strong {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
    min-width: 0;
    overflow: auto;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-message {
    line-height: 1.35;
    overflow-wrap: anywhere;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-field {
    display: flex;
    flex-direction: column;
    gap: 5px;
    min-width: 0;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-field label {
    opacity: 0.78;
    font-size: calc(var(--mainFontSize) * 0.9);
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-field .text_pole,
#completion_prompt_manager .bai-bai-preset-global-library-dialog-field select {
    width: 100% !important;
    min-width: 0 !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-field textarea {
    width: 100% !important;
    min-width: 0 !important;
    min-height: 260px;
    resize: vertical;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-actions {
    justify-content: flex-end;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-button {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    flex: 0 0 auto !important;
    min-width: 4.8em !important;
    width: auto !important;
    min-height: calc(var(--mainFontSize) * 2) !important;
    padding: 0 12px !important;
    line-height: 1.2 !important;
    white-space: nowrap !important;
    max-width: none !important;
    writing-mode: horizontal-tb !important;
}

#completion_prompt_manager .bai-bai-preset-global-library-dialog-danger {
    color: #d86666 !important;
}

@keyframes bai-bai-preset-global-library-layer-in {
    from {
        opacity: 0;
    }

    to {
        opacity: 1;
    }
}

@keyframes bai-bai-preset-global-library-dialog-in {
    from {
        opacity: 0;
        transform: translateY(8px) scale(0.97);
    }

    to {
        opacity: 1;
        transform: translateY(0) scale(1);
    }
}

@media (max-width: 600px) {
    #completion_prompt_manager .bai-bai-preset-global-library-dialog-layer {
        position: fixed;
        inset: 0;
        z-index: 50000;
        inline-size: auto;
        block-size: auto;
        min-height: 100dvh;
        padding: 18px;
        background: color-mix(in srgb, var(--SmartThemeBlurTintColor) 60%, transparent);
    }

    #completion_prompt_manager .bai-bai-preset-global-library-dialog {
        width: min(100%, 420px);
        max-height: calc(100dvh - 36px);
    }
}

body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group-list-empty {
    min-height: ${PRESET_VUE_GROUP_DROP_TARGET_MIN_HEIGHT_PX}px;
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group.${PRESET_VUE_GROUP_DROP_TARGET_CLASS} {
    border-color: var(--SmartThemeQuoteColor);
    box-shadow: 0 0 0 1px color-mix(in srgb, var(--SmartThemeQuoteColor) 65%, transparent);
}

#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group.${PRESET_VUE_GROUP_DROP_TARGET_CLASS} .bai-bai-preset-group-header,
#completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group.${PRESET_VUE_GROUP_DROP_TARGET_CLASS} .bai-bai-preset-group-list {
    background-color: color-mix(in srgb, var(--SmartThemeQuoteColor) 12%, transparent);
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

.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt,
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt,
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt,
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt {
    display: grid !important;
    grid-template-columns: minmax(0, 1fr) max-content max-content !important;
    column-gap: 6px !important;
    align-items: center !important;
    padding-left: 20px !important;
    list-style: none !important;
    list-style-type: none !important;
}

/* 拖拽克隆/ghost 行手柄为绝对定位、行模板三列。ghost 留在列表内,TT 宿主的
   grid-column 2/3/4 子元素规则会命中它,归位到自然流;原生 ST 上为无效覆盖。 */
.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt > .completion_prompt_manager_prompt_name,
.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt > span:nth-of-type(3),
.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt > .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt > .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt > span:nth-of-type(3),
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt > .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt > .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt > span:nth-of-type(3),
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt > .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt > .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt > span:nth-of-type(3),
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt > .prompt_manager_prompt_tokens {
    grid-column: auto !important;
}

.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt::marker,
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt::marker,
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt::marker,
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt::marker {
    content: "" !important;
    font-size: 0 !important;
}

.${PRESET_DRAG_CLONE_CLASS} .prompt_manager_prompt_controls,
.bai-bai-preset-vue-sortable-ghost .prompt_manager_prompt_controls,
.bai-bai-preset-vue-sortable-fallback .prompt_manager_prompt_controls,
.bai-bai-preset-vue-sortable-drag .prompt_manager_prompt_controls {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    flex-direction: row !important;
    gap: 4px !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    min-inline-size: max-content !important;
}

.${PRESET_DRAG_CLONE_CLASS} .drag-handle,
.bai-bai-preset-vue-sortable-ghost .drag-handle,
.bai-bai-preset-vue-sortable-fallback .drag-handle,
.bai-bai-preset-vue-sortable-drag .drag-handle {
    position: absolute !important;
    left: 0 !important;
    top: 0 !important;
    height: 100% !important;
    padding: 0 5px !important;
    display: flex !important;
    align-items: center !important;
}

.${PRESET_DRAG_CLONE_CLASS} .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-ghost .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-fallback .completion_prompt_manager_prompt_name,
.bai-bai-preset-vue-sortable-drag .completion_prompt_manager_prompt_name {
    min-width: 0 !important;
    white-space: nowrap !important;
    overflow: hidden !important;
}

.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-icon-button,
.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-action-button,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-icon-button,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-action-button,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-icon-button,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-action-button,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-icon-button,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-action-button {
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
    white-space: nowrap !important;
}

.${PRESET_DRAG_CLONE_CLASS}.completion_prompt_manager_prompt:not(.completion_prompt_manager_prompt_disabled) .prompt-manager-toggle-action,
.bai-bai-preset-vue-sortable-ghost.completion_prompt_manager_prompt:not(.completion_prompt_manager_prompt_disabled) .prompt-manager-toggle-action,
.bai-bai-preset-vue-sortable-fallback.completion_prompt_manager_prompt:not(.completion_prompt_manager_prompt_disabled) .prompt-manager-toggle-action,
.bai-bai-preset-vue-sortable-drag.completion_prompt_manager_prompt:not(.completion_prompt_manager_prompt_disabled) .prompt-manager-toggle-action {
    color: var(--SmartThemeQuoteColor) !important;
}

.${PRESET_DRAG_CLONE_CLASS} .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-ghost .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-fallback .prompt_manager_prompt_tokens,
.bai-bai-preset-vue-sortable-drag .prompt_manager_prompt_tokens {
    inline-size: max-content !important;
    min-inline-size: 2.2em !important;
    width: auto !important;
    justify-self: end !important;
    text-align: right !important;
    font-size: calc(var(--mainFontSize) * 0.9) !important;
}

.${PRESET_DRAG_CLONE_CLASS} .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-ghost .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-prompt-actions,
.bai-bai-preset-vue-sortable-drag .bai-bai-preset-prompt-actions {
    display: none !important;
    opacity: 0 !important;
}

.${PRESET_DRAG_CLONE_CLASS} .prompt-manager-remove-action,
.${PRESET_DRAG_CLONE_CLASS} .prompt-manager-copy-action,
.bai-bai-preset-vue-sortable-ghost .prompt-manager-remove-action,
.bai-bai-preset-vue-sortable-ghost .prompt-manager-copy-action,
.bai-bai-preset-vue-sortable-fallback .prompt-manager-remove-action,
.bai-bai-preset-vue-sortable-fallback .prompt-manager-copy-action,
.bai-bai-preset-vue-sortable-drag .prompt-manager-remove-action,
.bai-bai-preset-vue-sortable-drag .prompt-manager-copy-action {
    display: none !important;
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

body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-vue-sortable-ghost,
body.${PRESET_VUE_DRAGGING_BODY_CLASS} #completion_prompt_manager ${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-vue-sortable-chosen {
    visibility: hidden !important;
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
    gap: 4px !important;
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: normal !important;
    font-size: calc(var(--mainFontSize) * 1) !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-title-content {
    display: flex !important;
    align-items: flex-end !important;
    flex-wrap: wrap !important;
    gap: 6px !important;
    min-width: 0 !important;
    overflow: hidden !important;
    white-space: normal !important;
}

.bai-bai-preset-vue-sortable-fallback .bai-bai-preset-group-title-content strong {
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
    font-size: calc(var(--mainFontSize) * 0.82) !important;
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

function preparePromptManagerCustomDragList(
    list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR),
    { signature = '' } = {},
) {
    if (!(list instanceof HTMLElement)) {
        return false;
    }

    if (!settings.presetDragOptimizationEnabled && !isPresetGroupingEnabled()) {
        list.classList.remove(PRESET_DRAG_READY_CLASS, PRESET_DRAG_ACTIVE_CLASS);
        return false;
    }

    const manager = getPresetVuePromptListManagerState();
    const prepareSignature = signature || '';
    if (
        prepareSignature
        && manager.dragPreparedList === list
        && manager.dragPreparedSignature === prepareSignature
        && list.classList.contains(PRESET_DRAG_READY_CLASS)
    ) {
        return true;
    }

    disablePromptManagerStockSortable(list);
    list.classList.add(PRESET_DRAG_READY_CLASS);
    syncPresetVuePromptListGapVariable(list);
    list.querySelectorAll('li.completion_prompt_manager_prompt .drag-handle')
        .forEach(handle => handle.classList.add('ui-sortable-handle'));
    manager.dragPreparedList = list;
    manager.dragPreparedSignature = prepareSignature;
    return true;
}

function clearPromptManagerCustomDragList() {
    const list = document.querySelector(PRESET_PROMPT_MANAGER_LIST_SELECTOR);

    if (!(list instanceof HTMLElement)) {
        return;
    }

    list.classList.remove(PRESET_DRAG_READY_CLASS, PRESET_DRAG_ACTIVE_CLASS);
    invalidatePresetVuePromptListGapCache();
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
    markPresetPromptServiceSettingsSavePending();
}

function preventPresetDragEvent(event) {
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
}

export {
    activatePromptManagerCustomDragPending,
    applyPresetDragOptimization,
    applyPresetDragOptimizationCss,
    autoScrollPromptManagerDragContainer,
    beginPromptManagerCustomDrag,
    cancelPromptManagerCustomDragPending,
    clearPromptManagerCustomDragList,
    clearPromptManagerCustomDragPending,
    copyComputedStylesForDragClone,
    disablePromptManagerStockSortable,
    finishPromptManagerCustomDrag,
    getPresetDragPoint,
    getPresetPromptDragTarget,
    getPromptManagerDragScrollContainer,
    getPromptManagerDraggableRows,
    getPromptManagerDropIndex,
    handlePresetPromptDragClick,
    handlePresetPromptDragMouseDown,
    handlePresetPromptDragPointerDown,
    handlePresetPromptDragTouchStart,
    handlePromptManagerCustomDragKeyDown,
    handlePromptManagerCustomDragMouseMove,
    handlePromptManagerCustomDragMouseUp,
    handlePromptManagerCustomDragPendingKeyDown,
    handlePromptManagerCustomDragPendingPointerCancel,
    handlePromptManagerCustomDragPendingPointerEnd,
    handlePromptManagerCustomDragPendingPointerMove,
    handlePromptManagerCustomDragPendingTouchCancel,
    handlePromptManagerCustomDragPendingTouchEnd,
    handlePromptManagerCustomDragPendingTouchMove,
    handlePromptManagerCustomDragPointerCancel,
    handlePromptManagerCustomDragPointerMove,
    handlePromptManagerCustomDragPointerUp,
    handlePromptManagerCustomDragTouchCancel,
    handlePromptManagerCustomDragTouchEnd,
    handlePromptManagerCustomDragTouchMove,
    installPresetDragOptimizationHandlers,
    isPrimaryPresetDragButton,
    isPromptManagerReadyForCustomDrag,
    movePromptManagerDraggedRow,
    patchPromptManagerDraggable,
    preparePromptManagerCustomDragList,
    preparePromptManagerDragClone,
    preventPresetDragEvent,
    removePresetDragOptimizationHandlers,
    restorePromptManagerStockDraggable,
    savePromptManagerDraggedOrder,
    schedulePromptManagerDragAutoScroll,
    schedulePromptManagerDragFrame,
    shouldSuppressPromptManagerCompatDragEvent,
    startPromptManagerCustomDragPending,
    updatePromptManagerCustomDragFromEvent,
    updatePromptManagerCustomDragPendingFromEvent,
    updatePromptManagerDragFrame,
    updatePromptManagerDragIndicator,
};
