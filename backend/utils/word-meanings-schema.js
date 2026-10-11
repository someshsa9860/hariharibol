// The shape of `Verse.wordMeanings`: Prabhupada's word-for-word, one `{ word, meaning }`
// per entry, in the order the words stand in the verse. Both admin routes that take it
// (create and update) use this one schema, so they refuse the same things.
//
// `word` is null when the source did not split a word out. `meaning` is never empty.
// The limits sit above the longest real entry in the Gita and Bhagavatam (104 entries
// to a verse, a word of 130 characters, a meaning of 367) and well below a corrupt one:
// the Bhagavatam 10-12 blobs carried a whole purport in a single entry, and
// scripts/lib/fill-verse.js treats any entry over 400 characters as that.
//
// Kept in its own file, not in the route, so a test can load it without the app.

import { z } from 'zod';

export const wordMeaningsSchema = z
  .array(
    z.object({
      word: z.string().trim().max(200).nullable(),
      meaning: z.string().trim().min(1).max(400),
    })
  )
  .max(300);
