// Every request passes through here — that is the rule (backend/CLAUDE.md rule
// 5). This middleware does not decide whether a route is allowed; it only
// establishes *who is asking* and hangs it on `req.auth`.
//
// The allow/deny decision lives in utils/router.js, which requires
// authentication for every route unless it declares `public: true`. Keeping the
// two apart is what lets a public endpoint still know its caller when one is
// signed in — the sloka of the day, for instance, is public but personalises
// when it can.
//
//   req.auth = { user, permissions: Set, isAuthenticated }
//
// A missing token is anonymous. A *bad* token is an error: the client is
// holding something it thinks is valid, and telling it plainly is what triggers
// the silent refresh instead of a puzzling empty response.

import * as authService from '../services/auth.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { unauthorized } from '../utils/errors.js';

const ANONYMOUS = { user: null, permissions: new Set(), isAuthenticated: false };

function readBearer(req) {
  const header = req.get('Authorization');
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  if (!/^Bearer$/i.test(scheme || '') || !token) return null;
  return token.trim();
}

// lastActiveAt drives retention reporting, but writing it on every request
// would mean a database write per request. Once an hour per user is enough.
async function touchLastActive(userId) {
  const key = `active:${userId}`;
  const fresh = await redis.set(key, '1', 'EX', 3600, 'NX').catch(() => null);
  if (fresh !== 'OK') return;
  prisma.user
    .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
    .catch((err) => logger.debug({ err: err.message }, 'lastActiveAt update failed'));
}

export default async function auth(req, res, next) {
  const token = readBearer(req);

  if (!token) {
    req.auth = ANONYMOUS;
    return next();
  }

  try {
    const payload = authService.verifyAccessToken(token);
    const loaded = await authService.loadAuthUser(payload.sub);

    // The token verified but the account is gone — deleted while the token was
    // still inside its window.
    if (!loaded) return next(unauthorized('Account no longer exists'));

    req.auth = { user: loaded.user, permissions: loaded.permissions, isAuthenticated: true };
    touchLastActive(loaded.user.id);
    return next();
  } catch (err) {
    return next(err);
  }
}

export { ANONYMOUS };
