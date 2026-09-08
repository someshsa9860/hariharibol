const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/admin/user');

const router = createRouter({
  tag: 'Admin · Devices',
  prefix: '/devices',
  description:
    'Blocking an installation rather than an account. Someone whose account is banned can ' +
    'sign up again in a minute; the device is the part that does not change.',
});

router.post(
  '/:deviceId/ban',
  {
    summary: 'Ban a device',
    permission: 'user.ban',
    limit: 'write',
    params: z.object({ deviceId: z.string().min(1).max(200) }),
    body: z.object({ reason: z.string().trim().min(3).max(1000) }),
    responds: { 200: 'The banned device', 404: 'No such device' },
  },
  controller.banDevice
);

module.exports = router;
