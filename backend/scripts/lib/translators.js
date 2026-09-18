// Only Vaishnav-sampradaya, devotional commentators are imported — see the
// project's `CLAUDE.md` ("Vaishnav-sampradaya-only scope") and the
// `translators` array in prisma/seed/data.js, which is the actual, current
// list of who is approved. This module only ever references translators that
// array already seeds; it never creates one, so widening the list is a
// seed-data decision, not an import-script one.
//
// Maps a source JSON `translatorSlug` to this app's `Translator.slug`, for
// the few that the old scrape spelled differently. Anything from the source
// that is not a key here — sivananda, ramsukhdas, shankaracharya (Advaita),
// vallabhacharya, tejomayananda, ... — is off Vaishnav-sampradaya scope and
// is skipped by every import script, not auto-added.
const SOURCE_SLUG_TO_TRANSLATOR_SLUG = {
  prabhupada: 'prabhupada',
  ramanujacharya: 'ramanujacharya',
  madhavacharya: 'madhvacharya', // source spelling differs from the seeded slug
  'sridhara-swami': 'sridhara-swami',
  dnyaneshwar: 'dnyaneshwar',
};

export { SOURCE_SLUG_TO_TRANSLATOR_SLUG };
