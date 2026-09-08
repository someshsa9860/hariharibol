const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/webhook/payment');

const router = createRouter({
  tag: 'Webhooks',
  prefix: '/payments',
  description:
    'Server-to-server callbacks from the payment providers. Not app, web or admin — nobody ' +
    'calls these but Razorpay, Google and Apple, and they authenticate by signature rather ' +
    'than by token. They are the authoritative path for money: renewals, refunds and ' +
    'cancellations only ever arrive here.',
});

router.post(
  '/razorpay',
  {
    summary: 'Razorpay webhook',
    description:
      'HMAC-SHA256 over the raw request body, compared in constant time. Handles ' +
      'payment.captured, payment.failed and refund.processed; everything else is answered ' +
      '200 and ignored, because a 4xx would make Razorpay retry it.',
    public: true,
    limit: 'webhook',
    responds: { 200: 'Received', 403: 'Signature did not verify' },
  },
  controller.razorpay
);

router.post(
  '/google',
  {
    summary: 'Google Play real-time developer notification',
    description:
      'Arrives through Pub/Sub push, authenticated by a shared token on the URL. The body ' +
      'carries only an identifier — never an entitlement claim — so the subscription state ' +
      'is re-read from the Play API before anything is written.',
    public: true,
    limit: 'webhook',
    responds: { 200: 'Received', 403: 'Token did not match' },
  },
  controller.google
);

router.post(
  '/apple',
  {
    summary: 'App Store server notification (V2)',
    description:
      'The body is a JWS. Its payload is decoded to work out which subscription is being ' +
      'talked about, then the authoritative state is read back from Apple’s API — an ' +
      'unverified JWS is a hint about what happened, not proof of it.',
    public: true,
    limit: 'webhook',
    responds: { 200: 'Received' },
  },
  controller.apple
);

router.post(
  '/entitlement/refresh/:userId',
  {
    summary: 'Recompute one user’s entitlement',
    description:
      'An operator escape hatch for a missed webhook — someone locked out of something they ' +
      'paid for. Recomputes from the ledger and grants nothing on its own, which is why it ' +
      'is safe to expose behind a permission rather than a signature.',
    permission: 'payment.read',
    limit: 'write',
    params: z.object({ userId: z.string().min(1) }),
    responds: { 200: 'The recomputed entitlement' },
  },
  controller.refreshEntitlement
);

module.exports = router;
