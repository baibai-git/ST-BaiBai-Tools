import { getContext, setMessageText, type STContext, type STMessage } from '@pen/st/context';
import { openPen } from '@pen/state/ui';

function findMessage(floor: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`#chat .mes[mesid="${floor}"]`);
}

function activeEditorText(floor: number): string | null {
  return findMessage(floor)?.querySelector<HTMLTextAreaElement>('#curEditTextarea')?.value ?? null;
}

/**
 * 保存源自 ST 原生编辑框的改写时，先把最终文本同步回编辑框，再让 ST
 * 通过“取消编辑”流程收尾。此时 chat.mes 已经保存为新文本，所以取消按钮
 * 只负责重绘和清理内部编辑状态，不会撤销改写，也不会再次执行编辑正则。
 *
 * 旧版 ST 若没有取消按钮，则保留已同步的 textarea，交给用户随后正常完成；
 * 关键是不能调用 updateMessageBlock 提前删掉 textarea，否则 ST 会退回读取
 * 渲染后的 .mes_text.text()，导致 HTML、换行和空白丢失。
 */
function settleActiveEditor(floor: number, text: string): boolean {
  const message = findMessage(floor);
  const editor = message?.querySelector<HTMLTextAreaElement>('#curEditTextarea');
  if (!message || !editor) return false;

  editor.value = text;
  message.querySelector<HTMLElement>('.mes_edit_cancel')?.click();
  return true;
}

export function getFloorSourceText(floor: number): string | null {
  const message = getContext()?.chat?.[floor];
  if (!message) return null;
  return activeEditorText(floor) ?? message.mes ?? '';
}

/** 从楼层列表直接读取聊天数据，不要求该楼层已经渲染到 DOM。 */
export function openFloorInPen(floor: number): boolean {
  const context = getContext();
  const chatMessage = context?.chat?.[floor];
  if (!context || !chatMessage) return false;

  openPen(
    chatMessage.mes ?? '',
    floor,
    chatMessage.name || (chatMessage.is_user ? '你' : 'AI'),
    context.getCurrentChatId?.() ?? '',
  );
  return true;
}

export type ApplyFloorResult = 'saved' | 'chat-changed' | 'floor-changed' | 'unavailable';

async function emitMessageEvent(
  context: STContext,
  event: unknown,
  floor: number,
): Promise<void> {
  if (event !== undefined && context.eventSource?.emit) {
    await context.eventSource.emit(event, floor);
  }
}

async function refreshRenderedMessage(
  context: STContext,
  message: STMessage,
  floor: number,
): Promise<void> {
  const existing = findMessage(floor);
  if (!existing) return;

  if (typeof context.updateMessageBlock === 'function') {
    try {
      await context.updateMessageBlock(floor, message);
      return;
    } catch {
      // 局部刷新失败时回退到完整重载。
    }
  }

  try {
    await context.reloadCurrentChat?.();
  } catch (error) {
    console.warn('[柏宝砚] 楼层已保存，但界面刷新失败', error);
  }
}

/**
 * 直接更新聊天数组并持久化，不要求目标楼层存在于 DOM。
 * 若目标楼层恰好在 ST 编辑态，则以编辑区内容作为并发校验来源。
 */
export async function applyFloorText(
  floor: number,
  expectedText: string,
  nextText: string,
  expectedChatId = '',
): Promise<ApplyFloorResult> {
  const context = getContext();
  if (!context?.saveChat) return 'unavailable';
  if (expectedChatId && context.getCurrentChatId?.() !== expectedChatId) {
    return 'chat-changed';
  }

  const message = context.chat?.[floor];
  if (!message) return 'unavailable';
  const editorText = activeEditorText(floor);
  if ((editorText ?? message.mes) !== expectedText) return 'floor-changed';

  const previousText = message.mes;
  const currentSwipe =
    Array.isArray(message.swipes)
      ? typeof message.swipe_id === 'number'
        ? message.swipe_id
        : 0
      : undefined;
  const previousSwipeText =
    currentSwipe !== undefined ? message.swipes?.[currentSwipe] : undefined;

  setMessageText(message, nextText);

  try {
    await context.saveChat();
  } catch (error) {
    message.mes = previousText;
    if (
      currentSwipe !== undefined &&
      message.swipes &&
      currentSwipe >= 0 &&
      currentSwipe < message.swipes.length
    ) {
      message.swipes[currentSwipe] = previousSwipeText ?? previousText;
    }
    throw error;
  }

  await emitMessageEvent(context, context.eventTypes?.MESSAGE_EDITED, floor).catch(error => {
    console.warn('[柏宝砚] 楼层已保存，但 MESSAGE_EDITED 事件发送失败', error);
  });
  if (!settleActiveEditor(floor, message.mes)) {
    await refreshRenderedMessage(context, message, floor);
    await emitMessageEvent(context, context.eventTypes?.MESSAGE_UPDATED, floor).catch(error => {
      console.warn('[柏宝砚] 楼层已保存，但 MESSAGE_UPDATED 事件发送失败', error);
    });
  }
  return 'saved';
}
