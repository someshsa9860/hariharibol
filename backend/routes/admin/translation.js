import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/translation.js';
import { LANGUAGE_CODES } from '../../scripts/lib/claude-translate-languages.js';

const router = createRouter({
  tag: 'Admin · Translations',
  prefix: '/translations',
  description:
    "Translating Prabhupāda's Bhagavad-gītā into other languages with Claude: start a run for one " +
    'language, watch it live (websocket events `translation.run` and `translation.activity`), and read ' +
    'what it saved. A run is a database row worked by the worker; it survives a page refresh, a ' +
    'restart and a failure, and pauses rather than fails when credit runs out.',
});

const language = z.enum(LANGUAGE_CODES);
const chapterNumber = z.coerce.number().int().min(1).max(18);

// The query string carries a list as "1,2,3".
const chapterList = z
  .string()
  .regex(/^\d{1,2}(,\d{1,2})*$/, 'Chapters are numbers separated by commas')
  .transform((text) => [...new Set(text.split(',').map(Number))].sort((a, b) => a - b))
  .refine((numbers) => numbers.every((n) => n >= 1 && n <= 18), 'The Gita has chapters 1 to 18');

const statuses = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);

// Static paths first, so none of them is read as a run id.

router.get(
  '/overview',
  {
    summary: 'What translating is set up with',
    description:
      'The checklist the page opens with: is the Anthropic key set, can the bucket be reached, is a ' +
      'worker online, which model and version a new run uses — plus the languages on offer and the ' +
      'runs that are still active.',
    permission: 'translation.read',
    limit: 'read',
    responds: { 200: 'Settings, languages, chapters and the active runs' },
  },
  controller.overview
);

router.get(
  '/coverage',
  {
    summary: 'How much of the Gita each language has',
    description:
      'Verses saved per language and per chapter, how many of them Claude made, and their scores. ' +
      'Reads every chapter file, so the answer is cached for five minutes; `refresh=true` rereads.',
    permission: 'translation.read',
    limit: 'read',
    query: z.object({ refresh: z.enum(['true', 'false']).optional() }),
    responds: { 200: 'Coverage per language', 422: 'Storage cannot be read' },
  },
  controller.coverage
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a run',
    description: 'What is left to translate for a language, and a guess at the calls, tokens and cost. Nothing is spent.',
    permission: 'translation.read',
    limit: 'read',
    query: z.object({
      language,
      chapters: chapterList.optional(),
      limit: z.coerce.number().int().min(1).max(800).optional(),
    }),
    responds: { 200: 'The estimate', 422: 'Storage cannot be read' },
  },
  controller.estimate
);

router.get(
  '/runs',
  {
    summary: 'List translation runs',
    description: 'Newest first, filtered by status and language.',
    permission: 'translation.read',
    limit: 'read',
    query: schemas.page.extend({ status: statuses.optional(), language: language.optional() }),
    responds: { 200: 'Runs' },
  },
  controller.list
);

router.post(
  '/runs',
  {
    summary: 'Start a translation run',
    description:
      'Queues a run for one language. Only one run per language may be active; others wait their ' +
      'turn, because the queue works one run at a time. Verses already saved are skipped, so ' +
      'starting again continues where the last run stopped.',
    permission: 'translation.run',
    limit: 'write',
    body: z.object({
      language,
      chapters: z.array(chapterNumber).min(1).max(18).optional(),
      verseLimit: z.number().int().min(1).max(800).optional(),
      budgetUsd: z.number().positive().max(1000).optional(),
    }),
    responds: {
      201: 'The queued run',
      409: 'A run for this language is already active',
      422: 'No Anthropic key, storage not set up, or the queue is unreachable',
    },
  },
  controller.start
);

router.get(
  '/runs/:id',
  {
    summary: 'Get one run with its activity feed',
    permission: 'translation.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' },
  },
  controller.get
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed run',
    description:
      'For a run waiting on a person: credit topped up, a key fixed, a budget raised, or a verse that ' +
      'failed. Carries on from the first unsaved verse. `budgetUsd` replaces the run budget (`null` ' +
      'removes it); left out, the old one stays.',
    permission: 'translation.run',
    limit: 'write',
    params: schemas.id,
    body: z.object({ budgetUsd: z.number().positive().max(1000).nullable().optional() }).optional(),
    responds: { 200: 'The run, queued again', 404: 'No such run', 409: 'Not paused or failed, or another run is active' },
  },
  controller.resume
);

router.post(
  '/runs/:id/cancel',
  {
    summary: 'Cancel a run',
    description:
      'A run that is working stops after the verse in progress (within a few seconds); a waiting or ' +
      'paused one is cancelled at once. Everything already saved stays.',
    permission: 'translation.run',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancel
);

router.get(
  '/output/:language/chapters/:chapter',
  {
    summary: 'A chapter of one language, verse by verse',
    description: 'Which verses are saved, whether Claude made them, their scores and warnings, and the start of each translation.',
    permission: 'translation.read',
    limit: 'read',
    params: z.object({ language, chapter: chapterNumber }),
    responds: { 200: 'The chapter', 422: 'Storage cannot be read' },
  },
  controller.chapter
);

router.get(
  '/output/:language/verses/:verseId',
  {
    summary: 'One translated verse beside its English',
    description:
      'Translation, transliteration, word meanings and purport, as saved; the same in English; the ' +
      'model, version and scores; and what a fresh check of the saved text still finds wrong.',
    permission: 'translation.read',
    limit: 'read',
    params: z.object({ language, verseId: z.string().regex(/^\d{1,2}\.\d{1,2}\.\d{1,3}(-\d{1,3})?$/, 'A Gita verse id looks like 1.2.47') }),
    responds: { 200: 'The verse', 404: 'No such verse', 422: 'Storage cannot be read' },
  },
  controller.verse
);

export default router;
