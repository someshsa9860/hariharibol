// Reels made automatically from the verses of a book.
//
// A *recipe* is two things the panel gathers and this file joins:
//
//   1. a selection — a book, optionally narrowed to a canto, chapter, verse range,
//      topic tag or keyword hints; and
//   2. a template — the design every reel starts from: background image or video,
//      music, and text boxes, some of them *bound* to a verse field.
//
// Generating walks the matching verses and makes one draft reel per verse. What
// is not obvious from reading it:
//
//   - A reel keeps its verse (`verseId`) and the template's bound text boxes keep
//     their `bind`, so the app re-reads the verse when it fetches the reel and
//     shows the translation in the *reader's* language (utils/present.js). The
//     text written into the overlay here is only the fallback, in the language
//     the run asked for.
//   - Reels are tagged with the standard tags in utils/reel-tags.js — book,
//     canto, chapter, plus the names — which is what "more like this" matches on.
//   - A verse that already has a reel from this template is left out *before* the
//     limit is applied, so running the same recipe again makes the next batch
//     rather than finding nothing new. The (templateId, verseId) unique index
//     backs that up if two runs race.
//   - Drafts by default. Publishing a batch needs `reel.publish`, the same as
//     publishing one.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as s3 from '../../services/s3.js';
import * as language from '../../utils/language.js';
import { verseTags, verseLabel, slug } from '../../utils/reel-tags.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { notFound, badRequest, forbidden } from '../../utils/errors.js';
import { assertKey, syncReelCount } from './reel.js';

export const GENERATE_MAX = 100;

// ── Templates ──────────────────────────────────────────────────────────────

const configKeys = (config) => [
  ...(config.mediaType === 'VIDEO' ? [config.videoPath] : config.images),
  config.audioPath,
  config.thumbnailPath,
].filter(Boolean);

function assertConfig(config, existing = null) {
  const held = existing ? configKeys(existing) : [];
  assertKey(config.videoPath, ['reelVideo'], held);
  assertKey(config.audioPath, ['reelAudio'], held);
  assertKey(config.thumbnailPath, ['reelThumbnail', 'reelImage'], held);
  for (const image of config.images) assertKey(image, ['reelImage'], held);
}

async function shapeTemplate(row) {
  const config = row.config;
  const [videoUrl, audioUrl, thumbnailUrl, images] = await Promise.all([
    s3.presignGet(config.videoPath),
    s3.presignGet(config.audioPath),
    s3.presignGet(config.thumbnailPath),
    Promise.all((config.images ?? []).map(async (path) => ({ path, url: await s3.presignGet(path) }))),
  ]);

  return {
    id: row.id,
    name: row.name,
    isActive: row.isActive,
    reelCount: row._count?.reels ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    mediaType: config.mediaType,
    videoPath: config.videoPath ?? null,
    videoUrl,
    images,
    audioPath: config.audioPath ?? null,
    audioUrl,
    thumbnailPath: config.thumbnailPath ?? null,
    thumbnailUrl,
    durationMs: config.durationMs ?? null,
    width: config.width ?? null,
    height: config.height ?? null,
    overlays: config.overlays ?? [],
  };
}

const COUNT = { _count: { select: { reels: true } } };

async function loadTemplate(id) {
  const row = await prisma.reelTemplate.findUnique({ where: { id }, include: COUNT });
  if (!row) throw notFound('Template');
  return row;
}

/** GET /api/admin/reel-recipes/templates */
export const listTemplates = async (req, res) => {
  const rows = await prisma.reelTemplate.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: 'desc' },
    take: 100,
    include: COUNT,
  });
  return ok(res, await Promise.all(rows.map(shapeTemplate)));
};

/** GET /api/admin/reel-recipes/templates/:id */
export const getTemplate = async (req, res) => ok(res, await shapeTemplate(await loadTemplate(req.valid.params.id)));

/** POST /api/admin/reel-recipes/templates */
export const createTemplate = async (req, res) => {
  const { name, config } = req.valid.body;
  assertConfig(config);

  const row = await prisma.reelTemplate.create({
    data: { name, config, createdBy: req.auth.user.id },
    include: COUNT,
  });
  await audit.record(req, { action: 'reel.template.create', entityType: 'ReelTemplate', entityId: row.id, after: { name } });
  return created(res, await shapeTemplate(row));
};

/** PATCH /api/admin/reel-recipes/templates/:id */
export const updateTemplate = async (req, res) => {
  const before = await loadTemplate(req.valid.params.id);
  const { name, config } = req.valid.body;
  if (config) assertConfig(config, before.config);

  const row = await prisma.reelTemplate.update({
    where: { id: before.id },
    data: { ...(name ? { name } : {}), ...(config ? { config } : {}) },
    include: COUNT,
  });
  await audit.record(req, { action: 'reel.template.update', entityType: 'ReelTemplate', entityId: before.id, before: { name: before.name }, after: { name: row.name } });
  return ok(res, await shapeTemplate(row));
};

/** DELETE /api/admin/reel-recipes/templates/:id */
export const removeTemplate = async (req, res) => {
  const row = await loadTemplate(req.valid.params.id);
  // Reels made from it keep working — templateId is set null, the design was
  // copied into each reel when it was made.
  await prisma.reelTemplate.delete({ where: { id: row.id } });
  await audit.record(req, { action: 'reel.template.delete', entityType: 'ReelTemplate', entityId: row.id, before: { name: row.name } });
  return noContent(res);
};

// ── Choosing verses ────────────────────────────────────────────────────────

/** GET /api/admin/reel-recipes/books */
export const books = async (req, res) =>
  ok(
    res,
    await prisma.book.findMany({
      where: { totalVerses: { gt: 0 } },
      select: { id: true, slug: true, title: true, type: true, totalVerses: true, totalCantos: true },
      orderBy: [{ displayOrder: 'asc' }, { title: 'asc' }],
    })
  );

/** GET /api/admin/reel-recipes/outline?bookId= — what a book can be narrowed by. */
export const outline = async (req, res) => {
  const { bookId } = req.valid.query;
  const book = await prisma.book.findUnique({ where: { id: bookId }, select: { id: true, slug: true, title: true } });
  if (!book) throw notFound('Book');

  const [cantos, chapters, tags] = await Promise.all([
    prisma.canto.findMany({ where: { bookId }, select: { number: true, title: true }, orderBy: { number: 'asc' } }),
    prisma.chapter.findMany({
      where: { bookId },
      select: { id: true, cantoNumber: true, number: true, title: true, totalVerses: true },
      orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }],
    }),
    prisma.$queryRaw`
      SELECT tag, COUNT(*)::int AS count
      FROM "Verse", UNNEST(tags) AS tag
      WHERE "bookId" = ${bookId}
      GROUP BY tag
      ORDER BY count DESC, tag ASC
      LIMIT 60
    `,
  ]);

  return ok(res, { book, cantos, chapters, tags });
};

// The verses a selection means. `templateId` leaves out verses that template has
// already been used on — see the file comment.
function whereFor(selection, { templateId, useVerseAudio }) {
  const { bookId, cantoNumber, chapterId, verseFrom, verseTo, tag, hints = [] } = selection;
  const and = [];

  if (hints.length) {
    and.push({
      OR: hints.flatMap((hint) => [
        { sanskrit: { contains: hint, mode: 'insensitive' } },
        { transliteration: { contains: hint, mode: 'insensitive' } },
        { tags: { has: hint.toLowerCase() } },
        { translations: { some: { isPublished: true, meaning: { contains: hint, mode: 'insensitive' } } } },
      ]),
    });
  }

  return {
    bookId,
    // A verse with no Sanskrit has nothing to put on the frame.
    sanskrit: { not: null },
    ...(cantoNumber != null ? { cantoNumber } : {}),
    ...(chapterId ? { chapterId } : {}),
    ...(verseFrom != null || verseTo != null
      ? { verseNumber: { ...(verseFrom != null ? { gte: verseFrom } : {}), ...(verseTo != null ? { lte: verseTo } : {}) } }
      : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    // Asking for the recitation means a verse without one is not a candidate.
    ...(useVerseAudio ? { audioPath: { not: null } } : {}),
    ...(templateId ? { NOT: { reels: { some: { templateId } } } } : {}),
    ...(and.length ? { AND: and } : {}),
  };
}

const ORDER = [{ cantoNumber: 'asc' }, { chapterNumber: 'asc' }, { verseNumber: 'asc' }];

const VERSE_INCLUDE = (languageCode) => ({
  book: { select: { id: true, slug: true, title: true, deityId: true, sampradaya: true } },
  chapter: { select: { number: true, title: true } },
  translations: {
    where: { isPublished: true, languageCode: { in: [languageCode, language.readingChain(null)[0]] } },
    orderBy: { displayOrder: 'asc' },
    select: { languageCode: true, meaning: true },
  },
});

// The text each binding puts on the frame for one verse.
function textsOf(verse, languageCode) {
  const translation = language.pick(verse.translations, [languageCode, 'en']) ?? verse.translations[0] ?? null;
  return {
    sanskrit: verse.sanskrit,
    transliteration: verse.transliteration,
    translation: translation?.meaning ?? null,
    reference: verseLabel({ book: verse.book, verse }),
  };
}

/** POST /api/admin/reel-recipes/preview */
export const preview = async (req, res) => {
  const { selection, templateId, useVerseAudio } = req.valid.body;
  const where = whereFor(selection, { templateId, useVerseAudio });

  const [total, rows] = await Promise.all([
    prisma.verse.count({ where }),
    prisma.verse.findMany({ where, orderBy: ORDER, take: Math.min(selection.limit, 12), include: VERSE_INCLUDE(selection.languageCode) }),
  ]);

  return ok(res, {
    total,
    willCreate: Math.min(total, selection.limit),
    sample: rows.map((verse) => ({
      id: verse.id,
      verseId: verse.verseId,
      ...textsOf(verse, selection.languageCode),
      hasAudio: Boolean(verse.audioPath),
    })),
  });
};

// ── Making the reels ───────────────────────────────────────────────────────

function overlaysFor(overlays, texts) {
  return overlays.flatMap((overlay) => {
    if (!overlay.bind) return [overlay];
    const text = texts[overlay.bind]?.trim();
    // A verse with no translation in the language leaves that box out rather
    // than putting a placeholder on screen.
    return text ? [{ ...overlay, text: text.slice(0, 2000) }] : [];
  });
}

/** POST /api/admin/reel-recipes/generate */
export const generate = async (req, res) => {
  const { templateId, creatorId, selection, useVerseAudio, publish, extraTags } = req.valid.body;

  if (publish && !req.auth.permissions.has('reel.publish')) throw forbidden('Publishing needs the reel.publish permission');

  const template = await loadTemplate(templateId);
  const config = template.config;

  const creator = await prisma.creatorProfile.findFirst({ where: { id: creatorId, status: 'APPROVED' } });
  if (!creator) throw badRequest('Unknown or unapproved creator');

  // The design has to be complete before a hundred reels are made from it.
  if (config.mediaType === 'VIDEO' && !config.videoPath) throw badRequest('Add a background video to the template first');
  if (config.mediaType === 'IMAGE' && !config.images?.length) throw badRequest('Add at least one background image to the template first');
  if (publish) {
    const gone = (await Promise.all(configKeys(config).map(async (k) => ((await s3.objectExists(k)) ? null : k)))).filter(Boolean);
    if (gone.length) throw badRequest('A template file is missing from storage — upload it again', gone);
  }

  const verses = await prisma.verse.findMany({
    where: whereFor(selection, { templateId, useVerseAudio }),
    orderBy: ORDER,
    take: Math.min(selection.limit, GENERATE_MAX),
    include: VERSE_INCLUDE(selection.languageCode),
  });
  if (!verses.length) throw badRequest('No verses match, or all of them already have a reel from this template');

  const cantoRows = await prisma.canto.findMany({ where: { bookId: selection.bookId }, select: { number: true, title: true } });
  const cantos = new Map(cantoRows.map((c) => [c.number, c]));

  // The recitation has to exist, or the reel is a silent frame.
  const audioOk = new Map();
  if (useVerseAudio) {
    await Promise.all(verses.map(async (v) => audioOk.set(v.id, await s3.objectExists(v.audioPath))));
  }

  const hints = [...new Set([...selection.hints, ...extraTags].map(slug).filter(Boolean))];
  const now = new Date();
  const made = [];
  const skipped = [];

  for (const verse of verses) {
    if (useVerseAudio && !audioOk.get(verse.id)) {
      skipped.push({ verseId: verse.verseId, reason: 'recitation file missing from storage' });
      continue;
    }

    const texts = textsOf(verse, selection.languageCode);
    const tags = [...new Set([...verseTags({ book: verse.book, canto: cantos.get(verse.cantoNumber), chapter: verse.chapter, verse }), ...hints])].slice(0, 30);
    const images = config.mediaType === 'IMAGE' ? config.images : [];

    try {
      const reel = await prisma.reel.create({
        data: {
          creatorId,
          mediaType: config.mediaType,
          videoPath: config.mediaType === 'VIDEO' ? config.videoPath : null,
          audioTrackPath: useVerseAudio ? verse.audioPath : (config.audioPath ?? null),
          thumbnailPath: config.thumbnailPath ?? images[0] ?? null,
          durationMs: config.durationMs ?? null,
          width: config.width ?? null,
          height: config.height ?? null,
          caption: texts.reference,
          tags,
          verseId: verse.id,
          deityId: verse.book.deityId ?? null,
          templateId: template.id,
          overlays: overlaysFor(config.overlays ?? [], texts),
          sampradaya: verse.book.sampradaya,
          ...(publish
            ? { status: 'PUBLISHED', publishedAt: now, reviewedById: req.auth.user.id, reviewedAt: now }
            : { status: 'DRAFT' }),
          media: { create: images.map((imagePath, displayOrder) => ({ imagePath, displayOrder })) },
        },
        select: { id: true },
      });
      made.push({ id: reel.id, verseId: verse.verseId });
    } catch (error) {
      if (error?.code !== 'P2002') throw error;
      skipped.push({ verseId: verse.verseId, reason: 'already has a reel from this template' });
    }
  }

  if (publish) await syncReelCount(creatorId);

  await audit.record(req, {
    action: 'reel.generate',
    entityType: 'ReelTemplate',
    entityId: template.id,
    after: { book: selection.bookId, created: made.length, skipped: skipped.length, published: publish },
  });

  return created(res, { created: made.length, published: publish, reels: made, skipped });
};
