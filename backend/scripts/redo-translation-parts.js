// Redoes chosen parts of chosen verses of the Gita translations with a model, in two steps so that
// nothing reaches the bucket before it has been read:
//
//   node scripts/redo-translation-parts.js propose --list FILE --out FILE   asks the model, writes the proposed verses to --out; the bucket is only read
//   node scripts/redo-translation-parts.js apply --proposal FILE            checks each verse is still what the proposal started from, backs up each chapter file, writes it
//
// The list (JSON) has two kinds of task:
//   "redo":    [{ "lang": "ml", "verseId": "1.2.7", "parts": ["translation", "wordMeanings", "purport"] }]
//              the named parts are translated again (the pipeline's own prompt and checks); the other parts are not touched
//   "touchUp": [{ "lang": "ta", "verseId": "1.6.47", "part": "purport", "sanskrit": ["bhajanti"], "keep": ["worship"], "fragments": ["பொர"] }]
//              English words left in a text are given their wording in the language and nothing else in the text changes
//              (scripts/lib/translation-redo.js). `sanskrit` words are put into the script by rule, `keep` words stay,
//              `fragments` are half-written words before an English word, replaced with it. `hint` is a line
//              for the model about this passage, for a gap the rules cannot word (it is shown, not obeyed blindly).
//
// "redo" works for every translated language (REDO_LANGS); "touchUp" only for the languages scripts/lib/translation-script-fix.js has
// script rules for (OWN).
//
// Run scripts/fix-translation-script.js after this: it rebuilds the Sanskrit columns by rule, which the model keeps getting wrong.

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { config as loadEnv } from 'dotenv';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(backend, '.env') });

const HELP = `Usage:
  node scripts/redo-translation-parts.js propose --list FILE --out FILE [options]
  node scripts/redo-translation-parts.js apply --proposal FILE [options]

  --list FILE        the tasks (see the top of this file)
  --out FILE         where propose writes what it would change
  --proposal FILE    what apply writes into the chapter files
  --only ml:1.2.7,ta:1.9.4   propose for these verses of the list only (comma-separated)
  --model NAME       default claude-sonnet-5-5 (Anthropic)
  --max-spend USD    stop asking when this much is spent (default 5)
  --local-store DIR  read and write a folder laid out like the bucket instead of S3
  --force            apply although the checkpoint says a run is active
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    list: { type: 'string' }, out: { type: 'string' }, proposal: { type: 'string' }, only: { type: 'string' }, model: { type: 'string' },
    'max-spend': { type: 'string' }, 'local-store': { type: 'string' }, force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});
const command = positionals[0];
if (values.help || !['propose', 'apply'].includes(command)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const { CHAPTERS, DEFAULT_GROUP_BUDGET, loadChapter } = await import('./lib/claude-translate-source.js');
const { ConflictError, checkpointKey, dirStore, langChapterKey, s3Store, versionFrom } = await import('./lib/claude-translate-store.js');
const { buildEntry, mergeEntry, translateVerse, verifyEntry } = await import('./lib/claude-translate-run.js');
const { partsOf } = await import('./lib/claude-translate-parts.js');
const { OWN, rescoreVerse, verseScore } = await import('./lib/translation-script-fix.js');
const { fillGaps, gapsFrom, englishOf, proseFields, romanSpans, sortSpans, touchUpPrompt } = await import('./lib/translation-redo.js');

/** Languages whose parts can be translated again: every language the Gita has been translated into. */
const REDO_LANGS = ['bn', 'hi', 'kn', 'ml', 'mr', 'ta', 'te'];

const version = versionFrom(process.env.TRANSLATION_VERSION);
const store = values['local-store'] ? dirStore(resolve(values['local-store'])) : await s3Store();
const getSource = values['local-store'] ? (key) => store.getJson(key) : (await import('./lib/source-s3.js')).getJson;

const clone = (x) => JSON.parse(JSON.stringify(x));
const hashOf = (verse) => createHash('sha1').update(JSON.stringify(verse)).digest('hex');
const chapterOf = (verseId) => Number(verseId.split('.')[1]);
const usd = (n) => `$${n.toFixed(2)}`;
const read = async (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));

/** Tasks grouped by chapter file → Map("lang|chapter" → { lang, chapter, byVerse: Map(verseId → { redo, touchUps }) }). */
function plan(list) {
  const groups = new Map();
  const slot = (lang, verseId, allowed, what) => {
    if (!allowed.includes(lang)) throw new Error(`${lang} ${verseId}: ${what} works for ${allowed.join(', ')} only`);
    const chapter = chapterOf(verseId);
    if (!CHAPTERS.includes(chapter)) throw new Error(`${verseId}: not a verse of the Gita`);
    const key = `${lang}|${chapter}`;
    if (!groups.has(key)) groups.set(key, { lang, chapter, byVerse: new Map() });
    const { byVerse } = groups.get(key);
    if (!byVerse.has(verseId)) byVerse.set(verseId, { redo: null, touchUps: [] });
    return byVerse.get(verseId);
  };
  for (const t of list.redo ?? []) {
    if (!Array.isArray(t.parts) || !t.parts.length) throw new Error(`${t.lang} ${t.verseId}: "parts" is empty`);
    slot(t.lang, t.verseId, REDO_LANGS, 'redo').redo = t.parts;
  }
  for (const t of list.touchUp ?? []) {
    if (!['translation', 'purport', 'wordMeanings'].includes(t.part)) throw new Error(`${t.lang} ${t.verseId}: touch up "${t.part}"? only translation, purport or wordMeanings have prose`);
    slot(t.lang, t.verseId, Object.keys(OWN), 'touch-up').touchUps.push(t);
  }
  return groups;
}

/* ---------- propose ---------- */

async function propose() {
  if (!values.list || !values.out) throw new Error('propose needs --list and --out');
  const list = await read(values.list);
  const only = values.only ? new Set(values.only.split(',').map((s) => s.trim())) : null;
  const maxSpend = Number(values['max-spend'] ?? 5);
  const model = values.model || 'claude-sonnet-5-5';
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set (backend/.env)');

  const { createAsk } = await import('./lib/translate-providers.js');
  const controller = new AbortController();
  process.on('SIGINT', () => {
    if (controller.signal.aborted) process.exit(130);
    console.log('\nStopping after the call in progress — what is proposed so far is still written. Ctrl-C again to quit now.');
    controller.abort();
  });
  const { ask } = createAsk({ provider: 'anthropic', apiKey, model, effort: 'off', signal: controller.signal, onWait: (m) => console.log(`        ${m}`) });

  const logFile = resolve(backend, '.translate-work', 'redo.log');
  mkdirSync(dirname(logFile), { recursive: true });
  const log = {
    say: (line) => console.log(line),
    event: (name, fields) => appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), event: name, ...fields })}\n`),
  };

  const items = [];
  let spent = 0;
  let stopped = null;
  console.log(`Propose — ${store.describe}  model ${model}  version ${version}  (nothing is written to the bucket)\n`);

  groups: for (const { lang, chapter, byVerse } of plan(list).values()) {
    const key = langChapterKey(lang, chapter);
    const found = await store.read(key);
    if (!found) throw new Error(`${key} does not exist`);
    const { units } = await loadChapter(getSource, chapter);
    for (const [verseId, task] of byVerse) {
      if (only && !only.has(`${lang}:${verseId}`)) continue;
      if (controller.signal.aborted) { stopped = 'interrupted'; break groups; }
      if (spent >= maxSpend) { stopped = 'max-spend'; break groups; }
      const unit = units.find((u) => u.verseId === verseId);
      const original = found.json.verses.find((v) => v.verseId === verseId);
      if (!unit || !original) throw new Error(`${lang} ${verseId}: not in ${key}`);
      const item = { lang, chapter, verseId, before: hashOf(original), redo: null, touchUps: [], costUsd: 0 };
      let verse = clone(original);
      const problemsBefore = new Set(verifyEntry(original, unit, lang));

      if (task.redo) {
        const parts = partsOf(unit, task.redo);
        const result = await translateVerse({ unit, langs: [lang], ask, maxTokens: 64000, groupBudget: DEFAULT_GROUP_BUDGET, maxRounds: 4, log, signal: controller.signal, parts });
        const entry = buildEntry(unit, result.byLang[lang], lang, {
          provider: 'anthropic', model, effort: 'off', version, warnings: result.warningsByLang[lang], generatedAt: new Date().toISOString(), quality: result.qualityByLang[lang], parts,
        });
        verse = mergeEntry({ verses: [verse] }, entry, lang).verses[0];
        item.redo = { parts, scores: Object.fromEntries(parts.map((p) => [p, result.qualityByLang[lang].scores[p] ?? null])), rounds: result.rounds, warnings: result.warningsByLang[lang].slice(0, 6) };
        item.costUsd += result.costUsd;
        spent += result.costUsd;
        console.log(`${lang} ${verseId.padEnd(8)} redo ${parts.join('+')}  scores ${JSON.stringify(item.redo.scores)}  ${usd(result.costUsd)}`);
        for (const w of item.redo.warnings) console.log(`        ${w}`);
      }

      const touchedParts = new Set();
      for (const t of task.touchUps) {
        const next = clone(verse);
        for (const field of proseFields(lang, next, t.part)) {
          const spans = romanSpans(lang, field.text, { fragments: t.fragments ?? [] });
          const { ask: gaps, converted } = sortSpans(lang, spans, { sanskrit: t.sanskrit ?? [], keep: t.keep ?? [] });
          if (!spans.length || (!gaps.length && !converted.size)) continue;
          let wording = new Map(converted);
          if (gaps.length) {
            let problems = [];
            for (let attempt = 1; ; attempt++) {
              const prompt = touchUpPrompt({ lang, part: t.part, label: field.label, english: englishOf(unit, t.part, field.label), text: field.text, spans: gaps, problems, hint: t.hint });
              let result;
              try {
                result = await ask({ system: prompt.system, user: prompt.user, schema: prompt.schema, maxTokens: 2000 });
              } catch (err) {
                if (err.costUsd) { item.costUsd += err.costUsd; spent += err.costUsd; }
                if (err.badJson && attempt < 3) { problems = ['the answer was not valid JSON']; continue; }
                throw err;
              }
              item.costUsd += result.costUsd;
              spent += result.costUsd;
              try {
                for (const [id, text] of gapsFrom(lang, result.data, gaps)) wording.set(id, text);
                break;
              } catch (err) {
                if (!err.problems || attempt >= 3) throw new Error(`${lang} ${verseId} ${field.label}: ${err.message}`);
                problems = err.problems;
                log.event('touch-up-refused', { verseId, lang, part: t.part, attempt, problems });
              }
            }
          }
          const text = fillGaps(field.text, spans, wording);
          field.set(next, text);
          touchedParts.add(t.part);
          for (const span of spans) {
            if (wording.has(span.id)) {
              item.touchUps.push({ part: t.part, field: field.label, from: span.text, to: wording.get(span.id), how: converted.has(span.id) ? 'rule' : 'model' });
              console.log(`${lang} ${verseId.padEnd(8)} ${field.label.padEnd(12)} ${span.text}  →  ${wording.get(span.id)}${converted.has(span.id) ? '   (by rule)' : ''}`);
            } else {
              console.log(`${lang} ${verseId.padEnd(8)} ${field.label.padEnd(12)} ${span.text}  kept`);
            }
          }
        }
        verse = next;
      }
      if (touchedParts.size) {
        verse = rescoreVerse(lang, original, verse, unit, [...touchedParts]);
        const mark = { at: new Date().toISOString(), model, parts: [...new Set([...(verse.aiTranslation.touchUp?.parts ?? []), ...touchedParts])] };
        verse.aiTranslation.touchUp = mark;
        console.log(`${lang} ${verseId.padEnd(8)} touch-up ${[...touchedParts].join('+')}  ${usd(item.costUsd)}`);
      }

      const introduced = verifyEntry(verse, unit, lang).filter((p) => !problemsBefore.has(p) && /stamp|correctness|source has changed/.test(p));
      if (introduced.length) throw new Error(`${lang} ${verseId}: the change would introduce: ${introduced.join('; ')}`);
      item.verse = verse;
      item.scoreBefore = verseScore(original);
      item.scoreAfter = verseScore(verse);
      items.push(item);
    }
  }

  mkdirSync(dirname(resolve(values.out)), { recursive: true });
  writeFileSync(resolve(values.out), JSON.stringify({ at: new Date().toISOString(), store: store.describe, version, model, spent, stopped, items }, null, 1));
  console.log(`\n${items.length} verse(s) proposed, ${usd(spent)} spent${stopped ? ` — stopped: ${stopped}` : ''}.\nProposal: ${resolve(values.out)}\nNothing was written to the bucket. Read it, then: node scripts/redo-translation-parts.js apply --proposal ${values.out}`);
  if (stopped) process.exitCode = 1;
}

/* ---------- apply ---------- */

async function apply() {
  if (!values.proposal) throw new Error('apply needs --proposal');
  const proposal = await read(values.proposal);
  if (proposal.stopped) throw new Error(`The proposal stopped early (${proposal.stopped}); it is not complete. Propose again.`);
  if (!values.force) {
    const cp = await store.getJson(checkpointKey(version));
    if (cp?.running) throw new Error(`The checkpoint for ${version} says a run is active. Wait for it, or pass --force if you know it was killed.`);
  }

  const files = new Map();
  for (const item of proposal.items) {
    const key = langChapterKey(item.lang, item.chapter);
    if (!files.has(key)) {
      const found = await store.read(key);
      if (!found) throw new Error(`${key} does not exist`);
      files.set(key, { key, found, items: [], verses: [...found.json.verses] });
    }
    const entry = files.get(key);
    const at = entry.verses.findIndex((v) => v.verseId === item.verseId);
    if (at < 0) throw new Error(`${item.lang} ${item.verseId} is not in ${key} any more`);
    if (hashOf(entry.verses[at]) !== item.before) throw new Error(`${item.lang} ${item.verseId} in ${key} has changed since it was proposed. Propose again.`);
    entry.verses[at] = item.verse;
    entry.items.push(item);
  }

  console.log(`APPLY — ${store.describe}  ${proposal.items.length} verse(s) in ${files.size} chapter file(s)\n`);
  for (const { key, found, items, verses } of files.values()) {
    const file = { ...found.json, verses };
    const backup = await store.backup(key);
    try {
      await store.write(key, JSON.stringify(file, null, 2), found.tag);
    } catch (err) {
      if (err instanceof ConflictError) throw new Error(`${key} was changed by someone else since it was read — nothing was written to it. Run apply again.`);
      throw err;
    }
    const back = await store.read(key);
    if (!back || JSON.stringify(back.json) !== JSON.stringify(file)) throw new Error(`${key} does not read back as what was written. The backup is ${backup}.`);
    console.log(`  wrote ${key}  (${items.map((i) => i.verseId).join(' ')})   backup: ${backup}`);
  }
  console.log('\nDone. Now run scripts/fix-translation-script.js (dry run first).');
}

try {
  await (command === 'propose' ? propose() : apply());
} catch (err) {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
}
