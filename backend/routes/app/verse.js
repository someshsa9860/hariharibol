import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/verse.js';

const router = createRouter({
  tag: 'Verses',
  prefix: '/verses',
  description:
    'Individual verses, their translations, narrations and cross-links. Addressed by the ' +
    'dotted `verseId` — 1.2.47 for Bhagavad Gita 2.47, 2.10.1.5 for Srimad Bhagavatam ' +
    'canto 10, chapter 1, verse 5.',
});

const verseIdParam = z.object({
  verseId: z.string().regex(/^\d+(\.\d+){1,3}(-\d+)?$/, 'Expected a dotted verse id like 1.2.47'),
});

router.get(
  '/',
  {
    summary: 'List verses',
    description:
      'Flat listing across chapters, for browsing by tag. Reading a chapter in order is ' +
      'better served by GET /books/{slug}/chapters/{number}, which returns the chapter and ' +
      'its verses together.',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      bookNumber: z.coerce.number().int().min(1).optional(),
      canto: z.coerce.number().int().min(1).max(12).optional(),
      chapter: z.coerce.number().int().min(1).optional(),
      tag: z.string().max(50).optional(),
    }),
    responds: { 200: 'A page of verses' },
  },
  controller.list
);

router.get(
  '/:verseId',
  {
    summary: 'Get one verse',
    description:
      'The verse with its translation already resolved to the reader’s language, the other ' +
      'available renderings listed, and whether this reader has bookmarked it. Any ' +
      'explanation is returned separately from the translation and is never presented as ' +
      'acharya commentary.',
    public: true,
    limit: 'read',
    params: verseIdParam,
    responds: { 200: 'The verse', 404: 'No such verse' },
  },
  controller.get
);

router.get(
  '/:verseId/translations',
  {
    summary: 'List every translation of a verse',
    description:
      'Full text of all published renderings, for comparing acharyas side by side. Filter ' +
      'by `translator` or `languageCode`.',
    public: true,
    limit: 'read',
    params: verseIdParam,
    query: z.object({
      translator: z.string().max(100).optional(),
      languageCode: z.string().max(10).optional(),
    }),
    responds: { 200: 'Translations', 404: 'No such verse' },
  },
  controller.translations
);

router.get(
  '/:verseId/narrations',
  {
    summary: 'List narrations of a verse',
    description:
      'A saint’s telling of the story around the verse, attributed and usually with audio. ' +
      'Narrative rather than commentary on the text — the two are kept apart deliberately.',
    public: true,
    limit: 'read',
    params: verseIdParam,
    responds: { 200: 'Narrations in the reader’s language', 404: 'No such verse' },
  },
  controller.narrations
);

router.get(
  '/:verseId/related',
  {
    summary: 'List related verses',
    description:
      'Curated cross-links between the Gita and the Bhagavatam — same concept, expands on, ' +
      'quoted in, contrasts with. Directional: only links out of this verse are returned.',
    public: true,
    limit: 'read',
    params: verseIdParam,
    responds: { 200: 'Related verses with the relation that connects them', 404: 'No such verse' },
  },
  controller.related
);

export default router;
