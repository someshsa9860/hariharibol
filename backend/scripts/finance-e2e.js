// Walks the super admin's finance section over real HTTP against a running API, then the month-end reminder:
//
//   npm run dev    (another terminal)
//   npm run test:finance
//
// Checks who may use it, a month's revenue (gross, commission, net, a free trial that adds nothing, a refund,
// a foreign-currency payment already in INR), AI cost in rupees at a stored rate, credits and debits, profit,
// confirming a month fixing its rate, and the reminder going out once a day. Makes throw-away users, payments,
// AI log rows and entries (all deleted at the end). Uses 2025-03, a month nothing else touches.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import * as authService from '../services/auth.js';
import financeRemind from '../jobs/processors/finance-remind.js';
import * as finance from '../services/finance.js';
import { localDateString } from '../utils/date.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const DEVICE = 'finance-e2e-device';
const MONTH = '2025-03';
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
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try {
    json = await res.json();
  } catch {
    // 204
  }
  return { status: res.status, json };
}

async function makeUser(slug, tag) {
  const role = await prisma.role.findUnique({ where: { slug } });
  const email = `finance-e2e-${tag}@example.com`;
  await prisma.user.deleteMany({ where: { email } });
  return prisma.user.create({ data: { email, name: `Finance ${tag}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `finance-e2e-${tag}` } });
}

const pay = (userId, n, extra) =>
  prisma.payment.create({
    data: { userId, provider: 'GOOGLE_PLAY', purpose: 'SUBSCRIPTION', externalId: `finance-e2e-${n}`, status: 'SUCCEEDED', currency: 'INR', amountMinor: 0, ...extra },
  });

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }
  const owner = await makeUser('super_admin', 'owner');
  const admin = await makeUser('admin', 'admin');
  const payer = await makeUser('user', 'payer');
  const oldRate = await finance.currentRate();

  try {
    await redis.del(`rl:write:${owner.id}`, `rl:read:${owner.id}`, `rl:write:${admin.id}`, `rl:read:${admin.id}`);
    const { accessToken: token } = await authService.issueSession(owner, DEVICE);
    const { accessToken: adminToken } = await authService.issueSession(admin, DEVICE);

    console.log('\n1. Who may see the books');
    check('an admin is refused', (await call('GET', `/api/admin/finance/months/${MONTH}`, { token: adminToken })).status === 403);
    check('no sign-in is refused', [401, 403].includes((await call('GET', `/api/admin/finance/months/${MONTH}`)).status));
    check('the super admin is let in', (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).status === 200);
    const badMonth = await call('GET', '/api/admin/finance/months/2025-13', { token });
    check('a bad month is a 400', badMonth.status === 400);

    console.log('\n2. Revenue');
    // ₹100 sold in INR: store keeps ₹15. $2 sold abroad = ₹170 gross, ₹25.5 commission.
    await pay(payer.id, 1, { paidAt: new Date('2025-03-10T06:00:00Z'), grossInrMinor: 10000, commissionInrMinor: 1500, netInrMinor: 8500, amountMinor: 10000 });
    await pay(payer.id, 2, { paidAt: new Date('2025-03-12T06:00:00Z'), currency: 'USD', amountMinor: 200, grossInrMinor: 17000, commissionInrMinor: 2550, netInrMinor: 14450 });
    await pay(payer.id, 3, { paidAt: new Date('2025-03-14T06:00:00Z'), isTrial: true, grossInrMinor: 0, commissionInrMinor: 0, netInrMinor: 0 });
    // Paid on 31 March 20:00 UTC = 1 April in India, so it is April's.
    await pay(payer.id, 4, { paidAt: new Date('2025-03-31T20:00:00Z'), grossInrMinor: 5000, commissionInrMinor: 750, netInrMinor: 4250 });
    // Paid in February, refunded in March: comes off March.
    await pay(payer.id, 5, { status: 'REFUNDED', paidAt: new Date('2025-02-20T06:00:00Z'), refundedAt: new Date('2025-03-05T06:00:00Z'), grossInrMinor: 20000, commissionInrMinor: 3000, netInrMinor: 17000 });
    await pay(payer.id, 6, { paidAt: new Date('2025-03-20T06:00:00Z'), currency: 'EUR', amountMinor: 300 }); // rate not fetched yet

    let m = (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).json.data;
    check('gross = 100 + 170 - the refunded 200 (in paise)', m.revenue.grossInr === 10000 + 17000 - 20000, String(m.revenue.grossInr));
    check('commission = 15 + 25.5 - 30', m.revenue.commissionInr === 1500 + 2550 - 3000, String(m.revenue.commissionInr));
    check('net = 85 + 144.5 - 170', m.revenue.netInr === 8500 + 14450 - 17000, String(m.revenue.netInr));
    check('gross - commission = net', m.revenue.grossInr - m.revenue.commissionInr === m.revenue.netInr);
    check('the free trial adds nothing and is counted', m.revenue.freeTrials === 1);
    check('the 1 April (IST) payment is not in March', m.revenue.paymentCount === 3, String(m.revenue.paymentCount));
    check('the payment awaiting its rupee value is flagged', m.revenue.unconvertedPayments === 1);
    const april = (await call('GET', '/api/admin/finance/months/2025-04', { token })).json.data;
    check('it is April’s', april.revenue.netInr === 4250, String(april.revenue.netInr));

    console.log('\n3. AI cost in rupees');
    const rate = (await call('PUT', '/api/admin/finance/rate', { token, body: { rate: 80 } }));
    check('the rate is set', rate.status === 200);
    const log = (operation, costMicros) =>
      prisma.aiUsageLog.create({ data: { provider: 'OPENAI', model: 'finance-e2e', operation, costMicros, createdAt: new Date('2025-03-15T06:00:00Z') } });
    await log('chat.reply', 2_000_000); // $2
    await log('chat.summary', 500_000); // $0.50
    await log('translation', 4_000_000); // $4
    await log('scenes.write', 1_000_000); // $1
    await log('verse.explanation', 500_000); // $0.50
    m = (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).json.data;
    check('$8 at ₹80 is ₹640', m.ai.costInr === 64000, String(m.ai.costInr));
    const group = (name) => m.ai.groups.find((g) => g.name === name);
    check('Ask Sakha $2.50 → ₹200', group('Ask Sakha')?.costInr === 20000);
    check('Translations $4 → ₹320', group('Translations')?.costInr === 32000);
    check('Scenes $1 → ₹80', group('Scenes (Gemini)')?.costInr === 8000);

    console.log('\n4. Credits and debits');
    const add = (body) => call('POST', '/api/admin/finance/entries', { token, body });
    const ad = await add({ direction: 'DEBIT', category: 'advertising', amount: 1500.5, date: '2025-03-03', note: 'Instagram' });
    check('a debit is made', ad.status === 201 && ad.json.data.amountInr === 150050, JSON.stringify(ad.json?.data));
    await add({ direction: 'DEBIT', category: 'salary', amount: 5000, date: '2025-03-31' });
    await add({ direction: 'CREDIT', category: 'other', amount: 250, date: '2025-03-20' });
    await add({ direction: 'DEBIT', category: 'purchase', amount: 999, date: '2025-04-01' }); // April
    check('a bad category is refused', (await add({ direction: 'DEBIT', category: 'nope', amount: 1, date: '2025-03-03' })).status === 400);
    check('a zero amount is refused', (await add({ direction: 'DEBIT', category: 'other', amount: 0, date: '2025-03-03' })).status === 400);
    m = (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).json.data;
    check('debits = 1500.50 + 5000 (31 March counts)', m.manual.debitInr === 150050 + 500000, String(m.manual.debitInr));
    check('credits = 250', m.manual.creditInr === 25000);
    const expected = m.revenue.netInr + 25000 - (64000 + 650050);
    check('profit = net + credits - AI - debits', m.profitInr === expected, `${m.profitInr} vs ${expected}`);

    const list = await call('GET', `/api/admin/finance/entries?month=${MONTH}&direction=DEBIT`, { token });
    check('the ledger lists March’s debits only', list.json.data.length === 2, String(list.json.data.length));
    const edit = await call('PATCH', `/api/admin/finance/entries/${ad.json.data.id}`, { token, body: { amount: 2000 } });
    check('an entry can be edited', edit.status === 200 && edit.json.data.amountInr === 200000);
    const del = await call('DELETE', `/api/admin/finance/entries/${ad.json.data.id}`, { token });
    check('an entry can be deleted', del.status === 204);
    check('the audit log has it', (await prisma.auditLog.count({ where: { action: 'finance.entry.delete', entityId: ad.json.data.id } })) === 1);

    console.log('\n5. Confirming a month');
    const early = await call('POST', `/api/admin/finance/months/${finance.currentMonth()}/confirm`, { token });
    check('the running month cannot be confirmed early', finance.daysLeftInMonth() <= 2 || early.status === 400);
    const pendingBefore = (await call('GET', '/api/admin/finance/overview', { token })).json.data;
    check('overview has twelve months', pendingBefore.trend.length === 12);
    const conf = await call('POST', `/api/admin/finance/months/${MONTH}/confirm`, { token });
    check('a past month is confirmed', conf.status === 200 && conf.json.data.confirmed === true);
    await call('PUT', '/api/admin/finance/rate', { token, body: { rate: 100 } });
    m = (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).json.data;
    check('a confirmed month keeps its rate when the rate changes', m.ai.usdInrRate === 80 && m.ai.costInr === 64000, String(m.ai.usdInrRate));
    const reopened = await call('DELETE', `/api/admin/finance/months/${MONTH}/confirm`, { token });
    check('a month can be reopened', reopened.json.data.confirmed === false);
    m = (await call('GET', `/api/admin/finance/months/${MONTH}`, { token })).json.data;
    check('a reopened month follows the current rate', m.ai.usdInrRate === 100);

    console.log('\n6. The month-end reminder');
    const asked = (id) => prisma.notification.count({ where: { userId: id, title: { contains: 'costs' } } });
    const nov2 = new Date('2026-11-02T05:00:00Z'); // 2 November in India: October is still open
    await prisma.financeMonth.deleteMany({ where: { month: { in: ['2026-10', '2026-11'] } } });
    await prisma.notification.deleteMany({ where: { userId: owner.id } });
    const first = await financeRemind(null, nov2);
    check('on 2 November the super admin is asked for October', first.month === '2026-10' && (await asked(owner.id)) === 1, JSON.stringify(first));
    await financeRemind(null, nov2);
    check('a second run the same day sends nothing', (await asked(owner.id)) === 1);
    check('an admin is not asked', (await asked(admin.id)) === 0);
    await financeRemind(null, new Date('2026-11-03T05:00:00Z'));
    check('the next day asks again', (await asked(owner.id)) === 2);
    await finance.confirmMonth('2026-10', owner.id);
    await prisma.financeMonth.update({ where: { month: '2026-10' }, data: { lastRemindedOn: null } });
    check('nothing is sent once the month is confirmed', (await financeRemind(null, new Date('2026-11-04T05:00:00Z'))).reminded === 0);
    check('after the first week the panel banner is the only nudge', (await financeRemind(null, new Date('2026-11-12T05:00:00Z'))).reminded === 0);
    const pending = await finance.pendingMonths(new Date('2026-11-12T05:00:00Z'));
    check('the banner still lists the next month as pending only in its last days', pending.length === 0);
    const lastDay = new Date('2026-11-30T05:00:00Z');
    check('on the last day November is pending', (await finance.pendingMonths(lastDay)).includes('2026-11'));
    check('and the reminder asks for it', (await financeRemind(null, lastDay)).month === '2026-11');
    check('mid-month nothing is pending', (await finance.pendingMonths(new Date('2026-12-15T05:00:00Z'))).join() === '2026-11');

  } finally {
    await prisma.payment.deleteMany({ where: { externalId: { startsWith: 'finance-e2e-' } } });
    await prisma.aiUsageLog.deleteMany({ where: { model: 'finance-e2e' } });
    await prisma.financeEntry.deleteMany({ where: { createdById: owner.id } });
    await prisma.financeMonth.deleteMany({ where: { month: { in: [MONTH, '2026-10', '2026-11'] } } });
    await prisma.auditLog.deleteMany({ where: { actorId: owner.id } });
    await prisma.appSetting.update({ where: { key: 'finance.usd_inr_rate' }, data: { value: String(oldRate) } }).catch(() => null);
    await redis.del('setting:finance.usd_inr_rate').catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, admin.id, payer.id] } } });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
