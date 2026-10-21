// Translates the headings of a canto's chapters into one language, in one call. The pure part of
// scripts/translate-chapter-titles.js, so a test can drive it with a fake `ask`.

export const LANGUAGE_NAMES = {
  hi: 'Hindi', mr: 'Marathi', gu: 'Gujarati', bn: 'Bengali', as: 'Assamese', ta: 'Tamil',
  te: 'Telugu', kn: 'Kannada', or: 'Odia', pa: 'Punjabi', ml: 'Malayalam',
};

// The Unicode block each language is written in (as in test/section-titles.test.js).
export const BLOCKS = {
  hi: [0x0900, 0x097f], mr: [0x0900, 0x097f], gu: [0x0a80, 0x0aff], bn: [0x0980, 0x09ff], as: [0x0980, 0x09ff],
  ta: [0x0b80, 0x0bff], te: [0x0c00, 0x0c7f], kn: [0x0c80, 0x0cff], or: [0x0b00, 0x0b7f], pa: [0x0a00, 0x0a7f],
  ml: [0x0d00, 0x0d7f],
};

const SYSTEM = (name) => `You translate the chapter headings of Śrīmad-Bhāgavatam (A. C. Bhaktivedanta Swami Prabhupāda's English edition) into ${name}, for a devotional reading app.
Write each heading as a printed ${name} edition would: natural, short, reverent, in the ${name} script only. Names of persons and places (Śrī Śukadeva, Parīkṣit, Vidura…) and devotional terms are written in ${name} script, transliterated the way ${name} readers know them, never translated literally. Keep a heading a heading: no full stop, no numbering, no quotation marks.
Answer with JSON: {"titles": [...]} — exactly one string per heading, in the same order.`;

const schema = { type: 'object', properties: { titles: { type: 'array', items: { type: 'string' } } }, required: ['titles'], additionalProperties: false };

/** Why `titles` cannot be used for `headings` in `code`, or null when they can. */
export function problemWith(code, headings, titles) {
  if (!Array.isArray(titles) || titles.length !== headings.length) {
    return `expected ${headings.length} titles, got ${Array.isArray(titles) ? titles.length : 'none'}`;
  }
  const [lo, hi] = BLOCKS[code];
  for (const [i, title] of titles.entries()) {
    if (typeof title !== 'string' || !title.trim()) return `title ${i + 1} is empty`;
    if (![...title].some((ch) => ch.codePointAt(0) >= lo && ch.codePointAt(0) <= hi)) return `title ${i + 1} ("${title}") is not in the ${code} script`;
  }
  return null;
}

/**
 * `headings` (English, in chapter order) in language `code`: an array of the same length.
 * Asks again, telling the model what was wrong, up to `rounds` times. Adds its spend to `spent`.
 */
export async function translateHeadings({ ask, code, headings, canto, rounds = 3, spent = { usd: 0, calls: 0 } }) {
  let complaint = null;
  for (let round = 1; round <= rounds; round++) {
    const user = [
      `Canto ${canto} — translate these ${headings.length} chapter headings into ${LANGUAGE_NAMES[code]}.`,
      complaint ? `Your last answer was rejected: ${complaint}. Fix that.` : '',
      JSON.stringify(headings),
    ].filter(Boolean).join('\n\n');
    const result = await ask({ system: SYSTEM(LANGUAGE_NAMES[code]), user, schema, maxTokens: 16000 });
    spent.usd += result.costUsd ?? 0;
    spent.calls += 1;
    complaint = problemWith(code, headings, result.data?.titles);
    if (!complaint) return result.data.titles.map((t) => t.trim());
  }
  throw new Error(`${code}, canto ${canto}: ${complaint}`);
}
