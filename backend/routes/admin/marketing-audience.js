import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/admin/marketing-audience.js';

const router = createRouter({
  tag: 'Admin · Marketing audiences',
  prefix: '/marketing',
  description:
    'Who marketing can reach: saved segments of readers (a filter), lists of invitees imported from a CSV with an attestation of consent, ' +
    'the suppression list (only a keyed hash of each address is kept) and the consent log.',
});

const idParams = z.object({ id: z.string().min(1) });
const filter = z.record(z.string(), z.any());
const row = z.object({ email: z.string().max(300).optional().nullable(), phone: z.string().max(40).optional().nullable(), name: z.string().max(200).optional().nullable(), language: z.string().max(10).optional().nullable() });

router.get('/segments', { summary: 'List segments', permission: 'marketing.read', limit: 'read', responds: { 200: 'Segments with their last count' } }, controller.listSegments);
router.post('/segments', { summary: 'Save a segment', permission: 'marketing.manage', limit: 'write', body: z.object({ name: z.string().trim().min(1).max(120), filter }), responds: { 201: 'The segment', 422: 'The filter does not hold' } }, controller.createSegment);
router.post(
  '/segments/preview',
  { summary: 'Count a filter and sample readers who match', description: 'Nothing is saved. Samples show masked addresses. Banned accounts, stand-in addresses and readers who switched marketing off are never counted.', permission: 'marketing.read', limit: 'read', body: z.object({ filter, channel: z.enum(['EMAIL', 'WHATSAPP']).optional() }), responds: { 200: 'count, summary, sample', 422: 'The filter does not hold' } },
  controller.previewSegment
);
router.patch('/segments/:id', { summary: 'Rename or change a segment', description: 'A campaign made from it earlier keeps the filter it was made with.', permission: 'marketing.manage', limit: 'write', params: idParams, body: z.object({ name: z.string().trim().min(1).max(120).optional(), filter: filter.optional() }), responds: { 200: 'The segment' } }, controller.updateSegment);
router.delete('/segments/:id', { summary: 'Delete a segment', permission: 'marketing.manage', limit: 'write', params: idParams, responds: { 200: 'Deleted' } }, controller.removeSegment);

router.get('/lists', { summary: 'List the lists of invitees', permission: 'marketing.read', limit: 'read', responds: { 200: 'Lists with their sizes' } }, controller.listLists);
router.post('/lists', { summary: 'Make a list', permission: 'marketing.manage', limit: 'write', body: z.object({ name: z.string().trim().min(1).max(120), description: z.string().trim().max(400).nullable().optional() }), responds: { 201: 'The list' } }, controller.createList);
router.patch('/lists/:id', { summary: 'Rename a list', permission: 'marketing.manage', limit: 'write', params: idParams, body: z.object({ name: z.string().trim().min(1).max(120).optional(), description: z.string().trim().max(400).nullable().optional() }), responds: { 200: 'The list' } }, controller.updateList);
router.delete('/lists/:id', { summary: 'Delete a list', description: 'The contacts stay; only the list goes.', permission: 'marketing.manage', limit: 'write', params: idParams, responds: { 200: 'Deleted' } }, controller.removeList);
router.delete('/lists/:id/contacts/:contactId', { summary: 'Take a contact off a list', permission: 'marketing.manage', limit: 'write', params: z.object({ id: z.string().min(1), contactId: z.string().min(1) }), responds: { 200: 'Removed' } }, controller.removeFromList);

router.get('/contacts', { summary: 'List invitees', permission: 'marketing.read', limit: 'read', query: schemas.page.extend({ listId: z.string().optional() }), responds: { 200: 'A page of contacts' } }, controller.listContacts);
router.delete('/contacts/:id', { summary: 'Forget an invitee', description: 'Deletes the contact and blocks the address (by hash only), so a later import cannot bring them back.', permission: 'marketing.manage', limit: 'write', params: idParams, responds: { 200: 'Forgotten' } }, controller.removeContact);
router.post(
  '/contacts/import/check',
  { summary: 'Check a chunk of CSV rows', description: 'At most 500 rows. Counts how many are new, already contacts, invalid, duplicates, already readers or suppressed. Nothing is written.', permission: 'marketing.manage', limit: 'write', body: z.object({ rows: z.array(row).min(1).max(500), attestsEmail: z.boolean().optional(), attestsWhatsApp: z.boolean().optional() }), responds: { 200: 'Counts' } },
  controller.checkImport
);
router.post(
  '/contacts/import',
  {
    summary: 'Import a chunk of CSV rows into a list',
    description:
      'At most 500 rows a call. The first call carries the attestation (who confirmed these people agreed to hear from us, and by which channel) and returns an `importId`; send it with the next chunks so one file is one import. ' +
      'A phone gets a WhatsApp opt-in only if WhatsApp was attested. Addresses of readers and suppressed addresses are skipped.',
    permission: 'marketing.manage',
    limit: 'write',
    body: z.object({
      listId: z.string().min(1), rows: z.array(row).min(1).max(500), importId: z.string().optional(), fileName: z.string().max(200).optional(),
      attestation: z.string().trim().min(10).max(2000), attestsEmail: z.boolean().optional(), attestsWhatsApp: z.boolean().optional(),
    }),
    responds: { 200: 'Counts for this chunk and totals for the import', 400: 'No attestation', 404: 'No such list' },
  },
  controller.importContacts
);

router.get('/suppression', { summary: 'The suppression list', description: 'Only hashes are kept, so it cannot be searched by text: pass `q` as an address to look it up. Without `q` it lists the newest.', permission: 'marketing.read', limit: 'read', query: schemas.page.extend({ channel: z.enum(['EMAIL', 'WHATSAPP']).optional(), reason: z.enum(['UNSUBSCRIBE', 'HARD_BOUNCE', 'COMPLAINT', 'WHATSAPP_STOP', 'MANUAL']).optional() }), responds: { 200: 'A page of entries' } }, controller.listSuppression);
router.post('/suppression', { summary: 'Block an address', permission: 'marketing.manage', limit: 'write', body: z.object({ email: z.string().max(300).optional(), phone: z.string().max(40).optional(), note: z.string().trim().max(200).optional() }), responds: { 201: 'Blocked', 409: 'Already blocked' } }, controller.addSuppression);
router.post('/suppression/remove', { summary: 'Let an address be written to again', description: 'Logged in the consent log. Do this only when the person asked.', permission: 'marketing.manage', limit: 'write', body: z.object({ email: z.string().max(300).optional(), phone: z.string().max(40).optional() }), responds: { 200: 'Removed', 404: 'Not on the list' } }, controller.removeSuppression);
router.get('/consent', { summary: 'The consent log of one address', permission: 'marketing.read', limit: 'read', query: z.object({ email: z.string().min(3).max(300) }), responds: { 200: 'Whether found and suppressed, and the log' } }, controller.consentLog);

export default router;
