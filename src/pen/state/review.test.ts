import { describe, expect, it } from 'vitest';

import { buildReviewRows } from '@pen/state/review';

const paragraphs = ['第一段', '第二段', '第三段', '第四段', '第五段', '第六段'];

describe('review rows', () => {
  it('merges consecutive deleted paragraphs into one review row', () => {
    const rows = buildReviewRows(
      [
        { paragraph: 2, replacement: '' },
        { paragraph: 3, replacement: '' },
        { paragraph: 4, replacement: '' },
      ],
      paragraphs,
    );

    expect(rows).toEqual([
      {
        key: 'delete-2-4',
        paragraphs: [2, 3, 4],
        startParagraph: 2,
        endParagraph: 4,
        label: 'P2-P4',
        original: '第二段\n第三段\n第四段',
        result: '',
        deleted: true,
      },
    ]);
  });

  it('keeps separated deletion ranges in different rows', () => {
    const rows = buildReviewRows(
      [
        { paragraph: 2, replacement: '' },
        { paragraph: 3, replacement: '' },
        { paragraph: 5, replacement: '' },
      ],
      paragraphs,
    );

    expect(rows.map(row => row.paragraphs)).toEqual([[2, 3], [5]]);
  });

  it('does not merge deletions across a rewritten paragraph', () => {
    const rows = buildReviewRows(
      [
        { paragraph: 2, replacement: '' },
        { paragraph: 3, replacement: '第三段改写' },
        { paragraph: 4, replacement: '' },
      ],
      paragraphs,
    );

    expect(rows.map(row => ({
      paragraphs: row.paragraphs,
      result: row.result,
    }))).toEqual([
      { paragraphs: [2], result: '' },
      { paragraphs: [3], result: '第三段改写' },
      { paragraphs: [4], result: '' },
    ]);
  });
});
