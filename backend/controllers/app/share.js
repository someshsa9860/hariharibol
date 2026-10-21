// Sharing: the opaque link for a verse, mantra or reel; what a link opens (public, for the landing page and the
// app's link handler); and AI backgrounds for the Share Studio. Rules in services/share.js,
// services/share-background.js and utils/share.js.

import env from '../../config/env.js';
import * as share from '../../services/share.js';
import * as background from '../../services/share-background.js';
import { shareUrl, appUri, keptQuery, KIND_PATHS } from '../../utils/share.js';
import { ok, created } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';
import { gone } from '../../utils/errors.js';

const stores = () => ({ play: env.playStoreUrl, appStore: env.appStoreUrl });

const presentLink = (link) => ({
  code: link.code,
  kind: link.kind,
  url: shareUrl(env.WEB_BASE_URL, link.kind, link.code),
  appUri: appUri(env.APP_SCHEME, link.kind, link.code),
});

/** POST /api/app/share/links */
export const createLink = async (req, res) => {
  const { kind, targetId } = req.valid.body;
  return created(res, presentLink(await share.linkFor(kind, targetId)));
};

/** GET /api/app/share/links/:code */
export const openLink = async (req, res) => {
  const result = await share.resolve(req.valid.params.code, req.valid.query.kind ?? null);
  if (result.state === 'missing') throw notFound('Link');
  if (result.state === 'gone') throw gone('This has been taken down');

  return ok(res, {
    kind: result.kind,
    code: result.code,
    targetId: result.targetId,
    content: result.content,
    url: shareUrl(env.WEB_BASE_URL, result.kind, result.code),
    appUri: appUri(env.APP_SCHEME, result.kind, result.code),
    // Only attribution survives; see utils/share.keptQuery.
    query: keptQuery(req.query),
    stores: stores(),
    paths: KIND_PATHS,
  });
};

/** GET /api/app/share/background/quote */
export const quote = async (req, res) => ok(res, await background.quote(req.auth.user));

/** GET /api/app/share/background/:id/image — the picture's bytes, to its maker only (so the browser can draw it on a canvas). */
export const backgroundImage = async (req, res) => {
  const bytes = await background.imageBytes(req.auth.user, req.valid.params.id);
  if (!bytes) throw notFound('Picture');
  res.set({ 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' });
  return res.send(bytes);
};

/** POST /api/app/share/background */
export const makeBackground = async (req, res) => ok(res, await background.generate(req.auth.user, req.valid.body));
