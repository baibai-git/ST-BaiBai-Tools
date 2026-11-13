import { getContext } from '@pen/st/context';
import type { ThemeName } from '@pen/state/ui';
import { reactive, watch } from 'vue';

export interface QuickPhrase {
  id: number;
  name: string;
  instruction: string;
  favorite: boolean;
}

export interface PenPrompts {
  /** 破限提示词:置顶 system 附加在改写请求里;空串=用内置默认。 */
  jailbreak: string;
  /** 思维链提示词:在最终改写任务之后追加;空串=用内置默认。 */
  chainOfThought: string;
}

/** 查找替换规则:对楼层全文做确定性替换,不经过 AI。 */
export interface ReplaceRule {
  id: number;
  name: string;
  /** 匹配内容;isRegex 时按正则解析。 */
  pattern: string;
  /** 替换为;空串 = 删除匹配内容。 */
  replacement: string;
  isRegex: boolean;
  /** 勾选后对当前楼层生效。 */
  enabled: boolean;
}

/** 楼层列表筛选:全部 / 角色 / 用户 / 隐藏 */
export type FloorFilter = 'all' | 'char' | 'user' | 'hidden';
/** 楼层列表排序:desc 最新在前 / asc 最早在前 */
export type FloorOrder = 'desc' | 'asc';

/** 悬浮球形状,与柏宝书/柏宝绘一致 */
export type OrbShape = 'bookmark' | 'circle' | 'square';
export const ORB_SHAPES: Array<{ value: OrbShape; label: string }> = [
  { value: 'bookmark', label: '书签' },
  { value: 'circle', label: '圆形' },
  { value: 'square', label: '方形' },
];

export interface PenSettings {
  defaultChannelId: string;
  defaultContextRounds: number;
  theme: ThemeName;
  floorFilter: FloorFilter;
  floorOrder: FloorOrder;
  /** 楼层预览和工作台收起思维链(<think> 等块),只影响显示 */
  hideThinking: boolean;
  showOrb: boolean;
  /** 自定义悬浮球图标(ST 服务器图片路径),空=默认画笔 */
  orbImage: string;
  orbShape: OrbShape;
  /** 静止不透明度 20–100(%) */
  orbOpacity: number;
  /** 基准尺寸 32–80(px) */
  orbSize: number;
  quickPhraseDefaultsVersion: number;
  phrases: QuickPhrase[];
  prompts: PenPrompts;
  replaceRules: ReplaceRule[];
}

const SETTINGS_KEY = 'baibai_pen';
const QUICK_PHRASE_DEFAULTS_VERSION = 1;

export const DEFAULT_QUICK_PHRASES: readonly QuickPhrase[] = [
  {
    id: 1,
    name: '吃点别的',
    instruction: '吃点别的东西，不要老吃这个',
    favorite: false,
  },
  {
    id: 2,
    name: '禁慢点吃',
    instruction: '不要出现“慢点吃，没人跟你抢”之类的句式',
    favorite: false,
  },
  {
    id: 3,
    name: '别老吃饭',
    instruction: '角色没有这么爱吃饭，不要老是提起吃饭',
    favorite: false,
  },
  {
    id: 4,
    name: '禁老子',
    instruction: '不要使用老子自称',
    favorite: false,
  },
  {
    id: 5,
    name: '禁投石',
    instruction: '不要出现石子投入湖面这样的描写，包括其变体也不要',
    favorite: false,
  },
  {
    id: 6,
    name: '禁不是而是',
    instruction: '不要使用“不是而是”的句式',
    favorite: false,
  },
  {
    id: 7,
    name: '禁发白衬衫和军靴',
    instruction: '不要写衣服写得发白，换一个，也不要穿军靴',
    favorite: false,
  },
  {
    id: 8,
    name: '禁不容置疑等',
    instruction: '不要出现不容置疑，掌控欲，占有欲，野兽，低吼，猎物猎手等词',
    favorite: false,
  },
  {
    id: 9,
    name: '别做完就睡',
    instruction: '不要性爱之后马上睡觉，除了睡觉还有很多事情可以做',
    favorite: false,
  },
  {
    id: 10,
    name: '禁绝望',
    instruction: '不要动不动就崩溃绝望，角色的心理没有这么脆弱',
    favorite: false,
  },
];

function cloneDefaultQuickPhrases(): QuickPhrase[] {
  return DEFAULT_QUICK_PHRASES.map(phrase => ({ ...phrase }));
}

const LEGACY_PLACEHOLDER_REPLACE_RULES: readonly ReplaceRule[] = [
  {
    id: 1,
    name: '统一省略号',
    pattern: '\\.{3,}',
    replacement: '……',
    isRegex: true,
    enabled: true,
  },
  {
    id: 2,
    name: '清理行尾空白',
    pattern: '[ \\t]+$',
    replacement: '',
    isRegex: true,
    enabled: false,
  },
];

function isLegacyPlaceholderReplaceRule(rule: ReplaceRule): boolean {
  return LEGACY_PLACEHOLDER_REPLACE_RULES.some(
    placeholder =>
      rule.id === placeholder.id &&
      rule.name === placeholder.name &&
      rule.pattern === placeholder.pattern &&
      rule.replacement === placeholder.replacement &&
      rule.isRegex === placeholder.isRegex,
  );
}

function normalizeReplaceRules(raw: unknown): ReplaceRule[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const rule = item as Partial<ReplaceRule>;
      return {
        id: typeof rule.id === 'number' ? rule.id : Date.now() + Math.random(),
        name: typeof rule.name === 'string' ? rule.name : '',
        pattern: typeof rule.pattern === 'string' ? rule.pattern : '',
        replacement: typeof rule.replacement === 'string' ? rule.replacement : '',
        isRegex: rule.isRegex === true,
        enabled: rule.enabled !== false,
      };
    })
    .filter(item => item.name.trim() && item.pattern)
    .filter(item => !isLegacyPlaceholderReplaceRule(item));
}

function normalizeQuickPhrases(raw: unknown): QuickPhrase[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item && typeof item === 'object')
    .map(item => {
      const phrase = item as Partial<QuickPhrase>;
      return {
        id: typeof phrase.id === 'number' ? phrase.id : Date.now() + Math.random(),
        name: typeof phrase.name === 'string' ? phrase.name : '',
        instruction: typeof phrase.instruction === 'string' ? phrase.instruction : '',
        favorite: phrase.favorite === true,
      };
    })
    .filter(item => item.name.trim() && item.instruction.trim());
}

function defaults(): PenSettings {
  return {
    defaultChannelId: '',
    defaultContextRounds: 1,
    theme: 'day',
    floorFilter: 'all',
    floorOrder: 'desc',
    hideThinking: true,
    showOrb: false,
    orbImage: '',
    orbShape: 'bookmark',
    orbOpacity: 62,
    orbSize: 48,
    quickPhraseDefaultsVersion: QUICK_PHRASE_DEFAULTS_VERSION,
    phrases: cloneDefaultQuickPhrases(),
    prompts: { jailbreak: '', chainOfThought: '' },
    replaceRules: [],
  };
}

function normalizeFloorFilter(value: Record<string, unknown>): FloorFilter {
  const filter = value.floorFilter;
  if (filter === 'all' || filter === 'char' || filter === 'user' || filter === 'hidden') return filter;
  // 旧版只有「显示 User 消息」开关(默认关=只看 AI 楼层),老用户沿用原来看到的列表
  if ('showUserFloors' in value) return value.showUserFloors === true ? 'all' : 'char';
  return 'all';
}

function clampNumber(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value)
    ? Math.min(max, Math.max(min, Math.round(value)))
    : fallback;
}

export function normalizePenSettings(raw: unknown): PenSettings {
  const value = raw && typeof raw === 'object' ? (raw as Partial<PenSettings>) : {};
  const theme =
    value.theme === 'day' ||
      value.theme === 'night' ||
      value.theme === 'pastel' ||
      value.theme === 'green' ||
      value.theme === 'st'
      ? value.theme
      : 'day';
  return {
    defaultChannelId: typeof value.defaultChannelId === 'string' ? value.defaultChannelId : '',
    defaultContextRounds:
      typeof value.defaultContextRounds === 'number' && Number.isFinite(value.defaultContextRounds)
        ? Math.min(10, Math.max(0, Math.floor(value.defaultContextRounds)))
        : 1,
    theme,
    floorFilter: normalizeFloorFilter(value as Record<string, unknown>),
    floorOrder: value.floorOrder === 'asc' ? 'asc' : 'desc',
    hideThinking: value.hideThinking !== false,
    showOrb: value.showOrb === true,
    orbImage: typeof value.orbImage === 'string' ? value.orbImage : '',
    orbShape: ORB_SHAPES.some(shape => shape.value === value.orbShape) ? (value.orbShape as OrbShape) : 'bookmark',
    orbOpacity: clampNumber(value.orbOpacity, 20, 100, 62),
    orbSize: clampNumber(value.orbSize, 32, 80, 48),
    quickPhraseDefaultsVersion: QUICK_PHRASE_DEFAULTS_VERSION,
    phrases:
      value.quickPhraseDefaultsVersion === QUICK_PHRASE_DEFAULTS_VERSION
        ? normalizeQuickPhrases(value.phrases)
        : cloneDefaultQuickPhrases(),
    prompts: {
      jailbreak: typeof value.prompts?.jailbreak === 'string' ? value.prompts.jailbreak : '',
      chainOfThought:
        typeof value.prompts?.chainOfThought === 'string' ? value.prompts.chainOfThought : '',
    },
    // 旧版本曾内置两条界面占位规则；加载时清理，之后规则库只保留用户规则。
    replaceRules: Array.isArray(value.replaceRules)
      ? normalizeReplaceRules(value.replaceRules)
      : [],
  };
}

export const penSettings = reactive<PenSettings>(defaults());

let ready = false;

function persist(): void {
  const context = getContext();
  if (!context?.extensionSettings) return;
  context.extensionSettings[SETTINGS_KEY] = JSON.parse(JSON.stringify(penSettings));
  context.saveSettingsDebounced?.();
}

export async function initializePenSettings(): Promise<void> {
  if (ready) return;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const context = getContext();
    if (context?.extensionSettings) {
      Object.assign(penSettings, normalizePenSettings(context.extensionSettings[SETTINGS_KEY]));
      context.extensionSettings[SETTINGS_KEY] = JSON.parse(JSON.stringify(penSettings));
      context.saveSettingsDebounced?.();
      ready = true;
      return;
    }
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  ready = true;
}

watch(
  penSettings,
  () => {
    if (ready) persist();
  },
  { deep: true },
);
