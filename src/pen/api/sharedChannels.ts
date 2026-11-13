import { reactive, ref } from 'vue';

export interface ApiChannel {
  id: string;
  name: string;
  url: string;
  key: string;
  model: string;
  temperature: number;
  maxTokens: number;
  timeoutSec: number;
  stream: boolean;
  prefill: boolean;
  excludeParams: string[];
  /**
   * 思考强度（推理模型的 reasoning_effort）。空串 = auto = 不发这个参数（默认，老渠道即此值）。
   *
   * 取值不做白名单校验，原样发给端点：各家词汇不统一（OpenAI 的 minimal/low/medium/high/xhigh、
   * 部分中转站的 max/none……），中转站比我们更清楚自己的模型吃什么，校验只会误伤。
   *
   * 非空时整条请求改走 custom 源（见 api/client.ts 的 buildRequestBody）：
   * ST 代理对 openai 源的 reasoning_effort 有**模型名白名单**（src/constants.js 的
   * OPENAI_REASONING_EFFORT_MODELS，精确匹配 o1/o3/gpt-5 那批），模型名对不上就**静默丢弃且照样返回 200**——
   * 用户设了却毫无效果、还看不出来。custom 源的 custom_include_body 是纯 merge，不过白名单。
   *
   * 跨插件：与柏宝绘/柏宝书共享同一份渠道（baibai_api_channels），三家字段名一致。
   */
  reasoningEffort: string;
}

interface SharedChannelsStore {
  schemaVersion: number;
  revision: number;
  channels: ApiChannel[];
}

interface STContext {
  extensionSettings?: Record<string, unknown>;
  saveSettingsDebounced?: () => void;
  getRequestHeaders?: () => Record<string, string>;
}

interface BookApi {
  pluginVersion?: string;
  capabilities?: {
    sharedApiChannels?: boolean;
  };
}

interface ExtensionInfo {
  name?: string;
  type?: string;
}

const SHARED_CHANNELS_KEY = 'baibai_api_channels';
const LEGACY_BOOK_SETTINGS_KEY = 'baibai_book';
const SHARED_CHANNELS_EVENT = 'st-baibai-api-channels:changed';
const SHARED_CHANNELS_SCHEMA_VERSION = 1;
const MIN_SHARED_BOOK_VERSION = '1.1.3';
const BOOK_FOLDER = 'ST-BaiBai-Book';

export const channels = reactive<ApiChannel[]>([]);
export const sharingState = reactive({
  ready: false,
  mode: 'standalone' as 'shared' | 'legacy-readonly' | 'standalone',
  bookInstalled: false,
  bookVersion: '',
  updateError: '',
  updating: false,
});
export const bookUpdatePromptOpen = ref(false);

let revision = 0;
let channelsFingerprint = '';
let listenerBound = false;
let initialized = false;
let channelSequence = 0;

function getContext(): STContext | null {
  try {
    return (
      globalThis as typeof globalThis & {
        SillyTavern?: { getContext?: () => STContext };
      }
    ).SillyTavern?.getContext?.() ?? null;
  } catch {
    return null;
  }
}

function cloneChannel(channel: ApiChannel): ApiChannel {
  return JSON.parse(JSON.stringify(channel)) as ApiChannel;
}

function normalizeChannel(raw: unknown): ApiChannel {
  const channel = raw && typeof raw === 'object' ? (raw as Partial<ApiChannel>) : {};
  const excludeParams = raw && typeof raw === 'object'
    ? (raw as { excludeParams?: unknown }).excludeParams
    : undefined;
  return {
    id: typeof channel.id === 'string' ? channel.id : `ch_${Date.now()}_${++channelSequence}`,
    name: typeof channel.name === 'string' ? channel.name : '新渠道',
    url: typeof channel.url === 'string' ? channel.url : '',
    key: typeof channel.key === 'string' ? channel.key : '',
    model: typeof channel.model === 'string' ? channel.model : '',
    temperature: typeof channel.temperature === 'number' ? channel.temperature : 1,
    maxTokens: typeof channel.maxTokens === 'number' ? channel.maxTokens : 65535,
    timeoutSec:
      typeof channel.timeoutSec === 'number' && Number.isFinite(channel.timeoutSec) && channel.timeoutSec > 0
        ? Math.floor(channel.timeoutSec)
        : 180,
    stream: typeof channel.stream === 'boolean' ? channel.stream : false,
    prefill: typeof channel.prefill === 'boolean' ? channel.prefill : true,
    excludeParams: Array.isArray(excludeParams)
      ? excludeParams.filter((item): item is string => typeof item === 'string')
      : typeof excludeParams === 'string'
        ? excludeParams.split(',').map(item => item.trim()).filter(Boolean)
        : [],
    // 后加字段：老渠道无此键 → 空串（auto，不发参数），行为与加字段前完全一致
    reasoningEffort:
      typeof channel.reasoningEffort === 'string' ? channel.reasoningEffort.trim() : '',
  };
}

function replaceChannels(next: ApiChannel[]): void {
  channels.splice(0, channels.length, ...next.map(cloneChannel));
}

function fingerprint(next: ApiChannel[]): string {
  return JSON.stringify(next);
}

function readStore(raw: unknown): SharedChannelsStore | null {
  if (!raw || typeof raw !== 'object') return null;
  const store = raw as Partial<SharedChannelsStore>;
  if (!Array.isArray(store.channels)) return null;
  return {
    schemaVersion: SHARED_CHANNELS_SCHEMA_VERSION,
    revision:
      typeof store.revision === 'number' && Number.isFinite(store.revision)
        ? Math.max(0, Math.floor(store.revision))
        : 0,
    channels: store.channels.map(normalizeChannel),
  };
}

function legacyBookChannels(): ApiChannel[] {
  const raw = getContext()?.extensionSettings?.[LEGACY_BOOK_SETTINGS_KEY];
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { channels?: unknown }).channels;
  return Array.isArray(list) ? list.map(normalizeChannel) : [];
}

function readSharedChannels(): SharedChannelsStore | null {
  return readStore(getContext()?.extensionSettings?.[SHARED_CHANNELS_KEY]);
}

function persistSharedChannels(): void {
  const ctx = getContext();
  if (!ctx?.extensionSettings) return;
  revision += 1;
  const store: SharedChannelsStore = {
    schemaVersion: SHARED_CHANNELS_SCHEMA_VERSION,
    revision,
    channels: channels.map(cloneChannel),
  };
  ctx.extensionSettings[SHARED_CHANNELS_KEY] = store;
  channelsFingerprint = fingerprint(store.channels);
  ctx.saveSettingsDebounced?.();
  window.dispatchEvent(
    new CustomEvent(SHARED_CHANNELS_EVENT, {
      detail: { revision, source: 'ST-BaiBai-Pen' },
    }),
  );
}

function hydrateSharedChannels(): void {
  const stored = readSharedChannels();
  if (stored) {
    revision = Math.max(revision, stored.revision);
    channelsFingerprint = fingerprint(stored.channels);
    replaceChannels(stored.channels);
    return;
  }
  replaceChannels(legacyBookChannels());
  persistSharedChannels();
}

function bindSharedListener(): void {
  if (listenerBound) return;
  listenerBound = true;
  window.addEventListener(SHARED_CHANNELS_EVENT, () => {
    if (sharingState.mode === 'legacy-readonly') return;
    const stored = readSharedChannels();
    if (!stored) return;
    revision = Math.max(revision, stored.revision);
    const nextFingerprint = fingerprint(stored.channels);
    if (nextFingerprint === channelsFingerprint) return;
    channelsFingerprint = nextFingerprint;
    replaceChannels(stored.channels);
  });
}

function parseVersion(version: string): number[] {
  return version
    .split('.')
    .map(part => Number.parseInt(part.match(/^\d+/)?.[0] ?? '0', 10))
    .slice(0, 3);
}

function versionLessThan(current: string, required: string): boolean {
  const left = parseVersion(current);
  const right = parseVersion(required);
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}

async function waitForContext(): Promise<STContext | null> {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const ctx = getContext();
    if (ctx?.extensionSettings) return ctx;
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  return null;
}

function currentBookApi(): BookApi | null {
  return (
    globalThis as typeof globalThis & {
      STBaiBaiBook?: BookApi;
    }
  ).STBaiBaiBook ?? null;
}

async function waitForBookApi(): Promise<BookApi | null> {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const api = currentBookApi();
    if (api) return api;
    await new Promise(resolve => window.setTimeout(resolve, 250));
  }
  return null;
}

async function discoverBook(): Promise<{ folder: string; type: string } | null> {
  const ctx = getContext();
  try {
    const response = await fetch('/api/extensions/discover', {
      method: 'GET',
      headers: ctx?.getRequestHeaders?.() ?? {},
      cache: 'no-store',
    });
    if (!response.ok) return null;
    const list = (await response.json()) as ExtensionInfo[];
    if (!Array.isArray(list)) return null;
    const target = `third-party/${BOOK_FOLDER}`;
    const match = list.find(extension => extension?.name === target);
    return match ? { folder: BOOK_FOLDER, type: match.type ?? 'local' } : null;
  } catch {
    return null;
  }
}

function markPromptShown(version: string): boolean {
  const key = `bby.book-update-prompted:${version || 'unknown'}`;
  try {
    if (localStorage.getItem(key) === '1') return false;
    localStorage.setItem(key, '1');
  } catch {
    // localStorage 不可用时退回当前会话只提示一次。
    if ((markPromptShown as typeof markPromptShown & { fallback?: Set<string> }).fallback?.has(key)) return false;
    const fn = markPromptShown as typeof markPromptShown & { fallback?: Set<string> };
    fn.fallback ??= new Set();
    fn.fallback.add(key);
  }
  return true;
}

export function requestBookUpdate(): void {
  sharingState.updateError = '';
  bookUpdatePromptOpen.value = true;
}

export async function performBookUpdate(): Promise<void> {
  if (sharingState.updating) return;
  sharingState.updating = true;
  sharingState.updateError = '';
  try {
    const installed = await discoverBook();
    if (!installed) throw new Error('未找到柏宝书扩展目录');
    const ctx = getContext();
    const response = await fetch('/api/extensions/update', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(ctx?.getRequestHeaders?.() ?? {}),
      },
      body: JSON.stringify({
        extensionName: installed.folder,
        global: installed.type === 'global',
      }),
    });
    if (!response.ok) {
      const message = await response.text().catch(() => '');
      throw new Error(message || response.statusText || `HTTP ${response.status}`);
    }
    window.setTimeout(() => location.reload(), 800);
  } catch (error) {
    sharingState.updateError = error instanceof Error ? error.message : String(error);
  } finally {
    sharingState.updating = false;
  }
}

export async function initializeSharedChannels(): Promise<void> {
  if (initialized) return;
  initialized = true;
  await waitForContext();
  bindSharedListener();

  const installed = await discoverBook();
  const bookApi = currentBookApi() ?? (installed ? await waitForBookApi() : null);
  sharingState.bookInstalled = !!installed || !!bookApi;
  sharingState.bookVersion = bookApi?.pluginVersion ?? '';

  const compatibleBook =
    !!bookApi &&
    !versionLessThan(bookApi.pluginVersion ?? '0.0.0', MIN_SHARED_BOOK_VERSION) &&
    bookApi.capabilities?.sharedApiChannels === true;

  if (sharingState.bookInstalled && !compatibleBook) {
    sharingState.mode = 'legacy-readonly';
    const legacyChannels = legacyBookChannels();
    channelsFingerprint = fingerprint(legacyChannels);
    replaceChannels(legacyChannels);
    if (markPromptShown(sharingState.bookVersion)) requestBookUpdate();
  } else {
    sharingState.mode = compatibleBook ? 'shared' : 'standalone';
    hydrateSharedChannels();
  }

  sharingState.ready = true;
}

export function canEditChannels(): boolean {
  return sharingState.ready && sharingState.mode !== 'legacy-readonly';
}

export function newChannel(): ApiChannel {
  return {
    id: `ch_${Date.now()}_${++channelSequence}`,
    name: '新渠道',
    url: '',
    key: '',
    model: '',
    temperature: 1,
    maxTokens: 65535,
    timeoutSec: 180,
    stream: false,
    prefill: true,
    excludeParams: [],
    reasoningEffort: '',
  };
}

export function saveSharedChannel(channel: ApiChannel): void {
  if (!canEditChannels()) return;
  const normalized = normalizeChannel(channel);
  const index = channels.findIndex(item => item.id === normalized.id);
  if (index >= 0) channels[index] = normalized;
  else channels.push(normalized);
  persistSharedChannels();
}

export function removeSharedChannel(id: string): void {
  if (!canEditChannels()) return;
  const index = channels.findIndex(channel => channel.id === id);
  if (index >= 0) {
    channels.splice(index, 1);
    persistSharedChannels();
  }
}
