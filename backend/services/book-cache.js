// The weekly book export.
//
// Reads every published book out of the database and writes it, one file per
// chapter or canto, to s3://<bucket>/books/caches/<book>/<unit>.json (gzipped).
// The app downloads those files straight from S3 through short-lived links, so
// reading a book offline costs the database nothing per user.
//
// What keeps a run cheap is the hash: each unit is serialised in a fixed order
// (utils/book-cache.js), hashed, and compared with the hash stored in
// BookCacheUnit. Same hash, same file, nothing sent. A changed unit gets a new
// version number, and the manifest — the list the app diffs against — is
// rewritten only when something changed.
//
// Files under books/caches/ are only ever replaced, never deleted. The export
// does not clean up units that no longer exist, and no S3 lifecycle rule may
// expire this prefix: a phone that has not synced in a year must still find its
// file.

import { prisma } from '../config/database.js';
import logger from '../config/logger.js';
import { bookCache, SCHEMA_VERSION, UNIT_TYPES, unitFileKey } from '../config/book-cache.js';
import * as s3 from './s3.js';
import { withLock } from './redis-lock.js';
import * as cache from '../utils/book-cache.js';
import crypto from 'node:crypto';

// ── Building a unit ────────────────────────────────────────────────────────

/** 'chapter', 'canto', or null for a book that is not exported (a short work). */
function unitTypeFor(book) {
  const configured = UNIT_TYPES[book.slug];
  const hasCantos = book._count.cantos > 0;
  const hasChapters = book._count.chapters > 0;
  if (configured === 'chapter' && hasCantos) return null; // chapter numbers repeat per canto
  if (configured === 'canto' && !hasCantos) return null;
  if (configured) return configured;
  if (hasCantos) return 'canto';
  if (hasChapters) return 'chapter';
  return null;
}

const shapeTranslation = (t) => ({
  id: t.id,
  translatorId: t.translatorId,
  translatorSlug: t.translator?.slug ?? null,
  translatorName: t.translator?.name ?? null,
  languageCode: t.languageCode,
  type: t.type,
  meaning: t.meaning,
  purport: t.purport,
  sourceRef: t.sourceRef,
  audioPath: t.audioPath,
  displayOrder: t.displayOrder,
});

// Stable order for a verse's renderings. Without it two runs could list the same
// rows differently, and the hash would change for no reason.
const byTranslationOrder = (a, b) =>
  a.languageCode.localeCompare(b.languageCode) ||
  a.displayOrder - b.displayOrder ||
  a.type.localeCompare(b.type) ||
  a.id.localeCompare(b.id);

const shapeVerse = (v) => ({
  id: v.id,
  verseId: v.verseId,
  chapterId: v.chapterId,
  chapterNumber: v.chapterNumber,
  cantoNumber: v.cantoNumber,
  verseNumber: v.verseNumber,
  verseNumberEnd: v.verseNumberEnd,
  type: v.type,
  sanskrit: v.sanskrit,
  transliteration: v.transliteration,
  wordMeanings: v.wordMeanings,
  audioPath: v.audioPath,
  tags: v.tags,
  translations: [...v.translations].sort(byTranslationOrder).map(shapeTranslation),
});

const shapeSection = (row) => ({
  id: row.id,
  number: row.number,
  cantoNumber: row.cantoNumber ?? null,
  title: row.title,
  titleI18n: row.titleI18n ?? null,
  summary: row.summary ?? null,
  summaryI18n: row.summaryI18n ?? null,
  totalVerses: row.totalVerses,
});

const newest = (dates) => dates.reduce((a, b) => (b > a ? b : a), new Date(0));

/**
 * One unit's body. Returns null when the unit has no verses (nothing to cache).
 * [unit] is `{ type, row }`: a Chapter row, or a Canto row with its chapters.
 */
async function buildUnit(book, unit) {
  const chapters =
    unit.type === 'canto'
      ? await prisma.chapter.findMany({ where: { cantoId: unit.row.id }, orderBy: { number: 'asc' } })
      : [unit.row];

  const verses = [];
  const stamps = [unit.row.updatedAt, ...chapters.map((c) => c.updatedAt)];

  // A chapter at a time: a whole canto with every purport in one query is the
  // biggest thing this job holds in memory.
  for (const chapter of chapters) {
    const rows = await prisma.verse.findMany({
      where: { chapterId: chapter.id },
      orderBy: [{ verseNumber: 'asc' }, { id: 'asc' }],
      include: {
        translations: {
          where: { isPublished: true },
          include: { translator: { select: { slug: true, name: true } } },
        },
      },
    });
    for (const row of rows) {
      stamps.push(row.updatedAt, ...row.translations.map((t) => t.updatedAt));
      verses.push(shapeVerse(row));
    }
  }
  if (verses.length === 0) return null;

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: newest(stamps).toISOString(),
    book: {
      id: book.id,
      slug: book.slug,
      bookNumber: book.bookNumber,
      title: book.title,
      titleI18n: book.titleI18n ?? null,
      sourceLanguage: book.sourceLanguage,
    },
    unit: { type: unit.type, ...shapeSection(unit.row) },
    chapters: chapters.map(shapeSection),
    verses,
  };
}

// ── Syncing a unit ─────────────────────────────────────────────────────────

/**
 * Builds one unit, compares its hash with the stored one, and uploads only if it
 * changed or its file is missing. Returns what happened.
 *   { action: 'create'|'update'|'repair'|'skip'|'empty', bytesUploaded, ... }
 */
async function syncUnit(book, unit, { dryRun = false, force = false } = {}) {
  const body = await buildUnit(book, unit);
  if (!body) return { action: 'empty', bytesUploaded: 0 };

  const { bytes, hash, sizeBytes } = cache.serialize(body);
  const where = { bookId_unitType_unitId: { bookId: book.id, unitType: unit.type, unitId: unit.row.id } };
  const existing = await prisma.bookCacheUnit.findUnique({ where });

  const s3Key = unitFileKey(book.slug, unit.type, unit.row.number);
  // Only worth a HEAD when the hash matches: a changed hash uploads anyway.
  const fileExists = existing && existing.hash === hash ? await s3.objectExists(existing.s3Key) : null;
  const action = force && existing ? 'update' : cache.plan(existing, hash, fileExists);

  if (action === 'skip') return { action, bytesUploaded: 0, hash };
  if (dryRun) return { action, bytesUploaded: 0, hash };

  const gz = cache.gzip(bytes);
  await replaceObject(s3Key, book.slug, unit, hash, gz);

  const version = force && existing && existing.hash === hash ? existing.version + 1 : cache.nextVersion(existing, action);
  const data = {
    unitNumber: unit.row.number,
    hash,
    version,
    sizeBytes,
    compressedBytes: gz.length,
    verseCount: body.verses.length,
    schemaVersion: SCHEMA_VERSION,
    s3Key,
    contentUpdatedAt: new Date(body.updatedAt),
  };
  await prisma.bookCacheUnit.upsert({
    where,
    create: { bookId: book.id, unitType: unit.type, unitId: unit.row.id, ...data },
    update: data,
  });

  return { action, bytesUploaded: gz.length, hash, version, sizeBytes };
}

/**
 * Atomic replace: upload to a staging key, then copy over the live key. S3 never
 * shows a half-written object at the destination, and the staging copy — the
 * only thing this job ever deletes — lives outside books/caches/.
 */
async function replaceObject(liveKey, bookSlug, unit, hash, gz) {
  const staging = `${bookCache.stagingPrefix}/${bookSlug}/${unit.type}-${unit.row.number}-${hash.slice(0, 12)}-${crypto.randomBytes(4).toString('hex')}.json`;
  await s3.putObject(staging, gz, 'application/json', {
    contentEncoding: 'gzip',
    cacheControl: 'private, no-cache',
  });
  try {
    await s3.copyObject(staging, liveKey);
  } finally {
    await s3.deleteObject(staging);
  }
}

// ── Manifest ───────────────────────────────────────────────────────────────

const shapeManifestUnit = (row, slug) => ({
  bookId: row.bookId,
  bookSlug: slug,
  unitType: row.unitType,
  unitId: row.unitId,
  unitNumber: row.unitNumber,
  hash: row.hash,
  version: row.version,
  sizeBytes: row.sizeBytes,
  verseCount: row.verseCount,
  schemaVersion: row.schemaVersion,
  updatedAt: row.updatedAt.toISOString(),
  s3Key: row.s3Key,
});

/** Every unit of every book, in a fixed order — what manifest.json holds. */
async function manifestBody() {
  const rows = await prisma.bookCacheUnit.findMany({
    include: { book: { select: { slug: true, bookNumber: true } } },
    orderBy: [{ book: { bookNumber: 'asc' } }, { unitType: 'asc' }, { unitNumber: 'asc' }],
  });
  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: newest(rows.map((r) => r.updatedAt)).toISOString(),
    units: rows.map((r) => shapeManifestUnit(r, r.book.slug)),
  };
}

async function writeManifest() {
  const body = await manifestBody();
  const bytes = Buffer.from(cache.canonicalize(body), 'utf8');
  const gz = cache.gzip(bytes);
  await replaceObject(bookCache.manifestKey, '_manifest', { type: 'manifest', row: { number: 0 } }, cache.sha256(bytes), gz);
  return gz.length;
}

// ── A whole run ────────────────────────────────────────────────────────────

async function listUnits(book) {
  const type = unitTypeFor(book);
  if (!type) return [];
  const rows =
    type === 'canto'
      ? await prisma.canto.findMany({ where: { bookId: book.id }, orderBy: { number: 'asc' } })
      : await prisma.chapter.findMany({ where: { bookId: book.id }, orderBy: { number: 'asc' } });
  return rows.map((row) => ({ type, row }));
}

/** Runs [tasks] with at most [limit] in flight. */
async function pool(tasks, limit) {
  const queue = [...tasks];
  await Promise.all(
    Array.from({ length: Math.min(limit, queue.length) }, async () => {
      while (queue.length) await queue.shift()();
    })
  );
}

/**
 * Exports every published book (or just [books], a list of slugs). Safe to call
 * from two places at once: the second gets `{ locked: true }` and does nothing.
 * Options: `dryRun` reports what would change without writing; `force` re-uploads
 * everything and bumps every version.
 */
async function runExport({ books, dryRun = false, force = false } = {}) {
  const startedAt = new Date();
  const report = {
    startedAt: startedAt.toISOString(),
    locked: false,
    dryRun,
    checked: 0,
    created: 0,
    changed: 0,
    repaired: 0,
    skipped: 0,
    empty: 0,
    failed: 0,
    bytesUploaded: 0,
    manifestUpdated: false,
    failures: [],
  };

  const locked = await withLock(bookCache.lockKey, bookCache.lockTtlMs, async () => {
    const bookRows = await prisma.book.findMany({
      where: { isPublished: true, ...(books?.length ? { slug: { in: books } } : {}) },
      select: {
        id: true, slug: true, bookNumber: true, title: true, titleI18n: true, sourceLanguage: true,
        _count: { select: { cantos: true, chapters: true } },
      },
      orderBy: { bookNumber: 'asc' },
    });

    const tasks = [];
    for (const book of bookRows) {
      for (const unit of await listUnits(book)) {
        tasks.push(async () => {
          report.checked += 1;
          const label = `${book.slug}/${unit.type}-${unit.row.number}`;
          try {
            const result = await cache.withRetry(() => syncUnit(book, unit, { dryRun, force }), {
              retries: bookCache.retries,
              baseMs: bookCache.retryBaseMs,
              onRetry: (err, attempt) => logger.warn({ unit: label, attempt, err: err.message }, 'book cache unit failed, retrying'),
            });
            report.bytesUploaded += result.bytesUploaded;
            if (result.action === 'create') report.created += 1;
            else if (result.action === 'update') report.changed += 1;
            else if (result.action === 'repair') report.repaired += 1;
            else if (result.action === 'empty') report.empty += 1;
            else report.skipped += 1;
          } catch (err) {
            report.failed += 1;
            report.failures.push({ unit: label, error: err.message });
            logger.error({ unit: label, err: err.message }, 'book cache unit failed');
          }
        });
      }
    }
    await pool(tasks, bookCache.concurrency);

    const touched = report.created + report.changed + report.repaired > 0;
    if (!dryRun && (touched || !(await s3.objectExists(bookCache.manifestKey)))) {
      report.bytesUploaded += await writeManifest();
      report.manifestUpdated = true;
    }
  });

  if (!locked) {
    report.locked = true;
    logger.warn('book cache export skipped: another run holds the lock');
  }
  report.finishedAt = new Date().toISOString();
  report.durationMs = Date.now() - startedAt.getTime();
  logger.info(report, 'book cache export finished');
  return report;
}

export { runExport, syncUnit, buildUnit, unitTypeFor, manifestBody, writeManifest, shapeManifestUnit };
