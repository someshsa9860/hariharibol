// Puts repaired Kannada Śrīmad-Bhāgavatam chapter files on S3 — the way the 2026-10-20 fix went up. Each file, one at a time:
//   1. is read from S3 and must still be exactly the file the audit started from (otherwise skipped, never overwritten);
//   2. is copied to json-backup-<today>/<key>, and the copy is checked to be that original;
//   3. is written only if its ETag is unchanged (a conditional PutObject — someone else's write in between makes it a conflict, not a loss);
//   4. is read back and compared with what was meant to be written.
//
//   node kn-upload.js --before DIR --after DIR --cantos 1,2,3 --expect 62            check only: reads every key, writes nothing
//   node kn-upload.js --before DIR --after DIR --cantos 1,2,3 --expect 62 --write
//
// --before  a copy of the files as they were when audited, laid out like the bucket (json/srimad-bhagavatam/kn/c<canto>-ch-<n>.json)
// --after   the repaired copy, same layout (what kn-fix.js --write produced)
// --expect  how many chapter files those cantos have — a guard against a wrong folder
// Never name a canto that another job is still writing (on 2026-10-20 the canto-4 run was live while cantos 1–3 were fixed).
// Writes s3-upload-log.json (or s3-check-log.json) in the current folder: key, ETag before and after, backup key.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '../../lib');
const { values } = parseArgs({ options: { before: { type: 'string' }, after: { type: 'string' }, cantos: { type: 'string' }, expect: { type: 'string' }, write: { type: 'boolean' } } });
if (!values.before || !values.after || !values.cantos || !values.expect) {
  console.log('Usage: node kn-upload.js --before DIR --after DIR --cantos 1,2,3 --expect 62 [--write]');
  process.exit(1);
}

const { ConflictError, langChapterKey, s3Store } = await import(`${lib}/claude-translate-store.js`);
const BOOK = 'srimad-bhagavatam';
const folder = (root) => resolve(root, 'json', BOOK, 'kn');
const cantos = new Set(values.cantos.split(',').map((s) => Number(s.trim())));
const store = await s3Store();
console.log(values.write ? 'WRITE' : 'CHECK ONLY', store.describe);

const names = readdirSync(folder(values.before))
  .filter((x) => /^c\d+-ch-\d+\.json$/.test(x) && cantos.has(Number(x.match(/^c(\d+)-/)[1])))
  .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
if (names.length !== Number(values.expect)) throw new Error(`expected ${values.expect} files for cantos ${values.cantos}, found ${names.length}`);

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const log = [];
let ok = 0;
let skipped = 0;
for (const name of names) {
  const [, canto, chapter] = name.match(/c(\d+)-ch-(\d+)/).map(Number);
  const key = langChapterKey('kn', canto * 100 + chapter, BOOK);
  const original = JSON.parse(readFileSync(`${folder(values.before)}/${name}`, 'utf8'));
  const nextText = readFileSync(`${folder(values.after)}/${name}`, 'utf8');
  const found = await store.read(key);
  if (!found) { console.log('MISSING', key); skipped++; continue; }
  if (!same(found.json, original)) { console.log('CHANGED ON S3 SINCE THE AUDIT — skipped:', key, found.tag); skipped++; continue; }
  if (!values.write) { ok++; log.push({ key, tag: found.tag }); continue; }
  try {
    const backup = await store.backup(key);
    const kept = await store.read(backup);
    if (!kept || !same(kept.json, original)) throw new Error(`backup ${backup} is not the audited original — NOT writing ${key}`);
    const tag = await store.write(key, nextText, found.tag);
    const back = await store.read(key);
    if (!back || !same(back.json, JSON.parse(nextText))) throw new Error(`${key} does not read back as what was written (backup: ${backup})`);
    console.log('wrote', key.padEnd(52), found.tag, '→', tag, ' backup:', backup);
    log.push({ key, before: found.tag, after: tag, backup });
    ok++;
  } catch (err) {
    if (err instanceof ConflictError) { console.log('CONFLICT — changed by someone else while uploading, not written:', key); skipped++; continue; }
    console.log('FAILED', key, err.message);
    skipped++;
    process.exitCode = 1;
    break;
  }
}
console.log(`\n${values.write ? 'written' : 'would write'}: ${ok}   skipped/failed: ${skipped}   of ${names.length}`);
writeFileSync(`${process.cwd()}/${values.write ? 's3-upload-log' : 's3-check-log'}.json`, JSON.stringify({ at: new Date().toISOString(), log }, null, 1));
