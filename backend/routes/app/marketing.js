import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/marketing.js';

const router = createRouter({
  tag: 'Marketing',
  prefix: '/marketing',
  description: 'A reader’s own choices about hearing from HariHariBol by email, and the app reporting that a marketing link opened it.',
});

router.get('/preferences', { summary: 'My marketing choices', limit: 'read', responds: { 200: '{ emailEnabled, whatsapp }' } }, controller.preferences);
router.patch('/preferences', { summary: 'Switch marketing email on or off', description: 'On by default. Off is immediate and also holds for a later account with the same address.', limit: 'write', body: z.object({ emailEnabled: z.boolean().optional() }), responds: { 200: 'The choices now' } }, controller.setPreferences);
router.post('/open', { summary: 'The app was opened from a tracked link', limit: 'write', body: z.object({ code: z.string().min(8).max(16), n: z.number().int().min(0).max(20) }), responds: { 200: 'Where the link was meant to go' } }, controller.openedFromLink);
router.post('/install', { summary: 'The Play install referrer', limit: 'write', body: z.object({ referrer: z.string().max(500) }), responds: { 200: 'Recorded or not' } }, controller.installReferrer);

export default router;
