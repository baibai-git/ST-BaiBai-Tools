import { t } from '@sillytavern/scripts/i18n';
import { promptManager } from '@sillytavern/scripts/openai';
import { uuidv4 } from '@sillytavern/scripts/utils';
import { OPENAI_SETTINGS_SELECTOR, PRESET_GLOBAL_LIBRARY_DATABASE, PRESET_GLOBAL_LIBRARY_KEY, PRESET_GLOBAL_LIBRARY_STORE, PRESET_GLOBAL_LIBRARY_VERSION, PRESET_PROMPT_MANAGER_LIST_SELECTOR, PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX, PRESET_VUE_GLOBAL_LIBRARY_DRAG_GROUP, PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID, refreshPromptManagerTokensDebounced } from './constants.js';
import { getPresetPromptGroupState, savePresetPromptGroupSettings } from './groupState.js';
import { closePresetPromptActionMenus, createUniquePresetPromptIdentifier, handlePresetPromptActionButtonClick, refreshPresetPromptListAfterCopy } from './listActions.js';
import { flushPendingPresetPromptChanges, markPresetPromptServiceSettingsSavePending } from './pendingChanges.js';
import { LOG_PREFIX, extensionState, settings } from './state.js';
import { isPromptManagerReadyForFastPresetSwitch, renderPromptManagerListWithoutTokenStats } from './switchFast.js';
import { applyPresetVueDragGestureOptions, getPresetVuePromptDragHandleSelector, isPresetVuePromptDragStartFiltered, notifyPresetVuePromptDragStarted } from './vueDrag.js';
import { clearPresetVuePromptGroupBodyUnmountTimer, getPresetVuePromptListManagerState, isPresetVuePromptGroupBodyMounted, markPresetVuePromptListSyncSignatureCurrent, runPresetVuePromptBodyHeightTransition, schedulePresetVuePromptGroupBodyUnmount, setPresetVuePromptGroupBodyMounted, syncPresetVuePromptListManagerState } from './vueList.js';
import { renderPresetVuePromptActionButton } from './vueRender.js';

function getPresetGlobalLibrarySelectedIds(manager = getPresetVuePromptListManagerState()) {
    if (!(manager.globalLibrarySelectedIds instanceof Set)) {
        manager.globalLibrarySelectedIds = new Set();
    }

    return manager.globalLibrarySelectedIds;
}

function buildPresetVueGlobalLibraryItem() {
    const manager = getPresetVuePromptListManagerState();
    const items = normalizePresetGlobalPromptLibraryItems(manager.globalLibraryItems);
    const groups = normalizePresetGlobalPromptLibraryGroups(manager.globalLibraryGroups);
    const validGroupIds = new Set(groups.map(group => group.id));
    const selectedIds = getPresetGlobalLibrarySelectedIds(manager);
    const selecting = Boolean(manager.globalLibrarySelecting);
    const ungrouped = [];
    const childrenByGroupId = new Map(groups.map(group => [group.id, []]));
    let selectedCount = 0;

    for (const item of items) {
        const groupId = item.groupId && validGroupIds.has(item.groupId) ? item.groupId : null;
        const selected = selectedIds.has(item.id);
        const node = {
            id: item.id,
            name: item.name,
            content: item.content,
            groupId,
            type: 'global-library-prompt',
            selecting,
            selected,
        };

        if (selected) {
            selectedCount += 1;
        }

        if (groupId) {
            childrenByGroupId.get(groupId)?.push(node);
        } else {
            ungrouped.push(node);
        }
    }

    const groupNodes = groups.map(group => {
        const children = childrenByGroupId.get(group.id) ?? [];

        return {
            id: `global-library-group:${group.id}`,
            type: 'global-library-group',
            groupId: group.id,
            name: group.name,
            collapsed: Boolean(group.collapsed),
            count: children.length,
            children,
        };
    });

    return {
        id: PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID,
        type: 'global-library',
        count: items.length,
        selecting,
        selectedCount,
        collapsed: Boolean(manager.globalLibraryCollapsed),
        loading: Boolean(manager.globalLibraryLoading),
        error: manager.globalLibraryError ? String(manager.globalLibraryError) : '',
        hasGroups: groupNodes.length > 0,
        ungrouped,
        groups: groupNodes,
    };
}

function syncPresetVueGlobalLibraryModelState(model) {
    if (!model) {
        return;
    }

    const nextLibrary = buildPresetVueGlobalLibraryItem();

    if (!model.globalLibrary) {
        model.globalLibrary = nextLibrary;
        return;
    }

    const library = model.globalLibrary;
    library.id = nextLibrary.id;
    library.type = nextLibrary.type;
    library.count = nextLibrary.count;
    library.selecting = nextLibrary.selecting;
    library.selectedCount = nextLibrary.selectedCount;
    library.collapsed = nextLibrary.collapsed;
    library.loading = nextLibrary.loading;
    library.error = nextLibrary.error;
    library.hasGroups = nextLibrary.hasGroups;
    library.ungrouped = syncPresetVueGlobalLibraryNodeList(library.ungrouped, nextLibrary.ungrouped);
    library.groups = syncPresetVueGlobalLibraryGroupList(library.groups, nextLibrary.groups);
}

function syncPresetVueGlobalLibraryNodeList(currentList, nextList) {
    const currentById = new Map(
        (Array.isArray(currentList) ? currentList : [])
            .filter(item => item?.id)
            .map(item => [item.id, item]),
    );
    const synced = nextList.map(nextItem => {
        const currentItem = currentById.get(nextItem.id);

        if (!currentItem) {
            return nextItem;
        }

        currentItem.name = nextItem.name;
        currentItem.content = nextItem.content;
        currentItem.groupId = nextItem.groupId;
        currentItem.type = nextItem.type;
        currentItem.selecting = nextItem.selecting;
        currentItem.selected = nextItem.selected;
        return currentItem;
    });

    if (Array.isArray(currentList)) {
        currentList.splice(0, currentList.length, ...synced);
        return currentList;
    }

    return synced;
}

function syncPresetVueGlobalLibraryGroupList(currentList, nextList) {
    const currentById = new Map(
        (Array.isArray(currentList) ? currentList : [])
            .filter(group => group?.groupId)
            .map(group => [group.groupId, group]),
    );
    const synced = nextList.map(nextGroup => {
        const currentGroup = currentById.get(nextGroup.groupId);

        if (!currentGroup) {
            return nextGroup;
        }

        currentGroup.id = nextGroup.id;
        currentGroup.type = nextGroup.type;
        currentGroup.groupId = nextGroup.groupId;
        currentGroup.name = nextGroup.name;
        currentGroup.collapsed = nextGroup.collapsed;
        currentGroup.count = nextGroup.count;
        currentGroup.children = syncPresetVueGlobalLibraryNodeList(currentGroup.children, nextGroup.children);
        return currentGroup;
    });

    if (Array.isArray(currentList)) {
        currentList.splice(0, currentList.length, ...synced);
        return currentList;
    }

    return synced;
}

function syncPresetVueGlobalLibrarySelectionState(model = getPresetVuePromptListManagerState().state) {
    const library = model?.globalLibrary;

    if (!library) {
        return false;
    }

    const manager = getPresetVuePromptListManagerState();
    const selectedIds = getPresetGlobalLibrarySelectedIds(manager);
    const selecting = Boolean(manager.globalLibrarySelecting);
    let selectedCount = 0;
    const syncNode = node => {
        if (!node?.id) {
            return;
        }

        const selected = selectedIds.has(node.id);
        node.selecting = selecting;
        node.selected = selected;

        if (selected) {
            selectedCount += 1;
        }
    };

    for (const node of library.ungrouped ?? []) {
        syncNode(node);
    }

    for (const group of library.groups ?? []) {
        for (const node of group.children ?? []) {
            syncNode(node);
        }
    }

    library.selecting = selecting;
    library.selectedCount = selectedCount;
    return true;
}

function renderPresetVuePromptGlobalLibrary(h, vueDraggableNext, item, { outsideList = false } = {}) {
    if (!item) {
        return null;
    }

    const model = getPresetVuePromptListManagerState().state;
    const mounted = isPresetVuePromptGroupBodyMounted(model, item);
    const selecting = Boolean(item.selecting);
    const tag = outsideList ? 'div' : 'li';
    const bodyContent = (() => {
        if (!mounted) {
            return [];
        }

        if (item.loading) {
            return [h('div', { class: 'bai-bai-preset-global-library-empty' }, t`全局库加载中...`)];
        }

        if (item.error) {
            return [h('div', { class: 'bai-bai-preset-global-library-empty' }, t`全局库加载失败`)];
        }

        if (item.count === 0 && !item.hasGroups) {
            return [h('div', { class: 'bai-bai-preset-global-library-empty' }, t`暂无全局条目`)];
        }

        const sections = [];

        if (selecting) {
            sections.push(renderPresetVueGlobalLibrarySelectionBar(h, item));
        }

        sections.push(renderPresetVueGlobalLibraryDraggable(h, vueDraggableNext, item.ungrouped, { groupId: null }));

        for (const group of item.groups) {
            sections.push(renderPresetVueGlobalLibraryGroup(h, vueDraggableNext, group));
        }

        return sections;
    })();

    return h(tag, {
        class: [
            'bai-bai-preset-global-library',
            outsideList ? 'bai-bai-preset-global-library-outside' : '',
            item.collapsed ? 'bai-bai-preset-global-library-collapsed' : '',
            selecting ? 'bai-bai-preset-global-library-selecting' : '',
        ],
        key: PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID,
    }, [
        h('div', {
            class: 'bai-bai-preset-group-header bai-bai-preset-global-library-header',
            onClick: event => {
                event.preventDefault();
                event.stopPropagation();
                togglePresetVuePromptGlobalLibraryCollapsed();
            },
        }, [
            h('span', { class: 'bai-bai-preset-group-title', title: t`全局库` }, [
                h('span', {
                    class: [
                        'menu_button',
                        'bai-bai-preset-group-toggle',
                        'fa-solid',
                        'fa-chevron-down',
                    ],
                    title: item.collapsed ? t`展开全局库` : t`收起全局库`,
                }),
                h('span', { class: 'bai-bai-preset-group-title-content' }, [
                    h('strong', null, t`全局库`),
                    h('small', { class: 'bai-bai-preset-group-count' }, `(${item.count})`),
                ]),
            ]),
            h('span', { class: 'bai-bai-preset-group-actions' }, [
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-new-group',
                    icon: 'fa-folder-plus',
                    text: t`新建分组`,
                    onClick: event => {
                        event.stopPropagation();
                        handlePresetPromptActionButtonClick(event);
                    },
                }),
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-toggle-select',
                    icon: selecting ? 'fa-square-check' : 'fa-list-check',
                    text: selecting ? t`退出多选` : t`多选`,
                    extraClasses: selecting ? ['bai-bai-preset-global-library-select-active'] : [],
                    onClick: event => {
                        event.stopPropagation();
                        handlePresetPromptActionButtonClick(event);
                    },
                }),
            ]),
        ]),
        h('div', {
            class: 'bai-bai-preset-group-body',
            'aria-hidden': item.collapsed ? 'true' : 'false',
        }, [
            h('div', { class: 'bai-bai-preset-group-body-inner' }, bodyContent),
        ]),
    ]);
}

function renderPresetVueGlobalLibrarySelectionBar(h, item) {
    const selectedCount = item.selectedCount ?? 0;

    return h('div', { class: 'bai-bai-preset-global-library-selection-bar', key: 'global-library-selection-bar' }, [
        h('span', { class: 'bai-bai-preset-global-library-selection-count' }, `${t`已选`} ${selectedCount}`),
        h('span', { class: 'bai-bai-preset-global-library-selection-actions' }, [
            renderPresetVuePromptActionButton(h, {
                action: 'global-library-insert-selected',
                icon: 'fa-plus',
                text: t`添加选中到当前预设`,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
            renderPresetVuePromptActionButton(h, {
                action: 'global-library-move-selected',
                icon: 'fa-folder-tree',
                text: t`移动选中到分组`,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
            renderPresetVuePromptActionButton(h, {
                action: 'global-library-delete-selected',
                icon: 'fa-trash',
                text: t`删除选中`,
                caution: true,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
        ]),
    ]);
}

function buildPresetVueGlobalLibraryDraggableProps(list, { groupId }) {
    const handleSelector = getPresetVuePromptDragHandleSelector();
    const selecting = Boolean(getPresetVuePromptListManagerState().state?.globalLibrary?.selecting);
    const dragDisabled = selecting;
    const draggableProps = {
        tag: 'ul',
        class: [
            'bai-bai-preset-group-list',
            'bai-bai-preset-global-library-list',
            list.length ? '' : 'bai-bai-preset-group-list-empty',
        ],
        list,
        group: {
            name: PRESET_VUE_GLOBAL_LIBRARY_DRAG_GROUP,
            pull: !dragDisabled,
            put: dragDisabled ? false : canPutPresetVueGlobalLibraryItem,
        },
        draggable: 'li.completion_prompt_manager_prompt_draggable',
        filter: isPresetVuePromptDragStartFiltered,
        preventOnFilter: false,
        sort: true,
        disabled: dragDisabled,
        animation: 0,
        emptyInsertThreshold: PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX,
        forceFallback: true,
        fallbackOnBody: true,
        fallbackClass: 'bai-bai-preset-vue-sortable-fallback',
        ghostClass: 'bai-bai-preset-vue-sortable-ghost',
        chosenClass: 'bai-bai-preset-vue-sortable-chosen',
        dragClass: 'bai-bai-preset-vue-sortable-drag',
        'data-global-library-group-id': groupId || '',
        onChoose: () => {
            closePresetPromptActionMenus();
        },
        onStart: () => notifyPresetVuePromptDragStarted(),
        onEnd: () => {
            void handlePresetGlobalLibraryDrop();
        },
    };
    applyPresetVueDragGestureOptions(draggableProps);

    if (handleSelector) {
        draggableProps.handle = handleSelector;
    }

    return draggableProps;
}

function renderPresetVueGlobalLibraryDraggable(h, vueDraggableNext, list, { groupId }) {
    const items = Array.isArray(list) ? list : [];
    const selecting = Boolean(getPresetVuePromptListManagerState().state?.globalLibrary?.selecting);

    if (selecting || !vueDraggableNext?.VueDraggableNext) {
        return h('ul', {
            class: [
                'bai-bai-preset-group-list',
                'bai-bai-preset-global-library-list',
                items.length ? '' : 'bai-bai-preset-group-list-empty',
            ],
            'data-global-library-group-id': groupId || '',
        }, items.map(child => renderPresetVuePromptGlobalLibraryRow(h, child)));
    }

    const draggableProps = buildPresetVueGlobalLibraryDraggableProps(items, { groupId });

    return h(vueDraggableNext.VueDraggableNext, draggableProps, {
        default: () => items.map(child => renderPresetVuePromptGlobalLibraryRow(h, child)),
    });
}

function canPutPresetVueGlobalLibraryItem(to, from, dragElement) {
    return dragElement instanceof HTMLElement && dragElement.matches('li.completion_prompt_manager_prompt_draggable');
}

function renderPresetVueGlobalLibraryGroup(h, vueDraggableNext, group) {
    return h('div', {
        class: [
            'bai-bai-preset-group',
            'bai-bai-preset-global-library-group',
            group.collapsed ? 'bai-bai-preset-group-collapsed' : '',
        ],
        'data-preset-global-library-group-id': group.groupId,
        key: group.id,
    }, [
        h('div', {
            class: 'bai-bai-preset-group-header bai-bai-preset-global-library-group-header',
            onClick: event => {
                event.preventDefault();
                event.stopPropagation();
                togglePresetGlobalLibraryGroupCollapsed(group.groupId);
            },
        }, [
            h('span', { class: 'bai-bai-preset-group-title', title: group.name }, [
                h('span', {
                    class: [
                        'menu_button',
                        'bai-bai-preset-group-toggle',
                        'fa-solid',
                        'fa-chevron-down',
                    ],
                    title: group.collapsed ? t`展开分组` : t`收起分组`,
                }),
                h('span', { class: 'bai-bai-preset-group-title-content' }, [
                    h('span', { class: 'fa-solid fa-folder bai-bai-preset-global-library-group-icon' }),
                    h('strong', null, group.name),
                    h('small', { class: 'bai-bai-preset-group-count' }, `(${group.count})`),
                ]),
            ]),
            h('span', { class: 'bai-bai-preset-group-actions' }, [
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-group-rename',
                    icon: 'fa-pencil',
                    text: t`重命名分组`,
                    onClick: event => {
                        event.stopPropagation();
                        handlePresetPromptActionButtonClick(event);
                    },
                }),
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-group-delete',
                    icon: 'fa-trash',
                    text: t`删除分组`,
                    caution: true,
                    onClick: event => {
                        event.stopPropagation();
                        handlePresetPromptActionButtonClick(event);
                    },
                }),
            ]),
        ]),
        h('div', {
            class: 'bai-bai-preset-group-body',
            'aria-hidden': group.collapsed ? 'true' : 'false',
        }, [
            h('div', { class: 'bai-bai-preset-group-body-inner' }, group.collapsed ? [] : [
                renderPresetVueGlobalLibraryDraggable(h, vueDraggableNext, group.children, { groupId: group.groupId }),
            ]),
        ]),
    ]);
}

function renderPresetVuePromptGlobalLibraryRow(h, item) {
    const prefix = promptManager?.configuration?.prefix ?? '';
    const name = item.name || t`未命名条目`;
    const selecting = Boolean(item.selecting);
    const selected = Boolean(item.selected);
    const leadingCell = selecting
        ? h('span', {
            class: [
                'bai-bai-preset-global-library-row-marker',
                'bai-bai-preset-global-library-select-box',
                selected ? 'bai-bai-preset-global-library-select-box-checked' : '',
                'fa-solid',
                selected ? 'fa-square-check' : 'fa-square',
            ],
            'data-preset-prompt-action': 'global-library-select-item',
            title: selected ? t`取消选择` : t`选择`,
            onClick: event => handlePresetPromptActionButtonClick(event),
        })
        : h('span', {
            class: 'drag-handle ui-sortable-handle bai-bai-preset-global-library-row-marker',
            title: t`拖动以移动到分组`,
        }, '\u2630');

    return h('li', {
        class: [
            `${prefix}prompt_manager_prompt`,
            'completion_prompt_manager_prompt_draggable',
            'bai-bai-preset-global-library-prompt',
            selected ? 'bai-bai-preset-global-library-prompt-selected' : '',
        ],
        'data-preset-global-library-id': item.id,
        key: `global-library:${item.id}`,
    }, [
        leadingCell,
        h('span', {
            class: `${prefix}prompt_manager_prompt_name`,
            title: name,
            'data-pm-name': name,
        }, [
            h('span', null, name),
        ]),
        h('span', null, [
            h('span', { class: 'prompt_manager_prompt_controls' }, [
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-delete',
                    icon: 'fa-trash',
                    text: t`删除全局库条目`,
                    caution: true,
                    onClick: event => handlePresetPromptActionButtonClick(event),
                }),
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-edit',
                    icon: 'fa-pencil',
                    text: t`编辑全局库条目`,
                    onClick: event => handlePresetPromptActionButtonClick(event),
                }),
                renderPresetVuePromptActionButton(h, {
                    action: 'global-library-insert',
                    icon: 'fa-plus',
                    text: t`添加到当前预设`,
                    onClick: event => handlePresetPromptActionButtonClick(event),
                }),
            ]),
        ]),
        h('span', { class: 'prompt_manager_prompt_tokens' }, '-'),
    ]);
}

function createEmptyPresetGlobalPromptLibrary() {
    return {
        version: PRESET_GLOBAL_LIBRARY_VERSION,
        items: [],
        groups: [],
    };
}

function normalizePresetGlobalPromptLibrary(value) {
    const sourceItems = Array.isArray(value)
        ? value
        : Array.isArray(value?.items)
            ? value.items
            : [];
    const sourceGroups = Array.isArray(value?.groups) ? value.groups : [];
    const groups = normalizePresetGlobalPromptLibraryGroups(sourceGroups);
    const validGroupIds = new Set(groups.map(group => group.id));

    return {
        version: PRESET_GLOBAL_LIBRARY_VERSION,
        items: normalizePresetGlobalPromptLibraryItems(sourceItems, validGroupIds),
        groups,
    };
}

function normalizePresetGlobalPromptLibraryGroups(groups) {
    if (!Array.isArray(groups)) {
        return [];
    }

    const seenIds = new Set();
    const normalizedGroups = [];

    for (const group of groups) {
        if (!group || typeof group !== 'object') {
            continue;
        }

        let id = String(group.id || '').trim();

        if (!id || seenIds.has(id)) {
            id = uuidv4();
        }

        seenIds.add(id);
        normalizedGroups.push({
            id,
            name: normalizePresetGlobalPromptLibraryName(group.name),
            collapsed: Boolean(group.collapsed),
        });
    }

    return normalizedGroups;
}

function normalizePresetGlobalPromptLibraryItems(items, validGroupIds = null) {
    if (!Array.isArray(items)) {
        return [];
    }

    const seenIds = new Set();
    const normalizedItems = [];

    for (const item of items) {
        if (!item || typeof item !== 'object') {
            continue;
        }

        let id = String(item.id || '').trim();

        if (!id || seenIds.has(id)) {
            id = uuidv4();
        }

        seenIds.add(id);

        const rawGroupId = String(item.groupId || '').trim();
        const groupId = rawGroupId && (!validGroupIds || validGroupIds.has(rawGroupId))
            ? rawGroupId
            : null;

        normalizedItems.push({
            id,
            name: normalizePresetGlobalPromptLibraryName(item.name),
            content: typeof item.content === 'string' ? item.content : String(item.content ?? ''),
            groupId,
        });
    }

    return normalizedItems;
}

function normalizePresetGlobalPromptLibraryName(name) {
    return String(name || '').trim() || t`未命名条目`;
}

async function ensureBaiBaoKuBridge() {
    const existing = globalThis.BaiBaoKu;

    if (existing && typeof existing.database === 'function') {
        return existing;
    }

    if (typeof document === 'undefined') {
        throw new Error('BaiBaoKu frontend bridge is not available.');
    }

    const manager = getPresetVuePromptListManagerState();

    if (manager.globalLibraryBridgePromise) {
        return manager.globalLibraryBridgePromise;
    }

    manager.globalLibraryBridgePromise = new Promise((resolve, reject) => {
        let settled = false;
        let timeoutId = null;

        const settle = (callback, value) => {
            if (settled) {
                return;
            }

            settled = true;
            window.removeEventListener('baibaoku:ready', handleReady);

            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            callback(value);
        };
        const handleReady = event => {
            const bridge = event?.detail || globalThis.BaiBaoKu;

            if (bridge && typeof bridge.database === 'function') {
                settle(resolve, bridge);
            }
        };
        const script = document.createElement('script');

        script.src = '/api/plugins/baibaoku/v1/client.js';
        script.async = true;
        script.dataset.baiBaiToolkitBaibaokuClient = 'true';
        script.addEventListener('load', () => {
            const bridge = globalThis.BaiBaoKu;

            if (bridge && typeof bridge.database === 'function') {
                settle(resolve, bridge);
            }
        }, { once: true });
        script.addEventListener('error', () => {
            settle(reject, new Error('Failed to load BaiBaoKu frontend bridge.'));
        }, { once: true });

        window.addEventListener('baibaoku:ready', handleReady);
        timeoutId = setTimeout(() => {
            const bridge = globalThis.BaiBaoKu;

            if (bridge && typeof bridge.database === 'function') {
                settle(resolve, bridge);
                return;
            }

            settle(reject, new Error('BaiBaoKu frontend bridge timed out.'));
        }, 5000);

        document.head.appendChild(script);
    }).finally(() => {
        manager.globalLibraryBridgePromise = null;
    });

    return manager.globalLibraryBridgePromise;
}

async function getPresetGlobalPromptLibraryDatabase() {
    const bridge = await ensureBaiBaoKuBridge();

    if (typeof bridge.isAvailable === 'function' && !await bridge.isAvailable()) {
        throw new Error('BaiBaoKu backend is not available.');
    }

    const database = bridge.database(PRESET_GLOBAL_LIBRARY_DATABASE);

    if (!database || typeof database.get !== 'function' || typeof database.set !== 'function') {
        throw new Error('BaiBaoKu database API is not available.');
    }

    return database;
}

function setPresetGlobalPromptLibraryRuntimeState(library, { loaded = true, loading = false, error = null } = {}) {
    const manager = getPresetVuePromptListManagerState();
    const normalized = normalizePresetGlobalPromptLibrary(library);

    manager.globalLibraryItems = normalized.items;
    manager.globalLibraryGroups = normalized.groups;
    manager.globalLibraryLoaded = loaded;
    manager.globalLibraryLoading = loading;
    manager.globalLibraryError = error;
    pruneGlobalLibrarySelectionToItems(manager);

    syncPresetVuePromptListManagerState();
    return normalized;
}

function pruneGlobalLibrarySelectionToItems(manager = getPresetVuePromptListManagerState()) {
    const selectedIds = getPresetGlobalLibrarySelectedIds(manager);

    if (selectedIds.size === 0) {
        return;
    }

    const validIds = new Set(
        normalizePresetGlobalPromptLibraryItems(manager.globalLibraryItems).map(item => item.id),
    );

    for (const id of Array.from(selectedIds)) {
        if (!validIds.has(id)) {
            selectedIds.delete(id);
        }
    }
}

async function loadPresetGlobalPromptLibrary({ force = false, showLoading = true } = {}) {
    const manager = getPresetVuePromptListManagerState();

    if (!force && manager.globalLibraryLoaded) {
        return normalizePresetGlobalPromptLibrary({ items: manager.globalLibraryItems, groups: manager.globalLibraryGroups });
    }

    if (!force && manager.globalLibraryLoadPromise) {
        return manager.globalLibraryLoadPromise;
    }

    manager.globalLibraryError = null;

    if (showLoading) {
        manager.globalLibraryLoading = true;
        syncPresetVuePromptListManagerState();
    }

    manager.globalLibraryLoadPromise = (async () => {
        try {
            const database = await getPresetGlobalPromptLibraryDatabase();
            const result = await database.get(PRESET_GLOBAL_LIBRARY_STORE, PRESET_GLOBAL_LIBRARY_KEY);
            const library = normalizePresetGlobalPromptLibrary(result?.exists ? result.value : createEmptyPresetGlobalPromptLibrary());

            setPresetGlobalPromptLibraryRuntimeState(library, { loaded: true, loading: false, error: null });
            return library;
        } catch (error) {
            manager.globalLibraryLoading = false;
            manager.globalLibraryLoaded = false;
            manager.globalLibraryError = error?.message || String(error);
            syncPresetVuePromptListManagerState();
            throw error;
        } finally {
            manager.globalLibraryLoadPromise = null;
        }
    })();

    return manager.globalLibraryLoadPromise;
}

async function updatePresetGlobalPromptLibrary(mutator) {
    const manager = getPresetVuePromptListManagerState();
    const previousSave = manager.globalLibrarySavePromise || Promise.resolve();
    const run = async () => {
        const currentLibrary = await loadPresetGlobalPromptLibrary({ force: true, showLoading: false });
        const draft = normalizePresetGlobalPromptLibrary(currentLibrary);
        const nextLibrary = normalizePresetGlobalPromptLibrary(await mutator(draft) || draft);
        const database = await getPresetGlobalPromptLibraryDatabase();

        await database.set(PRESET_GLOBAL_LIBRARY_STORE, PRESET_GLOBAL_LIBRARY_KEY, nextLibrary);
        setPresetGlobalPromptLibraryRuntimeState(nextLibrary, { loaded: true, loading: false, error: null });
        return nextLibrary;
    };

    const savePromise = previousSave.then(run, run);
    const trackedPromise = savePromise.finally(() => {
        if (manager.globalLibrarySavePromise === trackedPromise) {
            manager.globalLibrarySavePromise = null;
        }
    });

    manager.globalLibrarySavePromise = trackedPromise;
    return manager.globalLibrarySavePromise;
}

async function getPresetGlobalPromptLibraryItem(itemId) {
    if (!itemId) {
        return null;
    }

    const library = await loadPresetGlobalPromptLibrary();
    return library.items.find(item => item.id === itemId) ?? null;
}

function getPresetGlobalLibraryDialogHost() {
    return document.querySelector('#completion_prompt_manager')
        || document.querySelector(OPENAI_SETTINGS_SELECTOR)
        || document.body;
}

function isPresetGlobalLibraryDialogOpen() {
    return (extensionState.presetGlobalLibraryDialogOpenCount ?? 0) > 0;
}

function beginPresetGlobalLibraryDialogOpen() {
    extensionState.presetGlobalLibraryDialogOpenCount = (extensionState.presetGlobalLibraryDialogOpenCount ?? 0) + 1;
}

function endPresetGlobalLibraryDialogOpen() {
    const next = (extensionState.presetGlobalLibraryDialogOpenCount ?? 0) - 1;
    extensionState.presetGlobalLibraryDialogOpenCount = Math.max(0, next);

    if (extensionState.presetGlobalLibraryDialogOpenCount > 0) {
        return;
    }

    if (extensionState.presetPromptListRebuildDeferredByDialog) {
        extensionState.presetPromptListRebuildDeferredByDialog = false;

        if (settings.presetSwitchOptimizationEnabled && isPromptManagerReadyForFastPresetSwitch()) {
            void renderPromptManagerListWithoutTokenStats();
        }
    }
}

function shouldAutoFocusPresetGlobalLibraryDialog() {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
        return true;
    }

    return !window.matchMedia('(pointer: coarse)').matches;
}

function isPresetGlobalLibraryDialogMobileLayout() {
    return Boolean(
        typeof window !== 'undefined'
        && typeof window.matchMedia === 'function'
        && window.matchMedia('(max-width: 600px)').matches
    );
}

function clearPresetGlobalLibraryDialogLayerBounds(layer) {
    if (!(layer instanceof HTMLElement)) {
        return;
    }

    layer.style.removeProperty('--bai-bai-preset-global-library-dialog-top');
    layer.style.removeProperty('--bai-bai-preset-global-library-dialog-left');
    layer.style.removeProperty('--bai-bai-preset-global-library-dialog-width');
    layer.style.removeProperty('--bai-bai-preset-global-library-dialog-height');
}

function updatePresetGlobalLibraryDialogLayerBounds(host, layer) {
    if (!(host instanceof HTMLElement) || !(layer instanceof HTMLElement)) {
        return;
    }

    if (isPresetGlobalLibraryDialogMobileLayout()) {
        clearPresetGlobalLibraryDialogLayerBounds(layer);
        return;
    }

    const viewportWidth = window.innerWidth || document.documentElement?.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement?.clientHeight || 0;

    if (!viewportWidth || !viewportHeight) {
        return;
    }

    const rect = host.getBoundingClientRect();
    const visibleVertically = rect.bottom > 0 && rect.top < viewportHeight;
    const visibleTop = visibleVertically ? Math.max(0, rect.top) : 0;
    const visibleBottom = visibleVertically ? Math.min(viewportHeight, rect.bottom) : viewportHeight;
    const width = Math.max(280, Math.min(rect.width || 420, viewportWidth));
    const left = Math.min(Math.max(0, rect.left), Math.max(0, viewportWidth - width));
    const availableHeight = Math.max(240, viewportHeight - visibleTop);
    const height = Math.min(availableHeight, Math.max(320, visibleBottom - visibleTop));
    const top = Math.min(visibleTop, Math.max(0, viewportHeight - height));

    layer.style.setProperty('--bai-bai-preset-global-library-dialog-top', `${top}px`);
    layer.style.setProperty('--bai-bai-preset-global-library-dialog-left', `${left}px`);
    layer.style.setProperty('--bai-bai-preset-global-library-dialog-width', `${width}px`);
    layer.style.setProperty('--bai-bai-preset-global-library-dialog-height', `${height}px`);
}

function showPresetGlobalLibraryDialog({
    title,
    message = '',
    fields = [],
    confirmText = t`确定`,
    cancelText = t`取消`,
    danger = false,
} = {}) {
    const host = getPresetGlobalLibraryDialogHost();

    if (!(host instanceof HTMLElement)) {
        return Promise.resolve(null);
    }

    beginPresetGlobalLibraryDialogOpen();

    return new Promise(resolve => {
        const values = {};
        const previousHostPosition = host.style.position;
        const hadHostClass = host.classList.contains('bai-bai-preset-global-library-dialog-host');
        const layer = document.createElement('div');
        const dialog = document.createElement('div');
        const head = document.createElement('div');
        const titleElement = document.createElement('strong');
        const closeButton = document.createElement('span');
        const body = document.createElement('div');
        const actions = document.createElement('div');
        const cancelButton = document.createElement('span');
        const confirmButton = document.createElement('span');
        let updateDialogLayerBounds = null;

        let cleanedUp = false;
        const cleanup = result => {
            if (cleanedUp) {
                return;
            }
            cleanedUp = true;
            endPresetGlobalLibraryDialogOpen();
            document.removeEventListener('keydown', handleKeydown, true);

            if (updateDialogLayerBounds) {
                window.removeEventListener('resize', updateDialogLayerBounds);
                document.removeEventListener('scroll', updateDialogLayerBounds, true);
            }

            layer.remove();

            if (!hadHostClass && !host.querySelector('.bai-bai-preset-global-library-dialog-layer')) {
                host.classList.remove('bai-bai-preset-global-library-dialog-host');
                host.style.position = previousHostPosition;
            }

            resolve(result);
        };
        const confirm = () => cleanup({ ...values });
        const cancel = () => cleanup(null);
        const handleKeydown = event => {
            if (event.key === 'Escape') {
                event.preventDefault();
                event.stopPropagation();
                cancel();
                return;
            }

            if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
                event.preventDefault();
                event.stopPropagation();
                confirm();
            }
        };
        const stopPropagation = event => event.stopPropagation();

        host.classList.add('bai-bai-preset-global-library-dialog-host');
        layer.className = 'bai-bai-preset-global-library-dialog-layer';
        dialog.className = 'bai-bai-preset-global-library-dialog';
        dialog.tabIndex = -1;
        head.className = 'bai-bai-preset-global-library-dialog-head';
        body.className = 'bai-bai-preset-global-library-dialog-body';
        actions.className = 'bai-bai-preset-global-library-dialog-actions';
        titleElement.textContent = title || '';
        closeButton.className = 'menu_button fa-solid fa-xmark bai-bai-preset-global-library-dialog-button';
        closeButton.title = t`取消`;
        cancelButton.className = 'menu_button bai-bai-preset-global-library-dialog-button';
        cancelButton.textContent = cancelText;
        confirmButton.className = [
            'menu_button',
            'bai-bai-preset-global-library-dialog-button',
            danger ? 'bai-bai-preset-global-library-dialog-danger' : '',
        ].filter(Boolean).join(' ');
        confirmButton.textContent = confirmText;

        if (message) {
            const messageElement = document.createElement('div');

            messageElement.className = 'bai-bai-preset-global-library-dialog-message';
            messageElement.textContent = message;
            body.appendChild(messageElement);
        }

        for (const field of fields) {
            if (!field?.id) {
                continue;
            }

            const fieldWrapper = document.createElement('div');
            const label = document.createElement('label');
            let control = null;

            fieldWrapper.className = 'bai-bai-preset-global-library-dialog-field';
            label.textContent = field.label || field.id;
            label.setAttribute('for', `bai_bai_preset_global_library_${field.id}`);
            fieldWrapper.appendChild(label);

            if (field.type === 'textarea') {
                control = document.createElement('textarea');
                control.rows = Number(field.rows) || 8;
            } else if (field.type === 'select') {
                control = document.createElement('select');

                for (const option of field.options ?? []) {
                    const optionElement = document.createElement('option');

                    optionElement.value = String(option.value ?? '');
                    optionElement.textContent = String(option.label ?? option.value ?? '');
                    control.appendChild(optionElement);
                }
            } else {
                control = document.createElement('input');
                control.type = 'text';
            }

            control.id = `bai_bai_preset_global_library_${field.id}`;
            control.classList.add('text_pole');
            control.value = String(field.value ?? '');
            values[field.id] = control.value;
            control.addEventListener('input', () => {
                values[field.id] = control.value;
            });
            control.addEventListener('change', () => {
                values[field.id] = control.value;
            });
            fieldWrapper.appendChild(control);
            body.appendChild(fieldWrapper);
        }

        closeButton.addEventListener('click', cancel);
        cancelButton.addEventListener('click', cancel);
        confirmButton.addEventListener('click', confirm);
        layer.addEventListener('click', event => {
            if (event.target === layer) {
                cancel();
            }
        });
        dialog.addEventListener('mousedown', stopPropagation);
        dialog.addEventListener('pointerdown', stopPropagation);
        dialog.addEventListener('click', stopPropagation);
        document.addEventListener('keydown', handleKeydown, true);

        head.append(titleElement, closeButton);
        actions.append(cancelButton, confirmButton);
        dialog.append(head, body, actions);
        layer.appendChild(dialog);
        host.appendChild(layer);
        updateDialogLayerBounds = () => updatePresetGlobalLibraryDialogLayerBounds(host, layer);
        updateDialogLayerBounds();
        window.addEventListener('resize', updateDialogLayerBounds);
        document.addEventListener('scroll', updateDialogLayerBounds, true);

        if (shouldAutoFocusPresetGlobalLibraryDialog()) {
            dialog.focus({ preventScroll: true });
        }
    });
}

function togglePresetVuePromptGlobalLibraryCollapsed() {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;
    const nextCollapsed = !manager.globalLibraryCollapsed;
    const mountId = PRESET_VUE_GLOBAL_LIBRARY_ENTRY_ID;

    runPresetVuePromptBodyHeightTransition(mountId, !nextCollapsed, () => {
        manager.globalLibraryCollapsed = nextCollapsed;

        if (!nextCollapsed) {
            clearPresetVuePromptGroupBodyUnmountTimer(manager, mountId);
            setPresetVuePromptGroupBodyMounted(model, mountId, true);
        }

        const modelLibrary = model?.globalLibrary;

        if (modelLibrary) {
            modelLibrary.collapsed = nextCollapsed;
        }

        if (nextCollapsed) {
            schedulePresetVuePromptGroupBodyUnmount(mountId);
        }

        markPresetVuePromptListSyncSignatureCurrent();
    });
}

function togglePresetGlobalLibrarySelecting() {
    const manager = getPresetVuePromptListManagerState();
    manager.globalLibrarySelecting = !manager.globalLibrarySelecting;

    if (!manager.globalLibrarySelecting) {
        getPresetGlobalLibrarySelectedIds(manager).clear();
    }

    syncPresetVueGlobalLibrarySelectionState(manager.state);
}

function togglePresetGlobalLibrarySelectedItem(itemId) {
    if (!itemId) {
        return;
    }

    const manager = getPresetVuePromptListManagerState();
    const selectedIds = getPresetGlobalLibrarySelectedIds(manager);

    if (selectedIds.has(itemId)) {
        selectedIds.delete(itemId);
    } else {
        selectedIds.add(itemId);
    }

    syncPresetVueGlobalLibrarySelectionState(manager.state);
}

function getPresetGlobalLibrarySelectedItemIds() {
    const manager = getPresetVuePromptListManagerState();
    const selectedIds = getPresetGlobalLibrarySelectedIds(manager);
    // 按库内条目顺序返回,保证批量插入顺序稳定。
    return normalizePresetGlobalPromptLibraryItems(manager.globalLibraryItems)
        .map(item => item.id)
        .filter(id => selectedIds.has(id));
}

async function insertSelectedPresetGlobalLibraryItemsToCurrentPreset() {
    const ids = getPresetGlobalLibrarySelectedItemIds();

    if (ids.length === 0) {
        toastr.warning(t`请先选择要添加的条目。`);
        return;
    }

    const inserted = await insertPresetGlobalLibraryItemsToCurrentPreset(ids);

    if (inserted) {
        togglePresetGlobalLibrarySelecting();
    }
}

async function moveSelectedPresetGlobalLibraryItemsToGroup() {
    const ids = getPresetGlobalLibrarySelectedItemIds();

    if (ids.length === 0) {
        toastr.warning(t`请先选择要移动的条目。`);
        return;
    }

    const library = await loadPresetGlobalPromptLibrary();
    const result = await showPresetGlobalLibraryDialog({
        title: t`移动选中到分组`,
        fields: [{
            id: 'target',
            type: 'select',
            label: t`目标分组`,
            value: '',
            options: [
                { value: '', label: t`未分组` },
                ...library.groups.map(group => ({ value: group.id, label: group.name })),
            ],
        }],
        confirmText: t`移动`,
        cancelText: t`取消`,
    });

    if (!result) {
        return;
    }

    const targetGroupId = String(result.target || '').trim() || null;
    const idSet = new Set(ids);

    try {
        await updatePresetGlobalPromptLibrary(currentLibrary => {
            const validGroupIds = new Set(currentLibrary.groups.map(group => group.id));
            const groupId = targetGroupId && validGroupIds.has(targetGroupId) ? targetGroupId : null;
            currentLibrary.items = currentLibrary.items.map(item => idSet.has(item.id)
                ? { ...item, groupId }
                : item);
            return currentLibrary;
        });
        toastr.success(t`已移动 ${ids.length} 条。`);
        togglePresetGlobalLibrarySelecting();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to move selected global library items`, error);
        toastr.error(t`移动条目失败。`);
    }
}

async function deleteSelectedPresetGlobalLibraryItems() {
    const ids = getPresetGlobalLibrarySelectedItemIds();

    if (ids.length === 0) {
        toastr.warning(t`请先选择要删除的条目。`);
        return;
    }

    const confirmed = await showPresetGlobalLibraryDialog({
        title: t`删除选中`,
        message: t`要删除选中的 ${ids.length} 条全局库条目吗？`,
        confirmText: t`删除`,
        cancelText: t`取消`,
        danger: true,
    });

    if (!confirmed) {
        return;
    }

    const idSet = new Set(ids);

    try {
        await updatePresetGlobalPromptLibrary(currentLibrary => {
            currentLibrary.items = currentLibrary.items.filter(item => !idSet.has(item.id));
            return currentLibrary;
        });
        toastr.success(t`已删除 ${ids.length} 条。`);
        togglePresetGlobalLibrarySelecting();
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to delete selected global library items`, error);
        toastr.error(t`删除条目失败。`);
    }
}

async function addPresetPromptToGlobalLibrary(promptId) {
    if (!promptId) {
        toastr.warning(t`没有找到要添加到全局库的条目。`);
        return false;
    }

    const sourcePrompt = promptManager?.getPromptById?.(promptId);

    if (!sourcePrompt) {
        toastr.warning(t`没有找到要添加到全局库的条目。`);
        return false;
    }

    const item = {
        id: uuidv4(),
        name: normalizePresetGlobalPromptLibraryName(sourcePrompt.name),
        content: typeof sourcePrompt.content === 'string' ? sourcePrompt.content : String(sourcePrompt.content ?? ''),
    };

    try {
        await updatePresetGlobalPromptLibrary(library => {
            library.items.push(item);
            return library;
        });
        toastr.success(t`已添加到全局库。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to add preset prompt to global library`, error);
        toastr.error(t`添加到全局库失败。`);
        return false;
    }
}

async function insertPresetGlobalPromptLibraryItemToCurrentPreset(itemId) {
    return insertPresetGlobalLibraryItemsToCurrentPreset(itemId ? [itemId] : []);
}

async function insertPresetGlobalLibraryItemsToCurrentPreset(itemIds) {
    const ids = Array.isArray(itemIds) ? itemIds.filter(Boolean) : [];

    if (ids.length === 0) {
        toastr.warning(t`没有要添加的全局库条目。`);
        return false;
    }

    if (
        !promptManager?.activeCharacter
        || !Array.isArray(promptManager.serviceSettings?.prompts)
        || typeof promptManager.addPrompt !== 'function'
    ) {
        toastr.warning(t`当前无法添加全局库条目。`);
        return false;
    }

    const promptOrder = promptManager.getPromptOrderForCharacter?.(promptManager.activeCharacter);

    if (!Array.isArray(promptOrder)) {
        toastr.warning(t`当前预设列表不可用。`);
        return false;
    }

    const library = await loadPresetGlobalPromptLibrary();
    const itemsById = new Map(library.items.map(item => [item.id, item]));
    const items = ids.map(id => itemsById.get(id)).filter(Boolean);

    if (items.length === 0) {
        toastr.warning(t`没有找到要添加的全局库条目。`);
        return false;
    }

    const target = await choosePresetGlobalPromptInsertTarget();

    if (!target) {
        return false;
    }

    const counts = promptManager.tokenHandler?.getCounts?.();
    // 目标为「预设顶部」时,insertPresetGlobalPromptOrderEntry 用 unshift,
    // 逆序插入才能让整批保持选择顺序;分组目标则顺序追加在组末,正序即可。
    const ordered = target?.type === 'group' ? items : items.slice().reverse();

    for (const item of ordered) {
        const promptId = createUniquePresetPromptIdentifier();
        const promptName = createPresetGlobalPromptInsertName(item.name);

        promptManager.addPrompt({
            name: promptName,
            role: 'system',
            content: item.content,
        }, promptId);

        insertPresetGlobalPromptOrderEntry(promptOrder, { identifier: promptId, enabled: true }, target);

        if (counts) {
            counts[promptId] = null;
        }

        promptManager.log?.(`Added global library prompt: ${item.id} -> ${promptId}.`);
    }

    refreshPresetPromptListAfterCopy();

    try {
        markPresetPromptServiceSettingsSavePending();
        await flushPendingPresetPromptChanges({ includeOpenAiPresetSaves: false });
        toastr.success(items.length > 1 ? t`已添加 ${items.length} 条到当前预设。` : t`已添加到当前预设。`);
        refreshPromptManagerTokensDebounced();
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to save global library prompt insert`, error);
        toastr.error(t`添加到当前预设后保存失败。`);
        return false;
    }
}

async function choosePresetGlobalPromptInsertTarget() {
    const groupState = getPresetPromptGroupState();
    const groups = Array.isArray(groupState?.groups)
        ? groupState.groups.filter(group => group?.id && String(group.name || '').trim())
        : [];

    if (!groups.length) {
        return { type: 'top' };
    }

    const result = await showPresetGlobalLibraryDialog({
        title: t`添加到当前预设`,
        fields: [{
            id: 'target',
            type: 'select',
            label: t`添加位置`,
            value: 'top',
            options: [
                { value: 'top', label: t`独立在预设最上方` },
                ...groups.map(group => ({
                    value: group.id,
                    label: group.name,
                })),
            ],
        }],
        confirmText: t`添加`,
        cancelText: t`取消`,
    });

    if (!result) {
        return null;
    }

    return result.target === 'top'
        ? { type: 'top' }
        : { type: 'group', groupId: result.target };
}

function insertPresetGlobalPromptOrderEntry(promptOrder, orderEntry, target) {
    if (!Array.isArray(promptOrder) || !orderEntry?.identifier) {
        return;
    }

    if (target?.type !== 'group' || !target.groupId) {
        promptOrder.unshift(orderEntry);
        return;
    }

    const groupState = getPresetPromptGroupState();
    const groupExists = Array.isArray(groupState.groups)
        && groupState.groups.some(group => group?.id === target.groupId);

    if (!groupExists) {
        promptOrder.unshift(orderEntry);
        return;
    }

    if (!groupState.prompts || typeof groupState.prompts !== 'object') {
        groupState.prompts = {};
    }

    const groupPromptIds = new Set(
        Object.entries(groupState.prompts ?? {})
            .filter(([, meta]) => meta?.groupId === target.groupId)
            .map(([promptId]) => promptId),
    );
    let insertIndex = 0;

    for (let index = 0; index < promptOrder.length; index += 1) {
        if (groupPromptIds.has(promptOrder[index]?.identifier)) {
            insertIndex = index + 1;
        }
    }

    promptOrder.splice(insertIndex, 0, orderEntry);
    groupState.prompts[orderEntry.identifier] = { groupId: target.groupId };
    savePresetPromptGroupSettings({ force: true });
}

function createPresetGlobalPromptInsertName(name) {
    const baseName = normalizePresetGlobalPromptLibraryName(name);
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

async function editPresetGlobalPromptLibraryItem(itemId) {
    const item = await getPresetGlobalPromptLibraryItem(itemId);

    if (!item) {
        toastr.warning(t`没有找到这个全局库条目。`);
        return false;
    }

    const result = await showPresetGlobalLibraryDialog({
        title: t`编辑全局库条目`,
        fields: [
            {
                id: 'name',
                type: 'text',
                label: t`名称`,
                value: item.name,
            },
            {
                id: 'content',
                type: 'textarea',
                label: t`内容`,
                value: item.content,
                rows: 16,
            },
        ],
        confirmText: t`保存`,
        cancelText: t`取消`,
    });

    if (!result) {
        return false;
    }

    const normalizedName = normalizePresetGlobalPromptLibraryName(result.name);
    const nextContent = typeof result.content === 'string' ? result.content : String(result.content ?? '');

    try {
        await updatePresetGlobalPromptLibrary(library => {
            library.items = library.items.map(entry => entry.id === itemId
                ? {
                    id: entry.id,
                    name: normalizedName,
                    content: nextContent,
                }
                : entry);
            return library;
        });
        toastr.success(t`已更新全局库条目。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to edit preset global library item`, error);
        toastr.error(t`更新全局库条目失败。`);
        return false;
    }
}

async function deletePresetGlobalPromptLibraryItem(itemId) {
    const item = await getPresetGlobalPromptLibraryItem(itemId);

    if (!item) {
        toastr.warning(t`没有找到这个全局库条目。`);
        return false;
    }

    const confirmed = await showPresetGlobalLibraryDialog({
        title: t`删除全局库条目`,
        message: t`要删除这个全局库条目吗？`,
        confirmText: t`删除`,
        cancelText: t`取消`,
        danger: true,
    });

    if (!confirmed) {
        return false;
    }

    try {
        await updatePresetGlobalPromptLibrary(library => {
            library.items = library.items.filter(entry => entry.id !== itemId);
            return library;
        });
        toastr.success(t`已删除全局库条目。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to delete preset global library item`, error);
        toastr.error(t`删除全局库条目失败。`);
        return false;
    }
}

// 拖拽落地:vue-draggable 已就地改动 model.globalLibrary 的 ungrouped / groups[].children,
// 从中读出每个条目的最终归属与顺序,写回权威 library 并持久化。失败时重载还原。
async function handlePresetGlobalLibraryDrop() {
    const model = getPresetVuePromptListManagerState().state;
    const library = model?.globalLibrary;

    if (!library) {
        return;
    }

    const desired = [];
    const seen = new Set();
    const pushNode = (node, groupId) => {
        if (!node?.id || seen.has(node.id)) {
            return;
        }
        seen.add(node.id);
        desired.push({ id: node.id, groupId: groupId || null });
    };

    for (const node of Array.isArray(library.ungrouped) ? library.ungrouped : []) {
        pushNode(node, null);
    }

    for (const group of Array.isArray(library.groups) ? library.groups : []) {
        for (const node of Array.isArray(group.children) ? group.children : []) {
            pushNode(node, group.groupId);
        }
    }

    const desiredById = new Map(desired.map(entry => [entry.id, entry.groupId]));

    try {
        await updatePresetGlobalPromptLibrary(currentLibrary => {
            const validGroupIds = new Set(currentLibrary.groups.map(group => group.id));
            const remaining = currentLibrary.items.slice();
            const reordered = [];

            for (const entry of desired) {
                const index = remaining.findIndex(item => item.id === entry.id);

                if (index === -1) {
                    continue;
                }

                const [item] = remaining.splice(index, 1);
                item.groupId = entry.groupId && validGroupIds.has(entry.groupId) ? entry.groupId : null;
                reordered.push(item);
            }

            for (const item of remaining) {
                if (desiredById.has(item.id)) {
                    const groupId = desiredById.get(item.id);
                    item.groupId = groupId && validGroupIds.has(groupId) ? groupId : null;
                }
                reordered.push(item);
            }

            currentLibrary.items = reordered;
            return currentLibrary;
        });
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to persist global library drag`, error);
        toastr.error(t`移动全局库条目失败。`);
        void loadPresetGlobalPromptLibrary({ force: true, showLoading: false });
    }
}

async function createPresetGlobalLibraryGroup() {
    const result = await showPresetGlobalLibraryDialog({
        title: t`新建分组`,
        fields: [{
            id: 'name',
            type: 'text',
            label: t`分组名称`,
            value: '',
        }],
        confirmText: t`创建`,
        cancelText: t`取消`,
    });

    if (!result) {
        return false;
    }

    const name = normalizePresetGlobalPromptLibraryName(result.name);

    try {
        await updatePresetGlobalPromptLibrary(library => {
            library.groups.push({ id: uuidv4(), name, collapsed: false });
            return library;
        });
        toastr.success(t`已新建分组。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to create global library group`, error);
        toastr.error(t`新建分组失败。`);
        return false;
    }
}

async function renamePresetGlobalLibraryGroup(groupId) {
    if (!groupId) {
        return false;
    }

    const library = await loadPresetGlobalPromptLibrary();
    const group = library.groups.find(entry => entry.id === groupId);

    if (!group) {
        toastr.warning(t`没有找到这个分组。`);
        return false;
    }

    const result = await showPresetGlobalLibraryDialog({
        title: t`重命名分组`,
        fields: [{
            id: 'name',
            type: 'text',
            label: t`分组名称`,
            value: group.name,
        }],
        confirmText: t`保存`,
        cancelText: t`取消`,
    });

    if (!result) {
        return false;
    }

    const name = normalizePresetGlobalPromptLibraryName(result.name);

    try {
        await updatePresetGlobalPromptLibrary(currentLibrary => {
            currentLibrary.groups = currentLibrary.groups.map(entry => entry.id === groupId
                ? { ...entry, name }
                : entry);
            return currentLibrary;
        });
        toastr.success(t`已重命名分组。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to rename global library group`, error);
        toastr.error(t`重命名分组失败。`);
        return false;
    }
}

async function deletePresetGlobalLibraryGroup(groupId) {
    if (!groupId) {
        return false;
    }

    const library = await loadPresetGlobalPromptLibrary();
    const group = library.groups.find(entry => entry.id === groupId);

    if (!group) {
        toastr.warning(t`没有找到这个分组。`);
        return false;
    }

    const confirmed = await showPresetGlobalLibraryDialog({
        title: t`删除分组`,
        message: t`删除分组后,组内条目会移到未分组,条目本身不会被删除。确定删除吗？`,
        confirmText: t`删除`,
        cancelText: t`取消`,
        danger: true,
    });

    if (!confirmed) {
        return false;
    }

    try {
        await updatePresetGlobalPromptLibrary(currentLibrary => {
            currentLibrary.groups = currentLibrary.groups.filter(entry => entry.id !== groupId);
            currentLibrary.items = currentLibrary.items.map(item => item.groupId === groupId
                ? { ...item, groupId: null }
                : item);
            return currentLibrary;
        });
        toastr.success(t`已删除分组。`);
        return true;
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to delete global library group`, error);
        toastr.error(t`删除分组失败。`);
        return false;
    }
}

function togglePresetGlobalLibraryGroupCollapsed(groupId) {
    if (!groupId) {
        return;
    }

    // UI-only state: expanding/collapsing global-library groups must not hit storage.
    const model = getPresetVuePromptListManagerState().state;
    const modelGroup = model?.globalLibrary?.groups?.find(group => group.groupId === groupId);
    const nextCollapsed = modelGroup ? !modelGroup.collapsed : true;

    if (modelGroup) {
        modelGroup.collapsed = nextCollapsed;
    }

    const manager = getPresetVuePromptListManagerState();
    manager.globalLibraryGroups = normalizePresetGlobalPromptLibraryGroups(manager.globalLibraryGroups)
        .map(group => group.id === groupId ? { ...group, collapsed: nextCollapsed } : group);
    markPresetVuePromptListSyncSignatureCurrent();
}

function getPresetGlobalLibraryItemIdFromAction(action) {
    const row = action instanceof Element
        ? action.closest('.bai-bai-preset-global-library-prompt[data-preset-global-library-id]')
        : null;

    return row?.dataset?.presetGlobalLibraryId || null;
}

function getPresetGlobalLibraryGroupIdFromAction(action) {
    const group = action instanceof Element
        ? action.closest('[data-preset-global-library-group-id]')
        : null;

    return group?.dataset?.presetGlobalLibraryGroupId || null;
}

function getPresetPromptIdFromAction(action) {
    const row = action instanceof Element
        ? action.closest(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li.completion_prompt_manager_prompt[data-pm-identifier]`)
        : null;

    return row?.dataset?.pmIdentifier || null;
}

function isPresetPromptAssignedToExistingGroup(promptId) {
    if (!promptId) {
        return false;
    }

    const groupState = getPresetPromptGroupState();
    const groupId = groupState.prompts?.[promptId]?.groupId;

    return Boolean(groupId && groupState.groups?.some(group => group?.id === groupId));
}

export {
    addPresetPromptToGlobalLibrary,
    beginPresetGlobalLibraryDialogOpen,
    buildPresetVueGlobalLibraryDraggableProps,
    buildPresetVueGlobalLibraryItem,
    canPutPresetVueGlobalLibraryItem,
    choosePresetGlobalPromptInsertTarget,
    clearPresetGlobalLibraryDialogLayerBounds,
    createEmptyPresetGlobalPromptLibrary,
    createPresetGlobalLibraryGroup,
    createPresetGlobalPromptInsertName,
    deletePresetGlobalLibraryGroup,
    deletePresetGlobalPromptLibraryItem,
    deleteSelectedPresetGlobalLibraryItems,
    editPresetGlobalPromptLibraryItem,
    endPresetGlobalLibraryDialogOpen,
    ensureBaiBaoKuBridge,
    getPresetGlobalLibraryDialogHost,
    getPresetGlobalLibraryGroupIdFromAction,
    getPresetGlobalLibraryItemIdFromAction,
    getPresetGlobalLibrarySelectedIds,
    getPresetGlobalLibrarySelectedItemIds,
    getPresetGlobalPromptLibraryDatabase,
    getPresetGlobalPromptLibraryItem,
    getPresetPromptIdFromAction,
    handlePresetGlobalLibraryDrop,
    insertPresetGlobalLibraryItemsToCurrentPreset,
    insertPresetGlobalPromptLibraryItemToCurrentPreset,
    insertPresetGlobalPromptOrderEntry,
    insertSelectedPresetGlobalLibraryItemsToCurrentPreset,
    isPresetGlobalLibraryDialogMobileLayout,
    isPresetGlobalLibraryDialogOpen,
    isPresetPromptAssignedToExistingGroup,
    loadPresetGlobalPromptLibrary,
    moveSelectedPresetGlobalLibraryItemsToGroup,
    normalizePresetGlobalPromptLibrary,
    normalizePresetGlobalPromptLibraryGroups,
    normalizePresetGlobalPromptLibraryItems,
    normalizePresetGlobalPromptLibraryName,
    pruneGlobalLibrarySelectionToItems,
    renamePresetGlobalLibraryGroup,
    renderPresetVueGlobalLibraryDraggable,
    renderPresetVueGlobalLibraryGroup,
    renderPresetVueGlobalLibrarySelectionBar,
    renderPresetVuePromptGlobalLibrary,
    renderPresetVuePromptGlobalLibraryRow,
    setPresetGlobalPromptLibraryRuntimeState,
    shouldAutoFocusPresetGlobalLibraryDialog,
    showPresetGlobalLibraryDialog,
    syncPresetVueGlobalLibraryGroupList,
    syncPresetVueGlobalLibraryModelState,
    syncPresetVueGlobalLibraryNodeList,
    syncPresetVueGlobalLibrarySelectionState,
    togglePresetGlobalLibraryGroupCollapsed,
    togglePresetGlobalLibrarySelectedItem,
    togglePresetGlobalLibrarySelecting,
    togglePresetVuePromptGlobalLibraryCollapsed,
    updatePresetGlobalLibraryDialogLayerBounds,
    updatePresetGlobalPromptLibrary,
};
