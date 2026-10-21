// Refer and earn. Rules in utils/referral.js, effects in services/referral.js.

import env from '../../config/env.js';
import * as referral from '../../services/referral.js';
import { referralUrl } from '../../utils/share.js';
import { ok } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/** GET /api/app/referral/me */
export const me = async (req, res) => {
  const { page, pageSize } = req.valid.query;
  const summary = await referral.summary(req.auth.user, { page, pageSize });
  return ok(res, { ...summary, url: referralUrl(env.WEB_BASE_URL, summary.code) });
};

/** POST /api/app/referral/claim */
export const claim = async (req, res) => {
  const row = await referral.claim(req.auth.user, req.valid.body.code);
  return ok(res, { status: row.status, claimedAt: row.claimedAt });
};

/** GET /api/app/referral/inviter/:code — public: only a first name. */
export const inviter = async (req, res) => {
  const found = await referral.inviter(req.valid.params.code);
  if (!found) throw notFound('Invitation');
  return ok(res, { ...found, url: referralUrl(env.WEB_BASE_URL, found.code), stores: { play: env.playStoreUrl, appStore: env.appStoreUrl } });
};
