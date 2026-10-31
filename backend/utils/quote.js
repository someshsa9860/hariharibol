// What the quotes on the chanting page are made of, as pure functions (no I/O, so `npm test` covers them): a quote in a
// reader's language, the prompt a translation run sends and the checks on its answer, and how a run is sent to the
// admin page.
//
// Reading and writing the database, the queue and Redis is services/quote.js; the run itself is jobs/processors/quote.js.

import { quote, languages } from '../config/quote.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';
import { scriptShare } from './etiquette.js';
import { usdOf } from './translation-run.js';

export { STATUSES } from './etiquette.js';

/** Bumped when the translation prompt or the shape of its answer changes. */
export const PROMPT_VERSION = '1';

export const languageInfo = (code) => languages.find((l) => l.code === code) ?? null;

/**
 * `item` carries its `translations` (published ones are enough). Walking the reader's languages, the first with a
 * translation wins; reaching English stops the walk, since the plain column is English.
 * → `{ text, language }`
 */
export function wording(item, chain = [DEFAULT_LANGUAGE]) {
  const rows = (item.translations || []).filter((t) => t.isPublished !== false);
  for (const code of chain) {
    if (code === DEFAULT_LANGUAGE) break;
    const row = rows.find((t) => t.languageCode === code);
    if (row?.text?.trim()) return { text: row.text, language: code };
  }
  return { text: item.text, language: DEFAULT_LANGUAGE };
}

/**
 * A quote as the app receives it. The author is always sent; the app decides whether to show it
 * (`AppConfig.showQuoteAuthor`), the same way it decides about the author of the books.
 */
export function present(item, chain) {
  const w = wording(item, chain);
  return {
    id: item.id,
    slug: item.slug,
    text: w.text,
    language: w.language,
    author: item.author ?? null,
    reference: item.reference ?? null,
    sourceName: item.sourceName ?? null,
    sourceUrl: item.sourceUrl ?? null,
  };
}

/* ---------- the translation prompt ---------- */

export const SYSTEM_PROMPT = `You translate short quotations from the teachings of a Vaiṣṇava teacher for an app used by devotees of Kṛṣṇa in India. Each is one or two sentences. Translate each into the language asked for.

Rules:
- Translate faithfully and simply. Keep the speaker's meaning and tone; do not paraphrase, add, explain or leave anything out.
- Keep Sanskrit and devotional terms (Kṛṣṇa, Hare Kṛṣṇa, mahā-mantra, japa, bhakti, guru, Vaiṣṇava, prasāda) the way devotees write them in the target language and script; do not translate them into plain words.
- Write in the target language's own script. Do not leave English words except for proper names with no usual form in that script.
- Return every quote you were given, once, with the same "slug" it came with. Return the quotation only, with no quotation marks added and no source.`;

export function userPrompt({ languageName, endonym, items }) {
  const lines = items.map((i) => JSON.stringify({ slug: i.slug, text: i.text }));
  return [`Translate into ${languageName} (${endonym}).`, '', 'Quotes, one JSON object per line:', ...lines, '', 'Return every quote, with its slug unchanged.'].join('\n');
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
          slug: { type: 'string', description: 'The slug the quote came with, unchanged' },
          text: { type: 'string' },
        },
        required: ['slug', 'text'],
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
};

export const estimateTokens = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t).length, 0) / 2);

const MAX_TEXT = 2000;

/**
 * The checks on one answer. `asked` is the quotes sent (`{ slug, text }`), `code` the language.
 * → `{ ok, items: [{ slug, text }], problems: [] }` — `items` holds only those that passed, so a half-good answer is
 * not wasted.
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
    const text = String(row.text ?? '').trim();
    if (!text) {
      problems.push(`"${item.slug}" is empty`);
      continue;
    }
    if (text.length > MAX_TEXT) {
      problems.push(`"${item.slug}" is too long`);
      continue;
    }
    if (info && scriptShare(text, info.block) < 0.5) {
      problems.push(`"${item.slug}" is not written in ${info.name}`);
      continue;
    }
    good.push({ slug: item.slug, text });
  }
  return { ok: problems.length === 0, items: good, problems };
}

/* ---------- a run, as the page receives it ---------- */

/** @param {object} row a QuoteRun */
export function presentRun(row, now = new Date()) {
  const done = row.doneItems;
  const total = row.totalItems;
  const info = languageInfo(row.language);
  const perItem = done > 0 && row.activeSeconds > 0 ? row.activeSeconds / done : null;
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > quote.staleHeartbeatSeconds * 1000;
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
