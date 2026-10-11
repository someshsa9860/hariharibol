// Progress of scripts/fill-prabhupada-source.js — safe to run any time, from
// another terminal, while it works (it only reads the files the runner writes).
//
//   node scripts/fill-status.js [--work <dir>] [--failed]
//
// --failed  also list each failed chapter with its error.

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const argv = process.argv.slice(2);
const i = argv.indexOf('--work');
const work = resolve(i === -1 ? join(dirname(fileURLToPath(import.meta.url)), '..', '.fill-work') : argv[i + 1]);

const read = (name) => (existsSync(join(work, name)) ? JSON.parse(readFileSync(join(work, name), 'utf8')) : null);
const p = read('progress.json');
if (!p) {
  console.log(`No progress yet in ${work} — start it with: node scripts/fill-prabhupada-source.js --upload`);
  process.exit(0);
}

let alive = false;
try {
  process.kill(p.pid, 0);
  alive = true;
} catch {
  // not running
}
const state = alive ? 'RUNNING' : p.phase === 'finished' ? 'FINISHED' : p.phase === 'stopped' ? 'STOPPED' : 'NOT RUNNING (stopped unexpectedly — run it again to carry on)';

const bar = (done, total) => {
  const width = 30;
  const filled = total ? Math.round((done / total) * width) : 0;
  return `[${'█'.repeat(filled)}${'░'.repeat(width - filled)}] ${done}/${total} (${total ? Math.round((done / total) * 100) : 0}%)`;
};
// The runner's progress.json describes the chapters of the current run; a run
// of only one book would hide the other's, so the totals come from state.json,
// which keeps every chapter ever done.
const units = Object.entries(read('state.json')?.units || {});
const inBook = (prefix) => units.filter(([id]) => id.startsWith(prefix));
const book = (prefix, running) => {
  const mine = inBook(prefix);
  return {
    total: Math.max(running.total, mine.length),
    done: mine.filter(([, u]) => ['done', 'skipped'].includes(u.status)).length,
    failed: mine.filter(([, u]) => u.status === 'failed').length,
  };
};
const bg = book('bg:', p.books.bg);
const sb = book('sb:', p.books.sb);
const added = (key) => units.reduce((n, [, u]) => n + (u.added?.[key] || 0), 0);
const minutes = (m) => (m == null ? 'unknown' : m >= 90 ? `${(m / 60).toFixed(1)} h` : `${m} min`);

console.log(`${state}   started ${p.startedAt}   updated ${p.updatedAt}   upload ${p.upload ? 'ON' : 'off'}`);
console.log(`Bhagavad Gita      ${bar(bg.done, bg.total)}${bg.failed ? `  ${bg.failed} failed` : ''}`);
console.log(`Srimad Bhagavatam  ${bar(sb.done, sb.total)}${sb.failed ? `  ${sb.failed} failed` : ''}`);
if (alive) console.log(`Working on: ${p.running.join(', ') || '—'}    time left: ~${minutes(p.etaMinutes)}`);
console.log('');
console.log('Added so far');
console.log(`  word-by-word, verses that had none   ${added('wordMeanings')}`);
console.log(`  word-by-word, broken ones replaced   ${added('replacedWordMeanings')}`);
console.log(`  Devanagari                           ${added('sanskrit')}`);
console.log(`  transliteration                      ${added('transliteration')}`);
console.log(`  translation (meaning)                ${added('translation')}`);
console.log(`  purport                              ${added('purport')}`);
console.log('');
console.log(`Uploaded to the source bucket: ${p.uploaded.files} files`);
const lowMatch = units.reduce((n, [, u]) => n + (u.lowMatch || 0), 0);
if (lowMatch) console.log(`Verses whose word-by-word matches their own text poorly (kept, worth a look): ${lowMatch}`);
console.log(`Verses left unfilled: ${units.reduce((n, [, u]) => n + (u.notFilled || 0), 0)} (${units.reduce((n, [, u]) => n + (u.mismatches || 0), 0)} where vedabase did not match the source — see ${join(work, 'report')})`);
if (p.totals.failed || argv.includes('--failed')) {
  const state2 = read('state.json');
  const failed = Object.entries(state2?.units || {}).filter(([, u]) => u.status === 'failed');
  console.log(`\n${failed.length} chapters failed${argv.includes('--failed') ? ':' : ' (--failed to list)'}`);
  if (argv.includes('--failed')) for (const [id, u] of failed) console.log(`  ${id}: ${u.error}`);
}
