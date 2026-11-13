const THINKING_TAGS = 'think|thinking|reasoning|analysis';
const THINKING_BLOCK_PATTERN = new RegExp(`<(${THINKING_TAGS})\\b[^>]*>[\\s\\S]*?<\\/\\1\\s*>`, 'gi');
const UNCLOSED_THINKING_BLOCK_PATTERN = new RegExp(`<(${THINKING_TAGS})\\b[^>]*>[\\s\\S]*$`, 'gi');
const THINKING_OPEN_PATTERN = new RegExp(`<(${THINKING_TAGS})\\b[^>]*>`, 'i');

/** 仅供楼层列表展示，不得将结果写回聊天消息或工作区。 */
export function buildFloorPreview(rawText: string, hideThinking = true): string {
  const text = hideThinking
    ? rawText.replace(THINKING_BLOCK_PATTERN, ' ').replace(UNCLOSED_THINKING_BLOCK_PATTERN, ' ')
    : rawText;
  return (
    text
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || '（无正文预览）'
  );
}

/**
 * 工作台按行显示正文;找出落在思维链块里的行(开标签所在行到闭标签所在行,没闭合就到末尾),
 * 只用来在界面上收起,行号不变,标注/改写/保存照旧按原文行号走。
 */
export function findThinkingParagraphIds(paragraphs: ReadonlyArray<{ id: number; text: string }>): Set<number> {
  const ids = new Set<number>();
  let closing: RegExp | null = null;
  for (const paragraph of paragraphs) {
    let rest = paragraph.text;
    if (!closing) {
      const open = THINKING_OPEN_PATTERN.exec(rest);
      if (!open) continue;
      closing = new RegExp(`<\\/${open[1]}\\s*>`, 'i');
      rest = rest.slice(open.index + open[0].length);
    }
    ids.add(paragraph.id);
    if (closing.test(rest)) closing = null;
  }
  return ids;
}

/** 原文里的 [start, end) 区间,来自预设/全局/角色正则的匹配位置 */
export type TextRange = [number, number];

// 私用区字符当匹配标记,正文里几乎不会出现
export const RANGE_OPEN = String.fromCharCode(0xe000);
export const RANGE_CLOSE = String.fromCharCode(0xe001);

/**
 * 正则「仅格式显示」且替换成空(或整段折进 <details>)的,视为在聊天里隐藏这段;
 * 替换成别的 HTML/文字的是美化,不算。
 */
export function isHidingReplacement(replaceString: string): boolean {
  return !replaceString.trim() || /^\s*<details\b[\s\S]*<\/details>\s*$/i.test(replaceString);
}

/**
 * 把正则替换成「OPEN 原匹配 CLOSE」后的结果还原成原文区间;
 * 去掉标记后和原文对不上(替换时展开了宏等)就放弃这条正则,返回空。
 */
export function rangesFromMarked(marked: string, text: string): TextRange[] {
  const ranges: TextRange[] = [];
  let plain = '';
  let start = -1;
  for (let index = 0; index < marked.length; index += 1) {
    const char = marked[index];
    if (char === RANGE_OPEN) {
      start = plain.length;
    } else if (char === RANGE_CLOSE) {
      if (start >= 0 && plain.length > start) ranges.push([start, plain.length]);
      start = -1;
    } else {
      plain += char;
    }
  }
  return plain === text ? ranges : [];
}

function coverage(length: number, ranges: readonly TextRange[]): Uint8Array {
  const covered = new Uint8Array(length);
  for (const [start, end] of ranges) covered.fill(1, Math.max(0, start), Math.min(length, end));
  return covered;
}

/** 整行(忽略空白)都落在区间里的行;行号与 splitParagraphs 一致(非空行从 1 数) */
export function paragraphIdsCoveredByRanges(text: string, ranges: readonly TextRange[]): Set<number> {
  const ids = new Set<number>();
  if (!ranges.length) return ids;
  const covered = coverage(text.length, ranges);
  let id = 0;
  for (const line of text.matchAll(/[^\r\n]+/g)) {
    if (!line[0].trim()) continue;
    id += 1;
    const offset = line.index ?? 0;
    let hidden = true;
    for (let index = 0; index < line[0].length; index += 1) {
      if (!covered[offset + index] && line[0][index].trim()) {
        hidden = false;
        break;
      }
    }
    if (hidden) ids.add(id);
  }
  return ids;
}

/** 预览用:去掉区间内的文字;去完什么都不剩就保留原文 */
export function removeRanges(text: string, ranges: readonly TextRange[]): string {
  if (!ranges.length) return text;
  const covered = coverage(text.length, ranges);
  let result = '';
  for (let index = 0; index < text.length; index += 1) {
    result += covered[index] ? (covered[index - 1] ? '' : ' ') : text[index];
  }
  return result.trim() ? result : text;
}
