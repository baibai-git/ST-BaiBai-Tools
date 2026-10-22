import { resetScrollHeight } from '@sillytavern/scripts/utils';
import { WORLD_INFO_DRAWER_ANIMATION_STYLE_ID, WORLD_INFO_DRAWER_HANDLER_KEY, WORLD_INFO_ENTRY_DRAWER_SELECTOR, WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR, WORLD_INFO_ENTRY_EXPANDED_CLASS } from './constants.js';
import { extensionState, settings } from './state.js';

function applyWorldInfoDrawerOptimization() {
    installWorldInfoDrawerAnimationStyle();

    if (extensionState[WORLD_INFO_DRAWER_HANDLER_KEY]) {
        return;
    }

    const handler = (event) => {
        handleWorldInfoDrawerToggleClick(event);
    };

    extensionState[WORLD_INFO_DRAWER_HANDLER_KEY] = handler;
    document.addEventListener('click', handler, true);
}

function installWorldInfoDrawerAnimationStyle() {
    if (document.getElementById(WORLD_INFO_DRAWER_ANIMATION_STYLE_ID)) {
        return;
    }

    const style = document.createElement('style');
    style.id = WORLD_INFO_DRAWER_ANIMATION_STYLE_ID;
    style.textContent = `
#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-motion > .world_entry_edit {
    transform-origin: top center;
    transition: opacity 140ms ease, transform 140ms ease;
    will-change: opacity, transform;
}

#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-enter > .world_entry_edit,
#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-leave > .world_entry_edit {
    opacity: 0;
    transform: translateY(-8px) scaleY(0.985);
}

#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-open > .world_entry_edit {
    opacity: 1;
    transform: translateY(0) scaleY(1);
}

#world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-leave {
    pointer-events: none;
}

@media (prefers-reduced-motion: reduce) {
    #world_popup_entries_list > .world_entry > .world_entry_form > .inline-drawer > .inline-drawer-content.bai-bai-wi-drawer-motion > .world_entry_edit {
        transition-duration: 1ms;
    }
}
`;
    document.head.append(style);
}

function handleWorldInfoDrawerToggleClick(event) {
    const shouldHandleDrawer = settings.worldInfoDrawerOptimizationEnabled || settings.worldInfoListOptimizationEnabled;

    if (!shouldHandleDrawer) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const toggle = target?.closest(WORLD_INFO_ENTRY_DRAWER_TOGGLE_SELECTOR);

    if (!target || !toggle || !toggle.contains(target)) {
        return;
    }

    if (target.classList.contains('text_pole')) {
        return;
    }

    const drawer = toggle.closest(WORLD_INFO_ENTRY_DRAWER_SELECTOR);
    const icon = drawer?.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
    const content = drawer?.querySelector(':scope > .inline-drawer-content');

    if (!drawer || !icon || !content) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    const expand = !isWorldInfoDrawerContentExpanded(content);

    setWorldInfoDrawerIconExpanded(icon, expand);
    // 展开的条目不参与 content-visibility,见 entryVisibility.js。
    drawer.closest('.world_entry')?.classList.toggle(WORLD_INFO_ENTRY_EXPANDED_CLASS, expand);

    if (settings.worldInfoListOptimizationEnabled) {
        animateWorldInfoDrawerContent(drawer, content, expand);
    } else {
        toggleWorldInfoDrawerContentImmediately(drawer, content, expand);
    }
}

function setWorldInfoDrawerIconExpanded(icon, expand) {
    icon.classList.toggle('down', !expand);
    icon.classList.toggle('up', expand);
    icon.classList.toggle('fa-circle-chevron-down', !expand);
    icon.classList.toggle('fa-circle-chevron-up', expand);
}

function isWorldInfoDrawerContentExpanded(content) {
    const state = content?.__baiBaiWorldInfoDrawerAnimation;

    if (state?.phase === 'opening' || state?.phase === 'expanded') {
        return true;
    }

    if (state?.phase === 'closing' || state?.phase === 'collapsed') {
        return false;
    }

    return content instanceof HTMLElement && getComputedStyle(content).display !== 'none';
}

function animateWorldInfoDrawerContent(drawer, content, expand) {
    if (!(drawer instanceof HTMLElement) || !(content instanceof HTMLElement)) {
        return;
    }

    const state = getWorldInfoDrawerAnimationState(content);
    cancelWorldInfoDrawerAnimation(state);

    content.style.height = '';
    content.style.display = 'block';
    content.classList.add('bai-bai-wi-drawer-motion');
    state.phase = expand ? 'opening' : 'closing';

    if (expand) {
        content.classList.remove('bai-bai-wi-drawer-open', 'bai-bai-wi-drawer-leave');
        content.classList.add('bai-bai-wi-drawer-enter');
        ensureWorldInfoEntryEditor(drawer, content);
    } else {
        content.classList.remove('bai-bai-wi-drawer-enter');
        content.classList.add('bai-bai-wi-drawer-open');
    }

    state.frameId = requestAnimationFrame(() => {
        state.frameId = null;

        if (state.phase !== (expand ? 'opening' : 'closing')) {
            return;
        }

        if (expand) {
            content.classList.remove('bai-bai-wi-drawer-enter');
            content.classList.add('bai-bai-wi-drawer-open');
        } else {
            content.classList.remove('bai-bai-wi-drawer-open');
            content.classList.add('bai-bai-wi-drawer-leave');
        }

        armWorldInfoDrawerAnimationEnd(content, state, expand);
    });
}

function toggleWorldInfoDrawerContentImmediately(drawer, content, expand) {
    if (!(drawer instanceof HTMLElement) || !(content instanceof HTMLElement)) {
        return;
    }

    const state = content.__baiBaiWorldInfoDrawerAnimation;
    cancelWorldInfoDrawerAnimation(state);

    content.classList.remove('bai-bai-wi-drawer-motion', 'bai-bai-wi-drawer-enter', 'bai-bai-wi-drawer-open', 'bai-bai-wi-drawer-leave');
    content.style.display = expand ? 'block' : 'none';
    content.style.height = '';

    if (state) {
        state.phase = expand ? 'expanded' : 'collapsed';
    }

    if (expand) {
        ensureWorldInfoEntryEditor(drawer, content);
    }

    resetWorldInfoDrawerTextareaHeights(content);
}

// ST/TT 收到 inline-drawer-toggle 才懒创建条目编辑器。TT ≥2.3.0 按 detail.open 判断开/关,
// 读不到时看内容是否可见,所以必须在内容显示之后派发。
function ensureWorldInfoEntryEditor(drawer, content) {
    if (content.querySelector(':scope > .world_entry_edit')) {
        return;
    }

    drawer.dispatchEvent(new CustomEvent('inline-drawer-toggle', {
        bubbles: true,
        detail: { open: true },
    }));
}

function getWorldInfoDrawerAnimationState(content) {
    if (!content.__baiBaiWorldInfoDrawerAnimation) {
        content.__baiBaiWorldInfoDrawerAnimation = {
            phase: getComputedStyle(content).display === 'none' ? 'collapsed' : 'expanded',
            frameId: null,
            fallbackTimer: null,
            transitionHandler: null,
            content: null,
        };
    }

    return content.__baiBaiWorldInfoDrawerAnimation;
}

function cancelWorldInfoDrawerAnimation(state) {
    if (!state) {
        return;
    }

    if (state.frameId !== null) {
        cancelAnimationFrame(state.frameId);
        state.frameId = null;
    }

    if (state.fallbackTimer !== null) {
        clearTimeout(state.fallbackTimer);
        state.fallbackTimer = null;
    }

    if (state.transitionHandler && state.content instanceof HTMLElement) {
        state.content.removeEventListener('transitionend', state.transitionHandler);
    }

    state.transitionHandler = null;
    state.content = null;
}

function armWorldInfoDrawerAnimationEnd(content, state, expand) {
    const expectedPhase = expand ? 'opening' : 'closing';

    const finish = () => {
        if (state.phase !== expectedPhase) {
            return;
        }

        cancelWorldInfoDrawerAnimation(state);
        finishWorldInfoDrawerAnimation(content, state, expand);
    };

    const transitionHandler = (event) => {
        if (!(event.target instanceof HTMLElement)
            || !event.target.matches('.world_entry_edit')
            || !['opacity', 'transform'].includes(event.propertyName)) {
            return;
        }

        finish();
    };

    state.content = content;
    state.transitionHandler = transitionHandler;
    state.fallbackTimer = setTimeout(finish, 220);
    content.addEventListener('transitionend', transitionHandler);
}

function finishWorldInfoDrawerAnimation(content, state, expand) {
    if (expand) {
        state.phase = 'expanded';
        content.style.display = 'block';
        content.classList.remove('bai-bai-wi-drawer-motion', 'bai-bai-wi-drawer-enter', 'bai-bai-wi-drawer-open', 'bai-bai-wi-drawer-leave');
    } else {
        state.phase = 'collapsed';
        content.style.display = 'none';
        content.classList.remove('bai-bai-wi-drawer-motion', 'bai-bai-wi-drawer-enter', 'bai-bai-wi-drawer-open', 'bai-bai-wi-drawer-leave');
    }

    content.style.height = '';

    resetWorldInfoDrawerTextareaHeights(content);
}

function resetWorldInfoDrawerTextareaHeights(content) {
    if (!CSS.supports('field-sizing', 'content')) {
        content.querySelectorAll('textarea.autoSetHeight').forEach(textarea => {
            void resetScrollHeight(textarea);
        });
    }
}

export {
    animateWorldInfoDrawerContent,
    applyWorldInfoDrawerOptimization,
    armWorldInfoDrawerAnimationEnd,
    cancelWorldInfoDrawerAnimation,
    finishWorldInfoDrawerAnimation,
    getWorldInfoDrawerAnimationState,
    handleWorldInfoDrawerToggleClick,
    installWorldInfoDrawerAnimationStyle,
    isWorldInfoDrawerContentExpanded,
    resetWorldInfoDrawerTextareaHeights,
    setWorldInfoDrawerIconExpanded,
    toggleWorldInfoDrawerContentImmediately,
};
