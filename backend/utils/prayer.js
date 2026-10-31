// What prayers are made of, as pure functions (no I/O, so `npm test` covers them): which scripts a reader is offered and
// each verse in them, the wording of a prayer in a reader's language, what a translation run still has to do for a
// prayer (`needsOf`, the one place that decides), the prompts a run sends and the checks on its answers, and how a run
// and a prayer are sent to the admin page.
//
// Reading and writing the database, the queue and Redis is services/prayer.js; the run itself is
// jobs/processors/prayer.js. How a verse gets its script (the same one, a rule at read time, or a model) is `howText`
// in config/prayer.js.

import { CATEGORY_IDS, ORIGINAL_LANGUAGES, SCRIPT_OF, categories, howText, languages, prayer as cfg } from '../config/prayer.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';
import { fromDevanagari } from './script.js';
import { estimateTokens } from './etiquette.js';
import { usdOf } from './translation-run.js';

/** Bumped when the translation prompt or the shape of its answers changes. */
export const PROMPT_VERSION = '1';

export const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;
export const isCategory = (id) => CATEGORY_IDS.includes(id);
export const languageInfo = (code) => languages.find((l) => l.code === code) ?? null;
export const isOriginalLanguage = (code) => ORIGINAL_LANGUAGES.includes(code);

const byPosition = (a, b) => a.position - b.position || String(a.id).localeCompare(String(b.id));
const filled = (value) => typeof value === 'string' && value.trim().length > 0;

/* ---------- a prayer in a reader's language ---------- */

/**
 * The text of `field` for a reader. `row` is a prayer (or a verse) with its `translations`; walking the reader's
 * languages, the first with a non-empty value wins, and reaching English stops the walk because the plain column is
 * English. A prayer's title, summary and about, and a verse's meaning, are each worded on their own, so a prayer with
 * no summary of its own still shows the title in the reader's language.
 */
export function wording(row, chain = [DEFAULT_LANGUAGE], field = 'title') {
  for (const code of chain) {
    if (code === DEFAULT_LANGUAGE) break;
    const hit = (row.translations || []).find((t) => t.languageCode === code)?.[field];
    if (filled(hit)) return hit;
  }
  return row[field] ?? null;
}

/**
 * The scripts a reader is offered for a prayer, from `prayer.verses[].translations` (the rows of every language):
 * - first `{ code: 'original', kind: 'original', languages }`, `languages` being every code that reads the original
 *   script as it is (for a Devanagari prayer: sa, hi, mr);
 * - then each other language in config order: `{ code, kind: 'rule' }` always (the phone converts the original), and
 *   `{ code, kind: 'stored' }` only when every verse has a stored rendering in it, so a prayer never mixes scripts.
 */
export function scriptsOf(row) {
  const verses = row.verses || [];
  const from = row.originalLanguage;
  const out = [{ code: 'original', kind: 'original', languages: ORIGINAL_LANGUAGES.filter((code) => howText(from, code) === 'same') }];
  for (const l of languages) {
    const how = howText(from, l.code);
    if (how === 'same') continue;
    if (how === 'rule') {
      out.push({ code: l.code, kind: 'rule' });
      continue;
    }
    const complete = verses.length > 0 && verses.every((v) => (v.translations || []).some((t) => t.languageCode === l.code && filled(t.text)));
    if (complete) out.push({ code: l.code, kind: 'stored' });
  }
  return out;
}

/** A verse's stored renderings, `{ <code>: text }`: every non-empty one in a language whose script is not the original's. */
function renderingsOf(verse, originalLanguage) {
  const out = {};
  for (const t of verse.translations || []) {
    if (!filled(t.text) || !languageInfo(t.languageCode) || howText(originalLanguage, t.languageCode) === 'same') continue;
    out[t.languageCode] = t.text;
  }
  return out;
}

/** A published prayer as the app receives it (`chain` is the reader's languages). */
export function present(row, chain) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: wording(row, chain, 'title'),
    summary: wording(row, chain, 'summary'),
    about: wording(row, chain, 'about'),
    author: row.author ?? null,
    reference: row.reference ?? null,
    sourceName: row.sourceName ?? null,
    sourceUrl: row.sourceUrl ?? null,
    sourceLanguage: row.originalLanguage,
    scripts: scriptsOf(row),
    verses: [...(row.verses || [])].sort(byPosition).map((v) => ({
      id: v.id,
      position: v.position,
      text: v.text,
      meaning: wording(v, chain, 'meaning'),
      renderings: renderingsOf(v, row.originalLanguage),
    })),
  };
}

/** The list the app shows. Each row carries its `translations` (title, summary) and `_count.verses`. */
export function presentList(rows, chain) {
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    category: row.category,
    title: wording(row, chain, 'title'),
    summary: wording(row, chain, 'summary'),
    sourceLanguage: row.originalLanguage,
    verseCount: row._count?.verses ?? 0,
  }));
}

/* ---------- a prayer, as the admin page receives it ---------- */

/** The prayer's own fields (no verses, no translations). */
export function presentItem(row) {
  return {
    id: row.id,
    slug: row.slug,
    category: row.category,
    sortOrder: row.sortOrder,
    originalLanguage: row.originalLanguage,
    title: row.title,
    summary: row.summary ?? null,
    about: row.about ?? null,
    author: row.author ?? null,
    reference: row.reference ?? null,
    sourceName: row.sourceName ?? null,
    sourceUrl: row.sourceUrl ?? null,
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export const presentVerse = (v) => ({ id: v.id, position: v.position, text: v.text, meaning: v.meaning ?? null });

/** Whether a stored rendering is older than the verse's text (the original was changed after it was made). */
export function isStale(verse, row) {
  if (!row || !filled(row.text)) return false;
  return !row.renderedAt || new Date(row.renderedAt) < new Date(verse.textChangedAt);
}

/** For the editor's list of languages: what each one holds, from a prayer with all its translations. */
export function languageSummaries(row) {
  return languages.map((l) => {
    const header = (row.translations || []).find((t) => t.languageCode === l.code);
    let meanings = 0;
    let texts = 0;
    let stale = 0;
    let edited = header?.isEdited ? 1 : 0;
    for (const v of row.verses || []) {
      const t = (v.translations || []).find((x) => x.languageCode === l.code);
      if (!t) continue;
      if (filled(t.meaning)) meanings += 1;
      if (filled(t.text)) {
        texts += 1;
        if (isStale(v, t)) stale += 1;
      }
      if (t.isEdited) edited += 1;
    }
    return { code: l.code, how: howText(row.originalLanguage, l.code), header: filled(header?.title), headerEdited: Boolean(header?.isEdited), meanings, texts, edited, stale };
  });
}

/**
 * One language's page in the editor: the header, and each verse beside what is stored. `automatic` is what the rule
 * would make (so the admin panel needs no converter of its own) and only where `how` is 'rule'.
 */
export function editorOf(row, code) {
  const how = howText(row.originalLanguage, code);
  const header = (row.translations || []).find((t) => t.languageCode === code);
  return {
    language: code,
    how,
    header: header && code !== DEFAULT_LANGUAGE
      ? { title: header.title, summary: header.summary ?? null, about: header.about ?? null, isEdited: header.isEdited, translatedBy: header.translatedBy ?? null }
      : null,
    verses: [...(row.verses || [])].sort(byPosition).map((v) => {
      const t = (v.translations || []).find((x) => x.languageCode === code);
      return {
        verseId: v.id,
        position: v.position,
        original: v.text,
        automatic: how === 'rule' ? fromDevanagari(v.text, code) : null,
        text: t?.text ?? null,
        meaning: t?.meaning ?? null,
        isEdited: Boolean(t?.isEdited),
        translatedBy: t?.translatedBy ?? null,
        stale: isStale(v, t),
      };
    }),
  };
}

/* ---------- what a run still has to do ---------- */

/**
 * The one place that decides what is missing, out of date or protected, for one prayer in one language. The estimate,
 * the coverage counts, the run and the editor's badges all agree because they all ask this.
 *
 * `row` is a prayer with its `translations` and its `verses` (each with `translations`); rows of other languages are
 * ignored. Nothing is needed for a prayer that is not PUBLISHED or has no verse. Otherwise:
 *  - a heading (title, summary, about) is needed for any language but English when there is none; a forced run redoes
 *    it unless a person wrote it;
 *  - a rendering is needed for each verse when the script is made by a model (`howText`) and there is none, or it is
 *    older than the verse's text and no person wrote it, or the run is forced and no person wrote it;
 *  - a meaning is needed for each verse, for any language but English, when the English one is not empty and there is
 *    none (a forced run redoes it unless a person wrote it).
 * A piece a person wrote is never needed again, but a piece that is empty is, even in a row a person edited: the run
 * fills the gap and leaves the rest. `runId` is the run asking: what it has written already is not forced a second time.
 *
 * → `{ any, header: null | { summary, about }, verses: [{ verse, rendering, meaning, stale }], counts: { headers,
 *    renderings, meanings, stale } }` — `header.summary` / `about` say whether the English has one to translate;
 *    `verses` holds only those with something to do, in reading order; `stale` counts renderings due to the original
 *    having changed.
 */
export function needsOf(row, code, force = false, runId = null) {
  const counts = { headers: 0, renderings: 0, meanings: 0, stale: 0 };
  const nothing = { any: false, header: null, verses: [], counts };
  if (row.status !== 'PUBLISHED' || !(row.verses || []).length) return nothing;

  const doneNow = (t) => runId != null && t.runId === runId;
  const how = howText(row.originalLanguage, code);

  let header = null;
  if (code !== DEFAULT_LANGUAGE) {
    const have = (row.translations || []).find((t) => t.languageCode === code);
    if (!filled(have?.title) || (force && !have.isEdited && !doneNow(have))) {
      header = { summary: filled(row.summary), about: filled(row.about) };
      counts.headers = 1;
    }
  }

  const verses = [];
  for (const verse of [...row.verses].sort(byPosition)) {
    const t = (verse.translations || []).find((x) => x.languageCode === code);
    let rendering = false;
    let stale = false;
    if (how === 'model') {
      if (!filled(t?.text)) rendering = true;
      else if (!t.isEdited) {
        stale = isStale(verse, t);
        rendering = stale || (force && !doneNow(t));
      }
    }
    let meaning = false;
    if (code !== DEFAULT_LANGUAGE && filled(verse.meaning)) {
      if (!filled(t?.meaning)) meaning = true;
      else if (!t.isEdited) meaning = force && !doneNow(t);
    }
    if (!rendering && !meaning) continue;
    verses.push({ verse, rendering, meaning, stale });
    if (rendering) counts.renderings += 1;
    if (meaning) counts.meanings += 1;
    if (stale) counts.stale += 1;
  }
  return { any: Boolean(header) || verses.length > 0, header, verses, counts };
}

/**
 * How one prayer stands in one language, from the counts `needsOf` gives (or the same counts worked out in the
 * database, see services/prayer.js `coverage`) and whether anything for it is stored:
 * 'translated' (nothing to do), 'missing' (nothing stored), 'stale' (only out-of-date renderings left), 'partial'.
 */
export function stateOf(counts, stored) {
  if (counts.headers + counts.renderings + counts.meanings === 0) return 'translated';
  if (!stored) return 'missing';
  if (counts.headers === 0 && counts.meanings === 0 && counts.stale === counts.renderings) return 'stale';
  return 'partial';
}

/* ---------- the translation prompt ---------- */

/** The Roman-letter style. An owner decision: it is this one constant. */
export const ROMAN_STYLE = `Roman letters: write IAST, as the printed editions of the Gītā and the Bhāgavatam do — ā ī ū ṛ ṝ ḷ ṃ ḥ ṅ ñ ṭ ḍ ṇ ś ṣ, with long vowels, the anusvāra ṃ and the visarga ḥ marked and the words divided as in a printed stotra. Use | and || where the verse has । and ॥. Ordinary lower case, with a capital for a proper name.`;

/** The Tamil-script convention for Sanskrit. An owner decision: it is this one constant. */
export const TAMIL_CONVENTION = `Tamil letters: Tamil has no separate letters for ka / kha / ga / gha and the other groups, so write Sanskrit the way Tamil editions of stotras print it. Use the Grantha letters ஜ ஷ ஸ ஹ க்ஷ ஸ்ரீ, and put the superscript digits ² ³ ⁴ after க ச ட த ப to tell the second, third and fourth letter of a group from the first (க = ka, க² = kha, க³ = ga, க⁴ = gha). Keep to the same system through the whole prayer.`;

const STYLE = { en: ROMAN_STYLE, ta: TAMIL_CONVENTION };

const SCRIPT_NAME = {
  deva: 'Devanagari', beng: 'Bengali–Assamese', gujr: 'Gujarati', taml: 'Tamil', telu: 'Telugu',
  knda: 'Kannada', mlym: 'Malayalam', orya: 'Odia', guru: 'Gurmukhi', latn: 'Roman',
};

export const SYSTEM_PROMPT = `You prepare prayers — stotras, aartis and verses said or sung by devotees of Kṛṣṇa and Viṣṇu in India — for an app. A request names the language to write in and is one of two kinds.

kind "header": translate a prayer's title, summary and about text from English into that language. The "ask" list says which of the three to write.

kind "verses": each verse has an "ask" list.
- "rendering": the verse's "text" is written in the script named in the request. Write the SAME words in the script asked for. This is transliteration, not translation: keep every sound, every word and the word order, and do not translate, paraphrase, correct, explain, add or leave out anything. Give exactly one output line for each line of the input (a line break in "text" is a line of the verse). Keep the verse-end marks as they are: । and ॥ stay unchanged in an Indic script.
- "meaning": translate the English "meaning" into the language, faithfully and in plain, warm wording, the way a kind elder explains a prayer to the family. Add no commentary and no source.

For everything you write:
- Write in the language's own script (Roman letters when Roman letters are asked for). Leave no English word in a translation except a proper name that has no usual form in that script.
- Spell the names of deities, places and scriptures the way the language usually does. Keep devotional terms (Kṛṣṇa, prasāda, darśana, japa, ārati, Vaiṣṇava, guru) the way devotees write them in that language; do not turn them into plain words.
- Return every item you were given, once, with its "n" unchanged. A piece that was not in the "ask" list comes back as an empty string.`;

/**
 * The prompt of one request. `kind` is 'header' (`items` is `{ title, summary, about, ask }`, one prayer) or 'verses'
 * (`items` is `[{ n, text, meaning, ask }]`, `text` and `meaning` present only when asked for). `originalLanguage` names
 * the script the verses are in.
 */
export function userPrompt({ kind, code, languageName, endonym, originalLanguage, items }) {
  const head = [`Write in ${languageName} (${endonym}).`];
  if (kind === 'header') {
    return [`kind: header`, ...head, '', 'The prayer, as one JSON object:', JSON.stringify(items), '', 'Return title, summary and about; a field that is not in "ask" comes back as "".'].join('\n');
  }
  const source = SCRIPT_NAME[SCRIPT_OF[originalLanguage]];
  const lines = items.map((i) => JSON.stringify(i));
  return [
    'kind: verses',
    ...head,
    ...(source ? [`The verses are written in ${source} script.`] : []),
    ...(STYLE[code] ? [STYLE[code]] : []),
    '',
    'Verses, one JSON object per line:',
    ...lines,
    '',
    'Return every verse, with its "n" unchanged.',
  ].join('\n');
}

/** The answer to a header request (the provider clients turn it into their own structured-output form). */
export const HEADER_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'The title in the language asked for' },
    summary: { type: 'string', description: 'The summary, or an empty string if it was not asked for' },
    about: { type: 'string', description: 'The about text, or an empty string if it was not asked for' },
  },
  required: ['title', 'summary', 'about'],
  additionalProperties: false,
};

/** The answer to a verses request. `n` is the verse's place in the request, not its id. */
export const VERSES_SCHEMA = {
  type: 'object',
  properties: {
    verses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          n: { type: 'integer', description: 'The n the verse came with, unchanged' },
          rendering: { type: 'string', description: 'The verse in the script asked for, or an empty string if not asked for' },
          meaning: { type: 'string', description: 'The meaning in the language asked for, or an empty string if not asked for' },
        },
        required: ['n', 'rendering', 'meaning'],
        additionalProperties: false,
      },
    },
  },
  required: ['verses'],
  additionalProperties: false,
};

export { estimateTokens };

const LIMITS = { title: 400, summary: 800 };
const INDIC = [[0x0900, 0x0dff]];

/**
 * Share of the letters in `text` that fall in the script's ranges (`[[lo, hi], …]`). Digits, spaces and punctuation are
 * not letters; combining marks are counted with the letters they sit on.
 */
export function scriptShare(text, ranges) {
  let letters = 0;
  let inScript = 0;
  for (const ch of String(text)) {
    if (!/\p{L}|\p{M}/u.test(ch)) continue;
    letters += 1;
    const code = ch.codePointAt(0);
    if (ranges.some(([lo, hi]) => code >= lo && code <= hi)) inScript += 1;
  }
  return letters === 0 ? 0 : inScript / letters;
}

/** Whether `text` is written in the language's script (Roman: in Latin letters and almost no Indic ones). */
function inScript(text, info) {
  if (info.code === 'en') return scriptShare(text, INDIC) <= 0.05 && scriptShare(text, info.ranges) >= 0.5;
  return scriptShare(text, info.ranges) >= 0.5;
}

const lineCount = (text) => String(text).split(/\r?\n/).filter((l) => l.trim()).length;
const tidy = (text, code) => {
  const clean = String(text ?? '').replace(/\r\n?/g, '\n').split('\n').map((l) => l.trimEnd()).join('\n').trim();
  return code === 'en' ? clean.normalize('NFC') : clean;
};

/**
 * The checks on a header answer. `asked` is `{ summary, about }` as `needsOf` gives (whether the English has them);
 * the title is always asked. → `{ ok, header: { title, summary?, about? }, problems }` where `header` holds only the
 * pieces that passed.
 */
export function checkHeader(data, asked, code) {
  const info = languageInfo(code);
  const problems = [];
  const header = {};
  const title = tidy(data?.title, code);
  if (!title) problems.push('the title is empty');
  else if (title.length > LIMITS.title) problems.push('the title is too long');
  else if (info && !inScript(title, info)) problems.push(`the title is not written in ${info.name}`);
  else header.title = title;

  if (asked.summary) {
    const summary = tidy(data?.summary, code);
    if (!summary) problems.push('the summary is empty');
    else if (summary.length > LIMITS.summary) problems.push('the summary is too long');
    else if (info && !inScript(summary, info)) problems.push(`the summary is not written in ${info.name}`);
    else header.summary = summary;
  }
  if (asked.about) {
    const about = tidy(data?.about, code);
    if (!about) problems.push('the about text is empty');
    else if (info && !inScript(about, info)) problems.push(`the about text is not written in ${info.name}`);
    else header.about = about;
  }
  return { ok: problems.length === 0, header, problems };
}

/**
 * The checks on a verses answer. `asked` is `[{ n, verse, rendering, meaning }]` (`verse.text` is the original; the two
 * flags say which pieces were asked for), `code` the language. Every `n` has to come back exactly once; a rendering has
 * the original's number of lines and is written in the language's script; a meaning is written in it too.
 * → `{ ok, items: [{ n, rendering?, meaning? }], problems }` — `items` holds only the pieces that passed, so a
 * half-good answer is not wasted and only what failed is asked for again.
 */
export function checkAnswer(data, asked, code) {
  const info = languageInfo(code);
  const problems = [];
  const good = [];
  const got = new Map();
  const twice = new Set();
  for (const row of Array.isArray(data?.verses) ? data.verses : []) {
    if (!row || (typeof row.n !== 'number' && typeof row.n !== 'string')) continue;
    const n = Number(row.n);
    if (got.has(n)) twice.add(n);
    got.set(n, row);
  }

  for (const item of asked) {
    if (twice.has(item.n)) {
      problems.push(`verse ${item.n} came back more than once`);
      continue;
    }
    const row = got.get(item.n);
    if (!row) {
      problems.push(`verse ${item.n} is missing`);
      continue;
    }
    const piece = { n: item.n };
    if (item.rendering) {
      const rendering = tidy(row.rendering, code);
      if (!rendering) problems.push(`verse ${item.n}: the rendering is empty`);
      else if (lineCount(rendering) !== lineCount(item.verse.text)) problems.push(`verse ${item.n}: the rendering has ${lineCount(rendering)} lines, the verse has ${lineCount(item.verse.text)}`);
      else if (info && !inScript(rendering, info)) problems.push(`verse ${item.n}: the rendering is not written in ${info.name}`);
      else piece.rendering = rendering;
    }
    if (item.meaning) {
      const meaning = tidy(row.meaning, code);
      if (!meaning) problems.push(`verse ${item.n}: the meaning is empty`);
      else if (info && !inScript(meaning, info)) problems.push(`verse ${item.n}: the meaning is not written in ${info.name}`);
      else piece.meaning = meaning;
    }
    if (piece.rendering !== undefined || piece.meaning !== undefined) good.push(piece);
  }
  return { ok: problems.length === 0, items: good, problems };
}

/* ---------- a run, as the page receives it ---------- */

/** @param {object} row a PrayerRun */
export function presentRun(row, now = new Date()) {
  const done = row.doneItems;
  const total = row.totalItems;
  const info = languageInfo(row.language);
  const perItem = done > 0 && row.activeSeconds > 0 ? row.activeSeconds / done : null;
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > cfg.staleHeartbeatSeconds * 1000;
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
