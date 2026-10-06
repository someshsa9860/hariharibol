import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/donation.js';

const router = createRouter({
  tag: 'Donations',
  prefix: '/donations',
  description:
    'Giving, through Razorpay, Google Play or the App Store. Any amount earns Premium ' +
    'permanently. Note that Apple requires in-app purchase for anything unlocking digital ' +
    'content, so the Razorpay path should not be offered inside the iOS build.',
});

router.post(
  '/razorpay/order',
  {
    summary: 'Start a Razorpay donation',
    description:
      'Creates the order and records it as pending. Nothing is credited here — an order is ' +
      'an intent, and the money has not moved yet.',
    limit: 'write',
    body: z.object({
      amountMinor: z.coerce.number().int().min(100).max(100_000_000),
      currency: z.string().length(3).default('INR'),
      message: z.string().max(500).optional(),
      isAnonymous: z.boolean().optional(),
    }),
    responds: { 201: 'The order to hand to the Razorpay checkout', 400: 'Below the minimum' },
  },
  controller.createOrder
);

router.post(
  '/razorpay/verify',
  {
    summary: 'Confirm a completed Razorpay checkout',
    description:
      'Checks the checkout signature, settles the pending row and grants Premium. The ' +
      'webhook confirms the same payment server to server; both write through the same ' +
      'idempotent upsert, so whichever arrives second changes nothing.',
    limit: 'write',
    body: z.object({
      orderId: z.string().min(1).max(200),
      paymentId: z.string().min(1).max(200),
      signature: z.string().min(1).max(500),
    }),
    responds: { 200: 'Donation recorded', 400: 'Signature did not verify, or unknown order' },
  },
  controller.verifyOrder
);

router.post(
  '/store',
  {
    summary: 'Record a donation bought through a store',
    description:
      'A one-off in-app product on Google Play or the App Store, verified server to server ' +
      'before anything is written.',
    limit: 'write',
    body: z.object({
      provider: z.enum(['GOOGLE_PLAY', 'APPLE_APP_STORE']),
      productId: z.string().min(1).max(200),
      purchaseToken: z.string().max(2000).optional(),
      transactionId: z.string().max(200).optional(),
      amountMinor: z.coerce.number().int().min(0).optional(),
      currency: z.string().length(3).optional(),
    }),
    responds: { 201: 'Donation recorded', 400: 'The store could not confirm it' },
  },
  controller.storeDonation
);

router.get(
  '/mine',
  {
    summary: 'List my donations',
    limit: 'read',
    responds: { 200: 'Donations with the lifetime total' },
  },
  controller.mine
);

export default router;
