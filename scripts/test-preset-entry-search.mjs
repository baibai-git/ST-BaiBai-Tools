import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import vm from 'node:vm';
import { parse } from 'espree';

// Loads the real src/preset/search.js with host modules mocked; no DOM, no ST.
async function loadModule(file, context, mocks) {
    const code = await readFile(new URL(`../src/preset/${file}`, import.meta.url), 'utf8');
    const imports = parse(code, { ecmaVersion: 'latest', sourceType: 'module' }).body
        .filter(node => node.type === 'ImportDeclaration');
    const dependencies = new Map();
    const module = new vm.SourceTextModule(code, { context, identifier: file });
    await module.link(source => {
        if (!dependencies.has(source)) {
            const values = mocks[source] || {};
            const names = new Set(Object.keys(values));
            for (const entry of imports.filter(entry => entry.source.value === source)) {
                for (const specifier of entry.specifiers) {
                    if (specifier.type === 'ImportSpecifier') names.add(specifier.imported.name);
                }
            }
            dependencies.set(source, new vm.SyntheticModule([...names], function () {
                for (const name of names) this.setExport(name, values[name]);
            }, { context }));
        }
        return dependencies.get(source);
    });
    await module.evaluate();
    return module.namespace;
}

const t = (strings, ...values) => strings.reduce((text, part, index) => text + part + (index < values.length ? values[index] : ''), '');
const h = (tag, props, children) => ({ tag, props: props ?? {}, children });
const plain = value => JSON.parse(JSON.stringify(value));
const prompt = (identifier, name, content = '') => ({ id: identifier, type: 'prompt', prompt: { identifier, name, content } });
const group = (groupId, name, children) => ({ id: `group:${groupId}`, type: 'group', groupId, name, collapsed: true, children });
const fakeEvent = (fields = {}) => ({
    defaultPrevented: false,
    propagationStopped: false,
    preventDefault() { this.defaultPrevented = true; },
    stopPropagation() { this.propagationStopped = true; },
    ...fields,
});

async function harness(items = [], globals = {}) {
    const manager = {
        state: {
            items,
            rangeSelection: { active: false },
            search: { open: false, query: '', revision: 0, collapsedGroups: {} },
        },
    };
    const calls = { rebuild: 0, closeMenus: 0, cancelRange: 0, onRebuild: null };
    const timers = [];
    const context = vm.createContext({
        setTimeout: fn => timers.push(fn),
        clearTimeout: id => { if (id) timers[id - 1] = null; },
        requestAnimationFrame: fn => fn(),
        window: { matchMedia: () => ({ matches: false }), innerHeight: 800 },
        ...globals,
    });
    const search = await loadModule('search.js', context, {
        '@sillytavern/scripts/i18n': { t },
        './constants.js': { PRESET_PROMPT_MANAGER_LIST_SELECTOR: '#completion_prompt_manager_list' },
        './listActions.js': { closePresetPromptActionMenus: () => { calls.closeMenus += 1; } },
        './vueList.js': {
            getPresetVuePromptListManagerState: () => manager,
            rebuildPresetVuePromptListDraggable: () => { calls.rebuild += 1; calls.onRebuild?.(); return true; },
        },
        './vueModel.js': {
            cancelPresetVuePromptGroupRangeSelection: model => {
                calls.cancelRange += 1;
                model.rangeSelection = { active: false, name: '', startId: null, endId: null, hoverId: null };
            },
        },
    });
    const flushTimers = () => {
        for (const [index, fn] of timers.entries()) {
            if (fn) {
                timers[index] = null;
                fn();
            }
        }
    };
    const pendingTimers = () => timers.filter(Boolean).length;
    const filter = query => {
        manager.state.search.open = true;
        manager.state.search.query = query;
        return search.getPresetVuePromptSearchView(manager.state);
    };
    const searchBar = () => search.renderPresetVuePromptSearchBar(h, manager.state);
    const searchInput = () => searchBar()[0].children[0].children[0];
    return { search, manager, model: manager.state, calls, flushTimers, pendingTimers, filter, searchBar, searchInput };
}

const presetItems = () => [
    { type: 'header' },
    { type: 'separator' },
    { type: 'favorites', children: [{ ...prompt('p1', '开场白', '心理'), favoriteMirror: true }] },
    prompt('p1', '开场白', '你好世界'),
    group('g1', '文风', [
        prompt('p2', '描写', '细腻的环境描写\n\n  以及 心理活动'),
        prompt('p3', '对话', '角色说话'),
    ]),
    group('g2', '杂项', [prompt('p4', '禁词', '不要出现 心理 二字')]),
    group('g3', '心理学', [prompt('p5', 'A'), prompt('p6', 'B')]),
];

test('filters by entry name, entry content and group name; favorites mirrors are not counted', async () => {
    const { filter } = await harness(presetItems());
    const view = filter('心理');

    assert.equal(view.count, 4);
    assert.deepEqual(plain(Object.fromEntries(view.groups)), {
        g1: { visible: true, nameHit: false },
        g2: { visible: true, nameHit: false },
        g3: { visible: true, nameHit: true },
    });
    assert.deepEqual(plain(Object.fromEntries(view.rows)), {
        p1: { visible: false, nameHit: false, snippet: null },
        p2: { visible: true, nameHit: false, snippet: { before: '…环境描写 以及 ', match: '心理', after: '活动' } },
        p3: { visible: false, nameHit: false, snippet: null },
        p4: { visible: true, nameHit: false, snippet: { before: '不要出现 ', match: '心理', after: ' 二字' } },
        p5: { visible: true, nameHit: false, snippet: null },
        p6: { visible: true, nameHit: false, snippet: null },
    });
});

test('groups without hits are hidden and name hits get no snippet', async () => {
    const { filter } = await harness(presetItems());
    const view = filter('对话');

    assert.equal(view.count, 1);
    assert.deepEqual(plain(view.rows.get('p3')), { visible: true, nameHit: true, snippet: null });
    assert.equal(view.groups.get('g1').visible, true);
    assert.equal(view.groups.get('g2').visible, false);
    assert.equal(view.groups.get('g3').visible, false);
});

test('space separated words match across newlines and the snippet collapses whitespace', async () => {
    const { filter } = await harness(presetItems());
    const view = filter('描写   以及');

    assert.deepEqual(plain(view.rows.get('p2')), {
        visible: true,
        nameHit: false,
        snippet: { before: '细腻的环境', match: '描写 以及', after: ' 心理活动' },
    });
});

test('long content gets ellipses on both sides and keeps 8 characters before the hit', async () => {
    const content = `${'x'.repeat(100)}KEY${'y'.repeat(200)}`;
    const { filter } = await harness([prompt('p1', 'name', content)]);
    const view = filter('key');

    assert.deepEqual(plain(view.rows.get('p1').snippet), {
        before: `…${'x'.repeat(8)}`,
        match: 'KEY',
        after: `${'y'.repeat(80)}…`,
    });
});

test('regex characters in the query are matched literally', async () => {
    const { filter } = await harness([prompt('p1', 'axb'), prompt('p2', 'a.b'), prompt('p3', 'f(x)')]);

    assert.equal(filter('a.b').count, 1);
    assert.equal(filter('a.b').rows.get('p2').visible, true);
    assert.equal(filter('(x').rows.get('p3').visible, true);
    assert.equal(filter('[').count, 0);
});

test('highlight wraps every case-insensitive hit and keeps the original text', async () => {
    const { search, filter } = await harness([prompt('p1', 'Foo bar foo')]);
    const parts = search.renderPresetVuePromptSearchHighlight(h, 'Foo bar foo', filter('foo'));

    assert.deepEqual(plain(parts), [
        { tag: 'mark', props: { class: 'bai-bai-preset-search-mark' }, children: 'Foo' },
        ' bar ',
        { tag: 'mark', props: { class: 'bai-bai-preset-search-mark' }, children: 'foo' },
    ]);
});

test('no filtering while closed or with a blank query', async () => {
    const { search, model, filter } = await harness(presetItems());

    model.search.query = '心理';
    assert.equal(search.getPresetVuePromptSearchView(model), null);
    assert.equal(search.isPresetVuePromptSearchFiltering(model), false);
    assert.equal(filter('   '), null);
    assert.equal(search.isPresetVuePromptSearchOpen(model), true);
    assert.equal(search.isPresetVuePromptSearchFiltering(model), false);
});

test('view is cached until the query, items or revision change', async () => {
    const items = presetItems();
    const { search, model, filter } = await harness(items);
    const first = filter('世界');

    assert.equal(search.getPresetVuePromptSearchView(model), first);
    assert.equal(first.count, 1);

    items[3].prompt.content = '换掉了';
    assert.equal(search.getPresetVuePromptSearchView(model), first);
    model.search.revision += 1;
    assert.equal(search.getPresetVuePromptSearchView(model).count, 0);
});

test('toggle opens and closes search; only closing after filtering rebuilds the list', async () => {
    const { search, manager, model, calls } = await harness(presetItems());
    const toggle = () => search.renderPresetVuePromptSearchToggle(h, model);
    const click = fakeEvent();

    manager.searchDragHintShown = true;
    toggle().props.onClick(click);
    assert.equal(click.defaultPrevented && click.propagationStopped, true);
    assert.equal(model.search.open, true);
    assert.equal(manager.searchFocusPending, true);
    assert.equal(manager.searchDragHintShown, false);
    assert.equal(calls.rebuild, 0);
    assert.equal(calls.closeMenus, 1);
    assert.match(toggle().props.class.join(' '), /bai-bai-preset-search-toggle-active/);

    // Open with an empty query: the list never changed, so closing skips the rebuild.
    toggle().props.onClick(fakeEvent());
    assert.equal(model.search.open, false);
    assert.equal(calls.rebuild, 0);

    toggle().props.onClick(fakeEvent());
    model.search.query = '心理';
    toggle().props.onClick(fakeEvent());
    assert.equal(model.search.open, false);
    assert.equal(model.search.query, '');
    assert.equal(manager.searchFocusPending, false);
    assert.equal(calls.rebuild, 1);
});

test('opening search cancels an active group range selection', async () => {
    const { search, model, calls } = await harness(presetItems());

    model.rangeSelection = { active: true, name: '', startId: 'p1', endId: null, hoverId: 'p1' };
    const toggle = search.renderPresetVuePromptSearchToggle(h, model);
    assert.doesNotMatch(toggle.props.class.join(' '), /suspended/);
    toggle.props.onClick(fakeEvent());
    assert.equal(calls.cancelRange, 1);
    assert.equal(model.rangeSelection.active, false);
    assert.equal(model.search.open, true);

    // Not selecting: leave rangeSelection alone so every row doesn't re-render.
    search.renderPresetVuePromptSearchToggle(h, model).props.onClick(fakeEvent());
    search.renderPresetVuePromptSearchToggle(h, model).props.onClick(fakeEvent());
    assert.equal(calls.cancelRange, 1);
});

test('closing with revealPromptId keeps that row where it was on screen', async () => {
    const container = { scrollTop: 100, scrollHeight: 3000, clientHeight: 600, isConnected: true, parentElement: null };
    const row = { top: 300, parentElement: container, getBoundingClientRect() { return { top: this.top }; } };
    const selectors = [];
    const { search, model, calls } = await harness(presetItems(), {
        document: { body: {}, querySelector: selector => { selectors.push(selector); return row; } },
        getComputedStyle: node => ({ overflowY: node === container ? 'auto' : 'visible' }),
        CSS: { escape: value => value },
    });

    model.search.open = true;
    model.search.query = '心理';
    // The full list comes back and pushes the row down to 700.
    calls.onRebuild = () => { row.top = 700; };
    search.closePresetVuePromptSearch({ revealPromptId: 'p1' });
    assert.equal(calls.rebuild, 1);
    assert.equal(container.scrollTop, 500);
    assert.match(selectors[0], /^#completion_prompt_manager_list li\[data-pm-identifier="p1"\]:not\(\[data-preset-favorite-mirror\]\)$/);
});

test('collapsing a group in the results is temporary and resets on a new query or reopen', async () => {
    const { search, model, filter, searchInput } = await harness(presetItems());
    const collapsed = groupId => search.isPresetVuePromptSearchGroupCollapsed(model, groupId);

    filter('心理');
    search.togglePresetVuePromptSearchGroupCollapsed('g1');
    assert.equal(collapsed('g1'), true);
    assert.equal(collapsed('g2'), false);
    assert.equal(model.items[4].collapsed, true);
    search.togglePresetVuePromptSearchGroupCollapsed('g1');
    assert.equal(collapsed('g1'), false);

    // Extra spaces give the same results, so the group stays collapsed; new words reset it.
    search.togglePresetVuePromptSearchGroupCollapsed('g1');
    searchInput().props.onKeydown(fakeEvent({ key: 'Enter', target: { value: ' 心理 ' } }));
    assert.equal(collapsed('g1'), true);
    searchInput().props.onKeydown(fakeEvent({ key: 'Enter', target: { value: '心理活动' } }));
    assert.equal(collapsed('g1'), false);

    search.togglePresetVuePromptSearchGroupCollapsed('g2');
    search.closePresetVuePromptSearch();
    search.renderPresetVuePromptSearchToggle(h, model).props.onClick(fakeEvent());
    assert.equal(model.search.open, true);
    assert.equal(collapsed('g2'), false);
});

test('typing is debounced and skipped during IME composition', async () => {
    const { model, searchInput, flushTimers, pendingTimers } = await harness(presetItems());
    model.search.open = true;
    const input = searchInput();

    input.props.onInput(fakeEvent({ isComposing: true, target: { value: 'xin' } }));
    assert.equal(pendingTimers(), 0);

    input.props.onCompositionend(fakeEvent({ target: { value: '心' } }));
    input.props.onInput(fakeEvent({ isComposing: false, target: { value: '心理' } }));
    assert.equal(pendingTimers(), 1);
    assert.equal(model.search.query, '');

    flushTimers();
    assert.equal(model.search.query, '心理');
});

test('Enter applies the query immediately and Escape closes search without bubbling', async () => {
    const { model, searchInput, pendingTimers } = await harness(presetItems());
    model.search.open = true;
    const input = searchInput();

    input.props.onInput(fakeEvent({ target: { value: '对' } }));
    input.props.onKeydown(fakeEvent({ key: 'Enter', target: { value: '对话' } }));
    assert.equal(model.search.query, '对话');
    assert.equal(pendingTimers(), 0);

    const escape = fakeEvent({ key: 'Escape', target: { value: '对话' } });
    input.props.onKeydown(escape);
    assert.equal(escape.propagationStopped, true);
    assert.equal(model.search.open, false);
    assert.equal(model.search.query, '');
});

test('search bar shows the result count, the clear button and the empty state', async () => {
    const { model, searchBar } = await harness(presetItems());
    model.search.open = true;

    let [bar, empty] = searchBar();
    assert.equal(bar.children[1], null);
    assert.equal(bar.children[0].children[1], null);
    assert.equal(empty, null);

    model.search.query = '心理';
    [bar, empty] = searchBar();
    assert.equal(bar.children[1].children, '4 条');
    assert.equal(empty, null);

    model.search.query = '不存在的词';
    [bar, empty] = searchBar();
    assert.equal(bar.children[1].children, '0 条');
    assert.equal(empty.children, '没有匹配的条目');

    const field = { querySelector: () => fieldInput };
    const fieldInput = { value: '不存在的词', focused: false, focus() { this.focused = true; } };
    bar.children[0].children[1].props.onClick(fakeEvent({ target: { closest: () => field } }));
    assert.equal(fieldInput.value, '');
    assert.equal(fieldInput.focused, true);
    assert.equal(model.search.query, '');
    assert.equal(model.search.open, true);
});
