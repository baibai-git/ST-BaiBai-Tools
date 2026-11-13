import { openPen } from '@pen/state/ui';
import { getContext } from '@pen/st/context';
import { penIconSvg } from '@pen/penIcon';

const ACTION_CLASS = 'bby-message-rewrite-action';
const STYLE_ID = 'bby-message-rewrite-action-style';
const BOTTOM_CONTAINER_SELECTOR = '.bai-bai-toolkit-message-edit-bottom-actions';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
#chat .${ACTION_CLASS} {
  color: var(--SmartThemeQuoteColor);
}
#chat .${ACTION_CLASS}:hover {
  opacity: 1;
}
`;
  document.head.append(style);
}

function createAction(kind: 'top' | 'bottom'): HTMLDivElement {
  const button = document.createElement('div');
  button.className = `menu_button ${ACTION_CLASS}`;
  button.innerHTML = penIconSvg(15);
  button.dataset.bbyPlacement = kind;
  button.title = 'AI 标注改写';
  button.setAttribute('role', 'button');
  button.setAttribute('tabindex', '0');

  const activate = () => {
    const editor = button.closest('.mes')?.querySelector<HTMLTextAreaElement>('#curEditTextarea');
    const message = button.closest<HTMLElement>('.mes');
    const floor = Number(message?.getAttribute('mesid'));
    const context = getContext();
    const chatMessage = context?.chat?.[floor];
    if (!editor || !Number.isInteger(floor) || !chatMessage) {
      toastr?.warning?.('请先编辑一条消息', '柏宝砚');
      return;
    }
    openPen(
      editor.value,
      floor,
      message?.querySelector<HTMLElement>('.name_text')?.textContent?.trim() || chatMessage.name,
      context?.getCurrentChatId?.() ?? '',
    );
  };

  button.addEventListener('click', activate);
  button.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      activate();
    }
  });
  return button;
}

function ensureButton(container: Element, kind: 'top' | 'bottom'): void {
  if (container.querySelector(`.${ACTION_CLASS}[data-bby-placement="${kind}"]`)) return;
  const button = createAction(kind);
  container.insertBefore(button, container.firstElementChild);
}

function syncButtons(): void {
  const editor = document.querySelector<HTMLTextAreaElement>('#chat #curEditTextarea');
  document.querySelectorAll(`#chat .${ACTION_CLASS}`).forEach(button => {
    if (!editor || button.closest('.mes') !== editor.closest('.mes')) button.remove();
  });
  if (!editor) return;

  const message = editor.closest('.mes');
  const floor = Number(message?.getAttribute('mesid'));
  const chatMessage = getContext()?.chat?.[floor];
  if (!chatMessage) return;
  const top = message?.querySelector('.mes_edit_buttons');
  if (top) ensureButton(top, 'top');

  const bottom = message?.querySelector(BOTTOM_CONTAINER_SELECTOR);
  if (bottom) ensureButton(bottom, 'bottom');
}

let observer: MutationObserver | null = null;
let retryTimer = 0;

export function bindEditButtons(): void {
  if (observer || retryTimer) return;
  ensureStyle();
  const install = () => {
    const chat = document.querySelector('#chat');
    if (!chat) return false;
    let frame = 0;
    observer = new MutationObserver(() => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        syncButtons();
      });
    });
    observer.observe(chat, { childList: true, subtree: true, attributes: true });
    syncButtons();
    return true;
  };

  if (install()) return;
  retryTimer = window.setInterval(() => {
    if (!install()) return;
    window.clearInterval(retryTimer);
    retryTimer = 0;
  }, 500);
}

/** 关掉「新版楼层管理器」时撤掉观察器和已插入的按钮 */
export function unbindEditButtons(): void {
  observer?.disconnect();
  observer = null;
  window.clearInterval(retryTimer);
  retryTimer = 0;
  document.querySelectorAll(`.${ACTION_CLASS}`).forEach(button => button.remove());
}
