// Fetches the original text of each prayer in lib/prayer-catalogue.js into public/prayers/json/<slug>.json, and writes
// public/prayers/PRAYERS.md (the list, with what came from where) from the same catalogue.
//
//   node scripts/fetch-prayers.js                      every prayer still to fetch
//   node scripts/fetch-prayers.js --only gurvastakam,siksastakam
//   node scripts/fetch-prayers.js --refresh            write every file again (pages still come from the cache)
//   node scripts/fetch-prayers.js --offline            use only pages already in the cache; never touch the network
//   node scripts/fetch-prayers.js --cache <dir>        where fetched pages are kept (default: the system temp folder)
//
// Safe to run again: a prayer whose file is already written is skipped unless --refresh or --only names it, and every
// page fetched is kept in the cache, so a second run sends no requests. Requests go one at a time, a little over a
// second apart, under a User-Agent that says who we are.
//
// Nothing here touches the database or S3. The JSON is the hand-over: an import (or the admin panel) takes it from
// here. What a prayer file holds is described in PRAYERS.md.
//
// Sources:
//   kksongs  kksongs.org. Each song has three pages: Roman (the song page), Devanagari (`_deva`) and Bengali (`_beng`).
//            We take the lyrics only, never the translation or the purport (the BBT's, under copyright). A Sanskrit
//            song's text is its Devanagari; a Bengali song's is its Bengali, with the Devanagari kept beside it.
//   wiki     Wikisource (sa / hi / mr), read through the MediaWiki API as wikitext. One copy only (Devanagari), so there
//            is nothing to check it against: every typo the page has is put right by an edit in the catalogue, with
//            its reason, and the verse numbers are checked to run 1, 2, 3 …. The texts are public domain; the pages'
//            own CC BY-SA licence is named in the file.

import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { PRAYERS } from './lib/prayer-catalogue.js';
import {
  decodeEntities,
  htmlToLines,
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
} from './lib/prayer-text.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(HERE, '..', 'public', 'prayers');
const JSON_DIR = path.join(OUT_DIR, 'json');

const USER_AGENT = 'HariHariBolPrayerFetch/0.1 (https://hariharibol.com; prayer import)';
const DELAY_MS = 1300;

// ---------------------------------------------------------------------------------------------------------------------
// Arguments

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const option = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const ONLY = option('only') ? option('only').split(',').map((s) => s.trim()).filter(Boolean) : null;
const REFRESH = flag('refresh');
const OFFLINE = flag('offline');
const CACHE_DIR = option('cache') || path.join(os.tmpdir(), 'hariharibol-prayer-fetch');

if (ONLY) {
  const unknown = ONLY.filter((slug) => !PRAYERS.some((p) => p.slug === slug));
  if (unknown.length) {
    console.error(`Not in the catalogue: ${unknown.join(', ')}`);
    process.exit(1);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Fetching, politely and once

let lastRequestAt = 0;

/** A page's bytes from the cache, else from the network (kept in the cache). `null` for a 404. */
async function getPage(url) {
  const file = path.join(CACHE_DIR, createHash('sha1').update(url).digest('hex'));
  if (existsSync(`${file}.404`)) return null;
  if (existsSync(file)) return readFile(file);
  if (OFFLINE) throw new Error(`not in the cache (--offline): ${url}`);

  for (let attempt = 1; ; attempt += 1) {
    const wait = lastRequestAt + DELAY_MS + Math.random() * 300 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastRequestAt = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT } });
    if (res.status === 404) {
      await writeFile(`${file}.404`, '');
      return null;
    }
    if (res.ok) {
      const bytes = Buffer.from(await res.arrayBuffer());
      await writeFile(file, bytes);
      return bytes;
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 5) {
      await new Promise((r) => setTimeout(r, 5000 * attempt));
      continue;
    }
    throw new Error(`${res.status} ${res.statusText} for ${url}`);
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// kksongs.org

const KK_BASE = 'https://kksongs.org';
const KK_LANGUAGES = { Sanskrit: 'sa', Bengali: 'bn', Brajabuli: 'bn' };
const KK_LYRICS_END = /^(WORD[- ]FOR[- ]WORD TRANSLATION|TRANSLATION|Remarks\/? ?Extra Information|PURPORT|MUSICAL NOTATION|UPDATED)\b/i;

/** The site's pages are Windows-1252 HTML with the Indic letters as numeric entities. */
const kkLines = (bytes) => htmlToLines(decodeWindows1252(bytes)).filter(Boolean);

/** "Song Name: …", "Author: …" and the rest, from the lines above the lyrics. */
function kkHeader(lines) {
  const header = {};
  for (const line of lines) {
    const m = line.match(/^(Song Name|Official Name|Author|Book Name|Language|Presented In):\s*(.*)$/i);
    if (m) header[m[1].toLowerCase()] = m[2].trim();
    if (/^LYRICS:?$/.test(line)) break;
  }
  return header;
}

/**
 * The verses between "LYRICS" and the first heading after them. A few script pages have no "LYRICS" heading: there
 * the lyrics start after the header, past the one-letter link that switches script ("A", "अ").
 */
function kkVerses(lines) {
  let start = lines.findIndex((l) => /^LYRICS:?$/.test(l));
  if (start < 0) {
    start = lines.findIndex((l) => /^Language:/i.test(l));
    if (start < 0) throw new Error('no LYRICS heading and no header');
    while (lines[start + 1] && [...lines[start + 1]].length === 1) start += 1;
  }
  const end = lines.findIndex((l, i) => i > start && KK_LYRICS_END.test(l));
  return splitMarkedVerses(lines.slice(start + 1, end < 0 ? undefined : end));
}

/**
 * The song page's links to its Devanagari and Bengali pages. They are often not named after the song page
 * (`bhajabhakata.html` links `bhajabhakatavatsala_beng.html`), so they are read, not guessed; a page with no such
 * links falls back to the song page's own name.
 */
function kkScriptLinks(bytes, letter, name) {
  const html = decodeWindows1252(bytes);
  const found = {};
  for (const [, href] of html.matchAll(/href="([^"]*\/unicode\/[^"]*_(deva|beng)\.html)"/gi)) {
    const key = /_deva\.html$/i.test(href) ? 'devanagari' : 'bengali';
    found[key] ||= new URL(href, KK_BASE).pathname;
  }
  return {
    devanagari: `${KK_BASE}${found.devanagari || `/unicode/${letter}/${name}_deva.html`}`,
    bengali: `${KK_BASE}${found.bengali || `/unicode/${letter}/${name}_beng.html`}`,
  };
}

async function fetchKksongs(source) {
  const [letter, name] = source.path.split('/');
  const urls = { roman: `${KK_BASE}/songs/${letter}/${name}.html` };
  const songPage = await getPage(urls.roman);
  if (!songPage) throw new Error(`song page not found: ${urls.roman}`);
  Object.assign(urls, kkScriptLinks(songPage, letter, name));

  const pages = { roman: kkLines(songPage) };
  for (const key of ['devanagari', 'bengali']) {
    const bytes = await getPage(urls[key]);
    pages[key] = bytes && kkLines(bytes);
  }

  const header = kkHeader(pages.roman);
  const copies = {};
  for (const [key, lines] of Object.entries(pages)) {
    if (lines) copies[key] = kkVerses(lines);
  }
  return {
    header,
    language: KK_LANGUAGES[header.language] || null,
    copies,
    urls: Object.fromEntries(Object.entries(urls).filter(([key]) => pages[key])),
    sourceName: 'Kṛṣṇa Kīrtana Songs (kksongs.org)',
    sourceUrl: urls.roman,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Wikisource

const WIKI_NAMES = { sa: 'Sanskrit', hi: 'Hindi', mr: 'Marathi' };
const DEVA = 'ऀ-ॿ';

// Lines that are never the text: a heading between double dandas with no verse number ("॥ श्रीगणेशाय नमः ॥",
// "॥ फलश्रुतिः॥") and a colophon ("इति श्रीमच्छङ्करभगवतः कृतौ …"). A prayer drops more with `source.drop`.
const WIKI_DROP = [new RegExp(`^॥[^॥0-9०-९]*॥$`), /^॥?\s*इति\s/];
const WIKI_VERSE_NUMBER = /\s*॥\s*[0-9०-९]+\s*॥\s*$/;

/** The `{{header | author = … }}` fields, before the templates are taken out. */
function wikiHeader(wikitext) {
  const m = wikitext.match(/\{\{\s*(?:header|शीर्ष)\s*([\s\S]*?)\n\}\}/i);
  const header = {};
  for (const [, key, value] of (m ? m[1] : '').matchAll(/\|\s*([^=|\n]+?)\s*=\s*([^|\n]*)/g)) {
    const text = value.replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1').trim();
    if (text && !text.startsWith('{{')) header[key] = text;
  }
  return header;
}

/**
 * A page's wikitext as plain lines of Devanagari. Markup goes (templates, categories, tags, bold), and the ways pages
 * type what they could not type are put right: "।।" and "||" for ॥, "|" for ।, "s" or "%" for the avagraha ऽ, a colon
 * for the visarga ः. Joiners (U+200D) go too.
 */
function wikiText(wikitext) {
  let text = wikitext;
  for (let before = ''; before !== text; ) {
    before = text;
    text = text.replace(/\{\{[^{}]*\}\}/g, '');
  }
  return decodeEntities(
    text
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/\[\[[^\]|]*:[^\]]*\]\]/g, '')
      .replace(/\[\[(?:[^|\]]*\|)?([^\]]*)\]\]/g, '$1')
      .replace(/<\/?br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '\n')
      .replace(/'''|''/g, ''),
  )
    .replace(/‍/g, '')
    .replace(/।।|\|\|/g, '॥')
    .replace(/\|/g, '।')
    .replace(new RegExp(`([${DEVA}])[s%](?=[${DEVA}])`, 'g'), '$1ऽ')
    .replace(new RegExp(`([${DEVA}]):`, 'g'), '$1ः')
    // A danda set straight after a letter gets the space printed books give it.
    .replace(/([\u0900-\u0963\u0970-\u097F])([।॥])/g, '$1 $2')
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n');
}

/** Stanzas between blank lines, for a page whose verses are not all numbered (a dhyāna above them, a phala after). */
function splitStanzas(lines, drop) {
  const verses = [];
  let current = [];
  for (const line of [...lines, '']) {
    if (line && !drop.some((re) => re.test(line))) current.push(line);
    else if (!line && current.length) {
      verses.push({ number: verses.length + 1, lines: current });
      current = [];
    }
  }
  return verses;
}

/**
 * `source`: `{ kind: 'wiki', site: 'sa', title, drop?, keep?, stanzas?, intro?, keepAfter?, midDanda?, halfLines? }`. Verses are cut at their numbers
 * ("… ॥ ३ ॥"), or at blank lines with `stanzas`. Lines after the last number (a phala with no number) are a last
 * verse with `keepAfter`, else they are listed as removed. A dhyāna numbered 1 ahead of the stotra's own verse 1 is
 * kept as the introductory verse. An edit with no `verse` is made to the page's text before it is cut into verses (a
 * missing danda that would run two verses together).
 */
async function fetchWiki(source, prayer) {
  const api = `https://${source.site}.wikisource.org/w/api.php?action=query&prop=revisions&rvprop=content&rvslots=main&titles=${encodeURIComponent(source.title)}&redirects=1&format=json&formatversion=2`;
  const bytes = await getPage(api);
  const page = bytes && JSON.parse(bytes.toString('utf8')).query.pages[0];
  if (!page || page.missing) throw new Error(`no such Wikisource page: ${source.site}:${source.title}`);
  const wikitext = page.revisions[0].slots.main.content;

  let text = wikiText(wikitext);
  const edits = [];
  for (const edit of (prayer.edits || []).filter((e) => e.verse == null)) {
    if (!text.includes(edit.from)) throw new Error(`${prayer.slug}: edit not applied, "${edit.from}" is not on the page. Has the source been corrected?`);
    text = text.replace(edit.from, edit.to);
    edits.push({ verse: null, field: 'devanagari', from: edit.from, to: edit.to, why: edit.why });
  }

  // `keep`: a verse line the colophon rule would take (one that starts with इति) stays.
  const keep = source.keep || [];
  const drop = [...WIKI_DROP, ...(source.drop || [])].map((re) => ({ test: (line) => re.test(line) && !keep.some((k) => k.test(line)) }));
  const lines = text.split('\n');
  // Headings, colophons and the lines a prayer's `drop` names are left out, and listed so the file says so.
  const removed = lines.filter((line) => line && drop.some((re) => re.test(line))).map((line) => ({ pageVerse: null, copy: 'devanagari', line }));
  let verses;
  let before = [];
  const warnings = [];
  if (source.stanzas) {
    verses = splitStanzas(lines, drop);
    // `intro`: the first stanza is a dhyāna above the stotra's own verses.
    if (source.intro && verses.length > 1) before = verses.shift().lines;
  } else {
    const split = splitNumberedVerses(lines, { drop });
    verses = split.verses;
    // A dhyāna numbered 1 by itself, with the stotra numbered from 1 again after it, is the introductory verse.
    if (verses.length > 1 && verses[0].number === 1 && verses[1].number === 1) before = verses.shift().lines;
    if (split.after.length && source.keepAfter) verses.push({ number: (verses.at(-1)?.number || 0) + 1, lines: split.after, unnumbered: true });
    else for (const line of split.after) removed.push({ pageVerse: null, copy: 'devanagari', line });
    if (!verses.length) throw new Error(`${prayer.slug}: no numbered verse on the page`);
    const numbers = verses.filter((v) => !v.unnumbered).map((v) => v.number);
    if (numbers.some((n, i) => n !== i + 1)) warnings.push(`the page numbers its verses ${numbers.join(', ')}`);
    verses = verses.map((v, i) => ({ number: i + 1, lines: v.lines }));
  }
  for (const v of [...verses, { lines: before }].filter((v) => v.lines.length)) {
    v.lines[v.lines.length - 1] = v.lines.at(-1).replace(WIKI_VERSE_NUMBER, ' ॥');
    // `midDanda`: a page that closes every half-verse with ॥ gets the single danda inside the verse.
    if (source.midDanda) for (let i = 0; i < v.lines.length - 1; i += 1) v.lines[i] = v.lines[i].replace(/\s*॥$/, ' ।');
    // `halfLines`: a page that writes each verse on one line gets it broken after the first half.
    if (source.halfLines && v.lines.length === 1) v.lines.splice(0, 1, ...v.lines[0].split(/(?<= ।) /, 2));
  }

  const titleUrl = encodeURIComponent(page.title.replace(/ /g, '_'));
  return {
    header: wikiHeader(wikitext),
    language: source.site,
    copies: { devanagari: { before, verses } },
    urls: { devanagari: `https://${source.site}.wikisource.org/wiki/${titleUrl}`, api },
    sourceName: `Wikisource (${WIKI_NAMES[source.site] || source.site}), CC BY-SA 4.0`,
    sourceUrl: `https://${source.site}.wikisource.org/wiki/${titleUrl}`,
    edits,
    removed,
    warnings,
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// Checks

/**
 * Compares the copies verse by verse and says where they part. The Bengali page is read back into Devanagari and set
 * against the Devanagari page for every song; the Roman page is set against the Devanagari read into IAST only for a
 * Sanskrit song (a Bengali song's Roman follows the Bengali pronunciation, so it differs on purpose).
 */
function checkCopies(verses, language) {
  const problems = [];
  for (const v of verses) {
    if (v.devanagari && v.bengali) {
      const a = indicSkeleton(v.devanagari);
      const b = indicSkeleton(bengaliToDevanagari(v.bengali));
      if (a !== b) problems.push({ verse: v.position, between: 'devanagari/bengali', hunks: diffHunks(a, b, 4).slice(0, 6) });
    }
    if (language === 'sa' && v.devanagari && v.roman) {
      const a = romanSkeleton(devanagariToIast(v.devanagari));
      const b = romanSkeleton(v.roman);
      if (a !== b) problems.push({ verse: v.position, between: 'devanagari/roman', hunks: diffHunks(a, b, 4).slice(0, 6) });
    }
  }
  return problems;
}

/** The share of each copy's letters in its own script; anything well under 1 is a page that is not what it says. */
function scriptShares(verses) {
  const all = (key) => verses.map((v) => v[key] || '').join(' ');
  const out = {};
  if (verses.some((v) => v.devanagari)) out.devanagari = Number(scriptShare(all('devanagari'), 'deva').toFixed(3));
  if (verses.some((v) => v.bengali)) out.bengali = Number(scriptShare(all('bengali'), 'beng').toFixed(3));
  if (verses.some((v) => v.roman)) out.roman = Number(scriptShare(all('roman'), 'latn').toFixed(3));
  return out;
}

const plain = (s) =>
  (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/w/g, 'v')
    .replace(/[^a-z]/g, '');

/** "Rūpa Gosvāmī" and "Rupa Goswami" are one name, and so are "Śaṅkarācārya" and "Adi Sankaracarya". */
const sameName = (a, b) => plain(a).includes(plain(b)) || plain(b).includes(plain(a));

// ---------------------------------------------------------------------------------------------------------------------
// One prayer

// A whole line in brackets is not the text: a label ("(Invocation)", "(শ্রী তুলসী প্রণাম)") or a line added when it is
// sung ("(অন্তরা ১)" and the antarā after it). Such lines are taken out and listed in the file's checks.
const KK_ASIDE = /^\(.*\)$/;

/**
 * Lines a verse's copies up by number. The unnumbered lines some songs carry above verse 1 (an introductory verse)
 * are kept as their own first verse, marked `intro`, in every copy that has them.
 */
function alignCopies(copies) {
  const byKey = {};
  const asides = [];
  for (const [key, { before, verses }] of Object.entries(copies)) {
    const list = verses.map((v) => ({ number: v.number, lines: v.lines }));
    if (before.length) list.unshift({ number: 0, lines: before });
    for (const v of list) {
      for (const line of v.lines.filter((l) => KK_ASIDE.test(l.trim()))) asides.push({ number: v.number, copy: key, line });
      v.text = v.lines.filter((l) => !KK_ASIDE.test(l.trim())).join('\n');
    }
    byKey[key] = list.filter((v) => v.text);
  }
  const numbers = [...new Set(Object.values(byKey).flatMap((list) => list.map((v) => v.number)))].sort((a, b) => a - b);
  const verses = numbers.map((number, i) => {
    const verse = { position: i + 1 };
    if (number === 0) verse.intro = true;
    for (const [key, list] of Object.entries(byKey)) {
      const found = list.find((v) => v.number === number);
      if (found) verse[key] = key === 'roman' ? found.text.split('\n').map(normaliseRoman).join('\n') : found.text;
    }
    return verse;
  });
  // Numbered as on the page (0: above verse 1), since `join` and `select` renumber the verses afterwards.
  const removed = asides.map((a) => ({ pageVerse: a.number, copy: a.copy, line: a.line }));
  return { verses, removed };
}

const COPY_KEYS = ['devanagari', 'bengali', 'roman'];
const renumber = (verses) => verses.map((v, i) => ({ ...v, position: i + 1 }));

/**
 * `join`: verses one copy splits in two and another keeps as one are made one verse, each copy's lines in order. One
 * group (`{ verses: [3, 4] }`) or several (`[{ verses: [1, 2] }, { verses: [3, 4] }]`), numbered as on the page.
 */
function joinVerses(verses, join) {
  if (!join) return verses;
  const gone = [];
  for (const group of Array.isArray(join) ? join : [join]) {
    const [first, ...rest] = group.verses;
    const target = verses.find((v) => v.position === first);
    for (const n of rest) {
      const other = verses.find((v) => v.position === n);
      if (!target || !other) throw new Error(`join: there is no verse ${!target ? first : n}`);
      for (const key of COPY_KEYS) {
        // `mid`: the danda a part that is now inside the verse ends with (a half-verse the page closed with ॥).
        if (group.mid && target[key]) target[key] = target[key].replace(/\s*॥$/, ` ${group.mid}`);
        if (other[key]) target[key] = target[key] ? `${target[key]}\n${other[key]}` : other[key];
      }
    }
    gone.push(...rest);
  }
  return renumber(verses.filter((v) => !gone.includes(v.position)));
}

/** `select`: only these verses are the prayer (the page holds more: the whole Upaniṣad, a Bengali coda). */
function selectVerses(verses, select) {
  if (!select) return verses;
  const missing = select.verses.filter((n) => !verses.some((v) => v.position === n));
  if (missing.length) throw new Error(`select: there is no verse ${missing.join(', ')}`);
  const kept = renumber(verses.filter((v) => select.verses.includes(v.position)));
  // An introductory verse is only that when something follows it.
  if (kept.length === 1) delete kept[0].intro;
  return kept;
}

function applyEdits(prayer, verses, language) {
  const done = [];
  for (const edit of (prayer.edits || []).filter((e) => e.verse != null)) {
    const verse = verses.find((v) => v.position === edit.verse);
    const key = edit.field === 'text' ? (language === 'bn' ? 'bengali' : 'devanagari') : edit.field;
    if (!verse || !verse[key] || !verse[key].includes(edit.from)) {
      throw new Error(`${prayer.slug}: edit not applied, "${edit.from}" is not in verse ${edit.verse} (${key}). Has the source been corrected?`);
    }
    verse[key] = verse[key].replace(edit.from, edit.to);
    done.push({ verse: edit.verse, field: key, from: edit.from, to: edit.to, why: edit.why });
  }
  return done;
}

const FETCHERS = { kksongs: fetchKksongs, wiki: fetchWiki };

async function buildPrayer(prayer) {
  const fetcher = FETCHERS[prayer.source.kind];
  if (!fetcher) throw new Error(`${prayer.slug}: no fetcher for source kind ${prayer.source.kind}`);
  if (prayer.source.kind === 'kksongs' && (prayer.edits || []).some((e) => e.verse == null)) {
    throw new Error(`${prayer.slug}: a kksongs edit needs its verse`);
  }
  const got = await fetcher(prayer.source, prayer);

  const language = prayer.originalLanguage || got.language;
  if (!language) throw new Error(`${prayer.slug}: language "${got.header.language}" is not one we know; set originalLanguage`);

  const { verses: lined, removed: asides } = alignCopies(got.copies);
  const removed = [...(got.removed || []), ...asides];
  const joined = joinVerses(lined, prayer.join);
  const edits = [...(got.edits || []), ...applyEdits(prayer, joined, language)];
  const aligned = selectVerses(joined, prayer.select);

  const counts = Object.fromEntries(Object.keys(got.copies).map((key) => [key, joined.filter((v) => v[key]).length]));
  const problems = checkCopies(aligned, language);
  const authorOnPage = got.header.author || '';
  const author = prayer.author || authorOnPage;
  const warnings = [...(got.warnings || [])];
  if (new Set(Object.values(counts)).size > 1) warnings.push(`verse counts differ between copies: ${JSON.stringify(counts)}`);
  if (prayer.author && authorOnPage && !sameName(prayer.author, authorOnPage) && !prayer.authorWhy) {
    warnings.push(`author "${prayer.author}" here, "${authorOnPage}" on the page`);
  }
  if (got.language && prayer.originalLanguage && got.language !== prayer.originalLanguage) {
    warnings.push(`language ${prayer.originalLanguage} here, ${got.header.language} on the page`);
  }

  const textKey = language === 'bn' ? 'bengali' : 'devanagari';
  const verses = aligned.map((v) => ({
    position: v.position,
    ...(v.intro ? { intro: true } : {}),
    text: v[textKey] || null,
    roman: v.roman || null,
    ...(language === 'bn' ? { devanagari: v.devanagari || null } : {}),
    meaning: null,
  }));
  if (verses.some((v) => !v.text)) warnings.push(`a verse has no ${textKey} text`);

  return {
    slug: prayer.slug,
    title: prayer.title,
    titleOriginal: prayer.titleOriginal,
    category: prayer.category,
    sortOrder: prayer.sortOrder,
    originalLanguage: language,
    summary: prayer.summary,
    about: prayer.about,
    author,
    ...(prayer.authorWhy ? { authorNote: prayer.authorWhy } : {}),
    reference: prayer.reference || got.header['book name'] || '',
    sourceName: got.sourceName,
    sourceUrl: got.sourceUrl,
    tradition: prayer.tradition,
    deity: prayer.deity,
    occasions: prayer.occasions,
    festivals: prayer.festivals,
    verses,
    sourcePages: got.urls,
    sourceHeader: got.header,
    ...(prayer.join ? { joined: prayer.join } : {}),
    ...(prayer.select ? { selected: prayer.select } : {}),
    edits,
    checks: {
      verseCounts: counts,
      linesRemoved: removed,
      scriptShares: scriptShares(aligned),
      copiesAgree: problems.length === 0,
      differences: problems,
      warnings,
    },
    fetchedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// The list

const CATEGORY_NAMES = {
  morning: 'Morning', evening: 'Evening', meals: 'Meals', guru: 'Guru', deity: 'Deity', aarti: 'Aarti', peace: 'Peace', other: 'Other',
};

function writeList(index) {
  const rows = PRAYERS.map((p) => {
    const got = index[p.slug];
    const status = p.status === 'gap' ? 'wanted, no source yet' : p.status === 'excluded' ? 'excluded' : got ? (got.copiesAgree ? 'fetched' : 'fetched, check') : 'to fetch';
    const festivals = (p.festivals || []).join(', ');
    return `| ${p.title} | ${p.titleOriginal || ''} | ${CATEGORY_NAMES[p.category] || p.category} | ${p.tradition} | ${got ? got.verses : ''} | ${festivals} | ${status} |`;
  });
  const notes = PRAYERS.filter((p) => p.note).map((p) => `- **${p.title}**: ${p.note}`);
  return [
    '# Prayers',
    '',
    'The prayers the app should carry, and where each one\'s original text came from. Written by',
    '`scripts/fetch-prayers.js` from `scripts/lib/prayer-catalogue.js`; edit the catalogue, not this file, and run',
    '`npm run fetch:prayers` again.',
    '',
    'Nothing here is in the database or on S3 yet: the files in `json/` are the hand-over to an import.',
    '',
    '## Where the texts came from',
    '',
    '- **kksongs.org** (Kṛṣṇa Kīrtana Songs), for the Vaiṣṇava songs. Each song has a Roman, a Devanagari and a Bengali',
    '  page, read one against the other. Only the lyrics are taken, never the English translation or the purport (the',
    '  BBT\'s, under copyright). A Sanskrit song\'s text is its Devanagari; a Bengali song\'s is its Bengali, with the',
    '  Devanagari kept beside it where the site has one. Both have the Roman beside them.',
    '- **Wikisource** (Sanskrit), for the rest, read as wikitext through its API. The texts are centuries old and public',
    '  domain; the pages are CC BY-SA 4.0, named in each file\'s `sourceName`. One copy, in Devanagari only, so these',
    '  prayers have no Roman yet (`roman` is null): how it is written (IAST or the kksongs style) is the owner\'s call.',
    '- **Not used**: sanskritdocuments.org (its FAQ forbids copying its texts in bulk for other sites or apps),',
    '  stotranidhi.com (all rights reserved), vignanam.org (a bot check in front of its pages) and',
    '  scsmathinternational.com (behind Cloudflare). Nothing was taken from behind a bot check.',
    '',
    'Every typo put right is in the file\'s `edits`, with its reason, and a correction the page no longer needs stops the',
    'run. **`meaning` is null everywhere**: the English on these sites is modern and under copyright, so meanings are',
    'ours to write (or a translation run\'s). **No text has been read by someone who reads the script**; each needs that',
    'before it is published.',
    '',
    '## Status',
    '',
    '- **fetched**: the copies agree, or there is one copy, and the verse numbers run 1, 2, 3 ….',
    '- **fetched, check**: kksongs\' Roman, Devanagari and Bengali copies differ in places; the differences are in the',
    '  file\'s `checks.differences` and want reading once.',
    '- **wanted, no source yet**: no copy free to reuse was found; why is under Notes.',
    '- **excluded**: not to be published; why is under Notes.',
    '',
    '## A prayer file',
    '',
    '`json/<slug>.json`; `json/_index.json` lists every file with its title, category, language, verse count and checks.',
    '',
    '| Field | What it holds |',
    '|---|---|',
    '| `slug`, `title`, `titleOriginal` | The title in English (with diacritics) and in the original\'s own script |',
    '| `category`, `sortOrder` | As the `Prayer` model has them (`config/prayer.js`) |',
    '| `originalLanguage` | A `config/prayer.js` language code (`sa`, `bn` …) |',
    '| `summary`, `about` | Our own words |',
    '| `author`, `reference` | As tradition gives them |',
    '| `sourceName`, `sourceUrl` | Where the text came from, and its licence where it has one |',
    '| `tradition`, `deity`, `occasions`, `festivals` | When and by whom it is said; `festivals` are `services/festivals.js` slugs |',
    '| `verses[]` | `position`, `text` (the original script, lines split by `\\n`), `roman`, `devanagari` (a Bengali song\'s), `meaning` (null) |',
    '| `sourcePages`, `sourceHeader` | Every page read, and what the page itself says about the song |',
    '| `edits` | Each correction made to the page\'s text, and why |',
    '| `checks` | Verse counts per copy, lines dropped (headings, colophons, refrains), differences between copies, warnings |',
    '| `fetchedAt` | When the file was written |',
    '',
    '## The list',
    '',
    '| Prayer | Original title | Category | Tradition | Verses | Festivals | Status |',
    '|---|---|---|---|---|---|---|',
    ...rows,
    '',
    ...(notes.length ? ['## Notes', '', ...notes, ''] : []),
  ].join('\n');
}

// ---------------------------------------------------------------------------------------------------------------------

await mkdir(JSON_DIR, { recursive: true });
await mkdir(CACHE_DIR, { recursive: true });

const indexFile = path.join(JSON_DIR, '_index.json');
const index = existsSync(indexFile) ? JSON.parse(await readFile(indexFile, 'utf8')) : {};
let written = 0;
let skipped = 0;
const failed = [];

for (const prayer of PRAYERS) {
  if ((prayer.status || 'fetch') !== 'fetch') continue;
  if (ONLY && !ONLY.includes(prayer.slug)) continue;
  const file = path.join(JSON_DIR, `${prayer.slug}.json`);
  if (!REFRESH && !ONLY && existsSync(file)) {
    skipped += 1;
    continue;
  }
  try {
    const out = await buildPrayer(prayer);
    await writeFile(file, `${JSON.stringify(out, null, 2)}\n`);
    index[prayer.slug] = {
      title: out.title,
      category: out.category,
      originalLanguage: out.originalLanguage,
      verses: out.verses.length,
      copiesAgree: out.checks.copiesAgree,
      warnings: out.checks.warnings.length,
      file: `${prayer.slug}.json`,
    };
    written += 1;
    const flagText = out.checks.copiesAgree && !out.checks.warnings.length ? '' : `  (${out.checks.differences.length} differences, ${out.checks.warnings.length} warnings)`;
    console.log(`${prayer.slug}: ${out.verses.length} verses, ${out.originalLanguage}${flagText}`);
  } catch (err) {
    failed.push(prayer.slug);
    console.error(`${prayer.slug}: ${err.message}`);
  }
}

// A prayer taken out of the catalogue, or marked a gap or excluded since, leaves the index and its file goes.
for (const slug of Object.keys(index)) {
  if (PRAYERS.some((p) => p.slug === slug && (p.status || 'fetch') === 'fetch')) continue;
  delete index[slug];
  await rm(path.join(JSON_DIR, `${slug}.json`), { force: true });
}
await writeFile(indexFile, `${JSON.stringify(index, null, 2)}\n`);
await writeFile(path.join(OUT_DIR, 'PRAYERS.md'), writeList(index));

console.log(`${written} written, ${skipped} already there, ${failed.length} failed${failed.length ? `: ${failed.join(', ')}` : ''}`);
process.exit(failed.length ? 1 : 0);
