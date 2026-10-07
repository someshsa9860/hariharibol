// Puts a repaired copy of the scripture source JSON (see repair-verse-source.js
// and repair-bg-source.js) into the source bucket, so the importers run on the
// server pick it up.
//
//   node scripts/upload-verse-source.js <localDir> [--yes]
//
// The bucket has versioning OFF, so an overwrite is permanent. Every object it
// is about to replace is therefore first copied to
// json-backup-<date>/<original key> in the same bucket and the copy's size is
// checked; if any backup fails nothing is overwritten. Without --yes it only
// prints what it would do. Needs SOURCE_* credentials that may write.

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import { CopyObjectCommand, HeadObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

import { client, bucket } from './lib/source-s3.js';

const [localDir, flag] = process.argv.slice(2);
if (!localDir) {
  console.error('usage: node scripts/upload-verse-source.js <localDir> [--yes]');
  process.exit(1);
}
const apply = flag === '--yes';
const backupPrefix = `json-backup-${new Date().toISOString().slice(0, 10)}/`;

const keys = [];
for (const prefix of ['json/srimad-bhagavatam/en/', 'json/bhagavat-gita/en/']) {
  const dir = join(localDir, prefix);
  if (!existsSync(dir)) continue;
  for (const name of readdirSync(dir).filter((n) => n.endsWith('.json'))) keys.push(prefix + name);
}
console.log(`${keys.length} objects to replace in ${bucket}; backups go to ${backupPrefix}`);
if (!apply) {
  console.log('Dry run — pass --yes to back up and upload.');
  process.exit(0);
}

const size = async (key) => (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength;

// 1. Back up every original, and check each copy.
for (const key of keys) {
  const original = await size(key);
  await client.send(new CopyObjectCommand({ Bucket: bucket, Key: backupPrefix + key, CopySource: `${bucket}/${key}` }));
  const copy = await size(backupPrefix + key);
  if (copy !== original) throw new Error(`Backup of ${key} is ${copy} bytes, original ${original} — stopping, nothing overwritten.`);
}
console.log(`Backed up ${keys.length} objects.`);

// 2. Overwrite, and check what landed.
for (const key of keys) {
  const body = readFileSync(join(localDir, key));
  await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' }));
  const landed = await size(key);
  if (landed !== body.length) throw new Error(`${key}: uploaded ${body.length} bytes, bucket reports ${landed}.`);
}
console.log(`Uploaded ${keys.length} objects.`);
