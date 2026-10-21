import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/referral.js';

const router = createRouter({
  tag: 'Referral',
  prefix: '/referral',
  description:
    'Refer and earn: a reader shares a /satsang/<code> link; when someone new claims it and settles in, the ' +
    'referrer is given a month of the Ārta plan. Opening a link never rewards anyone — only a signed-in claim does.',
});

router.get(
  '/me',
  {
    summary: 'My referral code, progress and rewards',
    description:
      'The reader’s own code and link (made on first use), the rules, counts of pending / rewarded referrals, the ' +
      'granted months with their start and end, and a paged history (first names only). Also settles any referral of ' +
      'theirs that has become due.',
    query: z.object({ page: z.coerce.number().int().min(1).optional(), pageSize: z.coerce.number().int().min(1).max(50).optional() }),
    limit: 'read',
    responds: { 200: 'Code, totals, rewards, history' },
  },
  controller.me
);

router.post(
  '/claim',
  {
    summary: 'Claim a referral code',
    description:
      'The signed-in new reader says which code brought them. First claim wins; claiming the same code again is ' +
      'harmless. 409 with `details.reason`: CODE_UNKNOWN, SELF_REFERRAL, ALREADY_REFERRED, NOT_NEW (the account is ' +
      'older than the claim window).',
    body: z.object({ code: z.string().trim().min(4).max(20) }),
    limit: 'referral',
    responds: { 200: 'The claim', 400: 'Not a code', 409: 'Refused, with a reason' },
  },
  controller.claim
);

router.get(
  '/inviter/:code',
  {
    summary: 'Whose invitation is this?',
    description: 'Public. The inviter’s first name and the store listings, for the /satsang landing page. Nothing else about them.',
    public: true,
    params: z.object({ code: z.string().min(1).max(32) }),
    limit: 'read',
    responds: { 200: 'First name and links', 404: 'Unknown code' },
  },
  controller.inviter
);

export default router;
