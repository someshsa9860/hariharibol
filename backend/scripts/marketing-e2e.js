// Walks email marketing over real HTTP against this process's own copy of the API, with a fake mail server
// (nodemailer's jsonTransport) and a fake AI, so nothing leaves the machine:
//
//   npm run test:marketing      (needs Postgres and Redis, the migrations applied and `npm run seed`; the script sets
//                                MARKETING_WEBHOOK_SECRET=e2e-secret itself, because the API reads it when it loads)
//
// Checks the permission gate, a template (a bad block is refused, a good one saved, approved, previewed), a CSV import
// with its consent attestation, an audience of invitees plus readers, the pre-flight (no postal address → refused),
// a whole run (every recipient gets exactly one email in their own language, with the one-click unsubscribe headers),
// that running it again writes nobody twice, a tracked click (a person's counted, a scanner's marked), unsubscribe and
// resubscribe, a bounce through the webhook (suppressed, and left out of the next campaign), and the weekly cap.
// Makes throw-away users, lists and campaigns (deleted at the end).

import nodemailer from 'nodemailer';
import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import { SETTING_KEYS } from '../config/constants.js';
import * as authService from '../services/auth.js';
import * as settings from '../services/setting.js';
import * as mailer from '../services/marketing-mailer.js';
import * as consent from '../services/marketing-consent.js';

const { default: app } = await import('../app.js');
const { processRun } = await import('../jobs/processors/marketing.js');

// A stand-in for the BullMQ job: a pause that wants to try again later asks it to move itself, which we only record.
const jobFor = (row) => ({ id: row.jobId, data: { campaignId: row.id }, updateProgress: async () => {}, moveToDelayed: async (at) => { delayed.push(at); } });
const delayed = [];
const TAG = `mkt-e2e-${Date.now().toString(36)}`;
const DEVICE = 'marketing-e2e-device';
let passed = 0;
let failed = 0;
let base = '';

function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

async function call(method, path, { token, body, headers } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'content-type': 'application/json', 'x-device-id': DEVICE, 'x-platform': 'android', ...(token ? { authorization: `Bearer ${token}` } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json, data: json?.data };
}

async function makeUser(roleSlug, tag, extra = {}) {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  const email = `${TAG}-${tag}@example.com`;
  return prisma.user.create({ data: { email, name: `Mkt ${tag}`, roleId: role.id, authProvider: 'GOOGLE', providerUserId: `${TAG}-${tag}`, ...extra } });
}
const tokenFor = async (user) => (await authService.issueSession(user, DEVICE)).accessToken;

mailer.useTransport(nodemailer.createTransport({ jsonTransport: true }));

async function main() {
  console.log('\nMarketing email\n');
  const server = app.listen(0);
  base = `http://127.0.0.1:${server.address().port}`;

  const keepPostal = await settings.get(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, '');
  const keepWeekly = await settings.get(SETTING_KEYS.MARKETING_WEEKLY_CAP, '');
  await settings.set(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, '');

  const admin = await makeUser('super_admin', 'admin', { countryCode: 'ZY' });
  const readerEn = await makeUser('user', 'en', { countryCode: 'ZZ', readingLanguage: 'en' });
  const readerHi = await makeUser('user', 'hi', { countryCode: 'ZZ', readingLanguage: 'hi' });
  const plain = await makeUser('user', 'plain', { countryCode: 'ZY' });
  const [a, r] = await Promise.all([tokenFor(admin), tokenFor(plain)]);
  const made = { templates: [], lists: [], campaigns: [] };

  try {
    console.log('Gate');
    check('a reader cannot open Marketing', (await call('GET', '/api/admin/marketing/overview', { token: r })).status === 403);
    check('the super admin can', (await call('GET', '/api/admin/marketing/overview', { token: a })).status === 200);
    const overview = (await call('GET', '/api/admin/marketing/overview', { token: a })).data;
    check('the overview says what is missing before a send', overview?.setup?.postalAddress === null && overview?.setup?.email?.configured === true);

    console.log('Template');
    const tpl = (await call('POST', '/api/admin/marketing/templates', { token: a, body: { name: `${TAG} template`, brief: 'A hello' } })).data;
    made.templates.push(tpl.id);
    const bad = await call('PUT', `/api/admin/marketing/templates/${tpl.id}/variants/en`, { token: a, body: { subject: 'Hi {{password}}', blocks: [{ type: 'paragraph', text: 'x' }] } });
    check('a made-up merge field is refused with the reason', bad.status === 422 && /not a merge field/.test(bad.json?.error?.message ?? ''), bad.json?.error?.message);
    const words = { subject: 'Hari Bol {{firstName|friend}}', preheader: 'pre', blocks: [{ type: 'heading', text: '{{greeting}}' }, { type: 'paragraph', text: '<script>alert(1)</script> Chant today' }, { type: 'button', label: 'Open', link: 1 }] };
    check('English saved', (await call('PUT', `/api/admin/marketing/templates/${tpl.id}/variants/en`, { token: a, body: words })).status === 200);
    check('Hindi saved', (await call('PUT', `/api/admin/marketing/templates/${tpl.id}/variants/hi`, { token: a, body: { ...words, subject: 'हरि बोल {{firstName|मित्र}}' } })).status === 200);
    const prev = await call('POST', '/api/admin/marketing/templates/preview', { token: a, body: { ...words, language: 'en' } });
    check('the preview escapes markup', prev.status === 200 && !/<script>alert/.test(prev.data.html) && /&lt;script&gt;/.test(prev.data.html));
    check('a draft is not sent: English approves', (await call('POST', `/api/admin/marketing/templates/${tpl.id}/variants/en/approve`, { token: a })).status === 200);
    check('Hindi approves', (await call('POST', `/api/admin/marketing/templates/${tpl.id}/variants/hi/approve`, { token: a })).status === 200);

    console.log('Invitees');
    const list = (await call('POST', '/api/admin/marketing/lists', { token: a, body: { name: `${TAG} list` } })).data;
    made.lists.push(list.id);
    const rows = [
      { email: `${TAG}-c1@example.com`, name: 'Contact One', language: 'en' }, { email: `${TAG}-c2@example.com`, name: 'Contact Two' }, { email: `${TAG}-c3@example.com` },
      { email: 'not-an-address' }, { email: `${TAG}-c1@example.com` }, { email: readerEn.email },
    ];
    const noAttest = await call('POST', '/api/admin/marketing/contacts/import', { token: a, body: { listId: list.id, rows, attestation: '', attestsEmail: true } });
    check('an import without an attestation is refused', noAttest.status >= 400 && noAttest.status < 500, String(noAttest.status));
    const imp = await call('POST', '/api/admin/marketing/contacts/import', { token: a, body: { listId: list.id, rows, attestation: 'E2E sign-up sheet, confirmed by the test', attestsEmail: true } });
    check('three new invitees added', imp.status === 200 && imp.data?.totals?.added === 3, JSON.stringify(imp.data?.totals));
    const listNow = (await call('GET', '/api/admin/marketing/lists', { token: a })).data.find((l) => l.id === list.id);
    check('the list counts three', listNow?.memberCount === 3);

    console.log('Campaign');
    const campaign = (await call('POST', '/api/admin/marketing/campaigns', {
      token: a,
      body: { name: `${TAG} one`, templateId: tpl.id, audience: { users: { countries: ['ZZ'] }, lists: [list.id] }, links: [{ position: 1, kind: 'WEB', target: 'https://hariharibol.com/plans' }] },
    })).data;
    made.campaigns.push(campaign.id);
    const est = await call('POST', '/api/admin/marketing/estimate', { token: a, body: { audience: campaign.audience, templateId: tpl.id } });
    check('the estimate counts two readers and three invitees', est.data?.total === 5, JSON.stringify(est.data && { total: est.data.total }));
    const noPostal = await call('POST', `/api/admin/marketing/campaigns/${campaign.id}/start`, { token: a });
    check('it will not start without a postal address', noPostal.status === 422 && /postal/i.test(noPostal.json?.error?.message ?? ''));
    await settings.set(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, '1 Temple Road, Vrindavan, India');

    const started = await call('POST', `/api/admin/marketing/campaigns/${campaign.id}/start`, { token: a });
    check('start queues it', started.status === 200 && started.data?.status === 'QUEUED', started.json?.error?.message);

    console.log('The run');
    const row = await prisma.marketingCampaign.findUnique({ where: { id: campaign.id } });
    const result = await processRun(jobFor(row), 'token').catch((e) => (e.name === 'DelayedError' ? { delayed: true } : Promise.reject(e)));
    const done = await prisma.marketingCampaign.findUnique({ where: { id: campaign.id } });
    if (process.env.E2E_DEBUG) console.log('   state:', done.status, done.pauseReason, done.statusMessage, 'sent', done.sent, 'failed', done.failed, 'skipped', done.skipped);
    if (process.env.E2E_DEBUG) console.log('   statuses:', JSON.stringify(await prisma.marketingDelivery.groupBy({ by: ['status', 'skipReason', 'error'], where: { campaignId: campaign.id }, _count: { _all: true } })));
    check('the run completes', done.status === 'COMPLETED', `${done.status} ${done.statusMessage ?? ''} ${JSON.stringify(result)}`);
    check('five were sent, none failed', done.sent === 5 && done.failed === 0, `sent ${done.sent} failed ${done.failed}`);
    const deliveries = await prisma.marketingDelivery.findMany({ where: { campaignId: campaign.id }, include: { user: { select: { email: true } }, contact: { select: { email: true } } } });
    check('one delivery each, no duplicates', deliveries.length === 5 && new Set(deliveries.map((d) => d.code)).size === 5);
    const hi = deliveries.find((d) => d.user?.email === readerHi.email);
    const en = deliveries.find((d) => d.user?.email === readerEn.email);
    check('the Hindi reader got the Hindi email', hi?.language === 'hi' && /हरि बोल/.test(hi?.subject ?? ''), `${hi?.language} ${hi?.subject}`);
    check('the English reader got English', en?.language === 'en');
    check('every delivery was sent once', deliveries.every((d) => d.status === 'SENT' && d.sentAt));

    const again = await processRun(jobFor(row), 'token');
    check('running it again writes nobody twice', again?.skipped === 'completed' && (await prisma.marketingDelivery.count({ where: { campaignId: campaign.id } })) === 5, JSON.stringify(again));

    console.log('Clicks');
    const code = en.code;
    const person = await call('GET', `/api/web/marketing/click/${code}/1`, { headers: { 'x-client-user-agent': 'Mozilla/5.0 (Linux; Android 14) Chrome/120 Mobile Safari/537.36' } });
    check('a tap says where to go, with utm values', person.status === 200 && /^https:\/\/hariharibol\.com\/plans/.test(person.data?.url) && /utm_campaign=/.test(person.data.url), person.data?.url);
    const bot = await call('GET', `/api/web/marketing/click/${hi.code}/1`, { headers: { 'x-client-user-agent': 'Mozilla/5.0 (compatible; Proofpoint)' } });
    check('a scanner’s tap is answered but marked', bot.status === 200 && (await prisma.marketingClick.count({ where: { deliveryId: hi.id, isBot: true } })) === 1);
    check('only the person counts as a click', (await prisma.marketingDelivery.findUnique({ where: { id: en.id } })).clickedAt !== null && (await prisma.marketingDelivery.findUnique({ where: { id: hi.id } })).clickedAt === null);
    check('a code we never made is a 404', (await call('GET', '/api/web/marketing/click/ZZZZZZZZZZZZZZZZ/1')).status === 404);
    const pixel = await fetch(`${base}/api/web/marketing/open/${code}`);
    check('the open picture is a gif and records the open', pixel.status === 200 && pixel.headers.get('content-type') === 'image/gif' && (await prisma.marketingDelivery.findUnique({ where: { id: en.id } })).openedAt !== null);

    console.log('Unsubscribe');
    const un = await call('POST', `/api/web/marketing/unsubscribe/${hi.code}`);
    check('one click unsubscribes', un.status === 200 && un.data?.unsubscribed === true);
    check('it is on the do-not-send list', (await call('GET', `/api/admin/marketing/consent?email=${encodeURIComponent(readerHi.email)}`, { token: a })).data?.suppressed === true);
    const pref = await prisma.marketingPreference.findUnique({ where: { userId: readerHi.id } });
    check('the reader’s preference is switched off', pref?.emailEnabled === false);
    check('and it can be undone', (await call('POST', `/api/web/marketing/resubscribe/${hi.code}`)).status === 200);
    await call('POST', `/api/web/marketing/unsubscribe/${hi.code}`);

    console.log('Bounce through the webhook');
    const c1 = deliveries.find((d) => d.contact?.email === `${TAG}-c1@example.com`);
    const hook = await call('POST', '/api/webhooks/marketing-email', { headers: { 'x-marketing-secret': 'e2e-secret' }, body: { type: 'bounce', email: c1.contact.email } });
    check('a hard bounce is accepted', hook.status === 200, JSON.stringify(hook.json).slice(0, 120));
    check('a webhook with the wrong secret is refused', (await call('POST', '/api/webhooks/marketing-email', { headers: { 'x-marketing-secret': 'nope' }, body: { type: 'bounce', email: 'x@example.com' } })).status >= 400);
    check('the bounced address is blocked', (await call('GET', `/api/admin/marketing/consent?email=${encodeURIComponent(c1.contact.email)}`, { token: a })).data?.suppressed === true);

    console.log('A second campaign leaves them out');
    const second = (await call('POST', '/api/admin/marketing/campaigns/' + campaign.id + '/duplicate', { token: a })).data;
    made.campaigns.push(second.id);
    // Lift the weekly cap for this walk, so that what is left out is the blocked, not the busy.
    await settings.set(SETTING_KEYS.MARKETING_WEEKLY_CAP, 10);
    await call('POST', `/api/admin/marketing/campaigns/${second.id}/start`, { token: a });
    const row2 = await prisma.marketingCampaign.findUnique({ where: { id: second.id } });
    await processRun(jobFor(row2), 'token');
    const done2 = await prisma.marketingCampaign.findUnique({ where: { id: second.id } });
    check('the unsubscribed reader is not in the audience and the bounced invitee is skipped', done2.sent === 3 && done2.skipped === 1, `recipients ${done2.recipients} sent ${done2.sent} skipped ${done2.skipped}`);

    console.log('Weekly cap');
    await settings.set(SETTING_KEYS.MARKETING_WEEKLY_CAP, 1);
    const third = (await call('POST', '/api/admin/marketing/campaigns/' + campaign.id + '/duplicate', { token: a })).data;
    made.campaigns.push(third.id);
    await call('POST', `/api/admin/marketing/campaigns/${third.id}/start`, { token: a });
    const row3 = await prisma.marketingCampaign.findUnique({ where: { id: third.id } });
    await processRun(jobFor(row3), 'token');
    const done3 = await prisma.marketingDelivery.findMany({ where: { campaignId: third.id, status: 'SENT' } });
    check('nobody is written to a second time that week', done3.length === 0, `${done3.length} sent`);

    console.log('Detail');
    const detail = await call('GET', `/api/admin/marketing/campaigns/${campaign.id}`, { token: a });
    check('the detail shows the funnel', detail.data?.funnel?.sent === 5 && detail.data?.funnel?.clicked === 1, JSON.stringify(detail.data?.funnel));
  } finally {
    const ids = made.campaigns;
    await prisma.marketingCampaign.deleteMany({ where: { id: { in: ids } } }).catch((e) => console.log('cleanup campaigns:', e.message));
    await prisma.marketingContact.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await prisma.marketingList.deleteMany({ where: { id: { in: made.lists } } }).catch(() => {});
    await prisma.marketingTemplate.deleteMany({ where: { id: { in: made.templates } } }).catch(() => {});
    const blocked = [readerHi.email, `${TAG}-c1@example.com`].map((e) => consent.hashOf('EMAIL', e)).filter(Boolean);
    await prisma.marketingSuppression.deleteMany({ where: { hash: { in: blocked } } }).catch(() => {});
    await prisma.user.deleteMany({ where: { email: { startsWith: TAG } } }).catch(() => {});
    await settings.set(SETTING_KEYS.MARKETING_WEEKLY_CAP, keepWeekly || 2);
    await settings.set(SETTING_KEYS.MARKETING_POSTAL_ADDRESS, keepPostal || '');
    server.close();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
