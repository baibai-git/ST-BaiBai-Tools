import { WORLD_INFO_ENTRY_EXPANDED_CLASS, WORLD_INFO_ENTRY_INTRINSIC_FALLBACK_PX, WORLD_INFO_ENTRY_INTRINSIC_SIZE_VAR, WORLD_INFO_ENTRY_VISIBILITY_STYLE_ID } from './constants.js';

// 屏幕外的收起条目跳过样式、布局和绘制。没渲染过的条目按实测的收起高度占位,渲染过的由 auto 记住真实高度。
// 展开的条目不加:containment 会裁掉编辑器里溢出的内容,fixed 定位也会改成相对条目。
// 拖拽占位不加:jQuery UI 插入占位后立刻读高度,读到占位值就不会把它撑成被拖条目的高度。
function installWorldInfoEntryVisibility(state) {
    installWorldInfoEntryVisibilityStyle();

    const list = document.getElementById('world_popup_entries_list');

    if (!(list instanceof HTMLElement) || state.entryVisibilityList === list) {
        return;
    }

    removeWorldInfoEntryVisibilityObservers(state);
    state.entryVisibilityList = list;

    // 内核不认 auto 占位时样式整条不生效,不用量。
    if (typeof ResizeObserver !== 'function' || !globalThis.CSS?.supports?.('contain-intrinsic-size', 'auto 1px')) {
        return;
    }

    // 占位高度不能主动去读:读被跳过条目里的尺寸会临时排版,整个列表跟着重排,一次就几十毫秒。
    // 改成观察条目卡片,条目真正渲染后 ResizeObserver 才回报,被跳过的不回报。
    const resizeObserver = new ResizeObserver((entries, observer) => {
        measureWorldInfoEntryIntrinsicSize(list, entries, observer);
    });
    const mutationObserver = new MutationObserver((records) => {
        observeWorldInfoEntryCards(resizeObserver, records);
    });

    mutationObserver.observe(list, { childList: true });
    state.entryVisibilityResizeObserver = resizeObserver;
    state.entryVisibilityMutationObserver = mutationObserver;

    for (const entry of list.children) {
        const card = getWorldInfoEntryCard(entry);

        if (card) {
            resizeObserver.observe(card);
        }
    }
}

function installWorldInfoEntryVisibilityStyle() {
    if (document.getElementById(WORLD_INFO_ENTRY_VISIBILITY_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = WORLD_INFO_ENTRY_VISIBILITY_STYLE_ID;
    // 旧内核支持 content-visibility 却不认 auto 占位时,跳过的条目高度会塌成 0,所以整条不生效。
    style.textContent = `
@supports (contain-intrinsic-size: auto 1px) {
    #world_popup_entries_list > .world_entry:not(.${WORLD_INFO_ENTRY_EXPANDED_CLASS}):not(.ui-sortable-placeholder) {
        content-visibility: auto;
        contain-intrinsic-size: auto var(${WORLD_INFO_ENTRY_INTRINSIC_SIZE_VAR}, ${WORLD_INFO_ENTRY_INTRINSIC_FALLBACK_PX}px);
    }
}
`;
    document.head.append(style);
}

// 列表重新渲染时重新观察新条目。量到一次就停,免得滚动时条目陆续渲染又反复量。
function observeWorldInfoEntryCards(observer, records) {
    for (const record of records) {
        for (const node of record.removedNodes) {
            const card = getWorldInfoEntryCard(node);

            if (card) {
                observer.unobserve(card);
            }
        }

        for (const node of record.addedNodes) {
            const card = getWorldInfoEntryCard(node);

            if (card) {
                observer.observe(card);
            }
        }
    }
}

function getWorldInfoEntryCard(node) {
    if (!(node instanceof HTMLElement) || !node.classList.contains('world_entry')) {
        return null;
    }

    return node.querySelector(':scope > .world_entry_form');
}

// 取收起条目卡片的平均高度。量卡片而不是条目本身:条目被跳过时,自身高度就是占位值。
// 回报时刚排完版,这里读样式不会再触发排版。
function measureWorldInfoEntryIntrinsicSize(list, entries, observer) {
    let total = 0;
    let samples = 0;
    let margin = null;

    for (const { target, borderBoxSize } of entries) {
        const height = borderBoxSize[0]?.blockSize ?? 0;
        const content = target.querySelector(':scope > .inline-drawer > .inline-drawer-content');

        if (height <= 0
            || target.parentElement?.classList.contains(WORLD_INFO_ENTRY_EXPANDED_CLASS)
            || !(content instanceof HTMLElement)
            || getComputedStyle(content).display !== 'none') {
            continue;
        }

        if (margin === null) {
            const cardStyle = getComputedStyle(target);
            margin = (parseFloat(cardStyle.marginTop) || 0) + (parseFloat(cardStyle.marginBottom) || 0);
        }

        total += height + margin;
        samples++;
    }

    if (!samples) {
        return;
    }

    observer.disconnect();

    const value = `${Math.ceil(total / samples)}px`;

    if (list.style.getPropertyValue(WORLD_INFO_ENTRY_INTRINSIC_SIZE_VAR) !== value) {
        list.style.setProperty(WORLD_INFO_ENTRY_INTRINSIC_SIZE_VAR, value);
    }
}

function removeWorldInfoEntryVisibility(state) {
    document.getElementById(WORLD_INFO_ENTRY_VISIBILITY_STYLE_ID)?.remove();
    state.entryVisibilityList?.style.removeProperty(WORLD_INFO_ENTRY_INTRINSIC_SIZE_VAR);
    removeWorldInfoEntryVisibilityObservers(state);
}

function removeWorldInfoEntryVisibilityObservers(state) {
    state.entryVisibilityMutationObserver?.disconnect();
    state.entryVisibilityResizeObserver?.disconnect();
    state.entryVisibilityMutationObserver = null;
    state.entryVisibilityResizeObserver = null;
    state.entryVisibilityList = null;
}

export {
    installWorldInfoEntryVisibility,
    removeWorldInfoEntryVisibility,
};
