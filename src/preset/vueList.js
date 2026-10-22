import { t } from '@sillytavern/scripts/i18n';
import { promptManager } from '@sillytavern/scripts/openai';
import { getStringHash } from '@sillytavern/scripts/utils';
import { PRESET_DRAG_READY_CLASS, PRESET_DRAG_STYLE_ID, PRESET_GROUP_GENERATION_GATE_PATCH_KEY, PRESET_PROMPT_MANAGER_LIST_SELECTOR, PRESET_VUE_COLLAPSE_ANIMATION_MS, PRESET_VUE_DRAGGING_BODY_CLASS, PRESET_VUE_FAVORITES_ENTRY_ID, PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID, PRESET_VUE_LIST_GAP_VARIABLE, PRESET_VUE_LIST_HOST_CLASS, PRESET_VUE_LIST_MANAGER_KEY, PRESET_VUE_LIST_RENDER_PATCH_KEY } from './constants.js';
import { applyPresetDragOptimization, applyPresetDragOptimizationCss, cancelPromptManagerCustomDragPending, clearPromptManagerCustomDragList, finishPromptManagerCustomDrag, installPresetDragOptimizationHandlers, isPromptManagerReadyForCustomDrag, patchPromptManagerDraggable, preparePromptManagerCustomDragList, removePresetDragOptimizationHandlers, restorePromptManagerStockDraggable } from './dragCustom.js';
import { getCurrentPresetPromptFavoritesState } from './favorites.js';
import { loadPresetGlobalPromptLibrary, normalizePresetGlobalPromptLibraryGroups, normalizePresetGlobalPromptLibraryItems, syncPresetVueGlobalLibraryModelState, syncPresetVueGlobalLibrarySelectionState } from './globalLibrary.js';
import { applyPresetGroupRenameCleanup, getCurrentPresetPromptOrderIds, getPresetPromptGroupState, normalizePresetPromptGroupState, savePresetPromptGroupSettings, syncCurrentPresetPromptGroupStateToPresetExtensionField } from './groupState.js';
import { clearPresetVuePromptOrderSaveSchedule, flushPendingPresetPromptChangesSafely, installPresetExportPendingChangesGuard, installPresetUpdatePendingChangesGuard, markPresetPromptServiceSettingsSavePending } from './pendingChanges.js';
import { LOG_PREFIX, extensionState, savePresetOptimizationSettings, settings } from './state.js';
import { isPromptManagerReadyForFastPresetSwitch, renderPromptManagerListItemsFast, schedulePromptManagerDraggableInit } from './switchFast.js';
import { isPresetGroupingEnabled } from './util.js';
import { cancelPresetVuePromptGroupHeaderCustomDrag, clearPresetVuePromptDragReadyFeedback, clearPresetVuePromptManualDragState, installPresetVueDynamicDragDelayHandlers, removePresetVueDynamicDragDelayHandlers, setPresetVuePromptDragScrollGuardEnabled, setPresetVuePromptDragging } from './vueDrag.js';
import { buildPresetVuePromptListItems, createPresetVuePromptListRootComponent } from './vueRender.js';

function applyPresetGrouping() {
    installPresetExportPendingChangesGuard();
    installPresetUpdatePendingChangesGuard();
    applyPresetGroupRenameCleanup();

    if (!isPresetGroupingEnabled()) {
        flushPendingPresetPromptChangesSafely();
        removePresetPromptGroupGenerationGatePatch();
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
    installPresetPromptGroupGenerationGatePatch();
    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();
    void installPresetVuePromptListManager();
}

function readPresetVuePromptListGapValue(list) {
    const styles = getComputedStyle(list);
    const gap = styles.rowGap && styles.rowGap !== 'normal'
        ? styles.rowGap
        : styles.gap;

    return gap && gap !== 'normal' ? gap : '';
}

function applyPresetVuePromptListGapValue(list, gap) {
    if (!(list instanceof HTMLElement)) {
        return;
    }

    if (gap) {
        list.style.setProperty(PRESET_VUE_LIST_GAP_VARIABLE, gap);
    } else {
        list.style.removeProperty(PRESET_VUE_LIST_GAP_VARIABLE);
    }
}

function syncPresetVuePromptListGapVariable(list) {
    if (!(list instanceof HTMLElement)) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();

    // Cache hit: the gap only changes on theme/font edits (rare, off the hot path),
    // so reuse the last measured value and just write the CSS variable. This write
    // does not force a synchronous layout, so the per-render reflow is eliminated.
    if (manager.cachedListGapList === list && manager.cachedListGap !== null) {
        applyPresetVuePromptListGapValue(list, manager.cachedListGap);
        return;
    }

    // Cache miss: defer the getComputedStyle read to the next animation frame.
    // Layout already runs at that point, so reading the gap there piggybacks on
    // it instead of triggering an extra forced reflow inside the render path.
    if (manager.listGapReadFrame !== null || typeof requestAnimationFrame !== 'function') {
        // No rAF available (or one already queued): fall back to an immediate read once.
        if (typeof requestAnimationFrame !== 'function') {
            const gap = readPresetVuePromptListGapValue(list);
            manager.cachedListGap = gap;
            manager.cachedListGapList = list;
            applyPresetVuePromptListGapValue(list, gap);
        }
        return;
    }

    manager.listGapReadFrame = requestAnimationFrame(() => {
        manager.listGapReadFrame = null;

        if (!(list instanceof HTMLElement) || !list.isConnected) {
            return;
        }

        const gap = readPresetVuePromptListGapValue(list);
        manager.cachedListGap = gap;
        manager.cachedListGapList = list;
        applyPresetVuePromptListGapValue(list, gap);
    });
}

function invalidatePresetVuePromptListGapCache() {
    const manager = getPresetVuePromptListManagerState();
    manager.cachedListGap = null;
    manager.cachedListGapList = null;

    if (manager.listGapReadFrame !== null && typeof cancelAnimationFrame === 'function') {
        cancelAnimationFrame(manager.listGapReadFrame);
    }

    manager.listGapReadFrame = null;
}

async function installPresetVuePromptListManager() {
    if (!isPresetGroupingEnabled()) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    manager.enabled = true;
    installPresetPromptGroupGenerationGatePatch();
    installPresetVuePromptListRenderPatch();
    patchPromptManagerDraggable();
    applyPresetDragOptimizationCss();
    installPresetVueDynamicDragDelayHandlers();

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
            preparePromptManagerCustomDragList(manager.root, { signature: manager.lastStructureSignature });
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
        preparePromptManagerCustomDragList(manager.root, { signature: manager.lastStructureSignature });
        void loadPresetGlobalPromptLibrary().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to load preset global prompt library`, error);
        });
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

    if (!settings.presetSwitchOptimizationEnabled) {
        removePresetVuePromptListRenderPatch();
    }
    removePresetVueDynamicDragDelayHandlers();

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
    clearPresetVuePromptGroupBodyUnmountTimers(manager);
    cancelPresetVuePromptBodyHeightAnimations(manager);

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
    clearPresetVuePromptManualDragState(manager);
    manager.currentTopLevelDropIndex = null;
    manager.currentDropTargetGroupId = null;
    manager.draggedPromptId = null;
    cancelPresetVuePromptGroupHeaderCustomDrag(manager, { suppress: false });
    clearPresetVuePromptDragReadyFeedback(manager);
    manager.groupHeaderGesture = null;
    manager.groupHeaderCustomDrag = null;
    manager.lastGroupHeaderToggleAt = 0;
    manager.lastGroupHeaderGestureCanceledAt = 0;
    manager.lastDragStartedAt = 0;
    manager.lastDragEndedAt = 0;
    manager.lastSyncSignature = '';
    manager.lastStructureSignature = '';
    manager.lastRenderPatchSyncCycle = 0;
    manager.dragPreparedList = null;
    manager.dragPreparedSignature = '';
    invalidatePresetVuePromptListGapCache();
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
            pendingOrderSave: false,
            dragSnapshot: null,
            pendingServiceSettingsSave: false,
            pendingGroupSettingsSave: false,
            pendingChangesSavePromise: null,
            pendingChangesSaveInFlight: false,
            pendingPresetPromptServiceSaves: null,
            pendingPresetPromptGroupSaves: null,
            pendingOpenAiPresetSaves: null,
            presetPromptSaveRevisions: null,
            nextPresetPromptSaveRevision: 0,
            openAiPresetSaveRequestStates: null,
            pendingVisibilityTimer: null,
            pendingVisibilityObserver: null,
            groupBodyUnmountTimers: null,
            globalLibraryCollapsed: true,
            globalLibraryItems: [],
            globalLibraryGroups: [],
            globalLibrarySelecting: false,
            globalLibrarySelectedIds: null,
            globalLibraryLoaded: false,
            globalLibraryLoading: false,
            globalLibraryError: null,
            globalLibraryLoadPromise: null,
            globalLibrarySavePromise: null,
            globalLibraryBridgePromise: null,
            dragReadyFeedbackTimer: null,
            dragReadyFeedbackElement: null,
            dragReadyFeedbackNotified: false,
            currentDropTargetGroupId: null,
            currentDropTargetElement: null,
            currentTopLevelDropIndex: null,
            draggedPromptId: null,
            draggedItem: null,
            dragPlacement: null,
            dragIndicatorElement: null,
            dragIndicatorRectKey: null,
            dragPlacementFrame: null,
            dragLayoutCache: null,
            dragScrollContainer: null,
            dragAutoScrollFrame: null,
            lastDragPoint: null,
            groupHeaderGesture: null,
            groupHeaderCustomDrag: null,
            lastGroupHeaderToggleAt: 0,
            lastGroupHeaderGestureCanceledAt: 0,
            lastDragStartedAt: 0,
            lastDragEndedAt: 0,
            enabled: false,
            lastSyncSignature: '',
            lastStructureSignature: '',
            lastRenderPatchSyncCycle: 0,
            dragPreparedList: null,
            dragPreparedSignature: '',
            cachedListGap: null,
            cachedListGapList: null,
            listGapReadFrame: null,
            bodyHeightAnimations: [],
            bodyHeightTransitionCycle: 0,
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
        manager.modulePromise = import('vue');
    }

    return manager.modulePromise;
}

async function loadPresetVueDraggableModule() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.draggableModulePromise) {
        manager.draggableModulePromise = import('vue-draggable-next');
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
            if (settings.presetSwitchOptimizationEnabled && isPromptManagerReadyForFastPresetSwitch()) {
                await renderPromptManagerListItemsFast();
                schedulePromptManagerDraggableInit();
                return undefined;
            }

            return originalRenderPromptManagerListItems.apply(this, args);
        }

        await installPresetVuePromptListManager();
        syncPresetVuePromptListManagerState();
        const manager = getPresetVuePromptListManagerState();
        manager.lastRenderPatchSyncCycle = extensionState.presetPromptManagerFastRenderCycle || 0;
        preparePromptManagerCustomDragList(getPromptManagerListElement(), { signature: manager.lastStructureSignature });
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

function installPresetPromptGroupGenerationGatePatch() {
    if (
        !promptManager
        || typeof promptManager.getPromptCollection !== 'function'
        || typeof promptManager.isPromptDisabledForActiveCharacter !== 'function'
    ) {
        return false;
    }

    const existingPatch = extensionState[PRESET_GROUP_GENERATION_GATE_PATCH_KEY];

    if (
        existingPatch?.manager === promptManager
        && promptManager.getPromptCollection === existingPatch.patchedGetPromptCollection
        && promptManager.isPromptDisabledForActiveCharacter === existingPatch.patchedIsPromptDisabledForActiveCharacter
    ) {
        return true;
    }

    if (
        promptManager.getPromptCollection[PRESET_GROUP_GENERATION_GATE_PATCH_KEY]
        && promptManager.isPromptDisabledForActiveCharacter[PRESET_GROUP_GENERATION_GATE_PATCH_KEY]
    ) {
        extensionState[PRESET_GROUP_GENERATION_GATE_PATCH_KEY] = {
            manager: promptManager,
            originalGetPromptCollection: promptManager.getPromptCollection.__baiBaiToolkitOriginalGetPromptCollection,
            patchedGetPromptCollection: promptManager.getPromptCollection,
            originalIsPromptDisabledForActiveCharacter: promptManager.isPromptDisabledForActiveCharacter.__baiBaiToolkitOriginalIsPromptDisabledForActiveCharacter,
            patchedIsPromptDisabledForActiveCharacter: promptManager.isPromptDisabledForActiveCharacter,
        };
        return true;
    }

    const originalGetPromptCollection = promptManager.getPromptCollection;
    const originalIsPromptDisabledForActiveCharacter = promptManager.isPromptDisabledForActiveCharacter;

    const patchedGetPromptCollection = function (...args) {
        if (!isPresetGroupingEnabled()) {
            return originalGetPromptCollection.apply(this, args);
        }

        const poweredOffPromptIds = getPresetPromptGroupPoweredOffPromptIds();

        if (!poweredOffPromptIds.size) {
            return originalGetPromptCollection.apply(this, args);
        }

        const restoreEntries = temporarilyDisablePresetPromptOrderEntriesForGroupGate(this, poweredOffPromptIds);

        try {
            const collection = originalGetPromptCollection.apply(this, args);
            patchPromptCollectionAddForPresetGroupGate(collection, poweredOffPromptIds);
            return collection;
        } finally {
            restorePresetPromptOrderEntriesForGroupGate(restoreEntries);
        }
    };

    const patchedIsPromptDisabledForActiveCharacter = function (...args) {
        const stockDisabled = originalIsPromptDisabledForActiveCharacter.apply(this, args);

        if (stockDisabled || !isPresetGroupingEnabled()) {
            return stockDisabled;
        }

        return isPresetPromptDisabledByGroupGate(args[0]);
    };

    patchedGetPromptCollection[PRESET_GROUP_GENERATION_GATE_PATCH_KEY] = true;
    patchedGetPromptCollection.__baiBaiToolkitOriginalGetPromptCollection = originalGetPromptCollection;
    patchedIsPromptDisabledForActiveCharacter[PRESET_GROUP_GENERATION_GATE_PATCH_KEY] = true;
    patchedIsPromptDisabledForActiveCharacter.__baiBaiToolkitOriginalIsPromptDisabledForActiveCharacter = originalIsPromptDisabledForActiveCharacter;

    promptManager.getPromptCollection = patchedGetPromptCollection;
    promptManager.isPromptDisabledForActiveCharacter = patchedIsPromptDisabledForActiveCharacter;
    extensionState[PRESET_GROUP_GENERATION_GATE_PATCH_KEY] = {
        manager: promptManager,
        originalGetPromptCollection,
        patchedGetPromptCollection,
        originalIsPromptDisabledForActiveCharacter,
        patchedIsPromptDisabledForActiveCharacter,
    };
    return true;
}

function removePresetPromptGroupGenerationGatePatch() {
    const patch = extensionState[PRESET_GROUP_GENERATION_GATE_PATCH_KEY];

    if (!patch) {
        return;
    }

    if (patch.manager?.getPromptCollection === patch.patchedGetPromptCollection) {
        patch.manager.getPromptCollection = patch.originalGetPromptCollection;
    }

    if (patch.manager?.isPromptDisabledForActiveCharacter === patch.patchedIsPromptDisabledForActiveCharacter) {
        patch.manager.isPromptDisabledForActiveCharacter = patch.originalIsPromptDisabledForActiveCharacter;
    }

    delete extensionState[PRESET_GROUP_GENERATION_GATE_PATCH_KEY];
}

function getPresetPromptGroupPoweredOffPromptIds(validPromptIds = getCurrentPresetPromptOrderIds()) {
    if (!isPresetGroupingEnabled() || !validPromptIds.length) {
        return new Set();
    }

    const validPromptIdSet = new Set(validPromptIds);
    const groupState = getPresetPromptGroupState();
    normalizePresetPromptGroupState(groupState, validPromptIdSet);
    const poweredOffGroupIds = new Set(
        groupState.groups
            .filter(group => group?.enabled === false)
            .map(group => group.id),
    );

    if (!poweredOffGroupIds.size) {
        return new Set();
    }

    const poweredOffPromptIds = new Set();

    for (const [promptId, meta] of Object.entries(groupState.prompts ?? {})) {
        if (validPromptIdSet.size && !validPromptIdSet.has(promptId)) {
            continue;
        }

        if (poweredOffGroupIds.has(meta?.groupId)) {
            poweredOffPromptIds.add(promptId);
        }
    }

    return poweredOffPromptIds;
}

function isPresetPromptDisabledByGroupGate(promptId) {
    if (!promptId) {
        return false;
    }

    return getPresetPromptGroupPoweredOffPromptIds().has(String(promptId));
}

function temporarilyDisablePresetPromptOrderEntriesForGroupGate(manager, promptIds) {
    const promptOrder = typeof manager?.getPromptOrderForCharacter === 'function'
        ? manager.getPromptOrderForCharacter(manager.activeCharacter)
        : [];
    const restoreEntries = [];

    for (const entry of promptOrder ?? []) {
        if (!entry?.identifier || !promptIds.has(entry.identifier) || entry.enabled === false) {
            continue;
        }

        restoreEntries.push({ entry, enabled: entry.enabled });
        entry.enabled = false;
    }

    return restoreEntries;
}

function restorePresetPromptOrderEntriesForGroupGate(restoreEntries) {
    for (const restoreEntry of restoreEntries ?? []) {
        if (restoreEntry?.entry) {
            restoreEntry.entry.enabled = restoreEntry.enabled;
        }
    }
}

function patchPromptCollectionAddForPresetGroupGate(collection, poweredOffPromptIds) {
    if (!collection || typeof collection.add !== 'function' || collection.add[PRESET_GROUP_GENERATION_GATE_PATCH_KEY]) {
        return collection;
    }

    const originalAdd = collection.add;
    const patchedAdd = function (...prompts) {
        const allowedPrompts = prompts.filter(prompt => !prompt?.identifier || !poweredOffPromptIds.has(prompt.identifier));

        if (!allowedPrompts.length) {
            return undefined;
        }

        return originalAdd.apply(this, allowedPrompts);
    };

    patchedAdd[PRESET_GROUP_GENERATION_GATE_PATCH_KEY] = true;
    patchedAdd.__baiBaiToolkitOriginalPromptCollectionAdd = originalAdd;
    collection.add = patchedAdd;
    return collection;
}

function createPresetVuePromptListModel() {
    return {
        globalLibrary: null,
        items: [],
        listClassName: `text_pole ${PRESET_DRAG_READY_CLASS}`,
        renderKey: 0,
        reclaimKey: 0,
        mountedGroupBodies: {},
        dragging: false,
        rangeSelection: {
            active: false,
            name: '',
            startId: null,
            endId: null,
            hoverId: null,
        },
        search: {
            open: false,
            query: '',
            revision: 0,
            collapsedGroups: {},
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

    const { renderSignature, structureSignature } = getPresetVuePromptListSyncSignatures(manager);
    if (renderSignature && manager.lastSyncSignature === renderSignature) {
        syncPresetVueGlobalLibrarySelectionState(manager.state);
        manager.lastStructureSignature = structureSignature;

        // 签名不含条目内容:搜索过滤中要让编辑过内容的条目按新内容重新匹配。
        if (manager.state.search?.open && manager.state.search.query) {
            manager.state.search.revision += 1;
        }

        return true;
    }

    syncPresetVueGlobalLibraryModelState(manager.state);
    manager.state.items = buildPresetVuePromptListItems();
    syncPresetVuePromptGroupBodyMountState(manager.state);
    manager.lastSyncSignature = renderSignature;
    manager.lastStructureSignature = structureSignature;
    return true;
}

// 当某次结构变更已通过命令式方式就地同步到 DOM 与 Vue model 后,
// 调用此函数把签名基线推进到当前状态,使随后的 syncPresetVuePromptListManagerState
// 短路命中、不再触发整列重建。
function markPresetVuePromptListSyncSignatureCurrent() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.state) {
        return false;
    }

    const { renderSignature, structureSignature } = getPresetVuePromptListSyncSignatures(manager);
    manager.lastSyncSignature = renderSignature;
    manager.lastStructureSignature = structureSignature;
    return true;
}

// 「分组后把编辑按钮收进菜单」开关只影响条目控件的渲染位置(不改条目数据),
// 普通 sync 会因签名命中而短路,这里清空签名基线强制整列重渲染一次。仅在分组已挂载时生效。
function refreshPresetVuePromptListControlsLayout() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.state) {
        return;
    }

    manager.lastSyncSignature = '';
    syncPresetVuePromptListManagerState();
}

function getPresetVuePromptListSyncSignatures(manager = getPresetVuePromptListManagerState()) {
    const promptOrder = promptManager?.getPromptOrderForCharacter?.(promptManager.activeCharacter) ?? [];
    const prompts = Array.isArray(promptManager?.serviceSettings?.prompts)
        ? promptManager.serviceSettings.prompts.filter(Boolean)
        : [];
    const promptById = new Map(prompts.map(prompt => [prompt.identifier, prompt]));
    const groupState = getPresetPromptGroupState();
    const favoriteState = getCurrentPresetPromptFavoritesState(
        promptOrder.map(entry => entry?.identifier).filter(Boolean),
    );
    const toggleDisabled = promptManager?.configuration?.toggleDisabled ?? [];
    const overriddenPrompts = Array.isArray(promptManager?.overriddenPrompts) ? promptManager.overriddenPrompts : [];
    const promptParts = promptOrder.map((entry, index) => {
        const prompt = promptById.get(entry?.identifier);
        return [
            index,
            entry?.identifier || '',
            entry?.enabled === false ? 0 : 1,
            prompt?.name || '',
            prompt?.role || '',
            prompt?.marker ? 1 : 0,
            prompt?.system_prompt ? 1 : 0,
            prompt?.forbid_overrides ? 1 : 0,
            prompt?.injection_position ?? '',
            prompt?.injection_depth ?? '',
        ].join(':');
    });
    const groupSignature = JSON.stringify({
        groups: groupState.groups ?? [],
        prompts: groupState.prompts ?? {},
    });
    const favoriteSignature = JSON.stringify(favoriteState);
    const globalLibrarySignature = JSON.stringify({
        collapsed: Boolean(manager.globalLibraryCollapsed),
        loading: Boolean(manager.globalLibraryLoading),
        loaded: Boolean(manager.globalLibraryLoaded),
        error: manager.globalLibraryError ? String(manager.globalLibraryError) : '',
        groups: normalizePresetGlobalPromptLibraryGroups(manager.globalLibraryGroups)
            .map(group => [group.id || '', group.name || '', group.collapsed ? 1 : 0]),
        items: normalizePresetGlobalPromptLibraryItems(manager.globalLibraryItems)
            .map(item => [
                item.id || '',
                item.name || '',
                item.groupId || '',
                getStringHash(String(item.content ?? '')),
            ]),
    });
    const structureSignature = getStringHash([
        promptParts.join('|'),
        groupSignature,
        favoriteSignature,
        globalLibrarySignature,
        Array.from(toggleDisabled).join('|'),
        overriddenPrompts.join('|'),
    ].join('||'));
    // Token 数变化不再纳入 renderSignature:token 显示走命令式 DOM 更新
    // (updatePromptManagerTokenDisplay),避免每次 token 重算都重建整个 Vue 列表。
    const renderSignature = structureSignature;

    return { renderSignature, structureSignature };
}

function rebuildPresetVuePromptListDraggable() {
    const manager = getPresetVuePromptListManagerState();

    if (!manager.state) {
        return false;
    }

    manager.state.renderKey += 1;
    return true;
}

function isPresetVuePromptDragLockSettingEnabled() {
    return settings.presetVueDragLocked === true;
}

function isPresetVuePromptDragLocked() {
    // 搜索框里有关键词时列表只显示部分条目,拖拽落点会有歧义,临时视同锁定(不改用户设置)。
    // 这个临时锁不重建 draggable(会打断输入),靠 Sortable 的 filter 和 move/put 检查动态拦住。
    const search = getPresetVuePromptListManagerState().state?.search;
    return isPresetVuePromptDragLockSettingEnabled() || Boolean(search?.open && String(search.query ?? '').trim());
}

function togglePresetVuePromptDragLocked() {
    const nextLocked = settings.presetVueDragLocked !== true;
    settings.presetVueDragLocked = nextLocked;

    if (nextLocked) {
        cancelPromptManagerCustomDragPending();
        finishPromptManagerCustomDrag({ cancelled: true });
        cancelPresetVuePromptGroupHeaderCustomDrag(getPresetVuePromptListManagerState());
        setPresetVuePromptDragging(getPresetVuePromptListManagerState().state, false);
        getPresetVuePromptListManagerState().dragSnapshot = null;
    }

    rebuildPresetVuePromptListDraggable();

    if (typeof savePresetOptimizationSettings === 'function') {
        savePresetOptimizationSettings();
    }
}

function syncPresetVuePromptGroupBodyMountState(model) {
    if (!model || !Array.isArray(model.items)) {
        return;
    }

    if (!model.mountedGroupBodies || typeof model.mountedGroupBodies !== 'object') {
        model.mountedGroupBodies = {};
    }

    const manager = getPresetVuePromptListManagerState();
    const validGroupIds = new Set();
    const mountItems = [
        model.globalLibrary,
        ...model.items,
    ].filter(Boolean);

    for (const item of mountItems) {
        const mountId = getPresetVuePromptBodyMountId(item);

        if (!mountId) {
            continue;
        }

        validGroupIds.add(mountId);

        if (!item.collapsed) {
            clearPresetVuePromptGroupBodyUnmountTimer(manager, mountId);
            model.mountedGroupBodies[mountId] = true;
            continue;
        }

        if (!hasPresetVuePromptGroupBodyUnmountTimer(manager, mountId)) {
            delete model.mountedGroupBodies[mountId];
        }
    }

    for (const groupId of Object.keys(model.mountedGroupBodies)) {
        if (!validGroupIds.has(groupId)) {
            delete model.mountedGroupBodies[groupId];
            clearPresetVuePromptGroupBodyUnmountTimer(manager, groupId);
        }
    }
}

function getPresetVuePromptBodyMountId(item) {
    if (item?.type === 'group' && item.groupId) {
        return item.groupId;
    }

    if (item?.type === 'favorites') {
        return PRESET_VUE_FAVORITES_ENTRY_ID;
    }

    if (item?.type === 'global-library') {
        return PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID;
    }

    return null;
}

function getPresetVuePromptGroupBodyUnmountTimers(manager = getPresetVuePromptListManagerState()) {
    if (!(manager.groupBodyUnmountTimers instanceof Map)) {
        manager.groupBodyUnmountTimers = new Map();
    }

    return manager.groupBodyUnmountTimers;
}

function hasPresetVuePromptGroupBodyUnmountTimer(manager, groupId) {
    return manager.groupBodyUnmountTimers instanceof Map && manager.groupBodyUnmountTimers.has(groupId);
}

function clearPresetVuePromptGroupBodyUnmountTimer(manager, groupId) {
    if (!(manager.groupBodyUnmountTimers instanceof Map)) {
        return;
    }

    const timer = manager.groupBodyUnmountTimers.get(groupId);

    if (timer) {
        clearTimeout(timer);
    }

    manager.groupBodyUnmountTimers.delete(groupId);
}

function clearPresetVuePromptGroupBodyUnmountTimers(manager = getPresetVuePromptListManagerState()) {
    if (!(manager.groupBodyUnmountTimers instanceof Map)) {
        return;
    }

    for (const timer of manager.groupBodyUnmountTimers.values()) {
        clearTimeout(timer);
    }

    manager.groupBodyUnmountTimers.clear();
}

function setPresetVuePromptGroupBodyMounted(model, groupId, mounted) {
    if (!model || !groupId) {
        return;
    }

    if (!model.mountedGroupBodies || typeof model.mountedGroupBodies !== 'object') {
        model.mountedGroupBodies = {};
    }

    if (mounted) {
        model.mountedGroupBodies[groupId] = true;
        return;
    }

    delete model.mountedGroupBodies[groupId];
}

// 展开/收起的高度动画改为纯 CSS 驱动(grid-template-rows: 0fr↔1fr,见样式表)。
// 这里只负责执行状态变更(mount/collapsed 切换),动画交给浏览器,
// 避免 JS 用 WAAPI 对 body 跑 height 动画时触发的合成层漏绘 bug(展开后空白)。
function runPresetVuePromptBodyHeightTransition(mountId, expanding, mutator) {
    if (typeof mutator !== 'function') {
        return undefined;
    }

    return mutator();
}

// 保留为安全空操作:外部(卸载、开始拖拽)仍会调用它,纯 CSS 方案下无需取消任何 JS 动画。
function cancelPresetVuePromptBodyHeightAnimations() {
}

function isPresetVuePromptGroupBodyMounted(model, item) {
    const mountId = getPresetVuePromptBodyMountId(item);

    if (!mountId) {
        return false;
    }

    return item.collapsed
        ? Boolean(model?.mountedGroupBodies?.[mountId])
        : true;
}

function schedulePresetVuePromptGroupBodyUnmount(groupId) {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;

    if (!model || !groupId) {
        return;
    }

    clearPresetVuePromptGroupBodyUnmountTimer(manager, groupId);

    const timer = setTimeout(() => {
        clearPresetVuePromptGroupBodyUnmountTimer(manager, groupId);

        const groupItem = [
            model.globalLibrary,
            ...(model.items ?? []),
        ].find(item => getPresetVuePromptBodyMountId(item) === groupId);

        if (!groupItem || groupItem.collapsed) {
            setPresetVuePromptGroupBodyMounted(model, groupId, false);
        }
    }, PRESET_VUE_COLLAPSE_ANIMATION_MS);

    getPresetVuePromptGroupBodyUnmountTimers(manager).set(groupId, timer);
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

export {
    applyPresetGrouping,
    applyPresetVuePromptListGapValue,
    cancelPresetVuePromptBodyHeightAnimations,
    clearPresetVuePromptGroupBodyUnmountTimer,
    clearPresetVuePromptGroupBodyUnmountTimers,
    createPresetVuePromptListModel,
    ensurePromptManagerListAfterVueHost,
    getPresetPromptGroupPoweredOffPromptIds,
    getPresetVueListHostElement,
    getPresetVuePromptBodyMountId,
    getPresetVuePromptGroupBodyUnmountTimers,
    getPresetVuePromptListClassName,
    getPresetVuePromptListManagerState,
    getPresetVuePromptListSyncSignatures,
    getPromptManagerListElement,
    hasPresetVuePromptGroupBodyUnmountTimer,
    installPresetPromptGroupGenerationGatePatch,
    installPresetVuePromptListManager,
    installPresetVuePromptListRenderPatch,
    invalidatePresetVuePromptListGapCache,
    isPresetPromptDisabledByGroupGate,
    isPresetVuePromptDragLockSettingEnabled,
    isPresetVuePromptDragLocked,
    isPresetVuePromptGroupBodyMounted,
    isPresetVuePromptListDragging,
    isPresetVuePromptListManagerActive,
    isPromptManagerReadyForVuePromptList,
    loadPresetVueDraggableModule,
    loadPresetVueModule,
    markPresetVuePromptListSyncSignatureCurrent,
    patchPromptCollectionAddForPresetGroupGate,
    readPresetVuePromptListGapValue,
    rebuildPresetVuePromptListDraggable,
    refreshPresetVuePromptListControlsLayout,
    removePresetPromptGroupGenerationGatePatch,
    removePresetVuePromptListManager,
    removePresetVuePromptListRenderPatch,
    repairPresetPromptGroupStateIfNeeded,
    repairPresetPromptOrderDuplicatesIfNeeded,
    replacePromptManagerListWithVueHost,
    restorePresetPromptOrderEntriesForGroupGate,
    restorePromptManagerDragAfterVueRemove,
    restorePromptManagerListAfterVueRemove,
    runPresetVuePromptBodyHeightTransition,
    schedulePresetVuePromptGroupBodyUnmount,
    schedulePresetVuePromptListManagerSync,
    setPresetVuePromptGroupBodyMounted,
    syncPresetVuePromptGroupBodyMountState,
    syncPresetVuePromptListGapVariable,
    syncPresetVuePromptListManagerState,
    temporarilyDisablePresetPromptOrderEntriesForGroupGate,
    togglePresetVuePromptDragLocked,
    unmountPresetVuePromptListApp,
};
