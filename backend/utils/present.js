// Turns database rows into the shape the clients consume.
//
// Two things have to happen to almost every content row before it leaves, and
// both are easy to forget one endpoint at a time:
//
//   1. Language resolution. A verse or mantra carries renderings in several
//      languages; which one a user sees depends on their three settings and the
//      fallback order between them.
//   2. Media signing. Every `*Path` column is a private S3 key. Returning it
//      raw gives the client something it cannot fetch.
//
// This is shaping, not business logic — controllers still own what to fetch and
// what to write. It lives in utils/ rather than services/ because it holds no
// state and talks to nothing.

import * as s3 from '../services/s3.js';
import * as language from './language.js';

// Prisma `include` blocks for the joins a shaped verse needs. Kept next to the
// shaping code so the two cannot drift — a shape that reads `verse.translations`
// only works if the query asked for them.
const includes = {
  verse: (readingChain) => ({
    book: { select: { id: true, slug: true, title: true, bookNumber: true, type: true } },
    chapter: { select: { id: true, number: true, title: true } },
    translations: {
      where: { isPublished: true, languageCode: { in: readingChain } },
      include: { translator: { select: { id: true, slug: true, name: true, imagePath: true } } },
      orderBy: { displayOrder: 'asc' },
    },
    explanations: { where: { isPublished: true, languageCode: { in: readingChain } } },
  }),

  mantra: (mantraChain, readingChain) => ({
    deity: { select: { id: true, slug: true, name: true, imagePath: true } },
    guru: { select: { id: true, slug: true, name: true, imagePath: true } },
    translations: {
      where: {
        isPublished: true,
        languageCode: { in: [...new Set([...mantraChain, ...readingChain])] },
      },
    },
  }),
};

/**
 * One verse, in the reader's language.
 *
 * The full translation list is returned alongside the resolved one: the app
 * shows a chosen acharya by default but lets the reader switch, and a second
 * round trip for that would be a poor trade for a few hundred bytes.
 */
async function verse(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);

  const translation = language.pick(row.translations, chain);
  const explanation = language.pick(row.explanations, chain);

  return {
    id: row.id,
    verseId: row.verseId,
    bookNumber: row.bookNumber,
    cantoNumber: row.cantoNumber,
    chapterNumber: row.chapterNumber,
    verseNumber: row.verseNumber,
    verseNumberEnd: row.verseNumberEnd,
    type: row.type,
    sanskrit: row.sanskrit,
    transliteration: row.transliteration,
    wordMeanings: row.wordMeanings,
    audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
    tags: row.tags,

    book: row.book || null,
    chapter: row.chapter || null,

    translation: translation
      ? {
          id: translation.id,
          languageCode: translation.languageCode,
          type: translation.type,
          meaning: translation.meaning,
          purport: translation.purport,
          sourceRef: translation.sourceRef,
          translator: translation.translator,
        }
      : null,

    // Other renderings the reader can switch to, without their full text.
    availableTranslations: (row.translations || []).map((t) => ({
      id: t.id,
      languageCode: t.languageCode,
      type: t.type,
      translator: t.translator,
    })),

    // App-written or generated, and deliberately not presented as commentary —
    // an acharya's purport and our own explanation are different things and are
    // never allowed to look the same.
    explanation: explanation ? { text: explanation.text, source: explanation.source } : null,
  };
}

const verses = (rows, user) => Promise.all((rows || []).map((row) => verse(row, user)));

/**
 * One mantra.
 *
 * The script and the meaning are chosen by *different* settings — mantraLanguage
 * for the text, readingLanguage for what it means — so a single response may
 * combine two rows of MantraTranslation. Someone chanting in Devanagari while
 * reading English is the normal case, not an edge one.
 */
async function mantra(row, user) {
  if (!row) return null;

  const scriptChain = language.mantraChain(user);
  const readChain = language.readingChain(user);

  const script = language.pick(row.translations, scriptChain);
  const meaning = language.pick(row.translations, readChain);

  // Per-language audio wins; the base recitation is the fallback.
  const audioPath = script?.audioPath || row.audioPath;

  return {
    id: row.id,
    slug: row.slug,
    name: script?.name || row.name,
    description: meaning?.description || row.description,
    category: row.category,
    sampradaya: row.sampradaya,
    tags: row.tags,

    // Falls back to the Devanagari source when every chosen language misses.
    text: script?.text || row.sanskrit,
    textLanguage: script?.languageCode || 'sa',
    transliteration: row.transliteration,

    meaning: meaning?.meaning || null,
    purport: meaning?.purport || null,
    meaningLanguage: meaning?.languageCode || null,

    audioUrl: audioPath ? await s3.presignGet(audioPath) : null,
    // Drives the in-app chant pacing, so it must hold even before audio loads.
    durationMs: script?.durationMs || row.durationMs,

    standardRounds: row.standardRounds,
    standardCount: row.standardCount,

    deity: row.deity ? await s3.presignFields(row.deity, ['imagePath']) : null,
    guru: row.guru ? await s3.presignFields(row.guru, ['imagePath']) : null,
  };
}

const mantras = (rows, user) => Promise.all((rows || []).map((row) => mantra(row, user)));

/** A book, with its title in the reader's language where one exists. */
async function book(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);

  return {
    id: row.id,
    bookNumber: row.bookNumber,
    slug: row.slug,
    type: row.type,
    title: language.localised(row, 'title', 'titleI18n', chain),
    description: language.localised(row, 'description', 'descriptionI18n', chain),
    sourceLanguage: row.sourceLanguage,
    coverImageUrl: row.coverImagePath ? await s3.presignGet(row.coverImagePath) : null,
    audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
    totalCantos: row.totalCantos,
    totalChapters: row.totalChapters,
    totalVerses: row.totalVerses,
    tags: row.tags,
    deity: row.deity || null,
  };
}

const books = (rows, user) => Promise.all((rows || []).map((row) => book(row, user)));

/** Chapters and cantos share a shape — a number, a localised title, a count. */
function section(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);
  return {
    id: row.id,
    number: row.number,
    cantoNumber: row.cantoNumber ?? null,
    title: language.localised(row, 'title', 'titleI18n', chain),
    summary: language.localised(row, 'summary', 'summaryI18n', chain),
    totalChapters: row.totalChapters ?? undefined,
    totalVerses: row.totalVerses,
  };
}

const sections = (rows, user) => (rows || []).map((row) => section(row, user));

/** Reference rows — deities, gurus, translators, issues. */
async function reference(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);
  return {
    id: row.id,
    slug: row.slug,
    name: language.localised(row, 'name', 'nameI18n', chain),
    description: row.description ?? null,
    imageUrl: row.imagePath ? await s3.presignGet(row.imagePath) : null,
    displayOrder: row.displayOrder,
  };
}

const references = (rows, user) => Promise.all((rows || []).map((row) => reference(row, user)));

export {
  includes,
  verse,
  verses,
  mantra,
  mantras,
  book,
  books,
  section,
  sections,
  reference,
  references,
};
