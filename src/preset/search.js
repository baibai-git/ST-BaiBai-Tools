import { t } from '@sillytavern/scripts/i18n';
import { PRESET_PROMPT_MANAGER_LIST_SELECTOR } from './constants.js';
import { closePresetPromptActionMenus } from './listActions.js';
import { getPresetVuePromptListManagerState, rebuildPresetVuePromptListDraggable } from './vueList.js';
import { cancelPresetVuePromptGroupRangeSelection } from './vueModel.js';

// 预设条目搜索:标题行放大镜原地展开搜索框,按条目名/内容/组名过滤当前预设(全局库不搜)。
// 框里有关键词才真正过滤,过滤时只暂停拖拽;其余按钮照常能点,新建分组这类要看完整列表的操作会先退出搜索。
// 过滤只影响渲染,分组的临时展开/收起都不写回折叠设置,关掉搜索即恢复原样。
const PRESET_VUE_SEARCH_QUERY_DEBOUNCE_MS = 150;
const PRESET_VUE_SEARCH_SNIPPET_LEAD_CHARS = 8;
const PRESET_VUE_SEARCH_SNIPPET_LEAD_SCAN_CHARS = 40;
const PRESET_VUE_SEARCH_SNIPPET_TAIL_CHARS = 80;
const PRESET_VUE_SEARCH_HEAD_SCROLL_RATIO = 0.35;
const PRESET_VUE_SEARCH_HEAD_SCROLL_MARGIN_PX = 8;

let presetVuePromptSearchViewCache = null;

function isPresetVuePromptSearchOpen(model = getPresetVuePromptListManagerState().state) {
    return Boolean(model?.search?.open);
}

function isPresetVuePromptSearchFiltering(model = getPresetVuePromptListManagerState().state) {
    return Boolean(model?.search?.open && String(model.search.query ?? '').trim());
}

function togglePresetVuePromptSearch() {
    if (isPresetVuePromptSearchOpen()) {
        closePresetVuePromptSearch();
        return;
    }

    openPresetVuePromptSearch();
}

function openPresetVuePromptSearch() {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;

    if (!model?.search || model.search.open) {
        return;
    }

    // 正在选分组范围时点搜索,当作放弃这次选择(选范围要看完整列表,两者不同时进行)。
    if (model.rangeSelection?.active) {
        cancelPresetVuePromptGroupRangeSelection(model);
    }

    closePresetPromptActionMenus();
    clearPresetVuePromptSearchQueryTimer(manager);
    manager.dragSnapshot = null;
    manager.searchFocusPending = true;
    manager.searchScrollSnapshot = null;
    manager.searchDragHintShown = false;
    model.search.query = '';
    model.search.collapsedGroups = {};
    model.search.open = true;
}

// revealPromptId:退出后让这个条目停在屏幕上原来的位置(直接对搜索结果里的条目操作时用);
// 不传就回到打开搜索前的滚动位置。
function closePresetVuePromptSearch({ revealPromptId = null } = {}) {
    const manager = getPresetVuePromptListManagerState();
    const model = manager.state;

    if (!model?.search?.open) {
        return;
    }

    const filtering = isPresetVuePromptSearchFiltering(model);
    const scrollSnapshot = manager.searchScrollSnapshot;
    const rowAnchor = revealPromptId ? capturePresetVuePromptSearchRowAnchor(revealPromptId) : null;
    clearPresetVuePromptSearchQueryTimer(manager);
    manager.searchFocusPending = false;
    manager.searchScrollSnapshot = null;
    model.search.open = false;
    model.search.query = '';

    // 筛选过就重建一次,让列表直接以原样出现,免得临时展开的分组挨个播放收起动画。
    if (filtering) {
        rebuildPresetVuePromptListDraggable();
    }

    requestAnimationFrame(() => {
        if (rowAnchor) {
            restorePresetVuePromptSearchRowAnchor(rowAnchor);
        } else if (scrollSnapshot?.container?.isConnected) {
            scrollSnapshot.container.scrollTop = scrollSnapshot.scrollTop;
        }
    });
}

function capturePresetVuePromptSearchRowAnchor(promptId) {
    const row = findPresetVuePromptSearchRow(promptId);
    const container = findPresetVuePromptSearchScrollContainer(row);
    return container ? { promptId, container, top: row.getBoundingClientRect().top } : null;
}

function restorePresetVuePromptSearchRowAnchor(anchor) {
    const row = findPresetVuePromptSearchRow(anchor.promptId);

    if (row && anchor.container.isConnected) {
        anchor.container.scrollTop += row.getBoundingClientRect().top - anchor.top;
    }
}

function findPresetVuePromptSearchRow(promptId) {
    return document.querySelector(`${PRESET_PROMPT_MANAGER_LIST_SELECTOR} li[data-pm-identifier="${CSS.escape(promptId)}"]:not([data-preset-favorite-mirror])`);
}

function schedulePresetVuePromptSearchQuery(value) {
    const manager = getPresetVuePromptListManagerState();

    clearPresetVuePromptSearchQueryTimer(manager);
    manager.searchPendingQuery = value;
    manager.searchQueryTimer = setTimeout(() => applyPresetVuePromptSearchQuery(value), PRESET_VUE_SEARCH_QUERY_DEBOUNCE_MS);
}

function applyPresetVuePromptSearchQuery(value) {
    const manager = getPresetVuePromptListManagerState();
    const search = manager.state?.search;

    clearPresetVuePromptSearchQueryTimer(manager);

    if (search?.open) {
        const query = String(value ?? '');

        // 换了关键词就是新的一批结果,之前在结果里收起的分组重新展开。
        if (query.trim() !== String(search.query ?? '').trim()) {
            search.collapsedGroups = {};
        }

        search.query = query;
    }
}

// 搜索结果里收起分组只在这次搜索里有效,不写回折叠设置。
function isPresetVuePromptSearchGroupCollapsed(model, groupId) {
    return Boolean(model?.search?.collapsedGroups?.[groupId]);
}

function togglePresetVuePromptSearchGroupCollapsed(groupId) {
    const search = getPresetVuePromptListManagerState().state?.search;

    if (search?.collapsedGroups) {
        search.collapsedGroups[groupId] = !search.collapsedGroups[groupId];
    }
}

function clearPresetVuePromptSearchQueryTimer(manager) {
    clearTimeout(manager.searchQueryTimer);
    manager.searchQueryTimer = null;
    manager.searchPendingQuery = null;
}

// 返回当前过滤结果;没开搜索或关键词为空时返回 null(= 不过滤)。
// 先读 open/query/revision/items 让调用方的渲染副作用订阅到它们,再按这几项命中缓存。
function getPresetVuePromptSearchView(model = getPresetVuePromptListManagerState().state) {
    const search = model?.search;

    if (!search?.open) {
        return null;
    }

    const query = String(search.query ?? '').trim();
    const revision = search.revision;
    const items = model.items;

    if (!query) {
        return null;
    }

    const cache = presetVuePromptSearchViewCache;

    if (cache?.items === items && cache.query === query && cache.revision === revision) {
        return cache.view;
    }

    const view = buildPresetVuePromptSearchView(items, query);
    presetVuePromptSearchViewCache = { items, query, revision, view };
    return view;
}

function buildPresetVuePromptSearchView(items, query) {
    // 空白分隔的多个词按「中间任意空白」连起来匹配,这样跨换行的内容也能搜到。
    const pattern = query.split(/\s+/).filter(Boolean).map(escapePresetVuePromptSearchPattern).join('\\s+');
    const matcher = new RegExp(pattern, 'i');
    const view = {
        splitter: new RegExp(`(${pattern})`, 'gi'),
        rows: new Map(),
        groups: new Map(),
        count: 0,
    };

    const visitPrompt = (item, forceVisible = false) => {
        const prompt = item?.prompt;

        if (!prompt?.identifier) {
            return false;
        }

        const nameHit = matcher.test(String(prompt.name ?? ''));
        let snippet = null;

        if (!nameHit) {
            const content = String(prompt.content ?? '');
            const match = content ? matcher.exec(content) : null;
            snippet = match ? buildPresetVuePromptSearchSnippet(content, match.index, match[0].length) : null;
        }

        const hit = nameHit || Boolean(snippet);
        const visible = hit || forceVisible;
        view.rows.set(prompt.identifier, { visible, nameHit, snippet });

        if (visible) {
            view.count += 1;
        }

        return hit;
    };

    for (const item of items ?? []) {
        if (item?.type === 'prompt') {
            visitPrompt(item);
            continue;
        }

        if (item?.type !== 'group') {
            continue;
        }

        // 组名命中时整组条目都显示。
        const nameHit = matcher.test(String(item.name ?? ''));
        let childHit = false;

        for (const child of item.children ?? []) {
            childHit = visitPrompt(child, nameHit) || childHit;
        }

        view.groups.set(item.groupId, { visible: nameHit || childHit, nameHit });
    }

    return view;
}

function escapePresetVuePromptSearchPattern(text) {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 内容命中片段:关键词前留约 8 个字,换行和连续空白压成一个空格,只取第一处。
function buildPresetVuePromptSearchSnippet(content, index, length) {
    const scanStart = Math.max(0, index - PRESET_VUE_SEARCH_SNIPPET_LEAD_SCAN_CHARS);
    const leadChars = Array.from(collapsePresetVuePromptSearchWhitespace(content.slice(scanStart, index)));
    const lead = leadChars.slice(-PRESET_VUE_SEARCH_SNIPPET_LEAD_CHARS).join('').trimStart();
    const leadTruncated = scanStart > 0 || leadChars.length > PRESET_VUE_SEARCH_SNIPPET_LEAD_CHARS;
    const tailStart = index + length;
    const tailEnd = tailStart + PRESET_VUE_SEARCH_SNIPPET_TAIL_CHARS;

    return {
        before: `${leadTruncated ? '…' : ''}${lead}`,
        match: collapsePresetVuePromptSearchWhitespace(content.slice(index, tailStart)),
        after: `${collapsePresetVuePromptSearchWhitespace(content.slice(tailStart, tailEnd))}${tailEnd < content.length ? '…' : ''}`,
    };
}

function collapsePresetVuePromptSearchWhitespace(text) {
    return text.replace(/\s+/g, ' ');
}

function renderPresetVuePromptSearchHighlight(h, text, view) {
    return String(text ?? '')
        .split(view.splitter)
        .map((part, index) => (index % 2 === 1 ? h('mark', { class: 'bai-bai-preset-search-mark' }, part) : part))
        .filter(part => part !== '');
}

function renderPresetVuePromptSearchSnippet(h, snippet) {
    return h('div', { class: 'bai-bai-preset-search-snippet' }, [
        snippet.before,
        h('mark', { class: 'bai-bai-preset-search-mark' }, snippet.match),
        snippet.after,
    ].filter(part => part !== ''));
}

function renderPresetVuePromptSearchToggle(h, model) {
    const searchOpen = isPresetVuePromptSearchOpen(model);

    return h('span', {
        class: [
            'menu_button',
            'fa-solid',
            'fa-magnifying-glass',
            'bai-bai-preset-search-toggle',
            searchOpen ? 'bai-bai-preset-search-toggle-active' : '',
        ],
        title: searchOpen ? t`关闭搜索` : t`搜索条目`,
        'aria-pressed': searchOpen ? 'true' : 'false',
        onClick: event => {
            event.preventDefault();
            event.stopPropagation();
            togglePresetVuePromptSearch();
        },
    });
}

// 标题行里的搜索框(占满整行宽度);返回节点数组,由标题行展开到自己的子节点里。
function renderPresetVuePromptSearchBar(h, model) {
    const view = getPresetVuePromptSearchView(model);
    const hasQuery = String(model?.search?.query ?? '') !== '';

    return [
        h('div', { class: 'bai-bai-preset-search-bar' }, [
            h('span', { class: 'bai-bai-preset-search-field' }, [
                // 不绑 value:重绘时不碰输入框内容,免得打断输入法组合。
                h('input', {
                    class: 'text_pole bai-bai-preset-search-input',
                    type: 'text',
                    placeholder: t`搜索条目名或内容`,
                    autocomplete: 'off',
                    spellcheck: false,
                    enterkeyhint: 'search',
                    onVnodeMounted: handlePresetVuePromptSearchInputMounted,
                    onInput: handlePresetVuePromptSearchInput,
                    onCompositionend: handlePresetVuePromptSearchCompositionEnd,
                    onKeydown: handlePresetVuePromptSearchKeydown,
                }),
                hasQuery
                    ? h('span', {
                        class: 'fa-solid fa-circle-xmark bai-bai-preset-search-clear',
                        title: t`清空搜索`,
                        onPointerdown: event => event.preventDefault(),
                        onClick: handlePresetVuePromptSearchClear,
                    })
                    : null,
            ]),
            view ? h('small', { class: 'bai-bai-preset-search-count' }, t`${view.count} 条`) : null,
        ]),
        view?.count === 0 ? h('div', { class: 'bai-bai-preset-search-empty' }, t`没有匹配的条目`) : null,
    ];
}

function handlePresetVuePromptSearchInputMounted(vnode) {
    const input = vnode.el;
    const manager = getPresetVuePromptListManagerState();

    if (!(input instanceof HTMLInputElement)) {
        return;
    }

    input.value = manager.searchPendingQuery ?? String(manager.state?.search?.query ?? '');

    if (!manager.searchFocusPending) {
        return;
    }

    manager.searchFocusPending = false;
    const head = input.closest('li');
    const container = findPresetVuePromptSearchScrollContainer(head);

    if (container) {
        manager.searchScrollSnapshot = { container, scrollTop: container.scrollTop };
        // 手机弹出键盘会盖住下半屏:标题行偏下时先把它滚到顶部,给结果留出空间。
        const headTop = head.getBoundingClientRect().top;

        if (headTop > window.innerHeight * PRESET_VUE_SEARCH_HEAD_SCROLL_RATIO) {
            container.scrollTop += headTop - container.getBoundingClientRect().top - PRESET_VUE_SEARCH_HEAD_SCROLL_MARGIN_PX;
        }
    }

    input.focus({ preventScroll: true });
}

function findPresetVuePromptSearchScrollContainer(element) {
    for (let node = element?.parentElement; node && node !== document.body; node = node.parentElement) {
        const overflowY = getComputedStyle(node).overflowY;

        if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) {
            return node;
        }
    }

    return null;
}

function handlePresetVuePromptSearchInput(event) {
    // 拼音等输入法组合中不筛选,等 compositionend 再算。
    if (event.isComposing) {
        return;
    }

    schedulePresetVuePromptSearchQuery(event.target.value);
}

function handlePresetVuePromptSearchCompositionEnd(event) {
    schedulePresetVuePromptSearchQuery(event.target.value);
}

function handlePresetVuePromptSearchKeydown(event) {
    if (event.isComposing) {
        return;
    }

    if (event.key === 'Escape') {
        // 拦在输入框里,别让酒馆的全局 Esc 把整个面板关掉。
        event.preventDefault();
        event.stopPropagation();
        closePresetVuePromptSearch();
        return;
    }

    if (event.key === 'Enter') {
        event.preventDefault();
        applyPresetVuePromptSearchQuery(event.target.value);

        // 手机上回车收起键盘,把结果露出来。
        if (window.matchMedia?.('(pointer: coarse)').matches) {
            event.target.blur();
        }
    }
}

function handlePresetVuePromptSearchClear(event) {
    event.preventDefault();
    event.stopPropagation();
    const input = event.target.closest('.bai-bai-preset-search-field')?.querySelector('input');

    if (input) {
        input.value = '';
        input.focus({ preventScroll: true });
    }

    applyPresetVuePromptSearchQuery('');
}

export {
    closePresetVuePromptSearch,
    getPresetVuePromptSearchView,
    isPresetVuePromptSearchFiltering,
    isPresetVuePromptSearchGroupCollapsed,
    isPresetVuePromptSearchOpen,
    renderPresetVuePromptSearchBar,
    renderPresetVuePromptSearchHighlight,
    renderPresetVuePromptSearchSnippet,
    renderPresetVuePromptSearchToggle,
    togglePresetVuePromptSearchGroupCollapsed,
};
