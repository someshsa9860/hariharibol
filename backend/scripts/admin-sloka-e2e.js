// Walks the admin Daily sloka surface over real HTTP against a running API. Run
// it after `npm run dev`:
//
//   npm run test:admin-sloka
//
// Same shape as scripts/admin-reels-e2e.js: the session is issued directly, and
// everything after that is the real endpoint over the real transport.
//
// Two things are being checked. The picker behind the "Set sloka" dialog must
// list exactly the verses `PUT /slokas/:date` will accept — nothing more, so the
// editor is never offered a verse that is then refused, and nothing less — laid
// out book → canto (the Bhagavatam only) → chapter → verse. And a day's
// background image has to follow the same rules as every other upload: only a
// key this server issued for a sloka image, only if the file arrived, kept when
// the request leaves it out, removed on `null`, and a refused save must change
// nothing.
//
// Everything it creates is deleted again, files included. It uses dates in 2099.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as s3 from '../services/s3.js';
import { toDateColumn } from '../utils/date.js';
import { SLOKA_ELIGIBLE_BOOK_NUMBERS } from '../config/constants.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'admin-sloka-e2e-device';

// Far enough ahead that no real sloka is ever set for them.
const [DAY_A, DAY_B, DAY_C] = ['2099-06-01', '2099-06-02', '2099-06-03'];

let passed = 0;
let failed = 0;

function check(name, ok, detail = '') {
  console.log(
    `  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`
  );
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

// The dev upload path end to end: ask for a key, PUT the bytes where it says.
async function upload(token, kind, contentType, bytes = Buffer.from('not really an image')) {
  const signed = await call('POST', '/api/admin/uploads', { token, body: { kind, contentType } });
  const { key, uploadUrl, viaApi } = signed.json?.data ?? {};
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, ...(viaApi ? { authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  });
  return { key, status: put.status };
}

const put = (token, date, body) => call('PUT', `/api/admin/slokas/${date}`, { token, body });
const stored = (date) => prisma.dailySloka.findUnique({ where: { date: toDateColumn(date) } });
const ids = (books) => books.flatMap((b) => b.chapters.flatMap((c) => c.verses.map((v) => v.verseId)));
const ascending = (list) => list.every((n, i) => i === 0 || list[i - 1] <= n);

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }
  if (!s3.useLocalStorage) {
    console.error('\nThis script writes real objects; it only runs against local storage.\n');
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: { slug: 'super_admin' } } });
  const reader = await prisma.user.findFirst({ where: { role: { slug: 'user' } } });
  const moderator = await prisma.user.findFirst({ where: { role: { slug: 'moderator' } } });
  if (!admin || !reader) {
    console.error('\nNeed a super_admin and a plain user. Run `npm run seed` first.\n');
    process.exit(1);
  }

  await authService.invalidateUser(admin.id);
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);

  // The check above is about this script's own storage; the API has its own setting. Signing a link
  // makes no object, so ask it: a real presigned link carries no `viaApi`, and the test files this
  // writes must never reach a real bucket (this script could not delete them from there).
  const probe = await call('POST', '/api/admin/uploads', { token, body: { kind: 'slokaImage', contentType: 'image/png' } });
  if (!probe.json?.data?.viaApi) {
    console.error('\nThe API is signing real storage links. Start it with AWS_ACCESS_KEY_ID= and AWS_SECRET_ACCESS_KEY= blank.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  const files = []; // object keys to clean up

  try {
    console.log(`\nAdmin ${admin.email}, reader ${reader.email}`);

    // ── 1 ────────────────────────────────────────────────────────────────────
    console.log('\n1. Who may use it');
    const anon = await call('GET', '/api/admin/slokas/picker');
    check('signed out is 401', anon.status === 401, `HTTP ${anon.status}`);
    const plain = await call('GET', '/api/admin/slokas/picker', { token: readerToken });
    check('a plain user is 403', plain.status === 403, `HTTP ${plain.status}`);
    if (moderator) {
      await authService.invalidateUser(moderator.id);
      const { accessToken: moderatorToken } = await authService.issueSession(moderator, DEVICE);
      const moderated = await call('GET', '/api/admin/slokas/picker', { token: moderatorToken });
      check('a moderator can use it', moderated.status === 200, `HTTP ${moderated.status}`);
    }
    const listed = await call('GET', '/api/admin/slokas/picker', { token });
    check('an admin can use it', listed.status === 200, `HTTP ${listed.status}`);
    const books = listed.json?.data?.books ?? [];

    // ── 2 ────────────────────────────────────────────────────────────────────
    console.log('\n2. What the picker lists');
    const offered = ids(books);
    const eligible = await prisma.verse.findMany({
      where: { isSlokaEligible: true, bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS } },
      select: { verseId: true },
    });
    check('the Gita comes first, then the Bhagavatam', books.map((b) => b.bookNumber).join() === '1,2', books.map((b) => b.bookNumber).join());
    check(
      'every eligible verse is offered, and nothing else',
      offered.length === eligible.length && new Set(offered).size === offered.length && eligible.every((v) => offered.includes(v.verseId)),
      `${offered.length} offered, ${eligible.length} eligible`
    );

    const notEligible = await prisma.verse.findFirst({
      where: { isSlokaEligible: false, bookNumber: { in: SLOKA_ELIGIBLE_BOOK_NUMBERS } },
      select: { verseId: true },
    });
    check('a verse outside the pool is not offered', notEligible && !offered.includes(notEligible.verseId), notEligible?.verseId);

    const gita = books.find((b) => b.bookNumber === 1);
    const bhagavatam = books.find((b) => b.bookNumber === 2);
    check('the Gita has no cantos', gita?.cantos.length === 0 && gita.chapters.every((c) => c.cantoNumber === null));
    check(
      'the Bhagavatam has cantos, in order',
      bhagavatam?.cantos.length > 0 && ascending(bhagavatam.cantos.map((c) => c.number)),
      `${bhagavatam?.cantos.length} cantos`
    );
    check(
      'every Bhagavatam chapter belongs to a listed canto',
      bhagavatam?.chapters.every((c) => bhagavatam.cantos.some((k) => k.number === c.cantoNumber))
    );
    check(
      'every canto offered has a chapter to choose',
      bhagavatam?.cantos.every((k) => bhagavatam.chapters.some((c) => c.cantoNumber === k.number))
    );
    check(
      'chapters and verses are in reading order',
      books.every(
        (b) =>
          ascending(b.chapters.map((c) => (c.cantoNumber ?? 0) * 1000 + c.number)) &&
          b.chapters.every((c) => c.verses.length > 0 && ascending(c.verses.map((v) => v.verseNumber)))
      )
    );

    const firstGitaChapter = gita?.chapters[0];
    const gitaRow = firstGitaChapter
      ? await prisma.chapter.findFirst({ where: { book: { bookNumber: 1 }, number: firstGitaChapter.number } })
      : null;
    const english = gitaRow?.titleI18n?.en;
    if (english) {
      check('a Gita chapter is titled by its English heading, not the Sanskrit name', firstGitaChapter.title === english && firstGitaChapter.title !== gitaRow.title, firstGitaChapter.title);
    }
    check(
      'the verse text is sent for the preview',
      books.every((b) => b.chapters.every((c) => c.verses.every((v) => v.sanskrit === null || typeof v.sanskrit === 'string'))) &&
        offered.length > 0
    );

    // ── 3 ────────────────────────────────────────────────────────────────────
    console.log('\n3. What it offers is accepted');
    const firstGita = gita.chapters[0].verses[0].verseId;
    const lastChapter = bhagavatam.chapters[bhagavatam.chapters.length - 1];
    const lastBhagavatam = lastChapter.verses[lastChapter.verses.length - 1].verseId;
    const gitaSet = await put(token, DAY_A, { verseId: firstGita, isPublished: false });
    check('the first Gita verse offered is accepted', gitaSet.status === 201, `HTTP ${gitaSet.status} ${gitaSet.json?.error?.message ?? ''}`);
    const bhagavatamSet = await put(token, DAY_B, { verseId: lastBhagavatam, isPublished: false });
    check('the last Bhagavatam verse offered is accepted', bhagavatamSet.status === 201, `HTTP ${bhagavatamSet.status} ${bhagavatamSet.json?.error?.message ?? ''}`);
    const refused = await put(token, DAY_C, { verseId: notEligible.verseId });
    check('a verse the picker does not offer is refused', refused.status === 400, `HTTP ${refused.status}`);
    check('and nothing was set for that day', (await stored(DAY_C)) === null);

    // ── 4 ────────────────────────────────────────────────────────────────────
    console.log('\n4. A background image');
    check('a day with no image has none', (await stored(DAY_A)).imagePath === null);

    const first = await upload(token, 'slokaImage', 'image/jpeg');
    files.push(first.key);
    check('the key is issued under slokas/images', first.key?.includes('/slokas/images/') || first.key?.startsWith('slokas/images/'), first.key);
    check('the PUT is accepted', first.status === 200, `HTTP ${first.status}`);

    const withImage = await put(token, DAY_A, { verseId: firstGita, imagePath: first.key, isPublished: true });
    check('saving the day with the image is 201', withImage.status === 201, `HTTP ${withImage.status} ${withImage.json?.error?.message ?? ''}`);
    const savedKey = (await stored(DAY_A))?.imagePath;
    files.push(savedKey);
    check('the row keeps the permanent key, not the temp one', Boolean(savedKey) && !savedKey.startsWith('temp/') && savedKey.includes('slokas/images/'), savedKey);
    check('the file moved to it', await s3.objectExists(savedKey));
    check('and left the temp folder', !(await s3.objectExists(first.key)));

    const calendar = await call('GET', `/api/admin/slokas?from=${DAY_A}&to=${DAY_B}`, { token });
    const dayA = (calendar.json?.data?.slokas ?? []).find((s) => s.date.startsWith(DAY_A));
    check('the calendar sends the key and a link', dayA?.imagePath === savedKey && Boolean(dayA?.imageUrl), dayA?.imageUrl);
    check('a day without one has no link', (calendar.json?.data?.slokas ?? []).find((s) => s.date.startsWith(DAY_B))?.imageUrl === null);
    const served = dayA?.imageUrl ? await fetch(dayA.imageUrl) : null;
    check('the link serves the file', served?.status === 200, `HTTP ${served?.status}`);

    const changedVerse = await put(token, DAY_A, { verseId: lastBhagavatam, isPublished: true });
    check('changing only the verse is 201', changedVerse.status === 201, `HTTP ${changedVerse.status}`);
    check('and the image is kept when the request leaves it out', (await stored(DAY_A)).imagePath === savedKey);
    const echoed = await put(token, DAY_A, { verseId: lastBhagavatam, imagePath: savedKey, isPublished: true });
    check('sending the stored key back is accepted', echoed.status === 201, `HTTP ${echoed.status} ${echoed.json?.error?.message ?? ''}`);

    console.log('\n5. A refused save changes nothing');
    const wrongKind = await put(token, DAY_A, { verseId: firstGita, imagePath: s3.buildKey('deityImage', 'image/jpeg') });
    check('a key made for another kind of upload is 400', wrongKind.status === 400, wrongKind.json?.error?.message);
    const traversal = await put(token, DAY_A, { verseId: firstGita, imagePath: '../../etc/passwd' });
    check('a traversal key is 400', traversal.status === 400, `HTTP ${traversal.status}`);
    const invented = await put(token, DAY_A, { verseId: firstGita, imagePath: 'slokas/images/anything.jpg' });
    check('a key the server did not issue is 400', invented.status === 400, `HTTP ${invented.status}`);
    const ghost = await put(token, DAY_A, { verseId: firstGita, imagePath: s3.buildKey('slokaImage', 'image/jpeg') });
    check('a key whose file never arrived is 400', ghost.status === 400, ghost.json?.error?.message);
    const tooLong = await put(token, DAY_A, { verseId: firstGita, imagePath: 'x'.repeat(501) });
    check('a key over 500 characters is 400', tooLong.status === 400, `HTTP ${tooLong.status}`);

    const afterRefusals = await stored(DAY_A);
    check('after all of them the image is still the same', afterRefusals.imagePath === savedKey);
    const unchangedVerse = await prisma.verse.findUnique({ where: { id: afterRefusals.verseId }, select: { verseId: true } });
    check('and so is the verse', unchangedVerse.verseId === lastBhagavatam);

    // An upload that rode along with a verse the API then refused is not spent.
    const second = await upload(token, 'slokaImage', 'image/png');
    files.push(second.key);
    const wrongVerse = await put(token, DAY_C, { verseId: notEligible.verseId, imagePath: second.key });
    check('an image sent with a refused verse is 400', wrongVerse.status === 400, `HTTP ${wrongVerse.status}`);
    check('and its upload is still waiting', await s3.objectExists(second.key));

    console.log('\n6. Replacing and removing it');
    const replaced = await put(token, DAY_A, { verseId: lastBhagavatam, imagePath: second.key, isPublished: true });
    check('a new image replaces the old one', replaced.status === 201, `HTTP ${replaced.status} ${replaced.json?.error?.message ?? ''}`);
    const replacedKey = (await stored(DAY_A)).imagePath;
    files.push(replacedKey);
    check('the row points at the new file', replacedKey !== savedKey && (await s3.objectExists(replacedKey)), replacedKey);
    check('the old file is left in storage', await s3.objectExists(savedKey));

    const cleared = await put(token, DAY_A, { verseId: lastBhagavatam, imagePath: null, isPublished: true });
    check('null removes the image', cleared.status === 201, `HTTP ${cleared.status}`);
    check('the row has none', (await stored(DAY_A)).imagePath === null);
    const afterClear = await call('GET', `/api/admin/slokas?from=${DAY_A}&to=${DAY_A}`, { token });
    check('the calendar has no link for it', afterClear.json?.data?.slokas?.[0]?.imageUrl === null);

    const removed = await call('DELETE', `/api/admin/slokas/${DAY_A}`, { token });
    check('the day can still be cleared', removed.status === 204, `HTTP ${removed.status}`);
  } finally {
    await prisma.dailySloka.deleteMany({ where: { date: { in: [DAY_A, DAY_B, DAY_C].map(toDateColumn) } } });
    await Promise.all(files.filter(Boolean).map((key) => s3.deleteObject(key)));
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
