import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/search.js';

const router = createRouter({
  tag: 'Search',
  prefix: '/search',
  description: 'One search across verses, mantras and books, with a lazy-loaded page per kind.',
});

router.get(
  '/',
  {
    summary: 'Search the library',
    description:
      'Matches Sanskrit, transliteration and translated meanings in the reader’s language, ' +
      'plus mantra and book titles. A dotted verse id such as 1.2.47, or a book’s own ' +
      'shorthand such as "BG 2.47" or "SB 1.3.28", is treated as a direct lookup rather than ' +
      'a search — someone typing one wants that verse. A book named at the start of the query ' +
      '("gita …", "bhagvat gita …", "sb …"), or `book` (a slug), narrows verses to that book. Words ' +
      'are matched by sound, so spelling slips, missing spaces and Roman spellings of Sanskrit ' +
      '(krishna / kṛṣṇa) still find their verse; `meta.corrected` says what the query was read ' +
      'as. Verses match in the Sanskrit, transliteration, translation and purport, best first, ' +
      'each with `searchMatch` (where the words were found, with the passage). Without `type`, returns a small ' +
      'preview of each kind; with `type`, the full paginated list for just that one, for a ' +
      '"see all" screen to lazy-load through with `page`/`pageSize`.',
    public: true,
    limit: 'read',
    query: schemas.page.extend({
      q: z.string().trim().min(2).max(100),
      type: z.enum(['verse', 'mantra', 'book']).optional(),
      book: z.string().trim().max(80).optional(),
    }),
    responds: { 200: 'Results grouped by kind, or one paginated kind when `type` is set' },
  },
  controller.search
);

export default router;
