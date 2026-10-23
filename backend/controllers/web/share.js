// Public side of sharing: what a stranger sees at a shared link.
//
// Everything here is anonymous. The resolver (services/share.js) decides what is
// safe to show; this file only maps the path segment to a content type and sets
// the status code. A link that used to work answers 410, one that never did 404,
// and both carry a body the page can render a kind message from.

import * as share from '../../services/share.js';
import * as referral from '../../services/referral.js';
import { CONTENT_ROUTES } from '../../utils/share.js';
import { ok } from '../../utils/respond.js';
import env from '../../config/env.js';
import { notFound } from '../../utils/errors.js';
import { requestChain } from '../../utils/language.js';
import { translateError } from '../../utils/messages.js';

const TYPE_BY_ROUTE = Object.fromEntries(Object.entries(CONTENT_ROUTES).map(([type, route]) => [route, type]));

/** GET /api/web/share/:route/:code */
export const resolve = async (req, res) => {
  const { route, code } = req.valid.params;
  const type = TYPE_BY_ROUTE[route];
  if (!type) throw notFound('Link');

  const result = await share.resolve(code, type, { language: req.valid.query.lang || 'en' });
  if (result.status === 'ok') return ok(res, result);
  const status = result.status === 'not_found' ? 404 : 410;
  return res.status(status).json({ success: false, error: { code: result.status.toUpperCase(), message: translateError({ message: 'This link is not available' }, requestChain(req)) }, data: result });
};

/** GET /api/web/referral/:code — enough to greet an invited person, nothing more. */
export const inspect = async (req, res) => {
  const found = await referral.inspect(req.valid.params.code);
  if (!found.valid) throw notFound('Invitation');
  return ok(res, found);
};

/** GET /api/web/app-links — where to get the app, as configured (empty when not published yet). */
export const appLinks = async (req, res) =>
  ok(res, {
    playStoreUrl: env.PLAY_STORE_URL || null,
    appStoreUrl: env.APP_STORE_URL || null,
    androidPackage: env.GOOGLE_PLAY_PACKAGE_NAME || null,
    appScheme: env.APP_SCHEME,
  });
