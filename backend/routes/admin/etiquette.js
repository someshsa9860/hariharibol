import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/etiquette.js';
import { LANGUAGE_CODES } from '../../controllers/admin/etiquette.js';
import { CATEGORY_IDS } from '../../config/etiquette.js';
import { STATUSES } from '../../utils/etiquette.js';

const router = createRouter({
  tag: 'Admin · Devotee etiquette',
  prefix: '/etiquette',
  description:
    'Devotee etiquette: short, respectful guidance for every devotee, written in English with its source, one of which is ' +
    'sent as a push every morning at 07:15 on the reader’s own clock. An item is `PUBLISHED` (readers see it and it can be ' +
    'the day’s push), `DRAFT`, or `EXCLUDED` — kept with the reason but never shown or pushed, for etiquette that would ' +
    'speak ill of a faith or a deity. Translations are made by runs (an `EtiquetteRun` row worked by the worker; websocket ' +
    'events `etiquette.run` and `etiquette.activity`) or written by hand.',
});

const category = z.enum(CATEGORY_IDS);
const status = z.enum(STATUSES);
const language = z.enum(LANGUAGE_CODES);
const runStatus = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
const provider = z.enum(['anthropic', 'openai', 'gemini']);

const text = (max) => z.string().trim().min(1).max(max);
const optionalText = (max) => z.string().trim().max(max).nullable().optional().transform((v) => (v ? v : v === undefined ? undefined : null));
const url = z.string().trim().url().max(500);

const params = z.object({ id: z.string().min(1) });
const translationParams = z.object({ id: z.string().min(1), language });

router.get(
  '/overview',
  {
    summary: 'What devotee etiquette has, and how it is set up',
    description:
      'Counts by status and category, how many items are translated into each language, the delivery time, today’s item if it has been chosen, ' +
      'and what a translation run would use (provider, model, key, worker) with the runs that are active.',
    permission: 'etiquette.manage',
    limit: 'read',
    responds: { 200: 'Counts, coverage, delivery and the active runs' },
  },
  controller.overview
);

router.get(
  '/items',
  {
    summary: 'List etiquette',
    description: 'English items with their status and which languages they are translated into. Search looks in the title, summary, body and slug.',
    permission: 'etiquette.manage',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      category: category.optional(),
      status: status.optional(),
      language: language.optional(),
      untranslated: z.enum(['true', 'false']).optional(),
    }),
    responds: { 200: 'A page of items' },
  },
  controller.list
);

router.post(
  '/items',
  {
    summary: 'Add an etiquette',
    description:
      'A new English item. The slug is made from the title. `author` is who it is by: the speaker of the verse, or the teacher or temple ' +
      'that published the page it rests on. A draft unless `status` says otherwise; an excluded item needs a reason.',
    permission: 'etiquette.manage',
    limit: 'write',
    body: z.object({
      category,
      title: text(160),
      summary: text(300),
      body: text(4000),
      reference: optionalText(200),
      author: optionalText(200),
      sourceName: optionalText(120),
      sourceUrl: url.nullable().optional(),
      status: status.optional(),
      excludedReason: optionalText(500),
      sortOrder: z.number().int().min(0).max(100000).optional(),
    }),
    responds: { 201: 'The new item', 400: 'Unknown category, or an excluded item without a reason' },
  },
  controller.create
);

router.get(
  '/items/:id',
  { summary: 'Get one etiquette with its translations', permission: 'etiquette.manage', limit: 'read', params, responds: { 200: 'The item', 404: 'No such item' } },
  controller.get
);

router.patch(
  '/items/:id',
  {
    summary: 'Edit an etiquette',
    description: 'The English wording, category, order, author and source. Marks the item edited, so the seed will not write over it. Use the status route to publish or exclude.',
    permission: 'etiquette.manage',
    limit: 'write',
    params,
    body: z
      .object({
        category: category.optional(),
        title: text(160).optional(),
        summary: text(300).optional(),
        body: text(4000).optional(),
        reference: optionalText(200),
        author: optionalText(200),
        sourceName: optionalText(120),
        sourceUrl: url.nullable().optional(),
        sortOrder: z.number().int().min(0).max(100000).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, 'Nothing to change'),
    responds: { 200: 'The item', 400: 'Unknown category', 404: 'No such item' },
  },
  controller.update
);

router.post(
  '/items/:id/status',
  {
    summary: 'Publish, hold back or exclude an etiquette',
    description:
      '`PUBLISHED` lets readers see it and lets it be the day’s push; `DRAFT` holds it back; `EXCLUDED` keeps it in the database with the ' +
      '`reason` and never shows or pushes it. An item that is excluded after it was chosen for a day is replaced for that day the next time the day is read.',
    permission: 'etiquette.manage',
    limit: 'write',
    params,
    body: z.object({ status, reason: z.string().trim().max(500).optional() }),
    responds: { 200: 'The item', 400: 'An exclusion needs a reason', 404: 'No such item' },
  },
  controller.setStatus
);

router.put(
  '/items/:id/translations/:language',
  {
    summary: 'Write or correct a translation by hand',
    description: 'Saved as written by an admin and marked edited, so a translation run never replaces it.',
    permission: 'etiquette.manage',
    limit: 'write',
    params: translationParams,
    body: z.object({ title: text(400), summary: text(800), body: text(8000), isPublished: z.boolean().optional() }),
    responds: { 200: 'The translation', 400: 'Not a language etiquette is translated into', 404: 'No such item' },
  },
  controller.saveTranslation
);

router.delete(
  '/items/:id/translations/:language',
  {
    summary: 'Delete a translation',
    description: 'The reader then sees the next language in their chain until a run (or an editor) writes it again.',
    permission: 'etiquette.manage',
    limit: 'write',
    params: translationParams,
    responds: { 200: 'Deleted', 404: 'No such translation' },
  },
  controller.deleteTranslation
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a translation run',
    description: 'How many published items a run into the language would translate, in how many requests, and about how many tokens. Nothing is spent.',
    permission: 'etiquette.translate',
    limit: 'read',
    query: z.object({ language, force: z.enum(['true', 'false']).optional() }),
    responds: { 200: 'The estimate', 400: 'Not a language etiquette is translated into' },
  },
  controller.estimate
);

router.get(
  '/runs',
  { summary: 'List etiquette translation runs', description: 'Newest first.', permission: 'etiquette.translate', limit: 'read', query: schemas.page.extend({ status: runStatus.optional(), language: language.optional() }), responds: { 200: 'Runs' } },
  controller.listRuns
);

router.post(
  '/runs',
  {
    summary: 'Start an etiquette translation run',
    description:
      'Queues a run that translates the published items that have no translation yet into the language (all of them with `force`; words an editor wrote are always kept). ' +
      'One live run per language; a run started while another is going waits its turn. `provider` and `model` default to the server’s.',
    permission: 'etiquette.translate',
    limit: 'write',
    body: z.object({ language, force: z.boolean().optional(), provider: provider.optional(), model: z.string().trim().min(1).max(100).optional() }),
    responds: { 201: 'The queued run', 409: 'Everything is already translated, or a run for the language is live', 422: 'No API key for the provider, or the queue is unreachable' },
  },
  controller.startRun
);

router.get(
  '/runs/:id',
  { summary: 'Get one etiquette run with its activity feed', permission: 'etiquette.translate', limit: 'read', params, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.getRun
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed etiquette run',
    description: 'Carries on from the first item that has no translation.',
    permission: 'etiquette.translate',
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
    summary: 'Cancel an etiquette run',
    description: 'A run that is working stops after the batch in progress; a waiting or paused one is cancelled at once. Everything translated stays.',
    permission: 'etiquette.translate',
    limit: 'write',
    params,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancelRun
);

export default router;
