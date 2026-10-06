import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/subscription.js';

const router = createRouter({
  tag: 'Subscription',
  prefix: '/subscription',
  description:
    'Plans, what each costs on each store, and what each unlocks. The app is free; paid plans ' +
    'add benefits and never take them from the free one. A higher plan is also earned ' +
    'permanently by donating any amount, which is why entitlement is reported separately ' +
    'from the subscription itself.',
});

router.get(
  '/plans',
  {
    summary: 'List plans',
    description:
      'Public, so the paywall can be shown before anyone signs in. Returns every active plan ' +
      '— the free one included, so the app can compare — with a price per store and billing ' +
      'period, and the value of every feature on each plan. Prices are in minor units — ' +
      'paise for INR, cents for USD — and each store’s own product id is included, because ' +
      'they differ and the app must not hardcode them. `provider` narrows the prices to the ' +
      'store the device buys from.',
    public: true,
    query: z.object({ provider: z.enum(['GOOGLE_PLAY', 'APPLE_APP_STORE', 'RAZORPAY']).optional() }),
    limit: 'read',
    responds: { 200: 'Active plans, the feature catalogue, and prices' },
  },
  controller.plans
);

router.get(
  '/me',
  {
    summary: 'Get my entitlement',
    description:
      'Which plan this user is on, until when, why, and what it unlocks. `reason` is `DONATION`, ' +
      '`SUBSCRIPTION` or `NONE` — a donor and a subscriber both have access, but only one ' +
      'of them has something that renews or can lapse.',
    limit: 'read',
    responds: { 200: 'Entitlement and subscription state' },
  },
  controller.mine
);

router.post(
  '/verify',
  {
    summary: 'Verify a store purchase',
    description:
      'Called right after a purchase completes in the app. The purchase token is never ' +
      'trusted on its own — it is checked against Google or Apple server to server. The ' +
      'store webhook is the authoritative path and arrives regardless, but waiting for it ' +
      'would leave someone looking at a paywall they have just paid to remove. Both write ' +
      'through the same idempotent upsert, so neither double-counts.',
    limit: 'write',
    body: z.object({
      provider: z.enum(['GOOGLE_PLAY', 'APPLE_APP_STORE']),
      productId: z.string().min(1).max(200),
      purchaseToken: z.string().max(2000).optional(),
      transactionId: z.string().max(200).optional(),
    }),
    responds: {
      201: 'Subscription active',
      400: 'Store says the subscription is not active',
      404: 'No plan has a price with that product id',
    },
  },
  controller.verify
);

router.post(
  '/restore',
  {
    summary: 'Rebuild my entitlement',
    description:
      'Recomputes Premium from the payment ledger. For a reinstall, or when a webhook landed ' +
      'while the user was signed out.',
    limit: 'write',
    responds: { 200: 'The recomputed entitlement' },
  },
  controller.restore
);

export default router;
