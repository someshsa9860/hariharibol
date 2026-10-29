// Puts the English quotes shown on the chanting page in the database.
//
//   npm run seed:quotes
//
// Safe to run again: a missing quote is added, a quote an admin has edited (`isEdited`) is left alone, and any other
// quote is brought up to date with prisma/seed/quotes/. Whether a quote is shown is never changed by this.

import { prisma } from '../config/database.js';
import { seedQuotes, quoteItems } from '../prisma/seed/quotes/index.js';

const { created, updated, kept, unchanged } = await seedQuotes(prisma);
console.log(`${quoteItems.length} quotes in the seed: ${created} added, ${updated} brought up to date, ${unchanged} unchanged, ${kept} edited by an admin and left alone`);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
