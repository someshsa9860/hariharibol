import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/marketing.js';
import { marketing } from '../../config/marketing.js';

const router = createRouter({
  tag: 'Admin · Marketing',
  prefix: '/marketing',
  description:
    'Bulk email to readers and invitees. A campaign is a `MarketingCampaign` row worked by the worker (websocket events ' +
    '`marketing.run` and `marketing.activity`, to `marketing.read`); reaching people (start, schedule, pause, resume, cancel) needs ' +
    '`marketing.send`, which only the super admin has by default. Preparing (drafts, templates, lists) needs `marketing.manage`.',
});

const params = z.object({ id: z.string().min(1) });
const status = z.enum(['DRAFT', 'SCHEDULED', 'QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'FAILED', 'CANCELLED']);
const provider = z.enum(['anthropic', 'openai', 'gemini']);
const audience = z.object({
  users: z.record(z.string(), z.any()).nullable().optional(), // a segment filter, parsed by utils/marketing-audience.js
  lists: z.array(z.string().min(1)).max(50).optional(),
});
const link = z.object({
  position: z.number().int().min(1).max(marketing.maxLinks),
  kind: z.enum(['WEB', 'APP']),
  target: z.string().trim().min(1).max(500),
  label: z.string().trim().max(120).nullable().optional(),
});
const campaignFields = {
  name: z.string().trim().min(1).max(160),
  templateId: z.string().min(1).nullable().optional(),
  segmentId: z.string().min(1).nullable().optional(),
  audience: audience.optional(),
  mode: z.enum(['MERGE', 'AI_PER_USER']).optional(),
  provider: provider.optional(),
  model: z.string().trim().min(1).max(100).optional(),
  maxCostUsd: z.number().min(0).max(1000).optional(),
  ratePerMinute: z.number().int().min(1).max(10_000).nullable().optional(),
  links: z.array(link).max(marketing.maxLinks).optional(),
};

router.get(
  '/overview',
  {
    summary: 'What Marketing has, and how it is set up',
    description:
      'Counts, the setup card (is an email server set, the sender, the postal address, is a worker running; with `?verify=true` the ' +
      'server is logged into), the limits, the AI providers and models to pick from, the languages, merge fields, block types and ' +
      'the app places a link can open, and the campaigns that are active.',
    permission: 'marketing.read',
    limit: 'read',
    query: z.object({ verify: z.enum(['true', 'false']).transform((v) => v === 'true').optional() }),
    responds: { 200: 'The overview' },
  },
  controller.overview
);

router.get(
  '/campaigns',
  {
    summary: 'List campaigns',
    permission: 'marketing.read',
    limit: 'read',
    query: schemas.sorted({ createdAt: 'createdAt', name: 'name', status: 'status', scheduledAt: 'scheduledAt' }).extend({ status: status.optional(), channel: z.enum(['EMAIL', 'WHATSAPP']).optional() }),
    responds: { 200: 'A page of campaigns' },
  },
  controller.list
);

router.post(
  '/campaigns',
  {
    summary: 'Make a campaign (a draft)',
    description:
      'A template, who it is for (`audience.users` is a segment filter, `segmentId` copies a saved one, `audience.lists` are lists of invitees) ' +
      'and the campaign’s tracked links (`links`: position 1..5, WEB with an https target, APP with a `hariharibol://…` destination). ' +
      '`mode` `AI_PER_USER` writes each reader’s copy with `provider` and `model`, up to `maxCostUsd`.',
    permission: 'marketing.manage',
    limit: 'write',
    body: z.object(campaignFields),
    responds: { 201: 'The draft', 404: 'No such template, segment or list', 422: 'A filter or a link that does not hold' },
  },
  controller.create
);

router.post(
  '/estimate',
  {
    summary: 'Size a campaign before it starts',
    description: 'How many readers and invitees would get it, how many readers get English because their language is not approved, how long it takes, and what `AI_PER_USER` would cost. Nothing is sent.',
    permission: 'marketing.read',
    limit: 'read',
    body: z.object({ audience: audience.optional(), templateId: z.string().min(1).nullable().optional(), mode: z.enum(['MERGE', 'AI_PER_USER']).optional(), provider: provider.optional(), model: z.string().max(100).optional(), ratePerMinute: z.number().int().min(1).optional() }),
    responds: { 200: 'Counts, languages and cost', 422: 'A filter that does not hold' },
  },
  controller.estimate
);

router.get(
  '/campaigns/:id',
  {
    summary: 'One campaign',
    description: 'The campaign, its template and links with their taps, the funnel, why people were left out, the latest failures, what readers did that the campaign can be credited for, AI samples, what stops a draft from starting, and the activity feed.',
    permission: 'marketing.read',
    limit: 'read',
    params,
    responds: { 200: 'The campaign', 404: 'No such campaign' },
  },
  controller.get
);

router.get(
  '/campaigns/:id/deliveries',
  {
    summary: 'Who a campaign went to',
    description: 'One row per reader or invitee, with the state of their email. Addresses are masked.',
    permission: 'marketing.read',
    limit: 'read',
    params,
    query: schemas.page.extend({ status: z.enum(['PENDING', 'SENDING', 'SENT', 'DELIVERED', 'READ', 'FAILED', 'BOUNCED', 'SKIPPED']).optional() }),
    responds: { 200: 'A page of recipients' },
  },
  controller.deliveries
);

router.get(
  '/campaigns/:id/impact',
  {
    summary: 'What readers who tapped did next',
    description: 'For readers who tapped a link: chanting, reel viewing and reading in the 24 hours and 7 days after the tap, against the 7 days before it.',
    permission: 'marketing.read',
    limit: 'read',
    params,
    responds: { 200: 'Before and after counts' },
  },
  controller.impact
);

router.patch(
  '/campaigns/:id',
  {
    summary: 'Edit a draft',
    description: '`links`, when sent, replaces all the links. Only a draft can be edited.',
    permission: 'marketing.manage',
    limit: 'write',
    params,
    body: z.object(Object.fromEntries(Object.entries(campaignFields).map(([k, v]) => [k, v.optional()]))),
    responds: { 200: 'The campaign', 409: 'Not a draft' },
  },
  controller.update
);

router.delete(
  '/campaigns/:id',
  { summary: 'Delete a draft', permission: 'marketing.manage', limit: 'write', params, responds: { 200: 'Deleted', 409: 'Not a draft' } },
  controller.remove
);

router.post(
  '/campaigns/:id/duplicate',
  { summary: 'Copy a campaign into a new draft', permission: 'marketing.manage', limit: 'write', params, responds: { 201: 'The draft' } },
  controller.duplicate
);

router.post(
  '/campaigns/:id/start',
  {
    summary: 'Start a campaign now',
    description:
      'Checks first (an email server, a postal address, an approved English variant, every link the words point at, an audience, a usable model for AI mode) and answers 422 with the first thing wrong and the whole list in `details`. ' +
      'The worker then writes the audience (leaving out the unsubscribed, the suppressed and anyone over the weekly cap) and sends at the configured pace.',
    permission: 'marketing.send',
    limit: 'write',
    params,
    responds: { 200: 'Queued', 409: 'Not a draft', 422: 'It cannot start yet' },
  },
  controller.start
);

router.post(
  '/campaigns/:id/schedule',
  { summary: 'Start a campaign at a time', description: 'The `marketing.tick` job (every minute) queues it when the time comes. Checked now and again then.', permission: 'marketing.send', limit: 'write', params, body: z.object({ scheduledAt: z.string().min(1) }), responds: { 200: 'Scheduled', 422: 'It cannot start yet' } },
  controller.schedule
);

router.post('/campaigns/:id/unschedule', { summary: 'Take a scheduled campaign back to a draft', permission: 'marketing.send', limit: 'write', params, responds: { 200: 'A draft again' } }, controller.unschedule);
router.post('/campaigns/:id/pause', { summary: 'Pause a running campaign', description: 'A running campaign stops after the email in hand (within seconds).', permission: 'marketing.send', limit: 'write', params, responds: { 200: 'Pausing' } }, controller.pause);
router.post('/campaigns/:id/resume', { summary: 'Resume a paused or failed campaign', description: 'Carries on with the recipients not yet attempted; nobody is written to twice.', permission: 'marketing.send', limit: 'write', params, responds: { 200: 'Queued' } }, controller.resume);
router.post('/campaigns/:id/approve-sample', { summary: 'Approve the sample emails of an AI-written campaign', description: 'An AI_PER_USER campaign writes five emails first and waits. Approving lets it write and send the rest.', permission: 'marketing.send', limit: 'write', params, responds: { 200: 'Queued', 409: 'Not waiting for a sample' } }, controller.approveSample);
router.post('/campaigns/:id/cancel', { summary: 'Cancel a campaign', description: 'Emails already sent stay sent. A running campaign stops after the email in hand.', permission: 'marketing.send', limit: 'write', params, responds: { 200: 'Cancelling or cancelled' } }, controller.cancel);

export default router;
