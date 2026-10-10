// The app's silent offline sync: what is available to download, and a link to
// download it. The files themselves are written weekly by services/book-cache.js
// and fetched by the phone straight from S3, so none of the book text passes
// through here. Both endpoints read the BookCacheUnit table only.

import { prisma } from '../../config/database.js';
import { bookCache } from '../../config/book-cache.js';
import * as s3 from '../../services/s3.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

// A book is named by slug or id — the app has both, and neither is secret.
async function findBook(ref) {
  const book = await prisma.book.findFirst({
    where: { isPublished: true, OR: [{ slug: ref }, { id: ref }] },
    select: { id: true, slug: true },
  });
  if (!book) throw notFound('Book');
  return book;
}

/** GET /api/app/books/:book/manifest */
export const manifest = async (req, res) => {
  const book = await findBook(req.valid.params.book);
  const rows = await prisma.bookCacheUnit.findMany({
    where: { bookId: book.id },
    orderBy: [{ unitType: 'asc' }, { unitNumber: 'asc' }],
  });

  return ok(res, {
    bookId: book.id,
    bookSlug: book.slug,
    schemaVersion: bookCache.schemaVersion,
    unitType: rows[0]?.unitType ?? null,
    totalUnits: rows.length,
    updatedAt: rows.reduce((max, r) => (r.updatedAt > max ? r.updatedAt : max), new Date(0)).toISOString(),
    units: rows.map((r) => ({
      unitId: r.unitId,
      unitType: r.unitType,
      number: r.unitNumber,
      version: r.version,
      hash: r.hash,
      sizeBytes: r.sizeBytes,
      verseCount: r.verseCount,
      schemaVersion: r.schemaVersion,
      updatedAt: r.updatedAt.toISOString(),
    })),
  });
};

/** GET|POST /api/app/books/:book/download-url */
export const downloadUrl = async (req, res) => {
  const book = await findBook(req.valid.params.book);
  const input = { ...req.valid.query, ...req.valid.body };
  const unitId = input.unitId ?? input.chapterId;

  const unit = await prisma.bookCacheUnit.findUnique({
    where: { bookId_unitType_unitId: await unitKey(book.id, unitId) },
  });
  if (!unit) throw notFound('Unit');

  const ttl = bookCache.downloadTtlSeconds;
  return ok(res, {
    bookId: book.id,
    unitId: unit.unitId,
    unitType: unit.unitType,
    presignedUrl: await s3.presignDownload(unit.s3Key, ttl),
    expiresInSeconds: ttl,
    version: unit.version,
    hash: unit.hash,
    sizeBytes: unit.sizeBytes,
    compressedBytes: unit.compressedBytes,
    schemaVersion: unit.schemaVersion,
  });
};

// unitType is part of the unique key, but a caller only knows the id — which is
// unique on its own (a Chapter or Canto cuid) — so look the type up.
async function unitKey(bookId, unitId) {
  const row = await prisma.bookCacheUnit.findFirst({ where: { bookId, unitId }, select: { unitType: true } });
  return { bookId, unitType: row?.unitType ?? '', unitId };
}

/**
 * POST /api/app/books/:book/audio-urls
 * The cached JSON holds audio *keys*, never links (a link in the file would
 * change its hash every hour). The app asks for links for the verses it is
 * about to play.
 */
export const audioUrls = async (req, res) => {
  const book = await findBook(req.valid.params.book);
  const rows = await prisma.verse.findMany({
    where: { bookId: book.id, id: { in: req.valid.body.verseIds }, audioPath: { not: null } },
    select: { id: true, audioPath: true },
  });
  const urls = {};
  await Promise.all(rows.map(async (r) => (urls[r.id] = await s3.presignGet(r.audioPath))));
  return ok(res, { urls });
};
