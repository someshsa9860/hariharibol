// Walks "which tradition does someone's chanting say they follow" over real HTTP
// against a running API:
//
//   npm run test:sampradaya
//
// Same shape as scripts/chant-e2e.js. Each scenario gets its own throwaway user,
// so nothing here touches anyone's real history, and everything it creates is
// deleted at the end. Days are backdated through the manual-rounds endpoint,
// which accepts a date — that is what lets a few seconds stand in for a month.
//
// What it checks is the rule in services/sampradaya.js: three separate days
// make a tradition, they need not be consecutive, an empty or mantra-less
// sitting says nothing, the tradition can flip at any time, a late entry for an
// old day cannot unseat a recent habit, and a dead heat changes nothing.

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';
import * as sampradaya from '../services/sampradaya.js';
import { localDateString, shiftDays } from '../utils/date.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'sampradaya-e2e-device';
const HEAD = { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios' };
const TAG = `sampradaya-e2e-${Date.now()}`;
const API = '/api/app/sadhana/chant';

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

const created = { users: [], mantras: [] };

async function makeUser(label) {
  const role = await prisma.role.findUnique({ where: { slug: 'user' } });
  const user = await prisma.user.create({
    data: {
      email: `${TAG}-${label}@example.test`,
      name: `${TAG} ${label}`,
      roleId: role.id,
      authProvider: 'GOOGLE',
      providerUserId: `${TAG}-${label}`,
    },
  });
  created.users.push(user.id);
  const { accessToken } = await authService.issueSession(user, DEVICE);
  return { id: user.id, token: accessToken };
}

const today = localDateString('Asia/Kolkata');
/** The date `n` days ago, as the API takes it. */
const ago = (n) => shiftDays(today, -n);

/** Rounds on one date, with or without a mantra. */
async function chant(who, daysAgo, mantra) {
  const res = await call('POST', `${API}/manual`, {
    token: who.token,
    body: { date: ago(daysAgo), rounds: 1, ...(mantra ? { mantraId: mantra.id } : {}) },
  });
  if (res.status !== 201) throw new Error(`manual log failed: HTTP ${res.status} ${JSON.stringify(res.json)}`);
}

/** What the API tells the app this person is. */
async function mine(who) {
  const res = await call('GET', '/api/app/me', who);
  return res.json?.data?.sampradaya;
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const bySlug = async (slug) => {
    const row = await prisma.mantra.findUnique({ where: { slug } });
    if (!row) {
      console.error(`\nThe mantra "${slug}" is missing. Run \`npm run seed\` first.\n`);
      process.exit(1);
    }
    return row;
  };
  const shiva = await bySlug('om-namah-shivaya');
  const mrityunjaya = await bySlug('maha-mrityunjaya-mantra');
  const krishna = await bySlug('hare-krishna-mahamantra');
  const rama = await bySlug('rama-taraka-mantra');
  check('the seed tags Shiva mantras shaiva and the rest vaishnav', shiva.sampradaya === 'shaiva' && krishna.sampradaya === 'vaishnav');

  console.log('\n1. Nothing yet');
  const fresh = await makeUser('fresh');
  check('a new user has no tradition', (await mine(fresh)) === null);

  console.log('\n2. What says nothing');
  const quiet = await makeUser('quiet');
  for (const n of [9, 8, 7, 6]) await chant(quiet, n); // no mantra attached
  check('four days with no mantra attached', (await mine(quiet)) === null);

  const opened = await call('POST', `${API}/session`, { ...quiet, body: { mantraId: shiva.id } });
  check('a session opens', opened.status === 201);
  check('opening the counter on a Shiva mantra and leaving is not a chant', (await mine(quiet)) === null);

  console.log('\n3. Three separate days make a tradition');
  const devotee = await makeUser('devotee');
  await chant(devotee, 30, shiva);
  await chant(devotee, 29, shiva);
  check('two days are not enough', (await mine(devotee)) === null);
  await chant(devotee, 29, mrityunjaya);
  check('a second sitting on the same day is still one day', (await mine(devotee)) === null);
  await chant(devotee, 25, shiva);
  check('a third day, not in a row, makes them shaiva', (await mine(devotee)) === 'shaiva');

  console.log('\n4. It can change at any time');
  await chant(devotee, 24, krishna);
  await chant(devotee, 23, rama);
  check('two Vaishnav days do not take it from them', (await mine(devotee)) === 'shaiva');
  await chant(devotee, 22, krishna);
  check('the third makes them vaishnav', (await mine(devotee)) === 'vaishnav');
  await chant(devotee, 21, shiva);
  await chant(devotee, 20, shiva);
  check('two Shaiva days do not take it back', (await mine(devotee)) === 'vaishnav');
  await chant(devotee, 19, shiva);
  check('the third puts them back to shaiva', (await mine(devotee)) === 'shaiva');

  console.log('\n5. When the days were, not when they were entered');
  for (const n of [40, 39, 38]) await chant(devotee, n, krishna);
  check('three older Vaishnav days entered late do not unseat the recent habit', (await mine(devotee)) === 'shaiva');

  console.log('\n6. A dead heat changes nothing');
  const torn = await makeUser('torn');
  for (const n of [5, 4]) {
    await chant(torn, n, shiva);
    await chant(torn, n, krishna);
  }
  check('two days of each — neither has three', (await mine(torn)) === null);
  await chant(torn, 3, krishna);
  check('Vaishnav gets to three first', (await mine(torn)) === 'vaishnav');
  await chant(torn, 3, shiva);
  check('Shaiva catching up to the same three days is a tie, and they stay vaishnav', (await mine(torn)) === 'vaishnav');
  await chant(torn, 2, shiva);
  check('one more Shaiva day settles it', (await mine(torn)) === 'shaiva');
  await chant(torn, 2, krishna);
  check('the same on the Vaishnav side is a tie again, and they stay shaiva', (await mine(torn)) === 'shaiva');

  console.log('\n7. A live session');
  const live = await makeUser('live');
  await chant(live, 10, krishna);
  await chant(live, 9, krishna);
  const session = await call('POST', `${API}/session`, { ...live, body: { mantraId: krishna.id } });
  const id = session.json?.data?.id;
  check('a session opens on the mahamantra', session.status === 201 && Boolean(id));
  check('with two days behind it, still nothing', (await mine(live)) === null);
  const first = await call('PATCH', `${API}/session/${id}`, { ...live, body: { beads: 1 } });
  check('the first bead is accepted', first.status === 200, `HTTP ${first.status}`);
  check('and the third day makes them vaishnav', (await mine(live)) === 'vaishnav');

  console.log('\n8. Any tradition the mantras name');
  const shakta = await prisma.mantra.create({
    data: {
      slug: `${TAG}-shakta`,
      name: `${TAG} shakta mantra`,
      sanskrit: 'ॐ दुं दुर्गायै नमः',
      category: 'beej',
      sampradaya: 'shakta',
    },
  });
  created.mantras.push(shakta.id);
  const mother = await makeUser('mother');
  for (const n of [3, 2, 1]) await chant(mother, n, shakta);
  check('three days on a Shakta mantra make them shakta', (await mine(mother)) === 'shakta');

  console.log('\n9. The rule on its own');
  const days = (...list) => list;
  const held = new Map([
    ['shaiva', days('2026-03-10', '2026-03-09', '2026-03-08')],
    ['vaishnav', days('2026-03-10', '2026-03-09', '2026-03-08')],
  ]);
  check('a tie keeps the current tradition', sampradaya.decide(held, 'vaishnav') === 'vaishnav');
  check('a tie with a current outside it is nobody', sampradaya.decide(held, 'shakta') === null);
  check('a tie with nobody before is nobody', sampradaya.decide(held, null) === null);
  check(
    'a tradition one day short is not held',
    sampradaya.decide(new Map([['shaiva', days('2026-03-10', '2026-03-09')]]), null) === null
  );
  check('no days at all is nobody', sampradaya.decide(new Map(), 'shaiva') === null);
  check(
    'the tradition whose latest days are more recent wins',
    sampradaya.decide(
      new Map([
        ['shaiva', days('2026-03-20', '2026-03-19', '2026-03-18')],
        ['vaishnav', days('2026-03-25', '2026-03-24', '2026-03-01')],
      ]),
      'vaishnav'
    ) === 'shaiva'
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
}

main()
  .catch((error) => {
    console.error(error);
    failed += 1;
  })
  .finally(async () => {
    // Users cascade to their days, sessions and rounds.
    await prisma.user.deleteMany({ where: { id: { in: created.users } } }).catch(() => null);
    await prisma.mantra.deleteMany({ where: { id: { in: created.mantras } } }).catch(() => null);
    await prisma.$disconnect();
    process.exit(failed === 0 ? 0 : 1);
  });
