// Sign-in for the mobile app. Google and Apple only — there is no password
// anywhere in this system, which is also why there is no password reset, no
// credential stuffing surface, and no email deliverability dependency at the
// front door.
//
// Sign-in and sign-up are one endpoint. The client cannot know which it is
// doing: Apple in particular gives no way to ask "does this person have an
// account?" before the sheet is presented, and splitting them would mean the
// app guessing wrong and showing the wrong screen.
//
// The one other way in is for people who used the app before this system
// existed: `legacy` below trades the sign-in the old app kept for a session here.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as authService from '../../services/auth.js';
import * as chatImages from '../../services/chat-images.js';
import * as legacyService from '../../services/legacy.js';
import * as devEvents from '../../services/dev-events.js';
import { ok, created } from '../../utils/respond.js';
import { AppError, badRequest, conflict, notFound } from '../../utils/errors.js';
import { emailForApp, placeholderEmail } from '../../utils/legacy.js';
import { ROLES, DEFAULT_ROUND_TARGET, SETTING_KEYS } from '../../config/constants.js';
import * as settings from '../../services/setting.js';
import { isValidTimezone } from '../../utils/date.js';

// Everything the app needs about the signed-in person, in the shape it gets
// after a refresh too — one parser on the client, not two.
function sessionPayload(user, session) {
  return {
    user: {
      id: user.id,
      // A stand-in address (a person carried over from the old server who had none) is not theirs to be shown.
      email: emailForApp(user.email),
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

// A person carried over from the old server (`legacy` below) who now signs in with Google or Apple for the first
// time. Their address, which the provider has verified, is what makes the account theirs: until now it was only
// somebody holding the old app's token, and the old server hands a token to anyone who gives it an existing email,
// so every session made from one ends here, before the verified one begins.
async function claimLegacy(holder, identity, req, body) {
  if (holder.isBanned) throw conflict('This account is banned');

  await authService.revokeAllForUser(holder.id);

  const user = await prisma.user.update({
    where: { id: holder.id },
    data: {
      authProvider: identity.provider,
      providerUserId: identity.providerUserId,
      name: identity.name || body.name || holder.name,
      avatarUrl: identity.avatarUrl || holder.avatarUrl,
      lastActiveAt: new Date(),
    },
    include: { role: true },
  });
  announceSignup(user, identity.provider);

  await linkDevice(user.id, req, body);
  const session = await authService.issueSession(user, body.deviceId || req.deviceId);

  logger.info({ userId: user.id, provider: identity.provider }, 'account from the old server now signs in with its provider');
  return sessionPayload(user, session);
}

/**
 * POST /api/app/auth/social
 * Verifies the provider's id token, finds or creates the account, and returns
 * a session. Guarded by client attestation — see middleware/attestation.js.
 */
// A new account, for the developer's feed. Queued and non-blocking; the name is not sent, only the provider and
// the email's domain, so the feed (and any push) says who is joining without spreading anyone's address.
function announceSignup(user, provider) {
  devEvents.emit('user.signup', {
    title: 'New sign-up',
    body: `${user.name || 'Someone'} joined with ${String(provider).toLowerCase()} (${String(user.email).split('@')[1] || '?'})`,
    data: { userId: user.id, provider },
  });
}

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

  const email = identity.email;

  let emailTaken = email ? await prisma.user.findUnique({ where: { email }, include: { role: true } }) : null;
  // People carried over from the old server are kept with a lower-case address.
  if (!emailTaken && email && email !== email.toLowerCase()) {
    const carried = await prisma.user.findUnique({ where: { email: email.toLowerCase() }, include: { role: true } });
    if (carried?.authProvider === 'LEGACY') emailTaken = carried;
  }

  // An existing account, not a new one, so it is not held back by closed sign-ups.
  if (emailTaken?.authProvider === 'LEGACY') return ok(res, await claimLegacy(emailTaken, identity, req, body));

  if (!signupOpen) throw conflict('New accounts are closed at the moment');

  if (!email) throw badRequest('This sign-in did not return an email address');

  // Same email, different provider. Merging silently would let anyone who can
  // create a Google account with someone's Apple relay address walk into their
  // account, so it is refused and explained instead.
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

// Everyone here with this address, however it was cased when they signed up. The old server's addresses reach us in
// lower case (`usableEmail`), but a Google or Apple sign-in stores the address as the provider sent it and the
// database counts `Anna@x.com` and `anna@x.com` as two people, so asking for the exact address would miss an
// account that is theirs and make a second one.
async function accountsWithEmail(email) {
  const rows = await prisma.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    select: { id: true, email: true, authProvider: true, legacyUserId: true },
    take: 50,
  });
  // Insensitive matching may read `_` and `%` as wildcards; only an address that matches letter for letter counts.
  return rows.filter((row) => row.email.toLowerCase() === email);
}

// The person already has an account here, made with Google or Apple before they updated the old app or on another
// phone. The old token cannot open it: the old server gives a token to anyone who names an existing address, so a
// token does not show who holds the address. What can be done is to record which old user this account is, and
// which mantra they chanted most there, so that it already knows them when they sign in the usual way — which is
// what the app does next, on the 409. Written favourite first, link last: the link is what stops this running
// again, so a failure in between is tried again on the next launch rather than lost.
async function linkOldIdentity(holder, old) {
  // Linked already, to this old user or (oddly) another: left as it is.
  if (holder.legacyUserId !== null) return;

  const favouriteId = await legacyService.favouriteFor(old.mantras);
  if (favouriteId) {
    // Only where they have none. A favourite already there wins, and chanting here takes over from it anyway.
    const { count } = await prisma.sadhanaProfile.updateMany({
      where: { userId: holder.id, legacyFavoriteMantraId: null },
      data: { legacyFavoriteMantraId: favouriteId },
    });
    // Nothing was updated: either there is no profile yet (this makes one) or it already has a favourite (the
    // insert is skipped and it stays).
    if (count === 0) {
      await prisma.sadhanaProfile.createMany({
        data: [{ userId: holder.id, dailyRoundTarget: DEFAULT_ROUND_TARGET, legacyFavoriteMantraId: favouriteId }],
        skipDuplicates: true,
      });
    }
  }

  try {
    await prisma.user.update({ where: { id: holder.id }, data: { legacyUserId: old.legacyUserId } });
    logger.info({ userId: holder.id, legacyUserId: old.legacyUserId }, 'account here linked to its old-server user');
  } catch (error) {
    // Two requests for one person at once: the other one linked an account first.
    if (error.code !== 'P2002') throw error;
  }
}

// The account for a person from the old server, made the first time its token is brought here.
async function carryOver(old, body) {
  // Their address there, unless it is not one or an account here already has it. An account that Google or Apple
  // vouched for is never opened by an old token: it is linked to the old user and refused (`linkOldIdentity`).
  // It is an existing account, not a new one, so closed sign-ups do not hold that back.
  let email = old.email;
  if (email) {
    const holders = await accountsWithEmail(email);
    const proved = holders.find((holder) => holder.authProvider !== 'LEGACY');
    if (proved) {
      await linkOldIdentity(proved, old);
      throw conflict(`An account already exists for this email. Please sign in with ${proved.authProvider.toLowerCase()}.`);
    }
    if (holders.length > 0) email = null; // another account from the old server already has it
  }

  // Not a refusal: this person is owed an account, and the app keeps their old token and asks again another day.
  if (!(await settings.getBoolean(SETTING_KEYS.SIGNUP_ENABLED, true))) {
    throw new AppError(503, 'LEGACY_UNAVAILABLE', 'New accounts are closed at the moment');
  }

  const role = await prisma.role.findUnique({ where: { slug: ROLES.USER } });
  if (!role) throw notFound('Default role — run the seed');

  const timezone = isValidTimezone(body.timezone) ? body.timezone : undefined;
  const legacyFavoriteMantraId = await legacyService.favouriteFor(old.mantras);

  try {
    const user = await prisma.user.create({
      data: {
        email: email ?? placeholderEmail(old.legacyUserId),
        name: old.name,
        avatarUrl: old.avatarUrl,
        authProvider: 'LEGACY',
        // Required and unique on every user; no provider has one for this person.
        providerUserId: `legacy:${old.legacyUserId}`,
        legacyUserId: old.legacyUserId,
        roleId: role.id,
        appLanguage: body.appLanguage || 'en',
        mantraLanguage: body.mantraLanguage || 'sa',
        readingLanguage: body.readingLanguage || body.appLanguage || 'en',
        ...(timezone ? { timezone } : {}),
        sadhanaProfile: { create: { dailyRoundTarget: DEFAULT_ROUND_TARGET, legacyFavoriteMantraId } },
      },
      include: { role: true },
    });
    announceSignup(user, 'LEGACY');
    return { user, isNew: true };
  } catch (error) {
    if (error.code !== 'P2002') throw error;
    // Two requests for one person at once (a double launch): use the account the other one made.
    const user = await prisma.user.findUnique({ where: { legacyUserId: old.legacyUserId }, include: { role: true } });
    if (!user) throw conflict('An account already exists for this email. Please sign in another way.');
    return { user, isNew: false };
  }
}

/**
 * POST /api/app/auth/legacy
 * Trades the access token the old app saved for a session here, so someone who used the app before this system
 * existed is not asked to sign in again. The old server is asked who the token belongs to (services/legacy.js);
 * this server never reads the token. The account is made the first time and found by the old user id after that,
 * so repeating the request, from the same phone or another one, gives the same account. Which mantra they chanted
 * most there is carried across as the one "Chant now" opens with until they have chanted here.
 *
 * The answer is the one `social` gives: 201 for a new account, 200 for one already carried over. 403
 * `UNAUTHENTICATED` means the old server does not accept the token and 409 that the account cannot be had this
 * way (an account here has that email, it now signs in with Google or Apple, or it is banned): the app drops the
 * token on either. 503 is anything that may pass — the app keeps the token and tries again on a later launch.
 *
 * An account here that already has the person's email (compared without regard to case) is linked to them — it
 * is told which old user it is and keeps the mantra they chanted most there — but still answers 409: an old token
 * is not proof of owning an address, so it never opens an account that Google or Apple has vouched for. The
 * person signs in the usual way and arrives in that same account.
 */
export const legacy = async (req, res) => {
  const body = req.valid.body;

  // A token the old server rejects ends here, before anything is read or written.
  const old = await legacyService.lookup(body.legacyToken);

  let user = await prisma.user.findUnique({ where: { legacyUserId: old.legacyUserId }, include: { role: true } });
  let isNew = false;
  if (!user) ({ user, isNew } = await carryOver(old, body));

  // Once a verified Google or Apple sign-in has taken the account over, an old token is no longer enough.
  if (user.authProvider !== 'LEGACY') {
    throw conflict(`This account now signs in with ${user.authProvider.toLowerCase()}. Please sign in that way.`);
  }
  if (user.isBanned) throw conflict('This account is banned');

  if (!isNew) {
    user = await prisma.user.update({ where: { id: user.id }, data: { lastActiveAt: new Date() }, include: { role: true } });
  }

  await linkDevice(user.id, req, body);
  const session = await authService.issueSession(user, body.deviceId || req.deviceId);

  if (isNew) {
    logger.info(
      { userId: user.id, legacyUserId: old.legacyUserId, withEmail: Boolean(old.email), mantras: old.mantras.length },
      'account carried over from the old server'
    );
    return created(res, sessionPayload(user, session));
  }
  return ok(res, sessionPayload(user, session));
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
