import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/referral.js';

const router = createRouter({
  tag: 'Referral',
  prefix: '/referral',
  description:
    'Refer and earn. Everyone has a code and a link (/satsang/<code>). A person invited with it ' +
    'qualifies by finishing a round of chanting, and the person who invited them is given a month ' +
    'of Ārta as an entitlement grant — never a store subscription. Opening a link alone rewards nothing.',
});

router.get(
  '/me',
  {
    summary: 'My referral code, totals, rewards and history',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'Code, link, totals, rules and a page of history' },
  },
  controller.me
);

router.get(
  '/mine',
  {
    summary: 'Who invited me',
    limit: 'read',
    responds: { 200: 'My referral, or null' },
  },
  controller.mine
);

router.post(
  '/attribute',
  {
    summary: 'Present a referral code',
    description:
      'Called after sign-in with the code from a link (or typed in). The first valid code wins. ' +
      'Always 200: `attributed: false` carries a `reason` (invalid_code, own_code, already_referred, ' +
      'not_new, window_passed, same_person, referrer_unavailable, referrer_busy).',
    limit: 'write',
    body: z.object({ code: z.string().min(4).max(24), source: z.enum(['LINK', 'CODE']).default('LINK') }),
    responds: { 200: '{ attributed, reason? }' },
  },
  controller.attribute
);

export default router;
