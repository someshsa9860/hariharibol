// A reader making their own reel from the share studio.
//
// The picture is the card they designed; the music, if any, is a file from their
// phone. Two steps, like the chat's pictures: the file goes up on its own
// (`uploadMedia`), then `make` names the keys it got back.
//
// Making a reel makes the reader a creator, and approves them on the spot — this
// path deliberately has no moderation queue (the product decision for the share
// studio; see "Reels — what is not there" in the root CLAUDE.md). A creator an
// admin has REJECTED is the one exception and stays out. Reports on a reel still
// work as they do for any other.

import { prisma } from '../../config/database.js';
import * as s3 from '../../services/s3.js';
import { sniffImage, sniffAudio } from '../../utils/reel-media.js';
import { assertKey, assertShowable, syncReelCount } from '../admin/reel.js';
import { ok, created } from '../../utils/respond.js';
import { AppError, badRequest, forbidden } from '../../utils/errors.js';

export const IMAGE_MAX_BYTES = 8 * 1024 * 1024;
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
// A reader can make this many reels a day; enough for play, not enough to flood the feed.
export const DAILY_LIMIT = 20;

const AUDIO_TYPES = {
  'audio/mpeg': 'audio/mpeg',
  'audio/mp3': 'audio/mpeg',
  'audio/mp4': 'audio/mp4',
  'audio/x-m4a': 'audio/mp4',
  'audio/m4a': 'audio/mp4',
  'audio/aac': 'audio/aac',
  'audio/wav': 'audio/wav',
  'audio/x-wav': 'audio/wav',
  'audio/wave': 'audio/wav',
};

/** POST /api/app/reels/media?kind=image|audio — the body is the file. Returns the key to name in `make`. */
export const uploadMedia = async (req, res) => {
  const { kind } = req.valid.query;
  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw badRequest('No file was sent');

  let contentType;
  if (kind === 'image') {
    contentType = sniffImage(bytes);
  } else {
    const declared = AUDIO_TYPES[String(req.get('content-type') || '').split(';')[0].trim().toLowerCase()];
    // A phone often sends application/octet-stream for a file it picked, so the bytes decide.
    contentType = sniffAudio(bytes) ?? (declared && bytes.length > 1024 ? declared : null);
  }
  if (!contentType) throw new AppError(422, 'MEDIA_NOT_USABLE', kind === 'image' ? 'That is not a usable picture' : 'That is not a usable music file');

  const key = s3.buildKey(kind === 'image' ? 'reelImage' : 'reelAudio', contentType);
  await s3.putObject(key, bytes, contentType);
  return ok(res, { key, url: await s3.presignGet(key) });
};

// The reader's creator profile, approved. Made on first use.
async function approvedCreator(user) {
  const existing = await prisma.creatorProfile.findUnique({ where: { userId: user.id } });
  if (existing?.status === 'REJECTED') throw forbidden('You cannot post reels');
  if (existing?.status === 'APPROVED') return existing;

  const data = { status: 'APPROVED', approvedAt: new Date(), rejectionReason: null };
  if (existing) return prisma.creatorProfile.update({ where: { id: existing.id }, data });
  return prisma.creatorProfile.create({
    data: { userId: user.id, displayName: (user.name || '').trim().slice(0, 60) || 'HariHariBol devotee', ...data },
  });
}

/** POST /api/app/reels/make — publish a reel from an uploaded picture and optional music. */
export const make = async (req, res) => {
  const user = req.auth.user;
  const { imageKey, audioKey, caption, tags, languageCode, mantraSlug } = req.valid.body;

  assertKey(imageKey, ['reelImage']);
  if (audioKey) assertKey(audioKey, ['reelAudio']);

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const today = await prisma.reel.count({ where: { creator: { userId: user.id }, createdAt: { gte: since } } });
  if (today >= DAILY_LIMIT) throw new AppError(429, 'REEL_LIMIT', 'You have made a lot of reels today. Please try again tomorrow.');

  // A missing file is a black screen in the feed, so nothing is published until both are in storage.
  await assertShowable({ mediaType: 'IMAGE', media: [{ imagePath: imageKey }], audioTracks: [], audioTrackPath: audioKey ?? null, thumbnailPath: imageKey });

  // A reel is public, so it can name a catalogue mantra but never a reader's private one.
  const mantra = mantraSlug ? await prisma.mantra.findFirst({ where: { slug: mantraSlug, mantraType: 'PUBLIC' }, select: { id: true } }) : null;
  const creator = await approvedCreator(user);

  const now = new Date();
  const reel = await prisma.$transaction(async (tx) => {
    const row = await tx.reel.create({
      data: {
        creatorId: creator.id,
        mediaType: 'IMAGE',
        thumbnailPath: imageKey,
        audioTrackPath: audioKey ?? null,
        caption: caption || null,
        tags: tags ?? [],
        languageCode: languageCode ?? null,
        mantraId: mantra?.id ?? null,
        status: 'PUBLISHED',
        publishedAt: now,
        reviewedAt: now,
      },
    });
    await tx.reelMedia.create({ data: { reelId: row.id, imagePath: imageKey, displayOrder: 0 } });
    return row;
  });

  await syncReelCount(creator.id);
  return created(res, { id: reel.id, creatorId: creator.id });
};
