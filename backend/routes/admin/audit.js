const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/admin/audit');

const router = createRouter({
  tag: 'Admin · Audit',
  prefix: '/audit',
  description:
    'Who changed what. Roles say who *could* have done something; this says who did. Only ' +
    'the fields that actually changed are stored — a table of full snapshots grows faster ' +
    'than the data it describes.',
});

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

// '/actions' and '/entity/...' come before any '/:id'-shaped route.

router.get(
  '/actions',
  {
    summary: 'List the action names in use',
    description: 'With counts, for the filter dropdown.',
    permission: 'audit.read',
    limit: 'read',
    responds: { 200: 'Action names and counts' },
  },
  controller.actions
);

router.get(
  '/entity/:entityType/:entityId',
  {
    summary: 'Get the history of one record',
    description: 'Everything that has happened to a book, a user or a plan, oldest first.',
    permission: 'audit.read',
    limit: 'read',
    params: z.object({ entityType: z.string().max(50), entityId: z.string().max(100) }),
    responds: { 200: 'Audit entries' },
  },
  controller.forEntity
);

router.get(
  '/',
  {
    summary: 'Search the audit log',
    description: '`action` matches by prefix, so "book." finds every book action.',
    permission: 'audit.read',
    limit: 'read',
    query: schemas.page.extend({
      actorId: z.string().optional(),
      action: z.string().max(100).optional(),
      entityType: z.string().max(50).optional(),
      entityId: z.string().max(100).optional(),
      from: dateString.optional(),
      to: dateString.optional(),
    }),
    responds: { 200: 'A page of audit entries' },
  },
  controller.list
);

module.exports = router;
