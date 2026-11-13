export interface STMessage {
  name: string;
  is_user: boolean;
  is_system: boolean;
  mes: string;
  swipes?: string[];
  swipe_id?: number;
  force_avatar?: string;
  extra?: Record<string, unknown>;
}

export interface STCharacter {
  name: string;
  avatar: string;
  description?: string;
  personality?: string;
  scenario?: string;
  [key: string]: unknown;
}

export interface STContext {
  chat: STMessage[];
  name1: string;
  name2: string;
  characters?: STCharacter[];
  characterId?: string | number;
  groupId?: string;
  maxContext?: number;
  extensionSettings?: Record<string, unknown>;
  saveSettingsDebounced?: () => void;
  saveChat?: () => Promise<void>;
  reloadCurrentChat?: () => Promise<void>;
  updateMessageBlock?: (
    messageId: number,
    message: STMessage,
    options?: { rerenderMessage?: boolean },
  ) => unknown;
  /** ST 的消息渲染管线:原文 → 正则脚本(深度由 messageId 推算)→ markdown → 安全过滤后的 HTML */
  messageFormatting?: (
    mes: string,
    chName: string,
    isSystem: boolean,
    isUser: boolean,
    messageId: number,
    sanitizerOverrides?: Record<string, unknown>,
    isReasoning?: boolean,
  ) => string;
  eventSource?: {
    on?: (event: unknown, handler: (...args: unknown[]) => void) => void;
    off?: (event: unknown, handler: (...args: unknown[]) => void) => void;
    emit: (event: unknown, ...args: unknown[]) => Promise<void>;
  };
  eventTypes?: {
    CHAT_CHANGED?: unknown;
    MESSAGE_EDITED?: unknown;
    MESSAGE_UPDATED?: unknown;
    USER_MESSAGE_RENDERED?: unknown;
    CHARACTER_MESSAGE_RENDERED?: unknown;
    OAI_PRESET_CHANGED_AFTER?: unknown;
  };
  getRequestHeaders: () => Record<string, string>;
  /** 头像缩略图地址(type: 'avatar' 角色 / 'persona' 用户) */
  getThumbnailUrl?: (type: string, file: string) => string;
  getCurrentChatId?: () => string | undefined;
  executeSlashCommandsWithOptions?: (
    command: string,
    options?: { handleExecutionErrors?: boolean; source?: string },
  ) => Promise<{ isError?: boolean; errorMessage?: string } | undefined>;
  callGenericPopup?: (message: string, type: unknown) => Promise<unknown>;
  POPUP_TYPE?: { CONFIRM?: unknown };
  substituteParams?: (content: string) => string;
  generateRaw?: (params: {
    prompt: Array<{ role: string; content: string }> | string;
    responseLength?: number | null;
  }) => Promise<string>;
  getWorldInfoPrompt?: (
    chat: string[],
    maxContext: number,
    isDryRun: boolean,
    globalScanData?: Record<string, unknown>,
  ) => Promise<{
    worldInfoBefore?: string;
    worldInfoAfter?: string;
    worldInfoString?: string;
    worldInfoDepth?: Array<{ depth?: number; role?: number; entries?: string[] }>;
    anBefore?: string[];
    anAfter?: string[];
  }>;
}

interface STGlobal {
  getContext: () => STContext;
}

declare global {
  interface Window {
    SillyTavern?: STGlobal;
  }
}

export function getContext(): STContext | null {
  try {
    return window.SillyTavern?.getContext?.() ?? null;
  } catch {
    return null;
  }
}

/**
 * 更新消息正文时同步当前 swipe。
 *
 * ST 的保存格式可能同时保留 `mes` 与 `swipes[swipe_id]`。不主动创建 swipes；
 * 仅在消息已有 swipes 时同步当前页，缺少 swipe_id 时按第一页处理。
 */
export function setMessageText(message: STMessage | undefined, text: string): void {
  if (!message) return;
  message.mes = text;
  if (!Array.isArray(message.swipes)) return;
  const index = typeof message.swipe_id === 'number' ? message.swipe_id : 0;
  if (index >= 0 && index < message.swipes.length) {
    message.swipes[index] = text;
  }
}

export function getOpenChatId(context: STContext | null = getContext()): string {
  const chatId = context?.getCurrentChatId?.();
  return typeof chatId === 'string' ? chatId.trim() : '';
}

export function getOpenChatIdentity(context: STContext | null = getContext()): string {
  const chatId = getOpenChatId(context);
  if (!chatId || !context) return '';
  if (context.groupId) return `group:${context.groupId}\u0000${chatId}`;

  const characterIndex = context.characterId;
  const character =
    characterIndex === undefined || characterIndex === null || characterIndex === ''
      ? undefined
      : context.characters?.[Number(characterIndex)];
  const characterKey = character?.avatar || String(characterIndex ?? '');
  return `character:${characterKey}\u0000${chatId}`;
}

export interface WorldInfoEntry {
  world?: string;
  comment?: string;
  content?: string;
  [key: string]: unknown;
}

interface CheckWorldInfoResult {
  allActivatedEntries?: Set<WorldInfoEntry> | Map<string, WorldInfoEntry>;
  [key: string]: unknown;
}

type CheckWorldInfoFn = (
  chat: string[],
  maxContext: number,
  isDryRun: boolean,
  globalScanData?: Record<string, unknown>,
) => Promise<CheckWorldInfoResult>;

export async function getCheckWorldInfo(): Promise<CheckWorldInfoFn | null> {
  try {
    const path = '/scripts/world-info.js';
    const module = (await import(/* @vite-ignore */ path)) as Record<string, unknown>;
    return typeof module.checkWorldInfo === 'function'
      ? (module.checkWorldInfo as CheckWorldInfoFn)
      : null;
  } catch {
    return null;
  }
}

export interface EjsTemplateApi {
  prepareContext: (context?: Record<string, unknown>, end?: number) => Promise<Record<string, unknown>>;
  evalTemplate: (
    code: string,
    context?: Record<string, unknown> | null,
    options?: Record<string, unknown>,
  ) => Promise<string | null>;
}

export function getEjsTemplate(): EjsTemplateApi | null {
  const api = (globalThis as { EjsTemplate?: Partial<EjsTemplateApi> }).EjsTemplate;
  if (api && typeof api.prepareContext === 'function' && typeof api.evalTemplate === 'function') {
    return api as EjsTemplateApi;
  }
  return null;
}
