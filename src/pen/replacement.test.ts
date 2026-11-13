import { describe, expect, it } from 'vitest';

import { replaceText, replaceTextWithRules } from '@pen/replacement';

describe('text replacement', () => {
  it('replaces every literal match without interpreting replacement tokens', () => {
    expect(
      replaceText('猫和猫', {
        pattern: '猫',
        replacement: '$&狗',
        isRegex: false,
      }),
    ).toEqual({
      text: '$&狗和$&狗',
      count: 2,
    });
  });

  it('supports global regular expressions and capture groups', () => {
    expect(
      replaceText('A12 B34', {
        pattern: '([A-Z])(\\d+)',
        replacement: '$2-$1',
        isRegex: true,
      }),
    ).toEqual({
      text: '12-A 34-B',
      count: 2,
    });
  });

  it('supports slash-delimited expressions with flags and multiline content', () => {
    expect(
      replaceText('XX\n第一段\nxxx\nxx第二段xxx', {
        pattern: '/xx[\\s\\S]+?xxx/gi',
        replacement: '已替换',
        isRegex: true,
      }),
    ).toEqual({
      text: '已替换\n已替换',
      count: 2,
    });
  });

  it('adds the global flag to slash-delimited expressions when omitted', () => {
    expect(
      replaceText('Foo foo', {
        pattern: '/foo/i',
        replacement: 'bar',
        isRegex: true,
      }),
    ).toEqual({
      text: 'bar bar',
      count: 2,
    });
  });

  it('recognizes escaped slash characters inside slash-delimited expressions', () => {
    expect(
      replaceText('HTTP://example.com https://example.com', {
        pattern: '/https?:\\/\\/example\\.com/gi',
        replacement: '网址',
        isRegex: true,
      }),
    ).toEqual({
      text: '网址 网址',
      count: 2,
    });
  });

  it('reports invalid flags in slash-delimited expressions', () => {
    expect(() =>
      replaceText('foo', {
        pattern: '/foo/gg',
        replacement: 'bar',
        isRegex: true,
      }),
    ).toThrow();
  });

  it('applies saved rules in order', () => {
    expect(
      replaceTextWithRules('甲乙甲', [
        { name: '甲变乙', pattern: '甲', replacement: '乙', isRegex: false },
        { name: '合并', pattern: '乙+', replacement: '丙', isRegex: true },
      ]),
    ).toEqual({
      text: '丙',
      count: 3,
    });
  });

  it('identifies an invalid saved regular expression', () => {
    expect(() =>
      replaceTextWithRules('正文', [
        { name: '坏规则', pattern: '[', replacement: '', isRegex: true },
      ]),
    ).toThrow('规则“坏规则”无法执行');
  });
});
