import * as chatOptimizations from '../chat/index.js';
import * as presetOptimizations from '../preset/index.js';
import { bindPresetBackupRetentionSettings } from '../preset/backupRetention.js';
import settingsTemplateHtml from '../settings.html?raw';
import * as worldInfoPageOptimization from '../worldinfo/index.js';
import { renderExtensionTemplateAsync } from '@sillytavern/scripts/extensions';
import { setBaibaokuCharacterListAccelerationEnabled, setBaibaokuChatKeyboardScanReductionEnabled, setBaibaokuExtensionManifestBundleEnabled, setBaibaokuLazyThemeLoadingEnabled, setBaibaokuProgressiveChatLoadingEnabled, setBaibaokuRecentChatListAccelerationEnabled, setBaibaokuSettingsAccelerationEnabled, setBaibaokuTokenizerBulkCountEnabled } from './backendToggles.js';
import { applyBaibaokuPanelLocalState, initializeBaibaokuPanel } from './baibaokuPanel.js';
import { applyCharacterListAvatarLazyLoadOptimization, applyCharacterSearchInputOptimization } from './characterList.js';
import { LOG_PREFIX } from './constants.js';
import { applyCustomCssInputOptimization } from './customCss.js';
import { applyDescriptionCodeMirrorEditorOptimization } from './descEditor.js';
import { applyFastChatGetOptimization } from './fastChat.js';
import { bindGenerateBlacklistRetrySettings } from './generateBlacklistRetry.js';
import { bindGenerateRetrySettings } from './generateRetry.js';
import { applyTranslateMessageUpdatedOptimization, patchAutoCompletePositioning, patchPowerUserResizeHandler, restoreAutoCompletePositioning, restorePowerUserResizeHandler } from './miscPatches.js';
import { startPerformanceTrace, stopPerformanceTraceAndExport, updatePerformanceTraceControls } from './perfTrace.js';
import { applyRegexQuickOperationOptimization } from './regexQuickOps.js';
import { isChatLossMitigationSupported } from './reloadGuard.js';
import { MODULE_NAME, extensionState, saveExtensionSettings, settings } from './state.js';
import { applyBaibaokuLazyThemeLoadingOptimization } from './theme.js';
import { initializeUpdateUI, queueExtensionUpdatePrompt } from './updateCheck.js';

async function loadVersionedSettingsTemplate() {
    if (typeof settingsTemplateHtml === 'string' && settingsTemplateHtml.length > 0) {
        return settingsTemplateHtml;
    }

    console.debug(`${LOG_PREFIX} Bundled settings template unavailable; falling back to SillyTavern template loader.`);
    return renderExtensionTemplateAsync(MODULE_NAME, 'settings');
}

async function renderSettingsPanel() {
    const root = $('#extensions_settings2');

    if (!root.length) {
        return;
    }

    let container = $('#bai_bai_toolkit_container');

    if (!container.length) {
        container = $('<div id="bai_bai_toolkit_container" class="extension_container"></div>');
        root.append(container);
    }

    const template = await loadVersionedSettingsTemplate();
    container.empty().append(template);

    // 初始化版本信息和更新逻辑

    // Initialize tabs
    const tabs = container.find('.bai_bai_toolkit_tab');
    const tabContents = container.find('.bai_bai_toolkit_tab_content');

    tabs.on('click', function () {
        const tab = $(this);
        const targetId = tab.data('target');

        // Update active class on tabs
        tabs.removeClass('active').css({
            'color': '',
            'border-bottom': '2px solid transparent',
            'opacity': '0.6'
        });

        tab.addClass('active').css({
            'color': 'var(--SmartThemeQuoteColor)',
            'border-bottom': '2px solid var(--SmartThemeQuoteColor)',
            'opacity': '1'
        });

        // Show/hide contents
        tabContents.hide();
        container.find(`#${targetId}`).show();
    });

    initializeUpdateUI(container);
    initializeBaibaokuPanel(container);

    $('#bai_bai_toolkit_update_prompt_on_available_enabled')
        .prop('checked', settings.updatePromptOnAvailableEnabled)
        .on('input', function () {
            settings.updatePromptOnAvailableEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();

            if (settings.updatePromptOnAvailableEnabled && extensionState.silentUpdateResult?.isUpToDate === false) {
                queueExtensionUpdatePrompt();
            }
        });

    $('#bai_bai_toolkit_resize_guard_enabled')
        .prop('checked', settings.resizeGuardEnabled)
        .on('input', function () {
            settings.resizeGuardEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyFeatureSettings();
        });

    const chatLossMitigationSupported = isChatLossMitigationSupported();
    const chatLossMitigationToggle = $('#bai_bai_toolkit_chat_loss_mitigation_enabled');
    chatLossMitigationToggle
        .prop('checked', chatLossMitigationSupported && settings.chatLossMitigationEnabled)
        .prop('disabled', !chatLossMitigationSupported)
        .on('input', function () {
            if (!isChatLossMitigationSupported()) {
                return;
            }
            settings.chatLossMitigationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });
    chatLossMitigationToggle.closest('label')
        .toggleClass('disabled', !chatLossMitigationSupported)
        .css('opacity', chatLossMitigationSupported ? '' : '0.55')
        .find('span')
        .text(chatLossMitigationSupported ? '缓解酒馆丢失聊天问题' : '缓解酒馆丢失聊天问题（1.16 及以上版本可用）');

    $('#bai_bai_toolkit_description_codemirror_editor_enabled')
        .prop('checked', settings.descriptionCodeMirrorEditorEnabled)
        .on('input', function () {
            settings.descriptionCodeMirrorEditorEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyDescriptionCodeMirrorEditorOptimization();
        });

    $('#bai_bai_toolkit_custom_css_input_optimization_enabled')
        .prop('checked', settings.customCssInputOptimizationEnabled)
        .on('input', function () {
            settings.customCssInputOptimizationEnabled = Boolean($(this).prop('checked'));

            // Auto-disable shadow property optimization if CodeMirror editor is disabled
            if (!settings.customCssInputOptimizationEnabled && settings.customCssShadowPropertyEnabled) {
                settings.customCssShadowPropertyEnabled = false;
                $('#bai_bai_toolkit_custom_css_shadow_property_enabled').prop('checked', false);
            }

            saveExtensionSettings();
            applyCustomCssInputOptimization();
        });

    $('#bai_bai_toolkit_custom_css_shadow_property_enabled')
        .prop('checked', settings.customCssShadowPropertyEnabled)
        .on('input', function () {
            settings.customCssShadowPropertyEnabled = Boolean($(this).prop('checked'));

            // Auto-enable CodeMirror editor if shadow property optimization is enabled
            if (settings.customCssShadowPropertyEnabled && !settings.customCssInputOptimizationEnabled) {
                settings.customCssInputOptimizationEnabled = true;
                $('#bai_bai_toolkit_custom_css_input_optimization_enabled').prop('checked', true);
            }

            saveExtensionSettings();
            applyCustomCssInputOptimization();
        });

    $('#bai_bai_toolkit_world_info_drawer_optimization_enabled')
        .prop('checked', settings.worldInfoDrawerOptimizationEnabled || settings.worldInfoPageOptimizationEnabled)
        .on('input', function () {
            const enabled = Boolean($(this).prop('checked'));
            settings.worldInfoDrawerOptimizationEnabled = enabled;
            settings.worldInfoPageOptimizationEnabled = enabled;
            if (!enabled) {
                worldInfoPageOptimization.initializeDeferredWorldInfoSelect2(document);
            }
            saveExtensionSettings();
            worldInfoPageOptimization.applyWorldInfoDrawerOptimization();
            worldInfoPageOptimization.applyWorldInfoLazySelect2Optimization();
            worldInfoPageOptimization.applyWorldInfoCharacterFilterOptionsOptimization();
            worldInfoPageOptimization.applyWorldInfoPageOptimization();
        });

    worldInfoPageOptimization.bindWorldInfoPageOptimizationSettings({ saveSettings: saveExtensionSettings });

    $('#bai_bai_toolkit_world_info_list_optimization_enabled')
        .prop('checked', settings.worldInfoListOptimizationEnabled)
        .on('input', function () {
            settings.worldInfoListOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            worldInfoPageOptimization.applyWorldInfoListOptimization();
            worldInfoPageOptimization.refreshWorldInfoEditorIfOpen();
        });

    $('#bai_bai_toolkit_world_info_search_replace_enabled')
        .prop('checked', settings.worldInfoSearchReplaceEnabled !== false)
        .on('input', function () {
            settings.worldInfoSearchReplaceEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            worldInfoPageOptimization.applyWorldInfoListOptimization();
        });

    $('#bai_bai_toolkit_character_search_input_optimization_enabled')
        .prop('checked', settings.characterSearchInputOptimizationEnabled)
        .on('input', function () {
            settings.characterSearchInputOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyCharacterSearchInputOptimization();
        });

    $('#bai_bai_toolkit_baibaoku_settings_acceleration_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuSettingsAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu settings acceleration config`, error);
                checkbox.prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_baibaoku_lazy_theme_loading_enabled')
        .prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false && settings.baibaokuLazyThemeLoadingEnabled !== false)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuLazyThemeLoadingEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu lazy theme loading config`, error);
                checkbox.prop('checked', settings.baibaokuSettingsAccelerationEnabled !== false && settings.baibaokuLazyThemeLoadingEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_extension_manifest_bundle_enabled')
        .prop('checked', settings.extensionManifestBundleEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuExtensionManifestBundleEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu extension manifest bundle config`, error);
                checkbox.prop('checked', settings.extensionManifestBundleEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_fast_character_list_enabled')
        .prop('checked', settings.fastCharacterListEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuCharacterListAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu character list acceleration config`, error);
                checkbox.prop('checked', settings.fastCharacterListEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_recent_chat_list_acceleration_enabled')
        .prop('checked', settings.recentChatListAccelerationEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuRecentChatListAccelerationEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu recent chat list acceleration config`, error);
                checkbox.prop('checked', settings.recentChatListAccelerationEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_progressive_chat_loading_enabled')
        .prop('checked', false)
        .prop('disabled', true)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuProgressiveChatLoadingEnabled(false);
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu progressive chat loading config`, error);
            } finally {
                checkbox.prop('checked', false);
                checkbox.prop('disabled', true);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_save_generate_enabled')
        .prop('checked', settings.saveGenerateEnabled)
        .on('input', function () {
            settings.saveGenerateEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyBaibaokuPanelLocalState(container);
        });

    $('#bai_bai_toolkit_preset_auto_backup_enabled')
        .prop('checked', settings.presetAutoBackupEnabled !== false)
        .on('input', function () {
            settings.presetAutoBackupEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            presetOptimizations.applyPresetAutoBackup();
            applyBaibaokuPanelLocalState(container);
        });

    bindPresetBackupRetentionSettings(container);

    $('#bai_bai_toolkit_tokenizer_bulk_count_enabled')
        .prop('checked', settings.tokenizerBulkCountEnabled)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuTokenizerBulkCountEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu tokenizer bulk count config`, error);
                checkbox.prop('checked', settings.tokenizerBulkCountEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_chat_keyboard_scan_reduction_enabled')
        .prop('checked', settings.chatKeyboardScanReductionEnabled !== false)
        .on('input', async function () {
            const checkbox = $(this);
            checkbox.prop('disabled', true);
            try {
                await setBaibaokuChatKeyboardScanReductionEnabled(Boolean(checkbox.prop('checked')));
            } catch (error) {
                console.debug(`${LOG_PREFIX} Failed to save BaiBaoKu chat keyboard scan reduction config`, error);
                checkbox.prop('checked', settings.chatKeyboardScanReductionEnabled !== false);
            } finally {
                checkbox.prop('disabled', false);
                applyBaibaokuPanelLocalState(container);
            }
        });

    $('#bai_bai_toolkit_character_list_avatar_lazy_load_enabled')
        .prop('checked', settings.characterListAvatarLazyLoadEnabled)
        .on('input', function () {
            settings.characterListAvatarLazyLoadEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyCharacterListAvatarLazyLoadOptimization();
        });

    chatOptimizations.bindChatOptimizationSettings({ saveSettings: saveExtensionSettings });
    bindGenerateRetrySettings({ saveSettings: saveExtensionSettings });
    bindGenerateBlacklistRetrySettings({ saveSettings: saveExtensionSettings });

    $('#bai_bai_toolkit_save_request_gzip_enabled')
        .prop('checked', settings.saveRequestGzipEnabled)
        .on('input', function () {
            settings.saveRequestGzipEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
        });

    $('#bai_bai_toolkit_translate_message_updated_optimization_enabled')
        .prop('checked', settings.translateMessageUpdatedOptimizationEnabled)
        .on('input', function () {
            settings.translateMessageUpdatedOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyTranslateMessageUpdatedOptimization();
        });

    $('#bai_bai_toolkit_perf_trace_start')
        .on('click', function () {
            if ($(this).hasClass('disabled')) {
                return;
            }
            startPerformanceTrace();
        });

    $('#bai_bai_toolkit_perf_trace_stop')
        .on('click', function () {
            if ($(this).hasClass('disabled')) {
                return;
            }
            stopPerformanceTraceAndExport();
        });

    updatePerformanceTraceControls();

    presetOptimizations.bindPresetOptimizationSettings({ saveSettings: saveExtensionSettings });

    $('#bai_bai_toolkit_regex_quick_operation_enabled')
        .prop('checked', settings.regexQuickOperationOptimizationEnabled)
        .on('input', function () {
            settings.regexQuickOperationOptimizationEnabled = Boolean($(this).prop('checked'));
            saveExtensionSettings();
            applyRegexQuickOperationOptimization();
        });

    chatOptimizations.applyChatOptimizationCompatibilityIndicators(container);
}

function applyFeatureSettings() {
    if (settings.resizeGuardEnabled) {
        patchAutoCompletePositioning();
        patchPowerUserResizeHandler();
    } else {
        restoreAutoCompletePositioning();
        restorePowerUserResizeHandler();
    }

    chatOptimizations.applyFastChatListScrollOptimization();
    worldInfoPageOptimization.applyWorldInfoDrawerOptimization();
    worldInfoPageOptimization.applyWorldInfoLazySelect2Optimization();
    worldInfoPageOptimization.applyWorldInfoCharacterFilterOptionsOptimization();
    worldInfoPageOptimization.applyWorldInfoPageOptimization();
    worldInfoPageOptimization.applyWorldInfoListOptimization();
    applyCharacterSearchInputOptimization();
    applyCharacterListAvatarLazyLoadOptimization();
    applyFastChatGetOptimization();
    applyDescriptionCodeMirrorEditorOptimization();
    applyCustomCssInputOptimization();
    presetOptimizations.applyPresetScrollOptimization();
    presetOptimizations.applyPresetInterfaceCollapse();
    presetOptimizations.applyPresetDragOptimization();
    presetOptimizations.applyPresetGrouping();
    presetOptimizations.applyPresetBackupPreviewUi();
    presetOptimizations.applyPresetAutoBackup();
    presetOptimizations.applyPresetSwitchOptimization();
    presetOptimizations.applyPresetToggleOptimization();
    presetOptimizations.applyPresetPromptCodeMirrorEditorOptimization();
    presetOptimizations.applyPresetSaveOptimization();
    applyRegexQuickOperationOptimization();
    chatOptimizations.applyWelcomeRecentChatDirectOpenOptimization();
    chatOptimizations.applyChatDeleteEditFlowOptimization();
    applyTranslateMessageUpdatedOptimization();
    chatOptimizations.applyReduceLoadedFloors();
    chatOptimizations.applyLongChatDomRenderOptimization();
    chatOptimizations.applyMessageCompletionScrollToMiddle();
    chatOptimizations.applyMobileAutoKeyboardSuppression();
    chatOptimizations.applyMobileMessageEditScrollGuard();
    chatOptimizations.applyMessageEditBottomActions();
    chatOptimizations.applyMessageTripleClickEdit();
    chatOptimizations.applyMessageCompletionSound();
    applyBaibaokuLazyThemeLoadingOptimization();
}

export {
    applyFeatureSettings,
    loadVersionedSettingsTemplate,
    renderSettingsPanel,
};
