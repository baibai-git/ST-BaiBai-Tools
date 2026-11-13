import {
  getCheckWorldInfo,
  getContext,
  getEjsTemplate,
  type STMessage,
  type WorldInfoEntry,
} from '@pen/st/context';

const HUGE_WORLD_INFO_CONTEXT = 1_000_000_000;
const THINK_BLOCK =
  /<(?:think|thinking|thinging)\b[^>]*>[\s\S]*?<\/(?:think|thinking|thinging)\s*>/gi;
const UNCLOSED_THINK_BLOCK = /<(?:think|thinking|thinging)\b[^>]*>[\s\S]*$/gi;
const NON_STORY_SYSTEM_TYPES = new Set([
  'help',
  'slash_commands',
  'formatting',
  'hotkeys',
  'macros',
  'welcome',
  'empty',
  'generic',
  'comment',
  'welcome_prompt',
  'assistant_note',
]);
const BOOK_SETTINGS_KEY = 'baibai_book';

export interface RewriteStoryContext {
  historyReference: string;
  latestUserMessage: string;
  worldInfo: string;
  charCard: string;
  persona: string;
  historyMessageCount: number;
}

export interface RewriteStoryContextOptions {
  includeWorldInfo: boolean;
  includeCharacterDescription: boolean;
  includeUserDescription: boolean;
}

const DEFAULT_REWRITE_STORY_CONTEXT_OPTIONS: RewriteStoryContextOptions = {
  includeWorldInfo: true,
  includeCharacterDescription: true,
  includeUserDescription: true,
};

export function cleanStoryContextText(message: string): string {
  let text = String(message ?? '')
    .replace(THINK_BLOCK, '')
    .replace(UNCLOSED_THINK_BLOCK, '')
    .replace(/<!--[\s\S]+?-->/g, '')
    .replace(/<horae[\s\S]*?>[\s\S]*?<\/horae[\s\S]*?>/gi, '');
  const starts = [...text.matchAll(/<bbs_start\b/gi)];
  const lastStart = starts.at(-1)?.index;
  if (lastStart !== undefined) text = text.slice(lastStart);
  const end = text.match(/<\/bbs_end>/i);
  if (end?.index !== undefined) text = text.slice(0, end.index + end[0].length);
  return text.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function isSystemUiMessage(message: STMessage): boolean {
  if (message.extra?.uses_system_ui === true) return true;
  const type = message.extra?.type;
  return typeof type === 'string' && NON_STORY_SYSTEM_TYPES.has(type.toLowerCase());
}

function isStoryUserMessage(message: STMessage | undefined): message is STMessage {
  return !!message && message.is_user && !isSystemUiMessage(message);
}

function isStoryAssistantMessage(message: STMessage | undefined): message is STMessage {
  if (!message || message.is_user || isSystemUiMessage(message)) return false;
  if (!message.is_system) return true;
  const name = message.name.trim().toLowerCase();
  return name !== 'system' && name !== 'sillytavern system';
}

export function selectHistoryIndices(
  chat: STMessage[],
  floor: number,
  rounds: number,
): number[] {
  const selected: number[] = [];
  let cursor = floor;
  for (let round = 0; round < rounds; round += 1) {
    let userIndex = -1;
    for (let index = cursor - 1; index >= 0; index -= 1) {
      const message = chat[index];
      if (isStoryUserMessage(message)) {
        userIndex = index;
        break;
      }
    }
    if (userIndex < 0) break;

    let aiIndex = -1;
    for (let index = userIndex - 1; index >= 0; index -= 1) {
      const message = chat[index];
      if (isStoryAssistantMessage(message)) {
        aiIndex = index;
        break;
      }
    }
    selected.unshift(userIndex);
    if (aiIndex >= 0) {
      selected.unshift(aiIndex);
      cursor = aiIndex;
    } else {
      break;
    }
  }
  return selected;
}

export interface SerializedRewriteHistory {
  historyReference: string;
  latestUserMessage: string;
  messageCount: number;
}

export function serializeRewriteHistory(
  chat: STMessage[],
  indices: number[],
  userName: string,
  characterName: string,
): SerializedRewriteHistory {
  const entries = indices
    .map(index => {
      const message = chat[index];
      const text = message ? cleanStoryContextText(message.mes) : '';
      return message && text ? { index, message, text } : null;
    })
    .filter((entry): entry is NonNullable<typeof entry> => !!entry);
  const latest = entries.at(-1);
  const latestUser = latest?.message.is_user ? latest : null;
  const referenceEntries = latestUser ? entries.slice(0, -1) : entries;
  const historyReference = referenceEntries
    .map(({ index, message, text }) => {
      const speaker = message.is_user
        ? message.name || userName || 'User'
        : message.name || characterName || 'Char';
      const hidden = message.is_system ? '｜ST 隐藏' : '';
      return `[楼层 #${index}｜${speaker}${hidden}]\n${text}`;
    })
    .join('\n\n');

  return {
    historyReference,
    latestUserMessage: latestUser?.text ?? '',
    messageCount: entries.length,
  };
}

function joinWorldInfoChunks(chunks: string[]): string {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const chunk of chunks) {
    const text = chunk?.trim();
    if (text && !seen.has(text)) {
      seen.add(text);
      output.push(text);
    }
  }
  return output.join('\n\n').trim();
}

interface BookWorldInfoSettings {
  excludedWorldNames: string[];
  excludedWorldInfoPatterns: string[];
  renderWorldInfoTemplates: boolean;
}

function bookWorldInfoSettings(): BookWorldInfoSettings {
  const raw = getContext()?.extensionSettings?.[BOOK_SETTINGS_KEY];
  const value = raw && typeof raw === 'object'
    ? (raw as {
      excludedWorldNames?: unknown;
      excludedWorldInfoPatterns?: unknown;
      renderWorldInfoTemplates?: unknown;
    })
    : {};
  return {
    excludedWorldNames: Array.isArray(value.excludedWorldNames)
      ? value.excludedWorldNames.filter((item): item is string => typeof item === 'string')
      : [],
    excludedWorldInfoPatterns: Array.isArray(value.excludedWorldInfoPatterns)
      ? value.excludedWorldInfoPatterns.filter((item): item is string => typeof item === 'string')
      : [],
    renderWorldInfoTemplates:
      typeof value.renderWorldInfoTemplates === 'boolean'
        ? value.renderWorldInfoTemplates
        : true,
  };
}

function isWorldInfoEntryExcluded(
  entry: WorldInfoEntry,
  settings: BookWorldInfoSettings,
): boolean {
  const world = entry.world?.trim();
  if (world && settings.excludedWorldNames.includes(world)) return true;
  const comment = entry.comment?.trim();
  if (!comment) return false;
  for (const raw of settings.excludedWorldInfoPatterns) {
    const pattern = raw.trim();
    if (!pattern) continue;
    try {
      if (new RegExp(pattern, 'i').test(comment)) return true;
    } catch {
      if (comment.toLowerCase().includes(pattern.toLowerCase())) return true;
    }
  }
  return false;
}

async function renderWorldInfoContent(
  content: string,
  entry?: WorldInfoEntry,
  floor?: number,
): Promise<string> {
  if (!bookWorldInfoSettings().renderWorldInfoTemplates) return content;
  const context = getContext();
  let text =
    typeof context?.substituteParams === 'function'
      ? context.substituteParams(content)
      : content;
  if (!text.includes('<%')) return text;
  const ejs = getEjsTemplate();
  if (!ejs) return text;
  try {
    const environment = await ejs.prepareContext({ world_info: entry }, floor);
    const output = await ejs.evalTemplate(text, environment);
    if (typeof output === 'string') text = output;
  } catch (error) {
    console.log('[柏宝砚] 世界书 EJS 渲染失败，使用宏展开后的文本：', error);
  }
  return text;
}

async function fetchWorldInfoViaPrompt(scanText: string[], floor: number): Promise<string> {
  const prompt = getContext()?.getWorldInfoPrompt;
  if (typeof prompt !== 'function') return '';
  const result = await prompt(scanText, HUGE_WORLD_INFO_CONTEXT, true);
  if (!result) return '';
  const chunks: string[] = [];
  if (typeof result.worldInfoBefore === 'string') chunks.push(result.worldInfoBefore);
  if (typeof result.worldInfoAfter === 'string') chunks.push(result.worldInfoAfter);
  for (const depth of result.worldInfoDepth ?? []) {
    for (const entry of depth.entries ?? []) if (typeof entry === 'string') chunks.push(entry);
  }
  for (const entry of result.anBefore ?? []) if (typeof entry === 'string') chunks.push(entry);
  for (const entry of result.anAfter ?? []) if (typeof entry === 'string') chunks.push(entry);
  return joinWorldInfoChunks(
    await Promise.all(chunks.map(chunk => renderWorldInfoContent(chunk, undefined, floor))),
  );
}

async function fetchWorldInfo(scanText: string[], floor: number): Promise<string> {
  if (!scanText.length) return '';
  try {
    const checkWorldInfo = await getCheckWorldInfo();
    if (!checkWorldInfo) return await fetchWorldInfoViaPrompt(scanText, floor);
    const result = await checkWorldInfo(scanText, HUGE_WORLD_INFO_CONTEXT, true);
    const activated = result?.allActivatedEntries;
    if (!activated) return '';
    const entries = activated instanceof Map ? [...activated.values()] : [...activated];
    const settings = bookWorldInfoSettings();
    return joinWorldInfoChunks(
      await Promise.all(
        entries
          .filter(entry => entry && !isWorldInfoEntryExcluded(entry, settings))
          .map(entry =>
            renderWorldInfoContent(
              typeof entry.content === 'string' ? entry.content : '',
              entry,
              floor,
            ),
          ),
      ),
    );
  } catch (error) {
    console.log('[柏宝砚] 世界书激活失败，继续执行不带世界书的改写：', error);
    return '';
  }
}

function fetchCharCard(): string {
  const context = getContext();
  if (!context || context.groupId) return '';
  const characterId = context.characterId;
  if (characterId === undefined || characterId === null || characterId === '') return '';
  const character = context.characters?.[Number(characterId)];
  if (!character) return '';
  const substitute =
    typeof context.substituteParams === 'function'
      ? context.substituteParams
      : (value: string) => value;
  const fields: Array<[string, string]> = [
    ['描述', String(character.description ?? '')],
    ['性格', String(character.personality ?? '')],
    ['情景', String(character.scenario ?? '')],
  ];
  return fields
    .map(([label, raw]) => {
      const value = substitute(raw).trim();
      return value ? `【${label}】\n${value}` : '';
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function fetchUserPersona(): string {
  const context = getContext();
  if (!context || typeof context.substituteParams !== 'function') return '';
  return context.substituteParams('{{persona}}').trim();
}

export async function collectRewriteStoryContext(
  floor: number,
  currentText: string,
  contextRounds: number,
  options: RewriteStoryContextOptions = DEFAULT_REWRITE_STORY_CONTEXT_OPTIONS,
): Promise<RewriteStoryContext> {
  const context = getContext();
  if (!context) throw new Error('SillyTavern 上下文不可用');
  const indices = selectHistoryIndices(context.chat, floor, contextRounds);
  const history = serializeRewriteHistory(
    context.chat,
    indices,
    context.name1 || 'User',
    context.name2 || 'Char',
  );
  const scanText = [
    ...indices.map(index => {
      const message = context.chat[index];
      const name = message?.is_user
        ? context.name1 || 'User'
        : message?.name || context.name2 || 'Char';
      return message ? `${name}: ${cleanStoryContextText(message.mes)}` : '';
    }),
    `${context.name2 || 'Char'}: ${cleanStoryContextText(currentText)}`,
  ].filter(Boolean);

  const worldInfo = options.includeWorldInfo
    ? await fetchWorldInfo(scanText, floor)
    : '';
  return {
    historyReference: history.historyReference,
    latestUserMessage: history.latestUserMessage,
    worldInfo,
    charCard: options.includeCharacterDescription ? fetchCharCard() : '',
    persona: options.includeUserDescription ? fetchUserPersona() : '',
    historyMessageCount: history.messageCount,
  };
}
