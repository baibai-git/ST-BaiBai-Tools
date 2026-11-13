import { afterEach, describe, expect, it, vi } from 'vitest';

import { applyFloorText, getFloorSourceText, openFloorInPen } from '@pen/st/openFloor';
import { ui } from '@pen/state/ui';

function installContext(context: Record<string, unknown>): void {
  vi.stubGlobal('window', {
    SillyTavern: {
      getContext: () => context,
    },
  });
  vi.stubGlobal('document', {
    querySelector: vi.fn(() => null),
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('floor access without rendered messages', () => {
  it('opens a floor directly from the chat array', () => {
    installContext({
      chat: [
        {
          name: '角色',
          is_user: false,
          is_system: true,
          mes: '未渲染的楼层正文',
        },
      ],
      getCurrentChatId: () => 'chat-a',
    });

    expect(openFloorInPen(0)).toBe(true);
    expect(ui.floor).toBe(0);
    expect(ui.originalText).toBe('未渲染的楼层正文');
    expect(ui.chatId).toBe('chat-a');
  });

  it('reads the active editor value before the persisted message text', () => {
    const editor = { value: '编辑器中的正文' };
    vi.stubGlobal('window', {
      SillyTavern: {
        getContext: () => ({
          chat: [{ name: '角色', is_user: false, is_system: false, mes: '已保存正文' }],
        }),
      },
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => ({
        querySelector: vi.fn(() => editor),
      })),
    });

    expect(getFloorSourceText(0)).toBe('编辑器中的正文');
  });

  it('persists before refreshing the message and emitting update events', async () => {
    const actions: string[] = [];
    const emit = vi.fn(async (event: string) => {
      actions.push(event);
    });
    const saveChat = vi.fn(async () => {
      actions.push('save');
    });
    const updateMessageBlock = vi.fn(() => {
      actions.push('refresh');
    });
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
      swipes: ['旧分支', '原文'],
      swipe_id: 1,
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat,
      updateMessageBlock,
      eventSource: { emit },
      eventTypes: {
        MESSAGE_EDITED: 'edited',
        MESSAGE_UPDATED: 'updated',
      },
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => ({
        querySelector: vi.fn(() => null),
      })),
    });

    await expect(applyFloorText(0, '原文', '新正文', 'chat-a')).resolves.toBe('saved');
    expect(message.mes).toBe('新正文');
    expect(message.swipes).toEqual(['旧分支', '新正文']);
    expect(emit).toHaveBeenNthCalledWith(1, 'edited', 0);
    expect(emit).toHaveBeenNthCalledWith(2, 'updated', 0);
    expect(saveChat).toHaveBeenCalledOnce();
    expect(updateMessageBlock).toHaveBeenCalledWith(0, message);
    expect(actions).toEqual(['save', 'edited', 'refresh', 'updated']);
  });

  it('settles an active ST editor without flattening HTML or line breaks', async () => {
    const actions: string[] = [];
    const nextText = '<section>\n\n  <p>保留格式</p>\n</section>';
    const editor = { value: '原文' };
    const cancel = {
      click: vi.fn(() => {
        actions.push('cancel');
      }),
    };
    const messageElement = {
      querySelector: vi.fn((selector: string) => {
        if (selector === '#curEditTextarea') return editor;
        if (selector === '.mes_edit_cancel') return cancel;
        return null;
      }),
    };
    const updateMessageBlock = vi.fn(() => {
      actions.push('refresh');
    });
    const emit = vi.fn(async (event: string) => {
      actions.push(event);
    });
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
      swipes: ['原文'],
      swipe_id: 0,
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat: vi.fn(async () => {
        actions.push('save');
      }),
      updateMessageBlock,
      eventSource: { emit },
      eventTypes: {
        MESSAGE_EDITED: 'edited',
        MESSAGE_UPDATED: 'updated',
      },
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => messageElement),
    });

    await expect(applyFloorText(0, '原文', nextText, 'chat-a')).resolves.toBe('saved');
    expect(message.mes).toBe(nextText);
    expect(message.swipes).toEqual([nextText]);
    expect(editor.value).toBe(nextText);
    expect(cancel.click).toHaveBeenCalledOnce();
    expect(updateMessageBlock).not.toHaveBeenCalled();
    expect(emit).toHaveBeenCalledOnce();
    expect(emit).toHaveBeenCalledWith('edited', 0);
    expect(actions).toEqual(['save', 'edited', 'cancel']);
  });

  it('keeps a synchronized editor intact when an older ST has no cancel button', async () => {
    const nextText = '<div>\n第一行\n\n第二行\n</div>';
    const editor = { value: '原文' };
    const messageElement = {
      querySelector: vi.fn((selector: string) =>
        selector === '#curEditTextarea' ? editor : null,
      ),
    };
    const updateMessageBlock = vi.fn();
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat: vi.fn(async () => undefined),
      updateMessageBlock,
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => messageElement),
    });

    await expect(applyFloorText(0, '原文', nextText, 'chat-a')).resolves.toBe('saved');
    expect(editor.value).toBe(nextText);
    expect(updateMessageBlock).not.toHaveBeenCalled();
  });

  it('updates swipes[0] when an old message has no swipe_id', async () => {
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
      swipes: ['原文'],
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat: vi.fn(async () => undefined),
    });

    await expect(applyFloorText(0, '原文', '新正文', 'chat-a')).resolves.toBe('saved');
    expect(message.mes).toBe('新正文');
    expect(message.swipes).toEqual(['新正文']);
  });

  it('saves before falling back to a full chat reload on older ST versions', async () => {
    const actions: string[] = [];
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat: vi.fn(async () => {
        actions.push('save');
      }),
      reloadCurrentChat: vi.fn(async () => {
        actions.push('reload');
      }),
    });
    vi.stubGlobal('document', {
      querySelector: vi.fn(() => ({
        querySelector: vi.fn(() => null),
      })),
    });

    await expect(applyFloorText(0, '原文', '新正文', 'chat-a')).resolves.toBe('saved');
    expect(actions).toEqual(['save', 'reload']);
  });

  it('rolls back the message and current swipe when saving fails', async () => {
    const message = {
      name: '角色',
      is_user: false,
      is_system: false,
      mes: '原文',
      swipes: ['原文'],
      swipe_id: 0,
    };
    installContext({
      chat: [message],
      getCurrentChatId: () => 'chat-a',
      saveChat: vi.fn(async () => {
        throw new Error('保存失败');
      }),
    });

    await expect(applyFloorText(0, '原文', '新正文', 'chat-a')).rejects.toThrow('保存失败');
    expect(message.mes).toBe('原文');
    expect(message.swipes).toEqual(['原文']);
  });
});
