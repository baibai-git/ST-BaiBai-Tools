import { event_types, eventSource } from '@sillytavern/script';
import { WORLD_INFO_ENTRY_AUTOCOMPLETE_INPUT_SELECTOR } from './constants.js';
import { LOG_PREFIX } from './state.js';

// 原版每次滚动都把所有条目的分组、自动化 ID 输入框查一遍并逐个关补全菜单,条目一多每次滚动要好几毫秒。
// 补全菜单失焦就会关,开着的只可能是焦点所在的那个输入框,只关它就够了。
// 原版处理在 initWorldInfo 里绑定,比插件加载晚,所以等 APP_READY 再换;已经 ready 时 once 会立刻执行。
function installWorldInfoScrollHandlerPatch(state) {
    if (state.scrollHandlerPatchQueued) {
        return;
    }

    state.scrollHandlerPatchQueued = true;
    eventSource.once(event_types.APP_READY, () => {
        state.scrollHandlerPatchQueued = false;

        if (state.enabled) {
            patchWorldInfoScrollHandler(state);
        }
    });
}

function patchWorldInfoScrollHandler(state) {
    if (state.worldInfoScrollReplacement) {
        return;
    }

    const worldInfo = document.getElementById('WorldInfo');
    const scrollHandlers = worldInfo ? $._data(worldInfo, 'events')?.scroll : null;
    const stockHandlerEntry = Array.isArray(scrollHandlers)
        ? scrollHandlers.find(({ handler }) => isStockWorldInfoScrollHandler(handler))
        : null;

    if (!stockHandlerEntry) {
        console.warn(`${LOG_PREFIX} Could not locate the stock world info scroll handler`);
        return;
    }

    const replacement = () => {
        closeFocusedWorldInfoAutocomplete();
    };

    $(worldInfo).off('scroll', stockHandlerEntry.handler);
    $(worldInfo).on('scroll', replacement);
    state.originalWorldInfoScrollHandler = stockHandlerEntry.handler;
    state.worldInfoScrollReplacement = replacement;
}

function closeFocusedWorldInfoAutocomplete() {
    const input = document.activeElement;

    if (!(input instanceof HTMLInputElement) || !input.matches(WORLD_INFO_ENTRY_AUTOCOMPLETE_INPUT_SELECTOR)) {
        return;
    }

    const $input = $(input);

    // 看菜单的内联 display 判断开没开,不用 :visible,免得读布局。
    if ($input.autocomplete('instance') !== undefined && $input.autocomplete('widget')?.[0]?.style.display !== 'none') {
        $input.autocomplete('close');
    }
}

function restoreWorldInfoScrollHandler(state) {
    const worldInfo = document.getElementById('WorldInfo');
    const replacement = state.worldInfoScrollReplacement;
    const originalHandler = state.originalWorldInfoScrollHandler;

    state.worldInfoScrollReplacement = null;
    state.originalWorldInfoScrollHandler = null;

    if (!worldInfo || typeof replacement !== 'function') {
        return;
    }

    $(worldInfo).off('scroll', replacement);

    const scrollHandlers = $._data(worldInfo, 'events')?.scroll;
    const hasOriginalHandler = Array.isArray(scrollHandlers)
        && scrollHandlers.some(({ handler }) => handler === originalHandler);

    if (typeof originalHandler === 'function' && !hasOriginalHandler) {
        $(worldInfo).on('scroll', originalHandler);
    }
}

function isStockWorldInfoScrollHandler(handler) {
    if (typeof handler !== 'function') {
        return false;
    }

    const source = String(handler);
    return source.includes('automationId') && source.includes('autocomplete');
}

export {
    installWorldInfoScrollHandlerPatch,
    restoreWorldInfoScrollHandler,
};
