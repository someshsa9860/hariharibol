// Walks the chant sync (the phone's batch) over real HTTP against a running API:
//
//   npm run test:chant-sync
//
// What it checks is what the endpoint exists for: sending a sitting twice is one
// sitting, a sitting that arrives days late lands on the day it began, rounds never go
// backwards, a finished sitting still takes a late update, two mantras keep their own
// rounds, a mantra that cannot be opened does not fail the batch, nobody can touch
// someone else's sitting, and a made-up start time is held inside the window.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';
import { localDateString } from '../utils/date.js';
import { CHANT_SYNC_MAX_SITTINGS, CHANT_SYNC_MAX_AGE_DAYS } from '../config/constants.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'chant-sync-e2e-device', 'x-platform': 'ios' };
const DAY_MS = 24 * 60 * 60 * 1000;

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

const SYNC = '/api/app/sadhana/chant/sync';
const TODAY = '/api/app/sadhana/today';

let seq = 0;
const newId = () => `e2e-${Date.now()}-${(seq += 1)}-${Math.random().toString(36).slice(2, 8)}`;

/** A sitting the way the phone sends it. */
function sitting(over = {}) {
  return { clientId: newId(), startedAt: Date.now() - 60000, rounds: 0, beads: 0, ...over };
}

const mala = (index, over = {}) => ({
  index,
  complete: true,
  beads: 108,
  startedAt: Date.now() - 50000,
  endedAt: Date.now() - 40000,
  durationMs: 10000,
  avgGapMs: 90,
  ...over,
});

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
  const as = { token: (await authService.issueSession(me, 'chant-sync-e2e-device')).accessToken };
  const asOther = { token: (await authService.issueSession(other, 'chant-sync-e2e-device')).accessToken };

  const mantras = await prisma.mantra.findMany({ where: { isPublished: true }, take: 2, select: { id: true } });
  if (mantras.length < 2) {
    console.error('\nNeed two published mantras. Run `npm run seed` first.\n');
    process.exit(1);
  }
  const [mantraA, mantraB] = mantras;

  const made = []; // client ids, for the clean-up
  const track = (s) => {
    made.push(s.clientId);
    return s;
  };

  try {
    console.log('\n1. A sitting is made, and sending it again is the same sitting');
    const first = track(
      sitting({ mantraId: mantraA.id, rounds: 2, beads: 10, malas: [mala(1), mala(2), mala(3, { complete: false, beads: 10 })] })
    );
    const sent = await call('PUT', SYNC, { ...as, body: { sittings: [first] } });
    check('the batch is accepted', sent.status === 200, `HTTP ${sent.status} ${JSON.stringify(sent.json?.error ?? '')}`);
    const stored = sent.json?.data?.sittings?.[0];
    check('the answer names the sitting by its client id', stored?.clientId === first.clientId);
    check('rounds and beads are stored', stored?.rounds === 2 && stored?.beads === 10, JSON.stringify(stored));
    const sessionId = stored?.id;

    const again = await call('PUT', SYNC, { ...as, body: { sittings: [first] } });
    check('sending it again is accepted', again.status === 200);
    check('it is the same row', again.json?.data?.sittings?.[0]?.id === sessionId);
    const count = await prisma.chantSession.count({ where: { userId: me.id, clientId: first.clientId } });
    check('only one session exists for the client id', count === 1, `${count}`);
    const malaRows = await prisma.chantMala.findMany({ where: { sessionId }, orderBy: { index: 'asc' } });
    check('one row per round, none doubled', malaRows.length === 3, `${malaRows.length}`);
    check('a round is complete only when it has all its beads', malaRows[0]?.complete === true && malaRows[2]?.complete === false);
    check('no taps are stored', malaRows.every((row) => row.taps.length === 0));

    console.log('\n2. Rounds never go backwards');
    const older = await call('PUT', SYNC, { ...as, body: { sittings: [{ ...first, rounds: 1, beads: 100 }] } });
    check('an older copy is accepted', older.status === 200);
    check(
      'it does not lower the rounds or take the beads of a lower count',
      older.json?.data?.sittings?.[0]?.rounds === 2 && older.json?.data?.sittings?.[0]?.beads === 10,
      JSON.stringify(older.json?.data?.sittings?.[0])
    );
    const sameRounds = await call('PUT', SYNC, { ...as, body: { sittings: [{ ...first, rounds: 2, beads: 40 }] } });
    check('at the same rounds the larger beads win', sameRounds.json?.data?.sittings?.[0]?.beads === 40);
    const newer = await call('PUT', SYNC, { ...as, body: { sittings: [{ ...first, rounds: 3, beads: 5 }] } });
    check(
      'a higher round count brings its own beads, even fewer',
      newer.json?.data?.sittings?.[0]?.rounds === 3 && newer.json?.data?.sittings?.[0]?.beads === 5,
      JSON.stringify(newer.json?.data?.sittings?.[0])
    );

    console.log('\n3. A finished sitting takes a late update');
    const finished = await call('PUT', SYNC, { ...as, body: { sittings: [{ ...first, rounds: 3, beads: 5, finish: true }] } });
    check('finishing is accepted', finished.status === 200);
    const row = await prisma.chantSession.findUnique({ where: { id: sessionId } });
    check('the sitting is ended', row?.endedAt instanceof Date);
    check('its duration is worked out', row?.durationSeconds >= 0 && row?.durationSeconds < 600, `${row?.durationSeconds}`);
    const endedAt = row?.endedAt?.getTime();
    const late = await call('PUT', SYNC, { ...as, body: { sittings: [{ ...first, rounds: 4, beads: 0, finish: true }] } });
    check('an update after the end is accepted, not refused', late.status === 200 && late.json?.data?.sittings?.[0]?.rounds === 4);
    const after = await prisma.chantSession.findUnique({ where: { id: sessionId } });
    check('the end is not moved by a later finish', after?.endedAt?.getTime() === endedAt);

    console.log('\n4. A sitting that arrives days late lands on the day it began');
    const daysAgo = 5;
    const began = Date.now() - daysAgo * DAY_MS;
    const lateOne = track(sitting({ mantraId: mantraA.id, startedAt: began, rounds: 3, beads: 0, finish: true, malas: [mala(1), mala(2), mala(3)] }));
    const lateSent = await call('PUT', SYNC, { ...as, body: { sittings: [lateOne] } });
    const expectedDate = localDateString(me.timezone, new Date(began));
    check('accepted', lateSent.status === 200);
    check('it is dated by when it began', lateSent.json?.data?.sittings?.[0]?.date === expectedDate, `${lateSent.json?.data?.sittings?.[0]?.date} vs ${expectedDate}`);
    const lateDay = lateSent.json?.data?.days?.find((d) => d.date === expectedDate);
    check('that day was recounted', lateDay?.roundsCompleted >= 3, JSON.stringify(lateDay));
    const todayDate = localDateString(me.timezone);
    check('today was not touched by it', !(lateSent.json?.data?.days ?? []).some((d) => d.date === todayDate));

    console.log('\n5. Two mantras keep their own rounds, and the day adds both');
    const beforeToday = await call('GET', TODAY, as);
    const baseRounds = beforeToday.json?.data?.day?.roundsCompleted ?? 0;
    const baseA = (beforeToday.json?.data?.sessions ?? []).filter((s) => s.mantraId === mantraA.id).reduce((n, s) => n + s.rounds, 0);
    const baseB = (beforeToday.json?.data?.sessions ?? []).filter((s) => s.mantraId === mantraB.id).reduce((n, s) => n + s.rounds, 0);
    const sa = track(sitting({ mantraId: mantraA.id, rounds: 16, beads: 0, finish: true }));
    const sb = track(sitting({ mantraId: mantraB.id, rounds: 1, beads: 0, finish: true }));
    const both = await call('PUT', SYNC, { ...as, body: { sittings: [sa, sb] } });
    check('both are accepted in one request', both.status === 200 && both.json?.data?.sittings?.length === 2);
    const afterToday = await call('GET', TODAY, as);
    const sessions = afterToday.json?.data?.sessions ?? [];
    const sumFor = (id) => sessions.filter((s) => s.mantraId === id).reduce((n, s) => n + s.rounds, 0);
    check('the day total is both mantras together', afterToday.json?.data?.day?.roundsCompleted === baseRounds + 17, `${afterToday.json?.data?.day?.roundsCompleted} vs ${baseRounds + 17}`);
    check('the first mantra has its own 16', sumFor(mantraA.id) === baseA + 16, `${sumFor(mantraA.id)}`);
    check('the second has its own 1, not 17', sumFor(mantraB.id) === baseB + 1, `${sumFor(mantraB.id)}`);

    console.log('\n6. A mantra that cannot be opened does not fail the batch');
    const ghost = track(sitting({ mantraId: 'no-such-mantra-id', rounds: 1, beads: 0, finish: true }));
    const ghostSent = await call('PUT', SYNC, { ...as, body: { sittings: [ghost] } });
    check('accepted', ghostSent.status === 200);
    const ghostRow = await prisma.chantSession.findFirst({ where: { userId: me.id, clientId: ghost.clientId } });
    check('kept, under no mantra', ghostRow && ghostRow.mantraId === null && ghostRow.rounds === 1);
    const plain = track(sitting({ mantraId: null, rounds: 1, beads: 0, finish: true }));
    const plainSent = await call('PUT', SYNC, { ...as, body: { sittings: [plain] } });
    check('a sitting with no mantra is accepted', plainSent.status === 200);

    console.log('\n7. Nobody reaches anyone else’s sitting');
    const theirs = await call('PUT', SYNC, { ...asOther, body: { sittings: [{ ...first, rounds: 99, beads: 7 }] } });
    check('the same client id from another account is accepted', theirs.status === 200);
    check('it is a different session', theirs.json?.data?.sittings?.[0]?.id !== sessionId);
    const mine = await prisma.chantSession.findUnique({ where: { id: sessionId } });
    check('mine is untouched', mine?.rounds === 4, `${mine?.rounds}`);
    const theirRow = await prisma.chantSession.findFirst({ where: { userId: other.id, clientId: first.clientId } });
    check('theirs belongs to them', theirRow?.userId === other.id && theirRow?.rounds === 99);
    await prisma.chantSession.deleteMany({ where: { userId: other.id, clientId: first.clientId } });

    console.log('\n8. A made-up start time is held inside the window');
    const ancient = track(sitting({ startedAt: Date.now() - (CHANT_SYNC_MAX_AGE_DAYS + 900) * DAY_MS, rounds: 1, beads: 0, finish: true }));
    const future = track(sitting({ startedAt: Date.now() + 30 * DAY_MS, rounds: 1, beads: 0, finish: true }));
    const odd = await call('PUT', SYNC, { ...as, body: { sittings: [ancient, future] } });
    check('accepted', odd.status === 200);
    const ancientRow = await prisma.chantSession.findFirst({ where: { userId: me.id, clientId: ancient.clientId } });
    const futureRow = await prisma.chantSession.findFirst({ where: { userId: me.id, clientId: future.clientId } });
    check(
      'a start older than the window is brought to its edge',
      ancientRow && Date.now() - ancientRow.startedAt.getTime() <= (CHANT_SYNC_MAX_AGE_DAYS + 1) * DAY_MS
    );
    check('a start in the future is brought to now', futureRow && futureRow.startedAt.getTime() <= Date.now() + 1000);

    console.log('\n9. What it refuses');
    const empty = await call('PUT', SYNC, { ...as, body: { sittings: [] } });
    check('an empty batch is a 400', empty.status === 400, `HTTP ${empty.status}`);
    const tooMany = await call('PUT', SYNC, {
      ...as,
      body: { sittings: Array.from({ length: CHANT_SYNC_MAX_SITTINGS + 1 }, () => sitting()) },
    });
    check('more than the limit is a 400', tooMany.status === 400, `HTTP ${tooMany.status}`);
    const shortId = await call('PUT', SYNC, { ...as, body: { sittings: [sitting({ clientId: 'x' })] } });
    check('a short client id is a 400', shortId.status === 400, `HTTP ${shortId.status}`);
    const lots = await call('PUT', SYNC, { ...as, body: { sittings: [sitting({ rounds: 9999 })] } });
    check('an absurd round count is a 400', lots.status === 400, `HTTP ${lots.status}`);
    const anon = await call('PUT', SYNC, { body: { sittings: [sitting()] } });
    check('signed out is refused', anon.status === 403, `HTTP ${anon.status}`);

    console.log('\n10. A full batch in one request');
    const batch = Array.from({ length: CHANT_SYNC_MAX_SITTINGS }, (_, i) =>
      track(sitting({ startedAt: Date.now() - (i + 1) * 3600000, rounds: 1, beads: 0, finish: true }))
    );
    const bulk = await call('PUT', SYNC, { ...as, body: { sittings: batch } });
    check('the limit is accepted whole', bulk.status === 200 && bulk.json?.data?.sittings?.length === CHANT_SYNC_MAX_SITTINGS, `HTTP ${bulk.status}`);
  } finally {
    // The rounds are real rows on real days, so put every day back.
    const rows = await prisma.chantSession.findMany({
      where: { userId: me.id, clientId: { in: made } },
      select: { id: true, sadhanaDayId: true },
    });
    const dayIds = [...new Set(rows.map((r) => r.sadhanaDayId))];
    await prisma.chantSession.deleteMany({ where: { id: { in: rows.map((r) => r.id) } } });
    for (const id of dayIds) {
      const sum = await prisma.chantSession.aggregate({ where: { sadhanaDayId: id }, _sum: { rounds: true } });
      await prisma.sadhanaDay.update({ where: { id }, data: { roundsCompleted: sum._sum.rounds || 0 } });
    }
    await prisma.$disconnect();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
