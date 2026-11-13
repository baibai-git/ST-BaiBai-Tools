import { afterEach, describe, expect, it, vi } from 'vitest';

import { deleteFloorsFrom, toggleFloorHidden } from '@pen/st/floorActions';

function installContext(context: Record<string, unknown>): void {
  vi.stubGlobal('window', {
    SillyTavern: {
      getContext: () => context,
    },
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('toggleFloorHidden', () => {
  it('hides a visible floor via /hide', async () => {
    const run = vi.fn(async () => undefined);
    installContext({
      chat: [{ name: '角色', is_user: false, is_system: false, mes: '正文' }],
      executeSlashCommandsWithOptions: run,
    });

    await expect(toggleFloorHidden(0)).resolves.toBe(true);
    expect(run).toHaveBeenCalledWith('/hide 0', {
      handleExecutionErrors: true,
      source: 'baibai-pen',
    });
  });

  it('unhides a hidden floor via /unhide', async () => {
    const run = vi.fn(async () => undefined);
    installContext({
      chat: [{ name: '角色', is_user: false, is_system: true, mes: '正文' }],
      executeSlashCommandsWithOptions: run,
    });

    await expect(toggleFloorHidden(0)).resolves.toBe(false);
    expect(run).toHaveBeenCalledWith('/unhide 0', expect.anything());
  });

  it('throws when the slash command reports an error', async () => {
    installContext({
      chat: [{ name: '角色', is_user: false, is_system: false, mes: '正文' }],
      executeSlashCommandsWithOptions: vi.fn(async () => ({
        isError: true,
        errorMessage: '命令失败',
      })),
    });

    await expect(toggleFloorHidden(0)).rejects.toThrow('命令失败');
  });

  it('throws when the floor does not exist', async () => {
    installContext({ chat: [] });
    await expect(toggleFloorHidden(3)).rejects.toThrow('楼层不存在');
  });
});

describe('deleteFloorsFrom', () => {
  it('deletes the floor and everything after it via /del', async () => {
    const run = vi.fn(async () => undefined);
    const chat = Array.from({ length: 5 }, () => ({
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '正文',
    }));
    installContext({
      chat,
      executeSlashCommandsWithOptions: run,
      callGenericPopup: vi.fn(async () => true),
      POPUP_TYPE: { CONFIRM: 'confirm' },
    });

    await expect(deleteFloorsFrom(2)).resolves.toBe(3);
    expect(run).toHaveBeenCalledWith('/del 3', {
      handleExecutionErrors: true,
      source: 'baibai-pen',
    });
  });

  it('does nothing when the user cancels the confirm popup', async () => {
    const run = vi.fn(async () => undefined);
    installContext({
      chat: [{ name: '角色', is_user: false, is_system: false, mes: '正文' }],
      executeSlashCommandsWithOptions: run,
      callGenericPopup: vi.fn(async () => false),
      POPUP_TYPE: { CONFIRM: 'confirm' },
    });

    await expect(deleteFloorsFrom(0)).resolves.toBe(0);
    expect(run).not.toHaveBeenCalled();
  });
});
