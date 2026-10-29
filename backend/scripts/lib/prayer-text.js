// Text helpers for scripts/fetch-prayers.js: turning a fetched page into lines, splitting lines into verses, and the
// cross-checks between two copies of the same prayer (Devanagari against Bengali, Devanagari against Roman). Nothing
// here fetches or writes; it is all string work, so it can be tried on a saved page.

// ---------------------------------------------------------------------------------------------------------------------
// HTML to lines

const NAMED_ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', shy: '',
  rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', ndash: '–', mdash: '—', hellip: '…', bull: '•',
  zwj: '‍', zwnj: '‌', middot: '·', copy: '©',
};

// What Windows-1252 puts at 0x80-0x9F, where Latin-1 has control characters. Node 20's TextDecoder('windows-1252')
// decodes as Latin-1 and leaves `’` as U+0092, so the table is kept here.
const CP1252_HIGH = {
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡', 0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š',
  0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘', 0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
};
const fromC1 = (ch) => CP1252_HIGH[ch.codePointAt(0)] ?? ch;

/** A Windows-1252 page's bytes as text, quotes and dashes included (see CP1252_HIGH). */
function decodeWindows1252(bytes) {
  return Buffer.from(bytes).toString('latin1').replace(/[\x80-\x9f]/g, fromC1);
}

/**
 * Decodes `&#2360;`, `&#x938;` and the named entities above; an unknown named entity is left as it is. A number from
 * 128 to 159 is read as Windows-1252, as browsers do (`&#146;` is ’, not a control character).
 */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, name) => {
    if (name[0] === '#') {
      const code = name[1] === 'x' || name[1] === 'X' ? parseInt(name.slice(2), 16) : parseInt(name.slice(1), 10);
      if (!Number.isFinite(code)) return whole;
      return code >= 0x80 && code <= 0x9f ? fromC1(String.fromCodePoint(code)) : String.fromCodePoint(code);
    }
    const known = NAMED_ENTITIES[name.toLowerCase()];
    return known === undefined ? whole : known;
  });
}

/**
 * A page's visible text, one line per paragraph or `<br>`. Whitespace in the source (Word's line wrapping) is folded
 * first, so only the markup decides where a line ends. Lines are trimmed and runs of spaces closed up.
 */
function htmlToLines(html) {
  let t = html.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  t = t.replace(/<!--[\s\S]*?-->/g, '');
  t = t.replace(/\s+/g, ' ');
  t = t.replace(/<br\s*\/?>|<\/p>|<\/div>|<\/h\d>|<\/li>|<\/tr>|<\/dd>|<\/dt>|<p[\s>]/gi, (m) => (m.startsWith('<p') ? `\n${m}` : '\n'));
  t = decodeEntities(t.replace(/<[^>]+>/g, ''));
  return t
    .split('\n')
    .map((l) => l.replace(/[\s ]+/g, ' ').trim())
    .map((l) => l.normalize('NFC'));
}

// ---------------------------------------------------------------------------------------------------------------------
// Verse numbers

const DIGITS = { deva: '०१२३४५६७८९', beng: '০১২৩৪৫৬৭৮৯' };

/** The number written in ASCII, Devanagari or Bengali digits, or NaN. */
function readNumber(text) {
  let out = '';
  for (const ch of text) {
    if (ch >= '0' && ch <= '9') out += ch;
    else if (DIGITS.deva.includes(ch)) out += DIGITS.deva.indexOf(ch);
    else if (DIGITS.beng.includes(ch)) out += DIGITS.beng.indexOf(ch);
    else return NaN;
  }
  return out ? Number(out) : NaN;
}

const ANY_DIGIT = '[0-9०-९০-৯]';

/**
 * kksongs.org's verses: a line that is only "(1)" / "(१)" / "(১)" starts verse 1 ("(6)*" marks a verse the page says
 * was added to the song). Lines before the first marker are returned as `before` (an introductory verse or a
 * heading). A song with no markers at all comes back as one verse.
 */
function splitMarkedVerses(lines) {
  const marker = new RegExp(`^\\((${ANY_DIGIT}+)\\)\\*?$`);
  const verses = [];
  const before = [];
  let current = null;
  for (const line of lines) {
    const m = line.match(marker);
    if (m) {
      current = { number: readNumber(m[1]), lines: [] };
      verses.push(current);
    } else if (line) {
      (current ? current.lines : before).push(line);
    }
  }
  if (!verses.length && before.length) return { before: [], verses: [{ number: 1, lines: before }] };
  return { before, verses };
}

/**
 * A stotra written the usual way, each verse closed by its number between double dandas: "… ॥ ३ ॥" (or "॥३॥",
 * "॥ ३॥", "|| 3 ||"). Every line up to and including the closing one is the verse. Lines after the last number are
 * returned as `after`; a line can be dropped first with `drop` (an array of RegExps).
 */
function splitNumberedVerses(lines, { drop = [] } = {}) {
  const close = new RegExp(`(?:॥|\\|\\|)\\s*(?:[^॥|]{0,30}?\\s)?(${ANY_DIGIT}+)\\s*(?:॥|\\|\\|)\\s*$`);
  const verses = [];
  let pending = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || drop.some((re) => re.test(line))) continue;
    pending.push(line);
    const m = line.match(close);
    if (m) {
      verses.push({ number: readNumber(m[1]), lines: pending });
      pending = [];
    }
  }
  return { verses, after: pending };
}

// ---------------------------------------------------------------------------------------------------------------------
// Scripts

const SCRIPT_RANGES = {
  deva: [0x0900, 0x097f],
  beng: [0x0980, 0x09ff],
  latn: [0x0041, 0x024f],
};

/** The share of letters in `text` that are in `script` (0–1); spaces, digits and punctuation are not counted. */
function scriptShare(text, script) {
  const [lo, hi] = SCRIPT_RANGES[script];
  const extraLatin = script === 'latn' ? [0x1e00, 0x1eff] : null;
  let letters = 0;
  let inScript = 0;
  for (const ch of text) {
    if (!/\p{L}|\p{M}/u.test(ch)) continue;
    letters += 1;
    const cp = ch.codePointAt(0);
    if ((cp >= lo && cp <= hi) || (extraLatin && cp >= extraLatin[0] && cp <= extraLatin[1]) || (script === 'latn' && cp >= 0x0300 && cp <= 0x036f)) {
      inScript += 1;
    }
  }
  return letters ? inScript / letters : 0;
}

/** Bengali script to Devanagari, letter for letter (the two blocks are laid out alike). */
function bengaliToDevanagari(text) {
  // NFC splits য় into য + nukta, so the pair is matched before the letters are mapped one by one.
  text = text.normalize('NFC').replace(/\u09AF\u09BC/g, '\u09AF');
  const special = { 'ৎ': 'त्', 'ৰ': 'र', 'ৱ': 'व' };
  let out = '';
  for (const ch of text.normalize('NFC')) {
    if (special[ch]) out += special[ch];
    else {
      const cp = ch.codePointAt(0);
      out += cp >= 0x0981 && cp <= 0x09ef ? String.fromCodePoint(cp - 0x80) : ch;
    }
  }
  return out;
}

const DEVA_CONSONANTS = {
  क: 'k', ख: 'kh', ग: 'g', घ: 'gh', ङ: 'ṅ', च: 'c', छ: 'ch', ज: 'j', झ: 'jh', ञ: 'ñ',
  ट: 'ṭ', ठ: 'ṭh', ड: 'ḍ', ढ: 'ḍh', ण: 'ṇ', त: 't', थ: 'th', द: 'd', ध: 'dh', न: 'n',
  प: 'p', फ: 'ph', ब: 'b', भ: 'bh', म: 'm', य: 'y', र: 'r', ल: 'l', ळ: 'ḷ', व: 'v',
  श: 'ś', ष: 'ṣ', स: 's', ह: 'h',
};
const DEVA_VOWELS = { अ: 'a', आ: 'ā', इ: 'i', ई: 'ī', उ: 'u', ऊ: 'ū', ऋ: 'ṛ', ॠ: 'ṝ', ऌ: 'ḷ', ए: 'e', ऐ: 'ai', ओ: 'o', औ: 'au' };
const DEVA_SIGNS = { 'ा': 'ā', 'ि': 'i', 'ी': 'ī', 'ु': 'u', 'ू': 'ū', 'ृ': 'ṛ', 'ॄ': 'ṝ', 'ॢ': 'ḷ', 'े': 'e', 'ै': 'ai', 'ो': 'o', 'ौ': 'au' };
const DEVA_OTHER = { 'ं': 'ṁ', 'ँ': 'ṁ', 'ः': 'ḥ', 'ऽ': "'", '।': '|', '॥': '||', ॐ: 'oṁ' };

/** Devanagari to IAST (with ṁ for the anusvara, as kksongs.org writes it). Only for comparing, not for showing. */
function devanagariToIast(text) {
  const chars = [...text.normalize('NFC').replace(/़/g, '')];
  let out = '';
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    if (DEVA_CONSONANTS[ch]) {
      out += DEVA_CONSONANTS[ch];
      const next = chars[i + 1];
      if (next === '्') i += 1;
      else if (DEVA_SIGNS[next]) {
        out += DEVA_SIGNS[next];
        i += 1;
      } else out += 'a';
    } else if (DEVA_VOWELS[ch]) out += DEVA_VOWELS[ch];
    else if (DEVA_OTHER[ch]) out += DEVA_OTHER[ch];
    else if (DIGITS.deva.includes(ch)) out += DIGITS.deva.indexOf(ch);
    else out += ch;
  }
  return out;
}

/**
 * kksongs.org writes ṁ and ṅ as m / n with a combining acute (ḿ, ń), which no font draws as the dot above. Folded to
 * the dotted letters, the curly apostrophe to the plain one, and a space before a hyphen closed.
 */
function normaliseRoman(text) {
  return text
    .normalize('NFD')
    .replace(/ḿ/g, 'ṁ')
    .replace(/Ḿ/g, 'Ṁ')
    .replace(/ń/g, 'ṅ')
    .replace(/Ń/g, 'Ṅ')
    .normalize('NFC')
    .replace(/[’‘]/g, "'")
    .replace(/\s+-(?=\S)/g, '-')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

// ---------------------------------------------------------------------------------------------------------------------
// Comparing two copies

/**
 * What is left of an Indic line for comparing: no spaces, hyphens, dashes, punctuation, digits or avagraha, and the
 * spellings two careful copies may differ in folded together (व/ब, which Bengali does not tell apart; a nasal before a
 * consonant written as a letter or as the anusvara).
 */
function indicSkeleton(text) {
  return text
    .normalize('NFC')
    .replace(/[\s\-–—।॥|,.;:!?'"’‘“”()\[\]0-9०-९ऽ‌‍]/g, '')
    .replace(/्([अआइईउऊऋएऐओऔ])/g, (m, vowel) => VOWEL_SIGN[vowel])
    .replace(/व/g, 'ब')
    .replace(/[ङञणनम]्(?=[क-ह])/g, 'ं')
    .replace(/ँ/g, 'ं');
}

// A consonant with a virama followed by a vowel letter (`र् उक्त`, the words split) reads as the joined form (`रुक्त`).
const VOWEL_SIGN = { अ: '', आ: 'ा', इ: 'ि', ई: 'ी', उ: 'ु', ऊ: 'ू', ऋ: 'ृ', ए: 'े', ऐ: 'ै', ओ: 'ो', औ: 'ौ' };

/** The same for a Roman line. */
function romanSkeleton(text) {
  return normaliseRoman(text)
    .toLowerCase()
    // At a line's end or before a consonant, a word-final m and ṁ are one sound written two ways (मधुरम् at the end
    // of a line, madhuraṁ on the Roman page). Before a vowel they are not (kṛṣṇam ekam), so that is left alone.
    .replace(/[mṁ](?=[\s,.;:!?|'"’”)]*$)/gm, 'ṁ')
    .replace(/[mṁ](?=[\s,.;:!?|'"’”)]+[^\saāiīuūṛṝḷeo,.;:!?|'"’”)])/g, 'ṁ')
    .replace(/[\s\-–—|,.;:!?'"’‘“”()\[\]0-9]/g, '')
    .replace(/[ṅñṇnm](?=[kgcjṭḍtdpbśṣsh])/g, 'ṁ')
    .replace(/ṁ(?=[yrlv])/g, 'ṁ');
}

/**
 * Where two strings differ, as hunks `{ a, b, at }` with a little context either side: the longest common
 * subsequence of their code points, then the runs that are not in it. Short strings only (a verse).
 */
function diffHunks(a, b, context = 6) {
  const x = [...a];
  const y = [...b];
  const n = x.length;
  const m = y.length;
  const lcs = Array.from({ length: n + 1 }, () => new Uint16Array(m + 1));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = x[i] === y[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const hunks = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && x[i] === y[j]) {
      i += 1;
      j += 1;
      continue;
    }
    const si = i;
    const sj = j;
    while ((i < n || j < m) && !(i < n && j < m && x[i] === y[j])) {
      if (j >= m || (i < n && lcs[i + 1][j] >= lcs[i][j + 1])) i += 1;
      else j += 1;
    }
    const before = x.slice(Math.max(0, si - context), si).join('');
    hunks.push({
      a: `${before}[${x.slice(si, i).join('')}]${x.slice(i, i + context).join('')}`,
      b: `${y.slice(Math.max(0, sj - context), sj).join('')}[${y.slice(sj, j).join('')}]${y.slice(j, j + context).join('')}`,
      at: si,
    });
  }
  return hunks;
}

export {
  decodeEntities,
  htmlToLines,
  readNumber,
  splitMarkedVerses,
  splitNumberedVerses,
  scriptShare,
  bengaliToDevanagari,
  decodeWindows1252,
  devanagariToIast,
  normaliseRoman,
  indicSkeleton,
  romanSkeleton,
  diffHunks,
};
