// Pure rules for the accounts carried over from the old server: what the old server's answer must look like,
// and which of our mantras a name it used ("Om Namah Shivay") is. No I/O — services/legacy.js fetches, the
// controller writes, and test/legacy-mantra.test.js holds these.

import { z } from 'zod';

import { fold, soundKey } from './search-query.js';

const text = (max) => z.string().trim().max(max);

// What the old server's migration endpoint returns inside `data`. Only `id` is required: an old account with
// no email or name is still carried over. Anything else it sends is ignored.
const legacyAccount = z.object({
  id: z.union([z.string(), z.number()]).transform((value) => String(value)).pipe(text(100).min(1)),
  email: text(255).email().nullish().catch(null),
  name: text(100).nullish().catch(null),
  avatarUrl: text(2000).nullish().catch(null),
  // 'google' | 'apple', when the old server knew; and the provider's own id for the person, which is what lets a
  // later Google sign-in land on this same account instead of a second one.
  provider: z.string().trim().max(20).nullish().catch(null),
  providerUserId: text(255).nullish().catch(null),
  // What they chanted there, in any order: a name and how many times. Counts only rank the mantras, so the unit
  // (chants, beads, rounds) does not matter.
  mantras: z
    .array(
      z.object({
        name: text(200).min(1),
        count: z.coerce.number().finite().min(0).catch(0),
      })
    )
    .max(500)
    .catch([]),
});

/** The old server's `data`, or null when it is not an account at all. */
function readLegacyAccount(data) {
  const parsed = legacyAccount.safeParse(data);
  if (!parsed.success) return null;
  const account = parsed.data;
  return {
    id: account.id,
    email: account.email ? account.email.toLowerCase() : null,
    name: account.name || null,
    avatarUrl: account.avatarUrl || null,
    provider: String(account.provider || '').toUpperCase() === 'APPLE' ? 'APPLE' : 'GOOGLE',
    providerUserId: account.providerUserId || null,
    mantras: account.mantras,
  };
}

// "om namah shivay", "Om Namah Shivaya", "ॐ नमः शिवाय" written in Roman by a person: the same name. Each word's
// sound, with a final vowel dropped (shivay / shivaya, krishna / krishn), so a spelling a letter off still meets.
function nameKey(name) {
  return fold(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => soundKey(word).replace(/[aeiou]$/, ''))
    .filter(Boolean)
    .join(' ');
}

// The same sound with the spaces taken out first, so "Maha Mantra" and "Mahamantra" are one word to a person.
function runTogetherKey(name) {
  return soundKey(fold(name)).replace(/[aeiou]$/, '');
}

const keysOf = (name) => {
  const a = nameKey(name).replace(/ /g, '');
  const b = runTogetherKey(name);
  return a ? [a, b] : [];
};

/**
 * The published mantra a name belongs to, or null. Matched on the name, then the slug, then every translated
 * name the caller passes (`names`) and the transliteration, never on a guess about meaning: a name that is not clearly one of ours is
 * left out rather than turned into a different mantra.
 * `mantras` is `[{ id, name, slug, transliteration?, names: [...] }]`.
 */
function matchMantra(name, mantras) {
  const wanted = keysOf(name);
  if (!wanted.length) return null;
  for (const mantra of mantras) {
    const theirs = [mantra.name, mantra.slug?.replace(/-/g, ' '), mantra.transliteration, ...(mantra.names || [])].flatMap(keysOf);
    if (wanted.some((key) => theirs.includes(key))) return mantra;
  }
  return null;
}

/**
 * The most chanted of the old mantras that is also one of ours. A name that appears twice (two spellings of the
 * same mantra) adds up, because the person did chant it that many times.
 */
function pickLegacyFavourite(entries, mantras) {
  const totals = new Map();
  for (const entry of entries || []) {
    const mantra = matchMantra(entry.name, mantras);
    if (!mantra) continue;
    totals.set(mantra.id, (totals.get(mantra.id) || 0) + (entry.count || 0));
  }
  let best = null;
  for (const [id, count] of totals) {
    if (count > 0 && (!best || count > best.count)) best = { id, count };
  }
  return best ? best.id : null;
}

export { readLegacyAccount, nameKey, matchMantra, pickLegacyFavourite };
