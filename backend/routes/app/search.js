import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/search.js';

const router = createRouter({
  tag: 'Search',
  prefix: '/search',
  description: 'One search across verses, mantras and books.',
});

router.get(
  '/',
  {
    summary: 'Search the library',
    description:
      'Matches Sanskrit, transliteration and translated meanings in the reader’s language, ' +
      'plus mantra and book titles. A dotted verse id such as 1.2.47 is treated as a direct ' +
      'lookup rather than a search — someone typing it wants that verse.',
    public: true,
    limit: 'read',
    query: z.object({
      q: z.string().trim().min(2).max(100),
      type: z.enum(['verse', 'mantra', 'book']).optional(),
    }),
    responds: { 200: 'Results grouped by kind' },
  },
  controller.search
);

export default router;
