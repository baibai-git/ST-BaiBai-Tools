// 酒馆更新扩展失败时只会抛一句通用文案(真实报错只在服务端控制台),
// 这里在前端拦截 /api/extensions/update 的 500,再用酒馆已有接口查原因,
// 只给用户一句看得懂的原因和一个照着做就行的办法,检测细节打到浏览器控制台。只读检测,不会改动任何仓库。
// 柏宝库接管的请求(响应带 X-Baibaoku-Extension-Op)由 extensionOps 报告,这里跳过。
import { getRequestHeaders } from '@sillytavern/script';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import {
    BAIBAOKU_STATUS_TIMEOUT_MS,
    BAIBAOKU_STATUS_URL,
    EXTENSION_BRANCHES_PATH,
    EXTENSION_OPS_OP_HEADER,
    EXTENSION_UPDATE_DIAGNOSTICS_COOLDOWN_MS,
    EXTENSION_UPDATE_DIAGNOSTICS_FETCH_KEY,
    EXTENSION_UPDATE_PATH,
    EXTENSION_VERSION_PATH,
    LOG_PREFIX,
} from './constants.js';
import { fetchExtensionManagerApi } from './extensionOps.js';
import { getFetchRequestMethod, getFetchRequestUrl } from './gzipHook.js';
import { extensionState } from './state.js';
import { readFetchJsonBody } from './util.js';

function getUpdateDiagnosticsState() {
    if (!extensionState.updateDiagnostics || typeof extensionState.updateDiagnostics !== 'object') {
        extensionState.updateDiagnostics = {};
    }

    const state = extensionState.updateDiagnostics;
    if (!(state.pending instanceof Map)) {
        state.pending = new Map();
    }
    if (!(state.lastShownAt instanceof Map)) {
        state.lastShownAt = new Map();
    }

    return state;
}

// 酒馆启动时会静默自动更新(auto_update),那时用户还没操作过页面。
// 手动点更新一定发生在 pointerdown/keydown 之后,用这个区分两种场景,
// 避免开机直接糊用户一脸弹窗。
let userHasInteracted = false;

function trackUserInteraction() {
    userHasInteracted = true;
}

function hasUserInteracted() {
    if (userHasInteracted) {
        return true;
    }

    return typeof navigator !== 'undefined' && navigator.userActivation?.hasBeenActive === true;
}

function installExtensionUpdateDiagnosticsFetchHook() {
    const existing = globalThis[EXTENSION_UPDATE_DIAGNOSTICS_FETCH_KEY];
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
    };

    if (!hasUserInteracted() && typeof document !== 'undefined') {
        document.addEventListener('pointerdown', trackUserInteraction, { capture: true, once: true });
        document.addEventListener('keydown', trackUserInteraction, { capture: true, once: true });
    }

    state.wrappedFetch = async function baiBaiToolkitExtensionUpdateDiagnosticsFetch(input, init) {
        const requestUrl = getFetchRequestUrl(input);
        const isExtensionUpdate = typeof requestUrl === 'string'
            && requestUrl.endsWith(EXTENSION_UPDATE_PATH)
            && getFetchRequestMethod(input, init) === 'POST';
        // 只有更新接口才解析 body,普通请求保持零开销。
        const requestInfo = isExtensionUpdate ? await readExtensionUpdateRequestInfo(input, init) : null;
        const response = await state.originalFetch(input, init);

        if (requestInfo && response?.status === 500 && !response.headers?.get(EXTENSION_OPS_OP_HEADER)) {
            void (async () => {
                try {
                    const responseText = await response.clone().text();
                    await showExtensionUpdateDiagnosis({ ...requestInfo, responseText });
                } catch (error) {
                    console.debug(`${LOG_PREFIX} Extension update diagnosis failed`, error);
                }
            })();
        }

        return response;
    };

    globalThis[EXTENSION_UPDATE_DIAGNOSTICS_FETCH_KEY] = state;
    globalThis.fetch = state.wrappedFetch;
    return state;
}

async function readExtensionUpdateRequestInfo(input, init) {
    const body = await readFetchJsonBody(input, init).catch(() => null);
    const extensionName = body?.extensionName;
    if (typeof extensionName !== 'string' || !extensionName) {
        return null;
    }

    return { extensionName, isGlobal: Boolean(body?.global) };
}

/**
 * 弹出更新失败诊断。同一个扩展在冷却时间内只弹一次,进行中的诊断复用同一个 promise,
 * 因此插件自己的更新流程和全局 fetch 钩子同时触发时不会弹两次。
 */
async function showExtensionUpdateDiagnosis({ extensionName, isGlobal, responseText }) {
    const state = getUpdateDiagnosticsState();
    const pending = state.pending.get(extensionName);
    if (pending) {
        return pending;
    }
    if (Date.now() - (state.lastShownAt.get(extensionName) || 0) < EXTENSION_UPDATE_DIAGNOSTICS_COOLDOWN_MS) {
        return null;
    }
    state.lastShownAt.set(extensionName, Date.now());

    const promise = (async () => {
        const diagnosis = await diagnoseExtensionUpdateFailure({ extensionName, isGlobal, responseText });
        console.info(`${LOG_PREFIX} Extension update diagnosis`, diagnosis);

        if (!hasUserInteracted()) {
            toastr.error('点这里看原因和解决办法。', `${getExtensionDisplayName(extensionName)} 更新失败`, {
                timeOut: 10_000,
                onclick: () => openDiagnosisPopup(diagnosis),
            });
            return;
        }

        await openDiagnosisPopup(diagnosis);
    })().finally(() => state.pending.delete(extensionName));

    state.pending.set(extensionName, promise);
    return promise;
}

function openDiagnosisPopup(diagnosis) {
    return callGenericPopup(renderUpdateDiagnosisHtml(diagnosis), POPUP_TYPE.TEXT, '', {
        okButton: '知道了',
    });
}

async function diagnoseExtensionUpdateFailure({ extensionName, isGlobal, responseText }) {
    const diagnosis = {
        extensionName,
        isGlobal,
        responseText: responseText || '',
        version: null,
        versionError: null,
        branches: null,
        branchesError: null,
        baibaoku: null,
        conclusion: null,
    };

    try {
        const response = await postExtensionApi(EXTENSION_VERSION_PATH, extensionName, isGlobal);
        if (response.ok) {
            diagnosis.version = await response.json().catch(() => null);
        } else {
            diagnosis.versionError = { status: response.status, text: await readResponseTextSafe(response) };
        }
    } catch (error) {
        diagnosis.versionError = { status: 0, text: errorMessage(error) };
    }

    // /version 已经能区分「不是 git 仓库」;它报错时再看分支列表:
    // 分支列表不需要 origin/<本地分支> 存在,所以能反过来确认「本地分支在远端已被删除」。
    if (diagnosis.versionError && diagnosis.versionError.status !== 0) {
        try {
            const response = await postExtensionApi(EXTENSION_BRANCHES_PATH, extensionName, isGlobal);
            if (response.ok) {
                diagnosis.branches = await response.json().catch(() => null);
            } else {
                diagnosis.branchesError = { status: response.status, text: await readResponseTextSafe(response) };
            }
        } catch (error) {
            diagnosis.branchesError = { status: 0, text: errorMessage(error) };
        }
    }

    // 连得上酒馆后台才查得了柏宝库装没装
    if (diagnosis.versionError?.status !== 0) {
        diagnosis.baibaoku = await detectBaibaokuState();
    }

    diagnosis.conclusion = buildUpdateDiagnosisConclusion(diagnosis);
    return diagnosis;
}

function postExtensionApi(path, extensionName, isGlobal) {
    return fetch(path, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            extensionName,
            global: isGlobal,
        }),
    });
}

// 柏宝库接管了更新就不会走到这里,看看它是「插件安装优化」关了、版本太旧还是没装
async function detectBaibaokuState() {
    try {
        const config = await fetchExtensionManagerApi('manager/config', { timeoutMs: BAIBAOKU_STATUS_TIMEOUT_MS });
        return config?.interceptEnabled === false ? 'off' : 'on';
    } catch (error) {
        if (!error?.unsupported) {
            return 'unknown';
        }
    }

    // 没有扩展管理接口:状态接口还在,说明柏宝库装了但版本太旧
    try {
        const response = await fetch(BAIBAOKU_STATUS_URL, {
            cache: 'no-store',
            signal: createAbortSignalWithTimeout(BAIBAOKU_STATUS_TIMEOUT_MS),
        });
        return response.ok ? 'outdated' : 'missing';
    } catch {
        return 'unknown';
    }
}

function createAbortSignalWithTimeout(timeoutMs) {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
        return AbortSignal.timeout(timeoutMs);
    }

    const controller = new AbortController();
    setTimeout(() => controller.abort(), timeoutMs);
    return controller.signal;
}

const REINSTALL_ACTION = '删掉这个扩展,重新装一次就好。';
const INSTALL_BAIBAOKU_ACTION = '推荐按照帖子里的说明安装一下柏宝库。';

// 连不上 GitHub 时柏宝库能自动换线路,按柏宝库的状态给办法
const NETWORK_ACTIONS = {
    off: '到柏宝箱的「柏宝库」页打开「插件安装优化」,再更新一次。',
    outdated: '柏宝库版本太旧,重启酒馆后台(不是刷新网页)让它自动更新,再更新一次;还不行就删掉柏宝库重新安装。',
};

function buildUpdateDiagnosisConclusion(diagnosis) {
    const conclusion = buildUpdateFailureConclusion(diagnosis);

    // 没装柏宝库时不管什么原因都只推荐装它:装上后由它接管更新,出错时它会说清楚怎么办。
    if (diagnosis.baibaoku === 'missing') {
        conclusion.action = INSTALL_BAIBAOKU_ACTION;
    }

    return conclusion;
}

function buildUpdateFailureConclusion(diagnosis) {
    const { version, versionError, branches } = diagnosis;

    // /version 成功:仓库、远端分支、git fetch 全都没问题,失败只能发生在 git pull 阶段。
    if (!versionError) {
        if (!version?.currentBranchName && !version?.currentCommitHash) {
            return {
                reason: '因为这个扩展不是用酒馆装的,更新失败。',
                action: REINSTALL_ACTION,
            };
        }

        return {
            reason: '因为本地文件和新版本对不上,更新失败。',
            action: REINSTALL_ACTION,
        };
    }

    // /version 失败但 /branches 正常:几乎可以确定是本地分支在远端不存在。
    if (Array.isArray(branches)) {
        const localBranch = branches.find(branch => branch?.current)?.name || '';
        if (localBranch && !branches.some(branch => branch?.name === `origin/${localBranch}`)) {
            return {
                reason: '因为作者删了你在用的分支,更新失败。',
                action: REINSTALL_ACTION,
            };
        }
    }

    if (versionError.status === 0) {
        return {
            reason: '因为连不上酒馆后台,更新失败。',
            action: '确认酒馆后台还开着,刷新网页再更新一次。',
        };
    }

    // 其余情况:酒馆接口能通,但酒馆后台的 git 连不上 GitHub。
    return {
        reason: '因为网络问题,更新失败。',
        action: NETWORK_ACTIONS[diagnosis.baibaoku] ?? '过一会儿再更新一次。',
    };
}

function renderUpdateDiagnosisHtml(diagnosis) {
    const { conclusion } = diagnosis;
    return `
        <h3>${escapeHtml(getExtensionDisplayName(diagnosis.extensionName))}</h3>
        <p>${escapeHtml(conclusion.reason)}</p>
        <p>${escapeHtml(conclusion.action)}</p>
    `;
}

// 酒馆发更新请求时把 'third-party/名字' 去掉前缀成了 '/名字',显示时把开头这段去掉
function getExtensionDisplayName(extensionName) {
    return String(extensionName ?? '').replace(/^(third-party)?\/+/, '');
}

async function readResponseTextSafe(response) {
    try {
        return await response.text();
    } catch {
        return '';
    }
}

function errorMessage(error) {
    return String(error?.message || error || '');
}

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
    })[char]);
}

export {
    buildUpdateDiagnosisConclusion,
    diagnoseExtensionUpdateFailure,
    hasUserInteracted,
    installExtensionUpdateDiagnosticsFetchHook,
    renderUpdateDiagnosisHtml,
    showExtensionUpdateDiagnosis,
};
