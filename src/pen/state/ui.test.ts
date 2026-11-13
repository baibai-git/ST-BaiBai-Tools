import { describe, expect, it } from 'vitest';

import { applyParagraphReplacements, splitParagraphs } from '@pen/state/ui';

describe('line-based paragraph handling', () => {
  it('treats every non-empty line as a paragraph', () => {
    expect(splitParagraphs('第一行\n第二行\n\n  第三行  \r\n   \r\n第四行')).toEqual([
      { id: 1, text: '第一行' },
      { id: 2, text: '第二行' },
      { id: 3, text: '第三行' },
      { id: 4, text: '第四行' },
    ]);
  });

  it('replaces a numbered non-empty line without changing surrounding line breaks', () => {
    const replacements = new Map([[2, '替换后的第二行']]);

    expect(applyParagraphReplacements('第一行\r\n\r\n  第二行  \r\n第三行', replacements)).toBe(
      '第一行\r\n\r\n  替换后的第二行  \r\n第三行',
    );
  });

  it('removes the selected physical line when replacement is empty', () => {
    const replacements = new Map([[2, '']]);

    expect(applyParagraphReplacements('第一行\n第二行\n第三行', replacements)).toBe(
      '第一行\n第三行',
    );
  });
});
