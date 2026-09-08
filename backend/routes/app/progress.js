const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/app/progress');

const router = createRouter({
  tag: 'Reading progress',
  prefix: '/progress',
  description: 'Where the reader left off in each book — the continue-reading list.',
});

router.get(
  '/',
  {
    summary: 'List where I left off',
    description:
      'One entry per book, most recently read first, each with a percentage against that ' +
      'book’s own verse count.',
    limit: 'read',
    responds: { 200: 'Progress per book' },
  },
  controller.list
);

router.put(
  '/',
  {
    summary: 'Save my position',
    description:
      'Records the furthest verse reached in a book. `versesRead` only ever increases — ' +
      'flipping back to re-read something earlier must not undo months of progress.',
    limit: 'write',
    body: z.object({
      verseId: z.string().regex(/^\d+(\.\d+){1,3}(-\d+)?$/, 'Expected a dotted verse id'),
      versesRead: z.coerce.number().int().min(0).optional(),
    }),
    responds: { 200: 'The saved position', 404: 'No such verse' },
  },
  controller.save
);

router.delete(
  '/:bookId',
  {
    summary: 'Start a book over',
    limit: 'write',
    params: z.object({ bookId: z.string().min(1) }),
    responds: { 200: 'Reset' },
  },
  controller.reset
);

module.exports = router;
