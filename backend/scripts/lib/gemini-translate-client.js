// The Gemini side of the translation pipeline: the same `ask({ system, user, schema, maxTokens })
// → { data, usage, costUsd, stopReason }` as claude-translate-client.js and openai-translate-client.js, so the
// pipeline cannot tell them apart. Errors are the same classes (TruncatedError, RefusalError, FatalApiError),
// so the worker's classifyError treats a problem the same way whichever provider it came from.
//
// Plain fetch against the REST API, like services/ai/gemini.js: the surface is one endpoint.

import { FatalApiError, RefusalError, TruncatedError } from './claude-translate-client.js';

export const DEFAULT_MODEL = 'gemini-3.5-flash-lite';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// $ per million tokens, from Google's pricing page (prompts up to 200k tokens). A model not listed here still
// runs; its cost is reported as unknown (null). Cached input is billed at `cacheRead`. Thinking tokens are
// billed as output.
const PRICING = {
  'gemini-3.5-flash-lite': { input: 0.3, output: 2.5, cacheRead: 0.03 },
  'gemini-2.5-flash': { input: 0.3, output: 2.5, cacheRead: 0.03 },
  'gemini-2.5-flash-lite': { input: 0.1, output: 0.4, cacheRead: 0.01 },
  'gemini-2.5-pro': { input: 1.25, output: 10, cacheRead: 0.31 },
};

export function costUsd(model, usage) {
  const p = PRICING[model];
  if (!p) return null;
  return (usage.inputTokens * p.input + usage.cacheReadTokens * p.cacheRead + usage.outputTokens * p.output) / 1e6;
}

// Our effort levels are Claude's. Gemini 2.5 takes a budget of thinking tokens; 0 is "no thinking".
const BUDGETS = { off: 0, low: 1024, medium: 4096, high: 16384, xhigh: 24576, max: 32768 };

/**
 * The thinking budget for an effort. Throws for an unknown effort, and for a model that cannot think "off"
 * (the Pro models always think), so the run fails at once, as a config problem, not on the first verse.
 */
// Gemini 3 and later take a named level instead of a token budget (a budget is a 400 there).
const LEVELS = { off: 'minimal', low: 'low', medium: 'medium', high: 'high', xhigh: 'high', max: 'high' };
const usesLevels = (model) => Number(/gemini-(\d+)/.exec(model)?.[1] ?? 0) >= 3;

/** The `thinkingConfig` for a model and effort: a level for Gemini 3+, a token budget before that. */
export function thinkingConfig(model, effort) {
  if (!usesLevels(model)) return { thinkingBudget: thinkingBudget(model, effort) };
  if (!LEVELS[effort]) throw new Error(`Unknown effort "${effort}" — use off, low, medium, high, xhigh or max`);
  return { thinkingLevel: LEVELS[effort] };
}

export function thinkingBudget(model, effort) {
  const budget = BUDGETS[effort];
  if (budget === undefined) throw new Error(`Unknown effort "${effort}" — use off, low, medium, high, xhigh or max`);
  if (budget === 0 && /(^|-)pro(-|$)/.test(model)) {
    throw new Error(`${model} always thinks and cannot be set to effort "off" — use low or higher, or a Flash model`);
  }
  return budget;
}

/**
 * Our JSON Schema → the subset Gemini's `responseSchema` accepts: types in capitals, no
 * `additionalProperties`, and no `enum` on a number (a 1–3 rating becomes an integer between 1 and 3).
 */
export function toGeminiSchema(schema) {
  if (Array.isArray(schema)) return schema.map(toGeminiSchema);
  if (!schema || typeof schema !== 'object') return schema;
  const out = {};
  for (const [key, value] of Object.entries(schema)) {
    if (key === 'additionalProperties') continue;
    if (key === 'type' && typeof value === 'string') out.type = value.toUpperCase();
    else if (key === 'properties') out.properties = Object.fromEntries(Object.entries(value).map(([name, child]) => [name, toGeminiSchema(child)]));
    else if (key === 'items') out.items = toGeminiSchema(value);
    else if (key === 'enum' && schema.type === 'integer') {
      out.minimum = Math.min(...value);
      out.maximum = Math.max(...value);
    } else out[key] = value;
  }
  if (out.properties) out.propertyOrdering = Object.keys(out.properties); // the order the answer is written in
  return out;
}

/** The body of one generateContent call. Pure, so the tests can check exactly what would be sent. */
export function generateRequest({ model, effort, system, user, schema, maxTokens }) {
  return {
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: user }] }],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: maxTokens,
      responseMimeType: 'application/json',
      responseSchema: toGeminiSchema(schema),
      thinkingConfig: thinkingConfig(model, effort),
    },
  };
}

/** A non-2xx answer. `status` is what classifyError reads (429 and 5xx are retried, 401/403 need a key, 402 is money). */
export class GeminiHttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'GeminiHttpError';
    this.status = status;
  }
}

const NETWORK = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ECONNABORTED', 'UND_ERR_SOCKET', 'UND_ERR_CONNECT_TIMEOUT'];

function isTransient(err) {
  if (err instanceof GeminiHttpError) return err.status === 429 || err.status >= 500;
  return err?.name === 'APIConnectionError';
}

const sleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new Error('aborted'));
    });
  });

// Google answers a wrong key with 400 "API key not valid"; the pipeline reads that as the 401 it is.
const statusOf = (status, text) => (status === 400 && /API key (not valid|expired)|API_KEY_INVALID/i.test(text) ? 401 : status);

export function createGemini({ apiKey, model = DEFAULT_MODEL, effort = 'off', transientRetries = 6, onWait = () => {}, signal, fetchImpl = fetch }) {
  thinkingConfig(model, effort); // fail now, not on the first verse

  async function once({ system, user, schema, maxTokens }) {
    const body = JSON.stringify(generateRequest({ model, effort, system, user, schema, maxTokens }));
    let response;
    try {
      response = await fetchImpl(`${BASE}/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
        signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(30 * 60_000)]) : AbortSignal.timeout(30 * 60_000),
      });
    } catch (err) {
      if (signal?.aborted) throw err;
      const code = err?.cause?.code || err?.code;
      if (err?.name === 'TimeoutError' || err?.name === 'AbortError' || NETWORK.includes(code) || err instanceof TypeError) {
        throw Object.assign(new Error(`Gemini could not be reached: ${err?.cause?.message || err.message}`), { name: 'APIConnectionError', code });
      }
      throw err;
    }

    if (!response.ok) {
      const text = (await response.text().catch(() => '')).slice(0, 400);
      throw new GeminiHttpError(statusOf(response.status, text), `Gemini API ${response.status}: ${text}`);
    }

    const data = await response.json();
    const candidate = data.candidates?.[0];
    const u = data.usageMetadata || {};
    const cached = u.cachedContentTokenCount || 0;
    const usage = {
      inputTokens: Math.max(0, (u.promptTokenCount || 0) - cached),
      outputTokens: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), // thinking is billed as output
      cacheReadTokens: cached,
      cacheWriteTokens: 0,
      calls: 1,
    };
    const result = { usage, costUsd: costUsd(model, usage), stopReason: candidate?.finishReason };

    const blocked = data.promptFeedback?.blockReason;
    if (blocked || (candidate && ['SAFETY', 'PROHIBITED_CONTENT', 'BLOCKLIST', 'SPII', 'RECITATION'].includes(candidate.finishReason))) {
      throw Object.assign(new RefusalError(`declined (${blocked || candidate.finishReason})`), result);
    }
    if (candidate?.finishReason === 'MAX_TOKENS') throw Object.assign(new TruncatedError('ran out of output room'), result);

    const text = (candidate?.content?.parts || []).filter((p) => !p.thought).map((p) => p.text ?? '').join('');
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw Object.assign(new Error('answer was not valid JSON'), { ...result, badJson: true });
    }
    return { ...result, data: parsed };
  }

  async function ask(request) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await once(request);
      } catch (err) {
        if (err instanceof TruncatedError || err instanceof RefusalError || err.badJson) throw err;
        if (signal?.aborted) throw err;
        if (err instanceof GeminiHttpError && !isTransient(err)) {
          // 400, 401, 403, 404 …
          throw Object.assign(new FatalApiError(err.message.slice(0, 300), err.status), { provider: 'gemini' });
        }
        if (!isTransient(err) || attempt >= transientRetries) throw Object.assign(err, { provider: 'gemini' });
        const wait = Math.min(30_000 * 2 ** attempt, 10 * 60_000);
        onWait(`${err.status ?? err.name} from Gemini — waiting ${Math.round(wait / 1000)}s (try ${attempt + 1}/${transientRetries})`);
        await sleep(wait, signal);
      }
    }
  }

  return { ask, model, effort };
}
