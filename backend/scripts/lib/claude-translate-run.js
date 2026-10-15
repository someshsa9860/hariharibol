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
//     version, or not by Claude at all. The checkpoint is a summary, never the source of truth.
//   * A version is what decides whether to translate again. Asking for the version a verse was already
//     translated under asks Claude nothing; a verse Claude translated under another version is outdated
//     and is translated again — that is what bumping TRANSLATION_VERSION is for. A translator's own
//     work (a row with no `aiTranslation`) is never replaced.
//   * All four items are asked for every time. An answer that leaves a whole one out (the English has a
//     purport, the answer has none) is asked again; only if every round does is it saved without it.
//   * The next verse does not start until the save is confirmed (the whole file reads back equal).
//   * Nothing is overwritten blind: every write carries the tag of the file it was built from and
//     fails if someone else changed it; a file that existed before this pipeline touched it, or that
//     holds another version's verses this run is about to replace, is copied to json-backup-<date>/
//     first. A verse already done is skipped, not redone.
//   * A verse that gets no usable answer after --max-rounds stops the run. It is never skipped.

import { TruncatedError, addUsage, emptyUsage, costUsd } from './claude-translate-client.js';
import { PROMPT_VERSION, SYSTEM_PROMPT, answerSchema, userPrompt } from './claude-translate-prompt.js';
import {
  CHAPTERS, TRANSLATOR, estimateInputTokens, estimateOutputTokens, groupLanguages, loadChapter, sourceHash, unitWords,
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
export async function translateVerse({ unit, langs, ask, maxTokens, groupBudget, maxRounds, log, signal }) {
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
        system: SYSTEM_PROMPT,
        user: userPrompt(unit, group, problems),
        schema: answerSchema(group),
        maxTokens,
      });
    } catch (err) {
      if (err.usage) {
        addUsage(usage, err.usage);
        cost += err.costUsd ?? 0;
        log.event('call-failed', { verseId: unit.verseId, langs: group, kind: err instanceof TruncatedError ? 'truncated' : err.badJson ? 'bad-json' : 'refused', ...callFigures(err) });
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
      verseId: unit.verseId, langs: group, round: rounds, inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens, cacheReadTokens: result.usage.cacheReadTokens, costUsd: result.costUsd,
    });

    const data = result.data && typeof result.data === 'object' ? result.data : {};
    for (const lang of group) {
      const check = assessLanguage(unit, data[lang], lang);
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
    const groups = rounds >= 3 ? pending.map((l) => [l]) : groupLanguages(unit, pending, groupBudget);
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
  const qualityByLang = Object.fromEntries(langs.map((l) => [l, { scores: accepted[l].scores, correctness: accepted[l].correctness, note: accepted[l].note }]));
  const warnings = langs.flatMap((l) => warningsByLang[l].map((m) => `${l} ${m}`));
  return { byLang, warningsByLang, qualityByLang, warnings, usage, costUsd: cost, rounds };
}


/* ---------- one verse, as it is saved ---------- */

/**
 * What one language's translation of a verse looks like in its chapter file: the verse's identity,
 * the verse in that script (`transliteration`, lines joined by "\n" like the English file's),
 * `wordMeanings`, Prabhupāda's translation and purport as commentary rows, and `aiTranslation` — who
 * made it, which version of the run, and how far it can be trusted. Every row carries the same stamp
 * and its own correctness (1 to 3), so a row read on its own still says it was translated by Claude.
 * `aiTranslation.correctness` is the lowest of the parts, `partScores` has each. A part that came back
 * empty is left out, so what the file already holds there (the Roman text in hi/) is not blanked.
 * `displayOrder` is set when the entry is merged.
 *
 * @param {{ scores: Record<string, number>, correctness: number, note?: string }} quality  from assessLanguage
 */
export function buildEntry(unit, t, lang, { model, effort, version, warnings = [], generatedAt, quality }) {
  const stamp = { translatedBy: 'claude', version };
  const row = (type, text) => ({ translatorSlug: TRANSLATOR, type, language: lang, displayOrder: 0, text, ...stamp, correctness: quality.scores[type] });
  const commentaries = [row('translation', t.translation)];
  if (t.purport.length) commentaries.push(row('purport', t.purport.join('\n')));
  return {
    verseId: unit.verseId,
    globalVerseNumber: unit.globalVerseNumber,
    bookNumber: unit.bookNumber,
    chapterNumber: unit.chapterNumber,
    verseNumber: unit.verseNumber,
    verseNumberEnd: unit.verseNumberEnd,
    cantoNumber: unit.cantoNumber,
    ...(t.transliteration?.length ? { transliteration: t.transliteration.join('\n') } : {}),
    ...(t.wordMeanings?.length ? { wordMeanings: t.wordMeanings } : {}),
    commentaries,
    aiTranslation: {
      ...stamp, model, effort, promptVersion: PROMPT_VERSION, sourceHash: sourceHash(unit), generatedAt,
      correctness: quality.correctness, partScores: quality.scores, ...(quality.note ? { note: quality.note } : {}), warnings,
    },
  };
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
 * Is the verse's translation in this language up to date for `version`? One that Claude made under the
 * same version is; one Claude made under another version is outdated, and a run for `version` makes it
 * again. One Claude did not make (the verse has no `aiTranslation`) counts as current whatever the
 * version: a translator's own text is never replaced by a run.
 */
export function isCurrent(file, verseId, lang, version) {
  if (!hasTranslation(file, verseId, lang)) return false;
  const made = file.verses.find((v) => v.verseId === verseId).aiTranslation;
  return !made || made.version === version;
}

/**
 * `file` with `entry` put in, as a new object (`file` itself is not changed). Other translators' rows
 * and the verse's other fields stay as they are; only Prabhupāda's rows in this language are
 * replaced, and the new ones go after the last displayOrder. A verse the file lacks is inserted in
 * verse order.
 */
export function mergeEntry(file, entry) {
  const lang = entry.commentaries[0].language;
  const at = file.verses.findIndex((v) => v.verseId === entry.verseId);
  const old = at >= 0 ? file.verses[at] : null;
  const kept = (old?.commentaries || []).filter((c) => !(c.translatorSlug === TRANSLATOR && c.language === lang));
  let order = Math.max(0, ...kept.map((c) => c.displayOrder || 0));
  const commentaries = [...kept, ...entry.commentaries.map((c) => ({ ...c, displayOrder: ++order }))];
  const verse = { ...old, ...entry, commentaries };

  const verses = file.verses.slice();
  if (old) {
    verses[at] = verse;
  } else {
    const before = entry.globalVerseNumber == null ? -1 : verses.findIndex((v) => v.globalVerseNumber > entry.globalVerseNumber);
    if (before >= 0) verses.splice(before, 0, verse);
    else verses.push(verse);
  }
  return { ...file, verses };
}

/** Re-checks a saved verse against its English source. Returns a list of problems. */
export function verifyEntry(verse, unit, lang) {
  const ai = verse?.aiTranslation;
  if (!ai) return ['not translated by this pipeline'];
  const problems = [];
  if (ai.sourceHash !== sourceHash(unit)) problems.push('the English source has changed since this was translated');
  const rows = (verse.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);
  for (const r of rows) if (r.translatedBy !== 'claude' || r.version !== ai.version) problems.push(`${r.type} row is not stamped claude / ${ai.version}`);
  if (![1, 2, 3].includes(ai.correctness)) problems.push('no correctness score');
  for (const r of rows) if (r.correctness !== ai.partScores?.[r.type]) problems.push(`${r.type} row's correctness does not match the verse's`);
  const answer = {
    translation: rows.find((r) => r.type === 'translation')?.text,
    purport: rows.find((r) => r.type === 'purport')?.text?.split('\n') ?? [],
    transliteration: verse.transliteration ? verse.transliteration.split('\n') : [],
    wordMeanings: verse.wordMeanings,
  };
  const check = validateLanguage(unit, answer, lang);
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
 * Puts `entry` into the language's chapter file and confirms it. `state` is { file, tag, backedUp } for
 * that file and is updated in place. The write is conditional on `state.tag`; when the file turns out
 * to have been changed by someone else, it is read again and the entry is merged into what is there now.
 */
async function saveEntry({ store, key, meta, lang, entry, state, log, retryDelayMs }) {
  let failures = 0;
  for (let attempt = 1; ; attempt++) {
    await backupBeforeFirstWrite(store, key, state, entry.aiTranslation.version, log);
    const next = mergeEntry(state.file || newFile(meta, lang), entry);
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

async function loadCheckpoint(store, version) {
  return (await store.getJson(checkpointKey(version))) || {
    schemaVersion: SCHEMA_VERSION, version, completedVerses: 0, usage: emptyUsage(), costUsd: 0, lastCompleted: null, lastError: null,
  };
}

async function writeCheckpoint(store, cp) {
  cp.updatedAt = new Date().toISOString();
  await store.put(checkpointKey(cp.version), JSON.stringify(cp, null, 2));
}

/** Reads each language's chapter file: { lang: { file, tag, backedUp } }. A missing file is `file: null`. */
async function readChapterFiles(store, langs, n) {
  const states = {};
  for (const lang of langs) {
    const found = await store.read(langChapterKey(lang, n));
    states[lang] = { file: found?.json ?? null, tag: found?.tag ?? null, backedUp: false };
  }
  return states;
}

/** The languages a run for `version` still has to translate for this verse: missing, or made under another version. */
const pendingLangs = (states, langs, verseId, version) => langs.filter((l) => !isCurrent(states[l].file, verseId, l, version));

/* ---------- the run ---------- */

/**
 * @param {object} p
 * @param {object} p.store      claude-translate-store
 * @param {(key: string) => Promise<object>} p.getSource  reads the English and Sanskrit chapter files
 * @param {Function} p.ask      from claude-translate-client (or a stub)
 * @param {object} p.cfg        { model, effort, version, langs, chapters, only, limit, maxSpend, maxTokens, groupBudget, maxRounds, force, retryDelayMs }
 * @param {{ say: Function, event: Function }} p.log
 * @param {AbortSignal} [p.signal]
 */
export async function run({ store, getSource, ask, cfg, log, signal }) {
  const cp = await loadCheckpoint(store, cfg.version);
  if (cp.running && !cfg.force) {
    const age = Date.now() - new Date(cp.heartbeatAt || cp.updatedAt || 0).getTime();
    if (age < HEARTBEAT_STALE_MS) {
      throw new Error(`Another run looks active (checkpoint updated ${Math.round(age / 1000)}s ago by ${cp.runner || 'unknown'}). Wait, or pass --force if it is dead.`);
    }
  }
  Object.assign(cp, {
    running: true, runner: cfg.runner || `pid ${process.pid}`, model: cfg.model, effort: cfg.effort, version: cfg.version, promptVersion: PROMPT_VERSION,
    langs: cfg.langs, startedAt: new Date().toISOString(), heartbeatAt: new Date().toISOString(),
  });
  // Doubles as the write-permission preflight: nothing is spent on Claude if the store is read-only.
  await writeCheckpoint(store, cp);

  const retryDelayMs = cfg.retryDelayMs ?? 2000;
  const session = { done: 0, skipped: 0, usage: emptyUsage(), costUsd: 0 };
  let stopReason = 'finished';
  try {
    outer: for (const n of cfg.chapters) {
      const { units, skipped, meta } = await loadChapter(getSource, n);
      for (const s of skipped) log.say(`ch ${n}  ${s.verseId} skipped: ${s.reason}`);
      const states = await readChapterFiles(store, cfg.langs, n);
      let chapterDone = 0;

      for (const unit of units) {
        if (cfg.only && unit.verseId !== cfg.only) continue;
        const pending = pendingLangs(states, cfg.langs, unit.verseId, cfg.version);
        if (!pending.length) {
          chapterDone++;
          session.skipped++;
          continue;
        }
        if (cfg.limit && session.done >= cfg.limit) { stopReason = 'limit'; break outer; }
        if (cfg.maxSpend != null && cp.costUsd >= cfg.maxSpend) { stopReason = 'max-spend'; break outer; }
        if (signal?.aborted) { stopReason = 'interrupted'; break outer; }

        const started = Date.now();
        log.event('verse-start', { verseId: unit.verseId, chapter: n, langs: pending });
        const result = await translateVerse({ unit, langs: pending, ask, maxTokens: cfg.maxTokens, groupBudget: cfg.groupBudget, maxRounds: cfg.maxRounds, log, signal })
          .catch((err) => {
            if (err.usage) {
              addUsage(cp.usage, err.usage);
              cp.costUsd += err.costUsd ?? 0;
            }
            throw err;
          });
        // Spent is spent, whether or not the save below goes through.
        addUsage(session.usage, result.usage);
        addUsage(cp.usage, result.usage);
        session.costUsd += result.costUsd;
        cp.costUsd += result.costUsd;

        const generatedAt = new Date().toISOString();
        let bytes = 0;
        for (const lang of pending) {
          const entry = buildEntry(unit, result.byLang[lang], lang, {
            model: cfg.model, effort: cfg.effort, version: cfg.version, warnings: result.warningsByLang[lang], generatedAt, quality: result.qualityByLang[lang],
          });
          const key = langChapterKey(lang, n);
          const saved = await saveEntry({ store, key, meta, lang, entry, state: states[lang], log, retryDelayMs });
          bytes += saved.bytes;
          log.event('saved', { verseId: unit.verseId, lang, key, bytes: saved.bytes, attempts: saved.attempts });
        }

        cp.completedVerses++;
        cp.lastCompleted = { verseId: unit.verseId, langs: pending, at: new Date().toISOString() };
        cp.lastError = null;
        cp.heartbeatAt = new Date().toISOString();
        await writeCheckpoint(store, cp);

        session.done++;
        if (!pendingLangs(states, cfg.langs, unit.verseId, cfg.version).length) chapterDone++;
        const correctness = Object.fromEntries(pending.map((l) => [l, result.qualityByLang[l].correctness]));
        log.event('verse', { verseId: unit.verseId, langs: pending, correctness, rounds: result.rounds, calls: result.usage.calls, costUsd: result.costUsd });
        log.say(
          `ch ${String(n).padStart(2)}  ${unit.ref.padEnd(7)} ✓ ${pending.join(',')}` +
            `  ${result.usage.calls} call${result.usage.calls === 1 ? '' : 's'}${result.rounds > 1 ? `, ${result.rounds} rounds` : ''}` +
            `  in ${k(result.usage.inputTokens + result.usage.cacheReadTokens)} out ${k(result.usage.outputTokens)}` +
            `  $${result.costUsd.toFixed(2)}  score ${pending.map((l) => `${l} ${correctness[l]}`).join(' · ')}  wrote ${pending.length} file${pending.length === 1 ? '' : 's'} (${(bytes / 1024).toFixed(0)} KB)` +
            `  ${Math.round((Date.now() - started) / 1000)}s  [${chapterDone}/${units.length}]`
        );
        if (result.warnings.length) log.say(`        ${result.warnings.length} warning(s): ${result.warnings.slice(0, 2).join(' | ')}`);
      }
    }
  } catch (err) {
    stopReason = err.message === 'aborted' || signal?.aborted ? 'interrupted' : 'error';
    cp.lastError = { at: new Date().toISOString(), verseId: err.verseId || null, message: err.message, problems: err.problems || null };
    cp.running = false;
    await writeCheckpoint(store, cp).catch(() => {});
    if (stopReason === 'interrupted') return { ...session, stopReason };
    throw err;
  }
  cp.running = false;
  await writeCheckpoint(store, cp);
  return { ...session, stopReason };
}

const k = (n) => (n >= 1000 ? `${(n / 1000).toFixed(1)}k` : String(n));

/* ---------- dry run & status ---------- */

/**
 * What a run for `cfg.version` would do, without calling Claude or writing anything. `byLang` counts the
 * verses a language has up to date (nothing to do for them); `outdated` counts the verse translations —
 * a verse in a language — that Claude made under another version and the run would make again. They are
 * part of `todo`, not extra to it.
 */
export async function dryRun({ store, getSource, cfg, pricePerM = { input: 4, output: 20 } }) {
  const rows = [];
  const instructionTokens = Math.round(SYSTEM_PROMPT.length / 3.6); // what every call carries besides the verse; a guess
  const totals = { chapters: 0, verses: 0, done: 0, todo: 0, outdated: 0, calls: 0, words: 0, inTokens: 0, systemTokens: 0, outTokens: 0, byLang: Object.fromEntries(cfg.langs.map((l) => [l, 0])) };
  for (const n of cfg.chapters) {
    const { units } = await loadChapter(getSource, n);
    const states = await readChapterFiles(store, cfg.langs, n);
    const byLang = Object.fromEntries(cfg.langs.map((l) => [l, 0]));
    let verses = 0, todo = 0, outdated = 0, calls = 0, words = 0, inTokens = 0, outTokens = 0;
    for (const unit of units) {
      if (cfg.only && unit.verseId !== cfg.only) continue;
      verses++;
      const pending = pendingLangs(states, cfg.langs, unit.verseId, cfg.version);
      for (const l of cfg.langs) if (!pending.includes(l)) byLang[l]++;
      outdated += pending.filter((l) => hasTranslation(states[l].file, unit.verseId, l)).length;
      if (!pending.length) continue;
      todo++;
      const groups = groupLanguages(unit, pending, cfg.groupBudget);
      calls += groups.length;
      words += unitWords(unit);
      inTokens += groups.length * estimateInputTokens(unit);
      outTokens += pending.reduce((sum, l) => sum + estimateOutputTokens(unit, l), 0);
    }
    rows.push({ chapter: n, verses, done: verses - todo, todo, outdated, calls, words, inTokens, outTokens, byLang });
    Object.assign(totals, {
      chapters: totals.chapters + 1, verses: totals.verses + verses, done: totals.done + (verses - todo), todo: totals.todo + todo,
      outdated: totals.outdated + outdated, calls: totals.calls + calls, words: totals.words + words, inTokens: totals.inTokens + inTokens,
      outTokens: totals.outTokens + outTokens, systemTokens: totals.systemTokens + calls * instructionTokens,
    });
    for (const l of cfg.langs) totals.byLang[l] += byLang[l];
  }
  // At the given prices, instructions and all, with no caching and no thinking.
  const costFloor = ((totals.inTokens + totals.systemTokens) * pricePerM.input + totals.outTokens * pricePerM.output) / 1e6;
  return { rows, totals, costFloor };
}

/**
 * Progress read from the language files: per chapter, how many verses each language has (whichever version
 * made them — the tally of versions below says which), plus a tally of the versions found
 * (`{ version: { lang: verses } }`), of the correctness scores (`{ lang: { 1, 2, 3 } }`) and the verses
 * scored 1 (`redo`), the run's checkpoint, and — with `verify` — a strict re-check of every saved verse (`bad`).
 */
export async function status({ store, getSource, cfg, verify = false }) {
  const checkpoint = await store.getJson(checkpointKey(cfg.version));
  const rows = [];
  const versions = {};
  const scores = Object.fromEntries(cfg.langs.map((l) => [l, { 1: 0, 2: 0, 3: 0, unscored: 0 }]));
  const redo = []; // saved with correctness 1 — the verses a second round would take
  const bad = [];
  for (const n of cfg.chapters) {
    const { units } = await loadChapter(getSource, n);
    const states = await readChapterFiles(store, cfg.langs, n);
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
