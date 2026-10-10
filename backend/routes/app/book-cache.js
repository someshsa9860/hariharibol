import { createRouter, z } from '../../utils/router.js';
import * as controller from '../../controllers/app/book-cache.js';

const router = createRouter({
  tag: 'Books · Offline',
  prefix: '/books',
  description:
    'Silent offline sync. The text of each chapter or canto is exported weekly to S3 and ' +
    'downloaded by the app directly; these endpoints say what exists and hand out short-lived ' +
    'links. Public like the rest of the library.',
});

const bookParam = z.object({ book: z.string().min(1).max(100).describe('Book slug or id') });
const unitInput = z
  .object({
    unitId: z.string().min(1).max(64).optional(),
    chapterId: z.string().min(1).max(64).optional().describe('Alias of unitId. For canto-based books pass the canto id.'),
  })
  .refine((v) => v.unitId || v.chapterId, { message: 'unitId (or chapterId) is required' });

router.get(
  '/:book/manifest',
  {
    summary: 'List a book’s downloadable units',
    description:
      'Every exported chapter (or canto) with its version and content hash. The app compares ' +
      'this with what it holds and fetches only what is missing or outdated. Reads one table; ' +
      'cheap to call every time a book opens. A book that is not exported (a short work, or one ' +
      'not yet exported) returns an empty list.',
    public: true,
    limit: 'read',
    params: bookParam,
    responds: { 200: 'The manifest', 404: 'No such published book' },
  },
  controller.manifest
);

router.get(
  '/:book/download-url',
  {
    summary: 'Get a download link for one unit (query form)',
    description: 'Same as the POST form. `unitId` is the chapter id, or the canto id for canto-based books.',
    public: true,
    limit: 'read',
    params: bookParam,
    query: unitInput,
    responds: { 200: 'A short-lived link and the unit’s version, hash and size', 400: 'No unit given', 404: 'No such book or unit' },
  },
  controller.downloadUrl
);

router.post(
  '/:book/download-url',
  {
    summary: 'Get a download link for one unit',
    description:
      'Returns a presigned S3 link valid for a few minutes (BOOK_CACHE_DOWNLOAD_TTL_SECONDS), ' +
      'with the version, SHA-256 hash and size to check the download against. The file is gzipped ' +
      'JSON; the hash is of the decompressed bytes.',
    public: true,
    limit: 'read',
    params: bookParam,
    body: unitInput,
    responds: { 200: 'A short-lived link and the unit’s version, hash and size', 400: 'No unit given', 404: 'No such book or unit' },
  },
  controller.downloadUrl
);

router.post(
  '/:book/audio-urls',
  {
    summary: 'Get playable links for verse audio',
    description:
      'The offline files carry audio keys, not links. Send the ids of the verses about to be ' +
      'played; verses without audio are omitted.',
    public: true,
    limit: 'read',
    params: bookParam,
    body: z.object({ verseIds: z.array(z.string().min(1).max(64)).min(1).max(200) }),
    responds: { 200: 'A map of verse id to link', 404: 'No such published book' },
  },
  controller.audioUrls
);

export default router;
