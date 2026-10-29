// A reader's own marketing choices, and the app telling us a marketing link brought it here.
//
// Email is on by default and one tap off; the switch is `MarketingPreference.emailEnabled` and also puts the address on the
// suppression list (services/marketing-consent.js), so it holds even for a new account made with the same address.
// WhatsApp opt-in is not here yet (it needs the WhatsApp phase).

import * as consent from '../../services/marketing-consent.js';
import * as tracking from '../../services/marketing-tracking.js';
import { ok } from '../../utils/respond.js';

/** GET /api/app/marketing/preferences */
export const preferences = async (req, res) => ok(res, await consent.preferenceOf(req.auth.user.id));

/** PATCH /api/app/marketing/preferences */
export const setPreferences = async (req, res) => {
  if (req.valid.body.emailEnabled !== undefined) await consent.setEmailEnabled(req.auth.user.id, req.valid.body.emailEnabled, 'app');
  return ok(res, await consent.preferenceOf(req.auth.user.id));
};

/** POST /api/app/marketing/open — the app was opened by a tracked link. */
export const openedFromLink = async (req, res) => {
  const found = await tracking.recordAppOpen({ userId: req.auth.user.id, code: req.valid.body.code, position: req.valid.body.n });
  return ok(res, found ?? { recorded: false });
};

/** POST /api/app/marketing/install — Google’s install referrer, read on first launch. */
export const installReferrer = async (req, res) => {
  const found = await tracking.recordInstallReferrer({ userId: req.auth.user.id, referrer: req.valid.body.referrer });
  return ok(res, found ?? { recorded: false });
};
