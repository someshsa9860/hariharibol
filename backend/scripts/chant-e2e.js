// Walks the chant tap record over real HTTP against a running API:
//
//   npm run test:chant
//
// Same shape as scripts/reels-e2e.js — the session is issued directly and
// everything after it is the real endpoint. What it checks is that the numbers
// stored for a round are the ones worked out from its taps, that re-sending is
// harmless, that nobody can write to someone else's session, and that a
// transcript past its expiry disappears from reads and from the table.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';
import maintenanceProcessor from '../jobs/processors/maintenance.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'chant-e2e-device', 'x-platform': 'ios' };

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
    headers: { ...HEAD, ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // no body
  }
  return { status: res.status, json };
}

const API = '/api/app/sadhana/chant';

/** `count` taps, `gap` ms apart, numbered from `fromSeq`. */
function taps(fromSeq, count, startAt, gap) {
  return Array.from({ length: count }, (_, i) => ({
    seq: fromSeq + i,
    at: startAt + i * gap,
    gapMs: i === 0 && fromSeq === 1 ? 0 : gap,
    auto: i % 2 === 0,
  }));
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const users = await prisma.user.findMany({ take: 2, include: { role: true } });
  if (users.length < 2) {
    console.error('\nNeed two users. Run `npm run seed` first.\n');
    process.exit(1);
  }
  const [me, other] = users;
  const as = { token: (await authService.issueSession(me, 'chant-e2e-device')).accessToken };
  const asOther = { token: (await authService.issueSession(other, 'chant-e2e-device')).accessToken };

  console.log('\n1. A session and its rounds');
  const started = await call('POST', `${API}/session`, { ...as, body: {} });
  const id = started.json?.data?.id;
  check('a session opens', started.status === 201 && Boolean(id), `HTTP ${started.status}`);

  const t0 = Date.now() - 600000;
  const mala1 = { index: 1, complete: true, taps: taps(1, 108, t0, 2000) };
  const mala2 = { index: 2, complete: false, taps: taps(109, 10, t0 + 108 * 2000, 3000) };
  const saved = await call('PUT', `${API}/session/${id}/detail`, { ...as, body: { malas: [mala1, mala2] } });
  check('detail saves', saved.status === 200, `HTTP ${saved.status} ${JSON.stringify(saved.json?.error ?? '')}`);

  const rows = await prisma.chantMala.findMany({ where: { sessionId: id }, orderBy: { index: 'asc' } });
  check('one row per round', rows.length === 2, `${rows.length}`);
  check('beads are counted from the taps', rows[0]?.beads === 108 && rows[1]?.beads === 10);
  check('a round is complete only at 108', rows[0]?.complete === true && rows[1]?.complete === false);
  check('duration is last tap minus first', rows[0]?.durationMs === 107 * 2000, `${rows[0]?.durationMs}`);
  check('average gap ignores the first tap', rows[0]?.avgGapMs === 2000, `${rows[0]?.avgGapMs}`);
  check('start and end are the first and last tap', rows[0]?.startedAt.getTime() === t0);

  console.log('\n2. Sending it again');
  const again = await call('PUT', `${API}/session/${id}/detail`, { ...as, body: { malas: [mala2] } });
  check('a retry is accepted', again.status === 200);
  check('and adds no rows', (await prisma.chantMala.count({ where: { sessionId: id } })) === 2);

  const shortened = { index: 2, complete: false, taps: taps(109, 9, t0 + 108 * 2000, 3000) };
  await call('PUT', `${API}/session/${id}/detail`, { ...as, body: { malas: [shortened] } });
  const undone = await prisma.chantMala.findUnique({ where: { sessionId_index: { sessionId: id, index: 2 } } });
  check('an undone tap is dropped on the next save', undone?.beads === 9, `${undone?.beads}`);

  const tooMany = await call('PUT', `${API}/session/${id}/detail`, {
    ...as,
    body: { malas: [{ index: 3, taps: taps(1, 121, t0, 1000) }] },
  });
  check('more than 120 taps in a round is rejected', tooMany.status === 400, `HTTP ${tooMany.status}`);

  console.log('\n3. Whose session it is');
  const theft = await call('PUT', `${API}/session/${id}/detail`, { ...asOther, body: { malas: [mala1] } });
  check('another user cannot write to it', theft.status === 403, `HTTP ${theft.status}`);
  const peek = await call('GET', `${API}/session/${id}`, asOther);
  check('or read it', peek.status === 403, `HTTP ${peek.status}`);
  const anon = await call('GET', `${API}/sessions`);
  check('history needs a signed-in user', anon.status === 401, `HTTP ${anon.status}`);

  console.log('\n4. Transcripts and their expiry');
  const heard = await call('POST', `${API}/session/${id}/transcripts`, {
    ...as,
    body: {
      items: [
        { seq: 1, malaIndex: 1, text: ' hare krishna ', confidence: 0.9, heardAt: new Date(t0).toISOString() },
        { seq: 2, malaIndex: 1, text: 'hare rama', heardAt: new Date(t0 + 2000).toISOString() },
      ],
    },
  });
  check('transcripts save', heard.status === 200, `HTTP ${heard.status}`);
  const stored = await prisma.chantTapTranscript.findMany({ where: { sessionId: id }, orderBy: { seq: 'asc' } });
  const days = (stored[0]?.expiresAt.getTime() - Date.now()) / 86400000;
  check('they expire in 7 days', days > 6.99 && days <= 7, `${days.toFixed(3)} days`);
  check('text is trimmed', stored[0]?.text === 'hare krishna');

  await call('POST', `${API}/session/${id}/transcripts`, {
    ...as,
    body: { items: [{ seq: 1, malaIndex: 1, text: 'hare krsna', heardAt: new Date(t0).toISOString() }] },
  });
  check('re-sending a tap replaces it', (await prisma.chantTapTranscript.count({ where: { sessionId: id } })) === 2);

  const detail = await call('GET', `${API}/session/${id}`, as);
  check('the session reads back with rounds and words', detail.json?.data?.malas?.length === 2 && detail.json?.data?.transcripts?.length === 2);

  await prisma.chantTapTranscript.updateMany({ where: { sessionId: id, seq: 2 }, data: { expiresAt: new Date(Date.now() - 1000) } });
  const afterExpiry = await call('GET', `${API}/session/${id}`, as);
  check('an expired transcript is hidden before it is swept', afterExpiry.json?.data?.transcripts?.length === 1);

  await maintenanceProcessor({ name: 'chant.transcripts.prune' });
  check('the sweep deletes it', (await prisma.chantTapTranscript.count({ where: { sessionId: id } })) === 1);

  console.log('\n5. History');
  await call('PATCH', `${API}/session/${id}`, { ...as, body: { rounds: 1, beads: 9, finish: true } });
  const list = await call('GET', `${API}/sessions`, as);
  const row = (list.json?.data ?? []).find((s) => s.id === id);
  check('the session is listed', Boolean(row));
  check('with its round count and average', row?.malaCount === 2 && row?.avgMalaMs === 107 * 2000, `${row?.malaCount} / ${row?.avgMalaMs}`);
  check('the page meta is present', list.json?.meta?.total >= 1);

  await prisma.chantSession.delete({ where: { id } });
  check('deleting a session removes its rounds and words', (await prisma.chantMala.count({ where: { sessionId: id } })) === 0 && (await prisma.chantTapTranscript.count({ where: { sessionId: id } })) === 0);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
