// 内置柏宝砚入口:由柏宝箱 src/floorManager.js 按「新版楼层管理器」开关启停。
// 与独立版的区别:不注入自己的魔法棒菜单(共用柏宝箱的「楼层管理器」入口)、
// 不做独立更新检查、Vue App 第一次打开时才挂载(开了悬浮球则启动即挂载)。
import App from '@pen/App.vue';
import { initializePenSettings, penSettings } from '@pen/api/settings';
import { initializeSharedChannels } from '@pen/api/sharedChannels';
import { bindEditButtons, unbindEditButtons } from '@pen/editButton';
import { openPenFromMenu } from '@pen/menu';
import { closePen, ui } from '@pen/state/ui';
import { guardEditableArrowKeys } from '@pen/st/keyboard';
import { versionedAssetUrl } from '@pen/version';
import '@pen/styles/base.css';
import '@pen/styles/theme.css';
import { createApp, watch, type App as VueApp } from 'vue';

// 与独立版同名:二者由 floorManager 保证不会同时运行
const HOST_ID = 'bby-app-host';

let started = false;
let app: VueApp | null = null;

function ensureMounted(): void {
  if (app) return;
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    document.body.appendChild(host);
  }

  host.style.setProperty('display', 'contents', 'important');
  const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
  shadow.textContent = '';
  guardEditableArrowKeys(shadow);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = versionedAssetUrl('./index.css', import.meta.url);
  shadow.appendChild(link);

  const container = document.createElement('div');
  shadow.appendChild(container);
  app = createApp(App);
  app.mount(container);
}

export function startPen(): void {
  if (started) return;
  started = true;
  bindEditButtons();
  void Promise.all([initializeSharedChannels(), initializePenSettings()]).then(syncMount);
}

export function stopPen(): void {
  if (!started) return;
  started = false;
  unbindEditButtons();
  closePen();
  app?.unmount();
  app = null;
  document.getElementById(HOST_ID)?.remove();
}

export function openPenWindow(): void {
  startPen();
  openPenFromMenu();
}

// 菜单和编辑区按钮都只改 ui 状态;第一次打开时在这里同步挂载 App。
// openPen/openFloorPicker 最后才置 ui.open,此时其余状态已就绪。
// 开了悬浮球则设置读完就挂载(悬浮球在 App 里,要跟主题)。
function syncMount(): void {
  if (started && (ui.open || penSettings.showOrb)) ensureMounted();
}

watch(() => ui.open || penSettings.showOrb, syncMount, { flush: 'sync' });

window.addEventListener('pagehide', () => app?.unmount(), { once: true });
