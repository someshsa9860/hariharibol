// Three real browsers (headless Chromium, fake microphones) chant together through the website, the API and the
// websocket container — the one part the API test cannot see: that the WebRTC handshake really connects and audio flows.
//
//   Needs: the API (:4000), the websocket container (:4001) and the website (:3000, built with
//   NEXT_PUBLIC_API_BASE_URL=http://localhost:4000) running, and Playwright with Chromium installed.
//   PW_PATH=<path to the playwright package> node scripts/group-webrtc-e2e.mjs
//
// It makes three users and a group straight in the database, signs the browsers in by writing their sessions to
// localStorage, and deletes everything afterwards.

import { createRequire } from 'node:module';

import { prisma } from '../config/database.js';
import * as authService from '../services/auth.js';

const { chromium } = createRequire(import.meta.url)(process.env.PW_PATH || 'playwright');

const tag = `wrtc-${Date.now()}`;
const role = await prisma.role.findFirst({ where: { slug: 'user' } });
const mk = async (n) => {
  const u = await prisma.user.create({ data: { email: `${tag}-${n}@example.test`, name: n, authProvider: 'GOOGLE', providerUserId: `${tag}-${n}`, roleId: role.id } });
  const s = await authService.issueSession(u, `dev-${n}`);
  return { u, session: { accessToken: s.accessToken, refreshToken: s.refreshToken, user: { id: u.id, email: u.email, name: u.name, avatarUrl: null, readingLanguage: 'en' } } };
};
const a = await mk('Asha'), b = await mk('Bhanu'), c = await mk('Chitra');
const group = await prisma.chantGroup.create({ data: { name: 'WebRTC test', ownerId: a.u.id, members: { create: [
  { userId: a.u.id, role: 'OWNER', status: 'ACTIVE' }, { userId: b.u.id, status: 'ACTIVE' }, { userId: c.u.id, status: 'ACTIVE' } ] } } });

const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const open = async (who) => {
  const ctx = await browser.newContext({ permissions: ['microphone'] });
  await ctx.addInitScript((s) => localStorage.setItem('hhb.session', JSON.stringify(s)), who.session);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('pageerror', who.u.name, e.message));
  await page.goto(`http://localhost:3000/groups/${group.id}`);
  return page;
};
let ok = true;
const expect = (name, cond) => { console.log(cond ? 'PASS' : 'FAIL', name); if (!cond) ok = false; };
try {
  const pa = await open(a), pb = await open(b), pc = await open(c);
  await pa.getByRole('button', { name: /Start chanting together/ }).click();
  await pa.getByText('Chanting now').waitFor({ timeout: 10000 });
  expect('owner is in the room', true);

  // Members hear about it over the websocket, without a reload.
  await pb.getByRole('button', { name: /Join the chanting/ }).waitFor({ timeout: 10000 });
  expect('a member sees the room open live', true);
  await pb.getByRole('button', { name: /Join the chanting/ }).click();
  await pc.getByRole('button', { name: /Join the chanting/ }).click();

  const connected = async (page, n) => {
    await page.waitForFunction((k) => document.querySelectorAll('.live-people .member small').length >= k && [...document.querySelectorAll('.live-people .member')].filter((m) => m.textContent.includes('Chanting')).length >= k, n, { timeout: 20000 });
  };
  // Each sees "You" + two others, both connected.
  await connected(pa, 3); expect('owner is connected to both', true);
  await connected(pb, 3); expect('first member is connected to both', true);
  await connected(pc, 3); expect('second member is connected to both', true);

  // Audio really flows: each page has two remote audio elements with a live stream.
  const flowing = await pc.evaluate(() => [...document.querySelectorAll('.live-stage audio')].map((el) => el.srcObject ? el.srcObject.getTracks().map((t) => t.kind + ':' + t.readyState + ':' + t.muted).join(',') : 'null'));
  expect('remote audio streams are attached', flowing.length === 2 && flowing.every((n) => n.startsWith('audio:live')));

  await pb.getByRole('button', { name: 'Leave', exact: true }).click();
  await pa.waitForFunction(() => ![...document.querySelectorAll('.live-people .member')].some((m) => m.textContent.includes('Bhanu')), null, { timeout: 10000 });
  expect('when someone leaves the others drop them', true);

  await pa.getByRole('button', { name: /Mute/ }).click();
  expect('mute toggles', await pa.getByRole('button', { name: /Unmute/ }).count() === 1);

  pa.on('dialog', (d) => d.accept());
  await pa.getByRole('button', { name: /End for everyone/ }).click();
  await pc.getByRole('button', { name: /Join the chanting|Start/ }).waitFor({ state: 'detached', timeout: 10000 }).catch(() => {});
  await pc.waitForFunction(() => !document.querySelector('.live-people'), null, { timeout: 10000 });
  expect('ending closes the room for everyone', true);
} catch (e) { console.log('ERROR', e.message); ok = false; }
finally {
  await browser.close();
  await prisma.chantGroup.deleteMany({ where: { id: group.id } });
  await prisma.notification.deleteMany({ where: { userId: { in: [a.u.id, b.u.id, c.u.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [a.u.id, b.u.id, c.u.id] } } });
  await prisma.$disconnect();
}
process.exit(ok ? 0 : 1);
