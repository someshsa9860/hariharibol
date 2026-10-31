// Puts the prayers from public/prayers/json in the database, as drafts.
//
//   npm run seed:prayers
//
// Safe to run again: a prayer whose slug is already there is left as it is, verses and all. Nothing is published by this:
// the prayers stay DRAFT until an admin publishes them on the Prayers page.

import { prisma } from '../config/database.js';
import { seedPrayers, readPrayerFiles } from '../prisma/seed/prayers/index.js';

const { created, kept, verses } = await seedPrayers(prisma);
console.log(
  `${readPrayerFiles().length} prayer files: ${created} added as drafts (${verses} verses), ${kept} already in the database and left alone`
);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
