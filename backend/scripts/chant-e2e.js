// Walks the chant tap record over real HTTP against a running API:
//
//   npm run test:chant
//
// Same shape as scripts/reels-e2e.js — the session is issued directly and
// everything after it is the real endpoint. What it checks is that the numbers
// stored for a round are the ones worked out from its taps (older builds) or
// taken from the summary the app sends now, that re-sending is harmless, that
// nobody can write to someone else's session, that the history can be limited to
// one mantra, and that a transcript past its expiry disappears from reads and
// from the table.

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
  check('history needs a signed-in user', anon.status === 403, `HTTP ${anon.status}`);

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

  console.log('\n6. Round summaries, and the history of one mantra');
  const mantras = await prisma.mantra.findMany({ where: { isPublished: true }, orderBy: { slug: 'asc' }, take: 2 });
  if (mantras.length < 2) {
    console.error('\nNeed two published mantras. Run `npm run seed` first.\n');
    process.exit(1);
  }
  const [first, second] = mantras;
  const open = async (mantraId, rounds, beads = 0) => {
    const made = await call('POST', `${API}/session`, { ...as, body: mantraId ? { mantraId } : {} });
    const sid = made.json?.data?.id;
    if (rounds || beads) await call('PATCH', `${API}/session/${sid}`, { ...as, body: { rounds, beads, finish: true } });
    return sid;
  };

  const s1 = await open(first.id, 1, 5);
  const summary = [
    { index: 1, complete: true, beads: 108, startedAt: t0, endedAt: t0 + 216000, durationMs: 216000, avgGapMs: 2000 },
    // Begun in an earlier sitting: the time is not known, and says so with 0.
    { index: 2, complete: false, beads: 5, startedAt: t0 + 220000, endedAt: t0 + 228000, durationMs: 0, avgGapMs: 2000 },
  ];
  const summed = await call('PUT', `${API}/session/${s1}/detail`, { ...as, body: { malas: summary } });
  check('a summary with no taps saves', summed.status === 200, `HTTP ${summed.status} ${JSON.stringify(summed.json?.error ?? '')}`);
  const kept = await prisma.chantMala.findMany({ where: { sessionId: s1 }, orderBy: { index: 'asc' } });
  check('its figures are stored as sent', kept[0]?.beads === 108 && kept[0]?.durationMs === 216000 && kept[0]?.avgGapMs === 2000 && kept[0]?.complete === true);
  check('no taps are stored with it', kept.every((row) => Array.isArray(row.taps) && row.taps.length === 0));
  check('start and end are the times sent', kept[0]?.startedAt.getTime() === t0 && kept[0]?.endedAt.getTime() === t0 + 216000);
  check('an unfinished round is not complete', kept[1]?.complete === false && kept[1]?.durationMs === 0);

  const short = await call('PUT', `${API}/session/${s1}/detail`, {
    ...as,
    body: { malas: [{ index: 3, complete: true, beads: 50, startedAt: t0, endedAt: t0 + 1000 }] },
  });
  const shortRow = await prisma.chantMala.findUnique({ where: { sessionId_index: { sessionId: s1, index: 3 } } });
  check('a round cannot be complete with fewer than 108 beads', short.status === 200 && shortRow?.complete === false);
  const absurd = await call('PUT', `${API}/session/${s1}/detail`, { ...as, body: { malas: [{ index: 4, beads: 5000 }] } });
  check('an impossible bead count is rejected', absurd.status === 400, `HTTP ${absurd.status}`);

  const s2 = await open(second.id, 1);
  const s3 = await open(null, 1);
  const s4 = await open(first.id, 0, 0); // opened and closed without a round
  const idsOf = async (query) => {
    const res = await call('GET', `${API}/sessions${query}`, as);
    return (res.json?.data ?? []).map((row) => row.id);
  };
  const ofFirst = await idsOf(`?mantraId=${first.id}`);
  check('the history of a mantra lists its own sittings', ofFirst.includes(s1) && !ofFirst.includes(s2) && !ofFirst.includes(s3));
  const ofNone = await idsOf('?mantraId=none');
  check('"none" lists the sittings that had no mantra', ofNone.includes(s3) && !ofNone.includes(s1) && !ofNone.includes(s2));
  const ofAll = await idsOf('');
  check('with no mantra given every one is listed', [s1, s2, s3].every((sid) => ofAll.includes(sid)));
  check('a sitting that finished no round is never listed', !ofAll.includes(s4) && !ofFirst.includes(s4));

  const read = await call('GET', `${API}/session/${s1}`, as);
  check('a session reads back its round summaries', read.json?.data?.malas?.length === 3 && read.json.data.malas[0].beads === 108);

  await prisma.chantSession.deleteMany({ where: { id: { in: [s1, s2, s3, s4] } } });

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
