import { describe, expect, it } from 'vitest';

import {
  classifyGenerationChat,
  isGenerationTargetOpen,
} from '@pen/state/generationTask';

describe('generation task chat lifecycle', () => {
  it('keeps a task while the user is on the welcome page', () => {
    expect(classifyGenerationChat('character:a\u0000chat-1', '')).toBe('home');
  });

  it('restores only inside the original chat identity', () => {
    const target = 'character:a\u0000chat-1';
    expect(classifyGenerationChat(target, target)).toBe('target');
    expect(classifyGenerationChat(target, 'character:a\u0000chat-2')).toBe('other');
    expect(classifyGenerationChat(target, 'character:b\u0000chat-1')).toBe('other');
  });

  it('associates the spinner with the exact target floor', () => {
    const target = { chatIdentity: 'group:g\u0000chat-1', floor: 12 };
    expect(isGenerationTargetOpen(target, target.chatIdentity, 12)).toBe(true);
    expect(isGenerationTargetOpen(target, target.chatIdentity, 13)).toBe(false);
    expect(isGenerationTargetOpen(target, 'group:g\u0000chat-2', 12)).toBe(false);
  });
});
