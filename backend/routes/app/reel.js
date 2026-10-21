import express from 'express';

import { createRouter, z, schemas } from '../../utils/router.js';
import { AppError } from '../../utils/errors.js';
import * as controller from '../../controllers/app/reel.js';
import * as make from '../../controllers/app/reel-make.js';

const router = createRouter({
  tag: 'Reels',
  prefix: '/reels',
  description:
    'Short-form creator video and image posts, and what a reader does to one — watching, ' +
    'liking, sharing, reporting. Comments are their own resource; see Reel comments.',
});

// The share platforms a client may report. Mirrors the SharePlatform enum —
// zod validates against the same list Prisma will, so a typo is a 400 here
// rather than a 500 from the database.
const sharePlatform = z.enum([
  'WHATSAPP',
  'INSTAGRAM',
  'FACEBOOK',
  'TWITTER',
  'TELEGRAM',
  'COPY_LINK',
  'OTHER',
]);

const reportReason = z.enum([
  'SPAM',
  'HARASSMENT_OR_ABUSE',
  'NON_DEVOTIONAL',
  'MISINFORMATION',
  'SEXUAL_OR_VIOLENT',
  'OTHER',
]);

// The file arrives as the request body itself; what it really is is judged from its bytes.
const rawFile = express.raw({ type: () => true, limit: make.AUDIO_MAX_BYTES });
const readFile = (req, res, next) =>
  rawFile(req, res, (error) =>
    next(error?.type === 'entity.too.large' ? new AppError(413, 'MEDIA_TOO_LARGE', 'That file is too large') : error)
  );

router.post(
  '/media',
  {
    summary: 'Upload a picture or music for my reel',
    description:
      'The request body is the file. `kind=image` takes the share studio card (JPEG, PNG or WebP, up to ' +
      '8 MB); `kind=audio` takes music from the phone (MP3, M4A/MP4, AAC or WAV, up to 25 MB). What the ' +
      'file really is is judged from its bytes. Returns `{ key, url }`: name `key` in `POST /reels/make`.',
    limit: 'write',
    query: z.object({ kind: z.enum(['image', 'audio']) }),
    middleware: readFile,
    responds: { 200: 'The key and a link', 400: 'Empty body', 413: 'MEDIA_TOO_LARGE', 422: 'MEDIA_NOT_USABLE' },
  },
  (req, res) => {
    if (req.valid.query.kind === 'image' && req.body?.length > make.IMAGE_MAX_BYTES) {
      throw new AppError(413, 'MEDIA_TOO_LARGE', 'That picture is too large');
    }
    return make.uploadMedia(req, res);
  }
);

router.post(
  '/make',
  {
    summary: 'Make a reel from the share studio',
    description:
      'Publishes a reel straight away from an uploaded picture (and optional background music) — the ' +
      'reader becomes an approved creator on the spot, with no moderation queue. The reel then shows in ' +
      'the feed (app and website) and on their profile. A creator an admin rejected gets 403. At most ' +
      `${make.DAILY_LIMIT} a day (429 REEL_LIMIT).`,
    limit: 'write',
    body: z.object({
      imageKey: z.string().min(1).max(500),
      audioKey: z.string().min(1).max(500).optional(),
      caption: z.string().trim().max(2200).optional(),
      tags: z.array(z.string().trim().min(1).max(50)).max(30).optional(),
      languageCode: z.string().max(10).optional(),
      mantraSlug: z.string().max(100).optional(),
    }),
    responds: { 201: 'The reel id', 400: 'A bad key or a missing file', 403: 'Creator rejected', 429: 'REEL_LIMIT' },
  },
  make.make
);

router.get(
  '/',
  {
    summary: 'Browse the reels feed',
    description:
      'Ranked for the signed-in reader: same-language reels and ones already gaining likes, ' +
      'comments and shares surface first, with that boost fading over the following days so ' +
      'nothing camps at the top forever. Reels the reader has already watched are pushed ' +
      'down — finished ones harder than half-watched ones — but not removed, so a small ' +
      'library does not empty itself in an evening. The reader’s own reels are left out. ' +
      'Paginate by swiping — fetch the next page once the reader is a few reels from the end ' +
      'of what they already have, rather than waiting until the last one. `pageSize` ' +
      'defaults to 11. Public: signed out (the website) nothing is seen, liked or saved.',
    public: true,
    limit: 'read',
    query: z.object({
      page: z.coerce.number().int().min(1).optional(),
      pageSize: z.coerce.number().int().min(1).max(100).optional(),
    }),
    responds: { 200: 'A page of ranked reels' },
  },
  controller.feed
);

// Registered before `/:id`, or `GET /reels/saved` matches it with id="saved".
router.get(
  '/saved',
  {
    summary: 'Reels I saved',
    description:
      'Newest save first. A saved reel is an ordinary `Favorite` row, so this is the same ' +
      'bookmark the favourites endpoint writes — one taken down since it was saved is left ' +
      'out rather than shown.',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'A page of saved reels' },
  },
  controller.saved
);

router.get(
  '/:id/similar',
  {
    summary: 'More reels like this one',
    description:
      'Reels that share this reel’s standard tags — same chapter first, then the same canto, ' +
      'then the same book — and then ones sharing a hashtag. Within a match, verse order, so a ' +
      'chapter plays in sequence. Empty for a reel with no tags in common with anything: hide ' +
      'the option rather than show a dead end. The reel itself is never in the list.',
    limit: 'read',
    params: schemas.id,
    query: schemas.page,
    responds: { 200: 'A page of similar reels', 404: 'No such reel' },
  },
  controller.similar
);

router.get(
  '/:id',
  {
    summary: 'Get one reel',
    description:
      'The share and deeplink target. Unlike the feed this does not hide the reader’s own ' +
      'reels — following a link to something you posted should show it, including one still ' +
      'awaiting review. Public: a signed-out visitor sees it with nothing liked or saved.',
    public: true,
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The reel', 404: 'No such reel, or not published' },
  },
  controller.get
);

router.post(
  '/:id/like',
  {
    summary: 'Like a reel',
    description:
      'Idempotent — liking twice returns the same count rather than an error, because a ' +
      'double tap is a normal thing for a finger to do on a video.',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The new like state and count', 404: 'No such reel' },
  },
  controller.like
);

router.delete(
  '/:id/like',
  {
    summary: 'Unlike a reel',
    limit: 'write',
    params: schemas.id,
    responds: { 200: 'The new like state and count', 404: 'No such reel' },
  },
  controller.unlike
);

router.post(
  '/:id/view',
  {
    summary: 'Report watch progress',
    description:
      'Called when the reader leaves a reel, with how far they got. Safe to call repeatedly ' +
      'for the same reel — the row moves forward rather than a new view being counted. ' +
      '`Reel.viewCount` only moves on a reader’s *first* view, so looping your own reel ' +
      'does not inflate it, and a watch shorter than three seconds is not recorded at all. ' +
      'Reaching ~90% marks the view completed, which is also what pushes the reel down that ' +
      'reader’s feed afterwards.',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      watchedMs: z.coerce.number().int().min(0),
      // Only used when the reel row has no duration of its own.
      durationMs: z.coerce.number().int().min(0).optional(),
    }),
    responds: { 200: 'Whether the view counted', 404: 'No such reel' },
  },
  controller.recordView
);

router.post(
  '/:id/share',
  {
    summary: 'Record a share',
    description:
      'Logged per event rather than as a running total, so which platform actually drives ' +
      'traffic is answerable later. Call it when the share sheet reports success, not when ' +
      'it opens.',
    limit: 'write',
    params: schemas.id,
    body: z.object({ platform: sharePlatform.default('OTHER') }),
    responds: { 200: 'The new share count', 404: 'No such reel' },
  },
  controller.share
);

router.post(
  '/:id/report',
  {
    summary: 'Report a reel',
    description:
      'One open report per person per reel. Reporting the same thing twice returns the ' +
      'existing report rather than writing a second one — a second tap usually means ' +
      'nothing visibly happened the first time.',
    limit: 'write',
    params: schemas.id,
    body: z.object({
      reason: reportReason,
      note: z.string().trim().max(1000).optional(),
    }),
    responds: { 201: 'The report', 404: 'No such reel' },
  },
  controller.report
);

export default router;
