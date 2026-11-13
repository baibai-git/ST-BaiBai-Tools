import { describe, expect, it } from 'vitest';

import { getOpenChatId, getOpenChatIdentity, setMessageText, type STContext } from '@pen/st/context';

function contextWithChatId(chatId: string | undefined): STContext {
  return {
    chat: [],
    name1: 'User',
    name2: 'Char',
    getRequestHeaders: () => ({}),
    getCurrentChatId: () => chatId,
  };
}

describe('open chat detection', () => {
  it('treats the welcome page as having no open chat', () => {
    expect(getOpenChatId(contextWithChatId(undefined))).toBe('');
    expect(getOpenChatId(contextWithChatId('   '))).toBe('');
  });

  it('returns the trimmed active chat id', () => {
    expect(getOpenChatId(contextWithChatId(' chat-a '))).toBe('chat-a');
  });

  it('includes the character or group scope in the chat identity', () => {
    const characterContext = contextWithChatId('chat-a');
    characterContext.characterId = 0;
    characterContext.characters = [{ name: 'Char', avatar: 'char.png' }];
    expect(getOpenChatIdentity(characterContext)).toBe('character:char.png\u0000chat-a');

    const groupContext = contextWithChatId('chat-a');
    groupContext.groupId = 'group-1';
    expect(getOpenChatIdentity(groupContext)).toBe('group:group-1\u0000chat-a');
  });
});

describe('setMessageText', () => {
  it('does not create swipes for a message without swipes', () => {
    const message = { name: 'Char', is_user: false, is_system: false, mes: 'old' };
    setMessageText(message, 'new');
    expect(message.mes).toBe('new');
    expect('swipes' in message).toBe(false);
  });

  it('updates the first swipe when swipe_id is absent', () => {
    const message = {
      name: 'Char',
      is_user: false,
      is_system: false,
      mes: 'old',
      swipes: ['old'],
    };
    setMessageText(message, 'new');
    expect(message.mes).toBe('new');
    expect(message.swipes).toEqual(['new']);
  });

  it('updates only the selected swipe', () => {
    const message = {
      name: 'Char',
      is_user: false,
      is_system: false,
      mes: 'second',
      swipe_id: 1,
      swipes: ['first', 'second'],
    };
    setMessageText(message, 'updated');
    expect(message.swipes).toEqual(['first', 'updated']);
  });
});
