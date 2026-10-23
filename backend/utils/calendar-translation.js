// The Hindu calendar's words in a reader's language, as pure functions (no I/O, so `npm test` covers them): what a
// translation is keyed by, how the words of a response are swapped for the reader's language, the prompt a translation
// run sends and the checks on its answer, and how a run is sent to the admin page.
//
// Reading and writing the database, the queue and Redis is services/calendar-translation.js; the run itself is
// jobs/processors/calendar.js.

import { createHash } from 'node:crypto';

import { calendar, languages, TERM_FIELDS } from '../config/calendar.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';
import { estimateTokens, scriptShare } from './etiquette.js';

/** Bumped when the translation prompt or the shape of its answer changes. */
export const PROMPT_VERSION = '1';

export const languageInfo = (code) => languages.find((l) => l.code === code) ?? null;
export { estimateTokens };

/* ---------- what a translation is keyed by ---------- */

/** The SHA-1 of the English text. A reworded name hashes differently, so it stops matching its old translation. */
export const sourceKeyOf = (text) => createHash('sha1').update(String(text).trim()).digest('hex');

/** "NAME:3f2a…" — one item of work, whatever the language. */
export const itemKey = (kind, text) => `${kind}:${sourceKeyOf(text)}`;

/* ---------- the words of a response, in a reader's language ---------- */

/**
 * The English words a calendar response is made of, as `[{ kind, text }]` (duplicates are fine): each festival's name
 * and description, the Ekadashi a parana row belongs to, and the panchang terms of each day. A parana's description is
 * the day's own times in English, built for that date; it is not translated (the push words it from `details`).
 */
export function wordsOf(days = [], festivals = []) {
  const out = [];
  for (const f of festivals) {
    if (f.name) out.push({ kind: 'NAME', text: f.name });
    if (f.description && f.kind !== 'PARANA') out.push({ kind: 'DESCRIPTION', text: f.description });
    if (f.details?.ekadashi) out.push({ kind: 'NAME', text: f.details.ekadashi });
  }
  for (const d of days) for (const field of Object.keys(TERM_FIELDS)) if (d[field]) out.push({ kind: 'TERM', text: d[field] });
  return out;
}

/** The words as they come: English stays English. */
export const plainWords = (_kind, text) => text;

/**
 * `(kind, text) => the text in the reader's language`, from the translation `rows` that were found for the chain.
 * Walking the chain, the first language with a translation wins; reaching English stops the walk.
 */
export function makeWords(rows, chain = [DEFAULT_LANGUAGE]) {
  const found = new Map(rows.map((r) => [`${r.languageCode}|${r.kind}|${r.sourceKey}`, r.text]));
  const codes = [];
  for (const code of chain) {
    if (code === DEFAULT_LANGUAGE) break;
    codes.push(code);
  }
  if (!codes.length || !found.size) return plainWords;
  return (kind, text) => {
    if (!text) return text;
    const key = sourceKeyOf(text);
    for (const code of codes) {
      const hit = found.get(`${code}|${kind}|${key}`);
      if (hit?.trim()) return hit;
    }
    return text;
  };
}

/* ---------- the translation prompt ---------- */

export const SYSTEM_PROMPT = `You translate the words of the Hindu calendar (panchang) for an app used by devotees of Kṛṣṇa and Viṣṇu in India. Each item is one of:
- NAME: the name of a festival or observance (Papmochani Ekadashi, Vinayaka Chaturthi, Makar Sankranti, Shukla Pradosh Vrat, Nirjala Ekadashi parana).
- DESCRIPTION: one or two sentences about a festival.
- TERM: a panchang term, with its group named (a tithi, a nakshatra, a yoga, a karana, a lunar month, a zodiac sign).

Rules:
- Names and terms are Sanskrit or Sanskrit-derived. Write them the way the target language's own almanacs and panchangs write them (Ekadashi → एकादशी, Mesha → मेष, Shukla Pradosh Vrat → शुक्ल प्रदोष व्रत). Use the established form of the word; do not turn a name into a plain-language phrase and do not explain it.
- Words such as Ekadashi, Chaturthi, Purnima, Amavasya, Sankranti, Jayanti, Vrat and parana are part of the names: write each with its established word in the target language.
- A DESCRIPTION is translated faithfully, in the warm, respectful register a kind elder would use. Add nothing and leave nothing out.
- Write in the target language's own script. Leave no English word except a proper name that has no usual form in that script.
- Keep each translation as short as the English: a name is a heading and a push title.
- Return every item you were given, once, with the same "ref".`;

export function userPrompt({ languageName, endonym, items }) {
  const lines = items.map((i) => JSON.stringify({ ref: i.ref, kind: i.kind, ...(i.group && { group: i.group }), text: i.source }));
  return [`Translate into ${languageName} (${endonym}).`, '', 'Items, one JSON object per line:', ...lines, '', 'Return every item, with its ref unchanged.'].join('\n');
}

/** The JSON Schema of the answer (the provider clients turn it into their own structured-output form). */
export const TRANSLATE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          ref: { type: 'string', description: 'The ref the item came with, unchanged' },
          text: { type: 'string', description: 'The translation' },
        },
        required: ['ref', 'text'],
      },
    },
  },
  required: ['items'],
};

const MAX_LENGTH = { NAME: 240, TERM: 80 };

/**
 * The checks on one answer. `asked` is the items sent (`{ ref, kind, source }`), `code` the language.
 * → `{ ok, items: [{ ref, text }], problems: [] }` — `items` holds only those that passed, so a half-good answer is
 * not wasted.
 */
export function checkAnswer(data, asked, code) {
  const info = languageInfo(code);
  const problems = [];
  const good = [];
  const got = new Map();
  for (const row of Array.isArray(data?.items) ? data.items : []) {
    if (row && (typeof row.ref === 'string' || typeof row.ref === 'number')) got.set(String(row.ref).trim(), row);
  }

  for (const item of asked) {
    const row = got.get(item.ref);
    if (!row) {
      problems.push(`"${item.ref}" is missing`);
      continue;
    }
    const text = String(row.text ?? '').trim();
    if (!text) {
      problems.push(`"${item.ref}" is empty`);
      continue;
    }
    const limit = MAX_LENGTH[item.kind] ?? Math.max(300, item.source.length * 4);
    if (text.length > limit) {
      problems.push(`"${item.ref}" is far longer than the English`);
      continue;
    }
    if (info && scriptShare(text, info.block) < 0.5) {
      problems.push(`"${item.ref}" is not written in ${info.name}`);
      continue;
    }
    good.push({ ref: item.ref, text });
  }
  return { ok: problems.length === 0, items: good, problems };
}

/* ---------- a run, as the page receives it ---------- */

/** @param {object} row a CalendarRun */
export function presentRun(row, now = new Date()) {
  const done = row.doneItems;
  const total = row.totalItems;
  const info = languageInfo(row.language);
  const perItem = done > 0 && row.activeSeconds > 0 ? row.activeSeconds / done : null;
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > calendar.staleHeartbeatSeconds * 1000;
  return {
    id: row.id,
    language: row.language,
    languageName: info?.name ?? row.language,
    endonym: info?.endonym ?? row.language,
    provider: row.provider,
    model: row.model,
    force: row.force,
    status: row.status,
    pauseReason: row.pauseReason,
    statusMessage: row.statusMessage,
    stopReason: row.stopReason,
    resumeAt: row.resumeAt,
    cancelRequested: row.cancelRequested,
    progress: {
      total,
      done,
      percent: total ? Math.min(100, Math.round((done / total) * 100)) : 0,
      currentItem: row.currentItem,
      etaSeconds: perItem && row.status === 'RUNNING' ? Math.round(perItem * Math.max(0, total - done)) : null,
    },
    usage: { inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls },
    attempts: row.attempts,
    requestedBy: row.requestedById ? { id: row.requestedById, name: row.requestedByName } : null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    stalled: Boolean(stalled),
  };
}
