import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/web/marketing.js';

const router = createRouter({
  tag: 'Website marketing',
  prefix: '/marketing',
  description:
    'What a tap on a marketing email does. Anonymous: the opaque delivery code in the link is the only credential. ' +
    'Unsubscribe is immediate (the one-click POST that mail programs call, and the website’s page); a tracked link is recorded and redirected by the website’s /l route; ' +
    'the picture at the foot of an email counts an (approximate) open.',
});

const code = z.string().regex(/^[1-9A-HJ-NP-Za-km-z]{8,16}$/);

router.get('/unsubscribe/:code', { summary: 'Who an unsubscribe link is for', public: true, limit: 'read', params: z.object({ code }), responds: { 200: '{ channel, address (masked), unsubscribed }', 404: 'No such link' } }, controller.unsubscribeInfo);
router.post('/unsubscribe/:code', { summary: 'Unsubscribe (one click)', description: 'This is the URL in the List-Unsubscribe header. Honoured immediately; calling it twice is harmless.', public: true, limit: 'write', params: z.object({ code }), responds: { 200: '{ unsubscribed }', 404: 'No such link' } }, controller.unsubscribe);
router.post('/resubscribe/:code', { summary: 'Take an unsubscribe back', description: 'Only an unsubscribe is undone; an address that bounced or complained stays blocked.', public: true, limit: 'write', params: z.object({ code }), responds: { 200: '{ subscribed }', 404: 'No such link' } }, controller.resubscribe);
router.get(
  '/click/:code/:n',
  {
    summary: 'Record a tap on a tracked link and say where it goes',
    description:
      'Called by the website’s /l/<code>/<n> route with the visitor’s User-Agent in `X-Client-User-Agent`. A scanner or previewer is recorded but not counted. ' +
      'No rate limit of its own: every visitor reaches it through the website’s server, so a per-address limit would throttle everyone together.',
    public: true,
    params: z.object({ code, n: z.coerce.number().int().min(0).max(20) }),
    responds: { 200: '{ kind, url, appUri, webUrl, getAppUrl }', 404: 'No such link' },
  },
  controller.click
);
router.get('/open/:code', { summary: 'The tracking picture', description: 'A 1×1 GIF. Records the first open of a message; mail privacy features open messages by themselves, so opens are approximate.', public: true, params: z.object({ code: z.string().min(4).max(20) }), responds: { 200: 'image/gif' } }, controller.open);

export default router;
