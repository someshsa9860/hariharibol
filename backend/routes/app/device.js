const { createRouter, z } = require('../../utils/router');
const attestation = require('../../middleware/attestation');
const controller = require('../../controllers/app/device');

const router = createRouter({
  tag: 'Devices',
  prefix: '/devices',
  description: 'Push registration and broadcast topic membership for one installation.',
});

router.post(
  '/',
  {
    summary: 'Register this device',
    description:
      'Called on launch and whenever the FCM token rotates. Public on purpose: a device ' +
      'registers before anyone signs in, which is how a fresh install can still receive the ' +
      'sloka of the day. Attested, so the device table cannot be filled from outside.',
    public: true,
    limit: 'write',
    middleware: attestation,
    body: z.object({
      deviceId: z.string().min(1).max(200),
      platform: z.enum(['ios', 'android', 'web']).optional(),
      deviceModel: z.string().max(100).optional(),
      osVersion: z.string().max(50).optional(),
      appVersion: z.string().max(50).optional(),
      fcmToken: z.string().max(500).optional(),
    }),
    responds: { 200: 'The device record' },
  },
  controller.register
);

router.patch(
  '/fcm-token',
  {
    summary: 'Update the push token',
    description: 'The OS rotates FCM tokens on its own schedule; this keeps ours current.',
    public: true,
    limit: 'write',
    middleware: attestation,
    body: z.object({
      deviceId: z.string().max(200).optional(),
      fcmToken: z.string().min(10).max(500),
    }),
    responds: { 200: 'Updated', 404: 'Device is not registered' },
  },
  controller.updateToken
);

router.get(
  '/topics',
  {
    summary: 'List broadcast topics',
    description:
      'Every active topic, and whether this device is on it. Topics are how anything going ' +
      'to everyone is sent — one call to Firebase rather than a loop over users.',
    public: true,
    query: z.object({ deviceId: z.string().max(200).optional() }),
    responds: { 200: 'Topics with subscription state' },
  },
  controller.topics
);

router.post(
  '/topics/:key',
  {
    summary: 'Subscribe this device to a topic',
    public: true,
    limit: 'write',
    middleware: attestation,
    params: z.object({ key: z.string().min(1).max(100) }),
    body: z.object({ deviceId: z.string().max(200).optional() }),
    responds: { 200: 'Subscribed', 404: 'Device is not registered' },
  },
  controller.subscribe
);

router.delete(
  '/topics/:key',
  {
    summary: 'Unsubscribe this device from a topic',
    public: true,
    limit: 'write',
    params: z.object({ key: z.string().min(1).max(100) }),
    query: z.object({ deviceId: z.string().max(200).optional() }),
    responds: { 200: 'Unsubscribed', 404: 'Device is not registered' },
  },
  controller.unsubscribe
);

module.exports = router;
