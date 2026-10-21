// 酒馆更新扩展失败时只会抛一句通用文案(真实报错只在服务端控制台),
// 这里在前端拦截 /api/extensions/update 的 500,再用酒馆已有接口做体检,
// 给用户一份能看懂的失败原因和操作建议。只读检测,不会改动任何仓库。
// 柏宝库接管的请求(响应带 X-Baibaoku-Extension-Op)由 extensionOps 报告,这里跳过。
import { getRequestHeaders } from '@sillytavern/script';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import {
    EXTENSION_BRANCHES_PATH,
    EXTENSION_OPS_OP_HEADER,
    EXTENSION_UPDATE_DIAGNOSTICS_COOLDOWN_MS,
    EXTENSION_UPDATE_DIAGNOSTICS_FETCH_KEY,
    EXTENSION_UPDATE_DIAGNOSTICS_GITHUB_PROBE_URL,
    EXTENSION_UPDATE_DIAGNOSTICS_PROBE_TIMEOUT_MS,
    EXTENSION_UPDATE_PATH,
    EXTENSION_VERSION_PATH,
    LOG_PREFIX,
} from './constants.js';
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
            toastr.error('点击查看诊断详情。', `${extensionName} 更新失败`, {
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
        wide: true,
        allowVerticalScrolling: true,
        okButton: '关闭',
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
        browserGithubReachable: null,
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

    let conclusion = buildUpdateDiagnosisConclusion(diagnosis);
    if (conclusion.probeBrowser) {
        diagnosis.browserGithubReachable = await probeBrowserGithubReachability();
        conclusion = buildUpdateDiagnosisConclusion(diagnosis);
    }

    diagnosis.conclusion = conclusion;
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

async function probeBrowserGithubReachability() {
    try {
        await fetch(EXTENSION_UPDATE_DIAGNOSTICS_GITHUB_PROBE_URL, {
            mode: 'no-cors',
            cache: 'no-store',
            signal: createAbortSignalWithTimeout(EXTENSION_UPDATE_DIAGNOSTICS_PROBE_TIMEOUT_MS),
        });
        return true;
    } catch {
        return false;
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

function buildUpdateDiagnosisConclusion(diagnosis) {
    const { version, versionError, branches, browserGithubReachable } = diagnosis;
    const directory = getExtensionDirectoryHint(diagnosis.extensionName, diagnosis.isGlobal);

    // /version 成功:仓库、远端分支、git fetch 全都没问题,失败只能发生在 git pull 阶段。
    if (!versionError) {
        if (!version?.currentBranchName && !version?.currentCommitHash) {
            return {
                stage: '检查仓库',
                reason: '这个扩展目录不是 git 仓库(没有 .git),酒馆只能用 git 更新扩展。',
                suggestions: [
                    '如果你是解压压缩包/手动复制安装的,请删除该目录,然后在「扩展」面板用 Install extension 填 GitHub 地址重新安装。',
                    '如果这个扩展本来就不在 GitHub 上,它无法通过酒馆自带的更新按钮更新。',
                ],
                commands: [
                    `cd ${directory}`,
                    `git clone <仓库地址> ${diagnosis.extensionName}`,
                ],
            };
        }

        const pendingText = version?.isUpToDate === false
            ? '远端确实有新提交,卡在 git pull。'
            : '远端检查没发现新提交,但更新请求仍然失败了。';
        return {
            stage: '拉取更新(git pull)',
            reason: `仓库、远端分支、网络都正常,${pendingText}常见原因是本地有未提交修改/构建产物冲突、分支已分叉无法快进,或文件被其他程序占用(Windows 上很常见)。`,
            suggestions: [
                '在插件目录执行 git status,看看有没有未提交的改动;有就先 git stash 或 git checkout . 再重试更新。',
                '如果你在开发这个插件(npm run build / npm run watch),构建产物会让更新失败,先提交或撤销本地改动。',
                '关掉正在占用 dist/index.js 的程序(编辑器、跑着 watch 的终端)后再试。',
                '分支分叉(本地有提交)时可以手动 git pull origin <分支> 处理冲突,或者直接删掉重装。',
            ],
            commands: [
                `cd ${directory}`,
                'git status',
                'git pull origin $(git branch --show-current)',
            ],
            versionInfo: version,
        };
    }

    // /version 失败但 /branches 正常:几乎可以确定是本地分支在远端不存在。
    if (Array.isArray(branches)) {
        const localBranch = branches.find(branch => branch?.current)?.name || '';
        const remoteBranchNames = branches
            .map(branch => String(branch?.name || ''))
            .filter(name => name.startsWith('origin/') && !name.endsWith('/HEAD'));
        const hasRemoteCounterpart = Boolean(localBranch) && remoteBranchNames.includes(`origin/${localBranch}`);

        if (localBranch && !hasRemoteCounterpart) {
            const fallbackBranch = String(remoteBranchNames[0] || 'origin/main').replace(/^origin\//, '');
            return {
                stage: '检查远端分支',
                reason: `当前本地分支「${localBranch}」在远端已经不存在了(作者可能改过名或删过分支),酒馆第一步检查 origin/${localBranch} 就直接失败。`,
                suggestions: [
                    `在「扩展」面板点分支切换,换到远端仍存在的分支(如 ${remoteBranchNames[0] || 'origin/main'})后再更新。`,
                    '或者删除后重新安装插件。',
                ],
                commands: [
                    `cd ${directory}`,
                    'git fetch origin',
                    `git checkout ${fallbackBranch}`,
                    'git pull',
                ],
            };
        }
    }

    if (versionError?.status === 0) {
        return {
            stage: '连接 SillyTavern 服务器',
            reason: '浏览器连酒馆后端都失败了(服务器可能正在重启或已掉线)。',
            suggestions: [
                '确认酒馆还在运行,然后重试。',
            ],
            commands: [],
        };
    }

    // 其余情况:酒馆接口能通,但服务器上的 git fetch 失败。再用浏览器能否访问 GitHub 辅助判断。
    let reason = '酒馆服务器上的 git 无法访问 GitHub。git 是服务器进程执行的,既不受浏览器网络影响,也不吃酒馆 config.yaml 里的 requestProxy 代理设置。';
    if (browserGithubReachable === true) {
        reason += ' 你的浏览器能访问 GitHub,说明问题在服务器进程这一侧:git 没走代理,或者服务器上根本没装 git。';
    } else if (browserGithubReachable === false) {
        reason = '当前网络访问 GitHub 失败(浏览器也连不上),git fetch 无法完成。';
    }

    return {
        stage: '访问 GitHub(git fetch)',
        reason,
        suggestions: [
            '推荐安装柏宝库并在柏宝箱「柏宝库」页打开「插件安装优化」:更新时会自动在直连、代理和镜像之间切换线路。',
            '不建议给 git 配全局代理:代理软件一关,所有 git 操作都会失败(这也是更新失败的常见原因)。可以用 git config --global --get http.proxy 查看,确实不用了就用 git config --global --unset http.proxy 删掉。',
            '或者让系统代理开启 TUN/全局模式,确保命令行也能走代理。',
            '如果服务器上没装 git,更新同样会报这个 500;到酒馆启动窗口确认是否出现 spawn git ENOENT。',
            '如果是从手机/其他设备访问局域网里的酒馆,浏览器能不能访问 GitHub 不代表服务器能不能。',
        ],
        commands: [
            `cd ${directory}`,
            'git fetch origin',
            'git config --global --get http.proxy',
        ],
        probeBrowser: true,
    };
}

function getExtensionDirectoryHint(extensionName, isGlobal) {
    return isGlobal
        ? `SillyTavern/public/scripts/extensions/third-party/${extensionName}`
        : `SillyTavern/data/<用户名>/extensions/${extensionName}`;
}

function renderUpdateDiagnosisHtml(diagnosis) {
    const { conclusion } = diagnosis;
    const parts = [];

    parts.push('<h3>插件更新失败诊断</h3>');
    parts.push(`<p><b>扩展:</b>${escapeHtml(diagnosis.extensionName)}(${diagnosis.isGlobal ? '全局扩展' : '用户扩展'})</p>`);
    parts.push(`<p><b>失败阶段:</b>${escapeHtml(conclusion.stage)}</p>`);
    parts.push(`<p><b>诊断结论:</b>${escapeHtml(conclusion.reason)}</p>`);

    if (conclusion.versionInfo) {
        const info = conclusion.versionInfo;
        const commit = String(info.currentCommitHash || '').slice(0, 7);
        parts.push(`<p><b>仓库状态:</b>分支 ${escapeHtml(info.currentBranchName || '未知')},提交 ${escapeHtml(commit || '未知')},${info.isUpToDate ? '与远端一致' : '落后于远端'}${info.remoteUrl ? `,远端 ${escapeHtml(info.remoteUrl)}` : ''}</p>`);
    }

    if (conclusion.suggestions?.length) {
        parts.push('<p><b>怎么办:</b></p><ul>');
        for (const suggestion of conclusion.suggestions) {
            parts.push(`<li>${escapeHtml(suggestion)}</li>`);
        }
        parts.push('</ul>');
    }

    if (conclusion.commands?.length) {
        parts.push('<p><b>可以在酒馆服务器上手动执行:</b></p>');
        for (const command of conclusion.commands) {
            parts.push(`<pre><code>${escapeHtml(command)}</code></pre>`);
        }
    }

    parts.push('<p style="opacity:.75">最准确的报错在酒馆启动窗口(运行 node server.js 的终端)里:<code>Updating extension failed</code> 后面那一段。</p>');
    parts.push('<details style="margin-top:.5em"><summary>检测详情与接口原始返回</summary>');
    parts.push(renderDiagnosisDetails(diagnosis));
    parts.push('</details>');

    return parts.join('');
}

function renderDiagnosisDetails(diagnosis) {
    const parts = [];

    parts.push(`<p>酒馆更新接口返回:${escapeHtml(diagnosis.responseText || '(空)')}</p>`);

    if (diagnosis.versionError) {
        parts.push(`<p>/api/extensions/version 失败:${escapeHtml(String(diagnosis.versionError.status || '网络错误'))} ${escapeHtml(diagnosis.versionError.text || '')}</p>`);
    } else if (diagnosis.version) {
        parts.push(`<p>/api/extensions/version 正常:${escapeHtml(JSON.stringify(diagnosis.version))}</p>`);
    }

    if (diagnosis.branchesError) {
        parts.push(`<p>/api/extensions/branches 失败:${escapeHtml(String(diagnosis.branchesError.status || '网络错误'))} ${escapeHtml(diagnosis.branchesError.text || '')}</p>`);
    } else if (Array.isArray(diagnosis.branches)) {
        const names = diagnosis.branches.map(branch => String(branch?.name || '')).filter(Boolean);
        parts.push(`<p>/api/extensions/branches 正常:${escapeHtml(names.join(', '))}</p>`);
    }

    if (diagnosis.browserGithubReachable !== null) {
        parts.push(`<p>浏览器访问 GitHub:${diagnosis.browserGithubReachable ? '可以' : '不可以'}</p>`);
    }

    return parts.join('');
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
    probeBrowserGithubReachability,
    renderUpdateDiagnosisHtml,
    showExtensionUpdateDiagnosis,
};
