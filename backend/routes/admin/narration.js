import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/narration.js';
import { BOOK_IDS } from '../../scripts/lib/claude-translate-source.js';
import { narration } from '../../config/narration.js';

const router = createRouter({
  tag: 'Admin · Narration',
  prefix: '/narration',
  description:
    'Narration (AI voices): the translation of each verse spoken by a text-to-speech engine (Google Chirp 3 HD or Gemini TTS) and stored in ' +
    'S3 as `narration/api/<book>/<language>/<engine>/<model>/<voice>/<chapter>/<verse>.<ext>`, with an `_index.json` beside each voice. ' +
    'A run is a database row worked by the worker (websocket events `narration.run`, `narration.activity` and `narration.clip`); it survives a ' +
    'refresh and a restart and pauses rather than fails when the engine is busy. A comparison speaks one verse in several voices to listen to. ' +
    'Prices and limits shown are not verified against Google.',
});

const book = z.enum(BOOK_IDS);
const language = z.enum(Object.keys(narration.languages));
const text = (max) => z.string().trim().min(1).max(max);
const chapterNumber = z.coerce.number().int().min(1).max(1299);
const chapterList = z
  .string()
  .regex(/^\d{1,4}(,\d{1,4})*$/, 'Chapters are numbers separated by commas')
  .transform((value) => [...new Set(value.split(',').map(Number))].sort((a, b) => a - b));
const statuses = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
const target = z.object({ engine: text(30), model: text(100), voice: text(100) });

router.get(
  '/overview',
  {
    summary: 'What narration is set up with',
    description: 'The checklist the page opens with (engine keys, storage, worker), engines with their voices, models, limits and price, languages, books and the active runs.',
    permission: 'narration.read',
    limit: 'read',
    responds: { 200: 'Settings, books and the active runs' },
  },
  controller.overview
);

router.get('/voices', { summary: 'Engines, models and voices', permission: 'narration.read', limit: 'read', responds: { 200: 'The engines' } }, controller.voices);
router.get('/languages', { summary: 'Languages that can be narrated', permission: 'narration.read', limit: 'read', responds: { 200: 'The languages' } }, controller.languages);

router.get(
  '/estimate',
  {
    summary: 'Estimate a narration run',
    description:
      'Characters, engine requests, the least time the engine’s request rate allows and, when a price is known, a rough cost in US dollars ' +
      '(`priceVerified` says whether anyone checked it). Up to 20 chapters are read and the clips already made are left out; more are sampled and scaled. Nothing is spent.',
    permission: 'narration.read',
    limit: 'read',
    query: z.object({
      book: book.optional(),
      language: language.optional(),
      engine: text(30).optional(),
      model: text(100).optional(),
      voice: text(100).optional(),
      chapters: chapterList.optional(),
      force: z.enum(['true', 'false']).optional(),
    }),
    responds: { 200: 'The estimate', 400: 'A chapter is not in the book', 422: 'A choice cannot be used, or storage cannot be read' },
  },
  controller.estimate
);

router.get(
  '/runs',
  {
    summary: 'List narration runs',
    description: 'Newest first.',
    permission: 'narration.read',
    limit: 'read',
    query: schemas.page.extend({ status: statuses.optional(), book: book.optional(), kind: z.enum(['NARRATION', 'COMPARE']).optional() }),
    responds: { 200: 'Runs' },
  },
  controller.list
);

router.post(
  '/runs',
  {
    summary: 'Start a narration run',
    description:
      'Queues a run that narrates the chapters given (all of the book when left out) in one voice. A verse whose clip was made from the same text is not made again ' +
      'unless `force` is true (which replaces the clip; the old one is not kept). Only one narration run can be live for a book.',
    permission: 'narration.run',
    limit: 'write',
    body: z.object({
      book: book.optional(),
      language: language.optional(),
      engine: text(30).optional(),
      model: text(100).optional(),
      voice: text(100).optional(),
      chapters: z.array(chapterNumber).min(1).max(335).optional(),
      force: z.boolean().optional(),
    }),
    responds: { 201: 'The queued run', 400: 'A chapter is not in the book', 409: 'A narration run is already live for this book', 422: 'A choice cannot be used, no API key, storage not set up, or the queue is unreachable' },
  },
  controller.start
);

router.post(
  '/compare',
  {
    summary: 'Start a voice comparison',
    description: 'Speaks one verse in up to six engine/model/voice combinations, so they can be played side by side. Replaces earlier clips of that verse in those voices.',
    permission: 'narration.run',
    limit: 'write',
    body: z.object({
      book: book.optional(),
      language: language.optional(),
      verseId: text(40),
      targets: z.array(target).min(1).max(narration.maxTargets),
    }),
    responds: { 201: 'The queued comparison', 409: 'A comparison is already live for this book', 422: 'A choice cannot be used, the verse has no text, no API key, or storage is not set up' },
  },
  controller.startCompare
);

router.get(
  '/runs/:id',
  { summary: 'Get one narration run with its activity feed', permission: 'narration.read', limit: 'read', params: schemas.id, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.get
);

router.get(
  '/compare/:id',
  {
    summary: 'Get a voice comparison',
    description: 'The run, and for each voice its clip (with a short-lived address to play it) once made.',
    permission: 'narration.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The comparison', 404: 'No such comparison' },
  },
  controller.compare
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed narration run',
    description: 'Carries on from the first verse without a clip made from the current text.',
    permission: 'narration.run',
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
    summary: 'Cancel a narration run',
    description: 'A run that is working stops after the verse in progress; a waiting or paused one is cancelled at once. Every clip made stays.',
    permission: 'narration.run',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancel
);

router.get(
  '/clips',
  {
    summary: 'List clips',
    description: 'Clips made, newest first, optionally of one voice or verse.',
    permission: 'narration.read',
    limit: 'read',
    query: schemas.page.extend({
      book: book.optional(), language: language.optional(), engine: text(30).optional(), model: text(100).optional(), voice: text(100).optional(), verseId: text(40).optional(),
    }),
    responds: { 200: 'Clips' },
  },
  controller.clips
);

router.get(
  '/clips/:id',
  { summary: 'Get one clip with a link to play it', description: 'The `url` is short-lived.', permission: 'narration.read', limit: 'read', params: schemas.id, responds: { 200: 'The clip', 404: 'No such clip' } },
  controller.clip
);

export default router;
