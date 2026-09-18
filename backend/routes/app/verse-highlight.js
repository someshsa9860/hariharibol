import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/verse-highlight.js';

const router = createRouter({
  tag: 'Verse highlights',
  prefix: '/verse-highlights',
  description:
    'A verse a reader has marked while reading — whole-verse emphasis, distinct from a ' +
    'Favourite: a favourite is saved to a personal collection surfaced elsewhere in the app, ' +
    'a highlight is inline in the text being read.',
});

router.post(
  '/',
  {
    summary: 'Highlight a verse',
    description:
      'Idempotent — highlighting an already-highlighted verse returns the existing row instead ' +
      'of an error, the same as bookmarking twice.',
    limit: 'write',
    body: z.object({ verseId: z.string().min(1) }),
    responds: { 201: 'The highlight', 404: 'No such verse' },
  },
  controller.add
);

router.delete(
  '/:id',
  {
    summary: 'Remove a highlight',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Removed', 404: 'Not yours, or already gone' },
  },
  controller.remove
);

export default router;
