import { describe, expect, it } from 'vitest';
import type { ApiChannel } from '@pen/api/sharedChannels';
import { buildRequestBody } from './client';

const channel: ApiChannel = {
  id: 'ch1',
  name: '测试渠道',
  url: 'https://api.example.com',
  key: 'k',
  model: 'm',
  temperature: 1,
  maxTokens: 1024,
  timeoutSec: 60,
  stream: false,
  prefill: true,
  excludeParams: [],
  reasoningEffort: '',
};

describe('buildRequestBody：思考强度与两条源分支', () => {
  const msgs = [{ role: 'user' as const, content: 'hi' }];
  const build = (over: Partial<ApiChannel> = {}) =>
    buildRequestBody({ ...channel, ...over }, msgs, 'https://api.example.com/v1');

  it('未设思考强度 → 走 openai 源，请求体与加功能前逐字节一致', () => {
    expect(build()).toEqual({
      chat_completion_source: 'openai',
      reverse_proxy: 'https://api.example.com/v1',
      proxy_password: 'k',
      model: 'm',
      messages: msgs,
      temperature: 1,
      max_tokens: 1024,
      stream: false,
      presence_penalty: 0,
      frequency_penalty: 0,
    });
  });

  it('设了思考强度 → 切 custom 源，并经 custom_include_body 透传', () => {
    const body = build({ reasoningEffort: 'high' });
    expect(body.chat_completion_source).toBe('custom');
    expect(body.custom_url).toBe('https://api.example.com/v1');
    // 顶层不发 reasoning_effort：openai/custom 源都卡模型名白名单，
    // 模型名恰好命中时会覆盖掉我们真正想发的值
    expect(body.reasoning_effort).toBeUndefined();
    expect(JSON.parse(body.custom_include_body as string)).toEqual({ reasoning_effort: 'high' });
  });

  it('custom 源必须靠 header 带 key：proxy_password 在该源下不被读取', () => {
    const body = build({ reasoningEffort: 'high' });
    expect(body.proxy_password).toBeUndefined();
    expect(JSON.parse(body.custom_include_headers as string)).toEqual({
      Authorization: 'Bearer k',
    });
  });

  it('key 含 YAML 元字符时仍能安全注入（靠 JSON.stringify 转义）', () => {
    // 手拼 YAML 会在这类 key 上解析失败；而 ST 的 mergeObjectWithYaml 是静默忽略，
    // header 注入失败 → 退回读 ST 自己的 Custom 密钥 → 可能把别家的 key 发到本端点。
    const nasty = 'sk-a:b#c{d}e*f "g"';
    const body = build({ reasoningEffort: 'high', key: nasty });
    expect(JSON.parse(body.custom_include_headers as string).Authorization).toBe(`Bearer ${nasty}`);
  });

  it('空白字符串视同未设（不误切 custom 源）', () => {
    expect(build({ reasoningEffort: '   ' }).chat_completion_source).toBe('openai');
  });

  it('取值不做白名单：非常规值原样透传', () => {
    const body = build({ reasoningEffort: '我自己的档位' });
    expect(JSON.parse(body.custom_include_body as string).reasoning_effort).toBe('我自己的档位');
  });

  it('excludeParams 在两条分支下都照常生效', () => {
    expect(build({ excludeParams: ['temperature'] }).temperature).toBeUndefined();
    expect(
      build({ excludeParams: ['temperature'], reasoningEffort: 'high' }).temperature,
    ).toBeUndefined();
  });
});
