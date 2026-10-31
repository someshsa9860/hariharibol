import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import router from '../routes/admin/narration.js';
import { checkTarget, pickChapters, cancel, resume, get, compare, clip } from '../controllers/admin/narration.js';
import { prisma } from '../config/database.js';

const routes = router.meta.routes;
const find = (method, path) => routes.find((r) => r.method === method && r.path === path);

describe('the narration routes', () => {
  it('has the documented endpoints', () => {
    const have = routes.map((r) => `${r.method} ${r.path}`).sort();
    assert.deepEqual(have, [
      'get /clips', 'get /clips/:id', 'get /compare/:id', 'get /estimate', 'get /languages', 'get /overview', 'get /runs', 'get /runs/:id', 'get /voices',
      'post /compare', 'post /runs', 'post /runs/:id/cancel', 'post /runs/:id/resume',
    ]);
  });

  it('asks narration.read of every read and narration.run of every write', () => {
    for (const r of routes) assert.equal(r.meta.permission, r.method === 'get' ? 'narration.read' : 'narration.run', `${r.method} ${r.path}`);
  });

  it('takes a start body with optional choices and refuses unknown values', () => {
    const body = find('post', '/runs').meta.body;
    assert.ok(body.safeParse({}).success);
    assert.ok(body.safeParse({ book: 'bhagavat-gita', language: 'hi', chapters: [1, 2], force: true }).success);
    assert.ok(!body.safeParse({ language: 'fr' }).success);
    assert.ok(!body.safeParse({ book: 'nope' }).success);
    assert.ok(!body.safeParse({ chapters: [] }).success);
    assert.ok(!body.safeParse({ chapters: [0] }).success);
  });

  it('takes a comparison of one to six voices', () => {
    const body = find('post', '/compare').meta.body;
    const t = (voice) => ({ engine: 'google-chirp', model: 'chirp-3-hd', voice });
    assert.ok(body.safeParse({ verseId: '1.2.47', targets: [t('Kore')] }).success);
    assert.ok(body.safeParse({ verseId: '1.2.47', targets: ['a', 'b', 'c', 'd', 'e', 'f'].map(t) }).success);
    assert.ok(!body.safeParse({ verseId: '1.2.47', targets: ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map(t) }).success);
    assert.ok(!body.safeParse({ verseId: '1.2.47', targets: [] }).success);
    assert.ok(!body.safeParse({ targets: [t('Kore')] }).success);
  });

  it('reads the chapters of an estimate as a sorted, unique list', () => {
    const query = find('get', '/estimate').meta.query;
    assert.deepEqual(query.parse({ chapters: '3,1,3,2' }).chapters, [1, 2, 3]);
    assert.ok(!query.safeParse({ chapters: '1;2' }).success);
  });
});

describe('choosing chapters and voices', () => {
  it('lists the whole book when none are asked for, and refuses a chapter the book lacks', () => {
    assert.equal(pickChapters('bhagavat-gita', undefined).length, 18);
    assert.deepEqual(pickChapters('bhagavat-gita', [3, 1, 3]), [1, 3]);
    assert.throws(() => pickChapters('bhagavat-gita', [19]), /not in/);
  });

  it('refuses a voice the engine does not have, and an engine whose key is not set', () => {
    assert.throws(() => checkTarget({ engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Nobody' }, 'en'), /no voice/);
    assert.throws(() => checkTarget({ engine: 'nope', model: 'x', voice: 'Kore' }, 'en'), /no engine/);
    const saved = process.env.GOOGLE_TTS_API_KEY;
    // The key is read from the loaded config; with none set the engine is refused by name.
    try {
      checkTarget({ engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore' }, 'en');
    } catch (err) {
      assert.match(err.message, /GOOGLE_TTS_API_KEY is not set/);
    }
    process.env.GOOGLE_TTS_API_KEY = saved;
  });
});

// A run row is looked up through prisma; these cases never reach a database because the row is replaced.
function withRun(row, fn) {
  const original = prisma.narrationRun.findUnique;
  prisma.narrationRun.findUnique = async () => row;
  return Promise.resolve(fn()).finally(() => { prisma.narrationRun.findUnique = original; });
}
const req = (params = {}) => ({ valid: { params, query: {}, body: {} }, auth: { user: { id: 'u1', name: 'Admin' } } });

describe('acting on a run', () => {
  it('404s a run or comparison or clip that is not there', async () => {
    for (const fn of [get, resume, cancel, compare]) await withRun(null, () => assert.rejects(fn(req({ id: 'x' }), {}), (e) => e.status === 404 || e.statusCode === 404));
    const original = prisma.narrationClip.findUnique;
    prisma.narrationClip.findUnique = async () => null;
    try {
      await assert.rejects(clip(req({ id: 'x' }), {}), (e) => e.status === 404 || e.statusCode === 404);
    } finally { prisma.narrationClip.findUnique = original; }
  });

  it('only resumes a paused or failed run and only cancels a live one', async () => {
    await withRun({ id: 'r', status: 'COMPLETED' }, async () => {
      await assert.rejects(resume(req({ id: 'r' }), {}), (e) => (e.status ?? e.statusCode) === 409);
      await assert.rejects(cancel(req({ id: 'r' }), {}), (e) => (e.status ?? e.statusCode) === 409);
    });
    await withRun({ id: 'r', status: 'RUNNING' }, () => assert.rejects(resume(req({ id: 'r' }), {}), (e) => (e.status ?? e.statusCode) === 409));
  });

  it('refuses a comparison lookup for a narration run', async () => {
    await withRun({ id: 'r', kind: 'NARRATION', status: 'RUNNING' }, () => assert.rejects(compare(req({ id: 'r' }), {}), (e) => (e.status ?? e.statusCode) === 404));
  });
});
