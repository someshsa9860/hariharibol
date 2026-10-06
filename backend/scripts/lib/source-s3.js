// Read-only access to the previous project's S3 bucket — the one-time source
// for scraped scripture content. Deliberately separate from services/s3.js:
// that service is this app's own media store, credentialed via the regular
// .env; this is a migration source with its own credentials that do not
// belong in the app's permanent configuration. See scripts/README.md.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config as loadEnv } from 'dotenv';
import { S3Client, GetObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

// Doesn't touch process.env for a var already set there, so real env vars
// (e.g. a server's secrets manager) always win over this file.
loadEnv({ path: resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '.env.scripts') });

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set — see backend/scripts/README.md for how to export it.`);
  }
  return value;
}

const bucket = requireEnv('SOURCE_S3_BUCKET');
const client = new S3Client({
  region: process.env.SOURCE_AWS_REGION || 'ap-south-1',
  credentials: {
    accessKeyId: requireEnv('SOURCE_AWS_ACCESS_KEY_ID'),
    secretAccessKey: requireEnv('SOURCE_AWS_SECRET_ACCESS_KEY'),
  },
});

async function getJson(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await res.Body.transformToString());
}

async function getBuffer(key) {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

/** Every key under a prefix, paging past S3's 1000-key-per-call limit. */
async function listKeys(prefix) {
  const keys = [];
  let continuationToken;
  do {
    const res = await client.send(
      new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix, ContinuationToken: continuationToken })
    );
    keys.push(...(res.Contents || []).map((c) => c.Key));
    continuationToken = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (continuationToken);
  return keys;
}

export { getJson, getBuffer, listKeys };
