import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/prayer.js';
import { LANGUAGE_CODES, SORT_COLUMNS } from '../../controllers/admin/prayer.js';
import { CATEGORY_IDS, ORIGINAL_LANGUAGES, prayer as cfg } from '../../config/prayer.js';

const router = createRouter({
  tag: 'Admin · Prayers',
  prefix: '/prayers',
  description:
    'Prayers: stotras, aartis and prayers a reader reads in their own script, each verse with a meaning that can be folded away. ' +
    'A prayer is written once, in English wording and in its original language’s script, and is a `DRAFT` until it is `PUBLISHED`. ' +
    'Another script is made by a rule at read time where one writes it well, and otherwise by a run (a `PrayerRun` row worked by ' +
    'the worker; websocket events `prayer.run` and `prayer.activity`) or by hand. A hand-written piece is never replaced by a run. ' +
    'This is not a mantra’s opening prayer, which is set on the mantra.',
});

const category = z.enum(CATEGORY_IDS);
const status = z.enum(['DRAFT', 'PUBLISHED']);
const originalLanguage = z.enum(ORIGINAL_LANGUAGES);
const language = z.enum(LANGUAGE_CODES);
const runStatus = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
// An enum, not a string: the controller looks the provider up without a null check.
const provider = z.enum(['anthropic', 'openai', 'gemini']);
// The panel sends a blank model to mean "the provider's default".
const model = z.string().trim().max(100).optional().transform((v) => v || undefined);

const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null));

// A link readers can open, so only http and https (`new URL` alone accepts javascript: and data:).
const isWebLink = (value) => {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
};
const sourceUrl = optionalText(500).refine((v) => v == null || isWebLink(v), 'Must be an http or https link');

const sortOrder = z.number().int().min(0).max(100000);
// A verse's text is the original in its own script, one line of the verse per line break; its meaning may be empty.
const verseText = z.string().trim().min(1).max(8000);
const verseMeaning = z.string().trim().max(8000).nullable().optional();
const verseList = (item) => z.array(item).max(cfg.maxVerses, `A prayer has at most ${cfg.maxVerses} verses`);

const params = z.object({ id: z.string().min(1) });
const translationParams = z.object({ id: z.string().min(1), language });

router.get(
  '/overview',
  {
    summary: 'What prayers there are, and how a run would be set up',
    description:
      'Counts by status and category, how much of each language is written (by a rule, by a run or by hand), and what a translation run ' +
      'would use (provider, model, key, worker) with the runs that are active.',
    permission: 'prayer.manage',
    limit: 'read',
    responds: { 200: 'Counts, coverage and the active runs' },
  },
  controller.overview
);

router.get(
  '/items',
  {
    summary: 'List prayers',
    description: 'Prayers with their status and which languages are written. Search looks in the title, summary and slug.',
    permission: 'prayer.manage',
    limit: 'read',
    query: schemas.sorted(SORT_COLUMNS).extend({
      category: category.optional(),
      status: status.optional(),
    }),
    responds: { 200: 'A page of prayers' },
  },
  controller.list
);

router.post(
  '/items',
  {
    summary: 'Add a prayer',
    description:
      'A new draft. The slug is made from the title. `originalLanguage` is the language, so the script, the verses are written in. ' +
      '`verses` may be pasted in now or saved later with the verses route. `author` is who composed it, in English.',
    permission: 'prayer.manage',
    limit: 'write',
    body: z.object({
      category,
      originalLanguage,
      title: text(200),
      summary: optionalText(400),
      about: optionalText(8000),
      author: optionalText(200),
      reference: optionalText(200),
      sourceName: optionalText(200),
      sourceUrl,
      sortOrder: sortOrder.optional(),
      verses: verseList(z.object({ text: verseText, meaning: verseMeaning })).optional(),
    }),
    responds: { 201: 'The new prayer, as a draft', 400: 'Unknown category or language, or a verse with no text' },
  },
  controller.create
);

router.get(
  '/items/:id',
  { summary: 'Get one prayer with its verses and what is written in each language', permission: 'prayer.manage', limit: 'read', params, responds: { 200: 'The prayer', 404: 'No such prayer' } },
  controller.get
);

router.patch(
  '/items/:id',
  {
    summary: 'Edit a prayer',
    description:
      'The English wording, category, order, original language and source. Changing the original language marks every verse’s text as ' +
      'changed, so what was made from the old script shows as out of date. The verses have their own route, and the status route publishes.',
    permission: 'prayer.manage',
    limit: 'write',
    params,
    // Only the columns below can reach the update: the schema drops every other key, so no `status` or `verses` gets in here.
    body: z
      .object({
        category: category.optional(),
        originalLanguage: originalLanguage.optional(),
        title: text(200).optional(),
        summary: optionalText(400),
        about: optionalText(8000),
        author: optionalText(200),
        reference: optionalText(200),
        sourceName: optionalText(200),
        sourceUrl,
        sortOrder: sortOrder.optional(),
      })
      .refine((v) => Object.keys(v).length > 0, 'Nothing to change'),
    responds: { 200: 'The prayer', 400: 'Unknown category or language, or nothing to change', 404: 'No such prayer' },
  },
  controller.update
);

router.put(
  '/items/:id/verses',
  {
    summary: 'Save a prayer’s verses',
    description:
      'The whole list, in display order. A row with an `id` keeps it (its translations hang off it), a row without one is new, and a verse left ' +
      'out is deleted with what was written for it. A verse whose text changed is stamped so its renderings show as out of date. A published ' +
      'prayer cannot be left with no verse.',
    permission: 'prayer.manage',
    limit: 'write',
    params,
    body: z.object({
      verses: verseList(z.object({ id: z.string().min(1).optional(), text: verseText, meaning: verseMeaning })),
    }),
    responds: {
      200: 'The verses, in order',
      400: 'A verse is in the list twice, or a published prayer was left with none',
      404: 'No such prayer',
      409: 'A verse in the list is no longer part of the prayer (it was changed elsewhere): reload and save again',
    },
  },
  controller.saveVerses
);

router.post(
  '/items/:id/status',
  {
    summary: 'Publish a prayer or hold it back',
    description: '`PUBLISHED` shows it to readers and needs at least one verse; `DRAFT` hides it.',
    permission: 'prayer.manage',
    limit: 'write',
    params,
    body: z.object({ status }),
    responds: { 200: 'The prayer', 400: 'A prayer with no verse cannot be published', 404: 'No such prayer' },
  },
  controller.setStatus
);

router.delete(
  '/items/:id',
  {
    summary: 'Delete a prayer',
    description: 'With its verses and every translation of them. A published prayer disappears from the app at once.',
    permission: 'prayer.manage',
    limit: 'write',
    params,
    responds: { 200: 'Deleted', 404: 'No such prayer' },
  },
  controller.remove
);

router.get(
  '/items/:id/translations/:language',
  {
    summary: 'Get what is written in one language, to edit it',
    description: 'The heading, and for each verse its text in the language’s script and its meaning, with how each was made (rule, run or hand).',
    permission: 'prayer.manage',
    limit: 'read',
    params: translationParams,
    responds: { 200: 'What is written in the language', 404: 'No such prayer' },
  },
  controller.getTranslation
);

router.put(
  '/items/:id/translations/:language',
  {
    summary: 'Write or correct a language by hand',
    description:
      'A heading and/or verse pieces. Whatever is written is marked as an admin’s, and a run never replaces it. A blank piece clears it; a blank ' +
      'title with a blank summary and about removes the heading. A verse’s `text` is only for a language that is not written in the prayer’s own script, ' +
      'and `meaning` is never for English (that is the verse itself).',
    permission: 'prayer.manage',
    limit: 'write',
    params: translationParams,
    body: z.object({
      header: z
        .object({
          title: z.string().trim().max(400),
          summary: z.string().trim().max(800).nullable().optional(),
          about: z.string().trim().max(8000).nullable().optional(),
        })
        .optional(),
      verses: z
        .array(
          z.object({
            verseId: z.string().min(1),
            text: z.string().trim().max(8000).nullable().optional(),
            meaning: z.string().trim().max(8000).nullable().optional(),
          })
        )
        .max(cfg.maxVerses)
        .default([]),
    }),
    responds: {
      200: 'What is written in the language now',
      400: 'A heading for English, a summary with no title, a verse that is not in the prayer, a text for a language in the same script, or an English meaning',
      404: 'No such prayer',
    },
  },
  controller.saveTranslation
);

router.delete(
  '/items/:id/translations/:language',
  {
    summary: 'Delete everything written in one language',
    description: 'The reader then sees the rule’s rendering, or the original, until a run (or an editor) writes it again.',
    permission: 'prayer.manage',
    limit: 'write',
    params: translationParams,
    responds: { 200: 'Deleted', 404: 'No such prayer, or nothing written in that language' },
  },
  controller.deleteTranslation
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a translation run',
    description:
      'How many published prayers a run into the language would work on, in how many requests, and about how many tokens. Only what is missing or ' +
      'out of date is counted (everything with `force`; hand-written pieces never). Nothing is spent. A blank `model` is the provider’s default.',
    permission: 'prayer.translate',
    limit: 'read',
    query: z.object({ language, force: z.enum(['true', 'false']).optional(), provider: provider.optional(), model }),
    responds: { 200: 'The estimate', 400: 'Not a language prayers are written in' },
  },
  controller.estimate
);

router.get(
  '/runs',
  {
    summary: 'List prayer translation runs',
    description: 'Newest first.',
    permission: 'prayer.translate',
    limit: 'read',
    query: schemas.page.extend({ status: runStatus.optional(), language: language.optional() }),
    responds: { 200: 'Runs' },
  },
  controller.listRuns
);

router.post(
  '/runs',
  {
    summary: 'Start a prayer translation run',
    description:
      'Queues a run that writes the missing or out-of-date pieces of the published prayers into the language (all of them with `force`; a hand-written ' +
      'piece is always kept). One live run per language. `provider` and `model` default to the server’s.',
    permission: 'prayer.translate',
    limit: 'write',
    body: z.object({ language, force: z.boolean().optional(), provider: provider.optional(), model }),
    responds: {
      201: 'The queued run',
      409: 'Everything is already written, a run for the language is live, or another start is in progress',
      422: 'No API key for the provider, the model cannot run, or the queue is unreachable',
    },
  },
  controller.startRun
);

router.get(
  '/runs/:id',
  { summary: 'Get one prayer run with its activity feed', permission: 'prayer.translate', limit: 'read', params, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.getRun
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed prayer run',
    description: 'Carries on with what is still missing.',
    permission: 'prayer.translate',
    limit: 'write',
    params,
    body: z.object({}).optional(),
    responds: { 200: 'The run, queued again', 404: 'No such run', 409: 'Not paused or failed' },
  },
  controller.resumeRun
);

router.post(
  '/runs/:id/cancel',
  {
    summary: 'Cancel a prayer run',
    description: 'A run that is working stops after the batch in progress; a waiting or paused one is cancelled at once. Everything written stays.',
    permission: 'prayer.translate',
    limit: 'write',
    params,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancelRun
);

export default router;
