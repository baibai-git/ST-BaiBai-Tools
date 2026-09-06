// 生成消息失败自动重试:只接管酒馆本体 Generate() 发出的那一个消息生成请求。
//
// 判定分两层:
//   1. GENERATION_AFTER_COMMANDS 只在本体 Generate() 里触发(generateRaw 之类的
//      扩展入口不会走到),用它开一个「本体消息生成」窗口,quiet / dryRun 直接排除;
//   2. 窗口开着时记下 CHAT_COMPLETION_SETTINGS_READY / GENERATE_AFTER_DATA 交出来的
//      请求体对象引用,发请求时再 JSON.stringify 和实际 body 逐字节比对(留到发请求时
//      才序列化,顺带躲开其它监听器对同一对象的后续改写)。
//
// 插件自己直连 /api/backends/... (如 ST-BaiBai-Book)既不开窗口也没有对应的请求体,
// 走 ST 的 generateRaw 时窗口是关着的且 body.type 为 quiet,两种都会被原样放过。
//
// 柏宝库「消息后台生成」接管时,请求变成 POST save-generate、请求体是 { save, generate },
// 这里同样按 generate 段比对认领。区别只有一条:那种模式下 job 归后端所有,浏览器断线
// 后端仍会继续生成并写盘,所以只重试「拿到了错误响应」,不重试 fetch 直接失败(断线),
// 否则会多出一个 job、聊天里多一条回复。
import { event_types, eventSource } from '@sillytavern/script';
import { BAIBAOKU_SAVE_GENERATE_URL, GENERATE_RETRY_BASE_DELAY_MS, GENERATE_RETRY_BODY_TTL_MS, GENERATE_RETRY_DEFAULT_RETRIES, GENERATE_RETRY_FETCH_KEY, GENERATE_RETRY_MAX_DELAY_MS, GENERATE_RETRY_MAX_PENDING_BODIES, GENERATE_RETRY_MAX_RETRIES, GENERATE_RETRY_MESSAGE_TYPES, GENERATE_RETRY_MIN_RETRIES, GENERATE_RETRY_PATHS, GENERATE_RETRY_PERMANENT_STATUSES, GENERATE_RETRY_REASON_MAX_LENGTH, GENERATE_RETRY_WINDOW_TTL_MS, LOG_PREFIX } from './constants.js';
import { getFetchRequestMethod, getFetchRequestUrl, isFetchRequest } from './gzipHook.js';
import { extensionState, settings } from './state.js';
import { parseJsonOrNull } from './util.js';

function installGenerateRetryFetchHook() {
    const existing = globalThis[GENERATE_RETRY_FETCH_KEY];
    if (existing?.wrappedFetch) {
        existing.isEnabled = () => settings.generateRetryEnabled === true;
        if (!Array.isArray(existing.pendingBodies)) {
            existing.pendingBodies = [];
        }
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
        pendingBodies: [],
        eventHandlersInstalled: false,
        isEnabled: () => settings.generateRetryEnabled === true,
    };

    state.wrappedFetch = async function baiBaiToolkitGenerateRetryFetch(input, init) {
        const request = matchGenerateRetryRequest(state, input, init);
        if (!request) {
            return state.originalFetch(input, init);
        }

        return runGenerateRetryRequest(state, request, input, init);
    };

    state.wrappedFetch[GENERATE_RETRY_FETCH_KEY] = true;
    globalThis[GENERATE_RETRY_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    installGenerateRetryEventHandlers(state);
    console.debug(`${LOG_PREFIX} generate retry fetch hook installed`);
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

    for (const event of [event_types.GENERATION_ENDED, event_types.GENERATION_STOPPED]) {
        if (event) {
            eventSource.on(event, () => closeGenerateRetryWindow(state));
        }
    }
}

function openGenerateRetryWindow(state, type, dryRun) {
    if (!state) {
        return;
    }

    // 新一轮生成开始,上一轮没被认领的请求体一并作废。
    state.pendingBodies = [];
    state.nativeWindow = null;

    if (dryRun) {
        return;
    }

    const normalizedType = String(type || 'normal');
    if (!GENERATE_RETRY_MESSAGE_TYPES.has(normalizedType)) {
        return;
    }

    state.nativeWindow = { type: normalizedType, createdAt: Date.now() };
}

function closeGenerateRetryWindow(state) {
    if (!state) {
        return;
    }

    state.nativeWindow = null;
    state.pendingBodies = [];
}

function isGenerateRetryWindowOpen(state) {
    const activeWindow = state?.nativeWindow;
    if (!activeWindow) {
        return false;
    }

    if (Date.now() - Number(activeWindow.createdAt || 0) > GENERATE_RETRY_WINDOW_TTL_MS) {
        closeGenerateRetryWindow(state);
        return false;
    }

    return true;
}

function bindGenerateRetryRequestBody(state, body) {
    if (!body || typeof body !== 'object' || Array.isArray(body) || !isGenerateRetryWindowOpen(state)) {
        return;
    }

    if (!Array.isArray(state.pendingBodies)) {
        state.pendingBodies = [];
    }

    state.pendingBodies.push({ body, createdAt: Date.now() });
    if (state.pendingBodies.length > GENERATE_RETRY_MAX_PENDING_BODIES) {
        state.pendingBodies = state.pendingBodies.slice(-GENERATE_RETRY_MAX_PENDING_BODIES);
    }
}

function matchGenerateRetryRequest(state, input, init) {
    if (!state?.isEnabled() || !state.pendingBodies?.length) {
        return null;
    }

    const kind = getGenerateRetryRequestKind(input, init);
    if (!kind) {
        return null;
    }

    // 只重放能原样再发一次的请求体;酒馆本体和 save-generate 传的都是 init.body 里的 JSON 字符串。
    const bodyText = typeof init?.body === 'string' ? init.body : '';
    if (!bodyText || isFetchRequest(input)) {
        return null;
    }

    // save-generate 把本体请求体整段塞进 generate 字段,拆出来比对,认领标准和直连一致。
    const generateText = kind === 'save-generate'
        ? stringifyGenerateRetryBody(parseJsonOrNull(bodyText)?.generate)
        : bodyText;
    if (!generateText) {
        return null;
    }

    const body = consumeGenerateRetryNativeBody(state, generateText);
    if (!body) {
        return null;
    }

    return {
        stream: body.stream === true || body.streaming === true,
        // 后端持有 job 时断线不代表生成失败,只按错误响应重试。
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

function consumeGenerateRetryNativeBody(state, bodyText) {
    const pendingBodies = Array.isArray(state.pendingBodies) ? state.pendingBodies : [];
    const now = Date.now();
    const matched = pendingBodies.find(entry => {
        if (!entry || now - Number(entry.createdAt || 0) > GENERATE_RETRY_BODY_TTL_MS) {
            return false;
        }

        return stringifyGenerateRetryBody(entry.body) === bodyText;
    });

    if (!matched) {
        return null;
    }

    // 请求已被认领,窗口随之关闭,后续 generateRaw 之类的请求不会再落进来。
    closeGenerateRetryWindow(state);

    const bodyType = typeof matched.body.type === 'string' ? matched.body.type : '';
    if (bodyType && !GENERATE_RETRY_MESSAGE_TYPES.has(bodyType)) {
        return null;
    }

    return matched.body;
}

function stringifyGenerateRetryBody(body) {
    if (!body || typeof body !== 'object') {
        return '';
    }

    try {
        return JSON.stringify(body);
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
    console.debug(`${LOG_PREFIX} generate retry ${attempt}/${maxRetries} in ${delay}ms: ${reason}`);
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
