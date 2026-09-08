// Sign-in for the mobile app. Google and Apple only — there is no password
// anywhere in this system, which is also why there is no password reset, no
// credential stuffing surface, and no email deliverability dependency at the
// front door.
//
// Sign-in and sign-up are one endpoint. The client cannot know which it is
// doing: Apple in particular gives no way to ask "does this person have an
// account?" before the sheet is presented, and splitting them would mean the
// app guessing wrong and showing the wrong screen.

const { prisma } = require('../../config/database');
const logger = require('../../config/logger');
const authService = require('../../services/auth');
const { ok, created } = require('../../utils/respond');
const { badRequest, conflict, notFound } = require('../../utils/errors');
const { ROLES, DEFAULT_ROUND_TARGET, SETTING_KEYS } = require('../../config/constants');
const settings = require('../../services/setting');
const { isValidTimezone } = require('../../utils/date');

// Everything the app needs about the signed-in person, in the shape it gets
// after a refresh too — one parser on the client, not two.
function sessionPayload(user, session) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      authProvider: user.authProvider,
      appLanguage: user.appLanguage,
      mantraLanguage: user.mantraLanguage,
      readingLanguage: user.readingLanguage,
      timezone: user.timezone,
      isPremium: user.isPremium,
      premiumUntil: user.premiumUntil,
      role: user.role?.slug || ROLES.USER,
    },
    tokens: {
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      refreshExpiresAt: session.refreshExpiresAt,
    },
  };
}

// The device row is what push notifications are sent to, so it is attached on
// every sign-in rather than in a separate call the app might skip.
async function linkDevice(userId, req, body) {
  const deviceId = body.deviceId || req.deviceId;
  if (!deviceId) return;

  await prisma.device.upsert({
    where: { deviceId },
    update: {
      userId,
      platform: body.platform || req.platform || 'unknown',
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion || req.appVersion,
      fcmToken: body.fcmToken,
      lastSeenAt: new Date(),
    },
    create: {
      deviceId,
      userId,
      platform: body.platform || req.platform || 'unknown',
      deviceModel: body.deviceModel,
      osVersion: body.osVersion,
      appVersion: body.appVersion || req.appVersion,
      fcmToken: body.fcmToken,
    },
  });
}

/**
 * POST /api/app/auth/social
 * Verifies the provider's id token, finds or creates the account, and returns
 * a session. Guarded by client attestation — see middleware/attestation.js.
 */
exports.social = async (req, res) => {
  const body = req.valid.body;

  const signupOpen = await settings.getBoolean(SETTING_KEYS.SIGNUP_ENABLED, true);
  const identity = await authService.verifyIdentityToken(body.provider, body.idToken);

  let user = await prisma.user.findUnique({
    where: { providerUserId: identity.providerUserId },
    include: { role: true },
  });

  if (user) {
    if (user.isBanned) throw conflict('This account is banned');

    // Google can change a display name or picture; Apple sends neither after
    // the first sign-in, so absent fields never overwrite what we hold.
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        name: identity.name || user.name,
        avatarUrl: identity.avatarUrl || user.avatarUrl,
        email: identity.email || user.email,
        lastActiveAt: new Date(),
      },
      include: { role: true },
    });

    await linkDevice(user.id, req, body);
    const session = await authService.issueSession(user, body.deviceId || req.deviceId);
    return ok(res, sessionPayload(user, session));
  }

  if (!signupOpen) throw conflict('New accounts are closed at the moment');

  const email = identity.email;
  if (!email) throw badRequest('This sign-in did not return an email address');

  // Same email, different provider. Merging silently would let anyone who can
  // create a Google account with someone's Apple relay address walk into their
  // account, so it is refused and explained instead.
  const emailTaken = await prisma.user.findUnique({ where: { email } });
  if (emailTaken) {
    throw conflict(
      `An account already exists for this email. Please sign in with ${emailTaken.authProvider.toLowerCase()}.`
    );
  }

  const role = await prisma.role.findUnique({ where: { slug: ROLES.USER } });
  if (!role) throw notFound('Default role — run the seed');

  const timezone = isValidTimezone(body.timezone) ? body.timezone : undefined;

  user = await prisma.user.create({
    data: {
      email,
      // Apple returns no name in the token; the app forwards what the sheet
      // gave it, and that is the only chance to capture it.
      name: identity.name || body.name || null,
      avatarUrl: identity.avatarUrl,
      authProvider: identity.provider,
      providerUserId: identity.providerUserId,
      roleId: role.id,
      appLanguage: body.appLanguage || 'en',
      mantraLanguage: body.mantraLanguage || 'sa',
      readingLanguage: body.readingLanguage || body.appLanguage || 'en',
      ...(timezone ? { timezone } : {}),
      // Chanting is the reason most people are here — the profile exists from
      // the first minute rather than being created on first use.
      sadhanaProfile: { create: { dailyRoundTarget: DEFAULT_ROUND_TARGET } },
    },
    include: { role: true },
  });

  await linkDevice(user.id, req, body);
  const session = await authService.issueSession(user, body.deviceId || req.deviceId);

  logger.info({ userId: user.id, provider: identity.provider }, 'account created');
  return created(res, sessionPayload(user, session));
};

/**
 * POST /api/app/auth/refresh
 * Spends the refresh token and returns a new pair. The refresh token is valid
 * for a year and is re-issued on every use, so an app in regular use never asks
 * anyone to sign in again.
 */
exports.refresh = async (req, res) => {
  const { refreshToken, deviceId } = req.valid.body;
  const result = await authService.rotateRefreshToken(refreshToken, deviceId || req.deviceId);
  return ok(res, sessionPayload(result.user, result.session));
};

/** POST /api/app/auth/logout — ends this device's session only. */
exports.logout = async (req, res) => {
  const { refreshToken } = req.valid.body;
  await authService.revokeRefreshToken(refreshToken);
  return ok(res, { message: 'Signed out' });
};

/** POST /api/app/auth/logout-all — ends every session, on every device. */
exports.logoutAll = async (req, res) => {
  await authService.revokeAllForUser(req.auth.user.id);
  return ok(res, { message: 'Signed out everywhere' });
};

/**
 * DELETE /api/app/auth/account
 * A real delete, not a flag. Both stores require it to be reachable from inside
 * the app, and the cascades in the schema take the practice history with it.
 */
exports.deleteAccount = async (req, res) => {
  const userId = req.auth.user.id;
  await prisma.user.delete({ where: { id: userId } });
  await authService.invalidateUser(userId);
  logger.info({ userId }, 'account deleted by user');
  return ok(res, { message: 'Account deleted' });
};
