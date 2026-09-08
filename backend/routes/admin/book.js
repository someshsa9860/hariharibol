import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/book.js';

const router = createRouter({
  tag: 'Admin · Books',
  prefix: '/books',
  description:
    'Books, cantos and chapters. `bookNumber` is the first segment of every verse id beneath ' +
    'the book and is already baked into the scraped source files, so it is set once and ' +
    'never changed.',
});

const contentType = z.enum(['SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT']);

const bookBody = {
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  type: contentType,
  title: z.string().min(1).max(200),
  titleI18n: z.record(z.string()).optional(),
  description: z.string().max(5000).optional(),
  descriptionI18n: z.record(z.string()).optional(),
  sourceLanguage: z.string().max(10).optional(),
  sampradaya: z.string().max(50).optional(),
  deityId: z.string().nullable().optional(),
  coverImagePath: z.string().max(500).nullable().optional(),
  audioPath: z.string().max(500).nullable().optional(),
  tags: z.array(z.string().max(50)).optional(),
  displayOrder: z.coerce.number().int().optional(),
};

router.get(
  '/',
  {
    summary: 'List books',
    permission: 'book.read',
    limit: 'read',
    query: schemas.page.extend({
      type: contentType.optional(),
      isPublished: z.coerce.boolean().optional(),
    }),
    responds: { 200: 'A page of books' },
  },
  controller.list
);

router.get(
  '/:id',
  {
    summary: 'Get one book with its structure',
    permission: 'book.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The book, its cantos, chapters and translators', 404: 'No such book' },
  },
  controller.get
);

router.post(
  '/',
  {
    summary: 'Create a book',
    description: '`bookNumber` must be unused — two books sharing one would claim the same verse ids.',
    permission: 'book.write',
    limit: 'write',
    body: z.object({ ...bookBody, bookNumber: z.coerce.number().int().min(1) }),
    responds: { 201: 'The book', 409: 'That book number is taken' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Update a book',
    description: '`bookNumber` cannot be changed — it is part of every verse id in the book.',
    permission: 'book.write',
    limit: 'write',
    params: schemas.id,
    body: z.object(bookBody).partial(),
    responds: { 200: 'The book', 400: 'Attempted to change bookNumber', 404: 'No such book' },
  },
  controller.update
);

router.post(
  '/:id/publish',
  {
    summary: 'Publish or unpublish a book',
    description:
      'Recounts the structure first, and refuses to publish a book with no verses — an empty ' +
      'book in the app reads as a bug to everyone who opens it.',
    permission: 'book.publish',
    limit: 'write',
    params: schemas.id,
    body: z.object({ isPublished: z.boolean() }),
    responds: { 200: 'The book', 400: 'No verses yet' },
  },
  controller.publish
);

router.post(
  '/:id/recount',
  {
    summary: 'Rebuild a book’s counts',
    description:
      'Recomputes canto, chapter and verse totals from what is actually there. Run after a ' +
      'bulk import — a wrong count shows up as a progress bar that never reaches the end.',
    permission: 'book.write',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The book with fresh counts' },
  },
  controller.recount
);

router.delete(
  '/:id',
  {
    summary: 'Delete a book',
    description: 'Cascades to every canto, chapter and verse. Unpublish it first.',
    permission: 'book.delete',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 400: 'Still published' },
  },
  controller.remove
);

router.post(
  '/:id/cantos',
  {
    summary: 'Add a canto',
    description: 'Srimad Bhagavatam only — nothing else in the library is organised this way.',
    permission: 'book.write',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      number: z.coerce.number().int().min(1).max(12),
      title: z.string().min(1).max(200),
      titleI18n: z.record(z.string()).optional(),
      summary: z.string().max(5000).optional(),
    }),
    responds: { 201: 'The canto' },
  },
  controller.createCanto
);

router.patch(
  '/:id/cantos/:cantoId',
  {
    summary: 'Update a canto',
    permission: 'book.write',
    limit: 'write',
    params: z.object({ id: z.string(), cantoId: z.string() }),
    body: z.object({
      title: z.string().min(1).max(200).optional(),
      titleI18n: z.record(z.string()).optional(),
      summary: z.string().max(5000).optional(),
    }),
    responds: { 200: 'The canto' },
  },
  controller.updateCanto
);

router.post(
  '/:id/chapters',
  {
    summary: 'Add a chapter',
    description:
      '`cantoNumber` is filled from the canto rather than taken from the request — it is ' +
      'denormalised onto the chapter so lists avoid a join, and the two must not disagree.',
    permission: 'book.write',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      number: z.coerce.number().int().min(1),
      cantoId: z.string().nullable().optional(),
      title: z.string().min(1).max(200),
      titleI18n: z.record(z.string()).optional(),
      summary: z.string().max(5000).optional(),
    }),
    responds: { 201: 'The chapter', 400: 'That canto is not in this book' },
  },
  controller.createChapter
);

router.patch(
  '/:id/chapters/:chapterId',
  {
    summary: 'Update a chapter',
    permission: 'book.write',
    limit: 'write',
    params: z.object({ id: z.string(), chapterId: z.string() }),
    body: z.object({
      title: z.string().min(1).max(200).optional(),
      titleI18n: z.record(z.string()).optional(),
      summary: z.string().max(5000).optional(),
    }),
    responds: { 200: 'The chapter' },
  },
  controller.updateChapter
);

router.put(
  '/:id/translators/:translatorId',
  {
    summary: 'Link a translator to a book',
    description:
      'Marking one default clears the others: this is the rendering readers get unless they ' +
      'pick another, and two defaults would make that choice arbitrary.',
    permission: 'translator.manage',
    limit: 'write',
    params: z.object({ id: z.string(), translatorId: z.string() }),
    body: z.object({
      seriesName: z.string().max(200).optional(),
      publishedYear: z.coerce.number().int().optional(),
      isDefault: z.boolean().optional(),
    }),
    responds: { 200: 'The link' },
  },
  controller.linkTranslator
);

export default router;
