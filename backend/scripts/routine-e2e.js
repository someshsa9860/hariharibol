// Walks the Routine sync over real HTTP against a running API:
//
//   npm run test:routine
//
// Same shape as scripts/chant-e2e.js — the session is issued directly and
// everything after it is the real endpoint. What it checks is that what the
// phone sends is what comes back, that sending it twice is harmless, that a
// removal removes, that `since` bounds what is returned, that bad input is
// refused, and that nobody sees or touches someone else's routine.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'routine-e2e-device', 'x-platform': 'ios' };
const API = '/api/app/routine';

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

const task = (id, day, extra = {}) => ({
  id,
  day,
  title: `Task ${id}`,
  category: 'devotion',
  slot: 'morning',
  isDone: false,
  ...extra,
});

const byId = (rows) => Object.fromEntries(rows.map((row) => [row.id, row]));

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
  const as = { token: (await authService.issueSession(me, 'routine-e2e-device')).accessToken };
  const asOther = { token: (await authService.issueSession(other, 'routine-e2e-device')).accessToken };

  // Start clean, whatever an earlier run left behind.
  const wipe = (userId) =>
    Promise.all([
      prisma.routineTask.deleteMany({ where: { userId } }),
      prisma.routineDailyItem.deleteMany({ where: { userId } }),
      prisma.routineCheck.deleteMany({ where: { userId } }),
    ]);
  await wipe(me.id);
  await wipe(other.id);

  const sync = (who, body) => call('POST', `${API}/sync`, { ...who, body: { since: '2026-01-01', ...body } });

  console.log('\n1. Sending a routine and reading it back');
  const first = await sync(as, {
    tasks: [
      task('t1', '2026-10-10', { windowStart: 360, windowEnd: 450, isDone: true, doneAt: 400 }),
      task('t2', '2026-10-10', { category: 'errand', slot: 'anytime' }),
    ],
    daily: [
      {
        id: 'd1',
        title: 'Japa',
        category: 'devotion',
        slot: 'morning',
        windowStart: 300,
        windowEnd: 420,
        since: '2026-09-01',
        until: '',
      },
    ],
    checks: [{ itemId: 'd1', day: '2026-10-10', doneAt: 330 }],
  });
  check('the sync is accepted', first.status === 200, `HTTP ${first.status} ${JSON.stringify(first.json?.error ?? '')}`);
  const data = first.json?.data;
  const tasks = byId(data?.tasks ?? []);
  check('both tasks come back', Object.keys(tasks).length === 2);
  check('a task keeps its range and the time it was done', tasks.t1?.windowStart === 360 && tasks.t1?.windowEnd === 450 && tasks.t1?.doneAt === 400);
  check('and a task with no range has none', tasks.t2 && !('windowStart' in tasks.t2) && !('doneAt' in tasks.t2));
  check('the daily item comes back with an empty until', data?.daily?.[0]?.id === 'd1' && data.daily[0].until === '' && data.daily[0].windowStart === 300);
  check('the tick comes back with its time', data?.checks?.[0]?.itemId === 'd1' && data.checks[0].doneAt === 330);

  const read = await call('GET', `${API}?since=2026-01-01`, as);
  check('GET gives the same routine', read.status === 200 && read.json?.data?.tasks?.length === 2 && read.json.data.daily.length === 1);

  console.log('\n2. Sending it again, and changing it');
  await sync(as, { tasks: [task('t1', '2026-10-10', { windowStart: 360, windowEnd: 450, isDone: true, doneAt: 400 })] });
  check('a repeat adds no rows', (await prisma.routineTask.count({ where: { userId: me.id } })) === 2);

  const edited = await sync(as, { tasks: [task('t1', '2026-10-10', { title: 'Renamed', isDone: false, doneAt: 999 })] });
  const t1 = byId(edited.json?.data?.tasks ?? []).t1;
  check('an edit overwrites the row', t1?.title === 'Renamed');
  check('and unticking drops the time it was done at', t1?.isDone === false && !('doneAt' in t1));
  check('the window an edit leaves out is cleared', t1 && !('windowStart' in t1));

  const moved = await sync(as, { tasks: [task('t2', '2026-10-12', { category: 'errand', slot: 'anytime' })] });
  check('a task can change day', byId(moved.json?.data?.tasks ?? []).t2?.day === '2026-10-12');

  const ended = await sync(as, {
    daily: [{ id: 'd1', title: 'Japa', category: 'devotion', slot: 'morning', since: '2026-09-01', until: '2026-10-11' }],
  });
  check('ending a daily item keeps it, with its last day', ended.json?.data?.daily?.[0]?.until === '2026-10-11');

  console.log('\n3. Removing');
  const removed = await sync(as, { removedTasks: ['t2', 'never-existed'], removedChecks: [{ itemId: 'd1', day: '2026-10-10' }] });
  check('a removal is accepted, even of a row that is not there', removed.status === 200);
  check('the task is gone', !byId(removed.json?.data?.tasks ?? []).t2 && Object.keys(byId(removed.json.data.tasks)).length === 1);
  check('and so is the tick', removed.json?.data?.checks?.length === 0);
  const again = await sync(as, { removedTasks: ['t2'] });
  check('removing twice is harmless', again.status === 200);

  const undone = await sync(as, { tasks: [task('t3', '2026-10-11')], removedTasks: ['t3'] });
  check('a row removed and sent in one request ends up present', Boolean(byId(undone.json?.data?.tasks ?? []).t3));

  console.log('\n4. `since` bounds what comes back');
  await sync(as, { tasks: [task('old', '2025-05-01')], checks: [{ itemId: 'd1', day: '2025-05-01', doneAt: null }] });
  const recent = await call('GET', `${API}?since=2026-01-01`, as);
  check('older tasks are not sent back', !byId(recent.json?.data?.tasks ?? []).old);
  check('nor older ticks', (recent.json?.data?.checks ?? []).every((c) => c.day >= '2026-01-01'));
  check('but they are kept', (await prisma.routineTask.count({ where: { userId: me.id, id: 'old' } })) === 1);
  const all = await call('GET', API, as);
  check('without `since` everything comes back', Boolean(byId(all.json?.data?.tasks ?? []).old));
  const tick = (all.json?.data?.checks ?? []).find((c) => c.day === '2025-05-01');
  check('a tick with no time keeps none', tick && tick.doneAt === null);

  console.log('\n5. Bad input is refused, and nothing is half-applied');
  const before = await prisma.routineTask.count({ where: { userId: me.id } });
  const refusals = [
    ['an empty title', { tasks: [task('x1', '2026-10-10', { title: '   ' })] }],
    ['a made-up category', { tasks: [task('x2', '2026-10-10', { category: 'sleep' })] }],
    ['a day that is not a date', { tasks: [task('x3', 'tomorrow')] }],
    ['a range that ends before it starts', { tasks: [task('x4', '2026-10-10', { windowStart: 500, windowEnd: 400 })] }],
    ['half a range', { tasks: [task('x5', '2026-10-10', { windowStart: 500 })] }],
    ['a time past the end of the day', { tasks: [task('x6', '2026-10-10', { isDone: true, doneAt: 1440 })] }],
    ['a title over 200 characters', { tasks: [task('x7', '2026-10-10', { title: 'a'.repeat(201) })] }],
    ['more than 1000 rows', { removedTasks: Array.from({ length: 1001 }, (_, i) => `r${i}`) }],
  ];
  for (const [name, body] of refusals) {
    const res = await sync(as, body);
    check(`${name} is refused`, res.status === 400, `HTTP ${res.status}`);
  }
  const mixed = await sync(as, { tasks: [task('good', '2026-10-10'), task('bad', 'nope')] });
  check('one bad row refuses the lot', mixed.status === 400 && (await prisma.routineTask.count({ where: { userId: me.id } })) === before);

  console.log('\n6. Whose routine it is');
  const theirs = await call('GET', `${API}?since=2026-01-01`, asOther);
  check('another user sees none of it', theirs.status === 200 && theirs.json?.data?.tasks?.length === 0 && theirs.json.data.daily.length === 0);

  // The same id from another account is a different row.
  await sync(asOther, { tasks: [task('t1', '2026-10-10', { title: 'Theirs' })] });
  const mine = byId((await call('GET', API, as)).json?.data?.tasks ?? []);
  const yours = byId((await call('GET', API, asOther)).json?.data?.tasks ?? []);
  check('an id used by two people is two rows', mine.t1?.title === 'Renamed' && yours.t1?.title === 'Theirs');

  const stolen = await sync(asOther, { removedTasks: ['t3'] });
  check('removing by id cannot reach another user’s row', stolen.status === 200 && (await prisma.routineTask.count({ where: { userId: me.id, id: 't3' } })) === 1);

  const anon = await call('POST', `${API}/sync`, { body: { since: '2026-01-01' } });
  check('a sync needs a signed-in user', anon.status === 401, `HTTP ${anon.status}`);
  const anonRead = await call('GET', API);
  check('and so does a read', anonRead.status === 401, `HTTP ${anonRead.status}`);

  // The verses behind the standard routine's reminders (needs `npm run seed`).
  const nudges = await call('GET', `${API}/nudges`, as);
  const kinds = nudges.json?.data?.kinds ?? [];
  const wake = kinds.find((kind) => kind.key === 'wakeUp');
  check('nudges list the standard routines in the order of the day', nudges.status === 200 && kinds[0]?.key === 'wakeUp' && kinds.at(-1)?.key === 'sleep', `HTTP ${nudges.status}, ${kinds.length} kinds`);
  check('each kind has verses with a reference and text', kinds.length > 0 && kinds.every((kind) => kind.nudges.length > 0 && kind.nudges.every((n) => n.reference && n.text)));
  check('a kind carries a voice script with {name} and no voice url yet', wake?.voiceScript?.includes('{name}') && wake.voiceUrl === null);
  check('the day-break chanting reminder exists', kinds.some((kind) => kind.key === 'breakChant'));
  const nudgesAnon = await call('GET', `${API}/nudges`);
  check('nudges need a signed-in user', nudgesAnon.status === 401, `HTTP ${nudgesAnon.status}`);

  await wipe(me.id);
  await wipe(other.id);

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
