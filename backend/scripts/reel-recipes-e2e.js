// Walks "make reels from the verses of a book" over real HTTP against a running
// API. Run it after `npm run dev`:
//
//   npm run test:reel-recipes
//
// It builds its own little book (a canto, two chapters, five verses with
// translations and recitation files) so it does not depend on what has been
// imported, and deletes all of it again.
//
// What it is checking is the part that fails quietly: that a reel made from a
// verse is tagged the standard way, that its bound text follows the *reader's*
// language when fetched rather than what was typed when it was made, that a
// second run makes the next batch instead of duplicates, and that "similar"
// puts the same chapter first.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as s3 from '../services/s3.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'reel-recipes-e2e-device';
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

async function upload(token, kind, contentType, bytes = Buffer.from('not really media')) {
  const signed = await call('POST', '/api/admin/uploads', { token, body: { kind, contentType } });
  const { key, uploadUrl, viaApi } = signed.json?.data ?? {};
  await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, ...(viaApi ? { authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  });
  return key;
}

const box = (id, bind, extra = {}) => ({
  id,
  text: bind ? `[${bind}]` : 'Hare Krishna',
  x: 8,
  y: 30,
  width: 84,
  size: 5,
  style: 'verse',
  color: 'light',
  align: 'center',
  ...(bind ? { bind } : {}),
  ...extra,
});

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
  const creator = await prisma.creatorProfile.findFirst({ where: { status: 'APPROVED' } });
  const userRole = await prisma.role.findFirst({ where: { slug: 'user' } });
  if (!admin || !creator || !userRole) {
    console.error('\nNeed a super_admin, an approved creator and the user role. Run `npm run seed` and `npm run seed:reels` first.\n');
    process.exit(1);
  }

  await authService.invalidateUser(admin.id);
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const as = { token };

  const reader = await prisma.user.create({
    data: {
      email: `recipes-e2e-${STAMP}@example.com`,
      authProvider: 'GOOGLE',
      providerUserId: `recipes-e2e-${STAMP}`,
      roleId: userRole.id,
      readingLanguage: 'en',
      appLanguage: 'en',
    },
  });
  const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);
  const asReader = { token: readerToken };

  const files = [];
  const made = [];
  let book = null;
  let templateId = null;
  let translator = null;
  const slug = `e2e-recipe-book-${STAMP}`;

  try {
    // ── fixture ─────────────────────────────────────────────────────────────
    translator = await prisma.translator.create({ data: { slug: `e2e-translator-${STAMP}`, name: 'E2E Translator' } });
    book = await prisma.book.create({
      data: { bookNumber: 9_000_000 + (STAMP % 900_000), slug, type: 'SCRIPTURE', title: 'E2E Recipe Book', totalVerses: 5, totalCantos: 1, deityId: null },
    });
    const canto = await prisma.canto.create({ data: { bookId: book.id, number: 1, title: `Creation ${STAMP}` } });
    const chapters = [];
    for (const [number, title] of [[1, `Karma Yoga ${STAMP}`], [2, `Surrender ${STAMP}`]]) {
      chapters.push(await prisma.chapter.create({ data: { bookId: book.id, cantoId: canto.id, cantoNumber: 1, number, title } }));
    }

    const goodAudio = await upload(token, 'reelAudio', 'audio/mpeg');
    const goodAudio2 = await upload(token, 'reelAudio', 'audio/mpeg');
    files.push(goodAudio, goodAudio2);

    // [chapter index, verse number, audio, English, Hindi]
    const spec = [
      [0, 1, goodAudio, 'You have a right to action alone', 'कर्म पर ही तुम्हारा अधिकार है'],
      [0, 2, goodAudio2, 'Never to its fruits', 'फल पर कभी नहीं'],
      [0, 3, `reels/audio/missing-${STAMP}.mp3`, 'Let not the fruit be your motive', 'फल तुम्हारा हेतु न हो'],
      [1, 1, null, 'Abandon all varieties of religion and just surrender unto Me', 'सब धर्मों को त्यागकर मेरी शरण में आओ'],
      [1, 2, null, null, null],
    ];
    const verses = [];
    for (const [ci, n, audioPath, en, hi] of spec) {
      const verse = await prisma.verse.create({
        data: {
          verseId: `E2E.${STAMP}.1.${ci + 1}.${n}`,
          bookId: book.id,
          bookNumber: book.bookNumber,
          cantoNumber: 1,
          chapterId: chapters[ci].id,
          chapterNumber: ci + 1,
          verseNumber: n,
          sanskrit: `संस्कृत ${ci + 1}.${n}`,
          transliteration: `sanskrit ${ci + 1}.${n}`,
          audioPath,
          tags: ci === 1 ? ['bhakti'] : ['karma'],
        },
      });
      for (const [lang, meaning] of [['en', en], ['hi', n === 1 && ci === 0 ? hi : n === 1 ? hi : null]]) {
        if (meaning) {
          await prisma.verseTranslation.create({ data: { verseId: verse.id, translatorId: translator.id, languageCode: lang, meaning, isPublished: true } });
        }
      }
      verses.push(verse);
    }
    // 2.1's Hindi and chapter 1's second verse deliberately missing — see below.

    // ── 1 ───────────────────────────────────────────────────────────────────
    console.log('\n1. Who may use it');
    check('signed out is 401', (await call('GET', '/api/admin/reel-recipes/books')).status === 401);
    check('a plain user is 403', (await call('GET', '/api/admin/reel-recipes/books', asReader)).status === 403);

    // ── 2 ───────────────────────────────────────────────────────────────────
    console.log('\n2. Choosing a book');
    const books = await call('GET', '/api/admin/reel-recipes/books', as);
    check('the book is offered', books.json?.data?.some((b) => b.id === book.id));
    const outline = await call('GET', `/api/admin/reel-recipes/outline?bookId=${book.id}`, as);
    check('cantos and chapters are listed', outline.json?.data?.cantos?.length === 1 && outline.json.data.chapters.length === 2);
    check('topic tags are listed with counts', outline.json?.data?.tags?.some((t) => t.tag === 'karma' && t.count === 3));
    check('an unknown book is 404', (await call('GET', '/api/admin/reel-recipes/outline?bookId=nope', as)).status === 404);

    // ── 3 ───────────────────────────────────────────────────────────────────
    console.log('\n3. The template');
    const bg = await upload(token, 'reelImage', 'image/png');
    const music = await upload(token, 'reelAudio', 'audio/mpeg');
    files.push(bg, music);
    const config = {
      mediaType: 'IMAGE',
      videoPath: null,
      images: [bg],
      audioPath: music,
      thumbnailPath: null,
      durationMs: null,
      width: null,
      height: null,
      overlays: [box('o-sa', 'sanskrit', { y: 20 }), box('o-tr', 'translation', { y: 50, style: 'body', size: 4 }), box('o-ref', 'reference', { y: 80, size: 3 }), box('o-fixed', null, { y: 8, style: 'heading' })],
    };
    const badKey = await call('POST', '/api/admin/reel-recipes/templates', { ...as, body: { name: 'bad', config: { ...config, images: ['somewhere/else.png'] } } });
    check('a key the server never issued is refused', badKey.status === 400, `HTTP ${badKey.status}`);
    const badBind = await call('POST', '/api/admin/reel-recipes/templates', { ...as, body: { name: 'bad', config: { ...config, overlays: [box('x', 'nonsense')] } } });
    check('an unknown binding is refused', badBind.status === 400, `HTTP ${badBind.status}`);
    const tpl = await call('POST', '/api/admin/reel-recipes/templates', { ...as, body: { name: `E2E template ${STAMP}`, config } });
    templateId = tpl.json?.data?.id;
    check('a template can be saved', tpl.status === 201 && templateId, `HTTP ${tpl.status}`);
    check('it comes back with signed media links', Boolean(tpl.json?.data?.images?.[0]?.url && tpl.json.data.audioUrl));
    check('bindings survive the round trip', tpl.json?.data?.overlays?.find((o) => o.id === 'o-tr')?.bind === 'translation');
    const rename = await call('PATCH', `/api/admin/reel-recipes/templates/${templateId}`, { ...as, body: { name: `E2E renamed ${STAMP}` } });
    check('it can be renamed without resending the design', rename.status === 200 && rename.json.data.name.includes('renamed') && rename.json.data.overlays.length === 4);
    check('it is listed', (await call('GET', '/api/admin/reel-recipes/templates', as)).json?.data?.some((t) => t.id === templateId));

    // ── 4 ───────────────────────────────────────────────────────────────────
    console.log('\n4. Choosing verses');
    const sel = (extra = {}) => ({ bookId: book.id, hints: [], limit: 20, languageCode: 'en', ...extra });
    const prev = (selection, extra = {}) => call('POST', '/api/admin/reel-recipes/preview', { ...as, body: { selection, ...extra } });

    check('the whole book is five verses', (await prev(sel())).json?.data?.total === 5);
    check('a chapter narrows it', (await prev(sel({ chapterId: chapters[0].id }))).json?.data?.total === 3);
    check('a verse range narrows it', (await prev(sel({ chapterId: chapters[0].id, verseFrom: 2, verseTo: 3 }))).json?.data?.total === 2);
    check('a topic tag narrows it', (await prev(sel({ tag: 'bhakti' }))).json?.data?.total === 2);
    check('a hint finds a word in a translation', (await prev(sel({ hints: ['surrender'] }))).json?.data?.total === 1);
    check('a hint finds a word in the transliteration', (await prev(sel({ hints: ['SANSKRIT 2.1'] }))).json?.data?.total === 1);
    check('nonsense finds nothing', (await prev(sel({ hints: ['zzzqqq'] }))).json?.data?.total === 0);
    const audioOnly = await prev(sel(), { useVerseAudio: true });
    check('asking for the recitation leaves out verses without one', audioOnly.json?.data?.total === 3);
    const limited = await prev(sel({ limit: 2 }));
    check('the limit caps what a run would make', limited.json?.data?.willCreate === 2 && limited.json.data.total === 5);
    const sample = limited.json?.data?.sample?.[0];
    check('the sample carries the verse text', sample?.sanskrit?.startsWith('संस्कृत') && sample.translation && sample.reference.startsWith('E2E Recipe Book 1.1.1'), JSON.stringify(sample?.reference));

    // ── 5 ───────────────────────────────────────────────────────────────────
    console.log('\n5. Making reels with the recitation');
    const gen = (body) => call('POST', '/api/admin/reel-recipes/generate', { ...as, body: { templateId, creatorId: creator.id, ...body } });

    check('an unknown creator is refused', (await gen({ selection: sel(), creatorId: 'nope' })).status === 400);
    const first = await gen({ selection: sel({ chapterId: chapters[0].id, hints: [] }), useVerseAudio: true, extraTags: ['Gita Wisdom'] });
    check('a run creates the reels it can', first.status === 201 && first.json?.data?.created === 2, JSON.stringify(first.json?.data?.created));
    check('a verse whose recitation file is gone is skipped, with the reason', first.json?.data?.skipped?.length === 1 && /recitation/.test(first.json.data.skipped[0].reason));
    made.push(...(first.json?.data?.reels ?? []).map((r) => r.id));

    const row = await prisma.reel.findFirst({ where: { id: made[0] }, include: { media: true } });
    check('they are drafts', row?.status === 'DRAFT');
    check('they remember their verse and template', row?.verseId === verses[0].id && row?.templateId === templateId);
    check('the verse recitation is the soundtrack', row?.audioTrackPath === goodAudio);
    check('the background is attached', row?.media?.length === 1 && row.media[0].imagePath === bg && row.mediaType === 'IMAGE');
    check('the caption is the verse reference', row?.caption === 'E2E Recipe Book 1.1.1', row?.caption);
    for (const want of [`book:${slug}`, `canto:${slug}-1`, `chapter:${slug}-1-1`, `karma-yoga-${STAMP}`, `creation-${STAMP}`, 'e2e-recipe-book', 'gita-wisdom']) {
      check(`tagged ${want}`, row?.tags?.includes(want), JSON.stringify(row?.tags));
    }
    const ov = Object.fromEntries((row?.overlays ?? []).map((o) => [o.id, o]));
    check('bound boxes are filled from the verse', ov['o-sa']?.text === 'संस्कृत 1.1' && ov['o-tr']?.text === 'You have a right to action alone' && ov['o-ref']?.text === 'E2E Recipe Book 1.1.1');
    check('bound boxes keep their binding, fixed ones their text', ov['o-tr']?.bind === 'translation' && ov['o-fixed']?.text === 'Hare Krishna' && !ov['o-fixed']?.bind);

    // ── 6 ───────────────────────────────────────────────────────────────────
    console.log('\n6. Running it again');
    const again = await gen({ selection: sel({ chapterId: chapters[0].id }), useVerseAudio: true });
    check('verses already done are not made twice', again.status === 201 && again.json.data.created === 0, JSON.stringify(again.json?.data?.created));
    const next = await prev(sel(), { templateId });
    check('the preview leaves them out, so the next batch is new verses', next.json?.data?.total === 3);

    // ── 7 ───────────────────────────────────────────────────────────────────
    console.log('\n7. Without the recitation, and publishing');
    const second = await gen({ selection: sel({ chapterId: chapters[1].id, languageCode: 'hi' }), useVerseAudio: false, publish: true });
    check('chapter two is made and published', second.status === 201 && second.json.data.created === 2 && second.json.data.published === true, JSON.stringify(second.json?.data));
    made.push(...(second.json?.data?.reels ?? []).map((r) => r.id));
    const live = await prisma.reel.findMany({ where: { id: { in: second.json.data.reels.map((r) => r.id) } }, orderBy: { createdAt: 'asc' } });
    check('they are live', live.every((r) => r.status === 'PUBLISHED' && r.publishedAt));
    check('without the recitation they play the template music', live.every((r) => r.audioTrackPath === music));
    const hindi = live.find((r) => r.verseId === verses[3].id);
    check('the stored translation is in the language the run asked for', hindi?.overlays.find((o) => o.id === 'o-tr')?.text.includes('मेरी शरण'));
    const bare = live.find((r) => r.verseId === verses[4].id);
    check('a verse with no translation leaves that box out, not blank', bare && !bare.overlays.some((o) => o.id === 'o-tr') && bare.overlays.some((o) => o.id === 'o-sa'));
    const profile = await prisma.creatorProfile.findUnique({ where: { id: creator.id } });
    check('the creator’s reel count follows', profile.reelCount === (await prisma.reel.count({ where: { creatorId: creator.id, status: 'PUBLISHED' } })));

    // Publish chapter one too, through the normal endpoint, so "similar" sees it.
    for (const id of made.slice(0, 2)) {
      const p = await call('POST', `/api/admin/reels/${id}/publish`, { ...as, body: { isPublished: true } });
      check('a draft from a recipe publishes like any other', p.status === 200, `HTTP ${p.status}`);
    }

    // ── 8 ───────────────────────────────────────────────────────────────────
    console.log('\n8. What the reader’s app receives');
    const fetchReel = async (id) => (await call('GET', `/api/app/reels/${id}`, asReader)).json?.data;
    const englishReel = await fetchReel(hindi.id);
    check('an English reader gets the English translation', englishReel?.overlays?.find((o) => o.id === 'o-tr')?.text.includes('surrender unto Me'), englishReel?.overlays?.find((o) => o.id === 'o-tr')?.text);
    await prisma.user.update({ where: { id: reader.id }, data: { readingLanguage: 'hi' } });
    await authService.invalidateUser(reader.id);
    const hindiReel = await fetchReel(hindi.id);
    check('a Hindi reader gets the Hindi one, from the same reel', hindiReel?.overlays?.find((o) => o.id === 'o-tr')?.text.includes('मेरी शरण'));
    check('the Sanskrit and the reference do not change', hindiReel?.overlays?.find((o) => o.id === 'o-sa')?.text === 'संस्कृत 2.1' && hindiReel.overlays.find((o) => o.id === 'o-ref')?.text === 'E2E Recipe Book 1.2.1');
    check('the reel still names its verse', hindiReel?.verse?.verseId === verses[3].verseId);
    check('and cites it with its book, so the app need not guess which book a number means', hindiReel?.verse?.label === 'E2E Recipe Book 1.2.1', hindiReel?.verse?.label);

    await prisma.verseTranslation.updateMany({ where: { verseId: verses[3].id, languageCode: 'hi' }, data: { meaning: 'सुधारा हुआ अनुवाद' } });
    check('a corrected translation shows on reels already made', (await fetchReel(hindi.id))?.overlays?.find((o) => o.id === 'o-tr')?.text === 'सुधारा हुआ अनुवाद');

    const bareApp = await fetchReel(bare.id);
    check('a reel with no translation falls back to nothing rather than a blank box', !bareApp?.overlays?.some((o) => o.id === 'o-tr'));

    // ── 9 ───────────────────────────────────────────────────────────────────
    console.log('\n9. More like this');
    const sim = await call('GET', `/api/app/reels/${made[0]}/similar`, asReader);
    const ids = (sim.json?.data ?? []).map((r) => r.id);
    check('similar answers', sim.status === 200, `HTTP ${sim.status}`);
    check('the reel itself is not in it', !ids.includes(made[0]));
    check('the same chapter comes first', ids[0] === made[1], `${ids[0]} vs ${made[1]}`);
    check('then the rest of the book', ids.length === 3 && ids.slice(1).every((id) => second.json.data.reels.some((r) => r.id === id)), `${ids.length} items`);
    check('they are shaped for the feed', sim.json?.data?.[0]?.verse?.verseId && Array.isArray(sim.json.data[0].overlays));
    check('it is paged', sim.json?.meta?.total === 3);
    check('an unknown reel is 404', (await call('GET', '/api/app/reels/nope/similar', asReader)).status === 404);

    const plain = await call('POST', '/api/admin/reels', { ...as, body: { mediaType: 'IMAGE', creatorId: creator.id, tags: [] } });
    made.push(plain.json?.data?.id);
    await prisma.reel.update({ where: { id: plain.json.data.id }, data: { status: 'PUBLISHED', publishedAt: new Date() } });
    const none = await call('GET', `/api/app/reels/${plain.json.data.id}/similar`, asReader);
    check('a reel with no tags has no similar reels, so the app can hide the option', none.status === 200 && none.json.data.length === 0);

    // ── 10 ──────────────────────────────────────────────────────────────────
    console.log('\n10. Removing the template');
    const del = await call('DELETE', `/api/admin/reel-recipes/templates/${templateId}`, as);
    check('a template can be deleted', del.status === 204, `HTTP ${del.status}`);
    const orphan = await prisma.reel.findUnique({ where: { id: made[0] } });
    check('its reels stay, unattached', orphan && orphan.templateId === null);
    templateId = null;
  } finally {
    await prisma.reel.deleteMany({ where: { id: { in: made.filter(Boolean) } } });
    if (templateId) await prisma.reelTemplate.deleteMany({ where: { id: templateId } });
    if (book) await prisma.book.delete({ where: { id: book.id } }); // cascades cantos, chapters, verses
    if (translator) await prisma.translator.delete({ where: { id: translator.id } });
    await prisma.user.delete({ where: { id: reader.id } }).catch(() => {});
    await Promise.all(files.map((key) => s3.deleteObject(key).catch(() => {})));
    await prisma.creatorProfile.update({
      where: { id: creator.id },
      data: { reelCount: await prisma.reel.count({ where: { creatorId: creator.id, status: 'PUBLISHED' } }) },
    });
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
