import { resetScrollHeight } from '@sillytavern/scripts/utils';
import { WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY } from './constants.js';
import { installWorldInfoEditorSelectGrouping, installWorldInfoEditorSelectSearch, removeWorldInfoEditorSelectGrouping, removeWorldInfoEditorSelectSearch } from './editorSelect.js';
import { installWorldInfoGlobalSelectorOptimization, removeWorldInfoGlobalSelectorOptimization } from './globalSelector.js';
import { applyWorldInfoMobileExpandedLayouts, applyWorldInfoMobileHeaderLayout, applyWorldInfoMobileHeaderLayouts, applyWorldInfoPopupLayout, installWorldInfoMobileHeaderLayoutWatcher, installWorldInfoMobileLayoutMutationObserver, removeWorldInfoMobileHeaderLayoutWatcher, removeWorldInfoMobileLayoutMutationObserver, restoreWorldInfoMobileExpandedLayouts, restoreWorldInfoMobileHeaderLayouts, restoreWorldInfoPopupLayout, shouldUseWorldInfoMobileHeaderLayout } from './mobileLayout.js';
import { installWorldInfoMobileHeaderLayoutStyle, removeWorldInfoMobileHeaderLayoutStyle } from './mobileLayoutStyle.js';
import { installWorldInfoSearchReplacePanel, removeWorldInfoSearchReplacePanel } from './searchReplace.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';

function applyWorldInfoListOptimization() {
    const state = getWorldInfoVueListOptimizationState();
    state.enabled = Boolean(settings.worldInfoListOptimizationEnabled);

    if (state.enabled) {
        installWorldInfoVueListPaginationPatch(state);
        installWorldInfoEditorSelectGrouping(state);
        installWorldInfoEditorSelectSearch(state);
        installWorldInfoGlobalSelectorOptimization(state);
        installWorldInfoMobileHeaderLayoutStyle();
        if (settings.worldInfoSearchReplaceEnabled !== false) {
            installWorldInfoSearchReplacePanel(state);
        } else {
            removeWorldInfoSearchReplacePanel(state);
        }
        installWorldInfoMobileHeaderLayoutWatcher(state);
        installWorldInfoMobileLayoutMutationObserver(state);
    } else {
        unmountWorldInfoVueListApp(state);
        restoreWorldInfoVueListPaginationPatch(state);
        removeWorldInfoEditorSelectGrouping(state);
        removeWorldInfoEditorSelectSearch(state);
        removeWorldInfoGlobalSelectorOptimization(state);
        removeWorldInfoSearchReplacePanel(state);
        removeWorldInfoMobileLayoutMutationObserver(state);
        removeWorldInfoMobileHeaderLayoutWatcher(state);
        restoreWorldInfoPopupLayout();
        restoreWorldInfoMobileExpandedLayouts();
        restoreWorldInfoMobileHeaderLayouts();
        removeWorldInfoMobileHeaderLayoutStyle();
    }
}

function getWorldInfoVueListOptimizationState() {
    if (!extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] || typeof extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] !== 'object') {
        extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY] = {
            enabled: false,
            app: null,
            root: null,
            modulePromise: null,
            renderToken: 0,
            activeAppendCapture: null,
            originalAppend: null,
            patchedAppend: null,
            originalPagination: null,
            patchedPagination: null,
            renderQueue: null,
            mobileHeaderLayoutHandler: null,
            mobileHeaderLayoutMediaQuery: null,
            mobileLayoutMutationObserver: null,
            worldInfoEditorSelectOpenHandler: null,
            worldInfoEditorSelectKeyHandler: null,
            worldInfoEditorSelectSelect2Handler: null,
            worldInfoEditorSelectSearchOpeningHandler: null,
            worldInfoEditorSelectSearchOpenHandler: null,
            worldInfoEditorSelectSearchInteractionGuard: null,
            worldInfoEditorSelectGroupingApplying: false,
            worldInfoGlobalSelectorDropdown: null,
            worldInfoGlobalSelectorSyncHandler: null,
            worldInfoGlobalSelectorTriggerHandler: null,
            worldInfoGlobalSelectorTriggerEvents: null,
            worldInfoGlobalSelectorSelects: new Set(),
            worldInfoSearchReplacePanel: null,
            worldInfoSearchReplaceHandlers: [],
            worldInfoSearchReplaceStats: null,
        };
    }

    const state = extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY];

    state.worldInfoGlobalSelectorDropdown ??= null;
    state.worldInfoGlobalSelectorSyncHandler ??= null;
    state.worldInfoGlobalSelectorTriggerHandler ??= null;
    state.worldInfoGlobalSelectorTriggerEvents ??= null;
    state.worldInfoSearchReplacePanel ??= null;
    state.worldInfoSearchReplaceHandlers ??= [];
    state.worldInfoSearchReplaceStats ??= null;

    if (!(state.worldInfoGlobalSelectorSelects instanceof Set)) {
        state.worldInfoGlobalSelectorSelects = new Set();
    }

    return extensionState[WORLD_INFO_VUE_LIST_OPTIMIZATION_KEY];
}

function installWorldInfoVueListPaginationPatch(state = getWorldInfoVueListOptimizationState()) {
    if (state.patchedPagination && globalThis.jQuery?.fn?.pagination === state.patchedPagination) {
        return;
    }

    const originalPagination = globalThis.jQuery?.fn?.pagination;

    if (typeof originalPagination !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery.pagination is unavailable; World Info list optimization was not installed`);
        return;
    }

    function patchedPagination(...args) {
        if (settings.worldInfoListOptimizationEnabled && shouldWrapWorldInfoPaginationCall(this, args)) {
            const options = { ...args[0] };
            const nativeCallback = options.callback;

            if (!nativeCallback?.__baiBaiToolkitWorldInfoVueListWrapped) {
                options.callback = function worldInfoVueListPaginationCallback(page, ...callbackArgs) {
                    if (!settings.worldInfoListOptimizationEnabled) {
                        return nativeCallback.call(this, page, ...callbackArgs);
                    }

                    return renderWorldInfoVueListFromNativeCallback(nativeCallback, this, page, callbackArgs);
                };
                options.callback.__baiBaiToolkitWorldInfoVueListWrapped = true;
                options.callback.__baiBaiToolkitWorldInfoVueListOriginal = nativeCallback;
            }

            args[0] = options;
        }

        return originalPagination.apply(this, args);
    }

    patchedPagination.__baiBaiToolkitWorldInfoVueListPatched = true;
    patchedPagination.__baiBaiToolkitOriginalPagination = originalPagination;
    Object.assign(patchedPagination, originalPagination);

    state.originalPagination = originalPagination;
    state.patchedPagination = patchedPagination;
    globalThis.jQuery.fn.pagination = patchedPagination;
}

function restoreWorldInfoVueListPaginationPatch(state = getWorldInfoVueListOptimizationState()) {
    if (!state.patchedPagination || !globalThis.jQuery?.fn) {
        return;
    }

    if (globalThis.jQuery.fn.pagination === state.patchedPagination && typeof state.originalPagination === 'function') {
        globalThis.jQuery.fn.pagination = state.originalPagination;
    }

    state.originalPagination = null;
    state.patchedPagination = null;
}

function shouldWrapWorldInfoPaginationCall(targets, args) {
    const options = args[0];

    return options
        && typeof options === 'object'
        && !Array.isArray(options)
        && typeof options.callback === 'function'
        && targets?.length === 1
        && targets[0] instanceof Element
        && targets[0].id === 'world_info_pagination';
}

function installWorldInfoVueListAppendCapturePatch(state = getWorldInfoVueListOptimizationState()) {
    if (state.patchedAppend && globalThis.jQuery?.fn?.append === state.patchedAppend) {
        return;
    }

    const originalAppend = globalThis.jQuery?.fn?.append;

    if (typeof originalAppend !== 'function') {
        console.warn(`${LOG_PREFIX} jQuery.append is unavailable; World Info list optimization was not installed`);
        return;
    }

    function patchedAppend(...args) {
        const capture = state.activeAppendCapture;

        if (settings.worldInfoListOptimizationEnabled
            && capture?.list
            && this?.length === 1
            && this[0] === capture.list) {
            capture.appendCalls.push(args);
            return this;
        }

        return originalAppend.apply(this, args);
    }

    patchedAppend.__baiBaiToolkitWorldInfoVueListAppendPatched = true;
    patchedAppend.__baiBaiToolkitOriginalAppend = originalAppend;
    Object.assign(patchedAppend, originalAppend);

    state.originalAppend = originalAppend;
    state.patchedAppend = patchedAppend;
    globalThis.jQuery.fn.append = patchedAppend;
}

function restoreWorldInfoVueListAppendCapturePatch(state = getWorldInfoVueListOptimizationState()) {
    if (!state.patchedAppend || !globalThis.jQuery?.fn) {
        return;
    }

    if (globalThis.jQuery.fn.append === state.patchedAppend && typeof state.originalAppend === 'function') {
        globalThis.jQuery.fn.append = state.originalAppend;
    }

    state.activeAppendCapture = null;
    state.originalAppend = null;
    state.patchedAppend = null;
}

async function renderWorldInfoVueListFromNativeCallback(nativeCallback, callbackThis, page, callbackArgs) {
    const state = getWorldInfoVueListOptimizationState();
    const previousRender = state.renderQueue || Promise.resolve();
    const render = previousRender
        .catch(() => { })
        .then(() => renderWorldInfoVueListFromNativeCallbackLocked(state, nativeCallback, callbackThis, page, callbackArgs));
    const cleanup = render.finally(() => {
        if (state.renderQueue === cleanup) {
            state.renderQueue = null;
        }
    });

    state.renderQueue = cleanup;
    return render;
}

async function renderWorldInfoVueListFromNativeCallbackLocked(state, nativeCallback, callbackThis, page, callbackArgs) {
    const list = document.getElementById('world_popup_entries_list');

    if (!settings.worldInfoListOptimizationEnabled || !(list instanceof HTMLElement) || typeof nativeCallback !== 'function') {
        return nativeCallback.call(callbackThis, page, ...callbackArgs);
    }

    unmountWorldInfoVueListApp(state);

    const capture = {
        list,
        appendCalls: [],
    };

    state.activeAppendCapture = capture;
    installWorldInfoVueListAppendCapturePatch(state);
    const append = state.originalAppend;

    try {
        const result = await nativeCallback.call(callbackThis, page, ...callbackArgs);

        if (!settings.worldInfoListOptimizationEnabled) {
            restoreWorldInfoVueListAppendCapturePatch(state);
            appendCapturedWorldInfoListCalls(state, list, capture.appendCalls, append);
            return result;
        }

        if (state.activeAppendCapture !== capture) {
            restoreWorldInfoVueListAppendCapturePatch(state);
            return result;
        }

        state.activeAppendCapture = null;
        restoreWorldInfoVueListAppendCapturePatch(state);

        if (capture.appendCalls.length === 0) {
            return result;
        }

        await mountWorldInfoVueListApp(state, list, capture.appendCalls, append);
        return result;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to render World Info Vue list`, error);
        state.activeAppendCapture = null;
        restoreWorldInfoVueListAppendCapturePatch(state);
        appendCapturedWorldInfoListCalls(state, list, capture.appendCalls, append);
        throw error;
    } finally {
        if (state.activeAppendCapture === capture) {
            state.activeAppendCapture = null;
        }
        restoreWorldInfoVueListAppendCapturePatch(state);
    }
}

async function mountWorldInfoVueListApp(state, list, appendCalls, append) {
    const vue = await loadWorldInfoVueListModule(state);
    const renderToken = ++state.renderToken;

    unmountWorldInfoVueListApp(state);

    state.root = list;
    state.app = vue.createApp(createWorldInfoVueListRootComponent(vue, {
        state,
        list,
        appendCalls,
        append,
        renderToken,
    }));
    state.app.mount(list);
}

function createWorldInfoVueListRootComponent(vue, context) {
    return {
        name: 'BaiBaiWorldInfoVueList',
        setup() {
            vue.onMounted(() => {
                if (context.state.renderToken !== context.renderToken || !settings.worldInfoListOptimizationEnabled) {
                    return;
                }

                applyWorldInfoMobileHeaderLayoutsBeforeAppend(context.appendCalls);
                appendCapturedWorldInfoListCalls(context.state, context.list, context.appendCalls, context.append);
                refreshWorldInfoVueListAfterAppend(context.list);
            });

            return () => null;
        },
    };
}

// 手机版标题栏趁条目还没插进页面就改好:离线时挪节点很便宜,插进页面后再挪,
// 每挪一个都要重建渲染对象、重算样式,还会通知页面上所有 MutationObserver(原版翻译也会把挪过的节点再翻一遍)。
function applyWorldInfoMobileHeaderLayoutsBeforeAppend(appendCalls) {
    if (!shouldUseWorldInfoMobileHeaderLayout()) {
        return;
    }

    for (const args of appendCalls) {
        for (const node of normalizeWorldInfoAppendArguments(args.filter(arg => typeof arg !== 'string'))) {
            if (node instanceof HTMLElement && !node.isConnected && node.classList.contains('world_entry')) {
                applyWorldInfoMobileHeaderLayout(node);
            }
        }
    }
}

function appendCapturedWorldInfoListCalls(state, list, appendCalls, appendOverride = null) {
    if (!(list instanceof HTMLElement) || !Array.isArray(appendCalls) || appendCalls.length === 0) {
        return;
    }

    const append = appendOverride || state.originalAppend;

    if (typeof append !== 'function') {
        for (const args of appendCalls) {
            list.append(...normalizeWorldInfoAppendArguments(args));
        }
        return;
    }

    const target = globalThis.jQuery?.(list);

    if (!target) {
        return;
    }

    for (const args of appendCalls) {
        append.apply(target, args);
    }
}

function normalizeWorldInfoAppendArguments(args) {
    const nodes = [];

    for (const arg of args) {
        if (arg instanceof Node) {
            nodes.push(arg);
        } else if (arg?.jquery && typeof arg.toArray === 'function') {
            nodes.push(...arg.toArray());
        } else if (Array.isArray(arg)) {
            for (const item of arg) {
                if (item instanceof Node) {
                    nodes.push(item);
                } else if (item?.jquery && typeof item.toArray === 'function') {
                    nodes.push(...item.toArray());
                }
            }
        } else if (typeof arg === 'string') {
            const template = document.createElement('template');
            template.innerHTML = arg;
            nodes.push(...template.content.childNodes);
        }
    }

    return nodes;
}

function refreshWorldInfoVueListAfterAppend(list) {
    if (settings.worldInfoSearchReplaceEnabled !== false) {
        installWorldInfoSearchReplacePanel();
    } else {
        removeWorldInfoSearchReplacePanel();
    }
    applyWorldInfoPopupLayout();
    applyWorldInfoMobileHeaderLayouts(list);
    applyWorldInfoMobileExpandedLayouts(list);

    list.querySelectorAll('textarea[name="comment"]').forEach(textarea => {
        if (textarea instanceof HTMLTextAreaElement && !globalThis.CSS?.supports?.('field-sizing', 'content')) {
            void resetScrollHeight(textarea);
        }
    });
}

function unmountWorldInfoVueListApp(state = getWorldInfoVueListOptimizationState()) {
    if (!state.app) {
        return;
    }

    try {
        state.app.unmount();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to unmount World Info Vue list`, error);
    }

    state.app = null;
    state.root = null;
}

async function loadWorldInfoVueListModule(state = getWorldInfoVueListOptimizationState()) {
    if (!state.modulePromise) {
        state.modulePromise = import('vue');
    }

    return state.modulePromise;
}

export {
    appendCapturedWorldInfoListCalls,
    applyWorldInfoListOptimization,
    createWorldInfoVueListRootComponent,
    getWorldInfoVueListOptimizationState,
    installWorldInfoVueListAppendCapturePatch,
    installWorldInfoVueListPaginationPatch,
    loadWorldInfoVueListModule,
    mountWorldInfoVueListApp,
    normalizeWorldInfoAppendArguments,
    refreshWorldInfoVueListAfterAppend,
    renderWorldInfoVueListFromNativeCallback,
    renderWorldInfoVueListFromNativeCallbackLocked,
    restoreWorldInfoVueListAppendCapturePatch,
    restoreWorldInfoVueListPaginationPatch,
    shouldWrapWorldInfoPaginationCall,
    unmountWorldInfoVueListApp,
};
