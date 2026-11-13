import { describe, expect, it } from 'vitest';

import { DEFAULT_QUICK_PHRASES, normalizePenSettings } from '@pen/api/settings';

describe('theme settings', () => {
  it('restores a persisted theme', () => {
    expect(normalizePenSettings({ theme: 'green' }).theme).toBe('green');
  });

  it('uses the day theme for legacy or invalid settings', () => {
    expect(normalizePenSettings({}).theme).toBe('day');
    expect(normalizePenSettings({ theme: 'unknown' }).theme).toBe('day');
  });
});

describe('floor filter settings', () => {
  it('defaults new users to all floors', () => {
    expect(normalizePenSettings({}).floorFilter).toBe('all');
    expect(normalizePenSettings({ floorFilter: 'bogus' }).floorFilter).toBe('all');
  });

  it('restores a persisted filter', () => {
    expect(normalizePenSettings({ floorFilter: 'hidden' }).floorFilter).toBe('hidden');
  });

  it('lists newest floors first unless ascending was chosen', () => {
    expect(normalizePenSettings({}).floorOrder).toBe('desc');
    expect(normalizePenSettings({ floorOrder: 'bogus' }).floorOrder).toBe('desc');
    expect(normalizePenSettings({ floorOrder: 'asc' }).floorOrder).toBe('asc');
  });

  it('keeps what legacy showUserFloors users saw', () => {
    expect(normalizePenSettings({ showUserFloors: false }).floorFilter).toBe('char');
    expect(normalizePenSettings({ showUserFloors: true }).floorFilter).toBe('all');
  });
});

describe('hide thinking setting', () => {
  it('hides thinking unless explicitly turned off', () => {
    expect(normalizePenSettings({}).hideThinking).toBe(true);
    expect(normalizePenSettings({ hideThinking: false }).hideThinking).toBe(false);
  });
});

describe('floating orb settings', () => {
  it('is off by default with the series defaults', () => {
    expect(normalizePenSettings({})).toMatchObject({
      showOrb: false,
      orbImage: '',
      orbShape: 'bookmark',
      orbOpacity: 62,
      orbSize: 48,
    });
  });

  it('clamps out-of-range values and rejects unknown shapes', () => {
    expect(
      normalizePenSettings({ showOrb: true, orbShape: 'star', orbOpacity: 5, orbSize: 200 }),
    ).toMatchObject({ showOrb: true, orbShape: 'bookmark', orbOpacity: 20, orbSize: 80 });
  });
});

describe('default quick phrases', () => {
  it('installs the built-in phrases for settings without a defaults version', () => {
    expect(normalizePenSettings({ phrases: [] }).phrases).toEqual(DEFAULT_QUICK_PHRASES);
  });

  it('preserves the saved phrase list after defaults have been installed', () => {
    const phrases = [
      {
        id: 99,
        name: '自定义',
        instruction: '保留这条',
        favorite: true,
      },
    ];

    expect(
      normalizePenSettings({
        quickPhraseDefaultsVersion: 1,
        phrases,
      }).phrases,
    ).toEqual(phrases);
  });

  it('allows users to keep an intentionally empty phrase list', () => {
    expect(
      normalizePenSettings({
        quickPhraseDefaultsVersion: 1,
        phrases: [],
      }).phrases,
    ).toEqual([]);
  });
});

describe('replace rules', () => {
  it('starts with an empty rule library', () => {
    expect(normalizePenSettings({}).replaceRules).toEqual([]);
  });

  it('removes the two legacy placeholder rules and preserves user rules', () => {
    const customRule = {
      id: 9,
      name: '自定义规则',
      pattern: '旧名',
      replacement: '新名',
      isRegex: false,
      enabled: true,
    };

    expect(
      normalizePenSettings({
        replaceRules: [
          {
            id: 1,
            name: '统一省略号',
            pattern: '\\.{3,}',
            replacement: '……',
            isRegex: true,
            enabled: true,
          },
          {
            id: 2,
            name: '清理行尾空白',
            pattern: '[ \\t]+$',
            replacement: '',
            isRegex: true,
            enabled: false,
          },
          customRule,
        ],
      }).replaceRules,
    ).toEqual([customRule]);
  });
});
