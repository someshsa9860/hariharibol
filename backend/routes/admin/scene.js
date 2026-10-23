import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/scene.js';
import { BOOK_IDS } from '../../services/scenes.js';

const router = createRouter({
  tag: 'Admin · Scenes',
  prefix: '/scenes',
  description:
    'AI scene prompts for reels: for each chapter of Śrīmad-Bhāgavatam the model is given the Hindi meaning of every verse ' +
    'and writes a storyboard (narration, dialogue, a visual prompt per scene) that is saved to storage as ' +
    '`json/<book>/scenes/sk-<canto>-ch-<n>.json`. Gemini by default, kept under the free tier’s requests and tokens a ' +
    'minute. A run is a database row worked by the worker (websocket events `scenes.run` and `scenes.activity`); it ' +
    'survives a refresh and a restart and pauses rather than fails when the provider is busy or out of quota.',
});

const book = z.enum(BOOK_IDS);
const chapterNumber = z.coerce.number().int().min(101).max(1299);
const chapterList = z
  .string()
  .regex(/^\d{1,4}(,\d{1,4})*$/, 'Chapters are numbers separated by commas')
  .transform((text) => [...new Set(text.split(',').map(Number))].sort((a, b) => a - b));
const statuses = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);

router.get(
  '/overview',
  {
    summary: 'What scene prompts are set up with',
    description: 'The checklist the page opens with (key, bucket, worker, model, limits), what the model has used this minute and today, the books, and the active runs.',
    permission: 'scenes.read',
    limit: 'read',
    responds: { 200: 'Settings, usage, books and the active runs' },
  },
  controller.overview
);

router.get(
  '/chapters',
  {
    summary: 'Which chapters have a scene file',
    description: 'Every chapter of the book with its file’s scene count, length, model and tokens when written. Read from one index file, not by listing the bucket.',
    permission: 'scenes.read',
    limit: 'read',
    query: z.object({ book: book.optional() }),
    responds: { 200: 'The chapters', 422: 'Storage cannot be read' },
  },
  controller.chapters
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a run',
    description:
      'How many chapters a run would write, the input tokens and requests that is, and about how long it takes under the limits of the ' +
      'provider chosen (only Gemini’s free tier has any of ours). Worked out from a sample of the chapters. When the model has a known price, ' +
      '`costUsd` is a rough cost in US dollars, and `unusable` says why the model cannot be used, if it cannot. Nothing is spent.',
    permission: 'scenes.read',
    limit: 'read',
    query: z.object({
      book: book.optional(),
      chapters: chapterList.optional(),
      force: z.enum(['true', 'false']).optional(),
      provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
      model: z.string().trim().min(1).max(100).optional(),
    }),
    responds: { 200: 'The estimate', 422: 'Storage cannot be read' },
  },
  controller.estimate
);

router.get(
  '/runs',
  { summary: 'List scene runs', description: 'Newest first.', permission: 'scenes.read', limit: 'read', query: schemas.page.extend({ status: statuses.optional(), book: book.optional() }), responds: { 200: 'Runs' } },
  controller.list
);

router.post(
  '/runs',
  {
    summary: 'Start a scene run',
    description:
      'Queues a run for the chapters given (all of the book when left out). Chapters that already have a file are skipped unless ' +
      '`force` is true. A run started while another is going is queued and starts by itself, one at a time in the order made. `provider` and `model` default to the server’s (Gemini and ' +
      '`SCENES_GEMINI_MODEL`); a model that cannot run without extended thinking is refused. A chapter with no Hindi meanings yet is skipped and said so in the feed.',
    permission: 'scenes.run',
    limit: 'write',
    body: z.object({
      book: book.optional(),
      chapters: z.array(chapterNumber).min(1).max(335).optional(),
      provider: z.enum(['anthropic', 'openai', 'gemini']).optional(),
      model: z.string().trim().min(1).max(100).optional(),
      force: z.boolean().optional(),
    }),
    responds: { 201: 'The queued run', 409: 'Everything asked for is already written', 422: 'No API key for the provider, a model that cannot be used, storage not set up, or the queue is unreachable' },
  },
  controller.start
);

router.get(
  '/runs/:id',
  { summary: 'Get one scene run with its activity feed', permission: 'scenes.read', limit: 'read', params: schemas.id, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.get
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed scene run',
    description: 'Carries on from the first chapter not yet written.',
    permission: 'scenes.run',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run, queued again', 404: 'No such run', 409: 'Not paused or failed' },
  },
  controller.resume
);

router.post(
  '/runs/:id/cancel',
  {
    summary: 'Cancel a scene run',
    description: 'A run that is working stops after the chapter in progress; a waiting or paused one is cancelled at once. Everything written stays.',
    permission: 'scenes.run',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancel
);

router.get(
  '/output/:chapter',
  {
    summary: 'A chapter’s scene prompts',
    description: 'The saved file plus the text to copy: the whole chapter as one prompt (`promptText`) and each scene on its own.',
    permission: 'scenes.read',
    limit: 'read',
    params: z.object({ chapter: chapterNumber }),
    query: z.object({ book: book.optional() }),
    responds: { 200: 'The chapter’s scenes', 404: 'Not written yet', 422: 'Storage cannot be read' },
  },
  controller.output
);

router.get(
  '/output/:chapter/file',
  {
    summary: 'A chapter’s scene file as stored',
    description: 'The JSON exactly as saved in storage (`sk-<canto>-ch-<n>.json`), without the copy text — what the panel’s Download saves.',
    permission: 'scenes.read',
    limit: 'read',
    params: z.object({ chapter: chapterNumber }),
    query: z.object({ book: book.optional() }),
    responds: { 200: 'The stored file', 404: 'Not written yet', 422: 'Storage cannot be read' },
  },
  controller.file
);

export default router;
