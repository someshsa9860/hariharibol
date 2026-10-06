// Read-only access to the old project's media bucket ("callvcal", under the
// ramkrishnahari/ prefix) — the one-time source for scripts/import-legacy-media.js.
// Deliberately separate from services/s3.js (this app's own media store,
// credentialed via the regular .env) and from scripts/lib/source-s3.js (the
// sanatan-db scripture-text source, a different bucket entirely): this one
// has its own credentials that don't belong in either of those. See
// scripts/README.md.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { S3Client, GetObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { NodeHttpHandler } from '@smithy/node-http-handler';

// Doesn't touch process.env for a var already set there, so real env vars
// (e.g. a server's secrets manager) always win over this file.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env.legacy-media') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see backend/scripts/README.md for how to configure it.`);
  }
  return value;
}

const bucket = requireEnv('LEGACY_S3_BUCKET');
const prefix = process.env.LEGACY_S3_PREFIX || '';
const client = new S3Client({
  region: process.env.LEGACY_AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: requireEnv('LEGACY_AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('LEGACY_AWS_SECRET_ACCESS_KEY'),
  },
  // A hung socket (sleep/wake, a flaky network) otherwise blocks forever — the
  // SDK has no default request timeout. A batch migration script would rather
  // fail one object and move on than sit motionless for hours.
  requestHandler: new NodeHttpHandler({ connectionTimeout: 5000, requestTimeout: 15000 }),
});

async function getBuffer(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

async function headObject(key) {
  return client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
}

/** Every object under the configured prefix, paging past S3's 1000-key limit. */
async function listObjects() {
  const objects = [];
  let continuationToken;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    for (const c of res.Contents || []) objects.push({ key: c.Key, size: c.Size });
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return objects;
}

export { bucket, prefix, listObjects, getBuffer, headObject };
