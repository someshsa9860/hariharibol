import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FatalApiError } from '../scripts/lib/claude-translate-client.js';
import { DEFAULT_MODEL, chatRequest, costUsd, createOpenAI, reasoningEffort } from '../scripts/lib/openai-translate-client.js';
import { DEFAULT_PROVIDER, PROVIDER_IDS, costFor, createAsk, providerOf } from '../scripts/lib/translate-providers.js';
import { classifyError } from '../utils/translation-run.js';

describe('providers', () => {
  it('knows Claude, OpenAI and Gemini, with GPT-6 Luna the default and Sonnet 5.5 one choice away', () => {
    assert.deepEqual(PROVIDER_IDS, ['anthropic', 'openai', 'gemini']);
    assert.equal(DEFAULT_PROVIDER, 'openai');
    assert.equal(providerOf('anthropic').defaultModel, 'claude-sonnet-5-5');
    assert.equal(providerOf('openai').defaultModel, 'gpt-6-luna');
    assert.equal(providerOf('gemini').defaultModel, 'gemini-3.5-flash-lite');
    assert.throws(() => providerOf('grok'), /Unknown provider/);
  });

  it('prices each provider with its own table', () => {
    const usage = { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 1e6, cacheWriteTokens: 0 };
    assert.equal(costUsd('gpt-6-luna', usage), 0.1 + 0.5 + 0.01);
    assert.equal(costFor('openai', 'gpt-6-luna', usage), 0.61);
    assert.equal(costFor('anthropic', 'claude-sonnet-5-5', usage), 2 + 10 + 0.1);
    assert.equal(costFor('openai', 'a-model-not-listed', usage), null);
  });
});

describe('openai request', () => {
  it('sends the schema, the system prompt and no reasoning when effort is off', () => {
    const schema = { type: 'object' };
    const body = chatRequest({ model: DEFAULT_MODEL, effort: 'off', system: 'S', user: 'U', schema, maxTokens: 100 });
    assert.equal(body.reasoning_effort, 'none');
    assert.equal(body.max_completion_tokens, 100);
    assert.deepEqual(body.response_format.json_schema.schema, schema);
    assert.deepEqual(body.messages, [{ role: 'system', content: 'S' }, { role: 'user', content: 'U' }]);
  });

  it('asks the free GPT-4 models for no reasoning at all — they refuse the parameter — and still rejects a bad effort', () => {
    for (const model of ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1-nano']) {
      const body = chatRequest({ model, effort: 'off', system: 'S', user: 'U', schema: { type: 'object' }, maxTokens: 100 });
      assert.equal('reasoning_effort' in body, false, model);
      assert.equal(body.model, model);
      assert.equal(body.max_completion_tokens, 100);
    }
    assert.throws(() => chatRequest({ model: 'gpt-4.1-mini', effort: 'minimal', system: 'S', user: 'U', schema: {}, maxTokens: 1 }), /Unknown effort/);
    assert.equal(chatRequest({ model: DEFAULT_MODEL, effort: 'off', system: 'S', user: 'U', schema: {}, maxTokens: 1 }).reasoning_effort, 'none', 'GPT-6 Luna still gets its reasoning level');
  });

  it('prices the free models at their standard rates, for the tokens past the allowance', () => {
    const usage = { inputTokens: 1e6, outputTokens: 1e6, cacheReadTokens: 0, cacheWriteTokens: 0 };
    assert.equal(costFor('openai', 'gpt-4.1-mini', usage), 0.4 + 1.6);
    assert.equal(costFor('openai', 'gpt-4o-mini', usage), 0.15 + 0.6);
    assert.equal(costFor('openai', 'gpt-4.1-nano', usage), 0.1 + 0.4);
  });

  it('carries other efforts by name and rejects unknown ones before any verse is sent', () => {
    assert.equal(reasoningEffort('high'), 'high');
    assert.throws(() => createOpenAI({ apiKey: 'x', effort: 'minimal' }), /Unknown effort/);
    assert.throws(() => createAsk({ provider: 'openai', apiKey: 'x', effort: 'minimal' }), /Unknown effort/);
  });
});

describe('errors from either provider', () => {
  const cfg = { maxAutoRetries: 12, retryBaseMs: 1000, retryMaxMs: 60000 };
  it('names the provider that failed', () => {
    const err = Object.assign(new FatalApiError('invalid key', 401), { provider: 'openai' });
    const out = classifyError(err, 0, cfg);
    assert.equal(out.reason, 'auth');
    assert.match(out.message, /OpenAI rejected the API key/);
    assert.match(out.message, /OPENAI_API_KEY/);
  });
  it('still reads an error with no provider as Claude', () => {
    assert.match(classifyError(new FatalApiError('invalid x-api-key', 401), 0, cfg).message, /Anthropic rejected/);
  });
  it('treats OpenAI running out of quota as credit', () => {
    const err = Object.assign(new FatalApiError('OpenAI API 429: insufficient_quota: You exceeded your current quota', 400), { provider: 'openai' });
    assert.equal(classifyError(err, 0, cfg).reason, 'credit');
  });
});
