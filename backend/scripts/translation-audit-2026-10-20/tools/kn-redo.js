// Redoes chosen parts of chosen Śrīmad-Bhāgavatam verses in a language with a model, in two steps so that nothing is
// written before it has been read. Adapted from scripts/redo-translation-parts.js, which is Gita-only (its verse ids,
// chapter numbers and provider); this one is for the Bhagavatam and any provider.
//
//   node kn-redo.js propose --list FILE --out FILE --local-store DIR   asks the model, writes the proposed verses to --out
//   node kn-redo.js apply --proposal FILE --local-store DIR            checks each verse is still what the proposal started from, backs up, writes
//
// DIR is laid out like the bucket (json/srimad-bhagavatam/<lang>/c<canto>-ch-<n>.json, and `en/` beside it). Without
// --local-store the real bucket is used, which the audit did NOT do: it worked on a copy and uploaded after reading.
//
// The list: { "redo": [{ "lang": "kn", "verseId": "2.1.2.3", "parts": ["translation", "purport", "wordMeanings"] }] }
// The named parts are translated again with the pipeline's own prompt and checks; the other parts of the verse are untouched.
// The verse keeps the version its stamps already carry, so it is still "current" for the run that wrote the file.

import { createHash } from 'node:crypto';
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const scripts = resolve(here, '../..');
loadEnv({ path: resolve(scripts, '../.env') });

const HELP = `Usage:
  node kn-redo.js propose --list FILE --out FILE --local-store DIR [options]
  node kn-redo.js apply --proposal FILE --local-store DIR

  --only kn:2.1.2.3,kn:2.3.8.1   propose for these verses of the list only
  --provider NAME    default openai
  --model NAME       default gpt-6-luna (openai)
  --max-spend USD    stop asking when this much is spent (default 5)
`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    list: { type: 'string' }, out: { type: 'string' }, proposal: { type: 'string' }, only: { type: 'string' }, provider: { type: 'string' }, model: { type: 'string' },
    'max-spend': { type: 'string' }, 'local-store': { type: 'string' }, help: { type: 'boolean', short: 'h' },
  },
});
const command = positionals[0];
if (values.help || !['propose', 'apply'].includes(command)) {
  console.log(HELP);
  process.exit(values.help ? 0 : 1);
}

const BOOK = 'srimad-bhagavatam';
const { BOOKS, DEFAULT_GROUP_BUDGET, loadChapter } = await import(`${scripts}/lib/claude-translate-source.js`);
const { ConflictError, dirStore, langChapterKey, s3Store, versionFrom } = await import(`${scripts}/lib/claude-translate-store.js`);
const { buildEntry, mergeEntry, translateVerse, verifyEntry } = await import(`${scripts}/lib/claude-translate-run.js`);
const { partsOf } = await import(`${scripts}/lib/claude-translate-parts.js`);
const { verseScore } = await import(`${scripts}/lib/translation-script-fix.js`);
const { createAsk, providerOf } = await import(`${scripts}/lib/translate-providers.js`);

const store = values['local-store'] ? dirStore(resolve(values['local-store'])) : await s3Store();
const getSource = values['local-store'] ? (key) => store.getJson(key) : (await import(`${scripts}/lib/source-s3.js`)).getJson;

const clone = (x) => JSON.parse(JSON.stringify(x));
const hashOf = (verse) => createHash('sha1').update(JSON.stringify(verse)).digest('hex');
const usd = (n) => `$${n.toFixed(2)}`;
const read = (path) => JSON.parse(readFileSync(resolve(path), 'utf8'));

/** `2.3.8.1` → the chapter id the pipeline uses, canto × 100 + chapter (308). */
function chapterOf(verseId) {
  const [book, canto, chapter] = verseId.split('.').map(Number);
  const id = canto * 100 + chapter;
  if (book !== BOOKS[BOOK].bookNumber || !BOOKS[BOOK].chapters.includes(id)) throw new Error(`${verseId}: not a verse of the Bhagavatam`);
  return id;
}

/** Tasks grouped by chapter file → Map("lang|chapter" → { lang, chapter, byVerse: Map(verseId → parts) }). */
function plan(list) {
  const groups = new Map();
  for (const t of list.redo ?? []) {
    if (!Array.isArray(t.parts) || !t.parts.length) throw new Error(`${t.lang} ${t.verseId}: "parts" is empty`);
    const chapter = chapterOf(t.verseId);
    const key = `${t.lang}|${chapter}`;
    if (!groups.has(key)) groups.set(key, { lang: t.lang, chapter, byVerse: new Map() });
    groups.get(key).byVerse.set(t.verseId, t.parts);
  }
  return groups;
}

async function propose() {
  if (!values.list || !values.out) throw new Error('propose needs --list and --out');
  const list = read(values.list);
  const only = values.only ? new Set(values.only.split(',').map((s) => s.trim())) : null;
  const maxSpend = Number(values['max-spend'] ?? 5);
  const provider = values.provider || 'openai';
  const info = providerOf(provider);
  const model = values.model || info.defaultModel;
  const apiKey = process.env[info.keyEnv];
  if (!apiKey) throw new Error(`${info.keyEnv} is not set (backend/.env)`);

  const controller = new AbortController();
  process.on('SIGINT', () => {
    if (controller.signal.aborted) process.exit(130);
    console.log('\nStopping after the call in progress — what is proposed so far is still written. Ctrl-C again to quit now.');
    controller.abort();
  });
  // effort 'off' is how the original run was made (no thinking), so the redone parts are comparable with the rest.
  const { ask } = createAsk({ provider, apiKey, model, effort: 'off', signal: controller.signal, onWait: (m) => console.log(`        ${m}`) });

  const logFile = resolve(scripts, '../.translate-work', 'kn-redo.log');
  mkdirSync(dirname(logFile), { recursive: true });
  const log = {
    say: (line) => console.log(line),
    event: (name, fields) => appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), event: name, ...fields })}\n`),
  };

  const items = [];
  let spent = 0;
  let stopped = null;
  console.log(`Propose — ${store.describe}  ${provider} ${model}  (nothing is written to the store)\n`);

  groups: for (const { lang, chapter, byVerse } of plan(list).values()) {
    const key = langChapterKey(lang, chapter, BOOK);
    const found = await store.read(key);
    if (!found) throw new Error(`${key} does not exist`);
    const { units } = await loadChapter(getSource, chapter, BOOK);
    for (const [verseId, redoParts] of byVerse) {
      if (only && !only.has(`${lang}:${verseId}`)) continue;
      if (controller.signal.aborted) { stopped = 'interrupted'; break groups; }
      if (spent >= maxSpend) { stopped = 'max-spend'; break groups; }
      const unit = units.find((u) => u.verseId === verseId);
      const original = found.json.verses.find((v) => v.verseId === verseId);
      if (!unit || !original) throw new Error(`${lang} ${verseId}: not in ${key}`);
      const version = original.aiTranslation?.version || versionFrom(process.env.TRANSLATION_VERSION);
      const problemsBefore = new Set(verifyEntry(original, unit, lang));
      const parts = partsOf(unit, redoParts);
      const result = await translateVerse({ unit, langs: [lang], ask, maxTokens: 64000, groupBudget: DEFAULT_GROUP_BUDGET, maxRounds: 4, log, signal: controller.signal, book: BOOK, parts });
      const entry = buildEntry(unit, result.byLang[lang], lang, {
        provider, model, effort: 'off', version, warnings: result.warningsByLang[lang], generatedAt: new Date().toISOString(), quality: result.qualityByLang[lang], parts,
      });
      const verse = mergeEntry({ verses: [clone(original)] }, entry, lang).verses[0];
      const scores = Object.fromEntries(parts.map((p) => [p, result.qualityByLang[lang].scores[p] ?? null]));
      spent += result.costUsd;
      console.log(`${lang} ${verseId.padEnd(10)} redo ${parts.join('+')}  scores ${JSON.stringify(scores)}  rounds ${result.rounds}  ${usd(result.costUsd)}`);
      for (const w of result.warningsByLang[lang].slice(0, 6)) console.log(`        ${w}`);

      const introduced = verifyEntry(verse, unit, lang).filter((p) => !problemsBefore.has(p) && /stamp|correctness|source has changed/.test(p));
      if (introduced.length) throw new Error(`${lang} ${verseId}: the change would introduce: ${introduced.join('; ')}`);
      items.push({
        lang, chapter, verseId, before: hashOf(original), redo: { parts, scores, rounds: result.rounds, warnings: result.warningsByLang[lang].slice(0, 6) },
        costUsd: result.costUsd, scoreBefore: verseScore(original), scoreAfter: verseScore(verse), verse,
      });
    }
  }

  mkdirSync(dirname(resolve(values.out)), { recursive: true });
  writeFileSync(resolve(values.out), JSON.stringify({ at: new Date().toISOString(), store: store.describe, provider, model, spent, stopped, items }, null, 1));
  console.log(`\n${items.length} verse(s) proposed, ${usd(spent)} spent${stopped ? ` — stopped: ${stopped}` : ''}.\nProposal: ${resolve(values.out)}\nNothing was written to the store. Read it, then: node kn-redo.js apply --proposal ${values.out}${values['local-store'] ? ` --local-store ${values['local-store']}` : ''}`);
  if (stopped) process.exitCode = 1;
}

async function apply() {
  if (!values.proposal) throw new Error('apply needs --proposal');
  const proposal = read(values.proposal);
  if (proposal.stopped) throw new Error(`The proposal stopped early (${proposal.stopped}); it is not complete. Propose again.`);

  const files = new Map();
  for (const item of proposal.items) {
    const key = langChapterKey(item.lang, item.chapter, BOOK);
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
}

try {
  await (command === 'propose' ? propose() : apply());
} catch (err) {
  console.error(`\n${err.message}`);
  process.exitCode = 1;
}
