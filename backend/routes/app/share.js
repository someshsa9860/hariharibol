import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/share.js';

const router = createRouter({
  tag: 'Share',
  prefix: '/share',
  description:
    'Shareable links for verses, mantras and reels, and AI backgrounds for the Share Studio. A link’s code is ' +
    'random and names no person; opening one never touches referrals (those live under /referral).',
});

router.post(
  '/links',
  {
    summary: 'Get the share link for a verse, mantra or reel',
    description:
      'Finds or makes the one link for a target. `kind` is SHLOKA (targetId = the verse’s `verseId`), MANTRA ' +
      '(targetId = the mantra slug) or REEL (targetId = the reel id). Refuses (404) a target that is not public, ' +
      'so no code exists for a draft. The same target always gets the same link.',
    body: z.object({ kind: z.enum(['SHLOKA', 'MANTRA', 'REEL']), targetId: z.string().trim().min(1).max(100) }),
    limit: 'write',
    responds: { 201: 'The link: code, url, appUri', 404: 'The content is not public' },
  },
  controller.createLink
);

router.get(
  '/links/:code',
  {
    summary: 'Open a share link',
    description:
      'Public. Resolves a code to the public view of its content, for the landing page, its Open Graph tags and the ' +
      'app’s link handler. 404 for a code that does not exist (or names another kind than `kind`), 410 when the ' +
      'content has been revoked or unpublished. Carries the store listings (null where not configured) and only ' +
      'attribution query parameters.',
    public: true,
    params: z.object({ code: z.string().min(1).max(32) }),
    query: z.object({ kind: z.enum(['SHLOKA', 'MANTRA', 'REEL']).optional() }).passthrough(),
    limit: 'read',
    responds: { 200: 'The content and its links', 404: 'Unknown link', 410: 'No longer available' },
  },
  controller.openLink
);

router.get(
  '/background/quote',
  {
    summary: 'Can I make an AI background?',
    description: 'Whether backgrounds are available, whether the wallet can pay for one now, and roughly how many it holds. Never tokens.',
    limit: 'read',
    responds: { 200: 'Availability and affordability' },
  },
  controller.quote
);

router.get(
  '/background/:id/image',
  {
    summary: 'Download an AI background',
    description: 'The PNG bytes of a finished background, for its maker only (404 for anyone else), so a browser can draw it on a canvas without cross-origin trouble.',
    params: z.object({ id: z.string().min(1).max(40) }),
    limit: 'read',
    responds: { 200: 'image/png', 404: 'Not yours, or not finished' },
  },
  controller.backgroundImage
);

router.post(
  '/background',
  {
    summary: 'Make an AI background',
    description:
      'Charges the Ask Sakha wallet once per `requestId` (send the same id when retrying). 402 `CREDITS_EXHAUSTED` ' +
      'when the wallet or the day’s allowance cannot pay — nothing is started. A failed generation is refunded ' +
      'before the error is returned. 409 `IN_PROGRESS` while the same or another background is still being made. ' +
      'Returns the picture’s temporary link and `imageKey`.',
    body: z.object({
      requestId: z.string().trim().min(8).max(64).regex(/^[\w-]+$/),
      prompt: z.string().trim().min(3).max(600),
    }),
    limit: 'ai',
    responds: { 200: 'The picture', 402: 'Not enough credits', 409: 'Already being made', 502: 'Generation failed, refunded', 503: 'Not available' },
  },
  controller.makeBackground
);

export default router;
