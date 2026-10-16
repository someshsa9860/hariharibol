// The four things translated for a verse — its translation, its purport, its transliteration (the Sanskrit in
// the language's script) and its word-by-word meanings — and how a run assigns them to AI models.
//
// A run's **plan** says, per part, which provider, model and effort writes it:
//
//   { translation:     { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'off' },
//     purport:         { provider: 'anthropic', model: 'claude-sonnet-5-5', effort: 'off' },
//     transliteration: { provider: 'gemini',    model: 'gemini-3.5-flash-lite', effort: 'off' } }
//
// A part left out of the plan is not touched by the run. Parts that name the same provider, model and effort
// form one **lane**: they share a single request per verse, and the request carries only their instructions
// and their source text. Lanes do not wait for each other.
//
// Pure functions only (no I/O), so `npm test` covers all of it.

import { createHash } from 'node:crypto';

import { wordCount } from './claude-translate-validate.js';

export const PARTS = ['translation', 'transliteration', 'wordMeanings', 'purport'];

/** What the admin panel calls each part. */
export const PART_LABELS = {
  translation: 'Translation',
  purport: 'Purport',
  transliteration: 'Transliteration',
  wordMeanings: 'Word meanings',
};

export const isPart = (name) => PARTS.includes(name);

// What a saved row's `translatedBy` says about who wrote it: the provider's brand, which is short enough for the column
// (the model and effort are in the stamp). Every provider in translate-providers.js has one; a stamp with no provider
// is from before there were several, when Claude wrote everything.
export const MADE_BY = { anthropic: 'claude', openai: 'gpt', gemini: 'gemini' };

/** Every label a pipeline row can carry — what "made by a run, not by a person" means to the database. */
export const MADE_BY_LABELS = Object.values(MADE_BY);

/** The `translatedBy` label for text a stamp's provider wrote (an unknown provider labels itself rather than pass as Claude). */
export const translatedByOf = (provider) => MADE_BY[provider ?? 'anthropic'] ?? provider;

/** The stamp that speaks for a whole verse, out of its parts' stamps: the translation's, or else the newest part's. Null when there are none. */
export function mainStampOf(parts) {
  const held = PARTS.filter((p) => parts[p]).map((p) => parts[p]);
  if (!held.length) return null;
  const newest = held.sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))[0];
  return parts.translation ?? newest;
}

/** Does the English have something for this part? The translation always does; the others only when the verse has them. */
export function unitHasPart(unit, part) {
  switch (part) {
    case 'translation':
      return Boolean(unit.translation);
    case 'purport':
      return (unit.purport || []).length > 0;
    case 'transliteration':
      return (unit.transliteration || []).length > 0;
    case 'wordMeanings':
      return (unit.wordMeanings || []).length > 0;
    default:
      throw new Error(`Unknown part "${part}" — use ${PARTS.join(', ')}`);
  }
}

/** The parts of a unit that exist, among `parts`. */
export const partsOf = (unit, parts = PARTS) => parts.filter((p) => unitHasPart(unit, p));

/** Stable fingerprint of exactly what the model is sent for one part of a verse. */
export function partHash(unit, part) {
  const source = {
    translation: unit.translation,
    purport: unit.purport,
    transliteration: unit.transliteration || [],
    wordMeanings: unit.wordMeanings || [],
  }[part];
  return createHash('sha256').update(JSON.stringify({ part, source })).digest('hex').slice(0, 16);
}

/**
 * Words the model writes for a part, weighted for the cost guess: a Sanskrit word in another script costs
 * more tokens than a translated one, so the two lists count one and a half times.
 */
export function partOutputWords(unit, part) {
  switch (part) {
    case 'translation':
      return wordCount(unit.translation || '');
    case 'purport':
      return (unit.purport || []).reduce((n, p) => n + wordCount(p), 0);
    case 'transliteration':
      return 1.5 * (unit.transliteration || []).reduce((n, l) => n + wordCount(l), 0);
    case 'wordMeanings':
      return 1.5 * (unit.wordMeanings || []).reduce((n, w) => n + wordCount(w.word || '') + wordCount(w.meaning || ''), 0);
    default:
      return 0;
  }
}

/** Words the model reads for a part (the lists count double, as the markup around each entry is heavier). */
export function partInputWords(unit, part) {
  return part === 'translation' || part === 'purport' ? partOutputWords(unit, part) : (partOutputWords(unit, part) / 1.5) * 2;
}

/* ---------- the plan ---------- */

export const laneKey = ({ provider, model, effort }) => `${provider}|${model}|${effort}`;

/**
 * A plan as the pipeline wants it: `{ part: { provider, model, effort } }` with every field filled, in the
 * order of PARTS. `defaults` fills what an entry leaves out. Without a plan, every part uses the defaults.
 * @throws on an unknown part, or an entry that is not an object
 */
export function normalizePlan(plan, defaults) {
  const source = plan == null ? Object.fromEntries(PARTS.map((p) => [p, {}])) : plan;
  if (typeof source !== 'object' || Array.isArray(source)) throw new Error('A plan is an object with a provider and model for each part');
  const unknown = Object.keys(source).filter((name) => !isPart(name));
  if (unknown.length) throw new Error(`Unknown part${unknown.length > 1 ? 's' : ''} in the plan: ${unknown.join(', ')} — use ${PARTS.join(', ')}`);
  const out = {};
  for (const part of PARTS) {
    if (!(part in source)) continue;
    const entry = source[part];
    if (entry == null || typeof entry !== 'object') throw new Error(`The plan for ${part} must be an object`);
    out[part] = {
      provider: entry.provider || defaults.provider,
      model: entry.model || defaults.model,
      effort: entry.effort || defaults.effort || 'off',
    };
    if (!out[part].provider || !out[part].model) throw new Error(`The plan for ${part} has no provider or model`);
  }
  if (!Object.keys(out).length) throw new Error('The plan has no parts — pick at least one of ' + PARTS.join(', '));
  return out;
}

/**
 * The lanes of a plan: parts with the same provider, model and effort, in PARTS order, each lane
 * listed where its first part comes. → [{ key, provider, model, effort, parts }]
 */
export function lanesOf(plan) {
  const lanes = new Map();
  for (const part of PARTS) {
    const entry = plan[part];
    if (!entry) continue;
    const key = laneKey(entry);
    if (!lanes.has(key)) lanes.set(key, { key, provider: entry.provider, model: entry.model, effort: entry.effort, parts: [] });
    lanes.get(key).parts.push(part);
  }
  return [...lanes.values()];
}
