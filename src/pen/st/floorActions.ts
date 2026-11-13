import { getContext, type STContext } from '@pen/st/context';

const SLASH_SOURCE = 'baibai-pen';

type SlashRunner = NonNullable<STContext['executeSlashCommandsWithOptions']>;

function requireSlashRunner(context: STContext | null): SlashRunner {
  const run = context?.executeSlashCommandsWithOptions;
  if (typeof run !== 'function') {
    throw new Error('当前酒馆版本未暴露斜杠命令执行接口');
  }
  return run;
}

/** 用 ST 的 /hide、/unhide 斜杠命令切换单层的隐藏状态（is_system）。返回切换后是否隐藏。 */
export async function toggleFloorHidden(floor: number): Promise<boolean> {
  const context = getContext();
  const message = context?.chat?.[floor];
  if (!message) throw new Error('楼层不存在');

  const run = requireSlashRunner(context);
  const willHide = !message.is_system;
  const result = await run(willHide ? `/hide ${floor}` : `/unhide ${floor}`, {
    handleExecutionErrors: true,
    source: SLASH_SOURCE,
  });

  if (result?.isError) {
    throw new Error(result.errorMessage || '斜杠命令执行失败');
  }
  return willHide;
}

async function confirmFloorDelete(context: STContext, floor: number): Promise<boolean> {
  const message = `将删除第 ${floor} 层及之后的楼层，删除后无法撤销。确定继续吗？`;
  if (typeof context.callGenericPopup === 'function' && context.POPUP_TYPE && 'CONFIRM' in context.POPUP_TYPE) {
    return Boolean(await context.callGenericPopup(message, context.POPUP_TYPE.CONFIRM));
  }
  return Boolean(globalThis.confirm?.(message));
}

/**
 * 删除第 floor 层及之后的所有楼层（对齐 ST /del 语义：从末尾删 N 条）。
 * 返回删除数量，用户取消时返回 0。
 */
export async function deleteFloorsFrom(floor: number): Promise<number> {
  const context = getContext();
  const chat = context?.chat;
  if (!context || !chat?.[floor]) throw new Error('楼层不存在');

  const run = requireSlashRunner(context);
  const deleteCount = chat.length - floor;
  if (deleteCount < 1) return 0;

  const confirmed = await confirmFloorDelete(context, floor);
  if (!confirmed) return 0;

  const result = await run(`/del ${deleteCount}`, {
    handleExecutionErrors: true,
    source: SLASH_SOURCE,
  });

  if (result?.isError) {
    throw new Error(result.errorMessage || '斜杠删除命令执行失败');
  }
  return deleteCount;
}
