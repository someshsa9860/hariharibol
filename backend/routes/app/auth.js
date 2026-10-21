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
  '/legacy',
  {
    summary: 'Sign in with the sign-in the old app kept',
    description:
      'For people who used the app before this system existed. Trades the access token the old app saved for a session ' +
      'here: the old server is asked who the token belongs to, the account is made the first time and found by its old ' +
      'user id after that, and the answer is the one /auth/social gives (201 for a new account, 200 for one already ' +
      'carried over). The token is never stored. The client acts on how it fails: 403 UNAUTHENTICATED (the old server ' +
      'does not accept the token) and 409 (this account cannot be had this way) mean the token is of no further use and ' +
      'is deleted; 403 FORBIDDEN (client attestation), 429 and every 5xx — including 503 LEGACY_UNAVAILABLE, when the ' +
      'old server cannot be asked right now or new accounts are closed — keep it for the next launch. Requires a client ' +
      'attestation token: accounts cannot be created by calling the API directly.',
    public: true,
    limit: 'signup',
    middleware: attestation,
    body: z.object({
      legacyToken: z.string().min(10).max(300),
      appLanguage: z.string().max(10).optional(),
      mantraLanguage: z.string().max(10).optional(),
      readingLanguage: z.string().max(10).optional(),
      timezone: z.string().max(64).optional(),
      ...deviceFields,
    }),
    responds: {
      200: 'Already carried over; signed in',
      201: 'New account made from the old one',
      403: 'The old server does not accept the token (UNAUTHENTICATED), or the client could not be attested (FORBIDDEN)',
      409: 'An account here has this email, it now signs in with Google or Apple, or it is banned',
      503: 'The old server cannot be asked right now, or new accounts are closed — try again later',
    },
  },
  controller.legacy
);

router.post(
  '/refresh',
  {
    summary: 'Exchange a refresh token for a new pair',
    description:
      'Rotates the refresh token: the one presented is spent and a fresh one is returned, ' +
      'valid for another year. Presenting a token that was already spent is treated as theft ' +
      'and revokes every session for that account — unless it was spent only a few seconds ' +
      'ago (REFRESH_REUSE_GRACE_SECONDS), which is a lost response and gets a new pair. ' +
      '403 means the session is over and the person must sign in; any other failure is ' +
      'temporary and the same token should be sent again later.',
    public: true,
    limit: 'auth',
    body: z.object({
      refreshToken: z.string().min(20),
      deviceId: z.string().max(200).optional(),
    }),
    responds: { 200: 'New access and refresh tokens', 403: 'Expired, revoked or replayed — sign in again' },
  },
  controller.refresh
);

router.post(
  '/logout',
  {
    summary: 'Sign out on this device',
    description:
      'Revokes the refresh token supplied. Other devices stay signed in. Public on purpose: ' +
      'the refresh token in the body is the credential, so signing out works even when the ' +
      'access token has already expired.',
    public: true,
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
