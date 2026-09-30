// Reels authored and managed from the admin panel.
//
// Three things here are not obvious from the schema:
//
//   1. The panel edits one "audio" slot, but the schema keeps two kinds of
//      audio. On a VIDEO or IMAGE reel it is `Reel.audioTrackPath` (background
//      music); on an AUDIO reel it is the one ReelAudioTrack row that *is* the
//      content. `audioPath` in and out of this file hides that split.
//   2. A reel only shows in the feed when its creator is APPROVED, so a reel is
//      always created under an approved creator — the platform's own channel by
//      default, chosen in the editor.
//   3. Overlay text is stored on the reel and drawn by the app; nothing here
//      touches the video file.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as s3 from '../../services/s3.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { notFound, badRequest } from '../../utils/errors.js';
import { OFFICIAL_CREATOR_EMAIL, SOURCE_LANGUAGE } from '../../config/constants.js';

export const SORT_COLUMNS = {
  createdAt: 'createdAt',
  publishedAt: 'publishedAt',
  status: 'status',
  views: 'viewCount',
  likes: 'likeCount',
  comments: 'commentCount',
};

const EDIT_INCLUDE = {
  creator: { select: { id: true, displayName: true, status: true } },
  verse: {
    select: {
      id: true,
      verseId: true,
      bookNumber: true,
      chapterNumber: true,
      verseNumber: true,
      book: { select: { title: true } },
    },
  },
  mantra: { select: { id: true, slug: true, name: true } },
  deity: { select: { id: true, slug: true, name: true } },
  media: { orderBy: { displayOrder: 'asc' } },
  audioTracks: true,
};

// ── Keys ───────────────────────────────────────────────────────────────────

// A key from the client is only trusted if this server issued it for a reel
// upload. Otherwise presignGet would sign whatever object the key names.
// A value the row already holds passes untouched — reels seeded from the legacy
// bucket carry keys that predate the generated format.
function assertKey(key, kinds, current = []) {
  if (!key || current.includes(key)) return;
  const inKind = kinds.some((kind) => key.startsWith(`${s3.PREFIXES[kind]}/`));
  if (!s3.isGeneratedKey(key) || !inKind) throw badRequest(`Not a reel upload key: ${key}`);
}

function assertKeys(body, existing) {
  const held = existing ? mediaOf(existing).keys : [];
  assertKey(body.videoPath, ['reelVideo'], held);
  assertKey(body.audioPath, ['reelAudio'], held);
  // A slideshow image is a fine thumbnail, so both upload kinds are accepted.
  assertKey(body.thumbnailPath, ['reelThumbnail', 'reelImage'], held);
  for (const image of body.images ?? []) assertKey(image, ['reelImage'], held);
}

// Every object key a reel points at, or the reason it cannot be shown at all.
function mediaOf(reel) {
  const keys = [];
  let missing = null;

  if (reel.mediaType === 'VIDEO') {
    if (reel.videoPath) keys.push(reel.videoPath);
    else missing = 'a video';
  } else if (reel.mediaType === 'IMAGE') {
    if (reel.media.length) keys.push(...reel.media.map((m) => m.imagePath));
    else missing = 'at least one image';
  } else if (reel.audioTracks.length) {
    keys.push(...reel.audioTracks.map((t) => t.audioPath));
  } else {
    missing = 'the audio';
  }

  if (reel.audioTrackPath) keys.push(reel.audioTrackPath);
  if (reel.thumbnailPath) keys.push(reel.thumbnailPath);
  return { keys, missing };
}

// A missing file is a black screen in the feed, so a live reel never points at
// one. `alreadyLive` are keys readers are already loading — not re-checked, so
// fixing a typo in the caption of an old reel is not blocked by its old media.
async function assertShowable(reel, alreadyLive = []) {
  const { keys, missing } = mediaOf(reel);
  if (missing) throw badRequest(`Add ${missing} before publishing`);

  const toCheck = keys.filter((k) => !alreadyLive.includes(k));
  const found = await Promise.all(toCheck.map((k) => s3.objectExists(k)));
  const gone = toCheck.filter((_, i) => !found[i]);
  if (gone.length) throw badRequest('A media file is missing from storage — upload it again', gone);
}

// ── Shaping ────────────────────────────────────────────────────────────────

// The one narration on an AUDIO reel: the row for the reel's language, else
// whatever row there is.
const narrationOf = (reel) =>
  reel.audioTracks.find((t) => t.languageCode === (reel.languageCode || SOURCE_LANGUAGE)) ??
  reel.audioTracks[0] ??
  null;

async function shape(reel) {
  const { media, audioTracks, audioTrackPath, ...rest } = reel;
  const audioPath = reel.mediaType === 'AUDIO' ? narrationOf(reel)?.audioPath : audioTrackPath;

  const [videoUrl, thumbnailUrl, audioUrl, images] = await Promise.all([
    s3.presignGet(reel.videoPath),
    s3.presignGet(reel.thumbnailPath),
    s3.presignGet(audioPath),
    Promise.all(media.map(async (m) => ({ path: m.imagePath, url: await s3.presignGet(m.imagePath) }))),
  ]);

  return { ...rest, videoUrl, thumbnailUrl, audioPath: audioPath ?? null, audioUrl, images };
}

async function load(id, db = prisma) {
  const reel = await db.reel.findUnique({ where: { id }, include: EDIT_INCLUDE });
  if (!reel) throw notFound('Reel');
  return reel;
}

// ── Writing ────────────────────────────────────────────────────────────────

// Foreign keys that do not exist would otherwise surface as a database error.
async function assertReferences(body) {
  const checks = [
    body.creatorId && ['Creator', prisma.creatorProfile.findFirst({ where: { id: body.creatorId, status: 'APPROVED' } })],
    body.verseId && ['Verse', prisma.verse.findUnique({ where: { id: body.verseId } })],
    body.mantraId && ['Mantra', prisma.mantra.findUnique({ where: { id: body.mantraId } })],
    body.deityId && ['Deity', prisma.deity.findUnique({ where: { id: body.deityId } })],
  ].filter(Boolean);

  const found = await Promise.all(checks.map(([, lookup]) => lookup));
  const bad = checks.filter((_, i) => !found[i]).map(([name]) => name);
  if (bad.length) throw badRequest(`Unknown or unapproved: ${bad.join(', ')}`);
}

// The feed's "N reels" figure. Rebuildable from Reel at any time, so it is
// recounted rather than nudged up and down.
async function syncReelCount(...creatorIds) {
  for (const id of new Set(creatorIds.filter(Boolean))) {
    const reelCount = await prisma.reel.count({ where: { creatorId: id, status: 'PUBLISHED' } });
    await prisma.creatorProfile.update({ where: { id }, data: { reelCount } });
  }
}

// Applies the parts of a body that are not plain Reel columns. `reel` is the row
// as it stands after the columns were written.
async function writeChildren(tx, reel, { audioPath, images }) {
  if (images !== undefined) {
    await tx.reelMedia.deleteMany({ where: { reelId: reel.id } });
    await tx.reelMedia.createMany({
      data: images.map((imagePath, displayOrder) => ({ reelId: reel.id, imagePath, displayOrder })),
    });
  }

  if (audioPath !== undefined && reel.mediaType === 'AUDIO') {
    const audioTracks = await tx.reelAudioTrack.findMany({ where: { reelId: reel.id } });
    const existing = narrationOf({ ...reel, audioTracks });

    if (!audioPath) {
      if (existing) await tx.reelAudioTrack.delete({ where: { id: existing.id } });
    } else {
      const data = { audioPath, languageCode: reel.languageCode || SOURCE_LANGUAGE, durationMs: reel.durationMs };
      if (existing) await tx.reelAudioTrack.update({ where: { id: existing.id }, data });
      else await tx.reelAudioTrack.create({ data: { ...data, reelId: reel.id } });
    }
  }
}

/** GET /api/admin/reels */
export const list = async (req, res) => {
  const { q, status, mediaType, creatorId } = req.valid.query;

  const { items, page } = await paginate(prisma.reel, {
    where: {
      ...(q ? { caption: { contains: q, mode: 'insensitive' } } : {}),
      ...(status ? { status } : {}),
      ...(mediaType ? { mediaType } : {}),
      ...(creatorId ? { creatorId } : {}),
    },
    orderBy: readSort(req.valid.query, SORT_COLUMNS, [{ createdAt: 'desc' }]),
    include: {
      creator: { select: { id: true, displayName: true } },
      verse: { select: { verseId: true } },
    },
    query: req.valid.query,
  });

  return paginated(res, await s3.presignList(items, ['thumbnailPath']), page);
};

/** GET /api/admin/reels/creators */
export const creators = async (req, res) => {
  const rows = await prisma.creatorProfile.findMany({
    where: { status: 'APPROVED' },
    select: { id: true, displayName: true, isVerified: true, reelCount: true, user: { select: { email: true } } },
    orderBy: { displayName: 'asc' },
  });

  return ok(
    res,
    rows.map(({ user, ...creator }) => ({ ...creator, isOfficial: user.email === OFFICIAL_CREATOR_EMAIL }))
  );
};

/** GET /api/admin/reels/:id */
export const get = async (req, res) => ok(res, await shape(await load(req.valid.params.id)));

/** POST /api/admin/reels */
export const create = async (req, res) => {
  const { audioPath, images, ...columns } = req.valid.body;
  assertKeys(req.valid.body, null);
  await assertReferences(columns);

  if (audioPath !== undefined && columns.mediaType !== 'AUDIO') columns.audioTrackPath = audioPath;

  const reel = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.create({ data: { ...columns, status: 'DRAFT' } });
    await writeChildren(tx, row, { audioPath, images });
    return row;
  });

  await audit.record(req, {
    action: 'reel.create',
    entityType: 'Reel',
    entityId: reel.id,
    after: { mediaType: reel.mediaType, creatorId: reel.creatorId },
  });

  return created(res, await shape(await load(reel.id)));
};

/** PATCH /api/admin/reels/:id */
export const update = async (req, res) => {
  const before = await load(req.valid.params.id);
  const { audioPath, images, ...columns } = req.valid.body;

  assertKeys(req.valid.body, before);
  await assertReferences(columns);

  const mediaType = columns.mediaType ?? before.mediaType;
  if (audioPath !== undefined && mediaType !== 'AUDIO') columns.audioTrackPath = audioPath;

  // The live-reel check runs inside the transaction so a failure rolls the edit
  // back — a published reel must never be left pointing at a missing file.
  const after = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.update({ where: { id: before.id }, data: columns });
    await writeChildren(tx, row, { audioPath, images });
    if (before.status === 'PUBLISHED') {
      await assertShowable(await load(before.id, tx), mediaOf(before).keys);
    }
    return row;
  });

  await syncReelCount(before.creatorId, after.creatorId);

  await audit.record(req, {
    action: 'reel.update',
    entityType: 'Reel',
    entityId: before.id,
    before: { caption: before.caption, verseId: before.verseId, creatorId: before.creatorId },
    after: { caption: after.caption, verseId: after.verseId, creatorId: after.creatorId },
  });

  return ok(res, await shape(await load(before.id)));
};

/** POST /api/admin/reels/:id/publish */
export const publish = async (req, res) => {
  const { isPublished } = req.valid.body;
  const reel = await load(req.valid.params.id);

  const data = { status: 'DRAFT' };
  if (isPublished) {
    if (reel.creator.status !== 'APPROVED') throw badRequest('The creator is not approved');
    await assertShowable(reel);
    Object.assign(data, {
      status: 'PUBLISHED',
      publishedAt: new Date(),
      reviewedById: req.auth.user.id,
      reviewedAt: new Date(),
      rejectionReason: null,
    });
  }

  await prisma.reel.update({ where: { id: reel.id }, data });
  await syncReelCount(reel.creatorId);

  await audit.record(req, {
    action: isPublished ? 'reel.publish' : 'reel.unpublish',
    entityType: 'Reel',
    entityId: reel.id,
    before: { status: reel.status },
    after: { status: data.status },
  });

  return ok(res, await shape(await load(reel.id)));
};

/** DELETE /api/admin/reels/:id */
export const remove = async (req, res) => {
  const reel = await prisma.reel.findUnique({ where: { id: req.valid.params.id } });
  if (!reel) throw notFound('Reel');
  if (reel.status === 'PUBLISHED') throw badRequest('Unpublish the reel before deleting it');

  await prisma.reel.delete({ where: { id: reel.id } });
  await audit.record(req, {
    action: 'reel.delete',
    entityType: 'Reel',
    entityId: reel.id,
    before: { caption: reel.caption, creatorId: reel.creatorId },
  });

  return noContent(res);
};
