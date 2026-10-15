// The pipeline itself: translate one verse into every language that still lacks it, validate
// it, save it, and only then go on to the next. Takes its Claude client and its store as
// arguments so the tests can run all of it against a stub model and a temporary folder.
//
// Where it writes: one chapter file per language beside the English one —
// json/bhagavat-gita/<lang>/ch-<n>.json — each verse carrying the four things translated
// (transliteration, wordMeanings, and Prabhupāda's translation and purport as commentaries) and
// stamped `translatedBy: 'claude'` with the run's version. A language's file may already exist
// with other translators' rows in it (hi/ does); those rows are kept.
//
// The rules this file keeps:
//   * Every usable answer is saved — an incomplete one too. What the checks find becomes warnings and a
//     correctness score of 1 to 3 on every item (3 perfect, 2 good, 1 needs a second round), so a later
//     pass can pick out the verses to redo. "Usable" means there is something to save at all: the JSON
//     parses and the translation is not empty. "Done" means one thing: the language's chapter file holds
//     a Prabhupāda translation for that verse that is current (`isCurrent`) — made under this run's
//     version, or not by Claude at all. Currency is per part (`isPartCurrent`): each part carries its own
//     stamp under `aiTranslation.parts`. The checkpoint is a summary, never the source of truth.
//   * A version is what decides whether to translate again. Asking for the version a verse was already
//     translated under asks Claude nothing; a verse Claude translated under another version is outdated
//     and is translated again — that is what bumping TRANSLATION_VERSION is for. A translator's own
//     work (a row with no `aiTranslation`) is never replaced.
//   * A run has a plan: which provider, model and effort writes each of the four parts. Parts that share
//     all three form a lane and are asked for in one request per verse; lanes run side by side and never
//     wait for each other. A request carries only its parts' instructions and source text, and what it
//     saves is only its parts: the other parts of the verse, and the rest of the file, are left as they are.
//   * An answer that leaves a whole part out (the English has a purport, the answer has none) is asked
//     again; only if every round does is it saved without it, and a part saved without content is not
//     stamped, so the next run asks for it again.
//   * The next verse does not start until the save is confirmed (the whole file reads back equal).
//   * Nothing is overwritten blind: every write carries the tag of the file it was built from and
//     fails if someone else changed it; a file that existed before this pipeline touched it, or that
//     holds another version's verses this run is about to replace, is copied to json-backup-<date>/
//     first. A verse already done is skipped, not redone.
//   * A verse that gets no usable answer after --max-rounds stops the run. It is never skipped.

import { TruncatedError, addUsage, emptyUsage, costUsd } from './claude-translate-client.js';
import { PROMPT_VERSION, answerSchema, systemPromptFor, userPrompt } from './claude-translate-prompt.js';
import { PARTS, lanesOf, normalizePlan, partHash, partsOf, unitHasPart } from './claude-translate-parts.js';
import {
  BOOK, CHAPTERS, TRANSLATOR, chapterLabel, estimateInputTokens, estimateOutputTokens, groupLanguages, loadChapter, sourceHash, unitWords,
} from './claude-translate-source.js';
import { ConflictError, checkpointKey, langChapterKey } from './claude-translate-store.js';
import { LANGUAGE_CODES } from './claude-translate-languages.js';
import { assessLanguage, validateLanguage } from './claude-translate-validate.js';

export const SCHEMA_VERSION = 2;
const HEARTBEAT_STALE_MS = 20 * 60 * 1000;

/** One language of one verse does not fit in max_tokens even on its own — nothing can be split further. */
export class TooLongError extends Error {
  constructor(verseId, lang, maxTokens) {
    super(`${verseId} ${lang}: one language alone does not fit in max_tokens=${maxTokens} — raise --max-tokens`);
    this.verseId = verseId;
  }
}

export class VerseFailedError extends Error {
  constructor(verseId, problems) {
    super(`${verseId} could not be translated and validated`);
    this.verseId = verseId;
    this.problems = problems;
  }
}

/* ---------- one verse ---------- */

// What a call that was paid for but gave nothing usable cost, for the log: the run's spend counts
// every call, not only the ones that came back whole. (A call that came back whole logs 'call'.)
const callFigures = (err) => ({
  inputTokens: (err.usage?.inputTokens ?? 0) + (err.usage?.cacheReadTokens ?? 0),
  outputTokens: err.usage?.outputTokens ?? 0,
  costUsd: err.costUsd ?? 0,
});

/**
 * Translates one unit into `langs`. Resolves with every language accepted, or throws.
 * One call asks the languages together (split only if the estimate says they will not fit) and
 * the answer is accepted as written. Only an answer with nothing to save (invalid JSON, no
 * translation text) is asked again, with the reason; so is one that leaves a whole part out (no
 * purport, no word list, no transliteration where the English has them) — and if every round does,
 * the best of them is saved with the part missing and scored 1. Everything else — a missing
 * paragraph, a short list, English left in — is kept as warnings and a lower correctness score on the
 * saved verse.
 */
export async function translateVerse({ unit, langs, ask, maxTokens, groupBudget, maxRounds, log, signal, book = BOOK, parts = PARTS }) {
  parts = partsOf(unit, parts); // only what the English has; the request names nothing else
  const accepted = {}; // lang → assessLanguage result
  const incomplete = {}; // lang → the best answer so far that left a whole part out, kept in case every try does
  const problems = {};
  const usage = emptyUsage();
  let cost = 0;
  let rounds = 0;

  async function callGroup(group) {
    if (signal?.aborted) throw new Error('aborted');
    let result;
    try {
      result = await ask({
        system: systemPromptFor(book, parts),
        user: userPrompt(unit, group, problems, book, parts),
        schema: answerSchema(group, parts),
        maxTokens,
      });
    } catch (err) {
      if (err.usage) {
        addUsage(usage, err.usage);
        cost += err.costUsd ?? 0;
        log.event('call-failed', { verseId: unit.verseId, langs: group, parts, kind: err instanceof TruncatedError ? 'truncated' : err.badJson ? 'bad-json' : 'refused', ...callFigures(err) });
      }
      if (err instanceof TruncatedError) {
        if (group.length === 1) {
          throw new TooLongError(unit.verseId, group[0], maxTokens);
        }
        log.event('split', { verseId: unit.verseId, langs: group, reason: 'max_tokens' });
        const mid = Math.ceil(group.length / 2);
        await callGroup(group.slice(0, mid));
        await callGroup(group.slice(mid));
        return;
      }
      if (err.badJson) {
        for (const l of group) problems[l] = ['the answer was not valid JSON'];
        log.event('bad-json', { verseId: unit.verseId, langs: group });
        return;
      }
      throw err;
    }

    addUsage(usage, result.usage);
    cost += result.costUsd ?? 0;
    log.event('call', {
      verseId: unit.verseId, langs: group, parts, round: rounds, inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, costUsd: result.costUsd,
    });

    const data = result.data && typeof result.data === 'object' ? result.data : {};
    for (const lang of group) {
      const check = assessLanguage(unit, data[lang], lang, parts);
      if (check.usable && check.missing.length) {
        // A part the English has came back with nothing in it: ask again. The answer is kept and saved
        // (with that part left out and scored 1) only if the last round still has no better one.
        if (!incomplete[lang] || check.missing.length <= incomplete[lang].missing.length) incomplete[lang] = check;
        problems[lang] = check.missing.map((part) => `"${part}" came back empty, but the English has it — return it in full`);
        log.event('incomplete', { verseId: unit.verseId, lang, round: rounds, missing: check.missing });
      } else if (check.usable) {
        accepted[lang] = check;
        if (check.warnings.length) log.event('warning', { verseId: unit.verseId, lang, correctness: check.correctness, warnings: check.warnings.slice(0, 8) });
        delete problems[lang];
      } else {
        problems[lang] = check.problems;
        log.event('rejected', { verseId: unit.verseId, lang, round: rounds, errors: check.problems.slice(0, 8) });
      }
    }
  }

  while (rounds < maxRounds) {
    const pending = langs.filter((l) => !accepted[l]);
    if (!pending.length) break;
    rounds++;
    const groups = rounds >= 3 ? pending.map((l) => [l]) : groupLanguages(unit, pending, groupBudget, parts);
    for (const group of groups) await callGroup(group);
  }

  for (const lang of langs) {
    if (accepted[lang] || !incomplete[lang]) continue;
    accepted[lang] = incomplete[lang]; // every round left a part out: save what there is, flagged
    if (accepted[lang].warnings.length) log.event('warning', { verseId: unit.verseId, lang, correctness: accepted[lang].correctness, warnings: accepted[lang].warnings.slice(0, 8) });
  }
  const missing = langs.filter((l) => !accepted[l]);
  if (missing.length) throw Object.assign(new VerseFailedError(unit.verseId, Object.fromEntries(missing.map((l) => [l, problems[l] || ['no answer']]))), { usage, costUsd: cost });

  const byLang = Object.fromEntries(langs.map((l) => [l, accepted[l].value]));
  const warningsByLang = Object.fromEntries(langs.map((l) => [l, accepted[l].warnings]));
  const qualityByLang = Object.fromEntries(langs.map((l) => [l, { scores: accepted[l].scores, correctness: accepted[l].correctness, note: accepted[l].note, findings: accepted[l].findings }]));
  const warnings = langs.flatMap((l) => warningsByLang[l].map((m) => `${l} ${m}`));
  return { byLang, warningsByLang, qualityByLang, warnings, usage, costUsd: cost, rounds, parts };
}


/* ---------- one verse, as it is saved ---------- */

const ownRows = (verse, lang) => (verse?.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);

/** The stamp of one part: its own under `aiTranslation.parts`, or — for a verse saved before parts were stamped — the verse's. */
const stampOf = (ai, part) => (ai.parts ? ai.parts[part] : ai);

/** Does the saved verse hold something for this part? */
function hasContent(verse, lang, part) {
  switch (part) {
    case 'translation':
    case 'purport':
      return ownRows(verse, lang).some((c) => c.type === part && typeof c.text === 'string' && c.text.trim());
    case 'transliteration':
      return typeof verse?.transliteration === 'string' && verse.transliteration.trim().length > 0;
    case 'wordMeanings':
      return Array.isArray(verse?.wordMeanings) && verse.wordMeanings.length > 0;
    default:
      return false;
  }
}

/**
 * What one language's translation of a verse looks like in its chapter file — for the `parts` this entry
 * carries (all four by default): the verse's identity, the verse in that script (`transliteration`, lines
 * joined by "\n" like the English file's), `wordMeanings`, Prabhupāda's translation and purport as commentary
 * rows, and `aiTranslation` — who made it, which version of the run, and how far it can be trusted.
 *
 * Each part has its own stamp under `aiTranslation.parts` (provider, model, effort, version, the hash of the
 * English it was made from, its score and warnings), and the rows carry their part's version and score, so a
 * row read on its own still says it was made by an AI. The verse-level fields of `aiTranslation` summarise
 * the parts (`correctness` is the lowest, `partScores` has each); `mergeEntry` recomputes them when parts
 * made by different runs sit in the same verse. A part that came back empty is left out of the entry, so
 * what the file already holds there (the Roman text in hi/) is not blanked; it is stamped with score 1, so
 * a later pass picks it out, and where the file holds nothing there it still counts as not done. `displayOrder` is set when the entry is merged.
 *
 * @param {{ scores: Record<string, number>, correctness: number, note?: string, findings?: Array<{ part: string, msg: string }> }} quality  from assessLanguage
 */
export function buildEntry(unit, t, lang, { provider = 'anthropic', model, effort, version, warnings = [], generatedAt, quality, parts = PARTS }) {
  // Only the parts asked for count, whatever else the answer holds: those the English has, or the answer has something for.
  const has = { translation: Boolean(t.translation), purport: t.purport?.length > 0, transliteration: t.transliteration?.length > 0, wordMeanings: t.wordMeanings?.length > 0 };
  const done = parts.filter((part) => unitHasPart(unit, part) || has[part]);
  const content = Object.fromEntries(PARTS.map((part) => [part, done.includes(part) && has[part]]));
  const stamped = done; // a part that came back empty is stamped too, scored 1, so it is flagged — not silently retried forever
  const row = (type, text) => ({ translatorSlug: TRANSLATOR, type, language: lang, displayOrder: 0, text, translatedBy: 'claude', version, correctness: quality.scores[type] });
  const commentaries = [];
  if (done.includes('translation') && content.translation) commentaries.push(row('translation', t.translation));
  if (content.purport) commentaries.push(row('purport', t.purport.join('\n')));

  const partStamps = Object.fromEntries(
    stamped.map((part) => [
      part,
      {
        provider, model, effort, version, promptVersion: PROMPT_VERSION, sourceHash: partHash(unit, part), generatedAt,
        correctness: quality.scores[part],
        warnings: quality.findings ? quality.findings.filter((f) => f.part === part).map((f) => f.msg) : warnings,
        ...(quality.note ? { note: quality.note } : {}),
      },
    ])
  );
  return {
    verseId: unit.verseId,
    globalVerseNumber: unit.globalVerseNumber,
    bookNumber: unit.bookNumber,
    chapterNumber: unit.chapterNumber,
    verseNumber: unit.verseNumber,
    verseNumberEnd: unit.verseNumberEnd,
    cantoNumber: unit.cantoNumber,
    ...(content.transliteration ? { transliteration: t.transliteration.join('\n') } : {}),
    ...(content.wordMeanings ? { wordMeanings: t.wordMeanings } : {}),
    commentaries,
    aiTranslation: summarise(partStamps, sourceHash(unit)),
  };
}

/** The verse-level `aiTranslation` from its parts' stamps. */
function summarise(parts, hash) {
  const names = PARTS.filter((p) => parts[p]);
  if (!names.length) return { translatedBy: 'claude', parts: {} };
  const newest = names.map((p) => parts[p]).sort((a, b) => String(b.generatedAt).localeCompare(String(a.generatedAt)))[0];
  const main = parts.translation ?? newest;
  const notes = [...new Set(names.map((p) => parts[p].note).filter(Boolean))];
  return {
    translatedBy: 'claude', version: main.version, provider: main.provider, model: main.model, effort: main.effort, promptVersion: main.promptVersion,
    sourceHash: hash, generatedAt: newest.generatedAt,
    correctness: Math.min(...names.map((p) => parts[p].correctness ?? 3)),
    partScores: Object.fromEntries(names.map((p) => [p, parts[p].correctness])),
    ...(notes.length ? { note: notes.join(' · ') } : {}),
    warnings: names.flatMap((p) => parts[p].warnings || []),
    parts: Object.fromEntries(names.map((p) => [p, parts[p]])),
  };
}

/** Per-part stamps for a verse saved before parts were stamped: its one stamp, for every part it holds. */
function legacyParts(verse, lang) {
  const ai = verse.aiTranslation;
  return Object.fromEntries(
    PARTS.filter((part) => hasContent(verse, lang, part)).map((part) => [
      part,
      { provider: ai.provider, model: ai.model, effort: ai.effort, version: ai.version, promptVersion: ai.promptVersion, generatedAt: ai.generatedAt, correctness: ai.partScores?.[part], warnings: [] },
    ])
  );
}

/** A language's chapter file before its first verse: the English file's `meta`, in this language. */
export function newFile(meta, lang) {
  const { chapterTitleEn, ...rest } = meta; // the English title of the chapter does not belong to another language
  return { meta: { ...rest, language: lang }, verses: [] };
}

/** Does this language's chapter file already hold Prabhupāda's translation of the verse, whoever made it? */
export function hasTranslation(file, verseId, lang) {
  const verse = file?.verses?.find((v) => v.verseId === verseId);
  return Boolean(verse?.commentaries?.some((c) => c.translatorSlug === TRANSLATOR && c.type === 'translation' && c.language === lang));
}

/**
 * Is one part of the verse, in this language, up to date for `version`? One an AI made under the same version
 * is. One made under another version is outdated, and a run for `version` makes it again. A verse that has
 * Prabhupāda's translation but no `aiTranslation` is a translator's own work: every part of it counts as
 * current, whatever the version, and a run never replaces it. A part the English does not have (a verse with
 * no purport) needs nothing and is current.
 */
export function isPartCurrent(file, unit, lang, part, version) {
  if (!unitHasPart(unit, part)) return true;
  const verse = file?.verses?.find((v) => v.verseId === unit.verseId);
  if (!hasTranslation(file, unit.verseId, lang)) {
    // No translation row: nothing is done yet — except that a purport lane or the like may have been first.
    if (part === 'translation' || !verse?.aiTranslation) return false;
  }
  const ai = verse.aiTranslation;
  if (!ai) return true;
  const stamp = stampOf(ai, part);
  return Boolean(stamp) && hasContent(verse, lang, part) && stamp.version === version;
}

/** The parts among `parts` that a run for `version` still has to write for this verse in this language. */
export const pendingPartsOf = (file, unit, lang, parts, version) => partsOf(unit, parts).filter((part) => !isPartCurrent(file, unit, lang, part, version));

/**
 * Is the verse's translation in this language up to date for `version`? One an AI made under the same
 * version is; one made under another version is outdated, and a run for `version` makes it again. One no AI
 * made (the verse has no `aiTranslation`) counts as current whatever the version: a translator's own text is
 * never replaced by a run. Without `unit` only the translation is looked at; with it, every part the English has.
 */
export function isCurrent(file, verseId, lang, version, unit = null) {
  if (!hasTranslation(file, verseId, lang)) return false;
  const made = file.verses.find((v) => v.verseId === verseId).aiTranslation;
  if (!made) return true;
  if (!unit) return stampOf(made, 'translation')?.version === version;
  return PARTS.every((part) => isPartCurrent(file, unit, lang, part, version));
}

/**
 * `file` with `entry` put in, as a new object (`file` itself is not changed). Other translators' rows and
 * the verse's other fields stay as they are, and so do the parts the entry does not carry: only the parts
 * named in `entry.aiTranslation.parts` are replaced, their stamps merged into the verse's, and the verse's
 * summary recomputed. An entry without `parts` (saved by an older version of this file) replaces all of
 * Prabhupāda's rows in the language. New rows go after the last displayOrder. A verse the file lacks is
 * inserted in verse order.
 */
export function mergeEntry(file, entry, lang = entry.commentaries?.[0]?.language) {
  const at = file.verses.findIndex((v) => v.verseId === entry.verseId);
  const old = at >= 0 ? file.verses[at] : null;
  const stamps = entry.aiTranslation?.parts;
  const replaced = stamps ? Object.keys(stamps) : null;
  const kept = (old?.commentaries || []).filter((c) => !(c.translatorSlug === TRANSLATOR && c.language === lang && (!replaced || replaced.includes(c.type))));
  let order = Math.max(0, ...kept.map((c) => c.displayOrder || 0));
  const commentaries = [...kept, ...entry.commentaries.map((c) => ({ ...c, displayOrder: ++order }))];
  const verse = { ...old, ...entry, commentaries };

  if (stamps) {
    const before = old?.aiTranslation ? old.aiTranslation.parts ?? legacyParts(old, lang) : {};
    verse.aiTranslation = summarise({ ...before, ...stamps }, entry.aiTranslation.sourceHash);
  }

  const verses = file.verses.slice();
  if (old) {
    verses[at] = verse;
  } else {
    const nextAt = entry.globalVerseNumber == null ? -1 : verses.findIndex((v) => v.globalVerseNumber > entry.globalVerseNumber);
    if (nextAt >= 0) verses.splice(nextAt, 0, verse);
    else verses.push(verse);
  }
  return { ...file, verses };
}

/** Re-checks a saved verse against its English source. Returns a list of problems. */
export function verifyEntry(verse, unit, lang) {
  const ai = verse?.aiTranslation;
  if (!ai) return ['not translated by this pipeline'];
  const problems = [];
  const rows = ownRows(verse, lang);
  const stamps = ai.parts ?? null;
  if (stamps) {
    if (ai.sourceHash !== sourceHash(unit)) problems.push('the English source has changed since this was translated');
    if (![1, 2, 3].includes(ai.correctness)) problems.push('no correctness score');
    for (const [part, stamp] of Object.entries(stamps)) {
      if (stamp.sourceHash && stamp.sourceHash !== partHash(unit, part) && ai.sourceHash === sourceHash(unit)) problems.push(`the English source of the ${part} has changed since it was translated`);
      if (![1, 2, 3].includes(stamp.correctness)) problems.push(`${part} has no correctness score`);
    }
    for (const r of rows) {
      const stamp = stamps[r.type];
      if (!stamp) problems.push(`${r.type} row has no stamp`);
      else {
        if (r.translatedBy !== 'claude' || r.version !== stamp.version) problems.push(`${r.type} row is not stamped claude / ${stamp.version}`);
        if (r.correctness !== stamp.correctness) problems.push(`${r.type} row's correctness does not match the verse's`);
      }
    }
  } else {
    if (ai.sourceHash !== sourceHash(unit)) problems.push('the English source has changed since this was translated');
    for (const r of rows) if (r.translatedBy !== 'claude' || r.version !== ai.version) problems.push(`${r.type} row is not stamped claude / ${ai.version}`);
    if (![1, 2, 3].includes(ai.correctness)) problems.push('no correctness score');
    for (const r of rows) if (r.correctness !== ai.partScores?.[r.type]) problems.push(`${r.type} row's correctness does not match the verse's`);
  }
  const answer = {
    translation: rows.find((r) => r.type === 'translation')?.text,
    purport: rows.find((r) => r.type === 'purport')?.text?.split('\n') ?? [],
    transliteration: verse.transliteration ? verse.transliteration.split('\n') : [],
    wordMeanings: verse.wordMeanings,
  };
  // Only the parts that have been written are checked; a part no run has reached yet is not "wrong".
  const check = validateLanguage(unit, answer, lang, stamps ? PARTS.filter((p) => stamps[p]) : PARTS);
  if (!check.ok) problems.push(...check.errors);
  return problems;
}

/* ---------- saving ---------- */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Copies the file to the backup folder before this run's first change to it, when what is there is
 * something to lose: a file this pipeline has not written yet is somebody's original (no verse of it
 * carries `aiTranslation`), and a file with verses Claude made under another version is about to have
 * some of them replaced by this one. A file holding nothing but this version's own verses is not copied
 * again. `state.backedUp` keeps it to once per file per run (the store keeps an earlier copy from the
 * same day rather than overwriting it).
 */
async function backupBeforeFirstWrite(store, key, state, version, log) {
  if (!state.file || state.backedUp) return;
  const madeByClaude = state.file.verses.filter((v) => v.aiTranslation);
  if (madeByClaude.length && madeByClaude.every((v) => v.aiTranslation.version === version)) return;
  const to = await store.backup(key);
  state.backedUp = true;
  log.event('backup', { key, to });
}

/**
 * Puts `entry` into the language's chapter file and confirms it. `state` is { file, tag, backedUp, queue } for
 * that file and is updated in place. The write is conditional on `state.tag`; when the file turns out to
 * have been changed by someone else, it is read again and the entry is merged into what is there now.
 *
 * Lanes share one `state` per file, so two lanes saving into the same chapter file are queued one behind
 * the other (`state.queue`): only the quick write waits, never the model call, and each save merges into
 * the file as the previous one left it, so neither loses the other's parts.
 */
function saveEntry(args) {
  const { state } = args;
  const turn = (state.queue || Promise.resolve()).then(() => saveNow(args));
  state.queue = turn.catch(() => {});
  return turn;
}

async function saveNow({ store, key, meta, lang, entry, state, log, retryDelayMs }) {
  let failures = 0;
  for (let attempt = 1; ; attempt++) {
    await backupBeforeFirstWrite(store, key, state, entry.aiTranslation.version, log);
    const next = mergeEntry(state.file || newFile(meta, lang), entry, lang);
    const body = JSON.stringify(next, null, 2);
    try {
      await store.write(key, body, state.tag);
      // The whole file must read back as what was sent.
      const back = await store.read(key);
      if (!back || JSON.stringify(back.json) !== JSON.stringify(next)) throw new Error(`${key} does not read back as what was saved`);
      Object.assign(state, { file: back.json, tag: back.tag });
      return { bytes: Buffer.byteLength(body), attempts: attempt };
    } catch (err) {
      if (err instanceof ConflictError) {
        if (attempt >= 5) throw new Error(`${key} keeps changing under the run — is another process writing it?`);
        log.event('save-conflict', { key, attempt });
        const now = await store.read(key);
        Object.assign(state, { file: now?.json ?? null, tag: now?.tag ?? null });
        continue;
      }
      if (/does not read back/.test(err.message)) throw err;
      if (++failures >= 4) throw new Error(`S3 save of ${key} failed: ${err.message}`);
      log.event('save-retry', { key, attempt, error: err.message });
      await sleep(retryDelayMs * failures);
    }
  }
}

/* ---------- checkpoint ---------- */

async function loadCheckpoint(store, version, book = BOOK) {
  return (await store.getJson(checkpointKey(version, book))) || {
    schemaVersion: SCHEMA_VERSION, version, book, completedVerses: 0, usage: emptyUsage(), costUsd: 0, lastCompleted: null, lastError: null,
  };
}

async function writeCheckpoint(store, cp) {
  cp.updatedAt = new Date().toISOString();
  await store.put(checkpointKey(cp.version, cp.book ?? BOOK), JSON.stringify(cp, null, 2));
}

/** Reads each language's chapter file: { lang: { file, tag, backedUp } }. A missing file is `file: null`. */
async function readChapterFiles(store, langs, n, book = BOOK) {
  const states = {};
  for (const lang of langs) {
    const found = await store.read(langChapterKey(lang, n, book));
    states[lang] = { file: found?.json ?? null, tag: found?.tag ?? null, backedUp: false };
  }
  return states;
}

/** The plan of a run: `cfg.plan` filled in, or — without one — every part with the run's provider, model and effort. */
export function planOf(cfg) {
  return normalizePlan(cfg.plan ?? null, { provider: cfg.provider || 'anthropic', model: cfg.model, effort: cfg.effort || 'off' });
}

/** Per language, the parts of `parts` still to write for this verse; languages with the same parts are grouped. → [{ parts, langs }] */
function pendingGroups(states, langs, unit, parts, version) {
  const groups = new Map();
  for (const lang of langs) {
    const need = pendingPartsOf(states[lang].file, unit, lang, parts, version);
    if (!need.length) continue;
    const key = need.join(',');
    if (!groups.has(key)) groups.set(key, { parts: need, langs: [] });
    groups.get(key).langs.push(lang);
  }
  return [...groups.values()];
}

/** Is everything the plan asks for done for this verse, in every language? */
const verseDone = (states, langs, unit, plan, version) => langs.every((l) => pendingPartsOf(states[l].file, unit, l, Object.keys(plan), version).length === 0);

/* ---------- the run ---------- */

/**
 * @param {object} p
 * @param {object} p.store      claude-translate-store
 * @param {(key: string) => Promise<object>} p.getSource  reads the English and Sanskrit chapter files
 * @param {Function} p.ask      from claude-translate-client (or a stub); used for every lane unless `askFor` is given
 * @param {(lane: object) => Function} [p.askFor]  one ask per lane (its provider, model and effort)
 * @param {object} p.cfg        { provider, model, effort, plan, version, langs, chapters, only, limit, maxSpend, maxTokens, groupBudget, maxRounds, force, retryDelayMs }
 * @param {{ say: Function, event: Function }} p.log
 * @param {AbortSignal} [p.signal]
 *
 * Each lane of the plan walks the book on its own: it asks for its parts of a verse, saves only those
 * parts, and goes on to the next verse without waiting for any other lane. When one lane fails, the others
 * finish the verse they are on (saved, so nothing is lost) and stop; the first error is thrown.
 */
export async function run({ store, getSource, ask, askFor, cfg, log, signal }) {
  const book = cfg.book || BOOK;
  const plan = planOf(cfg);
  const lanes = lanesOf(plan);
  const planParts = Object.keys(plan);
  const cp = await loadCheckpoint(store, cfg.version, book);
  if (cp.running && !cfg.force) {
    const age = Date.now() - new Date(cp.heartbeatAt || cp.updatedAt || 0).getTime();
    if (age < HEARTBEAT_STALE_MS) {
      throw new Error(`Another run looks active (checkpoint updated ${Math.round(age / 1000)}s ago by ${cp.runner || 'unknown'}). Wait, or pass --force if it is dead.`);
    }
  }
  Object.assign(cp, {
    running: true, runner: cfg.runner || `pid ${process.pid}`, provider: lanes[0].provider, model: lanes[0].model, effort: lanes[0].effort, plan, version: cfg.version, promptVersion: PROMPT_VERSION,
    langs: cfg.langs, startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(),
  });
  // Doubles as the write-permission preflight: nothing is spent on a model if the store is read-only.
  await writeCheckpoint(store, cp);

  const retryDelayMs = cfg.retryDelayMs ?? 2000;
  const session = { done: 0, skipped: 0, usage: emptyUsage(), costUsd: 0, lanes: Object.fromEntries(lanes.map((l) => [l.key, { done: 0, usage: emptyUsage(), costUsd: 0 }])) };
  let stopReason = 'finished';
  let failure = null;
  let stopping = false;
  const stop = (why) => { if (stopReason === 'finished') stopReason = why; stopping = true; };

  // One chapter's source and files, loaded once and shared by the lanes.
  const chapters = new Map();
  const chapter = (n) => {
    if (!chapters.has(n)) {
      chapters.set(n, (async () => {
        const loaded = await loadChapter(getSource, n, book);
        for (const sk of loaded.skipped) log.say(`ch ${chapterLabel(n, book)}  ${sk.verseId} skipped: ${sk.reason}`);
        return { ...loaded, states: await readChapterFiles(store, cfg.langs, n, book) };
      })());
    }
    return chapters.get(n);
  };
  let checkpointQueue = Promise.resolve();
  const saveCheckpoint = () => (checkpointQueue = checkpointQueue.then(() => writeCheckpoint(store, cp)));

  async function runLane(lane) {
    const laneAsk = askFor ? askFor(lane) : ask;
    const mine = session.lanes[lane.key];
    const tag = lanes.length > 1 ? `[${lane.provider}/${lane.model} ${lane.parts.join('+')}] ` : '';
    for (const n of cfg.chapters) {
      const { units, meta, states } = await chapter(n);
      let chapterDone = 0;
      for (const unit of units) {
        if (cfg.only && unit.verseId !== cfg.only) continue;
        const groups = pendingGroups(states, cfg.langs, unit, lane.parts, cfg.version);
        if (!groups.length) {
          chapterDone++;
          if (lane === lanes[0]) session.skipped++;
          continue;
        }
        if (stopping) return;
        if (cfg.limit && mine.done >= cfg.limit) return stop('limit');
        if (cfg.maxSpend != null && cp.costUsd >= cfg.maxSpend) return stop('max-spend');
        if (signal?.aborted) return stop('interrupted');

        for (const group of groups) {
          const started = Date.now();
          log.event('verse-start', { verseId: unit.verseId, chapter: n, langs: group.langs, parts: group.parts, lane: lane.key });
          const result = await translateVerse({ unit, langs: group.langs, ask: laneAsk, maxTokens: cfg.maxTokens, groupBudget: cfg.groupBudget, maxRounds: cfg.maxRounds, log, signal, book, parts: group.parts })
            .catch((err) => {
              if (err.usage) {
                addUsage(cp.usage, err.usage);
                cp.costUsd += err.costUsd ?? 0;
                addUsage(mine.usage, err.usage);
                mine.costUsd += err.costUsd ?? 0;
              }
              throw err;
            });
          // Spent is spent, whether or not the save below goes through.
          for (const target of [session, mine, cp]) {
            addUsage(target.usage, result.usage);
            target.costUsd += result.costUsd;
          }

          const generatedAt = new Date().toISOString();
          let bytes = 0;
          for (const lang of group.langs) {
            const entry = buildEntry(unit, result.byLang[lang], lang, {
              provider: lane.provider, model: lane.model, effort: lane.effort, version: cfg.version, warnings: result.warningsByLang[lang], generatedAt, quality: result.qualityByLang[lang], parts: group.parts,
            });
            const key = langChapterKey(lang, n, book);
            const saved = await saveEntry({ store, key, meta, lang, entry, state: states[lang], log, retryDelayMs });
            bytes += saved.bytes;
            log.event('saved', { verseId: unit.verseId, lang, key, bytes: saved.bytes, attempts: saved.attempts, parts: group.parts, lane: lane.key });
          }

          cp.completedVerses++;
          cp.lastCompleted = { verseId: unit.verseId, langs: group.langs, parts: group.parts, at: new Date().toISOString() };
          cp.lastError = null;
          cp.heartbeatAt = new Date().toISOString();
          await saveCheckpoint();

          mine.done++;
          session.done++;
          if (verseDone(states, cfg.langs, unit, plan, cfg.version) || !pendingGroups(states, cfg.langs, unit, lane.parts, cfg.version).length) chapterDone++;
          const correctness = Object.fromEntries(group.langs.map((l) => [l, result.qualityByLang[l].correctness]));
          log.event('verse', { verseId: unit.verseId, langs: group.langs, parts: group.parts, lane: lane.key, correctness, rounds: result.rounds, calls: result.usage.calls, costUsd: result.costUsd });
          log.say(
            `${tag}ch ${chapterLabel(n, book).padStart(5)}  ${unit.ref.padEnd(9)} ✓ ${group.langs.join(',')}` +
              `  ${result.usage.calls} call${result.usage.calls === 1 ? '' : 's'}${result.rounds > 1 ? `, ${result.rounds} rounds` : ''}` +
              `  in ${k(result.usage.inputTokens + result.usage.cacheReadTokens)} out ${k(result.usage.outputTokens)}` +
              `  $${result.costUsd.toFixed(2)}  score ${group.langs.map((l) => `${l} ${correctness[l]}`).join(' · ')}  wrote ${group.langs.length} file${group.langs.length === 1 ? '' : 's'} (${(bytes / 1024).toFixed(0)} KB)` +
              `  ${Math.round((Date.now() - started) / 1000)}s  [${chapterDone}/${units.length}]`
          );
          if (result.warnings.length) log.say(`        ${result.warnings.length} warning(s): ${result.warnings.slice(0, 2).join(' | ')}`);
        }
      }
    }
  }

  const settled = await Promise.allSettled(
    lanes.map((lane) =>
      runLane(lane).catch((err) => {
        failure ||= err;
        stopping = true; // the other lanes finish the verse they are on and stop
        throw err;
      })
    )
  );
  const aborted = signal?.aborted || (failure && failure.message === 'aborted');
  if (failure) {
    stopReason = aborted ? 'interrupted' : 'error';
    cp.lastError = { at: new Date().toISOString(), verseId: failure.verseId || null, message: failure.message, problems: failure.problems || null };
    cp.running = false;
    await saveCheckpoint().catch(() => {});
    if (stopReason === 'interrupted') return { ...session, stopReason };
    throw failure;
  }
  if (settled.some((r) => r.status === 'rejected')) throw settled.find((r) => r.status === 'rejected').reason;
  if (signal?.aborted && stopReason === 'finished') stopReason = 'interrupted';
  cp.running = false;
  await saveCheckpoint();
  return { ...session, stopReason };
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/* ---------- dry run & status ---------- */

/**
 * What a run for `cfg.version` would do, without calling a model or writing anything. Totals add up the
 * lanes; `lanes` has each one's own calls and tokens (so each can be priced at its own model's rate:
 * `cfg.priceFor(lane)` → `{ input, output }` $ per million tokens, else `pricePerM`). `byLang` counts the
 * verses a language has fully up to date; `outdated` counts the verse translations that were made under
 * another version and would be made again. They are part of `todo`, not extra to it.
 */
export async function dryRun({ store, getSource, cfg, pricePerM = { input: 4, output: 20 } }) {
  const book = cfg.book || BOOK;
  const plan = planOf(cfg);
  const lanes = lanesOf(plan);
  const rows = [];
  const laneTotals = lanes.map((lane) => ({ ...lane, todo: 0, calls: 0, inTokens: 0, systemTokens: 0, outTokens: 0, instructionTokens: Math.round(systemPromptFor(book, lane.parts).length / 3.6) }));
  const totals = { chapters: 0, verses: 0, done: 0, todo: 0, outdated: 0, calls: 0, words: 0, inTokens: 0, systemTokens: 0, outTokens: 0, byLang: Object.fromEntries(cfg.langs.map((l) => [l, 0])) };
  for (const n of cfg.chapters) {
    const { units } = await loadChapter(getSource, n, book);
    const states = await readChapterFiles(store, cfg.langs, n, book);
    const byLang = Object.fromEntries(cfg.langs.map((l) => [l, 0]));
    let verses = 0, todo = 0, outdated = 0, calls = 0, words = 0, inTokens = 0, outTokens = 0, systemTokens = 0;
    for (const unit of units) {
      if (cfg.only && unit.verseId !== cfg.only) continue;
      verses++;
      const planParts = Object.keys(plan);
      const open = cfg.langs.filter((l) => pendingPartsOf(states[l].file, unit, l, planParts, cfg.version).length);
      for (const l of cfg.langs) if (!open.includes(l)) byLang[l]++;
      outdated += open.filter((l) => hasTranslation(states[l].file, unit.verseId, l)).length;
      if (!open.length) continue;
      todo++;
      words += unitWords(unit);
      for (const lane of laneTotals) {
        for (const group of pendingGroups(states, cfg.langs, unit, lane.parts, cfg.version)) {
          const n2 = groupLanguages(unit, group.langs, cfg.groupBudget, group.parts).length;
          const input = n2 * estimateInputTokens(unit, group.parts);
          const output = group.langs.reduce((sum, l) => sum + estimateOutputTokens(unit, l, group.parts), 0);
          lane.todo++;
          lane.calls += n2;
          lane.inTokens += input;
          lane.outTokens += output;
          lane.systemTokens += n2 * lane.instructionTokens;
          calls += n2; inTokens += input; outTokens += output; systemTokens += n2 * lane.instructionTokens;
        }
      }
    }
    rows.push({ chapter: n, verses, done: verses - todo, todo, outdated, calls, words, inTokens, outTokens, byLang });
    Object.assign(totals, {
      chapters: totals.chapters + 1, verses: totals.verses + verses, done: totals.done + (verses - todo), todo: totals.todo + todo,
      outdated: totals.outdated + outdated, calls: totals.calls + calls, words: totals.words + words, inTokens: totals.inTokens + inTokens,
      outTokens: totals.outTokens + outTokens, systemTokens: totals.systemTokens + systemTokens,
    });
    for (const l of cfg.langs) totals.byLang[l] += byLang[l];
  }
  // At the given prices, instructions and all, with no caching and no thinking.
  const priced = laneTotals.map((lane) => {
    const price = cfg.priceFor?.(lane) ?? pricePerM;
    return { ...lane, costFloor: price ? ((lane.inTokens + lane.systemTokens) * price.input + lane.outTokens * price.output) / 1e6 : null };
  });
  const costFloor = priced.every((l) => l.costFloor != null) ? priced.reduce((sum, l) => sum + l.costFloor, 0) : null;
  return { rows, totals, costFloor, lanes: priced };
}

/**
 * Progress read from the language files: per chapter, how many verses each language has (whichever version
 * made them — the tally of versions below says which), plus a tally of the versions found
 * (`{ version: { lang: verses } }`), of the correctness scores (`{ lang: { 1, 2, 3 } }`) and the verses
 * scored 1 (`redo`), the run's checkpoint, and — with `verify` — a strict re-check of every saved verse (`bad`).
 */
export async function status({ store, getSource, cfg, verify = false }) {
  const book = cfg.book || BOOK;
  const checkpoint = await store.getJson(checkpointKey(cfg.version, book));
  const rows = [];
  const versions = {};
  const scores = Object.fromEntries(cfg.langs.map((l) => [l, { 1: 0, 2: 0, 3: 0, unscored: 0 }]));
  const redo = []; // saved with correctness 1 — the verses a second round would take
  const bad = [];
  for (const n of cfg.chapters) {
    const { units } = await loadChapter(getSource, n, book);
    const states = await readChapterFiles(store, cfg.langs, n, book);
    const byLang = Object.fromEntries(cfg.langs.map((l) => [l, 0]));
    let all = 0;
    for (const unit of units) {
      const saved = (lang) => hasTranslation(states[lang].file, unit.verseId, lang);
      if (cfg.langs.every(saved)) all++;
      for (const lang of cfg.langs) {
        if (!saved(lang)) continue;
        byLang[lang]++;
        const verse = states[lang].file.verses.find((v) => v.verseId === unit.verseId);
        const version = verse.aiTranslation?.version ?? 'unversioned';
        versions[version] ||= {};
        versions[version][lang] = (versions[version][lang] || 0) + 1;
        const score = [1, 2, 3].includes(verse.aiTranslation?.correctness) ? verse.aiTranslation.correctness : 'unscored';
        scores[lang][score]++;
        if (score === 1) redo.push({ verseId: unit.verseId, lang });
        if (verify) {
          const problems = verifyEntry(verse, unit, lang);
          if (problems.length) bad.push({ verseId: unit.verseId, lang, problems });
        }
      }
    }
    rows.push({ chapter: n, verses: units.length, done: all, byLang });
  }
  return { checkpoint, rows, versions, scores, redo, bad };
}

export { CHAPTERS, LANGUAGE_CODES, costUsd };
