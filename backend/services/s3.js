// The media bucket is private. Nothing in the database holds a URL — the
// columns named `*Path` hold S3 object keys, and a link is signed at response
// time. A stored URL would be a permanent public link to a private object, and
// would expire anyway.
//
// Signed URLs are cached in Redis for slightly less than their own lifetime.
// Signing is local and cheap, but caching keeps the URL stable between requests
// so a client's own HTTP cache and any CDN in front of it can do their job.

import crypto from 'node:crypto';
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

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
});

const BUCKET = env.S3_BUCKET;
const TTL = env.S3_PRESIGN_TTL_SECONDS;
const CACHE_TTL = Math.max(60, TTL - 300);

// Where each kind of media lives. One list, so keys stay predictable and a
// stray upload cannot land at the bucket root.
const PREFIXES = {
  mantraAudio: 'mantras/audio',
  verseAudio: 'verses/audio',
  narrationAudio: 'narrations/audio',
  bookCover: 'books/covers',
  deityImage: 'deities/images',
  guruImage: 'gurus/images',
  translatorImage: 'translators/images',
  issueImage: 'issues/images',
  slokaImage: 'slokas/images',
  avatar: 'users/avatars',
};

const ALLOWED_CONTENT_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/mp4',
  'audio/aac',
  'audio/wav',
]);

const EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/aac': 'aac',
  'audio/wav': 'wav',
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
  return `${prefix}/${id}.${EXTENSIONS[contentType]}`;
}

// ── Reading ────────────────────────────────────────────────────────────────

async function presignGet(key) {
  if (!key) return null;
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

async function presignUpload(kind, contentType) {
  const key = buildKey(kind, contentType);
  const url = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 }
  );
  return { key, uploadUrl: url, contentType, expiresIn: 900 };
}

// For files the server itself produces — generated sloka artwork, exports.
async function putObject(key, body, contentType) {
  await client.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType })
  );
  return key;
}

async function deleteObject(key) {
  if (!key) return;
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
  try {
    await client.send(new HeadObjectCommand({ Bucket: BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

export {
  PREFIXES,
  ALLOWED_CONTENT_TYPES,
  buildKey,
  presignGet,
  presignFields,
  presignList,
  presignUpload,
  putObject,
  deleteObject,
  objectExists,
};
