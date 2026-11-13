import type { RewriteChange } from '@pen/api/rewrite';

export interface ReviewRow {
  key: string;
  paragraphs: number[];
  startParagraph: number;
  endParagraph: number;
  label: string;
  original: string;
  result: string;
  deleted: boolean;
}

function paragraphText(paragraphTexts: readonly string[], paragraph: number): string {
  return paragraphTexts[paragraph - 1] ?? '';
}

function rowLabel(startParagraph: number, endParagraph: number): string {
  return startParagraph === endParagraph
    ? `P${startParagraph}`
    : `P${startParagraph}-P${endParagraph}`;
}

export function buildReviewRows(
  changes: readonly RewriteChange[],
  paragraphTexts: readonly string[],
): ReviewRow[] {
  const rows: ReviewRow[] = [];

  for (const change of changes) {
    const deleted = change.replacement === '';
    const previous = rows.at(-1);

    if (
      deleted &&
      previous?.deleted &&
      change.paragraph === previous.endParagraph + 1
    ) {
      previous.paragraphs.push(change.paragraph);
      previous.endParagraph = change.paragraph;
      previous.key = `delete-${previous.startParagraph}-${previous.endParagraph}`;
      previous.label = rowLabel(previous.startParagraph, previous.endParagraph);
      previous.original = [
        previous.original,
        paragraphText(paragraphTexts, change.paragraph),
      ].join('\n');
      continue;
    }

    rows.push({
      key: deleted ? `delete-${change.paragraph}-${change.paragraph}` : `change-${change.paragraph}`,
      paragraphs: [change.paragraph],
      startParagraph: change.paragraph,
      endParagraph: change.paragraph,
      label: rowLabel(change.paragraph, change.paragraph),
      original: paragraphText(paragraphTexts, change.paragraph),
      result: change.replacement,
      deleted,
    });
  }

  return rows;
}
