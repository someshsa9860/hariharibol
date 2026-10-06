// The scrape stores word-for-word meanings as one semicolon-joined string
// ("om—O my Lord; namah—offering my obeisances; ..."), using an em dash
// between a word and its meaning, wrapped as [{ raw: "…" }]. This splits it
// into the { word, meaning } shape Verse.wordMeanings actually documents, so
// the app can render a list rather than one unbroken sentence.
function parseRaw(raw) {
  return raw
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      const dashIndex = entry.indexOf('—');
      if (dashIndex === -1) return { word: null, meaning: entry };
      return { word: entry.slice(0, dashIndex).trim(), meaning: entry.slice(dashIndex + 1).trim() };
    });
}

/**
 * Source word-meanings arrive in two shapes depending on which job produced
 * them: BG's is already a plain list, SB's is `[{ raw: "word—meaning; …" }]`.
 * This normalises either into `[{ word, meaning }]`, or `[]` for neither.
 */
function normalizeWordMeanings(source) {
  if (!Array.isArray(source) || source.length === 0) return [];
  if (source[0]?.raw) return source.flatMap((entry) => parseRaw(entry.raw));
  return source;
}

export { normalizeWordMeanings };
