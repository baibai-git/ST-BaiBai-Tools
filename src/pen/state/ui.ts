import { reactive, ref } from 'vue';

export type ThemeName = 'day' | 'night' | 'pastel' | 'green' | 'st';
export type AppPage = 'workspace' | 'settings' | 'floors';
export type WorkspaceStage = 'annotate' | 'review';

/**
 * 弹窗 Teleport 宿主:App.vue 根节点直接子级,在页面滚动容器之外。
 * 修复 iOS「可滚动祖先内的 position:fixed 后代」相对滚动内容而非视口定位的问题。
 * 仍在 shadow root 内,scoped 样式与 --bby-* 主题变量照常生效(故不能用 Teleport to="body")。
 */
export const modalHost = ref<HTMLElement | null>(null);

/**
 * 窗口最近一次打开的时间戳。用于在打开瞬间忽略遮罩关闭——
 * 移动端打开手势末尾合成的 click 会穿透到刚渲染的遮罩,造成"秒关"。
 */
export let lastOpenedAt = 0;

export interface ParagraphDraft {
  id: number;
  text: string;
}

export function splitParagraphs(text: string): ParagraphDraft[] {
  const parts = text
    .replace(/\r\n?/g, '\n')
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean);
  return parts.map((part, index) => ({
    id: index + 1,
    text: part,
  }));
}

export function applyParagraphReplacements(
  text: string,
  replacements: ReadonlyMap<number, string>,
): string {
  if (!replacements.size) return text;
  const parts = text.split(/(\r\n|\n|\r)/);
  let paragraph = 0;
  let output = '';

  for (let index = 0; index < parts.length; index += 2) {
    const line = parts[index] ?? '';
    const lineEnding = parts[index + 1] ?? '';
    if (!line.trim()) {
      output += line + lineEnding;
      continue;
    }

    paragraph += 1;
    const replacement = replacements.get(paragraph);
    if (replacement === '') {
      continue;
    }

    let rendered = line;
    if (replacement !== undefined) {
      const original = line.trim();
      const start = line.indexOf(original);
      rendered = `${line.slice(0, start)}${replacement}${line.slice(start + original.length)}`;
    }
    output += rendered + lineEnding;
  }

  if (!text.match(/(?:\r\n|\n|\r)$/)) {
    output = output.replace(/(?:\r\n|\n|\r)$/, '');
  }
  return output.trim() ? output : '';
}

export const ui = reactive({
  open: false,
  page: 'workspace' as AppPage,
  stage: 'annotate' as WorkspaceStage,
  theme: 'day' as ThemeName,
  floor: null as number | null,
  floorLabel: '',
  speaker: '',
  originalText: '',
  chatId: '',
  sessionRevision: 0,
  paragraphs: [] as ParagraphDraft[],
});

export const THEMES: Array<{ value: ThemeName; label: string; icon: string }> = [
  { value: 'day', label: '日间', icon: 'sun' },
  { value: 'night', label: '夜间', icon: 'moon' },
  { value: 'pastel', label: '粉彩', icon: 'sparkles' },
  { value: 'green', label: '木白', icon: 'leaf' },
  { value: 'st', label: '跟随ST', icon: 'plug' },
];

export function openPen(
  text: string,
  floor: number,
  speaker: string,
  chatId = '',
): void {
  ui.floor = floor;
  ui.floorLabel = `#${floor}`;
  ui.speaker = speaker;
  ui.originalText = text;
  ui.chatId = chatId;
  ui.paragraphs = splitParagraphs(text);
  ui.sessionRevision += 1;
  ui.page = 'workspace';
  ui.stage = 'annotate';
  ui.open = true;
  lastOpenedAt = performance.now();
}

export function closePen(): void {
  ui.open = false;
}

/** 魔法棒入口(未在编辑态):先开楼层列表,选一楼再进工作台。不动 sessionRevision。 */
export function openFloorPicker(): void {
  ui.page = 'floors';
  ui.open = true;
  lastOpenedAt = performance.now();
}

export function cycleTheme(): void {
  const index = THEMES.findIndex(theme => theme.value === ui.theme);
  ui.theme = THEMES[(index + 1) % THEMES.length].value;
}
