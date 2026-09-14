// Retry only the identified main generation; background and native fallbacks
// share this inner hook so retries never re-run background dispatch.
// Strip the local request marker here even when automatic retry is disabled.
import { event_types, eventSource } from '@sillytavern/script';
import { createGenerationRequestId, getGenerationRequestId, markGenerationRequest, stripGenerationRequestId } from './generateRequest.js';
import { BAIBAOKU_SAVE_GENERATE_URL, GENERATE_RETRY_BASE_DELAY_MS, GENERATE_RETRY_DEFAULT_RETRIES, GENERATE_RETRY_FETCH_KEY, GENERATE_RETRY_MAX_DELAY_MS, GENERATE_RETRY_MAX_RETRIES, GENERATE_RETRY_MESSAGE_TYPES, GENERATE_RETRY_MIN_RETRIES, GENERATE_RETRY_PATHS, GENERATE_RETRY_PERMANENT_STATUSES, GENERATE_RETRY_REASON_MAX_LENGTH } from './constants.js';
import { getFetchRequestMethod, getFetchRequestUrl, isFetchRequest } from './gzipHook.js';
import { extensionState, settings } from './state.js';
import { readFetchJsonBody } from './util.js';

function installGenerateRetryFetchHook() {
    const existing = globalThis[GENERATE_RETRY_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => settings.generateRetryEnabled === true;
        installGenerateRetryEventHandlers(existing);
        return existing;
    }

    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
        return null;
    }

    const state = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
        nativeWindow: null,
        eventHandlersInstalled: false,
        isEnabled: () => settings.generateRetryEnabled === true,
    };

    state.wrappedFetch = async function baiBaiToolkitGenerateRetryFetch(input, init) {
        const kind = getGenerateRetryRequestKind(input, init);
        if (!kind) return state.originalFetch(input, init);

        const payload = await readFetchJsonBody(input, init);
        const body = kind === 'save-generate' ? payload?.generate : payload;
        const request = matchGenerateRetryRequest(state, body, kind, init);
        const clean = stripGenerationRequestId(body);
        // Strip even when retry is off, an intent was cleared, or background routing
        // was declined. The correlation field is never part of the API payload.
        if (clean !== body) {
            init = { ...(init || {}), body: JSON.stringify(kind === 'save-generate' ? { ...payload, generate: clean } : clean) };
        }
        if (!request || isFetchRequest(input)) return state.originalFetch(input, init);
        return runGenerateRetryRequest(state, request, input, init);
    };

    state.wrappedFetch[GENERATE_RETRY_FETCH_KEY] = true;
    globalThis[GENERATE_RETRY_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    installGenerateRetryEventHandlers(state);
    return state;
}

function installGenerateRetryEventHandlers(state) {
    if (!state || state.eventHandlersInstalled || typeof eventSource?.on !== 'function') {
        return;
    }

    state.eventHandlersInstalled = true;

    if (event_types.GENERATION_AFTER_COMMANDS) {
        eventSource.on(event_types.GENERATION_AFTER_COMMANDS, (type, options, dryRun) => {
            openGenerateRetryWindow(state, type, dryRun);
        });
    }

    if (event_types.CHAT_COMPLETION_SETTINGS_READY) {
        eventSource.on(event_types.CHAT_COMPLETION_SETTINGS_READY, body => {
            bindGenerateRetryRequestBody(state, body);
        });
    }

    if (event_types.GENERATE_AFTER_DATA) {
        eventSource.on(event_types.GENERATE_AFTER_DATA, (body, dryRun) => {
            if (dryRun) {
                return;
            }

            bindGenerateRetryRequestBody(state, body);
        });
    }

    for (const event of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED, event_types.CHAT_CHANGED]) {
        if (event) {
            eventSource.on(event, () => closeGenerateRetryWindow(state));
        }
    }
}

function openGenerateRetryWindow(state, type, dryRun) {
    // ST's token counter also calls Generate; a dry run must not clear the live request.
    if (!state || dryRun) return;
    closeGenerateRetryWindow(state);
    const normalizedType = String(type || 'normal');
    if (!GENERATE_RETRY_MESSAGE_TYPES.has(normalizedType)) return;
    state.nativeWindow = { type: normalizedType, requestId: createGenerationRequestId(), prepared: false };
}

function closeGenerateRetryWindow(state) {
    if (state) state.nativeWindow = null;
}

function bindGenerateRetryRequestBody(state, body) {
    const active = state?.nativeWindow;
    if (!active || !body || typeof body !== 'object' || Array.isArray(body)) return;
    if (!settings.generateRetryEnabled && !settings.saveGenerateEnabled) return;
    // Raw text-completion bodies have no type. Quiet/auxiliary chat completions
    // must not acquire the active main request's identity.
    if (body.type && body.type !== active.type) return;
    markGenerationRequest(body, active.requestId);
    active.prepared = true;
}

function matchGenerateRetryRequest(state, body, kind, init) {
    const active = state?.nativeWindow;
    if (!active?.prepared || getGenerationRequestId(body) !== active.requestId) return null;
    closeGenerateRetryWindow(state);
    if (body?.type && body.type !== active.type) return null;
    if (!state.isEnabled()) return null;
    return {
        stream: body.stream === true || body.streaming === true,
        retryOnNetworkError: kind !== 'save-generate',
        signal: init?.signal instanceof AbortSignal ? init.signal : null,
    };
}

function getGenerateRetryRequestKind(input, init) {
    if (getFetchRequestMethod(input, init) !== 'POST') {
        return '';
    }

    const rawUrl = getFetchRequestUrl(input);
    if (!rawUrl) {
        return '';
    }

    try {
        const url = new URL(rawUrl, location.href);
        if (url.origin !== location.origin) {
            return '';
        }

        if (GENERATE_RETRY_PATHS.has(url.pathname)) {
            return 'native';
        }

        return url.pathname === BAIBAOKU_SAVE_GENERATE_URL ? 'save-generate' : '';
    } catch {
        return '';
    }
}

async function runGenerateRetryRequest(state, request, input, init) {
    // A blacklist chain survives native regenerate calls. Both retry reasons
    // spend its counter instead of granting every new request a fresh allowance.
    const activeRun = extensionState.generateBlacklistRetry?.run;
    const budget = activeRun?.phase === 'generating'
        ? activeRun
        : { retries: 0, maxRetries: getGenerateRetryMaxRetries() };

    while (true) {
        const isFinalAttempt = budget.retries >= budget.maxRetries;

        let response = null;
        try {
            response = await state.originalFetch(input, init);
        } catch (error) {
            if (isFinalAttempt || !request.retryOnNetworkError || isGenerateRetryAborted(request, error)) {
                throw error;
            }

            if (!await waitBeforeGenerateRetry(state, request, budget, describeGenerateRetryError(error))) {
                throw error;
            }

            continue;
        }

        if (isFinalAttempt) {
            return response;
        }

        const failure = await describeGenerateRetryFailure(request, response);
        if (!failure || isGenerateRetryAborted(request)) {
            return response;
        }

        if (!await waitBeforeGenerateRetry(state, request, budget, failure)) {
            return response;
        }

        // 这份失败响应不会再交给酒馆,主动放掉正文以便及早释放连接。
        discardGenerateRetryResponse(response);
    }
}

function discardGenerateRetryResponse(response) {
    try {
        response.body?.cancel()?.catch(() => {});
    } catch {
        // 正文可能已经被读过或已关闭,忽略即可。
    }
}

// 返回空串表示这次响应不该重试(成功,或是重发也没用的永久性错误)。
async function describeGenerateRetryFailure(request, response) {
    if (!response.ok) {
        if (GENERATE_RETRY_PERMANENT_STATUSES.has(response.status)) {
            return '';
        }

        // 不读响应体,原样留给酒馆自己解析并展示错误信息。
        return `请求失败（HTTP ${response.status}）`;
    }

    // 流式响应此时只拿到响应头,正文中途断流已经交给酒馆渲染,不能在这一层重放。
    // 只有明确声明 JSON 的响应才克隆检查,免得把 SSE 流读到底、把流式生成拖成一次性返回。
    const contentType = String(response.headers?.get?.('content-type') || '').toLowerCase();
    if (request.stream || !contentType.includes('json')) {
        return '';
    }

    // 非流式时部分中转会用 200 包一个 error 返回,克隆一份只做判断。
    const data = await response.clone().json().catch(() => null);
    if (!data?.error) {
        return '';
    }

    const message = typeof data.error === 'string' ? data.error : data.error?.message;
    return message ? `接口返回错误（${truncateGenerateRetryReason(message)}）` : '接口返回错误';
}

function describeGenerateRetryError(error) {
    if (String(error?.name || '') === 'TimeoutError') {
        return '请求超时';
    }

    return '网络请求失败';
}

function consumeGenerateRetryAttempt(budget) {
    if (budget.retries >= budget.maxRetries) {
        return false;
    }
    budget.retries += 1;
    return true;
}

async function waitBeforeGenerateRetry(state, request, budget, reason) {
    if (!state.isEnabled() || isGenerateRetryAborted(request) || budget.retries >= budget.maxRetries) {
        return false;
    }

    const attempt = budget.retries + 1;
    const maxRetries = budget.maxRetries;
    const delay = Math.min(GENERATE_RETRY_BASE_DELAY_MS * (2 ** (attempt - 1)), GENERATE_RETRY_MAX_DELAY_MS);
    globalThis.toastr?.warning(
        `${reason}，${Math.round(delay / 100) / 10} 秒后重试（第 ${attempt}/${maxRetries} 次）`,
        '生成失败自动重试',
        { timeOut: Math.max(delay, 2000) },
    );

    const aborted = await sleepBeforeGenerateRetry(request, delay);
    return !aborted && state.isEnabled() && consumeGenerateRetryAttempt(budget);
}

function sleepBeforeGenerateRetry(request, delay) {
    return new Promise(resolve => {
        const signal = request?.signal;
        if (signal?.aborted) {
            resolve(true);
            return;
        }

        let timer = null;
        const onAbort = () => {
            clearTimeout(timer);
            resolve(true);
        };

        timer = setTimeout(() => {
            signal?.removeEventListener('abort', onAbort);
            resolve(false);
        }, delay);
        signal?.addEventListener('abort', onAbort, { once: true });
    });
}

function isGenerateRetryAborted(request, error = null) {
    if (request?.signal?.aborted) {
        return true;
    }

    return String(error?.name || '') === 'AbortError';
}

function truncateGenerateRetryReason(message) {
    const text = String(message).replace(/\s+/g, ' ').trim();
    return text.length > GENERATE_RETRY_REASON_MAX_LENGTH
        ? `${text.slice(0, GENERATE_RETRY_REASON_MAX_LENGTH)}...`
        : text;
}

function clampGenerateRetryMaxRetries(value) {
    const retries = Math.trunc(Number(value));
    if (!Number.isFinite(retries)) {
        return GENERATE_RETRY_DEFAULT_RETRIES;
    }

    return Math.min(Math.max(retries, GENERATE_RETRY_MIN_RETRIES), GENERATE_RETRY_MAX_RETRIES);
}

function getGenerateRetryMaxRetries() {
    return clampGenerateRetryMaxRetries(settings.generateRetryMaxRetries);
}

function bindGenerateRetrySettings({ saveSettings } = {}) {
    const persistSettings = () => {
        if (typeof saveSettings === 'function') {
            saveSettings();
        }
    };

    settings.generateRetryMaxRetries = getGenerateRetryMaxRetries();

    $('#bai_bai_toolkit_generate_retry_enabled')
        .prop('checked', settings.generateRetryEnabled === true)
        .off('input.baiBaiToolkitGenerateRetry')
        .on('input.baiBaiToolkitGenerateRetry', function () {
            settings.generateRetryEnabled = Boolean($(this).prop('checked'));
            persistSettings();
        });

    $('#bai_bai_toolkit_generate_retry_max_retries')
        .val(String(getGenerateRetryMaxRetries()))
        .off('change.baiBaiToolkitGenerateRetry')
        .on('change.baiBaiToolkitGenerateRetry', function () {
            settings.generateRetryMaxRetries = clampGenerateRetryMaxRetries($(this).val());
            $(this).val(String(settings.generateRetryMaxRetries));
            persistSettings();
        });
}

export {
    bindGenerateRetrySettings,
    clampGenerateRetryMaxRetries,
    consumeGenerateRetryAttempt,
    getGenerateRetryMaxRetries,
    installGenerateRetryFetchHook,
};
