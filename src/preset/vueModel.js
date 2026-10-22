import { t } from '@sillytavern/scripts/i18n';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { uuidv4 } from '@sillytavern/scripts/utils';
import { refreshPromptManagerTokensDebounced } from './constants.js';
import { getPresetPromptGroupState, normalizePresetPromptGroupState, savePresetPromptGroupSettings } from './groupState.js';
import { removeUnusedPresetPromptGroups } from './pendingChanges.js';
import { closePresetVuePromptSearch, isPresetVuePromptSearchFiltering, isPresetVuePromptSearchOpen, togglePresetVuePromptSearchGroupCollapsed } from './search.js';
import { updatePresetEffectiveTokenHeaderDisplay } from './switchFast.js';
import { clearPresetVuePromptGroupBodyUnmountTimer, getPresetVuePromptListManagerState, runPresetVuePromptBodyHeightTransition, schedulePresetVuePromptGroupBodyUnmount, setPresetVuePromptGroupBodyMounted, syncPresetVuePromptListManagerState } from './vueList.js';

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

    // 选分组范围要看完整列表,搜索开着就先退出;从某个条目发起时让它停在原处。
    if (isPresetVuePromptSearchOpen(model)) {
        closePresetVuePromptSearch({ revealPromptId: startId });
    }

    model.rangeSelection = {
        active: true,
        name: '',
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

    if (model.rangeSelection.endId) {
        return;
    }

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

    const name = await callGenericPopup(t`预设分组名称`, POPUP_TYPE.INPUT, model.rangeSelection?.name || '', {
        okButton: t`创建分组`,
        cancelButton: t`取消`,
    });

    if (!model?.rangeSelection?.active) {
        return;
    }

    if (typeof name !== 'string') {
        model.rangeSelection.endId = null;
        return;
    }

    const trimmedName = name.trim();

    if (!trimmedName) {
        toastr.warning(t`分组名称不能为空。`);
        model.rangeSelection.endId = null;
        return;
    }

    const groupState = getPresetPromptGroupState();
    normalizePresetPromptGroupState(groupState, new Set(getPresetVuePromptFlatIds(model)));
    const groupId = uuidv4();
    model.rangeSelection.name = trimmedName;
    groupState.groups.push({
        id: groupId,
        name: trimmedName,
        order: groupState.groups.length,
        collapsed: true,
        enabled: true,
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

function getPresetVuePromptItemsFromModel(
    model = getPresetVuePromptListManagerState().state,
    { includeFavoriteMirrors = false } = {},
) {
    const promptItems = [];

    for (const item of model?.items ?? []) {
        if (item?.type === 'prompt') {
            promptItems.push(item);
            continue;
        }

        if (item?.type === 'favorites') {
            if (includeFavoriteMirrors) {
                promptItems.push(...(item.children ?? []).filter(child => child?.type === 'prompt'));
            }
            continue;
        }

        if (item?.type === 'global-library') {
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

    const pushPromptOnce = (promptItem, targetItems, groupId = null) => {
        if (!promptItem?.id || promptItem.type !== 'prompt') {
            changed = true;
            return;
        }

        if (seenPromptIds.has(promptItem.id)) {
            changed = true;
            return;
        }

        seenPromptIds.add(promptItem.id);
        if ((promptItem.groupId ?? null) !== (groupId ?? null)) {
            promptItem.groupId = groupId ?? null;
            changed = true;
        }
        targetItems.push(promptItem);
    };

    for (const item of model.items) {
        if (
            item?.type === 'header'
            || item?.type === 'separator'
            || item?.type === 'global-library'
            || item?.type === 'favorites'
        ) {
            if (seenStaticIds.has(item.type)) {
                changed = true;
                continue;
            }

            seenStaticIds.add(item.type);
            nextItems.push(item);
            continue;
        }

        if (item?.type === 'prompt') {
            pushPromptOnce(item, nextItems, null);
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
                pushPromptOnce(child, groupItem.children, item.groupId);
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
    // 搜索过滤时分组是临时展开的,这里也只临时收起/展开结果里的这一组,不写回折叠设置,免得退出搜索后和原状态对不上。
    if (isPresetVuePromptSearchFiltering()) {
        togglePresetVuePromptSearchGroupCollapsed(groupId);
        return;
    }

    const groupState = getPresetPromptGroupState();
    const group = groupState.groups.find(group => group.id === groupId);

    if (!group) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;
    const nextCollapsed = !group.collapsed;

    runPresetVuePromptBodyHeightTransition(groupId, !nextCollapsed, () => {
        if (!nextCollapsed) {
            clearPresetVuePromptGroupBodyUnmountTimer(manager, groupId);
            setPresetVuePromptGroupBodyMounted(model, groupId, true);
        }

        group.collapsed = nextCollapsed;
        const modelGroup = model?.items?.find(item => item?.type === 'group' && item.groupId === groupId);

        if (modelGroup) {
            modelGroup.collapsed = group.collapsed;

            if (modelGroup.group) {
                modelGroup.group.collapsed = group.collapsed;
            }
        }

        if (nextCollapsed) {
            schedulePresetVuePromptGroupBodyUnmount(groupId);
        }

        savePresetPromptGroupSettings();
    });
}

function togglePresetVuePromptGroupEnabled(groupId) {
    const manager = getPresetVuePromptListManagerState();
    const groupState = getPresetPromptGroupState();
    const group = groupState.groups.find(group => group.id === groupId);

    if (!group) {
        return;
    }

    group.enabled = group.enabled === false;
    const groupItem = manager.state?.items?.find(item => item?.type === 'group' && item.groupId === groupId);

    if (groupItem) {
        groupItem.enabled = group.enabled;

        if (groupItem.group) {
            groupItem.group.enabled = group.enabled;
        }
    }

    updatePresetEffectiveTokenHeaderDisplay();
    savePresetPromptGroupSettings();
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

export {
    cancelPresetVuePromptGroupRangeSelection,
    deletePresetVuePromptGroup,
    finishPresetVuePromptGroupRangeSelection,
    getPresetVuePromptFlatIds,
    getPresetVuePromptItemsFromModel,
    getPresetVuePromptRangeClasses,
    getPresetVuePromptRangeIds,
    handlePresetVuePromptRangeSelectionClick,
    renamePresetVuePromptGroup,
    sanitizePresetVuePromptListModel,
    startPresetVuePromptGroupRangeSelection,
    togglePresetVuePromptGroupCollapsed,
    togglePresetVuePromptGroupEnabled,
    updatePresetVuePromptRangeSelectionHover,
};
