// Walks the admin reels surface over real HTTP against a running API. Run it
// after `npm run dev`:
//
//   npm run test:admin-reels
//
// Same shape as scripts/reels-e2e.js: the session is issued directly, and
// everything after that is the real endpoint over the real transport.
//
// What it is checking is the part that fails quietly: that a reel built in the
// panel is exactly what a reader's app then receives (overlays included), that
// publishing refuses a reel whose file is not actually in storage, that an edit
// to a live reel which fails is rolled back rather than half-applied, and that
// CreatorProfile.reelCount agrees with the published rows it summarises.
//
// Everything it creates is deleted again, files included.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as s3 from '../services/s3.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'admin-reels-e2e-device';

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
async function upload(token, kind, contentType, bytes = Buffer.from('not really media')) {
  const signed = await call('POST', '/api/admin/uploads', { token, body: { kind, contentType } });
  const { key, uploadUrl, viaApi } = signed.json?.data ?? {};
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, ...(viaApi ? { authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  });
  return { key, status: put.status, uploadUrl };
}

const publishedCount = (creatorId) => prisma.reel.count({ where: { creatorId, status: 'PUBLISHED' } });
const cachedCount = async (creatorId) =>
  (await prisma.creatorProfile.findUnique({ where: { id: creatorId } })).reelCount;

const overlay = (overrides = {}) => ({
  id: 'o1',
  text: 'कर्मण्येवाधिकारस्ते',
  x: 10,
  y: 40,
  width: 80,
  size: 6,
  style: 'verse',
  color: 'light',
  align: 'center',
  ...overrides,
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
  const reader = await prisma.user.findFirst({
    where: { role: { slug: 'user' }, creatorProfile: null },
  });
  const verse = await prisma.verse.findFirst({ where: { bookNumber: 1 } });
  if (!admin || !reader || !verse) {
    console.error('\nNeed a super_admin, a plain user and a verse. Run `npm run seed` first.\n');
    process.exit(1);
  }

  // The role may have gained permissions since this admin's cache was written.
  await authService.invalidateUser(admin.id);
  // The suite makes ~50 writes and the limiter allows 60 a minute, so two runs
  // back to back would otherwise fail on the second for reasons that have
  // nothing to do with reels.
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);
  const as = { token };

  let officialId = null;
  const made = []; // reel ids to clean up
  const files = []; // object keys to clean up

  try {
    console.log(`\nAdmin ${admin.email}, reader ${reader.email}`);

    // ── 1 ────────────────────────────────────────────────────────────────────
    console.log('\n1. Who may use it');
    const anon = await call('GET', '/api/admin/reels');
    check('signed out is 401', anon.status === 401, `HTTP ${anon.status}`);
    const plain = await call('GET', '/api/admin/reels', { token: readerToken });
    check('a plain user is 403', plain.status === 403, `HTTP ${plain.status}`);
    const listed = await call('GET', '/api/admin/reels', as);
    check('an admin can list', listed.status === 200, `HTTP ${listed.status}`);
    check('the list is paged', Boolean(listed.json?.meta?.pageSize));

    const creators = await call('GET', '/api/admin/reels/creators', as);
    const official = (creators.json?.data ?? []).find((c) => c.isOfficial);
    check('creators are listed', creators.status === 200 && creators.json.data.length > 0);
    check('the platform channel is flagged official', Boolean(official));
    check('creator email is not exposed', !JSON.stringify(creators.json?.data ?? []).includes('@'));
    if (!official) throw new Error('No official creator — run `npm run seed:reels` first.');
    officialId = official.id;

    // ── 2 ────────────────────────────────────────────────────────────────────
    console.log('\n2. Uploading, with no bucket');
    const video = await upload(token, 'reelVideo', 'video/mp4');
    files.push(video.key);
    check('a key is issued under reels/videos', video.key?.startsWith('reels/videos/'), video.key);
    check('the PUT is accepted', video.status === 200, `HTTP ${video.status}`);
    check('the object is in storage', await s3.objectExists(video.key));

    const noToken = await fetch(video.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4' },
      body: Buffer.from('x'),
    });
    check('the PUT needs a signed-in admin', noToken.status === 401, `HTTP ${noToken.status}`);

    const forged = await fetch(`${BASE}/api/admin/uploads/local/reels/videos/not-a-generated-name.mp4`, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4', authorization: `Bearer ${token}` },
      body: Buffer.from('x'),
    });
    check('a key the server did not issue is refused', forged.status === 400, `HTTP ${forged.status}`);

    const traversal = await fetch(`${BASE}/api/admin/uploads/local/..%2F..%2F.env`, {
      method: 'PUT',
      headers: { 'content-type': 'video/mp4', authorization: `Bearer ${token}` },
      body: Buffer.from('x'),
    });
    check('path traversal is refused', traversal.status === 400, `HTTP ${traversal.status}`);

    const wrongType = await fetch(video.uploadUrl, {
      method: 'PUT',
      headers: { 'content-type': 'text/html', authorization: `Bearer ${token}` },
      body: Buffer.from('<script>'),
    });
    check('a disallowed content type is refused', wrongType.status === 400, `HTTP ${wrongType.status}`);

    const thumb = await upload(token, 'reelThumbnail', 'image/jpeg');
    const music = await upload(token, 'reelAudio', 'audio/mpeg');
    files.push(thumb.key, music.key);

    // ── 3 ────────────────────────────────────────────────────────────────────
    console.log('\n3. Creating a video reel');
    const body = {
      mediaType: 'VIDEO',
      creatorId: official.id,
      videoPath: video.key,
      thumbnailPath: thumb.key,
      audioPath: music.key,
      durationMs: 12000,
      width: 1080,
      height: 1920,
      caption: 'Chapter 2, verse 47',
      tags: ['gita', 'karma'],
      languageCode: 'sa',
      verseId: verse.id,
      overlays: [overlay(), overlay({ id: 'o2', text: 'Your right is to action alone', style: 'body', y: 60, size: 4 })],
    };
    const createdReel = await call('POST', '/api/admin/reels', { token, body });
    const reel = createdReel.json?.data;
    check('POST is 201', createdReel.status === 201, `HTTP ${createdReel.status} ${JSON.stringify(createdReel.json?.error ?? '')}`);
    if (!reel) throw new Error('create failed, nothing else can run');
    made.push(reel.id);

    check('it starts as a draft', reel.status === 'DRAFT');
    check('two overlays came back', reel.overlays?.length === 2);
    check('overlay text is kept exactly', reel.overlays?.[0]?.text === 'कर्मण्येवाधिकारस्ते');
    check('the background music sits in the audio slot', reel.audioPath === music.key);
    check('the video is signed, and the key kept', reel.videoUrl?.includes(video.key) && reel.videoPath === video.key);
    check('the verse is linked', reel.verse?.verseId === verse.verseId);
    const stored = await prisma.reel.findUnique({ where: { id: reel.id } });
    check('background music landed in audioTrackPath', stored.audioTrackPath === music.key);
    const fetched = await fetch(reel.videoUrl);
    check('the signed video URL actually serves the file', fetched.status === 200, `HTTP ${fetched.status}`);

    // ── 4 ────────────────────────────────────────────────────────────────────
    console.log('\n4. Bad input is refused');
    const bad = (name, patch, expect = 400) =>
      call('POST', '/api/admin/reels', { token, body: { mediaType: 'VIDEO', creatorId: official.id, ...patch } }).then((r) =>
        check(name, r.status === expect, `HTTP ${r.status}`)
      );
    await bad('a hex colour is not a colour', { overlays: [overlay({ color: '#ff0000' })] });
    await bad('an unknown style is refused', { overlays: [overlay({ style: 'comic-sans' })] });
    await bad('a size off the scale is refused', { overlays: [overlay({ size: 99 })] });
    await bad('a position off the frame is refused', { overlays: [overlay({ x: 140 })] });
    await bad('empty text is refused', { overlays: [overlay({ text: '' })] });
    await bad('an invented object key is refused', { videoPath: 'users/avatars/anything.jpg' });
    await bad('a key of the wrong kind is refused', { videoPath: music.key });
    await bad('a traversal key is refused', { videoPath: '../../etc/passwd' });
    await bad('an unknown verse is refused', { verseId: 'no-such-verse' });
    await bad('an unknown creator is refused', { creatorId: 'no-such-creator' });
    const noCreator = await call('POST', '/api/admin/reels', { token, body: { mediaType: 'VIDEO' } });
    check('a creator is required', noCreator.status === 400, `HTTP ${noCreator.status}`);

    // ── 5 ────────────────────────────────────────────────────────────────────
    console.log('\n5. Publishing checks the media is really there');
    const empty = await call('POST', '/api/admin/reels', {
      token,
      body: { mediaType: 'IMAGE', creatorId: official.id },
    });
    made.push(empty.json.data.id);
    check('a reel can be started with no media', empty.status === 201);
    const noMedia = await call('POST', `/api/admin/reels/${empty.json.data.id}/publish`, { token, body: { isPublished: true } });
    check('publishing an empty slideshow is 400', noMedia.status === 400, noMedia.json?.error?.message);

    // A key the server would accept but whose file never arrived.
    const ghostKey = s3.buildKey('reelVideo', 'video/mp4');
    const ghost = await call('POST', '/api/admin/reels', {
      token,
      body: { mediaType: 'VIDEO', creatorId: official.id, videoPath: ghostKey },
    });
    made.push(ghost.json.data.id);
    const ghostPublish = await call('POST', `/api/admin/reels/${ghost.json.data.id}/publish`, { token, body: { isPublished: true } });
    check('publishing a reel whose file never arrived is 400', ghostPublish.status === 400, ghostPublish.json?.error?.message);
    check('and it stays a draft', (await prisma.reel.findUnique({ where: { id: ghost.json.data.id } })).status === 'DRAFT');

    const countBefore = await cachedCount(official.id);
    const pub = await call('POST', `/api/admin/reels/${reel.id}/publish`, { token, body: { isPublished: true } });
    check('publishing a complete reel is 200', pub.status === 200, pub.json?.error?.message);
    check('it is PUBLISHED', pub.json?.data?.status === 'PUBLISHED');
    const live = await prisma.reel.findUnique({ where: { id: reel.id } });
    check('publishedAt is set', Boolean(live.publishedAt));
    check('the publishing admin is recorded as reviewer', live.reviewedById === admin.id);
    check(
      "the creator's reelCount matches the published rows",
      (await cachedCount(official.id)) === (await publishedCount(official.id)),
      `cached ${await cachedCount(official.id)} vs rows ${await publishedCount(official.id)} (was ${countBefore})`
    );

    // ── 6 ────────────────────────────────────────────────────────────────────
    console.log('\n6. What the reader’s app receives');
    const asReader = await call('GET', `/api/app/reels/${reel.id}`, { token: readerToken });
    check('the reader can open it', asReader.status === 200, `HTTP ${asReader.status}`);
    check('overlays reach the app', asReader.json?.data?.overlays?.length === 2);
    check(
      'they are the same overlays',
      JSON.stringify(asReader.json?.data?.overlays) === JSON.stringify(reel.overlays)
    );
    check(
      'the app payload exposes URLs, not storage keys',
      !Object.keys(asReader.json?.data ?? {}).some((field) => field.endsWith('Path'))
    );

    // ── 7 ────────────────────────────────────────────────────────────────────
    console.log('\n7. Editing a live reel');
    const recaption = await call('PATCH', `/api/admin/reels/${reel.id}`, { token, body: { caption: 'New caption' } });
    check('a caption edit is 200', recaption.status === 200 && recaption.json.data.caption === 'New caption');

    const moved = await call('PATCH', `/api/admin/reels/${reel.id}`, {
      token,
      body: { overlays: [overlay({ x: 22, y: 33 })] },
    });
    check('moving text is saved', moved.json?.data?.overlays?.[0]?.x === 22 && moved.json.data.overlays[0].y === 33);
    check('the app sees the move at once', (await call('GET', `/api/app/reels/${reel.id}`, { token: readerToken })).json.data.overlays[0].x === 22);

    const swapGhost = await call('PATCH', `/api/admin/reels/${reel.id}`, {
      token,
      body: { videoPath: ghostKey, caption: 'should not stick' },
    });
    check('swapping in a missing file is 400', swapGhost.status === 400, swapGhost.json?.error?.message);
    const afterFail = await prisma.reel.findUnique({ where: { id: reel.id } });
    check('the failed edit was rolled back — video', afterFail.videoPath === video.key);
    check('the failed edit was rolled back — caption', afterFail.caption === 'New caption');

    const del1 = await call('DELETE', `/api/admin/reels/${reel.id}`, as);
    check('a live reel cannot be deleted', del1.status === 400, `HTTP ${del1.status}`);

    // ── 8 ────────────────────────────────────────────────────────────────────
    console.log('\n8. A slideshow');
    const imgA = await upload(token, 'reelImage', 'image/jpeg');
    const imgB = await upload(token, 'reelImage', 'image/png');
    files.push(imgA.key, imgB.key);
    const show = await call('POST', '/api/admin/reels', {
      token,
      body: { mediaType: 'IMAGE', creatorId: official.id, images: [imgA.key, imgB.key] },
    });
    made.push(show.json.data.id);
    check('images come back in order', show.json?.data?.images?.map((i) => i.path).join() === [imgA.key, imgB.key].join());
    check('each image is signed', show.json?.data?.images?.every((i) => i.url?.startsWith('http')));
    const reordered = await call('PATCH', `/api/admin/reels/${show.json.data.id}`, { token, body: { images: [imgB.key, imgA.key] } });
    check('reordering replaces the set', reordered.json?.data?.images?.map((i) => i.path).join() === [imgB.key, imgA.key].join());
    check('and leaves exactly two rows', (await prisma.reelMedia.count({ where: { reelId: show.json.data.id } })) === 2);

    // ── 9 ────────────────────────────────────────────────────────────────────
    console.log('\n9. An audio reel');
    const voice = await upload(token, 'reelAudio', 'audio/mpeg');
    files.push(voice.key);
    const talk = await call('POST', '/api/admin/reels', {
      token,
      body: { mediaType: 'AUDIO', creatorId: official.id, audioPath: voice.key, languageCode: 'sa', durationMs: 9000 },
    });
    made.push(talk.json.data.id);
    check('the audio slot round-trips', talk.json?.data?.audioPath === voice.key);
    const tracks = await prisma.reelAudioTrack.findMany({ where: { reelId: talk.json.data.id } });
    check('it is stored as the reel’s one audio track', tracks.length === 1 && tracks[0].audioPath === voice.key);
    check('the track carries the reel’s language and duration', tracks[0]?.languageCode === 'sa' && tracks[0]?.durationMs === 9000);
    check('the reel itself has no background track', (await prisma.reel.findUnique({ where: { id: talk.json.data.id } })).audioTrackPath === null);
    const cleared = await call('PATCH', `/api/admin/reels/${talk.json.data.id}`, { token, body: { audioPath: null } });
    check('clearing the audio removes the track', cleared.json?.data?.audioPath === null && (await prisma.reelAudioTrack.count({ where: { reelId: talk.json.data.id } })) === 0);

    // ── 10 ───────────────────────────────────────────────────────────────────
    console.log('\n10. Unpublishing and deleting');
    const unpub = await call('POST', `/api/admin/reels/${reel.id}/publish`, { token, body: { isPublished: false } });
    check('unpublish is 200 and returns a draft', unpub.status === 200 && unpub.json.data.status === 'DRAFT');
    check(
      "reelCount followed it down",
      (await cachedCount(official.id)) === (await publishedCount(official.id)),
      `cached ${await cachedCount(official.id)} vs rows ${await publishedCount(official.id)}`
    );
    const gone = await call('GET', `/api/app/reels/${reel.id}`, { token: readerToken });
    check('readers can no longer open it', gone.status === 404 || gone.status === 403, `HTTP ${gone.status}`);

    const del2 = await call('DELETE', `/api/admin/reels/${reel.id}`, as);
    check('a draft can be deleted', del2.status === 204, `HTTP ${del2.status}`);
    check('the row is gone', (await prisma.reel.findUnique({ where: { id: reel.id } })) === null);
    const again = await call('GET', `/api/admin/reels/${reel.id}`, as);
    check('and 404s afterwards', again.status === 404, `HTTP ${again.status}`);

    // ── 11 ───────────────────────────────────────────────────────────────────
    console.log('\n11. The audit trail');
    const actions = (
      await prisma.auditLog.findMany({ where: { actorId: admin.id, entityId: reel.id }, select: { action: true } })
    ).map((a) => a.action);
    for (const action of ['reel.create', 'reel.publish', 'reel.update', 'reel.unpublish', 'reel.delete']) {
      check(`${action} was recorded`, actions.includes(action));
    }

    const filtered = await call('GET', '/api/admin/reels?status=DRAFT&mediaType=IMAGE', as);
    check(
      'list filters by status and type',
      filtered.status === 200 && filtered.json.data.every((r) => r.status === 'DRAFT' && r.mediaType === 'IMAGE')
    );
    const searched = await call('GET', '/api/admin/reels?q=no-such-caption-xyz', as);
    check('list search finds nothing for nonsense', searched.json?.data?.length === 0);
  } finally {
    // Delete rows first (the API refuses to delete a live one, so go direct),
    // then the files they pointed at.
    await prisma.reel.deleteMany({ where: { id: { in: made } } });
    await Promise.all(files.map((key) => s3.deleteObject(key)));
    // A run that died with a reel published would leave the count one high.
    if (officialId) {
      await prisma.creatorProfile.update({
        where: { id: officialId },
        data: { reelCount: await publishedCount(officialId) },
      });
    }
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
