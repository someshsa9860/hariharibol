// Sharing: public links for content, and AI backgrounds for share cards.

import * as share from '../../services/share.js';
import * as s3 from '../../services/s3.js';
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

/**
 * GET /api/app/share/background/:id/image — the picture itself, with the API's CORS headers, so the website can draw it
 * on a canvas and still export the card (a cross-origin storage link would taint the canvas).
 */
export const backgroundImage = async (req, res) => {
  const job = await shareImage.find(req.auth.user, req.valid.params.id);
  if (!job || job.status !== 'DONE') throw notFound('Background');
  const bytes = await s3.getObjectBuffer(await shareImage.pathOf(req.auth.user, req.valid.params.id));
  if (!bytes) throw notFound('Background');
  res.set('Cache-Control', 'private, max-age=3600');
  return res.type('image/png').send(bytes);
};
