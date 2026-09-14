import * as presetOptimizations from '../preset/index.js';
import { getRequestHeaders } from '@sillytavern/script';
import { callGenericPopup, POPUP_TYPE } from '@sillytavern/scripts/popup';
import { BAIBAOKU_FAST_CONFIG_URL, BAIBAOKU_PANEL_STATUS_CACHE_MS, BAIBAOKU_PRESET_AUTO_BACKUP_MIN_VERSION, BAIBAOKU_REQUIRED_BACKEND_VERSION, BAIBAOKU_STATUS_TIMEOUT_MS, BAIBAOKU_STATUS_URL, LOG_PREFIX, SAVE_GENERATE_FETCH_KEY } from './constants.js';
import { applyFastChatGetOptimization } from './fastChat.js';
import { markSaveGenerateBackendAvailable } from './saveGenerate.js';
import { extensionState, settings } from './state.js';
import { getBaibaokuEarlyBridge } from './theme.js';
import { isVersionGreater } from './updateCheck.js';

function initializeBaibaokuPanel(container) {
    container.find('#bai_bai_toolkit_baibaoku_install_help')
        .off('click.baiBaiToolkitBaibaokuInstallHelp')
        .on('click.baiBaiToolkitBaibaokuInstallHelp', () => {
            showBaibaokuInstallHelpPrompt();
        });

    container.find('#bai_bai_toolkit_baibaoku_refresh_status')
        .off('click.baiBaiToolkitBaibaokuStatus')
        .on('click.baiBaiToolkitBaibaokuStatus', () => {
            refreshBaibaokuPanelStatus(container, { force: true });
        });

    refreshBaibaokuPanelStatus(container);
}

function getBaibaokuPanelState() {
    if (!extensionState.baibaokuPanel || typeof extensionState.baibaokuPanel !== 'object') {
        extensionState.baibaokuPanel = {
            cache: null,
            pending: null,
        };
    }

    return extensionState.baibaokuPanel;
}

function applyBaibaokuPanelLocalState(container) {
    const bridge = getBaibaokuEarlyBridge();
    const bridgeStatus = container.find('#bai_bai_toolkit_baibaoku_bridge_status');
    const presetAutoBackupToggle = container.find('#bai_bai_toolkit_preset_auto_backup_enabled');

    const bridgeLabel = bridge?.installed
        ? `已注入${bridge.version ? ` v${bridge.version}` : ''}`
        : '未注入';
    updateBaibaokuStatusText(bridgeStatus, bridgeLabel, Boolean(bridge?.installed));

    container.find('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false);
    container.find('#bai_bai_toolkit_baibaoku_lazy_theme_loading_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false && settings.baibaokuLazyThemeLoadingEnabled !== false);
    container.find('#bai_bai_toolkit_extension_manifest_bundle_enabled')
        .prop('checked', settings.extensionManifestBundleEnabled !== false);
    container.find('#bai_bai_toolkit_fast_character_list_enabled')
        .prop('checked', settings.fastCharacterListEnabled !== false);
    container.find('#bai_bai_toolkit_recent_chat_list_acceleration_enabled')
        .prop('checked', settings.recentChatListAccelerationEnabled !== false);
    container.find('#bai_bai_toolkit_progressive_chat_loading_enabled')
        .prop('checked', false)
        .prop('disabled', true);
    container.find('#bai_bai_toolkit_save_generate_enabled')
        .prop('checked', settings.saveGenerateEnabled === true);
    presetAutoBackupToggle
        .prop('checked', settings.presetAutoBackupEnabled !== false);
    container.find('#bai_bai_toolkit_tokenizer_bulk_count_enabled')
        .prop('checked', settings.tokenizerBulkCountEnabled !== false);
    container.find('#bai_bai_toolkit_chat_keyboard_scan_reduction_enabled')
        .prop('checked', settings.chatKeyboardScanReductionEnabled !== false);

    applyCachedBaibaokuPanelStatus(container, getBaibaokuPanelState().cache);
    applyPresetAutoBackupToggleAvailability(container, getBaibaokuPanelState().cache?.status);
}

function applyCachedBaibaokuPanelStatus(container, cache) {
    if (!cache) {
        return false;
    }

    const serverStatus = container.find('#bai_bai_toolkit_baibaoku_server_status');
    const driverStatus = container.find('#bai_bai_toolkit_baibaoku_driver_status');
    const status = cache.status;
    const driver = status?.driver;

    if (status) {
        updateBaibaokuStatusText(serverStatus, `已连接${status?.version ? ` v${status.version}` : ''}`, true);
        updateBaibaokuStatusText(driverStatus, driver?.available
            ? `可用${driver.package ? ` (${driver.package})` : ''}`
            : '不可用', Boolean(driver?.available));
        return true;
    }

    if (cache.offline) {
        updateBaibaokuStatusText(serverStatus, '未安装', false);
        updateBaibaokuStatusText(driverStatus, '未知', false);
        return true;
    }

    return false;
}

function applyPresetAutoBackupToggleAvailability(container, status) {
    const toggle = container.find('#bai_bai_toolkit_preset_auto_backup_enabled');
    const label = toggle.closest('label');
    const supported = isBaibaokuVersionAtLeast(status?.version, BAIBAOKU_PRESET_AUTO_BACKUP_MIN_VERSION);

    presetOptimizations.setPresetAutoBackupBackendAvailable(supported);

    if (!label.data('presetAutoBackupDefaultTitle')) {
        label.data('presetAutoBackupDefaultTitle', label.attr('title') || '');
    }

    toggle.prop('disabled', !supported);
    label
        .toggleClass('disabled', !supported)
        .css('opacity', supported ? '' : '0.55')
        .attr('title', supported
            ? label.data('presetAutoBackupDefaultTitle')
            : `\u9884\u8bbe\u81ea\u52a8\u5907\u4efd\u9700\u8981\u67cf\u5b9d\u5e93 v${BAIBAOKU_PRESET_AUTO_BACKUP_MIN_VERSION} \u6216\u66f4\u9ad8\u7248\u672c`);
}

function isBaibaokuVersionAtLeast(version, minimumVersion) {
    version = String(version || '').trim();
    minimumVersion = String(minimumVersion || '').trim();

    if (!version || !minimumVersion) {
        return false;
    }

    return !isVersionGreater(minimumVersion, version);
}

async function refreshBaibaokuPanelStatus(container, { force = false } = {}) {
    const panelState = getBaibaokuPanelState();
    const cache = panelState.cache;
    const cacheFresh = cache && Date.now() - Number(cache.updatedAt || 0) < BAIBAOKU_PANEL_STATUS_CACHE_MS;
    let refreshed = false;
    applyBaibaokuPanelLocalState(container);
    if (!force && cacheFresh && applyCachedBaibaokuPanelStatus(container, cache)) {
        return;
    }

    if (!force && panelState.pending) {
        await panelState.pending.catch(() => null);
        applyCachedBaibaokuPanelStatus(container, panelState.cache);
        return;
    }

    const serverStatus = container.find('#bai_bai_toolkit_baibaoku_server_status');
    const driverStatus = container.find('#bai_bai_toolkit_baibaoku_driver_status');
    const bridgeStatus = container.find('#bai_bai_toolkit_baibaoku_bridge_status');
    const accelerationToggle = container.find('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled');
    const lazyThemeLoadingToggle = container.find('#bai_bai_toolkit_baibaoku_lazy_theme_loading_enabled');
    const extensionManifestBundleToggle = container.find('#bai_bai_toolkit_extension_manifest_bundle_enabled');
    const characterListToggle = container.find('#bai_bai_toolkit_fast_character_list_enabled');
    const recentChatListToggle = container.find('#bai_bai_toolkit_recent_chat_list_acceleration_enabled');
    const progressiveChatLoadingToggle = container.find('#bai_bai_toolkit_progressive_chat_loading_enabled');
    const tokenizerBulkCountToggle = container.find('#bai_bai_toolkit_tokenizer_bulk_count_enabled');
    const chatKeyboardScanReductionToggle = container.find('#bai_bai_toolkit_chat_keyboard_scan_reduction_enabled');
    const bridge = getBaibaokuEarlyBridge();

    updateBaibaokuStatusText(bridgeStatus, bridge?.installed
        ? `已注入${bridge.version ? ` v${bridge.version}` : ''}`
        : '未注入', Boolean(bridge?.installed));

    const bridgeEnabled = typeof bridge?.isSettingsAccelerationEnabled === 'function'
        ? bridge.isSettingsAccelerationEnabled()
        : null;
    if (typeof bridgeEnabled === 'boolean') {
        settings.baibaokuSettingsAccelerationEnabled = bridgeEnabled;
        accelerationToggle.prop('checked', bridgeEnabled);
    }

    const bridgeLazyThemeLoadingEnabled = typeof bridge?.isLazyThemeLoadingEnabled === 'function'
        ? bridge.isLazyThemeLoadingEnabled()
        : null;
    if (typeof bridgeLazyThemeLoadingEnabled === 'boolean') {
        const activeLazyThemeLoadingEnabled = settings.baibaokuSettingsAccelerationEnabled !== false && bridgeLazyThemeLoadingEnabled;
        settings.baibaokuLazyThemeLoadingEnabled = activeLazyThemeLoadingEnabled;
        lazyThemeLoadingToggle.prop('checked', activeLazyThemeLoadingEnabled);
    }

    const bridgeExtensionManifestBundleEnabled = typeof bridge?.isExtensionManifestBundleEnabled === 'function'
        ? bridge.isExtensionManifestBundleEnabled()
        : null;
    if (typeof bridgeExtensionManifestBundleEnabled === 'boolean') {
        settings.extensionManifestBundleEnabled = bridgeExtensionManifestBundleEnabled;
        extensionManifestBundleToggle.prop('checked', bridgeExtensionManifestBundleEnabled);
    }

    const bridgeCharacterListEnabled = typeof bridge?.isCharacterListAccelerationEnabled === 'function'
        ? bridge.isCharacterListAccelerationEnabled()
        : null;
    if (typeof bridgeCharacterListEnabled === 'boolean') {
        settings.fastCharacterListEnabled = bridgeCharacterListEnabled;
        characterListToggle.prop('checked', bridgeCharacterListEnabled);
    }

    const bridgeRecentChatListEnabled = typeof bridge?.isRecentChatListAccelerationEnabled === 'function'
        ? bridge.isRecentChatListAccelerationEnabled()
        : null;
    if (typeof bridgeRecentChatListEnabled === 'boolean') {
        settings.recentChatListAccelerationEnabled = bridgeRecentChatListEnabled;
        recentChatListToggle.prop('checked', bridgeRecentChatListEnabled);
    }

    const bridgeTokenizerBulkCountEnabled = typeof bridge?.isTokenizerBulkCountEnabled === 'function'
        ? bridge.isTokenizerBulkCountEnabled()
        : null;
    if (typeof bridgeTokenizerBulkCountEnabled === 'boolean') {
        settings.tokenizerBulkCountEnabled = bridgeTokenizerBulkCountEnabled;
        tokenizerBulkCountToggle.prop('checked', bridgeTokenizerBulkCountEnabled);
    }

    const bridgeChatKeyboardScanReductionEnabled = typeof bridge?.isChatKeyboardScanReductionEnabled === 'function'
        ? bridge.isChatKeyboardScanReductionEnabled()
        : null;
    if (typeof bridgeChatKeyboardScanReductionEnabled === 'boolean') {
        settings.chatKeyboardScanReductionEnabled = bridgeChatKeyboardScanReductionEnabled;
        chatKeyboardScanReductionToggle.prop('checked', bridgeChatKeyboardScanReductionEnabled);
    }

    updateBaibaokuStatusText(serverStatus, '检测中', null);
    updateBaibaokuStatusText(driverStatus, '检测中', null);

    try {
        const status = await fetchBaibaokuStatus();
        markSaveGenerateBackendAvailable(globalThis[SAVE_GENERATE_FETCH_KEY], true, status);
        const driver = status?.driver;
        panelState.cache = {
            ...(panelState.cache || {}),
            status,
            offline: false,
            updatedAt: Date.now(),
        };
        refreshed = true;
        updateBaibaokuStatusText(serverStatus, `已连接${status?.version ? ` v${status.version}` : ''}`, true);
        updateBaibaokuStatusText(driverStatus, driver?.available
            ? `可用${driver.package ? ` (${driver.package})` : ''}`
            : '不可用', Boolean(driver?.available));
        applyPresetAutoBackupToggleAvailability(container, status);
        void maybeShowBaibaokuBackendUpdatePrompt(status);

        try {
            const config = await fetchBaibaokuFastConfig();
            const settingsEnabled = config.settingsAccelerationEnabled !== false;
            const lazyThemeLoadingEnabled = settingsEnabled && config.lazyThemeLoadingEnabled !== false;
            const extensionManifestBundleEnabled = config.extensionManifestBundleEnabled !== false;
            const characterListEnabled = config.characterListAccelerationEnabled !== false;
            const recentChatListEnabled = config.recentChatListAccelerationEnabled !== false;
            const progressiveChatLoadingEnabled = false;
            const tokenizerBulkCountEnabled = config.tokenizerBulkCountEnabled !== false;
            const chatKeyboardScanReductionEnabled = config.chatKeyboardScanReductionEnabled !== false;
            panelState.cache = {
                ...(panelState.cache || {}),
                config,
                offline: false,
                updatedAt: Date.now(),
            };
            settings.baibaokuSettingsAccelerationEnabled = settingsEnabled;
            settings.baibaokuLazyThemeLoadingEnabled = lazyThemeLoadingEnabled;
            settings.extensionManifestBundleEnabled = extensionManifestBundleEnabled;
            settings.fastCharacterListEnabled = characterListEnabled;
            settings.recentChatListAccelerationEnabled = recentChatListEnabled;
            settings.progressiveChatLoadingEnabled = progressiveChatLoadingEnabled;
            settings.tokenizerBulkCountEnabled = tokenizerBulkCountEnabled;
            settings.chatKeyboardScanReductionEnabled = chatKeyboardScanReductionEnabled;
            accelerationToggle.prop('checked', settingsEnabled);
            lazyThemeLoadingToggle.prop('checked', lazyThemeLoadingEnabled);
            extensionManifestBundleToggle.prop('checked', extensionManifestBundleEnabled);
            characterListToggle.prop('checked', characterListEnabled);
            recentChatListToggle.prop('checked', recentChatListEnabled);
            progressiveChatLoadingToggle.prop('checked', false).prop('disabled', true);
            tokenizerBulkCountToggle.prop('checked', tokenizerBulkCountEnabled);
            chatKeyboardScanReductionToggle.prop('checked', chatKeyboardScanReductionEnabled);
            applyFastChatGetOptimization();
            if (typeof bridge?.setSettingsAccelerationEnabled === 'function') {
                bridge.setSettingsAccelerationEnabled(settingsEnabled);
            } else if (bridge) {
                bridge.settingsAccelerationEnabled = settingsEnabled;
            }
            if (typeof bridge?.setLazyThemeLoadingEnabled === 'function') {
                bridge.setLazyThemeLoadingEnabled(lazyThemeLoadingEnabled);
            } else if (bridge) {
                bridge.lazyThemeLoadingEnabled = lazyThemeLoadingEnabled;
                if (!lazyThemeLoadingEnabled && typeof bridge.clearSettingsGetCache === 'function') {
                    bridge.clearSettingsGetCache('lazy-theme-loading-disabled');
                }
            }
            if (typeof bridge?.setCharacterListAccelerationEnabled === 'function') {
                bridge.setCharacterListAccelerationEnabled(characterListEnabled);
            } else if (bridge) {
                bridge.characterListAccelerationEnabled = characterListEnabled;
            }
            if (typeof bridge?.setExtensionManifestBundleEnabled === 'function') {
                bridge.setExtensionManifestBundleEnabled(extensionManifestBundleEnabled);
            } else if (bridge) {
                bridge.extensionManifestBundleEnabled = extensionManifestBundleEnabled;
            }
            if (typeof bridge?.setRecentChatListAccelerationEnabled === 'function') {
                bridge.setRecentChatListAccelerationEnabled(recentChatListEnabled);
            } else if (bridge) {
                bridge.recentChatListAccelerationEnabled = recentChatListEnabled;
            }
            if (typeof bridge?.setTokenizerBulkCountEnabled === 'function') {
                bridge.setTokenizerBulkCountEnabled(tokenizerBulkCountEnabled);
            } else if (bridge) {
                bridge.tokenizerBulkCountEnabled = tokenizerBulkCountEnabled;
            }
            if (typeof bridge?.setChatKeyboardScanReductionEnabled === 'function') {
                bridge.setChatKeyboardScanReductionEnabled(chatKeyboardScanReductionEnabled);
            } else if (bridge) {
                bridge.chatKeyboardScanReductionEnabled = chatKeyboardScanReductionEnabled;
            }
        } catch (error) {
            console.debug(`${LOG_PREFIX} Failed to read BaiBaoKu fast config`, error);
        }
    } catch {
        markSaveGenerateBackendAvailable(globalThis[SAVE_GENERATE_FETCH_KEY], false);
        updateBaibaokuStatusText(serverStatus, '未安装', false);
        updateBaibaokuStatusText(driverStatus, '未知', false);
        applyPresetAutoBackupToggleAvailability(container, null);
    }
    if (!refreshed) {
        panelState.cache = {
            ...(panelState.cache || {}),
            status: null,
            offline: true,
            updatedAt: Date.now(),
        };
    }
}

async function fetchBaibaokuStatus() {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), BAIBAOKU_STATUS_TIMEOUT_MS);

    try {
        const response = await fetch(BAIBAOKU_STATUS_URL, {
            method: 'GET',
            cache: 'no-store',
            signal: controller.signal,
        });
        const payload = await response.json().catch(() => null);

        if (!response.ok || payload?.ok !== true) {
            throw new Error(payload?.error?.message || `HTTP ${response.status}`);
        }

        return payload.data;
    } finally {
        clearTimeout(timer);
    }
}

async function maybeShowBaibaokuBackendUpdatePrompt(status) {
    const version = String(status?.version || '').trim();
    if (!version || !isVersionGreater(BAIBAOKU_REQUIRED_BACKEND_VERSION, version)) {
        return;
    }

    const promptKey = `${version}->${BAIBAOKU_REQUIRED_BACKEND_VERSION}`;
    if (extensionState.baibaokuBackendUpdatePromptShown === promptKey
        || extensionState.baibaokuBackendUpdatePromptPromise) {
        return;
    }

    extensionState.baibaokuBackendUpdatePromptShown = promptKey;
    extensionState.baibaokuBackendUpdatePromptPromise = callGenericPopup(`
        <div class="bai_bai_toolkit_baibaoku_update_prompt">
            <h3>柏宝库需要更新！</h3>
            <p>当前版本存在部分BUG，请重启酒馆让柏宝库自动更新到最新版本，注意不是刷新网页，是重启酒馆后台</p>
        </div>
    `, POPUP_TYPE.TEXT, '', {
        okButton: '知道了',
    }).catch(error => {
        console.debug(`${LOG_PREFIX} Failed to show BaiBaoKu backend update prompt`, error);
    }).finally(() => {
        extensionState.baibaokuBackendUpdatePromptPromise = null;
    });

    await extensionState.baibaokuBackendUpdatePromptPromise;
}

function showBaibaokuInstallHelpPrompt() {
    callGenericPopup('请看帖子标注内容', POPUP_TYPE.TEXT, '', {
        okButton: '知道了',
    }).catch(error => {
        console.debug(`${LOG_PREFIX} Failed to show BaiBaoKu install help prompt`, error);
    });
}

async function fetchBaibaokuFastConfig() {
    const response = await fetch(BAIBAOKU_FAST_CONFIG_URL, {
        method: 'GET',
        cache: 'no-store',
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

async function saveBaibaokuFastConfig(config) {
    const headers = new Headers(getRequestHeaders());
    if (!headers.has('content-type')) {
        headers.set('content-type', 'application/json');
    }

    const response = await fetch(BAIBAOKU_FAST_CONFIG_URL, {
        method: 'POST',
        headers,
        cache: 'no-store',
        body: JSON.stringify(config || {}),
    });
    const payload = await response.json().catch(() => null);

    if (!response.ok || payload?.ok !== true) {
        throw new Error(payload?.message || payload?.error?.message || `HTTP ${response.status}`);
    }

    return payload.data || {};
}

function updateBaibaokuStatusText(element, text, ok) {
    element.text(text);
    const color = ok === null
        ? ''
        : ok
            ? 'var(--SmartThemeQuoteColor)'
            : '#ff4d4f';
    element.each((_, node) => {
        if (!node?.style) {
            return;
        }
        if (color) {
            node.style.setProperty('color', color, 'important');
        } else {
            node.style.removeProperty('color');
        }
    });
}

export {
    applyBaibaokuPanelLocalState,
    applyCachedBaibaokuPanelStatus,
    applyPresetAutoBackupToggleAvailability,
    fetchBaibaokuFastConfig,
    fetchBaibaokuStatus,
    getBaibaokuPanelState,
    initializeBaibaokuPanel,
    isBaibaokuVersionAtLeast,
    maybeShowBaibaokuBackendUpdatePrompt,
    refreshBaibaokuPanelStatus,
    saveBaibaokuFastConfig,
    showBaibaokuInstallHelpPrompt,
    updateBaibaokuStatusText,
};
