// Repairs the Kannada Śrīmad-Bhāgavatam chapter files the 2026-10-20 audit found faulty, without a model:
//
//   transliteration  letters of other Indic scripts moved onto the Kannada block (the model wrote 219 verses in Devanagari, a
//                    few in Telugu / Malayalam / Tamil, and left stray letters in ~400 more), the verse-number tail removed,
//                    short e / o made long, and an isolated letter slip mended where the English file's Devanagari `sanskrit`
//                    clearly says which letter is meant (kn-translit.js: `mend`)
//   headwords        the same script move and long e / o
//   prose            hand patches (kn-fix-patches.json), Devanagari quotes and 1–3 stray letters of another script moved onto
//                    Kannada, a leaked `correctness` field name cut off, blank lines between paragraphs removed
//
// Never use scripts/fix-translation-script.js on the Bhagavatam: it rebuilds the Sanskrit from the English ASCII transliteration,
// which has lost ś / ṛ / ā. Parts the model is redoing (kn-redo.js) should be redone FIRST; this runs over the result.
//
//   node kn-fix.js --store DIR [--patches FILE] [--report FILE] [--write]
//
// DIR is laid out like the bucket (json/srimad-bhagavatam/kn/…, json/srimad-bhagavatam/en/…). Without --write nothing is changed.
// Stamps of the repaired parts are re-scored by the pipeline's validator and marked `scriptFix`; `translatedBy` is never touched.

import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const here = dirname(fileURLToPath(import.meta.url));
const lib = resolve(here, '../../lib');
const { unitsFromChapter, TRANSLATOR } = await import(`${lib}/claude-translate-source.js`);
const { applyPatches, foreignRuns, rescoreVerse } = await import(`${lib}/translation-script-fix.js`);
const { longEO, mend, stripNumberTail, toKannada } = await import('./kn-translit.js');

const BOOK = 'srimad-bhagavatam';
const LANG = 'kn';

/** The English file's `sanskrit` is wrong for these (it holds the next verse too / the previous verse's text): not an oracle there. */
const NO_MEND = new Set(['2.3.33.37', '2.3.13.12']);
/** A stray run this short, in these scripts, is a Kannada letter typed in the wrong script: it is moved. Tamil is not (lossy): hand patches. */
const STRAY_SCRIPTS = new Set(['Telugu', 'Bengali', 'Gujarati', 'Malayalam', 'Odia', 'Gurmukhi']);
const STRAY_LETTERS = 3;
/** Scripts the cleaned text must not have: they are never Kannada, and no offset maps them. */
const NEVER = /[Ѐ-ӿ　-鿿඀-෿]/u;

const { values } = parseArgs({
  options: { store: { type: 'string' }, patches: { type: 'string' }, report: { type: 'string' }, write: { type: 'boolean' }, help: { type: 'boolean', short: 'h' } },
});
if (values.help || !values.store) {
  console.log('Usage: node kn-fix.js --store DIR [--patches FILE] [--report FILE] [--write]');
  process.exit(values.help ? 0 : 1);
}

const dir = (lang) => resolve(values.store, 'json', BOOK, lang);
const patches = values.patches ? JSON.parse(readFileSync(resolve(values.patches), 'utf8')) : [];
const clone = (x) => JSON.parse(JSON.stringify(x));
const ownRows = (verse) => (verse.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === LANG);

/** `correctness` is the model's own field name; it leaked at the end of two purports (once with `],` before it, once followed by stray letters). */
function stripLeak(text) {
  const at = text.indexOf('correctness');
  if (at < 0 || text.length - at > 80) return { text, leak: at >= 0 };
  return { text: text.slice(0, at).replace(/\s*\]\s*,?\s*$/u, '').trimEnd(), leak: false, cut: text.slice(at) };
}

/** Prose (translation, purport, one word meaning): leak, stray scripts, paragraph spacing. → { text, changes, leftovers } */
function fixProse(text, field) {
  const changes = [];
  const leftovers = [];
  let t = text;

  const leak = stripLeak(t);
  if (leak.cut) { changes.push({ how: 'leak-cut', from: leak.cut.slice(0, 40), to: '' }); t = leak.text; } else if (leak.leak) leftovers.push({ kind: 'correctness-not-at-the-end' });

  const runs = foreignRuns(LANG, t).filter((r) => r.kind === 'indic');
  for (const run of runs.reverse()) {
    const scripts = run.scripts.split('+');
    const quote = scripts.every((s) => s === 'Devanagari');
    const stray = run.letters <= STRAY_LETTERS && scripts.every((s) => STRAY_SCRIPTS.has(s));
    if (!quote && !stray) { leftovers.push({ kind: 'foreign-run', scripts: run.scripts, letters: run.letters, text: run.text.slice(0, 40) }); continue; }
    const moved = toKannada(run.text);
    t = t.slice(0, run.start) + moved + t.slice(run.end);
    changes.push({ how: quote ? 'devanagari-moved' : 'stray-moved', from: run.text.slice(0, 30), to: moved.slice(0, 30) });
  }

  if (field === 'purport' && /\n{2,}/.test(t)) { t = t.replace(/\n{2,}/g, '\n'); changes.push({ how: 'blank-lines-removed' }); }
  if (NEVER.test(t)) leftovers.push({ kind: 'cyrillic-cjk-or-sinhala', text: t.match(NEVER)[0] });
  return { text: t, changes, leftovers };
}

/** One verse. → { verse, changes, leftovers, parts, scriptMoved, patchResults } */
function fixVerse(verse, enVerse, unit) {
  const out = clone(verse);
  const changes = [];
  const leftovers = [];
  const note = (part, list) => list.forEach((c) => changes.push({ part, ...c }));
  const left = (part, list) => list.forEach((l) => leftovers.push({ part, ...l }));

  // Hand patches first: they name the exact text, which the rules below would otherwise half-convert.
  const allMine = patches.filter((p) => p.verseId === verse.verseId);
  const mine = allMine.filter((p) => p.part !== 'transliteration');
  let patchResults = [];
  // applyPatches knows translation / purport / wordMeanings; a patch to the transliteration is a plain one-place replacement here.
  for (const p of allMine.filter((x) => x.part === 'transliteration')) {
    const t = out.transliteration;
    if (typeof t === 'string' && t.split(p.find).length === 2) {
      out.transliteration = t.replace(p.find, () => p.replace);
      patchResults.push({ status: 'applied' });
      changes.push({ part: 'transliteration', how: 'patch', from: p.find, to: p.replace });
    } else patchResults.push({ status: typeof t === 'string' && t.includes(p.replace) ? 'already' : 'not-found' });
  }
  if (mine.length) {
    const applied = applyPatches(LANG, out, mine);
    Object.assign(out, applied.verse);
    patchResults = [...patchResults, ...applied.results];
    for (const c of applied.changes) changes.push({ part: c.part, how: 'patch', ...(c.i != null ? { i: c.i } : {}), from: c.from, to: c.to });
  }

  let scriptMoved = false;
  if (typeof out.transliteration === 'string') {
    const before = out.transliteration;
    let t = toKannada(before);
    if (t !== before) { scriptMoved = true; changes.push({ part: 'transliteration', how: 'script-moved', letters: [...before].filter((c) => toKannada(c) !== c).length }); }
    const stripped = stripNumberTail(t);
    if (stripped !== t) { changes.push({ part: 'transliteration', how: 'number-tail-removed', from: t.slice(stripped.length).trim() }); t = stripped; }
    const long = longEO(t);
    if (long !== t) { changes.push({ part: 'transliteration', how: 'long-e-o' }); t = long; }
    if (enVerse?.sanskrit && !NO_MEND.has(verse.verseId)) {
      const m = mend(t, enVerse.sanskrit);
      if (m.patched.length) { changes.push({ part: 'transliteration', how: 'letters-mended', n: m.patched.length, pairs: m.patched.map((p) => `${p.from || '∅'}→${p.to || '∅'}`) }); t = m.text; }
      left('transliteration', m.left.map((reason) => ({ kind: 'mend', reason, dist: m.dist })));
    }
    out.transliteration = t;
  }

  // One entry more than the English list has, and nothing in it worth keeping (empty, a word repeated as its own meaning, or a note to
  // self in Latin letters): the model's stray. An extra entry that is a real word with a real meaning is left.
  if (Array.isArray(out.wordMeanings) && unit && out.wordMeanings.length === unit.wordMeanings.length + 1) {
    const last = out.wordMeanings[out.wordMeanings.length - 1];
    const w = (last.word || '').trim();
    const m = (last.meaning || '').trim();
    if ((!w && !m) || w === m || /[A-Za-z]{4,}/.test(w)) {
      out.wordMeanings = out.wordMeanings.slice(0, -1);
      changes.push({ part: 'wordMeanings', how: 'junk-entry-dropped', i: out.wordMeanings.length, from: JSON.stringify(last) });
    }
  }

  if (Array.isArray(out.wordMeanings)) {
    out.wordMeanings = out.wordMeanings.map((entry, i) => {
      let word = entry.word;
      if (typeof word === 'string') {
        const moved = longEO(toKannada(word));
        if (moved !== word) { changes.push({ part: 'wordMeanings', how: 'headword', i, from: word, to: moved }); word = moved; }
      }
      const prose = typeof entry.meaning === 'string' ? fixProse(entry.meaning, 'meaning') : { text: entry.meaning, changes: [], leftovers: [] };
      note('wordMeanings', prose.changes.map((c) => ({ ...c, i })));
      left('wordMeanings', prose.leftovers.map((l) => ({ ...l, i })));
      return { ...entry, word, meaning: prose.text };
    });
  }

  out.commentaries = (out.commentaries || []).map((row) => {
    if (!(row.translatorSlug === TRANSLATOR && row.language === LANG) || typeof row.text !== 'string') return row;
    const prose = fixProse(row.text, row.type);
    note(row.type, prose.changes);
    left(row.type, prose.leftovers);
    return { ...row, text: prose.text };
  });

  // Which parts actually differ now (a patch that found nothing changes nothing).
  const rows = (v) => Object.fromEntries(ownRows(v).map((r) => [r.type, r.text]));
  const a = rows(verse);
  const b = rows(out);
  const parts = [
    ...(a.translation !== b.translation ? ['translation'] : []),
    ...(verse.transliteration !== out.transliteration ? ['transliteration'] : []),
    ...(JSON.stringify(verse.wordMeanings) !== JSON.stringify(out.wordMeanings) ? ['wordMeanings'] : []),
    ...(a.purport !== b.purport ? ['purport'] : []),
  ];
  return { verse: out, changes, leftovers, parts, scriptMoved, patchResults };
}

/**
 * The model's free-text notes ("mistakenly rendered in Telugu") describe the text as it was before this run, and the admin page shows
 * the note beside the text. Once no Indic stray is left anywhere in the verse, a note sentence naming one is stale: dropped. A sentence
 * that merely says a spelling or gloss "needs verification" is kept, and so is anything about Bengali (some verses quote a Bengali song).
 */
const STALE_NOTE = /devanagari|telugu|tamil|hindi|malayalam|sinhala|russian|chinese/i;
function scrubNotes(verse) {
  const ai = verse.aiTranslation;
  if (!ai) return { verse, n: 0 };
  const texts = [verse.transliteration, ...(verse.wordMeanings || []).flatMap((m) => [m.word, m.meaning]), ...ownRows(verse).map((r) => r.text)];
  if (texts.some((t) => typeof t === 'string' && foreignRuns(LANG, t).some((r) => r.kind === 'indic'))) return { verse, n: 0 };
  let n = 0;
  const clean = (note) => {
    if (typeof note !== 'string') return note;
    const kept = note.split(' · ').filter((sentence) => { const stale = STALE_NOTE.test(sentence); if (stale) n++; return !stale; });
    return kept.length ? kept.join(' · ') : undefined;
  };
  const next = clone(verse);
  const notes = clean(ai.note);
  if (notes === undefined) delete next.aiTranslation.note; else next.aiTranslation.note = notes;
  for (const [part, stamp] of Object.entries(next.aiTranslation.parts || {})) {
    const c = clean(stamp.note);
    if (c === undefined) delete stamp.note; else stamp.note = c;
  }
  return n ? { verse: next, n } : { verse, n: 0 };
}

const tally = (o, k, n = 1) => { o[k] = (o[k] || 0) + n; };
const sum = { files: 0, filesChanged: 0, verses: 0, versesChanged: 0, parts: {}, how: {}, mendPairs: {}, leftover: {}, patch: {}, unscored: [] };
const report = [];

for (const name of readdirSync(dir(LANG)).filter((f) => /^c\d+-ch-\d+\.json$/.test(f)).sort((x, y) => x.localeCompare(y, undefined, { numeric: true }))) {
  const path = resolve(dir(LANG), name);
  const file = JSON.parse(readFileSync(path, 'utf8'));
  const en = JSON.parse(readFileSync(resolve(dir('en'), name), 'utf8'));
  const enById = new Map(en.verses.map((v) => [v.verseId, v]));
  const unitById = new Map(unitsFromChapter(en, null, BOOK).units.map((u) => [u.verseId, u]));
  sum.files++;

  let changed = false;
  const verses = file.verses.map((verse) => {
    sum.verses++;
    const r = fixVerse(verse, enById.get(verse.verseId), unitById.get(verse.verseId));
    for (const p of r.patchResults) tally(sum.patch, p.status);
    for (const l of r.leftovers) tally(sum.leftover, `${l.part}: ${l.kind}${l.reason ? ` — ${l.reason.replace(/^[a-z]+ [^\s:]*:\s*/i, '')}` : ''}`);
    let next = verse;
    if (r.parts.length) {
      next = r.verse;
      const unit = unitById.get(verse.verseId);
      if (unit && verse.aiTranslation) next = rescoreVerse(LANG, verse, r.verse, unit, r.parts, { rebuilt: r.scriptMoved ? ['transliteration'] : [] });
      else sum.unscored.push(verse.verseId);
    }
    const scrubbed = scrubNotes(next);
    if (scrubbed.n) { next = scrubbed.verse; tally(sum.how, 'notes/stale-script-sentence-removed', scrubbed.n); tally(sum.parts, 'notes'); }
    if (!r.parts.length && !scrubbed.n) {
      if (r.leftovers.length) report.push({ verseId: verse.verseId, changes: [], leftovers: r.leftovers });
      return verse;
    }
    sum.versesChanged++;
    changed = true;
    for (const p of r.parts) tally(sum.parts, p);
    for (const c of r.changes) { tally(sum.how, `${c.part}/${c.how}`); for (const pair of c.pairs ?? []) tally(sum.mendPairs, pair); }
    report.push({ verseId: verse.verseId, parts: r.parts, changes: r.changes, leftovers: r.leftovers, scoreBefore: verse.aiTranslation?.partScores, scoreAfter: next.aiTranslation?.partScores, ...(scrubbed.n ? { notesDropped: scrubbed.n } : {}) });
    return next;
  });

  if (changed) {
    sum.filesChanged++;
    if (values.write) writeFileSync(path, JSON.stringify({ ...file, verses }, null, 2));
  }
}

if (values.report) writeFileSync(resolve(values.report), JSON.stringify({ summary: sum, verses: report }, null, 1));
const show = (o) => Object.entries(o).sort((x, y) => y[1] - x[1]).map(([k, n]) => `  ${String(n).padStart(5)}  ${k}`).join('\n');
console.log(`${values.write ? 'WROTE' : 'DRY RUN — nothing written'}: ${sum.filesChanged}/${sum.files} files, ${sum.versesChanged}/${sum.verses} verses changed`);
console.log('\nparts changed:\n' + show(sum.parts));
console.log('\nwhat was done:\n' + show(sum.how));
console.log('\nletters mended (stored→source), top 25:\n' + show(Object.fromEntries(Object.entries(sum.mendPairs).sort((x, y) => y[1] - x[1]).slice(0, 25))));
console.log('\nhand patches:\n' + show(sum.patch));
console.log('\nleft alone (reported, not changed):\n' + show(sum.leftover));
if (sum.unscored.length) console.log(`\nchanged but not re-scored (no English unit or no stamp): ${sum.unscored.join(' ')}`);
