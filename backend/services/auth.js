// The only place tokens are created, verified or rotated, and the only place
// Google and Apple identity assertions are checked. Admin and app sign-in share
// it — there is one users table and one auth path, and an admin is simply a
// user whose role carries admin permissions.
//
// Token design:
//   access   signed JWT, short-lived by config, verified in-process with no
//            database hit on the hot path
//   refresh  opaque random string. Only its SHA-256 hash is stored, so a
//            database leak does not hand over live sessions. Valid for a year
//            and replaced on every use — `rotatedAt` marks a row spent, which
//            is what makes replay detectable.

const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const { createRemoteJWKSet, jwtVerify } = require('jose');

const env = require('../config/env');
const logger = require('../config/logger');
const { prisma } = require('../config/database');
const { redis } = require('../config/redis');
const { CACHE, ROLES } = require('../config/constants');
const { unauthorized, badRequest } = require('../utils/errors');

const googleClient = new OAuth2Client();
const appleKeys = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

const hash = (value) => crypto.createHash('sha256').update(value).digest('hex');

// ── Access tokens ──────────────────────────────────────────────────────────

function signAccessToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role?.slug || ROLES.USER, typ: 'access' },
    env.JWT_SECRET,
    { expiresIn: env.ACCESS_TOKEN_TTL, issuer: 'hariharibol' }
  );
}

function verifyAccessToken(token) {
  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { issuer: 'hariharibol' });
    if (payload.typ !== 'access') throw unauthorized('Wrong token type');
    return payload;
  } catch (err) {
    if (err.name === 'TokenExpiredError') throw unauthorized('Access token expired');
    throw unauthorized('Invalid access token');
  }
}

// ── Refresh tokens ─────────────────────────────────────────────────────────

async function issueRefreshToken(userId, deviceId) {
  const raw = crypto.randomBytes(48).toString('base64url');
  const expiresAt = new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { tokenHash: hash(raw), userId, deviceId: deviceId || null, expiresAt },
  });

  return { token: raw, expiresAt };
}

// Both tokens at once — every sign-in and every refresh returns this shape.
async function issueSession(user, deviceId) {
  const refresh = await issueRefreshToken(user.id, deviceId);
  return {
    accessToken: signAccessToken(user),
    refreshToken: refresh.token,
    refreshExpiresAt: refresh.expiresAt,
  };
}

// Presenting a refresh token spends it. Presenting one that was already spent
// means it was captured — the whole family is killed and the user signs in
// again, which is the only safe response.
async function rotateRefreshToken(rawToken, deviceId) {
  if (!rawToken) throw badRequest('refreshToken is required');

  const existing = await prisma.refreshToken.findUnique({
    where: { tokenHash: hash(rawToken) },
    include: { user: { include: { role: true } } },
  });

  if (!existing) throw unauthorized('Invalid refresh token');

  if (existing.rotatedAt) {
    logger.warn({ userId: existing.userId }, 'refresh token replay — revoking all sessions');
    await revokeAllForUser(existing.userId);
    throw unauthorized('Refresh token already used. Please sign in again.');
  }

  if (existing.revokedAt) throw unauthorized('Session was revoked');
  if (existing.expiresAt < new Date()) throw unauthorized('Refresh token expired');
  if (existing.user.isBanned) throw unauthorized('This account is banned');

  const [, session] = await prisma.$transaction([
    prisma.refreshToken.update({
      where: { id: existing.id },
      data: { rotatedAt: new Date() },
    }),
    prisma.user.update({
      where: { id: existing.userId },
      data: { lastActiveAt: new Date() },
      include: { role: true },
    }),
  ]);

  return { user: session, session: await issueSession(session, deviceId || existing.deviceId) };
}

async function revokeRefreshToken(rawToken) {
  await prisma.refreshToken.updateMany({
    where: { tokenHash: hash(rawToken), revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

async function revokeAllForUser(userId) {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  await redis.del(CACHE.userAuth(userId));
}

// ── Identity providers ─────────────────────────────────────────────────────
// Both return the same shape so the sign-in controller does not branch.

async function verifyGoogleIdToken(idToken) {
  if (!env.googleClientIds.length) throw badRequest('Google sign-in is not configured');
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken,
      audience: env.googleClientIds,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub) throw unauthorized('Google token has no subject');
    if (payload.email && payload.email_verified === false) {
      throw unauthorized('Google account email is not verified');
    }
    return {
      provider: 'GOOGLE',
      providerUserId: payload.sub,
      email: payload.email || null,
      name: payload.name || null,
      avatarUrl: payload.picture || null,
    };
  } catch (err) {
    if (err.expected) throw err;
    logger.warn({ err: err.message }, 'google id token rejected');
    throw unauthorized('Could not verify the Google sign-in');
  }
}

async function verifyAppleIdToken(idToken) {
  if (!env.appleBundleIds.length) throw badRequest('Apple sign-in is not configured');
  try {
    const { payload } = await jwtVerify(idToken, appleKeys, {
      issuer: 'https://appleid.apple.com',
      audience: env.appleBundleIds,
    });
    if (!payload.sub) throw unauthorized('Apple token has no subject');
    return {
      provider: 'APPLE',
      providerUserId: payload.sub,
      email: payload.email || null,
      // Apple sends the name only to the client, only on the very first
      // sign-in. The app forwards it; there is no second chance to read it.
      name: null,
      avatarUrl: null,
    };
  } catch (err) {
    if (err.expected) throw err;
    logger.warn({ err: err.message }, 'apple id token rejected');
    throw unauthorized('Could not verify the Apple sign-in');
  }
}

function verifyIdentityToken(provider, idToken) {
  if (provider === 'GOOGLE') return verifyGoogleIdToken(idToken);
  if (provider === 'APPLE') return verifyAppleIdToken(idToken);
  throw badRequest(`Unsupported provider: ${provider}`);
}

// ── Permission loading ─────────────────────────────────────────────────────
// Read on every authenticated request, so it is cached. Any change to a user's
// role or to a role's permissions must call `invalidateUser`.

async function loadAuthUser(userId) {
  const cacheKey = CACHE.userAuth(userId);
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) {
    const parsed = JSON.parse(cached);
    return { user: parsed.user, permissions: new Set(parsed.permissions) };
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      role: { include: { permissions: { include: { permission: true } } } },
    },
  });
  if (!user) return null;

  const permissions = user.role.permissions.map((rp) => rp.permission.slug);

  // Only the fields a guard or controller reads — this is cached, so it should
  // not carry anything that changes often or matters if it is a minute stale.
  const lean = {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    roleId: user.roleId,
    roleSlug: user.role.slug,
    appLanguage: user.appLanguage,
    mantraLanguage: user.mantraLanguage,
    readingLanguage: user.readingLanguage,
    timezone: user.timezone,
    isPremium: user.isPremium,
    premiumUntil: user.premiumUntil,
    isBanned: user.isBanned,
  };

  await redis
    .set(cacheKey, JSON.stringify({ user: lean, permissions }), 'EX', CACHE.userAuthTtl)
    .catch(() => null);

  return { user: lean, permissions: new Set(permissions) };
}

async function invalidateUser(userId) {
  await redis.del(CACHE.userAuth(userId)).catch(() => null);
}

// Every user of a role at once — used when a role's permissions change.
async function invalidateRole(roleId) {
  const users = await prisma.user.findMany({ where: { roleId }, select: { id: true } });
  if (!users.length) return;
  await redis.del(users.map((u) => CACHE.userAuth(u.id))).catch(() => null);
}

module.exports = {
  signAccessToken,
  verifyAccessToken,
  issueSession,
  issueRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllForUser,
  verifyIdentityToken,
  verifyGoogleIdToken,
  verifyAppleIdToken,
  loadAuthUser,
  invalidateUser,
  invalidateRole,
};
