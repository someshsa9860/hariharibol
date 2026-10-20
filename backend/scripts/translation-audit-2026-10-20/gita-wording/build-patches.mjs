// Turns the verified edits (runs/verified.jsonl) into a patch file for scripts/fix-translation-script.js.
// Verses Prabhupāda translated together each store their own copy of the shared translation, so a translation edit
// (which review.mjs puts on the group's first verse) is written out once per verse of the group.
//
//   node build-patches.mjs --from DIR --in runs/verified.jsonl --out patches/review-fixes.json --accept patches/accepted.json
//
// The verifier's verdict is not enough to change scripture: accepted.json lists the edits a person read in context and approved,
// { lang, verseId, part, index?, find?, replace?, patchFind? } — `find` tells apart two edits to one text, `replace` is the person's own wording,
// `patchFind` widens the text the patch looks for (when the edit only adds a word, a `find` inside `replace` would add it again on a second run).
// Anything not listed is left alone. (--exclude FILE, same shape, can be used instead to turn down a few.)

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';

import { check, loadUnit } from './units.mjs';

const { values } = parseArgs({ options: { from: { type: 'string' }, in: { type: 'string' }, out: { type: 'string' }, exclude: { type: 'string' }, accept: { type: 'string' } } });
if (!values.from || !values.in || !values.out) throw new Error('--from DIR, --in FILE and --out FILE are required');

const rows = readFileSync(resolve(values.in), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const excluded = values.exclude && existsSync(values.exclude) ? JSON.parse(readFileSync(resolve(values.exclude), 'utf8')) : [];
const accepted = values.accept ? JSON.parse(readFileSync(resolve(values.accept), 'utf8')) : null;
const sameEdit = (e, lang, i) => e.lang === lang && e.verseId === i.verseId && e.part === i.part && (e.index ?? null) === (i.part === 'wordMeanings' ? i.index : null) && (e.find === undefined || e.find === i.find);
const used = new Set();
const isExcluded = (lang, i) => excluded.some((e) => e.lang === lang && e.verseId === i.verseId && e.part === i.part && (e.index ?? null) === (i.part === 'wordMeanings' ? i.index : null) && e.find === i.find);

const patches = [];
let skipped = 0;
for (const row of rows) {
  for (const issue of row.apply ?? []) {
    if (isExcluded(row.lang, issue)) { skipped++; continue; }
    if (accepted) {
      const hit = accepted.find((e) => sameEdit(e, row.lang, issue));
      if (!hit) { skipped++; continue; }
      used.add(hit);
      if (hit.replace !== undefined) issue.replace = hit.replace;
      if (hit.patchFind !== undefined) issue.find = hit.patchFind;
    }
    const unit = loadUnit(resolve(values.from), row.lang, row.ids);
    const why = check(unit, issue);
    if (why) throw new Error(`${row.lang} ${issue.verseId}: ${why}`);
    const note = `${issue.kind}: ${issue.reason}`;
    if (issue.part === 'translation') {
      for (const verseId of row.ids) patches.push({ lang: row.lang, verseId, part: 'translation', find: issue.find, replace: issue.replace, why: note });
    } else {
      patches.push({ lang: row.lang, verseId: issue.verseId, part: 'wordMeanings', i: issue.index, find: issue.find, replace: issue.replace, why: note });
    }
  }
}
const unmatched = (accepted ?? []).filter((e) => !used.has(e));
if (unmatched.length) throw new Error(`accepted but not found in ${values.in}:\n${unmatched.map((e) => JSON.stringify(e)).join('\n')}`);
writeFileSync(resolve(values.out), `${JSON.stringify(patches, null, 1)}\n`);
console.log(`${patches.length} patch(es) written to ${values.out}${skipped ? ` (${skipped} excluded)` : ''}`);
