// Sharing: public links for content, and AI backgrounds for share cards.

import * as share from '../../services/share.js';
import * as shareImage from '../../services/share-image.js';
import { ok, created } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/** POST /api/app/share/link */
export const link = async (req, res) => {
  const { type, targetId } = req.valid.body;
  return ok(res, await share.linkFor({ userId: req.auth.user.id, type, targetId }));
};

/** GET /api/app/share/background/quote */
export const quote = async (req, res) => ok(res, await shareImage.quote(req.auth.user));

/** POST /api/app/share/background */
export const generate = async (req, res) => {
  const { requestKey, prompt } = req.valid.body;
  const job = await shareImage.generate({ user: req.auth.user, requestKey, prompt });
  return (job.status === 'PENDING' ? created : ok)(res, job);
};

/** GET /api/app/share/background/:id */
export const background = async (req, res) => {
  const job = await shareImage.find(req.auth.user, req.valid.params.id);
  if (!job) throw notFound('Background');
  return ok(res, job);
};
