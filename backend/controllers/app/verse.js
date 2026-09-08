// Verses.
//
// A verse is addressed by its `verseId` — the dotted key that is also baked
// into the scraped source content:
//
//   Bhagavad Gita       1.{chapter}.{verse}          1.2.47
//   Srimad Bhagavatam   2.{canto}.{chapter}.{verse}  2.10.1.5
//   short works         {bookNumber}.{verse}         7.12
//
// The app deep-links, bookmarks and shares by that key, so it is what the API
// takes. The cuid primary key is an implementation detail and never appears in
// a URL.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import * as s3 from '../../services/s3.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound } from '../../utils/errors.js';

/**
 * GET /api/app/verses
 * Flat, filterable listing. The chapter reading screen uses
 * /books/:slug/chapters/:number instead — this is for browsing by tag and for
 * anything that spans chapters.
 */
export const list = async (req, res) => {
  const { bookNumber, canto, chapter, tag } = req.valid.query;
  const readingChain = language.readingChain(req.auth.user);

  const where = {
    book: { isPublished: true },
    ...(bookNumber ? { bookNumber } : {}),
    ...(canto ? { cantoNumber: canto } : {}),
    ...(chapter ? { chapterNumber: chapter } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
  };

  const { items, page } = await paginate(prisma.verse, {
    where,
    orderBy: [
      { bookNumber: 'asc' },
      { cantoNumber: 'asc' },
      { chapterNumber: 'asc' },
      { verseNumber: 'asc' },
    ],
    include: present.includes.verse(readingChain),
    query: req.valid.query,
  });

  return paginated(res, await present.verses(items, req.auth.user), page);
};

/** GET /api/app/verses/:verseId */
export const get = async (req, res) => {
  const readingChain = language.readingChain(req.auth.user);

  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    include: present.includes.verse(readingChain),
  });
  if (!verse) throw notFound('Verse');

  const shaped = await present.verse(verse, req.auth.user);

  // Whether this reader has bookmarked it — one extra indexed lookup, and it
  // saves the client fetching the whole favourites list to colour one icon.
  let isFavorite = false;
  if (req.auth.user) {
    const favorite = await prisma.favorite.findUnique({
      where: { userId_verseId: { userId: req.auth.user.id, verseId: verse.id } },
      select: { id: true },
    });
    isFavorite = Boolean(favorite);
  }

  return ok(res, { ...shaped, isFavorite });
};

/**
 * GET /api/app/verses/:verseId/translations
 * Every published rendering, in full — for the screen where a reader compares
 * acharyas side by side. The single resolved translation on the verse itself
 * covers the ordinary case.
 */
export const translations = async (req, res) => {
  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    select: { id: true },
  });
  if (!verse) throw notFound('Verse');

  const { translator, languageCode } = req.valid.query;

  const translations = await prisma.verseTranslation.findMany({
    where: {
      verseId: verse.id,
      isPublished: true,
      ...(translator ? { translator: { slug: translator } } : {}),
      ...(languageCode ? { languageCode } : {}),
    },
    include: { translator: { select: { id: true, slug: true, name: true, imagePath: true } } },
    orderBy: [{ displayOrder: 'asc' }, { createdAt: 'asc' }],
  });

  return ok(
    res,
    await Promise.all(
      translations.map(async (row) => ({
        id: row.id,
        languageCode: row.languageCode,
        type: row.type,
        meaning: row.meaning,
        purport: row.purport,
        sourceRef: row.sourceRef,
        audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
        translator: row.translator,
      }))
    )
  );
};

/**
 * GET /api/app/verses/:verseId/narrations
 * A saint's telling of the story around a verse, usually with audio. Distinct
 * from a purport: narrative, not commentary on the text.
 */
export const narrations = async (req, res) => {
  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    select: { id: true },
  });
  if (!verse) throw notFound('Verse');

  const chain = language.readingChain(req.auth.user);

  const narrations = await prisma.narration.findMany({
    where: { verseId: verse.id, isPublished: true, languageCode: { in: chain } },
    include: { guru: { select: { id: true, slug: true, name: true, imagePath: true } } },
    orderBy: { displayOrder: 'asc' },
  });

  return ok(
    res,
    await Promise.all(
      narrations.map(async (row) => ({
        id: row.id,
        languageCode: row.languageCode,
        title: row.title,
        text: row.text,
        audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
        durationMs: row.durationMs,
        sourceNote: row.sourceNote,
        guru: row.guru ? await s3.presignFields(row.guru, ['imagePath']) : null,
      }))
    )
  );
};

/**
 * GET /api/app/verses/:verseId/related
 * Curated cross-links between the Gita and the Bhagavatam. Directional — the
 * link is stored one way round because "expands on" does not read the same in
 * reverse, so only outgoing links are followed here.
 */
export const related = async (req, res) => {
  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    select: { id: true },
  });
  if (!verse) throw notFound('Verse');

  const readingChain = language.readingChain(req.auth.user);

  const links = await prisma.verseLink.findMany({
    where: { sourceVerseId: verse.id },
    include: { targetVerse: { include: present.includes.verse(readingChain) } },
    orderBy: { createdAt: 'asc' },
  });

  return ok(
    res,
    await Promise.all(
      links.map(async (link) => ({
        relation: link.relation,
        note: link.note,
        verse: await present.verse(link.targetVerse, req.auth.user),
      }))
    )
  );
};
