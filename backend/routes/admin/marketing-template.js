import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/marketing-template.js';

const router = createRouter({
  tag: 'Admin · Marketing templates',
  prefix: '/marketing',
  description:
    'Email templates: one variant per language, each a subject, a preheader and a list of blocks (heading, paragraph, verse, button, image, divider, spacer; ' +
    'merge fields like `{{firstName|friend}}`). Only APPROVED variants are sent; a reader whose language has none gets English. ' +
    'A variant can be drafted or translated by a model the admin picks; one a person wrote is not replaced unless `force`.',
});

const idParams = z.object({ id: z.string().min(1) });
const variantParams = z.object({ id: z.string().min(1), language: z.string().regex(/^[a-z]{2,3}$/) });
const provider = z.enum(['anthropic', 'openai', 'gemini']);
const block = z.record(z.string(), z.any());
const words = {
  subject: z.string().max(400),
  preheader: z.string().max(400).nullable().optional(),
  blocks: z.array(block).max(80),
};
const card = z.record(z.string(), z.string().max(200)).optional();

router.get('/templates', { summary: 'List templates', permission: 'marketing.read', limit: 'read', responds: { 200: 'Templates with their variants’ states' } }, controller.list);
router.post('/templates', { summary: 'Make a template', permission: 'marketing.manage', limit: 'write', body: z.object({ name: z.string().trim().min(1).max(120), brief: z.string().trim().max(4000).nullable().optional() }), responds: { 201: 'The template' } }, controller.create);
router.get('/templates/:id', { summary: 'One template with its variants', permission: 'marketing.read', limit: 'read', params: idParams, responds: { 200: 'The template', 404: 'No such template' } }, controller.get);
router.patch('/templates/:id', { summary: 'Rename a template or change its brief', permission: 'marketing.manage', limit: 'write', params: idParams, body: z.object({ name: z.string().trim().min(1).max(120).optional(), brief: z.string().trim().max(4000).nullable().optional() }), responds: { 200: 'The template' } }, controller.update);
router.delete('/templates/:id', { summary: 'Delete a template no campaign used', permission: 'marketing.manage', limit: 'write', params: idParams, responds: { 200: 'Deleted', 409: 'A campaign used it' } }, controller.remove);

router.put(
  '/templates/:id/variants/:language',
  { summary: 'Save a variant by hand', description: 'Checks every block and merge field (422 lists the problems). A saved variant is a draft: approve it again.', permission: 'marketing.manage', limit: 'write', params: variantParams, body: z.object(words), responds: { 200: 'The variant', 422: 'The words do not pass' } },
  controller.saveVariant
);
router.post('/templates/:id/variants/:language/approve', { summary: 'Approve a variant for sending', permission: 'marketing.manage', limit: 'write', params: variantParams, responds: { 200: 'Approved' } }, controller.approveVariant);
router.post('/templates/:id/variants/:language/unapprove', { summary: 'Take a variant back to draft', permission: 'marketing.manage', limit: 'write', params: variantParams, responds: { 200: 'A draft again' } }, controller.unapproveVariant);
router.delete('/templates/:id/variants/:language', { summary: 'Delete a variant', permission: 'marketing.manage', limit: 'write', params: variantParams, responds: { 200: 'Deleted' } }, controller.removeVariant);

router.post(
  '/templates/:id/ai/draft',
  {
    summary: 'Draft a variant from a brief with an AI model',
    description: 'One language per request. 422 for a missing key or a model that cannot run; 409 `editedByHuman` when a person’s words would be replaced (repeat with `force`). The draft is never approved.',
    permission: 'marketing.manage',
    limit: 'ai',
    params: idParams,
    body: z.object({ language: z.string().regex(/^[a-z]{2,3}$/), brief: z.string().trim().max(4000).optional(), tone: z.string().trim().max(120).optional(), provider: provider.optional(), model: z.string().trim().max(100).optional(), force: z.boolean().optional() }),
    responds: { 201: 'The variant and what it cost', 409: 'A person wrote it', 422: 'No key, an unusable model, or an answer that did not pass' },
  },
  controller.draft
);
router.post(
  '/templates/:id/ai/translate',
  {
    summary: 'Translate a variant into another language with an AI model',
    description: 'Keeps the blocks, merge fields and link numbers; only the words change. The panel calls it once per language for “translate to all”.',
    permission: 'marketing.manage',
    limit: 'ai',
    params: idParams,
    body: z.object({ from: z.string().regex(/^[a-z]{2,3}$/), to: z.string().regex(/^[a-z]{2,3}$/), provider: provider.optional(), model: z.string().trim().max(100).optional(), force: z.boolean().optional() }),
    responds: { 201: 'The variant and what it cost', 404: 'No source variant', 409: 'A person wrote the target', 422: 'No key, an unusable model, or an answer that did not pass' },
  },
  controller.translate
);

router.post(
  '/templates/preview',
  { summary: 'Render a variant as the reader will see it', description: 'The words as given (saved or not), with a sample reader’s values or `card`. Returns the email’s HTML and plain text.', permission: 'marketing.read', limit: 'read', body: z.object({ ...words, language: z.string().regex(/^[a-z]{2,3}$/).default('en'), card }), responds: { 200: 'subject, html, text', 422: 'The words do not pass' } },
  controller.preview
);
router.post(
  '/templates/test-send',
  { summary: 'Send a variant to your own address', description: 'Only ever to the signed-in admin’s own email, marked [Test].', permission: 'marketing.send', limit: 'write', body: z.object({ ...words, language: z.string().regex(/^[a-z]{2,3}$/).default('en'), card, templateId: z.string().optional() }), responds: { 200: 'Sent', 422: 'No email server, or the words do not pass' } },
  controller.testSend
);

export default router;
