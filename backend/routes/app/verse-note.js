import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/verse-note.js';

const router = createRouter({
  tag: 'Verse notes',
  prefix: '/verse-notes',
  description:
    'A reader’s own words against a verse — personal and private, never shown to anyone else. ' +
    'Distinct from VerseExplanation (app-written, shown to every reader) and from the Notes ' +
    'tab, which is an unrelated feature for daily tasks.',
});

router.get(
  '/',
  {
    summary: 'List my notes on a verse',
    description: 'Newest first. One verse can carry several — this is a running set of thoughts, not a single field.',
    limit: 'read',
    query: z.object({ verseId: z.string().min(1) }),
    responds: { 200: 'My notes on that verse' },
  },
  controller.list
);

router.post(
  '/',
  {
    summary: 'Add a note',
    limit: 'write',
    body: z.object({
      verseId: z.string().min(1),
      text: z.string().trim().min(1).max(2000),
    }),
    responds: { 201: 'The note', 404: 'No such verse' },
  },
  controller.add
);

router.patch(
  '/:id',
  {
    summary: 'Edit a note',
    limit: 'write',
    params: schemas.id,
    body: z.object({ text: z.string().trim().min(1).max(2000) }),
    responds: { 200: 'The updated note', 404: 'Not yours, or already gone' },
  },
  controller.update
);

router.delete(
  '/:id',
  {
    summary: 'Delete a note',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Removed', 404: 'Not yours, or already gone' },
  },
  controller.remove
);

export default router;
