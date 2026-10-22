import { t } from '@sillytavern/scripts/i18n';
import { promptManager } from '@sillytavern/scripts/openai';
import { INJECTION_POSITION } from '@sillytavern/scripts/PromptManager';
import { isMobile } from '@sillytavern/scripts/RossAscends-mods';
import { FORCE_EDIT_PROMPTS, FORCE_TOGGLE_PROMPTS, PRESET_EFFECTIVE_TOKEN_HEADER_CLASS, PRESET_EFFECTIVE_TOKEN_HEADER_TITLE, PRESET_PROMPT_MANAGER_LIST_SELECTOR, PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX, PRESET_VUE_FAVORITES_ENTRY_ID, PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS, PRESET_VUE_HEADER_ENTRY_ID, PRESET_VUE_SEPARATOR_ENTRY_ID, PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS, PRESET_VUE_TOP_LEVEL_DRAGGABLE_SELECTOR } from './constants.js';
import { getCurrentPresetPromptFavoritesState, isCurrentPresetPromptFavorite, renderPresetVuePromptFavorites } from './favorites.js';
import { renderPresetVuePromptGlobalLibrary } from './globalLibrary.js';
import { getPresetPromptGroupState, normalizePresetPromptGroupState } from './groupState.js';
import { closePresetPromptActionMenus, handlePresetPromptActionButtonClick, togglePresetPromptActionMenu } from './listActions.js';
import { schedulePresetVuePromptOrderSaveAfterDrop } from './pendingChanges.js';
import { getPresetVuePromptSearchView, isPresetVuePromptSearchFiltering, isPresetVuePromptSearchGroupCollapsed, isPresetVuePromptSearchOpen, renderPresetVuePromptSearchBar, renderPresetVuePromptSearchHighlight, renderPresetVuePromptSearchSnippet, renderPresetVuePromptSearchToggle } from './search.js';
import { settings } from './state.js';
import { calculatePresetEffectivePromptTokenTotal, formatPresetEffectiveTokenHeaderText, getPromptImportantClass, getPromptTokenWarning } from './switchFast.js';
import { isPresetGroupingEnabled } from './util.js';
import { applyPresetVueDragGestureOptions, beginPresetVuePromptGroupHeaderGesture, beginPresetVuePromptManualDrag, canPutPresetVuePromptIntoGroupList, canPutPresetVuePromptIntoTopLevelList, cancelPresetVuePromptGroupHeaderGesture, consumePresetVuePromptDragChange, finishPresetVuePromptGroupHeaderGesture, finishPresetVuePromptManualDrag, getPresetVuePromptDragHandleSelector, handlePresetVuePromptGroupHeaderClickFallback, isPresetVuePromptDragStartFiltered, isPresetVuePromptGroupDragMoveAllowed, isPresetVuePromptTopLevelDragMoveAllowed, movePresetVuePromptGroupHeaderGesture, renderPresetVuePromptGroupBody, setPresetVuePromptDragging } from './vueDrag.js';
import { getPresetVuePromptListManagerState, isPresetVuePromptDragLockSettingEnabled, isPresetVuePromptDragLocked, togglePresetVuePromptDragLocked } from './vueList.js';
import { cancelPresetVuePromptGroupRangeSelection, deletePresetVuePromptGroup, getPresetVuePromptRangeClasses, handlePresetVuePromptRangeSelectionClick, renamePresetVuePromptGroup, startPresetVuePromptGroupRangeSelection, togglePresetVuePromptGroupCollapsed, togglePresetVuePromptGroupEnabled, updatePresetVuePromptRangeSelectionHover } from './vueModel.js';

function buildPresetVuePromptListItems() {
    const promptOrder = promptManager.getPromptOrderForCharacter?.(promptManager.activeCharacter) ?? [];
    const promptOrderIds = promptOrder.map(entry => entry?.identifier).filter(Boolean);
    const prompts = Array.isArray(promptManager.serviceSettings?.prompts)
        ? promptManager.serviceSettings.prompts.filter(Boolean)
        : [];
    const promptById = new Map(prompts.map(prompt => [prompt.identifier, prompt]));
    const groupState = getPresetPromptGroupState();
    normalizePresetPromptGroupState(groupState, new Set(promptOrderIds));
    const groupsById = new Map(groupState.groups.map(group => [group.id, group]));
    const favoriteState = getCurrentPresetPromptFavoritesState(promptOrderIds);
    const favoritePromptIds = new Set(favoriteState.promptIds);
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
                favorite: favoritePromptIds.has(prompt.identifier),
                tokens,
                calculatedTokens: tokens ? String(tokens) : '-',
                warningClass,
                warningTitle,
                index,
            };
        })
        .filter(Boolean);

    const favoriteChildren = promptItems
        .filter(item => item.favorite)
        .map(item => ({
            ...item,
            favoriteMirror: true,
        }));
    const items = [
        { id: PRESET_VUE_HEADER_ENTRY_ID, type: 'header' },
        { id: PRESET_VUE_SEPARATOR_ENTRY_ID, type: 'separator' },
    ];

    if (favoriteChildren.length > 0) {
        items.push({
            id: PRESET_VUE_FAVORITES_ENTRY_ID,
            type: 'favorites',
            count: favoriteChildren.length,
            collapsed: Boolean(favoriteState.collapsed),
            children: favoriteChildren,
        });
    }

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
                    enabled: group?.enabled !== false,
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
            return [
                renderPresetVuePromptGlobalLibrary(h, vueDraggableNext, model.globalLibrary, { outsideList: true }),
                renderPresetVuePromptDraggable(h, vueDraggableNext, model),
            ];
        },
    };
}

function renderPresetVuePromptListHeader(h, model) {
    const prefix = promptManager?.configuration?.prefix ?? '';
    const selecting = Boolean(model?.rangeSelection?.active);
    // 锁按钮只反映用户自己的设置;搜索筛选时的临时暂停拖拽不算锁定。
    const dragLocked = isPresetVuePromptDragLockSettingEnabled();
    const searchOpen = isPresetVuePromptSearchOpen(model);

    return h('li', {
        class: [
            `${prefix}prompt_manager_list_head`,
            searchOpen ? 'bai-bai-preset-list-head-searching' : '',
        ],
        key: 'header',
    }, [
        h('span', {
            class: PRESET_EFFECTIVE_TOKEN_HEADER_CLASS,
            title: PRESET_EFFECTIVE_TOKEN_HEADER_TITLE,
        }, formatPresetEffectiveTokenHeaderText(calculatePresetEffectivePromptTokenTotal())),
        h('span', { class: 'bai-bai-preset-list-head-actions' }, [
            renderPresetVuePromptSearchToggle(h, model),
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
            h('span', {
                class: [
                    'menu_button',
                    'fa-solid',
                    dragLocked ? 'fa-lock' : 'fa-lock-open',
                    'bai-bai-preset-drag-lock-toggle',
                    dragLocked ? 'bai-bai-preset-drag-lock-toggle-active' : '',
                ],
                title: dragLocked ? t`解锁预设拖拽` : t`锁定预设拖拽`,
                'aria-pressed': dragLocked ? 'true' : 'false',
                onClick: event => {
                    event.preventDefault();
                    event.stopPropagation();
                    togglePresetVuePromptDragLocked();
                },
            }),
        ]),
        ...(searchOpen ? renderPresetVuePromptSearchBar(h, model) : []),
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
    // Sortable 配置只在重建时生效,这里只放用户的锁定设置;搜索筛选、分组选择这类临时锁定
    // 由 filter 动态拦住(打字时重建会打断输入)。dragLocked 含临时锁定,只用于样式。
    const dragLocked = isPresetVuePromptDragLocked();
    const dragDisabled = isPresetVuePromptDragLockSettingEnabled();
    const draggableProps = {
        tag: 'ul',
        id: PRESET_PROMPT_MANAGER_LIST_SELECTOR.slice(1),
        class: [
            model.listClassName,
            dragLocked ? 'bai-bai-preset-drag-locked' : '',
            // 手机上显示手柄:关闭整条拖拽时它是唯一入口,整条拖时按住它能立刻拖、别处要长按。电脑端整行直接拖,不显示。
            isMobile() && !dragLocked ? 'bai-bai-preset-drag-handle-visible' : 'bai-bai-preset-drag-handle-hidden',
            isPresetVuePromptSearchOpen(model) ? 'bai-bai-preset-search-open' : '',
        ],
        list: model.items,
        group: {
            name: 'bai-bai-preset-prompts',
            pull: !dragDisabled,
            put: dragDisabled ? false : canPutPresetVuePromptIntoTopLevelList,
        },
        draggable: PRESET_VUE_TOP_LEVEL_DRAGGABLE_SELECTOR,
        filter: isPresetVuePromptDragStartFiltered,
        preventOnFilter: false,
        sort: false,
        disabled: dragDisabled,
        animation: 0,
        emptyInsertThreshold: PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX,
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
        onStart: event => beginPresetVuePromptManualDrag(model, event),
        onEnd: event => {
            const manager = getPresetVuePromptListManagerState();
            manager.lastDragEndedAt = Date.now();
            const manualDrop = finishPresetVuePromptManualDrag(model, event);
            setPresetVuePromptDragging(model, false);
            manager.draggedPromptId = null;
            manager.draggedItem = null;
            manager.currentDropTargetGroupId = null;
            manager.currentTopLevelDropIndex = null;
            const modelChanged = consumePresetVuePromptDragChange(model);
            if (manualDrop || modelChanged) {
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

function renderPresetVuePromptEntry(h, vueDraggableNext, item) {
    if (item?.type === 'header') {
        return renderPresetVuePromptListHeader(h, getPresetVuePromptListManagerState().state);
    }

    if (item?.type === 'separator') {
        return renderPresetVuePromptListSeparator(h);
    }

    if (item?.type === 'global-library') {
        return renderPresetVuePromptGlobalLibrary(h, vueDraggableNext, item);
    }

    if (item?.type === 'favorites') {
        // 收藏区是原条目的镜像,搜索过滤时会重复命中,先整块藏起来。
        return isPresetVuePromptSearchFiltering() ? null : renderPresetVuePromptFavorites(h, item);
    }

    if (item?.type === 'group') {
        return renderPresetVuePromptGroup(h, vueDraggableNext, item);
    }

    return renderPresetVuePromptRow(h, item, { topLevel: true });
}

function renderPresetVuePromptGroup(h, vueDraggableNext, item) {
    const handleSelector = getPresetVuePromptDragHandleSelector();
    const groupEnabled = isPresetVuePromptGroupEnabled(item);
    // 和主列表一样,配置里只放用户的锁定设置,临时锁定由 filter 动态拦。
    const dragDisabled = isPresetVuePromptDragLockSettingEnabled();
    const model = getPresetVuePromptListManagerState().state;
    const searchView = getPresetVuePromptSearchView(model);
    const searchGroup = searchView?.groups.get(item.groupId) ?? null;
    // 搜索过滤时有命中的组临时展开(在结果里手动收起的除外),只用于渲染,不写回折叠设置。
    const collapsed = searchGroup?.visible ? isPresetVuePromptSearchGroupCollapsed(model, item.groupId) : item.collapsed;
    const draggableProps = {
        tag: 'ul',
        class: [
            'bai-bai-preset-group-list',
            item.children?.length ? '' : 'bai-bai-preset-group-list-empty',
        ],
        list: item.children,
        group: {
            name: 'bai-bai-preset-prompts',
            pull: !dragDisabled,
            put: dragDisabled ? false : canPutPresetVuePromptIntoGroupList,
        },
        draggable: 'li.completion_prompt_manager_prompt_draggable',
        filter: isPresetVuePromptDragStartFiltered,
        preventOnFilter: false,
        sort: false,
        disabled: dragDisabled,
        animation: 0,
        emptyInsertThreshold: PRESET_VUE_EMPTY_INSERT_THRESHOLD_PX,
        dragoverBubble: true,
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
        onStart: event => beginPresetVuePromptManualDrag(getPresetVuePromptListManagerState().state, event),
        onEnd: event => {
            const manager = getPresetVuePromptListManagerState();
            const model = manager.state;
            manager.lastDragEndedAt = Date.now();
            const manualDrop = finishPresetVuePromptManualDrag(model, event);
            setPresetVuePromptDragging(model, false);
            manager.draggedPromptId = null;
            manager.draggedItem = null;
            manager.currentDropTargetGroupId = null;
            manager.currentTopLevelDropIndex = null;
            const modelChanged = consumePresetVuePromptDragChange(model);
            if (manualDrop || modelChanged) {
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
            collapsed ? 'bai-bai-preset-group-collapsed' : '',
            groupEnabled ? '' : 'bai-bai-preset-group-powered-off',
            searchView && !searchGroup?.visible ? 'bai-bai-preset-search-miss' : '',
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
                        'fa-chevron-down',
                    ],
                    title: collapsed ? t`展开分组` : t`收起分组`,
                    onClick: event => {
                        event.preventDefault();
                        event.stopPropagation();
                        togglePresetVuePromptGroupCollapsed(item.groupId);
                    },
                }),
                h('span', { class: 'bai-bai-preset-group-title-content' }, [
                    h('strong', null, searchGroup?.nameHit ? renderPresetVuePromptSearchHighlight(h, item.name, searchView) : item.name),
                    h('small', { class: 'bai-bai-preset-group-count' }, formatPresetVuePromptGroupCount(item)),
                ]),
            ]),
            h('span', { class: 'bai-bai-preset-group-actions' }, [
                h('span', {
                    class: [
                        'menu_button',
                        'fa-solid',
                        'bai-bai-preset-group-action-button',
                        'bai-bai-preset-group-enable-toggle',
                        groupEnabled ? 'fa-toggle-on' : 'fa-toggle-off',
                    ],
                    title: groupEnabled ? t`关闭分组供电` : t`开启分组供电`,
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
        renderPresetVuePromptGroupBody(h, vueDraggableNext, collapsed === item.collapsed ? item : { ...item, collapsed }, draggableProps),
    ]);
}

function isPresetVuePromptGroupEnabled(item) {
    return item?.enabled !== false && item?.group?.enabled !== false;
}

function formatPresetVuePromptGroupCount(item) {
    const children = Array.isArray(item?.children) ? item.children : [];
    const total = children.length || Number(item?.count) || 0;
    const enabled = children.filter(child => child?.enabled !== false && child?.orderEntry?.enabled !== false).length;
    return `(${enabled}/${total})`;
}

function renderPresetVuePromptRow(h, item, { topLevel = false, groupChild = false, favoriteMirror = false } = {}) {
    const prefix = promptManager?.configuration?.prefix ?? '';
    const prompt = item.prompt;
    const isEnabled = item.enabled !== false && item.orderEntry?.enabled !== false;
    const markerClass = prompt.marker ? `${prefix}prompt_manager_marker` : '';
    const importantClass = getPromptImportantClass(prompt, prefix);
    const manager = getPresetVuePromptListManagerState();
    const rangeClasses = favoriteMirror ? [] : getPresetVuePromptRangeClasses(manager.state, item);
    const searchView = favoriteMirror ? null : getPresetVuePromptSearchView(manager.state);
    const searchRow = searchView?.rows.get(prompt.identifier) ?? null;

    return h('li', {
        class: [
            `${prefix}prompt_manager_prompt`,
            favoriteMirror ? 'bai-bai-preset-favorite-prompt' : `${prefix}prompt_manager_prompt_draggable`,
            topLevel ? PRESET_VUE_TOP_LEVEL_DRAGGABLE_CLASS : '',
            groupChild ? PRESET_VUE_GROUP_CHILD_DRAGGABLE_CLASS : '',
            isEnabled ? '' : `${prefix}prompt_manager_prompt_disabled`,
            markerClass,
            importantClass,
            ...rangeClasses,
            searchView && !searchRow?.visible ? 'bai-bai-preset-search-miss' : '',
        ],
        'data-pm-identifier': prompt.identifier,
        'data-preset-group-id': item.groupId || '',
        'data-preset-favorite-mirror': favoriteMirror ? 'true' : undefined,
        key: favoriteMirror ? `favorite:${prompt.identifier}` : prompt.identifier,
        onClickCapture: favoriteMirror ? undefined : event => handlePresetVuePromptRangeSelectionClick(manager.state, item, event),
        onClick: favoriteMirror ? undefined : event => handlePresetVuePromptRangeSelectionClick(manager.state, item, event),
        onMouseenter: favoriteMirror ? undefined : () => updatePresetVuePromptRangeSelectionHover(manager.state, item),
    }, [
        favoriteMirror
            ? h('span', {
                class: 'drag-handle ui-sortable-handle bai-bai-preset-favorite-row-marker',
                title: t`收藏快捷项不可拖拽`,
            }, '\u2630')
            : h('span', { class: 'drag-handle ui-sortable-handle' }, '\u2630'),
        renderPresetVuePromptNameCell(h, prompt, prefix, {
            allowInspect: !favoriteMirror,
            searchView: searchRow?.nameHit ? searchView : null,
        }),
        h('span', null, [
            h('span', { class: 'prompt_manager_prompt_controls' }, renderPresetVuePromptControls(h, prompt, item, { favoriteMirror })),
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
        searchRow?.snippet ? renderPresetVuePromptSearchSnippet(h, searchRow.snippet) : null,
    ]);
}

function renderPresetVuePromptNameCell(h, prompt, prefix, { allowInspect = true, searchView = null } = {}) {
    const promptName = prompt.name ?? '';
    const nameContent = searchView ? renderPresetVuePromptSearchHighlight(h, promptName, searchView) : promptName;
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

    const canInspect = promptManager.isPromptInspectionAllowed?.(prompt);
    children.push(allowInspect && canInspect
        ? h('a', { title: promptName, class: 'prompt-manager-inspect-action' }, nameContent)
        : h('span', {
            title: promptName,
            class: canInspect ? 'prompt-manager-inspect-action bai-bai-preset-prompt-name-visual-only' : '',
        }, nameContent));

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

function renderPresetVuePromptControls(h, prompt, item, { favoriteMirror = false } = {}) {
    const canEdit = promptManager.isPromptEditAllowed?.(prompt) ?? (FORCE_EDIT_PROMPTS.has(prompt.identifier) || !prompt.marker);
    const canToggle = promptManager.isPromptToggleAllowed?.(prompt) ?? (
        prompt.marker && !FORCE_TOGGLE_PROMPTS.has(prompt.identifier)
            ? false
            : !(promptManager.configuration.toggleDisabled ?? []).includes(prompt.identifier)
    );
    const isEnabled = item.enabled !== false && item.orderEntry?.enabled !== false;
    const isFavorite = item.favorite !== false && (item.favorite || isCurrentPresetPromptFavorite(prompt.identifier));
    const favoriteToggle = renderPresetVuePromptActionButton(h, {
        action: 'favorite',
        icon: 'fa-star',
        text: isFavorite ? t`取消收藏` : t`收藏`,
        extraClasses: [
            'bai-bai-preset-prompt-favorite-toggle',
            isFavorite ? 'bai-bai-preset-prompt-favorite-toggle-active' : '',
        ],
        onClick: event => handlePresetPromptActionButtonClick(event),
    });
    const persistentFavoriteToggle = isFavorite
        ? renderPresetVuePromptActionButton(h, {
            action: 'favorite',
            icon: 'fa-star',
            text: t`取消收藏`,
            extraClasses: [
                'bai-bai-preset-prompt-favorite-toggle',
                'bai-bai-preset-prompt-favorite-toggle-active',
                'bai-bai-preset-prompt-favorite-toggle-persistent',
            ],
            onClick: event => handlePresetPromptActionButtonClick(event),
        })
        : null;
    const editButton = canEdit
        ? renderPresetVuePromptActionButton(h, {
            action: 'edit',
            icon: 'fa-pencil',
            text: t`编辑`,
            onClick: event => handlePresetPromptActionButtonClick(event),
        })
        : null;
    // 默认(关)时编辑按钮平铺在省略号菜单右侧,点一次即可编辑;开启时才收进收缩菜单。
    const editButtonInMenu = settings.presetGroupingEditButtonInMenuEnabled === true;

    const globalLibraryButton = renderPresetVuePromptActionButton(h, {
        action: 'global-library',
        icon: 'fa-database',
        text: t`添加到全局库`,
        onClick: event => handlePresetPromptActionButtonClick(event),
    });
    const groupRangeButton = isPresetGroupingEnabled() && !item.groupId
        ? renderPresetVuePromptActionButton(h, {
            action: 'group-range',
            icon: 'fa-folder-plus',
            text: t`以此条目创建分组`,
            onClick: event => handlePresetPromptActionButtonClick(event),
        })
        : null;

    if (favoriteMirror) {
        return [
            persistentFavoriteToggle,
            editButton,
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
        ].filter(Boolean);
    }

    return [
        persistentFavoriteToggle,
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
            favoriteToggle,
            groupRangeButton,
            globalLibraryButton,
            renderPresetVuePromptActionButton(h, {
                action: 'delete',
                icon: 'fa-trash',
                text: t`删除或移除`,
                caution: true,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
            renderPresetVuePromptActionButton(h, {
                action: 'copy',
                icon: 'fa-copy',
                text: t`复制`,
                onClick: event => handlePresetPromptActionButtonClick(event),
            }),
            editButtonInMenu ? editButton : null,
        ].filter(Boolean)),
        editButtonInMenu ? null : editButton,
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

function isPresetPromptDeleteOrDetachAllowed(prompt) {
    return Boolean(prompt && (promptManager?.isPromptDeletionAllowed?.(prompt) ?? prompt.system_prompt === false));
}

function renderPresetVuePromptActionButton(h, { action, icon, text, caution = false, extraClasses = [], onClick = null }) {
    return h('span', {
        class: [
            'menu_button',
            'bai-bai-preset-prompt-action-button',
            'fa-solid',
            icon,
            caution ? 'caution' : '',
            ...extraClasses,
        ],
        title: text,
        'data-preset-prompt-action': action,
        onClick,
    });
}

// 与 ST 原生 PromptManager 的平铺菜单逐字节一致(detach / edit / toggle),不可用时回退占位
// <span class="fa-solid"></span>。「切换预设快速刷新」只负责快速重渲染列表,菜单形态与原生无异;
// 收缩式菜单只归预设分组(走 Vue 的 renderPresetVuePromptControls)。
// 参考 public/scripts/PromptManager.js renderPromptManagerListItems 的 controls 区块。
function renderNativePromptControlsHtml({ canDelete, canEdit, canToggle, isEnabled }) {
    const detachSpanHtml = canDelete
        ? '<span title="Remove" class="prompt-manager-detach-action caution fa-solid fa-chain-broken fa-xs"></span>'
        : '<span class="fa-solid"></span>';
    const editSpanHtml = canEdit
        ? '<span title="edit" class="prompt-manager-edit-action fa-solid fa-pencil fa-xs"></span>'
        : '<span class="fa-solid"></span>';
    const toggleSpanHtml = canToggle
        ? `<span class="prompt-manager-toggle-action ${isEnabled ? 'fa-solid fa-toggle-on' : 'fa-solid fa-toggle-off'}"></span>`
        : '<span class="fa-solid"></span>';

    return `
        ${detachSpanHtml}
        ${editSpanHtml}
        ${toggleSpanHtml}
    `;
}

export {
    buildPresetVuePromptListItems,
    createPresetVuePromptListRootComponent,
    formatPresetVuePromptGroupCount,
    isPresetPromptDeleteOrDetachAllowed,
    isPresetVuePromptGroupEnabled,
    renderNativePromptControlsHtml,
    renderPresetVueIcon,
    renderPresetVuePromptActionButton,
    renderPresetVuePromptControls,
    renderPresetVuePromptDraggable,
    renderPresetVuePromptEntry,
    renderPresetVuePromptGroup,
    renderPresetVuePromptListHeader,
    renderPresetVuePromptListSeparator,
    renderPresetVuePromptNameCell,
    renderPresetVuePromptRow,
};
