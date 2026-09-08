import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/verse.js';

const router = createRouter({
  tag: 'Admin · Verses',
  prefix: '/verses',
  description:
    'Verses and everything attached to them. Two rules run through all of it: `verseId` is ' +
    'immutable, because deeplinks and bookmarks already point at it; and translations ' +
    '(an acharya’s work) are never stored alongside explanations (ours, or the AI’s).',
});

const verseIdParam = z.object({
  verseId: z.string().regex(/^\d+(\.\d+){1,3}(-\d+)?$/, 'Expected a dotted verse id'),
});

router.get(
  '/',
  {
    summary: 'List verses',
    description:
      'The editorial worklist. `untranslated=true` returns verses with no published rendering ' +
      'at all, which is usually what someone opening this screen is looking for.',
    permission: 'verse.read',
    limit: 'read',
    query: schemas.page.extend({
      bookId: z.string().optional(),
      canto: z.coerce.number().int().optional(),
      chapter: z.coerce.number().int().optional(),
      isSlokaEligible: z.coerce.boolean().optional(),
      untranslated: z.coerce.boolean().optional(),
    }),
    responds: { 200: 'A page of verses with attachment counts' },
  },
  controller.list
);

router.get(
  '/:verseId',
  {
    summary: 'Get one verse with everything attached',
    description: 'Including unpublished translations, explanations, narrations and issue mappings.',
    permission: 'verse.read',
    limit: 'read',
    params: verseIdParam,
    responds: { 200: 'The verse', 404: 'No such verse' },
  },
  controller.get
);

router.post(
  '/',
  {
    summary: 'Create a verse',
    permission: 'verse.write',
    limit: 'write',
    body: z.object({
      verseId: z.string().regex(/^\d+(\.\d+){1,3}(-\d+)?$/),
      bookId: z.string().min(1),
      chapterId: z.string().nullable().optional(),
      cantoNumber: z.coerce.number().int().nullable().optional(),
      chapterNumber: z.coerce.number().int().nullable().optional(),
      verseNumber: z.coerce.number().int().min(1),
      verseNumberEnd: z.coerce.number().int().nullable().optional(),
      type: z.enum(['SHLOKA', 'PROSE', 'LINE', 'REFRAIN', 'MANTRA']).optional(),
      sanskrit: z.string().optional(),
      transliteration: z.string().optional(),
      wordMeanings: z.any().optional(),
      audioPath: z.string().max(500).nullable().optional(),
      tags: z.array(z.string().max(50)).optional(),
    }),
    responds: { 201: 'The verse', 404: 'No such book' },
  },
  controller.create
);

router.patch(
  '/:verseId',
  {
    summary: 'Update a verse',
    description: '`verseId` itself cannot be changed — links that already exist point at it.',
    permission: 'verse.write',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      sanskrit: z.string().optional(),
      transliteration: z.string().optional(),
      wordMeanings: z.any().optional(),
      audioPath: z.string().max(500).nullable().optional(),
      tags: z.array(z.string().max(50)).optional(),
      type: z.enum(['SHLOKA', 'PROSE', 'LINE', 'REFRAIN', 'MANTRA']).optional(),
      isSlokaEligible: z.boolean().optional(),
    }),
    responds: { 200: 'The verse', 400: 'Attempted to change verseId', 404: 'No such verse' },
  },
  controller.update
);

router.delete(
  '/:verseId',
  {
    summary: 'Delete a verse',
    permission: 'verse.delete',
    limit: 'write',
    params: verseIdParam,
    responds: { 204: 'Deleted', 404: 'No such verse' },
  },
  controller.remove
);

router.post(
  '/sloka-eligibility',
  {
    summary: 'Mark verses as sloka-eligible, in bulk',
    description:
      'Curating this pool is done a chapter at a time, so it takes a list. Only Bhagavad Gita ' +
      'and Srimad Bhagavatam verses are ever eligible — a short work is not something to hand ' +
      'someone as the verse for their day, and the restriction is enforced here rather than ' +
      'trusted to whoever is clicking.',
    permission: 'sloka.manage',
    limit: 'write',
    body: z.object({
      verseIds: z.array(z.string()).min(1).max(500),
      isSlokaEligible: z.boolean(),
    }),
    responds: { 200: 'How many changed', 400: 'A verse from an ineligible book', 404: 'Unknown verse ids' },
  },
  controller.setSlokaEligibility
);

router.put(
  '/:verseId/translations',
  {
    summary: 'Add or replace a translation',
    description:
      'One translator’s rendering in one language. Keyed on verse + translator + language + ' +
      'type, so re-sending the same combination edits it rather than duplicating it.',
    permission: 'verse.write',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      translatorId: z.string().min(1),
      languageCode: z.string().max(10),
      type: z.enum(['TRANSLATION', 'COMMENTARY', 'POETIC_EXPANSION']).optional(),
      meaning: z.string().min(1),
      purport: z.string().optional(),
      sourceRef: z.string().max(50).optional(),
      audioPath: z.string().max(500).nullable().optional(),
      isPublished: z.boolean().optional(),
      displayOrder: z.coerce.number().int().optional(),
    }),
    responds: { 200: 'The translation', 404: 'No such verse' },
  },
  controller.upsertTranslation
);

router.delete(
  '/:verseId/translations/:translationId',
  {
    summary: 'Delete a translation',
    permission: 'verse.delete',
    limit: 'write',
    params: z.object({ verseId: z.string(), translationId: z.string() }),
    responds: { 204: 'Deleted' },
  },
  controller.deleteTranslation
);

router.put(
  '/:verseId/explanation',
  {
    summary: 'Add or replace an explanation',
    description:
      'A short plain-language note, written once per language and reused by every reader. ' +
      'Deliberately not stored as a translation: app-written or generated text must never be ' +
      'able to surface as though an acharya had said it.',
    permission: 'verse.write',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      languageCode: z.string().max(10),
      text: z.string().min(1).max(5000),
      source: z.enum(['MANUAL', 'RULE', 'AI']).optional(),
      isPublished: z.boolean().optional(),
    }),
    responds: { 200: 'The explanation', 404: 'No such verse' },
  },
  controller.upsertExplanation
);

router.post(
  '/:verseId/narrations',
  {
    summary: 'Add a narration',
    description:
      'A saint’s telling of the story around a verse, attributed and usually with audio. ' +
      'Narrative, not commentary on the text.',
    permission: 'verse.write',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      guruId: z.string().nullable().optional(),
      languageCode: z.string().max(10),
      title: z.string().max(200).optional(),
      text: z.string().optional(),
      audioPath: z.string().max(500).nullable().optional(),
      durationMs: z.coerce.number().int().optional(),
      sourceNote: z.string().max(500).optional(),
      isPublished: z.boolean().optional(),
    }),
    responds: { 201: 'The narration', 404: 'No such verse' },
  },
  controller.createNarration
);

router.patch(
  '/:verseId/narrations/:narrationId',
  {
    summary: 'Update a narration',
    permission: 'verse.write',
    limit: 'write',
    params: z.object({ verseId: z.string(), narrationId: z.string() }),
    body: z.object({
      title: z.string().max(200).optional(),
      text: z.string().optional(),
      audioPath: z.string().max(500).nullable().optional(),
      durationMs: z.coerce.number().int().optional(),
      isPublished: z.boolean().optional(),
      displayOrder: z.coerce.number().int().optional(),
    }),
    responds: { 200: 'The narration' },
  },
  controller.updateNarration
);

router.delete(
  '/:verseId/narrations/:narrationId',
  {
    summary: 'Delete a narration',
    permission: 'verse.delete',
    limit: 'write',
    params: z.object({ verseId: z.string(), narrationId: z.string() }),
    responds: { 204: 'Deleted' },
  },
  controller.deleteNarration
);

router.post(
  '/:verseId/links',
  {
    summary: 'Link one verse to another',
    description:
      'Directional. "Expands on" does not read the same in reverse, so A→B and B→A are ' +
      'separate rows and the editor decides whether both should exist.',
    permission: 'verse.write',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      targetVerseId: z.string().min(1),
      relation: z.enum(['SAME_CONCEPT', 'EXPANDS_ON', 'QUOTED_IN', 'CONTRASTS_WITH']),
      note: z.string().max(500).optional(),
    }),
    responds: { 201: 'The link', 400: 'A verse cannot link to itself', 404: 'No such verse' },
  },
  controller.createLink
);

router.delete(
  '/:verseId/links/:linkId',
  {
    summary: 'Remove a link',
    permission: 'verse.write',
    limit: 'write',
    params: z.object({ verseId: z.string(), linkId: z.string() }),
    responds: { 204: 'Deleted' },
  },
  controller.deleteLink
);

router.put(
  '/:verseId/issues',
  {
    summary: 'Set which struggles a verse speaks to',
    description:
      'The table the personalised sloka reads. `weight` decides which verse wins when several ' +
      'speak to the same struggle: 90+ means the verse addresses it head on, 50 means it is ' +
      'relevant. Replaces the whole set for this verse. This is the highest-leverage ' +
      'editorial surface in the system — a handful of well-chosen verses per struggle does ' +
      'more than a complete but careless mapping.',
    permission: 'sloka.manage',
    limit: 'write',
    params: verseIdParam,
    body: z.object({
      issues: z
        .array(
          z.object({
            slug: z.string().min(1).max(100),
            weight: z.coerce.number().int().min(0).max(100).optional(),
          })
        )
        .max(20),
    }),
    responds: { 200: 'The mapping', 400: 'Unknown issue slug', 404: 'No such verse' },
  },
  controller.setIssues
);

export default router;
