// OpenAI's free daily tokens, and the switch that decides whether we use them.
//
// The pools and the rules are in utils/ai-free-tier.js; today's count is services/ai/token-tally.js. This file adds the
// switch (an AppSetting, edited on the admin AI usage page) and answers one question for the callers: "may this call use
// the free tier right now?" — which is yes while the switch is on and the pool of the free model has room.
//
// Turn the switch off before turning data sharing off at OpenAI: the free models are then billed at their normal rates
// and, with the switch on, would still be preferred over the paid default.
//
// What it covers: every call through services/ai/index.js except the stronger-model tier (`text`), and the OpenAI lanes
// of an admin translation run on the paid default model (`translation`). The command-line translation script does not
// use it. When a free model is not available, chat goes on to the provider that is set and then to AI_FALLBACK_MODEL,
// and a translation run goes on with its own model (GPT-6 Luna by default).

import { SETTING_KEYS } from '../../config/constants.js';
import * as settings from '../setting.js';
import * as tally from './token-tally.js';
import { DEFAULT_MODELS, POOLS, SAFETY, USABLE_MODELS, capOf, dayOf, hasRoom, poolOf, poolUsed } from '../../utils/ai-free-tier.js';

const KEYS = {
  enabled: SETTING_KEYS.AI_FREE_TIER_ENABLED,
  text: SETTING_KEYS.AI_FREE_TIER_TEXT_MODEL,
  translation: SETTING_KEYS.AI_FREE_TIER_TRANSLATION_MODEL,
};

export const isEnabled = () => settings.getBoolean(KEYS.enabled, false);

/** The free-tier model for a use (`text` or `translation`): the saved one, if it is still offered, else the default. */
export async function modelFor(use) {
  const saved = await settings.get(KEYS[use], null);
  return USABLE_MODELS.includes(saved) ? saved : DEFAULT_MODELS[use];
}

/**
 * May a call for this use go to the free tier now?
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
  const [enabled, text, translation, rows] = await Promise.all([isEnabled(), modelFor('text'), modelFor('translation'), tally.today()]);
  return {
    enabled,
    models: { text, translation },
    usableModels: USABLE_MODELS,
    safetyPercent: Math.round(SAFETY * 100),
    day: dayOf(),
    pools: Object.keys(POOLS).map((id) => ({
      id, label: POOLS[id].label, limit: POOLS[id].limit, cap: capOf(id), used: poolUsed(rows, id), models: POOLS[id].models,
    })),
    usage: rows.map((row) => ({ ...row, pool: row.provider === 'openai' ? poolOf(row.model) : null })),
  };
}

/** Saves what the admin sent; a field left out is left alone. */
export async function save({ enabled, textModel, translationModel }, updatedById) {
  const options = { updatedById };
  if (enabled !== undefined) await settings.set(KEYS.enabled, enabled ? 'true' : 'false', { ...options, description: 'Use OpenAI’s free daily tokens' });
  if (textModel !== undefined) await settings.set(KEYS.text, textModel, { ...options, description: 'Free-tier model for chat and other AI calls' });
  if (translationModel !== undefined) await settings.set(KEYS.translation, translationModel, { ...options, description: 'Free-tier model for translation runs' });
}
