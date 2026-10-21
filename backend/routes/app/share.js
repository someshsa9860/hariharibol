import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/share.js';

const router = createRouter({
  tag: 'Share',
  prefix: '/share',
  description:
    'Public links for verses, mantras and reels, and AI backgrounds for share cards. A link is a ' +
    'random code on a spiritual path (/shloka, /naam, /darshan) that reveals neither the content ' +
    'id nor the sharer. Backgrounds are paid for from the Ask Sakha credit and are never charged twice.',
});

router.post(
  '/link',
  {
    summary: 'Get the public link for a piece of content',
    description:
      'Returns the same link for the same person sharing the same thing. 404 for content that ' +
      'is not public (an unpublished book, a reel awaiting review).',
    limit: 'write',
    body: z.object({
      type: z.enum(['VERSE', 'MANTRA', 'REEL']),
      targetId: z.string().min(1).max(120),
    }),
    responds: { 200: '{ code, type, url }', 404: 'Content is not public' },
  },
  controller.link
);

router.get(
  '/background/quote',
  {
    summary: 'Can I make a background, and what does it cost?',
    description: 'The cost as a percentage of the meter (never tokens), whether it is affordable now, and suggested prompts.',
    limit: 'read',
    responds: { 200: 'Quote' },
  },
  controller.quote
);

router.post(
  '/background',
  {
    summary: 'Make an AI background',
    description:
      '`requestKey` is chosen by the app for one attempt; repeating a request with the same key ' +
      'returns the same job and never charges again. The charge is taken first and returned if the ' +
      'picture cannot be made (a FAILED job with `refunded`). A failed job can be tried again with ' +
      'the same key. 402 `CREDIT_REQUIRED` before anything is charged when there is no credit.',
    limit: 'ai',
    body: z.object({
      requestKey: z.string().regex(/^[A-Za-z0-9_-]{8,80}$/),
      prompt: z.string().min(1).max(600),
    }),
    responds: { 200: 'The job (DONE or FAILED)', 201: 'The job was started', 402: 'Not enough credit', 503: 'Not available' },
  },
  controller.generate
);

router.get(
  '/background/:id',
  {
    summary: 'Get a background',
    limit: 'read',
    params: z.object({ id: z.string().min(1).max(40) }),
    responds: { 200: 'The job', 404: 'Not yours or unknown' },
  },
  controller.background
);

router.get(
  '/background/:id/image',
  {
    summary: 'Download a background',
    description: 'The finished picture as image/png, served through the API so a browser can draw it on a canvas.',
    limit: 'read',
    params: z.object({ id: z.string().min(1).max(40) }),
    responds: { 200: 'image/png', 404: 'Not yours, unknown or not finished' },
  },
  controller.backgroundImage
);

export default router;
