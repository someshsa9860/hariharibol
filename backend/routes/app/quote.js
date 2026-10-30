import { createRouter, schemas, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/quote.js';

const router = createRouter({
  tag: 'Quotes',
  prefix: '/quotes',
  description:
    'Short, well-known quotations shown on the chanting page, one after every 12 chants, each with its speaker, reference and a link ' +
    'to where it can be checked. Only published quotes are served, in the reader’s reading language (English where a translation ' +
    'does not exist yet).',
});

router.get(
  '/',
  {
    summary: 'The quotes',
    description: 'All published quotes in order, and a `version` that changes when any of them (or a translation) does.',
    limit: 'read',
    query: z.object({ languages: schemas.languages }),
    responds: { 200: 'The version and the quotes' },
  },
  controller.list
);

export default router;
