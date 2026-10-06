import { createRouter, z } from '../../utils/router.js';
import attestation from '../../middleware/attestation.js';
import * as controller from '../../controllers/app/auth.js';

const router = createRouter({
  tag: 'Auth',
  prefix: '/auth',
  description: 'Sign-in, token rotation and account removal for the mobile app.',
});

const deviceFields = {
  deviceId: z.string().min(1).max(200).optional(),
  platform: z.enum(['ios', 'android', 'web']).optional(),
  deviceModel: z.string().max(100).optional(),
  osVersion: z.string().max(50).optional(),
  appVersion: z.string().max(50).optional(),
  fcmToken: z.string().max(500).optional(),
};

router.post(
  '/social',
  {
    summary: 'Sign in with Google or Apple',
    description:
      'Verifies the provider id token and returns a session, creating the account if this is ' +
      'the first time. There is no separate sign-up call — the client cannot tell the two ' +
      'apart before the sheet is shown. Requires a client attestation token: accounts cannot ' +
      'be created by calling the API directly.',
    public: true,
    limit: 'signup',
    middleware: attestation,
    body: z.object({
      provider: z.enum(['GOOGLE', 'APPLE']),
      idToken: z.string().min(20),
      // Apple sends the display name to the client only, only on the very first
      // sign-in. If the app does not forward it here it is gone for good.
      name: z.string().max(100).optional(),
      appLanguage: z.string().max(10).optional(),
      mantraLanguage: z.string().max(10).optional(),
      readingLanguage: z.string().max(10).optional(),
      timezone: z.string().max(64).optional(),
      ...deviceFields,
    }),
    responds: {
      200: 'Existing account signed in',
      201: 'New account created',
      409: 'Email already registered with the other provider, or account banned',
    },
  },
  controller.social
);

router.post(
  '/refresh',
  {
    summary: 'Exchange a refresh token for a new pair',
    description:
      'Rotates the refresh token: the one presented is spent and a fresh one is returned, ' +
      'valid for another year. Presenting a token that was already spent is treated as theft ' +
      'and revokes every session for that account.',
    public: true,
    limit: 'auth',
    body: z.object({
      refreshToken: z.string().min(20),
      deviceId: z.string().max(200).optional(),
    }),
    responds: { 200: 'New access and refresh tokens', 401: 'Expired, revoked or replayed' },
  },
  controller.refresh
);

router.post(
  '/logout',
  {
    summary: 'Sign out on this device',
    description: 'Revokes the refresh token supplied. Other devices stay signed in.',
    limit: 'auth',
    body: z.object({ refreshToken: z.string().min(20) }),
    responds: { 200: 'Signed out' },
  },
  controller.logout
);

router.post(
  '/logout-all',
  {
    summary: 'Sign out everywhere',
    description: 'Revokes every refresh token for the account, on every device.',
    limit: 'auth',
    responds: { 200: 'Signed out everywhere' },
  },
  controller.logoutAll
);

router.delete(
  '/account',
  {
    summary: 'Delete the account',
    description:
      'Permanently deletes the account and everything attached to it — practice history, ' +
      'favourites, notifications. Not reversible. Both app stores require this to be ' +
      'reachable from inside the app.',
    limit: 'write',
    responds: { 200: 'Account deleted' },
  },
  controller.deleteAccount
);

export default router;
