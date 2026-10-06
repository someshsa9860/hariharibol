// Copies media from the old "callvcal" bucket (ramkrishnahari/ prefix) into
// this app's own media bucket (services/s3.js — S3_BUCKET in .env). One-time
// migration — see scripts/README.md for the credentials this needs.
//
// Idempotent and resumable: a key already present at the destination is left
// alone, so a killed run just picks up the remaining keys next time.
//
// `--dry-run` lists what is under the old prefix and what would be copied,
// without writing anything — use it first to see what is actually there and
// to confirm LEGACY_* credentials are wired up correctly.

import { listObjects, getBuffer, headObject, bucket, prefix } from './lib/legacy-media-s3.js';
import { putObject, objectExists } from '../services/s3.js';

const DRY_RUN = process.argv.includes('--dry-run');

// Old key -> new key. Strips the ramkrishnahari/ prefix and files everything
// under legacy/, so migrated media stays visibly separate from anything the
// app writes itself — nothing here guesses which mantra/verse/book a file
// belongs to.
function destKey(oldKey) {
  return `legacy/${oldKey.slice(prefix.length)}`;
}

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes;
  let unit = -1;
  do {
    value /= 1024;
    unit++;
  } while (value >= 1024 && unit < units.length - 1);
  return `${value.toFixed(1)} ${units[unit]}`;
}

async function run() {
  const objects = await listObjects();
  const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
  console.log(`${objects.length} object(s) under s3://${bucket}/${prefix} (${formatBytes(totalSize)} total).`);

  let copied = 0;
  let skipped = 0;

  for (const [i, { key }] of objects.entries()) {
    const newKey = destKey(key);
    if (await objectExists(newKey)) {
      skipped++;
      continue;
    }

    if (DRY_RUN) {
      console.log(`[dry run] ${key} -> ${newKey}`);
      continue;
    }

    const [buffer, head] = await Promise.all([getBuffer(key), headObject(key)]);
    await putObject(newKey, buffer, head.ContentType || 'application/octet-stream');
    copied++;
    console.log(`[${i + 1}/${objects.length}] copied ${key} -> ${newKey}`);
  }

  if (DRY_RUN) {
    console.log(`\nDry run done. ${objects.length - skipped} would be copied, ${skipped} already present.`);
  } else {
    console.log(`\nDone. ${copied} copied, ${skipped} already present.`);
  }
}

// Explicit exit: services/s3.js's Redis cache connection and the S3 clients'
// keep-alive agents otherwise leave the event loop non-empty, and the process
// sits alive indefinitely after the actual work is done.
run()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
