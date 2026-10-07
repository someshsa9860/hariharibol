// Read-only access to the previous project's S3 bucket — the one-time source
// for scraped scripture content. Deliberately separate from services/s3.js:
// that service is this app's own media store, credentialed via the regular
// .env; this is a migration source with its own credentials that do not
// belong in the app's permanent configuration. See scripts/README.md.

import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
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

// SOURCE_LOCAL_DIR points at a folder laid out like the bucket
// (<dir>/json/...) — used to import a repaired copy before it is uploaded.
const localDir = process.env.SOURCE_LOCAL_DIR;
const bucket = localDir ? null : requireEnv('SOURCE_S3_BUCKET');
const client = localDir
  ? null
  : new S3Client({
      region: process.env.SOURCE_AWS_REGION || 'ap-south-1',
      credentials: {
        accessKeyId: requireEnv('SOURCE_AWS_ACCESS_KEY_ID'),
        secretAccessKey: requireEnv('SOURCE_AWS_SECRET_ACCESS_KEY'),
      },
    });

/** Local-directory stand-in for the bucket: a file when present, else the S3 object's absence. */
function localPath(key) {
  return join(localDir, key);
}

async function getJson(key) {
  if (localDir) {
    if (!existsSync(localPath(key))) {
      const err = new Error(`${key} not in SOURCE_LOCAL_DIR`);
      err.name = 'NoSuchKey';
      throw err;
    }
    return JSON.parse(readFileSync(localPath(key), 'utf8'));
  }
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return JSON.parse(await res.Body.transformToString());
}

async function getBuffer(key) {
  if (localDir) return readFileSync(localPath(key));
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  return Buffer.from(await res.Body.transformToByteArray());
}

function localKeys(prefix) {
  const dir = localPath(prefix);
  if (!existsSync(dir)) return [];
  return readdirSync(dir).map((name) => prefix + name);
}

/** Every key under a prefix, paging past S3's 1000-key-per-call limit. */
async function listKeys(prefix) {
  if (localDir) return localKeys(prefix);
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

export { getJson, getBuffer, listKeys, client, bucket };
