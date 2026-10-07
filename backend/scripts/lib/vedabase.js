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

async function fetchPage(cacheDir, path) {
  const file = cacheFile(cacheDir, path);
  if (existsSync(file)) return readFileSync(file, 'utf8');
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}/`, { headers: { 'user-agent': 'Mozilla/5.0' } });
      if (res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const html = await res.text();
      writeFileSync(file, html);
      await new Promise((r) => setTimeout(r, DELAY_MS));
      return html;
    } catch (err) {
      if (attempt === 4) throw new Error(`${path}: ${err.message}`);
      await new Promise((r) => setTimeout(r, 1000 * attempt));
    }
  }
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

/** Verse page → the parts of one verse (or compound), as vedabase prints them. */
async function versePage(cacheDir, book, canto, chapter, range) {
  const prefix = canto ? `${book}/${canto}/${chapter}/${range}` : `${book}/${chapter}/${range}`;
  const html = await fetchPage(cacheDir, prefix);
  if (!html) return null;
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
    translation: translation ? text(translation) : null,
    purport: purport ? text(purport) : null,
  };
}

/** "ṛ" → "r" etc., the plain-letter spelling cantos 1-9 of the source use. */
function plainRoman(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').normalize('NFC');
}

export { chapterIndex, versePage, plainRoman };
