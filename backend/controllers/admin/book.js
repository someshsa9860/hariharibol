// Books, cantos and chapters, from the admin side.
//
// The counts on Book and Canto (`totalVerses`, `totalChapters`) are rollups the
// reading screens depend on. `recountBook` is the only thing that writes them,
// and it runs after any structural change — a wrong count shows up as a
// progress bar that never reaches the end.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as s3 from '../../services/s3.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound, badRequest, conflict } from '../../utils/errors.js';

/** Recomputes a book's structural counts from what is actually in it. */
async function recountBook(bookId) {
  const [cantos, chapters, verses] = await Promise.all([
    prisma.canto.count({ where: { bookId } }),
    prisma.chapter.count({ where: { bookId } }),
    prisma.verse.count({ where: { bookId } }),
  ]);

  await prisma.book.update({
    where: { id: bookId },
    data: { totalCantos: cantos, totalChapters: chapters, totalVerses: verses },
  });

  // Cantos carry their own counts so a canto index does not have to aggregate.
  const cantoRows = await prisma.canto.findMany({ where: { bookId }, select: { id: true, number: true } });
  for (const canto of cantoRows) {
    const [chapterCount, verseCount] = await Promise.all([
      prisma.chapter.count({ where: { cantoId: canto.id } }),
      prisma.verse.count({ where: { bookId, cantoNumber: canto.number } }),
    ]);
    await prisma.canto.update({
      where: { id: canto.id },
      data: { totalChapters: chapterCount, totalVerses: verseCount },
    });
  }
}

/** GET /api/admin/books */
export const list = async (req, res) => {
  const { q, type, isPublished } = req.valid.query;

  const { items, page } = await paginate(prisma.book, {
    where: {
      ...(q ? { title: { contains: q, mode: 'insensitive' } } : {}),
      ...(type ? { type } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { bookNumber: 'asc' }],
    include: { deity: { select: { slug: true, name: true } } },
    query: req.valid.query,
  });

  return paginated(res, await s3.presignList(items, ['coverImagePath', 'audioPath']), page);
};

/** GET /api/admin/books/:id */
export const get = async (req, res) => {
  const book = await prisma.book.findUnique({
    where: { id: req.valid.params.id },
    include: {
      deity: true,
      cantos: { orderBy: { number: 'asc' } },
      chapters: { orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }] },
      translators: { include: { translator: true } },
    },
  });
  if (!book) throw notFound('Book');

  return ok(res, await s3.presignFields(book, ['coverImagePath', 'audioPath']));
};

/** POST /api/admin/books */
export const create = async (req, res) => {
  const body = req.valid.body;

  // bookNumber is the first segment of every verseId beneath the book and is
  // already baked into the scraped source files. Reusing one would make two
  // books claim the same verse ids.
  const clash = await prisma.book.findUnique({ where: { bookNumber: body.bookNumber } });
  if (clash) throw conflict(`Book number ${body.bookNumber} is already used by "${clash.title}"`);

  const book = await prisma.book.create({ data: body });
  await audit.record(req, { action: 'book.create', entityType: 'Book', entityId: book.id, after: body });

  return created(res, book);
};

/** PATCH /api/admin/books/:id */
export const update = async (req, res) => {
  const before = await prisma.book.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Book');

  if (req.valid.body.bookNumber && req.valid.body.bookNumber !== before.bookNumber) {
    throw badRequest('bookNumber cannot be changed — it is part of every verse id in the book');
  }

  const book = await prisma.book.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, {
    action: 'book.update',
    entityType: 'Book',
    entityId: book.id,
    before,
    after: book,
  });

  return ok(res, book);
};

/**
 * POST /api/admin/books/:id/publish
 * Publishing is separate from editing so it is a deliberate act with its own
 * permission. A book with no verses is refused — an empty book in the app looks
 * like a bug to everyone who opens it.
 */
export const publish = async (req, res) => {
  const { isPublished } = req.valid.body;

  const book = await prisma.book.findUnique({
    where: { id: req.valid.params.id },
    include: { _count: { select: { verses: true } } },
  });
  if (!book) throw notFound('Book');

  if (isPublished && book._count.verses === 0) {
    throw badRequest('That book has no verses yet');
  }

  await recountBook(book.id);
  const updated = await prisma.book.update({ where: { id: book.id }, data: { isPublished } });

  await audit.record(req, {
    action: isPublished ? 'book.publish' : 'book.unpublish',
    entityType: 'Book',
    entityId: book.id,
    before: { isPublished: book.isPublished },
    after: { isPublished },
  });

  return ok(res, updated);
};

/** DELETE /api/admin/books/:id — cascades to every canto, chapter and verse. */
export const remove = async (req, res) => {
  const book = await prisma.book.findUnique({
    where: { id: req.valid.params.id },
    include: { _count: { select: { verses: true } } },
  });
  if (!book) throw notFound('Book');

  if (book.isPublished) throw badRequest('Unpublish the book before deleting it');

  await prisma.book.delete({ where: { id: book.id } });
  await audit.record(req, {
    action: 'book.delete',
    entityType: 'Book',
    entityId: book.id,
    before: { title: book.title, verses: book._count.verses },
  });

  return noContent(res);
};

/** POST /api/admin/books/:id/recount — rebuilds the rollups after a bulk import. */
export const recount = async (req, res) => {
  const book = await prisma.book.findUnique({ where: { id: req.valid.params.id } });
  if (!book) throw notFound('Book');

  await recountBook(book.id);
  const updated = await prisma.book.findUnique({ where: { id: book.id } });

  return ok(res, updated);
};

// ── Cantos ─────────────────────────────────────────────────────────────────

export const createCanto = async (req, res) => {
  const canto = await prisma.canto.create({
    data: { ...req.valid.body, bookId: req.valid.params.id },
  });
  await recountBook(req.valid.params.id);
  await audit.record(req, { action: 'canto.create', entityType: 'Canto', entityId: canto.id, after: canto });
  return created(res, canto);
};

export const updateCanto = async (req, res) => {
  const canto = await prisma.canto.update({
    where: { id: req.valid.params.cantoId },
    data: req.valid.body,
  });
  await audit.record(req, { action: 'canto.update', entityType: 'Canto', entityId: canto.id, after: canto });
  return ok(res, canto);
};

// ── Chapters ───────────────────────────────────────────────────────────────

export const createChapter = async (req, res) => {
  const bookId = req.valid.params.id;
  const body = req.valid.body;

  // cantoNumber is denormalised onto Chapter so a chapter list never needs the
  // canto join. It has to be filled from the canto rather than trusted from the
  // request, or the two can disagree.
  let cantoNumber = null;
  if (body.cantoId) {
    const canto = await prisma.canto.findUnique({ where: { id: body.cantoId } });
    if (!canto || canto.bookId !== bookId) throw badRequest('That canto is not in this book');
    cantoNumber = canto.number;
  }

  const chapter = await prisma.chapter.create({ data: { ...body, bookId, cantoNumber } });
  await recountBook(bookId);

  await audit.record(req, {
    action: 'chapter.create',
    entityType: 'Chapter',
    entityId: chapter.id,
    after: chapter,
  });

  return created(res, chapter);
};

export const updateChapter = async (req, res) => {
  const chapter = await prisma.chapter.update({
    where: { id: req.valid.params.chapterId },
    data: req.valid.body,
  });
  await audit.record(req, {
    action: 'chapter.update',
    entityType: 'Chapter',
    entityId: chapter.id,
    after: chapter,
  });
  return ok(res, chapter);
};

/** PUT /api/admin/books/:id/translators/:translatorId — link a rendering to a book. */
export const linkTranslator = async (req, res) => {
  const { id: bookId, translatorId } = req.valid.params;
  const { seriesName, publishedYear, isDefault } = req.valid.body;

  // Exactly one default per book: this is the rendering readers get unless they
  // pick another, and two of them would make that choice arbitrary.
  if (isDefault) {
    await prisma.bookTranslator.updateMany({ where: { bookId }, data: { isDefault: false } });
  }

  const link = await prisma.bookTranslator.upsert({
    where: { bookId_translatorId: { bookId, translatorId } },
    update: { seriesName, publishedYear, isDefault },
    create: { bookId, translatorId, seriesName, publishedYear, isDefault },
  });

  return ok(res, link);
};

// Exported for the verse importer, which changes a book's structure in bulk.
export { recountBook };
