import {
    characters,
    event_types,
    eventSource,
    getCurrentChatId,
    getRequestHeaders,
    openCharacterChat,
    saveSettingsDebounced,
    selectCharacterById,
    setActiveCharacter,
    this_chid,
} from '../../../../script.js';
import * as scriptModule from '../../../../script.js';
import { t } from '../../../i18n.js';
import { isMobile } from '../../../RossAscends-mods.js';
import { timestampToMoment } from '../../../utils.js';

const FAST_CHAT_SEARCH_FETCH_KEY = '__baiBaiToolkitFastChatSearchFetchPatched';
const FAST_CHAT_LIST_SCROLL_STYLE_ID = 'bai_bai_toolkit_fast_chat_list_scroll_style';
const LONG_CHAT_DOM_RENDER_STYLE_ID = 'bai_bai_toolkit_long_chat_dom_render_style';
const CHAT_DELETE_EDIT_HANDLER_KEY = '__baiBaiToolkitChatDeleteEditHandler';
const CHAT_DELETE_MESSAGE_DELETED_HANDLER_KEY = '__baiBaiToolkitChatDeleteMessageDeletedHandler';
const CHAT_DELETE_GENERATION_ACTION_HANDLER_KEY = '__baiBaiToolkitChatDeleteGenerationActionHandler';
const WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY = '__baiBaiToolkitWelcomeRecentChatDirectOpenHandler';
const WELCOME_RECENT_CHAT_DIRECT_OPEN_CURRENT_HANDLER_KEY = '__baiBaiToolkitWelcomeRecentChatDirectOpenCurrentHandler';
const MOBILE_AUTO_KEYBOARD_HANDLER_KEY = '__baiBaiToolkitMobileAutoKeyboardHandler';
const MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardFocusPatched';
const MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardJQueryFocusPatched';
const MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY = '__baiBaiToolkitMobileAutoKeyboardJQueryTriggerPatched';
const MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY = '__baiBaiToolkitMessageEditScrollTopPatched';
const LONG_CHAT_DOM_RENDER_TEXT_THRESHOLD = 60000;
const LONG_CHAT_DOM_RENDER_SINGLE_MESSAGE_THRESHOLD = 12000;
const LONG_CHAT_DOM_RENDER_MIN_TEXT_THRESHOLD = 24000;
const LONG_CHAT_DOM_RENDER_MESSAGE_COUNT_THRESHOLD = 20;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS = 900;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES = 6;
const LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE = 8;
const LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES = 4;
const LONG_CHAT_DOM_RENDER_GENERATION_ANCHOR_RELEASE_MS = 1200;
const LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_RATIO = 0.18;
const LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MIN = 24;
const LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MAX = 160;
const LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS = 'bai-bai-toolkit-long-chat-bottom-anchor';
const LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS = 'bai-bai-toolkit-long-chat-bottom-anchored';
const LONG_CHAT_DOM_RENDER_HEIGHT_VAR = '--bai-bai-toolkit-long-chat-mes-height';
const CHAT_DELETE_EDIT_WINDOW_MS = 5000;
const MOBILE_AUTO_KEYBOARD_DIRECT_FOCUS_WINDOW_MS = 1500;
const MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE = 2;
const MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_DELAYS = [0, 50, 160];
const CHAT_GENERATION_ACTION_SELECTOR = '#send_but, #option_regenerate, #option_continue, #option_impersonate, #mes_continue, #mes_impersonate';
const CHAT_MESSAGE_EDIT_SELECTOR = '#chat .mes_edit';
const WELCOME_PANEL_SELECTOR = '#chat .welcomePanel';
const WELCOME_RECENT_CHAT_SELECTOR = '#chat .welcomePanel .recentChat';
const WELCOME_RECENT_CHAT_ACTION_SELECTOR = '.renameChat, .deleteChat, .pinChat, button, a, input, select, textarea';
const MOBILE_MESSAGE_EDIT_SELECTOR = '#curEditTextarea, .reasoning_edit_textarea';
const MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR = '#curEditTextarea, #select_chat_search';
const MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR = '#send_textarea';
const MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR = `${MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR}, ${MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR}`;
const CHAT_MANAGEMENT_POPUP_SELECTOR = '#shadow_select_chat_popup';
const CHAT_MANAGEMENT_LIST_SELECTOR = '#select_chat_div';
const MESSAGE_COMPLETION_SOUND_SOURCES = new Set(['builtin', 'url', 'local']);
const MESSAGE_COMPLETION_SOUND_DB_NAME = 'baiBaiToolkit';
const MESSAGE_COMPLETION_SOUND_DB_VERSION = 1;
const MESSAGE_COMPLETION_SOUND_STORE = 'messageCompletionSounds';
const MESSAGE_COMPLETION_SOUND_LOCAL_KEY = 'local';
const MESSAGE_COMPLETION_SOUND_MAX_LOCAL_BYTES = 5 * 1024 * 1024;
const MESSAGE_COMPLETION_SOUND_COOLDOWN_MS = 1000;
const BUILTIN_COMPLETION_SOUNDS = [
    { id: 'guoke-bell', label: '果壳铃', file: '果壳铃.mp3' },
    { id: 'stardew-fish', label: '星露谷 - 钓鱼上钩', file: '星露谷-钓鱼上钩.mp3' },
    { id: 'stardew-achievement', label: '星露谷 - 成就', file: '星露谷-成就.mp3' },
    { id: 'pokemon-heal', label: '宝可梦 - 治疗', file: '宝可梦-治疗.mp3' },
    { id: 'pokemon-berry', label: '宝可梦 - 摘果子', file: '宝可梦-摘果子.mp3' },
    { id: 'zelda-get', label: '塞尔达 - 获取', file: '塞尔达-获取.mp3' },
    { id: 'zelda-complete', label: '塞尔达 - 完成', file: '塞尔达-完成.mp3' },
    { id: 'bubble', label: 'Q弹气泡', file: 'Q弹气泡.mp3' },
    { id: 'line-yangqin', label: 'LINE - 扬琴', file: 'LINE-扬琴.mp3' },
];

let settings = {};
let extensionState = {};
let LOG_PREFIX = '[BaiBaiToolkit]';
let fastChatListRequestId = 0;
let recordLongDomRefresh = null;

const createOrEditCharacter = scriptModule.createOrEditCharacter;
const messageEdit = scriptModule.messageEdit;
const unshallowCharacter = scriptModule.unshallowCharacter;

export function configureChatOptimizations(context = {}) {
    settings = context.settings ?? settings;
    extensionState = context.extensionState ?? extensionState;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    recordLongDomRefresh = context.recordLongDomRefresh ?? recordLongDomRefresh;
}

export function bindChatOptimizationSettings({ saveSettings } = {}) {
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
        .prop('checked', settings.longChatDomRenderOptimizationEnabled)
        .on('input', function () {
            settings.longChatDomRenderOptimizationEnabled = Boolean($(this).prop('checked'));
            persistSettings();
            applyLongChatDomRenderOptimization();
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

export function applyChatOptimizationCompatibilityIndicators(container) {
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

function waitForNextPaint() {
    return new Promise(resolve => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(fallback);
            resolve();
        };
        const fallback = setTimeout(finish, 80);

        if (typeof requestAnimationFrame !== 'function') {
            finish();
            return;
        }

        requestAnimationFrame(() => setTimeout(finish, 0));
    });
}

function calculateVisibleMessageTextStats(chat, visibleMessages = [...document.querySelectorAll('#chat .mes')]) {
    let visibleTextChars = 0;
    let maxVisibleChars = 0;
    let maxVisibleMesId = 'none';

    for (const element of visibleMessages) {
        const mesId = element.getAttribute('mesid') ?? '';
        const index = Number(mesId);
        const message = Number.isInteger(index) ? chat[index] : null;
        const chars = getLongChatMessageTextLength(message);

        visibleTextChars += chars;
        if (chars > maxVisibleChars) {
            maxVisibleChars = chars;
            maxVisibleMesId = mesId || 'none';
        }
    }

    return { visibleTextChars, maxVisibleChars, maxVisibleMesId };
}

function getLongChatDomRenderSnapshot() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return 'longDom=off';
    }

    const chat = document.querySelector('#chat');
    if (!(chat instanceof HTMLElement)) {
        return 'longDom=pending';
    }

    const optimized = chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized');
    const contained = chat.querySelectorAll('.mes.bai-bai-toolkit-long-chat-contained').length;
    return `longDom=${optimized ? 'on' : 'idle'}:${contained}`;
}

function applyLongChatDomRenderOptimization() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        removeLongChatDomRenderOptimization();
        return;
    }

    installLongChatDomRenderOptimization();
    scheduleLongChatDomRenderRefresh({ autoScroll: true, reason: 'apply' });
}

function getLongChatDomRenderState() {
    if (!extensionState.longChatDomRenderOptimization || typeof extensionState.longChatDomRenderOptimization !== 'object') {
        extensionState.longChatDomRenderOptimization = {};
    }

    const state = extensionState.longChatDomRenderOptimization;
    if (!(state.heightCache instanceof Map)) {
        state.heightCache = new Map();
    }
    if (!Array.isArray(state.eventHandlers)) {
        state.eventHandlers = [];
    }

    return state;
}

function installLongChatDomRenderOptimization() {
    const state = getLongChatDomRenderState();

    applyLongChatDomRenderOptimizationStyle();
    ensureLongChatDomRenderObservers();

    if (!state.installed) {
        const chatLoadHandler = () => {
            state.userScrolledAway = false;
            scheduleLongChatDomRenderRefresh({ autoScroll: true, reason: 'chat-load' });
        };
        const chatMutationHandler = () => {
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'chat-update' });
            scheduleLongChatDomRenderGenerationAnchor('chat-update');
        };
        const messageDeletedHandler = () => {
            pruneLongChatDomRenderCurrentChatHeightCache();
            chatMutationHandler();
        };
        const generationStartedHandler = () => {
            state.generationActive = true;
            state.generationAnchorEnabled = shouldStartLongChatDomRenderGenerationAnchor();
            if (state.generationAnchorEnabled) {
                state.userScrolledAway = false;
                scheduleLongChatDomRenderGenerationAnchor('generation-started');
            }
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'generation-started' });
        };
        const generationEndedHandler = () => {
            const shouldScrollToLatestMessageStart = shouldScrollLongChatDomRenderToLatestMessageStartAfterGeneration(state);
            state.generationActive = false;
            releaseLongChatDomRenderGenerationAnchor();
            if (shouldScrollToLatestMessageStart) {
                scheduleLongChatDomRenderScrollToLatestMessageStart('generation-ended');
            }
        };

        addLongChatDomRenderEventHandler(event_types.CHAT_CHANGED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.CHAT_LOADED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.MORE_MESSAGES_LOADED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.USER_MESSAGE_RENDERED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.CHARACTER_MESSAGE_RENDERED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.MESSAGE_UPDATED, chatMutationHandler);
        addLongChatDomRenderEventHandler(event_types.MESSAGE_DELETED, messageDeletedHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_STARTED, generationStartedHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_STOPPED, generationEndedHandler);
        addLongChatDomRenderEventHandler(event_types.GENERATION_ENDED, generationEndedHandler);

        state.installed = true;
    }
}

function addLongChatDomRenderEventHandler(event, handler) {
    if (!event || typeof eventSource?.on !== 'function') {
        return;
    }

    const state = getLongChatDomRenderState();
    eventSource.on(event, handler);
    state.eventHandlers.push({ event, handler });
}

function removeLongChatDomRenderOptimization() {
    const state = getLongChatDomRenderState();

    clearTimeout(state.refreshTimer);
    state.refreshTimer = null;
    clearLongChatDomRenderAutoScrollTimers();

    for (const entry of state.eventHandlers || []) {
        eventSource.removeListener?.(entry.event, entry.handler);
    }
    state.eventHandlers = [];
    state.installed = false;
    state.userScrolledAway = false;
    state.generationActive = false;
    state.generationAnchorEnabled = false;
    clearTimeout(state.generationAnchorTimer);
    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorTimer = null;
    state.generationAnchorReleaseTimer = null;

    detachLongChatDomRenderChatObservers();
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.mutationObserver?.disconnect();
    state.mutationObserver = null;

    document.getElementById(LONG_CHAT_DOM_RENDER_STYLE_ID)?.remove();
    cleanupLongChatDomRenderMessages();
}

function applyLongChatDomRenderOptimizationStyle() {
    let style = document.getElementById(LONG_CHAT_DOM_RENDER_STYLE_ID);
    if (!style) {
        style = document.createElement('style');
        style.id = LONG_CHAT_DOM_RENDER_STYLE_ID;
        document.head.append(style);
    }

    style.textContent = `
#chat.bai-bai-toolkit-long-chat-render-optimized > .mes.bai-bai-toolkit-long-chat-contained {
    content-visibility: auto;
    contain: layout paint style;
    contain-intrinsic-size: auto var(${LONG_CHAT_DOM_RENDER_HEIGHT_VAR}, 640px);
    contain-intrinsic-block-size: auto var(${LONG_CHAT_DOM_RENDER_HEIGHT_VAR}, 640px);
}

#chat.${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS} > :not(.${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS}) {
    overflow-anchor: none;
}

#chat > .${LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS} {
    display: block;
    width: 1px;
    height: 1px;
    flex: 0 0 auto;
    overflow-anchor: auto;
    pointer-events: none;
}
`;
}

function ensureLongChatDomRenderObservers() {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)) {
        return;
    }

    if (state.chatElement !== chat) {
        detachLongChatDomRenderChatObservers();
        state.mutationObserver?.disconnect();
        state.mutationObserver = null;
        state.chatElement = chat;
        state.scrollHandler = () => {
            handleLongChatDomRenderScroll(chat);
        };
        chat.addEventListener('scroll', state.scrollHandler, { passive: true });
    }

    if (!state.resizeObserver && typeof ResizeObserver === 'function') {
        state.resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                updateLongChatDomRenderHeightCache(entry.target, entry.contentRect?.height);
            }
        });
    }

    if (!state.mutationObserver && typeof MutationObserver === 'function') {
        state.mutationObserver = new MutationObserver((mutations) => {
            if (mutations.some(isLongChatDomRenderRelevantChildMutation)) {
                if (!chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized')) {
                    return;
                }
                scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'mutation' });
            }
        });
        state.mutationObserver.observe(chat, { childList: true });
    }
}

function isLongChatDomRenderRelevantChildMutation(mutation) {
    const nodes = [...mutation.addedNodes, ...mutation.removedNodes];
    return nodes.some(node => !(node instanceof HTMLElement && node.classList.contains(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS)));
}

function detachLongChatDomRenderChatObservers() {
    const state = getLongChatDomRenderState();
    if (state.chatElement && state.scrollHandler) {
        state.chatElement.removeEventListener('scroll', state.scrollHandler);
    }
    state.chatElement = null;
    state.scrollHandler = null;
}

function scheduleLongChatDomRenderRefresh({ autoScroll = false, reason = '' } = {}) {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const state = getLongChatDomRenderState();
    state.pendingAutoScroll = Boolean(state.pendingAutoScroll || autoScroll);
    state.pendingReason = reason || state.pendingReason || '';

    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
        state.refreshTimer = null;
        const pendingReason = state.pendingReason || 'refresh';
        refreshLongChatDomRenderOptimization({ reason: pendingReason });

        if (state.pendingAutoScroll) {
            state.pendingAutoScroll = false;
            scheduleLongChatDomRenderScrollToBottom(pendingReason);
        }
        state.pendingReason = '';
    }, 40);
}

function refreshLongChatDomRenderOptimization({ reason = '' } = {}) {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const chatElement = document.querySelector('#chat');
    if (!(chatElement instanceof HTMLElement)) {
        return;
    }

    if (isWelcomePageDisplayed(chatElement)) {
        cleanupLongChatDomRenderMessages();
        return;
    }

    const startedAt = performance.now();
    const refreshStats = {
        reason,
        duration: 0,
        messages: 0,
        optimized: false,
        contained: 0,
        editing: 0,
        tail: 0,
        cached: 0,
        estimated: 0,
        measured: 0,
    };

    ensureLongChatDomRenderObservers();

    const messages = [...chatElement.querySelectorAll('.mes')].filter(element => element instanceof HTMLElement);
    const chat = Array.isArray(scriptModule.chat) ? scriptModule.chat : [];
    const stats = calculateVisibleMessageTextStats(chat, messages);
    const shouldOptimize = shouldOptimizeLongChatDomRender(stats, messages.length);

    refreshStats.messages = messages.length;
    refreshStats.optimized = shouldOptimize;
    chatElement.classList.toggle('bai-bai-toolkit-long-chat-render-optimized', shouldOptimize);

    const state = getLongChatDomRenderState();
    const editingMessages = getLongChatDomRenderEditingMessages(chatElement);
    const uncontainedTailMessages = getLongChatDomRenderUncontainedTailMessages(messages, chat.length);
    const chatWidth = chatElement.clientWidth || window.innerWidth;
    for (const element of messages) {
        if (shouldOptimize && !uncontainedTailMessages.has(element)) {
            applyLongChatDomRenderToMessage(element, chat, refreshStats, { editingMessages, chatWidth });
            state.resizeObserver?.observe(element);
        } else {
            if (shouldOptimize && uncontainedTailMessages.has(element)) {
                refreshStats.tail += 1;
            }
            cleanupLongChatDomRenderMessage(element);
            state.resizeObserver?.unobserve(element);
        }
    }

    if (shouldOptimize && isLongChatDomRenderGenerationActive()) {
        scheduleLongChatDomRenderGenerationAnchor(reason || 'refresh');
    } else if (!shouldOptimize && state.generationAnchorEnabled) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
    }

    refreshStats.duration = performance.now() - startedAt;
    recordLongDomRefresh?.(refreshStats);
}

function shouldOptimizeLongChatDomRender(stats, messageCount) {
    return stats.visibleTextChars >= LONG_CHAT_DOM_RENDER_TEXT_THRESHOLD
        || stats.maxVisibleChars >= LONG_CHAT_DOM_RENDER_SINGLE_MESSAGE_THRESHOLD
        || (messageCount >= LONG_CHAT_DOM_RENDER_MESSAGE_COUNT_THRESHOLD && stats.visibleTextChars >= LONG_CHAT_DOM_RENDER_MIN_TEXT_THRESHOLD);
}

function applyLongChatDomRenderToMessage(element, chat, refreshStats = null, options = {}) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    if (options.editingMessages?.has(element)) {
        cleanupLongChatDomRenderMessage(element);
        if (refreshStats) {
            refreshStats.editing += 1;
        }
        return;
    }

    const mesId = element.getAttribute('mesid') || '';
    const index = Number(mesId);
    const message = Number.isInteger(index) ? chat[index] : null;
    const chars = getLongChatMessageTextLength(message);
    const measuredHeight = element.classList.contains('bai-bai-toolkit-long-chat-contained')
        ? 0
        : measureLongChatDomRenderMessageHeight(element);
    const cachedHeight = getLongChatDomRenderCachedHeight(mesId);
    const estimatedHeight = estimateLongChatDomRenderMessageHeight(chars, options.chatWidth);
    const height = measuredHeight || cachedHeight || estimatedHeight;

    if (refreshStats) {
        if (measuredHeight) {
            refreshStats.measured += 1;
        } else if (cachedHeight) {
            refreshStats.cached += 1;
        } else {
            refreshStats.estimated += 1;
        }
    }

    if (height > 0) {
        setLongChatDomRenderCachedHeight(mesId, height);
        element.style.setProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR, `${Math.round(height)}px`);
    }

    element.classList.add('bai-bai-toolkit-long-chat-contained');
    if (refreshStats) {
        refreshStats.contained += 1;
    }
}

function getLongChatDomRenderUncontainedTailMessages(messages, chatLength = 0) {
    const tailMessages = new Set();
    const tailCount = LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES;
    const numericChatLength = Number(chatLength || 0);
    const tailStartIndex = Math.max(0, numericChatLength - tailCount);

    for (const element of messages) {
        const mesIdValue = element.getAttribute('mesid');
        const mesId = Number(mesIdValue);
        if (mesIdValue && Number.isInteger(mesId) && mesId >= tailStartIndex) {
            tailMessages.add(element);
        }
    }

    for (const element of messages.slice(-tailCount)) {
        tailMessages.add(element);
    }

    return tailMessages;
}

function getLongChatDomRenderEditingMessages(chatElement) {
    const messages = new Set();

    if (!(chatElement instanceof HTMLElement)) {
        return messages;
    }

    for (const editor of chatElement.querySelectorAll(MOBILE_MESSAGE_EDIT_SELECTOR)) {
        const message = editor.closest('.mes');
        if (message instanceof HTMLElement) {
            messages.add(message);
        }
    }

    return messages;
}

function estimateLongChatDomRenderMessageHeight(chars, width = window.innerWidth) {
    const charsPerLine = Math.max(22, Math.min(80, Math.floor((width || 720) / 16)));
    const lines = Math.max(1, Math.ceil(Number(chars || 0) / charsPerLine));
    const estimated = 230 + (lines * 28);

    return Math.max(120, Math.min(12000, estimated));
}

function measureLongChatDomRenderMessageHeight(element) {
    if (!(element instanceof HTMLElement)) {
        return 0;
    }

    const rectHeight = Number(element.getBoundingClientRect?.().height || 0);
    const height = Math.max(rectHeight, Number(element.offsetHeight || 0));

    return height >= 24 ? Math.round(height) : 0;
}

function updateLongChatDomRenderHeightCache(target, observedHeight) {
    if (!(target instanceof HTMLElement) || !target.classList.contains('mes')) {
        return;
    }

    const mesId = target.getAttribute('mesid') || '';
    const height = Number(observedHeight || 0);
    if (!mesId || height < 24 || !isLongChatDomRenderNearViewport(target)) {
        return;
    }

    setLongChatDomRenderCachedHeight(mesId, height);
    target.style.setProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR, `${Math.round(height)}px`);
}

function isLongChatDomRenderNearViewport(element) {
    const rect = element.getBoundingClientRect();
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 800;
    return rect.bottom >= -viewportHeight && rect.top <= viewportHeight * 2;
}

function getLongChatDomRenderCachedHeight(mesId) {
    const key = getLongChatDomRenderHeightCacheKey(mesId);
    if (!key) {
        return 0;
    }

    const state = getLongChatDomRenderState();
    return Number(state.heightCache.get(key) || 0);
}

function setLongChatDomRenderCachedHeight(mesId, height) {
    const key = getLongChatDomRenderHeightCacheKey(mesId);
    if (!key || !Number.isFinite(height) || height <= 0) {
        return;
    }

    const state = getLongChatDomRenderState();
    state.heightCache.set(key, Math.round(height));

    while (state.heightCache.size > 1000) {
        const oldestKey = state.heightCache.keys().next().value;
        state.heightCache.delete(oldestKey);
    }
}

function getLongChatDomRenderHeightCacheKey(mesId) {
    if (mesId === undefined || mesId === null || String(mesId) === '') {
        return '';
    }

    const chatId = getCurrentChatId?.();
    if (chatId === undefined || chatId === null || String(chatId) === '') {
        return '';
    }

    return `${String(chatId)}::${String(mesId)}`;
}

function getLongChatDomRenderCurrentChatHeightCachePrefix() {
    const chatId = getCurrentChatId?.();
    if (chatId === undefined || chatId === null || String(chatId) === '') {
        return '';
    }

    return `${String(chatId)}::`;
}

function pruneLongChatDomRenderCurrentChatHeightCache() {
    const state = getLongChatDomRenderState();
    const prefix = getLongChatDomRenderCurrentChatHeightCachePrefix();
    const chatLength = Array.isArray(scriptModule.chat) ? scriptModule.chat.length : 0;

    if (!prefix || !Number.isFinite(chatLength)) {
        return;
    }

    for (const key of state.heightCache.keys()) {
        if (!String(key).startsWith(prefix)) {
            continue;
        }

        const mesId = Number(String(key).slice(prefix.length));
        if (!Number.isInteger(mesId) || mesId >= chatLength) {
            state.heightCache.delete(key);
        }
    }
}

function cleanupLongChatDomRenderMessages() {
    removeLongChatDomRenderBottomAnchor();
    document.querySelector('#chat')?.classList.remove('bai-bai-toolkit-long-chat-render-optimized');
    for (const element of document.querySelectorAll('#chat .mes.bai-bai-toolkit-long-chat-contained')) {
        cleanupLongChatDomRenderMessage(element);
    }
}

function cleanupLongChatDomRenderMessage(element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.classList.remove('bai-bai-toolkit-long-chat-contained');
    element.style.removeProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR);
}

function isLongChatDomRenderGenerationActive() {
    const state = getLongChatDomRenderState();
    if (state.generationActive) {
        return true;
    }

    if (typeof scriptModule.isGenerating === 'function') {
        try {
            return Boolean(scriptModule.isGenerating());
        } catch {
            return false;
        }
    }

    return false;
}

function isLongChatDomRenderOptimizedChat(chat) {
    return chat instanceof HTMLElement
        && (chat.classList.contains('bai-bai-toolkit-long-chat-render-optimized')
            || Boolean(chat.querySelector('.mes.bai-bai-toolkit-long-chat-contained')));
}

function shouldStartLongChatDomRenderGenerationAnchor() {
    const chat = document.querySelector('#chat');
    return chat instanceof HTMLElement
        && settings.longChatDomRenderOptimizationEnabled
        && !isWelcomePageDisplayed(chat)
        && isLongChatDomRenderOptimizedChat(chat)
        && isLongChatDomRenderAtBottom(chat);
}

function shouldScrollLongChatDomRenderToLatestMessageStartAfterGeneration(state = getLongChatDomRenderState()) {
    const chat = document.querySelector('#chat');
    return chat instanceof HTMLElement
        && settings.longChatDomRenderOptimizationEnabled
        && !isWelcomePageDisplayed(chat)
        && isLongChatDomRenderOptimizedChat(chat)
        && state.generationAnchorEnabled
        && !state.userScrolledAway;
}

function scheduleLongChatDomRenderGenerationAnchor() {
    if (!settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const state = getLongChatDomRenderState();
    if (!state.generationAnchorEnabled && !isLongChatDomRenderGenerationActive()) {
        return;
    }

    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorReleaseTimer = null;
    clearTimeout(state.generationAnchorTimer);
    state.generationAnchorTimer = setTimeout(() => {
        state.generationAnchorTimer = null;
        updateLongChatDomRenderGenerationAnchor();
    }, 40);
}

function updateLongChatDomRenderGenerationAnchor() {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)
        || !settings.longChatDomRenderOptimizationEnabled
        || isWelcomePageDisplayed(chat)
        || !isLongChatDomRenderGenerationActive()
        || !isLongChatDomRenderOptimizedChat(chat)) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
        return;
    }

    const atBottom = isLongChatDomRenderAtBottom(chat);
    if (!state.generationAnchorEnabled && !atBottom) {
        return;
    }

    if (!atBottom) {
        if (!state.generationAnchorAwayStartedAt) {
            state.generationAnchorAwayStartedAt = performance.now();
        }
        if (performance.now() - Number(state.generationAnchorAwayStartedAt || 0) > 250) {
            state.generationAnchorEnabled = false;
            removeLongChatDomRenderBottomAnchorIfIdle(state);
        } else {
            scheduleLongChatDomRenderGenerationAnchor('scroll-away');
        }
        return;
    }

    state.generationAnchorAwayStartedAt = 0;
    state.generationAnchorEnabled = true;
    ensureLongChatDomRenderBottomAnchor(chat, state);
}

function releaseLongChatDomRenderGenerationAnchor() {
    const state = getLongChatDomRenderState();
    state.generationAnchorEnabled = false;
    state.generationAnchorAwayStartedAt = 0;
    clearTimeout(state.generationAnchorTimer);
    state.generationAnchorTimer = null;
    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorReleaseTimer = setTimeout(() => {
        state.generationAnchorReleaseTimer = null;
        if (!isLongChatDomRenderGenerationActive()) {
            removeLongChatDomRenderBottomAnchorIfIdle(state);
        }
    }, LONG_CHAT_DOM_RENDER_GENERATION_ANCHOR_RELEASE_MS);
}

function removeLongChatDomRenderBottomAnchorIfIdle(state = getLongChatDomRenderState()) {
    if (state.autoScrollChatElement instanceof HTMLElement) {
        return;
    }

    removeLongChatDomRenderBottomAnchor(state);
}

function scheduleLongChatDomRenderScrollToLatestMessageStart(reason = '') {
    const state = getLongChatDomRenderState();
    clearLongChatDomRenderAutoScrollTimers();
    state.autoScrollToken = Number(state.autoScrollToken || 0) + 1;
    const token = state.autoScrollToken;
    state.autoScrollStartedAt = performance.now();
    state.autoScrollLastHeight = 0;
    state.autoScrollLastTargetTop = null;
    state.autoScrollStableFrames = 0;
    state.autoScrollLogged = false;

    settleLongChatDomRenderScrollToLatestMessageStart(token, reason);
}

function scheduleLongChatDomRenderScrollToBottom(reason = '') {
    const state = getLongChatDomRenderState();
    clearLongChatDomRenderAutoScrollTimers();
    state.autoScrollToken = Number(state.autoScrollToken || 0) + 1;
    const token = state.autoScrollToken;
    state.autoScrollStartedAt = performance.now();
    state.autoScrollLastHeight = 0;
    state.autoScrollStableFrames = 0;
    state.autoScrollLogged = false;

    settleLongChatDomRenderScrollToBottom(token, reason);
}

function clearLongChatDomRenderAutoScrollTimers() {
    const state = getLongChatDomRenderState();
    for (const timer of state.autoScrollTimers || []) {
        clearTimeout(timer);
    }
    state.autoScrollTimers = [];

    if (state.autoScrollFrame) {
        cancelAnimationFrame(state.autoScrollFrame);
        state.autoScrollFrame = 0;
    }

    restoreLongChatDomRenderScrollBehavior(state);
}

function settleLongChatDomRenderScrollToBottom(token, reason = '') {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)
        || token !== state.autoScrollToken
        || !settings.longChatDomRenderOptimizationEnabled
        || isWelcomePageDisplayed(chat)
        || state.userScrolledAway) {
        restoreLongChatDomRenderScrollBehavior(state);
        return;
    }

    ensureLongChatDomRenderInstantScroll(chat, state);
    ensureLongChatDomRenderBottomAnchor(chat, state);

    const now = performance.now();
    state.programmaticScrollUntil = now + 250;

    const desiredTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
    const distance = Math.abs(chat.scrollTop - desiredTop);
    const heightDelta = Math.abs(Number(state.autoScrollLastHeight || 0) - chat.scrollHeight);

    if (distance > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        chat.scrollTop = desiredTop;
        state.autoScrollStableFrames = 0;
    } else if (heightDelta > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        state.autoScrollStableFrames = 0;
    } else {
        state.autoScrollStableFrames = Number(state.autoScrollStableFrames || 0) + 1;
    }

    state.autoScrollLastHeight = chat.scrollHeight;

    const elapsed = now - Number(state.autoScrollStartedAt || now);
    if (elapsed < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS
        && Number(state.autoScrollStableFrames || 0) < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES) {
        state.autoScrollFrame = requestAnimationFrame(() => {
            state.autoScrollFrame = 0;
            settleLongChatDomRenderScrollToBottom(token, reason);
        });
        return;
    }

    restoreLongChatDomRenderScrollBehavior(state, { finalScrollToBottom: true });

    if (!state.autoScrollLogged) {
        state.autoScrollLogged = true;
        console.debug(`${LOG_PREFIX} Long chat DOM render optimization scrolled to bottom (${reason})`);
    }
}

function ensureLongChatDomRenderInstantScroll(chat, state) {
    if (!(chat instanceof HTMLElement) || state.autoScrollChatElement === chat) {
        return;
    }

    restoreLongChatDomRenderScrollBehavior(state);
    state.autoScrollChatElement = chat;
    state.autoScrollPreviousScrollBehavior = chat.style.scrollBehavior || '';
    chat.style.scrollBehavior = 'auto';
}

function ensureLongChatDomRenderBottomAnchor(chat, state) {
    if (!(chat instanceof HTMLElement)) {
        return;
    }

    let anchor = state.bottomAnchorElement;
    if (!(anchor instanceof HTMLElement)) {
        anchor = document.createElement('div');
        anchor.className = LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS;
        anchor.setAttribute('aria-hidden', 'true');
        state.bottomAnchorElement = anchor;
    }

    if (anchor.parentElement !== chat || chat.lastElementChild !== anchor) {
        chat.append(anchor);
    }

    chat.classList.add(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
}

function removeLongChatDomRenderBottomAnchor(state = getLongChatDomRenderState()) {
    const anchor = state.bottomAnchorElement;
    if (anchor instanceof HTMLElement) {
        anchor.parentElement?.classList.remove(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
        anchor.remove();
    }

    document.querySelector('#chat')?.classList.remove(LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS);
    state.bottomAnchorElement = null;
}

function restoreLongChatDomRenderScrollBehavior(state = getLongChatDomRenderState(), { finalScrollToBottom = false } = {}) {
    const chat = state.autoScrollChatElement;
    if (chat instanceof HTMLElement) {
        if (finalScrollToBottom) {
            chat.scrollTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
        }
        removeLongChatDomRenderBottomAnchor(state);
        if (finalScrollToBottom) {
            chat.scrollTop = Math.max(0, chat.scrollHeight - chat.clientHeight);
        }
        chat.style.scrollBehavior = state.autoScrollPreviousScrollBehavior || '';
    } else {
        removeLongChatDomRenderBottomAnchor(state);
    }

    state.autoScrollChatElement = null;
    state.autoScrollPreviousScrollBehavior = '';
}

function settleLongChatDomRenderScrollToLatestMessageStart(token, reason = '') {
    const state = getLongChatDomRenderState();
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement)
        || token !== state.autoScrollToken
        || !settings.longChatDomRenderOptimizationEnabled
        || isWelcomePageDisplayed(chat)
        || state.userScrolledAway) {
        restoreLongChatDomRenderScrollBehavior(state);
        return;
    }

    const latestMessage = getLongChatDomRenderLatestMessageElement(chat);
    if (!(latestMessage instanceof HTMLElement)) {
        restoreLongChatDomRenderScrollBehavior(state);
        return;
    }

    ensureLongChatDomRenderInstantScroll(chat, state);
    removeLongChatDomRenderBottomAnchor(state);

    const now = performance.now();
    state.programmaticScrollUntil = now + 250;

    const targetTop = getLongChatDomRenderLatestMessageStartScrollTop(chat, latestMessage);
    const distance = Math.abs(chat.scrollTop - targetTop);
    const heightDelta = Math.abs(Number(state.autoScrollLastHeight || 0) - chat.scrollHeight);
    const targetDelta = Number.isFinite(state.autoScrollLastTargetTop)
        ? Math.abs(Number(state.autoScrollLastTargetTop) - targetTop)
        : 0;

    if (distance > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        chat.scrollTop = targetTop;
        state.autoScrollStableFrames = 0;
    } else if (heightDelta > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE || targetDelta > LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE) {
        state.autoScrollStableFrames = 0;
    } else {
        state.autoScrollStableFrames = Number(state.autoScrollStableFrames || 0) + 1;
    }

    state.autoScrollLastHeight = chat.scrollHeight;
    state.autoScrollLastTargetTop = targetTop;

    const elapsed = now - Number(state.autoScrollStartedAt || now);
    if (elapsed < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS
        && Number(state.autoScrollStableFrames || 0) < LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES) {
        state.autoScrollFrame = requestAnimationFrame(() => {
            state.autoScrollFrame = 0;
            settleLongChatDomRenderScrollToLatestMessageStart(token, reason);
        });
        return;
    }

    restoreLongChatDomRenderScrollBehavior(state);

    if (!state.autoScrollLogged) {
        state.autoScrollLogged = true;
        console.debug(`${LOG_PREFIX} Long chat DOM render optimization scrolled to latest message start (${reason})`);
    }
}

function handleLongChatDomRenderScroll(chat) {
    const state = getLongChatDomRenderState();
    if (performance.now() < Number(state.programmaticScrollUntil || 0)) {
        return;
    }

    const atBottom = isLongChatDomRenderAtBottom(chat);
    state.userScrolledAway = !atBottom;
    if (state.generationAnchorEnabled) {
        if (atBottom) {
            state.generationAnchorAwayStartedAt = 0;
        } else {
            if (!state.generationAnchorAwayStartedAt) {
                state.generationAnchorAwayStartedAt = performance.now();
            }
            scheduleLongChatDomRenderGenerationAnchor('scroll');
        }
    }
}

function isLongChatDomRenderAtBottom(chat) {
    if (!(chat instanceof HTMLElement)) {
        return true;
    }

    return chat.scrollHeight - chat.scrollTop - chat.clientHeight <= 48;
}

function getLongChatDomRenderLatestMessageElement(chat) {
    if (!(chat instanceof HTMLElement)) {
        return null;
    }

    const messages = [...chat.querySelectorAll('.mes[mesid]')].filter(element => element instanceof HTMLElement);
    return messages[messages.length - 1] ?? null;
}

function getLongChatDomRenderLatestMessageStartScrollTop(chat, message) {
    const currentTop = chat.scrollTop;
    const chatRect = chat.getBoundingClientRect();
    const messageRect = message.getBoundingClientRect();
    const viewportOffset = Math.max(
        LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MIN,
        Math.min(
            Math.round(chat.clientHeight * LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_RATIO),
            LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MAX,
        ),
    );
    const rawTop = currentTop + messageRect.top - chatRect.top - viewportOffset;
    const maxTop = Math.max(0, chat.scrollHeight - chat.clientHeight);

    return Math.max(0, Math.min(Math.round(rawTop), maxTop));
}

function getLongChatMessageTextLength(message) {
    if (!message || typeof message !== 'object') {
        return 0;
    }

    let rawText = '';

    // Prefer translated text if available, fallback to original message
    if (typeof message.extra?.display_text === 'string' && message.extra.display_text.trim().length > 0) {
        rawText = message.extra.display_text;
    } else if (typeof message.mes === 'string') {
        rawText = message.mes;
    }

    let length = 0;
    if (rawText) {
        // Strip <think> and <details> blocks out of the length calculation
        // since they are usually folded/hidden and don't contribute to standard reading height
        let processedText = rawText
            .replace(/<think[ing]*>[\s\S]*?<\/think[ing]*>/gi, '')
            .replace(/<details[\s\S]*?>[\s\S]*?<\/details>/gi, '');

        length += processedText.length;
    }

    // Add a fixed small length penalty if reasoning text exists (representing folded summary)
    if (typeof message.extra?.reasoning === 'string' || typeof message.extra?.reasoning_display_text === 'string') {
        length += 50;
    }

    return length;
}

function isWelcomeRecentChatDirectOpenCompatibilityMode() {
    return typeof createOrEditCharacter !== 'function';
}

function isChatDeleteEditFlowSupported() {
    return typeof messageEdit === 'function';
}

function applyChatDeleteEditFlowOptimization() {
    if (!isChatDeleteEditFlowSupported()) {
        endChatDeleteEditWindow();
        return;
    }

    if (extensionState[CHAT_DELETE_EDIT_HANDLER_KEY]) {
        return;
    }

    const clickHandler = (event) => {
        handleChatDeleteEditFlowClick(event);
    };
    const generationActionHandler = (event) => {
        handleChatGenerationActionClick(event);
    };
    const messageDeletedHandler = () => {
        scheduleChatDeleteEditWindowEnd(1500);
    };

    extensionState[CHAT_DELETE_EDIT_HANDLER_KEY] = clickHandler;
    extensionState[CHAT_DELETE_GENERATION_ACTION_HANDLER_KEY] = generationActionHandler;
    extensionState[CHAT_DELETE_MESSAGE_DELETED_HANDLER_KEY] = messageDeletedHandler;

    document.addEventListener('click', clickHandler, true);
    document.addEventListener('click', generationActionHandler, true);
    eventSource.on(event_types.MESSAGE_DELETED, messageDeletedHandler);
}

function applyMobileAutoKeyboardSuppression() {
    patchMobileAutoKeyboardFocus();
    patchMobileAutoKeyboardJQueryFocus();

    if (extensionState[MOBILE_AUTO_KEYBOARD_HANDLER_KEY]) {
        return;
    }

    const directFocusIntentHandler = (event) => {
        markMobileAutoKeyboardDirectFocusIntent(event);
    };
    const pointerUpHandler = (event) => {
        handleMobileAutoKeyboardPointerUp(event);
    };
    const focusInHandler = (event) => {
        handleMobileAutoKeyboardFocusIn(event);
    };
    const pageLifecycleHandler = (event) => {
        handleMobileAutoKeyboardPageLifecycle(event);
    };

    extensionState[MOBILE_AUTO_KEYBOARD_HANDLER_KEY] = {
        directFocusIntentHandler,
        pointerUpHandler,
        focusInHandler,
        pageLifecycleHandler,
    };

    document.addEventListener('pointerdown', directFocusIntentHandler, true);
    document.addEventListener('mousedown', directFocusIntentHandler, true);
    document.addEventListener('touchstart', directFocusIntentHandler, true);
    document.addEventListener('pointerup', pointerUpHandler, true);
    document.addEventListener('touchend', pointerUpHandler, true);
    document.addEventListener('mouseup', pointerUpHandler, true);
    document.addEventListener('focusin', focusInHandler, true);
    document.addEventListener('visibilitychange', pageLifecycleHandler, true);
    window.addEventListener('pagehide', pageLifecycleHandler, true);
    window.addEventListener('pageshow', pageLifecycleHandler, true);
    window.addEventListener('focus', pageLifecycleHandler, true);
}

function applyMobileMessageEditScrollGuard() {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    patchMobileMessageEditChatScrollTop();
    installMobileMessageEditScrollGuardObservers();
    ensureMobileMessageEditChatResizeObserver();
    captureMobileMessageEditScrollGuard('apply');
}

function applyWelcomeRecentChatDirectOpenOptimization() {
    const existingHandler = extensionState[WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY];

    if (existingHandler?.[WELCOME_RECENT_CHAT_DIRECT_OPEN_CURRENT_HANDLER_KEY]) {
        return;
    }

    if (typeof existingHandler === 'function') {
        document.removeEventListener('click', existingHandler, true);
    }

    const clickHandler = (event) => {
        handleWelcomeRecentChatDirectOpenClick(event);
    };
    clickHandler[WELCOME_RECENT_CHAT_DIRECT_OPEN_CURRENT_HANDLER_KEY] = true;

    extensionState[WELCOME_RECENT_CHAT_DIRECT_OPEN_HANDLER_KEY] = clickHandler;
    document.addEventListener('click', clickHandler, true);
}

function handleWelcomeRecentChatDirectOpenClick(event) {
    if (!settings.welcomeRecentChatDirectOpenEnabled) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest(WELCOME_RECENT_CHAT_ACTION_SELECTOR)) {
        return;
    }

    const item = target.closest(WELCOME_RECENT_CHAT_SELECTOR);
    if (!(item instanceof HTMLElement)) {
        return;
    }

    const avatarId = item.getAttribute('data-avatar');
    const groupId = item.getAttribute('data-group');
    const fileName = item.getAttribute('data-file');

    if (!avatarId || !fileName || groupId) {
        return;
    }

    const characterId = characters.findIndex(character => character?.avatar === avatarId);
    if (characterId === -1) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    if (extensionState.welcomeRecentChatDirectOpenPromise) {
        return;
    }

    extensionState.welcomeRecentChatDirectOpenPromise = openWelcomeRecentCharacterChatDirectly(characterId, avatarId, fileName)
        .finally(() => {
            extensionState.welcomeRecentChatDirectOpenPromise = null;
        });
}

async function openWelcomeRecentCharacterChatDirectly(characterId, avatarId, fileName) {
    try {
        await ensureWelcomeRecentChatCharacterHydrated(characterId);

        const character = characters[characterId];
        if (!character) {
            console.error(`${LOG_PREFIX} Character not found for avatar ID: ${avatarId}`);
            return;
        }

        if (String(this_chid) === String(characterId)) {
            setActiveCharacter(avatarId);
            saveSettingsDebounced();

            if (isWelcomeRecentChatAlreadyDisplayed(fileName)) {
                console.debug(`${LOG_PREFIX} Chat ${fileName} is already open.`);
                return;
            }

            await openCharacterChat(fileName);
            return;
        }

        const previousChat = character.chat;
        character.chat = fileName;

        await selectCharacterById(characterId);

        if (String(this_chid) !== String(characterId)) {
            if (character.chat === fileName && previousChat !== fileName) {
                character.chat = previousChat;
            }
            return;
        }

        setActiveCharacter(avatarId);
        saveSettingsDebounced();

        if (getCurrentChatId() !== fileName) {
            await openCharacterChat(fileName);
            return;
        }

        if (previousChat !== fileName) {
            if (typeof createOrEditCharacter === 'function') {
                await createOrEditCharacter(new CustomEvent('newChat'));
            } else {
                await openCharacterChat(fileName);
            }
        }
    } catch (error) {
        console.error(`${LOG_PREFIX} Error opening recent chat`, error);
        toastr.error(t`Failed to open recent chat. See console for details.`);
    }
}

async function ensureWelcomeRecentChatCharacterHydrated(characterId) {
    if (typeof unshallowCharacter !== 'function' || !characters[characterId]?.shallow) {
        return;
    }

    // ST replaces shallow character objects during getChat(), so expand before writing character.chat.
    await unshallowCharacter(characterId);
}

function isWelcomeRecentChatAlreadyDisplayed(fileName) {
    return getCurrentChatId() === fileName && !isWelcomePageDisplayed();
}

function isWelcomePageDisplayed(root = document) {
    if (!(root instanceof Document || root instanceof Element)) {
        return false;
    }

    return Boolean(root.querySelector(WELCOME_PANEL_SELECTOR));
}

function patchMobileMessageEditChatScrollTop() {
    const target = getMobileMessageEditScrollTopDescriptorTarget();

    if (
        !target?.descriptor?.get
        || !target.descriptor?.set
        || target.descriptor.set[MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY]
    ) {
        return;
    }

    const { prototype, descriptor } = target;

    function guardedScrollTopSetter(value) {
        if (shouldBlockMobileMessageEditChatScrollTop(this, value)) {
            return;
        }

        return descriptor.set.call(this, value);
    }

    guardedScrollTopSetter[MOBILE_MESSAGE_EDIT_SCROLL_TOP_PATCH_KEY] = true;
    guardedScrollTopSetter.__baiBaiToolkitOriginalScrollTopSetter = descriptor.set;

    Object.defineProperty(prototype, 'scrollTop', {
        ...descriptor,
        set: guardedScrollTopSetter,
    });
}

function getMobileMessageEditScrollTopDescriptorTarget() {
    const prototypes = [
        globalThis.Element?.prototype,
        globalThis.HTMLElement?.prototype,
    ].filter(Boolean);

    for (const prototype of prototypes) {
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'scrollTop');

        if (descriptor?.get && descriptor?.set) {
            return { prototype, descriptor };
        }
    }

    return null;
}

function shouldBlockMobileMessageEditChatScrollTop(element, value) {
    if (extensionState.mobileMessageEditScrollRestoreActive) {
        return false;
    }

    if (!(element instanceof HTMLElement) || element.id !== 'chat') {
        return false;
    }

    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard || guard.chat !== element || Date.now() < Number(guard.userScrollIntentUntil || 0)) {
        return false;
    }

    const nextScrollTop = Number(value);

    if (!Number.isFinite(nextScrollTop)) {
        return false;
    }

    return Math.abs(nextScrollTop - Number(guard.scrollTop || 0)) > MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE;
}

function installMobileMessageEditScrollGuardObservers() {
    if (extensionState.mobileMessageEditScrollGuardObserversInstalled) {
        return;
    }

    const updateHandler = () => {
        scheduleMobileMessageEditScrollGuardUpdate();
    };
    const resizeHandler = () => {
        handleMobileMessageEditViewportResize();
    };
    const userScrollIntentHandler = () => {
        handleMobileMessageEditUserScrollIntent();
    };
    const mutationObserver = new MutationObserver(updateHandler);

    mutationObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    document.addEventListener('focusin', updateHandler, true);
    document.addEventListener('focusout', updateHandler, true);
    document.addEventListener('touchmove', userScrollIntentHandler, { capture: true, passive: true });
    document.addEventListener('wheel', userScrollIntentHandler, { capture: true, passive: true });
    window.addEventListener('resize', resizeHandler, true);
    window.visualViewport?.addEventListener('resize', resizeHandler, true);

    extensionState.mobileMessageEditScrollGuardMutationObserver = mutationObserver;
    extensionState.mobileMessageEditScrollGuardUpdateHandler = updateHandler;
    extensionState.mobileMessageEditScrollGuardResizeHandler = resizeHandler;
    extensionState.mobileMessageEditScrollGuardUserScrollIntentHandler = userScrollIntentHandler;
    extensionState.mobileMessageEditScrollGuardObserversInstalled = true;
}

function ensureMobileMessageEditChatResizeObserver() {
    const chat = document.querySelector('#chat');

    if (!(chat instanceof HTMLElement) || typeof ResizeObserver !== 'function') {
        return;
    }

    if (extensionState.mobileMessageEditScrollGuardResizeElement === chat) {
        return;
    }

    extensionState.mobileMessageEditScrollGuardResizeObserver?.disconnect();

    const resizeObserver = new ResizeObserver(() => {
        handleMobileMessageEditChatResize();
    });

    resizeObserver.observe(chat);
    extensionState.mobileMessageEditScrollGuardResizeObserver = resizeObserver;
    extensionState.mobileMessageEditScrollGuardResizeElement = chat;
}

function scheduleMobileMessageEditScrollGuardUpdate() {
    if (extensionState.mobileMessageEditScrollGuardUpdateFrame) {
        return;
    }

    extensionState.mobileMessageEditScrollGuardUpdateFrame = requestAnimationFrame(() => {
        extensionState.mobileMessageEditScrollGuardUpdateFrame = 0;
        ensureMobileMessageEditChatResizeObserver();
        captureMobileMessageEditScrollGuard('scheduled update');
    });
}

function captureMobileMessageEditScrollGuard(reason, editor = null, { force = false } = {}) {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    const targetEditor = editor instanceof HTMLElement && editor.matches(MOBILE_MESSAGE_EDIT_SELECTOR)
        ? editor
        : document.querySelector(MOBILE_MESSAGE_EDIT_SELECTOR);
    const chat = document.querySelector('#chat');

    if (!(targetEditor instanceof HTMLElement) || !(chat instanceof HTMLElement)) {
        stopMobileMessageEditScrollGuard();
        return;
    }

    const existingGuard = extensionState.mobileMessageEditScrollGuard;

    if (
        !force
        && existingGuard?.editor === targetEditor
        && existingGuard?.chat === chat
    ) {
        return;
    }

    extensionState.mobileMessageEditScrollGuard = {
        editor: targetEditor,
        chat,
        scrollTop: chat.scrollTop,
        chatHeight: chat.offsetHeight,
        capturedAt: Date.now(),
        reason,
        restoreTimers: [],
        userScrollIntentUntil: 0,
    };
}

function stopMobileMessageEditScrollGuard() {
    const guard = extensionState.mobileMessageEditScrollGuard;

    if (guard?.restoreTimers?.length) {
        guard.restoreTimers.forEach(timer => clearTimeout(timer));
    }

    extensionState.mobileMessageEditScrollGuard = null;
}

function handleMobileMessageEditChatResize() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        captureMobileMessageEditScrollGuard('chat resize without guard');
        return;
    }

    const nextHeight = guard.chat.offsetHeight;
    const heightDelta = nextHeight - Number(guard.chatHeight || 0);
    guard.chatHeight = nextHeight;

    if (Math.abs(heightDelta) <= MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE) {
        return;
    }

    scheduleMobileMessageEditScrollRestore(`chat resize ${heightDelta}`);
}

function handleMobileMessageEditViewportResize() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    scheduleMobileMessageEditScrollRestore('viewport resize');
}

function handleMobileMessageEditUserScrollIntent() {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    guard.userScrollIntentUntil = Date.now() + 700;
}

function scheduleMobileMessageEditScrollRestore(reason) {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard) {
        return;
    }

    queueMicrotask(() => restoreMobileMessageEditScroll(reason));
    requestAnimationFrame(() => restoreMobileMessageEditScroll(reason));

    for (const delay of MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_DELAYS) {
        const timer = setTimeout(() => {
            guard.restoreTimers = guard.restoreTimers.filter(value => value !== timer);
            restoreMobileMessageEditScroll(reason);
        }, delay);

        guard.restoreTimers.push(timer);
    }
}

function restoreMobileMessageEditScroll(reason) {
    const guard = getActiveMobileMessageEditScrollGuard();

    if (!guard || Date.now() < Number(guard.userScrollIntentUntil || 0)) {
        return;
    }

    const desiredScrollTop = Number(guard.scrollTop || 0);

    if (Math.abs(guard.chat.scrollTop - desiredScrollTop) <= MOBILE_MESSAGE_EDIT_SCROLL_RESTORE_TOLERANCE) {
        return;
    }

    try {
        extensionState.mobileMessageEditScrollRestoreActive = true;
        guard.chat.scrollTop = desiredScrollTop;
        console.debug(`${LOG_PREFIX} Restored message edit chat scroll after ${reason}: ${desiredScrollTop}`);
    } finally {
        extensionState.mobileMessageEditScrollRestoreActive = false;
    }
}

function getActiveMobileMessageEditScrollGuard() {
    const guard = extensionState.mobileMessageEditScrollGuard;

    if (
        !guard
        || !isMobileMessageEditScrollGuardEnabled()
        || !(guard.editor instanceof HTMLElement)
        || !(guard.chat instanceof HTMLElement)
        || !guard.editor.isConnected
        || !guard.chat.isConnected
        || !document.querySelector(MOBILE_MESSAGE_EDIT_SELECTOR)
    ) {
        stopMobileMessageEditScrollGuard();
        return null;
    }

    return guard;
}

function isMobileMessageEditScrollGuardEnabled() {
    return Boolean(settings.mobileMessageEditScrollGuardEnabled);
}

function patchMobileAutoKeyboardFocus() {
    const originalFocus = HTMLElement.prototype.focus;

    if (typeof originalFocus !== 'function' || originalFocus[MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY]) {
        return;
    }

    function guardedFocus(...args) {
        if (shouldSuppressMobileAutoKeyboardFocus(this)) {
            return undefined;
        }

        return originalFocus.apply(this, args);
    }

    guardedFocus[MOBILE_AUTO_KEYBOARD_FOCUS_PATCH_KEY] = true;
    guardedFocus.__baiBaiToolkitOriginalFocus = originalFocus;
    HTMLElement.prototype.focus = guardedFocus;
}

function patchMobileAutoKeyboardJQueryFocus() {
    const jQueryPrototype = globalThis.jQuery?.fn || globalThis.$?.fn;

    if (!jQueryPrototype) {
        return;
    }

    const originalFocus = jQueryPrototype.focus;
    if (typeof originalFocus === 'function' && !originalFocus[MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY]) {
        function guardedJQueryFocus(...args) {
            if (args.length === 0 && shouldSuppressMobileAutoKeyboardJQueryCollection(this)) {
                return this;
            }

            // PC Auto-Scroll Guard: Inject {preventScroll: true} for `#curEditTextarea` on PC or Mobile
            if (this.length > 0 && this[0].id === 'curEditTextarea' && isMobileMessageEditScrollGuardEnabled()) {
                args = [{ preventScroll: true }];
            }

            return originalFocus.apply(this, args);
        }

        guardedJQueryFocus[MOBILE_AUTO_KEYBOARD_JQUERY_FOCUS_PATCH_KEY] = true;
        guardedJQueryFocus.__baiBaiToolkitOriginalFocus = originalFocus;
        jQueryPrototype.focus = guardedJQueryFocus;
    }

    const originalTrigger = jQueryPrototype.trigger;
    if (typeof originalTrigger === 'function' && !originalTrigger[MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY]) {
        function guardedJQueryTrigger(...args) {
            if (isMobileAutoKeyboardFocusTrigger(args[0]) && shouldSuppressMobileAutoKeyboardJQueryCollection(this)) {
                return this;
            }

            return originalTrigger.apply(this, args);
        }

        guardedJQueryTrigger[MOBILE_AUTO_KEYBOARD_JQUERY_TRIGGER_PATCH_KEY] = true;
        guardedJQueryTrigger.__baiBaiToolkitOriginalTrigger = originalTrigger;
        jQueryPrototype.trigger = guardedJQueryTrigger;
    }
}

function markMobileAutoKeyboardDirectFocusIntent(event) {
    const keyboardTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR)
        : null;
    const editTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_MESSAGE_EDIT_SELECTOR)
        : null;

    if (isMobileMessageEditScrollGuardEnabled() && editTarget instanceof HTMLElement) {
        captureMobileMessageEditScrollGuard('direct edit focus intent', editTarget, { force: true });

        // Record coordinates to distinguish between scroll and click
        const touch = event.touches?.[0] || event;
        extensionState.mobileAutoKeyboardTouchStartX = touch.clientX;
        extensionState.mobileAutoKeyboardTouchStartY = touch.clientY;
    }

    if (!isMobile()) {
        return;
    }

    if (keyboardTarget instanceof HTMLElement && shouldTrackMobileAutoKeyboardDirectFocusIntent(keyboardTarget)) {
        extensionState.mobileAutoKeyboardDirectFocusTarget = keyboardTarget;
        extensionState.mobileAutoKeyboardDirectFocusAt = Date.now();
    }
}

function handleMobileAutoKeyboardPointerUp(event) {
    if (!isMobileMessageEditScrollGuardEnabled()) {
        return;
    }

    const editTarget = event.target instanceof Element
        ? event.target.closest(MOBILE_MESSAGE_EDIT_SELECTOR)
        : null;

    if (editTarget instanceof HTMLElement) {
        // Only focus if the pointer didn't move significantly (it was a click, not a swipe)
        let isSwipe = false;

        if (event.type === 'touchend' && typeof extensionState.mobileAutoKeyboardTouchStartX === 'number') {
            const touch = event.changedTouches?.[0] || event;
            const deltaX = Math.abs(touch.clientX - extensionState.mobileAutoKeyboardTouchStartX);
            const deltaY = Math.abs(touch.clientY - extensionState.mobileAutoKeyboardTouchStartY);

            // If moved more than 10 pixels, consider it a swipe
            if (deltaX > 10 || deltaY > 10) {
                isSwipe = true;
            }
        }

        extensionState.mobileAutoKeyboardTouchStartX = null;
        extensionState.mobileAutoKeyboardTouchStartY = null;

        if (!isSwipe) {
            focusMobileMessageEditWithoutScroll(event, editTarget);
        }
    }
}

function focusMobileMessageEditWithoutScroll(event, editor) {
    if (
        document.activeElement === editor
        || Date.now() - Number(extensionState.mobileMessageEditPreventScrollFocusAt || 0) <= 300
    ) {
        return;
    }

    extensionState.mobileMessageEditPreventScrollFocusAt = Date.now();

    try {
        editor.focus({ preventScroll: true });
    } catch {
        editor.focus();
    }
}

function handleMobileAutoKeyboardFocusIn(event) {
    const target = event.target;

    if (!(target instanceof HTMLElement)) {
        return;
    }

    if (isMobileMessageEditScrollGuardEnabled() && target.matches(MOBILE_MESSAGE_EDIT_SELECTOR)) {
        captureMobileMessageEditScrollGuard('edit focusin', target, { force: true });
    }

    if (!shouldSuppressMobileAutoKeyboardFocus(target)) {
        return;
    }

    blurMobileAutoKeyboardTarget(target);
}

function blurMobileAutoKeyboardTarget(target) {
    if (document.activeElement === target) {
        target.blur();
    }

    const blurAgain = () => {
        if (document.activeElement === target && shouldSuppressMobileAutoKeyboardFocus(target)) {
            target.blur();
        }
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(blurAgain);
    } else {
        setTimeout(blurAgain, 0);
    }
}

function shouldSuppressMobileAutoKeyboardFocus(element) {
    return Boolean(
        isMobile()
        && element instanceof HTMLElement
        && isMobileAutoKeyboardSuppressionTarget(element)
        && !isRecentMobileAutoKeyboardDirectFocusIntent(element),
    );
}

function shouldTrackMobileAutoKeyboardDirectFocusIntent(element) {
    return Boolean(
        settings.mobileAutoKeyboardSuppressionEnabled
        && element.matches(MOBILE_DIRECT_KEYBOARD_TARGET_SELECTOR)
    );
}

function isMobileAutoKeyboardSuppressionTarget(element) {
    return Boolean(
        settings.mobileAutoKeyboardSuppressionEnabled
        && (
            element.matches(MOBILE_AUTO_KEYBOARD_TARGET_SELECTOR)
            || element.matches(MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR)
        )
    );
}

function isRecentMobileAutoKeyboardDirectFocusIntent(element) {
    return Boolean(
        extensionState.mobileAutoKeyboardDirectFocusTarget === element
        && Date.now() - Number(extensionState.mobileAutoKeyboardDirectFocusAt || 0) <= MOBILE_AUTO_KEYBOARD_DIRECT_FOCUS_WINDOW_MS,
    );
}

function shouldSuppressMobileAutoKeyboardJQueryCollection(collection) {
    const element = collection?.[0];
    return element instanceof HTMLElement && shouldSuppressMobileAutoKeyboardFocus(element);
}

function isMobileAutoKeyboardFocusTrigger(type) {
    const eventType = typeof type === 'string'
        ? type
        : typeof type?.type === 'string'
            ? type.type
            : '';
    const normalizedType = eventType.split('.')[0];

    return normalizedType === 'focus' || normalizedType === 'focusin';
}

function handleMobileAutoKeyboardPageLifecycle(event) {
    if (!settings.mobileAutoKeyboardSuppressionEnabled || !isMobile()) {
        return;
    }

    if (event?.type === 'pagehide' || document.visibilityState === 'hidden') {
        clearMobileAutoKeyboardDirectFocusIntent();
    }

    scheduleMobileChatEntryKeyboardBlur();
}

function scheduleMobileChatEntryKeyboardBlur() {
    blurMobileChatEntryKeyboardTargetIfNeeded();

    const blurAgain = () => {
        blurMobileChatEntryKeyboardTargetIfNeeded();
    };

    if (typeof requestAnimationFrame === 'function') {
        requestAnimationFrame(blurAgain);
    } else {
        setTimeout(blurAgain, 0);
    }

    setTimeout(blurAgain, 100);
}

function blurMobileChatEntryKeyboardTargetIfNeeded() {
    const target = document.activeElement;
    if (target instanceof HTMLElement && target.matches(MOBILE_CHAT_ENTRY_KEYBOARD_TARGET_SELECTOR) && shouldSuppressMobileAutoKeyboardFocus(target)) {
        target.blur();
    }
}

function clearMobileAutoKeyboardDirectFocusIntent() {
    extensionState.mobileAutoKeyboardDirectFocusTarget = null;
    extensionState.mobileAutoKeyboardDirectFocusAt = 0;
}

function handleChatDeleteEditFlowClick(event) {
    if (!settings.chatDeleteEditFlowOptimizationEnabled || !isChatDeleteEditFlowSupported()) {
        endChatDeleteEditWindow();
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    if (!target) {
        return;
    }

    if (target.closest('#dialogue_del_mes_ok')) {
        if (hasSelectedMessageForDeletion()) {
            startChatDeleteEditWindow();
        }
        return;
    }

    const editButton = target.closest(CHAT_MESSAGE_EDIT_SELECTOR);
    if (!editButton || !isChatDeleteEditWindowActive()) {
        return;
    }

    if (hasActiveMessageEditor()) {
        return;
    }

    const messageElement = editButton.closest('.mes[mesid]');
    const messageId = Number(messageElement?.getAttribute('mesid'));
    if (!Number.isInteger(messageId) || messageId < 0) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void openMessageEditorDuringDeleteFlow(messageId);
}

function hasSelectedMessageForDeletion() {
    return Boolean(document.querySelector('#chat .mes.selected, #chat .del_checkbox:checked'));
}

function startChatDeleteEditWindow() {
    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowActive = true;
    extensionState.chatDeleteEditWindowStartedAt = Date.now();
    extensionState.chatDeleteEditWindowTimer = setTimeout(endChatDeleteEditWindow, CHAT_DELETE_EDIT_WINDOW_MS);
}

function scheduleChatDeleteEditWindowEnd(delayMs) {
    if (!extensionState.chatDeleteEditWindowActive) {
        return;
    }

    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowTimer = setTimeout(endChatDeleteEditWindow, delayMs);
}

function endChatDeleteEditWindow() {
    clearTimeout(extensionState.chatDeleteEditWindowTimer);
    extensionState.chatDeleteEditWindowActive = false;
    extensionState.chatDeleteEditWindowStartedAt = 0;
}

function isChatDeleteEditWindowActive() {
    return Boolean(
        extensionState.chatDeleteEditWindowActive
        && Date.now() - Number(extensionState.chatDeleteEditWindowStartedAt || 0) <= CHAT_DELETE_EDIT_WINDOW_MS,
    );
}

async function openMessageEditorDuringDeleteFlow(messageId) {
    if (!isChatDeleteEditFlowSupported()) {
        return;
    }

    try {
        await messageEdit(messageId);
        const editor = document.querySelector('#curEditTextarea');
        const editedMessage = editor?.closest('.mes[mesid]');
        const editedMessageId = Number(editedMessage?.getAttribute('mesid'));

        if (Number.isInteger(editedMessageId)) {
            extensionState.chatDeleteFastEditorMesId = editedMessageId;
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to open message editor after message deletion`, error);
    }
}

function handleChatGenerationActionClick(event) {
    if (!settings.chatDeleteEditFlowOptimizationEnabled || !isChatDeleteEditFlowSupported() || extensionState.chatDeleteEditReplayingAction) {
        return;
    }

    if (!isFastDeleteEditorActive()) {
        return;
    }

    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest(CHAT_GENERATION_ACTION_SELECTOR);
    if (!action) {
        return;
    }

    event.preventDefault();
    event.stopPropagation();
    event.stopImmediatePropagation();

    void commitFastDeleteEditorAndReplayAction(action);
}

function hasActiveMessageEditor() {
    return Boolean(document.querySelector('#curEditTextarea') || document.querySelector('.reasoning_edit_textarea'));
}

function isFastDeleteEditorActive() {
    const editor = document.querySelector('#curEditTextarea');
    const message = editor?.closest('.mes[mesid]');
    const messageId = Number(message?.getAttribute('mesid'));

    return Boolean(
        editor
        && Number.isInteger(messageId)
        && Number(extensionState.chatDeleteFastEditorMesId) === messageId,
    );
}

async function commitFastDeleteEditorAndReplayAction(action) {
    if (!(action instanceof HTMLElement)) {
        return;
    }

    try {
        await commitFastDeleteEditor();
        await waitForNextPaint();
        replayChatGenerationAction(action);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to commit message edit before generation action`, error);
    }
}

async function commitFastDeleteEditor() {
    if (extensionState.chatDeleteEditCommitPromise) {
        return extensionState.chatDeleteEditCommitPromise;
    }

    const doneButton = $('#chat .mes_edit_done:visible').last();
    if (!doneButton.length) {
        extensionState.chatDeleteFastEditorMesId = null;
        return;
    }

    const messageId = Number(doneButton.closest('.mes[mesid]').attr('mesid'));
    const updatedPromise = waitForMessageUpdated(messageId, 3000);

    extensionState.chatDeleteEditCommitPromise = updatedPromise
        .finally(() => {
            extensionState.chatDeleteEditCommitPromise = null;
            extensionState.chatDeleteFastEditorMesId = null;
        });

    doneButton.trigger('click');
    await extensionState.chatDeleteEditCommitPromise;
}

function waitForMessageUpdated(messageId, timeoutMs) {
    return new Promise((resolve) => {
        let settled = false;
        const finish = () => {
            if (settled) {
                return;
            }

            settled = true;
            clearTimeout(timeout);
            eventSource.removeListener?.(event_types.MESSAGE_UPDATED, handler);
            resolve();
        };
        const handler = (updatedMessageId) => {
            if (!Number.isInteger(messageId) || Number(updatedMessageId) === messageId) {
                finish();
            }
        };
        const timeout = setTimeout(finish, timeoutMs);

        eventSource.on(event_types.MESSAGE_UPDATED, handler);
    });
}

function replayChatGenerationAction(action) {
    if (!action.isConnected) {
        return;
    }

    extensionState.chatDeleteEditReplayingAction = true;
    try {
        action.dispatchEvent(new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window,
        }));
    } finally {
        setTimeout(() => {
            extensionState.chatDeleteEditReplayingAction = false;
        }, 0);
    }
}

function applyFastChatListScrollOptimization() {
    const existingStyle = document.getElementById(FAST_CHAT_LIST_SCROLL_STYLE_ID);

    if (!settings.chatListScrollOptimizationEnabled) {
        existingStyle?.remove();
        return;
    }

    if (existingStyle) {
        return;
    }

    const style = document.createElement('style');
    style.id = FAST_CHAT_LIST_SCROLL_STYLE_ID;
    style.textContent = `
${CHAT_MANAGEMENT_POPUP_SELECTOR} ${CHAT_MANAGEMENT_LIST_SELECTOR} > .select_chat_block_wrapper {
    content-visibility: auto;
    contain: layout paint style;
    contain-intrinsic-size: 72px;
}
`;
    document.head.append(style);
}

function observeChatManagementPopupCleanup() {
    if (extensionState.chatManagementPopupObserver) {
        return;
    }

    const attachObserver = () => {
        const popup = document.querySelector(CHAT_MANAGEMENT_POPUP_SELECTOR);

        if (!popup) {
            return false;
        }

        let wasVisible = isElementDisplayed(popup);
        const observer = new MutationObserver(() => {
            const isVisible = isElementDisplayed(popup);

            if (wasVisible && !isVisible) {
                clearChatManagementPopupContent(popup);
            }

            wasVisible = isVisible;
        });

        observer.observe(popup, {
            attributes: true,
            attributeFilter: ['style', 'class'],
        });

        extensionState.chatManagementPopupObserver = observer;
        return true;
    };

    if (attachObserver()) {
        return;
    }

    const bodyObserver = new MutationObserver(() => {
        if (attachObserver()) {
            bodyObserver.disconnect();
            extensionState.chatManagementPopupAttachObserver = null;
        }
    });

    bodyObserver.observe(document.body, {
        childList: true,
        subtree: true,
    });

    extensionState.chatManagementPopupAttachObserver = bodyObserver;
}

function isElementDisplayed(element) {
    return getComputedStyle(element).display !== 'none';
}

function clearChatManagementPopupContent(popup) {
    if (!settings.chatListAutoClearEnabled) {
        return;
    }

    fastChatListRequestId += 1;

    const list = popup.querySelector(CHAT_MANAGEMENT_LIST_SELECTOR);

    if (!list || !list.children.length) {
        return;
    }

    list.replaceChildren();
}

function patchFastChatSearchFetch() {
    const originalFetch = globalThis.fetch;

    if (typeof originalFetch !== 'function' || originalFetch[FAST_CHAT_SEARCH_FETCH_KEY]) {
        return;
    }

    async function baiBaiToolkitFetch(input, init) {
        const requestData = await getFastChatSearchRequestData(input, init);

        if (requestData) {
            try {
                return await fetchFastCharacterChatList(originalFetch, requestData);
            } catch (error) {
                console.debug(`${LOG_PREFIX} Fast chat list path failed; falling back to /api/chats/search`, error);
            }
        }

        return originalFetch.apply(this, arguments);
    }

    baiBaiToolkitFetch[FAST_CHAT_SEARCH_FETCH_KEY] = true;
    baiBaiToolkitFetch.__baiBaiToolkitOriginalFetch = originalFetch;
    globalThis.fetch = baiBaiToolkitFetch;
}

async function getFastChatSearchRequestData(input, init) {
    if (!settings.fastChatListEnabled) {
        return null;
    }

    if (!isChatSearchUrl(input)) {
        return null;
    }

    const method = String(init?.method || (input instanceof Request ? input.method : 'GET')).toUpperCase();

    if (method !== 'POST') {
        return null;
    }

    const body = await readJsonRequestBody(input, init);

    if (!body || typeof body !== 'object') {
        return null;
    }

    const query = String(body.query ?? '');
    const avatarUrl = body.avatar_url;
    const groupId = body.group_id;

    if (query.trim().length !== 0 || groupId || typeof avatarUrl !== 'string' || avatarUrl.length === 0) {
        return null;
    }

    return { avatarUrl };
}

function isChatSearchUrl(input) {
    try {
        const rawUrl = input instanceof Request ? input.url : String(input);
        const url = new URL(rawUrl, location.origin);
        return url.origin === location.origin && url.pathname === '/api/chats/search';
    } catch {
        return false;
    }
}

async function readJsonRequestBody(input, init) {
    const initBody = init?.body;

    if (typeof initBody === 'string') {
        return tryParseJson(initBody);
    }

    if (input instanceof Request) {
        try {
            return await input.clone().json().catch(() => null);
        } catch {
            return null;
        }
    }

    return null;
}

async function fetchFastCharacterChatList(fetchFn, { avatarUrl }) {
    const response = await fetchFn('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatarUrl, simple: true }),
    });

    if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
    }

    const chats = await response.json();
    const searchResults = Array.isArray(chats) ? chats.map(toPlaceholderChatSearchResult).filter(Boolean) : [];
    searchResults.sort((a, b) => getTimestampValue(b.last_mes) - getTimestampValue(a.last_mes));
    const requestId = ++fastChatListRequestId;

    setTimeout(() => {
        markFastChatRowsAsLoading(searchResults, requestId);
        void hydrateFastCharacterChatList(fetchFn, avatarUrl, requestId);
    }, 0);

    return new Response(JSON.stringify(searchResults), {
        status: 200,
        headers: {
            'Content-Type': 'application/json',
        },
    });
}

async function hydrateFastCharacterChatList(fetchFn, avatarUrl, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    try {
        const chats = await fetchFullCharacterChatList(fetchFn, avatarUrl);
        applyHydratedChatRows(chats, requestId);
    } catch (error) {
        console.debug(`${LOG_PREFIX} Failed to hydrate full chat list metadata`, error);
    }
}

async function fetchFullCharacterChatList(fetchFn, avatarUrl) {
    const response = await fetchFn('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: avatarUrl }),
    });

    if (!response.ok) {
        throw new Error(`Unexpected status ${response.status}`);
    }

    const chats = await response.json();
    return Array.isArray(chats) ? chats.map(toChatSearchResult).filter(Boolean) : [];
}

function markFastChatRowsAsLoading(chats, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    for (const chat of chats) {
        const row = findChatListRow(chat.file_name);

        if (!row.length) {
            continue;
        }

        row.find('.chat_file_size').text('(...,');
        row.find('.chat_messages_num').text('... 💬)');
    }
}

function applyHydratedChatRow(chat, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    const row = findChatListRow(chat.file_name);

    if (!row.length) {
        return;
    }

    row.find('.chat_file_size').text(`(${chat.file_size},`);
    row.find('.chat_messages_num').text(`${chat.message_count} 💬)`);
    row.find('.select_chat_block_mes').text(chat.preview_message);
    row.find('.chat_messages_date').text(timestampToMoment(chat.last_mes).format('lll'));
}

function applyHydratedChatRows(chats, requestId) {
    if (!isCurrentFastChatListRequest(requestId)) {
        return;
    }

    const order = new Map();

    chats.forEach((chat, index) => {
        applyHydratedChatRow(chat, requestId);
        order.set(chat.file_name, {
            index,
            time: getTimestampValue(chat.last_mes),
        });
    });

    sortHydratedChatRows(order);
}

function sortHydratedChatRows(order) {
    const container = $('#select_chat_div');
    const rows = container.children('.select_chat_block_wrapper').get();

    rows.sort((left, right) => {
        const leftName = $(left).find('.select_chat_block').attr('file_name');
        const rightName = $(right).find('.select_chat_block').attr('file_name');
        const leftOrder = order.get(leftName) ?? { time: 0, index: Number.MAX_SAFE_INTEGER };
        const rightOrder = order.get(rightName) ?? { time: 0, index: Number.MAX_SAFE_INTEGER };

        return rightOrder.time - leftOrder.time || leftOrder.index - rightOrder.index;
    });

    container.append(rows);
}

function findChatListRow(fileName) {
    return $('#select_chat_div .select_chat_block')
        .filter((_, element) => $(element).attr('file_name') === fileName)
        .closest('.select_chat_block_wrapper');
}

function isCurrentFastChatListRequest(requestId) {
    return requestId === fastChatListRequestId && String($('#select_chat_search').val() ?? '').trim().length === 0;
}

function toPlaceholderChatSearchResult(chat) {
    if (!chat || typeof chat !== 'object') {
        return null;
    }

    const fileName = getChatSearchFileName(chat);

    if (!fileName) {
        return null;
    }

    return {
        file_name: fileName,
        file_size: '...',
        message_count: '...',
        last_mes: guessLastMesFromFileName(fileName),
        preview_message: '',
    };
}

function toChatSearchResult(chat) {
    if (!chat || typeof chat !== 'object') {
        return null;
    }

    const fileName = getChatSearchFileName(chat);

    if (!fileName) {
        return null;
    }

    const messageCount = Number(chat.chat_items);

    return {
        file_name: fileName,
        file_size: chat.file_size ?? '',
        message_count: Number.isFinite(messageCount) ? messageCount : 0,
        last_mes: normalizeLastMes(chat.last_mes),
        preview_message: getPreviewMessage(chat.mes),
    };
}

function getChatSearchFileName(chat) {
    const value = typeof chat.file_id === 'string' && chat.file_id
        ? chat.file_id
        : chat.file_name;

    if (typeof value !== 'string') {
        return '';
    }

    return value.replace(/\.jsonl$/i, '');
}

function guessLastMesFromFileName(fileName) {
    const text = String(fileName).replace(/\.jsonl$/i, '');
    const match = text.match(/(\d{4})-(\d{1,2})-(\d{1,2})(?:\s*@|@|\s+)?(\d{1,2})h\s*(\d{1,2})m(?:\s*(\d{1,2})s)?(?:\s*(\d{1,3})ms)?/i);

    if (match) {
        const [, year, month, day, hour, minute, second = '0', millisecond = '0'] = match;
        const date = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hour),
            Number(minute),
            Number(second),
            Number(millisecond),
        );

        if (!Number.isNaN(date.getTime())) {
            return date.toISOString();
        }
    }

    return new Date().toISOString();
}

function normalizeLastMes(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return new Date(value).toISOString();
    }

    return value;
}

function getTimestampValue(value) {
    const timestamp = timestampToMoment(value).valueOf();
    return Number.isFinite(timestamp) ? timestamp : 0;
}

function getPreviewMessage(message) {
    const strlen = 400;

    if (typeof message !== 'string' || message === '[The chat is empty]' || message === '[The message is empty]') {
        return '';
    }

    return message.length > strlen
        ? '...' + message.substring(message.length - strlen)
        : message;
}

function tryParseJson(value) {
    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function initializeMessageCompletionSoundControls(persistSettings) {
    populateMessageCompletionSoundBuiltinOptions();
    normalizeMessageCompletionSoundSettings();
    updateMessageCompletionSoundControls();
    refreshMessageCompletionSoundLocalFileLabel();

    $('#bai_bai_toolkit_message_completion_sound_enabled')
        .prop('checked', settings.messageCompletionSoundEnabled)
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundEnabled = Boolean($(this).prop('checked'));
            persistSettings?.();
            applyMessageCompletionSound();
        });

    $('#bai_bai_toolkit_message_completion_sound_source')
        .val(getMessageCompletionSoundSource())
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', function () {
            const nextSource = String($(this).val() || 'builtin');
            settings.messageCompletionSoundSource = MESSAGE_COMPLETION_SOUND_SOURCES.has(nextSource)
                ? nextSource
                : 'builtin';
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
            updateMessageCompletionSoundControls();
            refreshMessageCompletionSoundLocalFileLabel();
        });

    $('#bai_bai_toolkit_message_completion_sound_builtin_id')
        .val(getMessageCompletionSoundBuiltin().id)
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundBuiltinId = String($(this).val() || BUILTIN_COMPLETION_SOUNDS[0].id);
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
        });

    $('#bai_bai_toolkit_message_completion_sound_url')
        .val(settings.messageCompletionSoundUrl || '')
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundUrl = String($(this).val() || '').trim();
            resetMessageCompletionSoundAudio();
            persistSettings?.();
            setMessageCompletionSoundStatus('');
        });

    $('#bai_bai_toolkit_message_completion_sound_volume')
        .val(String(clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume)))
        .off('input.baiBaiToolkitMessageSound')
        .on('input.baiBaiToolkitMessageSound', function () {
            settings.messageCompletionSoundVolume = clampMessageCompletionSoundVolume($(this).val());
            updateMessageCompletionSoundVolumeLabel();
            const audio = getMessageCompletionSoundState().audio;
            if (audio instanceof HTMLAudioElement) {
                audio.volume = settings.messageCompletionSoundVolume;
            }
            persistSettings?.();
        });

    $('#bai_bai_toolkit_message_completion_sound_preview')
        .off('click.baiBaiToolkitMessageSound')
        .on('click.baiBaiToolkitMessageSound', async function () {
            const button = $(this);
            if (button.hasClass('disabled')) {
                return;
            }

            button.addClass('disabled');
            setMessageCompletionSoundStatus('正在试听...');
            try {
                await playSelectedMessageCompletionSound({ preview: true });
                setMessageCompletionSoundStatus('已播放当前提示音。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to preview message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '提示音播放失败。', true);
            } finally {
                button.removeClass('disabled');
            }
        });

    $('#bai_bai_toolkit_message_completion_sound_local_file')
        .off('change.baiBaiToolkitMessageSound')
        .on('change.baiBaiToolkitMessageSound', async function () {
            const input = $(this);
            const file = this.files?.[0];
            input.val('');

            if (!file) {
                return;
            }

            try {
                setMessageCompletionSoundStatus('正在保存到本机...');
                const record = await saveMessageCompletionSoundLocalFile(file);
                settings.messageCompletionSoundSource = 'local';
                settings.messageCompletionSoundLocalFileName = record.name;
                resetMessageCompletionSoundAudio();
                persistSettings?.();
                updateMessageCompletionSoundControls();
                await refreshMessageCompletionSoundLocalFileLabel();
                setMessageCompletionSoundStatus('已保存到本机。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save local message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '本地音频保存失败。', true);
            }
        });

    $('#bai_bai_toolkit_message_completion_sound_local_clear')
        .off('click.baiBaiToolkitMessageSound')
        .on('click.baiBaiToolkitMessageSound', async function () {
            const button = $(this);
            if (button.hasClass('disabled')) {
                return;
            }

            button.addClass('disabled');
            try {
                await deleteMessageCompletionSoundLocalFile();
                settings.messageCompletionSoundLocalFileName = '';
                resetMessageCompletionSoundAudio();
                persistSettings?.();
                await refreshMessageCompletionSoundLocalFileLabel();
                setMessageCompletionSoundStatus('已清除本机提示音。');
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to delete local message completion sound`, error);
                setMessageCompletionSoundStatus(error?.message || '本地音频清除失败。', true);
            } finally {
                button.removeClass('disabled');
            }
        });
}

function normalizeMessageCompletionSoundSettings() {
    if (!MESSAGE_COMPLETION_SOUND_SOURCES.has(settings.messageCompletionSoundSource)) {
        settings.messageCompletionSoundSource = 'builtin';
    }

    settings.messageCompletionSoundBuiltinId = getMessageCompletionSoundBuiltin().id;
    settings.messageCompletionSoundVolume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);
    settings.messageCompletionSoundUrl = typeof settings.messageCompletionSoundUrl === 'string'
        ? settings.messageCompletionSoundUrl.trim()
        : '';
    settings.messageCompletionSoundLocalFileName = typeof settings.messageCompletionSoundLocalFileName === 'string'
        ? settings.messageCompletionSoundLocalFileName
        : '';
}

function populateMessageCompletionSoundBuiltinOptions() {
    const select = $('#bai_bai_toolkit_message_completion_sound_builtin_id');
    if (!select.length || select.children().length) {
        return;
    }

    for (const sound of BUILTIN_COMPLETION_SOUNDS) {
        select.append($('<option></option>').val(sound.id).text(sound.label));
    }
}

function updateMessageCompletionSoundControls() {
    const source = getMessageCompletionSoundSource();
    $('#bai_bai_toolkit_message_completion_sound_enabled')
        .prop('checked', Boolean(settings.messageCompletionSoundEnabled));
    $('#bai_bai_toolkit_message_completion_sound_source').val(source);
    $('#bai_bai_toolkit_message_completion_sound_builtin_id').val(getMessageCompletionSoundBuiltin().id);
    $('#bai_bai_toolkit_message_completion_sound_url').val(settings.messageCompletionSoundUrl || '');
    $('#bai_bai_toolkit_message_completion_sound_builtin_row').toggle(source === 'builtin');
    $('#bai_bai_toolkit_message_completion_sound_url_row').toggle(source === 'url');
    $('#bai_bai_toolkit_message_completion_sound_local_row').toggle(source === 'local');
    $('#bai_bai_toolkit_message_completion_sound_volume')
        .val(String(clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume)));
    updateMessageCompletionSoundVolumeLabel();
}

function updateMessageCompletionSoundVolumeLabel() {
    const volume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);
    $('#bai_bai_toolkit_message_completion_sound_volume_value').text(`${Math.round(volume * 100)}%`);
}

function setMessageCompletionSoundStatus(message, isError = false) {
    const status = $('#bai_bai_toolkit_message_completion_sound_status');
    if (!status.length) {
        return;
    }

    status.text(message || '').css('color', isError ? 'var(--SmartThemeQuoteColor)' : '');
}

function getMessageCompletionSoundSource() {
    const source = String(settings.messageCompletionSoundSource || 'builtin');
    return MESSAGE_COMPLETION_SOUND_SOURCES.has(source) ? source : 'builtin';
}

function getMessageCompletionSoundBuiltin() {
    return BUILTIN_COMPLETION_SOUNDS.find(sound => sound.id === settings.messageCompletionSoundBuiltinId)
        || BUILTIN_COMPLETION_SOUNDS[0];
}

function clampMessageCompletionSoundVolume(value) {
    const number = Number(value);
    if (!Number.isFinite(number)) {
        return 0.8;
    }

    return Math.max(0, Math.min(1, number));
}

function getMessageCompletionSoundState() {
    if (!extensionState.messageCompletionSound || typeof extensionState.messageCompletionSound !== 'object') {
        extensionState.messageCompletionSound = {};
    }

    const state = extensionState.messageCompletionSound;
    if (!Array.isArray(state.eventHandlers)) {
        state.eventHandlers = [];
    }

    return state;
}

function applyMessageCompletionSound() {
    if (settings.messageCompletionSoundEnabled) {
        installMessageCompletionSoundHandlers();
    } else {
        removeMessageCompletionSoundHandlers();
    }
}

function installMessageCompletionSoundHandlers() {
    const state = getMessageCompletionSoundState();
    if (state.installed || typeof eventSource?.on !== 'function') {
        return;
    }

    const generationStartedHandler = () => {
        state.generationActive = true;
        state.generationStopped = false;
    };
    const generationStoppedHandler = () => {
        if (state.generationActive) {
            state.generationStopped = true;
        }
    };
    const generationEndedHandler = () => {
        const shouldPlay = state.generationActive && !state.generationStopped;
        state.generationActive = false;
        state.generationStopped = false;

        if (!shouldPlay) {
            return;
        }

        playSelectedMessageCompletionSound().catch(error => {
            console.debug(`${LOG_PREFIX} Failed to play message completion sound`, error);
        });
    };

    addMessageCompletionSoundEventHandler(event_types.GENERATION_STARTED, generationStartedHandler);
    addMessageCompletionSoundEventHandler(event_types.GENERATION_STOPPED, generationStoppedHandler);
    addMessageCompletionSoundEventHandler(event_types.GENERATION_ENDED, generationEndedHandler);
    state.installed = true;
}

function addMessageCompletionSoundEventHandler(event, handler) {
    if (!event || typeof eventSource?.on !== 'function') {
        return;
    }

    const state = getMessageCompletionSoundState();
    eventSource.on(event, handler);
    state.eventHandlers.push({ event, handler });
}

function removeMessageCompletionSoundHandlers() {
    const state = getMessageCompletionSoundState();
    for (const entry of state.eventHandlers || []) {
        eventSource.removeListener?.(entry.event, entry.handler);
    }

    state.eventHandlers = [];
    state.installed = false;
    state.generationActive = false;
    state.generationStopped = false;
    resetMessageCompletionSoundAudio();
}

async function playSelectedMessageCompletionSound({ preview = false } = {}) {
    if (!preview && !settings.messageCompletionSoundEnabled) {
        return false;
    }

    const state = getMessageCompletionSoundState();
    const now = Date.now();
    if (!preview && now - Number(state.lastPlayedAt || 0) < MESSAGE_COMPLETION_SOUND_COOLDOWN_MS) {
        return false;
    }

    const audio = getMessageCompletionSoundAudio();
    const src = await getMessageCompletionSoundPlaybackSrc();
    audio.volume = clampMessageCompletionSoundVolume(settings.messageCompletionSoundVolume);

    if (audio.src !== src) {
        audio.pause();
        audio.src = src;
        audio.load();
    } else {
        audio.pause();
    }

    audio.currentTime = 0;
    await audio.play();
    state.lastPlayedAt = now;
    return true;
}

function getMessageCompletionSoundAudio() {
    const state = getMessageCompletionSoundState();
    if (!(state.audio instanceof HTMLAudioElement)) {
        state.audio = new Audio();
        state.audio.preload = 'none';
    }

    return state.audio;
}

async function getMessageCompletionSoundPlaybackSrc() {
    const source = getMessageCompletionSoundSource();
    revokeMessageCompletionSoundObjectUrl();

    if (source === 'builtin') {
        const builtin = getMessageCompletionSoundBuiltin();
        return new URL(`./video/${builtin.file}`, import.meta.url).href;
    }

    if (source === 'url') {
        const url = String(settings.messageCompletionSoundUrl || '').trim();
        if (!url) {
            throw new Error('请先填写音频 URL。');
        }

        return url;
    }

    const record = await getMessageCompletionSoundLocalFile();
    if (!record?.blob) {
        throw new Error('本机还没有上传提示音文件。');
    }

    const state = getMessageCompletionSoundState();
    state.objectUrl = URL.createObjectURL(record.blob);
    return state.objectUrl;
}

function resetMessageCompletionSoundAudio() {
    const state = getMessageCompletionSoundState();
    if (state.audio instanceof HTMLAudioElement) {
        state.audio.pause();
        state.audio.removeAttribute('src');
        state.audio.load();
    }

    revokeMessageCompletionSoundObjectUrl();
}

function revokeMessageCompletionSoundObjectUrl() {
    const state = getMessageCompletionSoundState();
    if (state.objectUrl) {
        URL.revokeObjectURL(state.objectUrl);
        state.objectUrl = null;
    }
}

async function refreshMessageCompletionSoundLocalFileLabel() {
    const label = $('#bai_bai_toolkit_message_completion_sound_local_name');
    if (!label.length) {
        return;
    }

    try {
        const record = await getMessageCompletionSoundLocalFile();
        if (record?.name) {
            label.text(record.name);
        } else if (settings.messageCompletionSoundLocalFileName) {
            label.text(`${settings.messageCompletionSoundLocalFileName}（本机未上传）`);
        } else {
            label.text('未上传');
        }
    } catch {
        label.text('本机存储不可用');
    }
}

async function saveMessageCompletionSoundLocalFile(file) {
    if (!(file instanceof File)) {
        throw new Error('请选择一个音频文件。');
    }

    if (!file.type.startsWith('audio/') && !isMessageCompletionSoundAudioFileName(file.name)) {
        throw new Error('请选择浏览器可播放的音频文件。');
    }

    if (file.size > MESSAGE_COMPLETION_SOUND_MAX_LOCAL_BYTES) {
        throw new Error('本地提示音不能超过 5MB。');
    }

    const record = {
        key: MESSAGE_COMPLETION_SOUND_LOCAL_KEY,
        name: file.name,
        type: file.type || 'audio/mpeg',
        size: file.size,
        updatedAt: Date.now(),
        blob: file,
    };
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readwrite');
    const done = idbTransactionDone(transaction);
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    await Promise.all([idbRequest(store.put(record)), done]);
    return record;
}

async function getMessageCompletionSoundLocalFile() {
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readonly');
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    return await idbRequest(store.get(MESSAGE_COMPLETION_SOUND_LOCAL_KEY));
}

async function deleteMessageCompletionSoundLocalFile() {
    const db = await getMessageCompletionSoundDb();
    const transaction = db.transaction(MESSAGE_COMPLETION_SOUND_STORE, 'readwrite');
    const done = idbTransactionDone(transaction);
    const store = transaction.objectStore(MESSAGE_COMPLETION_SOUND_STORE);
    await Promise.all([idbRequest(store.delete(MESSAGE_COMPLETION_SOUND_LOCAL_KEY)), done]);
}

function getMessageCompletionSoundDb() {
    const state = getMessageCompletionSoundState();
    if (!state.dbPromise) {
        state.dbPromise = openMessageCompletionSoundDb();
    }

    return state.dbPromise;
}

function isMessageCompletionSoundAudioFileName(fileName) {
    return /\.(mp3|wav|ogg|m4a|aac|flac|webm)$/i.test(String(fileName || ''));
}

function openMessageCompletionSoundDb() {
    return new Promise((resolve, reject) => {
        if (typeof indexedDB === 'undefined') {
            reject(new Error('当前浏览器不支持 IndexedDB。'));
            return;
        }

        const request = indexedDB.open(MESSAGE_COMPLETION_SOUND_DB_NAME, MESSAGE_COMPLETION_SOUND_DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(MESSAGE_COMPLETION_SOUND_STORE)) {
                db.createObjectStore(MESSAGE_COMPLETION_SOUND_STORE, { keyPath: 'key' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB 打开失败。'));
        request.onblocked = () => reject(new Error('IndexedDB 正被其他页面占用。'));
    });
}

function idbRequest(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error('IndexedDB 请求失败。'));
    });
}

function idbTransactionDone(transaction) {
    return new Promise((resolve, reject) => {
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error || new Error('IndexedDB 事务失败。'));
        transaction.onabort = () => reject(transaction.error || new Error('IndexedDB 事务已取消。'));
    });
}

function applyMessageTripleClickEdit() {
    const chatElement = document.getElementById('chat');
    if (!chatElement) return;

    chatElement.removeEventListener('click', handleMessageTripleClickEdit);

    if (settings.messageDoubleClickEditEnabled || settings.messageTripleClickEditEnabled) {
        chatElement.addEventListener('click', handleMessageTripleClickEdit);
    }
}

function handleMessageTripleClickEdit(e) {
    if (!isMessageClickEditTrigger(e) || !(e.target instanceof Element)) {
        return;
    }

    const mesText = e.target.closest('.mes_text');
    if (!(mesText instanceof HTMLElement)) {
        return;
    }

    const mes = mesText.closest('.mes[mesid]');
    if (!(mes instanceof HTMLElement)) {
        return;
    }

    const editBtn = mes.querySelector('.mes_button.mes_edit');
    if (!(editBtn instanceof HTMLElement)) {
        return;
    }

    const caretOffset = getMessageTripleClickRawCaretOffset(e, mes, mesText);
    editBtn.click();

    if (Number.isInteger(caretOffset)) {
        scheduleMessageTripleClickEditorCaret(mes, caretOffset);
    }

    // Clear text selection created by repeated clicking.
    const selection = window.getSelection();
    if (selection) {
        selection.removeAllRanges();
    }
}

function isMessageClickEditTrigger(event) {
    return Boolean(
        (settings.messageDoubleClickEditEnabled && event.detail === 2)
        || (settings.messageTripleClickEditEnabled && event.detail === 3),
    );
}

function getMessageTripleClickRawCaretOffset(event, mes, mesText) {
    const messageId = Number(mes.getAttribute('mesid'));
    const rawText = Number.isInteger(messageId) && messageId >= 0
        ? scriptModule.chat?.[messageId]?.mes
        : null;

    if (typeof rawText !== 'string' || rawText.length === 0) {
        return null;
    }

    const pointer = getMessageTripleClickPointer(event);
    if (!pointer) {
        return null;
    }

    const caretRange = getCaretRangeFromPoint(pointer.clientX, pointer.clientY);
    if (!caretRange || !isRangeInsideElement(caretRange, mesText)) {
        return null;
    }

    const renderedText = mesText.textContent || '';
    if (!renderedText) {
        return null;
    }

    const renderedOffset = getRangeTextOffset(mesText, caretRange);
    if (!Number.isInteger(renderedOffset)) {
        return null;
    }

    const clickedTextInfo = getCaretTextNodeInfo(caretRange);
    return mapRenderedMessageOffsetToRawOffset(rawText, renderedText, renderedOffset, clickedTextInfo)
        ?? estimateRawCaretOffsetByRenderedRatio(rawText, renderedText, renderedOffset);
}

function getMessageTripleClickPointer(event) {
    const touch = event.changedTouches?.[0] || event.touches?.[0];
    if (touch && Number.isFinite(touch.clientX) && Number.isFinite(touch.clientY)) {
        return touch;
    }

    if (Number.isFinite(event.clientX) && Number.isFinite(event.clientY)) {
        return event;
    }

    return null;
}

function getCaretRangeFromPoint(clientX, clientY) {
    if (typeof document.caretRangeFromPoint === 'function') {
        return document.caretRangeFromPoint(clientX, clientY);
    }

    if (typeof document.caretPositionFromPoint === 'function') {
        const position = document.caretPositionFromPoint(clientX, clientY);
        if (position) {
            const range = document.createRange();
            range.setStart(position.offsetNode, position.offset);
            range.setEnd(position.offsetNode, position.offset);
            return range;
        }
    }

    return null;
}

function isRangeInsideElement(range, element) {
    const container = range.startContainer;
    return container === element || element.contains(container);
}

function getRangeTextOffset(container, range) {
    try {
        const prefixRange = document.createRange();
        prefixRange.selectNodeContents(container);
        prefixRange.setEnd(range.startContainer, range.startOffset);
        return prefixRange.toString().length;
    } catch {
        return null;
    }
}

function getCaretTextNodeInfo(range) {
    if (range.startContainer?.nodeType !== Node.TEXT_NODE) {
        return null;
    }

    return {
        text: range.startContainer.textContent || '',
        offset: Math.max(0, Math.min(range.startOffset, (range.startContainer.textContent || '').length)),
    };
}

function mapRenderedMessageOffsetToRawOffset(rawText, renderedText, renderedOffset, clickedTextInfo = null) {
    const rawProjection = buildRawMessageTextProjection(rawText);
    const rawComparable = buildComparableTextIndex(rawProjection.text, rawProjection.offsets);
    const renderedComparable = buildComparableTextIndex(renderedText);
    const renderedComparableOffset = getComparableOffsetBeforeSourceOffset(renderedComparable, renderedOffset);

    if (!rawComparable.text || !renderedComparable.text) {
        return null;
    }

    if (rawComparable.text === renderedComparable.text) {
        return getRawOffsetForComparableOffset(rawComparable, rawText, renderedComparableOffset);
    }

    const contextOffset = findRawOffsetByComparableContext(
        rawComparable,
        rawText,
        renderedComparable,
        renderedComparableOffset,
    );

    if (Number.isInteger(contextOffset)) {
        return contextOffset;
    }

    const clickedTextOffset = findRawOffsetByClickedText(
        rawComparable,
        rawText,
        clickedTextInfo,
        renderedComparable,
        renderedComparableOffset,
    );

    if (Number.isInteger(clickedTextOffset)) {
        return clickedTextOffset;
    }

    return null;
}

function estimateRawCaretOffsetByRenderedRatio(rawText, renderedText, renderedOffset) {
    if (!renderedText.length) {
        return null;
    }

    return Math.max(0, Math.min(rawText.length, Math.round(rawText.length * renderedOffset / renderedText.length)));
}

function buildRawMessageTextProjection(rawText) {
    const text = [];
    const offsets = [];
    let index = 0;
    let atLineStart = true;

    while (index < rawText.length) {
        if (atLineStart) {
            const fenceEnd = getMarkdownFenceLineEnd(rawText, index);
            if (Number.isInteger(fenceEnd)) {
                index = fenceEnd;
                atLineStart = true;
                continue;
            }

            const skippedIndex = skipMarkdownLinePrefix(rawText, index);
            if (skippedIndex > index) {
                index = skippedIndex;
                atLineStart = false;
                continue;
            }
        }

        const char = rawText[index];
        const nextChar = rawText[index + 1];

        if (char === '\n') {
            appendProjectedChar(text, offsets, char, index);
            index += 1;
            atLineStart = true;
            continue;
        }

        if (rawText.startsWith('<!--', index)) {
            const commentEnd = rawText.indexOf('-->', index + 4);
            index = commentEnd === -1 ? rawText.length : commentEnd + 3;
            atLineStart = false;
            continue;
        }

        if (char === '<') {
            const tagEnd = rawText.indexOf('>', index + 1);
            const tagText = tagEnd !== -1 ? rawText.slice(index, tagEnd + 1) : '';
            if (tagEnd !== -1 && isProjectedHtmlTag(tagText)) {
                if (/^<\s*br\b/i.test(tagText)) {
                    appendProjectedChar(text, offsets, '\n', index);
                }
                index = tagEnd + 1;
                atLineStart = false;
                continue;
            }
        }

        const entity = decodeHtmlEntityAt(rawText, index);
        if (entity) {
            appendProjectedChar(text, offsets, entity.text, index);
            index += entity.length;
            atLineStart = false;
            continue;
        }

        if (char === '!' && nextChar === '[') {
            const imageEnd = findMarkdownLinkEnd(rawText, index + 1);
            if (Number.isInteger(imageEnd)) {
                index = imageEnd;
                atLineStart = false;
                continue;
            }
        }

        if (char === '[') {
            const link = getMarkdownLinkParts(rawText, index);
            if (link) {
                appendProjectedRawRange(text, offsets, rawText, link.textStart, link.textEnd);
                index = link.end;
                atLineStart = false;
                continue;
            }
        }

        appendProjectedChar(text, offsets, char, index);
        index += 1;
        atLineStart = false;
    }

    return { text: text.join(''), offsets };
}

function appendProjectedRawRange(text, offsets, rawText, start, end) {
    for (let index = start; index < end; index++) {
        appendProjectedChar(text, offsets, rawText[index], index);
    }
}

function appendProjectedChar(text, offsets, char, rawOffset) {
    text.push(char);
    offsets.push(rawOffset);
}

function getMarkdownFenceLineEnd(rawText, index) {
    const lineEnd = getLineEnd(rawText, index);
    const line = rawText.slice(index, lineEnd);

    if (!/^[ \t]{0,3}(```+|~~~+)/.test(line)) {
        return null;
    }

    return lineEnd < rawText.length ? lineEnd + 1 : lineEnd;
}

function skipMarkdownLinePrefix(rawText, index) {
    const lineEnd = getLineEnd(rawText, index);
    const line = rawText.slice(index, lineEnd);
    let offset = 0;

    const quoteMatch = line.match(/^(?:[ \t]{0,3}>\s*)+/);
    if (quoteMatch) {
        offset += quoteMatch[0].length;
    }

    const rest = line.slice(offset);
    const headingMatch = rest.match(/^[ \t]{0,3}#{1,6}[ \t]+/);
    if (headingMatch) {
        return index + offset + headingMatch[0].length;
    }

    const listMatch = rest.match(/^[ \t]{0,3}(?:[-+*]|\d{1,9}[.)])[ \t]+(?:\[[ xX]\][ \t]+)?/);
    if (listMatch) {
        return index + offset + listMatch[0].length;
    }

    return index + offset;
}

function getLineEnd(text, index) {
    const lineEnd = text.indexOf('\n', index);
    return lineEnd === -1 ? text.length : lineEnd;
}

function decodeHtmlEntityAt(text, index) {
    const namedEntities = {
        amp: '&',
        apos: "'",
        gt: '>',
        lt: '<',
        nbsp: ' ',
        quot: '"',
    };

    const match = text.slice(index, index + 16).match(/^&(#x[\da-f]+|#\d+|[a-z]+);/i);
    if (!match) {
        return null;
    }

    const token = match[1];
    let decoded = namedEntities[token.toLowerCase()];

    if (!decoded && token[0] === '#') {
        const codePoint = token[1]?.toLowerCase() === 'x'
            ? Number.parseInt(token.slice(2), 16)
            : Number.parseInt(token.slice(1), 10);
        if (Number.isFinite(codePoint)) {
            try {
                decoded = String.fromCodePoint(codePoint);
            } catch {
                decoded = null;
            }
        }
    }

    return decoded ? { text: decoded, length: match[0].length } : null;
}

function isProjectedHtmlTag(text) {
    return /^<\/?[a-z][\w:-]*(?:\s[^>]*)?\/?>$/i.test(text);
}

function getMarkdownLinkParts(rawText, index) {
    const textEnd = findUnescapedChar(rawText, ']', index + 1);
    if (textEnd === -1 || rawText[textEnd + 1] !== '(') {
        return null;
    }

    const linkEnd = findMarkdownLinkDestinationEnd(rawText, textEnd + 2);
    if (linkEnd === -1) {
        return null;
    }

    return {
        textStart: index + 1,
        textEnd,
        end: linkEnd + 1,
    };
}

function findMarkdownLinkEnd(rawText, index) {
    const parts = getMarkdownLinkParts(rawText, index);
    return parts ? parts.end : null;
}

function findMarkdownLinkDestinationEnd(rawText, index) {
    let depth = 0;

    for (let cursor = index; cursor < rawText.length; cursor++) {
        if (rawText[cursor] === '\\') {
            cursor += 1;
            continue;
        }

        if (rawText[cursor] === '(') {
            depth += 1;
            continue;
        }

        if (rawText[cursor] === ')') {
            if (depth === 0) {
                return cursor;
            }
            depth -= 1;
        }
    }

    return -1;
}

function findUnescapedChar(text, char, index) {
    for (let cursor = index; cursor < text.length; cursor++) {
        if (text[cursor] === '\\') {
            cursor += 1;
            continue;
        }

        if (text[cursor] === char) {
            return cursor;
        }
    }

    return -1;
}

function buildComparableTextIndex(text, rawOffsets = null) {
    const comparable = [];
    const comparableToRaw = [];
    const sourceToComparable = new Array(text.length + 1);

    for (let index = 0; index < text.length; index++) {
        sourceToComparable[index] = comparable.length;

        if (!isComparableMessageChar(text[index])) {
            continue;
        }

        comparable.push(normalizeComparableMessageChar(text[index]));
        comparableToRaw.push(rawOffsets?.[index] ?? index);
    }

    sourceToComparable[text.length] = comparable.length;

    return {
        text: comparable.join(''),
        comparableToRaw,
        sourceToComparable,
    };
}

function isComparableMessageChar(char) {
    return !/[\s`*_~]/.test(char);
}

function normalizeComparableMessageChar(char) {
    return char;
}

function getComparableOffsetBeforeSourceOffset(index, sourceOffset) {
    const clampedOffset = Math.max(0, Math.min(sourceOffset, index.sourceToComparable.length - 1));
    return index.sourceToComparable[clampedOffset] ?? 0;
}

function getRawOffsetForComparableOffset(rawComparable, rawText, comparableOffset) {
    if (comparableOffset <= 0) {
        return 0;
    }

    if (comparableOffset >= rawComparable.comparableToRaw.length) {
        return rawText.length;
    }

    return rawComparable.comparableToRaw[comparableOffset];
}

function findRawOffsetByComparableContext(rawComparable, rawText, renderedComparable, renderedComparableOffset) {
    for (const radius of [80, 48, 28, 16, 10]) {
        const start = Math.max(0, renderedComparableOffset - radius);
        const end = Math.min(renderedComparable.text.length, renderedComparableOffset + radius);
        const needle = renderedComparable.text.slice(start, end);

        if (needle.length < 6) {
            continue;
        }

        const matchIndex = findBestComparableOccurrence(
            rawComparable.text,
            needle,
            getExpectedComparableOffset(rawComparable, renderedComparable, renderedComparableOffset),
        );

        if (matchIndex !== -1) {
            return getRawOffsetForComparableOffset(
                rawComparable,
                rawText,
                matchIndex + (renderedComparableOffset - start),
            );
        }
    }

    return null;
}

function findRawOffsetByClickedText(rawComparable, rawText, clickedTextInfo, renderedComparable, renderedComparableOffset) {
    if (!clickedTextInfo?.text) {
        return null;
    }

    const clickedComparable = buildComparableTextIndex(clickedTextInfo.text);
    if (clickedComparable.text.length < 3) {
        return null;
    }

    const clickedComparableOffset = getComparableOffsetBeforeSourceOffset(clickedComparable, clickedTextInfo.offset);
    const matchIndex = findBestComparableOccurrence(
        rawComparable.text,
        clickedComparable.text,
        getExpectedComparableOffset(rawComparable, renderedComparable, renderedComparableOffset),
    );

    if (matchIndex === -1) {
        return null;
    }

    return getRawOffsetForComparableOffset(rawComparable, rawText, matchIndex + clickedComparableOffset);
}

function getExpectedComparableOffset(rawComparable, renderedComparable, renderedComparableOffset) {
    if (renderedComparable.text.length === 0) {
        return 0;
    }

    return Math.round(renderedComparableOffset / renderedComparable.text.length * rawComparable.text.length);
}

function findBestComparableOccurrence(haystack, needle, expectedIndex) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    let index = haystack.indexOf(needle);

    while (index !== -1) {
        const distance = Math.abs(index - expectedIndex);
        if (distance < bestDistance) {
            bestIndex = index;
            bestDistance = distance;
        }

        index = haystack.indexOf(needle, index + 1);
    }

    return bestIndex;
}

function scheduleMessageTripleClickEditorCaret(mes, rawOffset) {
    const messageId = Number(mes.getAttribute('mesid'));
    let attempts = 0;

    const tryApply = () => {
        attempts += 1;

        const editor = document.querySelector('#curEditTextarea');
        const editorMes = editor?.closest?.('.mes[mesid]');
        const editorMessageId = Number(editorMes?.getAttribute('mesid'));

        if (editor instanceof HTMLTextAreaElement && Number.isInteger(editorMessageId) && editorMessageId === messageId) {
            const initialValue = editor.value;
            applyMessageTripleClickEditorCaret(editor, rawOffset, initialValue);
            requestAnimationFrame(() => applyMessageTripleClickEditorCaret(editor, rawOffset, initialValue));
            setTimeout(() => applyMessageTripleClickEditorCaret(editor, rawOffset, initialValue), 60);
            setTimeout(() => applyMessageTripleClickEditorCaret(editor, rawOffset, initialValue), 180);
            return;
        }

        if (attempts < 20) {
            setTimeout(tryApply, 25);
        }
    };

    tryApply();
}

function applyMessageTripleClickEditorCaret(editor, rawOffset, initialValue) {
    if (!editor.isConnected || editor.value !== initialValue) {
        return;
    }

    const caretOffset = Math.max(0, Math.min(rawOffset, editor.value.length));

    try {
        editor.focus({ preventScroll: true });
    } catch {
        editor.focus();
    }

    editor.setSelectionRange(caretOffset, caretOffset);
    scrollMessageTripleClickEditorCaretIntoView(editor, caretOffset);
}

function scrollMessageTripleClickEditorCaretIntoView(editor, caretOffset) {
    if (editor.scrollHeight <= editor.clientHeight || editor.value.length === 0) {
        return;
    }

    const targetTop = Math.round(
        (editor.scrollHeight - editor.clientHeight)
        * caretOffset
        / editor.value.length,
    );

    editor.scrollTop = Math.max(0, Math.min(targetTop, editor.scrollHeight - editor.clientHeight));
}

export {
    applyChatDeleteEditFlowOptimization,
    applyFastChatListScrollOptimization,
    applyLongChatDomRenderOptimization,
    applyMessageCompletionSound,
    applyMessageTripleClickEdit,
    applyMobileAutoKeyboardSuppression,
    applyMobileMessageEditScrollGuard,
    applyWelcomeRecentChatDirectOpenOptimization,
    calculateVisibleMessageTextStats,
    getLongChatDomRenderSnapshot,
    isChatDeleteEditFlowSupported,
    isWelcomeRecentChatDirectOpenCompatibilityMode,
    observeChatManagementPopupCleanup,
    patchFastChatSearchFetch,
};
