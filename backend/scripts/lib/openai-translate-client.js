// The OpenAI side of the translation pipeline: the same `ask({ system, user, schema, maxTokens })
// → { data, usage, costUsd, stopReason }` as claude-translate-client.js, so the pipeline cannot tell them apart.
// Errors are the same classes (TruncatedError, RefusalError, FatalApiError), so the worker's
// classifyError treats a problem the same way whichever provider it came from.

import OpenAI from 'openai';

import { FatalApiError, RefusalError, TruncatedError } from './claude-translate-client.js';

export const DEFAULT_MODEL = 'gpt-6-luna';

// $ per million tokens, from OpenAI's pricing page (checked 2026-10-15). A model not listed here still runs;
// its cost is reported as unknown (null). Cached input is billed at `cacheRead`.
const PRICING = {
  'gpt-6-luna': { input: 0.1, output: 0.5, cacheRead: 0.01 },
};

export function costUsd(model, usage) {
  const p = PRICING[model];
  if (!p) return null;
  return (usage.inputTokens * p.input + usage.cacheReadTokens * p.cacheRead + usage.outputTokens * p.output) / 1e6;
}

// Our effort levels are Claude's. `off` is "no thinking" — translating needs none, and reasoning tokens are
// billed as output — which OpenAI calls `none`. The others carry over by name.
const EFFORT = { off: 'none', low: 'low', medium: 'medium', high: 'high', xhigh: 'xhigh', max: 'max' };

export function reasoningEffort(effort) {
  const value = EFFORT[effort];
  if (!value) throw new Error(`Unknown effort "${effort}" — use off, low, medium, high, xhigh or max`);
  return value;
}

/** The body of one Chat Completions call. Pure, so the tests can check exactly what would be sent. */
export function chatRequest({ model, effort, system, user, schema, maxTokens }) {
  return {
    model,
    max_completion_tokens: maxTokens,
    reasoning_effort: reasoningEffort(effort),
    response_format: { type: 'json_schema', json_schema: { name: 'translation', strict: true, schema } },
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
  };
}

function isTransient(err) {
  if (err instanceof OpenAI.APIConnectionError) return true;
  if (err instanceof OpenAI.APIError) return err.status === 429 || err.status >= 500;
  return false;
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });

export function createOpenAI({ apiKey, model = DEFAULT_MODEL, effort = 'off', transientRetries = 6, onWait = () => {}, signal }) {
  reasoningEffort(effort); // fail now, not on the first verse
  const client = new OpenAI({ apiKey, maxRetries: 4, timeout: 30 * 60 * 1000 });

  async function once({ system, user, schema, maxTokens }) {
    const completion = await client.chat.completions.create(chatRequest({ model, effort, system, user, schema, maxTokens }), { signal });
    const choice = completion.choices[0];
    const u = completion.usage || {};
    const cached = u.prompt_tokens_details?.cached_tokens || 0;
    const usage = {
      inputTokens: Math.max(0, (u.prompt_tokens || 0) - cached),
      outputTokens: u.completion_tokens || 0, // includes reasoning tokens, which are billed as output
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
      calls: 1,
    };
    const result = { usage, costUsd: costUsd(model, usage), stopReason: choice?.finish_reason };

    if (choice?.message?.refusal || choice?.finish_reason === 'content_filter') {
      throw Object.assign(new RefusalError(`declined (${choice.message?.refusal ?? 'content filter'})`.slice(0, 300)), result);
    }
    if (choice?.finish_reason === 'length') throw Object.assign(new TruncatedError('ran out of output room'), result);

    let data;
    try {
      data = JSON.parse(choice?.message?.content ?? '');
    } catch {
      throw Object.assign(new Error('answer was not valid JSON'), { ...result, badJson: true });
    }
    return { ...result, data };
  }

  async function ask(request) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await once(request);
      } catch (err) {
        if (err instanceof TruncatedError || err instanceof RefusalError || err.badJson) throw err;
        if (signal?.aborted) throw err;
        if (err instanceof OpenAI.APIError && !isTransient(err)) {
          // 400, 401, 403, 404, insufficient_quota …
          const text = `${err.code ? `${err.code}: ` : ''}${err.message}`.slice(0, 300);
          throw Object.assign(new FatalApiError(`OpenAI API ${err.status}: ${text}`, err.status), { provider: 'openai', code: err.code });
        }
        if (!isTransient(err) || attempt >= transientRetries) throw err;
        const wait = Math.min(30_000 * 2 ** attempt, 10 * 60_000);
        onWait(`${err.status ?? err.name} from OpenAI — waiting ${Math.round(wait / 1000)}s (try ${attempt + 1}/${transientRetries})`);
        await sleep(wait, signal);
      }
    }
  }

  return { ask, model, effort };
}
