import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/payment.js';

const router = createRouter({
  tag: 'Admin · Money',
  prefix: '',
  description:
    'Subscriptions, the payment ledger and refunds. Nothing here decides entitlement ' +
    'directly — it is always recomputed from the ledger, so an admin correcting a payment ' +
    'changes access as a consequence rather than by flipping a flag.',
});

const provider = z.enum(['GOOGLE_PLAY', 'APPLE_APP_STORE', 'RAZORPAY']);
const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// ── Subscriptions ──────────────────────────────────────────────────────────

router.get(
  '/subscriptions',
  {
    summary: 'List subscriptions',
    permission: 'payment.read',
    limit: 'read',
    query: schemas.sorted(controller.SUBSCRIPTION_SORT_COLUMNS).extend({
      status: z
        .enum(['IN_TRIAL', 'ACTIVE', 'GRACE', 'CANCELLED', 'EXPIRED', 'REFUNDED'])
        .optional(),
      provider: provider.optional(),
    }),
    responds: { 200: 'A page of subscriptions' },
  },
  controller.listSubscriptions
);

// ── Payments ───────────────────────────────────────────────────────────────
// '/payments/summary' and '/payments/donors' come before '/payments/:id'.

router.get(
  '/payments/summary',
  {
    summary: 'Get payment totals',
    description:
      'Grouped by purpose and currency. Currency is not collapsed on purpose — summing paise ' +
      'and cents into one number would be meaningless, and a single revenue figure across ' +
      'currencies is exactly the kind of mistake that goes unnoticed.',
    permission: 'payment.read',
    limit: 'read',
    query: z.object({ from: dateString.optional() }),
    responds: { 200: 'Totals by purpose and currency' },
  },
  controller.summary
);

router.get(
  '/payments/donors',
  {
    summary: 'List donors',
    description:
      'Most recent first. Anonymous donations are included, but the donor is not named — ' +
      'they asked not to be, and an admin list is still a list.',
    permission: 'payment.read',
    limit: 'read',
    responds: { 200: 'Donations' },
  },
  controller.donors
);

router.get(
  '/payments',
  {
    summary: 'List payments',
    description: 'One ledger for subscriptions and donations alike, separated by `purpose`.',
    permission: 'payment.read',
    limit: 'read',
    query: schemas.sorted(controller.PAYMENT_SORT_COLUMNS).extend({
      purpose: z.enum(['SUBSCRIPTION', 'DONATION']).optional(),
      status: z.enum(['PENDING', 'SUCCEEDED', 'FAILED', 'REFUNDED']).optional(),
      provider: provider.optional(),
      from: dateString.optional(),
      to: dateString.optional(),
    }),
    responds: { 200: 'A page of payments' },
  },
  controller.listPayments
);

router.post(
  '/payments/:id/refund',
  {
    summary: 'Mark a payment refunded',
    description:
      'Records that a refund happened; it does not issue one. The money goes back through the ' +
      'provider’s own console, and this brings the ledger in line — which then recomputes ' +
      'entitlement, so a refunded donation stops granting permanent Premium.',
    permission: 'payment.refund',
    limit: 'write',
    params: schemas.id,
    body: z.object({ reason: z.string().max(1000).optional() }),
    responds: { 200: 'Marked', 400: 'Not a successful payment', 404: 'No such payment' },
  },
  controller.refund
);

router.post(
  '/payments/entitlement/:userId',
  {
    summary: 'Recompute one account’s entitlement',
    description: 'For a missed webhook. Recomputes from the ledger and grants nothing on its own.',
    permission: 'payment.read',
    limit: 'write',
    params: z.object({ userId: z.string().min(1) }),
    responds: { 200: 'The recomputed entitlement' },
  },
  controller.refreshEntitlement
);

export default router;
