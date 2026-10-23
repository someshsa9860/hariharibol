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
import * as presence from '../services/presence.js';
import * as geoIp from '../services/geo-ip.js';
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
//
// The same write refreshes where the request came from (User.country … city, from the IP). The lookup is in
// memory, so it adds no round trip, and tying it to this beat means a new account is placed on its first
// signed-in request and a traveller within the hour, without a write of its own. A lookup that finds nothing
// (no database installed, a private address) leaves the last known place standing.
async function touchLastActive(req, userId) {
  const key = `active:${userId}`;
  const fresh = await redis.set(key, '1', 'EX', 3600, 'NX').catch(() => null);
  if (fresh !== 'OK') return;

  const now = new Date();
  const place = await geoIp.locate(req.ip);

  prisma.user
    .update({
      where: { id: userId },
      data: { lastActiveAt: now, ...(place ? { ...place, locationUpdatedAt: now } : {}) },
    })
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
    touchLastActive(req, loaded.user.id);
    presence.touch(loaded.user.id, String(req.get('X-Platform') || '').toLowerCase());
    return next();
  } catch (err) {
    return next(err);
  }
}

export { ANONYMOUS };
