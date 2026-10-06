import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/book.js';

const router = createRouter({
  tag: 'Books',
  prefix: '/books',
  description:
    'The library: complete works, their cantos and chapters. Public — the content is free, ' +
    'and reading it does not require an account.',
});

router.get(
  '/',
  {
    summary: 'List books',
    description:
      'Published works only. Filter by `type` to separate the scriptures from the short ' +
      'works — stotras, aartis, prayers, poems.',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      type: z.enum(['SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT']).optional(),
      deity: z.string().max(100).optional(),
      tag: z.string().max(50).optional(),
    }),
    responds: { 200: 'A page of books' },
  },
  controller.list
);

router.get(
  '/:slug',
  {
    summary: 'Get one book',
    description:
      'The book with its counts and the translators whose renderings it carries, including ' +
      'which one is shown unless the reader picks another.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    responds: { 200: 'The book', 404: 'No such published book' },
  },
  controller.get
);

router.get(
  '/:slug/cantos',
  {
    summary: 'List a book’s cantos',
    description:
      'Only Srimad Bhagavatam has cantos — twelve of them. Every other book returns an ' +
      'empty list rather than an error, so the client can call it unconditionally.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    responds: { 200: 'Cantos in order', 404: 'No such published book' },
  },
  controller.cantos
);

router.get(
  '/:slug/chapters',
  {
    summary: 'List a book’s chapters',
    description: 'Pass `canto` for Srimad Bhagavatam. The Gita has none, so it returns all 18.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    query: z.object({ canto: z.coerce.number().int().min(1).max(12).optional() }),
    responds: { 200: 'Chapters in order', 404: 'No such published book' },
  },
  controller.chapters
);

router.get(
  '/:slug/chapters/bulk',
  {
    summary: 'Read every chapter in a book, or one canto, for offline download',
    description:
      'Every chapter in scope with its verses, already resolved to the reader’s language — ' +
      'the same shape as GET /:slug/chapters/{number}, repeated. This is the download path, ' +
      'not the reading screen: Bhagavad Gita has no cantos, so it has no translation and ' +
      'purport volume large enough to matter, and this returns the whole book in one call. ' +
      'Srimad Bhagavatam’s does, so `canto` is required there and this is called once per ' +
      'canto — twelve requests for the whole book instead of one per chapter. Registered ' +
      'ahead of /:slug/chapters/:number so "bulk" is never parsed as a chapter number.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    query: z.object({ canto: z.coerce.number().int().min(1).max(12).optional() }),
    responds: {
      200: 'Every chapter in scope, each with its verses',
      400: 'Book is organised by canto and none was given',
      404: 'No such published book',
    },
  },
  controller.chaptersBulk
);

router.get(
  '/:slug/chapters/:number',
  {
    summary: 'Read a chapter',
    description:
      'The chapter and every verse in it, each already resolved to the reader’s language. ' +
      'This is the reading screen in one call — splitting the verses out would cost a second ' +
      'round trip on every chapter opened.',
    public: true,
    limit: 'read',
    params: z.object({ slug: z.string().min(1), number: z.coerce.number().int().min(1) }),
    query: z.object({ canto: z.coerce.number().int().min(1).max(12).optional() }),
    responds: {
      200: 'The chapter and its verses',
      400: 'Book is organised by canto and none was given',
      404: 'No such chapter',
    },
  },
  controller.chapter
);

router.get(
  '/:slug/verses',
  {
    summary: 'Read a short work',
    description:
      'Every verse of a book with no chapters — a stotra, aarti, prayer or poem — in order, ' +
      'already resolved to the reader’s language. The equivalent of ' +
      'GET /:slug/chapters/{number} for a book whose verses hang directly off it.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    responds: {
      200: 'The book’s verses in order',
      400: 'Book is organised by chapter instead',
      404: 'No such published book',
    },
  },
  controller.verses
);

export default router;
