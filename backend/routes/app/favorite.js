import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/favorite.js';

const router = createRouter({
  tag: 'Favourites',
  prefix: '/favorites',
  description: 'Bookmarked verses, mantras and books.',
});

router.get(
  '/',
  {
    summary: 'List my favourites',
    description:
      'Newest first, with each item already resolved to the reader’s languages. Filter by ' +
      '`type` to get one kind.',
    limit: 'read',
    query: z.object({ type: z.enum(['verse', 'mantra', 'book']).optional() }),
    responds: { 200: 'Favourites' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Add a favourite',
    description:
      'Set exactly one of `verseId`, `mantraId` or `bookId`. Idempotent — bookmarking the ' +
      'same thing twice returns the existing bookmark instead of an error, because a double ' +
      'tap should not look like a failure.',
    limit: 'write',
    body: z.object({
      verseId: z.string().optional(),
      mantraId: z.string().optional(),
      bookId: z.string().optional(),
    }),
    responds: { 201: 'The favourite', 400: 'Zero or more than one target given', 404: 'No such item' },
  },
  controller.add
);

router.delete(
  '/:id',
  {
    summary: 'Remove a favourite',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Removed', 404: 'Not yours, or already gone' },
  },
  controller.remove
);

export default router;
