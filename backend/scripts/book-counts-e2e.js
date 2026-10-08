// Walks the book / canto / chapter counts against a running API. Run it after
// `npm run dev`:
//
//   npm run test:book-counts
//
// It builds its own little book (two cantos, three chapters, ten verses) so it
// does not depend on what has been imported, and deletes all of it again.
//
// What it is checking is the part that fails quietly: that the numbers the
// reading screens show — a chapter's verse count, a canto's chapter and verse
// counts, the book's totals — are rebuilt from the rows rather than trusted
// (trusting a total in a source file is what put "0 verses" on every chapter of
// cantos 10-12 of the Bhagavatam), that a healthy book is left alone, and that
// creating or deleting a verse in the admin panel keeps them right without
// anyone pressing "recount".

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';
import { recountBook } from '../services/book-counts.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'book-counts-e2e-device';
const STAMP = Date.now();

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, path, { token, body } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'content-type': 'application/json',
      'x-device-id': DEVICE,
      'x-platform': 'ios',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204 has no body.
  }
  return { status: res.status, json };
}

async function main() {
  if (env.isProduction) {
    console.error('\nThis script writes rows; it does not run against production.\n');
    process.exit(1);
  }
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }
  const admin = await prisma.user.findFirst({ where: { role: { slug: 'super_admin' } } });
  if (!admin) {
    console.error('\nNeed a super_admin. Run `npm run seed` and `npm run promote-admin` first.\n');
    process.exit(1);
  }

  await authService.invalidateUser(admin.id);
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const as = { token };

  let book = null;

  try {
    // ── fixture ─────────────────────────────────────────────────────────────
    // Created the way the old importer left things: every count at zero.
    book = await prisma.book.create({
      data: { bookNumber: 9_000_000 + (STAMP % 900_000), slug: `e2e-counts-book-${STAMP}`, type: 'SCRIPTURE', title: 'E2E Counts Book' },
    });
    const verseId = (canto, chapter, n) => `${book.bookNumber}.${canto}.${chapter}.${n}`;

    const cantos = [];
    for (const number of [1, 2]) cantos.push(await prisma.canto.create({ data: { bookId: book.id, number, title: `Canto ${number}` } }));

    // [canto index, chapter number, verses in it]
    const layout = [[0, 1, 3], [0, 2, 2], [1, 1, 4]];
    const chapters = [];
    for (const [ci, number, count] of layout) {
      const canto = cantos[ci];
      const chapter = await prisma.chapter.create({
        data: { bookId: book.id, cantoId: canto.id, cantoNumber: canto.number, number, title: `Chapter ${number}` },
      });
      chapters.push(chapter);
      for (let n = 1; n <= count; n++) {
        await prisma.verse.create({
          data: {
            verseId: verseId(canto.number, number, n),
            bookId: book.id,
            bookNumber: book.bookNumber,
            cantoNumber: canto.number,
            chapterId: chapter.id,
            chapterNumber: number,
            verseNumber: n,
          },
        });
      }
    }
    // A verse that hangs straight off the book, the way a short work's do: it counts
    // toward the book and toward no chapter or canto.
    await prisma.verse.create({
      data: { verseId: verseId(0, 0, 1), bookId: book.id, bookNumber: book.bookNumber, verseNumber: 1 },
    });

    // What is in the database right now, in the order of `layout`.
    const read = async () => {
      const [b, cs, chs] = await Promise.all([
        prisma.book.findUnique({ where: { id: book.id } }),
        prisma.canto.findMany({ where: { bookId: book.id }, orderBy: { number: 'asc' } }),
        prisma.chapter.findMany({ where: { bookId: book.id }, orderBy: [{ cantoNumber: 'asc' }, { number: 'asc' }] }),
      ]);
      return { book: b, cantos: cs, chapters: chs };
    };
    const shape = (s) => JSON.stringify({
      book: [s.book.totalCantos, s.book.totalChapters, s.book.totalVerses],
      cantos: s.cantos.map((c) => [c.totalChapters, c.totalVerses]),
      chapters: s.chapters.map((c) => c.totalVerses),
    });
    const RIGHT = JSON.stringify({ book: [2, 3, 10], cantos: [[2, 5], [1, 4]], chapters: [3, 2, 4] });
    const ZERO = JSON.stringify({ book: [0, 0, 0], cantos: [[0, 0], [0, 0]], chapters: [0, 0, 0] });

    // ── 1 ───────────────────────────────────────────────────────────────────
    console.log('\n1. A book fresh from an import, every count at zero');
    check('the fixture starts that way', shape(await read()) === ZERO, shape(await read()));

    const dry = await recountBook(book.id, { dryRun: true });
    check('a dry run reports every wrong row', dry.chapters === 3 && dry.cantos === 2 && dry.book === true && dry.changes.length === 6, JSON.stringify({ ...dry, changes: dry.changes.length }));
    check('and writes nothing', shape(await read()) === ZERO);
    check('each correction says what it is', dry.changes.some((line) => line.includes('canto 1 chapter 1') && line.includes('totalVerses 0 → 3')), dry.changes[0]);

    const fixed = await recountBook(book.id);
    check('the real run reports the same rows', fixed.chapters === 3 && fixed.cantos === 2 && fixed.book === true);
    check('chapters, cantos and the book are all rebuilt', shape(await read()) === RIGHT, shape(await read()));
    check('a verse with no chapter counts toward the book only', (await read()).book.totalVerses === 10 && (await read()).cantos.reduce((n, c) => n + c.totalVerses, 0) === 9);

    // ── 2 ───────────────────────────────────────────────────────────────────
    console.log('\n2. A healthy book is left alone');
    const stamps = async () => {
      const s = await read();
      return JSON.stringify([s.book.updatedAt, ...s.cantos.map((c) => c.updatedAt), ...s.chapters.map((c) => c.updatedAt)]);
    };
    const beforeStamps = await stamps();
    const again = await recountBook(book.id);
    check('a second run changes nothing', again.chapters === 0 && again.cantos === 0 && again.book === false && again.changes.length === 0);
    check('not even a modified-at', (await stamps()) === beforeStamps);

    // ── 3 ───────────────────────────────────────────────────────────────────
    console.log('\n3. The Bhagavatam case: chapters at zero, the rest looks right');
    await prisma.chapter.updateMany({ where: { bookId: book.id }, data: { totalVerses: 0 } });
    const chaptersOnly = await recountBook(book.id);
    check('only the chapters were wrong', chaptersOnly.chapters === 3 && chaptersOnly.cantos === 0 && chaptersOnly.book === false);
    check('and they are right again', shape(await read()) === RIGHT);

    // ── 4 ───────────────────────────────────────────────────────────────────
    console.log('\n4. Too high is wrong too, not only zero');
    await prisma.book.update({ where: { id: book.id }, data: { totalVerses: 999, totalCantos: 7 } });
    await prisma.canto.updateMany({ where: { bookId: book.id, number: 2 }, data: { totalChapters: 5 } });
    await prisma.chapter.update({ where: { id: chapters[0].id }, data: { totalVerses: 40 } });
    const high = await recountBook(book.id);
    check('all three levels are pulled back down', high.chapters === 1 && high.cantos === 1 && high.book === true);
    check('to what the rows say', shape(await read()) === RIGHT);

    // ── 5 ───────────────────────────────────────────────────────────────────
    console.log('\n5. The admin panel keeps them right without a recount');
    const created = await call('POST', '/api/admin/verses', {
      ...as,
      body: { verseId: verseId(1, 1, 4), bookId: book.id, chapterId: chapters[0].id, cantoNumber: 1, chapterNumber: 1, verseNumber: 4 },
    });
    check('a verse can be added', created.status === 201, `HTTP ${created.status} ${JSON.stringify(created.json?.error ?? '')}`);
    const afterAdd = await read();
    check('its chapter, canto and book all went up by one', afterAdd.chapters[0].totalVerses === 4 && afterAdd.cantos[0].totalVerses === 6 && afterAdd.book.totalVerses === 11, shape(afterAdd));

    const removed = await call('DELETE', `/api/admin/verses/${verseId(1, 1, 4)}`, as);
    check('and removed', removed.status === 204, `HTTP ${removed.status}`);
    check('which brings them back down', shape(await read()) === RIGHT, shape(await read()));

    const addedChapter = await call('POST', `/api/admin/books/${book.id}/chapters`, {
      ...as,
      body: { number: 3, cantoId: cantos[0].id, title: 'An empty chapter' },
    });
    check('a chapter can be added', addedChapter.status === 201, `HTTP ${addedChapter.status}`);
    const afterChapter = await read();
    check('the canto and the book count it', afterChapter.cantos[0].totalChapters === 3 && afterChapter.book.totalChapters === 4);
    check('and it starts at zero verses, truthfully', afterChapter.chapters.find((c) => c.number === 3)?.totalVerses === 0);

    await prisma.book.update({ where: { id: book.id }, data: { totalVerses: 0 } });
    await prisma.chapter.update({ where: { id: chapters[1].id }, data: { totalVerses: 0 } });
    const recount = await call('POST', `/api/admin/books/${book.id}/recount`, as);
    check('the recount endpoint answers with the book', recount.status === 200 && recount.json?.data?.totalVerses === 10, `HTTP ${recount.status}`);
    check('and has repaired the chapter too', (await read()).chapters.find((c) => c.id === chapters[1].id)?.totalVerses === 2);

    // ── 6 ───────────────────────────────────────────────────────────────────
    console.log('\n6. Edges');
    check('signed out is 401', (await call('POST', `/api/admin/books/${book.id}/recount`)).status === 401);
    // Prisma logs its own "No record was found" above this line; that is the error being asked for.
    check('an unknown book is an error rather than a quiet nothing', await recountBook('no-such-book').then(() => false, () => true));
  } finally {
    if (book) await prisma.book.delete({ where: { id: book.id } }); // cascades cantos, chapters, verses
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
