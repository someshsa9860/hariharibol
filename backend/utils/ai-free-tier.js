// OpenAI's free daily tokens, as plain rules: which models have a free pool, how big each pool is, and where we stop
// using it. Pure functions — no database, no Redis; the switch
// and the day's tally are in services/ai/free-tier.js and services/ai/token-tally.js.
//
// An organisation that shares its API traffic with OpenAI (platform.openai.com → Settings → Data controls → Sharing)
// gets a daily allowance of free tokens, in two pools by model. Past a pool's limit OpenAI does not refuse — it bills at
// the standard rate — so nothing stops a heavy day but us.

// What OpenAI's Data controls → Sharing page lists (read 2026-10-17). Tokens are counted per pool, per day. The page
// says "tokens" and does not say whether input and output are counted apart; we add them together, which can only
// make us stop early.
export const POOLS = {
  large: {
    label: 'Large models',
    limit: 250_000,
    models: ['gpt-5.4', 'gpt-5.2', 'gpt-5.1', 'gpt-5', 'gpt-4.1', 'gpt-4o', 'o1', 'o3'],
  },
  mini: {
    label: 'Mini and nano models',
    limit: 2_500_000,
    models: ['gpt-5.4-mini', 'gpt-5.4-nano', 'gpt-5-mini', 'gpt-5-nano', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4o-mini', 'o3-mini', 'o4-mini'],
  },
};

// The models the admin can pick for chat: the ones in a pool whose request parameters openai.js already knows (no
// reasoning effort, a plain temperature). A reasoning model in a pool (gpt-5.x, o-series) wants different parameters and
// has not been run here, so it is not offered. All three are in the big `mini` pool. Book translation never uses them.
export const USABLE_MODELS = ['gpt-4o-mini', 'gpt-4.1-mini', 'gpt-4.1-nano'];
export const DEFAULT_MODELS = { text: 'gpt-4o-mini' };

// Stop at this share of a pool's limit: other projects on the same OpenAI organisation draw on the pool without us
// seeing it.
export const SAFETY = 0.9;

// `gpt-4o-mini-2024-07-18` is `gpt-4o-mini`.
const baseName = (model) => String(model || '').replace(/-\d{4}-\d{2}-\d{2}$/, '');

/** The pool a model's tokens count against, or null when it has none. */
export function poolOf(model) {
  const name = baseName(model);
  return Object.keys(POOLS).find((id) => POOLS[id].models.includes(name)) ?? null;
}

/** Where we stop using a pool: SAFETY of its limit. */
export const capOf = (pool) => Math.floor(POOLS[pool].limit * SAFETY);

export const hasRoom = (pool, used) => used < capOf(pool);

// The tally rolls over at midnight UTC.
export const dayOf = (now = new Date()) => now.toISOString().slice(0, 10);

/**
 * Tokens a pool has used, from the day's tally rows (`{ provider, model, inputTokens, outputTokens }`). Only OpenAI's
 * own models count — a Gemini model that happens to share a name with nothing here is nobody's free pool.
 */
export function poolUsed(rows, pool) {
  let total = 0;
  for (const row of rows) {
    if (String(row.provider).toLowerCase() === 'openai' && poolOf(row.model) === pool) total += (row.inputTokens || 0) + (row.outputTokens || 0);
  }
  return total;
}
