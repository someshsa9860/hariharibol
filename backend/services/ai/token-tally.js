// The token calculator: every AI token this app sends, counted per day, per provider and per model.
//
// Chat, the batch passes and the admin Translations runs all add to it as a call finishes (services/ai/index.js and
// jobs/processors/translation.js), so one place says how much of a model's day has gone. That is what lets
// services/ai/free-tier.js spend OpenAI's free tokens up to their limit and no further, and what the admin AI usage
// page lists, model by model.
//
// Redis, so the API and the worker (which runs translations) add to one number. One hash per UTC day, with the fields
// `<provider>|<model>|in`, `|out` and `|calls`, kept three days. It is the calls *this app* made: other projects on the
// same OpenAI organisation, and the command-line translation script, are not in it, and a flushed Redis starts the
// day again from zero. A Redis that cannot answer reads as empty — a counter outage must never stop a reply.

import { redis } from '../../config/redis.js';
import { dayOf } from '../../utils/ai-free-tier.js';

const KEEP_SECONDS = 3 * 86_400;
const KINDS = { in: 'inputTokens', out: 'outputTokens', calls: 'calls' };

/** The Redis hash of one day's counts (exported so a test can put it back as it found it). */
export const keyOf = (now) => `ai:tokens:${dayOf(now)}`;
const fieldOf = (provider, model, kind) => `${String(provider).toLowerCase()}|${model}|${kind}`;

/** Counts one finished call. Nothing is added for a call that used no tokens. */
export async function record({ provider, model, inputTokens = 0, outputTokens = 0 }, now = new Date()) {
  const input = Math.max(0, Math.round(inputTokens || 0));
  const output = Math.max(0, Math.round(outputTokens || 0));
  if (!provider || !model || input + output === 0) return;

  const key = keyOf(now);
  await redis
    .multi()
    .hincrby(key, fieldOf(provider, model, 'in'), input)
    .hincrby(key, fieldOf(provider, model, 'out'), output)
    .hincrby(key, fieldOf(provider, model, 'calls'), 1)
    .expire(key, KEEP_SECONDS)
    .exec()
    .catch(() => null);
}

/** Today's rows, the busiest first: `{ provider, model, inputTokens, outputTokens, calls }`, provider in lower case. */
export async function today(now = new Date()) {
  const hash = await redis.hgetall(keyOf(now)).catch(() => null);
  const rows = new Map();

  for (const [field, value] of Object.entries(hash || {})) {
    const first = field.indexOf('|');
    const last = field.lastIndexOf('|');
    const kind = KINDS[field.slice(last + 1)];
    if (first < 0 || last <= first || !kind) continue;

    const provider = field.slice(0, first);
    const model = field.slice(first + 1, last);
    const id = `${provider}|${model}`;
    if (!rows.has(id)) rows.set(id, { provider, model, inputTokens: 0, outputTokens: 0, calls: 0 });
    rows.get(id)[kind] = Number(value) || 0;
  }

  return [...rows.values()].sort((a, b) => b.inputTokens + b.outputTokens - (a.inputTokens + a.outputTokens));
}
