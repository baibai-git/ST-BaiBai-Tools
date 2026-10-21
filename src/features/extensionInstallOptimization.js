// 柏宝库页的「插件安装优化」开关:只读写柏宝库的 interceptEnabled,代理、镜像等全部由柏宝库自动处理。
import { LOG_PREFIX } from './constants.js';
import { fetchExtensionManagerApi } from './extensionOps.js';

const EVENT_NAMESPACE = '.baiBaiToolkitExtensionInstallOptimization';
// 读到后端状态之前先显示上次读到的值(没读过就按后端默认的开),免得每次打开页面开关都从关跳到开
const LAST_STATE_KEY = 'bai_bai_toolkit_extension_install_optimization_enabled';

function initializeExtensionInstallOptimization(container) {
    const toggle = container.find('#bai_bai_toolkit_extension_install_optimization_enabled');
    if (!toggle.length) {
        return;
    }

    const label = toggle.closest('label');
    label.data('defaultTitle', label.attr('title') ?? '');
    toggle.prop('checked', localStorage.getItem(LAST_STATE_KEY) !== 'false');

    toggle.off(`input${EVENT_NAMESPACE}`)
        .on(`input${EVENT_NAMESPACE}`, () => {
            void saveInstallOptimization(toggle);
        });

    // 打开柏宝库页时才读,不占酒馆启动时的请求
    container.find('.bai_bai_toolkit_tab[data-target="bai_bai_toolkit_tab_baibaoku"]')
        .off(`click${EVENT_NAMESPACE}`)
        .on(`click${EVENT_NAMESPACE}`, () => {
            if (!toggle.data('loaded')) {
                void loadInstallOptimization(toggle);
            }
        });

    container.find('#bai_bai_toolkit_baibaoku_refresh_status')
        .off(`click${EVENT_NAMESPACE}`)
        .on(`click${EVENT_NAMESPACE}`, () => {
            void loadInstallOptimization(toggle);
        });
}

async function loadInstallOptimization(toggle) {
    if (toggle.data('busy')) {
        return;
    }

    toggle.data({ busy: true, loaded: true }).prop('disabled', true);
    try {
        applyInstallOptimizationState(toggle, await fetchExtensionManagerApi('manager/config', { timeoutMs: 10_000 }));
    } catch (error) {
        const reason = error?.unsupported
            ? '需要先安装柏宝库(或更新到最新版)。'
            : `读取失败:${error?.message || error}`;
        applyInstallOptimizationState(toggle, null, reason);
        console.debug(`${LOG_PREFIX} Failed to load extension install optimization`, error);
    } finally {
        toggle.removeData('busy');
    }
}

async function saveInstallOptimization(toggle) {
    const enabled = toggle.prop('checked');
    toggle.data('busy', true).prop('disabled', true);
    try {
        applyInstallOptimizationState(toggle, await fetchExtensionManagerApi('manager/config', {
            method: 'POST',
            body: { interceptEnabled: enabled },
        }));
    } catch (error) {
        toggle.prop('checked', !enabled).prop('disabled', false);
        toastr.warning(String(error?.message || error), '插件安装优化没有保存');
        console.debug(`${LOG_PREFIX} Failed to save extension install optimization`, error);
    } finally {
        toggle.removeData('busy');
    }
}

function applyInstallOptimizationState(toggle, state, reason = '') {
    const disabledReason = reason || (state && !state.isAdmin ? '只有管理员可以修改这个开关。' : '');
    const label = toggle.closest('label');
    const defaultTitle = label.data('defaultTitle');
    const enabled = Boolean(state) && state.interceptEnabled !== false;
    localStorage.setItem(LAST_STATE_KEY, String(enabled));

    toggle.prop('checked', enabled)
        .prop('disabled', Boolean(disabledReason));
    label.toggleClass('disabled', Boolean(disabledReason))
        .css('opacity', disabledReason ? '0.55' : '')
        .attr('title', disabledReason ? `${disabledReason}\n${defaultTitle}` : defaultTitle);
}

export {
    initializeExtensionInstallOptimization,
};
