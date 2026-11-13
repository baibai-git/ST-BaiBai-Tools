// 楼层管理器调度:魔法棒里只有一个「楼层管理器」入口(由 floorDirectory 注入),
// 「新版楼层管理器」开着时打开内置柏宝砚,关着时打开旧版弹窗。
//
// 装了独立版柏宝砚(且已启用)时内置砚一律不启动、入口回到旧版:旧的独立版不认识内置版,
// 两边同时跑会抢同一个 Shadow Root、重复插编辑区按钮。卸载独立版刷新后内置版自动接管,
// 设置(extensionSettings.baibai_pen)和共享渠道两边是同一份,不用迁移。
import { extension_settings, extensionNames } from '@sillytavern/scripts/extensions';
import * as floorDirectory from './floorDirectory.js';
import { openPenWindow, startPen, stopPen } from './pen/index.ts';

// 目录名:手动放的叫 ST-BaiBai-Pen,用仓库地址安装的叫 ST-BaiBai-Inkwell
const STANDALONE_PEN_PATTERN = /^third-party\/st-baibai-(pen|inkwell)$/i;

let settings = {};
let LOG_PREFIX = '[FloorManager]';
let saveSettings = () => {};

/** 已安装且已启用的独立版柏宝砚的扩展名;没有返回 null */
function findStandalonePen() {
    // extensionNames 是酒馆启动时 discover 的结果,能跑到这里说明那次已经成功
    const name = extensionNames.find(item => STANDALONE_PEN_PATTERN.test(item));
    if (!name || extension_settings.disabledExtensions?.includes(name)) {
        return null;
    }
    return name;
}

function isNewFloorManagerActive() {
    return settings.newFloorManagerEnabled !== false && !findStandalonePen();
}

function openFloorManager() {
    if (isNewFloorManagerActive()) {
        openPenWindow();
    } else {
        floorDirectory.openFloorDirectoryDialog();
    }
}

export function configureFloorManager(context = {}) {
    settings = context.settings ?? settings;
    LOG_PREFIX = context.logPrefix ?? LOG_PREFIX;
    saveSettings = context.saveSettings ?? saveSettings;
    floorDirectory.configureFloorDirectory({
        settings,
        extensionState: context.extensionState,
        logPrefix: LOG_PREFIX,
        open: openFloorManager,
    });
}

export function applyFloorManager() {
    const standalone = findStandalonePen();
    if (standalone) {
        console.debug(`${LOG_PREFIX} Standalone pen ${standalone} is active, built-in pen stays off`);
    }
    if (isNewFloorManagerActive()) {
        startPen();
    } else {
        stopPen();
    }
}

export function installFloorManager() {
    floorDirectory.installFloorDirectory();
    applyFloorManager();
}

export function bindFloorManagerSettings() {
    const standalone = findStandalonePen();
    $('#bai_bai_toolkit_new_floor_manager_standalone_hint').toggle(Boolean(standalone));
    $('#bai_bai_toolkit_new_floor_manager_enabled')
        .prop('checked', settings.newFloorManagerEnabled !== false)
        .on('input', function () {
            settings.newFloorManagerEnabled = Boolean($(this).prop('checked'));
            saveSettings();
            applyFloorManager();
        });
}
