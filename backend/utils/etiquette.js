// What devotee etiquette is made of, as pure functions (no I/O, so `npm test` covers them): which item a date gets, the
// wording of an item in a reader's language, the push, the prompt a translation run sends and the checks on its answer,
// and how a run is sent to the admin page.
//
// Reading and writing the database, the queue and Redis is services/etiquette.js; the run itself is
// jobs/processors/etiquette.js.

import { CATEGORY_IDS, categories, etiquette, languages } from '../config/etiquette.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';
import * as language from './language.js';
import { etiquetteTitle, greetedTitle } from './messages.js';
import { firstNameOf } from './chat-name.js';
import { usdOf } from './translation-run.js';

export const STATUSES = ['PUBLISHED', 'DRAFT', 'EXCLUDED'];

/** Bumped when the translation prompt or the shape of its answer changes. */
export const PROMPT_VERSION = '1';

export const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;
export const isCategory = (id) => CATEGORY_IDS.includes(id);
export const languageInfo = (code) => languages.find((l) => l.code === code) ?? null;

/* ---------- which item a date gets ---------- */

/**
 * The item for a date that has none yet. Items that have never had a day come first, in their order; once every one
 * has had a day, the one that had it longest ago. So a new item is shown soon, and nothing repeats before the whole
 * list has been through.
 *
 * @param {{ id: string, sortOrder: number }[]} published  the PUBLISHED items
 * @param {Map<string, string>} lastUsed  item id → the latest date (YYYY-MM-DD) it was given
 * @returns {string|null} the item's id, or null when nothing is published
 */
export function pickNext(published, lastUsed) {
  let best = null;
  for (const item of published) {
    const used = lastUsed.get(item.id) ?? '';
    if (!best || used < best.used || (used === best.used && (item.sortOrder < best.item.sortOrder || (item.sortOrder === best.item.sortOrder && item.id < best.item.id)))) {
      best = { item, used };
    }
  }
  return best ? best.item.id : null;
}

/* ---------- an item in a reader's language ---------- */

/**
 * `item` carries its `translations` (published ones are enough). Walking the reader's languages, the first with a
 * translation wins; reaching English stops the walk, since the plain columns are English.
 * → `{ title, summary, body, language }`
 */
export function wording(item, chain = [DEFAULT_LANGUAGE]) {
  const rows = (item.translations || []).filter((t) => t.isPublished !== false);
  for (const code of chain) {
    if (code === DEFAULT_LANGUAGE) break;
    const row = rows.find((t) => t.languageCode === code);
    if (row?.title?.trim() && row?.summary?.trim() && row?.body?.trim()) {
      return { title: row.title, summary: row.summary, body: row.body, language: code };
    }
  }
  return { title: item.title, summary: item.summary, body: item.body, language: DEFAULT_LANGUAGE };
}

/** An item as the app receives it. */
export function present(item, chain) {
  const w = wording(item, chain);
  return {
    id: item.id,
    slug: item.slug,
    category: item.category,
    title: w.title,
    summary: w.summary,
    body: w.body,
    language: w.language,
    reference: item.reference ?? null,
    author: item.author ?? null,
    sourceName: item.sourceName ?? null,
    sourceUrl: item.sourceUrl ?? null,
  };
}

/* ---------- the push ---------- */

function clip(text, max) {
  const clean = String(text || '').trim();
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max).trimEnd()}…`;
}

/**
 * The title, body and data of the day's push for one reader, in their reading language. The title says what it is, the
 * body is the item's own title and then its summary. `data.deeplink` opens the app on the item.
 */
export function etiquettePush({ item, user }) {
  const chain = language.readingChain(user);
  const w = wording(item, chain);
  return {
    title: greetedTitle(firstNameOf(user?.name), chain, etiquetteTitle(chain)),
    body: clip(`${w.title}\n${w.summary}`, etiquette.pushBodyChars + w.title.length),
    data: { deeplink: `hariharibol://etiquette/${item.id}`, etiquetteId: item.id, category: item.category },
  };
}

/* ---------- the translation prompt ---------- */

export const SYSTEM_PROMPT = `You translate short pieces of devotional etiquette for an app used by devotees of Kṛṣṇa and Viṣṇu in India. Each piece has a title, a summary (shown in a push notification) and a body (a few sentences). Translate all three into the language asked for.

Rules:
- Translate the meaning faithfully and simply, in the warm, respectful register a kind elder would use. Do not add advice, examples or sources that are not in the English, and do not leave anything out.
- Keep Sanskrit and devotional terms (Kṛṣṇa, prasāda, darśana, tilaka, tulasī, japa, ārati, Vaiṣṇava, guru, mahā-mantra) the way devotees write them in the target language and script; do not translate them into plain words.
- Write in the target language's own script. Do not leave English words except for proper names with no usual form in that script.
- Keep each summary as short as the English: it is read on a lock screen.
- The title is a short heading, not a sentence ending in a full stop unless the English has one.
- Return every item you were given, once, with the same "slug" it came with.`;

export function userPrompt({ languageName, endonym, items }) {
  const lines = items.map((i) => JSON.stringify({ slug: i.slug, title: i.title, summary: i.summary, body: i.body }));
  return [`Translate into ${languageName} (${endonym}).`, '', 'Items, one JSON object per line:', ...lines, '', 'Return every item, with its slug unchanged.'].join('\n');
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
          slug: { type: 'string', description: 'The slug the item came with, unchanged' },
          title: { type: 'string' },
          summary: { type: 'string' },
          body: { type: 'string' },
        },
        required: ['slug', 'title', 'summary', 'body'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

export const estimateTokens = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t).length, 0) / 2);

const LIMITS = { title: 400, summary: 800 };

/** Share of the letters in `text` that fall in the script block. Digits, spaces and punctuation are not letters. */
export function scriptShare(text, block) {
  let letters = 0;
  let inBlock = 0;
  for (const ch of String(text)) {
    if (!/\p{L}|\p{M}/u.test(ch)) continue;
    letters += 1;
    const code = ch.codePointAt(0);
    if (code >= block[0] && code <= block[1]) inBlock += 1;
  }
  return letters === 0 ? 0 : inBlock / letters;
}

/**
 * The checks on one answer. `asked` is the items sent (`{ slug, title, summary, body }`), `code` the language.
 * → `{ ok, items: [{ slug, title, summary, body }], problems: [] }` — `items` holds only those that passed, so a
 * half-good answer is not wasted.
 */
export function checkAnswer(data, asked, code) {
  const info = languageInfo(code);
  const problems = [];
  const good = [];
  const got = new Map();
  for (const row of Array.isArray(data?.items) ? data.items : []) {
    if (row && typeof row.slug === 'string') got.set(row.slug.trim(), row);
  }

  for (const item of asked) {
    const row = got.get(item.slug);
    if (!row) {
      problems.push(`"${item.slug}" is missing`);
      continue;
    }
    const title = String(row.title ?? '').trim();
    const summary = String(row.summary ?? '').trim();
    const body = String(row.body ?? '').trim();
    if (!title || !summary || !body) {
      problems.push(`"${item.slug}" has an empty part`);
      continue;
    }
    if (title.length > LIMITS.title || summary.length > LIMITS.summary) {
      problems.push(`"${item.slug}" has a title or summary that is too long`);
      continue;
    }
    // The summary is a lock-screen line: not more than about three times the English, which is generous for Indic scripts.
    if (summary.length > Math.max(120, item.summary.length * 3)) {
      problems.push(`"${item.slug}" has a summary far longer than the English`);
      continue;
    }
    if (info && scriptShare(`${title} ${summary} ${body}`, info.block) < 0.5) {
      problems.push(`"${item.slug}" is not written in ${info.name}`);
      continue;
    }
    good.push({ slug: item.slug, title, summary, body });
  }
  return { ok: problems.length === 0, items: good, problems };
}

/* ---------- a run, as the page receives it ---------- */

/** @param {object} row an EtiquetteRun */
export function presentRun(row, now = new Date()) {
  const done = row.doneItems;
  const total = row.totalItems;
  const info = languageInfo(row.language);
  const perItem = done > 0 && row.activeSeconds > 0 ? row.activeSeconds / done : null;
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > etiquette.staleHeartbeatSeconds * 1000;
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
      currentSlug: row.currentSlug,
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

export { usdOf };
