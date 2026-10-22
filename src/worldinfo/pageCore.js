import { AutoComplete } from '@sillytavern/scripts/autocomplete/AutoComplete';
import { WORLD_INFO_CONTENT_TEXTAREA_SELECTOR, WORLD_INFO_DEFERRED_MACROS_DATASET_KEY, WORLD_INFO_DEFERRED_MACROS_VALUE_DATASET_KEY, WORLD_INFO_FLOATING_AUTOCOMPLETE_PATCH_KEY, WORLD_INFO_PAGE_APPEND_PATCH_KEY } from './constants.js';
import { installWorldInfoEntryVisibility, removeWorldInfoEntryVisibility } from './entryVisibility.js';
import { installWorldInfoScrollHandlerPatch, restoreWorldInfoScrollHandler } from './scrollPatch.js';
import { LOG_PREFIX, getWorldInfoPageOptimizationState, settings, toKebabCase } from './state.js';

function applyWorldInfoPageOptimization() {
    const state = getWorldInfoPageOptimizationState();
    state.enabled = Boolean(settings.worldInfoPageOptimizationEnabled);

    if (!state.enabled) {
        removeWorldInfoPageOptimization(state);
        return;
    }

    patchWorldInfoFloatingAutocompletePosition(state);
    restoreLegacyWorldInfoPageAppendPatch(state);
    installWorldInfoMacroDeferralObserver(state);
    installDeferredMacroActivationListeners(state);
    installWorldInfoEntryVisibility(state);
    installWorldInfoScrollHandlerPatch(state);

    console.debug(`${LOG_PREFIX} World info page optimization enabled`);
}

function removeWorldInfoPageOptimization(state = getWorldInfoPageOptimizationState()) {
    restoreWorldInfoScrollHandler(state);
    removeWorldInfoEntryVisibility(state);
    restoreDeferredWorldInfoMacroTextareas();
    removeDeferredMacroActivationListeners(state);
    removeWorldInfoMacroDeferralObserver(state);
    restoreLegacyWorldInfoPageAppendPatch(state);
    restoreWorldInfoFloatingAutocompletePosition(state);
}

function patchWorldInfoFloatingAutocompletePosition(state) {
    if (state[WORLD_INFO_FLOATING_AUTOCOMPLETE_PATCH_KEY]) {
        return;
    }

    const originalUpdateFloatingPosition = AutoComplete?.prototype?.updateFloatingPosition;

    if (typeof originalUpdateFloatingPosition !== 'function') {
        console.warn(`${LOG_PREFIX} AutoComplete floating positioning is unavailable; World Info autocomplete optimization was not installed`);
        return;
    }

    if (originalUpdateFloatingPosition.__baiBaiToolkitWorldInfoFloatingAutocompletePatched) {
        state[WORLD_INFO_FLOATING_AUTOCOMPLETE_PATCH_KEY] = true;
        return;
    }

    function guardedUpdateFloatingPosition(...args) {
        if (!this.isActive) {
            return;
        }

        return originalUpdateFloatingPosition.apply(this, args);
    }

    guardedUpdateFloatingPosition.__baiBaiToolkitWorldInfoFloatingAutocompletePatched = true;
    guardedUpdateFloatingPosition.__baiBaiToolkitWorldInfoFloatingAutocompleteOriginal = originalUpdateFloatingPosition;
    AutoComplete.prototype.updateFloatingPosition = guardedUpdateFloatingPosition;
    state[WORLD_INFO_FLOATING_AUTOCOMPLETE_PATCH_KEY] = true;
}

function restoreWorldInfoFloatingAutocompletePosition(state) {
    const currentUpdateFloatingPosition = AutoComplete?.prototype?.updateFloatingPosition;

    if (currentUpdateFloatingPosition?.__baiBaiToolkitWorldInfoFloatingAutocompletePatched) {
        AutoComplete.prototype.updateFloatingPosition = currentUpdateFloatingPosition.__baiBaiToolkitWorldInfoFloatingAutocompleteOriginal;
    }

    state[WORLD_INFO_FLOATING_AUTOCOMPLETE_PATCH_KEY] = false;
}

function restoreLegacyWorldInfoPageAppendPatch(state) {
    const currentAppend = globalThis.jQuery?.fn?.append;

    if (currentAppend?.__baiBaiToolkitWorldInfoPageAppendPatched) {
        globalThis.jQuery.fn.append = currentAppend.__baiBaiToolkitWorldInfoPageAppendOriginal;
    }

    state[WORLD_INFO_PAGE_APPEND_PATCH_KEY] = false;
}

function installWorldInfoMacroDeferralObserver(state) {
    if (state.deferredMacroMutationObserver) {
        return;
    }

    const list = document.getElementById('world_popup_entries_list');

    if (!(list instanceof HTMLElement)) {
        return;
    }

    deferWorldInfoMacroTextareas(list);

    if (typeof MutationObserver !== 'function') {
        return;
    }

    const observer = new MutationObserver(mutations => {
        if (!settings.worldInfoPageOptimizationEnabled) {
            return;
        }

        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                deferWorldInfoMacroTextareas(node);
            }
        }
    });

    observer.observe(list, { childList: true, subtree: true });
    state.deferredMacroMutationObserver = observer;
}

function removeWorldInfoMacroDeferralObserver(state) {
    state.deferredMacroMutationObserver?.disconnect();
    state.deferredMacroMutationObserver = null;
}

function deferWorldInfoMacroTextareas(target) {
    if (!(target instanceof Element)) {
        return;
    }

    const outlets = target.matches('#world_popup_entries_list .inline-drawer-outlet')
        ? [target]
        : Array.from(target.querySelectorAll?.('#world_popup_entries_list .inline-drawer-outlet') ?? []);

    outlets.forEach(outlet => {
        outlet.querySelectorAll(WORLD_INFO_CONTENT_TEXTAREA_SELECTOR).forEach(textarea => {
            if (!(textarea instanceof HTMLTextAreaElement) || textarea.dataset[WORLD_INFO_DEFERRED_MACROS_DATASET_KEY] === 'true') {
                return;
            }

            textarea.dataset[WORLD_INFO_DEFERRED_MACROS_DATASET_KEY] = 'true';
            textarea.dataset[WORLD_INFO_DEFERRED_MACROS_VALUE_DATASET_KEY] = textarea.getAttribute('data-macros') ?? '';
            textarea.removeAttribute('data-macros');
        });
    });
}

function installDeferredMacroActivationListeners(state) {
    if (state.deferredMacroActivationHandler) {
        return;
    }

    const handler = (event) => {
        activateDeferredWorldInfoMacroFromEvent(event);
    };

    document.addEventListener('focusin', handler, true);
    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('click', handler, true);

    state.deferredMacroActivationHandler = handler;
}

function removeDeferredMacroActivationListeners(state) {
    const handler = state.deferredMacroActivationHandler;

    if (!handler) {
        return;
    }

    document.removeEventListener('focusin', handler, true);
    document.removeEventListener('pointerdown', handler, true);
    document.removeEventListener('click', handler, true);
    state.deferredMacroActivationHandler = null;
}

function activateDeferredWorldInfoMacroFromEvent(event) {
    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
        return;
    }

    const textarea = findDeferredWorldInfoMacroTextarea(target);

    if (textarea) {
        restoreDeferredWorldInfoMacroTextarea(textarea);
    }
}

function findDeferredWorldInfoMacroTextarea(target) {
    const directTextarea = target.closest?.(`textarea[data-${toKebabCase(WORLD_INFO_DEFERRED_MACROS_DATASET_KEY)}="true"]`);

    if (directTextarea instanceof HTMLTextAreaElement) {
        return directTextarea;
    }

    const maximizeButton = target.closest?.('.editor_maximize[data-for]');
    const sourceId = maximizeButton?.getAttribute('data-for');
    const source = sourceId ? document.getElementById(sourceId) : null;

    return source instanceof HTMLTextAreaElement && source.dataset[WORLD_INFO_DEFERRED_MACROS_DATASET_KEY] === 'true'
        ? source
        : null;
}

function restoreDeferredWorldInfoMacroTextareas() {
    document
        .querySelectorAll(`textarea[data-${toKebabCase(WORLD_INFO_DEFERRED_MACROS_DATASET_KEY)}="true"]`)
        .forEach(textarea => {
            if (textarea instanceof HTMLTextAreaElement) {
                restoreDeferredWorldInfoMacroTextarea(textarea);
            }
        });
}

function restoreDeferredWorldInfoMacroTextarea(textarea) {
    const value = textarea.dataset[WORLD_INFO_DEFERRED_MACROS_VALUE_DATASET_KEY] ?? '';
    textarea.setAttribute('data-macros', value);
    delete textarea.dataset[WORLD_INFO_DEFERRED_MACROS_DATASET_KEY];
    delete textarea.dataset[WORLD_INFO_DEFERRED_MACROS_VALUE_DATASET_KEY];
}

function refreshWorldInfoEditorIfOpen() {
    const refreshButton = document.getElementById('world_refresh');
    const worldEditor = document.getElementById('WorldInfo');

    if (!refreshButton || !worldEditor || getComputedStyle(worldEditor).display === 'none') {
        return;
    }

    setTimeout(() => refreshButton.click(), 0);
}

export {
    activateDeferredWorldInfoMacroFromEvent,
    applyWorldInfoPageOptimization,
    deferWorldInfoMacroTextareas,
    findDeferredWorldInfoMacroTextarea,
    installDeferredMacroActivationListeners,
    installWorldInfoMacroDeferralObserver,
    patchWorldInfoFloatingAutocompletePosition,
    refreshWorldInfoEditorIfOpen,
    removeDeferredMacroActivationListeners,
    removeWorldInfoMacroDeferralObserver,
    removeWorldInfoPageOptimization,
    restoreDeferredWorldInfoMacroTextarea,
    restoreDeferredWorldInfoMacroTextareas,
    restoreLegacyWorldInfoPageAppendPatch,
    restoreWorldInfoFloatingAutocompletePosition,
};
