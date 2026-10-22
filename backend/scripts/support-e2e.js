// Walks support tickets, feedback and the rating prompt over real HTTP against a running API:
//
//   npm run dev    (another terminal)
//   npm run test:support
//
// Checks the permission gate, raising a ticket and feedback, the reader seeing only their own, a staff reply
// (status moves to IN_PROGRESS, the reader is flagged unread and gets a SUPPORT notification), opening it
// clearing the flag, resolving, a follow-up reopening it, and the review check (streak, throttle, tickets,
// unhappy feedback). Makes throw-away users (deleted at the end).

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import { localDateString, shiftDays, toDateColumn } from '../utils/date.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'support-e2e-device';
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
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'android', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204
  }
  return { status: res.status, json, data: json?.data, meta: json?.meta };
}

async function makeUser(slug, tag) {
  const role = await prisma.role.findUnique({ where: { slug } });
  const email = `support-e2e-${tag}@example.com`;
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({ data: { email, name: `Support ${tag}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `support-e2e-${tag}` } });
}

async function tokenFor(user) {
  const { accessToken } = await authService.issueSession(user, DEVICE);
  return accessToken;
}

async function main() {
  console.log('\nSupport and feedback\n');
  const reader = await makeUser('user', 'reader');
  const other = await makeUser('user', 'other');
  const admin = await makeUser('admin', 'admin');
  const [r, o, a] = await Promise.all([tokenFor(reader), tokenFor(other), tokenFor(admin)]);

  try {
    console.log('Gate');
    check('reader cannot open the admin inbox', (await call('GET', '/api/admin/support/tickets', { token: r })).status === 403);
    check('admin can', (await call('GET', '/api/admin/support/tickets', { token: a })).status === 200);

    console.log('Raising');
    const fresh = await call('GET', '/api/app/support/review-check?trigger=session', { token: r });
    check('a brand new reader is not asked yet', fresh.data?.ask === false, fresh.data?.reason);

    const t = await call('POST', '/api/app/support/tickets', { token: r, body: { kind: 'TICKET', category: 'bug', message: 'The counter froze', deviceInfo: { deviceModel: 'Pixel', appVersion: '1.0.0+1' } } });
    check('ticket created', t.status === 201 && t.data?.status === 'OPEN', JSON.stringify(t.json).slice(0, 120));
    const ticketId = t.data?.id;
    const empty = await call('POST', '/api/app/support/tickets', { token: r, body: { kind: 'TICKET', category: 'bug', message: '' } });
    check('an empty ticket is refused', empty.status === 400);
    const noRating = await call('POST', '/api/app/support/tickets', { token: r, body: { kind: 'FEEDBACK', category: 'suggestion' } });
    check('feedback needs a rating', noRating.status === 400);
    const f = await call('POST', '/api/app/support/tickets', { token: r, body: { kind: 'FEEDBACK', category: 'suggestion', rating: 2, message: 'Too slow' } });
    check('feedback created', f.status === 201 && f.data?.rating === 2);

    const mine = await call('GET', '/api/app/support/tickets', { token: r });
    check('reader sees both of theirs', mine.data?.length === 2 && mine.data.every((x) => typeof x.preview === 'string'));
    check('another reader sees none', (await call('GET', '/api/app/support/tickets', { token: o })).data?.length === 0);
    check('another reader cannot open it', (await call('GET', `/api/app/support/tickets/${ticketId}`, { token: o })).status === 404);

    console.log('Staff side');
    const list = await call('GET', '/api/admin/support/tickets?status=OPEN&kind=TICKET', { token: a });
    check('admin filters by status and kind', list.data?.some((x) => x.id === ticketId) && list.data.every((x) => x.kind === 'TICKET'));
    check('unhappy feedback filter', (await call('GET', '/api/admin/support/tickets?maxRating=2', { token: a })).data?.every((x) => x.rating <= 2));
    const detail = await call('GET', `/api/admin/support/tickets/${ticketId}`, { token: a });
    check('admin sees the sender and device', detail.data?.user?.email === reader.email && detail.data?.deviceInfo?.deviceModel === 'Pixel');

    const reply = await call('POST', `/api/admin/support/tickets/${ticketId}/messages`, { token: a, body: { body: 'Please update to the latest version.' } });
    check('staff reply saved', reply.status === 201);
    const after = await call('GET', `/api/admin/support/tickets/${ticketId}`, { token: a });
    check('status moved to in progress', after.data?.status === 'IN_PROGRESS');
    const note = await prisma.notification.findFirst({ where: { userId: reader.id, type: 'SUPPORT' } });
    check('reader got a SUPPORT notification with the ticket link', note?.data?.deeplink === `hariharibol://ticket?id=${ticketId}`);
    check('unread count is 1', (await call('GET', '/api/app/support/unread', { token: r })).data?.count === 1);
    const opened = await call('GET', `/api/app/support/tickets/${ticketId}`, { token: r });
    check('reader sees the reply, oldest first', opened.data?.messages?.length === 2 && opened.data.messages[1].fromStaff === true);
    check('opening cleared the unread flag', (await call('GET', '/api/app/support/unread', { token: r })).data?.count === 0);

    const resolved = await call('PATCH', `/api/admin/support/tickets/${ticketId}`, { token: a, body: { status: 'RESOLVED' } });
    check('resolved with a time', resolved.data?.status === 'RESOLVED' && !!resolved.data?.resolvedAt);
    const followUp = await call('POST', `/api/app/support/tickets/${ticketId}/messages`, { token: r, body: { body: 'Still happening' } });
    check('follow-up saved', followUp.status === 201);
    check('and reopens the ticket', (await call('GET', `/api/admin/support/tickets/${ticketId}`, { token: a })).data?.status === 'OPEN');
    const summary = await call('GET', '/api/admin/support/summary', { token: a });
    check('summary counts', summary.data?.open >= 1 && summary.data?.feedback >= 1);

    console.log('Rating prompt');
    // A reader with a seven day streak, no tickets and no earlier prompts is asked.
    const fan = await makeUser('user', 'fan');
    const fanToken = await tokenFor(fan);
    const today = localDateString(fan.timezone || 'Asia/Kolkata');
    for (let i = 0; i < 7; i += 1) {
      await prisma.sadhanaDay.create({ data: { userId: fan.id, date: toDateColumn(shiftDays(today, -i)), roundTarget: 16, roundsCompleted: 2 } });
    }
    const ask = await call('GET', '/api/app/support/review-check?trigger=streak', { token: fanToken });
    check('seven days of chanting: ask', ask.data?.ask === true && ask.data?.streak >= 7, JSON.stringify(ask.data));
    const short = await makeUser('user', 'short');
    const shortToken = await tokenFor(short);
    await prisma.sadhanaDay.create({ data: { userId: short.id, date: toDateColumn(today), roundTarget: 16, roundsCompleted: 2 } });
    check('one day is not a streak', (await call('GET', '/api/app/support/review-check?trigger=streak', { token: shortToken })).data?.ask === false);
    check('a reader who just wrote in is not asked', (await call('GET', '/api/app/support/review-check?trigger=streak', { token: r })).data?.ask === false);

    const shown = await call('POST', '/api/app/support/review-prompts', { token: fanToken, body: { trigger: 'streak', outcome: 'SHOWN' } });
    check('prompt recorded', shown.status === 201);
    const again = await call('GET', '/api/app/support/review-check?trigger=streak', { token: fanToken });
    check('and not asked again for three months', again.data?.ask === false && again.data?.reason === 'recently_asked');

    const dismissedOnly = await makeUser('user', 'dismissed');
    const dToken = await tokenFor(dismissedOnly);
    for (let i = 0; i < 7; i += 1) {
      await prisma.sadhanaDay.create({ data: { userId: dismissedOnly.id, date: toDateColumn(shiftDays(today, -i)), roundTarget: 16, roundsCompleted: 1 } });
    }
    await call('POST', '/api/app/support/review-prompts', { token: dToken, body: { trigger: 'streak', outcome: 'DISMISSED' } });
    check('a dismissed pre-prompt does not start the quiet period', (await call('GET', '/api/app/support/review-check?trigger=streak', { token: dToken })).data?.ask === true);

    await prisma.supportTicket.deleteMany({ where: { userId: { in: [fan.id] } } });
    const unhappy = await call('POST', '/api/app/support/tickets', { token: fanToken, body: { kind: 'FEEDBACK', category: 'suggestion', rating: 1 } });
    await prisma.supportTicket.update({ where: { id: unhappy.data.id }, data: { createdAt: new Date(Date.now() - 100 * 24 * 60 * 60 * 1000) } });
    await prisma.reviewPrompt.deleteMany({ where: { userId: fan.id } });
    check('old unhappy feedback still keeps the prompt away', (await call('GET', '/api/app/support/review-check?trigger=streak', { token: fanToken })).data?.reason === 'unhappy_feedback');
  } finally {
    await prisma.user.deleteMany({ where: { email: { startsWith: 'support-e2e-' } } });
    await prisma.$disconnect();
    redis.disconnect();
  }
  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
