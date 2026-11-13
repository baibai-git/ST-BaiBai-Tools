import type { ApiChannel } from '@pen/api/sharedChannels';
import { getContext } from '@pen/st/context';

const GENERATE_URL = '/api/backends/chat-completions/generate';
const STATUS_URL = '/api/backends/chat-completions/status';
const DEFAULT_TIMEOUT_SEC = 180;
const MAIN_API_RESPONSE_LENGTH = 65535;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class ApiError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'ApiError';
  }
}

function normalizeUrl(url: string): string {
  const value = url.trim().replace(/\/+$/, '');
  if (!value) return value;
  if (/\/chat\/completions$/i.test(value)) return value.replace(/\/chat\/completions$/i, '');
  if (/^https?:\/\/[^/?#]+$/i.test(value)) return `${value}/v1`;
  return value;
}

function alternateUrl(url: string): string {
  return /\/v1$/i.test(url) ? url.replace(/\/v1$/i, '') : `${url}/v1`;
}

async function withTimeout<T>(
  timeoutSec: number,
  externalSignal: AbortSignal | undefined,
  task: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;
  const abort = () => controller.abort();
  if (externalSignal?.aborted) abort();
  else externalSignal?.addEventListener('abort', abort, { once: true });
  const timer = window.setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1000, timeoutSec * 1000));

  try {
    return await task(controller.signal);
  } catch (error) {
    if (timedOut) throw new ApiError(`副 API 请求超时(>${timeoutSec}秒)`);
    throw error;
  } finally {
    window.clearTimeout(timer);
    externalSignal?.removeEventListener('abort', abort);
  }
}

function extractContent(data: any): string {
  return (
    data?.choices?.[0]?.message?.content ??
    data?.choices?.[0]?.text ??
    data?.content ??
    ''
  ).trim();
}

async function readSseContent(response: Response): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return extractContent(await response.json().catch(() => null));
  const decoder = new TextDecoder();
  let buffer = '';
  let output = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      const text = line.trim();
      if (!text.startsWith('data:')) continue;
      const payload = text.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const data = JSON.parse(payload);
        if (data?.error) throw new ApiError(data.error.message || '副 API 返回错误');
        const delta =
          data?.choices?.[0]?.delta?.content ??
          data?.choices?.[0]?.message?.content ??
          data?.choices?.[0]?.text;
        if (typeof delta === 'string') output += delta;
      } catch (error) {
        if (error instanceof ApiError) throw error;
      }
    }
  }
  return output.trim();
}

/**
 * 构造发给 ST 代理的请求体（纯函数，便于测两条分支的产物）。
 *
 * 两条分支，按渠道有没有设思考强度二选一：
 *
 * ① 未设（reasoningEffort 为空 = auto）：走 `chat_completion_source: 'openai'`，
 *    与加本功能之前**逐字节一致**——存量用户零变化。
 *
 * ② 已设：走 `'custom'`。因为 ST 代理对 openai 源的 reasoning_effort 卡**模型名白名单**
 *    （src/constants.js 的 OPENAI_REASONING_EFFORT_MODELS，精确匹配 o1/o3/gpt-5 那批），
 *    模型名对不上就静默丢弃、还照样返回 200（实测确认），用户设了却无效且看不出来。
 *    custom 源的 custom_include_body 由服务端 mergeObjectWithYaml 直接并进上游请求体，
 *    不过任何白名单，任意字段/嵌套对象都能透传。
 *
 * 两条路都仍然走 ST 服务端转发（同一个 /generate 端点），没有浏览器直连，
 * 因此 CORS、密钥不落浏览器、SSE 转发等性质完全不变。
 *
 * custom 源的两个坑（都已规避）：
 * - 它**不读 proxy_password**，只读 ST 自己存的 Custom 密钥，所以 key 必须靠
 *   custom_include_headers 注入 Authorization（服务端 `...headers` 排在默认
 *   Authorization 之后，覆盖成立）；
 * - custom_include_* 是 YAML 字符串且**解析失败会静默忽略**（util.js 的 catch 是空的）。
 *   key 里带 `:` `#` `{` 或以 `*` 开头都会让 YAML 解析炸 → header 没注入 →
 *   退回用 ST 的 Custom 密钥，可能把用户另一个服务商的 key 发到本端点。
 *   故一律用 JSON.stringify 生成（YAML 是 JSON 的超集），转义交给它，不手拼。
 *
 * （与柏宝绘/柏宝书 src/api/client.ts 的同名函数同源，行为保持一致。）
 */
export function buildRequestBody(
  channel: ApiChannel,
  messages: ChatMessage[],
  reverseProxy: string,
): Record<string, unknown> {
  const effort = channel.reasoningEffort?.trim() ?? '';
  const common = {
    model: channel.model,
    messages,
    temperature: channel.temperature ?? 1,
    max_tokens: channel.maxTokens ?? 65535,
    stream: channel.stream ?? false,
    presence_penalty: 0,
    frequency_penalty: 0,
  };

  const body: Record<string, unknown> = effort
    ? {
        chat_completion_source: 'custom',
        custom_url: reverseProxy,
        custom_include_headers: JSON.stringify({ Authorization: `Bearer ${channel.key || ''}` }),
        custom_include_body: JSON.stringify({ reasoning_effort: effort }),
        ...common,
      }
    : {
        chat_completion_source: 'openai',
        reverse_proxy: reverseProxy,
        proxy_password: channel.key || '',
        ...common,
      };

  for (const parameter of channel.excludeParams ?? []) {
    const key = parameter.trim();
    if (key) delete body[key];
  }
  return body;
}

async function requestAtUrl(
  channel: ApiChannel,
  messages: ChatMessage[],
  reverseProxy: string,
  signal?: AbortSignal,
): Promise<string> {
  const context = getContext();
  if (!context) throw new ApiError('SillyTavern 上下文不可用');
  if (!channel.url.trim() || !channel.model.trim()) {
    throw new ApiError('副 API 渠道未配置完整（缺少地址或模型）');
  }

  const outputMessages =
    channel.prefill === false && messages.at(-1)?.role === 'assistant'
      ? messages.slice(0, -1)
      : messages;
  const body = buildRequestBody(channel, outputMessages, reverseProxy);

  const timeoutSec =
    Number.isFinite(channel.timeoutSec) && channel.timeoutSec > 0
      ? Math.floor(channel.timeoutSec)
      : DEFAULT_TIMEOUT_SEC;
  return withTimeout(timeoutSec, signal, async requestSignal => {
    const response = await fetch(GENERATE_URL, {
      method: 'POST',
      headers: context.getRequestHeaders(),
      body: JSON.stringify(body),
      signal: requestSignal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(`副 API 请求失败 (${response.status})：${text.slice(0, 300)}`, response.status);
    }
    const content = channel.stream
      ? await readSseContent(response)
      : extractContent(await response.json());
    if (!content) throw new ApiError('副 API 返回空内容');
    return content;
  });
}

export function requestCompletion(
  channel: ApiChannel,
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  return requestAtUrl(channel, messages, normalizeUrl(channel.url), signal);
}

export async function requestViaMainApi(
  messages: ChatMessage[],
  signal?: AbortSignal,
): Promise<string> {
  const context = getContext();
  if (typeof context?.generateRaw !== 'function') {
    throw new ApiError('当前 SillyTavern 版本不支持跟随主 API');
  }
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  const content = (
    await context.generateRaw({
      prompt: messages,
      responseLength: MAIN_API_RESPONSE_LENGTH,
    })
  )?.trim();
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
  if (!content) throw new ApiError('主 API 返回空内容');
  return content;
}

export async function testChannel(channel: ApiChannel): Promise<{ ok: boolean; message: string }> {
  const primaryUrl = normalizeUrl(channel.url);
  try {
    const reply = await requestAtUrl(
      channel,
      [{ role: 'user', content: '回复“ok”两个字符即可。' }],
      primaryUrl,
    );
    if (channel.url.trim().replace(/\/+$/, '') !== primaryUrl) channel.url = primaryUrl;
    return { ok: true, message: `连通正常，返回：${reply.slice(0, 40)}` };
  } catch (error) {
    if (!(error instanceof ApiError) || (error.status !== 404 && error.status !== 405)) {
      return { ok: false, message: error instanceof Error ? error.message : String(error) };
    }
    const fallbackUrl = alternateUrl(primaryUrl);
    try {
      const reply = await requestAtUrl(
        channel,
        [{ role: 'user', content: '回复“ok”两个字符即可。' }],
        fallbackUrl,
      );
      channel.url = fallbackUrl;
      return { ok: true, message: `连通正常，已改用：${fallbackUrl}，返回：${reply.slice(0, 40)}` };
    } catch {
      return { ok: false, message: error.message };
    }
  }
}

export async function fetchModels(
  channel: Pick<ApiChannel, 'url' | 'key' | 'timeoutSec'>,
): Promise<string[]> {
  const context = getContext();
  if (!context) throw new ApiError('SillyTavern 上下文不可用');
  if (!channel.url.trim()) throw new ApiError('请先填写 API 地址');

  const timeoutSec =
    Number.isFinite(channel.timeoutSec) && channel.timeoutSec > 0
      ? Math.floor(channel.timeoutSec)
      : DEFAULT_TIMEOUT_SEC;
  return withTimeout(timeoutSec, undefined, async signal => {
    const response = await fetch(STATUS_URL, {
      method: 'POST',
      headers: context.getRequestHeaders(),
      body: JSON.stringify({
        chat_completion_source: 'openai',
        reverse_proxy: normalizeUrl(channel.url),
        proxy_password: channel.key || '',
      }),
      signal,
    });
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      throw new ApiError(`拉取模型失败 (${response.status})：${text.slice(0, 200)}`);
    }
    const data = await response.json();
    if (data?.error && !Array.isArray(data?.data)) {
      throw new ApiError(data?.message || '拉取模型失败');
    }
    const list: unknown = data?.data ?? data?.models ?? [];
    if (!Array.isArray(list)) return [];
    return list
      .map((item: any) => (typeof item === 'string' ? item : item?.id))
      .filter((item: unknown): item is string => typeof item === 'string' && !!item)
      .sort();
  });
}
