import { getRequestHeaders } from '@sillytavern/script';
import { extensionTypes } from '@sillytavern/scripts/extensions';
import { t } from '@sillytavern/scripts/i18n';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { isAdmin } from '@sillytavern/scripts/user';
import { CURRENT_VERSION, EXTENSION_OPS_OP_HEADER, EXTENSION_VERSION_CHECK_TIMEOUT_MS, LOG_PREFIX } from './constants.js';
import { fetchExtensionManagerApi } from './extensionOps.js';
import { EXTENSION_ID, extensionState, settings } from './state.js';
import { showExtensionUpdateDiagnosis } from './updateDiagnostics.js';

function initializeExtensionUpdateCheck() {
    void checkForSilentExtensionUpdate()
        .catch((error) => console.debug(`${LOG_PREFIX} Silent update failed`, error));
}

async function checkForSilentExtensionUpdate() {
    if (extensionState.silentUpdateResult) {
        return extensionState.silentUpdateResult;
    }

    if (extensionState.silentUpdatePromise) {
        return extensionState.silentUpdatePromise;
    }

    extensionState.silentUpdatePromise = runSilentExtensionUpdate()
        .then((result) => {
            extensionState.silentUpdateResult = result;
            return result;
        })
        .catch((error) => {
            extensionState.silentUpdateResult = { error };
            throw error;
        })
        .finally(() => {
            extensionState.silentUpdatePromise = null;
        });

    return extensionState.silentUpdatePromise;
}

async function runSilentExtensionUpdate() {
    try {
        const updateAvailable = await detectExtensionUpdate();

        applyUpdateAvailableVisualState(updateAvailable);

        if (updateAvailable) {
            queueExtensionUpdatePrompt();
        }

        return { isUpToDate: !updateAvailable };
    } catch (error) {
        console.error(`${LOG_PREFIX} Update check failed:`, error);
        throw error;
    }
}

/**
 * 先问柏宝库:服务器能自动选直连/代理/镜像线路读远端版本,浏览器连不上 GitHub 也能检查。
 * 没装柏宝库或它检查失败时,退回浏览器直接读 GitHub 上的 manifest。
 */
async function detectExtensionUpdate() {
    const backend = await fetchBaibaokuExtensionVersion();
    const backendReliable = Boolean(backend?.currentCommitHash) && !backend.baibaoku?.remoteCheckFailed;
    const remoteVersion = backendReliable ? backend.baibaoku?.remoteManifest?.version : null;
    if (remoteVersion) {
        return isVersionGreater(remoteVersion, CURRENT_VERSION);
    }
    if (backendReliable && backend.isUpToDate !== false) {
        return false;
    }

    try {
        return isVersionGreater(await fetchRemoteManifestVersion(), CURRENT_VERSION);
    } catch (error) {
        // 浏览器连不上 GitHub,但服务器已经确认远端有新提交
        if (backendReliable) {
            return true;
        }
        throw error;
    }
}

async function fetchBaibaokuExtensionVersion() {
    const type = getInstalledExtensionType();
    if (!type || type === 'system') {
        return null;
    }

    try {
        return await fetchExtensionManagerApi('version', {
            method: 'POST',
            body: { extensionName: EXTENSION_ID, global: type === 'global', includeRemoteManifest: true },
            timeoutMs: EXTENSION_VERSION_CHECK_TIMEOUT_MS,
        });
    } catch {
        return null;
    }
}

async function fetchRemoteManifestVersion() {
    const remoteManifestUrl = `https://raw.githubusercontent.com/baibai-git/SillyTavern-Mobile-Resize-Guard/main/manifest.json?t=${Date.now()}`;
    const remoteManifestResponse = await fetch(remoteManifestUrl, { cache: 'no-store' });
    if (!remoteManifestResponse.ok) {
        throw new Error(`Failed to fetch remote manifest: ${remoteManifestResponse.statusText}`);
    }
    const remoteManifest = await remoteManifestResponse.json();
    return remoteManifest.version;
}

function isVersionGreater(v1, v2) {
    if (!v1 || !v2) return false;
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return true;
        if (p1 < p2) return false;
    }
    return false;
}

async function getCurrentExtensionVersion() {
    return fetchCurrentExtensionEndpoint('/api/extensions/version');
}

async function updateCurrentExtension() {
    return fetchCurrentExtensionEndpoint('/api/extensions/update');
}

async function fetchCurrentExtensionEndpoint(endpoint) {
    const type = getInstalledExtensionType();

    if (!type || type === 'system') {
        return new Response('Extension is not installed as an updateable third-party extension.', { status: 404 });
    }

    if (type === 'global' && !isAdmin()) {
        return new Response('Forbidden: No permission to update global extensions.', { status: 403 });
    }

    return fetch(endpoint, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            extensionName: EXTENSION_ID,
            global: type === 'global',
        }),
    });
}

function applyUpdateAvailableVisualState(updateAvailable) {
    const isAvailable = Boolean(updateAvailable);
    $('.bai_bai_toolkit_update_badge').toggle(isAvailable);
    $('.bai_bai_toolkit_update_button').toggle(isAvailable);
}

async function promptForExtensionUpdate(updateButton = null) {
    if (extensionState.updatePromptPromise) {
        return extensionState.updatePromptPromise;
    }

    extensionState.updatePromptPromise = runExtensionUpdatePrompt(updateButton)
        .finally(() => {
            extensionState.updatePromptPromise = null;
        });

    return extensionState.updatePromptPromise;
}

function queueExtensionUpdatePrompt() {
    if (!settings.updatePromptOnAvailableEnabled) {
        return;
    }

    jQuery(() => {
        if (!settings.updatePromptOnAvailableEnabled) {
            return;
        }

        void promptForExtensionUpdate()
            .catch((error) => console.debug(`${LOG_PREFIX} Update prompt failed`, error));
    });
}

async function runExtensionUpdatePrompt(updateButton) {
    const button = updateButton?.length ? updateButton : null;
    let shouldResetButton = Boolean(button);

    if (button) {
        button.addClass('disabled');
    }

    try {
        const confirmed = await confirmExtensionUpdate();
        if (!confirmed) {
            return false;
        }

        setUpdateButtonLoading(button);
        const updated = await performCurrentExtensionUpdate();
        if (updated) {
            shouldResetButton = false;
        }
        return updated;
    } catch (error) {
        console.error(`${LOG_PREFIX} Update failed:`, error);
        const message = String(error?.message || error);
        // 酒馆只会把失败包成一句通用文案,这里换成结构化诊断弹窗。
        // 柏宝库接管时报错本身就是具体原因,详情和强制更新由 extensionOps 另外提示。
        if (message.includes('Internal Server Error') && !error?.handledByBaibaoku) {
            void showExtensionUpdateDiagnosis({
                extensionName: EXTENSION_ID,
                isGlobal: getInstalledExtensionType() === 'global',
                responseText: message,
            }).catch((diagnosisError) => console.debug(`${LOG_PREFIX} Update diagnosis failed`, diagnosisError));
        } else {
            toastr.error(`更新失败: ${message}`);
        }
        return false;
    } finally {
        if (shouldResetButton) {
            resetUpdateButton(button);
        }
    }
}

async function confirmExtensionUpdate() {
    const content = `
        <div class="bai_bai_toolkit_update_prompt">
            <h3>柏宝箱发现新版本</h3>
            <p>检测到插件有可用更新。要现在更新吗？</p>
            <p>更新完成后，SillyTavern 会自动刷新页面。</p>
        </div>
    `;
    const result = await callGenericPopup(content, POPUP_TYPE.CONFIRM, '', {
        okButton: '更新',
        cancelButton: '取消',
    });

    return result === POPUP_RESULT.AFFIRMATIVE;
}

async function performCurrentExtensionUpdate() {
    const response = await updateCurrentExtension();
    if (!response.ok) {
        const error = new Error(await getResponseErrorMessage(response));
        error.handledByBaibaoku = Boolean(response.headers.get(EXTENSION_OPS_OP_HEADER));
        throw error;
    }

    const data = await response.json().catch(() => null);
    applyUpdateAvailableVisualState(false);
    if (data?.isUpToDate) {
        // 服务器上的文件已经是最新(比如酒馆启动时自动更新过),只是页面还在跑旧代码
        extensionState.silentUpdateResult = { isUpToDate: true };
        if (!data.baibaoku?.staleSource) {
            toastr.info('服务器上已经是最新版本,没有可更新的内容。如果页面还是旧版本,刷新页面即可。');
        }
        return false;
    }

    toastr.success(t`Extension updated successfully. Reloading...`);
    setTimeout(() => location.reload(), 1000);
    return true;
}

function setUpdateButtonLoading(button) {
    if (!button?.length) {
        return;
    }

    button.addClass('disabled');
    button.find('span').text('更新中...');
    button.find('i').removeClass('fa-download').addClass('fa-spinner fa-spin');
}

function resetUpdateButton(button) {
    if (!button?.length) {
        return;
    }

    button.removeClass('disabled');
    button.find('span').text('更新');
    button.find('i').removeClass('fa-spinner fa-spin').addClass('fa-download');
}

function getInstalledExtensionType(extensionId = EXTENSION_ID) {
    const fullExtensionId = Object.keys(extensionTypes).find((id) => {
        return id === extensionId || (id.startsWith('third-party') && id.endsWith(extensionId));
    });

    return fullExtensionId ? extensionTypes[fullExtensionId] : null;
}

async function getResponseErrorMessage(response) {
    const text = await response.text();

    return text || response.statusText || `HTTP ${response.status}`;
}

async function initializeUpdateUI(container) {
    const versionSpan = container.find('.bai_bai_toolkit_current_version');
    const updateButton = container.find('.bai_bai_toolkit_update_button');
    const updateStatus = container.find('.bai_bai_toolkit_update_status');
    const badge = container.find('.bai_bai_toolkit_update_badge');

    versionSpan.text(CURRENT_VERSION);
    updateStatus.text('检查更新中...');

    if (extensionState.silentUpdateResult) {
        showUpdateState(extensionState.silentUpdateResult);
    } else {
        checkUpdateAndShowUI();
    }

    async function checkUpdateAndShowUI() {
        try {
            showUpdateState(await checkForSilentExtensionUpdate());
        } catch (e) {
            updateStatus.text('检查更新出错');
        }
    }

    function showUpdateState(data) {
        if (data?.error) {
            showUpdateError();
            return;
        }

        if (data?.isUpToDate === false) {
            showUpdateAvailable();
        } else {
            showNoUpdateAvailable();
        }
    }

    function showUpdateError() {
        updateButton.hide();
        badge.hide();
        updateStatus.text('检查更新出错');
    }

    function showUpdateAvailable() {
        updateStatus.text('');
        updateButton.show();
        badge.show();
    }

    function showNoUpdateAvailable() {
        updateButton.hide();
        badge.hide();
        updateStatus.text('已是最新版本');
        setTimeout(() => updateStatus.text(''), 3000);
    }

    // 绑定更新按钮点击事件
    updateButton.on('click', async function () {
        if ($(this).hasClass('disabled')) return;

        await promptForExtensionUpdate($(this));
    });
}

export {
    applyUpdateAvailableVisualState,
    checkForSilentExtensionUpdate,
    confirmExtensionUpdate,
    fetchCurrentExtensionEndpoint,
    getCurrentExtensionVersion,
    getInstalledExtensionType,
    getResponseErrorMessage,
    initializeExtensionUpdateCheck,
    initializeUpdateUI,
    isVersionGreater,
    performCurrentExtensionUpdate,
    promptForExtensionUpdate,
    queueExtensionUpdatePrompt,
    resetUpdateButton,
    runExtensionUpdatePrompt,
    runSilentExtensionUpdate,
    setUpdateButtonLoading,
    updateCurrentExtension,
};
