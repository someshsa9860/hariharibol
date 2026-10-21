// Refer and earn — the signed-in person's side. The rules live in services/referral.js.

import * as referral from '../../services/referral.js';
import { ok } from '../../utils/respond.js';

/** GET /api/app/referral/me */
export const me = async (req, res) => {
  const { page, pageSize } = req.valid.query;
  return ok(res, await referral.summary(req.auth.user.id, { page, pageSize }));
};

/** GET /api/app/referral/mine — who invited me, if anyone. */
export const mine = async (req, res) => ok(res, await referral.mine(req.auth.user.id));

/** POST /api/app/referral/attribute */
export const attribute = async (req, res) => {
  const { code, source } = req.valid.body;
  return ok(res, await referral.attribute({ userId: req.auth.user.id, code, source }));
};
