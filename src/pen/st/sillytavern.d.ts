// 宿主 ST 模块,构建时按 @sillytavern/* 解析为 external;这里只声明砚用到的部分
declare module '@sillytavern/scripts/extensions/regex/engine' {
  export interface RegexScript {
    scriptName?: string;
    findRegex: string;
    replaceString: string;
    trimStrings?: string[];
    placement: number[];
    disabled?: boolean;
    markdownOnly?: boolean;
    promptOnly?: boolean;
    minDepth?: number | null;
    maxDepth?: number | null;
  }
  export const regex_placement: { USER_INPUT: number; AI_OUTPUT: number };
  export function getRegexScripts(options?: { allowedOnly?: boolean }): RegexScript[];
  export function runRegexScript(
    script: RegexScript,
    rawString: string,
    params?: { characterOverride?: string },
  ): string;
}
