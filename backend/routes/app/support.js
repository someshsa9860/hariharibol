import express from 'express';

import { createRouter, z, schemas } from '../../utils/router.js';
import { AppError } from '../../utils/errors.js';
import * as controller from '../../controllers/app/support.js';
import { CATEGORIES } from '../../services/support.js';

const router = createRouter({
  tag: 'Support',
  prefix: '/support',
  description:
    'A reader writing in: a ticket (a problem or question, with optional screenshot) or quick feedback ' +
    '(stars and a note). Staff reply from the admin panel and the reader gets a push. Also the check ' +
    'the app makes before asking for a store rating, and the log of those prompts.',
});

const rawFile = express.raw({ type: () => true, limit: controller.IMAGE_MAX_BYTES });
const readFile = (req, res, next) =>
  rawFile(req, res, (error) =>
    next(error?.type === 'entity.too.large' ? new AppError(413, 'MEDIA_TOO_LARGE', 'That picture is too large') : error)
  );

router.post(
  '/media',
  {
    summary: 'Upload a screenshot for a ticket',
    description:
      'The request body is the picture (JPEG, PNG or WebP, up to 5 MB), judged from its bytes. Returns ' +
      '`{ key, url }`: name `key` as `screenshotKey` in `POST /support/tickets`.',
    limit: 'write',
    middleware: readFile,
    responds: { 200: 'The key and a link', 400: 'Empty body', 413: 'MEDIA_TOO_LARGE', 422: 'MEDIA_NOT_USABLE' },
  },
  controller.uploadMedia
);

router.post(
  '/tickets',
  {
    summary: 'Raise a ticket or send feedback',
    description:
      '`kind: TICKET` needs a message, except a translation request; `kind: FEEDBACK` needs a 1–5 rating and may ' +
      'carry a note. `category: feature` is a new feature asked for (a message). `category: translation` asks for ' +
      'a book in a language: it needs `details: { bookSlug, languageCode }`, both must exist and the language must be ' +
      'one the app reads in; a note is optional. ' +
      '`deviceInfo` is what the app attaches (platform, OS, model, app version, locale). At most 10 a day.',
    limit: 'write',
    body: z.object({
      kind: z.enum(['TICKET', 'FEEDBACK']).default('TICKET'),
      category: z.enum(CATEGORIES),
      subject: z.string().trim().max(120).optional(),
      message: z.string().trim().max(4000).default(''),
      rating: z.coerce.number().int().min(1).max(5).optional(),
      details: z.object({ bookSlug: z.string().trim().min(1).max(200), languageCode: z.string().trim().min(2).max(10) }).optional(),
      screenshotKey: z.string().min(1).max(500).optional(),
      deviceInfo: z.record(z.string().max(100), z.union([z.string().max(200), z.number(), z.boolean()])).optional(),
    }),
    responds: {
      201: 'The ticket',
      400: 'Missing message or rating, or a translation request with no real book or language',
      429: 'Too many today',
    },
  },
  controller.create
);

router.get(
  '/tickets',
  {
    summary: 'List my tickets',
    description: 'Newest activity first. `meta.unread` is how many have a staff reply not yet opened.',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'A page of tickets' },
  },
  controller.list
);

router.get(
  '/unread',
  { summary: 'Tickets with an unread reply', description: 'The badge on Help and feedback.', limit: 'read', responds: { 200: '{ count }' } },
  controller.unread
);

router.get(
  '/tickets/:id',
  {
    summary: 'Read a ticket',
    description: 'The whole conversation, oldest first, and the screenshot link. Opening it marks the reply read.',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The ticket and its messages', 404: 'Not yours or not there' },
  },
  controller.get
);

router.post(
  '/tickets/:id/messages',
  {
    summary: 'Reply on a ticket',
    description: 'A follow-up from the reader. A resolved ticket reopens.',
    limit: 'write',
    params: schemas.id,
    body: z.object({ body: z.string().trim().min(1).max(4000) }),
    responds: { 201: 'The message', 404: 'Not yours or not there' },
  },
  controller.reply
);

router.get(
  '/review-check',
  {
    summary: 'Is this a good moment to ask for a store rating?',
    description:
      'Asks only after a streak of chanting days (`trigger=streak`) or a finished session (`trigger=session`), ' +
      'never within 90 days of the last prompt, nor within 60 days of writing in, nor after unhappy feedback.',
    limit: 'read',
    query: z.object({ trigger: z.enum(['streak', 'session']) }),
    responds: { 200: '{ ask, reason }' },
  },
  controller.reviewCheck
);

router.post(
  '/review-prompts',
  {
    summary: 'Record a rating prompt',
    description:
      '`SHOWN` when the store sheet was requested; `LIKED` / `UNHAPPY` / `DISMISSED` for the "Enjoying ' +
      'HariHariBol?" pre-prompt. Shown, liked and unhappy start the 90-day quiet period.',
    limit: 'write',
    body: z.object({
      trigger: z.enum(['streak', 'session']),
      outcome: z.enum(['SHOWN', 'LIKED', 'UNHAPPY', 'DISMISSED']),
    }),
    responds: { 201: 'The record' },
  },
  controller.reviewPrompt
);

export default router;
