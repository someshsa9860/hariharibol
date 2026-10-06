import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/reel-recipe.js';
import { overlay, key } from './reel.js';

const router = createRouter({
  tag: 'Admin · Reel recipes',
  prefix: '/reel-recipes',
  description:
    'Make reels in bulk from the verses of a book. A recipe is a selection of verses plus a ' +
    'template — the design every reel starts from, with text boxes bound to a verse field. ' +
    'Generating makes one draft reel per verse, tagged with its book, canto and chapter, so ' +
    'the app can offer "more like this".',
});

// What the editor saves for a template. The same shape as a reel's media and
// overlays; there is no caption, tags or creator — those are per reel.
const config = z.object({
  mediaType: z.enum(['VIDEO', 'IMAGE']),
  videoPath: key.nullable(),
  images: z.array(key).max(20),
  // Background music, used when a run does not use each verse's own recitation.
  audioPath: key.nullable(),
  thumbnailPath: key.nullable(),
  durationMs: z.number().int().min(0).nullable(),
  width: z.number().int().min(1).nullable(),
  height: z.number().int().min(1).nullable(),
  overlays: z.array(overlay).max(20),
});

const selection = z.object({
  bookId: z.string().min(1),
  cantoNumber: z.number().int().nullable().optional(),
  chapterId: z.string().min(1).nullable().optional(),
  verseFrom: z.number().int().min(1).nullable().optional(),
  verseTo: z.number().int().min(1).nullable().optional(),
  // A topic: one of the tags verses in the book already carry.
  tag: z.string().trim().max(60).nullable().optional(),
  // Free keywords — a verse matches if any appears in its Sanskrit, transliteration,
  // a published translation, or its tags.
  hints: z.array(z.string().trim().min(1).max(60)).max(10).default([]),
  limit: z.number().int().min(1).max(controller.GENERATE_MAX).default(20),
  // The language the translation box is written in on the reel itself; readers
  // still see their own language when it is fetched.
  languageCode: z.string().min(1).max(10).default('en'),
});

router.get(
  '/books',
  {
    summary: 'Books a recipe can use',
    description: 'Books that have verses.',
    permission: 'reel.write',
    limit: 'read',
    responds: { 200: 'Books' },
  },
  controller.books
);

router.get(
  '/outline',
  {
    summary: 'What a book can be narrowed by',
    description: 'Its cantos, chapters and the most common verse tags (topics).',
    permission: 'reel.write',
    limit: 'read',
    query: z.object({ bookId: z.string().min(1) }),
    responds: { 200: 'Cantos, chapters and tags', 404: 'No such book' },
  },
  controller.outline
);

router.post(
  '/preview',
  {
    summary: 'Preview a selection',
    description:
      'How many verses match, how many reels a run would make, and the first few. With a ' +
      '`templateId`, verses that template was already used on are left out — the same rule ' +
      'generating applies.',
    permission: 'reel.write',
    limit: 'read',
    body: z.object({
      selection,
      templateId: z.string().min(1).nullable().optional(),
      useVerseAudio: z.boolean().default(false),
    }),
    responds: { 200: 'Count and sample verses' },
  },
  controller.preview
);

router.post(
  '/generate',
  {
    summary: 'Make reels from a template and a selection',
    description:
      'One reel per matching verse, up to the limit (at most 100). Drafts unless `publish` is ' +
      'set, which also needs `reel.publish`. With `useVerseAudio` each reel plays its verse’s ' +
      'recitation and verses without one are not candidates; otherwise it plays the template’s ' +
      'music, if any. Every reel is tagged book / canto / chapter plus their names, then the ' +
      'hints and `extraTags`. Verses that already have a reel from this template are skipped.',
    permission: 'reel.write',
    limit: 'write',
    body: z.object({
      templateId: z.string().min(1),
      creatorId: z.string().min(1),
      selection,
      useVerseAudio: z.boolean().default(false),
      publish: z.boolean().default(false),
      extraTags: z.array(z.string().trim().min(1).max(50)).max(10).default([]),
    }),
    responds: { 201: 'What was made and what was skipped', 400: 'Nothing matches, or the template is incomplete', 403: 'Publishing without reel.publish' },
  },
  controller.generate
);

router.get(
  '/templates',
  {
    summary: 'List templates',
    description: 'Active templates, most recently changed first.',
    permission: 'reel.read',
    limit: 'read',
    responds: { 200: 'Templates, with signed media links' },
  },
  controller.listTemplates
);

router.get(
  '/templates/:id',
  {
    summary: 'Get one template',
    permission: 'reel.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The template', 404: 'No such template' },
  },
  controller.getTemplate
);

router.post(
  '/templates',
  {
    summary: 'Create a template',
    permission: 'reel.write',
    limit: 'write',
    body: z.object({ name: z.string().trim().min(1).max(100), config }),
    responds: { 201: 'The template', 400: 'Bad media key' },
  },
  controller.createTemplate
);

router.patch(
  '/templates/:id',
  {
    summary: 'Update a template',
    description: 'Reels already made from it are not changed.',
    permission: 'reel.write',
    limit: 'write',
    params: schemas.id,
    body: z.object({ name: z.string().trim().min(1).max(100).optional(), config: config.optional() }),
    responds: { 200: 'The template', 404: 'No such template' },
  },
  controller.updateTemplate
);

router.delete(
  '/templates/:id',
  {
    summary: 'Delete a template',
    description: 'Reels made from it stay; they just no longer belong to a template.',
    permission: 'reel.delete',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 404: 'No such template' },
  },
  controller.removeTemplate
);

export default router;
