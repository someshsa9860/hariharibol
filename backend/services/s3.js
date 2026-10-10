// The media bucket is private. Nothing in the database holds a URL — the
// columns named `*Path` hold S3 object keys, and a link is signed at response
// time. A stored URL would be a permanent public link to a private object, and
// would expire anyway.
//
// Signed URLs are cached in Redis for slightly less than their own lifetime.
// Signing is local and cheap, but caching keeps the URL stable between requests
// so a client's own HTTP cache and any CDN in front of it can do their job.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  CopyObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';

import env from '../config/env.js';
import logger from '../config/logger.js';
import { redis } from '../config/redis.js';
import { badRequest } from '../utils/errors.js';

const client = new S3Client({
  region: env.AWS_REGION,
  credentials:
    env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY
      ? { accessKeyId: env.AWS_ACCESS_KEY_ID, secretAccessKey: env.AWS_SECRET_ACCESS_KEY }
      : undefined, // fall through to the instance role in production
  // A hung socket otherwise blocks forever — the SDK has no default request
  // timeout of its own.
  requestHandler: new NodeHttpHandler({ connectionTimeout: 5000, requestTimeout: 15000 }),
});

const BUCKET = env.S3_BUCKET;
const TTL = env.S3_PRESIGN_TTL_SECONDS;
const CACHE_TTL = Math.max(60, TTL - 300);

// A laptop rarely has real AWS credentials lying around, and nobody should
// need them just to see a book cover while developing. Reads and writes fall
// back to a local directory, served back at `${API_BASE_URL}/media/…` by
// app.js — everything else about the interface stays the same either way.
// Gated on the environment rather than on credentials alone, so a production
// deploy that is missing its keys still fails loudly instead of quietly
// writing to a container's ephemeral disk.
const useLocalStorage = env.isDevelopment && !(env.AWS_ACCESS_KEY_ID && env.AWS_SECRET_ACCESS_KEY);
const LOCAL_STORAGE_ROOT = path.join(import.meta.dirname, '..', 'storage');

if (useLocalStorage) {
  logger.warn(
    'No AWS credentials configured — media reads and writes fall back to backend/storage/. ' +
      'Set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY to use S3 instead.'
  );
}

function localPath(key) {
  return path.join(LOCAL_STORAGE_ROOT, key);
}

// Everything lives under one parent folder, so the bucket shows one project
// rather than a pile of loose prefixes.
//
//   hariharibol/<kind prefix>/<id>.<ext>             saved — what rows point at
//   temp/<DD-MM-YY>/hariharibol/<kind prefix>/…      uploaded, not yet saved
//
// A presigned upload always lands in temp/. The key the client gets back is that
// temp key; when a row is saved with it (see commitKeys), the object is moved to
// its permanent home and the row stores the permanent key. Anything never saved
// is swept by the monthly `s3.temp.prune` job.
const ROOT = 'hariharibol';
const TEMP = 'temp';

// Where each kind of media lives inside ROOT. One list, so keys stay predictable
// and a stray upload cannot land at the bucket root.
const PREFIXES = {
  mantraAudio: 'mantras/audio',
  mantraMalaAudio: 'mantras/mala',
  verseAudio: 'verses/audio',
  narrationAudio: 'narrations/audio',
  bookCover: 'books/covers',
  deityImage: 'deities/images',
  guruImage: 'gurus/images',
  translatorImage: 'translators/images',
  issueImage: 'issues/images',
  slokaImage: 'slokas/images',
  avatar: 'users/avatars',
  reelVideo: 'reels/videos',
  reelImage: 'reels/images',
  reelThumbnail: 'reels/thumbnails',
  reelAudio: 'reels/audio',
  creatorAvatar: 'creators/avatars',
  creatorCover: 'creators/covers',
  reelTemplateBackground: 'reel-templates/backgrounds',
  reelTemplateLogo: 'reel-templates/logos',
};

// DD-MM-YY, UTC — the same clock the scheduled jobs run on.
function tempDay(date = new Date()) {
  const dd = String(date.getUTCDate()).padStart(2, '0');
  const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
  const yy = String(date.getUTCFullYear()).slice(-2);
  return `${dd}-${mm}-${yy}`;
}

const TEMP_PREFIX_RE = /^temp\/\d{2}-\d{2}-\d{2}\//;
const isTempKey = (key) => typeof key === 'string' && TEMP_PREFIX_RE.test(key);

// The key without its temp/<date>/ and hariharibol/ parts: `books/covers/x.jpg`.
// Keys from before this layout have no root and come back unchanged.
const bareKey = (key) => key.replace(TEMP_PREFIX_RE, '').replace(`${ROOT}/`, '');

// True when the key sits under this kind prefix — temp, saved or legacy.
const keyHasPrefix = (key, prefix) => typeof key === 'string' && bareKey(key).startsWith(`${prefix}/`);

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
  // Reels. H.264 in an MP4 container is the only format both platforms play
  // without a codec question, so it is what the upload path accepts —
  // anything else is transcoded before it gets here, not after.
  'video/mp4',
  'video/quicktime',
]);

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

// Keys are generated, never taken from the client — a client-supplied key is
// how one upload overwrites another's file.
function buildKey(kind, contentType) {
  const prefix = PREFIXES[kind];
  if (!prefix) throw badRequest(`Unknown upload kind: ${kind}`);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    throw badRequest(`Unsupported content type: ${contentType}`);
  }
  const id = crypto.randomBytes(16).toString('hex');
  return `${TEMP}/${tempDay()}/${ROOT}/${prefix}/${id}.${EXTENSIONS[contentType]}`;
}

// ── Reading ────────────────────────────────────────────────────────────────

async function presignGet(key) {
  if (!key) return null;
  if (useLocalStorage) return `${env.API_BASE_URL}/media/${key}`;

  const cacheKey = `s3:get:${key}`;
  const cached = await redis.get(cacheKey).catch(() => null);
  if (cached) return cached;

  const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: BUCKET, Key: key }), {
    expiresIn: TTL,
  });
  await redis.set(cacheKey, url, 'EX', CACHE_TTL).catch(() => null);
  return url;
}

// Turns `{ audioPath: 'k' }` into `{ audioPath: 'k', audioUrl: 'https://…' }`.
// The key is kept so the admin panel can still see and replace it.
async function presignFields(row, fields) {
  if (!row) return row;
  const out = { ...row };
  await Promise.all(
    fields.map(async (field) => {
      const urlField = field.replace(/Path$/, 'Url');
      out[urlField] = row[field] ? await presignGet(row[field]) : null;
    })
  );
  return out;
}

const presignList = (rows, fields) =>
  Promise.all((rows || []).map((row) => presignFields(row, fields)));

// ── Writing ────────────────────────────────────────────────────────────────
// Admin uploads go straight from the browser to S3. The API only signs the
// request, so a 40 MB narration never passes through the API container.

// True only for a key buildKey could have produced. The local-upload route
// writes wherever its key says, so it has to be able to refuse `../../.env`.
const GENERATED_KEY = new RegExp(
  `^(?:temp/\\d{2}-\\d{2}-\\d{2}/)?(?:${ROOT}/)?(?:${Object.values(PREFIXES).join('|')})/[0-9a-f]{32}\\.(?:${Object.values(EXTENSIONS).join('|')})$`
);
const isGeneratedKey = (key) => typeof key === 'string' && GENERATED_KEY.test(key);

async function presignUpload(kind, contentType) {
  const key = buildKey(kind, contentType);

  // No bucket on a laptop, so there is nothing to sign. The browser PUTs to the
  // API instead (controllers/admin/upload.js, receiveLocal) — the one place a
  // file does pass through it, and only in development. `viaApi` tells the
  // client to send its bearer token, which a real presigned URL must not get.
  if (useLocalStorage) {
    return {
      key,
      uploadUrl: `${env.API_BASE_URL}/api/admin/uploads/local/${key}`,
      contentType,
      expiresIn: 900,
      viaApi: true,
    };
  }

  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 }
  );
  return { key, uploadUrl: url, contentType, expiresIn: 900 };
}

// For files the server itself produces — generated sloka artwork, exports —
// and for the import scripts that seed book covers and media locally.
async function putObject(key, body, contentType) {
  if (useLocalStorage) {
    const dest = localPath(key);
    await fs.mkdir(path.dirname(dest), { recursive: true });
    await fs.writeFile(dest, body);
    return key;
  }

  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

async function deleteObject(key) {
  if (!key) return;
  if (useLocalStorage) {
    await fs.rm(localPath(key), { force: true });
    return;
  }

  try {
    await client.send(new DeleteObjectCommand({ Bucket: BUCKET, Key: key }));
  } catch (err) {
    // A missing object is the state we wanted anyway.
    logger.warn({ err: err.message, key }, 's3 delete failed');
  }
}

// Used before publishing: a mantra with a dangling audio key is worse than one
// with no audio at all, because the app shows a play button that does nothing.
async function objectExists(key) {
  if (!key) return false;
  if (useLocalStorage) {
    return fs
      .access(localPath(key))
      .then(() => true)
      .catch(() => false);
  }

  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

// ── Saving and cleaning up ─────────────────────────────────────────────────

// Moves a temp upload to its permanent key and returns that key. Anything that
// is not a temp key — already saved, or from before this layout — is returned
// as it came. Called by the database client when a row is written (see
// config/database.js), so no controller has to remember to do it.
async function commitKey(key) {
  if (!isTempKey(key)) return key;
  const dest = key.replace(TEMP_PREFIX_RE, '');

  if (useLocalStorage) {
    try {
      await fs.mkdir(path.dirname(localPath(dest)), { recursive: true });
      await fs.rename(localPath(key), localPath(dest));
    } catch (err) {
      // Already moved by an earlier attempt at this same save.
      if (!(await objectExists(dest))) throw badRequest('That upload has expired — upload it again');
    }
    return dest;
  }

  try {
    await client.send(
      new CopyObjectCommand({ Bucket: BUCKET, Key: dest, CopySource: `${BUCKET}/${key}` })
    );
  } catch (err) {
    if (!(await objectExists(dest))) throw badRequest('That upload has expired — upload it again');
    return dest;
  }
  await deleteObject(key);
  return dest;
}

// Walks a value about to be written and commits every temp key in it — a plain
// column, or a path inside a JSON column such as a reel recipe's config. Returns
// the value with permanent keys in their place; the input is not changed.
async function commitKeys(value) {
  if (typeof value === 'string') return isTempKey(value) && isGeneratedKey(value) ? commitKey(value) : value;
  if (Array.isArray(value)) return Promise.all(value.map(commitKeys));
  if (value && Object.getPrototypeOf(value) === Object.prototype) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = await commitKeys(v);
    return out;
  }
  return value; // Date, Decimal, Buffer, null …
}

// Deletes everything under temp/ that was uploaded before `before` and never
// saved. The date folder is the upload day, so it decides, not LastModified.
async function pruneTemp(before) {
  const cutoff = tempDay(before);
  const toDate = (day) => {
    const [dd, mm, yy] = day.split('-').map(Number);
    return Date.UTC(2000 + yy, mm - 1, dd);
  };
  const cutoffTime = toDate(cutoff);
  let deleted = 0;

  if (useLocalStorage) {
    const base = path.join(LOCAL_STORAGE_ROOT, TEMP);
    for (const day of await fs.readdir(base).catch(() => [])) {
      if (!/^\d{2}-\d{2}-\d{2}$/.test(day) || toDate(day) >= cutoffTime) continue;
      await fs.rm(path.join(base, day), { recursive: true, force: true });
      deleted += 1;
    }
    return { deleted };
  }

  let ContinuationToken;
  do {
    const page = await client.send(
      new ListObjectsV2Command({ Bucket: BUCKET, Prefix: `${TEMP}/`, ContinuationToken, MaxKeys: 1000 })
    );
    const old = (page.Contents ?? []).filter((obj) => {
      const day = obj.Key.split('/')[1];
      return /^\d{2}-\d{2}-\d{2}$/.test(day) && toDate(day) < cutoffTime;
    });
    if (old.length) {
      await client.send(
        new DeleteObjectsCommand({
          Bucket: BUCKET,
          Delete: { Objects: old.map((obj) => ({ Key: obj.Key })), Quiet: true },
        })
      );
      deleted += old.length;
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return { deleted };
}

export {
  ROOT,
  TEMP,
  PREFIXES,
  isTempKey,
  bareKey,
  keyHasPrefix,
  commitKey,
  commitKeys,
  pruneTemp,
  ALLOWED_CONTENT_TYPES,
  buildKey,
  isGeneratedKey,
  presignGet,
  presignFields,
  presignList,
  presignUpload,
  putObject,
  deleteObject,
  objectExists,
  // For controllers/admin/system.js's storage summary — everything else here
  // works through the functions above, this is the one place that needs the
  // bucket connection details directly.
  client,
  BUCKET,
  useLocalStorage,
  LOCAL_STORAGE_ROOT,
};
