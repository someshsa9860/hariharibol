// Works out `User.sampradaya` for everyone who chanted before it existed.
//
// The column is filled as people chant (services/sampradaya.js), so a new
// deployment starts with it empty for anyone whose last chanting predates it —
// they would stay empty until their next new day of chanting. This reads their
// history and fills it in. Safe to run again: it only writes what changed, and
// rebuilding from ChantSession always gives the same answer.
//
// Usage (from backend/):
//   npm run backfill:sampradaya

import { prisma } from '../config/database.js';
import * as sampradaya from '../services/sampradaya.js';

async function run() {
  // Only people who have chanted a mantra at all — nobody else can have one.
  const chanters = await prisma.chantSession.findMany({
    where: { mantraId: { not: null } },
    distinct: ['userId'],
    select: { userId: true },
  });

  const tally = {};
  for (const { userId } of chanters) {
    const result = (await sampradaya.refresh(userId)) ?? 'none yet';
    tally[result] = (tally[result] || 0) + 1;
  }

  console.log(`Checked ${chanters.length} people who have chanted a mantra:`);
  for (const [name, count] of Object.entries(tally).sort()) console.log(`  ${name}: ${count}`);
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
