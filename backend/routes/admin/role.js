const { createRouter, z, schemas } = require('../../utils/router');
const controller = require('../../controllers/admin/role');

const router = createRouter({
  tag: 'Admin · Roles',
  prefix: '/roles',
  description:
    'Roles and their permissions. Four are seeded as system roles and cannot be deleted. ' +
    'Permissions are code, not data — the panel assigns them, it cannot invent them.',
});

router.get(
  '/',
  {
    summary: 'List roles',
    description: 'Each with its permissions and how many accounts hold it.',
    permission: 'role.manage',
    limit: 'read',
    responds: { 200: 'Roles' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Create a role',
    permission: 'role.manage',
    limit: 'write',
    body: z.object({
      slug: z.string().regex(/^[a-z][a-z0-9_]*$/, 'lowercase, digits and underscores').max(50),
      name: z.string().min(1).max(100),
      description: z.string().max(500).optional(),
      permissions: z.array(z.string()).optional(),
    }),
    responds: { 201: 'The role', 400: 'Unknown permission slug', 409: 'Slug already used' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Update a role',
    description:
      'The permission list replaces the existing set outright rather than being merged — a ' +
      'checkbox list is what the panel sends, and applying it whole is the only way an ' +
      'unchecked box actually removes anything. Everyone holding the role has their cached ' +
      'permissions cleared.',
    permission: 'role.manage',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      name: z.string().min(1).max(100).optional(),
      description: z.string().max(500).optional(),
      permissions: z.array(z.string()).optional(),
    }),
    responds: { 200: 'The role', 400: 'Unknown permission slug', 404: 'No such role' },
  },
  controller.update
);

router.delete(
  '/:id',
  {
    summary: 'Delete a role',
    description: 'Refused for system roles, and for any role that accounts still hold.',
    permission: 'role.manage',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 400: 'System role, or still in use' },
  },
  controller.remove
);

module.exports = router;
