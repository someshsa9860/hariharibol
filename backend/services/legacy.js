// Server-to-server call to the old (Laravel) API, used once per carried-over account.
//
// The app hands us the token it held from the old server. We never trust it on its own: we ask the old server who
// it belongs to, presenting a key only the two servers know (`X-Migration-Key`), and the old server checks both the
// key and the token before it answers. A token the old server does not recognise is a 403 here, the same "this
// credential is not valid" answer sign-in gives; the old server being down or slow is a 502, which the app treats
// as "try again later" and never as a reason to drop anyone.

import env from '../config/env.js';
import logger from '../config/logger.js';
import { AppError, unauthorized } from '../utils/errors.js';
import { readLegacyAccount } from '../utils/legacy-mantra.js';

// Where the old server answers. A route on the Laravel API (see legacy/README.md).
const ACCOUNT_PATH = '/api/migration/account';

const unavailable = () => new AppError(502, 'LEGACY_UNAVAILABLE', 'The previous server could not be reached');

/** The account the old server says `legacyToken` belongs to, shaped by `readLegacyAccount`. */
async function fetchAccount(legacyToken) {
  let res;
  try {
    res = await fetch(env.LEGACY_API_URL + ACCOUNT_PATH, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        authorization: `Bearer ${legacyToken}`,
        'x-migration-key': env.LEGACY_MIGRATION_KEY,
      },
      signal: AbortSignal.timeout(env.LEGACY_TIMEOUT_MS),
    });
  } catch (err) {
    logger.warn({ err: err.message }, 'legacy server unreachable');
    throw unavailable();
  }

  // 401/403/404: the old server does not know this token (or the key is wrong — which would be our configuration
  // and would show up as every call failing, so it is logged loudly rather than told to the person).
  if (res.status === 401 || res.status === 403 || res.status === 404) {
    logger.warn({ status: res.status }, 'legacy server refused the token or the migration key');
    throw unauthorized('Could not verify the previous sign-in');
  }
  if (!res.ok) {
    logger.warn({ status: res.status }, 'legacy server answered with an error');
    throw unavailable();
  }

  let body;
  try {
    body = await res.json();
  } catch {
    logger.warn('legacy server answered with something that is not JSON');
    throw unavailable();
  }

  const account = readLegacyAccount(body?.data ?? body);
  if (!account) {
    logger.warn('legacy server answered with no usable account');
    throw unauthorized('Could not verify the previous sign-in');
  }
  return account;
}

export { fetchAccount };
