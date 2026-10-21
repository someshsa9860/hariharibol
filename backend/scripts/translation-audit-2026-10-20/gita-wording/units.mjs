// A "unit" is one verse, or the verses Prabhupāda translated together (they carry one shared translation). Shared by verify.mjs.
// review.mjs builds the same units inline.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, '../../..');
const { language } = await import(resolve(backend, 'scripts/lib/claude-translate-languages.js'));

const prabhupada = (v, type) => v?.commentaries?.find((c) => c.translatorSlug === 'prabhupada' && c.type === type)?.text ?? null;
const squash = (t) => (t || '').replace(/\s+/g, ' ').trim();
const clean = (t) => squash((t || '').replace(/^।।[\d.]+।।\s*/, '').replace(/\(टिप्पणी[^)]*\)/g, ''));
const count = (text, find) => (find ? text.split(find).length - 1 : 0);

const chapterOf = (id) => id.split('.')[1];
const cache = new Map();
const readChapter = (from, dir, ch) => {
  const key = `${from}|${dir}|${ch}`;
  if (!cache.has(key)) cache.set(key, new Map(JSON.parse(readFileSync(resolve(from, dir, `ch-${ch}.json`), 'utf8')).verses.map((v) => [v.verseId, v])));
  return cache.get(key);
};

/** The unit made of these verse ids (in one language): `{ lang, english, own, ids, verses: [{ sa, mine }] }`. */
export function loadUnit(from, lang, ids) {
  const ch = chapterOf(ids[0]);
  const sas = readChapter(from, 'sa', ch), ens = readChapter(from, 'en', ch), owns = readChapter(from, lang, ch);
  const verses = ids.map((id) => ({ sa: sas.get(id), mine: owns.get(id) }));
  return { lang, ids, verses, english: squash(prabhupada(ens.get(ids[0]), 'translation')), own: prabhupada(verses[0].mine, 'translation') };
}

export function unitPrompt(lang, unit) {
  const L = language(lang).name;
  const lines = [];
  if (unit.verses.length > 1) lines.push(`These ${unit.verses.length} verses (${unit.ids.join(', ')}) share ONE translation.`);
  for (const { sa, mine } of unit.verses) {
    lines.push(`\n=== VERSE ${sa.verseId}${sa.speaker ? `  (spoken by ${sa.speaker})` : ''} ===`);
    lines.push(`SANSKRIT:\n${sa.sanskrit}`);
    lines.push(`WORD LIST — index | Sanskrit | English | ${L}:`);
    const n = Math.max(sa.wordMeanings.length, mine.wordMeanings.length);
    for (let i = 0; i < n; i++) lines.push(`${i} | ${sa.wordMeanings[i]?.word ?? '—'} | ${sa.wordMeanings[i]?.meaning ?? '—'} | ${mine.wordMeanings[i]?.meaning ?? '—'}`);
  }
  lines.push(`\nENGLISH TRANSLATION (Prabhupāda${unit.verses.length > 1 ? ', all these verses together' : ''}): ${unit.english}`);
  lines.push(`\n${L.toUpperCase()} TRANSLATION:\n${unit.own}`);
  if (lang === 'hi') {
    const ref = (slug) => unit.verses.map(({ mine }) => clean(mine.commentaries.find((c) => c.translatorSlug === slug && c.type === 'translation')?.text)).filter(Boolean).join(' ');
    lines.push(`\nFOR COMPARISON ONLY, Hindi by two human translators (do not copy; use them to see how a Hindi reader says it):\n- Ramsukhdas: ${ref('ramsukhdas')}\n- Tejomayananda: ${ref('tejomayananda')}`);
  }
  return lines.join('\n');
}

/** null if the edit can be applied: it names a verse of the unit, `find` occurs exactly once, and it changes something; else why not. */
export function check(unit, issue) {
  const verse = unit.verses.find((v) => v.sa.verseId === issue.verseId);
  if (!verse) return 'verseId is not in this unit';
  if (issue.genuine === false) return 'the model itself withdrew it';
  if (issue.find === issue.replace) return 'find equals replace';
  if (!issue.replace.trim()) return 'replace is empty';
  if (!issue.find.trim()) return 'find is empty';
  if (issue.part === 'translation') {
    if (issue.verseId !== unit.ids[0]) return 'translation issue not on the first verse of the group';
    const n = count(unit.own, issue.find);
    return n === 1 ? null : `find occurs ${n} times in the translation`;
  }
  const entry = verse.mine.wordMeanings[issue.index];
  if (!entry) return `no word-list line ${issue.index}`;
  const n = count(entry.meaning, issue.find);
  return n === 1 ? null : `find occurs ${n} times in line ${issue.index}`;
}
