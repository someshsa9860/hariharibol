// The one place the translation pipeline talks to Claude. Everything else gets a function
// `ask({ system, user, schema, maxTokens }) → { data, usage, costUsd, stopReason }`, which
// is also what the tests replace with a stub.
//
// Streaming, because a verse's seven translations can run to tens of thousands of tokens.
// The SDK retries 429 / 5xx / connection errors itself (honouring retry-after); when it has
// given up on a transient failure this wrapper waits and tries again before reporting it.

import Anthropic from '@anthropic-ai/sdk';

export const DEFAULT_MODEL = 'claude-sonnet-5-5';

// $ per million tokens, from the pricing table in Anthropic's prompt-caching docs (checked 2026-10-12).
// A model not listed here still runs; its cost is reported as unknown (null).
const PRICING = {
  'claude-opus-5-5': { input: 4, output: 20, cacheRead: 0.2 },
  'claude-opus-5': { input: 5, output: 25, cacheRead: 0.5 },
  'claude-sonnet-5-5': { input: 2, output: 10, cacheRead: 0.1 },
  'claude-sonnet-5': { input: 2, output: 10, cacheRead: 0.2 },
  'claude-fable-5-1': { input: 10, output: 50, cacheRead: 0.25 },
};

/** The models priced above, for the admin panel's model lists. Others still run when typed in. */
export const KNOWN_MODELS = Object.entries(PRICING).map(([id, p]) => ({ id, inputPerMillion: p.input, outputPerMillion: p.output }));

export function costUsd(model, usage) {
  const p = PRICING[model];
  if (!p) return null;
  return (
    (usage.inputTokens * p.input +
      usage.cacheWriteTokens * p.input * 1.25 +
      usage.cacheReadTokens * p.cacheRead +
      usage.outputTokens * p.output) /
    1e6
  );
}

export function emptyUsage() {
  return { inputTokens: 0, outputTokens: 0, cacheReadTokens: 0, cacheWriteTokens: 0, calls: 0 };
}

export function addUsage(total, usage) {
  for (const k of Object.keys(total)) total[k] += usage[k] || 0;
  return total;
}

/** The model stopped because it ran out of output room; the answer is incomplete. */
export class TruncatedError extends Error {}
/** The model declined. Never retried silently — a refused verse stops the run. */
export class RefusalError extends Error {}
/** Credentials, quota or request problems that retrying cannot fix. `status` is the HTTP status. */
export class FatalApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

function isTransient(err) {
  if (err instanceof Anthropic.APIConnectionError) return true;
  if (err instanceof Anthropic.APIError) return err.status === 429 || err.status === 529 || err.status >= 500;
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

// How to turn thinking off differs by model, and the wrong value is a 400 (Anthropic docs, "Thinking" →
// "Configuring thinking", checked 2026-10-12). Per model: the `thinking` value that switches it off (null =
// send none, these models only think when asked) and the effort to state with it. Sonnet 5.5, Opus 5 and
// Haiku 5.5 take their off-switch only at effort `high` or below, so it is stated, not left to a default.
// Sonnet 5.5 refuses "disabled" — its lowest setting is "between_tools", which skips the up-front thinking
// and, with no tools in the request, leaves a text-only answer. Opus 5.5, Fable and Mythos cannot turn
// thinking off at all, so they have no row.
const THINKING_OFF = [
  { models: /^claude-sonnet-5-5(-\d{8})?$/, thinking: { type: 'between_tools' }, effort: 'high' },
  { models: /^claude-(opus-5|haiku-5-5)(-\d{8})?$/, thinking: { type: 'disabled' }, effort: 'high' },
  { models: /^claude-sonnet-5(-\d{8})?$/, thinking: { type: 'disabled' } },
  { models: /^claude-(opus|sonnet|haiku)-4/, thinking: null },
];

/**
 * The `thinking` and `output_config.effort` a request carries for this model at this effort level.
 * `off` means no thinking — translating needs none, and thinking tokens are billed as output. Any other
 * level lets the model think adaptively at that level. Throws when the model cannot do what was asked.
 */
export function thinkingSettings(model, effort) {
  if (effort !== 'off') return { thinking: { type: 'adaptive' }, effort };
  const row = THINKING_OFF.find((r) => r.models.test(model));
  if (!row) {
    throw new Error(
      `Cannot turn thinking off on ${model} (Opus 5.5, Fable and Mythos cannot, and other models are not known here) — ` +
        `use --effort low, or --model ${DEFAULT_MODEL}`
    );
  }
  return { thinking: row.thinking, effort: row.effort };
}

/** The body of one Messages call. Pure, so the tests can check exactly what would be sent. */
export function messageRequest({ model, effort, system, user, schema, maxTokens }) {
  const settings = thinkingSettings(model, effort);
  return {
    model,
    max_tokens: maxTokens,
    ...(settings.thinking && { thinking: settings.thinking }),
    output_config: { ...(settings.effort && { effort: settings.effort }), format: { type: 'json_schema', schema } },
    system: [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: user }],
  };
}

/**
 * @param {object} options
 * @param {string} options.apiKey
 * @param {string} [options.model]
 * @param {string} [options.effort]       off (default: no thinking) | low | medium | high | xhigh | max
 * @param {number} [options.transientRetries]  extra waits after the SDK's own retries
 * @param {(msg: string) => void} [options.onWait]
 * @param {AbortSignal} [options.signal]
 */
export function createClaude({ apiKey, model = DEFAULT_MODEL, effort = 'off', transientRetries = 6, onWait = () => {}, signal }) {
  thinkingSettings(model, effort); // fail now, not on the first verse, if this model cannot do what was asked
  const client = new Anthropic({ apiKey, maxRetries: 4, timeout: 30 * 60 * 1000 });

  async function once({ system, user, schema, maxTokens }) {
    const stream = client.messages.stream(messageRequest({ model, effort, system, user, schema, maxTokens }), { signal });
    const message = await stream.finalMessage();

    const usage = {
      inputTokens: message.usage.input_tokens || 0,
      outputTokens: message.usage.output_tokens || 0,
      cacheReadTokens: message.usage.cache_read_input_tokens || 0,
      cacheWriteTokens: message.usage.cache_creation_input_tokens || 0,
      calls: 1,
    };
    const result = { usage, costUsd: costUsd(model, usage), stopReason: message.stop_reason };

    if (message.stop_reason === 'refusal') {
      throw Object.assign(new RefusalError(`declined (${message.stop_details?.category ?? 'no category'})`), result);
    }
    if (message.stop_reason === 'max_tokens') {
      throw Object.assign(new TruncatedError('ran out of output room'), result);
    }
    const text = message.content.filter((b) => b.type === 'text').map((b) => b.text).join('');
    let data;
    try {
      data = JSON.parse(text);
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
        if (err instanceof Anthropic.APIError && !isTransient(err)) {
          // 400 (including "credit balance too low"), 401, 403, 404, 413 …
          throw Object.assign(new FatalApiError(`Anthropic API ${err.status}: ${String(err.message).slice(0, 300)}`, err.status), { provider: 'anthropic' });
        }
        if (!isTransient(err) || attempt >= transientRetries) throw err;
        const wait = Math.min(30_000 * 2 ** attempt, 10 * 60_000);
        onWait(`${err.status ?? err.name} from Anthropic — waiting ${Math.round(wait / 1000)}s (try ${attempt + 1}/${transientRetries})`);
        await sleep(wait, signal);
      }
    }
  }

  return { ask, model, effort };
}
