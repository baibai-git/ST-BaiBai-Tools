import * as scriptModule from '@sillytavern/script';
import { event_types, eventSource, getCurrentChatId } from '@sillytavern/script';
import { LONG_CHAT_DOM_RENDER_BOTTOM_ANCHORED_CLASS, LONG_CHAT_DOM_RENDER_BOTTOM_ANCHOR_CLASS, LONG_CHAT_DOM_RENDER_ESTIMATE_EXTRA_PX, LONG_CHAT_DOM_RENDER_ESTIMATE_MAX_HEIGHT, LONG_CHAT_DOM_RENDER_ESTIMATE_SAFETY_MULTIPLIER, LONG_CHAT_DOM_RENDER_ESTIMATOR_ALPHA, LONG_CHAT_DOM_RENDER_ESTIMATOR_MAX_SCALE, LONG_CHAT_DOM_RENDER_FORCE_DISABLED, LONG_CHAT_DOM_RENDER_GENERATION_ANCHOR_RELEASE_MS, LONG_CHAT_DOM_RENDER_HEIGHT_VAR, LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MAX, LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_MIN, LONG_CHAT_DOM_RENDER_LATEST_MESSAGE_TOP_OFFSET_RATIO, LONG_CHAT_DOM_RENDER_MESSAGE_COUNT_THRESHOLD, LONG_CHAT_DOM_RENDER_MIN_TEXT_THRESHOLD, LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_SETTLE_MS, LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_STABLE_FRAMES, LONG_CHAT_DOM_RENDER_SCROLL_BOTTOM_TOLERANCE, LONG_CHAT_DOM_RENDER_SINGLE_MESSAGE_THRESHOLD, LONG_CHAT_DOM_RENDER_STYLE_ID, LONG_CHAT_DOM_RENDER_TEXT_THRESHOLD, LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES, LONG_CHAT_DOM_RENDER_WIDTH_BUCKET_SIZE, MOBILE_MESSAGE_EDIT_SELECTOR } from './constants.js';
import { extensionState, recordLongDomRefresh, settings } from './state.js';
import { isWelcomePageDisplayed } from './welcomeRecent.js';

function applyLongChatDomRenderOptimization() {
    if (LONG_CHAT_DOM_RENDER_FORCE_DISABLED || !settings.longChatDomRenderOptimizationEnabled) {
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
    if (!(state.messageRecords instanceof Map)) {
        state.messageRecords = new Map();
    }
    if (!(state.pendingMessageIds instanceof Set)) {
        state.pendingMessageIds = new Set();
    }
    if (!(state.tailMessageIds instanceof Set)) {
        state.tailMessageIds = new Set();
    }
    if (!(state.roleHeightEstimators instanceof Map)) {
        state.roleHeightEstimators = new Map();
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
            scheduleLongChatDomRenderRefresh({ autoScroll: true, reason: 'chat-load', mode: 'full' });
        };
        const chatMutationHandler = (reason = 'chat-update') => {
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason, mode: 'full' });
        };
        const messageRenderedHandler = (messageId) => {
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'message-rendered', mode: 'incremental', messageIds: [messageId] });
        };
        const messageUpdatedHandler = (messageId) => {
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'message-updated', mode: 'incremental', messageIds: [messageId] });
        };
        const messageDeletedHandler = () => {
            pruneLongChatDomRenderCurrentChatHeightCache();
            chatMutationHandler('message-deleted');
        };
        const generationStartedHandler = () => {
            state.generationActive = true;
            state.generationAnchorEnabled = false;
            scheduleLongChatDomRenderRefresh({ autoScroll: false, reason: 'generation-started', mode: 'incremental', messageIds: [getLongChatDomRenderLatestMessageId()] });
        };
        const generationEndedHandler = () => {
            state.generationActive = false;
            state.generationAnchorEnabled = false;
            removeLongChatDomRenderBottomAnchorIfIdle(state);
        };

        addLongChatDomRenderEventHandler(event_types.CHAT_CHANGED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.CHAT_LOADED, chatLoadHandler);
        addLongChatDomRenderEventHandler(event_types.MORE_MESSAGES_LOADED, () => chatMutationHandler('more-messages-loaded'));
        addLongChatDomRenderEventHandler(event_types.USER_MESSAGE_RENDERED, messageRenderedHandler);
        addLongChatDomRenderEventHandler(event_types.CHARACTER_MESSAGE_RENDERED, messageRenderedHandler);
        addLongChatDomRenderEventHandler(event_types.MESSAGE_UPDATED, messageUpdatedHandler);
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
    resetLongChatDomRenderIndex(state);
    clearTimeout(state.generationAnchorTimer);
    clearTimeout(state.generationAnchorReleaseTimer);
    state.generationAnchorTimer = null;
    state.generationAnchorReleaseTimer = null;

    detachLongChatDomRenderChatObservers();
    state.resizeObserver?.disconnect();
    state.resizeObserver = null;
    state.mutationObserver?.disconnect();
    state.mutationObserver = null;

    if (settings.messageCompletionScrollToMiddleEnabled === false) {
        document.getElementById(LONG_CHAT_DOM_RENDER_STYLE_ID)?.remove();
    }
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

function scheduleLongChatDomRenderRefresh({ autoScroll = false, reason = '', mode = 'full', messageIds = [] } = {}) {
    if (LONG_CHAT_DOM_RENDER_FORCE_DISABLED || !settings.longChatDomRenderOptimizationEnabled) {
        return;
    }

    const state = getLongChatDomRenderState();
    state.pendingAutoScroll = Boolean(state.pendingAutoScroll || autoScroll);
    state.pendingReason = reason || state.pendingReason || '';
    state.pendingRefreshMode = state.pendingRefreshMode === 'full' || mode !== 'incremental'
        ? 'full'
        : 'incremental';

    for (const messageId of normalizeLongChatDomRenderMessageIds(messageIds)) {
        state.pendingMessageIds.add(messageId);
    }

    if (state.pendingRefreshMode === 'incremental' && state.pendingMessageIds.size === 0) {
        state.pendingRefreshMode = 'full';
    }

    clearTimeout(state.refreshTimer);
    state.refreshTimer = setTimeout(() => {
        state.refreshTimer = null;
        const pendingReason = state.pendingReason || 'refresh';
        const pendingMode = state.pendingRefreshMode || 'full';
        const pendingMessageIds = [...state.pendingMessageIds];

        state.pendingRefreshMode = '';
        state.pendingMessageIds.clear();

        refreshLongChatDomRenderOptimization({ reason: pendingReason, mode: pendingMode, messageIds: pendingMessageIds });

        if (state.pendingAutoScroll) {
            state.pendingAutoScroll = false;
            scheduleLongChatDomRenderScrollToBottom(pendingReason);
        }
        state.pendingReason = '';
    }, 40);
}

function refreshLongChatDomRenderOptimization({ reason = '', mode = 'full', messageIds = [] } = {}) {
    if (LONG_CHAT_DOM_RENDER_FORCE_DISABLED || !settings.longChatDomRenderOptimizationEnabled) {
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

    ensureLongChatDomRenderObservers();

    const state = getLongChatDomRenderState();
    const chat = Array.isArray(scriptModule.chat) ? scriptModule.chat : [];

    if (mode === 'incremental') {
        const handled = refreshLongChatDomRenderIncremental({
            state,
            chatElement,
            chat,
            reason,
            messageIds,
        });

        if (handled) {
            return;
        }
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
        skipped: 0,
    };

    const messages = [...chatElement.querySelectorAll('.mes')].filter(element => element instanceof HTMLElement);
    rebuildLongChatDomRenderIndex(state, chatElement, messages, chat);
    const stats = getLongChatDomRenderIndexStats(state);
    const shouldOptimize = shouldOptimizeLongChatDomRender(stats, messages.length);

    refreshStats.messages = messages.length;
    refreshStats.optimized = shouldOptimize;
    chatElement.classList.toggle('bai-bai-toolkit-long-chat-render-optimized', shouldOptimize);

    const editingMessages = getLongChatDomRenderEditingMessages(chatElement);
    const uncontainedTailMessages = getLongChatDomRenderUncontainedTailMessages(messages, chat.length);
    state.tailMessageIds = getLongChatDomRenderMessageIdsFromElements(uncontainedTailMessages);
    state.optimized = shouldOptimize;
    const chatWidth = chatElement.clientWidth || window.innerWidth;
    // 先做一次性的“读”:把本轮所有可能需要测量的元素的高度集中测量,
    // 之后的循环只“写”(setProperty/classList/cleanup),不再穿插同步读,
    // 从而把逐条强制重排收敛为单次重排。
    const measuredHeights = shouldOptimize
        ? batchMeasureLongChatDomRenderHeights(messages, editingMessages)
        : new Map();
    for (const element of messages) {
        const mesId = element.getAttribute('mesid') || '';
        const record = state.messageRecords.get(mesId) || null;
        if (shouldOptimize && !uncontainedTailMessages.has(element)) {
            applyLongChatDomRenderToMessage(element, chat, refreshStats, { editingMessages, chatWidth, record, measuredHeights });
            observeLongChatDomRenderMessage(element, record, state);
        } else {
            if (shouldOptimize && uncontainedTailMessages.has(element)) {
                refreshStats.tail += 1;
            }
            cleanupLongChatDomRenderMessage(element, record);
            unobserveLongChatDomRenderMessage(element, record, state);
        }
    }
    updateLongChatDomRenderRoleHeightEstimators(state, uncontainedTailMessages, chat, chatWidth, measuredHeights);

    if (!shouldOptimize && state.generationAnchorEnabled) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
    }

    refreshStats.duration = performance.now() - startedAt;
    recordLongDomRefresh?.(refreshStats);
}

function refreshLongChatDomRenderIncremental({ state, chatElement, chat, reason = '', messageIds = [] } = {}) {
    const normalizedIds = normalizeLongChatDomRenderMessageIds(messageIds);
    if (!normalizedIds.length || !isLongChatDomRenderIndexReady(state, chatElement)) {
        return false;
    }

    const startedAt = performance.now();
    const refreshStats = {
        reason,
        duration: 0,
        messages: Number(state.messageCount || 0),
        optimized: Boolean(state.optimized),
        contained: 0,
        editing: 0,
        tail: 0,
        cached: 0,
        estimated: 0,
        measured: 0,
        skipped: 0,
    };
    const touchedMessageIds = new Set([
        ...normalizedIds,
        ...(state.tailMessageIds instanceof Set ? state.tailMessageIds : []),
    ]);

    for (const mesId of normalizedIds) {
        const element = getLongChatDomRenderMessageElement(chatElement, mesId);
        if (!(element instanceof HTMLElement)) {
            return false;
        }

        if (!syncLongChatDomRenderRecord(state, element, chat)) {
            return false;
        }
    }

    const nextTailMessageIds = getLongChatDomRenderTailMessageIdsForChat(chat.length);
    for (const mesId of nextTailMessageIds) {
        touchedMessageIds.add(mesId);
    }

    const stats = getLongChatDomRenderIndexStats(state);
    const shouldOptimize = shouldOptimizeLongChatDomRender(stats, Number(state.messageCount || 0));

    if (shouldOptimize !== Boolean(state.optimized)) {
        return false;
    }

    refreshStats.messages = Number(state.messageCount || 0);
    refreshStats.optimized = shouldOptimize;
    chatElement.classList.toggle('bai-bai-toolkit-long-chat-render-optimized', shouldOptimize);

    const editingMessages = getLongChatDomRenderEditingMessages(chatElement);
    const chatWidth = chatElement.clientWidth || window.innerWidth;
    // 同 full 模式:先集中测量,再统一写,避免读写交错触发的逐条强制重排。
    const touchedElements = [];
    for (const mesId of touchedMessageIds) {
        const element = state.messageRecords.get(mesId)?.element;
        if (element instanceof HTMLElement) {
            touchedElements.push(element);
        }
    }
    const measuredHeights = shouldOptimize
        ? batchMeasureLongChatDomRenderHeights(touchedElements, editingMessages)
        : new Map();
    for (const mesId of touchedMessageIds) {
        const record = state.messageRecords.get(mesId);
        if (!record?.element?.isConnected) {
            continue;
        }

        if (shouldOptimize && !nextTailMessageIds.has(mesId)) {
            applyLongChatDomRenderToMessage(record.element, chat, refreshStats, { editingMessages, chatWidth, record, measuredHeights });
            observeLongChatDomRenderMessage(record.element, record, state);
        } else {
            if (shouldOptimize && nextTailMessageIds.has(mesId)) {
                refreshStats.tail += 1;
            }
            cleanupLongChatDomRenderMessage(record.element, record);
            unobserveLongChatDomRenderMessage(record.element, record, state);
        }
    }
    updateLongChatDomRenderRoleHeightEstimatorsForIds(state, chatElement, nextTailMessageIds, chat, chatWidth, measuredHeights);

    state.tailMessageIds = nextTailMessageIds;

    if (!shouldOptimize && state.generationAnchorEnabled) {
        state.generationAnchorEnabled = false;
        removeLongChatDomRenderBottomAnchorIfIdle(state);
    }

    refreshStats.duration = performance.now() - startedAt;
    recordLongDomRefresh?.(refreshStats);
    return true;
}

function updateLongChatDomRenderRoleHeightEstimatorsForIds(state, chatElement, messageIds, chat, width, measuredHeights = null) {
    if (isLongChatDomRenderGenerationActive()) {
        return;
    }

    const elements = [];

    for (const mesId of messageIds || []) {
        const record = state.messageRecords?.get?.(String(mesId));
        const element = record?.element instanceof HTMLElement
            ? record.element
            : getLongChatDomRenderMessageElement(chatElement, mesId);

        if (element instanceof HTMLElement) {
            elements.push(element);
        }
    }

    updateLongChatDomRenderRoleHeightEstimators(state, elements, chat, width, measuredHeights);
}

function updateLongChatDomRenderRoleHeightEstimators(state, elements, chat, width = window.innerWidth, measuredHeights = null) {
    if (isLongChatDomRenderGenerationActive()) {
        return;
    }

    if (!state || !Array.isArray(chat)) {
        return;
    }

    const hasMeasuredHeights = measuredHeights instanceof Map;

    for (const element of elements || []) {
        if (!(element instanceof HTMLElement)
            || !element.isConnected
            || element.classList.contains('bai-bai-toolkit-long-chat-contained')) {
            continue;
        }

        const mesId = element.getAttribute('mesid') || '';
        const index = Number(mesId);
        if (!mesId || !Number.isInteger(index)) {
            continue;
        }

        const message = chat[index] || null;
        const actualHeight = hasMeasuredHeights
            ? Number(measuredHeights.get(element) || 0)
            : measureLongChatDomRenderMessageHeight(element);
        if (actualHeight < 24) {
            continue;
        }

        const textInfo = getLongChatDomRenderMessageTextInfo(message);
        const role = getLongChatDomRenderMessageRole(message);
        const fallbackHeight = estimateLongChatDomRenderFallbackMessageHeight(textInfo.chars, width, role);
        if (!Number.isFinite(fallbackHeight) || fallbackHeight <= 0) {
            continue;
        }

        const rawScale = actualHeight / fallbackHeight;
        const safeScale = Math.max(1, Math.min(LONG_CHAT_DOM_RENDER_ESTIMATOR_MAX_SCALE, rawScale));
        const key = getLongChatDomRenderRoleHeightEstimatorKey(role, width);
        const previous = state.roleHeightEstimators.get(key);
        const previousScale = Number(previous?.scale || 1);
        const scale = previous
            ? previousScale + (Math.max(0, safeScale - previousScale) * LONG_CHAT_DOM_RENDER_ESTIMATOR_ALPHA)
            : safeScale;

        state.roleHeightEstimators.set(key, {
            role,
            widthBucket: getLongChatDomRenderWidthBucket(width),
            scale,
            samples: Math.min(1000, Number(previous?.samples || 0) + 1),
            updatedAt: Date.now(),
        });

        const record = state.messageRecords?.get?.(mesId);
        if (record) {
            record.role = role;
            record.textChars = textInfo.chars;
            record.messageSignature = textInfo.signature;
            record.sampleHeight = actualHeight;
        }

        setLongChatDomRenderCachedHeight(mesId, actualHeight);
    }
}

function getLongChatDomRenderRoleHeightEstimatorKey(role, width = window.innerWidth) {
    return `${getLongChatDomRenderNormalizedRole(role)}:${getLongChatDomRenderWidthBucket(width)}`;
}

function getLongChatDomRenderRoleHeightEstimator(role, width = window.innerWidth) {
    const state = getLongChatDomRenderState();
    return state.roleHeightEstimators?.get?.(getLongChatDomRenderRoleHeightEstimatorKey(role, width)) || null;
}

function getLongChatDomRenderWidthBucket(width = window.innerWidth) {
    return Math.max(0, Math.round(Number(width || 0) / LONG_CHAT_DOM_RENDER_WIDTH_BUCKET_SIZE));
}

function getLongChatDomRenderNormalizedRole(role) {
    return role === 'user' ? 'user' : 'assistant';
}

function rebuildLongChatDomRenderIndex(state, chatElement, messages, chat) {
    const previousRecords = state.messageRecords instanceof Map ? state.messageRecords : new Map();
    const nextRecords = new Map();
    let totalTextChars = 0;
    let maxVisibleChars = 0;
    let maxVisibleMesId = 'none';

    state.indexChatId = String(getCurrentChatId?.() ?? '');
    state.indexChatElement = chatElement;

    for (const element of messages) {
        const mesId = element.getAttribute('mesid') || '';
        if (!mesId) {
            continue;
        }

        const index = Number(mesId);
        const message = Number.isInteger(index) ? chat[index] : null;
        const textInfo = getLongChatDomRenderMessageTextInfo(message);
        const role = getLongChatDomRenderMessageRole(message);
        const previous = previousRecords.get(mesId);
        const record = previous || { mesId };

        if (previous?.element instanceof HTMLElement && previous.element !== element) {
            unobserveLongChatDomRenderMessage(previous.element, previous, state);
        }

        record.mesId = mesId;
        record.element = element;
        record.textChars = textInfo.chars;
        record.messageSignature = textInfo.signature;
        record.role = role;
        nextRecords.set(mesId, record);

        totalTextChars += textInfo.chars;
        if (textInfo.chars > maxVisibleChars) {
            maxVisibleChars = textInfo.chars;
            maxVisibleMesId = mesId || 'none';
        }
    }

    for (const [mesId, record] of previousRecords.entries()) {
        if (!nextRecords.has(mesId) && record?.element instanceof HTMLElement) {
            unobserveLongChatDomRenderMessage(record.element, record, state);
        }
    }

    state.messageRecords = nextRecords;
    state.messageCount = nextRecords.size;
    state.totalTextChars = totalTextChars;
    state.maxVisibleChars = maxVisibleChars;
    state.maxVisibleMesId = maxVisibleMesId;
    state.indexReady = true;
}

function syncLongChatDomRenderRecord(state, element, chat) {
    if (!(element instanceof HTMLElement)) {
        return null;
    }

    const mesId = element.getAttribute('mesid') || '';
    const index = Number(mesId);
    if (!mesId || !Number.isInteger(index)) {
        return null;
    }

    const message = chat[index] || null;
    const textInfo = getLongChatDomRenderMessageTextInfo(message);
    const role = getLongChatDomRenderMessageRole(message);
    const records = state.messageRecords instanceof Map ? state.messageRecords : new Map();
    const previous = records.get(mesId);
    const record = previous || { mesId };

    if (previous?.element instanceof HTMLElement && previous.element !== element) {
        unobserveLongChatDomRenderMessage(previous.element, previous, state);
        record.appliedSignature = '';
    }

    if (!previous) {
        state.totalTextChars = Number(state.totalTextChars || 0) + textInfo.chars;
        updateLongChatDomRenderMaxStatsAfterRecordChange(state, mesId, 0, textInfo.chars);
    } else if (Number(previous.textChars || 0) !== textInfo.chars) {
        const previousChars = Number(previous.textChars || 0);
        state.totalTextChars = Math.max(0, Number(state.totalTextChars || 0) - previousChars + textInfo.chars);
        updateLongChatDomRenderMaxStatsAfterRecordChange(state, mesId, previousChars, textInfo.chars);
    }

    record.mesId = mesId;
    record.element = element;
    record.textChars = textInfo.chars;
    record.messageSignature = textInfo.signature;
    record.role = role;
    records.set(mesId, record);
    state.messageRecords = records;
    state.messageCount = records.size;

    return record;
}

function updateLongChatDomRenderMaxStatsAfterRecordChange(state, mesId, previousChars, nextChars) {
    if (String(state.maxVisibleMesId || '') === String(mesId)) {
        if (nextChars >= previousChars) {
            state.maxVisibleChars = nextChars;
            return;
        }
        recomputeLongChatDomRenderMaxStats(state);
        return;
    }

    if (nextChars > Number(state.maxVisibleChars || 0)) {
        state.maxVisibleChars = nextChars;
        state.maxVisibleMesId = mesId;
    }
}

function recomputeLongChatDomRenderMaxStats(state) {
    let maxVisibleChars = 0;
    let maxVisibleMesId = 'none';

    for (const record of state.messageRecords?.values?.() || []) {
        const chars = Number(record?.textChars || 0);
        if (chars > maxVisibleChars) {
            maxVisibleChars = chars;
            maxVisibleMesId = record.mesId || 'none';
        }
    }

    state.maxVisibleChars = maxVisibleChars;
    state.maxVisibleMesId = maxVisibleMesId;
}

function getLongChatDomRenderIndexStats(state) {
    return {
        visibleTextChars: Number(state.totalTextChars || 0),
        maxVisibleChars: Number(state.maxVisibleChars || 0),
        maxVisibleMesId: state.maxVisibleMesId || 'none',
    };
}

function isLongChatDomRenderIndexReady(state, chatElement) {
    return Boolean(
        state?.indexReady
        && state.indexChatElement === chatElement
        && String(state.indexChatId || '') === String(getCurrentChatId?.() ?? ''),
    );
}

function resetLongChatDomRenderIndex(state = getLongChatDomRenderState()) {
    for (const record of state.messageRecords?.values?.() || []) {
        if (record?.element instanceof HTMLElement) {
            unobserveLongChatDomRenderMessage(record.element, record, state);
        }
    }

    state.messageRecords = new Map();
    state.pendingMessageIds = new Set();
    state.tailMessageIds = new Set();
    state.pendingRefreshMode = '';
    state.messageCount = 0;
    state.totalTextChars = 0;
    state.maxVisibleChars = 0;
    state.maxVisibleMesId = 'none';
    state.indexChatId = '';
    state.indexChatElement = null;
    state.indexReady = false;
    state.optimized = false;
}

function normalizeLongChatDomRenderMessageIds(values = []) {
    const rawValues = Array.isArray(values) ? values : [values];
    const ids = [];
    const seen = new Set();

    for (const value of rawValues) {
        const rawId = value && typeof value === 'object'
            ? value.messageId ?? value.mesId ?? value.id
            : value;
        const numberId = Number(rawId);
        const id = Number.isInteger(numberId) && numberId >= 0
            ? String(numberId)
            : String(rawId ?? '').trim();

        if (!id || seen.has(id)) {
            continue;
        }

        seen.add(id);
        ids.push(id);
    }

    return ids;
}

function getLongChatDomRenderMessageElement(chatElement, mesId) {
    if (!(chatElement instanceof HTMLElement)) {
        return null;
    }

    const escapedMesId = String(mesId).replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    return chatElement.querySelector(`.mes[mesid="${escapedMesId}"]`);
}

function getLongChatDomRenderTailMessageIdsForChat(chatLength = 0) {
    const ids = new Set();
    const numericChatLength = Number(chatLength || 0);
    const tailStartIndex = Math.max(0, numericChatLength - LONG_CHAT_DOM_RENDER_UNCONTAINED_TAIL_MESSAGES);

    for (let index = tailStartIndex; index < numericChatLength; index += 1) {
        ids.add(String(index));
    }

    return ids;
}

function getLongChatDomRenderMessageIdsFromElements(elements) {
    const ids = new Set();

    for (const element of elements || []) {
        const mesId = element instanceof HTMLElement ? element.getAttribute('mesid') : '';
        if (mesId) {
            ids.add(String(mesId));
        }
    }

    return ids;
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

    const record = options.record || null;
    if (options.editingMessages?.has(element)) {
        cleanupLongChatDomRenderMessage(element, record);
        if (refreshStats) {
            refreshStats.editing += 1;
        }
        return;
    }

    const mesId = element.getAttribute('mesid') || '';
    const index = Number(mesId);
    const message = Number.isInteger(index) ? chat[index] : null;
    const role = record?.role || getLongChatDomRenderMessageRole(message);
    const chars = Number(record?.textChars ?? getLongChatMessageTextLength(message));
    const applySignature = getLongChatDomRenderApplySignature(record, chars, options.chatWidth, role);
    const appliedHeight = element.style.getPropertyValue(LONG_CHAT_DOM_RENDER_HEIGHT_VAR);

    if (element.classList.contains('bai-bai-toolkit-long-chat-contained') && appliedHeight) {
        if (record) {
            record.appliedSignature = applySignature;
            record.contained = true;
            record.role = role;
        }
        if (refreshStats) {
            refreshStats.skipped += 1;
        }
        return;
    }

    if (
        record
        && record.appliedSignature === applySignature
        && record.contained === true
        && element.classList.contains('bai-bai-toolkit-long-chat-contained')
        && appliedHeight
    ) {
        if (refreshStats) {
            refreshStats.skipped += 1;
        }
        return;
    }

    const hasMeasuredHeights = options.measuredHeights instanceof Map;
    const measuredHeight = element.classList.contains('bai-bai-toolkit-long-chat-contained') || isLongChatDomRenderGenerationActive()
        ? 0
        : (hasMeasuredHeights
            ? Number(options.measuredHeights.get(element) || 0)
            : measureLongChatDomRenderMessageHeight(element));
    const cachedHeight = getLongChatDomRenderCachedHeight(mesId);
    const estimatedHeight = estimateLongChatDomRenderMessageHeight(chars, options.chatWidth, role);
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
    if (record) {
        record.appliedSignature = applySignature;
        record.contained = true;
        record.role = role;
    }
    if (refreshStats) {
        refreshStats.contained += 1;
    }
}

function getLongChatDomRenderApplySignature(record, chars, width = window.innerWidth, role = 'assistant') {
    const widthBucket = Math.max(0, Math.round(Number(width || 0) / LONG_CHAT_DOM_RENDER_WIDTH_BUCKET_SIZE));
    return [
        getLongChatDomRenderNormalizedRole(role || record?.role),
        record?.messageSignature || `chars:${Number(chars || 0)}`,
        `width:${widthBucket}`,
    ].join('|');
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

function estimateLongChatDomRenderMessageHeight(chars, width = window.innerWidth, role = 'assistant') {
    const fallbackHeight = estimateLongChatDomRenderFallbackMessageHeight(chars, width, role);
    const estimator = getLongChatDomRenderRoleHeightEstimator(role, width);
    const calibratedScale = Math.max(1, Number(estimator?.scale || 1));
    const estimated = (fallbackHeight * calibratedScale * LONG_CHAT_DOM_RENDER_ESTIMATE_SAFETY_MULTIPLIER)
        + LONG_CHAT_DOM_RENDER_ESTIMATE_EXTRA_PX;

    return Math.max(120, Math.min(LONG_CHAT_DOM_RENDER_ESTIMATE_MAX_HEIGHT, Math.ceil(estimated)));
}

function estimateLongChatDomRenderFallbackMessageHeight(chars, width = window.innerWidth, role = 'assistant') {
    const normalizedRole = getLongChatDomRenderNormalizedRole(role);
    const charsPerLine = getLongChatDomRenderEstimatedCharsPerLine(width);
    const lines = Math.max(1, Math.ceil(Number(chars || 0) / charsPerLine));
    const baseHeight = normalizedRole === 'user' ? 180 : 260;
    const lineHeight = normalizedRole === 'user' ? 30 : 32;
    const minHeight = normalizedRole === 'user' ? 140 : 190;
    const estimated = baseHeight + (lines * lineHeight);

    return Math.max(minHeight, estimated);
}

function getLongChatDomRenderEstimatedCharsPerLine(width = window.innerWidth) {
    return Math.max(22, Math.min(80, Math.floor((width || 720) / 16)));
}

function measureLongChatDomRenderMessageHeight(element) {
    if (!(element instanceof HTMLElement)) {
        return 0;
    }

    const rectHeight = Number(element.getBoundingClientRect?.().height || 0);
    const height = Math.max(rectHeight, Number(element.offsetHeight || 0));

    return height >= 24 ? Math.round(height) : 0;
}

// 批量测量:把所有需要 getBoundingClientRect/offsetHeight 的“读”集中在一起执行,
// 避免与后续写样式(setProperty/classList)交错触发逐条强制重排(layout thrashing)。
// 测量条件必须与 applyLongChatDomRenderToMessage 内的判断保持一致。
function batchMeasureLongChatDomRenderHeights(elements, editingMessages) {
    const measuredHeights = new Map();
    if (isLongChatDomRenderGenerationActive()) {
        return measuredHeights;
    }

    for (const element of elements || []) {
        if (!(element instanceof HTMLElement)) {
            continue;
        }
        if (editingMessages?.has?.(element)) {
            continue;
        }
        if (element.classList.contains('bai-bai-toolkit-long-chat-contained')) {
            continue;
        }
        // 只对视口附近的楼层做真实测量,离屏楼层留给 applyLongChatDomRenderToMessage 走偏大的估算占位,
        // 之后滚进视口时由 ResizeObserver -> updateLongChatDomRenderHeightCache 用真实高度校准。
        // 避免进入长聊天时全量 getBoundingClientRect/offsetHeight 导致的卡顿(成本恒定,与总楼层数无关)。
        if (!isLongChatDomRenderNearViewport(element)) {
            continue;
        }

        const height = measureLongChatDomRenderMessageHeight(element);
        if (height >= 24) {
            measuredHeights.set(element, height);
        }
    }

    return measuredHeights;
}

function updateLongChatDomRenderHeightCache(target, observedHeight) {
    if (!(target instanceof HTMLElement) || !target.classList.contains('mes')) {
        return;
    }

    if (target.style.getPropertyValue(LONG_CHAT_DOM_RENDER_HEIGHT_VAR)) {
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
    resetLongChatDomRenderIndex();
}

function cleanupLongChatDomRenderMessage(element, record = null) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    element.classList.remove('bai-bai-toolkit-long-chat-contained');
    element.style.removeProperty(LONG_CHAT_DOM_RENDER_HEIGHT_VAR);

    if (record) {
        record.appliedSignature = '';
        record.contained = false;
    }
}

function observeLongChatDomRenderMessage(element, record, state = getLongChatDomRenderState()) {
    if (!(element instanceof HTMLElement) || !state.resizeObserver) {
        return;
    }

    if (record?.observedElement === element && record?.resizeObserver === state.resizeObserver) {
        return;
    }

    state.resizeObserver.observe(element);

    if (record) {
        record.observedElement = element;
        record.resizeObserver = state.resizeObserver;
    }
}

function unobserveLongChatDomRenderMessage(element, record = null, state = getLongChatDomRenderState()) {
    const observedElement = record?.observedElement instanceof HTMLElement
        ? record.observedElement
        : element;
    const observer = record?.resizeObserver || state.resizeObserver;

    if (observedElement instanceof HTMLElement && observer) {
        observer.unobserve(observedElement);
    }

    if (record) {
        record.observedElement = null;
        record.resizeObserver = null;
    }
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
        && !LONG_CHAT_DOM_RENDER_FORCE_DISABLED
        && settings.longChatDomRenderOptimizationEnabled
        && !isWelcomePageDisplayed(chat)
        && isLongChatDomRenderOptimizedChat(chat)
        && isLongChatDomRenderAtBottom(chat);
}

function shouldScrollLongChatDomRenderToLatestMessageStartAfterGeneration(state = getLongChatDomRenderState()) {
    const chat = document.querySelector('#chat');
    return chat instanceof HTMLElement
        && !LONG_CHAT_DOM_RENDER_FORCE_DISABLED
        && settings.longChatDomRenderOptimizationEnabled
        && !isWelcomePageDisplayed(chat)
        && isLongChatDomRenderOptimizedChat(chat)
        && state.generationAnchorEnabled
        && !state.userScrolledAway;
}

function scheduleLongChatDomRenderGenerationAnchor() {
    if (LONG_CHAT_DOM_RENDER_FORCE_DISABLED || !settings.longChatDomRenderOptimizationEnabled) {
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
        || LONG_CHAT_DOM_RENDER_FORCE_DISABLED
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
        || LONG_CHAT_DOM_RENDER_FORCE_DISABLED
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
        || LONG_CHAT_DOM_RENDER_FORCE_DISABLED
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

function getLongChatDomRenderLatestMessageId() {
    const chat = document.querySelector('#chat');
    const latestMessage = getLongChatDomRenderLatestMessageElement(chat);
    return latestMessage instanceof HTMLElement ? latestMessage.getAttribute('mesid') : '';
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

function getLongChatDomRenderMessageTextInfo(message) {
    if (!message || typeof message !== 'object') {
        return { chars: 0, signature: 'empty' };
    }

    let rawText = '';
    let source = 'none';

    // Prefer translated text if available, fallback to original message
    if (typeof message.extra?.display_text === 'string' && message.extra.display_text.trim().length > 0) {
        rawText = message.extra.display_text;
        source = 'display';
    } else if (typeof message.mes === 'string') {
        rawText = message.mes;
        source = 'mes';
    }

    let length = 0;
    let processedText = '';
    if (rawText) {
        // Strip <think> and <details> blocks out of the length calculation
        // since they are usually folded/hidden and don't contribute to standard reading height
        processedText = rawText
            .replace(/<think[ing]*>[\s\S]*?<\/think[ing]*>/gi, '')
            .replace(/<details[\s\S]*?>[\s\S]*?<\/details>/gi, '');

        length += processedText.length;
    }

    // Add a fixed small length penalty if reasoning text exists (representing folded summary)
    const reasoningText = typeof message.extra?.reasoning_display_text === 'string'
        ? message.extra.reasoning_display_text
        : typeof message.extra?.reasoning === 'string'
            ? message.extra.reasoning
            : '';
    if (reasoningText) {
        length += 50;
    }

    return {
        chars: length,
        signature: [
            source,
            processedText.length,
            hashLongChatDomRenderStringSample(processedText),
            reasoningText.length,
            hashLongChatDomRenderStringSample(reasoningText),
        ].join(':'),
    };
}

function getLongChatMessageTextLength(message) {
    return getLongChatDomRenderMessageTextInfo(message).chars;
}

function hashLongChatDomRenderStringSample(value) {
    const text = String(value || '');
    if (!text) {
        return '0';
    }

    const sample = text.length <= 1024
        ? text
        : `${text.slice(0, 512)}\n${text.slice(-512)}`;
    let hash = 0x811c9dc5;

    for (let index = 0; index < sample.length; index += 1) {
        hash ^= sample.charCodeAt(index);
        hash = Math.imul(hash, 0x01000193);
    }

    return (hash >>> 0).toString(36);
}

function getLongChatDomRenderMessageRole(message) {
    return message?.is_user === true ? 'user' : 'assistant';
}

export {
    addLongChatDomRenderEventHandler,
    applyLongChatDomRenderOptimization,
    applyLongChatDomRenderOptimizationStyle,
    applyLongChatDomRenderToMessage,
    batchMeasureLongChatDomRenderHeights,
    cleanupLongChatDomRenderMessage,
    cleanupLongChatDomRenderMessages,
    clearLongChatDomRenderAutoScrollTimers,
    detachLongChatDomRenderChatObservers,
    ensureLongChatDomRenderBottomAnchor,
    ensureLongChatDomRenderInstantScroll,
    ensureLongChatDomRenderObservers,
    estimateLongChatDomRenderFallbackMessageHeight,
    estimateLongChatDomRenderMessageHeight,
    getLongChatDomRenderApplySignature,
    getLongChatDomRenderCachedHeight,
    getLongChatDomRenderCurrentChatHeightCachePrefix,
    getLongChatDomRenderEditingMessages,
    getLongChatDomRenderEstimatedCharsPerLine,
    getLongChatDomRenderHeightCacheKey,
    getLongChatDomRenderIndexStats,
    getLongChatDomRenderLatestMessageElement,
    getLongChatDomRenderLatestMessageId,
    getLongChatDomRenderLatestMessageStartScrollTop,
    getLongChatDomRenderMessageElement,
    getLongChatDomRenderMessageIdsFromElements,
    getLongChatDomRenderMessageRole,
    getLongChatDomRenderMessageTextInfo,
    getLongChatDomRenderNormalizedRole,
    getLongChatDomRenderRoleHeightEstimator,
    getLongChatDomRenderRoleHeightEstimatorKey,
    getLongChatDomRenderState,
    getLongChatDomRenderTailMessageIdsForChat,
    getLongChatDomRenderUncontainedTailMessages,
    getLongChatDomRenderWidthBucket,
    getLongChatMessageTextLength,
    handleLongChatDomRenderScroll,
    hashLongChatDomRenderStringSample,
    installLongChatDomRenderOptimization,
    isLongChatDomRenderAtBottom,
    isLongChatDomRenderGenerationActive,
    isLongChatDomRenderIndexReady,
    isLongChatDomRenderNearViewport,
    isLongChatDomRenderOptimizedChat,
    isLongChatDomRenderRelevantChildMutation,
    measureLongChatDomRenderMessageHeight,
    normalizeLongChatDomRenderMessageIds,
    observeLongChatDomRenderMessage,
    pruneLongChatDomRenderCurrentChatHeightCache,
    rebuildLongChatDomRenderIndex,
    recomputeLongChatDomRenderMaxStats,
    refreshLongChatDomRenderIncremental,
    refreshLongChatDomRenderOptimization,
    releaseLongChatDomRenderGenerationAnchor,
    removeLongChatDomRenderBottomAnchor,
    removeLongChatDomRenderBottomAnchorIfIdle,
    removeLongChatDomRenderOptimization,
    resetLongChatDomRenderIndex,
    restoreLongChatDomRenderScrollBehavior,
    scheduleLongChatDomRenderGenerationAnchor,
    scheduleLongChatDomRenderRefresh,
    scheduleLongChatDomRenderScrollToBottom,
    scheduleLongChatDomRenderScrollToLatestMessageStart,
    setLongChatDomRenderCachedHeight,
    settleLongChatDomRenderScrollToBottom,
    settleLongChatDomRenderScrollToLatestMessageStart,
    shouldOptimizeLongChatDomRender,
    shouldScrollLongChatDomRenderToLatestMessageStartAfterGeneration,
    shouldStartLongChatDomRenderGenerationAnchor,
    syncLongChatDomRenderRecord,
    unobserveLongChatDomRenderMessage,
    updateLongChatDomRenderGenerationAnchor,
    updateLongChatDomRenderHeightCache,
    updateLongChatDomRenderMaxStatsAfterRecordChange,
    updateLongChatDomRenderRoleHeightEstimators,
    updateLongChatDomRenderRoleHeightEstimatorsForIds,
};
