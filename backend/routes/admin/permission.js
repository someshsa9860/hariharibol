const { createRouter } = require('../../utils/router');
const controller = require('../../controllers/admin/role');

const router = createRouter({
  tag: 'Admin · Permissions',
  prefix: '/permissions',
  description: 'The permission catalogue, grouped the way the role editor lays it out.',
});

router.get(
  '/',
  {
    summary: 'List all permissions',
    description:
      'Grouped by content, users and system. Read-only: permissions are the strings the ' +
      'routes check, so one that is not in config/constants.js would guard nothing.',
    permission: 'role.manage',
    limit: 'read',
    responds: { 200: 'Permissions grouped for the UI' },
  },
  controller.permissions
);

module.exports = router;
