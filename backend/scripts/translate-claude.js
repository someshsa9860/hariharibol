// Translates the Bhagavad-gītā (Prabhupāda's English translation, purport, transliteration and
// word-by-word meanings) into Hindi, Marathi and Tamil with Claude — other languages with --langs —
// one verse at a time. Each finished verse is written into its language's chapter file beside the
// English one, json/bhagavat-gita/<lang>/ch-<n>.json, before the next verse starts, and every
// item says it was translated by Claude, in which version (TRANSLATION_VERSION) and how far it can
// be trusted: a correctness score of 3 (perfect), 2 (good) or 1 (needs a second round). Every usable
// answer is saved — a doubtful one is kept with warnings and a low score, not thrown away.
//
//   node scripts/translate-claude.js --dry-run            what a run would do and cost; no Claude call, no write
//   node scripts/translate-claude.js --status [--verify]  progress from S3 (--verify re-checks every saved verse)
//   node scripts/translate-claude.js                      translate; resumes at the first verse a language lacks
//
// Full flags: --help. Setup, layout and the rules: scripts/README.md, "Translating the Gita with Claude".

import { appendFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { config as loadEnv } from 'dotenv';

const backend = resolve(dirname(fileURLToPath(import.meta.url)), '..');
loadEnv({ path: resolve(backend, '.env') });

const HELP = `Usage: node scripts/translate-claude.js [options]

  --dry-run            count what is left, estimate calls / tokens / cost; calls nothing, writes nothing
  --status             progress per chapter and language, the versions found, the correctness scores and the checkpoint; add --verify to re-check every saved verse
  (no mode flag)       translate, resuming automatically: only the verses and languages not yet saved (--resume is accepted)

  --chapters 2,3       chapters to work on (default: all 18)
  --verse 1.2.47       one verse only (with --chapters or alone)
  --limit N            stop after N verses translated in this run
  --langs hi,mr,...    languages (default: hi,mr,ta; all seven: hi,mr,bn,ta,te,kn,ml)
  --model ID           default claude-sonnet-5-5 (or ANTHROPIC_MODEL)
  --effort LEVEL       off | low | medium | high | xhigh | max  (default off: no thinking; Opus 5.5, Fable and Mythos cannot turn it off — use low)
  --max-tokens N       output ceiling per call (default 64000)
  --group-budget N     estimated output tokens a call may carry before languages are split. Default 1: each language in its own call.
                       40000 puts a verse's languages together in one call (about 5% cheaper, Marathi and Tamil may come out weaker)
  --max-rounds N       tries per verse when an answer has nothing to save — invalid JSON or no translation (default 4)
  --max-spend USD      stop before the next verse once the checkpoint's total spend reaches this
  --local-store DIR    write to a folder laid out like the bucket instead of S3 (pilots, tests)
  --test               translate ONE random verse (or --verse 2.47) and write it under _test/<time>/ in the bucket — the real chapter files are not touched
  --force              start even though the checkpoint says another run is active (use after a killed run)

The version every verse is stamped with is TRANSLATION_VERSION in backend/.env (default 1.0-12-10-26); it is fixed for the run.
`;

const { values } = parseArgs({
  options: {
    'dry-run': { type: 'boolean' }, status: { type: 'boolean' }, verify: { type: 'boolean' }, resume: { type: 'boolean' },
    chapters: { type: 'string' }, verse: { type: 'string' }, limit: { type: 'string' }, langs: { type: 'string' },
    model: { type: 'string' }, effort: { type: 'string' }, 'max-tokens': { type: 'string' }, 'group-budget': { type: 'string' },
    'max-rounds': { type: 'string' }, 'max-spend': { type: 'string' }, 'local-store': { type: 'string' },
    force: { type: 'boolean' }, test: { type: 'boolean' }, help: { type: 'boolean', short: 'h' },
  },
});

if (values.help) {
  console.log(HELP);
  process.exit(0);
}

const { LANGUAGE_CODES } = await import('./lib/claude-translate-languages.js');
const { CHAPTERS, DEFAULT_GROUP_BUDGET, loadChapter } = await import('./lib/claude-translate-source.js');
const { DEFAULT_MODEL, costUsd, createClaude, thinkingSettings } = await import('./lib/claude-translate-client.js');
const { dirStore, langChapterKey, s3Store, testStore, versionFrom } = await import('./lib/claude-translate-store.js');
const { dryRun, run, status } = await import('./lib/claude-translate-run.js');

function intFlag(name, fallback) {
  if (values[name] == null) return fallback;
  const n = Number(values[name]);
  if (!Number.isFinite(n) || n <= 0) throw new Error(`--${name} must be a positive number`);
  return n;
}

// Hindi, Marathi and Tamil by default; --langs picks others (bn, te, kn, ml).
const DEFAULT_LANGS = ['hi', 'mr', 'ta'];
const langs = values.langs ? values.langs.split(',').map((s) => s.trim()) : DEFAULT_LANGS;
for (const l of langs) if (!LANGUAGE_CODES.includes(l)) throw new Error(`Unknown language "${l}" — use ${LANGUAGE_CODES.join(', ')}`);

const chapters = values.chapters
  ? values.chapters.split(',').map((s) => Number(s.trim()))
  : values.verse
    ? [Number(values.verse.split('.')[1])]
    : CHAPTERS;
for (const c of chapters) if (!CHAPTERS.includes(c)) throw new Error(`Chapter ${c} is not 1–18`);

// "off" = no thinking: the job is a faithful rendering of given text, and thinking only adds cost.
const EFFORTS = ['off', 'low', 'medium', 'high', 'xhigh', 'max'];
const effort = values.effort || 'off';
if (!EFFORTS.includes(effort)) throw new Error(`--effort must be one of ${EFFORTS.join(', ')}`);

const cfg = {
  model: values.model || process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  effort,
  version: versionFrom(process.env.TRANSLATION_VERSION),
  langs,
  chapters,
  only: values.verse || null,
  limit: intFlag('limit', 0),
  maxSpend: values['max-spend'] != null ? Number(values['max-spend']) : null,
  maxTokens: intFlag('max-tokens', 64000),
  groupBudget: intFlag('group-budget', DEFAULT_GROUP_BUDGET),
  maxRounds: intFlag('max-rounds', 4),
  force: !!values.force,
};
thinkingSettings(cfg.model, cfg.effort); // throws now, before anything is read or spent, if this model cannot do what --effort asks

// The English source and the output store. SOURCE_LOCAL_DIR reads the English from a folder.
const { getJson: getSource } = await import('./lib/source-s3.js');
let store = values['local-store'] ? dirStore(resolve(values['local-store'])) : await s3Store();

let testRoot = null;
if (values.test) {
  // One verse, chosen at random unless --verse says which, written under a throwaway prefix of its own.
  const want = values.verse;
  const pool = [];
  for (const n of want ? CHAPTERS : chapters) pool.push(...(await loadChapter(getSource, n)).units);
  const matches = want ? pool.filter((u) => u.verseId === want || u.ref === want) : pool;
  if (!matches.length) throw new Error(`No verse "${want}" in the source`);
  const unit = matches[Math.floor(Math.random() * matches.length)];
  Object.assign(cfg, { chapters: [unit.chapterNumber], only: unit.verseId, limit: 1, force: true });
  testRoot = `_test/${new Date().toISOString().replace(/[:.]/g, '-')}/`;
  store = testStore(store, testRoot);
  console.log(`Test verse: Bhagavad-gītā ${unit.ref} (${unit.verseId}) → ${store.describe}\n`);
}

const logFile = resolve(backend, '.translate-work', 'claude.log');
mkdirSync(dirname(logFile), { recursive: true });
const log = {
  say: (line) => console.log(line),
  // One JSON line per event: verse ids, languages, token counts, error text. Never a model response.
  event: (name, fields) => appendFileSync(logFile, `${JSON.stringify({ at: new Date().toISOString(), event: name, ...fields })}\n`),
};

const usd = (n) => (n == null ? 'unknown' : `$${n.toFixed(2)}`);
const pad = (v, w) => String(v).padStart(w);

if (values['dry-run']) {
  const { rows, totals } = await dryRun({ store, getSource, cfg });
  console.log(`Dry run — ${cfg.model}, ${cfg.langs.join(' ')}, version ${cfg.version}\nOutput: ${store.describe}json/bhagavat-gita/<lang>/ch-<n>.json\n`);
  console.log(`chapter  verses  ${cfg.langs.map((l) => pad(l, 5)).join(' ')}  to do  calls   words`);
  for (const r of rows) console.log(`${pad(r.chapter, 7)}  ${pad(r.verses, 6)}  ${cfg.langs.map((l) => pad(r.byLang[l], 5)).join(' ')}  ${pad(r.todo, 5)}  ${pad(r.calls, 5)}  ${pad(r.words, 6)}`);
  // The instructions ride on every call but are cached after the first, so they are priced as cache reads.
  const cost = costUsd(cfg.model, { inputTokens: totals.inTokens, outputTokens: totals.outTokens, cacheReadTokens: totals.systemTokens, cacheWriteTokens: 0 });
  console.log(`\nTo do: ${totals.todo} of ${totals.verses} verses (a verse is to do while any language lacks it), about ${totals.calls} calls, ${(totals.words / 1000).toFixed(0)}k English words.`);
  console.log(`Already saved: ${cfg.langs.map((l) => `${l} ${totals.byLang[l]}/${totals.verses}`).join('   ')}`);
  console.log(`Estimated tokens: ~${(totals.inTokens / 1e6).toFixed(1)}M in, ~${(totals.outTokens / 1e6).toFixed(1)}M out, and ~${(totals.systemTokens / 1e6).toFixed(1)}M of instructions re-read from the cache (script-length guesses; real counts are logged per call).`);
  console.log(cfg.effort === 'off'
    ? `Estimated cost: about ${usd(cost)} with thinking off — from the token guesses above; the real cost of every call is logged.`
    : `Estimated cost: about ${usd(cost)} before thinking tokens, which are billed as output and can add a large share at effort "${cfg.effort}".`);
  console.log('Nothing was sent to Claude and nothing was written.');
  process.exit(0);
}

if (values.status) {
  const { checkpoint: cp, rows, versions, scores, redo, bad } = await status({ store, getSource, cfg, verify: !!values.verify });
  console.log(`Status — ${store.describe}  (${cfg.langs.join(' ')}; run version ${cfg.version})\n`);
  for (const r of rows) {
    console.log(`ch ${pad(r.chapter, 2)}  ${cfg.langs.map((l) => `${l} ${pad(r.byLang[l], 3)}/${r.verses}`).join('   ')}${r.done === r.verses ? '  ✓' : ''}`);
  }
  const all = rows.reduce((s, r) => s + r.verses, 0);
  console.log(`\nSaved: ${cfg.langs.map((l) => `${l} ${rows.reduce((s, r) => s + r.byLang[l], 0)}/${all}`).join('   ')}`);
  const found = Object.entries(versions);
  console.log(found.length ? `Versions found: ${found.map(([v, by]) => `${v} (${Object.entries(by).map(([l, c]) => `${l} ${c}`).join(', ')})`).join('; ')}` : 'Versions found: none');
  console.log('Correctness of the saved verses (3 perfect · 2 good · 1 needs a second round):');
  for (const l of cfg.langs) {
    const t = scores[l];
    console.log(`  ${l}   3: ${pad(t[3], 4)}   2: ${pad(t[2], 4)}   1: ${pad(t[1], 4)}${t.unscored ? `   no score: ${t.unscored}` : ''}`);
  }
  if (redo.length) {
    const shown = redo.slice(0, 25).map((r) => `${r.verseId} [${r.lang}]`).join(', ');
    console.log(`  needing a second round: ${shown}${redo.length > 25 ? ` … and ${redo.length - 25} more` : ''}`);
  }
  if (cp) {
    console.log(`Checkpoint ${cfg.version}: ${cp.running ? 'a run is marked active' : 'no run active'}, updated ${cp.updatedAt}`);
    console.log(`  last saved: ${cp.lastCompleted?.verseId ?? 'none'}   total spend: ${usd(cp.costUsd)}   tokens in/out: ${cp.usage.inputTokens + cp.usage.cacheReadTokens}/${cp.usage.outputTokens}`);
    if (cp.lastError) console.log(`  last error: ${cp.lastError.verseId ?? ''} ${cp.lastError.message}`);
  } else {
    console.log(`No checkpoint for version ${cfg.version} yet — nothing has been run under it.`);
  }
  if (values.verify) {
    console.log(bad.length ? `\n${bad.length} saved verse(s) fail verification:` : '\nAll saved verses re-verified against the English.');
    for (const b of bad) console.log(`  ${b.verseId} [${b.lang}]: ${b.problems.slice(0, 3).join('; ')}`);
    if (bad.length) process.exitCode = 1;
  }
  process.exit(process.exitCode || 0);
}

// ---- a real run ----

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set. Add it to backend/.env (ANTHROPIC_API_KEY=sk-ant-...) and run again.');
  process.exit(2);
}

const controller = new AbortController();
process.on('SIGINT', () => {
  if (controller.signal.aborted) process.exit(130);
  console.log('\nStopping — the verse in progress is not saved and will be redone on the next run. Ctrl-C again to quit now.');
  controller.abort();
});

const { ask } = createClaude({ apiKey: process.env.ANTHROPIC_API_KEY, model: cfg.model, effort: cfg.effort, signal: controller.signal, onWait: (m) => { log.say(`        ${m}`); log.event('wait', { message: m }); } });

console.log(`Translating the Gita → ${cfg.langs.join(' ')}\nModel ${cfg.model} (${cfg.effort === 'off' ? 'thinking off' : `effort ${cfg.effort}`}) · version ${cfg.version} · output ${store.describe}json/bhagavat-gita/<lang>/ch-<n>.json\n`);
try {
  const result = await run({ store, getSource, ask, cfg, log, signal: controller.signal });
  console.log(`\n${result.stopReason}: ${result.done} verse(s) translated this run, ${result.skipped} already saved, ${usd(result.costUsd)} spent.`);
  if (result.stopReason === 'interrupted') process.exitCode = 130;
  if (testRoot && result.done) {
    const { units } = await loadChapter(getSource, cfg.chapters[0]);
    const en = units.find((u) => u.verseId === cfg.only);
    console.log(`\nEnglish: ${en.translation}`);
    console.log(`Verse sent (${en.transliteration.length} lines): ${en.transliteration[0] ?? ''} …`);
    console.log(`Word list sent (${en.wordMeanings.length}): ${en.wordMeanings.slice(0, 5).map((w) => `${w.word} — ${w.meaning}`).join(' ; ')}${en.wordMeanings.length > 5 ? ' …' : ''}\n`);
    for (const l of cfg.langs) {
      const key = langChapterKey(l, cfg.chapters[0]);
      const verse = (await store.getJson(key)).verses.find((v) => v.verseId === cfg.only);
      const rows = verse.commentaries.filter((c) => c.translatorSlug === 'prabhupada' && c.language === l);
      console.log(`[${l}] ${rows[0].text}`);
      if (verse.transliteration) console.log(`     verse: ${verse.transliteration.split('\n').slice(0, 2).join(' / ')} …`);
      const words = verse.wordMeanings || [];
      if (words.length) console.log(`     words (${words.length}): ${words.slice(0, 5).map((w) => `${w.word} — ${w.meaning}`).join(' ; ')}${words.length > 5 ? ' …' : ''}`);
      if (rows[1]) console.log(`     purport: ${rows[1].text.split('\n')[0].slice(0, 200)}…`);
      const ai = verse.aiTranslation;
      console.log(`     stamp: translatedBy ${ai.translatedBy}, version ${ai.version}`);
      console.log(`     correctness ${ai.correctness}  (${Object.entries(ai.partScores).map(([part, n]) => `${part} ${n}`).join(', ')})${ai.note ? ` — ${ai.note}` : ''}`);
      for (const w of ai.warnings.slice(0, 6)) console.log(`     warning: ${w}`);
      if (ai.warnings.length > 6) console.log(`     … and ${ai.warnings.length - 6} more warning(s)`);
      console.log(`     saved: ${store.describe}${key}`);
    }
    console.log('\nThe real chapter files were not touched. Delete the _test/ prefix in S3 when done.');
  }
} catch (err) {
  log.event('fatal', { verseId: err.verseId ?? null, message: err.message, problems: err.problems ?? null });
  console.error(`\nStopped: ${err.message}`);
  if (err.problems) for (const [lang, errs] of Object.entries(err.problems)) console.error(`  ${lang}: ${errs.slice(0, 3).join('; ')}`);
  console.error('Nothing was saved for this verse. Fix the cause and run the same command again to resume here.');
  process.exitCode = 1;
}
