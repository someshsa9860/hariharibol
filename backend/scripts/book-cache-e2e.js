// Walks the weekly book export and the offline-sync endpoints over real HTTP.
// Run it after `npm run dev` (with AWS_ACCESS_KEY_ID= and AWS_SECRET_ACCESS_KEY=
// blank, so files land in backend/storage/ instead of the real bucket):
//
//   npm run test:book-cache
//
// It builds its own little books (a canto-cut one and a chapter-cut one), runs the
// export through the admin endpoint, and deletes everything — rows and files —
// afterwards. What it is checking is the part that costs money when it is wrong:
// that an unchanged unit is never uploaded again, that a changed one is uploaded
// exactly once with its version bumped, that the app gets a working short-lived
// link whose bytes match the hash it was promised, and that two exports cannot run
// at once.

import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import crypto from 'node:crypto';

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import env from '../config/env.js';
import { bookCache } from '../config/book-cache.js';
import * as authService from '../services/auth.js';
import * as s3 from '../services/s3.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'book-cache-e2e-device';
const STAMP = Date.now();
const TAG = `e2e-bc-${STAMP}`;

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, url, { token, body } = {}) {
  const res = await fetch(BASE + url, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

async function makeUser(roleSlug, label) {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  const user = await prisma.user.create({
    data: { email: `${TAG}-${label}@example.test`, name: label, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${TAG}-${label}` },
  });
  await redis.del(`rl:write:${user.id}`, `rl:read:${user.id}`);
  const { accessToken } = await authService.issueSession(user, DEVICE);
  return { user, token: accessToken };
}

async function main() {
  if (env.isProduction) { console.error('Does not run against production.'); process.exit(1); }
  if (!s3.useLocalStorage) { console.error('Run with blank AWS keys so files stay in backend/storage/.'); process.exit(1); }
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) { console.error(`The API is not answering on ${BASE}. Start it with \`npm run dev\` first.`); process.exit(1); }

  const admin = await makeUser('super_admin', 'admin');
  const reader = await makeUser('user', 'reader');
  const users = [admin.user.id, reader.user.id];
  const books = [];
  let translator = null;

  try {
    // ── fixture ─────────────────────────────────────────────────────────────
    translator = await prisma.translator.create({ data: { slug: TAG, name: 'E2E Translator' } });
    const mkBook = (suffix, n) => prisma.book.create({
      data: { bookNumber: 8_000_000 + (STAMP % 900_000) * 10 + n, slug: `${TAG}-${suffix}`, type: 'SCRIPTURE', title: `E2E ${suffix}`, isPublished: true },
    });
    const mkVerse = async (book, chapter, canto, n) => {
      const verse = await prisma.verse.create({
        data: {
          verseId: `${book.bookNumber}.${canto?.number ?? 0}.${chapter.number}.${n}`, bookId: book.id, bookNumber: book.bookNumber,
          cantoNumber: canto?.number ?? null, chapterId: chapter.id, chapterNumber: chapter.number, verseNumber: n,
          sanskrit: `श्लोक ${n}`, transliteration: `shloka ${n}`, wordMeanings: [{ word: 'a', meaning: 'b' }],
        },
      });
      for (const lang of ['en', 'hi']) {
        await prisma.verseTranslation.create({
          data: { verseId: verse.id, translatorId: translator.id, languageCode: lang, meaning: `${lang} meaning ${n}`, purport: `${lang} purport ${n}`, isPublished: true },
        });
      }
      // A draft rendering must never be exported.
      await prisma.verseTranslation.create({
        data: { verseId: verse.id, translatorId: translator.id, languageCode: 'mr', meaning: 'draft', isPublished: false },
      });
      return verse;
    };

    const cantoBook = await mkBook('canto', 1);
    const chapterBook = await mkBook('chapter', 2);
    books.push(cantoBook, chapterBook);
    const cantos = [];
    for (const number of [1, 2]) cantos.push(await prisma.canto.create({ data: { bookId: cantoBook.id, number, title: `Canto ${number}` } }));
    let aVerse;
    for (const [ci, number, count] of [[0, 1, 3], [0, 2, 2], [1, 1, 2]]) {
      const ch = await prisma.chapter.create({ data: { bookId: cantoBook.id, cantoId: cantos[ci].id, cantoNumber: cantos[ci].number, number, title: `Ch ${number}` } });
      for (let n = 1; n <= count; n += 1) { const v = await mkVerse(cantoBook, ch, cantos[ci], n); aVerse ??= v; }
    }
    const gitaChapters = [];
    for (const number of [1, 2, 3]) {
      const ch = await prisma.chapter.create({ data: { bookId: chapterBook.id, number, title: `Chapter ${number}` } });
      gitaChapters.push(ch);
      for (let n = 1; n <= 2; n += 1) await mkVerse(chapterBook, ch, null, n);
    }
    const slugs = [cantoBook.slug, chapterBook.slug];
    const run = (body = {}) => call('POST', '/api/admin/book-cache/run', { token: admin.token, body: { books: slugs, wait: true, ...body } });
    const key = (book, type, n) => `${bookCache.prefix}/${book.slug}/${type}-${n}.json`;
    const readUnit = async (k) => JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(s3.LOCAL_STORAGE_ROOT, k))));

    // ── access ──────────────────────────────────────────────────────────────
    console.log('\nAccess');
    check('export trigger refuses a signed-out caller', (await call('POST', '/api/admin/book-cache/run', { body: { wait: true } })).status === 401);
    check('export trigger refuses a reader', (await call('POST', '/api/admin/book-cache/run', { token: reader.token, body: { wait: true } })).status === 403);

    // ── first export ────────────────────────────────────────────────────────
    console.log('\nFirst export');
    const dry = (await run({ dryRun: true })).json.data.report;
    check('dry run reports 2 canto + 3 chapter units to create, writes nothing', dry.created === 5 && dry.bytesUploaded === 0 && (await prisma.bookCacheUnit.count({ where: { bookId: { in: books.map((b) => b.id) } } })) === 0, JSON.stringify({ c: dry.created, b: dry.bytesUploaded }));
    const first = (await run()).json.data.report;
    check('creates 5 units, none failed', first.created === 5 && first.failed === 0 && first.skipped === 0, JSON.stringify(first));
    check('wrote the manifest', first.manifestUpdated === true);
    check('uploaded bytes counted', first.bytesUploaded > 0);

    const canto1 = await readUnit(key(cantoBook, 'canto', 1));
    check('canto file holds both its chapters and all 5 verses', canto1.chapters.length === 2 && canto1.verses.length === 5, `${canto1.chapters.length}/${canto1.verses.length}`);
    check('verses are in order', canto1.verses.map((v) => `${v.chapterNumber}.${v.verseNumber}`).join() === '1.1,1.2,1.3,2.1,2.2');
    check('verse carries sanskrit, transliteration, word meanings', canto1.verses[0].sanskrit === 'श्लोक 1' && canto1.verses[0].transliteration === 'shloka 1' && canto1.verses[0].wordMeanings.length === 1);
    check('verse carries every published language, not drafts', canto1.verses[0].translations.map((t) => t.languageCode).join() === 'en,hi');
    check('translation carries meaning, purport and translator', canto1.verses[0].translations[0].purport === 'en purport 1' && canto1.verses[0].translations[0].translatorSlug === TAG);
    check('file has schemaVersion and updatedAt', canto1.schemaVersion === bookCache.schemaVersion && !Number.isNaN(Date.parse(canto1.updatedAt)));
    check('chapter-cut book writes chapter-<n>.json', (await readUnit(key(chapterBook, 'chapter', 2))).verses.length === 2);
    const manifestFile = JSON.parse(zlib.gunzipSync(await fs.readFile(path.join(s3.LOCAL_STORAGE_ROOT, bookCache.manifestKey))));
    check('manifest.json lists the units', manifestFile.units.filter((u) => slugs.includes(u.bookSlug)).length === 5);
    const staged = await fs.readdir(path.join(s3.LOCAL_STORAGE_ROOT, bookCache.stagingPrefix, cantoBook.slug)).catch(() => []);
    check('staging copies are cleaned up', staged.length === 0);

    // ── unchanged ───────────────────────────────────────────────────────────
    console.log('\nSecond export, nothing changed');
    const before = await prisma.bookCacheUnit.findMany({ where: { bookId: { in: books.map((b) => b.id) } }, orderBy: { id: 'asc' } });
    const second = (await run()).json.data.report;
    check('skips all 5, uploads nothing', second.skipped === 5 && second.created + second.changed === 0 && second.bytesUploaded === 0, JSON.stringify(second));
    check('manifest left alone', second.manifestUpdated === false);
    const after = await prisma.bookCacheUnit.findMany({ where: { bookId: { in: books.map((b) => b.id) } }, orderBy: { id: 'asc' } });
    check('versions and hashes did not move', JSON.stringify(before.map((r) => [r.version, r.hash])) === JSON.stringify(after.map((r) => [r.version, r.hash])));

    // ── one change ──────────────────────────────────────────────────────────
    console.log('\nOne purport edited');
    await prisma.verseTranslation.updateMany({ where: { verseId: aVerse.id, languageCode: 'en' }, data: { purport: 'edited' } });
    const third = (await run()).json.data.report;
    check('exactly one unit re-uploaded', third.changed === 1 && third.skipped === 4 && third.created === 0, JSON.stringify(third));
    const row1 = await prisma.bookCacheUnit.findFirst({ where: { bookId: cantoBook.id, unitNumber: 1 } });
    const row2 = await prisma.bookCacheUnit.findFirst({ where: { bookId: cantoBook.id, unitNumber: 2 } });
    check('that unit is version 2, its neighbour still 1', row1.version === 2 && row2.version === 1, `${row1.version}/${row2.version}`);
    check('the file now carries the edit', (await readUnit(key(cantoBook, 'canto', 1))).verses[0].translations[0].purport === 'edited');

    // ── missing file ────────────────────────────────────────────────────────
    console.log('\nFile lost from the bucket');
    await fs.rm(path.join(s3.LOCAL_STORAGE_ROOT, key(chapterBook, 'chapter', 3)));
    const fourth = (await run()).json.data.report;
    const row3 = await prisma.bookCacheUnit.findFirst({ where: { bookId: chapterBook.id, unitNumber: 3 } });
    check('re-uploaded at the same version', fourth.repaired === 1 && row3.version === 1, JSON.stringify(fourth));
    check('and is back', await s3.objectExists(key(chapterBook, 'chapter', 3)));

    // ── lock ────────────────────────────────────────────────────────────────
    console.log('\nConcurrency');
    await redis.set(bookCache.lockKey, 'someone-else', 'PX', 30000);
    const locked = (await run()).json.data.report;
    check('a run while another holds the lock does nothing', locked.locked === true && locked.checked === 0);
    await redis.del(bookCache.lockKey);
    check('and the lock is free again afterwards', (await run()).json.data.report.locked === false);

    // ── manifest endpoint ───────────────────────────────────────────────────
    console.log('\nManifest endpoint');
    const mf = await call('GET', `/api/app/books/${cantoBook.slug}/manifest`);
    check('is public and lists 2 cantos', mf.status === 200 && mf.json.data.totalUnits === 2 && mf.json.data.unitType === 'canto');
    check('each unit has version, hash, size', mf.json.data.units.every((u) => u.version >= 1 && u.hash.length === 64 && u.sizeBytes > 0));
    check('works by book id too', (await call('GET', `/api/app/books/${cantoBook.id}/manifest`)).json.data.totalUnits === 2);
    check('unknown book is a 404', (await call('GET', '/api/app/books/no-such-book/manifest')).status === 404);
    const empty = await prisma.book.create({ data: { bookNumber: 7_000_000 + (STAMP % 900_000), slug: `${TAG}-empty`, type: 'STOTRA', title: 'E2E short', isPublished: true } });
    books.push(empty);
    check('a book that is not exported returns an empty list', (await call('GET', `/api/app/books/${empty.slug}/manifest`)).json.data.units.length === 0);
    const draft = await prisma.book.create({ data: { bookNumber: 6_000_000 + (STAMP % 900_000), slug: `${TAG}-draft`, type: 'SCRIPTURE', title: 'draft', isPublished: false } });
    books.push(draft);
    check('an unpublished book is a 404', (await call('GET', `/api/app/books/${draft.slug}/manifest`)).status === 404);

    // ── download-url ────────────────────────────────────────────────────────
    console.log('\nDownload URL');
    const canto1Row = await prisma.bookCacheUnit.findFirst({ where: { bookId: cantoBook.id, unitNumber: 1 } });
    const dl = await call('POST', `/api/app/books/${cantoBook.slug}/download-url`, { body: { chapterId: canto1Row.unitId } });
    check('POST with the canto id answers 200', dl.status === 200, JSON.stringify(dl.json));
    const d = dl.json.data;
    check('carries url, version, hash, size, type', d.presignedUrl && d.version === 2 && d.hash === canto1Row.hash && d.sizeBytes === canto1Row.sizeBytes && d.unitType === 'canto');
    check('link lives minutes, not hours', d.expiresInSeconds <= 900);
    let bytes = Buffer.from(await (await fetch(d.presignedUrl)).arrayBuffer());
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) bytes = zlib.gunzipSync(bytes);
    check('the downloaded bytes match the promised hash', crypto.createHash('sha256').update(bytes).digest('hex') === d.hash);
    const viaGet = await call('GET', `/api/app/books/${cantoBook.slug}/download-url?unitId=${canto1Row.unitId}`);
    check('GET with unitId works too', viaGet.status === 200 && viaGet.json.data.hash === d.hash);
    check('no unit given is a 400', (await call('POST', `/api/app/books/${cantoBook.slug}/download-url`, { body: {} })).status === 400);
    check('unknown unit is a 404', (await call('POST', `/api/app/books/${cantoBook.slug}/download-url`, { body: { unitId: 'nope' } })).status === 404);
    check('a unit of another book is a 404', (await call('POST', `/api/app/books/${chapterBook.slug}/download-url`, { body: { unitId: canto1Row.unitId } })).status === 404);

    // ── audio links ─────────────────────────────────────────────────────────
    console.log('\nAudio links');
    await prisma.verse.update({ where: { id: aVerse.id }, data: { audioPath: `verses/audio/${TAG}.mp3` } });
    const au = await call('POST', `/api/app/books/${cantoBook.slug}/audio-urls`, { body: { verseIds: [aVerse.id, 'nope'] } });
    check('returns a link for a verse with audio and omits the rest', au.status === 200 && Object.keys(au.json.data.urls).join() === aVerse.id);
    check('rejects an empty list', (await call('POST', `/api/app/books/${cantoBook.slug}/audio-urls`, { body: { verseIds: [] } })).status === 400);
  } finally {
    for (const book of books) {
      await prisma.book.delete({ where: { id: book.id } }).catch(() => {});
      await fs.rm(path.join(s3.LOCAL_STORAGE_ROOT, bookCache.prefix, book.slug), { recursive: true, force: true });
      await fs.rm(path.join(s3.LOCAL_STORAGE_ROOT, bookCache.stagingPrefix, book.slug), { recursive: true, force: true });
    }
    if (translator) await prisma.translator.delete({ where: { id: translator.id } }).catch(() => {});
    await prisma.auditLog.deleteMany({ where: { actorId: { in: users } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { id: { in: users } } }).catch(() => {});
    await redis.del(bookCache.lockKey);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => { console.error(err); process.exit(1); });
