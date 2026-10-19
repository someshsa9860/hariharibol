// Sign-in for the mobile app. Google and Apple only — there is no password
// anywhere in this system, which is also why there is no password reset, no
// credential stuffing surface, and no email deliverability dependency at the
// front door.
//
// Sign-in and sign-up are one endpoint. The client cannot know which it is
// doing: Apple in particular gives no way to ask "does this person have an
// account?" before the sheet is presented, and splitting them would mean the
// app guessing wrong and showing the wrong screen.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as authService from '../../services/auth.js';
import * as chatImages from '../../services/chat-images.js';
import { ok, created } from '../../utils/respond.js';
import { badRequest, conflict, notFound } from '../../utils/errors.js';
import { ROLES, DEFAULT_ROUND_TARGET, SETTING_KEYS } from '../../config/constants.js';
import * as settings from '../../services/setting.js';
import * as legacyServer from '../../services/legacy.js';
import env from '../../config/env.js';
import { pickLegacyFavourite } from '../../utils/legacy-mantra.js';
import { isValidTimezone } from '../../utils/date.js';

// What providerUserId holds for an account carried over from the old server that has not signed in with a provider here.
const LEGACY_PROVIDER_PREFIX = 'legacy:';

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
      sampradaya: user.sampradaya,
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
export const social = async (req, res) => {
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
  const emailTaken = await prisma.user.findUnique({ where: { email }, include: { role: true } });

  // An account carried over from the old server has no provider id of its own yet (`legacy:<id>`). The first time
  // its owner signs in with Google or Apple here is that id arriving: the verified email is the same one the old
  // server vouched for, so this is the same person and the account is theirs, not a second one.
  if (emailTaken?.providerUserId.startsWith(LEGACY_PROVIDER_PREFIX)) {
    if (emailTaken.isBanned) throw conflict('This account is banned');
    user = await prisma.user.update({
      where: { id: emailTaken.id },
      data: {
        authProvider: identity.provider,
        providerUserId: identity.providerUserId,
        name: identity.name || emailTaken.name,
        avatarUrl: identity.avatarUrl || emailTaken.avatarUrl,
        lastActiveAt: new Date(),
      },
      include: { role: true },
    });
    await linkDevice(user.id, req, body);
    const session = await authService.issueSession(user, body.deviceId || req.deviceId);
    return ok(res, sessionPayload(user, session));
  }

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
 * anyone to sign in again. A token spent within REFRESH_REUSE_GRACE_SECONDS is
 * answered with a fresh pair (a lost response), not treated as theft. A 403
 * here is the one answer that ends a session; the apps keep the person signed
 * in through every other failure.
 */
export const refresh = async (req, res) => {
  const { refreshToken, deviceId } = req.valid.body;
  const result = await authService.rotateRefreshToken(refreshToken, deviceId || req.deviceId);
  return ok(res, sessionPayload(result.user, result.session));
};

/** POST /api/app/auth/logout — ends this device's session only. */
export const logout = async (req, res) => {
  const { refreshToken } = req.valid.body;
  await authService.revokeRefreshToken(refreshToken);
  return ok(res, { message: 'Signed out' });
};

/** POST /api/app/auth/logout-all — ends every session, on every device. */
export const logoutAll = async (req, res) => {
  await authService.revokeAllForUser(req.auth.user.id);
  return ok(res, { message: 'Signed out everywhere' });
};

/**
 * DELETE /api/app/auth/account
 * A real delete, not a flag. Both stores require it to be reachable from inside
 * the app, and the cascades in the schema take the practice history with it.
 */
export const deleteAccount = async (req, res) => {
  const userId = req.auth.user.id;
  const pictures = await chatImages.keysWhere({ conversation: { userId } });
  await prisma.user.delete({ where: { id: userId } });
  await chatImages.deleteFiles(pictures);
  await authService.invalidateUser(userId);
  logger.info({ userId }, 'account deleted by user');
  return ok(res, { message: 'Account deleted' });
};

// The published mantras an old mantra name can be matched against, with the names they go by in other languages.
async function mantrasToMatch() {
  const rows = await prisma.mantra.findMany({
    where: { isPublished: true },
    select: { id: true, name: true, slug: true, transliteration: true, translations: { select: { name: true } } },
  });
  return rows.map((m) => ({
    id: m.id,
    name: m.name,
    slug: m.slug,
    transliteration: m.transliteration,
    names: m.translations.map((t) => t.name).filter(Boolean),
  }));
}

// The mantra they chanted most there becomes the stand-in favourite here (see favouriteMantra in sadhana.js). Set
// once: a later call never moves it, because by then what they chant here is the better answer.
async function carryFavouriteMantra(userId, entries) {
  if (!entries.length) return;
  const profile = await prisma.sadhanaProfile.findUnique({ where: { userId } });
  if (profile?.legacyFavoriteMantraId) return;

  const mantraId = pickLegacyFavourite(entries, await mantrasToMatch());
  if (!mantraId) return;

  await prisma.sadhanaProfile.upsert({
    where: { userId },
    update: { legacyFavoriteMantraId: mantraId },
    create: { userId, dailyRoundTarget: DEFAULT_ROUND_TARGET, legacyFavoriteMantraId: mantraId },
  });
}

/**
 * POST /api/app/auth/legacy
 * Someone who used the old app and is now on this one is signed in without asking them to sign in again: the
 * old server's token is checked with the old server itself (services/legacy.js), the account is found or made
 * here, and a session of this server's own is returned in the same shape as /auth/social.
 *
 * Found by, in order: the old id on a previous carry-over, the provider's id (so the person who already signed in
 * here with the same Google account is the same account), then the email. Sign-up being closed does not apply — these
 * people already have an account.
 */
export const legacy = async (req, res) => {
  if (!env.legacyEnabled) throw notFound('Route');
  const body = req.valid.body;

  const old = await legacyServer.fetchAccount(body.legacyToken);

  let user = await prisma.user.findUnique({ where: { legacyUserId: old.id }, include: { role: true } });
  let isNew = false;

  if (!user && old.providerUserId) {
    user = await prisma.user.findUnique({ where: { providerUserId: old.providerUserId }, include: { role: true } });
  }
  if (!user && old.email) {
    user = await prisma.user.findUnique({ where: { email: old.email }, include: { role: true } });
  }

  if (user) {
    if (user.isBanned) throw conflict('This account is banned');
    // One old account is one new one. A different old id on an account already linked is somebody else's.
    if (user.legacyUserId && user.legacyUserId !== old.id) {
      throw conflict('This account is already linked to another previous account');
    }
    user = await prisma.user.update({
      where: { id: user.id },
      data: {
        legacyUserId: old.id,
        name: user.name || old.name,
        avatarUrl: user.avatarUrl || old.avatarUrl,
        lastActiveAt: new Date(),
      },
      include: { role: true },
    });
  } else {
    const role = await prisma.role.findUnique({ where: { slug: ROLES.USER } });
    if (!role) throw notFound('Default role — run the seed');

    const timezone = isValidTimezone(body.timezone) ? body.timezone : undefined;
    user = await prisma.user.create({
      data: {
        // The email is required and unique. An old account that never had one gets an address that cannot receive
        // mail and cannot collide; the account is still theirs by its legacy id.
        email: old.email || `legacy-${old.id}@legacy.hariharibol.invalid`,
        name: old.name || body.name || null,
        avatarUrl: old.avatarUrl,
        authProvider: old.provider,
        providerUserId: old.providerUserId || `${LEGACY_PROVIDER_PREFIX}${old.id}`,
        legacyUserId: old.id,
        roleId: role.id,
        appLanguage: body.appLanguage || 'en',
        mantraLanguage: body.mantraLanguage || 'sa',
        readingLanguage: body.readingLanguage || body.appLanguage || 'en',
        ...(timezone ? { timezone } : {}),
        sadhanaProfile: { create: { dailyRoundTarget: DEFAULT_ROUND_TARGET } },
      },
      include: { role: true },
    });
    isNew = true;
  }

  // The favourite is a nicety: failing to work it out must not stop anyone being signed in.
  await carryFavouriteMantra(user.id, old.mantras).catch((err) =>
    logger.warn({ err: err.message, userId: user.id }, 'could not carry the favourite mantra over')
  );

  await linkDevice(user.id, req, body);
  const session = await authService.issueSession(user, body.deviceId || req.deviceId);

  logger.info({ userId: user.id, legacyUserId: old.id, isNew }, 'account carried over from the old server');
  return (isNew ? created : ok)(res, sessionPayload(user, session));
};
