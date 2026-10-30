import express from 'express';

import { createRouter } from '../../utils/router.js';
import * as controller from '../../controllers/webhook/marketing-email.js';

const router = createRouter({
  tag: 'Webhooks',
  prefix: '/marketing-email',
  description:
    'Bounces, complaints and deliveries of marketing email, from Amazon SES through an SNS topic (or any provider through the shared secret). ' +
    'Not app, web or admin: the caller is the mail provider, authenticated by signature or secret.',
});

router.post(
  '/',
  {
    summary: 'Marketing email events',
    description:
      'SNS posts JSON as `text/plain`. The message signature is verified against a certificate hosted on amazonaws.com, and only our own topic ' +
      '(`MARKETING_SNS_TOPIC_ARN`) is accepted or confirmed. A permanent bounce or a complaint puts the address on the suppression list and marks the delivery; ' +
      'a complaint also switches a reader’s marketing email off. Another provider posts `{ type: bounce|complaint|delivery, email }` with `X-Marketing-Secret`.',
    public: true,
    limit: 'webhook',
    middleware: express.text({ type: () => true, limit: '1mb' }),
    responds: { 200: 'Received', 400: 'Not a valid message', 403: 'Signature or secret did not verify' },
  },
  controller.receive
);

export default router;
