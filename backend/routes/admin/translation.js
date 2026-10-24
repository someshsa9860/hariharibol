import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/translation.js';
import { BOOK_IDS } from '../../scripts/lib/claude-translate-source.js';
import { LANGUAGE_CODES } from '../../scripts/lib/claude-translate-languages.js';

const router = createRouter({
  tag: 'Admin · Translations',
  prefix: '/translations',
  description:
    "Translating Prabhupāda's Bhagavad-gītā and Śrīmad-Bhāgavatam into other languages with Claude or OpenAI: start a run for one " +
    'language, watch it live (websocket events `translation.run` and `translation.activity`), read ' +
    'what it saved, and import the result from storage into the database. A run is a database row ' +
    'worked by the worker; it survives a page refresh, a restart and a failure, and pauses rather ' +
    'than fails when credit runs out. An import is the same kind of row (`/imports/runs`, websocket events ' +
    '`translation-import.run` and `translation-import.activity`), also worked by the worker. Text is stamped ' +
    'with a version (`TRANSLATION_VERSION`): a language already translated under the current version is not ' +
    'translated again.',
});

const language = z.enum(LANGUAGE_CODES);
const book = z.enum(BOOK_IDS);
// A Gita chapter is 1–18; a Bhagavatam one is canto × 100 + chapter, up to 1290.
const chapterNumber = z.coerce.number().int().min(1).max(1290);

// The query string carries a list as "1,2,3".
const chapterList = z
  .string()
  .regex(/^\d{1,4}(,\d{1,4})*$/, 'Chapters are numbers separated by commas')
  .transform((text) => [...new Set(text.split(',').map(Number))].sort((a, b) => a - b))
  .refine((numbers) => numbers.every((n) => n >= 1 && n <= 1290), 'Chapter ids are 1 to 1290');

// Who writes each part. A part left out is not touched by the run; one with no model uses its provider's default.
const planEntry = z.object({
  provider: z.enum(['anthropic', 'openai', 'gemini']),
  model: z.string().trim().min(1).max(100).optional(),
  effort: z.enum(['off', 'low', 'medium', 'high', 'xhigh', 'max']).optional(),
});
const plan = z.object({ translation: planEntry.optional(), purport: planEntry.optional(), transliteration: planEntry.optional(), wordMeanings: planEntry.optional() }).strict();
// On a GET the plan travels as JSON text.
const planText = z.string().max(2000).transform((text, ctx) => {
  try {
    return plan.parse(JSON.parse(text));
  } catch {
    ctx.addIssue({ code: 'custom', message: 'plan must be JSON: { translation?, purport?, transliteration?, wordMeanings? } each { provider, model?, effort? }' });
    return z.NEVER;
  }
});

const statuses = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
// An import never waits on a person, so it is never PAUSED.
const importStatuses = z.enum(['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED']);

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
      'Verses saved per language and per chapter, how many of them are up to date for the current ' +
      'version (`upToDate`; the rest were made under an older one and are translated again by a new ' +
      'run), how many Claude made, and their scores. Read from the `TranslationProgress` table, never ' +
      'from storage; `recounting` is true while a background fill from storage runs (it starts by itself when ' +
      'the table is empty or was counted under another version, and `refresh=true` starts one).',
    permission: 'translation.read',
    limit: 'read',
    query: z.object({ book: book.optional(), refresh: z.enum(['true', 'false']).optional() }),
    responds: { 200: 'Coverage per language', 422: 'Storage cannot be read' },
  },
  controller.coverage
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a run',
    description:
      'What is left to translate for a language under the current version, and a guess at the calls, ' +
      'tokens and cost: `saved` is already up to date, `outdated` was made under an older version and ' +
      'is translated again. Nothing is spent.',
    permission: 'translation.read',
    limit: 'read',
    query: z.object({
      language,
      book: book.optional(),
      provider: z.string().max(40).optional(),
      model: z.string().max(100).optional(),
      plan: planText.optional(),
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
    query: schemas.page.extend({ status: statuses.optional(), language: language.optional(), book: book.optional() }),
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
      'turn, because the queue works one run per book at a time. Verses already translated under the current ' +
      'version are skipped, so starting again continues where the last run stopped; verses made ' +
      'under an older version are translated again. When everything asked for is already up to date ' +
      'there is nothing to do and the answer is 409 with `details.upToDate`. `plan` gives each part its own ' +
      'provider, model and effort (translation, purport, transliteration, word meanings); parts that share all three ' +
      'are asked for in one request per verse, and the groups run side by side. Parts left out of the plan are not touched.',
    permission: 'translation.run',
    limit: 'write',
    body: z.object({
      language,
      book: book.optional(),
      chapters: z.array(chapterNumber).min(1).max(335).optional(),
      provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
      model: z.string().trim().min(1).max(100).optional(),
      plan: plan.optional(),
      verseLimit: z.number().int().min(1).max(800).optional(),
      budgetUsd: z.number().positive().max(1000).optional(),
    }),
    responds: {
      201: 'The queued run',
      409: 'A run for this language is already active, or the language is already up to date for this version',
      422: 'No API key for the chosen provider, storage not set up, or the queue is unreachable',
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
  '/imports',
  {
    summary: 'What is in the database from Claude’s translations',
    description:
      'Per language: how many Prabhupāda translation rows Claude made are in the database, how many ' +
      'were made under the current version, how many readers can see, and when one last changed. ' +
      'Languages with none are left out.',
    permission: 'translation.read',
    limit: 'read',
    query: z.object({ book: book.optional() }),
    responds: { 200: 'The current version and a line per language' },
  },
  controller.imports
);

router.post(
  '/imports',
  {
    summary: 'Import translated chapters into the database',
    description:
      'Copies a language’s translated chapters from storage into `VerseTranslation`: the translation, ' +
      'purport, transliteration and word-by-word meanings, with the version that made them. A verse is ' +
      'matched on its book, chapter and verse number; a row that exists is updated in place (its id ' +
      'does not change) and one that does not is created. A verse the database lacks, or whose ' +
      'numbers disagree with the file, is reported and left alone. New rows are hidden from readers ' +
      'unless `publish` is true, which also needs `verse.publish`; an existing row’s visibility is ' +
      'never lowered. Importing again changes only what differs. An import is queued, not done in the ' +
      'request: the answer is the new run (201), which the worker works a chapter at a time while the ' +
      'page follows it over the websocket or `GET /imports/runs/:id`. Only one import per language and ' +
      'book may be live. `dryRun` is the exception: it only reads, so it is answered at once (200) with ' +
      'the same report and writes nothing — for a book as long as the Bhagavatam it can take a while.',
    permission: 'translation.import',
    limit: 'write',
    body: z.object({
      language,
      book: book.optional(),
      chapters: z.array(chapterNumber).min(1).max(335).optional(),
      publish: z.boolean().default(false),
      dryRun: z.boolean().default(false),
    }),
    responds: {
      200: '`dryRun` only: counts per chapter and in total — created, updated, unchanged, missing, conflicts',
      201: 'The queued import run',
      400: 'A chapter that is not in the book',
      403: '`publish` without the `verse.publish` permission',
      409: 'An import of this language and book is already queued or running (`details.runId`), or one is being started',
      422: 'The book or translator is not in the database or storage cannot be read (`dryRun`), or the queue is unreachable',
    },
  },
  controller.importTranslations
);

router.get(
  '/imports/runs',
  {
    summary: 'List imports',
    description: 'Newest first, filtered by status, language and book.',
    permission: 'translation.read',
    limit: 'read',
    query: schemas.page.extend({ status: importStatuses.optional(), language: language.optional(), book: book.optional() }),
    responds: { 200: 'Import runs' },
  },
  controller.importRuns
);

router.get(
  '/imports/runs/:id',
  {
    summary: 'Get one import with its activity feed',
    description:
      'Progress (`progress.done` of `progress.total` chapters; `currentChapter` is the last one finished), and ' +
      'once it is over the report that `dryRun` gives, in `run.result`. A cancelled import keeps the report of ' +
      'the chapters it did.',
    permission: 'translation.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The import and the latest activity, newest first', 404: 'No such import' },
  },
  controller.importRun
);

router.post(
  '/imports/runs/:id/cancel',
  {
    summary: 'Cancel an import',
    description:
      'An import that is working stops after the chapter in progress (within a few seconds); a waiting one is ' +
      'cancelled at once. Chapters already imported stay imported — each one is written in one transaction.',
    permission: 'translation.import',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The import', 404: 'No such import', 409: 'The import has already finished' },
  },
  controller.cancelImportRun
);

router.get(
  '/output/:language/chapters/:chapter',
  {
    summary: 'A chapter of one language, verse by verse',
    description: 'Which verses are saved, whether Claude made them, their scores and warnings, and the start of each translation.',
    permission: 'translation.read',
    limit: 'read',
    params: z.object({ language, chapter: chapterNumber }),
    query: z.object({ book: book.optional() }),
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
    params: z.object({ language, verseId: z.string().regex(/^\d{1,2}(\.\d{1,3}){2,3}(-\d{1,3})?$/, 'A verse id looks like 1.2.47 (Gita) or 2.1.1.1 (Bhagavatam)') }),
    responds: { 200: 'The verse', 404: 'No such verse', 422: 'Storage cannot be read' },
  },
  controller.verse
);

export default router;
