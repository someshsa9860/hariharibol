// The old app's server (Laravel), asked about one of its people: who a token belongs to, and which mantras
// they chanted most. POST /auth/legacy trades that token for a session here — see "Legacy users" in
// backend/CLAUDE.md.
//
// This server never reads the old token itself: it only carries it to the old server's migration route, which
// answers for it. The route is shut to anyone without the shared key (`X-Migration-Key`), so the key and the
// token are two separate things a caller must hold.
//
// What goes wrong is told in two ways, and the app acts on the difference (it deletes the old token on the
// first and keeps it for another day on the second):
//   - the old server says the token is no good (never issued, expired, the account deleted) → `unauthorized()`;
//   - anything else — not configured, a wrong key, down, slow, busy, an answer we do not understand — is the
//     OLD SERVER'S or OUR problem, not the token's → 503 `LEGACY_UNAVAILABLE`, and the reason goes to the log.
// The token and the key are never logged.

import { z } from 'zod';
import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { MANTRA_SLUGS, MAX_LEGACY_MANTRAS } from '../config/legacy.js';
import { AppError, unauthorized } from '../utils/errors.js';
import { candidateFrom, cleanName, httpsUrl, pickFavourite, usableEmail } from '../utils/legacy.js';

const unavailable = (reason) => {
  logger.warn({ reason }, 'old server could not be asked');
  return new AppError(503, 'LEGACY_UNAVAILABLE', 'The old sign-in cannot be checked right now');
};

// What the old server sends for the person. Anything it leaves out is null; only the id is needed.
const OldUser = z.object({
  id: z.coerce.number().int().positive().max(2147483647),
  name: z.string().nullish(),
  email: z.string().nullish(),
  image: z.string().nullish(),
});

const text = (value) => (typeof value === 'string' && value.trim() ? value : null);

function chantCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0;
}

/**
 * Asks the old server who [token] belongs to. Returns
 * `{ legacyUserId, name, email, avatarUrl, mantras }` — name, email (null unless it is a real address) and picture
 * already tidied (`utils/legacy.js`) — where `mantras` are their most chanted old mantras,
 * `{ id, title, subtitle, mantra, count }`, at most `MAX_LEGACY_MANTRAS`.
 *
 * Throws `unauthorized()` when the old server rejects the token, and 503 `LEGACY_UNAVAILABLE` for anything else.
 */
export async function lookup(token) {
  if (!env.legacyMigrationEnabled) throw unavailable('not configured');

  let response;
  try {
    response = await fetch(env.LEGACY_MIGRATION_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'x-migration-key': env.LEGACY_MIGRATION_KEY,
      },
      body: JSON.stringify({ token }),
      // The key is a header: a redirect would carry it to wherever it points.
      redirect: 'error',
      signal: AbortSignal.timeout(env.LEGACY_MIGRATION_TIMEOUT_MS),
    });
  } catch (err) {
    throw unavailable(err.name === 'TimeoutError' ? 'timed out' : `no answer: ${err.cause?.code || err.cause?.message || err.message}`);
  }

  const body = await response.json().catch(() => null);

  // The one answer that is about the token itself. (A 401 with another code is the shared key being wrong.)
  if (response.status === 401 && (body?.code === 'invalid_token' || body?.code === 'account_deleted')) {
    throw unauthorized('This sign-in is no longer valid');
  }
  if (!response.ok) throw unavailable(`status ${response.status}${text(body?.code) ? ` (${body.code})` : ''}`);

  const user = OldUser.safeParse(body?.user);
  if (!user.success) throw unavailable('the answer has no user');

  return {
    legacyUserId: user.data.id,
    name: cleanName(user.data.name),
    email: usableEmail(user.data.email),
    avatarUrl: httpsUrl(user.data.image),
    mantras: (Array.isArray(body.mantras) ? body.mantras : []).slice(0, MAX_LEGACY_MANTRAS).map((row) => ({
      id: Number.isInteger(row?.id) ? row.id : null,
      title: text(row?.title),
      subtitle: text(row?.subtitle),
      mantra: text(row?.mantra),
      count: chantCount(row?.count),
    })),
  };
}

/**
 * The id of the published mantra of ours that [mantras] (from `lookup`) say the person chanted most, or null when
 * none of them is one of ours. It is only used to open "Chant now" on a familiar mantra until there is chanting
 * here, so a miss costs nothing; the titles that matched nothing are logged so a wrong guess can be corrected in
 * `MANTRA_SLUGS` (config/legacy.js).
 */
export async function favouriteFor(mantras) {
  if (mantras.length === 0) return null;

  const rows = await prisma.mantra.findMany({
    where: { isPublished: true },
    select: {
      id: true,
      slug: true,
      name: true,
      sanskrit: true,
      transliteration: true,
      translations: { where: { isPublished: true }, select: { name: true, text: true } },
    },
  });

  const favourite = pickFavourite(mantras, rows.map(candidateFrom), { overrides: MANTRA_SLUGS });
  logger.info(
    {
      matched: favourite.slug,
      via: favourite.via,
      score: Number(favourite.score.toFixed(2)),
      count: favourite.count,
      // Titles are the old app's mantra names, not anything about the person.
      unmatched: favourite.unmatched.slice(0, 5).map((title) => title.slice(0, 60)),
    },
    'old favourite mantra'
  );
  return favourite.mantraId;
}
