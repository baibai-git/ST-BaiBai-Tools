export interface TextReplacement {
  pattern: string;
  replacement: string;
  isRegex: boolean;
}

export interface ReplacementResult {
  text: string;
  count: number;
}

function parseRegex(pattern: string): RegExp {
  if (pattern.startsWith('/')) {
    for (let index = pattern.length - 1; index > 0; index -= 1) {
      if (pattern[index] !== '/') continue;

      let backslashCount = 0;
      for (let cursor = index - 1; cursor >= 0 && pattern[cursor] === '\\'; cursor -= 1) {
        backslashCount += 1;
      }
      if (backslashCount % 2 === 1) continue;

      const flags = pattern.slice(index + 1);
      if (!/^[a-zA-Z]*$/.test(flags)) continue;

      const source = pattern.slice(1, index);
      if (!source) throw new Error('正则表达式内容不能为空');
      return new RegExp(source, flags.includes('g') ? flags : `${flags}g`);
    }
  }

  return new RegExp(pattern, 'g');
}

export function replaceText(text: string, rule: TextReplacement): ReplacementResult {
  if (!rule.pattern) {
    throw new Error('查找内容不能为空');
  }

  if (rule.isRegex) {
    const expression = parseRegex(rule.pattern);
    const count = text.match(expression)?.length ?? 0;
    return {
      text: count ? text.replace(expression, rule.replacement) : text,
      count,
    };
  }

  const parts = text.split(rule.pattern);
  const count = parts.length - 1;
  return {
    text: count ? parts.join(rule.replacement) : text,
    count,
  };
}

export function replaceTextWithRules(
  text: string,
  rules: readonly (TextReplacement & { name: string })[],
): ReplacementResult {
  let result = text;
  let count = 0;

  for (const rule of rules) {
    try {
      const next = replaceText(result, rule);
      result = next.text;
      count += next.count;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`规则“${rule.name}”无法执行：${message}`);
    }
  }

  return { text: result, count };
}
