// Publishes one AUDIO reel per Bhagavad Gita verse, using the Sanskrit
// recitation audio migrated from the old bucket by import-legacy-media.js
// (legacy/bhagvat-gita/mp3/chpaters-sloks/<chapter>/<verse>.mp3 — see that
// script and scripts/README.md).
//
// Unlike seed-reels.js, this is not dev-only demo data: the reels are real
// content, published under one real, platform-owned creator — "HariHariBol" —
// rather than an invented person. It runs in any environment for that reason.
//
// Idempotent and resumable, the bar scripts/README.md sets: one reel per
// (creator, verse), found by that pair rather than created fresh each run; its
// audio track is upserted by (reel, languageCode) the same way. A verse
// without a matching mp3 in the bucket is skipped, not failed — the audio
// import and the verse content are two separate pipelines and do not always
// cover exactly the same verses.
//
// Usage:
//   node scripts/seed-bg-verse-reels.js          # chapter 2 — the pilot
//   node scripts/seed-bg-verse-reels.js 5        # one chapter
//   node scripts/seed-bg-verse-reels.js all      # every chapter with audio

import { prisma } from '../config/database.js';
import * as s3 from '../services/s3.js';

const BOOK_NUMBER = 1; // Bhagavad Gita — see the verseId comment on Verse

const OFFICIAL_CREATOR = {
  email: 'official@hariharibol.com',
  name: 'HariHariBol',
  displayName: 'HariHariBol',
  bio: 'Official Bhagavad Gita verse recitations — Sanskrit, chapter by chapter.',
};

const log = (...args) => console.log('  ', ...args);

function audioKey(chapterNumber, verseNumber) {
  return `legacy/bhagvat-gita/mp3/chpaters-sloks/${chapterNumber}/${verseNumber}.mp3`;
}

async function ensureOfficialCreator() {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  if (!role) throw new Error('No "user" role — run `npm run seed` first.');

  // Not a real sign-in target: no Google/Apple token will ever carry this
  // providerUserId, so nobody can end up signed in as the platform's own
  // channel by coincidence.
  const user = await prisma.user.upsert({
    where: { email: OFFICIAL_CREATOR.email },
    update: { name: OFFICIAL_CREATOR.name },
    create: {
      email: OFFICIAL_CREATOR.email,
      name: OFFICIAL_CREATOR.name,
      authProvider: 'GOOGLE',
      providerUserId: 'official-hariharibol',
      roleId: role.id,
      appLanguage: 'en',
      readingLanguage: 'en',
      mantraLanguage: 'sa',
    },
  });

  const fields = {
    displayName: OFFICIAL_CREATOR.displayName,
    bio: OFFICIAL_CREATOR.bio,
    isVerified: true,
    status: 'APPROVED',
  };

  return prisma.creatorProfile.upsert({
    where: { userId: user.id },
    update: fields,
    create: { userId: user.id, ...fields, approvedAt: new Date() },
  });
}

function buildCaption(verse, translationText) {
  const citation = `BG ${verse.chapterNumber}.${verse.verseNumber}${
    verse.verseNumberEnd ? `-${verse.verseNumberEnd}` : ''
  }`;
  const parts = [];
  if (verse.sanskrit) parts.push(verse.sanskrit.trim());
  if (translationText) parts.push(translationText.trim());
  return parts.length ? `${parts.join(' — ')} ${citation}` : citation;
}

async function ensureReel(verse, translationText, creator, thumbnailPath, chapterNumber) {
  const key = audioKey(chapterNumber, verse.verseNumber);
  if (!(await s3.objectExists(key))) return null; // no recitation for this verse

  const existing = await prisma.reel.findFirst({
    where: { creatorId: creator.id, verseId: verse.id },
    select: { id: true },
  });

  const fields = {
    mediaType: 'AUDIO',
    thumbnailPath,
    caption: buildCaption(verse, translationText),
    tags: ['bhagavad-gita', `chapter-${chapterNumber}`, 'sloka', 'recitation'],
    languageCode: 'sa',
    verseId: verse.id,
    status: 'PUBLISHED',
    publishedAt: new Date(),
  };

  const reel = existing
    ? await prisma.reel.update({ where: { id: existing.id }, data: fields })
    : await prisma.reel.create({ data: { creatorId: creator.id, ...fields } });

  await prisma.reelAudioTrack.upsert({
    where: { reelId_languageCode: { reelId: reel.id, languageCode: 'sa' } },
    update: { audioPath: key },
    create: { reelId: reel.id, languageCode: 'sa', audioPath: key },
  });

  return reel;
}

async function chaptersWithVerses(chapterArg) {
  if (chapterArg === 'all') {
    const rows = await prisma.verse.findMany({
      where: { bookNumber: BOOK_NUMBER },
      distinct: ['chapterNumber'],
      select: { chapterNumber: true },
      orderBy: { chapterNumber: 'asc' },
    });
    return rows.map((r) => r.chapterNumber).filter((n) => n != null);
  }
  return [chapterArg];
}

async function main() {
  const arg = process.argv[2];
  const chapterArg = arg === 'all' ? 'all' : Number(arg) || 2;

  console.log(`Seeding Bhagavad Gita verse reels (${chapterArg === 'all' ? 'all chapters' : `chapter ${chapterArg}`})...\n`);

  const book = await prisma.book.findUnique({
    where: { bookNumber: BOOK_NUMBER },
    select: { id: true, coverImagePath: true },
  });
  if (!book) throw new Error('Bhagavad Gita book row not found — run the prisma seed and import-bg.js first.');

  const translator = await prisma.translator.findUnique({ where: { slug: 'prabhupada' } });

  const creator = await ensureOfficialCreator();
  log(`creator ${creator.displayName}`);

  const chapters = await chaptersWithVerses(chapterArg);
  if (!chapters.length) {
    console.error(`No verses found for chapter ${chapterArg} of book ${BOOK_NUMBER}.`);
    process.exit(1);
  }

  let created = 0;
  let skippedNoAudio = 0;

  for (const chapterNumber of chapters) {
    const verses = await prisma.verse.findMany({
      where: { bookId: book.id, chapterNumber },
      orderBy: { verseNumber: 'asc' },
    });

    for (const verse of verses) {
      const translation = translator
        ? await prisma.verseTranslation.findFirst({
            where: { verseId: verse.id, translatorId: translator.id, languageCode: 'en', type: 'TRANSLATION' },
            select: { meaning: true },
          })
        : null;

      const reel = await ensureReel(verse, translation?.meaning, creator, book.coverImagePath, chapterNumber);
      if (!reel) {
        skippedNoAudio++;
        continue;
      }
      created++;
    }

    log(`chapter ${chapterNumber}: ${verses.length} verse(s) processed`);
  }

  const reelCount = await prisma.reel.count({ where: { creatorId: creator.id, status: 'PUBLISHED' } });
  await prisma.creatorProfile.update({ where: { id: creator.id }, data: { reelCount } });

  console.log(`\nDone. ${created} reel(s) published/updated, ${skippedNoAudio} verse(s) skipped (no recitation audio).`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
