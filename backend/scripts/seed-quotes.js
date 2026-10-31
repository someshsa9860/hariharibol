// Puts the English quotes shown on the chanting page in the database.
//
//   npm run seed:quotes
//
// Safe to run again: a missing quote is added, and a quote already there is left as it is, except that a blank field is
// filled from prisma/seed/quotes/. Whether a quote is shown is never changed by this.

import { prisma } from '../config/database.js';
import { seedQuotes, quoteItems } from '../prisma/seed/quotes/index.js';

const { created, filled, kept } = await seedQuotes(prisma);
console.log(`${quoteItems.length} quotes in the seed: ${created} added, ${filled} with a blank field filled in, ${kept} left as they are`);
await prisma.$disconnect();
process.exit(0); // the shared redis client would otherwise keep the process open
