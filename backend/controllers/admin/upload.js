// Media uploads.
//
// The file never passes through the API. The panel asks for a presigned URL and
// then PUTs straight to S3 — a 40 MB narration going through the API container
// would tie up a request worker for the whole upload, and the container has no
// business holding it.
//
// The object key is generated here, never taken from the client. A
// client-supplied key is how one upload silently overwrites another's file.

const s3 = require('../../services/s3');
const audit = require('../../services/audit');
const { ok } = require('../../utils/respond');
const { badRequest, notFound } = require('../../utils/errors');

/** POST /api/admin/uploads — get a URL to upload to. */
exports.presign = async (req, res) => {
  const { kind, contentType } = req.valid.body;

  const result = await s3.presignUpload(kind, contentType);

  await audit.record(req, {
    action: 'media.upload',
    entityType: 'S3Object',
    entityId: result.key,
    after: { kind, contentType },
  });

  return ok(res, result);
};

/** GET /api/admin/uploads/kinds — what may be uploaded and where each kind lands. */
exports.kinds = async (req, res) => {
  return ok(res, {
    kinds: Object.keys(s3.PREFIXES),
    contentTypes: [...s3.ALLOWED_CONTENT_TYPES],
  });
};

/**
 * POST /api/admin/uploads/verify
 * Confirms the object actually arrived before the key is saved onto a row. A
 * key pointing at nothing is worse than an empty column: the app renders a play
 * button that does nothing, and the reader blames their connection.
 */
exports.verify = async (req, res) => {
  const { key } = req.valid.body;

  const exists = await s3.objectExists(key);
  if (!exists) throw notFound('That object is not in the bucket');

  return ok(res, { key, exists: true, url: await s3.presignGet(key) });
};

/** DELETE /api/admin/uploads — remove an orphaned object. */
exports.remove = async (req, res) => {
  const { key } = req.valid.body;
  if (!key) throw badRequest('key is required');

  await s3.deleteObject(key);
  await audit.record(req, { action: 'media.delete', entityType: 'S3Object', entityId: key });

  return ok(res, { deleted: true });
};
