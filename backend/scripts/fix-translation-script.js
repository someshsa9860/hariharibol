// Repairs the script of the Malayalam and Tamil Gita translations without an AI: the Sanskrit lines (the
// transliteration and the Sanskrit word of each word meaning) are rebuilt from the English IAST wherever the saved
// text has a script flaw — Devanagari or Kannada letters, a colon for a visarga, superscript digits — and Sanskrit
// quoted inside prose is converted. Wrong-language prose and English words left in Roman letters are NOT touched:
// they are listed, and need a translation (`translate-claude.js`). The rules are scripts/lib/translation-script-fix.js.
//
//   node scripts/fix-translation-script.js --langs ml,ta                 dry run: what would change, and the scores before / after; writes nothing
//   node scripts/fix-translation-script.js --langs ml --apply            back up each chapter file, then write it (conditionally) and read it back
//
// Every repaired part is re-scored by the validator and stamped `scriptFix`; the model's own rating of a transliteration
// that was rebuilt is dropped (it described text that is gone). Nothing else in a verse changes, and the translation
// version is left alone, so a later translation run still treats the verse as current.

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { config as loadEnv } from 'dotenv';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(backend, '.env') });

const HELP = `Usage: node scripts/fix-translation-script.js [options]

  --langs ml,ta        languages (default: ml,ta)
  --chapters 1,2       chapters (default: all 18)
  --verse 1.2.47       one verse only
  --apply              write the repaired chapter files (default: a dry run that writes nothing)
  --report FILE        write every change and leftover, verse by verse, to FILE (JSON)
  --keep-rating        keep the model's own rating of a rebuilt transliteration (to compare with the audit's dry run)
  --local-store DIR    read and write a folder laid out like the bucket (en/, sa/ and <lang>/ in it) instead of S3
  --force              apply although the checkpoint says a run is active
`;

const { values } = parseArgs({
  options: {
    langs: { type: 'string' }, chapters: { type: 'string' }, verse: { type: 'string' }, apply: { type: 'boolean' }, report: { type: 'string' },
    'keep-rating': { type: 'boolean' }, 'local-store': { type: 'string' }, force: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});
if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const { CHAPTERS, loadChapter } = await import('./lib/claude-translate-source.js');
const { ConflictError, checkpointKey, dirStore, langChapterKey, s3Store, versionFrom } = await import('./lib/claude-translate-store.js');
const { verifyEntry } = await import('./lib/claude-translate-run.js');
const { OWN, fixVerse, rescoreVerse, sanskritFlaw, verseScore } = await import('./lib/translation-script-fix.js');

const langs = (values.langs || 'ml,ta').split(',').map((s) => s.trim()).filter(Boolean);
for (const l of langs) if (!OWN[l]) throw new Error(`--langs: "${l}" is not handled here — this repairs ${Object.keys(OWN).join(', ')}`);
const chapters = values.chapters ? values.chapters.split(',').map(Number) : CHAPTERS;
for (const n of chapters) if (!CHAPTERS.includes(n)) throw new Error(`--chapters: ${n} is not a chapter of the Gita`);
const version = versionFrom(process.env.TRANSLATION_VERSION);

const store = values['local-store'] ? dirStore(resolve(values['local-store'])) : await s3Store();
const getSource = values['local-store'] ? (key) => store.getJson(key) : (await import('./lib/source-s3.js')).getJson;

const pad = (v, w) => String(v).padStart(w);
const count = (map, key, by = 1) => {
  map[key] = (map[key] || 0) + by;
};
const histogram = (verses) => {
  const h = { 1: 0, 2: 0, 3: 0 };
  for (const v of verses) h[verseScore(v)]++;
  return h;
};
const partHistogram = (verses) => {
  const out = {};
  for (const v of verses) {
    const ai = v.aiTranslation || {};
    const scores = ai.parts ? Object.fromEntries(Object.entries(ai.parts).map(([p, s]) => [p, s.correctness])) : ai.partScores || {};
    for (const [p, s] of Object.entries(scores)) (out[p] ||= { 1: 0, 2: 0, 3: 0 })[s]++;
  }
  return out;
};

const apply = Boolean(values.apply);
const details = {};
const written = [];
let problemsFound = false;

if (apply && !values.force) {
  const cp = await store.getJson(checkpointKey(version));
  if (cp?.running) throw new Error(`The checkpoint for ${version} says a run is active. Wait for it, or pass --force if you know it was killed.`);
}

console.log(`${apply ? 'APPLY' : 'Dry run'} — ${store.describe}  (${langs.join(' ')}; chapters ${chapters.length === CHAPTERS.length ? 'all' : chapters.join(',')}; version ${version})\n`);

for (const lang of langs) {
  const before = [];
  const after = [];
  const changes = {};
  const leftovers = {};
  const leftoverVerses = {};
  const touched = new Set();
  let flawsLeft = 0;
  const perLang = (details[lang] = {});
  const pending = []; // chapter files to write

  for (const n of chapters) {
    const { units } = await loadChapter(getSource, n);
    const unitOf = new Map(units.map((u) => [u.verseId, u]));
    const key = langChapterKey(lang, n);
    const found = await store.read(key);
    if (!found) {
      console.log(`  ${lang} ch ${n}: no file`);
      continue;
    }
    let fileChanged = false;
    const verses = found.json.verses.map((verse) => {
      before.push(verse);
      const unit = unitOf.get(verse.verseId);
      if (!unit || (values.verse && values.verse !== verse.verseId)) {
        after.push(verse);
        return verse;
      }
      const fixed = fixVerse(lang, verse, unit);
      for (const c of fixed.changes) count(changes, `${c.part}: ${c.how}`);
      for (const l of fixed.leftovers) {
        const k = `${l.part}: ${l.kind}`;
        count(leftovers, k);
        (leftoverVerses[k] ||= new Set()).add(verse.verseId);
      }
      let next = verse;
      if (fixed.changes.length) {
        touched.add(verse.verseId);
        next = rescoreVerse(lang, verse, fixed.verse, unit, fixed.parts, { keepTransliterationRating: Boolean(values['keep-rating']) });
        fileChanged = true;
        // The stamps and rows must still agree; a problem the repair introduced stops everything.
        const was = new Set(verifyEntry(verse, unit, lang));
        const introduced = verifyEntry(next, unit, lang).filter((p) => !was.has(p) && /stamp|correctness|source has changed/.test(p));
        if (introduced.length) {
          problemsFound = true;
          console.log(`  !! ${lang} ${verse.verseId}: the repair would introduce: ${introduced.join('; ')}`);
        }
      }
      // Sanskrit columns that still hold a script flaw after the repair.
      for (const line of (next.transliteration || '').split('\n')) if (line && sanskritFlaw(lang, line).length) flawsLeft++;
      for (const w of next.wordMeanings || []) if (sanskritFlaw(lang, w.word || '').length) flawsLeft++;
      after.push(next);
      perLang[verse.verseId] = { changes: fixed.changes, leftovers: fixed.leftovers, parts: fixed.parts, scoreBefore: verseScore(verse), scoreAfter: verseScore(next) };
      return next;
    });
    if (fileChanged) pending.push({ key, n, tag: found.tag, file: { ...found.json, verses } });
  }

  const h0 = histogram(before);
  const h1 = histogram(after);
  console.log(`${lang}: ${before.length} verses, ${touched.size} would change${apply ? '' : ' (nothing written)'}`);
  console.log(`  verse score  1: ${pad(h0[1], 4)} → ${pad(h1[1], 4)}    2: ${pad(h0[2], 4)} → ${pad(h1[2], 4)}    3: ${pad(h0[3], 4)} → ${pad(h1[3], 4)}`);
  const p0 = partHistogram(before);
  const p1 = partHistogram(after);
  for (const part of Object.keys(p0).sort()) console.log(`  ${part.padEnd(16)} 1: ${pad(p0[part][1], 4)} → ${pad(p1[part]?.[1] ?? 0, 4)}`);
  console.log('  changes made by rule:');
  for (const [k, v] of Object.entries(changes).sort()) console.log(`    ${k.padEnd(44)} ${pad(v, 5)}`);
  console.log('  LEFT for a translation or a look (never touched):');
  for (const [k, v] of Object.entries(leftovers).sort()) {
    const ids = [...leftoverVerses[k]];
    console.log(`    ${k.padEnd(44)} ${pad(v, 5)} in ${pad(ids.length, 3)} verses  ${ids.slice(0, 10).join(' ')}${ids.length > 10 ? ' …' : ''}`);
  }
  console.log(`  Sanskrit lines / words still carrying a script flaw after the repair: ${flawsLeft}\n`);

  if (apply) {
    if (problemsFound) throw new Error('Stopping before any write: see the lines marked !! above.');
    for (const { key, n, tag, file } of pending) {
      const body = JSON.stringify(file, null, 2);
      const backup = await store.backup(key);
      try {
        await store.write(key, body, tag);
      } catch (err) {
        if (err instanceof ConflictError) throw new Error(`${key} was changed by someone else since it was read — nothing was written to it. Run this again.`);
        throw err;
      }
      const back = await store.read(key);
      if (!back || JSON.stringify(back.json) !== JSON.stringify(file)) throw new Error(`${key} does not read back as what was written. The backup is ${backup}.`);
      written.push({ lang, chapter: n, key, backup });
      console.log(`  wrote ${key}   (backup: ${backup})`);
    }
    console.log('');
  }
}

if (values.report) {
  mkdirSync(dirname(resolve(values.report)), { recursive: true });
  writeFileSync(resolve(values.report), JSON.stringify({ at: new Date().toISOString(), apply, version, langs, written, details }, null, 1));
  console.log(`Report: ${resolve(values.report)}`);
}
if (!apply) console.log('Nothing was written. Add --apply to write the repaired chapter files (each is backed up first).');
if (problemsFound) process.exitCode = 1;
