import { t } from '@sillytavern/scripts/i18n';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { PRESET_DRAG_ACTIVE_CLASS, PRESET_DRAG_INDICATOR_CLASS, PRESET_DRAG_INTERACTIVE_SELECTOR, PRESET_PROMPT_MANAGER_LIST_SELECTOR, PRESET_VUE_DRAGGING_BODY_CLASS, PRESET_VUE_DRAG_PLACEMENT_LISTENER_KEY, PRESET_VUE_DRAG_READY_FEEDBACK_CLASS, PRESET_VUE_DYNAMIC_DRAG_DELAY_HANDLER_KEY, PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX, PRESET_VUE_GROUP_DROP_SURFACE_SELECTOR, PRESET_VUE_GROUP_DROP_TARGET_CLASS, PRESET_VUE_GROUP_HEADER_CUSTOM_DRAG_LISTENER_KEY, PRESET_VUE_GROUP_HEADER_DRAG_SUPPRESS_MS, PRESET_VUE_GROUP_HEADER_TOGGLE_DISTANCE_PX, PRESET_VUE_POINTER_START_THRESHOLD_PX, PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS, PRESET_VUE_TOUCH_DRAG_DELAY_MS, PRESET_VUE_TOUCH_SCROLL_GUARD_KEY, PRESET_VUE_TOUCH_START_THRESHOLD_PX, refreshPromptManagerTokensDebounced } from './constants.js';
import { autoScrollPromptManagerDragContainer, clearPromptManagerCustomDragPending, disablePromptManagerStockSortable, getPresetDragPoint, getPromptManagerDragScrollContainer } from './dragCustom.js';
import { closePresetPromptActionMenus } from './listActions.js';
import { getPresetVuePromptGroupAssignmentsFromModel, schedulePresetVuePromptOrderSaveAfterDrop } from './pendingChanges.js';
import { isPresetVuePromptSearchFiltering } from './search.js';
import { extensionState, settings } from './state.js';
import { areStringArraysEqual } from './util.js';
import { cancelPresetVuePromptBodyHeightAnimations, getPresetVuePromptListManagerState, getPromptManagerListElement, isPresetVuePromptDragLockSettingEnabled, isPresetVuePromptDragLocked, isPresetVuePromptGroupBodyMounted, isPresetVuePromptListDragging } from './vueList.js';
import { getPresetVuePromptFlatIds, sanitizePresetVuePromptListModel, togglePresetVuePromptGroupCollapsed } from './vueModel.js';
import { renderPresetVuePromptRow } from './vueRender.js';

function isPresetVuePromptTopLevelDragMoveAllowed(event, originalEvent) {
    const manager = getPresetVuePromptListManagerState();

    if (isPresetVuePromptDragLocked()) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    if (manager.state?.rangeSelection?.active) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    const dragged = manager.draggedItem ?? event?.draggedContext?.element;

    if (dragged?.type !== 'prompt' && dragged?.type !== 'group') {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    updatePresetVuePromptManualDragPlacementFromEvent(originalEvent ?? event?.originalEvent ?? event);
    return false;
}

function isPresetVuePromptGroupDragMoveAllowed(event, originalEvent) {
    const manager = getPresetVuePromptListManagerState();

    if (isPresetVuePromptDragLocked()) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    if (manager.state?.rangeSelection?.active) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    const dragged = manager.draggedItem ?? event?.draggedContext?.element;

    if (dragged?.type !== 'prompt') {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    updatePresetVuePromptManualDragPlacementFromEvent(originalEvent ?? event?.originalEvent ?? event);
    return false;
}

function canPutPresetVuePromptIntoGroupList(to, from, dragElement) {
    if (isPresetVuePromptDragLocked()) {
        return false;
    }

    return dragElement instanceof HTMLElement && dragElement.matches('li.completion_prompt_manager_prompt_draggable');
}

function canPutPresetVuePromptIntoTopLevelList(to, from, dragElement) {
    if (isPresetVuePromptDragLocked()) {
        return false;
    }

    if (!(to instanceof HTMLElement) || to.id !== PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1)) {
        return false;
    }

    if (!(dragElement instanceof HTMLElement)) {
        return false;
    }

    return dragElement.matches('li.completion_prompt_manager_prompt_draggable')
        || dragElement.matches(`li.${PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS}`);
}

function setPresetVuePromptDropTargetFromList(listElement) {
    const target = listElement instanceof HTMLElement
        ? listElement.closest('.bai-bai-preset-group')
        : null;

    setPresetVuePromptDropTarget(target);
}

function setPresetVuePromptDropTarget(target) {
    const manager = getPresetVuePromptListManagerState();
    const currentTarget = manager.currentDropTargetElement instanceof HTMLElement
        ? manager.currentDropTargetElement
        : null;

    if (currentTarget === target) {
        manager.currentDropTargetGroupId = target instanceof HTMLElement
            ? target.dataset.presetGroupId || null
            : null;
        return;
    }

    clearPresetVuePromptDropTarget();

    if (target instanceof HTMLElement) {
        target.classList.add(PRESET_VUE_GROUP_DROP_TARGET_CLASS);
        manager.currentDropTargetElement = target;
        manager.currentDropTargetGroupId = target.dataset.presetGroupId || null;
    }
}

function getPresetVuePromptNestedGroupDropTargetFromMoveEvent(event, originalEvent) {
    const to = event?.to;

    if (!(to instanceof HTMLElement) || to.id !== PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1)) {
        return null;
    }

    return getPresetVuePromptGroupDropTargetAtPoint(getPresetDragPoint(originalEvent ?? event?.originalEvent));
}

function getPresetVuePromptExpandedGroupDropTargetAtPoint(point) {
    if (!point) {
        return null;
    }

    const candidates = [];
    const margin = PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX;

    for (const group of document.querySelectorAll(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} .bai-bai-preset-group:not(.bai-bai-preset-group-collapsed)`)) {
        if (!(group instanceof HTMLElement)) {
            continue;
        }

        const surface = group.querySelector('.bai-bai-preset-group-list, .bai-bai-preset-group-body');

        if (!(surface instanceof HTMLElement)) {
            continue;
        }

        const rect = surface.getBoundingClientRect();
        const left = rect.left - margin;
        const right = rect.right + margin;
        const top = rect.top - margin / 2;
        const bottom = rect.bottom + margin;

        if (point.clientX < left || point.clientX > right || point.clientY < top || point.clientY > bottom) {
            continue;
        }

        const verticalDistance = point.clientY < rect.top
            ? rect.top - point.clientY
            : point.clientY > rect.bottom
                ? point.clientY - rect.bottom
                : 0;

        candidates.push({ group, verticalDistance });
    }

    candidates.sort((left, right) => left.verticalDistance - right.verticalDistance);
    return candidates[0]?.group ?? null;
}

function getPresetVuePromptGroupDropTargetAtPoint(point) {
    const strictTarget = getPresetVuePromptStrictGroupDropTargetAtPoint(point);

    if (strictTarget) {
        return strictTarget;
    }

    return getPresetVuePromptExpandedGroupDropTargetAtPoint(point);
}

function getPresetVuePromptStrictGroupDropTargetAtPoint(point) {
    if (!point) {
        return null;
    }

    const elements = typeof document.elementsFromPoint === 'function'
        ? document.elementsFromPoint(point.clientX, point.clientY)
        : [document.elementFromPoint(point.clientX, point.clientY)].filter(Boolean);

    for (const element of elements) {
        if (!(element instanceof Element)) {
            continue;
        }

        if (element.closest('.bai-bai-preset-vue-sortable-fallback, .bai-bai-preset-vue-sortable-drag')) {
            continue;
        }

        const surface = element.closest(PRESET_VUE_GROUP_DROP_SURFACE_SELECTOR);
        const group = surface instanceof HTMLElement
            ? surface.closest('.bai-bai-preset-group')
            : null;

        if (group instanceof HTMLElement && !group.classList.contains('bai-bai-preset-group-collapsed')) {
            return group;
        }
    }

    return null;
}

function clearPresetVuePromptDropTarget() {
    const manager = getPresetVuePromptListManagerState();
    manager.currentDropTargetGroupId = null;

    if (manager.currentDropTargetElement instanceof HTMLElement) {
        manager.currentDropTargetElement.classList.remove(PRESET_VUE_GROUP_DROP_TARGET_CLASS);
        manager.currentDropTargetElement = null;
    }
}

function getPresetVuePromptIdFromDragEvent(event) {
    const item = event?.item;

    if (!(item instanceof HTMLElement)) {
        return null;
    }

    return item.dataset.pmIdentifier || null;
}

function beginPresetVuePromptManualDrag(model, event) {
    return beginPresetVuePromptManualDragWithItem(model, getPresetVuePromptDragItemFromEvent(event), event?.originalEvent ?? event);
}

function beginPresetVuePromptManualDragWithItem(model, draggedItem, event) {
    const manager = getPresetVuePromptListManagerState();
    const list = getPromptManagerListElement();

    if (isPresetVuePromptDragLocked() || !model || !draggedItem) {
        return false;
    }

    manager.groupHeaderGesture = null;
    manager.currentTopLevelDropIndex = null;
    manager.currentDropTargetGroupId = null;
    manager.currentDropTargetElement = null;
    manager.draggedItem = draggedItem;
    manager.draggedPromptId = manager.draggedItem?.type === 'prompt' ? manager.draggedItem.id : null;
    manager.dragLayoutCache = createPresetVuePromptManualDragLayoutCache(model, manager.draggedItem);
    manager.dragScrollContainer = list instanceof HTMLElement
        ? getPromptManagerDragScrollContainer(list)
        : document.scrollingElement;
    manager.lastDragStartedAt = Date.now();
    showPresetVuePromptDragReadyFeedback(manager, { notify: false });
    setPresetVuePromptDragging(model, true);
    notifyPresetVuePromptDragStarted();
    capturePresetVuePromptDragSnapshot(model);
    startPresetVuePromptManualDragPlacementListeners(manager);
    updatePresetVuePromptManualDragPlacementFromEvent(event);
    return true;
}

function finishPresetVuePromptManualDrag(model, event = null) {
    const manager = getPresetVuePromptListManagerState();
    const point = getPresetDragPoint(event?.originalEvent ?? event);

    if (point) {
        manager.lastDragPoint = point;
        updatePresetVuePromptManualDragPlacement(model, point);
    }

    const placement = manager.dragPlacement;
    const changed = applyPresetVuePromptManualDrop(model, placement);

    clearPresetVuePromptManualDragState(manager);
    return changed;
}

function getPresetVuePromptDragItemFromEvent(event) {
    const item = event?.item;
    const contextElement = event?.draggedContext?.element;

    if (item instanceof HTMLElement) {
        if (item.classList.contains('bai-bai-preset-group') && item.dataset.presetGroupId) {
            return { type: 'group', id: item.dataset.presetGroupId };
        }

        if (item.dataset.pmIdentifier) {
            return { type: 'prompt', id: item.dataset.pmIdentifier };
        }
    }

    if (contextElement?.type === 'group' && contextElement.groupId) {
        return { type: 'group', id: contextElement.groupId };
    }

    if (contextElement?.type === 'prompt' && contextElement.id) {
        return { type: 'prompt', id: contextElement.id };
    }

    return null;
}

function startPresetVuePromptManualDragPlacementListeners(manager = getPresetVuePromptListManagerState()) {
    stopPresetVuePromptManualDragPlacementListeners();

    const pointermove = event => updatePresetVuePromptManualDragPlacementFromEvent(event);
    const mousemove = event => {
        if (manager.draggedItem) {
            updatePresetVuePromptManualDragPlacementFromEvent(event);
        }
    };
    const touchmove = event => updatePresetVuePromptManualDragPlacementFromEvent(event);

    document.addEventListener('pointermove', pointermove, true);
    document.addEventListener('mousemove', mousemove, true);
    document.addEventListener('touchmove', touchmove, { capture: true, passive: true });
    extensionState[PRESET_VUE_DRAG_PLACEMENT_LISTENER_KEY] = { pointermove, mousemove, touchmove };
}

function stopPresetVuePromptManualDragPlacementListeners() {
    const listeners = extensionState[PRESET_VUE_DRAG_PLACEMENT_LISTENER_KEY];

    if (!listeners) {
        return;
    }

    document.removeEventListener('pointermove', listeners.pointermove, true);
    document.removeEventListener('mousemove', listeners.mousemove, true);
    document.removeEventListener('touchmove', listeners.touchmove, true);
    delete extensionState[PRESET_VUE_DRAG_PLACEMENT_LISTENER_KEY];
}

function updatePresetVuePromptManualDragPlacementFromEvent(event) {
    const point = getPresetDragPoint(event);
    const manager = getPresetVuePromptListManagerState();

    if (!point) {
        return false;
    }

    manager.lastDragPoint = point;
    schedulePresetVuePromptManualDragPlacementFrame(manager);
    return true;
}

function schedulePresetVuePromptManualDragPlacementFrame(manager = getPresetVuePromptListManagerState()) {
    if (manager.dragPlacementFrame) {
        return;
    }

    manager.dragPlacementFrame = requestAnimationFrame(() => {
        manager.dragPlacementFrame = null;
        updatePresetVuePromptManualDragPlacement(manager.state, manager.lastDragPoint);
        schedulePresetVuePromptManualDragAutoScroll(manager);
    });
}

function updatePresetVuePromptManualDragPlacement(model, point) {
    const manager = getPresetVuePromptListManagerState();
    const draggedItem = manager.draggedItem;

    if (!model || !point || !draggedItem) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    const placement = getPresetVuePromptManualDragPlacementAtPoint(model, draggedItem, point);

    if (!placement) {
        clearPresetVuePromptManualDragPlacement(manager);
        return false;
    }

    manager.dragPlacement = placement;
    manager.currentTopLevelDropIndex = placement.targetType === 'top-level' ? placement.index : null;

    if (placement.targetType === 'group') {
        setPresetVuePromptDropTarget(placement.groupElement);
    } else {
        clearPresetVuePromptDropTarget();
    }

    updatePresetVuePromptManualDragIndicator(manager, placement);
    return true;
}

function getPresetVuePromptManualDragPlacementAtPoint(model, draggedItem, point) {
    const layout = getPresetVuePromptManualDragLayoutCache(model, draggedItem);

    if (!layout) {
        return null;
    }

    if (draggedItem.type === 'prompt') {
        const groupPlacement = getPresetVuePromptManualGroupDropPlacementAtPoint(model, draggedItem, point, layout);

        if (groupPlacement) {
            return groupPlacement;
        }
    }

    return getPresetVuePromptManualTopLevelDropPlacementAtPoint(model, draggedItem, point, layout);
}

function getPresetVuePromptManualGroupDropPlacementAtPoint(model, draggedItem, point, layout) {
    const groupLayout = getPresetVuePromptManualGroupLayoutAtPoint(layout, point);
    const groupElement = groupLayout?.groupElement;
    const groupId = groupLayout?.groupId ?? null;

    if (!groupId || !(groupElement instanceof HTMLElement)) {
        return null;
    }

    const groupItem = getPresetVuePromptGroupItem(model, groupId);

    if (!groupItem) {
        return null;
    }

    const index = getPresetVuePromptManualDropIndexFromLayout(groupLayout, point);

    return {
        targetType: 'group',
        groupId,
        groupElement,
        containerElement: groupLayout.containerElement,
        containerRect: groupLayout.containerRect,
        children: groupLayout.children,
        index,
        indicatorRect: getPresetVuePromptManualIndicatorRectFromLayout(groupLayout, index),
        draggedItem,
    };
}

function getPresetVuePromptManualTopLevelDropPlacementAtPoint(model, draggedItem, point, layout) {
    const topLayout = layout?.topLevel;

    if (!topLayout) {
        return null;
    }

    const rect = topLayout.containerRect;
    const margin = PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX;

    if (
        point.clientX < rect.left - margin
        || point.clientX > rect.right + margin
        || point.clientY < rect.top - margin
        || point.clientY > rect.bottom + margin
    ) {
        return null;
    }

    const index = getPresetVuePromptManualDropIndexFromLayout(topLayout, point, {
        minIndex: getPresetVuePromptTopLevelContentStartIndex(model),
    });

    return {
        targetType: 'top-level',
        containerElement: topLayout.containerElement,
        containerRect: topLayout.containerRect,
        children: topLayout.children,
        index,
        indicatorRect: getPresetVuePromptManualIndicatorRectFromLayout(topLayout, index),
        draggedItem,
    };
}

function getPresetVuePromptManualDragLayoutCache(model, draggedItem) {
    const manager = getPresetVuePromptListManagerState();
    const cache = manager.dragLayoutCache;

    if (
        cache
        && cache.draggedItem?.type === draggedItem?.type
        && cache.draggedItem?.id === draggedItem?.id
        && getPresetVuePromptManualDragLayoutScrollSignature(cache) === cache.scrollSignature
    ) {
        return cache;
    }

    manager.dragLayoutCache = createPresetVuePromptManualDragLayoutCache(model, draggedItem);
    return manager.dragLayoutCache;
}

function createPresetVuePromptManualDragLayoutCache(model, draggedItem) {
    if (!model || !draggedItem) {
        return null;
    }

    const list = getPromptManagerListElement();

    if (!(list instanceof HTMLElement)) {
        return null;
    }

    const groups = [];

    for (const groupElement of list.querySelectorAll('.bai-bai-preset-group:not(.bai-bai-preset-group-collapsed)')) {
        if (!(groupElement instanceof HTMLElement)) {
            continue;
        }

        const groupId = groupElement.dataset.presetGroupId;
        const containerElement = groupElement.querySelector('.bai-bai-preset-group-list');
        const hitElement = groupElement.querySelector('.bai-bai-preset-group-body, .bai-bai-preset-group-list');

        if (!groupId || !(containerElement instanceof HTMLElement) || !(hitElement instanceof HTMLElement)) {
            continue;
        }

        groups.push({
            groupId,
            groupElement,
            hitRect: getPresetVuePromptManualElementRect(hitElement),
            ...createPresetVuePromptManualContainerLayout(containerElement, draggedItem),
        });
    }

    const cache = {
        draggedItem: { ...draggedItem },
        topLevel: createPresetVuePromptManualContainerLayout(list, draggedItem),
        groups,
        scrollSignature: '',
    };

    cache.scrollSignature = getPresetVuePromptManualDragLayoutScrollSignature(cache);
    return cache;
}

function createPresetVuePromptManualContainerLayout(containerElement, draggedItem) {
    return {
        containerElement,
        containerRect: getPresetVuePromptManualElementRect(containerElement),
        children: getPresetVuePromptManualDropChildren(containerElement, draggedItem)
            .map(element => ({
                element,
                rect: getPresetVuePromptManualElementRect(element),
            })),
    };
}

function getPresetVuePromptManualElementRect(element) {
    const rect = element.getBoundingClientRect();

    return {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height,
    };
}

function getPresetVuePromptManualDragLayoutScrollSignature(cache) {
    const parts = [window.scrollX || 0, window.scrollY || 0];
    const seen = new Set();
    const add = element => {
        if (!(element instanceof HTMLElement) || seen.has(element)) {
            return;
        }

        seen.add(element);
        parts.push(element.scrollLeft || 0, element.scrollTop || 0);
    };

    add(cache?.topLevel?.containerElement);

    for (const group of cache?.groups ?? []) {
        add(group.containerElement);
    }

    return parts.join(':');
}

function getPresetVuePromptManualGroupLayoutAtPoint(layout, point) {
    if (!layout || !point) {
        return null;
    }

    const margin = PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX;
    let bestGroup = null;
    let bestDistance = Infinity;

    for (const group of layout.groups ?? []) {
        const rect = group.hitRect;

        if (
            point.clientX < rect.left - margin
            || point.clientX > rect.right + margin
            || point.clientY < rect.top - margin / 2
            || point.clientY > rect.bottom + margin
        ) {
            continue;
        }

        const verticalDistance = point.clientY < rect.top
            ? rect.top - point.clientY
            : point.clientY > rect.bottom
                ? point.clientY - rect.bottom
                : 0;

        if (verticalDistance < bestDistance) {
            bestDistance = verticalDistance;
            bestGroup = group;
        }
    }

    return bestGroup;
}

function getPresetVuePromptManualDropIndexFromLayout(containerLayout, point, { minIndex = 0 } = {}) {
    const children = containerLayout?.children ?? [];
    let index = 0;

    for (const child of children) {
        const rect = child.rect;

        if (point.clientY < rect.top + rect.height / 2) {
            return Math.max(minIndex, Math.min(index, children.length));
        }

        index += 1;
    }

    return Math.max(minIndex, children.length);
}

function getPresetVuePromptManualIndicatorRectFromLayout(containerLayout, index) {
    const containerRect = containerLayout?.containerRect;

    if (!containerRect) {
        return null;
    }

    const children = containerLayout.children ?? [];
    const target = children[index];
    let top = containerRect.top;

    if (target) {
        top = target.rect.top;
    } else if (children.length) {
        top = children[children.length - 1].rect.bottom;
    }

    return {
        left: containerRect.left,
        top,
        width: containerRect.width,
    };
}

function schedulePresetVuePromptManualDragAutoScroll(manager = getPresetVuePromptListManagerState()) {
    if (manager.dragAutoScrollFrame || !manager.draggedItem || !manager.lastDragPoint) {
        return;
    }

    manager.dragAutoScrollFrame = requestAnimationFrame(() => {
        manager.dragAutoScrollFrame = null;

        if (!manager.draggedItem || !manager.lastDragPoint) {
            return;
        }

        const scrolled = autoScrollPresetVuePromptManualDragContainer(manager);

        if (!scrolled) {
            return;
        }

        manager.dragLayoutCache = null;
        schedulePresetVuePromptManualDragPlacementFrame(manager);
        schedulePresetVuePromptManualDragAutoScroll(manager);
    });
}

function autoScrollPresetVuePromptManualDragContainer(manager = getPresetVuePromptListManagerState()) {
    const container = manager.dragScrollContainer;
    const point = manager.lastDragPoint;

    if (!container || !point) {
        return false;
    }

    return autoScrollPromptManagerDragContainer({
        scrollContainer: container,
        clientY: point.clientY,
    });
}

function getPresetVuePromptManualDropIndex(containerElement, point, draggedItem, { minIndex = 0 } = {}) {
    const children = getPresetVuePromptManualDropChildren(containerElement, draggedItem);
    let index = 0;

    for (const child of children) {
        const rect = child.getBoundingClientRect();

        if (point.clientY < rect.top + rect.height / 2) {
            return Math.max(minIndex, Math.min(index, children.length));
        }

        index += 1;
    }

    return Math.max(minIndex, children.length);
}

function getPresetVuePromptManualDropChildren(containerElement, draggedItem) {
    return Array.from(containerElement?.children ?? []).filter(child => child instanceof HTMLElement
        && !isPresetVuePromptTransientDragElement(child)
        && !isPresetVuePromptDraggedDomElement(child, draggedItem));
}

function isPresetVuePromptDraggedDomElement(element, draggedItem) {
    if (!(element instanceof HTMLElement) || !draggedItem) {
        return false;
    }

    if (draggedItem.type === 'group') {
        return element.classList.contains('bai-bai-preset-group')
            && element.dataset.presetGroupId === draggedItem.id;
    }

    return draggedItem.type === 'prompt' && element.dataset.pmIdentifier === draggedItem.id;
}

function getPresetVuePromptGroupItem(model, groupId) {
    return (model?.items ?? []).find(item => item?.type === 'group' && item.groupId === groupId) ?? null;
}

function updatePresetVuePromptManualDragIndicator(manager, placement) {
    const indicator = ensurePresetVuePromptManualDragIndicator(manager);
    const rect = placement?.indicatorRect ?? getPresetVuePromptManualDragIndicatorRect(placement);

    if (!indicator || !rect) {
        clearPresetVuePromptManualDragIndicator(manager);
        return;
    }

    const rectKey = `${Math.round(rect.left)}:${Math.round(rect.top)}:${Math.round(rect.width)}`;

    if (manager.dragIndicatorRectKey === rectKey) {
        return;
    }

    manager.dragIndicatorRectKey = rectKey;
    indicator.style.left = `${rect.left}px`;
    indicator.style.top = `${Math.round(rect.top - 1)}px`;
    indicator.style.width = `${rect.width}px`;
}

function ensurePresetVuePromptManualDragIndicator(manager = getPresetVuePromptListManagerState()) {
    if (manager.dragIndicatorElement instanceof HTMLElement && manager.dragIndicatorElement.isConnected) {
        return manager.dragIndicatorElement;
    }

    const indicator = document.createElement('div');
    indicator.className = PRESET_DRAG_INDICATOR_CLASS;
    document.body.append(indicator);
    manager.dragIndicatorElement = indicator;
    return indicator;
}

function getPresetVuePromptManualDragIndicatorRect(placement) {
    const container = placement?.containerElement;

    if (!(container instanceof HTMLElement)) {
        return null;
    }

    const containerRect = container.getBoundingClientRect();
    const children = getPresetVuePromptManualDropChildren(container, placement.draggedItem);
    const target = children[placement.index];
    let top = containerRect.top;

    if (target instanceof HTMLElement) {
        top = target.getBoundingClientRect().top;
    } else if (children.length) {
        top = children[children.length - 1].getBoundingClientRect().bottom;
    }

    return {
        left: containerRect.left,
        top,
        width: containerRect.width,
    };
}

function clearPresetVuePromptManualDragIndicator(manager = getPresetVuePromptListManagerState()) {
    manager.dragIndicatorElement?.remove?.();
    manager.dragIndicatorElement = null;
    manager.dragIndicatorRectKey = null;
}

function clearPresetVuePromptManualDragPlacement(manager = getPresetVuePromptListManagerState()) {
    manager.dragPlacement = null;
    manager.currentTopLevelDropIndex = null;
    clearPresetVuePromptDropTarget();
    clearPresetVuePromptManualDragIndicator(manager);
}

function clearPresetVuePromptManualDragState(manager = getPresetVuePromptListManagerState()) {
    stopPresetVuePromptManualDragPlacementListeners();

    if (manager.dragPlacementFrame) {
        cancelAnimationFrame(manager.dragPlacementFrame);
        manager.dragPlacementFrame = null;
    }

    if (manager.dragAutoScrollFrame) {
        cancelAnimationFrame(manager.dragAutoScrollFrame);
        manager.dragAutoScrollFrame = null;
    }

    clearPresetVuePromptManualDragPlacement(manager);
    manager.draggedItem = null;
    manager.dragLayoutCache = null;
    manager.dragScrollContainer = null;
    manager.lastDragPoint = null;
}

function applyPresetVuePromptManualDrop(model, placement) {
    const draggedItem = placement?.draggedItem;

    if (!model || !draggedItem) {
        return false;
    }

    if (draggedItem.type === 'group') {
        return movePresetVuePromptGroupToTopLevelIndex(model, draggedItem.id, placement.index);
    }

    if (draggedItem.type !== 'prompt') {
        return false;
    }

    if (placement.targetType === 'group') {
        return movePresetVuePromptToGroupIndex(model, draggedItem.id, placement.groupId, placement.index);
    }

    return movePresetVuePromptToTopLevelIndex(model, draggedItem.id, placement.index);
}

function movePresetVuePromptGroupToTopLevelIndex(model, groupId, index) {
    if (!Array.isArray(model?.items) || !groupId) {
        return false;
    }

    const before = getPresetVuePromptTopLevelItemKeys(model);
    const sourceIndex = model.items.findIndex(item => item?.type === 'group' && item.groupId === groupId);

    if (sourceIndex < 0) {
        return false;
    }

    const [groupItem] = model.items.splice(sourceIndex, 1);
    model.items.splice(clampPresetVuePromptTopLevelDropIndex(model, index), 0, groupItem);
    return !areStringArraysEqual(before, getPresetVuePromptTopLevelItemKeys(model));
}

function movePresetVuePromptToGroupIndex(model, promptId, groupId, index) {
    if (!Array.isArray(model?.items) || !promptId || !groupId) {
        return false;
    }

    const groupItem = getPresetVuePromptGroupItem(model, groupId);

    if (!groupItem) {
        return false;
    }

    const before = getPresetVuePromptListSnapshot(model);
    const promptItem = removePresetVuePromptItemFromModel(model, promptId);

    if (!promptItem) {
        return false;
    }

    promptItem.groupId = groupId;
    groupItem.children = Array.isArray(groupItem.children) ? groupItem.children : [];
    groupItem.children.splice(Math.max(0, Math.min(Number(index) || 0, groupItem.children.length)), 0, promptItem);
    groupItem.count = groupItem.children.length;

    const after = getPresetVuePromptListSnapshot(model);
    return !areStringArraysEqual(before.order, after.order)
        || !arePresetVuePromptGroupAssignmentsEqual(before.assignments, after.assignments);
}

function movePresetVuePromptToTopLevelIndex(model, promptId, index) {
    if (!Array.isArray(model?.items) || !promptId) {
        return false;
    }

    const before = getPresetVuePromptListSnapshot(model);
    const promptItem = removePresetVuePromptItemFromModel(model, promptId);

    if (!promptItem) {
        return false;
    }

    promptItem.groupId = null;
    model.items.splice(clampPresetVuePromptTopLevelDropIndex(model, index), 0, promptItem);

    const after = getPresetVuePromptListSnapshot(model);
    return !areStringArraysEqual(before.order, after.order)
        || !arePresetVuePromptGroupAssignmentsEqual(before.assignments, after.assignments);
}

function getPresetVuePromptTopLevelItemKeys(model) {
    return (model?.items ?? []).map(item => {
        if (item?.type === 'group') {
            return `group:${item.groupId}`;
        }

        if (item?.type === 'prompt') {
            return `prompt:${item.id}`;
        }

        return `static:${item?.type ?? ''}`;
    });
}

function applyPresetVuePromptDropTargetFallback(model, event = null) {
    const manager = getPresetVuePromptListManagerState();
    const promptId = manager.draggedPromptId;
    const groupId = manager.currentDropTargetGroupId;

    if (!model || !promptId || !groupId) {
        return false;
    }

    const pointGroup = getPresetVuePromptGroupDropTargetAtPoint(getPresetDragPoint(event?.originalEvent ?? event));

    if (pointGroup instanceof HTMLElement && pointGroup.dataset.presetGroupId !== groupId) {
        return false;
    }

    if (!pointGroup && event) {
        return false;
    }

    const groupItem = model.items?.find(item => item?.type === 'group' && item.groupId === groupId);

    if (!groupItem) {
        return false;
    }

    if ((groupItem.children ?? []).some(child => child?.type === 'prompt' && child.id === promptId)) {
        return false;
    }

    const promptItem = removePresetVuePromptItemFromModel(model, promptId);

    if (!promptItem) {
        return false;
    }

    promptItem.groupId = groupId;
    groupItem.children = Array.isArray(groupItem.children) ? groupItem.children : [];
    groupItem.children.push(promptItem);
    groupItem.count = groupItem.children.length;
    return true;
}

function applyPresetVuePromptTopLevelDropFallback(model, event = null) {
    const manager = getPresetVuePromptListManagerState();
    const promptId = manager.draggedPromptId;

    if (!model || !promptId || !isPresetVuePromptNestedInGroup(model, promptId)) {
        return false;
    }

    const point = getPresetDragPoint(event?.originalEvent ?? event);

    if (getPresetVuePromptGroupDropTargetAtPoint(point)) {
        return false;
    }

    const pointDropIndex = getPresetVuePromptTopLevelDropIndexAtPoint(model, point);
    const dropIndex = Number.isFinite(pointDropIndex)
        ? pointDropIndex
        : manager.currentTopLevelDropIndex;

    if (!Number.isFinite(dropIndex)) {
        return false;
    }

    const promptItem = removePresetVuePromptItemFromModel(model, promptId);

    if (!promptItem) {
        return false;
    }

    promptItem.groupId = null;
    model.items.splice(clampPresetVuePromptTopLevelDropIndex(model, dropIndex), 0, promptItem);
    return true;
}

function isPresetVuePromptNestedInGroup(model, promptId) {
    if (!Array.isArray(model?.items) || !promptId) {
        return false;
    }

    return model.items.some(item => item?.type === 'group'
        && Array.isArray(item.children)
        && item.children.some(child => child?.type === 'prompt' && child.id === promptId));
}

function getPresetVuePromptTopLevelDropIndexAtPoint(model, point) {
    if (!point || !Array.isArray(model?.items)) {
        return null;
    }

    const list = getPromptManagerListElement();

    if (!(list instanceof HTMLElement)) {
        return null;
    }

    const listRect = list.getBoundingClientRect();
    const margin = PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX;

    if (
        point.clientX < listRect.left - margin
        || point.clientX > listRect.right + margin
        || point.clientY < listRect.top - margin
        || point.clientY > listRect.bottom + margin
    ) {
        return null;
    }

    let modelIndex = 0;

    for (const child of Array.from(list.children)) {
        if (!(child instanceof HTMLElement) || isPresetVuePromptTransientDragElement(child)) {
            continue;
        }

        const rect = child.getBoundingClientRect();

        if (point.clientY < rect.top + rect.height / 2) {
            return clampPresetVuePromptTopLevelDropIndex(model, modelIndex);
        }

        modelIndex += 1;
    }

    return model.items.length;
}

function isPresetVuePromptTransientDragElement(element) {
    return element.classList.contains('bai-bai-preset-vue-sortable-fallback')
        || element.classList.contains('bai-bai-preset-vue-sortable-ghost')
        || element.classList.contains('bai-bai-preset-vue-sortable-chosen')
        || element.classList.contains('bai-bai-preset-vue-sortable-drag');
}

function clampPresetVuePromptTopLevelDropIndex(model, index) {
    const minIndex = getPresetVuePromptTopLevelContentStartIndex(model);
    const maxIndex = Array.isArray(model?.items) ? model.items.length : minIndex;
    return Math.max(minIndex, Math.min(Number(index) || minIndex, maxIndex));
}

function getPresetVuePromptTopLevelContentStartIndex(model) {
    if (!Array.isArray(model?.items)) {
        return 2;
    }

    let index = 0;

    while (index < model.items.length) {
        const type = model.items[index]?.type;

        if (type !== 'header' && type !== 'global-library' && type !== 'favorites' && type !== 'separator') {
            break;
        }

        index += 1;
    }

    return index;
}

function removePresetVuePromptItemFromModel(model, promptId) {
    if (!Array.isArray(model?.items) || !promptId) {
        return null;
    }

    for (const item of model.items) {
        if (item?.type !== 'group' || !Array.isArray(item.children)) {
            continue;
        }

        const index = item.children.findIndex(child => child?.type === 'prompt' && child.id === promptId);

        if (index >= 0) {
            const [promptItem] = item.children.splice(index, 1);
            item.count = item.children.length;
            return promptItem;
        }
    }

    const topLevelIndex = model.items.findIndex(item => item?.type === 'prompt' && item.id === promptId);

    if (topLevelIndex < 0) {
        return null;
    }

    const [promptItem] = model.items.splice(topLevelIndex, 1);
    return promptItem;
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

function beginPresetVuePromptGroupHeaderGesture(event, groupId) {
    if (isPresetVuePromptDragLocked()) {
        return;
    }

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
    const startedAt = Date.now();

    cancelPresetVuePromptGroupHeaderCustomDrag(manager, { suppress: false });
    clearPresetVuePromptDragReadyFeedback(manager);
    manager.groupHeaderGesture = {
        groupId,
        pointerId: event.pointerId,
        startedAt,
        x: point.clientX,
        y: point.clientY,
        lastX: point.clientX,
        lastY: point.clientY,
        scrolling: false,
        dragging: false,
        feedbackElement,
        readyTimer: null,
    };

    if (isMobile() && feedbackElement instanceof HTMLElement) {
        manager.dragReadyFeedbackElement = feedbackElement;
        manager.dragReadyFeedbackNotified = false;
        manager.groupHeaderGesture.readyTimer = window.setTimeout(() => {
            beginPresetVuePromptGroupHeaderCustomDrag(manager, manager.groupHeaderGesture);
        }, PRESET_VUE_TOUCH_DRAG_DELAY_MS);
    }
}

function movePresetVuePromptGroupHeaderGesture(event, groupId) {
    const manager = getPresetVuePromptListManagerState();
    const gesture = manager.groupHeaderGesture;

    if (!gesture || gesture.groupId !== groupId || gesture.pointerId !== event.pointerId || manager.state?.dragging) {
        return;
    }

    const point = getPresetVuePointerEventPoint(event);

    if (!point) {
        return;
    }

    gesture.lastX = point.clientX;
    gesture.lastY = point.clientY;

    const deltaX = point.clientX - gesture.x;
    const deltaY = point.clientY - gesture.y;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    if (gesture.dragging) {
        updatePresetVuePromptManualDragPlacementFromEvent(event);

        if (event.cancelable) {
            event.preventDefault();
        }

        event.stopPropagation();
        return;
    }

    if (!isMobile()) {
        return;
    }

    if (Math.max(absX, absY) <= PRESET_VUE_TOUCH_START_THRESHOLD_PX) {
        return;
    }

    gesture.scrolling = true;
    manager.lastGroupHeaderGestureCanceledAt = Date.now();
    clearPresetVuePromptGroupHeaderGestureTimer(gesture);
    clearPresetVuePromptDragReadyFeedback(manager);
}

function finishPresetVuePromptGroupHeaderGesture(event, groupId) {
    const manager = getPresetVuePromptListManagerState();
    const gesture = manager.groupHeaderGesture;

    if (manager.groupHeaderCustomDrag?.pointerId === event.pointerId) {
        finishPresetVuePromptGroupHeaderCustomDrag(event);
        return;
    }

    if (!gesture || gesture.groupId !== groupId || gesture.pointerId !== event.pointerId) {
        return;
    }

    manager.groupHeaderGesture = null;
    clearPresetVuePromptGroupHeaderGestureTimer(gesture);
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

    if (manager.groupHeaderCustomDrag?.groupId === groupId) {
        cancelPresetVuePromptGroupHeaderCustomDrag(manager);
    }

    if (manager.groupHeaderGesture?.groupId === groupId) {
        clearPresetVuePromptGroupHeaderGestureTimer(manager.groupHeaderGesture);
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

function clearPresetVuePromptGroupHeaderGestureTimer(gesture) {
    if (gesture?.readyTimer) {
        clearTimeout(gesture.readyTimer);
        gesture.readyTimer = null;
    }
}

function beginPresetVuePromptGroupHeaderCustomDrag(manager, gesture) {
    if (!isMobile() || !manager || manager.groupHeaderGesture !== gesture || !gesture || gesture.scrolling || gesture.dragging) {
        return false;
    }

    const model = manager.state;
    const point = {
        clientX: gesture.lastX ?? gesture.x,
        clientY: gesture.lastY ?? gesture.y,
    };

    clearPresetVuePromptGroupHeaderGestureTimer(gesture);
    gesture.dragging = true;
    manager.groupHeaderCustomDrag = {
        groupId: gesture.groupId,
        pointerId: gesture.pointerId,
    };

    const started = beginPresetVuePromptManualDragWithItem(
        model,
        { type: 'group', id: gesture.groupId },
        point,
    );

    if (!started) {
        cancelPresetVuePromptGroupHeaderCustomDrag(manager);
        return false;
    }

    startPresetVuePromptGroupHeaderCustomDragEndListeners(manager);
    return true;
}

function startPresetVuePromptGroupHeaderCustomDragEndListeners(manager = getPresetVuePromptListManagerState()) {
    stopPresetVuePromptGroupHeaderCustomDragEndListeners();

    const pointerup = event => {
        const customDrag = manager.groupHeaderCustomDrag;

        if (!customDrag || customDrag.pointerId !== event.pointerId) {
            return;
        }

        finishPresetVuePromptGroupHeaderCustomDrag(event);
    };
    const pointercancel = event => {
        const customDrag = manager.groupHeaderCustomDrag;

        if (!customDrag || customDrag.pointerId !== event.pointerId) {
            return;
        }

        cancelPresetVuePromptGroupHeaderCustomDrag(manager);
    };
    const touchend = event => {
        if (manager.groupHeaderCustomDrag) {
            finishPresetVuePromptGroupHeaderCustomDrag(event);
        }
    };
    const touchcancel = () => {
        if (manager.groupHeaderCustomDrag) {
            cancelPresetVuePromptGroupHeaderCustomDrag(manager);
        }
    };

    document.addEventListener('pointerup', pointerup, true);
    document.addEventListener('pointercancel', pointercancel, true);
    document.addEventListener('touchend', touchend, true);
    document.addEventListener('touchcancel', touchcancel, true);
    extensionState[PRESET_VUE_GROUP_HEADER_CUSTOM_DRAG_LISTENER_KEY] = {
        pointerup,
        pointercancel,
        touchend,
        touchcancel,
    };
}

function stopPresetVuePromptGroupHeaderCustomDragEndListeners() {
    const listeners = extensionState[PRESET_VUE_GROUP_HEADER_CUSTOM_DRAG_LISTENER_KEY];

    if (!listeners) {
        return;
    }

    document.removeEventListener('pointerup', listeners.pointerup, true);
    document.removeEventListener('pointercancel', listeners.pointercancel, true);
    document.removeEventListener('touchend', listeners.touchend, true);
    document.removeEventListener('touchcancel', listeners.touchcancel, true);
    delete extensionState[PRESET_VUE_GROUP_HEADER_CUSTOM_DRAG_LISTENER_KEY];
}

function finishPresetVuePromptGroupHeaderCustomDrag(event = null) {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;

    if (!manager.groupHeaderCustomDrag) {
        return;
    }

    stopPresetVuePromptGroupHeaderCustomDragEndListeners();

    if (event?.cancelable) {
        event.preventDefault();
    }

    event?.stopPropagation?.();

    manager.lastDragEndedAt = Date.now();
    const manualDrop = finishPresetVuePromptManualDrag(model, event);
    setPresetVuePromptDragging(model, false);
    manager.draggedPromptId = null;
    manager.draggedItem = null;
    manager.currentDropTargetGroupId = null;
    manager.currentTopLevelDropIndex = null;
    manager.groupHeaderCustomDrag = null;
    manager.groupHeaderGesture = null;
    manager.lastGroupHeaderGestureCanceledAt = Date.now();

    const modelChanged = consumePresetVuePromptDragChange(model);

    if (manualDrop || modelChanged) {
        schedulePresetVuePromptOrderSaveAfterDrop();
    }
}

function cancelPresetVuePromptGroupHeaderCustomDrag(
    manager = getPresetVuePromptListManagerState(),
    { suppress = true } = {},
) {
    stopPresetVuePromptGroupHeaderCustomDragEndListeners();

    if (manager.groupHeaderGesture) {
        clearPresetVuePromptGroupHeaderGestureTimer(manager.groupHeaderGesture);
    }

    if (manager.groupHeaderCustomDrag) {
        manager.dragSnapshot = null;
        setPresetVuePromptDragging(manager.state, false);
    }

    clearPresetVuePromptDragReadyFeedback(manager);
    manager.groupHeaderCustomDrag = null;
    manager.groupHeaderGesture = null;

    if (suppress) {
        manager.lastGroupHeaderGestureCanceledAt = Date.now();
    }
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

function renderPresetVuePromptGroupBody(h, vueDraggableNext, item, draggableProps) {
    const model = getPresetVuePromptListManagerState().state;
    const mounted = isPresetVuePromptGroupBodyMounted(model, item);

    return h('div', {
        class: 'bai-bai-preset-group-body',
        'aria-hidden': item.collapsed ? 'true' : 'false',
    }, [
        h('div', { class: 'bai-bai-preset-group-body-inner' }, mounted ? [
            h(vueDraggableNext.VueDraggableNext, draggableProps, {
                default: () => (item.children ?? []).map(child => renderPresetVuePromptRow(h, child, { groupChild: true })),
            }),
        ] : []),
    ]);
}

function installPresetVueDynamicDragDelayHandlers() {
    if (extensionState[PRESET_VUE_DYNAMIC_DRAG_DELAY_HANDLER_KEY]) {
        return;
    }

    const handler = event => configurePresetVueSortableDragDelayForEvent(event);

    document.addEventListener('pointerdown', handler, true);
    document.addEventListener('touchstart', handler, true);
    extensionState[PRESET_VUE_DYNAMIC_DRAG_DELAY_HANDLER_KEY] = { handler };
}

function removePresetVueDynamicDragDelayHandlers() {
    const state = extensionState[PRESET_VUE_DYNAMIC_DRAG_DELAY_HANDLER_KEY];

    if (!state?.handler) {
        return;
    }

    document.removeEventListener('pointerdown', state.handler, true);
    document.removeEventListener('touchstart', state.handler, true);
    delete extensionState[PRESET_VUE_DYNAMIC_DRAG_DELAY_HANDLER_KEY];
}

function configurePresetVueSortableDragDelayForEvent(event) {
    if (!isMobile()) {
        return;
    }

    if (isPresetVuePromptDragLocked()) {
        return;
    }

    if (getPresetVuePromptListManagerState().state?.rangeSelection?.active) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;

    if (!target) {
        return;
    }

    const list = target.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR}, .bai-bai-preset-group-list`);

    if (!(list instanceof HTMLElement)) {
        return;
    }

    const sortable = getPresetVueSortableInstance(list);

    if (!sortable || typeof sortable.option !== 'function') {
        return;
    }

    const immediateHandle = Boolean(target.closest('.drag-handle'));
    const threshold = immediateHandle
        ? PRESET_VUE_POINTER_START_THRESHOLD_PX
        : PRESET_VUE_TOUCH_START_THRESHOLD_PX;

    sortable.option('delay', immediateHandle ? 0 : PRESET_VUE_TOUCH_DRAG_DELAY_MS);
    sortable.option('touchStartThreshold', threshold);
    sortable.option('fallbackTolerance', threshold);
}

function getPresetVueSortableInstance(element) {
    for (const key of Object.keys(element)) {
        const value = element[key];

        if (key.startsWith('Sortable') && value && typeof value.option === 'function') {
            return value;
        }
    }

    return null;
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
    // 只看用户的锁定设置:handle 只在重建 draggable 时生效,搜索筛选的临时锁由下面的 filter 动态拦。
    if (isPresetVuePromptDragLockSettingEnabled()) {
        return '__bai_bai_preset_drag_locked__';
    }

    if (!isMobile()) {
        return '';
    }

    return settings.presetMobileWholeRowDragEnabled
        ? 'li.completion_prompt_manager_prompt_draggable'
        : '.drag-handle';
}

// Sortable 的 filter:每次按下都会调用,返回 true 就不起拖。Sortable 配置只在重建时生效,
// 搜索筛选、分组选择这类临时锁定就在这里动态拦住;按钮等交互元素上不起拖,和原来的选择器写法一样。
function isPresetVuePromptDragStartFiltered(event, item, sortable) {
    const target = event?.target instanceof Element ? event.target : null;
    const interactive = target?.closest(PRESET_DRAG_INTERACTIVE_SELECTOR);

    if (interactive && interactive !== sortable?.el && sortable?.el?.contains(interactive)) {
        return true;
    }

    if (!isPresetVuePromptDragLocked() && !getPresetVuePromptListManagerState().state?.rangeSelection?.active) {
        return false;
    }

    armPresetVuePromptSearchDragHint(event, item, sortable);
    return true;
}

// 手机上搜索筛选时长按条目(平时这样就拖起来了)却拖不动,提示一次原因;每次打开搜索只提示一次。
function armPresetVuePromptSearchDragHint(event, item, sortable) {
    const manager = getPresetVuePromptListManagerState();
    const touchLike = event?.type === 'touchstart' || (event?.type === 'pointerdown' && event.pointerType !== 'mouse');

    // 嵌套列表里同一次按下会依次经过分组列表和主列表的 filter,只算一次。
    if (!item || !touchLike || !isMobile() || manager.searchDragHintShown || manager.searchDragHint?.event === event) {
        return;
    }

    // 用户自己锁的、或正在选分组范围,都不是搜索造成的,不提示。
    if (!isPresetVuePromptSearchFiltering() || isPresetVuePromptDragLockSettingEnabled() || manager.state?.rangeSelection?.active) {
        return;
    }

    // 平时只能按住手柄拖时,按在别处本来就拖不动,也不提示。
    const handle = sortable?.options?.handle;

    if (handle && !(event.target instanceof Element && event.target.closest(handle))) {
        return;
    }

    const start = getPresetDragPoint(event);

    if (!start) {
        return;
    }

    clearPresetVuePromptSearchDragHint(manager);
    const hint = { event, timer: null, listener: null };
    hint.listener = nextEvent => {
        const point = nextEvent.type.endsWith('move') ? getPresetDragPoint(nextEvent) : null;

        if (point && Math.hypot(point.clientX - start.clientX, point.clientY - start.clientY) <= PRESET_VUE_TOUCH_START_THRESHOLD_PX) {
            return;
        }

        clearPresetVuePromptSearchDragHint(manager);
    };
    hint.timer = window.setTimeout(() => {
        clearPresetVuePromptSearchDragHint(manager);

        if (isPresetVuePromptSearchFiltering()) {
            manager.searchDragHintShown = true;
            toastr.info(t`搜索结果里不能拖动，清空搜索后再拖。`);
        }
    }, PRESET_VUE_TOUCH_DRAG_DELAY_MS);
    manager.searchDragHint = hint;
    togglePresetVuePromptSearchDragHintListeners(hint.listener, true);
}

function clearPresetVuePromptSearchDragHint(manager) {
    const hint = manager.searchDragHint;

    if (!hint) {
        return;
    }

    window.clearTimeout(hint.timer);
    togglePresetVuePromptSearchDragHintListeners(hint.listener, false);
    manager.searchDragHint = null;
}

function togglePresetVuePromptSearchDragHintListeners(listener, enabled) {
    for (const type of ['pointermove', 'pointerup', 'pointercancel', 'touchmove', 'touchend', 'touchcancel', 'scroll']) {
        if (enabled) {
            document.addEventListener(type, listener, true);
        } else {
            document.removeEventListener(type, listener, true);
        }
    }
}

function setPresetVuePromptDragging(model, dragging) {
    if (!model) {
        if (!dragging) {
            clearPresetVuePromptDragReadyFeedback();
            clearPresetVuePromptManualDragState();
            clearPresetVuePromptDropTarget();
            setPresetVuePromptDragScrollGuardEnabled(false);
            document.body?.classList.remove(PRESET_VUE_DRAGGING_BODY_CLASS);
            getPromptManagerListElement()?.classList.remove(PRESET_DRAG_ACTIVE_CLASS);
        }
        return;
    }

    if (dragging) {
        cancelPresetVuePromptBodyHeightAnimations();
        closePresetPromptActionMenus();
        clearPromptManagerCustomDragPending();
        disablePromptManagerStockSortable(getPromptManagerListElement());
    }

    model.dragging = Boolean(dragging);
    document.body?.classList.toggle(PRESET_VUE_DRAGGING_BODY_CLASS, model.dragging);
    getPromptManagerListElement()?.classList.toggle(PRESET_DRAG_ACTIVE_CLASS, model.dragging);
    setPresetVuePromptDragScrollGuardEnabled(model.dragging);

    if (!model.dragging) {
        clearPresetVuePromptDragReadyFeedback();
        clearPresetVuePromptManualDragState();
        clearPresetVuePromptDropTarget();
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

export {
    applyPresetVueDragGestureOptions,
    applyPresetVuePromptDropTargetFallback,
    applyPresetVuePromptManualDrop,
    applyPresetVuePromptTopLevelDropFallback,
    arePresetVuePromptGroupAssignmentsEqual,
    autoScrollPresetVuePromptManualDragContainer,
    beginPresetVuePromptGroupHeaderCustomDrag,
    beginPresetVuePromptGroupHeaderGesture,
    beginPresetVuePromptManualDrag,
    beginPresetVuePromptManualDragWithItem,
    canPutPresetVuePromptIntoGroupList,
    canPutPresetVuePromptIntoTopLevelList,
    cancelPresetVuePromptGroupHeaderCustomDrag,
    cancelPresetVuePromptGroupHeaderGesture,
    capturePresetVuePromptDragSnapshot,
    clampPresetVuePromptTopLevelDropIndex,
    clearPresetVuePromptDragReadyFeedback,
    clearPresetVuePromptDropTarget,
    clearPresetVuePromptGroupHeaderGestureTimer,
    clearPresetVuePromptManualDragIndicator,
    clearPresetVuePromptManualDragPlacement,
    clearPresetVuePromptManualDragState,
    configurePresetVueSortableDragDelayForEvent,
    consumePresetVuePromptDragChange,
    createPresetVuePromptManualContainerLayout,
    createPresetVuePromptManualDragLayoutCache,
    ensurePresetVuePromptManualDragIndicator,
    finishPresetVuePromptGroupHeaderCustomDrag,
    finishPresetVuePromptGroupHeaderGesture,
    finishPresetVuePromptManualDrag,
    getPresetVuePointDistance,
    getPresetVuePointerEventPoint,
    getPresetVuePromptDragHandleSelector,
    getPresetVuePromptDragItemFromEvent,
    getPresetVuePromptExpandedGroupDropTargetAtPoint,
    getPresetVuePromptGroupDropTargetAtPoint,
    getPresetVuePromptGroupHeaderFeedbackElement,
    getPresetVuePromptGroupItem,
    getPresetVuePromptIdFromDragEvent,
    getPresetVuePromptListSnapshot,
    getPresetVuePromptManualDragIndicatorRect,
    getPresetVuePromptManualDragLayoutCache,
    getPresetVuePromptManualDragLayoutScrollSignature,
    getPresetVuePromptManualDragPlacementAtPoint,
    getPresetVuePromptManualDropChildren,
    getPresetVuePromptManualDropIndex,
    getPresetVuePromptManualDropIndexFromLayout,
    getPresetVuePromptManualElementRect,
    getPresetVuePromptManualGroupDropPlacementAtPoint,
    getPresetVuePromptManualGroupLayoutAtPoint,
    getPresetVuePromptManualIndicatorRectFromLayout,
    getPresetVuePromptManualTopLevelDropPlacementAtPoint,
    getPresetVuePromptNestedGroupDropTargetFromMoveEvent,
    getPresetVuePromptStrictGroupDropTargetAtPoint,
    getPresetVuePromptTopLevelContentStartIndex,
    getPresetVuePromptTopLevelDropIndexAtPoint,
    getPresetVuePromptTopLevelItemKeys,
    getPresetVueSortableInstance,
    handlePresetVuePromptGroupHeaderClickFallback,
    installPresetVueDynamicDragDelayHandlers,
    isPresetVuePromptDragStartFiltered,
    isPresetVuePromptDraggedDomElement,
    isPresetVuePromptGroupDragMoveAllowed,
    isPresetVuePromptGroupHeaderInteractiveEvent,
    isPresetVuePromptNestedInGroup,
    isPresetVuePromptTopLevelDragMoveAllowed,
    isPresetVuePromptTransientDragElement,
    movePresetVuePromptGroupHeaderGesture,
    movePresetVuePromptGroupToTopLevelIndex,
    movePresetVuePromptToGroupIndex,
    movePresetVuePromptToTopLevelIndex,
    notifyPresetVuePromptDragStarted,
    removePresetVueDynamicDragDelayHandlers,
    removePresetVuePromptItemFromModel,
    renderPresetVuePromptGroupBody,
    schedulePresetVuePromptManualDragAutoScroll,
    schedulePresetVuePromptManualDragPlacementFrame,
    setPresetVuePromptDragScrollGuardEnabled,
    setPresetVuePromptDragging,
    setPresetVuePromptDropTarget,
    setPresetVuePromptDropTargetFromList,
    shouldSuppressPresetVuePromptGroupHeaderToggle,
    showPresetVuePromptDragReadyFeedback,
    startPresetVuePromptGroupHeaderCustomDragEndListeners,
    startPresetVuePromptManualDragPlacementListeners,
    stopPresetVuePromptGroupHeaderCustomDragEndListeners,
    stopPresetVuePromptManualDragPlacementListeners,
    updatePresetVuePromptManualDragIndicator,
    updatePresetVuePromptManualDragPlacement,
    updatePresetVuePromptManualDragPlacementFromEvent,
    vibratePresetVuePromptDragFeedback,
};
