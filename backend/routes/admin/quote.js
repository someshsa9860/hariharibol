import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/quote.js';
import { LANGUAGE_CODES } from '../../controllers/admin/quote.js';
import { STATUSES } from '../../utils/quote.js';

const router = createRouter({
  tag: 'Admin · Quotes',
  prefix: '/quotes',
  description:
    'Quotes shown on the chanting page in place of the deity picture and the mala, one after every 12 chants: short, well-known ' +
    'sayings written in English with the speaker, the reference and a link to where each can be checked. A quote is `PUBLISHED` ' +
    '(readers see it), `DRAFT`, or `EXCLUDED` — kept with the reason but never shown. Translations are made by runs (a `QuoteRun` ' +
    'row worked by the worker; websocket events `quote.run` and `quote.activity`) or written by hand.',
});

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
    summary: 'What the quotes have, and how translation is set up',
    description:
      'Counts by status, how many quotes are translated into each language, and what a translation run would use ' +
      '(provider, model, key, worker) with the runs that are active.',
    permission: 'quote.manage',
    limit: 'read',
    responds: { 200: 'Counts, coverage and the active runs' },
  },
  controller.overview
);

router.get(
  '/items',
  {
    summary: 'List quotes',
    description: 'English quotes with their status and which languages they are translated into. Search looks in the text, reference and slug.',
    permission: 'quote.manage',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      status: status.optional(),
      language: language.optional(),
      untranslated: z.enum(['true', 'false']).optional(),
    }),
    responds: { 200: 'A page of quotes' },
  },
  controller.list
);

router.post(
  '/items',
  {
    summary: 'Add a quote',
    description:
      'A new English quote. The slug is made from its first words. `author` is who said it, `reference` where, `sourceUrl` the page it can be ' +
      'checked on. A draft unless `status` says otherwise; an excluded quote needs a reason.',
    permission: 'quote.manage',
    limit: 'write',
    body: z.object({
      text: text(1000),
      reference: optionalText(200),
      author: optionalText(200),
      sourceName: optionalText(120),
      sourceUrl: url.nullable().optional(),
      status: status.optional(),
      excludedReason: optionalText(500),
      sortOrder: z.number().int().min(0).max(100000).optional(),
    }),
    responds: { 201: 'The new quote', 400: 'An excluded quote without a reason' },
  },
  controller.create
);

router.get(
  '/items/:id',
  { summary: 'Get one quote with its translations', permission: 'quote.manage', limit: 'read', params, responds: { 200: 'The quote', 404: 'No such quote' } },
  controller.get
);

router.patch(
  '/items/:id',
  {
    summary: 'Edit a quote',
    description: 'The English wording, order, author and source. Marks the quote edited, so the seed will not write over it. Use the status route to publish or exclude.',
    permission: 'quote.manage',
    limit: 'write',
    params,
    body: z
      .object({
        text: text(1000).optional(),
        reference: optionalText(200),
        author: optionalText(200),
        sourceName: optionalText(120),
        sourceUrl: url.nullable().optional(),
        sortOrder: z.number().int().min(0).max(100000).optional(),
      })
      .refine((v) => Object.keys(v).length > 0, 'Nothing to change'),
    responds: { 200: 'The quote', 404: 'No such quote' },
  },
  controller.update
);

router.post(
  '/items/:id/status',
  {
    summary: 'Publish, hold back or exclude a quote',
    description: '`PUBLISHED` lets readers see it; `DRAFT` holds it back; `EXCLUDED` keeps it in the database with the `reason` and never shows it.',
    permission: 'quote.manage',
    limit: 'write',
    params,
    body: z.object({ status, reason: z.string().trim().max(500).optional() }),
    responds: { 200: 'The quote', 400: 'An exclusion needs a reason', 404: 'No such quote' },
  },
  controller.setStatus
);

router.put(
  '/items/:id/translations/:language',
  {
    summary: 'Write or correct a translation by hand',
    description: 'Saved as written by an admin and marked edited, so a translation run never replaces it.',
    permission: 'quote.manage',
    limit: 'write',
    params: translationParams,
    body: z.object({ text: text(2000), isPublished: z.boolean().optional() }),
    responds: { 200: 'The translation', 400: 'Not a language quotes are translated into', 404: 'No such quote' },
  },
  controller.saveTranslation
);

router.delete(
  '/items/:id/translations/:language',
  {
    summary: 'Delete a translation',
    description: 'The reader then sees the next language in their chain until a run (or an editor) writes it again.',
    permission: 'quote.manage',
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
    description: 'How many published quotes a run into the language would translate, in how many requests, and about how many tokens. Nothing is spent.',
    permission: 'quote.translate',
    limit: 'read',
    query: z.object({ language, force: z.enum(['true', 'false']).optional() }),
    responds: { 200: 'The estimate', 400: 'Not a language quotes are translated into' },
  },
  controller.estimate
);

router.get(
  '/runs',
  { summary: 'List quote translation runs', description: 'Newest first.', permission: 'quote.translate', limit: 'read', query: schemas.page.extend({ status: runStatus.optional(), language: language.optional() }), responds: { 200: 'Runs' } },
  controller.listRuns
);

router.post(
  '/runs',
  {
    summary: 'Start an quote translation run',
    description:
      'Queues a run that translates the published quotes that have no translation yet into the language (all of them with `force`; words an editor wrote are always kept). ' +
      'One live run per language; a run started while another is going waits its turn. `provider` and `model` default to the server’s.',
    permission: 'quote.translate',
    limit: 'write',
    body: z.object({ language, force: z.boolean().optional(), provider: provider.optional(), model: z.string().trim().min(1).max(100).optional() }),
    responds: { 201: 'The queued run', 409: 'Everything is already translated, or a run for the language is live', 422: 'No API key for the provider, or the queue is unreachable' },
  },
  controller.startRun
);

router.get(
  '/runs/:id',
  { summary: 'Get one quote run with its activity feed', permission: 'quote.translate', limit: 'read', params, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.getRun
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed quote run',
    description: 'Carries on from the first quote that has no translation.',
    permission: 'quote.translate',
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
    summary: 'Cancel an quote run',
    description: 'A run that is working stops after the batch in progress; a waiting or paused one is cancelled at once. Everything translated stays.',
    permission: 'quote.translate',
    limit: 'write',
    params,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancelRun
);

export default router;
