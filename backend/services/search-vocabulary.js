// The words the library is written in, kept in memory so a misspelt search word can be
// matched to a real one (`utils/search-query.js`). Built from the transliteration of
// every verse, the English translations, and book and mantra names — not the purports:
// they are the bulk of the text and add few words the translations do not already hold.
//
// About 20–40 thousand distinct words. Built on the first search after a boot and again
// every `TTL_MS`, so a newly imported book is found within the hour without anything
// having to tell this module. A failed build leaves the old words standing.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { Vocabulary } from '../utils/search-query.js';

const TTL_MS = 60 * 60 * 1000;

let current = new Vocabulary();
let builtAt = 0;
let building = null;

async function load() {
  const rows = await prisma.$queryRaw`
    SELECT w AS word, count(*)::int AS n
    FROM (
      SELECT regexp_split_to_table(lower(t), '[[:space:][:punct:]]+') AS w
      FROM (
        SELECT "transliteration" AS t FROM "Verse" WHERE "transliteration" IS NOT NULL
        UNION ALL
        SELECT "meaning" FROM "VerseTranslation" WHERE "languageCode" = 'en' AND "isPublished"
        UNION ALL
        SELECT "title" FROM "Book"
        UNION ALL
        SELECT "name" FROM "Mantra"
        UNION ALL
        SELECT "transliteration" FROM "Mantra" WHERE "transliteration" IS NOT NULL
      ) AS source
    ) AS split
    WHERE length(w) BETWEEN 2 AND 40
    GROUP BY w`;
  return new Vocabulary(rows.filter((r) => /^[\p{L}\p{M}]+$/u.test(r.word)));
}

/** The vocabulary, built if it has not been or is out of date. Never throws. */
export async function vocabulary() {
  const fresh = Date.now() - builtAt < TTL_MS;
  if (fresh) return current;

  // Serve the old words while a new set is built; only the very first search waits.
  if (!building) {
    building = load()
      .then((built) => {
        current = built;
        builtAt = Date.now();
      })
      .catch((error) => {
        logger.warn({ err: error }, 'search vocabulary could not be built');
        // Try again in a minute rather than on every keystroke.
        builtAt = Date.now() - TTL_MS + 60 * 1000;
      })
      .finally(() => {
        building = null;
      });
  }
  if (!current.size) await building;
  return current;
}

/** For tests: use these words, and do not rebuild. */
export function setVocabulary(vocab) {
  current = vocab;
  builtAt = Date.now() + 365 * 24 * 60 * 60 * 1000;
}
