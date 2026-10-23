import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/calendar-translation.js';
import { LANGUAGE_CODES } from '../../controllers/admin/calendar-translation.js';
import { KINDS } from '../../config/calendar.js';

const router = createRouter({
  tag: 'Admin · Calendar translation',
  prefix: '/panchang/translation',
  description:
    'The Hindu calendar’s words — festival names and descriptions and the panchang terms (tithi, nakshatra, yoga, karana, ' +
    'lunar month, zodiac sign) — in the 11 reading languages. A translation belongs to the English text, not to a date or a ' +
    'place, so one serves every day. Made by runs (a `CalendarRun` row worked by the worker with the provider and model the ' +
    'admin picks; websocket events `calendar.run` and `calendar.activity`) or written by hand; a translation written by hand is ' +
    'never replaced by a run. The public calendar and the festival push use them for readers whose reading language has one, and ' +
    'show English for the rest.',
});

const language = z.enum(LANGUAGE_CODES);
const kind = z.enum(KINDS);
const runStatus = z.enum(['QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
const provider = z.enum(['anthropic', 'openai', 'gemini']);
const model = z.string().trim().min(1).max(100);

router.get(
  '/overview',
  {
    summary: 'What the calendar translation has, and how it is set up',
    description:
      'How many of the calendar’s words are translated into each language, and what a run can use: every provider with the models it ' +
      'offers (price, and why one cannot be used), whether its key is set, the server’s default, whether the worker is online, and the runs that are active.',
    permission: 'panchang.translate',
    limit: 'read',
    responds: { 200: 'Coverage, providers and models, and the active runs' },
  },
  controller.overview
);

router.get(
  '/items',
  {
    summary: 'List the calendar’s words with their translation into a language',
    description:
      'Every distinct festival name, festival description and panchang term the calendar holds, with the translation into `language` if there is one. ' +
      '`state` narrows to the translated, the missing or the hand-written; `q` searches the English and the translation.',
    permission: 'panchang.translate',
    limit: 'read',
    query: schemas.page.extend({ language, kind: kind.optional(), state: z.enum(['translated', 'missing', 'edited']).optional() }),
    responds: { 200: 'A page of words', 400: 'Not a language the calendar is translated into' },
  },
  controller.listItems
);

router.put(
  '/items',
  {
    summary: 'Write or correct a translation by hand',
    description: 'Saved as written by an admin and marked edited, so a translation run never replaces it. The English `source` must be a word the calendar holds.',
    permission: 'panchang.translate',
    limit: 'write',
    body: z.object({ language, kind, source: z.string().trim().min(1).max(600), text: z.string().trim().min(1).max(1200) }),
    responds: { 200: 'The translation', 400: 'Not a language the calendar is translated into', 404: 'The calendar holds no such word' },
  },
  controller.saveItem
);

router.delete(
  '/items/:id',
  {
    summary: 'Delete a translation',
    description: 'Readers then see English until a run (or an editor) writes it again.',
    permission: 'panchang.translate',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'Deleted', 404: 'No such translation' },
  },
  controller.deleteItem
);

router.get(
  '/estimate',
  {
    summary: 'Estimate a calendar translation run',
    description:
      'How many words a run into the language would translate, in how many requests, about how many tokens, and — when the model has a known price — what that costs in US dollars. ' +
      '`unusable` says why the model cannot be used, if it cannot. Nothing is spent.',
    permission: 'panchang.translate',
    limit: 'read',
    query: z.object({ language, force: z.enum(['true', 'false']).optional(), provider: provider.optional(), model: model.optional() }),
    responds: { 200: 'The estimate', 400: 'Not a language the calendar is translated into' },
  },
  controller.estimate
);

router.get(
  '/runs',
  { summary: 'List calendar translation runs', description: 'Newest first.', permission: 'panchang.translate', limit: 'read', query: schemas.page.extend({ status: runStatus.optional(), language: language.optional() }), responds: { 200: 'Runs' } },
  controller.listRuns
);

router.post(
  '/runs',
  {
    summary: 'Start a calendar translation run',
    description:
      'Queues a run that translates the calendar’s words that have no translation yet into the language (all of them with `force`; words an editor wrote are always kept). ' +
      'One live run per language; a run started while another is going waits its turn. `provider` and `model` default to the server’s; a model that cannot run without extended thinking is refused.',
    permission: 'panchang.translate',
    limit: 'write',
    body: z.object({ language, force: z.boolean().optional(), provider: provider.optional(), model: model.optional() }),
    responds: {
      201: 'The queued run',
      409: 'Everything is already translated, or a run for the language is live',
      422: 'No API key for the provider, a model that cannot be used, or the queue is unreachable',
    },
  },
  controller.startRun
);

router.get(
  '/runs/:id',
  { summary: 'Get one calendar translation run with its activity feed', permission: 'panchang.translate', limit: 'read', params: schemas.id, responds: { 200: 'The run and the latest activity, newest first', 404: 'No such run' } },
  controller.getRun
);

router.post(
  '/runs/:id/resume',
  {
    summary: 'Resume a paused or failed calendar translation run',
    description: 'Carries on from the first word that has no translation.',
    permission: 'panchang.translate',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run, queued again', 404: 'No such run', 409: 'Not paused or failed' },
  },
  controller.resumeRun
);

router.post(
  '/runs/:id/cancel',
  {
    summary: 'Cancel a calendar translation run',
    description: 'A run that is working stops after the batch in progress; a waiting or paused one is cancelled at once. Everything translated stays.',
    permission: 'panchang.translate',
    limit: 'write',
    params: schemas.id,
    body: z.object({}).optional(),
    responds: { 200: 'The run', 404: 'No such run', 409: 'The run has already finished' },
  },
  controller.cancelRun
);

export default router;
