import { openFloorPicker, openPen } from '@pen/state/ui';
import { getContext } from '@pen/st/context';

/**
 * 魔法棒「楼层管理器」入口点开时的行为(入口本身由柏宝箱 floorDirectory 注入,
 * 新旧版共用一个按钮):
 * 正在编辑某条消息就直接对当前编辑区开砚,否则先给楼层列表。
 */
export function openPenFromMenu(): void {
  const editor = document.querySelector<HTMLTextAreaElement>('#curEditTextarea');
  const message = editor?.closest<HTMLElement>('.mes');
  const floor = Number(message?.getAttribute('mesid'));
  const context = getContext();
  const chatMessage = context?.chat?.[floor];
  if (editor && Number.isInteger(floor) && chatMessage) {
    openPen(
      editor.value,
      floor,
      message?.querySelector<HTMLElement>('.name_text')?.textContent?.trim() || chatMessage.name,
      context?.getCurrentChatId?.() ?? '',
    );
  } else {
    // 未在编辑态:先给楼层列表,选一楼后自动进入该楼编辑
    openFloorPicker();
  }
}
