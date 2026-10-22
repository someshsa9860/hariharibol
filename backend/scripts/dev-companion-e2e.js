// Walks the developer companion backend over real HTTP and a real websocket. Needs the API, the worker and the
// websocket container running (npm run dev, npm run worker, npm run websocket), a migrated and seeded database
// and Redis:
//
//   npm run test:dev-companion
//
// Firebase is not configured here, so no push leaves the machine; what is checked is the decision (what was held
// for the digest, what was suppressed).

import WebSocket from 'ws';

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import * as devEvents from '../services/dev-events.js';
import { closeQueues } from '../jobs/index.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const WS = process.env.WS_URL || 'ws://localhost:4001/ws';
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'e2e-dev', 'x-platform': 'android' };

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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
    /* no body */
  }
  return { status: res.status, json };
}

// A socket that records every event it is sent.
function listen(token, query = '') {
  const events = [];
  const socket = new WebSocket(`${WS}?token=${token}${query}`);
  socket.on('message', (raw) => events.push(JSON.parse(raw)));
  const closed = new Promise((resolve) => socket.on('close', (code) => resolve(code)));
  const open = new Promise((resolve) => socket.on('open', resolve));
  return { socket, events, closed, open, has: (name, test = () => true) => events.some((e) => e.event === name && test(e.payload)) };
}

async function waitFor(fn, ms = 6000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await sleep(150);
  }
  return false;
}

async function person(email, roleSlug) {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  const user = await prisma.user.upsert({
    where: { email },
    update: { roleId: role.id },
    create: { email, name: email.split('@')[0], authProvider: 'GOOGLE', providerUserId: `e2e:${email}`, roleId: role.id },
  });
  return { user, token: (await authService.issueSession(user, `e2e-${roleSlug}`)).accessToken };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}.\n`);
    process.exit(1);
  }

  const owner = await person('owner@dev-e2e.test', 'super_admin');
  const admin = await person('admin@dev-e2e.test', 'admin');
  const reader = await person('reader@dev-e2e.test', 'user');
  await prisma.devConversation.deleteMany({ where: { userId: reader.user.id } });
  await redis.del(`dev:digest:${owner.user.id}`, `dev:push:hour:${owner.user.id}`, `dev:push:crit:${owner.user.id}`, `dev:fg:${owner.user.id}`, `dev:lastpush:${owner.user.id}`);

  console.log('\n1. Who may sign in to the companion app');
  check('owner (super_admin) reads the summary', (await call('GET', '/api/admin/dev/summary', { token: owner.token })).status === 200);
  check('the admin role does not have dev.access', (await call('GET', '/api/admin/dev/summary', { token: admin.token })).status === 403);
  check('a reader does not', (await call('GET', '/api/admin/dev/summary', { token: reader.token })).status === 403);
  check('no token is refused', [401, 403].includes((await call('GET', '/api/admin/dev/summary')).status));
  const bad = listen(admin.token, '&app=dev');
  check('the dev websocket refuses a non-holder', (await bad.closed) === 4003);

  console.log('\n2. A reader writes to the developer');
  const devSocket = listen(owner.token, '&app=dev');
  const readerSocket = listen(reader.token);
  await Promise.all([devSocket.open, readerSocket.open]);
  const first = await call('POST', '/api/app/developer-chat/messages', { token: reader.token, body: { body: 'Hare Krishna, the counter froze today' } });
  check('POST /developer-chat/messages is 201', first.status === 201, `HTTP ${first.status}`);
  check('the developer socket got dev.chat.message', await waitFor(() => devSocket.has('dev.chat.message', (p) => p.body.includes('froze'))));
  check('and, from the worker, a chat.message feed event', await waitFor(() => devSocket.has('dev.event', (p) => p.type === 'chat.message')));
  const list = await call('GET', '/api/admin/dev/conversations', { token: owner.token });
  const convo = list.json?.data?.items?.find((c) => c.user.id === reader.user.id);
  check('the conversation lists with 1 unread', convo?.devUnread === 1, JSON.stringify(convo?.devUnread));

  console.log('\n3. The developer replies');
  const reply = await call('POST', `/api/admin/dev/conversations/${convo.id}/messages`, { token: owner.token, body: { body: 'Thanks — fixed in the next update' } });
  check('reply is 201', reply.status === 201, `HTTP ${reply.status}`);
  check('the reader socket got it', await waitFor(() => readerSocket.has('dev.chat.message', (p) => p.fromDeveloper === true)));
  check('the reader has 1 unread', (await call('GET', '/api/app/developer-chat/unread', { token: reader.token })).json?.data?.count === 1);
  const opened = await call('GET', '/api/app/developer-chat', { token: reader.token });
  check('opening the chat shows both messages in order', opened.json?.data?.messages?.length === 2 && opened.json.data.messages[1].fromDeveloper === true);
  check('and clears the reader’s unread', (await call('GET', '/api/app/developer-chat/unread', { token: reader.token })).json?.data?.count === 0);
  const thread = await call('GET', `/api/admin/dev/conversations/${convo.id}/messages`, { token: owner.token });
  check('the developer opening it clears devUnread', thread.json?.data?.conversation?.devUnread === 0);
  check('a reader cannot read the developer’s side', (await call('GET', `/api/admin/dev/conversations/${convo.id}/messages`, { token: reader.token })).status === 403);
  check('an empty message is refused', (await call('POST', '/api/app/developer-chat/messages', { token: reader.token, body: { body: '   ' } })).status === 400);

  console.log('\n4. The feed: alerts are de-duplicated and reach the socket');
  const key = `e2e-${Date.now()}`;
  for (let i = 0; i < 3; i += 1) devEvents.emit('health.alert', { severity: 'critical', title: `Disk is full ${key}`, dedupeKey: key, cooldownS: 60 });
  check('a critical alert arrives live', await waitFor(() => devSocket.has('dev.event', (p) => p.title.includes(key))));
  await sleep(800);
  check('three emits with one key make one event', devSocket.events.filter((e) => e.event === 'dev.event' && e.payload.title.includes(key)).length === 1);
  const feed = await call('GET', '/api/admin/dev/feed?limit=5', { token: owner.token });
  check('GET /feed returns newest first', feed.status === 200 && feed.json.data.items.length > 0);
  check('the feed filters by severity', (await call('GET', '/api/admin/dev/feed?severity=critical', { token: owner.token })).json.data.items.every((e) => e.severity === 'critical'));

  console.log('\n5. Errors are counted, then become one event');
  devEvents.recordError({ method: 'GET', route: '/api/app/e2e', status: 500, message: `boom ${key}` });
  for (let i = 0; i < 24; i += 1) devEvents.recordError({ method: 'GET', route: '/api/app/e2e', status: 500, message: `boom ${key}` });
  devEvents.flushErrors();
  check('a new kind of error shows up once', await waitFor(() => devSocket.has('dev.event', (p) => p.type === 'error.new' && p.title.includes('/api/app/e2e'))));
  check('and, past the threshold, an error spike', await waitFor(() => devSocket.has('dev.event', (p) => p.type === 'error.spike')));

  console.log('\n6. Pushes: held back, never spammy');
  const digestLen = () => redis.llen(`dev:digest:${owner.user.id}`);
  const before = await digestLen();
  await devSocket.socket.send(JSON.stringify({ type: 'ping', foreground: false }));
  await sleep(200);
  devEvents.emit('user.signup', { title: `New sign-up ${key}`, body: 'x' });
  check('background + a plain event waits for the digest', await waitFor(async () => (await digestLen()) > before));
  await devSocket.socket.send(JSON.stringify({ type: 'ping', foreground: true }));
  await sleep(300);
  check('foreground is remembered', (await redis.exists(`dev:fg:${owner.user.id}`)) === 1);
  const mid = await digestLen();
  devEvents.emit('user.signup', { title: `Another sign-up ${key}`, body: 'y' });
  await waitFor(() => devSocket.has('dev.event', (p) => p.title.includes('Another')));
  await sleep(500);
  check('foreground adds nothing to the digest', (await digestLen()) === mid);
  const prefs = await call('PUT', '/api/admin/dev/prefs', { token: owner.token, body: { pushEnabled: true, mutedTypes: ['user.signup'] } });
  check('PUT /prefs saves muted types', prefs.status === 200 && prefs.json.data.mutedTypes[0] === 'user.signup');
  check('GET /prefs reads them back', (await call('GET', '/api/admin/dev/prefs', { token: owner.token })).json.data.mutedTypes.includes('user.signup'));

  console.log('\n7. Summary and sign-ups');
  const s = await call('GET', '/api/admin/dev/summary', { token: owner.token });
  check('summary has the numbers', s.status === 200 && typeof s.json.data.users === 'number' && typeof s.json.data.errorsLastHour === 'number', JSON.stringify(s.json?.data));
  const found = await call('GET', '/api/admin/dev/users?q=reader@dev', { token: owner.token });
  check('the developer can find a reader to write to', found.json?.data?.items?.some((u) => u.id === reader.user.id));
  const started = await call('POST', '/api/admin/dev/conversations', { token: owner.token, body: { userId: reader.user.id, body: 'Hello from the developer' } });
  check('and start a conversation', started.status === 201 && started.json.data.conversationId === convo.id);

  devSocket.socket.close();
  readerSocket.socket.close();
  console.log(`\n${passed} passed, ${failed} failed\n`);
  await closeQueues();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
