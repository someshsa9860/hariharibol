import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/admin/reel.js';

const router = createRouter({
  tag: 'Admin · Reels',
  prefix: '/reels',
  description:
    'Author and manage reels from the panel: media, background audio, text placed on the ' +
    'frame, and the verse a reel is about. Media goes up through `/uploads` first; a reel ' +
    'only ever stores the returned keys. Text overlays are drawn by the app at watch time, ' +
    'not burned into the video, so a reel can be edited after it is live.',
});

// One piece of text on the frame. Positions and sizes are percentages, so the
// same reel lays out correctly on every screen: x/y are the box's top-left as a
// share of the frame's width/height, `width` its width as a share of the
// frame's width, and `size` the font size as a share of the frame's width.
//
// Style and colour are names, not values. The app owns the palette and the
// typefaces (Devanagari in particular must stay on the platform font), so the
// panel picks from a short list rather than shipping hex codes and font names
// the app would have to honour.
export const overlay = z.object({
  id: z.string().min(1).max(40),
  text: z.string().min(1).max(2000),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  width: z.number().min(5).max(100),
  size: z.number().min(1).max(30),
  style: z.enum(['body', 'heading', 'verse']),
  color: z.enum(['light', 'dark', 'accent']),
  align: z.enum(['left', 'center', 'right']),
  // Where a quoted verse came from. Purely a note for the next editor — the
  // text above is what the app draws, and stays as written if the verse changes.
  source: z.object({ verseId: z.string().max(40), label: z.string().max(120) }).optional(),
  // Filled from the reel's verse instead of being typed: the app swaps `text` for
  // the verse's own field (the translation in the reader's language) when it
  // fetches the reel, so `text` is only what a reader sees if that lookup fails.
  // Used by reels made from a template; see controllers/admin/reel-recipe.js.
  bind: z.enum(['sanskrit', 'transliteration', 'translation', 'reference']).optional(),
});

export const key = z.string().min(1).max(500);

const reelBody = {
  mediaType: z.enum(['VIDEO', 'IMAGE', 'AUDIO']),
  creatorId: z.string().min(1),

  videoPath: key.nullable(),
  // A slideshow's images, in order. Replaces the whole set.
  images: z.array(key).max(20),
  // Background music over a video or slideshow — or, for an AUDIO reel, the
  // recitation itself. One field because the panel treats it as one slot.
  audioPath: key.nullable(),
  thumbnailPath: key.nullable(),
  durationMs: z.number().int().min(0).nullable(),
  width: z.number().int().min(1).nullable(),
  height: z.number().int().min(1).nullable(),

  caption: z.string().max(2200).nullable(),
  tags: z.array(z.string().min(1).max(50)).max(30),
  languageCode: z.string().max(10).nullable(),
  sampradaya: z.string().min(1).max(50),

  verseId: z.string().nullable(),
  mantraId: z.string().nullable(),
  deityId: z.string().nullable(),

  overlays: z.array(overlay).max(20),
};

router.get(
  '/',
  {
    summary: 'List reels',
    description: 'Every reel in any state, newest first unless sorted.',
    permission: 'reel.read',
    limit: 'read',
    query: schemas.sorted(controller.SORT_COLUMNS).extend({
      status: z.enum(['DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'REJECTED', 'TAKEN_DOWN']).optional(),
      mediaType: z.enum(['VIDEO', 'IMAGE', 'AUDIO']).optional(),
      creatorId: z.string().optional(),
    }),
    responds: { 200: 'A page of reels' },
  },
  controller.list
);

router.get(
  '/creators',
  {
    summary: 'List creators a reel can be published under',
    description:
      'Approved creators only — the feed hides reels from anyone else. The platform’s own ' +
      'channel is flagged `isOfficial`, which is what the editor preselects.',
    permission: 'reel.read',
    limit: 'read',
    responds: { 200: 'Approved creators' },
  },
  controller.creators
);

router.get(
  '/:id',
  {
    summary: 'Get one reel for editing',
    description: 'Object keys are returned alongside signed URLs, so the editor can replace a file.',
    permission: 'reel.read',
    limit: 'read',
    params: schemas.id,
    responds: { 200: 'The reel', 404: 'No such reel' },
  },
  controller.get
);

router.post(
  '/',
  {
    summary: 'Create a reel',
    description:
      'Always created as a draft. Only `mediaType` and `creatorId` are required, so a reel can ' +
      'be started before its media exists; publishing is what checks the media is there.',
    permission: 'reel.write',
    limit: 'write',
    body: z.object(reelBody).partial().required({ mediaType: true, creatorId: true }),
    responds: { 201: 'The reel', 400: 'Bad media key, or an unknown creator, verse, mantra or deity' },
  },
  controller.create
);

router.patch(
  '/:id',
  {
    summary: 'Update a reel',
    description:
      'Send only what changed. Editing a live reel changes what readers see immediately, so a ' +
      'file swapped in on a published reel is checked the way publishing checks it.',
    permission: 'reel.write',
    limit: 'write',
    params: schemas.id,
    body: z.object(reelBody).partial(),
    responds: { 200: 'The reel', 400: 'Bad media key or missing file', 404: 'No such reel' },
  },
  controller.update
);

router.post(
  '/:id/publish',
  {
    summary: 'Publish or unpublish a reel',
    description:
      'Publishing checks that the media a reel needs for its type is set and actually in the ' +
      'bucket — a reel whose file is missing is a black screen in the feed. Unpublishing ' +
      'returns it to draft, still editable. The admin who publishes is recorded as its reviewer.',
    permission: 'reel.publish',
    limit: 'write',
    params: schemas.id,
    body: z.object({ isPublished: z.boolean() }),
    responds: { 200: 'The reel', 400: 'Missing media, or the creator is not approved' },
  },
  controller.publish
);

router.delete(
  '/:id',
  {
    summary: 'Delete a reel',
    description:
      'Deletes the reel with its likes, comments and views. The uploaded files are left in the ' +
      'bucket: a thumbnail can be a book cover, and nothing here can tell that another row ' +
      'does not still use a file.',
    permission: 'reel.delete',
    limit: 'write',
    params: schemas.id,
    responds: { 204: 'Deleted', 400: 'Still published' },
  },
  controller.remove
);

export default router;
