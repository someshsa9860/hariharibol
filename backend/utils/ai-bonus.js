// The free-tier bonus: extra tokens a day for every reader, while OpenAI's free daily tokens are in use.
//
// An admin gives the bonus a pool — "1.5 million tokens a day" — and it is shared out among the readers who use the
// chat: the more of them there are, the smaller each share, up to a ceiling per reader so a quiet week does not hand
// one person the lot. Pure arithmetic; the switch, the pool and the head-count come from services/ai/free-tier.js.

import { POOLS, capOf } from './ai-free-tier.js';

export const DEFAULT_BONUS = { poolTokens: 1_500_000, maxPerUser: 20_000 };

// What an admin may enter. The pool can never be more than the largest free pool holds in a day.
export const BONUS_LIMITS = { poolTokens: { min: 0, max: POOLS.mini.limit }, maxPerUser: { min: 0, max: 200_000 } };

const whole = (value, fallback, { min, max }) => (Number.isInteger(value) && value >= min && value <= max ? value : fallback);

/** A stored pool/ceiling pair read back safely: a value that is not a sensible whole number is replaced by its default. */
export function normalise({ poolTokens, maxPerUser } = {}) {
  return {
    poolTokens: whole(poolTokens, DEFAULT_BONUS.poolTokens, BONUS_LIMITS.poolTokens),
    maxPerUser: whole(maxPerUser, DEFAULT_BONUS.maxPerUser, BONUS_LIMITS.maxPerUser),
  };
}

/**
 * Each reader's bonus for the day: the pool divided by the readers using the chat, no more than `maxPerUser`, and
 * never counting more of the pool than the free tier itself can hold (`poolCap`, 90% of the pool by default).
 * Fewer than one reader counts as one.
 */
export function perUser({ poolTokens, maxPerUser, users, poolCap = capOf('mini') }) {
  const pool = Math.max(0, Math.min(poolTokens, poolCap));
  const share = Math.floor(pool / Math.max(1, users));
  return Math.max(0, Math.min(share, maxPerUser));
}

/** How much of today's bonus is left for one reader. */
export const left = (bonus, used) => Math.max(0, (bonus || 0) - (used || 0));

/**
 * A debit of `tokens` split into the part the bonus pays and the part the wallet pays. The bonus goes first: it is
 * gone at the end of the day, a wallet is not.
 */
export function split({ tokens, bonus, bonusUsed }) {
  const fromBonus = Math.min(tokens, left(bonus, bonusUsed));
  return { fromBonus, fromWallet: tokens - fromBonus };
}
