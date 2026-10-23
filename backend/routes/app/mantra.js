import express from 'express';

import { IMAGE_MAX_BYTES, MAX_PICKS, MAX_SUGGESTIONS } from '../../config/mantra-own.js';
import { createRouter, z, schemas } from '../../utils/router.js';
import { AppError } from '../../utils/errors.js';
import * as controller from '../../controllers/app/mantra.js';

const router = createRouter({
  tag: 'Mantras',
  prefix: '/mantras',
  description:
    'Mantras for chanting. Each response resolves the script from the reader’s mantra ' +
    'language and the meaning from their reading language, so the two halves may come from ' +
    'different rows — that is intended.',
});

router.get(
  '/',
  {
    summary: 'List mantras',
    description:
      'Published mantras, filterable by category, deity, guru or tag — and, for a signed-in reader, the private ones ' +
      'they added (`mantraType: "PRIVATE"`), first.',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      category: z.string().max(50).optional(),
      deity: z.string().max(100).optional(),
      guru: z.string().max(100).optional(),
      tag: z.string().max(50).optional(),
    }),
    responds: { 200: 'A page of mantras' },
  },
  controller.list
);

router.get(
  '/categories',
  {
    summary: 'List mantra categories',
    description: 'Every category in use, with how many published mantras are in each.',
    public: true,
    limit: 'read',
    responds: { 200: 'Categories with counts' },
  },
  controller.categories
);

// The picture is the request body itself; what it really is, is judged from its bytes (utils/chat-image.js).
const rawPicture = express.raw({ type: () => true, limit: IMAGE_MAX_BYTES });
const readPicture = (req, res, next) =>
  rawPicture(req, res, (error) =>
    next(error?.type === 'entity.too.large' ? new AppError(413, 'IMAGE_TOO_LARGE', 'That picture is too large') : error)
  );

// The `/own…` routes come before `/:slug`, which would otherwise take "own" for a mantra.

router.post(
  '/own/suggest',
  {
    summary: 'Suggest mantras for what the reader typed or said',
    description:
      'Step 1 of adding a mantra that is not in the catalogue. The text is sent to the AI as it was entered; the ' +
      'AI names related mantras, and they come back to choose from. Each has a `status`: `new` (can be added), ' +
      '`shared` (another reader added it — choosing it gives this reader access too), `yours` (already on the ' +
      'list) or `catalog` (already in the catalogue — open it by `slug`). Only `new` and `shared` can be chosen. ' +
      'The suggestions are kept on the server for an hour under `suggestionId`; the phone sends back only the ' +
      'numbers it chose, so nothing but what the AI suggested can be saved. Only the mantras of a well-known deity ' +
      'or saint are ever suggested (each item says whom it is for: `kind` is `deity` or `saint`, `addressedTo` is ' +
      'the name); a mantra the AI cannot tie to one is never offered, even when asked for by name. `items` is empty ' +
      '(and there is no `suggestionId`) when nothing was found. 422 `MANTRA_INPUT_NOT_USABLE`, 429 at the daily ' +
      'limit, 503 `MANTRA_AI_UNAVAILABLE`.',
    limit: 'ai',
    body: z.object({ text: z.string().min(1).max(1000) }),
    responds: {
      200: 'The suggestions',
      422: 'MANTRA_INPUT_NOT_USABLE',
      429: 'Daily limit reached',
      503: 'MANTRA_AI_UNAVAILABLE',
    },
  },
  controller.suggestOwn
);

router.post(
  '/own',
  {
    summary: 'Add the chosen mantras',
    description:
      'Step 2: `picks` are the `index` numbers of up to five suggestions. A mantra we already hold is shared with ' +
      'this reader instead of being made again; a new one is written by the AI in the shape of every catalogue ' +
      'mantra, saved private to the readers who hold it, given a public picture if one is found, and written out ' +
      'in the reader’s reading language in the background. Answers one `items` entry per pick with `status` ' +
      '`created`, `shared`, `already` or `failed`, and the `mantra` as the app shows it. A private mantra held by ' +
      '11 readers becomes public and is written out in every language. 410 when the suggestions have expired, ' +
      '409 `MANTRA_LIMIT`, 429 at the daily limit, 503 `MANTRA_AI_UNAVAILABLE`.',
    limit: 'ai',
    body: z.object({
      suggestionId: z.string().regex(/^[a-f0-9]{24}$/),
      picks: z.array(z.number().int().min(0).max(MAX_SUGGESTIONS - 1)).min(1).max(MAX_PICKS),
    }),
    responds: {
      201: 'What happened to each pick',
      409: 'MANTRA_LIMIT',
      410: 'The suggestions have expired',
      429: 'Daily limit reached',
      503: 'MANTRA_AI_UNAVAILABLE',
    },
  },
  controller.createOwn
);

router.put(
  '/own/:slug/image',
  {
    summary: 'Change the picture of a mantra the reader added',
    description:
      'The request body is the picture (JPEG, PNG or WebP). It is checked, drawn again as a JPEG and stored; ' +
      'only the reader who added the mantra can do this, and only while it is private. 404 for a mantra that is ' +
      'not theirs, 403 for one they only share, 413 `IMAGE_TOO_LARGE`, 422 `IMAGE_NOT_USABLE`.',
    limit: 'write',
    params: schemas.slug,
    middleware: readPicture,
    responds: { 200: 'The mantra', 403: 'Not the reader who added it', 404: 'Not found', 413: 'IMAGE_TOO_LARGE', 422: 'IMAGE_NOT_USABLE' },
  },
  controller.changeOwnImage
);

router.delete(
  '/own/:slug',
  {
    summary: 'Remove a private mantra from the reader’s list',
    description:
      'Takes away the reader’s access to it, their favourite and their standing choice of it. When no reader holds ' +
      'it any more and nothing refers to it, it is deleted. A public mantra cannot be removed this way (404).',
    limit: 'write',
    params: schemas.slug,
    responds: { 204: 'Removed', 404: 'Not on the reader’s list' },
  },
  controller.leaveOwn
);

router.get(
  '/:slug',
  {
    summary: 'Get one mantra',
    description:
      'The mantra with audio, the approximate duration of one recitation, the standard ' +
      'round or repetition count, and — for a signed-in reader — how many rounds they have ' +
      'chanted of it. `availableLanguages` lets the app say "not available in Marathi" ' +
      'rather than quietly falling back.',
    public: true,
    limit: 'read',
    params: schemas.slug,
    responds: { 200: 'The mantra', 404: 'No such published mantra, or a private one that is not the reader’s' },
  },
  controller.get
);

export default router;
