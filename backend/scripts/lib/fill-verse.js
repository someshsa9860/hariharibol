// The decisions behind scripts/fill-prabhupada-source.js, kept free of network
// and disk so they can be tested: given a chapter of the source JSON and what
// vedabase.io prints for it (Prabhupada, BBT), what is missing and what to put
// there. Never invents text — everything written comes from the vedabase page,
// and only after the page is shown to be the same verse (see `similarity`).
//
// The rule that runs through all of it: fill what is missing, replace only what
// is known to be broken (the Bhagavatam 10-12 word-by-word blobs), and leave
// everything else exactly as it was.

import { plainRoman } from './vedabase.js';

/** Below this, a vedabase page is not accepted as the source verse. See fill-prabhupada-source.js. */
const MIN_SIMILARITY = 0.7;

/** A real word-by-word entry is a few words; the corrupt Bhagavatam 10-12 ones carry a whole purport. */
const OVERLONG_ENTRY = 400;

/** A Bhagavad Gita chapter's word-by-word is used only if this share of its words was found in the Sanskrit. */
const MIN_CHAPTER_FOUND = 0.85;

const letters = (s) => plainRoman(s || '').toLowerCase().replace(/[^a-z]/g, '');

function bigrams(s) {
  const counts = new Map();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    counts.set(g, (counts.get(g) || 0) + 1);
  }
  return counts;
}

/**
 * How alike two romanised verses are, 0..1 (Dice on letter pairs, diacritics,
 * spacing and punctuation ignored). Sandhi marks and the odd spelling differ
 * between the scrape and the BBT; a different verse scores far lower.
 */
function similarity(a, b) {
  const x = bigrams(letters(a));
  const y = bigrams(letters(b));
  let total = 0;
  let shared = 0;
  for (const n of x.values()) total += n;
  for (const n of y.values()) total += n;
  if (total === 0) return 0;
  for (const [g, n] of x) shared += Math.min(n, y.get(g) || 0);
  return (2 * shared) / total;
}

const entriesOf = (wordMeanings) => (Array.isArray(wordMeanings) ? wordMeanings : []);

/** What state a verse's word-by-word is in: 'empty', 'overlong' (corrupt), 'blob' (one unsplit {raw}), or 'ok'. */
function wordMeaningState(wordMeanings) {
  const entries = entriesOf(wordMeanings);
  if (entries.length === 0) return 'empty';
  const length = (e) => (e.raw || e.meaning || '').length;
  if (entries.some((e) => length(e) > OVERLONG_ENTRY)) return 'overlong';
  if (entries.length === 1 && entries[0].raw) return 'blob';
  return 'ok';
}

/** Vedabase pairs in the spelling a canto's source uses (cantos 1-9 have no diacritics). */
function styleMeanings(pairs, plain) {
  const fix = plain ? plainRoman : (s) => s;
  return pairs.filter((p) => p.meaning).map((p) => ({ word: p.word ? fix(p.word) : null, meaning: fix(p.meaning) }));
}

/**
 * A compound's word-by-word → one list per verse in it. Vedabase prints one
 * list for the whole compound, in verse order, so the split is the best way of
 * cutting that list into consecutive runs, one per verse, with every verse
 * getting at least one word. "Best" is how many words are found in the verse
 * they are given to: a word counts when its first letters appear in the verse's
 * own text (sandhi changes word ends, rarely starts). Null when there are
 * fewer words than verses — the caller then gives every verse the whole list,
 * which is more than one verse needs but never wrong.
 */
function splitPairs(pairs, verseTexts) {
  const K = verseTexts.length;
  const n = pairs.length;
  if (K === 0 || n < K) return null;
  const texts = verseTexts.map(letters);
  const fit = (i, k) => {
    const word = letters(pairs[i].word || '');
    if (word.length >= 4 && texts[k].includes(word.slice(0, 4))) return 2;
    if (word.length >= 3 && texts[k].includes(word.slice(0, 3))) return 1;
    return 0;
  };
  // best[i][k]: the highest score with pair i in verse k; from[i][k]: the verse pair i-1 was in.
  const best = Array.from({ length: n }, () => new Array(K).fill(-Infinity));
  const from = Array.from({ length: n }, () => new Array(K).fill(-1));
  best[0][0] = fit(0, 0);
  for (let i = 1; i < n; i++) {
    for (let k = 0; k < K; k++) {
      const stay = best[i - 1][k];
      const advance = k > 0 ? best[i - 1][k - 1] : -Infinity;
      if (stay === -Infinity && advance === -Infinity) continue;
      const useAdvance = advance > stay;
      best[i][k] = (useAdvance ? advance : stay) + fit(i, k);
      from[i][k] = useAdvance ? k - 1 : k;
    }
  }
  const lists = texts.map(() => []);
  for (let i = n - 1, k = K - 1; i >= 0; i--) {
    lists[k].unshift(pairs[i]);
    k = from[i][k];
  }
  return lists;
}

/**
 * A whole chapter's word-by-word → one list per verse, by laying the pairs
 * along the verses' own transliteration. Used for the Bhagavad Gita, where the
 * Sanskrit edition and the BBT end verses in slightly different places (1.26 in
 * the BBT carries a line the Sanskrit gives to 1.27), so vedabase's verse
 * boundaries cannot be trusted to cut the list; the Sanskrit's can.
 *
 * Vedabase prints each word in its dictionary form, the Sanskrit has it with
 * sandhi ("parayā upetāḥ" is "parayopetāḥ", "saṁnyasya" is also "sannyasya"),
 * so a word is looked for by several short pieces of itself — its first five,
 * four and three letters, and the same from its second letter. Every place any
 * of them occurs is a candidate; the words come in text order, so the answer is
 * the longest chain of candidates that moves forward through the text (a heavier
 * piece counts for more). A word with a stray match elsewhere is simply left
 * out of that chain, which a cursor walking forward could not do.
 *
 * A word not in the chain (one or two letters, or a different reading) goes
 * where its neighbours put it. Returns the lists and `found`, the share of the
 * words long enough to look for (three letters or more) that the chain located
 * — a low share means the pairs and the verses are not the same text.
 */
function alignPairs(pairs, verseTexts) {
  const texts = verseTexts.map(letters);
  const starts = [];
  let all = '';
  for (const t of texts) { starts.push(all.length); all += t; }
  const verseAt = (pos) => {
    let k = starts.length - 1;
    while (k > 0 && starts[k] > pos) k--;
    return k;
  };
  // m and n are one letter here: saṁnyasya / sannyasya, tam / tan.
  const flat = (s) => s.replace(/m/g, 'n');
  const haystack = flat(all);

  // Every place a piece of each word occurs, with what finding it there is worth.
  const words = pairs.map((p) => flat(letters(p.word || '')));
  const candidates = [];
  words.forEach((w, i) => {
    const pieces = [];
    for (const len of [5, 4, 3]) if (w.length >= len) pieces.push([w.slice(0, len), len]);
    for (const len of [4, 3]) if (w.length >= len + 1) pieces.push([w.slice(1, 1 + len), len - 1]);
    const seen = new Map();
    for (const [piece, worth] of pieces) {
      for (let pos = haystack.indexOf(piece); pos !== -1; pos = haystack.indexOf(piece, pos + 1)) {
        if ((seen.get(pos) || 0) < worth) seen.set(pos, worth);
      }
    }
    for (const [pos, worth] of seen) candidates.push({ word: i, pos, worth });
  });

  // The heaviest chain with the word number and the position both rising.
  candidates.sort((x, y) => x.word - y.word || x.pos - y.pos);
  const total = new Array(candidates.length);
  const before = new Array(candidates.length).fill(-1);
  let top = -1;
  for (let c = 0; c < candidates.length; c++) {
    let bestPrev = -1;
    for (let d = 0; d < c; d++) {
      if (candidates[d].word < candidates[c].word && candidates[d].pos < candidates[c].pos && (bestPrev === -1 || total[d] > total[bestPrev])) bestPrev = d;
    }
    total[c] = candidates[c].worth + (bestPrev === -1 ? 0 : total[bestPrev]);
    before[c] = bestPrev;
    if (top === -1 || total[c] > total[top]) top = c;
  }
  const at = new Array(pairs.length).fill(-1);
  for (let c = top; c !== -1; c = before[c]) at[candidates[c].word] = candidates[c].pos;

  // A word not located sits between its located neighbours: take its exact
  // spelling from the gap if it is there, else it stays with the word before.
  let previousEnd = 0;
  const nextStart = (i) => { for (let j = i + 1; j < at.length; j++) if (at[j] !== -1) return at[j]; return all.length; };
  const place = at.map((pos, i) => {
    if (pos !== -1) { previousEnd = pos + 1; return pos; }
    const hit = words[i] ? haystack.slice(previousEnd, nextStart(i)).indexOf(words[i]) : -1;
    return hit !== -1 ? previousEnd + hit : Math.max(previousEnd - 1, 0);
  });

  const lists = texts.map(() => []);
  place.forEach((pos, i) => lists[verseAt(pos)].push(pairs[i]));
  const lookedFor = words.filter((w) => w.length >= 3).length;
  const located = words.filter((w, i) => w.length >= 3 && at[i] !== -1).length;
  return { lists, found: lookedFor ? located / lookedFor : 0 };
}

/** "Verse 6" or "verses 4-6" → the source verse numbers each vedabase range covers. */
function unitsOf(indexRanges, verseNumbers) {
  const units = new Map();
  for (const range of indexRanges) {
    const [a, b] = range.split('-').map(Number);
    const members = verseNumbers.filter((n) => n >= a && n <= (b || a));
    if (members.length) units.set(range, members);
  }
  return units;
}

/**
 * How sure we are that `page` is these source verses: the better of the
 * transliteration match and the Prabhupada translation match, using whichever
 * the source has. null when the source has neither, so nothing can be checked.
 */
function matchScore(verses, page, translationOf) {
  const scores = [];
  const translit = verses.map((v) => v.transliteration).filter(Boolean);
  if (translit.length === verses.length && page.transliteration) scores.push(similarity(translit.join(' '), page.transliteration));
  const translations = verses.map(translationOf).filter(Boolean);
  if (translations.length === verses.length && page.translation) scores.push(similarity(translations.join(' '), page.translation));
  return scores.length ? Math.max(...scores) : null;
}

const prabhupada = (type) => (c) => c.translatorSlug === 'prabhupada' && c.type === type;
const isPlaceholder = (t) => /^\s*there is no purport for this verse\s*\.?\s*$/i.test(t || '');
const oneLine = (s) => (s || '').replace(/\s*\n\s*/g, ' ').replace(/\s+/g, ' ').trim();

/**
 * Bhagavad Gita, one chapter. `sa` holds Sanskrit, transliteration and word
 * meanings; `en` holds Prabhupada's translation and purport — two files, as
 * in the bucket. Both are changed in place. `pages` maps a vedabase range
 * ("47", "16-18") to its parsed page, or null where the site has none.
 *
 * Fills: word-by-word (all of it is missing) cut by the Sanskrit's verses (see
 * alignPairs), and any Prabhupada translation or purport, or transliteration,
 * the verse lacks, from the BBT page that holds it. `rangeOf(n)` says which
 * vedabase range that is for source verse n (chapter 1 runs one behind from 37).
 */
function fillBgChapter({ sa, en, indexRanges, pages, rangeOf }) {
  const report = { wordMeanings: 0, transliteration: 0, translation: 0, purport: 0, lowMatch: [], skipped: [] };
  const enById = new Map(en.verses.map((v) => [v.verseId, v]));

  // Word-by-word: the whole chapter's list, cut by the Sanskrit's own verses.
  const needs = sa.verses.filter((v) => wordMeaningState(v.wordMeanings) === 'empty');
  const allPairs = indexRanges.flatMap((range) => pages.get(range)?.synonymPairs || []);
  if (needs.length && allPairs.length === 0) {
    for (const v of needs) report.skipped.push({ verseId: v.verseId, reason: 'vedabase has no word-by-word for the chapter' });
  } else if (needs.length) {
    const { lists, found } = alignPairs(allPairs, sa.verses.map((v) => v.transliteration));
    if (found < MIN_CHAPTER_FOUND || lists.some((l) => l.length === 0)) {
      const why = found < MIN_CHAPTER_FOUND ? `only ${(found * 100).toFixed(0)}% of vedabase's words found in the chapter's Sanskrit` : 'some verse would get no words';
      for (const v of needs) report.skipped.push({ verseId: v.verseId, reason: `word-by-word not aligned: ${why}` });
    } else {
      sa.verses.forEach((v, i) => {
        if (!needs.includes(v)) return;
        v.wordMeanings = styleMeanings(lists[i], false);
        report.wordMeanings += 1;
        const own = letters(v.transliteration);
        const words = v.wordMeanings.map((w) => letters(w.word)).filter((w) => w.length >= 3);
        const hit = words.filter((w) => own.includes(w.slice(0, 3))).length;
        if (words.length && hit / words.length < 0.6) report.lowMatch.push(v.verseId);
      });
    }
  }

  // Anything else the verse lacks, from the BBT page that holds it.
  const byRange = new Map();
  for (const v of sa.verses) {
    const range = rangeOf(v.verseNumber);
    if (!range) continue;
    if (!byRange.has(range)) byRange.set(range, []);
    byRange.get(range).push(v);
  }
  for (const [range, verses] of byRange) {
    const page = pages.get(range);
    const missing = verses.some((v) => {
      const e = enById.get(v.verseId);
      const has = (type) => e?.commentaries?.some((c) => prabhupada(type)(c) && c.text);
      return !v.transliteration || !has('translation') || (!has('purport') && page?.purport && !isPlaceholder(page.purport));
    });
    if (!missing) continue;
    if (!page) { for (const v of verses) report.skipped.push({ verseId: v.verseId, reason: `vedabase ${range} has no page` }); continue; }
    const translationOf = (v) => enById.get(v.verseId)?.commentaries?.find(prabhupada('translation'))?.text;
    const score = matchScore(verses, page, translationOf);
    if (score === null || score < MIN_SIMILARITY) {
      const why = score === null ? 'nothing to check it against' : `does not match (${score.toFixed(2)})`;
      for (const v of verses) report.skipped.push({ verseId: v.verseId, reason: `vedabase ${range} ${why}` });
      continue;
    }
    for (const v of verses) {
      if (!v.transliteration && page.transliteration && verses.length === 1) {
        v.transliteration = oneLine(page.transliteration);
        report.transliteration += 1;
      }
      const e = enById.get(v.verseId);
      if (!e) continue;
      e.commentaries = e.commentaries || [];
      const tr = e.commentaries.find(prabhupada('translation'));
      if ((!tr || !tr.text) && page.translation) {
        if (tr) tr.text = page.translation;
        else e.commentaries.unshift({ translatorSlug: 'prabhupada', type: 'translation', language: 'en', displayOrder: 1, text: page.translation });
        report.translation += 1;
      }
      const pu = e.commentaries.find(prabhupada('purport'));
      if (!pu && page.purport && !isPlaceholder(page.purport)) {
        const at = e.commentaries.findIndex(prabhupada('translation')) + 1;
        e.commentaries.splice(at, 0, { translatorSlug: 'prabhupada', type: 'purport', language: 'en', displayOrder: 2, text: page.purport });
        report.purport += 1;
      }
    }
  }
  return report;
}

/**
 * Srimad Bhagavatam, one chapter (a single file holds everything). Fills the
 * Devanagari (cantos 1-9 never had it), a missing transliteration / Prabhupada
 * translation / purport, and word-by-word where it is empty — and in cantos
 * 10-12 replaces the unsplit blobs the scrape left, which carry the verse's
 * translation and purport pasted into their last entry.
 *
 * `plain` is true for cantos 1-9, whose source spells everything without
 * diacritics; what is filled follows that.
 */
function fillSbChapter({ data, indexRanges, pages, plain }) {
  const report = { sanskrit: 0, transliteration: 0, translation: 0, purport: 0, wordMeanings: 0, replacedWordMeanings: 0, skipped: [] };
  const fix = plain ? plainRoman : (s) => s;
  const units = unitsOf(indexRanges, data.verses.map((v) => v.verseNumber));

  for (const v of data.verses) {
    // A compound is one source row (verseNumberEnd set) or several rows sharing a page.
    const own = v.verseNumberEnd ? `${v.verseNumber}-${v.verseNumberEnd}` : null;
    const range = own && indexRanges.includes(own) ? own : [...units].find(([, members]) => members.includes(v.verseNumber))?.[0];
    const page = range && pages.get(range);
    if (!page) { report.skipped.push({ verseId: v.verseId, reason: range ? `vedabase ${range} has no page` : 'no vedabase range' }); continue; }
    const members = (units.get(range) || [v.verseNumber]).map((n) => data.verses.find((x) => x.verseNumber === n));
    const shared = members.length > 1;

    const translationOf = (m) => m.commentaries?.find((c) => c.type === 'translation')?.text;
    const score = matchScore(members, page, translationOf);
    if (score === null || score < MIN_SIMILARITY) {
      report.skipped.push({ verseId: v.verseId, reason: score === null ? `vedabase ${range}: nothing to check it against` : `vedabase ${range} does not match (${score.toFixed(2)})` });
      continue;
    }

    if (!v.sanskrit && page.devanagari && !shared) {
      v.sanskrit = page.devanagari.replace(/\n/g, ' ');
      report.sanskrit += 1;
    }
    if (!v.transliteration && page.transliteration && !shared) {
      v.transliteration = oneLine(fix(page.transliteration));
      report.transliteration += 1;
    }

    v.commentaries = v.commentaries || [];
    const tr = v.commentaries.find((c) => c.type === 'translation');
    if ((!tr || !tr.text) && page.translation) {
      const text = oneLine(fix(page.translation));
      if (tr) tr.text = text;
      else v.commentaries.unshift({ translatorSlug: 'prabhupada', type: 'translation', language: 'en', text });
      report.translation += 1;
    }
    const pu = v.commentaries.find((c) => c.type === 'purport');
    if (!pu && page.purport && !isPlaceholder(page.purport)) {
      const at = v.commentaries.findIndex((c) => c.type === 'translation') + 1;
      v.commentaries.splice(at, 0, { translatorSlug: 'prabhupada', type: 'purport', language: 'en', text: fix(page.purport).replace(/\n+/g, '\n').trim() });
      report.purport += 1;
    }

    const state = wordMeaningState(v.wordMeanings);
    const replace = state === 'empty' || state === 'overlong' || (state === 'blob' && !plain);
    if (replace && page.synonymPairs.length) {
      const lists = shared ? splitPairs(page.synonymPairs, members.map((m) => m.transliteration)) || members.map(() => page.synonymPairs) : [page.synonymPairs];
      const mine = lists[shared ? members.indexOf(v) : 0];
      v.wordMeanings = styleMeanings(mine, plain);
      if (state === 'empty') report.wordMeanings += 1;
      else report.replacedWordMeanings += 1;
    } else if (replace && state !== 'blob') {
      report.skipped.push({ verseId: v.verseId, reason: `vedabase ${range} has no word-by-word` });
    }
  }
  return report;
}

/**
 * Everything a fill must leave alone, checked before anything is uploaded: the
 * same verses, no existing Sanskrit / transliteration / commentary changed, and
 * word-by-word touched only where it was empty or broken. Returns the problems
 * found (empty when the output only adds to the input).
 */
function onlyAdditions(before, after) {
  const problems = [];
  if (before.length !== after.length) problems.push(`verse count ${before.length} → ${after.length}`);
  const byId = new Map(after.map((v) => [v.verseId, v]));
  for (const b of before) {
    const a = byId.get(b.verseId);
    if (!a) { problems.push(`${b.verseId}: gone`); continue; }
    for (const field of ['verseNumber', 'verseNumberEnd', 'sanskrit', 'transliteration']) {
      if (b[field] && b[field] !== a[field]) problems.push(`${b.verseId}: ${field} changed`);
    }
    for (const c of b.commentaries || []) {
      if (!c.text) continue;
      const kept = (a.commentaries || []).some((x) => x.translatorSlug === c.translatorSlug && x.type === c.type && x.language === c.language && x.text === c.text);
      if (!kept) problems.push(`${b.verseId}: ${c.translatorSlug} ${c.type} changed`);
    }
    if (wordMeaningState(b.wordMeanings) === 'ok' && JSON.stringify(b.wordMeanings) !== JSON.stringify(a.wordMeanings)) {
      problems.push(`${b.verseId}: good word-by-word changed`);
    }
  }
  return problems;
}

export { alignPairs, onlyAdditions, MIN_SIMILARITY, similarity, matchScore, wordMeaningState, splitPairs, styleMeanings, unitsOf, fillBgChapter, fillSbChapter };
