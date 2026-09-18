// Sets a book's cover image from a local file. Uploads through services/s3.js,
// so it lands on S3 in production and under storage/ locally, same as every
// other upload — nothing about this script cares which.
//
// Usage (from backend/):
//   node scripts/set-book-cover.js <book-slug> <path-to-image>
//
// Example:
//   node scripts/set-book-cover.js bhagavad-gita ~/Downloads/gita-cover.png

import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../config/database.js';
import { redis, publisher } from '../config/redis.js';
import * as s3 from '../services/s3.js';

const CONTENT_TYPES = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
};

async function run() {
  const [slug, filePath] = process.argv.slice(2);
  if (!slug || !filePath) {
    console.error('Usage: node scripts/set-book-cover.js <book-slug> <path-to-image>');
    process.exitCode = 1;
    return;
  }

  const book = await prisma.book.findUnique({ where: { slug } });
  if (!book) throw new Error(`No book with slug "${slug}"`);

  const ext = path.extname(filePath).toLowerCase();
  const contentType = CONTENT_TYPES[ext];
  if (!contentType) throw new Error(`Unsupported image type "${ext}" — use png, jpg or webp`);

  const oldKey = book.coverImagePath;
  const body = await readFile(filePath);
  const key = s3.buildKey('bookCover', contentType);
  await s3.putObject(key, body, contentType);

  await prisma.book.update({ where: { id: book.id }, data: { coverImagePath: key } });
  if (oldKey) await s3.deleteObject(oldKey);

  console.log(`${book.title}: cover set to ${key}`);
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    // services/s3.js pulls in the redis cache client for presigned-URL
    // caching — without closing it explicitly, its open connection keeps the
    // process alive long after the actual work is done.
    await prisma.$disconnect();
    redis.disconnect();
    publisher.disconnect();
  });
