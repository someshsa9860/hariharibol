// OpenAI's free daily tokens, and the switch that decides whether we use them.
//
// The pools and the rules are in utils/ai-free-tier.js; today's count is services/ai/token-tally.js. This file adds the
// switch (an AppSetting, edited on the admin AI usage page) and answers one question for the callers: "may this call use
// the free tier right now?" — which is yes while the switch is on and the pool of the free model has room.
//
// Turn the switch off before turning data sharing off at OpenAI: the free models are then billed at their normal rates
// and, with the switch on, would still be preferred over the paid default.
//
// What it covers: every call through services/ai/index.js except the stronger-model tier (`text`). Book translation
// (the admin runs and the command-line script) never uses it: the free models have limits a translation cannot work
// within. When a free model is not available, chat goes on to the provider that is set and then to AI_FALLBACK_MODEL.

import { SETTING_KEYS } from '../../config/constants.js';
import { prisma } from '../../config/database.js';
import * as settings from '../setting.js';
import * as tally from './token-tally.js';
import { BONUS_LIMITS, normalise as normaliseBonus, perUser as bonusPerUser } from '../../utils/ai-bonus.js';
import { localDateKey } from '../../utils/ai-credits.js';
import { DEFAULT_MODELS, POOLS, SAFETY, USABLE_MODELS, capOf, dayOf, hasRoom, poolOf, poolUsed } from '../../utils/ai-free-tier.js';

const KEYS = {
  enabled: SETTING_KEYS.AI_FREE_TIER_ENABLED,
  text: SETTING_KEYS.AI_FREE_TIER_TEXT_MODEL,
  bonusPool: SETTING_KEYS.AI_FREE_TIER_BONUS_POOL,
  bonusMax: SETTING_KEYS.AI_FREE_TIER_BONUS_MAX_USER,
};

// ── The daily bonus ──────────────────────────────────────────────────────────
// While the switch is on and the pool has room, every reader on a plan that uses the ordinary chat model gets extra
// tokens each day, out of a pool the admin sets (1.5 million by default) shared among the readers who used the chat in
// the last week, up to a ceiling each. They are spent first, before the wallet, and do not count against the daily cap
// (services/ai-wallet.js). The head-count is cached: it only has to be roughly right, and it moves slowly.

const ACTIVE_DAYS = 7;
const COUNT_TTL_MS = 10 * 60 * 1000;
let counted = { at: 0, users: 0 };

/** Readers who used the chat in the last week (at least the ones counted today). */
async function activeReaders() {
  if (Date.now() - counted.at < COUNT_TTL_MS) return counted.users;
  try {
    const since = localDateKey(new Date(Date.now() - ACTIVE_DAYS * 86400000), 'UTC');
    const [{ n }] = await prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS n FROM "AiDailyUsage" WHERE "date" >= ${since}`;
    counted = { at: Date.now(), users: n };
  } catch {
    // Keep the last count; a reader is never turned away because a count failed.
    counted = { at: Date.now(), users: counted.users };
  }
  return counted.users;
}

export const clearBonusCache = () => {
  counted = { at: 0, users: 0 };
};

async function bonusSettings() {
  const [poolTokens, maxPerUser] = await Promise.all([settings.get(KEYS.bonusPool, null), settings.get(KEYS.bonusMax, null)]);
  const asInt = (value) => (value === null || value === undefined || value === '' ? undefined : Number(value));
  return normaliseBonus({ poolTokens: asInt(poolTokens), maxPerUser: asInt(maxPerUser) });
}

/**
 * Today's bonus for one reader, in tokens: 0 while the switch is off or the day's free pool is spent.
 * → `{ tokens, users, poolTokens, maxPerUser, active }`
 */
export async function bonus() {
  const [config, gate] = await Promise.all([bonusSettings(), check('text')]);
  if (!gate.model) return { ...config, tokens: 0, users: counted.users, active: false };
  const users = await activeReaders();
  return { ...config, tokens: bonusPerUser({ ...config, users, poolCap: capOf(poolOf(gate.model) || 'mini') }), users, active: true };
}

/** Just the number, for the wallet. */
export const dailyBonus = async () => (await bonus()).tokens;

export const isEnabled = () => settings.getBoolean(KEYS.enabled, false);

/** The free-tier model for chat: the saved one, if it is still offered, else the default. */
export async function modelFor(use) {
  const saved = await settings.get(KEYS[use], null);
  return USABLE_MODELS.includes(saved) ? saved : DEFAULT_MODELS[use];
}

/**
 * May a call for this use (`text`) go to the free tier now?
 * → `{ model }` when it may, `{ model: null, reason: 'off' | 'spent' }` when it may not.
 */
export async function check(use) {
  if (!(await isEnabled())) return { model: null, reason: 'off' };
  const model = await modelFor(use);
  const pool = poolOf(model);
  if (!hasRoom(pool, poolUsed(await tally.today(), pool))) return { model: null, reason: 'spent' };
  return { model, reason: null };
}

/** What the admin page shows: the switch, the pools against today's count, and the count model by model. */
export async function status() {
  const [enabled, text, rows, dailyBonusNow] = await Promise.all([isEnabled(), modelFor('text'), tally.today(), bonus()]);
  return {
    enabled,
    models: { text },
    usableModels: USABLE_MODELS,
    safetyPercent: Math.round(SAFETY * 100),
    day: dayOf(),
    bonus: { ...dailyBonusNow, limits: BONUS_LIMITS },
    pools: Object.keys(POOLS).map((id) => ({
      id, label: POOLS[id].label, limit: POOLS[id].limit, cap: capOf(id), used: poolUsed(rows, id), models: POOLS[id].models,
    })),
    usage: rows.map((row) => ({ ...row, pool: row.provider === 'openai' ? poolOf(row.model) : null })),
  };
}

/** Saves what the admin sent; a field left out is left alone. */
export async function save({ enabled, textModel, bonusPoolTokens, bonusMaxPerUser }, updatedById) {
  const options = { updatedById };
  if (enabled !== undefined) await settings.set(KEYS.enabled, enabled ? 'true' : 'false', { ...options, description: 'Use OpenAI’s free daily tokens' });
  if (textModel !== undefined) await settings.set(KEYS.text, textModel, { ...options, description: 'Free-tier model for chat and other AI calls' });
  if (bonusPoolTokens !== undefined) await settings.set(KEYS.bonusPool, String(bonusPoolTokens), { ...options, description: 'Free-tier daily bonus: tokens shared among readers' });
  if (bonusMaxPerUser !== undefined) await settings.set(KEYS.bonusMax, String(bonusMaxPerUser), { ...options, description: 'Free-tier daily bonus: most one reader gets' });
  clearBonusCache();
}
