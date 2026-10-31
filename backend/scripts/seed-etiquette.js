// Puts the English devotee etiquette in the database.
//
//   npm run seed:etiquette
//
// Safe to run again: a missing item is added, and an item already there is left as it is, except that a blank field
// (an author, say) is filled from prisma/seed/etiquette/. Whether an item is shown is never changed by this.

import { prisma } from '../config/database.js';
import { seedEtiquette, etiquetteItems } from '../prisma/seed/etiquette/index.js';

const { created, filled, kept } = await seedEtiquette(prisma);
const excluded = etiquetteItems.filter((item) => item.status === 'EXCLUDED').length;
console.log(
  `${etiquetteItems.length} etiquette items in the seed (${etiquetteItems.length - excluded} to show, ${excluded} kept out): ` +
    `${created} added, ${filled} with a blank field filled in, ${kept} left as they are`
);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
