// Demo creators and reels, for local development.
//
//   npm run seed:reels
//
// Deliberately **not** part of `npm run seed`. That seed states plainly that it
// never touches user data, and a creator is a capability on a real User — so
// seeding reels means inventing people, which is exactly the kind of thing
// that should not run on a deploy. This refuses to run outside development for
// the same reason.
//
// Idempotent and resumable, the bar scripts/README.md sets: creators are keyed
// on a fixed demo email, reels on a fixed slug held in the caption index, so a
// second run updates rather than duplicates.
//
// The videos are generated with ffmpeg from the deity images the main seed
// already put in storage/, so the feed is genuinely playable on a laptop with
// no network and no media bucket. Without ffmpeg on PATH the video reels are
// skipped and the image ones still seed — the feed works either way.

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import * as s3 from '../services/s3.js';

const run = promisify(execFile);

if (!env.isDevelopment) {
  console.error('seed-reels only runs in development — it invents user accounts.');
  process.exit(1);
}

const log = (...args) => console.log('  ', ...args);

// ── The demo cast ───────────────────────────────────────────────────────────
// Emails are on `example.invalid`, which RFC 6761 reserves and which can never
// resolve — so nothing here can accidentally mail a real person.

const CREATORS = [
  {
    email: 'gopal.das@example.invalid',
    name: 'Gopal Das',
    displayName: 'Gopal Das',
    bio: 'Sharing the Bhagavatam one verse at a time. Mayapur.',
    isVerified: true,
    deity: 'krishna',
  },
  {
    email: 'radhika.devi@example.invalid',
    name: 'Radhika Devi',
    displayName: 'Radhika Devi',
    bio: 'Kirtan, and the stories behind the songs.',
    isVerified: false,
    deity: 'radha',
  },
  {
    email: 'jagannath.seva@example.invalid',
    name: 'Jagannath Seva',
    displayName: 'Jagannath Seva',
    bio: 'Puri. Rath Yatra, prasadam, and the Lord who has no hands.',
    isVerified: true,
    deity: 'jagannath',
  },
];

// `slug` is not a column — it is carried in `tags` so a re-run can find the
// row it wrote last time without adding a column for the sake of a dev script.
const REELS = [
  {
    slug: 'demo-mahamantra',
    creator: 'gopal.das@example.invalid',
    mediaType: 'VIDEO',
    deity: 'krishna',
    caption: 'Hare Krishna Hare Krishna, Krishna Krishna Hare Hare — one round, together. 🙏',
    tags: ['mahamantra', 'japa', 'chanting'],
    languageCode: 'en',
    mantraSlug: 'hare-krishna-mahamantra',
  },
  {
    slug: 'demo-bg-2-47',
    creator: 'gopal.das@example.invalid',
    mediaType: 'VIDEO',
    deity: 'krishna',
    caption:
      'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन — you have a right to the work, never to its fruits. BG 2.47',
    tags: ['bhagavad-gita', 'karma-yoga'],
    languageCode: 'hi',
    verseId: '1.2.47',
  },
  {
    slug: 'demo-radha-kirtan',
    creator: 'radhika.devi@example.invalid',
    mediaType: 'VIDEO',
    deity: 'radha',
    caption: 'Evening kirtan. Turn the sound on. 🎶',
    tags: ['kirtan', 'bhajan'],
    languageCode: null,
  },
  {
    slug: 'demo-tulsi',
    creator: 'radhika.devi@example.invalid',
    mediaType: 'IMAGE',
    deity: 'lakshmi',
    caption: 'Tulsi puja this morning. Swipe →',
    tags: ['puja', 'tulsi', 'seva'],
    languageCode: 'en',
    images: ['lakshmi', 'radha', 'vitthal'],
  },
  {
    slug: 'demo-rath-yatra',
    creator: 'jagannath.seva@example.invalid',
    mediaType: 'IMAGE',
    deity: 'jagannath',
    caption: 'Rath Yatra, Puri. Jai Jagannath!',
    tags: ['rath-yatra', 'puri', 'festival'],
    languageCode: 'en',
    images: ['jagannath', 'vishnu'],
  },
  {
    slug: 'demo-vitthal',
    creator: 'jagannath.seva@example.invalid',
    mediaType: 'VIDEO',
    deity: 'vitthal',
    caption: 'Vitthala Vitthala — Pandharpur wari, hands on hips, waiting on the brick.',
    tags: ['vitthal', 'wari', 'varkari'],
    languageCode: 'mr',
  },
];

const COMMENTS = [
  'Hari bol! 🙏',
  'Needed to hear this today. Thank you Prabhu.',
  'Which canto is this from?',
  'Beautiful. Please post more of these.',
  'Jai Sri Krishna 🦚',
  'Chanting along from Mumbai.',
];

// ── Media ───────────────────────────────────────────────────────────────────

const DEITY_IMAGE = (slug) => `deities/images/${slug}.jpg`;

let ffmpegAvailable = null;

async function hasFfmpeg() {
  if (ffmpegAvailable !== null) return ffmpegAvailable;
  try {
    await run('ffmpeg', ['-version']);
    ffmpegAvailable = true;
  } catch {
    ffmpegAvailable = false;
    log('ffmpeg not found — video reels will be seeded without a playable file.');
  }
  return ffmpegAvailable;
}

const STORAGE_ROOT = path.join(import.meta.dirname, '..', 'storage');

/**
 * A short 9:16 clip made from a still: the image slowly zooms, over silence.
 *
 * Real enough to exercise the player — aspect ratio, duration, looping, the
 * mute button — without checking a binary into the repository or needing a
 * network to fetch one.
 */
async function makeVideo(deitySlug, seconds = 8) {
  if (!(await hasFfmpeg())) return null;

  const source = path.join(STORAGE_ROOT, DEITY_IMAGE(deitySlug));
  try {
    await fs.access(source);
  } catch {
    log(`no source image for ${deitySlug} — run npm run seed first`);
    return null;
  }

  const out = path.join(os.tmpdir(), `reel-${deitySlug}-${seconds}s.mp4`);
  const frames = seconds * 30;

  await run('ffmpeg', [
    '-y',
    '-loop', '1',
    '-i', source,
    '-f', 'lavfi',
    '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
    // Fill a 1080x1920 frame: cover, crop the overflow, then a slow push in.
    '-vf',
    `scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,` +
      `zoompan=z='min(zoom+0.0006,1.2)':d=${frames}:s=1080x1920:fps=30`,
    '-c:v', 'libx264',
    '-preset', 'veryfast',
    '-pix_fmt', 'yuv420p',
    '-c:a', 'aac',
    '-shortest',
    '-t', String(seconds),
    '-movflags', '+faststart',
    out,
  ]);

  return out;
}

// Uploads through services/s3.js, so this lands under storage/ locally and on
// the real bucket if credentials happen to be configured — same as every other
// script. The key is derived from the demo slug rather than random, so a
// re-run overwrites its own file instead of littering.
async function putMedia(kind, slug, filePath, contentType) {
  const extension = contentType === 'video/mp4' ? 'mp4' : 'jpg';
  const key = `${s3.PREFIXES[kind]}/${slug}.${extension}`;
  await s3.putObject(key, await fs.readFile(filePath), contentType);
  return key;
}

// ── Seeding ─────────────────────────────────────────────────────────────────

async function ensureUser(person) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  if (!role) throw new Error('No "user" role — run `npm run seed` first.');

  const handle = person.email.split('@')[0];

  return prisma.user.upsert({
    where: { email: person.email },
    update: { name: person.name },
    create: {
      email: person.email,
      name: person.name,
      // A real account is created by verifying a Google or Apple token, and
      // both columns are required because of it. These are demo rows that no
      // provider will ever match: the id is prefixed so it is obvious in the
      // database which accounts came from this script.
      authProvider: 'GOOGLE',
      providerUserId: `demo-reels-${handle}`,
      roleId: role.id,
      appLanguage: 'en',
      readingLanguage: 'en',
      mantraLanguage: 'sa',
    },
  });
}

async function ensureCreator(person) {
  const user = await ensureUser(person);

  const avatarKey = await putMedia(
    'creatorAvatar',
    person.email.split('@')[0],
    path.join(STORAGE_ROOT, DEITY_IMAGE(person.deity)),
    'image/jpeg'
  ).catch(() => null);

  const fields = {
    displayName: person.displayName,
    bio: person.bio,
    avatarPath: avatarKey,
    isVerified: person.isVerified,
    status: 'APPROVED',
    approvedAt: new Date(),
  };

  return prisma.creatorProfile.upsert({
    where: { userId: user.id },
    update: fields,
    create: { userId: user.id, ...fields },
  });
}

async function ensureReel(spec, creatorsByEmail, deitiesBySlug) {
  const creator = creatorsByEmail.get(spec.creator);

  // The demo slug lives in tags, so this is how a re-run finds its own row.
  const existing = await prisma.reel.findFirst({
    where: { creatorId: creator.id, tags: { has: spec.slug } },
    select: { id: true },
  });

  let videoPath = null;
  let thumbnailPath = null;
  let durationMs = null;

  if (spec.mediaType === 'VIDEO') {
    const file = await makeVideo(spec.deity);
    if (file) {
      videoPath = await putMedia('reelVideo', spec.slug, file, 'video/mp4');
      durationMs = 8000;
    }
  }

  // Every reel gets a thumbnail, video or not — it is what the saved-reels
  // grid and the share card render, and a poster frame is what the player
  // shows before the first frame decodes.
  thumbnailPath = await putMedia(
    'reelThumbnail',
    spec.slug,
    path.join(STORAGE_ROOT, DEITY_IMAGE(spec.deity)),
    'image/jpeg'
  ).catch(() => null);

  const verse = spec.verseId
    ? await prisma.verse.findUnique({ where: { verseId: spec.verseId }, select: { id: true } })
    : null;
  const mantra = spec.mantraSlug
    ? await prisma.mantra.findUnique({ where: { slug: spec.mantraSlug }, select: { id: true } })
    : null;

  const fields = {
    mediaType: spec.mediaType,
    videoPath,
    thumbnailPath,
    durationMs,
    width: 1080,
    height: 1920,
    caption: spec.caption,
    // The slug is kept in tags — see the note on REELS.
    tags: [spec.slug, ...spec.tags],
    languageCode: spec.languageCode,
    verseId: verse?.id ?? null,
    mantraId: mantra?.id ?? null,
    deityId: deitiesBySlug.get(spec.deity)?.id ?? null,
    status: 'PUBLISHED',
    publishedAt: new Date(),
  };

  const reel = existing
    ? await prisma.reel.update({ where: { id: existing.id }, data: fields })
    : await prisma.reel.create({ data: { creatorId: creator.id, ...fields } });

  if (spec.mediaType === 'IMAGE') {
    await prisma.reelMedia.deleteMany({ where: { reelId: reel.id } });
    for (const [index, deitySlug] of (spec.images || []).entries()) {
      const key = await putMedia(
        'reelImage',
        `${spec.slug}-${index}`,
        path.join(STORAGE_ROOT, DEITY_IMAGE(deitySlug)),
        'image/jpeg'
      ).catch(() => null);
      if (!key) continue;
      await prisma.reelMedia.create({
        data: { reelId: reel.id, imagePath: key, displayOrder: index },
      });
    }
  }

  return reel;
}

/**
 * Cross-engagement between the demo accounts, so counters are not all zero and
 * the ranking in the feed has something to actually sort on.
 *
 * Written through the same two-step every controller uses — the row, then the
 * counter — rather than setting the counts directly, because a seed that
 * produces a state the API could never produce is a seed that hides bugs.
 */
async function seedEngagement(reels, creators) {
  const users = creators.map((creator) => creator.userId);
  let likes = 0;
  let comments = 0;

  for (const [index, reel] of reels.entries()) {
    for (const [position, userId] of users.entries()) {
      const isOwn = creators.find((c) => c.userId === userId)?.id === reel.creatorId;
      if (isOwn) continue;

      // Deterministic rather than random, so re-running does not slowly
      // inflate every count.
      if ((index + position) % 2 === 0) {
        const { count } = await prisma.reelLike.createMany({
          data: [{ userId, reelId: reel.id }],
          skipDuplicates: true,
        });
        if (count) {
          await prisma.reel.update({
            where: { id: reel.id },
            data: { likeCount: { increment: 1 } },
          });
          likes += count;
        }
      }

      const text = COMMENTS[(index + position) % COMMENTS.length];
      const already = await prisma.reelComment.findFirst({
        where: { reelId: reel.id, userId, text },
        select: { id: true },
      });
      if (already) continue;

      await prisma.reelComment.create({ data: { reelId: reel.id, userId, text } });
      await prisma.reel.update({
        where: { id: reel.id },
        data: { commentCount: { increment: 1 } },
      });
      comments += 1;
    }
  }

  return { likes, comments };
}

async function main() {
  console.log('Seeding demo reels...\n');

  const deities = await prisma.deity.findMany({ select: { id: true, slug: true } });
  const deitiesBySlug = new Map(deities.map((d) => [d.slug, d]));
  if (!deitiesBySlug.size) {
    console.error('No deities found. Run `npm run seed` first.');
    process.exit(1);
  }

  const creatorsByEmail = new Map();
  for (const person of CREATORS) {
    const creator = await ensureCreator(person);
    creatorsByEmail.set(person.email, creator);
    log(`creator ${creator.displayName}`);
  }

  const reels = [];
  for (const spec of REELS) {
    const reel = await ensureReel(spec, creatorsByEmail, deitiesBySlug);
    reels.push(reel);
    log(`reel ${spec.slug} (${spec.mediaType}${reel.videoPath ? ', playable' : ''})`);
  }

  const creators = [...creatorsByEmail.values()];
  const { likes, comments } = await seedEngagement(reels, creators);
  log(`${likes} new likes, ${comments} new comments`);

  // reelCount on the profile is a cache like every other counter — rebuilt
  // here rather than incremented, since this script may have updated rows it
  // wrote on a previous run.
  for (const creator of creators) {
    const count = await prisma.reel.count({
      where: { creatorId: creator.id, status: 'PUBLISHED' },
    });
    await prisma.creatorProfile.update({ where: { id: creator.id }, data: { reelCount: count } });
  }

  console.log('\nDone.');
  console.log(
    '\nThese are demo accounts on example.invalid. The feed hides your own reels, so sign in\n' +
      'as yourself — not as one of these — to see all six.\n'
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
