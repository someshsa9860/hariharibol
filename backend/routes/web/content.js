import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/web/content.js';

const router = createRouter({
  tag: 'Website content',
  prefix: '/content',
  description:
    'Public content for hariharibol.com. Kept apart from the app’s endpoints because the two ' +
    'want different things — the website is indexed, so it returns full text, canonical URLs ' +
    'and neighbours; the app returns small payloads resolved to a signed-in reader.',
});

const verseIdParam = z.object({
  verseId: z.string().regex(/^\d+(\.\d+){1,3}(-\d+)?$/, 'Expected a dotted verse id'),
});

const langQuery = { lang: z.string().max(10).optional() };

router.get(
  '/books',
  {
    summary: 'List books',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      type: z.enum(['SCRIPTURE', 'STOTRA', 'AARTI', 'PRAYER', 'POEM', 'TEXT']).optional(),
      ...langQuery,
    }),
    responds: { 200: 'Published books' },
  },
  controller.books
);

router.get(
  '/books/:slug',
  {
    summary: 'Get a book with its full contents list',
    description: 'Everything the book index page renders: cantos, chapters and translators.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    query: z.object(langQuery),
    responds: { 200: 'The book', 404: 'No such published book' },
  },
  controller.book
);

router.get(
  '/verses/:verseId',
  {
    summary: 'Get a verse with every translation',
    description:
      'The website page is the canonical one for a verse, so it carries all published ' +
      'renderings rather than the single one the app would resolve, plus the previous and ' +
      'next verse for navigation.',
    public: true,
    limit: 'read',
    params: verseIdParam,
    query: z.object(langQuery),
    responds: { 200: 'The verse', 404: 'No such verse, or its book is unpublished' },
  },
  controller.verse
);

router.get(
  '/sloka/today',
  {
    summary: 'Get the sloka of the day',
    description: 'The shareable daily verse, with its artwork and a share URL.',
    public: true,
    limit: 'read',
    query: z.object({
      date: z
        .string()
        .regex(/^\d{4}-\d{2}-\d{2}$/)
        .optional(),
      ...langQuery,
    }),
    responds: { 200: 'The sloka', 404: 'Nothing published for that date' },
  },
  controller.slokaOfTheDay
);

router.get(
  '/sitemap',
  {
    summary: 'List every canonical URL',
    description:
      'Slugs and verse ids with their last-modified times, for the site to build sitemap.xml ' +
      'from. Ids only — shipping the corpus text through here would be a very large response ' +
      'for something a crawler reads occasionally.',
    public: true,
    limit: 'read',
    responds: { 200: 'Ids and timestamps' },
  },
  controller.sitemap
);

export default router;
