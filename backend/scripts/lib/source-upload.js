// Writes one source JSON object back to the source bucket without ever being
// able to lose the original. The bucket has versioning OFF, so an overwrite is
// permanent; every key is therefore copied to json-backup-<date>/<key> first,
// the copy's size is checked, and only then is the object replaced and its
// landed size checked. A backup that already exists is left alone — it holds
// the first original, which is the one worth keeping.
//
// Used by scripts/fill-prabhupada-source.js, which uploads a chapter as soon as
// it is filled. (scripts/upload-verse-source.js does the same for a whole
// directory at once.) Needs SOURCE_* credentials that may write.

import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { client, bucket } from './source-s3.js';

const backupPrefix = `json-backup-${new Date().toISOString().slice(0, 10)}/`;

/** Size of an object, or null when there is none. */
async function sizeOf(key) {
  try {
    return (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength;
  } catch (err) {
    if (err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404) return null;
    throw err;
  }
}

/**
 * Backs up `key`, then replaces it with `body`.
 *
 * `expectedBytes` is how large the object was when this run last saw it (what
 * was downloaded, or what this run uploaded before). If the bucket's copy is a
 * different size, someone else changed it meanwhile and nothing is written.
 * Returns { backedUp, bytes }.
 */
async function replaceSafely(key, body, expectedBytes) {
  const current = await sizeOf(key);
  if (current === null) throw new Error(`${key} is not in ${bucket} — refusing to create it`);
  if (expectedBytes != null && current !== expectedBytes) {
    throw new Error(`${key} is ${current} bytes in the bucket but this run last saw ${expectedBytes} — changed by someone else, not overwritten`);
  }

  let backedUp = false;
  if ((await sizeOf(backupPrefix + key)) === null) {
    await client.send(new CopyObjectCommand({ Bucket: bucket, Key: backupPrefix + key, CopySource: `${bucket}/${key}` }));
    const copy = await sizeOf(backupPrefix + key);
    if (copy !== current) throw new Error(`Backup of ${key} is ${copy} bytes, original ${current} — not overwritten`);
    backedUp = true;
  }

  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' }));
  const landed = await sizeOf(key);
  if (landed !== body.length) throw new Error(`${key}: uploaded ${body.length} bytes, bucket reports ${landed}`);
  return { backedUp, bytes: body.length };
}

export { replaceSafely, backupPrefix };
