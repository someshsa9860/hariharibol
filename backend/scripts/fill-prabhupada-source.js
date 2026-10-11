// Fills the scripture source JSON from Prabhupada's own text on vedabase.io
// (BBT) and puts each chapter into the source bucket as soon as it is done.
// Built to run for hours in the background and be stopped and started again.
//
//   node scripts/fill-prabhupada-source.js [--only bg,sb:3] [--upload] [--workers 3] [--work <dir>]
//   node scripts/fill-status.js [--work <dir>]        # progress, any time
//
// What it adds, per chapter (details and the rules in lib/fill-verse.js):
//   Bhagavad Gita        word-by-word for every verse (the source had none) and
//                        any missing Prabhupada translation / purport / transliteration
//   Srimad Bhagavatam    Devanagari for cantos 1-9 (the source never had it),
//                        clean word-by-word for cantos 10-12 (the source's has the
//                        translation and purport pasted into it), and any missing
//                        translation / purport / transliteration / word-by-word
// Only Prabhupada's text is used and nothing already good is changed: a fill that
// would alter existing text is refused and the chapter is not written.
//
// --only    unit prefixes: "bg", "bg:2", "sb", "sb:10", "sb:10:4" (default: everything)
// --upload  after each chapter, back up and replace its objects in the source
//           bucket (lib/source-upload.js). Without it nothing leaves this machine.
// --redo    do the selected chapters again even if they are marked done (the scraped
//           pages are cached, so this is quick; used after the fill rules change)
// --work    working folder (default backend/.fill-work):
//             source/    the filled copy, laid out like the bucket — what
//                        SOURCE_LOCAL_DIR points the importers at
//             baseline/  untouched downloads, kept so nothing can be lost
//             cache/     parsed vedabase pages, so a restart does not refetch
//             report/    per-chapter detail, including every verse not filled and why
//             state.json progress.json fill.log
// Do not set SOURCE_LOCAL_DIR for this script: it reads and uploads to the real bucket.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync, appendFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { getBuffer, listKeys } from './lib/source-s3.js';
import { replaceSafely } from './lib/source-upload.js';
import { chapterIndex, versePageParsed } from './lib/vedabase.js';
import { fillBgChapter, fillSbChapter, onlyAdditions } from './lib/fill-verse.js';

if (process.env.SOURCE_LOCAL_DIR) {
  console.error('SOURCE_LOCAL_DIR is set — unset it; this script reads and uploads to the real bucket.');
  process.exit(1);
}

const argv = process.argv.slice(2);
const flag = (name) => argv.includes(`--${name}`);
const option = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
};
const upload = flag('upload');
const redo = flag('redo');
const workers = Math.max(1, Number(option('workers', 3)));
const only = option('only', '').split(',').filter(Boolean);
const work = resolve(option('work', join(dirname(fileURLToPath(import.meta.url)), '..', '.fill-work')));
const dirs = { source: join(work, 'source'), baseline: join(work, 'baseline'), cache: join(work, 'cache'), report: join(work, 'report') };
for (const d of Object.values(dirs)) mkdirSync(d, { recursive: true });

const bgKey = (kind, n) => `json/bhagavat-gita/${kind}/ch-${n}.json`;
const sbKey = (c, m) => `json/srimad-bhagavatam/en/c${c}-ch-${m}.json`;

// ---------- state, progress and log ----------

const statePath = join(work, 'state.json');
const state = existsSync(statePath)
  ? JSON.parse(readFileSync(statePath, 'utf8'))
  : { createdAt: new Date().toISOString(), units: {}, keys: {} };
const startedAt = Date.now();
const running = new Set();
let stopping = false;

function atomicWrite(path, text) {
  writeFileSync(path + '.tmp', text);
  renameSync(path + '.tmp', path);
}

function log(line) {
  const stamped = `${new Date().toISOString()} ${line}`;
  console.log(stamped);
  appendFileSync(join(work, 'fill.log'), stamped + '\n');
}

const ADDED = ['wordMeanings', 'replacedWordMeanings', 'sanskrit', 'transliteration', 'translation', 'purport'];

function progress(phase) {
  const units = Object.entries(state.units).filter(([id]) => selected.some((u) => u.id === id));
  const count = (status) => units.filter(([, u]) => u.status === status).length;
  const added = Object.fromEntries(ADDED.map((k) => [k, units.reduce((n, [, u]) => n + (u.added?.[k] || 0), 0)]));
  const book = (prefix) => {
    const all = selected.filter((u) => u.id.startsWith(prefix));
    return { total: all.length, done: all.filter((u) => ['done', 'skipped'].includes(state.units[u.id]?.status)).length, failed: all.filter((u) => state.units[u.id]?.status === 'failed').length };
  };
  const doneNow = selected.filter((u) => state.units[u.id]?.finishedInRun).length;
  const remaining = selected.filter((u) => !['done', 'skipped'].includes(state.units[u.id]?.status)).length;
  const perUnit = doneNow ? (Date.now() - startedAt) / doneNow : null;
  const out = {
    pid: process.pid,
    phase,
    upload,
    startedAt: new Date(startedAt).toISOString(),
    updatedAt: new Date().toISOString(),
    totals: { units: selected.length, done: count('done'), skipped: count('skipped'), failed: count('failed'), remaining },
    books: { bg: book('bg:'), sb: book('sb:') },
    running: [...running],
    added,
    versesNotFilled: units.reduce((n, [, u]) => n + (u.notFilled || 0), 0),
    mismatches: units.reduce((n, [, u]) => n + (u.mismatches || 0), 0),
    lowMatch: units.reduce((n, [, u]) => n + (u.lowMatch || 0), 0),
    uploaded: { files: Object.values(state.keys).filter((k) => k.uploadedSha).length },
    etaMinutes: perUnit && phase === 'running' ? Math.round((perUnit * remaining) / 60000) : null,
  };
  atomicWrite(join(work, 'progress.json'), JSON.stringify(out, null, 2));
}

function save(phase = 'running') {
  atomicWrite(statePath, JSON.stringify(state));
  progress(phase);
}

// ---------- the units of work ----------

const selected = [];
async function plan() {
  const all = [];
  for (let n = 1; n <= 18; n++) all.push({ id: `bg:${n}`, kind: 'bg', chapter: n });
  const sbKeys = (await listKeys('json/srimad-bhagavatam/en/'))
    .map((key) => key.match(/c(\d+)-ch-(\d+)\.json$/))
    .filter(Boolean)
    .map((m) => ({ id: `sb:${m[1]}:${m[2]}`, kind: 'sb', canto: Number(m[1]), chapter: Number(m[2]) }))
    .sort((a, b) => a.canto - b.canto || a.chapter - b.chapter);
  all.push(...sbKeys);
  for (const u of all) if (only.length === 0 || only.some((p) => u.id === p || u.id.startsWith(p + ':'))) selected.push(u);
}

const sha = (text) => createHash('sha1').update(text).digest('hex');

/** The untouched object: downloaded once, then always read from disk. */
async function baselineOf(key) {
  const file = join(dirs.baseline, key);
  if (!existsSync(file)) {
    const buffer = await getBuffer(key);
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, buffer);
    state.keys[key] = { ...(state.keys[key] || {}), baselineBytes: buffer.length };
  }
  return JSON.parse(readFileSync(file, 'utf8'));
}

function writeSource(key, data) {
  const text = JSON.stringify(data);
  const file = join(dirs.source, key);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text);
  return text;
}

/** Puts a filled object in the bucket if it differs from what is there. */
async function publish(key, text, before) {
  const entry = (state.keys[key] = state.keys[key] || {});
  const unchanged = text === JSON.stringify(before);
  if (unchanged || entry.uploadedSha === sha(text)) return false;
  const body = Buffer.from(text);
  const result = await replaceSafely(key, body, entry.uploadedBytes ?? entry.baselineBytes);
  entry.uploadedSha = sha(text);
  entry.uploadedBytes = result.bytes;
  log(`uploaded ${key} (${result.bytes} bytes${result.backedUp ? ', original backed up' : ''})`);
  return true;
}

const classify = (skipped) => ({
  notFilled: skipped.length,
  mismatches: skipped.filter((s) => s.reason.includes('does not match')).length,
});

async function pagesFor(book, canto, chapter, ranges) {
  const pages = new Map();
  for (const range of ranges) pages.set(range, await versePageParsed(dirs.cache, book, canto, chapter, range));
  return pages;
}

async function runBg({ chapter }) {
  const sa = await baselineOf(bgKey('sa', chapter));
  const en = await baselineOf(bgKey('en', chapter));
  const saBefore = JSON.stringify(sa);
  const enBefore = JSON.stringify(en);
  const index = await chapterIndex(dirs.cache, 'bg', null, chapter);
  if (!index) return { status: 'skipped', note: 'vedabase has no such chapter' };

  const unitOf = new Map();
  for (const range of index.verses) {
    const [a, b] = range.split('-').map(Number);
    for (let n = a; n <= (b || a); n++) unitOf.set(n, range);
  }
  // Chapter 1 from Sanskrit verse 37: the BBT numbers run one behind (see repair-bg-source.js).
  const rangeOf = (n) => (chapter === 1 && n >= 37 ? (n === 37 ? '36' : n === 38 || n === 39 ? '37-38' : String(n - 1)) : unitOf.get(n));
  const pages = await pagesFor('bg', null, chapter, index.verses);

  const report = fillBgChapter({ sa, en, indexRanges: index.verses, pages, rangeOf });
  const problems = [
    ...onlyAdditions(JSON.parse(saBefore).verses, sa.verses),
    ...onlyAdditions(JSON.parse(enBefore).verses, en.verses),
  ];
  if (problems.length) throw new Error(`fill would change existing text, not written: ${problems.slice(0, 5).join('; ')}`);

  const saText = writeSource(bgKey('sa', chapter), sa);
  const enText = writeSource(bgKey('en', chapter), en);
  let uploaded = 0;
  if (upload) {
    if (await publish(bgKey('sa', chapter), saText, JSON.parse(saBefore))) uploaded += 1;
    if (await publish(bgKey('en', chapter), enText, JSON.parse(enBefore))) uploaded += 1;
  }
  return { status: 'done', added: report, uploaded, ...classify(report.skipped), lowMatch: report.lowMatch.length, detail: { skipped: report.skipped, lowMatch: report.lowMatch } };
}

async function runSb({ canto, chapter }) {
  const data = await baselineOf(sbKey(canto, chapter));
  const before = JSON.stringify(data);
  const index = await chapterIndex(dirs.cache, 'sb', canto, chapter);
  if (!index) {
    writeSource(sbKey(canto, chapter), data);
    return { status: 'skipped', note: 'vedabase has no such chapter' };
  }
  const pages = await pagesFor('sb', canto, chapter, index.verses);
  const report = fillSbChapter({ data, indexRanges: index.verses, pages, plain: canto <= 9 });

  // Verses vedabase prints that the source has no row for: reported, never invented.
  const have = new Set(data.verses.flatMap((v) => Array.from({ length: (v.verseNumberEnd || v.verseNumber) - v.verseNumber + 1 }, (_, i) => v.verseNumber + i)));
  const absent = index.verses.filter((range) => {
    const [a, b] = range.split('-').map(Number);
    return !Array.from({ length: (b || a) - a + 1 }, (_, i) => a + i).every((n) => have.has(n));
  });
  for (const range of absent) report.skipped.push({ verseId: `2.${canto}.${chapter}.${range}`, reason: 'on vedabase, no row in the source' });

  const problems = onlyAdditions(JSON.parse(before).verses, data.verses);
  if (problems.length) throw new Error(`fill would change existing text, not written: ${problems.slice(0, 5).join('; ')}`);

  const text = writeSource(sbKey(canto, chapter), data);
  const uploaded = upload && (await publish(sbKey(canto, chapter), text, JSON.parse(before))) ? 1 : 0;
  return { status: 'done', added: report, uploaded, ...classify(report.skipped), detail: { skipped: report.skipped } };
}

async function runUnit(unit) {
  running.add(unit.id);
  save();
  try {
    const result = await (unit.kind === 'bg' ? runBg(unit) : runSb(unit));
    const { detail, ...summary } = result;
    state.units[unit.id] = { ...summary, finishedInRun: true, finishedAt: new Date().toISOString() };
    if (detail?.skipped.length || detail?.lowMatch?.length) writeFileSync(join(dirs.report, `${unit.id.replace(/:/g, '-')}.json`), JSON.stringify(detail, null, 1));
    const a = result.added;
    log(`${unit.id} ${result.status}${a ? ` — word-by-word ${a.wordMeanings}+${a.replacedWordMeanings || 0} fixed, devanagari ${a.sanskrit || 0}, translit ${a.transliteration}, translation ${a.translation}, purport ${a.purport}; ${result.notFilled} not filled` : ''}${result.uploaded ? `, ${result.uploaded} uploaded` : ''}`);
  } catch (err) {
    state.units[unit.id] = { status: 'failed', error: err.message, finishedAt: new Date().toISOString() };
    log(`${unit.id} FAILED — ${err.message}`);
  } finally {
    running.delete(unit.id);
    save();
  }
}

// ---------- run ----------

async function main() {
  await plan();
  const todo = redo ? [...selected] : selected.filter((u) => !['done', 'skipped'].includes(state.units[u.id]?.status));
  log(`${selected.length} chapters selected, ${todo.length} to do, ${workers} workers, upload ${upload ? 'ON' : 'off'}, work dir ${work}`);
  save();

  const queue = [...todo];
  const next = async () => {
    while (queue.length && !stopping) await runUnit(queue.shift());
  };
  await Promise.all(Array.from({ length: workers }, next));

  const failed = selected.filter((u) => state.units[u.id]?.status === 'failed').length;
  save(stopping ? 'stopped' : 'finished');
  log(stopping ? 'stopped — run the same command again to carry on' : `finished${failed ? `, ${failed} chapters failed — run the same command again to retry them` : ''}`);
  if (failed) process.exitCode = 1;
}

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    if (stopping) process.exit(130);
    stopping = true;
    log(`${signal} — finishing the chapters in progress, then stopping`);
  });
}

main().catch((err) => {
  log(`ERROR ${err.stack || err.message}`);
  process.exitCode = 1;
});
