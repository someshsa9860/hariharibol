// How the old app's mantras would be matched to ours when someone signs in from it (see "Legacy users" in
// backend/CLAUDE.md) — the check to run before and after filling MANTRA_SLUGS in config/legacy.js. It reads
// the database it is pointed at (published mantras only, as the sign-in does) and writes nothing.
//
//   node scripts/legacy-match-mantras.js <old-mantras.json>
//
// <old-mantras.json> is the old server's `mantras` table: an array of `{ id, title, subtitle, mantra }`.
// Add `count` (everyone's total) and `chanters` to have them listed most chanted first and the report
// weighed by chanting, and `deleted: true` on rows the old server has soft-deleted (the sign-in never
// receives those, so they are listed and left out of the totals).

import { readFileSync } from 'node:fs';
import { prisma } from '../config/database.js';
import { MANTRA_SLUGS } from '../config/legacy.js';
import { candidateFrom, closeness, matchMantra, skeleton, textsOf } from '../utils/legacy.js';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/legacy-match-mantras.js <old-mantras.json>');
  process.exit(1);
}
const old = JSON.parse(readFileSync(file, 'utf8'));

const rows = await prisma.mantra.findMany({
  where: { isPublished: true },
  select: {
    id: true,
    slug: true,
    name: true,
    sanskrit: true,
    transliteration: true,
    translations: { where: { isPublished: true }, select: { name: true, text: true } },
  },
});
const candidates = rows.map(candidateFrom);
const bySlug = new Map(candidates.map((candidate) => [candidate.slug, candidate]));

/** Every candidate's score for one old mantra, best first — what `matchMantra` decides from. */
function scores(mantra) {
  const wanted = [...new Set(textsOf(mantra).map(skeleton).filter(Boolean))];
  return candidates
    .map((candidate) => ({
      slug: candidate.slug,
      score: Math.max(0, ...candidate.skeletons.flatMap((have) => wanted.map((want) => closeness(want, have)))),
    }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);
}

const show = (entry) => `${entry.slug} ${entry.score.toFixed(2)}`;
const pad = (value, width) => String(value ?? '').slice(0, width).padEnd(width);

const ordered = [...old].sort((a, b) => (b.count ?? 0) - (a.count ?? 0) || a.id - b.id);
const used = new Set();
let matchedChants = 0;
let allChants = 0;
let matched = 0;
let live = 0;

console.log(`${old.length} old mantras, ${candidates.length} published here\n`);
console.log(`${pad('old id', 7)}${pad('chanters', 9)}${pad('chants', 9)}${pad('old title', 36)}→ ours`);

for (const mantra of ordered) {
  const chants = mantra.count ?? 0;
  const override = bySlug.get(MANTRA_SLUGS[mantra.id]);
  const found = override ? { slug: override.slug, score: 1, via: 'override' } : matchMantra(textsOf(mantra), candidates);

  let verdict;
  if (found) {
    verdict = `${found.slug} (${found.via ?? 'name'}, ${found.score.toFixed(2)})`;
  } else {
    const [first, second] = scores(mantra);
    verdict = first
      ? `NO MATCH — best ${show(first)}${second ? `, then ${show(second)}` : ''}`
      : 'NO MATCH — nothing alike';
  }

  if (mantra.deleted) {
    verdict += '   [deleted on the old server: never sent]';
  } else {
    live++;
    allChants += chants;
    if (found) {
      matched++;
      matchedChants += chants;
      used.add(found.slug);
    }
  }
  console.log(`${pad(mantra.id, 7)}${pad(mantra.chanters ?? '', 9)}${pad(chants, 9)}${pad(mantra.title ?? mantra.subtitle, 36)}${verdict}`);
}

console.log(`\nMatched ${matched} of ${live} live old mantras${allChants ? `, ${Math.round((matchedChants / allChants) * 100)}% of all chanting` : ''}.`);
const unused = candidates.filter((candidate) => !used.has(candidate.slug)).map((candidate) => candidate.slug);
console.log(`Ours that no old mantra points at (${unused.length}): ${unused.join(', ') || '—'}`);

await prisma.$disconnect();
// Importing the database config also opened the Redis connections; nothing here needs them.
process.exit(0);
