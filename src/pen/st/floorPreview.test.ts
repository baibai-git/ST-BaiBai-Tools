import { describe, expect, it } from 'vitest';

import {
  buildFloorPreview,
  findThinkingParagraphIds,
  isHidingReplacement,
  paragraphIdsCoveredByRanges,
  RANGE_CLOSE,
  RANGE_OPEN,
  rangesFromMarked,
  removeRanges,
} from '@pen/st/floorPreview';

describe('floor preview cleanup', () => {
  it('removes thinking blocks while preserving visible text', () => {
    expect(
      buildFloorPreview(
        '<think>内部推理</think>\n正文一\n<reasoning mode="private">更多推理</reasoning>\n正文二',
      ),
    ).toBe('正文一 正文二');
  });

  it('supports alternate tag names, casing, and multiple blocks', () => {
    expect(
      buildFloorPreview(
        '<THINKING>推理一</THINKING><analysis>推理二</analysis><p>有效正文</p>',
      ),
    ).toBe('有效正文');
  });

  it('hides an unfinished thinking block', () => {
    expect(buildFloorPreview('可见正文\n<think>尚未闭合的推理')).toBe('可见正文');
  });

  it('returns a useful placeholder when no visible text remains', () => {
    expect(buildFloorPreview('<think>只有推理</think>')).toBe('（无正文预览）');
  });

  it('keeps thinking text when hiding is off', () => {
    expect(buildFloorPreview('<think>推理</think>\n正文', false)).toBe('推理 正文');
  });
});

describe('thinking paragraph detection', () => {
  const lines = (...texts: string[]) => texts.map((text, index) => ({ id: index + 1, text }));

  it('marks lines from the opening tag through the closing tag', () => {
    expect(
      findThinkingParagraphIds(lines('<think>', '推理一', '推理二', '</think>', '正文', '<analysis>单行</analysis>', '尾')),
    ).toEqual(new Set([1, 2, 3, 4, 6]));
  });

  it('runs an unclosed block to the end and ignores other closing tags', () => {
    expect(findThinkingParagraphIds(lines('正文', '<thinking>', '</think>', '仍是推理'))).toEqual(new Set([2, 3, 4]));
  });

  it('returns nothing for plain text', () => {
    expect(findThinkingParagraphIds(lines('正文一', '正文二')).size).toBe(0);
  });
});

describe('regex hidden ranges', () => {
  it('treats empty and details-fold replacements as hiding', () => {
    expect(isHidingReplacement('')).toBe(true);
    expect(isHidingReplacement('  \n')).toBe(true);
    expect(isHidingReplacement('<details><summary>草稿</summary>$1</details>')).toBe(true);
    expect(isHidingReplacement('<div class="status">$1</div>')).toBe(false);
    expect(isHidingReplacement('【$1】')).toBe(false);
  });

  it('maps marked output back to source ranges', () => {
    const text = '前言<draft>想法</draft>正文';
    const marked = `前言${RANGE_OPEN}<draft>想法</draft>${RANGE_CLOSE}正文`;
    expect(rangesFromMarked(marked, text)).toEqual([[2, 19]]);
  });

  it('gives up when the marked output does not match the source', () => {
    expect(rangesFromMarked(`${RANGE_OPEN}小明${RANGE_CLOSE}`, '{{user}}')).toEqual([]);
  });

  it('hides only paragraphs fully covered by ranges', () => {
    const text = '<draft>\n草稿一\n\n草稿二\n</draft>\n正文 <b>尾</b>';
    const end = text.indexOf('</draft>') + '</draft>'.length;
    // 非空行:1 <draft> 2 草稿一 3 草稿二 4 </draft> 5 正文
    expect([...paragraphIdsCoveredByRanges(text, [[0, end]])]).toEqual([1, 2, 3, 4]);
    expect([...paragraphIdsCoveredByRanges(text, [[text.indexOf('<b>'), text.length]])]).toEqual([]);
  });

  it('removes ranges for the preview but keeps text when nothing is left', () => {
    expect(removeRanges('前<x>藏</x>后', [[1, 9]])).toBe('前 后');
    expect(removeRanges('全藏', [[0, 2]])).toBe('全藏');
  });
});
