// Draws the daily sloka push's picture for some verses, so the design can be
// looked at without sending a push. Reads the verses from the database and
// writes one JPEG each — nothing is uploaded.
//
// Usage (from backend/):
//   node scripts/sloka-card-preview.js                  a spread of short, long and compound verses
//   node scripts/sloka-card-preview.js 1.2.47 2.1.1.1   the verses with these ids
//
// Writes to storage/sloka-card-preview/<verseId>.jpg.

import fs from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import { renderCard } from '../services/sloka-card.js';

const OUT_DIR = path.join(import.meta.dirname, '..', 'storage', 'sloka-card-preview');

// Gita 2.47 and 18.66, the speaker line of 1.1, a Bhagavatam verse of two
// lines, the long opening verse, a compound of three, and the longest verse
// there is — the one that has to be cut.
const DEMO_VERSE_IDS = ['1.2.47', '1.18.66', '1.1.1', '2.9.6.22', '2.1.1.1', '2.7.12.26-28'];

async function run() {
  const ids = process.argv.slice(2);
  const verseIds = ids.length ? ids : DEMO_VERSE_IDS;

  if (!ids.length) {
    const [longest] = await prisma.$queryRaw`
      SELECT "verseId" FROM "Verse" WHERE sanskrit IS NOT NULL ORDER BY length(sanskrit) DESC LIMIT 1`;
    if (longest) verseIds.push(longest.verseId);
  }

  await fs.mkdir(OUT_DIR, { recursive: true });
  for (const verseId of verseIds) {
    const verse = await prisma.verse.findUnique({
      where: { verseId },
      select: {
        verseId: true,
        sanskrit: true,
        cantoNumber: true,
        chapterNumber: true,
        verseNumber: true,
        verseNumberEnd: true,
        book: { select: { title: true } },
      },
    });
    const jpeg = verse && (await renderCard(verse));
    if (!jpeg) {
      console.log(`${verseId}: no verse text to draw`);
      continue;
    }
    const file = path.join(OUT_DIR, `${verseId}.jpg`);
    await fs.writeFile(file, jpeg);
    console.log(`${verseId}: ${file} (${Math.round(jpeg.length / 1024)} KB)`);
  }
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    redis.disconnect();
    publisher.disconnect();
  });
