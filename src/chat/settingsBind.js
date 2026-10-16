import { saveSettingsDebounced } from '@sillytavern/script';
import { power_user } from '@sillytavern/scripts/power-user';
import { applyFastChatListScrollOptimization } from './chatList.js';
import { applyMessageCompletionScrollToMiddle } from './completionScroll.js';
import { initializeMessageCompletionSoundControls } from './completionSound.js';
import { LONG_CHAT_DOM_RENDER_FORCE_DISABLED, REDUCE_LOADED_FLOORS_CHAT_PATHS, REDUCE_LOADED_FLOORS_FETCH_KEY, REDUCE_LOADED_FLOORS_INPUT_IDS, REDUCE_LOADED_FLOORS_LIMIT } from './constants.js';
import { applyChatDeleteEditFlowOptimization, isChatDeleteEditFlowSupported, isWelcomeRecentChatDirectOpenCompatibilityMode } from './deleteEditFlow.js';
import { applyMessageEditBottomActions } from './editBottomActions.js';
import { applyLongChatDomRenderOptimization } from './longChatRender.js';
import { applyMobileAutoKeyboardSuppression, applyMobileMessageEditScrollGuard } from './mobileKeyboard.js';
import { settings } from './state.js';
import { isStreamingRegexDeferSupported } from './streamingRegexDefer.js';
import { applyMessageTripleClickEdit } from './tripleClickEdit.js';
import { applyWelcomeRecentChatDirectOpenOptimization } from './welcomeRecent.js';

function bindChatOptimizationSettings({ saveSettings } = {}) {
    const persistSettings = () => {
        if (typeof saveSettings === 'function') {
            saveSettings();
        }
    };

    $('#bai_bai_toolkit_fast_chat_list_enabled')
        .prop('checked', settings.fastChatListEnabled)
        .on('input', function () {
            settings.fastChatListEnabled = Boolean($(this).prop('checked'));
            persistSettings();
        });

    $('#bai_bai_toolkit_welcome_recent_chat_direct_open_enabled')
        .prop('checked', settings.welcomeRecentChatDirectOpenEnabled)
        .on('input', function () {
            settings.welcomeRecentChatDirectOpenEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyWelcomeRecentChatDirectOpenOptimization();
        });

    $('#bai_bai_toolkit_long_chat_dom_render_optimization_enabled')
        .prop('checked', settings.longChatDomRenderOptimizationEnabled && !LONG_CHAT_DOM_RENDER_FORCE_DISABLED)
        .prop('disabled', LONG_CHAT_DOM_RENDER_FORCE_DISABLED)
        .on('input', function () {
            if (LONG_CHAT_DOM_RENDER_FORCE_DISABLED) {
                settings.longChatDomRenderOptimizationEnabled = false;
                $(this).prop('checked', false);
                persistSettings();
                applyLongChatDomRenderOptimization();
                return;
            }
            settings.longChatDomRenderOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyLongChatDomRenderOptimization();
        });

    $('#bai_bai_toolkit_streaming_regex_defer_enabled')
        .prop('checked', settings.streamingRegexDeferEnabled !== false)
        .on('input', function () {
            settings.streamingRegexDeferEnabled = Boolean($(this).prop('checked'));
            persistSettings();
        });

    $('#bai_bai_toolkit_reduce_loaded_floors_enabled')
        .prop('checked', settings.reduceLoadedFloorsEnabled === true)
        .on('input', function () {
            settings.reduceLoadedFloorsEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyReduceLoadedFloors();
        });

    $('#bai_bai_toolkit_message_completion_scroll_to_middle_enabled')
        .prop('checked', settings.messageCompletionScrollToMiddleEnabled !== false)
        .on('input', function () {
            settings.messageCompletionScrollToMiddleEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyMessageCompletionScrollToMiddle();
        });

    $('#bai_bai_toolkit_chat_list_scroll_optimization_enabled')
        .prop('checked', settings.chatListScrollOptimizationEnabled)
        .on('input', function () {
            settings.chatListScrollOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyFastChatListScrollOptimization();
        });

    $('#bai_bai_toolkit_chat_list_auto_clear_enabled')
        .prop('checked', settings.chatListAutoClearEnabled)
        .on('input', function () {
            settings.chatListAutoClearEnabled = Boolean($(this).prop('checked'));
            persistSettings();
        });

    $('#bai_bai_toolkit_mobile_auto_keyboard_suppression_enabled')
        .prop('checked', settings.mobileAutoKeyboardSuppressionEnabled)
        .on('input', function () {
            settings.mobileAutoKeyboardSuppressionEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyMobileAutoKeyboardSuppression();
        });

    $('#bai_bai_toolkit_mobile_message_edit_scroll_guard_enabled')
        .prop('checked', settings.mobileMessageEditScrollGuardEnabled)
        .on('input', function () {
            settings.mobileMessageEditScrollGuardEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyMobileMessageEditScrollGuard();
        });

    $('#bai_bai_toolkit_chat_delete_edit_flow_optimization_enabled')
        .prop('checked', settings.chatDeleteEditFlowOptimizationEnabled)
        .on('input', function () {
            settings.chatDeleteEditFlowOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyChatDeleteEditFlowOptimization();
        });

    $('#bai_bai_toolkit_message_edit_bottom_actions_enabled')
        .prop('checked', settings.messageEditBottomActionsEnabled !== false)
        .on('input', function () {
            settings.messageEditBottomActionsEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyMessageEditBottomActions();
        });

    initializeMessageCompletionSoundControls(persistSettings);

    $('#bai_bai_toolkit_message_double_click_edit_enabled')
        .prop('checked', settings.messageDoubleClickEditEnabled)
        .on('input', function () {
            settings.messageDoubleClickEditEnabled = Boolean($(this).prop('checked'));
            if (settings.messageDoubleClickEditEnabled) {
                settings.messageTripleClickEditEnabled = false;
                $('#bai_bai_toolkit_message_triple_click_edit_enabled').prop('checked', false);
            }
            persistSettings();
            applyMessageTripleClickEdit();
        });

    $('#bai_bai_toolkit_message_triple_click_edit_enabled')
        .prop('checked', settings.messageTripleClickEditEnabled)
        .on('input', function () {
            settings.messageTripleClickEditEnabled = Boolean($(this).prop('checked'));
            if (settings.messageTripleClickEditEnabled) {
                settings.messageDoubleClickEditEnabled = false;
                $('#bai_bai_toolkit_message_double_click_edit_enabled').prop('checked', false);
            }
            persistSettings();
            applyMessageTripleClickEdit();
        });
}

function applyChatOptimizationCompatibilityIndicators(container) {
    if (isWelcomeRecentChatDirectOpenCompatibilityMode()) {
        markSettingCompatibility(
            container,
            '#bai_bai_toolkit_welcome_recent_chat_direct_open_enabled',
            '（兼容模式）',
            false,
            '当前酒馆版本未导出 createOrEditCharacter，已使用兼容模式。',
        );
    }

    if (!isChatDeleteEditFlowSupported()) {
        markSettingCompatibility(
            container,
            '#bai_bai_toolkit_chat_delete_edit_flow_optimization_enabled',
            '（当前酒馆版本过低，请更新）',
            true,
            '当前酒馆版本未导出 messageEdit，请更新酒馆后使用。',
        );
    }

    if (!isStreamingRegexDeferSupported()) {
        markSettingCompatibility(
            container,
            '#bai_bai_toolkit_streaming_regex_defer_enabled',
            '（需要新版柏宝库）',
            true,
            '未检测到柏宝库的正则桥接，请安装柏宝库或重启酒馆让柏宝库更新到最新版本，然后刷新页面。',
        );
    }
}

function applyReduceLoadedFloors() {
    const state = installReduceLoadedFloorsGuard();
    if (state) {
        state.isEnabled = () => settings.reduceLoadedFloorsEnabled === true;
        state.enforce = enforceReducedLoadedFloors;
    }

    if (settings.reduceLoadedFloorsEnabled === true) {
        enforceReducedLoadedFloors({ persist: true });
    }
}

function installReduceLoadedFloorsGuard() {
    const existing = globalThis[REDUCE_LOADED_FLOORS_FETCH_KEY];
    if (existing?.wrappedFetch) {
        return existing;
    }

    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        inputHandler: null,
        isEnabled: () => settings.reduceLoadedFloorsEnabled === true,
        enforce: enforceReducedLoadedFloors,
    };

    state.inputHandler = (event) => {
        const target = event.target;
        if (!(target instanceof HTMLInputElement)
            || !REDUCE_LOADED_FLOORS_INPUT_IDS.has(target.id)
            || !state.isEnabled()
            || target.value.trim() === '') {
            return;
        }

        state.enforce({
            candidateValue: target.value,
            persist: true,
        });
    };

    document.addEventListener('input', state.inputHandler);

    state.wrappedFetch = async function baiBaiToolkitReduceLoadedFloorsFetch(input, init) {
        if (state.isEnabled() && isChatLoadRequest(input, init)) {
            state.enforce({ persist: true });
        }

        return state.originalFetch(input, init);
    };

    state.wrappedFetch[REDUCE_LOADED_FLOORS_FETCH_KEY] = true;
    state.wrappedFetch.__baiBaiToolkitOriginalFetch = originalFetch;
    globalThis[REDUCE_LOADED_FLOORS_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

function enforceReducedLoadedFloors({
    candidateValue = power_user.chat_truncation,
    persist = false,
} = {}) {
    if (settings.reduceLoadedFloorsEnabled !== true) {
        return false;
    }

    const normalizedCandidate = String(candidateValue ?? '').trim();
    if (!normalizedCandidate) {
        return false;
    }

    const value = Number(normalizedCandidate);
    if (!Number.isFinite(value) || (value !== 0 && value <= REDUCE_LOADED_FLOORS_LIMIT)) {
        return false;
    }

    const changed = Number(power_user.chat_truncation) !== REDUCE_LOADED_FLOORS_LIMIT
        || value !== REDUCE_LOADED_FLOORS_LIMIT;

    power_user.chat_truncation = REDUCE_LOADED_FLOORS_LIMIT;
    syncReducedLoadedFloorsControls();

    if (changed && persist) {
        saveSettingsDebounced();
    }

    return changed;
}

function syncReducedLoadedFloorsControls() {
    for (const id of REDUCE_LOADED_FLOORS_INPUT_IDS) {
        const input = document.getElementById(id);
        if (input instanceof HTMLInputElement) {
            input.value = String(REDUCE_LOADED_FLOORS_LIMIT);
        }
    }
}

function isChatLoadRequest(input, init) {
    try {
        const isRequest = typeof Request !== 'undefined' && input instanceof Request;
        const rawUrl = isRequest ? input.url : String(input);
        const url = new URL(rawUrl, location.origin);
        const method = String(init?.method || (isRequest ? input.method : 'GET')).toUpperCase();

        return method === 'POST'
            && url.origin === location.origin
            && REDUCE_LOADED_FLOORS_CHAT_PATHS.has(url.pathname);
    } catch {
        return false;
    }
}

function markSettingCompatibility(container, inputSelector, badgeText, disabled, titleNote) {
    const input = container.find(inputSelector);
    const label = input.closest('label');
    const text = label.find('span').first();

    if (!input.length || !label.length || !text.length) {
        return;
    }

    const badgeClass = `${input.attr('id')}_compat_badge`;
    let badge = text.find(`.${badgeClass}`);

    if (!badge.length) {
        badge = $(`<small class="${badgeClass} bai_bai_toolkit_compat_badge"></small>`);
        text.append(' ', badge);
    }

    badge
        .text(badgeText)
        .css({
            opacity: 0.75,
            'font-size': '0.9em',
            'white-space': 'nowrap',
        });

    if (titleNote) {
        const currentTitle = String(label.attr('title') || '');
        if (!currentTitle.includes(titleNote)) {
            label.attr('title', currentTitle ? `${currentTitle} ${titleNote}` : titleNote);
        }
    }

    if (disabled) {
        input.prop('checked', false).prop('disabled', true);
        label.css('opacity', 0.65);
    }
}

export {
    applyChatOptimizationCompatibilityIndicators,
    applyReduceLoadedFloors,
    bindChatOptimizationSettings,
    enforceReducedLoadedFloors,
    installReduceLoadedFloorsGuard,
    isChatLoadRequest,
    markSettingCompatibility,
    syncReducedLoadedFloorsControls,
};
