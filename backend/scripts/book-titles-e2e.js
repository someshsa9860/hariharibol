// Walks the translated titles of books, cantos and chapters against a running
// API. Run it after `npm run dev`:
//
//   npm run test:book-titles
//
// It builds its own little published book (one canto, two chapters) so it does
// not depend on what has been imported, and deletes all of it again.
//
// Two halves of one feature:
//   admin — the languages a title can be written in, and saving a title's
//           translations on a book, a canto and a chapter (the admin panel's
//           "Titles" dialog does exactly these calls);
//   app   — what a phone is sent: for every title, the plain English one and a
//           `{ code: text }` map that always holds `en`, so the app can choose
//           by the reader's languages without a second request.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import env from '../config/env.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'book-titles-e2e-device';
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

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

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
    // Titles the way the importers leave them: English in the plain column,
    // and on a chapter also in the map.
    book = await prisma.book.create({
      data: {
        bookNumber: 9_000_000 + (STAMP % 900_000),
        slug: `e2e-titles-book-${STAMP}`,
        type: 'SCRIPTURE',
        title: 'E2E Titles Book',
        description: 'About the book',
        isPublished: true,
      },
    });
    const canto = await prisma.canto.create({ data: { bookId: book.id, number: 1, title: 'Creation' } });
    const chapter1 = await prisma.chapter.create({
      data: {
        bookId: book.id,
        cantoId: canto.id,
        cantoNumber: 1,
        number: 1,
        title: 'Observing the Armies',
        titleI18n: { en: 'Observing the Armies' },
      },
    });
    const chapter2 = await prisma.chapter.create({
      data: { bookId: book.id, cantoId: canto.id, cantoNumber: 1, number: 2, title: 'Contents Summarized' },
    });

    const adminBook = async () => (await call('GET', `/api/admin/books/${book.id}`, as)).json?.data;

    // ── 1 ───────────────────────────────────────────────────────────────────
    console.log('\n1. The languages a title can be written in');
    const signedOut = await call('GET', '/api/admin/books/languages');
    check('signed out is 401', signedOut.status === 401, `HTTP ${signedOut.status}`);

    const langs = await call('GET', '/api/admin/books/languages', as);
    check('answers 200 (and "languages" is not read as a book id)', langs.status === 200, `HTTP ${langs.status}`);
    const codes = (langs.json?.data ?? []).map((l) => l.code);
    const wanted = (
      await prisma.language.findMany({
        where: { isActive: true, isReadingLanguage: true, code: { not: 'en' } },
        orderBy: { displayOrder: 'asc' },
        select: { code: true },
      })
    ).map((l) => l.code);
    check('it lists the active reading languages in display order', codes.length > 0 && same(codes, wanted), codes.join(','));
    check('English is not in it — it is the source', !codes.includes('en'));
    check('Sanskrit is not in it — it is a verse language only', !codes.includes('sa'));
    const first = langs.json?.data?.[0] ?? {};
    check(
      'each has a code, native and English name and a direction',
      typeof first.code === 'string' && !!first.nativeName && !!first.englishName && typeof first.isRtl === 'boolean',
      JSON.stringify(first)
    );

    // ── 2 ───────────────────────────────────────────────────────────────────
    console.log('\n2. Saving titles from the admin panel');
    const before = await adminBook();
    check('the admin book carries its cantos and chapters', before?.cantos?.length === 1 && before?.chapters?.length === 2);
    check('a chapter shows the map the importer wrote', same(before?.chapters?.[0]?.titleI18n, { en: 'Observing the Armies' }));
    check('a canto with none shows null', before?.cantos?.[0]?.titleI18n == null);

    const patchBook = await call('PATCH', `/api/admin/books/${book.id}`, {
      ...as,
      body: { titleI18n: { hi: 'ई२ई शीर्षक', mr: 'ई२ई ग्रंथ' } },
    });
    check('a book takes a titleI18n on its own', patchBook.status === 200, `HTTP ${patchBook.status}`);
    const patchCanto = await call('PATCH', `/api/admin/books/${book.id}/cantos/${canto.id}`, {
      ...as,
      body: { titleI18n: { hi: 'सृष्टि' } },
    });
    check('a canto takes one', patchCanto.status === 200, `HTTP ${patchCanto.status}`);
    const patchChapter = await call('PATCH', `/api/admin/books/${book.id}/chapters/${chapter1.id}`, {
      ...as,
      body: { titleI18n: { en: 'Observing the Armies', hi: 'अर्जुनविषादयोग', mr: 'अर्जुनविषादयोग' } },
    });
    check('a chapter takes one', patchChapter.status === 200, `HTTP ${patchChapter.status}`);

    const after = await adminBook();
    check('the book keeps what was sent', same(after?.titleI18n, { hi: 'ई२ई शीर्षक', mr: 'ई२ई ग्रंथ' }));
    check('and its English title and description are untouched', after?.title === 'E2E Titles Book' && after?.description === 'About the book');
    check('the canto keeps its map', same(after?.cantos?.[0]?.titleI18n, { hi: 'सृष्टि' }));
    check('and its English title is untouched', after?.cantos?.[0]?.title === 'Creation');
    check('the chapter keeps its map', after?.chapters?.[0]?.titleI18n?.hi === 'अर्जुनविषादयोग');
    check('the other chapter is not touched', after?.chapters?.[1]?.titleI18n == null);

    const drop = await call('PATCH', `/api/admin/books/${book.id}/chapters/${chapter1.id}`, {
      ...as,
      body: { titleI18n: { en: 'Observing the Armies', hi: 'अर्जुनविषादयोग' } },
    });
    check('a map is replaced whole, so a language can be withdrawn', drop.status === 200 && drop.json?.data?.titleI18n?.mr === undefined);

    // ── 3 ───────────────────────────────────────────────────────────────────
    console.log('\n3. What a phone is sent');
    const bookRes = await call('GET', `/api/app/books/${book.slug}`);
    const sent = bookRes.json?.data;
    check('the book answers publicly', bookRes.status === 200, `HTTP ${bookRes.status}`);
    check('its title map holds the saved languages and English from the plain column', same(sent?.titleI18n, { hi: 'ई२ई शीर्षक', mr: 'ई२ई ग्रंथ', en: 'E2E Titles Book' }), JSON.stringify(sent?.titleI18n));
    check('its description map is just the English', same(sent?.descriptionI18n, { en: 'About the book' }), JSON.stringify(sent?.descriptionI18n));

    const cantoRes = await call('GET', `/api/app/books/${book.slug}/cantos`);
    const sentCanto = cantoRes.json?.data?.[0];
    check('a canto carries its map with English added', same(sentCanto?.titleI18n, { hi: 'सृष्टि', en: 'Creation' }), JSON.stringify(sentCanto?.titleI18n));
    check('and still its plain English title', sentCanto?.title === 'Creation');

    const chapterRes = await call('GET', `/api/app/books/${book.slug}/chapters?canto=1`);
    const [sent1, sent2] = chapterRes.json?.data ?? [];
    check('a chapter carries its map', sent1?.titleI18n?.hi === 'अर्जुनविषादयोग' && sent1?.titleI18n?.en === 'Observing the Armies', JSON.stringify(sent1?.titleI18n));
    check('one with no translation still gets a map with English, so the app has one shape', same(sent2?.titleI18n, { en: 'Contents Summarized' }), JSON.stringify(sent2?.titleI18n));
    check('no summary on either, so no summary map', sent1?.summaryI18n == null && sent2?.summaryI18n == null);

    // A blank string is no title: the app must not show an empty heading.
    await prisma.chapter.update({ where: { id: chapter2.id }, data: { titleI18n: { hi: '   ', mr: '' } } });
    const blank = (await call('GET', `/api/app/books/${book.slug}/chapters?canto=1`)).json?.data?.[1];
    check('blank titles are left out of what is sent', same(blank?.titleI18n, { en: 'Contents Summarized' }), JSON.stringify(blank?.titleI18n));
  } finally {
    if (book) await prisma.book.delete({ where: { id: book.id } }); // cascades cantos, chapters
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
