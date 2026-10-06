import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/mantra.js';

const router = createRouter({
  tag: 'Admin · Mantras',
  prefix: '/mantras',
  description:
    'Mantras and their per-language renderings. Each rendering carries both the mantra in ' +
    'that script and what it means, because the app selects those two by different user ' +
    'settings.',
});

router.get(
  '/',
  {
    summary: 'List mantras',
    permission: 'mantra.read',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      category: z.string().max(50).optional(),
      isPublished: schemas.flag.optional(),
    }),
    responds: { 200: 'A page of mantras' },
  },
  controller.list
);

router.get(
  '/languages',
  {
    summary: 'Languages a mantra can be rendered in',
    permission: 'mantra.read',
    limit: 'read',
    responds: { 200: 'Active mantra languages, in display order' },
  },
  controller.languages
);

router.post(
  '/transliterate',
  {
    summary: 'Draft a mantra in another script',
    description:
      'Converts Devanagari text into the script of `languageCode` (Bengali, Gujarati, Tamil, ' +
      'Telugu …). Nothing is saved — it gives the editor a starting point to review. Tamil has ' +
      'no aspirated or voiced consonants, so those collapse onto the plain ones there.',
    permission: 'mantra.write',
    limit: 'write',
    body: z.object({ text: z.string().min(1).max(10000), languageCode: z.string().max(10) }),
    responds: { 200: 'The converted text' },
  },
  controller.transliterate
);

router.get(
  '/:id',
  {
    summary: 'Get one mantra with its translations',
    permission: 'mantra.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The mantra', 404: 'No such mantra' },
  },
  controller.get
);

const mantraBody = {
  slug: z.string().regex(/^[a-z0-9-]+$/).max(100),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional(),
  deityId: z.string().nullable().optional(),
  guruId: z.string().nullable().optional(),
  sanskrit: z.string().min(1),
  transliteration: z.string().optional(),
  category: z.string().min(1).max(50),
  sampradaya: z.string().max(50).optional(),
  tags: z.array(z.string().max(50)).optional(),
  audioPath: z.string().max(500).nullable().optional(),
  durationMs: z.coerce.number().int().min(0).nullable().optional(),
  standardRounds: z.coerce.number().int().min(0).nullable().optional(),
  standardCount: z.coerce.number().int().min(0).nullable().optional(),
  displayOrder: z.coerce.number().int().optional(),
};

router.post(
  '/',
  {
    summary: 'Create a mantra',
    permission: 'mantra.write',
    limit: 'write',
    body: z.object(mantraBody),
    responds: { 201: 'The mantra' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Update a mantra',
    permission: 'mantra.write',
    limit: 'write',
    params: schemas.id,
    body: z.object(mantraBody).partial(),
    responds: { 200: 'The mantra', 404: 'No such mantra' },
  },
  controller.update
);

router.post(
  '/:id/publish',
  {
    summary: 'Publish or unpublish a mantra',
    description:
      'Checks that the audio file is actually in the bucket, not merely that a key is set. ' +
      'A key pointing at nothing gives the reader a play button that does nothing, and they ' +
      'blame their own connection. Duration and at least one language rendering are also ' +
      'required — the chant pacing depends on the first, and the app cannot display the second.',
    permission: 'mantra.publish',
    limit: 'write',
    params: schemas.id,
    body: z.object({ isPublished: z.boolean() }),
    responds: { 200: 'The mantra', 400: 'Missing audio, duration or translations' },
  },
  controller.publish
);

router.delete(
  '/:id',
  {
    summary: 'Delete a mantra',
    permission: 'mantra.delete',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 400: 'Still published' },
  },
  controller.remove
);

router.put(
  '/:id/translations',
  {
    summary: 'Add or replace a language rendering',
    description:
      '`text` is the mantra written in that language’s script — selected by the user’s mantra ' +
      'language. `meaning` is what it means — selected by their reading language. A single ' +
      'response may combine two different rows of this table.',
    permission: 'mantra.write',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      languageCode: z.string().max(10),
      name: z.string().max(200).nullable().optional(),
      description: z.string().max(5000).nullable().optional(),
      text: z.string().min(1),
      meaning: z.string().nullable().optional(),
      purport: z.string().nullable().optional(),
      audioPath: z.string().max(500).nullable().optional(),
      durationMs: z.coerce.number().int().nullable().optional(),
      isPublished: z.boolean().optional(),
    }),
    responds: { 200: 'The rendering', 400: 'Unknown language', 404: 'No such mantra' },
  },
  controller.upsertTranslation
);

router.delete(
  '/:id/translations/:translationId',
  {
    summary: 'Delete a language rendering',
    permission: 'mantra.delete',
    limit: 'write',
    params: z.object({ id: z.string(), translationId: z.string() }),
    responds: { 204: 'Deleted', 404: 'No such translation on this mantra' },
  },
  controller.deleteTranslation
);

export default router;
