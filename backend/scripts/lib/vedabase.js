// Fetches and parses vedabase.io pages — the reference text (BBT editions of
// Prabhupada's books) the scraped source JSON is checked and repaired against.
// Used by scripts/repair-verse-source.js. Pages are cached on disk so a re-run
// (or a crash halfway) does not hit the site again.

import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://vedabase.io/en/library';
const DELAY_MS = 250;

function cacheFile(cacheDir, path) {
  mkdirSync(cacheDir, { recursive: true });
  return join(cacheDir, createHash('sha1').update(path).digest('hex') + '.html');
}

/** One page from the site, no cache. null when the site has no such page. */
async function download(path) {
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}/`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      await new Promise((r) => setTimeout(r, DELAY_MS));
      return html;
    } catch (err) {
      if (attempt === 4) throw new Error(`${path}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
}

async function fetchPage(cacheDir, path) {
  const file = cacheFile(cacheDir, path);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  const html = await download(path);
  if (html) writeFileSync(file, html);
  return html;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', nbsp: ' ', '#39': "'", '#x27': "'", rsquo: '’', lsquo: '‘' };
function decode(s) {
  return s.replace(/&(#x?[0-9a-fA-F]+|[a-z]+);/g, (m, e) => {
    if (ENTITIES[e]) return ENTITIES[e];
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return m;
  });
}

function text(html) {
  return decode(html.replace(/<br\s*\/?>/gi, '\n').replace(/<\/(div|p)>/gi, '\n').replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+/g, ' ')
    .replace(/ ?\n ?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .trim();
}

function stripScripts(html) {
  return html.replace(/<script[\s\S]*?<\/script>/g, '');
}

/** Chapter page → { title, verses: ['1', '3-4', ...] } in reading order. */
async function chapterIndex(cacheDir, book, canto, chapter) {
  const prefix = canto ? `${book}/${canto}/${chapter}` : `${book}/${chapter}`;
  const html = await fetchPage(cacheDir, prefix);
  if (!html) return null;
  const page = stripScripts(html);
  const h1 = page.match(/<h1[^>]*>([\s\S]*?)<\/h1>/);
  const re = new RegExp(`href="/en/library/${prefix}/(\\d+(?:-\\d+)?)/"`, 'g');
  const verses = [];
  for (const m of page.matchAll(re)) if (!verses.includes(m[1])) verses.push(m[1]);
  return { title: h1 ? text(h1[1]) : null, verses };
}

/**
 * Word-by-word entries of a synonyms section → [{ word, meaning }], in order.
 * Read from the markup, not from the joined text, so a ";" inside a meaning
 * cannot split an entry: every entry ends with the meaning's closing span
 * followed by "; " or "." and the entry's own closing span.
 */
function synonymPairs(sectionHtml) {
  if (!sectionHtml) return [];
  const MARK = '\u0001';
  const marked = sectionHtml.replace(/<\/span>[;.] ?<\/span>/g, MARK);
  return text(marked.replace(/<\/?div[^>]*>/g, ''))
    .split(MARK)
    .map((e) => e.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .map((e) => {
      const i = e.indexOf(' — ');
      if (i === -1) return { word: null, meaning: e };
      return { word: e.slice(0, i).trim(), meaning: e.slice(i + 3).trim() };
    });
}

/** The page's HTML → the parts of one verse (or compound), as vedabase prints them. */
function parseVersePage(html) {
  const page = stripScripts(html);
  const section = (name) => {
    const m = page.match(new RegExp(`<div class="av-${name}">([\\s\\S]*?)(?=<div class="av-|<div class="mt-10)`));
    return m ? m[1].replace(/<h2[\s\S]*?<\/h2>/, '') : null;
  };
  const verseText = section('verse_text');
  const syn = section('synonyms');
  const purport = section('purport');
  const translation = section('translation');
  const devanagari = section('devanagari');
  return {
    devanagari: devanagari ? text(devanagari) : null,
    transliteration: verseText ? text(verseText.replace(/<\/div>\s*<\/div>/g, '\n')) : null,
    synonyms: syn ? text(syn.replace(/<\/span>; ?<\/span>/g, ' ;</span>')) : null,
    synonymPairs: synonymPairs(syn),
    translation: translation ? text(translation) : null,
    purport: purport ? text(purport) : null,
  };
}

const versePath = (book, canto, chapter, range) => (canto ? `${book}/${canto}/${chapter}/${range}` : `${book}/${chapter}/${range}`);

/** Verse page → the parts of one verse (or compound), as vedabase prints them. */
async function versePage(cacheDir, book, canto, chapter, range) {
  const html = await fetchPage(cacheDir, versePath(book, canto, chapter, range));
  return html ? parseVersePage(html) : null;
}

/**
 * Same as versePage, but the cache holds the parsed parts as small JSON rather
 * than the whole HTML page — thirteen thousand Bhagavatam verses would
 * otherwise be over a gigabyte of markup nobody reads twice.
 */
async function versePageParsed(cacheDir, book, canto, chapter, range) {
  const path = versePath(book, canto, chapter, range);
  const file = cacheFile(cacheDir, path).replace(/\.html$/, '.json');
  if (existsSync(file)) return JSON.parse(readFileSync(file, 'utf8'));
  const html = await download(path);
  const parsed = html ? parseVersePage(html) : null;
  // A 200 with no verse on it is the site failing, not the verse being empty: don't remember it.
  if (parsed && !parsed.translation && !parsed.transliteration && !parsed.devanagari && !parsed.synonyms) {
    throw new Error(`${path}: the page has no verse content`);
  }
  writeFileSync(file, JSON.stringify(parsed));
  return parsed;
}

/** "ṛ" → "r" etc., the plain-letter spelling cantos 1-9 of the source use. */
function plainRoman(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export { chapterIndex, versePage, versePageParsed, parseVersePage, synonymPairs, plainRoman };
