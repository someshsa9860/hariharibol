// Puts the English devotee etiquette in the database.
//
//   npm run seed:etiquette
//
// Safe to run again: a missing item is added, an item an admin has edited (`isEdited`) is left alone, and any other
// item is brought up to date with prisma/seed/etiquette/. Whether an item is shown is never changed by this.

import { prisma } from '../config/database.js';
import { seedEtiquette, etiquetteItems } from '../prisma/seed/etiquette/index.js';

const { created, updated, kept, unchanged } = await seedEtiquette(prisma);
const excluded = etiquetteItems.filter((item) => item.status === 'EXCLUDED').length;
console.log(
  `${etiquetteItems.length} etiquette items in the seed (${etiquetteItems.length - excluded} to show, ${excluded} kept out): ` +
    `${created} added, ${updated} brought up to date, ${unchanged} unchanged, ${kept} edited by an admin and left alone`
);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
