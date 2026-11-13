import { describe, expect, it } from 'vitest';

import {
  buildShotFilename,
  depthZeroProxyId,
  isFrontendCode,
  sanitizeFilename,
} from '@pen/st/floorShot';

describe('isFrontendCode', () => {
  it('matches the same fragments Tavern Helper renders as iframes', () => {
    expect(isFrontendCode('<!DOCTYPE html><html><body>hi</body></html>')).toBe(true);
    expect(isFrontendCode('<head><style></style></head>')).toBe(true);
    expect(isFrontendCode('<body class="panel">')).toBe(true);
  });

  it('ignores ordinary code blocks', () => {
    expect(isFrontendCode('const x = 1;')).toBe(false);
    expect(isFrontendCode('<div>plain html snippet</div>')).toBe(false);
  });
});

describe('depthZeroProxyId', () => {
  it('returns the last non-system message index', () => {
    const chat = [
      { is_system: false },
      { is_system: false },
      { is_system: true },
    ];
    expect(depthZeroProxyId(chat, 0)).toBe(1);
  });

  it('returns the last index when nothing is hidden', () => {
    const chat = [{ is_system: false }, { is_system: false }];
    expect(depthZeroProxyId(chat, 0)).toBe(1);
  });

  it('falls back to the floor itself when every message is hidden', () => {
    const chat = [{ is_system: true }, { is_system: true }];
    expect(depthZeroProxyId(chat, 0)).toBe(0);
  });
});

describe('sanitizeFilename', () => {
  it('strips characters Windows rejects', () => {
    expect(sanitizeFilename('a<b>:c"/d\\|e?*f')).toBe('abcdef');
  });

  it('falls back when the name is empty after cleaning', () => {
    expect(sanitizeFilename('???')).toBe('floor');
  });

  it('keeps CJK names and spaces', () => {
    expect(sanitizeFilename('柏 宝')).toBe('柏 宝');
  });
});

describe('buildShotFilename', () => {
  it('composes speaker, floor and timestamp', () => {
    const name = buildShotFilename(12, '柏宝', new Date(2026, 6, 26, 9, 5, 3));
    expect(name).toBe('柏宝-楼层12-20260726-090503.jpg');
  });
});
