const { createRouter, z } = require('../../utils/router');
const controller = require('../../controllers/admin/upload');

const router = createRouter({
  tag: 'Admin · Uploads',
  prefix: '/uploads',
  description:
    'Media goes straight from the browser to S3; the API only signs the request. A 40 MB ' +
    'narration passing through the API container would tie up a request worker for the whole ' +
    'upload for no reason.',
});

router.get(
  '/kinds',
  {
    summary: 'List what can be uploaded',
    description: 'The upload kinds and the content types each accepts.',
    permission: 'media.upload',
    limit: 'read',
    responds: { 200: 'Kinds and content types' },
  },
  controller.kinds
);

router.post(
  '/',
  {
    summary: 'Get a presigned upload URL',
    description:
      'PUT the file to the returned URL, then save the returned `key` — not the URL — onto ' +
      'the row. The bucket is private and links are signed at read time, so a stored URL ' +
      'would expire. The key is generated here and never taken from the client: a ' +
      'client-supplied key is how one upload overwrites another’s file.',
    permission: 'media.upload',
    limit: 'write',
    body: z.object({
      kind: z.string().min(1).max(50),
      contentType: z.string().min(1).max(100),
    }),
    responds: { 200: 'The key and the URL to PUT to', 400: 'Unknown kind or content type' },
  },
  controller.presign
);

router.post(
  '/verify',
  {
    summary: 'Check that an upload arrived',
    description:
      'Call before saving a key onto a row. A key pointing at nothing is worse than an empty ' +
      'column — the app renders a play button that does nothing and the reader blames their ' +
      'connection.',
    permission: 'media.upload',
    limit: 'read',
    body: z.object({ key: z.string().min(1).max(500) }),
    responds: { 200: 'It is there', 404: 'Not in the bucket' },
  },
  controller.verify
);

router.delete(
  '/',
  {
    summary: 'Delete an object',
    description: 'For cleaning up an orphaned upload. Does not clear any column referencing it.',
    permission: 'media.upload',
    limit: 'write',
    body: z.object({ key: z.string().min(1).max(500) }),
    responds: { 200: 'Deleted' },
  },
  controller.remove
);

module.exports = router;
