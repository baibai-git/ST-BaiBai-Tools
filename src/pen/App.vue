<script setup lang="ts">
import { fetchModels, testChannel as testApiChannel } from '@pen/api/client';
import { CHAIN_OF_THOUGHT_PROMPT, JAILBREAK_PROMPT } from '@pen/api/prompts';
import {
  rewriteCurrentFloor,
  type RewriteChange,
  type RewriteResult,
} from '@pen/api/rewrite';
import { ORB_SHAPES, penSettings, type FloorFilter, type OrbShape, type PenSettings, type QuickPhrase, type ReplaceRule } from '@pen/api/settings';
import {
  bookUpdatePromptOpen,
  canEditChannels,
  channels,
  newChannel,
  performBookUpdate,
  removeSharedChannel,
  requestBookUpdate,
  saveSharedChannel,
  sharingState,
  type ApiChannel,
} from '@pen/api/sharedChannels';
import Collapsible from '@pen/components/Collapsible.vue';
import BbySelect from '@pen/components/BbySelect.vue';
import FloatingOrb from '@pen/components/FloatingOrb.vue';
import Icon from '@pen/components/Icon.vue';
import ModalMask from '@pen/components/ModalMask.vue';
import PhrasePicker from '@pen/components/PhrasePicker.vue';
import { replaceText, replaceTextWithRules, type ReplacementResult } from '@pen/replacement';
import {
  classifyGenerationChat,
  isGenerationTargetOpen,
  type GenerationTarget,
} from '@pen/state/generationTask';
import { buildReviewRows, type ReviewRow } from '@pen/state/review';
import {
  buildFloorPreview,
  findThinkingParagraphIds,
  paragraphIdsCoveredByRanges,
  removeRanges,
  type TextRange,
} from '@pen/st/floorPreview';
import { collectHideScripts, findHiddenRanges } from '@pen/st/regexHide';
import { deleteFloorsFrom, toggleFloorHidden } from '@pen/st/floorActions';
import { captureFloorShot, downloadBlob } from '@pen/st/floorShot';
import { applyFloorText, getFloorSourceText, openFloorInPen } from '@pen/st/openFloor';
import {
  closePen,
  cycleTheme,
  applyParagraphReplacements,
  lastOpenedAt,
  modalHost,
  THEMES,
  ui,
  type AppPage,
} from '@pen/state/ui';
import { getContext, getOpenChatId, getOpenChatIdentity } from '@pen/st/context';
import { computed, nextTick, onMounted, onUnmounted, ref, shallowRef, watch } from 'vue';

interface WorkspaceDraftSnapshot {
  selectedChannelId: string;
  contextRounds: number;
  carryWorldbook: boolean;
  carryCharDesc: boolean;
  carryUserDesc: boolean;
  generalNote: string;
  globalPhraseIds: number[];
  markedPhrases: Record<number, number[]>;
  paragraphNotes: Record<number, string>;
}

type GenerationOutcome =
  | { kind: 'success'; result: RewriteResult }
  | { kind: 'error'; message: string };

interface GenerationTask extends GenerationTarget {
  id: number;
  chatId: string;
  originalText: string;
  draft: WorkspaceDraftSnapshot;
  controller: AbortController;
  outcome: GenerationOutcome | null;
}

const expandedId = ref<number | null>(null);
const selectedChannelId = ref('');
const contextRounds = ref(1);
const carryWorldbook = ref(true);
const carryCharDesc = ref(true);
const carryUserDesc = ref(true);
const generalNote = ref('');
const globalPhraseIds = ref<number[]>([]);
const showKey = ref(false);
const channelDraft = ref<ApiChannel | null>(null);

/**
 * 思考强度候选：各家取值的并集，**不是**某一家的官方列表。
 * auto 是显式选项（值为空串 = 不发送该参数），不是「留空」。
 * 取值不做校验，原样发给端点（见 ApiChannel.reasoningEffort）。
 */
const REASONING_EFFORT_OPTIONS = [
  { value: '', label: 'auto' },
  { value: 'minimal', label: 'minimal' },
  { value: 'low', label: 'low' },
  { value: 'medium', label: 'medium' },
  { value: 'high', label: 'high' },
  { value: 'xhigh', label: 'xhigh' },
  { value: 'max', label: 'max' },
];
const phraseDraft = ref<QuickPhrase | null>(null);
const testMessage = ref('');
const modelOptions = ref<string[]>([]);
const loadingModels = ref(false);
const modelMenuOpen = ref(false);
const modelQuery = ref('');
const toastText = ref('');
const markedPhrases = ref<Record<number, number[]>>({});
const paragraphNotes = ref<Record<number, string>>({});
const rewriteChanges = ref<RewriteChange[]>([]);
const reviewDecision = ref<Record<number, 'accept' | 'reject'>>({});
/* 审阅页内联手改:键是段落号,值是用户改过的结果文本(与 AI 版不同才登记) */
const editedResults = ref<Record<number, string>>({});
const editingResultId = ref<number | null>(null);
const resultDraft = ref('');
/* 工作台模式:标注=给 AI 下指令;多选=点选多段一次填同一组要求;编辑=不走 AI,直接手动改文 */
const workMode = ref<'annotate' | 'multi' | 'edit'>('annotate');
const editDrafts = ref<string[]>([]);
/* 多选模式的选中段落与共用要求草稿(应用后写入各段标注,自身即清空) */
const multiSelected = ref<number[]>([]);
const bulkPhraseIds = ref<number[]>([]);
const bulkNote = ref('');
const generationError = ref('');
const saving = ref(false);
const replacing = ref(false);
const contextSummary = ref('');
const generationTask = shallowRef<GenerationTask | null>(null);
const currentChatIdentity = ref(getOpenChatIdentity());
let generationSequence = 0;

const generating = computed(() => generationTask.value?.outcome === null);
const viewingGenerationTarget = computed(() =>
  isGenerationTargetOpen(
    generationTask.value,
    currentChatIdentity.value,
    ui.floor,
  ),
);
const generationButtonLabel = computed(() => {
  if (!generating.value) return ui.stage === 'annotate' ? '生成' : '重新生成';
  if (viewingGenerationTarget.value) return '生成中…';
  return `#${generationTask.value?.floor ?? ''} 生成中`;
});

const phrases = computed(() =>
  [...penSettings.phrases].sort((left, right) => Number(right.favorite) - Number(left.favorite)),
);

/* —— 工作台:行标注是主体;整体要求与查找替换为顶部折叠区 —— */
const generalFilled = computed(() => !!generalNote.value.trim() || globalPhraseIds.value.length > 0);
const enabledRuleCount = computed(() => penSettings.replaceRules.filter(rule => rule.enabled).length);

const markedCount = computed(() => ui.paragraphs.filter(paragraph => isMarked(paragraph.id)).length);
// 思维链/草稿行只在界面上收起,行号不变,标注/改写/保存仍按原文。
// 除了 <think> 等标签,还按当前生效的正则判断:勾了「仅格式显示」且替换成空或 <details> 的,
// 聊天里本来就看不到,这里也收起。正则每次现读,打开砚、切聊天、切预设时刷新。
const regexRevision = ref(0);
const hideScripts = computed(() => {
  void regexRevision.value;
  return collectHideScripts();
});
function regexHiddenRanges(text: string, floor: number): TextRange[] {
  const chat = getContext()?.chat ?? [];
  return findHiddenRanges(
    text,
    { isUser: chat[floor]?.is_user === true, depth: chat.length - 1 - floor },
    hideScripts.value,
  );
}
const thinkingParagraphIds = computed(() => {
  const ids = findThinkingParagraphIds(ui.paragraphs);
  if (ui.floor != null) {
    for (const id of paragraphIdsCoveredByRanges(ui.originalText, regexHiddenRanges(ui.originalText, ui.floor))) {
      ids.add(id);
    }
  }
  // 整楼都会被收起时(比如正文也被正则包住)就不收,免得工作台一片空白
  return ids.size >= ui.paragraphs.length ? new Set<number>() : ids;
});
const isThinkingHidden = (id: number) => penSettings.hideThinking && thinkingParagraphIds.value.has(id);
const hasInstructions = computed(
  () =>
    markedCount.value > 0 ||
    !!generalNote.value.trim() ||
    globalPhraseIds.value.length > 0,
);
const nextTheme = computed(() => {
  const index = THEMES.findIndex(theme => theme.value === ui.theme);
  return THEMES[(index + 1) % THEMES.length];
});
const reviewRows = computed(() =>
  buildReviewRows(
    rewriteChanges.value,
    ui.paragraphs.map(paragraph => paragraph.text),
  ).map(row => ({
    ...row,
    marked: row.paragraphs.some(isMarked),
  })),
);
const acceptedCount = computed(
  () => rewriteChanges.value.filter(change => reviewDecision.value[change.paragraph] === 'accept').length,
);

function reviewRowDecision(row: ReviewRow): 'accept' | 'reject' | 'mixed' {
  const decisions = row.paragraphs.map(paragraph => reviewDecision.value[paragraph]);
  if (decisions.every(decision => decision === 'accept')) return 'accept';
  if (decisions.every(decision => decision === 'reject')) return 'reject';
  return 'mixed';
}

function setReviewRowDecision(row: ReviewRow, decision: 'accept' | 'reject'): void {
  for (const paragraph of row.paragraphs) {
    reviewDecision.value[paragraph] = decision;
  }
}

watch(
  () => ui.sessionRevision,
  () => {
    markedPhrases.value = {};
    paragraphNotes.value = {};
    expandedId.value = null;
    generalNote.value = '';
    globalPhraseIds.value = [];
    rewriteChanges.value = [];
    reviewDecision.value = {};
    editedResults.value = {};
    editingResultId.value = null;
    resultDraft.value = '';
    workMode.value = 'annotate';
    editDrafts.value = [];
    multiSelected.value = [];
    bulkPhraseIds.value = [];
    bulkNote.value = '';
    generationError.value = '';
    contextSummary.value = '';
    contextRounds.value = penSettings.defaultContextRounds;
    selectedChannelId.value =
      penSettings.defaultChannelId &&
      channels.some(channel => channel.id === penSettings.defaultChannelId)
        ? penSettings.defaultChannelId
        : '';
    ui.stage = 'annotate';
  },
  { immediate: true },
);

watch(
  () => penSettings.theme,
  theme => {
    if (ui.theme !== theme) ui.theme = theme;
  },
  { immediate: true },
);

watch(
  () => ui.theme,
  theme => {
    if (penSettings.theme !== theme) penSettings.theme = theme;
  },
);

watch(
  () => channels.map(channel => channel.id),
  ids => {
    if (selectedChannelId.value && !ids.includes(selectedChannelId.value)) {
      selectedChannelId.value = '';
    }
    if (penSettings.defaultChannelId && !ids.includes(penSettings.defaultChannelId)) {
      penSettings.defaultChannelId = '';
    }
  },
);

watch(
  () => penSettings.defaultContextRounds,
  value => {
    const normalized = Math.min(10, Math.max(0, Math.floor(Number(value) || 0)));
    if (value !== normalized) penSettings.defaultContextRounds = normalized;
  },
);


function isMarked(id: number): boolean {
  return (markedPhrases.value[id] ?? []).length > 0 || !!paragraphNotes.value[id]?.trim();
}

function markedNames(id: number): string[] {
  return (markedPhrases.value[id] ?? [])
    .map(phraseId => penSettings.phrases.find(phrase => phrase.id === phraseId)?.name)
    .filter((name): name is string => !!name);
}

function toggleExpand(id: number): void {
  if (ui.stage !== 'annotate' || viewingGenerationTarget.value) return;
  if (expandedId.value === id) {
    expandedId.value = null;
    return;
  }
  expandedId.value = id;
}

/* 段落补充要求直连 paragraphNotes:输入即生效,hasInstructions 实时为真,
   不会在「生成」按钮的禁用态下吞掉第一次点击 */
const noteDraft = computed<string>({
  get: () => (expandedId.value == null ? '' : paragraphNotes.value[expandedId.value] ?? ''),
  set: value => {
    if (expandedId.value != null) paragraphNotes.value[expandedId.value] = value;
  },
});

function captureWorkspaceDraft(): WorkspaceDraftSnapshot {
  return {
    selectedChannelId: selectedChannelId.value,
    contextRounds: contextRounds.value,
    carryWorldbook: carryWorldbook.value,
    carryCharDesc: carryCharDesc.value,
    carryUserDesc: carryUserDesc.value,
    generalNote: generalNote.value,
    globalPhraseIds: [...globalPhraseIds.value],
    markedPhrases: Object.fromEntries(
      Object.entries(markedPhrases.value).map(([id, phraseIds]) => [id, [...phraseIds]]),
    ),
    paragraphNotes: { ...paragraphNotes.value },
  };
}

function restoreWorkspaceDraft(draft: WorkspaceDraftSnapshot): void {
  selectedChannelId.value =
    draft.selectedChannelId &&
    channels.some(channel => channel.id === draft.selectedChannelId)
      ? draft.selectedChannelId
      : '';
  contextRounds.value = draft.contextRounds;
  carryWorldbook.value = draft.carryWorldbook;
  carryCharDesc.value = draft.carryCharDesc;
  carryUserDesc.value = draft.carryUserDesc;
  generalNote.value = draft.generalNote;
  globalPhraseIds.value = [...draft.globalPhraseIds];
  markedPhrases.value = Object.fromEntries(
    Object.entries(draft.markedPhrases).map(([id, phraseIds]) => [id, [...phraseIds]]),
  );
  paragraphNotes.value = { ...draft.paragraphNotes };
  expandedId.value = null;
}

function formatContextSummary(result: RewriteResult): string {
  return [
    `历史消息 ${result.historyMessageCount} 条`,
    result.contextParts.charCard ? '角色设定' : '',
    result.contextParts.persona ? '用户设定' : '',
    result.contextParts.worldInfo ? '世界书' : '',
  ].filter(Boolean).join(' · ');
}

function clearMark(id: number): void {
  markedPhrases.value[id] = [];
  paragraphNotes.value[id] = '';
}

function phraseInstruction(id: number): string {
  return penSettings.phrases.find(phrase => phrase.id === id)?.instruction ?? '';
}

function rememberSelectedChannel(): void {
  penSettings.defaultChannelId = selectedChannelId.value;
}

/* —— 底栏渠道:自绘菜单(原生 select 的展开列表是浏览器样式,改不了) —— */
const channelMenuOpen = ref(false);
const channelMenu = ref<HTMLElement | null>(null);

const selectedChannelLabel = computed(() => {
  if (!selectedChannelId.value) return '跟随主 API';
  const channel = channels.find(item => item.id === selectedChannelId.value);
  if (!channel) return '跟随主 API';
  return `${channel.name || '未命名渠道'} · ${channel.model || '未设模型'}`;
});

function toggleChannelMenu(): void {
  channelMenuOpen.value = !channelMenuOpen.value;
}

function pickChannel(id: string): void {
  selectedChannelId.value = id;
  rememberSelectedChannel();
  channelMenuOpen.value = false;
}

function onChannelMenuDocDown(event: PointerEvent): void {
  if (channelMenu.value && !event.composedPath().includes(channelMenu.value)) {
    channelMenuOpen.value = false;
  }
}

function onChannelMenuKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') channelMenuOpen.value = false;
}

watch(channelMenuOpen, open => {
  // 组件在 shadow root 里,composedPath 能穿过 shadow 边界,据此判断点在外部
  if (open) {
    document.addEventListener('pointerdown', onChannelMenuDocDown, true);
    document.addEventListener('keydown', onChannelMenuKeydown, true);
  } else {
    document.removeEventListener('pointerdown', onChannelMenuDocDown, true);
    document.removeEventListener('keydown', onChannelMenuKeydown, true);
  }
});

/* —— 楼层列表(魔法棒入口):列出当前聊天可改写的楼层,新的在前 —— */
interface FloorRow {
  floor: number;
  name: string;
  isUser: boolean;
  /** 已隐藏楼层(is_system):不参与上下文,列表里以小幽灵标注 */
  hidden: boolean;
}

interface FloorPreviewRow extends FloorRow {
  preview: string;
}

const FLOOR_PAGE_SIZE = 20;
const floorRows = ref<FloorRow[]>([]);
const floorChatOpen = ref(false);
const floorPage = ref(0);
const floorQuery = ref('');
/** 防抖后的搜索词,真正参与过滤的是它 */
const floorSearchTerm = ref('');
const floorSearchOpen = ref(false);
const floorSearchInput = ref<HTMLInputElement | null>(null);
const floorPanel = ref<HTMLElement | null>(null);

// 搜索框默认收成一个小图标,点击展开并自动聚焦;再点图标/Esc 清空并收起
async function toggleFloorSearch(): Promise<void> {
  if (floorSearchOpen.value) {
    closeFloorSearch();
    return;
  }
  floorSearchOpen.value = true;
  await nextTick();
  floorSearchInput.value?.focus();
}

function closeFloorSearch(): void {
  floorQuery.value = '';
  floorSearchOpen.value = false;
}

function onFloorSearchBlur(): void {
  if (!floorQuery.value.trim()) floorSearchOpen.value = false;
}

const FLOOR_FILTERS: Array<{ value: FloorFilter; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'char', label: '角色' },
  { value: 'user', label: '用户' },
  { value: 'hidden', label: '隐藏' },
];

// BbySelect 只认 string,在这里收窄回 OrbShape
const orbShapeSel = computed<string>({
  get: () => penSettings.orbShape,
  set: value => (penSettings.orbShape = value as OrbShape),
});

const kindFloorRows = computed(() => {
  switch (penSettings.floorFilter) {
    case 'char':
      return floorRows.value.filter(row => !row.isUser);
    case 'user':
      return floorRows.value.filter(row => row.isUser);
    case 'hidden':
      return floorRows.value.filter(row => row.hidden);
    default:
      return floorRows.value;
  }
});
// floorRows 按最新在前存,正序时反过来
const visibleFloorRows = computed(() =>
  penSettings.floorOrder === 'asc' ? [...kindFloorRows.value].reverse() : kindFloorRows.value,
);

// 搜索:纯数字时把该楼层号精确命中置顶,同时保留按关键词命中的结果
const filteredFloorRows = computed(() => {
  const query = floorSearchTerm.value.trim().toLowerCase();
  if (!query) return visibleFloorRows.value;
  const chat = getContext()?.chat ?? [];
  const matched = visibleFloorRows.value.filter(row => {
    const rawText = chat[row.floor]?.mes;
    return (
      row.name.toLowerCase().includes(query) ||
      (typeof rawText === 'string' && rawText.toLowerCase().includes(query))
    );
  });
  if (!/^\d+$/.test(query)) return matched;
  const exact = visibleFloorRows.value.find(row => row.floor === Number(query));
  if (!exact) return matched;
  return [exact, ...matched.filter(row => row.floor !== exact.floor)];
});

const floorPageCount = computed(() =>
  Math.max(1, Math.ceil(filteredFloorRows.value.length / FLOOR_PAGE_SIZE)),
);
const pagedFloorRows = computed<FloorPreviewRow[]>(() => {
  const chat = getContext()?.chat ?? [];
  return filteredFloorRows.value
    .slice(floorPage.value * FLOOR_PAGE_SIZE, (floorPage.value + 1) * FLOOR_PAGE_SIZE)
    .map(row => {
      const text = chat[row.floor]?.mes ?? '';
      const visible = penSettings.hideThinking ? removeRanges(text, regexHiddenRanges(text, row.floor)) : text;
      return { ...row, preview: buildFloorPreview(visible, penSettings.hideThinking) };
    });
});
const floorPagerHead = computed(() =>
  floorSearchTerm.value.trim() ? `匹配 ${filteredFloorRows.value.length} 楼` : `共 ${visibleFloorRows.value.length} 楼`,
);

// 点页码可直接输入跳转;回车/失焦确认,超出范围就停在首页/末页
const pageJumpOpen = ref(false);
const pageJumpValue = ref('');
const pageJumpInput = ref<HTMLInputElement | null>(null);
async function openPageJump(): Promise<void> {
  pageJumpValue.value = String(floorPage.value + 1);
  pageJumpOpen.value = true;
  await nextTick();
  pageJumpInput.value?.select();
}
function commitPageJump(): void {
  if (!pageJumpOpen.value) return;
  const page = Number.parseInt(pageJumpValue.value, 10);
  if (Number.isFinite(page)) floorPage.value = Math.min(floorPageCount.value, Math.max(1, page)) - 1;
  pageJumpOpen.value = false;
}

// 搜索要扫一遍所有楼层正文,停止输入 200ms 后再搜;清空立即生效
let floorSearchTimer = 0;
watch(floorQuery, query => {
  window.clearTimeout(floorSearchTimer);
  if (!query.trim()) {
    floorSearchTerm.value = '';
    return;
  }
  floorSearchTimer = window.setTimeout(() => {
    floorSearchTerm.value = query;
  }, 200);
});

watch(floorSearchTerm, () => {
  floorPage.value = 0;
});

watch(
  () => [penSettings.floorFilter, penSettings.floorOrder],
  () => {
    floorPage.value = 0;
  },
);

watch(floorPage, () => {
  floorPanel.value?.scrollTo({ top: 0 });
});

// ST 的 chat 不是响应式的,computed 会缓存旧聊天;每次进入楼层页时重建
function refreshFloorRows(): void {
  const context = getContext();
  const chatId = getOpenChatId(context);
  floorChatOpen.value = !!chatId;
  if (!chatId) {
    floorRows.value = [];
    ui.floor = null;
    ui.floorLabel = '';
    ui.speaker = '';
    ui.originalText = '';
    ui.chatId = '';
    ui.paragraphs = [];
    floorPage.value = 0;
    floorQuery.value = '';
    floorSearchOpen.value = false;
    return;
  }

  if (ui.chatId && ui.chatId !== chatId) {
    ui.floor = null;
    ui.floorLabel = '';
    ui.speaker = '';
    ui.originalText = '';
    ui.chatId = '';
    ui.paragraphs = [];
  }

  const chat = context?.chat ?? [];
  const rows: FloorRow[] = [];
  chat.forEach((message, index) => {
    if (!message || message.mes == null) return;
    rows.push({
      floor: index,
      name: message.name || (message.is_user ? 'User' : 'Char'),
      isUser: message.is_user === true,
      hidden: message.is_system === true,
    });
  });
  floorRows.value = rows.reverse();
  floorPage.value = 0;
  floorQuery.value = '';
  floorSearchOpen.value = false;
}

watch(
  () => [ui.open, ui.page] as const,
  ([open, page]) => {
    if (open && page === 'floors') refreshFloorRows();
  },
  { immediate: true },
);

function enterFloor(floor: number): void {
  const ok = openFloorInPen(floor);
  if (!ok) showToast('无法打开该楼层');
}

async function onToggleFloorHidden(floor: number): Promise<void> {
  try {
    const nowHidden = await toggleFloorHidden(floor);
    refreshFloorRows();
    showToast(nowHidden ? `已隐藏第 ${floor} 层` : `已显示第 ${floor} 层`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '操作失败');
  }
}

async function onDeleteFloor(floor: number): Promise<void> {
  try {
    const deleted = await deleteFloorsFrom(floor);
    if (!deleted) return;
    // 被删范围包含当前正在改写的楼层时,工作区内容已失效,一并清掉
    if (ui.floor != null && ui.floor >= floor) {
      ui.floor = null;
      ui.floorLabel = '';
      ui.speaker = '';
      ui.originalText = '';
      ui.chatId = '';
      ui.paragraphs = [];
    }
    refreshFloorRows();
    showToast(`已删除第 ${floor} 层及之后 ${deleted} 层`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '删除失败');
  }
}

/* —— 楼层截图:深度 0 重渲染 + 酒馆助手 iframe 实况合成,导出图片 —— */
const shootingFloor = ref<number | null>(null);

async function onShootFloor(floor: number): Promise<void> {
  if (shootingFloor.value != null) return;
  shootingFloor.value = floor;
  showToast(`正在生成第 ${floor} 层截图…`);
  try {
    // 截图一开始就占住主线程,先把提示框和按钮状态画出来再开截,否则提示框要等截完才出现
    await waitForToastPaint();
    const { blob, outcome } = await captureFloorShot(floor);
    downloadBlob(blob, outcome.suggestedName);
    if (outcome.frontendBlocks > outcome.iframesCaptured) {
      const missed = outcome.frontendBlocks - outcome.iframesCaptured;
      toastr?.warning?.(
        outcome.floorInDom
          ? `截图已保存，但有 ${missed} 个前端界面未渲染，以代码块显示`
          : `截图已保存，但楼层未加载到聊天区，${missed} 个前端界面以代码块显示`,
        '柏宝砚',
      );
    } else {
      showToast(`第 ${floor} 层截图已保存`);
    }
  } catch (error) {
    showToast(error instanceof Error ? error.message : '截图失败');
  } finally {
    shootingFloor.value = null;
  }
}

function goToWorkspace(): void {
  ui.page = ui.floor == null ? 'floors' : 'workspace';
}

// 移动端:再点一下当前页的导航按钮即关闭整窗(对齐柏宝书,省得去够右上角的 ×);非当前页正常切页。
function onMobileNavClick(page: AppPage): void {
  if (ui.page === page) {
    closePen();
    return;
  }
  if (page === 'workspace') goToWorkspace();
  else ui.page = page;
}

function isCurrentGenerationTask(taskId: number): boolean {
  return generationTask.value?.id === taskId;
}

function discardGenerationTask(taskId: number, notify = false): void {
  const task = generationTask.value;
  if (!task || task.id !== taskId) return;
  task.controller.abort();
  generationTask.value = null;
  if (notify) showToast('聊天已切换，本次生成结果已丢弃');
}

async function reconcileGenerationTask(expectedTaskId?: number): Promise<void> {
  const task = generationTask.value;
  if (!task || (expectedTaskId !== undefined && task.id !== expectedTaskId)) return;

  currentChatIdentity.value = getOpenChatIdentity();
  const location = classifyGenerationChat(task.chatIdentity, currentChatIdentity.value);
  if (location === 'home') return;
  if (location === 'other') {
    discardGenerationTask(task.id, true);
    return;
  }
  if (!task.outcome) return;

  const currentText = getFloorSourceText(task.floor);
  if (currentText == null) {
    generationTask.value = null;
    toastr?.warning?.(`生成目标楼层 #${task.floor} 已不存在，结果已丢弃`, '柏宝砚');
    return;
  }
  if (currentText !== task.originalText) {
    generationTask.value = null;
    toastr?.warning?.(`楼层 #${task.floor} 在生成期间已发生变化，结果已丢弃`, '柏宝砚');
    return;
  }
  if (!openFloorInPen(task.floor)) {
    generationTask.value = null;
    toastr?.warning?.(`无法重新打开生成目标楼层 #${task.floor}`, '柏宝砚');
    return;
  }

  await nextTick();
  if (!isCurrentGenerationTask(task.id)) return;
  currentChatIdentity.value = getOpenChatIdentity();
  const locationAfterOpen = classifyGenerationChat(task.chatIdentity, currentChatIdentity.value);
  if (locationAfterOpen === 'home') return;
  if (locationAfterOpen === 'other') {
    discardGenerationTask(task.id, true);
    return;
  }
  restoreWorkspaceDraft(task.draft);
  generationError.value = '';
  contextSummary.value = '';

  if (task.outcome.kind === 'success') {
    rewriteChanges.value = task.outcome.result.changes;
    reviewDecision.value = Object.fromEntries(
      task.outcome.result.changes.map(change => [change.paragraph, 'accept' as const]),
    );
    contextSummary.value = formatContextSummary(task.outcome.result);
    ui.stage = 'review';
  } else {
    rewriteChanges.value = [];
    reviewDecision.value = {};
    generationError.value = task.outcome.message;
    ui.stage = 'annotate';
    showToast('生成失败');
  }

  generationTask.value = null;
}

let chatChangedHandler: (() => void) | null = null;
let chatChangedEvent: unknown;
let presetChangedEvent: unknown;
const refreshHideScripts = () => {
  regexRevision.value += 1;
};

watch(
  () => ui.open,
  open => {
    if (open) refreshHideScripts();
  },
);

onMounted(() => {
  const context = getContext();
  currentChatIdentity.value = getOpenChatIdentity(context);
  const event = context?.eventTypes?.CHAT_CHANGED;
  const on = context?.eventSource?.on;
  if (!event || typeof on !== 'function') return;
  chatChangedEvent = event;
  chatChangedHandler = () => {
    window.setTimeout(() => {
      currentChatIdentity.value = getOpenChatIdentity();
      refreshHideScripts();
      void reconcileGenerationTask();
    }, 0);
  };
  on.call(context.eventSource, event, chatChangedHandler);
  presetChangedEvent = context.eventTypes?.OAI_PRESET_CHANGED_AFTER;
  if (presetChangedEvent) on.call(context.eventSource, presetChangedEvent, refreshHideScripts);
});

onUnmounted(() => {
  window.clearTimeout(floorSearchTimer);
  const context = getContext();
  if (chatChangedHandler && chatChangedEvent && typeof context?.eventSource?.off === 'function') {
    context.eventSource.off(chatChangedEvent, chatChangedHandler);
  }
  if (presetChangedEvent && typeof context?.eventSource?.off === 'function') {
    context.eventSource.off(presetChangedEvent, refreshHideScripts);
  }
  generationTask.value?.controller.abort();
});

async function startReview(): Promise<void> {
  if (generationTask.value || saving.value || replacing.value) return;
  if (!hasInstructions.value) {
    showToast('请先添加行标注或整体要求');
    return;
  }
  if (ui.floor == null || !ui.originalText.trim()) {
    showToast('当前楼层不可用');
    return;
  }
  contextRounds.value = Math.min(10, Math.max(0, Math.floor(Number(contextRounds.value) || 0)));

  const context = getContext();
  const chatId = getOpenChatId(context);
  const chatIdentity = getOpenChatIdentity(context);
  if (!chatId || !chatIdentity) {
    showToast('当前聊天不可用');
    return;
  }

  const floor = ui.floor;
  const originalText = ui.originalText;
  const draft = captureWorkspaceDraft();
  const selectedChannel = selectedChannelId.value
    ? channels.find(channel => channel.id === selectedChannelId.value) ?? null
    : null;
  const controller = new AbortController();
  const task: GenerationTask = {
    id: ++generationSequence,
    chatId,
    chatIdentity,
    floor,
    originalText,
    draft,
    controller,
    outcome: null,
  };
  currentChatIdentity.value = chatIdentity;
  const annotations = ui.paragraphs
    .filter(paragraph => isMarked(paragraph.id))
    .map(paragraph => ({
      paragraph: paragraph.id,
      text: paragraph.text,
      instructions: [
        ...(markedPhrases.value[paragraph.id] ?? []).map(phraseInstruction),
        paragraphNotes.value[paragraph.id] ?? '',
      ].filter(Boolean),
    }));
  const generalInstructions = [
    ...globalPhraseIds.value.map(phraseInstruction),
    generalNote.value,
  ].filter(Boolean);

  generationError.value = '';
  contextSummary.value = '';
  generationTask.value = task;
  try {
    const result = await rewriteCurrentFloor({
      floor,
      originalText,
      contextRounds: draft.contextRounds,
      includeWorldInfo: draft.carryWorldbook,
      includeCharacterDescription: draft.carryCharDesc,
      includeUserDescription: draft.carryUserDesc,
      channel: selectedChannel ? JSON.parse(JSON.stringify(selectedChannel)) as ApiChannel : null,
      signal: controller.signal,
      generalInstructions,
      annotations,
    });
    if (!isCurrentGenerationTask(task.id)) return;
    generationTask.value = {
      ...task,
      outcome: { kind: 'success', result },
    };
    await reconcileGenerationTask(task.id);
  } catch (error) {
    if (!isCurrentGenerationTask(task.id)) return;
    if (error instanceof DOMException && error.name === 'AbortError') {
      generationTask.value = null;
      return;
    } else {
      generationTask.value = {
        ...task,
        outcome: {
          kind: 'error',
          message: error instanceof Error ? error.message : String(error),
        },
      };
      await reconcileGenerationTask(task.id);
    }
  }
}

function cancelGeneration(): void {
  const task = generationTask.value;
  if (!task || task.outcome) return;
  task.controller.abort();
  generationTask.value = null;
  showToast('已取消生成');
}

function backToAnnotate(): void {
  if (viewingGenerationTarget.value) return;
  ui.stage = 'annotate';
}

/* 离开标注页就退回标注模式,手改草稿与多选状态随之丢弃(都只活在标注页里) */
watch(
  () => ui.stage,
  stage => {
    if (stage !== 'annotate') {
      workMode.value = 'annotate';
      multiSelected.value = [];
      bulkPhraseIds.value = [];
      bulkNote.value = '';
    }
  },
);

/* textarea 随内容自动增高;v-model 更新值后 updated 钩子会再量一次 */
function growTextarea(el: HTMLTextAreaElement): void {
  el.style.height = 'auto';
  el.style.height = `${el.scrollHeight}px`;
}

const vAutogrow = {
  mounted: (el: HTMLTextAreaElement) => growTextarea(el),
  updated: (el: HTMLTextAreaElement) => growTextarea(el),
};

function setWorkMode(mode: 'annotate' | 'multi' | 'edit'): void {
  if (mode === workMode.value) return;
  if (mode === 'edit') {
    expandedId.value = null;
    editDrafts.value = ui.paragraphs.map(paragraph => paragraph.text);
  }
  if (mode === 'multi') {
    expandedId.value = null;
    multiSelected.value = [];
    bulkPhraseIds.value = [];
    bulkNote.value = '';
  }
  workMode.value = mode;
}

/* —— 多选批量标注:点选若干段落,把同一组要求一次写入每段的标注 —— */
function isMultiSelected(id: number): boolean {
  return multiSelected.value.includes(id);
}

function toggleMultiSelect(id: number): void {
  if (viewingGenerationTarget.value) return;
  multiSelected.value = isMultiSelected(id)
    ? multiSelected.value.filter(item => item !== id)
    : [...multiSelected.value, id];
}

const bulkFilled = computed(() => bulkPhraseIds.value.length > 0 || !!bulkNote.value.trim());

/* 应用即写入 markedPhrases/paragraphNotes(与单段标注同一份数据,生成流程不感知多选)。
   语句去重合并,补充要求追加成新行,不覆盖各段已有标注 */
function applyBulkAnnotation(): void {
  if (!multiSelected.value.length || !bulkFilled.value) return;
  const note = bulkNote.value.trim();
  for (const id of multiSelected.value) {
    if (bulkPhraseIds.value.length) {
      const merged = new Set([...(markedPhrases.value[id] ?? []), ...bulkPhraseIds.value]);
      markedPhrases.value[id] = [...merged];
    }
    if (note) {
      const existing = paragraphNotes.value[id]?.trim();
      paragraphNotes.value[id] = existing ? `${existing}\n${note}` : note;
    }
  }
  const count = multiSelected.value.length;
  multiSelected.value = [];
  bulkPhraseIds.value = [];
  bulkNote.value = '';
  workMode.value = 'annotate';
  showToast(`已把要求应用到 ${count} 段`);
}

function cancelMultiSelect(): void {
  workMode.value = 'annotate';
  multiSelected.value = [];
  bulkPhraseIds.value = [];
  bulkNote.value = '';
}

function discardManualEdit(): void {
  workMode.value = 'annotate';
  editDrafts.value = [];
}

const editDirty = computed(() =>
  ui.paragraphs.some(
    (paragraph, index) => (editDrafts.value[index] ?? paragraph.text).trim() !== paragraph.text,
  ),
);

/* 手动保存:只把改过的段落交给 applyParagraphReplacements,未动行的空白/缩进原样保留;
   段落清空即删除该行(与审阅页接受「删除行」同一语义) */
async function saveManualEdit(): Promise<void> {
  if (saving.value || replacing.value || generating.value || viewingGenerationTarget.value) return;
  if (ui.floor == null) {
    showToast('当前楼层不可用');
    return;
  }
  const replacements = new Map<number, string>();
  ui.paragraphs.forEach((paragraph, index) => {
    const draft = (editDrafts.value[index] ?? paragraph.text).trim();
    if (draft !== paragraph.text) replacements.set(paragraph.id, draft);
  });
  if (!replacements.size) {
    showToast('内容没有变化');
    return;
  }
  const nextText = applyParagraphReplacements(ui.originalText, replacements);
  if (!nextText.trim()) {
    showToast('不能把楼层保存为空');
    return;
  }

  const floor = ui.floor;
  const originalText = ui.originalText;
  const chatId = ui.chatId;
  const hadMarks = hasInstructions.value;
  saving.value = true;
  try {
    const result = await applyFloorText(floor, originalText, nextText, chatId);
    if (result === 'chat-changed') {
      showToast('当前聊天已经切换，不能保存修改');
      return;
    }
    if (result === 'floor-changed') {
      showToast('楼层内容已经变化，请重新打开砚');
      return;
    }
    if (result !== 'saved') {
      showToast('无法保存当前楼层');
      return;
    }
    // 重开楼层让段落与最新内容对齐;行号可能已变,原有标注由会话重置一并清掉
    if (ui.floor === floor && ui.chatId === chatId) {
      openFloorInPen(floor);
    }
    showToast(hadMarks ? '修改已保存，原有标注已随行号变化重置' : '修改已保存到楼层');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存楼层失败');
  } finally {
    saving.value = false;
  }
}

/* —— 审阅页内联手改 AI 结果 —— */
function rowEditedResult(row: ReviewRow): string | null {
  if (row.deleted || row.paragraphs.length !== 1) return null;
  return editedResults.value[row.paragraphs[0] ?? -1] ?? null;
}

function displayRowResult(row: ReviewRow): string {
  return rowEditedResult(row) ?? row.result;
}

function isEditingRow(row: ReviewRow): boolean {
  return (
    !row.deleted &&
    row.paragraphs.length === 1 &&
    editingResultId.value === row.paragraphs[0]
  );
}

function startResultEdit(row: ReviewRow): void {
  if (row.deleted || row.paragraphs.length !== 1) return;
  const paragraph = row.paragraphs[0] ?? -1;
  editingResultId.value = paragraph;
  resultDraft.value = editedResults.value[paragraph] ?? row.result;
}

function finishResultEdit(): void {
  const paragraph = editingResultId.value;
  if (paragraph == null) return;
  editingResultId.value = null;
  const change = rewriteChanges.value.find(item => item.paragraph === paragraph);
  if (!change) return;
  const draft = resultDraft.value.trim();
  if (draft === change.replacement) {
    delete editedResults.value[paragraph];
    return;
  }
  editedResults.value[paragraph] = draft;
  // 手改即采纳:用户动手改了,意图就是应用这条
  reviewDecision.value[paragraph] = 'accept';
}

function revertResultEdit(row: ReviewRow): void {
  if (row.paragraphs.length !== 1) return;
  const paragraph = row.paragraphs[0] ?? -1;
  delete editedResults.value[paragraph];
  if (editingResultId.value === paragraph) resultDraft.value = row.result;
}

const editedAcceptedCount = computed(
  () =>
    rewriteChanges.value.filter(
      change =>
        reviewDecision.value[change.paragraph] === 'accept' &&
        editedResults.value[change.paragraph] !== undefined,
    ).length,
);

const applyButtonLabel = computed(() => {
  if (saving.value) return '保存中…';
  if (acceptedCount.value === 0) return '丢弃全部';
  const base = `应用 ${acceptedCount.value} 行`;
  return editedAcceptedCount.value > 0 ? `${base}（含 ${editedAcceptedCount.value} 处手改）` : base;
});

async function finishReview(): Promise<void> {
  if (generating.value || saving.value || replacing.value) return;
  if (ui.floor == null || !rewriteChanges.value.length) return;
  if (acceptedCount.value === 0) {
    closePen();
    toastr?.info?.('已丢弃全部改写结果，原楼层未发生变化', '柏宝砚');
    return;
  }
  const accepted = new Map(
    rewriteChanges.value
      .filter(change => reviewDecision.value[change.paragraph] === 'accept')
      .map(change => [change.paragraph, editedResults.value[change.paragraph] ?? change.replacement] as const),
  );
  const nextText = applyParagraphReplacements(ui.originalText, accepted);

  saving.value = true;
  try {
    const result = await applyFloorText(ui.floor, ui.originalText, nextText, ui.chatId);
    if (result === 'chat-changed') {
      showToast('当前聊天已经切换，不能应用结果');
      return;
    }
    if (result === 'floor-changed') {
      showToast('楼层内容已经变化，请重新打开砚');
      return;
    }
    if (result !== 'saved') {
      showToast('无法保存当前楼层');
      return;
    }
    closePen();
    toastr?.info?.(`改写结果已保存到楼层 #${ui.floor}`, '柏宝砚');
  } catch (error) {
    showToast(error instanceof Error ? error.message : '保存楼层失败');
  } finally {
    saving.value = false;
  }
}

function showToast(message: string): void {
  toastText.value = message;
  window.setTimeout(() => {
    if (toastText.value === message) toastText.value = '';
  }, 2200);
}

/**
 * 等提示框真正画出来:nextTick 后节点已插入,但 <Transition> 的进入动画隔两帧(双 rAF)才开始,
 * 所以再等两帧;rAF 里排的宏任务要等这一帧画完才执行。动画开始后 opacity/transform 由合成线程推进,主线程忙也能播完
 */
async function waitForToastPaint(): Promise<void> {
  await nextTick();
  await new Promise<void>(resolve =>
    requestAnimationFrame(() => requestAnimationFrame(() => window.setTimeout(resolve, 0))),
  );
}

const excludeParamsText = computed<string>({
  get: () => channelDraft.value?.excludeParams.join(', ') ?? '',
  set: value => {
    if (!channelDraft.value) return;
    channelDraft.value.excludeParams = value
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);
  },
});

const filteredModelOptions = computed<string[]>(() => {
  const query = modelQuery.value.trim().toLowerCase();
  const options = query
    ? modelOptions.value.filter(model => model.toLowerCase().includes(query))
    : modelOptions.value;
  return options.slice(0, 200);
});

function openModelMenu(): void {
  modelQuery.value = '';
  modelMenuOpen.value = true;
}

function pickModel(model: string): void {
  if (channelDraft.value) channelDraft.value.model = model;
  modelMenuOpen.value = false;
  modelQuery.value = '';
}

function closeModelMenuSoon(): void {
  window.setTimeout(() => {
    modelMenuOpen.value = false;
    modelQuery.value = '';
  }, 150);
}

function openChannel(channel?: ApiChannel): void {
  if (!sharingState.ready) {
    showToast('渠道正在载入');
    return;
  }
  if (!canEditChannels()) {
    requestBookUpdate();
    return;
  }
  testMessage.value = '';
  modelOptions.value = [];
  loadingModels.value = false;
  modelMenuOpen.value = false;
  modelQuery.value = '';
  showKey.value = false;
  channelDraft.value = channel
    ? JSON.parse(JSON.stringify(channel))
    : newChannel();
}

function saveChannel(): void {
  if (!channelDraft.value) return;
  if (!channelDraft.value.name.trim()) {
    showToast('请填写渠道名');
    return;
  }
  saveSharedChannel(channelDraft.value);
  selectedChannelId.value = channelDraft.value.id;
  rememberSelectedChannel();
  channelDraft.value = null;
  showToast('渠道已保存');
}

function removeChannel(): void {
  if (!channelDraft.value) return;
  removeSharedChannel(channelDraft.value.id);
  channelDraft.value = null;
  selectedChannelId.value = channels[0]?.id ?? '';
  rememberSelectedChannel();
  showToast('渠道已删除');
}

async function testChannel(): Promise<void> {
  if (!channelDraft.value) return;
  testMessage.value = '测试中…';
  const result = await testApiChannel(channelDraft.value);
  testMessage.value = result.message;
}

async function loadModels(): Promise<void> {
  if (!channelDraft.value || loadingModels.value) return;
  loadingModels.value = true;
  testMessage.value = '正在拉取模型…';
  try {
    modelOptions.value = await fetchModels(channelDraft.value);
    if (!channelDraft.value.model && modelOptions.value[0]) {
      channelDraft.value.model = modelOptions.value[0];
    }
    testMessage.value = modelOptions.value.length
      ? `已获取 ${modelOptions.value.length} 个模型`
      : '接口没有返回可用模型';
  } catch (error) {
    testMessage.value = error instanceof Error ? error.message : String(error);
  } finally {
    loadingModels.value = false;
  }
}

function openPhrase(phrase?: QuickPhrase): void {
  phraseDraft.value = phrase
    ? JSON.parse(JSON.stringify(phrase))
    : { id: Date.now(), name: '', instruction: '', favorite: false };
}

function savePhrase(): void {
  if (!phraseDraft.value?.name.trim() || !phraseDraft.value.instruction.trim()) {
    showToast('请填写名称和指令');
    return;
  }
  const index = penSettings.phrases.findIndex(phrase => phrase.id === phraseDraft.value?.id);
  if (index >= 0) penSettings.phrases[index] = phraseDraft.value;
  else penSettings.phrases.push(phraseDraft.value);
  phraseDraft.value = null;
  showToast('快捷语句已保存');
}

function removePhrase(): void {
  if (!phraseDraft.value) return;
  const index = penSettings.phrases.findIndex(phrase => phrase.id === phraseDraft.value?.id);
  if (index >= 0) penSettings.phrases.splice(index, 1);
  phraseDraft.value = null;
}

/* —— 查找替换:快速替换当前楼层,或按顺序执行已启用的全局规则 —— */
const ruleDraft = ref<ReplaceRule | null>(null);

const quickFind = ref('');
const quickReplacement = ref('');
const quickIsRegex = ref(false);

async function applyReplacement(result: ReplacementResult): Promise<void> {
  if (replacing.value || viewingGenerationTarget.value || saving.value) return;
  if (ui.floor == null) {
    showToast('当前楼层不可用');
    return;
  }
  if (!result.count || result.text === ui.originalText) {
    showToast(result.count ? '替换后内容没有变化' : '当前楼层没有匹配内容');
    return;
  }

  const floor = ui.floor;
  const originalText = ui.originalText;
  const chatId = ui.chatId;
  replacing.value = true;
  try {
    const applyResult = await applyFloorText(floor, originalText, result.text, chatId);
    if (applyResult === 'chat-changed') {
      showToast('当前聊天已经切换，不能执行替换');
      return;
    }
    if (applyResult === 'floor-changed') {
      showToast('楼层内容已经变化，请重新打开砚');
      return;
    }
    if (applyResult !== 'saved') {
      showToast('无法保存当前楼层');
      return;
    }

    if (ui.floor === floor && ui.chatId === chatId) {
      openFloorInPen(floor);
    }
    showToast(`已替换 ${result.count} 处`);
  } catch (error) {
    showToast(error instanceof Error ? error.message : '替换失败');
  } finally {
    replacing.value = false;
  }
}

async function runQuickReplace(): Promise<void> {
  try {
    await applyReplacement(
      replaceText(ui.originalText, {
        pattern: quickFind.value,
        replacement: quickReplacement.value,
        isRegex: quickIsRegex.value,
      }),
    );
  } catch (error) {
    showToast(error instanceof Error ? `正则表达式无效：${error.message}` : '替换失败');
  }
}

function saveQuickAsRule(): void {
  openRule({
    id: Date.now(),
    name: '',
    pattern: quickFind.value,
    replacement: quickReplacement.value,
    isRegex: quickIsRegex.value,
    enabled: true,
  });
}

function openRule(rule?: ReplaceRule): void {
  ruleDraft.value = rule
    ? JSON.parse(JSON.stringify(rule))
    : { id: Date.now(), name: '', pattern: '', replacement: '', isRegex: false, enabled: true };
}

function saveRule(): void {
  if (!ruleDraft.value?.name.trim() || !ruleDraft.value.pattern) {
    showToast('请填写规则名和匹配内容');
    return;
  }
  const index = penSettings.replaceRules.findIndex(rule => rule.id === ruleDraft.value?.id);
  if (index >= 0) penSettings.replaceRules[index] = ruleDraft.value;
  else penSettings.replaceRules.push(ruleDraft.value);
  ruleDraft.value = null;
  showToast('替换规则已保存');
}

function removeRule(): void {
  if (!ruleDraft.value) return;
  const index = penSettings.replaceRules.findIndex(rule => rule.id === ruleDraft.value?.id);
  if (index >= 0) penSettings.replaceRules.splice(index, 1);
  ruleDraft.value = null;
}

async function runReplace(): Promise<void> {
  const enabledRules = penSettings.replaceRules.filter(rule => rule.enabled);
  try {
    await applyReplacement(replaceTextWithRules(ui.originalText, enabledRules));
  } catch (error) {
    showToast(error instanceof Error ? error.message : '执行规则失败');
  }
}

/* —— 自定义提示词:列表(破限/思维链),点开在弹窗里编辑大文本 —— */
type PromptKey = keyof PenSettings['prompts'];
interface PromptMeta {
  key: PromptKey;
  label: string;
  hint: string;
  builtin: string;
}
const PROMPT_METAS: PromptMeta[] = [
  {
    key: 'jailbreak',
    label: '破限提示词',
    hint: '作为置顶 system 附加在改写请求里，降低拒答率。留空则用内置默认。',
    builtin: JAILBREAK_PROMPT,
  },
  {
    key: 'chainOfThought',
    label: '思维链提示词',
    hint: '在最终改写任务之后追加，引导模型先审稿判断再返回逐行补丁。留空则用内置默认。',
    builtin: CHAIN_OF_THOUGHT_PROMPT,
  },
];

// 正在编辑的提示词;draft 是草稿,点「完成」才写回 penSettings(取消则丢弃)。
const editingPrompt = ref<PromptMeta | null>(null);
const promptDraft = ref('');

// 该提示词是否已自定义(非空即视为已覆盖内置)
function isCustomPrompt(key: PromptKey): boolean {
  return penSettings.prompts[key].trim().length > 0;
}

function openPrompt(meta: PromptMeta): void {
  editingPrompt.value = meta;
  // 已自定义→载入用户内容;未自定义→预填内置模板,方便直接在其上改
  promptDraft.value = penSettings.prompts[meta.key].trim() || meta.builtin;
}
function closePrompt(): void {
  editingPrompt.value = null;
  promptDraft.value = '';
}
function savePrompt(): void {
  const meta = editingPrompt.value;
  if (!meta) return;
  // 草稿与内置完全一致→存空串(回落内置),避免把模板冗余存进设置、也便于显示「默认」
  const v = promptDraft.value.trim();
  penSettings.prompts[meta.key] = v === meta.builtin.trim() ? '' : promptDraft.value;
  closePrompt();
  showToast('提示词已保存');
}
// 「恢复默认」:把草稿重置回内置模板(保存后即回落内置)
function resetPrompt(): void {
  if (editingPrompt.value) promptDraft.value = editingPrompt.value.builtin;
}

let pressedOnOverlay = false;

function onOverlayPointerDown(event: PointerEvent): void {
  pressedOnOverlay = event.target === event.currentTarget;
}

function onOverlayClick(event: MouseEvent): void {
  const justOpened = performance.now() - lastOpenedAt < 350;
  if (!justOpened && pressedOnOverlay && event.target === event.currentTarget) {
    closePen();
  }
  pressedOnOverlay = false;
}
</script>

<template>
  <div class="bby-root" :data-theme="ui.theme">
    <div ref="modalHost"></div>
    <Transition name="bby-fade">
      <div
        v-if="ui.open"
        class="bby-overlay"
        tabindex="-1"
        @pointerdown="onOverlayPointerDown"
        @click="onOverlayClick"
        @keydown.esc="closePen"
      >
        <section class="bby-window" role="dialog" aria-modal="true" aria-label="柏宝砚">
          <div class="bby-mobile-grabber"><span></span></div>

          <header class="bby-header">
            <span class="bby-brand-name">柏宝砚</span>
            <div class="bby-header-actions">
              <button class="bby-icon-button" type="button" :title="`切换主题：${nextTheme.label}`" @click="cycleTheme">
                <Icon :name="nextTheme.icon" />
              </button>
              <button class="bby-icon-button" type="button" title="关闭" @click="closePen">
                <Icon name="close" />
              </button>
            </div>
          </header>

          <nav class="bby-main-nav" aria-label="主导航">
            <button type="button" :class="{ 'is-active': ui.page === 'floors' }" @click="ui.page = 'floors'">
              <Icon name="list" /> 楼层
            </button>
            <button type="button" :class="{ 'is-active': ui.page === 'workspace' }" :disabled="ui.floor == null" @click="goToWorkspace">
              <Icon name="workspace" /> 工作台
            </button>
            <button type="button" :class="{ 'is-active': ui.page === 'settings' }" @click="ui.page = 'settings'">
              <Icon name="settings" /> 设置
            </button>
          </nav>

          <div class="bby-page-stage">
          <Transition name="bby-page">
            <div v-if="ui.page === 'workspace'" key="workspace" class="bby-page-shell">
              <div v-if="ui.stage === 'annotate'" class="bby-work-tabs bby-status-strip">
                <span class="bby-strip-meta">
                  <span class="bby-floor-number">{{ ui.floorLabel }}</span>
                  <span v-if="workMode === 'annotate'">已标注 <b>{{ markedCount }}</b> 行</span>
                  <span v-else-if="workMode === 'multi'">已选 <b>{{ multiSelected.length }}</b> 段</span>
                  <span v-else>手动修改原文，不经过 AI</span>
                </span>
                <div class="bby-segmented bby-mode-switch" role="tablist" aria-label="工作台模式">
                  <button
                    type="button"
                    class="bby-seg"
                    :class="{ 'is-on': workMode === 'annotate' }"
                    :disabled="generating || saving || replacing"
                    @click="setWorkMode('annotate')"
                  >
                    标注
                  </button>
                  <button
                    type="button"
                    class="bby-seg"
                    :class="{ 'is-on': workMode === 'multi' }"
                    :disabled="generating || viewingGenerationTarget || saving || replacing"
                    @click="setWorkMode('multi')"
                  >
                    多选
                  </button>
                  <button
                    type="button"
                    class="bby-seg"
                    :class="{ 'is-on': workMode === 'edit' }"
                    :disabled="generating || viewingGenerationTarget || saving || replacing"
                    @click="setWorkMode('edit')"
                  >
                    <Icon name="pen" /> 编辑
                  </button>
                </div>
              </div>

              <div v-else class="bby-work-tabs bby-review-bar">
                <div class="bby-floor-meta">
                  <span class="bby-floor-number">{{ ui.floorLabel }}</span>
                  <strong>{{ ui.speaker }}</strong>
                </div>
                <div class="bby-doc-status">
                  <span>AI 建议 <b>{{ reviewRows.length }}</b> 项 · 已选 <b>{{ acceptedCount }}</b> 行</span>
                  <button class="bby-text-action" type="button" @click="backToAnnotate">
                    <Icon name="undo" /> 返回标注
                  </button>
                </div>
              </div>

              <main v-if="ui.stage === 'annotate'" class="bby-document" aria-label="楼层全文">
                <Collapsible v-if="workMode === 'annotate'" title="整体要求" class="bby-work-fold">
                  <template #badge>
                    <i v-if="generalFilled" class="bby-tab-dot"></i>
                  </template>
                  <section class="bby-general-editor">
                    <p class="bby-field-hint">作用于当前楼层全文的要求，与行标注一起发给 AI。</p>
                    <PhrasePicker v-if="phrases.length" v-model="globalPhraseIds" :phrases="phrases" />
                    <textarea
                      v-model="generalNote"
                      class="bby-input bby-general-note"
                      placeholder="可选：填写作用于当前楼层全文的要求"
                    ></textarea>
                    <div class="bby-carry-options">
                      <label class="bby-switch-row bby-carry-row">
                        <span>携带上下文轮数</span>
                        <input v-model.number="contextRounds" class="bby-input bby-rounds-input" type="number" min="0" max="10" step="1" />
                      </label>
                      <label class="bby-switch-row bby-carry-row">
                        <span>携带世界书</span>
                        <input v-model="carryWorldbook" type="checkbox" class="bby-checkbox" />
                      </label>
                      <label class="bby-switch-row bby-carry-row">
                        <span>携带角色描述</span>
                        <input v-model="carryCharDesc" type="checkbox" class="bby-checkbox" />
                      </label>
                      <label class="bby-switch-row bby-carry-row">
                        <span>携带User描述</span>
                        <input v-model="carryUserDesc" type="checkbox" class="bby-checkbox" />
                      </label>
                    </div>
                  </section>
                </Collapsible>

                <Collapsible title="查找替换" class="bby-work-fold">
                  <template #badge>
                    <em v-if="enabledRuleCount" class="bby-tab-count">{{ enabledRuleCount }}</em>
                  </template>
                  <section class="bby-replace-panel">
                    <div class="bby-quick-replace">
                      <div class="bby-quick-fields">
                        <input
                          v-model="quickFind"
                          class="bby-input bby-mono"
                          type="text"
                          placeholder="查找（正则支持 /pattern/gi）"
                        />
                        <input
                          v-model="quickReplacement"
                          class="bby-input bby-mono"
                          type="text"
                          placeholder="替换为（留空即删除）"
                        />
                      </div>
                      <div class="bby-quick-actions">
                        <label class="bby-quick-regex">
                          <input v-model="quickIsRegex" type="checkbox" class="bby-checkbox" />
                          <span>正则</span>
                        </label>
                        <button
                          class="bby-button bby-btn-sm"
                          type="button"
                          :disabled="replacing || !quickFind"
                          @click="saveQuickAsRule"
                        >
                          <Icon name="plus" /> 存为规则
                        </button>
                        <button
                          class="bby-button bby-primary bby-btn-sm"
                          type="button"
                          :disabled="replacing || viewingGenerationTarget || saving || !quickFind"
                          @click="runQuickReplace"
                        >
                          <Icon name="replace" /> {{ replacing ? '替换中…' : '替换' }}
                        </button>
                      </div>
                    </div>

                    <div class="bby-rule-lib">
                      <div class="bby-rule-lib-head">
                        <span class="bby-field-label">规则库</span>
                        <button class="bby-text-action bby-rule-add" type="button" title="添加规则" @click="openRule()">
                          <Icon name="plus" />
                        </button>
                      </div>
                      <ul v-if="penSettings.replaceRules.length" class="bby-rule-list">
                        <li
                          v-for="rule in penSettings.replaceRules"
                          :key="rule.id"
                          class="bby-rule"
                          :class="{ 'is-off': !rule.enabled }"
                        >
                          <input
                            v-model="rule.enabled"
                            type="checkbox"
                            class="bby-checkbox"
                            :title="rule.enabled ? '停用这条规则' : '启用这条规则'"
                          />
                          <button class="bby-rule-open" type="button" @click="openRule(rule)">
                            <span class="bby-rule-main">
                              <strong>{{ rule.name }}</strong>
                              <small>
                              <code>{{ rule.pattern }}</code>
                              <span class="bby-rule-sep">→</span>
                              <code>{{ rule.replacement || '删除' }}</code>
                            </small>
                            </span>
                            <span v-if="rule.isRegex" class="bby-tag">正则</span>
                            <Icon name="chevron" />
                          </button>
                        </li>
                      </ul>
                      <p v-else class="bby-rule-empty">还没有规则。把常用的清理存成规则，之后勾选即可反复用。</p>

                      <div class="bby-rule-run">
                        <span class="bby-replace-summary">
                          {{ enabledRuleCount ? `已启用 ${enabledRuleCount} 条规则` : '还没有启用的规则' }}
                        </span>
                        <button
                          class="bby-button bby-btn-sm"
                          type="button"
                          :disabled="replacing || viewingGenerationTarget || saving || !enabledRuleCount"
                          @click="runReplace"
                        >
                          <Icon name="replace" /> {{ replacing ? '执行中…' : '执行规则' }}
                        </button>
                      </div>
                    </div>
                  </section>
                </Collapsible>

                <div class="bby-sheet">
                <div v-if="thinkingParagraphIds.size" class="bby-think-bar">
                  <span>{{ penSettings.hideThinking ? '已收起' : '正在显示' }}思维链/草稿 {{ thinkingParagraphIds.size }} 行</span>
                  <button class="bby-text-action" type="button" @click="penSettings.hideThinking = !penSettings.hideThinking">
                    <Icon :name="penSettings.hideThinking ? 'eye' : 'eyeOff'" /> {{ penSettings.hideThinking ? '显示' : '收起' }}
                  </button>
                </div>
                <article
                  v-for="(paragraph, index) in ui.paragraphs"
                  v-show="!isThinkingHidden(paragraph.id)"
                  :key="paragraph.id"
                  class="bby-para"
                  :class="{
                    'is-open': workMode === 'annotate' && expandedId === paragraph.id,
                    'is-marked': workMode !== 'edit' && isMarked(paragraph.id),
                    'is-selected': workMode === 'multi' && isMultiSelected(paragraph.id),
                  }"
                >
                  <textarea
                    v-if="workMode === 'edit'"
                    v-model="editDrafts[index]"
                    v-autogrow
                    class="bby-para-text bby-para-edit"
                    rows="1"
                    spellcheck="false"
                    aria-label="手动编辑本行"
                  ></textarea>
                  <template v-else-if="workMode === 'multi'">
                    <button
                      class="bby-para-text bby-para-selectable"
                      type="button"
                      :disabled="viewingGenerationTarget"
                      :aria-pressed="isMultiSelected(paragraph.id)"
                      @click="toggleMultiSelect(paragraph.id)"
                    >
                      <span class="bby-para-check" aria-hidden="true"><Icon name="check" /></span>
                      <span class="bby-para-select-text">{{ paragraph.text }}</span>
                    </button>
                    <div v-if="isMarked(paragraph.id)" class="bby-para-tags">
                      <span v-for="name in markedNames(paragraph.id)" :key="name" class="bby-tag">{{ name }}</span>
                      <span v-if="paragraphNotes[paragraph.id]?.trim()" class="bby-tag">+ 补充要求</span>
                    </div>
                  </template>
                  <template v-else>
                  <button
                    class="bby-para-text"
                    type="button"
                    :disabled="viewingGenerationTarget"
                    @click="toggleExpand(paragraph.id)"
                  >
                    {{ paragraph.text }}
                  </button>

                  <div v-if="expandedId !== paragraph.id && isMarked(paragraph.id)" class="bby-para-tags">
                    <span v-for="name in markedNames(paragraph.id)" :key="name" class="bby-tag">{{ name }}</span>
                    <span v-if="paragraphNotes[paragraph.id]?.trim()" class="bby-tag">+ 补充要求</span>
                  </div>

                  <Transition name="bby-expand">
                    <div v-if="expandedId === paragraph.id" class="bby-para-editor">
                      <div class="bby-para-editor-head">
                        <span>改写要求</span>
                        <button class="bby-icon-mini bby-danger-hover" type="button" title="清除本行标注" @click="clearMark(paragraph.id)">
                          <Icon name="trash" />
                        </button>
                      </div>
                      <PhrasePicker
                        v-if="phrases.length"
                        :model-value="markedPhrases[paragraph.id] ?? []"
                        :phrases="phrases"
                        @update:model-value="markedPhrases[paragraph.id] = $event"
                      />
                      <textarea
                        v-model="noteDraft"
                        class="bby-input bby-note"
                        placeholder="填写希望如何修改这一行"
                      ></textarea>
                      <button class="bby-text-action" type="button" @click="ui.page = 'settings'">
                        <Icon name="settings" /> 管理快捷语句
                      </button>
                    </div>
                  </Transition>
                  </template>
                </article>
                </div>

                <p v-if="generationError" class="bby-error-message">{{ generationError }}</p>
              </main>

              <main v-else class="bby-document bby-review-document" aria-label="改写结果">
                <p v-if="contextSummary" class="bby-context-summary">{{ contextSummary }}</p>
                <p v-if="generationError" class="bby-error-message">{{ generationError }}</p>
                <div
                  v-for="row in reviewRows"
                  :key="row.key"
                  class="bby-review-row"
                  :class="{ 'is-rejected': reviewRowDecision(row) === 'reject' }"
                >
                  <div class="bby-review-row-head">
                    <span class="bby-floor-number">{{ row.label }}</span>
                    <span class="bby-tag">
                      {{ row.deleted ? row.paragraphs.length > 1 ? `删除 ${row.paragraphs.length} 行` : '删除行' : row.marked ? '标注行' : '关联调整' }}
                    </span>
                    <span v-if="rowEditedResult(row) !== null" class="bby-tag bby-tag-edited">已手改</span>
                    <button
                      v-if="!row.deleted"
                      class="bby-icon-mini bby-row-edit"
                      type="button"
                      title="手动修改这条结果"
                      @click="startResultEdit(row)"
                    >
                      <Icon name="pen" />
                    </button>
                  </div>
                  <div class="bby-review-columns">
                    <div>
                      <span class="bby-review-label">原文</span>
                      <p>{{ row.original }}</p>
                    </div>
                    <div>
                      <span class="bby-review-label">改写结果</span>
                      <template v-if="isEditingRow(row)">
                        <textarea
                          v-model="resultDraft"
                          v-autogrow
                          class="bby-input bby-result-edit"
                          rows="1"
                          spellcheck="false"
                          aria-label="手动修改这条改写结果"
                          @blur="finishResultEdit"
                          @keydown.esc="finishResultEdit"
                        ></textarea>
                        <div class="bby-result-edit-actions">
                          <button class="bby-text-action" type="button" @mousedown.prevent @click="finishResultEdit">
                            <Icon name="check" /> 完成
                          </button>
                          <button
                            v-if="rowEditedResult(row) !== null"
                            class="bby-text-action"
                            type="button"
                            @mousedown.prevent
                            @click="revertResultEdit(row)"
                          >
                            <Icon name="undo" /> 还原 AI 版
                          </button>
                        </div>
                      </template>
                      <p v-else :class="{ 'bby-deleted-text': row.deleted || displayRowResult(row) === '' }">
                        {{ row.deleted ? row.paragraphs.length > 1 ? `（删除连续 ${row.paragraphs.length} 行）` : '（删除整行）' : displayRowResult(row) === '' ? '（清空整行）' : displayRowResult(row) }}
                      </p>
                    </div>
                  </div>
                  <div class="bby-decide">
                    <button
                      type="button"
                      :class="{ 'is-active': reviewRowDecision(row) === 'reject' }"
                      @click="setReviewRowDecision(row, 'reject')"
                    >
                      {{ row.paragraphs.length > 1 ? '丢弃本组' : '丢弃本行' }}
                    </button>
                    <button
                      type="button"
                      :class="{ 'is-active': reviewRowDecision(row) === 'accept' }"
                      @click="setReviewRowDecision(row, 'accept')"
                    >
                      {{ row.paragraphs.length > 1 ? '应用本组' : '应用本行' }}
                    </button>
                  </div>
                </div>
              </main>

              <section
                v-if="ui.stage === 'annotate' && workMode === 'multi'"
                class="bby-bulk-editor"
                aria-label="批量标注要求"
              >
                <div class="bby-para-editor-head">
                  <span>{{ multiSelected.length ? `已选 ${multiSelected.length} 段，填写共同要求` : '先点选上方段落' }}</span>
                </div>
                <PhrasePicker v-if="phrases.length" v-model="bulkPhraseIds" :phrases="phrases" />
                <textarea
                  v-model="bulkNote"
                  class="bby-input bby-note bby-bulk-note"
                  placeholder="填写希望如何修改选中的这几段"
                ></textarea>
              </section>

              <footer class="bby-action-bar">
                <div v-if="ui.stage === 'review' || workMode === 'annotate'" ref="channelMenu" class="bby-channel-menu">
                  <button
                    class="bby-channel-ghost"
                    type="button"
                    :aria-expanded="channelMenuOpen"
                    title="改写渠道"
                    @click="toggleChannelMenu"
                  >
                    <Icon name="plug" />
                    <span class="bby-channel-ghost-name">{{ selectedChannelLabel }}</span>
                    <Icon name="chevron" class="bby-channel-ghost-chevron" :class="{ 'is-open': channelMenuOpen }" />
                  </button>
                  <Transition name="bby-menu">
                    <ul v-if="channelMenuOpen" class="bby-menu" role="listbox">
                      <li>
                        <button type="button" :class="{ 'is-active': !selectedChannelId }" @click="pickChannel('')">
                          <Icon name="check" class="bby-menu-check" />
                          <span class="bby-menu-name">跟随主 API</span>
                        </button>
                      </li>
                      <li v-for="channel in channels" :key="channel.id">
                        <button type="button" :class="{ 'is-active': selectedChannelId === channel.id }" @click="pickChannel(channel.id)">
                          <Icon name="check" class="bby-menu-check" />
                          <span class="bby-menu-name">{{ channel.name || '未命名渠道' }}</span>
                          <span class="bby-menu-model">{{ channel.model || '未设模型' }}</span>
                        </button>
                      </li>
                    </ul>
                  </Transition>
                </div>
                <span v-else></span>
                <div class="bby-action-buttons">
                  <button v-if="generating" class="bby-button" type="button" @click="cancelGeneration">
                    {{ viewingGenerationTarget ? '取消' : `取消 #${generationTask?.floor}` }}
                  </button>
                  <template v-if="ui.stage === 'annotate'">
                    <template v-if="workMode === 'edit'">
                      <button class="bby-button" type="button" :disabled="saving || replacing" @click="discardManualEdit">
                        <Icon name="undo" /> 放弃修改
                      </button>
                      <button
                        class="bby-button bby-primary"
                        type="button"
                        :disabled="saving || replacing || generating || !editDirty"
                        @click="saveManualEdit"
                      >
                        <Icon name="check" /> {{ saving ? '保存中…' : '保存到楼层' }}
                      </button>
                    </template>
                    <template v-else-if="workMode === 'multi'">
                      <button class="bby-button" type="button" @click="cancelMultiSelect">
                        <Icon name="undo" /> 取消
                      </button>
                      <button
                        class="bby-button bby-primary"
                        type="button"
                        :disabled="!multiSelected.length || !bulkFilled"
                        @click="applyBulkAnnotation"
                      >
                        <Icon name="check" /> 应用到 {{ multiSelected.length }} 段
                      </button>
                    </template>
                    <button
                      v-else
                      class="bby-button bby-primary"
                      type="button"
                      :disabled="generating || replacing || !hasInstructions"
                      @click="startReview"
                    >
                      <Icon :name="viewingGenerationTarget ? 'refresh' : 'bolt'" :class="{ 'bby-spin': viewingGenerationTarget }" />
                      {{ generationButtonLabel }}
                    </button>
                  </template>
                  <template v-else>
                    <button class="bby-button" type="button" :disabled="generating || replacing" @click="startReview">
                      <Icon name="refresh" :class="{ 'bby-spin': viewingGenerationTarget }" /> {{ generationButtonLabel }}
                    </button>
                    <button class="bby-button bby-primary" type="button" :disabled="generating || saving || replacing" @click="finishReview">
                      <Icon :name="acceptedCount === 0 ? 'trash' : 'check'" />
                      {{ applyButtonLabel }}
                    </button>
                  </template>
                </div>
              </footer>
            </div>

            <main v-else-if="ui.page === 'floors'" key="floors" class="bby-settings bby-page-shell">
              <header class="bby-settings-page-head">
                <h2>选择楼层</h2>
                <div v-if="floorChatOpen" class="bby-floor-head-actions">
                  <button
                    class="bby-floor-search-toggle"
                    :class="{ 'is-active': floorSearchOpen }"
                    type="button"
                    title="搜索楼层"
                    @mousedown.prevent
                    @click="toggleFloorSearch"
                  >
                    <Icon name="search" />
                  </button>
                  <button
                    class="bby-floor-search-toggle"
                    type="button"
                    :title="penSettings.floorOrder === 'asc' ? '最早在前（点击改为最新在前）' : '最新在前（点击改为最早在前）'"
                    :aria-label="penSettings.floorOrder === 'asc' ? '最早在前' : '最新在前'"
                    @click="penSettings.floorOrder = penSettings.floorOrder === 'asc' ? 'desc' : 'asc'"
                  >
                    <Icon :name="penSettings.floorOrder === 'asc' ? 'sortAsc' : 'sortDesc'" />
                  </button>
                  <div class="bby-segmented bby-mode-switch" role="tablist" aria-label="楼层筛选">
                    <button
                      v-for="filter in FLOOR_FILTERS"
                      :key="filter.value"
                      type="button"
                      class="bby-seg"
                      :class="{ 'is-on': penSettings.floorFilter === filter.value }"
                      @click="penSettings.floorFilter = filter.value"
                    >
                      {{ filter.label }}
                    </button>
                  </div>
                </div>
              </header>
              <div ref="floorPanel" class="bby-floor-scroll">
                <Transition name="bby-expand">
                  <div v-if="floorChatOpen && floorSearchOpen" class="bby-floor-search">
                    <Icon name="search" />
                    <input
                      ref="floorSearchInput"
                      v-model="floorQuery"
                      class="bby-input"
                      type="text"
                      placeholder="搜索楼层号或关键词"
                      @blur="onFloorSearchBlur"
                      @keydown.esc.stop="closeFloorSearch"
                    />
                  </div>
                </Transition>
                <div class="bby-floor-list">
                  <p v-if="!floorChatOpen" class="bby-field-hint">请先进入一个聊天，之后即可选择需要改写的楼层。</p>
                  <template v-else>
                    <div
                      v-for="row in pagedFloorRows"
                      :key="row.floor"
                      class="bby-floor-open"
                      :class="{ 'is-user': row.isUser, 'is-hidden': row.hidden }"
                      role="button"
                      tabindex="0"
                      @click="enterFloor(row.floor)"
                      @keydown.enter.prevent="enterFloor(row.floor)"
                    >
                      <span class="bby-floor-main">
                        <span class="bby-floor-tags">
                          <span class="bby-floor-tag bby-floor-tag-num">#{{ row.floor }}</span>
                          <span class="bby-floor-tag bby-floor-role">{{ row.isUser ? 'User' : 'Char' }}</span>
                          <Icon v-if="row.hidden" name="ghost" class="bby-floor-ghost" title="已隐藏楼层（不参与上下文）" />
                          <span class="bby-floor-actions">
                            <button
                              class="bby-floor-action"
                              type="button"
                              :title="shootingFloor === row.floor ? '截图中…' : '截图该楼层'"
                              :disabled="shootingFloor != null"
                              @click.stop="onShootFloor(row.floor)"
                            >
                              <Icon
                                :name="shootingFloor === row.floor ? 'refresh' : 'camera'"
                                :class="{ 'bby-spin': shootingFloor === row.floor }"
                              />
                            </button>
                            <button
                              class="bby-floor-action"
                              type="button"
                              :title="row.hidden ? '显示楼层' : '隐藏楼层'"
                              @click.stop="onToggleFloorHidden(row.floor)"
                            >
                              <Icon :name="row.hidden ? 'eyeOff' : 'eye'" />
                            </button>
                            <button
                              class="bby-floor-action"
                              type="button"
                              title="删除该层及之后楼层"
                              @click.stop="onDeleteFloor(row.floor)"
                            >
                              <Icon name="trash" />
                            </button>
                          </span>
                        </span>
                        <small>{{ row.preview }}</small>
                      </span>
                    </div>
                    <p v-if="!floorRows.length" class="bby-field-hint">当前聊天没有可改写的楼层。</p>
                    <p v-else-if="!visibleFloorRows.length" class="bby-field-hint">没有符合筛选的楼层。</p>
                    <p v-else-if="!filteredFloorRows.length" class="bby-field-hint">没有匹配的楼层。</p>
                  </template>
                </div>
              </div>
              <div v-if="floorChatOpen && floorPageCount > 1" class="bby-floor-pager">
                <span class="bby-floor-pager-info">
                  {{ floorPagerHead }} ·
                  <input
                    v-if="pageJumpOpen"
                    ref="pageJumpInput"
                    v-model="pageJumpValue"
                    class="bby-floor-pager-jump"
                    type="text"
                    inputmode="numeric"
                    aria-label="跳到第几页"
                    @keydown.enter.prevent="commitPageJump"
                    @keydown.esc.stop="pageJumpOpen = false"
                    @blur="commitPageJump"
                  />
                  <button v-else class="bby-floor-pager-page" type="button" title="点击输入页码跳转" @click="openPageJump">
                    第 {{ floorPage + 1 }} / {{ floorPageCount }} 页
                  </button>
                </span>
                <div class="bby-floor-pager-buttons">
                  <button class="bby-icon-mini" type="button" title="首页" :disabled="floorPage === 0" @click="floorPage = 0">
                    <Icon name="chevronsLeft" />
                  </button>
                  <button class="bby-icon-mini" type="button" title="上一页" :disabled="floorPage === 0" @click="floorPage--">
                    <Icon name="chevronLeft" />
                  </button>
                  <button class="bby-icon-mini" type="button" title="下一页" :disabled="floorPage >= floorPageCount - 1" @click="floorPage++">
                    <Icon name="chevronRight" />
                  </button>
                  <button class="bby-icon-mini" type="button" title="末页" :disabled="floorPage >= floorPageCount - 1" @click="floorPage = floorPageCount - 1">
                    <Icon name="chevronsRight" />
                  </button>
                </div>
              </div>
            </main>

            <main v-else key="settings" class="bby-settings bby-page-shell">
              <header class="bby-settings-page-head">
                <h2>设置</h2>
              </header>

              <div class="bby-settings-sections">
                <Collapsible title="基本设置">
                  <label class="bby-modal-field">
                    <span class="bby-modal-label">默认渠道</span>
                    <select v-model="penSettings.defaultChannelId" class="bby-input bby-select">
                      <option value="">跟随主 API</option>
                      <option v-for="channel in channels" :key="channel.id" :value="channel.id">
                        {{ channel.name }} · {{ channel.model }}
                      </option>
                    </select>
                  </label>
                  <label class="bby-modal-field bby-setting-gap">
                    <span class="bby-modal-label">默认上下文轮数</span>
                    <input v-model.number="penSettings.defaultContextRounds" class="bby-input" type="number" min="0" max="10" step="1" />
                    <span class="bby-field-hint">每轮包含上一条 AI 消息和紧随其后的用户输入。</span>
                  </label>
                  <div class="bby-field bby-setting-gap">
                    <div class="bby-field-head"><span class="bby-modal-label">主题</span></div>
                    <div class="bby-segmented bby-segmented-wrap">
                      <button
                        v-for="theme in THEMES"
                        :key="theme.value"
                        type="button"
                        class="bby-seg"
                        :class="{ 'is-on': ui.theme === theme.value }"
                        @click="ui.theme = theme.value"
                      >
                        <Icon :name="theme.icon" /> {{ theme.label }}
                      </button>
                    </div>
                  </div>
                  <label class="bby-switch-row">
                    <span class="bby-modal-label">显示屏幕悬浮球</span>
                    <input v-model="penSettings.showOrb" type="checkbox" class="bby-checkbox" />
                  </label>
                  <p class="bby-field-hint">屏幕边缘挂一枚可拖动的悬浮球,点一下打开楼层管理器。拖到中间就停在中间,拖近左右边缘会贴边。</p>
                  <!-- 悬浮球外观:配置项多,开启后才收进小分组(同柏宝绘) -->
                  <Collapsible v-if="penSettings.showOrb" title="悬浮球外观" class="bby-orb-fold">
                    <div class="bby-select-row">
                      <span class="bby-modal-label">形状</span>
                      <BbySelect v-model="orbShapeSel" :options="ORB_SHAPES" aria-label="悬浮球形状" />
                    </div>
                    <div class="bby-field">
                      <div class="bby-field-head">
                        <span class="bby-modal-label">大小</span>
                        <span class="bby-field-value">{{ penSettings.orbSize }}px</span>
                      </div>
                      <input v-model.number="penSettings.orbSize" class="bby-range" type="range" min="32" max="80" step="1" />
                    </div>
                    <div class="bby-field">
                      <div class="bby-field-head">
                        <span class="bby-modal-label">静止透明度</span>
                        <span class="bby-field-value">{{ penSettings.orbOpacity }}%</span>
                      </div>
                      <input v-model.number="penSettings.orbOpacity" class="bby-range" type="range" min="20" max="100" step="1" />
                      <p class="bby-field-hint">悬浮球静止时的不透明度;唤起 / 拖动时一律全显。</p>
                    </div>
                    <div class="bby-field">
                      <div class="bby-field-head"><span class="bby-modal-label">自定义图标</span></div>
                      <input v-model="penSettings.orbImage" class="bby-input" type="text" placeholder="ST 服务器图片路径" spellcheck="false" />
                      <p class="bby-field-hint">留空用默认的笔图标。</p>
                    </div>
                  </Collapsible>
                </Collapsible>

                <Collapsible title="副 API">
                  <div v-if="sharingState.mode === 'legacy-readonly'" class="bby-channel-compat">
                    <p class="bby-field-hint">
                      检测到旧版柏宝书{{ sharingState.bookVersion ? ` v${sharingState.bookVersion}` : '' }}。更新到 v1.1.3
                      后，两边即可共同编辑同一份渠道列表。
                    </p>
                    <button class="bby-button bby-primary bby-btn-sm" type="button" @click="requestBookUpdate">
                      <Icon name="refresh" /> 更新柏宝书
                    </button>
                  </div>
                  <div class="bby-channel-bar">
                    <span class="bby-field-label">渠道</span>
                    <button class="bby-button bby-primary bby-btn-sm" type="button" :disabled="!canEditChannels()" @click="openChannel()">
                      <Icon name="plus" /> 添加渠道
                    </button>
                  </div>
                  <ul v-if="channels.length" class="bby-channel-list">
                    <li v-for="channel in channels" :key="channel.id" class="bby-channel-item">
                      <button class="bby-channel-open" type="button" @click="openChannel(channel)">
                        <span class="bby-channel-name">{{ channel.name || '未命名渠道' }}</span>
                        <span class="bby-channel-model">{{ channel.model || '未设模型' }}</span>
                      </button>
                    </li>
                  </ul>
                  <p v-else-if="!sharingState.ready" class="bby-field-hint">正在载入渠道…</p>
                  <p v-else class="bby-field-hint">还没有渠道。可以添加副 API，或直接跟随主 API。</p>
                </Collapsible>

                <Collapsible title="快捷语句">
                  <div class="bby-section-action">
                    <span class="bby-field-label">标注模板</span>
                    <button class="bby-button bby-primary bby-btn-sm" type="button" @click="openPhrase()">
                      <Icon name="plus" /> 添加语句
                    </button>
                  </div>
                  <div v-if="phrases.length" class="bby-phrase-list">
                    <button v-for="phrase in phrases" :key="phrase.id" type="button" @click="openPhrase(phrase)">
                      <span class="bby-phrase-favorite" :class="{ 'is-on': phrase.favorite }">★</span>
                      <span>
                        <strong>{{ phrase.name }}</strong>
                        <small>{{ phrase.instruction }}</small>
                      </span>
                      <Icon name="chevron" />
                    </button>
                  </div>
                  <p v-else class="bby-field-hint">尚未添加快捷语句。</p>
                </Collapsible>

                <Collapsible title="自定义提示词">
                  <ul class="bby-prompt-list">
                    <li v-for="meta in PROMPT_METAS" :key="meta.key" class="bby-prompt-item">
                      <button class="bby-prompt-open" type="button" @click="openPrompt(meta)">
                        <span class="bby-prompt-name">{{ meta.label }}</span>
                        <span class="bby-prompt-state" :class="{ 'is-custom': isCustomPrompt(meta.key) }">
                          {{ isCustomPrompt(meta.key) ? '已自定义' : '默认' }}
                        </span>
                        <Icon name="pen" class="bby-prompt-edit" />
                      </button>
                    </li>
                  </ul>
                </Collapsible>
              </div>
            </main>
          </Transition>
          </div>

          <nav class="bby-mobile-nav" aria-label="移动端导航">
            <button :class="{ 'is-active': ui.page === 'floors' }" type="button" title="楼层" aria-label="楼层" @click="onMobileNavClick('floors')">
              <Icon name="list" />
            </button>
            <button :class="{ 'is-active': ui.page === 'workspace' }" type="button" :disabled="ui.floor == null" title="工作台" aria-label="工作台" @click="onMobileNavClick('workspace')">
              <Icon name="workspace" />
            </button>
            <button :class="{ 'is-active': ui.page === 'settings' }" type="button" title="设置" aria-label="设置" @click="onMobileNavClick('settings')">
              <Icon name="settings" />
            </button>
          </nav>
        </section>
      </div>
    </Transition>

    <ModalMask :open="!!channelDraft" @close="channelDraft = null">
      <div v-if="channelDraft" class="bby-modal" role="dialog" aria-modal="true" aria-label="编辑渠道">
        <header class="bby-modal-head">
          <span class="bby-modal-title">编辑渠道</span>
          <button class="bby-icon-mini" type="button" title="关闭" @click="channelDraft = null"><Icon name="close" /></button>
        </header>
        <label class="bby-modal-field">
          <span class="bby-modal-label">渠道名</span>
          <input v-model="channelDraft.name" class="bby-input" placeholder="渠道名" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">API 地址</span>
          <input v-model="channelDraft.url" class="bby-input" placeholder="如 https://api.openai.com/v1" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">API 密钥</span>
          <div class="bby-model-row">
            <input v-model="channelDraft.key" class="bby-input" :type="showKey ? 'text' : 'password'" placeholder="API 密钥" />
            <button class="bby-icon-mini" type="button" :title="showKey ? '隐藏密钥' : '显示密钥'" @click="showKey = !showKey">
              <Icon :name="showKey ? 'eyeOff' : 'eye'" />
            </button>
          </div>
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">模型</span>
          <div class="bby-model-row">
            <div class="bby-combo">
              <input
                v-model="channelDraft.model"
                class="bby-input"
                :placeholder="modelOptions.length ? '搜索或输入模型名…' : '模型名，如 gpt-4o-mini'"
                @focus="openModelMenu"
                @input="modelQuery = channelDraft.model; modelMenuOpen = true"
                @blur="closeModelMenuSoon"
              />
              <span
                v-if="modelOptions.length"
                class="bby-combo-caret"
                :class="{ 'is-open': modelMenuOpen }"
                aria-hidden="true"
              />
              <ul v-if="modelMenuOpen && modelOptions.length" class="bby-combo-menu">
                <li v-if="!filteredModelOptions.length" class="bby-combo-empty">无匹配模型</li>
                <li
                  v-for="model in filteredModelOptions"
                  :key="model"
                  class="bby-combo-item"
                  :class="{ 'is-active': model === channelDraft.model }"
                  @mousedown.prevent="pickModel(model)"
                >
                  {{ model }}
                </li>
              </ul>
            </div>
            <button
              class="bby-icon-mini"
              type="button"
              :title="loadingModels ? '拉取中…' : '拉取模型'"
              :disabled="loadingModels"
              @click="loadModels"
            >
              <Icon name="refresh" :class="{ 'bby-spin': loadingModels }" />
            </button>
          </div>
        </label>
        <div class="bby-channel-row">
          <label class="bby-mini-field">
            <span>温度</span>
            <input v-model.number="channelDraft.temperature" class="bby-input" type="number" step="0.1" min="0" max="2" />
          </label>
          <label class="bby-mini-field">
            <span>最大 token</span>
            <input v-model.number="channelDraft.maxTokens" class="bby-input" type="number" step="256" min="256" />
          </label>
          <label class="bby-mini-field">
            <span>超时（秒）</span>
            <input v-model.number="channelDraft.timeoutSec" class="bby-input" type="number" step="10" min="1" />
          </label>
          <!-- 思考强度：自绘下拉（跟随主题；原生 select 的弹出层由系统渲染，主题管不到）。
               auto 是显式选项，值为空串 = 不发送该参数 -->
          <div class="bby-mini-field">
            <span>思考强度</span>
            <BbySelect
              v-model="channelDraft.reasoningEffort"
              :options="REASONING_EFFORT_OPTIONS"
              aria-label="思考强度"
            />
          </div>
        </div>
        <span class="bby-field-hint">思考强度不知道的就选 auto，DS 系推荐 max</span>
        <label class="bby-switch-row">
          <span class="bby-modal-label">流式传输</span>
          <input v-model="channelDraft.stream" type="checkbox" class="bby-checkbox" />
        </label>
        <label class="bby-switch-row">
          <span class="bby-modal-label">发送预填充</span>
          <input v-model="channelDraft.prefill" type="checkbox" class="bby-checkbox" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">排除参数</span>
          <input v-model="excludeParamsText" class="bby-input" placeholder="逗号分隔，如 temperature, max_tokens" />
        </label>
        <p v-if="testMessage" class="bby-channel-test">{{ testMessage }}</p>
        <footer class="bby-modal-foot">
          <button class="bby-button bby-danger" type="button" @click="removeChannel"><Icon name="trash" /> 删除</button>
          <span class="bby-modal-foot-spacer"></span>
          <button class="bby-button" type="button" @click="testChannel"><Icon name="plug" /> 测试渠道</button>
          <button class="bby-button bby-primary" type="button" @click="saveChannel">完成</button>
        </footer>
      </div>
    </ModalMask>

    <ModalMask :open="bookUpdatePromptOpen" @close="bookUpdatePromptOpen = false">
      <div class="bby-modal" role="dialog" aria-modal="true" aria-label="更新柏宝书">
        <header class="bby-modal-head">
          <span class="bby-modal-title">更新柏宝书</span>
          <button class="bby-icon-mini" type="button" title="关闭" @click="bookUpdatePromptOpen = false"><Icon name="close" /></button>
        </header>
        <p class="bby-field-hint">
          当前柏宝书{{ sharingState.bookVersion ? `版本为 v${sharingState.bookVersion}` : '版本无法确认' }}。需要更新到
          v1.1.3，才能与柏宝砚实时共用并编辑渠道。更新成功后页面会自动刷新，现有渠道会自动迁移。
        </p>
        <p v-if="sharingState.updateError" class="bby-channel-test">更新失败：{{ sharingState.updateError }}</p>
        <footer class="bby-modal-foot">
          <span class="bby-modal-foot-spacer"></span>
          <button class="bby-button" type="button" :disabled="sharingState.updating" @click="bookUpdatePromptOpen = false">暂不更新</button>
          <button class="bby-button bby-primary" type="button" :disabled="sharingState.updating" @click="performBookUpdate">
            <Icon name="refresh" /> {{ sharingState.updating ? '更新中…' : '更新并刷新' }}
          </button>
        </footer>
      </div>
    </ModalMask>

    <ModalMask :open="!!phraseDraft" @close="phraseDraft = null">
      <div v-if="phraseDraft" class="bby-modal" role="dialog" aria-modal="true" aria-label="编辑快捷语句">
        <header class="bby-modal-head">
          <span class="bby-modal-title">编辑快捷语句</span>
          <button class="bby-icon-mini" type="button" title="关闭" @click="phraseDraft = null"><Icon name="close" /></button>
        </header>
        <label class="bby-modal-field">
          <span class="bby-modal-label">名称</span>
          <input v-model="phraseDraft.name" class="bby-input" placeholder="例如：增强情绪" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">指令</span>
          <textarea v-model="phraseDraft.instruction" class="bby-input bby-phrase-area"></textarea>
        </label>
        <label class="bby-switch-row">
          <span class="bby-modal-label">置顶显示</span>
          <input v-model="phraseDraft.favorite" type="checkbox" class="bby-checkbox" />
        </label>
        <footer class="bby-modal-foot">
          <button class="bby-button bby-danger" type="button" @click="removePhrase"><Icon name="trash" /> 删除</button>
          <span class="bby-modal-foot-spacer"></span>
          <button class="bby-button bby-primary" type="button" @click="savePhrase">完成</button>
        </footer>
      </div>
    </ModalMask>

    <ModalMask :open="!!ruleDraft" @close="ruleDraft = null">
      <div v-if="ruleDraft" class="bby-modal" role="dialog" aria-modal="true" aria-label="编辑替换规则">
        <header class="bby-modal-head">
          <span class="bby-modal-title">编辑替换规则</span>
          <button class="bby-icon-mini" type="button" title="关闭" @click="ruleDraft = null"><Icon name="close" /></button>
        </header>
        <label class="bby-modal-field">
          <span class="bby-modal-label">规则名</span>
          <input v-model="ruleDraft.name" class="bby-input" placeholder="例如：统一角色名" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">匹配内容</span>
          <input v-model="ruleDraft.pattern" class="bby-input bby-mono" placeholder="文字、正则或 /pattern/gi" />
        </label>
        <label class="bby-modal-field">
          <span class="bby-modal-label">替换为</span>
          <input v-model="ruleDraft.replacement" class="bby-input bby-mono" placeholder="留空则删除匹配内容" />
        </label>
        <label class="bby-switch-row">
          <span class="bby-modal-label">使用正则表达式</span>
          <input v-model="ruleDraft.isRegex" type="checkbox" class="bby-checkbox" />
        </label>
        <p v-if="ruleDraft.isRegex" class="bby-field-hint">支持纯表达式或 /表达式/gi；全局替换所有匹配，可用 $1、$2 引用捕获组。</p>
        <footer class="bby-modal-foot">
          <button class="bby-button bby-danger" type="button" @click="removeRule"><Icon name="trash" /> 删除</button>
          <span class="bby-modal-foot-spacer"></span>
          <button class="bby-button bby-primary" type="button" @click="saveRule">完成</button>
        </footer>
      </div>
    </ModalMask>

    <ModalMask :open="!!editingPrompt" @close="closePrompt">
      <div v-if="editingPrompt" class="bby-modal bby-modal-wide" role="dialog" aria-modal="true" :aria-label="`编辑${editingPrompt.label}`">
        <header class="bby-modal-head">
          <span class="bby-modal-title">编辑{{ editingPrompt.label }}</span>
          <button class="bby-icon-mini" type="button" title="关闭" @click="closePrompt"><Icon name="close" /></button>
        </header>
        <p class="bby-field-hint">{{ editingPrompt.hint }}</p>
        <textarea
          v-model="promptDraft"
          class="bby-input bby-prompt-area"
          spellcheck="false"
          rows="16"
        ></textarea>
        <footer class="bby-modal-foot">
          <button class="bby-button bby-danger" type="button" @click="resetPrompt">
            <Icon name="refresh" /> 恢复默认
          </button>
          <span class="bby-modal-foot-spacer"></span>
          <button class="bby-button" type="button" @click="closePrompt">取消</button>
          <button class="bby-button bby-primary" type="button" @click="savePrompt">完成</button>
        </footer>
      </div>
    </ModalMask>

    <Transition name="bby-toast">
      <div v-if="toastText" class="bby-toast">{{ toastText }}</div>
    </Transition>

    <!-- 窗口打开时收起,免得盖在窗口上 -->
    <FloatingOrb v-if="penSettings.showOrb && !ui.open" />
  </div>
</template>
