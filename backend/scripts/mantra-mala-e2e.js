// Walks the mantra mala recording over real HTTP against a running API. Run it
// after `npm run dev`:
//
//   npm run test:mantra-mala
//
// It uploads (and deletes) real files, so it only runs on local storage. The dev
// `.env` points at the real bucket: start the API, and run this, with
// `AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY=` blank and storage falls back to
// backend/storage/.
//
// A mantra can carry one recording of a whole mala, and the span of it that is
// chanting; the app plays it and counts along, one chant per 1/108 of the span.
// What is checked is the part that quietly goes wrong: that the three columns
// only ever exist together, that a patch is judged against the row it produces
// (not against the request), that a recording whose file is gone is refused
// rather than saved, and that the reader gets exactly the span the admin set —
// or three nulls, never a link with no span to count to.
//
// Everything it creates is deleted again, files included.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as s3 from '../services/s3.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'mantra-mala-e2e-device';

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
async function upload(token, kind) {
  const contentType = 'audio/mpeg';
  const signed = await call('POST', '/api/admin/uploads', { token, body: { kind, contentType } });
  const { key, uploadUrl, viaApi } = signed.json?.data ?? {};
  // `viaApi` is only set when the API is on local storage. Without it the link is a
  // real bucket's — and this process being on local storage says nothing about the
  // API, which is another process.
  if (signed.status === 200 && !viaApi) {
    throw new Error(
      'The API signed a link to a real bucket. Start it with AWS_ACCESS_KEY_ID= and AWS_SECRET_ACCESS_KEY= blank.'
    );
  }
  const put = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': contentType, ...(viaApi ? { authorization: `Bearer ${token}` } : {}) },
    body: Buffer.from('not really audio'),
  });
  return { key, status: signed.status === 200 ? put.status : signed.status };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }
  if (!s3.useLocalStorage) {
    console.error(
      '\nThis script writes real objects; it only runs against local storage.\n' +
        'Run it with AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY= blank, and start the API the same way.\n'
    );
    process.exit(1);
  }

  const admin = await prisma.user.findFirst({ where: { role: { slug: 'super_admin' } } });
  const reader = await prisma.user.findFirst({ where: { role: { slug: 'user' } } });
  if (!admin || !reader) {
    console.error('\nNeed a super_admin and a plain user. Run `npm run seed` first.\n');
    process.exit(1);
  }

  await authService.invalidateUser(admin.id);
  await redis.del(`rl:write:${admin.id}`, `rl:read:${admin.id}`);
  const { accessToken: token } = await authService.issueSession(admin, DEVICE);
  const { accessToken: readerToken } = await authService.issueSession(reader, DEVICE);
  const as = { token };

  const slug = `mala-e2e-${Date.now()}`;
  const files = [];
  let id = null;

  try {
    console.log(`\nAdmin ${admin.email}`);

    // ── 1 ────────────────────────────────────────────────────────────────────
    console.log('\n1. Who may write it');
    const body = { slug, name: 'Mala e2e', category: 'mahamantra', sanskrit: 'हरे कृष्ण' };
    const denied = await call('POST', '/api/admin/mantras', { token: readerToken, body });
    check('a plain user cannot create a mantra', denied.status === 403, `HTTP ${denied.status}`);

    // ── 2 ────────────────────────────────────────────────────────────────────
    console.log('\n2. A recording needs its span, and the span has to make sense');
    const mala = await upload(token, 'mantraMalaAudio');
    files.push(mala.key);
    check('a mala recording can be uploaded', mala.status === 200 && Boolean(mala.key), `HTTP ${mala.status}`);
    check('it lands under its own prefix', mala.key?.startsWith('mantras/mala/'), mala.key);

    const noSpan = await call('POST', '/api/admin/mantras', { ...as, body: { ...body, malaAudioPath: mala.key } });
    check('a recording with no span is refused', noSpan.status === 400, `HTTP ${noSpan.status}`);

    const halfSpan = await call('POST', '/api/admin/mantras', {
      ...as,
      body: { ...body, malaAudioPath: mala.key, malaAudioStartMs: 12000 },
    });
    check('a recording with only a start is refused', halfSpan.status === 400, `HTTP ${halfSpan.status}`);

    const backwards = await call('POST', '/api/admin/mantras', {
      ...as,
      body: { ...body, malaAudioPath: mala.key, malaAudioStartMs: 9000, malaAudioEndMs: 9000 },
    });
    check('an end that is not after the start is refused', backwards.status === 400, `HTTP ${backwards.status}`);

    const missing = await call('POST', '/api/admin/mantras', {
      ...as,
      body: {
        ...body,
        malaAudioPath: 'mantras/mala/00000000000000000000000000000000.mp3',
        malaAudioStartMs: 1000,
        malaAudioEndMs: 2000,
      },
    });
    check('a key that points at nothing is refused', missing.status === 400, `HTTP ${missing.status}`);
    check('none of the refusals left a mantra behind', (await prisma.mantra.count({ where: { slug } })) === 0);

    // ── 3 ────────────────────────────────────────────────────────────────────
    console.log('\n3. Saving and editing it');
    const audio = await upload(token, 'mantraAudio');
    files.push(audio.key);
    const made = await call('POST', '/api/admin/mantras', {
      ...as,
      body: {
        ...body,
        audioPath: audio.key,
        durationMs: 4000,
        malaAudioPath: mala.key,
        malaAudioStartMs: 15500,
        malaAudioEndMs: 435500,
      },
    });
    check('a whole recording is saved', made.status === 201, `HTTP ${made.status}`);
    id = made.json?.data?.id;
    check(
      'the span is stored as sent',
      made.json?.data?.malaAudioStartMs === 15500 && made.json?.data?.malaAudioEndMs === 435500
    );

    const detail = await call('GET', `/api/admin/mantras/${id}`, as);
    check('the panel gets the key to keep', detail.json?.data?.malaAudioPath === mala.key);
    check('the panel gets a link to play it', /^https?:\/\//.test(detail.json?.data?.malaAudioUrl ?? ''));

    const moved = await call('PATCH', `/api/admin/mantras/${id}`, { ...as, body: { malaAudioEndMs: 430000 } });
    check('a patch can move just the end', moved.status === 200 && moved.json.data.malaAudioEndMs === 430000);
    check('and the start is left alone', moved.json?.data?.malaAudioStartMs === 15500);

    const crossed = await call('PATCH', `/api/admin/mantras/${id}`, { ...as, body: { malaAudioEndMs: 15000 } });
    check('a patch that puts the end before the stored start is refused', crossed.status === 400);
    const unchanged = await prisma.mantra.findUnique({ where: { id } });
    check('and the row is untouched', unchanged.malaAudioEndMs === 430000);

    // ── 4 ────────────────────────────────────────────────────────────────────
    console.log('\n4. What a reader receives');
    await call('PUT', `/api/admin/mantras/${id}/translations`, {
      ...as,
      body: { languageCode: 'sa', text: 'हरे कृष्ण', isPublished: true },
    });
    const published = await call('POST', `/api/admin/mantras/${id}/publish`, { ...as, body: { isPublished: true } });
    check('a mantra with a recording publishes', published.status === 200, `HTTP ${published.status}`);

    const seen = await call('GET', `/api/app/mantras/${slug}`, { token: readerToken });
    const data = seen.json?.data;
    check('the app is sent a link to the recording', /^https?:\/\//.test(data?.malaAudioUrl ?? ''));
    check('and the span, as stored', data?.malaAudioStartMs === 15500 && data?.malaAudioEndMs === 430000);
    check('the stored key is not a field the app sees', !('malaAudioPath' in (data ?? {})));
    check('the recitation audio is unaffected', Boolean(data?.audioUrl) && data?.durationMs === 4000);

    const listed = await call('GET', '/api/app/mantras', { token: readerToken });
    const row = (listed.json?.data ?? []).find((m) => m.slug === slug);
    check('the list carries it too', Boolean(row?.malaAudioUrl) && row?.malaAudioEndMs === 430000);

    // ── 5 ────────────────────────────────────────────────────────────────────
    console.log('\n5. A recording whose file has gone');
    await call('POST', `/api/admin/mantras/${id}/publish`, { ...as, body: { isPublished: false } });
    await s3.deleteObject(mala.key);
    const gone = await call('POST', `/api/admin/mantras/${id}/publish`, { ...as, body: { isPublished: true } });
    check('publishing is refused', gone.status === 400, `HTTP ${gone.status}`);

    // ── 6 ────────────────────────────────────────────────────────────────────
    console.log('\n6. Taking it off');
    const cleared = await call('PATCH', `/api/admin/mantras/${id}`, { ...as, body: { malaAudioPath: null } });
    check('clearing the recording is allowed', cleared.status === 200, `HTTP ${cleared.status}`);
    check(
      'and takes its span with it',
      cleared.json?.data?.malaAudioStartMs === null && cleared.json?.data?.malaAudioEndMs === null
    );
    const republished = await call('POST', `/api/admin/mantras/${id}/publish`, { ...as, body: { isPublished: true } });
    check('a mantra with no recording publishes as before', republished.status === 200, `HTTP ${republished.status}`);

    const bare = (await call('GET', `/api/app/mantras/${slug}`, { token: readerToken })).json?.data;
    check(
      'the reader gets three nulls, not a link with no span',
      bare?.malaAudioUrl === null && bare?.malaAudioStartMs === null && bare?.malaAudioEndMs === null
    );
  } finally {
    if (id) await prisma.mantra.deleteMany({ where: { id } });
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
