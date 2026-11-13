import {
  getRegexScripts,
  regex_placement,
  runRegexScript,
  type RegexScript,
} from '@sillytavern/scripts/extensions/regex/engine';

import { getContext } from '@pen/st/context';
import { isHidingReplacement, RANGE_CLOSE, RANGE_OPEN, rangesFromMarked, type TextRange } from '@pen/st/floorPreview';

/**
 * 当前生效的「隐藏类」正则:全局 + 已允许的角色/预设正则里,勾了「仅格式显示」、
 * 没禁用、替换成空或 <details> 折叠的。每次调用都现读,切预设/改正则后重新调用即可。
 */
export function collectHideScripts(): RegexScript[] {
  const disabled = getContext()?.extensionSettings?.disabledExtensions;
  if (Array.isArray(disabled) && disabled.includes('regex')) return [];
  try {
    return getRegexScripts({ allowedOnly: true }).filter(
      script =>
        script &&
        !script.disabled &&
        script.markdownOnly &&
        script.findRegex &&
        Array.isArray(script.placement) &&
        isHidingReplacement(script.replaceString ?? ''),
    );
  } catch (error) {
    console.debug('[柏宝砚] 读取正则失败', error);
    return [];
  }
}

function depthAllowed(script: RegexScript, depth: number): boolean {
  const { minDepth, maxDepth } = script;
  if (typeof minDepth === 'number' && minDepth >= -1 && depth < minDepth) return false;
  if (typeof maxDepth === 'number' && maxDepth >= 0 && depth > maxDepth) return false;
  return true;
}

/** 这些正则在聊天界面里会藏掉的原文区间(每条正则单独对原文跑,只取位置,不改文字) */
export function findHiddenRanges(
  text: string,
  options: { isUser: boolean; depth: number },
  scripts: readonly RegexScript[],
): TextRange[] {
  if (!text || !scripts.length || text.includes(RANGE_OPEN) || text.includes(RANGE_CLOSE)) return [];
  const placement = options.isUser ? regex_placement.USER_INPUT : regex_placement.AI_OUTPUT;
  const ranges: TextRange[] = [];
  for (const script of scripts) {
    if (!script.placement.includes(placement) || !depthAllowed(script, options.depth)) continue;
    try {
      const marked = runRegexScript(
        { ...script, replaceString: `${RANGE_OPEN}{{match}}${RANGE_CLOSE}`, trimStrings: [] },
        text,
      );
      if (marked !== text) ranges.push(...rangesFromMarked(marked, text));
    } catch (error) {
      console.debug('[柏宝砚] 正则匹配失败', script.scriptName, error);
    }
  }
  return ranges;
}
