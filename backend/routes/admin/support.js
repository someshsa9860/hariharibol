import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/support.js';
import { CATEGORIES } from '../../services/support.js';

const router = createRouter({
  tag: 'Admin · Support',
  prefix: '/support',
  description:
    'Tickets and quick feedback from readers. Replying pushes the reader; permission `support.manage`, ' +
    'held by admin and super_admin.',
});

router.get(
  '/summary',
  {
    summary: 'Support counts',
    description: 'Open, in progress and resolved tickets, feedback count and the average star rating.',
    permission: 'support.manage',
    limit: 'read',
    responds: { 200: 'The counts' },
  },
  controller.summary
);

router.get(
  '/tickets',
  {
    summary: 'List tickets and feedback',
    description: 'Newest activity first. Filter by status, kind, category, or `maxRating` for unhappy feedback; `q` searches subject, message and sender.',
    permission: 'support.manage',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']).optional(),
      kind: z.enum(['TICKET', 'FEEDBACK']).optional(),
      category: z.enum(CATEGORIES).optional(),
      maxRating: z.coerce.number().int().min(1).max(5).optional(),
    }),
    responds: { 200: 'A page of tickets' },
  },
  controller.list
);

router.get(
  '/tickets/:id',
  {
    summary: 'Read a ticket',
    description: 'Who sent it, the device details, the screenshot and the whole conversation.',
    permission: 'support.manage',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The ticket', 404: 'No such ticket' },
  },
  controller.get
);

router.post(
  '/tickets/:id/messages',
  {
    summary: 'Reply to a reader',
    description: 'Saves the reply, moves an open ticket to in progress and pushes the reader.',
    permission: 'support.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({ body: z.string().trim().min(1).max(4000) }),
    responds: { 201: 'The message', 404: 'No such ticket' },
  },
  controller.reply
);

router.patch(
  '/tickets/:id',
  {
    summary: 'Change status or assignee',
    description: 'Status is open, in progress or resolved; resolving stamps the time.',
    permission: 'support.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED']), assigneeId: z.string().nullable() }).partial(),
    responds: { 200: 'The ticket', 404: 'No such ticket' },
  },
  controller.update
);

export default router;
