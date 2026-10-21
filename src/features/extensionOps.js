// 柏宝库接管酒馆的扩展安装/更新/删除后,这里给每个请求带上任务 id:慢的时候显示进度,
// 失败时给出原因和尝试过的线路(能强制更新的直接给按钮),请求断了或页面刷新了也能接着报结果。
// 响应里没有柏宝库的标记头(没装柏宝库或没开接管)就什么都不做。
import { event_types, eventSource, getRequestHeaders } from '@sillytavern/script';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '@sillytavern/scripts/popup';
import {
    BAIBAOKU_EXTENSIONS_URL,
    EXTENSION_DELETE_PATH,
    EXTENSION_INSTALL_PATH,
    EXTENSION_OPS_CODE_HEADER,
    EXTENSION_OPS_FETCH_KEY,
    EXTENSION_OPS_JOB_HEADER,
    EXTENSION_OPS_NOTICE_REPLAY_MS,
    EXTENSION_OPS_NOTICES_STORAGE_KEY,
    EXTENSION_OPS_OP_HEADER,
    EXTENSION_OPS_PENDING_STORAGE_KEY,
    EXTENSION_OPS_POLL_INTERVAL_MS,
    EXTENSION_OPS_PROGRESS_DELAY_MS,
    EXTENSION_OPS_RESUME_MAX_AGE_MS,
    EXTENSION_UPDATE_PATH,
    LOG_PREFIX,
} from './constants.js';
import { buildFetchHeaders, getFetchRequestMethod, getFetchRequestUrl } from './gzipHook.js';
import { extensionState } from './state.js';
import { hasUserInteracted } from './updateDiagnostics.js';
import { readFetchJsonBody } from './util.js';

const KIND_LABELS = {
    install: '安装',
    update: '更新',
    delete: '删除',
    version: '检查更新',
};
const OPERATION_PATHS = [
    ['install', EXTENSION_INSTALL_PATH],
    ['update', EXTENSION_UPDATE_PATH],
    ['delete', EXTENSION_DELETE_PATH],
];
const TRACKED_KINDS = new Set(OPERATION_PATHS.map(([kind]) => kind));
// 酒馆的提示只有一句话,这些错误要看尝试过的线路、冲突文件或备份位置才知道怎么办
const DETAIL_CODES = new Set([
    'NETWORK',
    'DOWNLOAD_FAILED',
    'REPO_NOT_FOUND',
    'TIMEOUT',
    'REMOTE_CHANGED',
    'BRANCH_GONE',
    'BRANCH_UNKNOWN',
    'APPLY_FAILED',
    'FILE_LOCKED',
    'INSTALL_MOVE_FAILED',
    'DELETE_FAILED',
    'INTERNAL_ERROR',
]);
const FORCEABLE_CODES = new Set(['LOCAL_CHANGES', 'DIVERGED', 'IN_PROGRESS', 'LOCKED', 'BRANCH_GONE', 'DETACHED_HEAD']);
const PROGRESS_PHASE_LABELS = {
    'Enumerating objects': '枚举对象',
    'Counting objects': '统计对象',
    'Compressing objects': '压缩对象',
    'Receiving objects': '接收数据',
    'Resolving deltas': '处理差异',
    'Updating files': '更新文件',
    'Checking out files': '检出文件',
    'Filtering content': '过滤内容',
    'Analyzing workdir': '分析工作区',
    'Updating workdir': '更新工作区',
};
const ATTEMPT_PHASE_LABELS = {
    probe: '探测',
    clone: '下载',
    fetch: '下载更新',
};
const JOB_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
// 酒馆「全部更新」会同时发出一批请求,结束后整页刷新;这一批失败时只留提示,不自动弹窗
const BATCH_WINDOW_MS = 1500;
const MAX_POLLED_JOBS = 50;
const MAX_POLL_MISSES = 8;
const POLL_ERROR_DELAY_MS = 5000;
const MAX_PROGRESS_LINES = 5;
const MAX_NOTICES = 10;
const MAX_LISTED_ITEMS = 30;
const MAX_DETAIL_CHARS = 800;

function getExtensionOpsState() {
    if (!extensionState.extensionOps || typeof extensionState.extensionOps !== 'object') {
        extensionState.extensionOps = {};
    }

    const state = extensionState.extensionOps;
    if (!(state.tracked instanceof Map)) {
        state.tracked = new Map();
    }
    if (!(state.selfReported instanceof Set)) {
        state.selfReported = new Set();
    }
    if (!Number.isInteger(state.openPopups)) {
        state.openPopups = 0;
    }

    return state;
}

function installExtensionOpsFetchHook() {
    const existing = globalThis[EXTENSION_OPS_FETCH_KEY];
    if (existing?.wrappedFetch) {
        return existing;
    }

    const originalFetch = globalThis.fetch;
    if (typeof originalFetch !== 'function') {
        return null;
    }

    const hook = {
        originalFetch: originalFetch.bind(globalThis),
        wrappedFetch: null,
    };

    hook.wrappedFetch = async function baiBaiToolkitExtensionOpsFetch(input, init) {
        const kind = getOperationKind(input, init);
        if (!kind) {
            return hook.originalFetch(input, init);
        }

        const body = await readFetchJsonBody(input, init).catch(() => null);
        const headers = buildFetchHeaders(input, init);
        const requestedId = headers.get(EXTENSION_OPS_JOB_HEADER);
        const jobId = requestedId && JOB_ID_PATTERN.test(requestedId) ? requestedId : createRandomId('bbt_');
        headers.set(EXTENSION_OPS_JOB_HEADER, jobId);
        const entry = createEntry({
            jobId,
            kind,
            extension: getRequestDisplayName(kind, body),
            requestName: body?.extensionName,
            global: body?.global,
            force: body?.force,
        });
        trackOperation(entry);

        let response;
        try {
            response = await hook.originalFetch(input, { ...init, headers });
        } catch (error) {
            // 请求断了(酒馆前端超时、网络抖动),服务器上的任务可能还在跑,改成轮询拿结果
            entry.detached = true;
            savePendingOperations();
            schedulePoll(0);
            throw error;
        }

        handleOperationResponse(entry, response);
        return response;
    };

    globalThis[EXTENSION_OPS_FETCH_KEY] = hook;
    globalThis.fetch = hook.wrappedFetch;

    // 刷新前没报完的操作接着查,没来得及看的提示补上
    restorePendingOperations();
    eventSource.once(event_types.APP_READY, () => {
        replayNotices();
        schedulePoll(0);
    });
    return hook;
}

function getOperationKind(input, init) {
    const url = getFetchRequestUrl(input);
    if (typeof url !== 'string' || !url) {
        return null;
    }

    const match = OPERATION_PATHS.find(([, path]) => url.endsWith(path));
    return match && getFetchRequestMethod(input, init) === 'POST' ? match[0] : null;
}

function getRequestDisplayName(kind, body) {
    if (kind === 'install') {
        const url = typeof body?.url === 'string' ? body.url.trim() : '';
        const name = url.split(/[?#]/)[0].replace(/\/+$/, '').split('/').pop().replace(/\.git$/i, '');
        return name || '扩展';
    }

    const name = typeof body?.extensionName === 'string' ? body.extensionName : '';
    return name.replace(/^third-party/, '').replace(/^\/+/, '') || '扩展';
}

function createEntry({ jobId, kind, extension, requestName, global, force, startedAt, selfReport, responded, seen, detached }) {
    return {
        jobId,
        kind,
        extension: String(extension || '扩展'),
        requestName: typeof requestName === 'string' ? requestName : '',
        global: Boolean(global),
        force: Boolean(force),
        startedAt: Number(startedAt) || Date.now(),
        selfReport: Boolean(selfReport),
        responded: Boolean(responded),
        seen: Boolean(seen),
        detached: Boolean(detached),
        batch: false,
        misses: 0,
        skipPoll: false,
        job: null,
    };
}

function serializeEntry(entry) {
    const { jobId, kind, extension, requestName, global, force, startedAt, selfReport, responded, seen } = entry;
    return { jobId, kind, extension, requestName, global, force, startedAt, selfReport, responded, seen };
}

function createRandomId(prefix) {
    const bytes = crypto.getRandomValues(new Uint8Array(9));
    return prefix + Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
}

function trackOperation(entry) {
    const state = getExtensionOpsState();
    // 强制更新是这里自己发的请求,酒馆不会给任何提示,结果由这里报
    entry.selfReport = state.selfReported.delete(entry.jobId);
    for (const other of state.tracked.values()) {
        if (!other.detached && Math.abs(entry.startedAt - other.startedAt) < BATCH_WINDOW_MS) {
            other.batch = true;
            entry.batch = true;
        }
    }
    state.tracked.set(entry.jobId, entry);
    savePendingOperations();
    schedulePoll(EXTENSION_OPS_PROGRESS_DELAY_MS);
}

function untrackOperation(entry) {
    const state = getExtensionOpsState();
    if (state.tracked.get(entry.jobId) !== entry) {
        return false;
    }

    state.tracked.delete(entry.jobId);
    savePendingOperations();
    renderProgress();
    return true;
}

function savePendingOperations() {
    const entries = [...getExtensionOpsState().tracked.values()].map(serializeEntry);
    writeSessionJson(EXTENSION_OPS_PENDING_STORAGE_KEY, entries.length ? entries : null);
}

function restorePendingOperations() {
    const list = readSessionJson(EXTENSION_OPS_PENDING_STORAGE_KEY);
    if (!Array.isArray(list)) {
        return;
    }

    const state = getExtensionOpsState();
    const now = Date.now();
    for (const item of list) {
        const jobId = String(item?.jobId ?? '');
        if (!JOB_ID_PATTERN.test(jobId) || !TRACKED_KINDS.has(item.kind) || state.tracked.has(jobId)) {
            continue;
        }
        if (!(now - Number(item.startedAt) < EXTENSION_OPS_RESUME_MAX_AGE_MS)) {
            continue;
        }
        state.tracked.set(jobId, createEntry({ ...item, jobId, detached: true }));
    }
    savePendingOperations();
}

function handleOperationResponse(entry, response) {
    const opHeader = response?.headers?.get(EXTENSION_OPS_OP_HEADER);
    if (!opHeader) {
        untrackOperation(entry);
        return;
    }

    entry.responded = true;
    savePendingOperations();
    const informed = !entry.selfReport;
    const outcome = {
        ok: response.ok,
        status: response.status,
        code: response.ok ? null : response.headers.get(EXTENSION_OPS_CODE_HEADER) || 'INTERNAL_ERROR',
        message: '',
        hint: null,
        opId: opHeader.startsWith('op_') ? opHeader : null,
        response: null,
    };

    // 必须在交还响应之前 clone,调用方读完 body 后就 clone 不了了
    const copy = outcome.ok && entry.kind === 'delete' ? null : response.clone();
    void (async () => {
        if (!outcome.ok) {
            outcome.message = (await copy.text().catch(() => '')).trim();
        } else if (copy) {
            outcome.response = await copy.json().catch(() => null);
        } else {
            // 删除接口照酒馆原样回一句纯文本,回收区位置和提醒要从任务结果里拿
            const jobs = await fetchJobs([entry.jobId]).catch(() => null);
            outcome.response = jobs?.[entry.jobId]?.result?.response ?? null;
        }
        await reportOutcome(entry, outcome, { informed });
    })().catch((error) => {
        console.debug(`${LOG_PREFIX} Extension operation report failed`, error);
        untrackOperation(entry);
    });
}

function canForceUpdate(entry, outcome) {
    // 502 的 BRANCH_GONE 只有镜像的结果,不能据此强制切分支
    return entry.kind === 'update'
        && !entry.force
        && FORCEABLE_CODES.has(outcome.code)
        && outcome.status !== 502;
}

function shouldReportFailure(entry, outcome, informed) {
    return !informed
        || entry.kind === 'delete'
        || DETAIL_CODES.has(outcome.code)
        || canForceUpdate(entry, outcome);
}

async function reportOutcome(entry, outcome, { informed }) {
    if (!untrackOperation(entry)) {
        return;
    }

    if (outcome.ok) {
        reportSuccess(entry, outcome, informed);
        return;
    }

    await reportFailure(entry, outcome, informed);
}

function reportSuccess(entry, outcome, informed) {
    const response = outcome.response && typeof outcome.response === 'object' ? outcome.response : {};
    const info = response.baibaoku && typeof response.baibaoku === 'object' ? response.baibaoku : response;
    const label = getExtensionOpKindLabel(entry.kind);
    const name = entry.kind === 'install'
        ? response.display_name || response.folderName || entry.extension
        : entry.extension;

    const warnings = Array.isArray(info.warnings) ? info.warnings.filter(Boolean).map(String) : [];
    if (info.staleSource && info.note) {
        warnings.push(String(info.note));
    }
    if (warnings.length) {
        showNotice(createNotice({ level: 'warning', title: `${label}「${name}」:请留意`, lines: warnings }));
    }

    // 酒馆自己会提示成功;删除后酒馆会直接刷新页面
    if (informed || entry.kind === 'delete') {
        return;
    }

    if (entry.kind === 'update' && response.isUpToDate) {
        if (!info.staleSource) {
            toastr.info('已经是最新版本,不需要更新。', `「${name}」`);
        }
        return;
    }

    const lines = [];
    if (entry.kind === 'install') {
        lines.push(`「${name}」已经在后台装好了。`);
    } else {
        const commit = shortSha(info.to || response.shortCommitHash);
        lines.push(`「${name}」已${info.forced ? '强制' : ''}更新${commit ? `到 ${commit}` : ''}。`);
        if (info.switchedTo) {
            lines.push(`已切换到远端分支 ${info.switchedTo}。`);
        }
        if (info.backupPath) {
            lines.push(`改动前的目录备份在 ${info.backupPath}(保留 7 天)。`);
        }
    }
    lines.push('点这里刷新页面生效。');
    showNotice(createNotice({ level: 'success', title: `${label}完成`, lines, reload: true }), { store: false });
}

async function reportFailure(entry, outcome, informed) {
    if (!shouldReportFailure(entry, outcome, informed)) {
        return;
    }

    const forceable = canForceUpdate(entry, outcome);
    const notice = createNotice({
        level: 'error',
        title: `「${entry.extension}」${getExtensionOpKindLabel(entry.kind)}失败`,
        message: joinMessage(outcome.message, outcome.hint),
        // 酒馆删除时不管成败都提示「已删除」,所以删除失败的原因要自己说
        informed: informed && entry.kind !== 'delete',
        lines: [forceable ? '点这里查看详情,可以强制更新。' : '点这里查看详情。'],
        detail: { entry: serializeEntry(entry), outcome: { ...outcome, response: null } },
    });

    const state = getExtensionOpsState();
    const autoOpen = (forceable || entry.selfReport)
        && !entry.detached
        && !entry.batch
        && hasUserInteracted()
        && state.openPopups === 0;
    if (!autoOpen) {
        showNotice(notice);
        return;
    }

    storeNotice(notice);
    await openFailurePopup(notice);
}

function createNotice({ level, title, message = '', informed = false, lines = [], detail = null, reload = false }) {
    return {
        id: createRandomId('notice_'),
        level,
        title,
        message,
        informed,
        lines,
        detail,
        reload,
        createdAt: Date.now(),
    };
}

/**
 * 显示提示,默认同时存进 sessionStorage:酒馆「全部更新」和删除扩展后会马上刷新页面,刷新后补显示一次。
 */
function showNotice(notice, { store = true } = {}) {
    if (store) {
        storeNotice(notice);
    }
    displayNotice(notice);
}

function displayNotice(notice, { replay = false } = {}) {
    const body = $('<div></div>');
    if (notice.message && (!notice.informed || replay)) {
        body.append($('<div></div>').text(notice.message));
    }
    for (const line of Array.isArray(notice.lines) ? notice.lines : []) {
        body.append($('<div></div>').text(String(line)));
    }

    const show = toastr[notice.level] ?? toastr.info;
    show(body, $('<span></span>').text(notice.title), {
        escapeHtml: false,
        timeOut: notice.level === 'info' ? 4000 : 15_000,
        extendedTimeOut: 10_000,
        onclick: () => {
            forgetNotice(notice.id);
            if (notice.detail) {
                void openFailurePopup(notice)
                    .catch((error) => console.debug(`${LOG_PREFIX} Extension operation details failed`, error));
            } else if (notice.reload) {
                location.reload();
            }
        },
    });
}

function replayNotices() {
    const notices = readNotices();
    if (!notices.length) {
        return;
    }

    writeNotices([]);
    for (const notice of notices) {
        displayNotice(notice, { replay: true });
    }
}

function readNotices() {
    const list = readSessionJson(EXTENSION_OPS_NOTICES_STORAGE_KEY);
    if (!Array.isArray(list)) {
        return [];
    }

    const now = Date.now();
    return list.filter(notice => typeof notice?.id === 'string'
        && typeof notice.title === 'string'
        && now - Number(notice.createdAt) < EXTENSION_OPS_NOTICE_REPLAY_MS);
}

function writeNotices(notices) {
    writeSessionJson(EXTENSION_OPS_NOTICES_STORAGE_KEY, notices.length ? notices : null);
}

function storeNotice(notice) {
    const notices = readNotices().filter(item => item.id !== notice.id);
    notices.push(notice);
    writeNotices(notices.slice(-MAX_NOTICES));
}

function forgetNotice(id) {
    const notices = readNotices();
    const remaining = notices.filter(item => item.id !== id);
    if (remaining.length !== notices.length) {
        writeNotices(remaining);
    }
}

function readSessionJson(key) {
    try {
        const raw = sessionStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function writeSessionJson(key, value) {
    try {
        if (value === null) {
            sessionStorage.removeItem(key);
        } else {
            sessionStorage.setItem(key, JSON.stringify(value));
        }
    } catch {
        // 存不下就不跨刷新补报了
    }
}

function schedulePoll(delay = EXTENSION_OPS_POLL_INTERVAL_MS) {
    const state = getExtensionOpsState();
    if (state.pollTimer || state.polling || state.pollUnsupported || !state.tracked.size) {
        return;
    }

    state.pollTimer = setTimeout(() => {
        state.pollTimer = null;
        void pollOperations();
    }, delay);
}

async function pollOperations() {
    const state = getExtensionOpsState();
    const now = Date.now();
    for (const entry of [...state.tracked.values()]) {
        if (entry.detached && now - entry.startedAt >= EXTENSION_OPS_RESUME_MAX_AGE_MS) {
            untrackOperation(entry);
        }
    }

    // 1 秒多还没回来的请求才查进度,快的操作不弹进度条
    const due = [...state.tracked.values()]
        .filter(entry => entry.detached || (!entry.skipPoll && now - entry.startedAt >= EXTENSION_OPS_PROGRESS_DELAY_MS))
        .slice(0, MAX_POLLED_JOBS);
    let nextDelay = EXTENSION_OPS_POLL_INTERVAL_MS;
    if (due.length) {
        state.polling = true;
        try {
            applyPolledJobs(due, await fetchJobs(due.map(entry => entry.jobId)));
        } catch (error) {
            if (error?.unsupported) {
                state.pollUnsupported = true;
                for (const entry of [...state.tracked.values()]) {
                    if (entry.detached) {
                        untrackOperation(entry);
                    }
                }
            } else {
                nextDelay = POLL_ERROR_DELAY_MS;
            }
        } finally {
            state.polling = false;
        }
    }

    renderProgress();
    schedulePoll(nextDelay);
}

function fetchJobs(ids) {
    return fetchExtensionManagerApi(`jobs?ids=${ids.map(encodeURIComponent).join(',')}`, { timeoutMs: 10_000 });
}

function applyPolledJobs(entries, jobs) {
    const state = getExtensionOpsState();
    let changed = false;
    for (const entry of entries) {
        if (state.tracked.get(entry.jobId) !== entry) {
            continue;
        }

        const job = jobs?.[entry.jobId];
        if (!job) {
            entry.misses += 1;
            if (entry.detached && entry.seen) {
                // 之前查得到、现在查不到:酒馆重启过,任务记录没了
                untrackOperation(entry);
                showNotice(createNotice({
                    level: 'warning',
                    title: `「${entry.extension}」${getExtensionOpKindLabel(entry.kind)}`,
                    lines: [`没能查到「${entry.extension}」的${getExtensionOpKindLabel(entry.kind)}结果(酒馆可能重启过),请到扩展列表确认。`],
                }), { store: false });
            } else if (entry.misses >= MAX_POLL_MISSES) {
                // 没接管(或任务还没建起来就结束了):在途的请求等响应就行,断掉的直接放弃
                if (entry.detached) {
                    untrackOperation(entry);
                } else {
                    entry.skipPoll = true;
                }
            }
            continue;
        }

        entry.misses = 0;
        entry.job = job;
        if (!entry.seen) {
            entry.seen = true;
            changed = true;
        }
        if (entry.detached && job.state !== 'running') {
            void reportOutcome(entry, outcomeFromJob(job), { informed: entry.responded && !entry.selfReport })
                .catch((error) => console.debug(`${LOG_PREFIX} Extension operation report failed`, error));
        }
    }

    if (changed) {
        savePendingOperations();
    }
}

function outcomeFromJob(job) {
    if (job.state === 'succeeded') {
        return {
            ok: true,
            status: 200,
            code: null,
            message: '',
            hint: null,
            opId: job.opId ?? null,
            response: job.result?.response ?? null,
        };
    }

    const error = job.error ?? {};
    return {
        ok: false,
        status: Number(error.status) || 500,
        code: error.code || 'INTERNAL_ERROR',
        message: error.message || '',
        hint: error.hint || null,
        opId: job.opId ?? null,
        response: null,
    };
}

function renderProgress() {
    const state = getExtensionOpsState();
    const running = [...state.tracked.values()].filter(entry => entry.job?.state === 'running');
    if (!running.length) {
        if (state.progressToast) {
            toastr.clear(state.progressToast, { force: true });
            state.progressToast = null;
        }
        state.progressDismissed = false;
        return;
    }
    if (state.progressDismissed) {
        return;
    }

    const body = $('<div></div>');
    for (const entry of running.slice(0, MAX_PROGRESS_LINES)) {
        body.append($('<div></div>').text(describeExtensionJob({
            ...entry.job,
            kind: entry.kind,
            extension: entry.job.extension || entry.extension,
        })));
    }
    if (running.length > MAX_PROGRESS_LINES) {
        body.append($('<div></div>').text(`还有 ${running.length - MAX_PROGRESS_LINES} 个操作在进行…`));
    }

    if (state.progressToast?.[0]?.isConnected) {
        state.progressToast.find('.toast-message').empty().append(body);
        return;
    }

    state.progressToast = toastr.info(body, '扩展操作进行中', {
        escapeHtml: false,
        timeOut: 0,
        extendedTimeOut: 0,
        onclick: () => {
            state.progressDismissed = true;
            state.progressToast = null;
        },
    });
}

function describeExtensionJob(job) {
    const parts = [`${getExtensionOpKindLabel(job?.kind)}「${job?.extension || '扩展'}」:${job?.message || '准备中'}`];
    const progress = job?.progress;
    if (progress?.phase) {
        const phase = PROGRESS_PHASE_LABELS[progress.phase] ?? progress.phase;
        parts.push(Number.isFinite(progress.percent) ? `${phase} ${progress.percent}%` : phase);
    }
    if (progress?.speed) {
        parts.push(progress.speed);
    }
    return parts.join(' · ');
}

function getExtensionOpKindLabel(kind) {
    return KIND_LABELS[kind] ?? '操作';
}

async function openFailurePopup(notice) {
    const state = getExtensionOpsState();
    const { entry, outcome } = notice.detail;
    const forceable = canForceUpdate(entry, outcome);
    let confirmed = false;
    state.openPopups += 1;
    try {
        const op = outcome.opId
            ? await fetchExtensionManagerApi(`ops/${encodeURIComponent(outcome.opId)}`, { timeoutMs: 5000 }).catch(() => null)
            : null;
        const content = renderOperationDetails({
            kind: entry.kind,
            extension: entry.extension,
            global: entry.global,
            ok: false,
            code: outcome.code,
            message: op?.message || outcome.message,
            hint: op ? op.hint : outcome.hint,
            opId: outcome.opId,
            op,
            forceable,
        });
        const result = forceable
            ? await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
                okButton: '强制更新(先备份)',
                cancelButton: '关闭',
                wide: true,
                allowVerticalScrolling: true,
            })
            : await callGenericPopup(content, POPUP_TYPE.TEXT, '', {
                okButton: '关闭',
                wide: true,
                allowVerticalScrolling: true,
            });
        confirmed = forceable && result === POPUP_RESULT.AFFIRMATIVE;
    } finally {
        state.openPopups -= 1;
        forgetNotice(notice.id);
    }

    if (confirmed) {
        await startForceUpdate(entry);
    }
}

async function startForceUpdate(entry) {
    const state = getExtensionOpsState();
    const jobId = createRandomId('bbt_');
    state.selfReported.add(jobId);
    try {
        const response = await fetch(EXTENSION_UPDATE_PATH, {
            method: 'POST',
            headers: { ...getRequestHeaders(), [EXTENSION_OPS_JOB_HEADER]: jobId },
            body: JSON.stringify({ extensionName: entry.requestName, global: Boolean(entry.global), force: true }),
        });
        if (!response.headers.get(EXTENSION_OPS_OP_HEADER)) {
            const text = response.ok ? '' : await response.text().catch(() => '');
            toastr.warning(
                response.ok
                    ? '柏宝库没有接管这次请求(「插件安装优化」可能已经关闭),已经按酒馆原生方式更新,不是强制更新。'
                    : joinMessage('柏宝库没有接管这次请求(「插件安装优化」可能已经关闭),强制更新没有执行。', text),
                `「${entry.extension}」强制更新`,
            );
        }
    } catch (error) {
        console.debug(`${LOG_PREFIX} Force update request failed`, error);
        toastr.error(String(error?.message || error), `「${entry.extension}」强制更新失败`);
    } finally {
        state.selfReported.delete(jobId);
    }
}

function renderOperationDetails({ kind, extension, global, ok, code, message, hint, opId, op, forceable }) {
    const root = $('<div class="bai_bai_toolkit_extension_op_details"></div>')
        .css({ textAlign: 'left', overflowWrap: 'anywhere' });
    root.append($('<h3></h3>').text(`${getExtensionOpKindLabel(kind)}${ok ? '成功' : '失败'}`));
    appendDetailField(root, '扩展', `${extension || '未知'}(${global ? '全局扩展' : '个人扩展'})`);
    if (op?.startedAt) {
        const elapsed = formatExtensionOpDuration(op.elapsedMs);
        appendDetailField(root, '时间', `${new Date(op.startedAt).toLocaleString()}${elapsed ? `,用时 ${elapsed}` : ''}`);
    }
    if (op?.source) {
        appendDetailField(root, '仓库', op.source);
    }
    appendDetailField(root, ok ? '结果' : '原因', message || (ok ? '完成。' : '没有拿到具体原因。'));
    if (hint) {
        appendDetailField(root, '建议', hint);
    }

    const result = op?.result && typeof op.result === 'object' ? op.result : {};
    if (ok) {
        appendSuccessDetails(root, result);
    } else if (result.details && typeof result.details === 'object') {
        appendFailureDetails(root, result.details);
    }
    if (forceable) {
        root.append($('<p></p>').text('强制更新会先把整个扩展目录备份(保留 7 天),再对齐到远端最新版;你在这个扩展里的本地修改和提交会被覆盖。'));
    }
    appendAttempts(root, op?.attempts);

    const meta = [
        code ? `错误代码 ${code}` : '',
        opId ? `记录 ${opId}` : '',
        describeGitBackend(op),
    ].filter(Boolean);
    if (meta.length) {
        root.append($('<p></p>').css({ opacity: 0.7, fontSize: '0.85em' }).text(meta.join(' · ')));
    }
    return root;
}

function appendDetailField(root, label, value) {
    root.append($('<p></p>').append($('<b></b>').text(`${label}:`), document.createTextNode(String(value))));
}

function appendDetailList(root, label, items) {
    root.append($('<p></p>').append($('<b></b>').text(`${label}:`)));
    const list = $('<ul></ul>');
    for (const item of items.slice(0, MAX_LISTED_ITEMS)) {
        list.append($('<li></li>').text(String(item)));
    }
    if (items.length > MAX_LISTED_ITEMS) {
        list.append($('<li></li>').text(`…还有 ${items.length - MAX_LISTED_ITEMS} 个`));
    }
    root.append(list);
}

function appendFailureDetails(root, details) {
    if (Array.isArray(details.files) && details.files.length) {
        appendDetailList(root, '本地改过的文件', details.files);
    }
    if (Array.isArray(details.restoreFailed) && details.restoreFailed.length) {
        appendDetailList(root, '没能放回去的改动文件', details.restoreFailed);
    }
    if (details.backup) {
        appendDetailField(root, '备份', `${details.backup}(保留 7 天)`);
    }
    if (details.detail) {
        root.append($('<p></p>').append($('<b></b>').text('详细信息:')));
        root.append(createDetailBlock(details.detail));
    }
}

function appendSuccessDetails(root, result) {
    if (result.from && result.to) {
        const changed = Number.isFinite(result.changedFiles) ? `,改动 ${result.changedFiles} 个文件` : '';
        appendDetailField(root, '版本', `${shortSha(result.from)} → ${shortSha(result.to)}${changed}${result.forced ? '(强制)' : ''}`);
    } else if (result.commit) {
        appendDetailField(root, '版本', shortSha(result.commit));
    }
    if (result.switchedTo) {
        appendDetailField(root, '切换分支', result.switchedTo);
    }
    if (result.route) {
        appendDetailField(root, '线路', result.route);
    }
    if (result.backupPath) {
        appendDetailField(root, '备份', `${result.backupPath}(保留 7 天)`);
    }
    if (result.trashPath) {
        appendDetailField(root, '回收区', `${result.trashPath}(保留 7 天)`);
    }
    if (Array.isArray(result.warnings) && result.warnings.length) {
        appendDetailList(root, '提醒', result.warnings);
    }
}

function appendAttempts(root, attempts) {
    if (!Array.isArray(attempts) || !attempts.length) {
        return;
    }

    root.append($('<p></p>').append($('<b></b>').text('尝试过的线路:')));
    const list = $('<ul></ul>');
    for (const attempt of attempts) {
        const parts = [`${attempt.ok ? '✓' : '✗'} ${attempt.label || attempt.kind || '线路'}`];
        if (attempt.phase) {
            parts.push(ATTEMPT_PHASE_LABELS[attempt.phase] ?? attempt.phase);
        }
        const latency = formatExtensionOpDuration(attempt.latencyMs);
        if (latency) {
            parts.push(latency);
        }
        if (!attempt.ok && attempt.error?.summary) {
            parts.push(attempt.error.summary);
        }
        const item = $('<li></li>').text(parts.join(' · '));
        if (!attempt.ok && attempt.error?.detail) {
            item.append(createDetailBlock(attempt.error.detail));
        }
        list.append(item);
    }
    root.append(list);
}

function createDetailBlock(text) {
    return $('<div></div>')
        .css({ fontSize: '0.85em', opacity: 0.7, whiteSpace: 'pre-wrap' })
        .text(truncateText(text, MAX_DETAIL_CHARS));
}

function describeGitBackend(op) {
    if (op?.backend === 'system') {
        return op.gitVersion ? `系统 git ${op.gitVersion}` : '系统 git';
    }
    return op?.backend === 'builtin' ? '内置 git' : '';
}

function formatExtensionOpDuration(ms) {
    const value = Number(ms);
    if (ms === null || ms === undefined || !Number.isFinite(value) || value < 0) {
        return '';
    }
    if (value < 1000) {
        return `${Math.round(value)} 毫秒`;
    }
    if (value < 60_000) {
        return `${(value / 1000).toFixed(1)} 秒`;
    }
    return `${(value / 60_000).toFixed(1)} 分钟`;
}

function joinMessage(message, hint) {
    return [message, hint].filter(Boolean).join(' ');
}

function shortSha(value) {
    return String(value || '').slice(0, 7);
}

function truncateText(value, maxLength) {
    const text = String(value ?? '');
    return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * 调柏宝库的扩展管理接口。失败时抛出带 code/hint/status 的 Error;
 * 柏宝库没装或版本太旧(接口 404 且不是柏宝库的 JSON)时 error.unsupported 为 true。
 */
async function fetchExtensionManagerApi(path, { method = 'GET', body, timeoutMs = 15_000 } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const response = await fetch(`${BAIBAOKU_EXTENSIONS_URL}/${path}`, {
            method,
            ...(method === 'GET' ? {} : { headers: getRequestHeaders() }),
            ...(body === undefined ? {} : { body: JSON.stringify(body) }),
            cache: 'no-store',
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);
        if (response.ok && payload?.ok === true) {
            return payload.data;
        }

        const unsupported = !payload && response.status === 404;
        const error = new Error(payload?.error?.message || (unsupported ? '柏宝库没有安装或版本太旧' : `HTTP ${response.status}`));
        error.code = payload?.error?.code ?? null;
        error.hint = payload?.error?.hint ?? null;
        error.status = response.status;
        error.unsupported = unsupported;
        throw error;
    } finally {
        clearTimeout(timer);
    }
}

export {
    fetchExtensionManagerApi,
    installExtensionOpsFetchHook,
};
