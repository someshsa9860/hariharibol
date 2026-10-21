// Walks chanting groups and the live room over real HTTP against a running API:
//
//   npm run test:groups
//
// Four throwaway users: an owner, an admin the owner makes, a member and a stranger. Checks who
// may do what (only the owner deletes), that a private group is a 404 to a stranger, that the
// room hands out ICE servers and lists who is already in it, and that a handshake message is
// published to the right person — it listens on the same Redis channel the websocket container
// reads. The users are deleted at the end.

import { prisma } from '../config/database.js';
import { createClient, channels } from '../config/redis.js';
import * as authService from '../services/auth.js';

const BASE = process.env.API_BASE_URL || 'http://localhost:4000';
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'group-e2e-device', 'x-platform': 'ios' };
const API = '/api/app/groups';
const TAG = `group-e2e-${Date.now()}`;

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
  return { status: res.status, json, data: json?.data };
}

async function makeUser(label, roleId) {
  const user = await prisma.user.create({
    data: {
      email: `${TAG}-${label}@example.test`,
      name: label,
      authProvider: 'GOOGLE',
      providerUserId: `${TAG}-${label}`,
      roleId,
    },
  });
  const session = await authService.issueSession(user, 'group-e2e-device');
  return { user, token: session.accessToken, id: user.id, email: user.email };
}

async function main() {
  const health = await fetch(`${BASE}/health`).catch(() => null);
  if (!health?.ok) {
    console.error(`\nThe API is not answering on ${BASE}. Start it with \`npm run dev\` first.\n`);
    process.exit(1);
  }

  const role = await prisma.role.findFirst({ where: { slug: 'user' } });
  if (!role) {
    console.error('\nNo `user` role. Run `npm run seed` first.\n');
    process.exit(1);
  }
  const owner = await makeUser('owner', role.id);
  const admin = await makeUser('admin', role.id);
  const member = await makeUser('member', role.id);
  const stranger = await makeUser('stranger', role.id);

  // Everything the websocket container would be asked to send, by user.
  const sent = [];
  const sub = createClient();
  await sub.subscribe(channels.userEvent);
  sub.on('message', (_channel, raw) => sent.push(JSON.parse(raw)));
  const events = (userId, event) => sent.filter((m) => m.userId === userId && m.event === event);
  const settle = () => new Promise((resolve) => setTimeout(resolve, 250));

  try {
    console.log('\n1. Making a group');
    const made = await call('POST', API, { token: owner.token, body: { name: 'Morning Japa', description: 'Before sunrise' } });
    check('a group is made', made.status === 201, `HTTP ${made.status} ${JSON.stringify(made.json?.error ?? '')}`);
    const id = made.data?.id;
    check('the maker is its owner', made.data?.myRole === 'OWNER' && made.data?.ownerId === owner.id);
    check('a name that is too short is refused', (await call('POST', API, { token: owner.token, body: { name: 'x' } })).status === 400);
    check('signing in is required', (await call('POST', API, { body: { name: 'Nope nope' } })).status === 403);

    console.log('\n2. A private group is invisible to strangers');
    check('a stranger cannot read it', (await call('GET', `${API}/${id}`, stranger)).status === 404);
    check('a stranger cannot start its room', (await call('POST', `${API}/${id}/live/start`, stranger)).status === 404);
    check('a stranger does not see it listed', (await call('GET', API, stranger)).data?.groups?.length === 0);

    console.log('\n3. Inviting');
    check('a stranger cannot invite', (await call('POST', `${API}/${id}/invite`, { ...stranger, body: { email: member.email } })).status === 404);
    const inv = await call('POST', `${API}/${id}/invite`, { ...owner, body: { email: admin.email.toUpperCase() } });
    check('the owner invites by email, whatever the letter case', inv.status === 201, `HTTP ${inv.status}`);
    check('an email nobody has is a 404', (await call('POST', `${API}/${id}/invite`, { ...owner, body: { email: 'nobody@example.test' } })).status === 404);
    await settle();
    check('the invited person is told over the websocket', events(admin.id, 'group.invited').length === 1);
    const pending = await call('GET', API, admin);
    check('the invitation is listed, the group is not yet', pending.data?.invitations?.length === 1 && pending.data.groups.length === 0);
    check('an invited person cannot read the group yet', (await call('GET', `${API}/${id}`, admin)).status === 404);
    check('accepting makes them a member', (await call('POST', `${API}/${id}/accept`, admin)).data?.myRole === 'MEMBER');
    check('accepting twice finds no invitation', (await call('POST', `${API}/${id}/accept`, admin)).status === 404);

    console.log('\n4. Admins');
    check('an ordinary member cannot invite', (await call('POST', `${API}/${id}/invite`, { ...admin, body: { email: member.email } })).status === 403);
    const promote = await call('PUT', `${API}/${id}/members/${admin.id}/role`, { ...owner, body: { role: 'ADMIN' } });
    check('the owner makes a member an admin', promote.status === 200 && promote.data?.role === 'ADMIN');
    check('the new admin can invite', (await call('POST', `${API}/${id}/invite`, { ...admin, body: { email: member.email } })).status === 201);
    check('the new member accepts', (await call('POST', `${API}/${id}/accept`, member)).status === 200);
    const makeAdminByAdmin = await call('PUT', `${API}/${id}/members/${member.id}/role`, { ...admin, body: { role: 'ADMIN' } });
    check('an admin can make another admin', makeAdminByAdmin.status === 200);
    check('but an admin cannot take admin away', (await call('PUT', `${API}/${id}/members/${member.id}/role`, { ...admin, body: { role: 'MEMBER' } })).status === 403);
    check('the owner can', (await call('PUT', `${API}/${id}/members/${member.id}/role`, { ...owner, body: { role: 'MEMBER' } })).status === 200);
    check('nobody changes the owner’s role', (await call('PUT', `${API}/${id}/members/${owner.id}/role`, { ...admin, body: { role: 'MEMBER' } })).status === 403);
    const detail = await call('GET', `${API}/${id}`, member);
    check('members see everyone with their roles', detail.data?.members?.length === 3 && detail.data.memberCount === 3);

    console.log('\n5. Only the owner deletes');
    check('an admin cannot delete the group', (await call('DELETE', `${API}/${id}`, admin)).status === 403);
    check('a member cannot', (await call('DELETE', `${API}/${id}`, member)).status === 403);
    check('the owner cannot leave', (await call('POST', `${API}/${id}/leave`, owner)).status === 409);
    check('an admin cannot remove the owner', (await call('DELETE', `${API}/${id}/members/${owner.id}`, admin)).status === 403);
    check('the group is still there', (await call('GET', `${API}/${id}`, owner)).status === 200);

    console.log('\n6. The live room');
    check('a member cannot start the room', (await call('POST', `${API}/${id}/live/start`, member)).status === 403);
    check('joining before it opens is 410', (await call('POST', `${API}/${id}/live/join`, member)).status === 410);
    sent.length = 0;
    const start = await call('POST', `${API}/${id}/live/start`, owner);
    check('an admin opens the room', start.status === 200 && start.data?.sessionId, `HTTP ${start.status}`);
    check('it hands out ICE servers', Array.isArray(start.data?.iceServers) && start.data.iceServers.length > 0);
    check('nobody is in it yet but the starter', start.data?.participants?.length === 0);
    await settle();
    check('members are told it is live', events(admin.id, 'group.live').length === 1 && events(member.id, 'group.live').length === 1);
    check('the starter is not', events(owner.id, 'group.live').length === 0);

    const joinAdmin = await call('POST', `${API}/${id}/live/join`, admin);
    check('a member joins', joinAdmin.status === 200 && joinAdmin.data?.participants?.length === 1 && joinAdmin.data.participants[0].id === owner.id);
    const joinMember = await call('POST', `${API}/${id}/live/join`, member);
    check('the next one is told of both', joinMember.data?.participants?.length === 2);
    await settle();
    check('the people already there hear of each arrival', events(owner.id, 'group.participant').filter((m) => m.payload.joined).length === 2);
    check('a stranger cannot join', (await call('POST', `${API}/${id}/live/join`, stranger)).status === 404);

    console.log('\n7. The handshake');
    sent.length = 0;
    const offer = await call('POST', `${API}/${id}/live/signal`, { ...member, body: { to: owner.id, kind: 'offer', data: { sdp: 'v=0' } } });
    check('an offer is accepted', offer.status === 204, `HTTP ${offer.status}`);
    await settle();
    const got = events(owner.id, 'group.signal')[0]?.payload;
    check('and published to the person it is for', got?.from === member.id && got.kind === 'offer' && got.data.sdp === 'v=0' && got.groupId === id);
    check('nobody else is sent it', events(admin.id, 'group.signal').length === 0);
    check('a stranger cannot signal', (await call('POST', `${API}/${id}/live/signal`, { ...stranger, body: { to: owner.id, kind: 'offer', data: {} } })).status === 404);
    check('nor can one signal someone outside the room', (await call('POST', `${API}/${id}/live/signal`, { ...member, body: { to: stranger.id, kind: 'offer', data: {} } })).status === 404);
    check('or oneself', (await call('POST', `${API}/${id}/live/signal`, { ...member, body: { to: member.id, kind: 'offer', data: {} } })).status === 404);
    check('an unknown kind is refused', (await call('POST', `${API}/${id}/live/signal`, { ...member, body: { to: owner.id, kind: 'shout', data: {} } })).status === 400);

    console.log('\n8. Leaving, staleness, ending');
    check('the heartbeat says the room is open', (await call('POST', `${API}/${id}/live/heartbeat`, member)).data?.open === true);
    sent.length = 0;
    check('a member leaves the room', (await call('POST', `${API}/${id}/live/leave`, member)).status === 204);
    await settle();
    check('the others hear it', events(owner.id, 'group.participant').some((m) => m.payload.joined === false && m.payload.userId === member.id));
    // A phone that died: only its heartbeat is old.
    await prisma.chantGroupParticipant.updateMany({ where: { userId: admin.id }, data: { lastSeenAt: new Date(Date.now() - 5 * 60 * 1000) } });
    const live = await call('GET', `${API}/${id}/live`, owner);
    check('a silent phone no longer counts', live.data?.live?.participants?.length === 1);
    check('a member cannot end the room', (await call('POST', `${API}/${id}/live/end`, member)).status === 403);
    check('an admin ends it for everyone', (await call('POST', `${API}/${id}/live/end`, admin)).status === 204);
    check('nobody is live afterwards', (await call('GET', `${API}/${id}/live`, owner)).data?.live === null);
    check('a new room can be opened', (await call('POST', `${API}/${id}/live/start`, admin)).status === 200);
    await call('POST', `${API}/${id}/live/leave`, admin);
    check('the last to leave closes the room', (await call('GET', `${API}/${id}/live`, owner)).data?.live === null);

    console.log('\n9. Removing');
    check('an admin removes a member', (await call('DELETE', `${API}/${id}/members/${member.id}`, admin)).status === 204);
    check('who then cannot see the group', (await call('GET', `${API}/${id}`, member)).status === 404);
    check('an admin cannot remove an admin', (await call('DELETE', `${API}/${id}/members/${owner.id}`, admin)).status === 403);
    check('an admin leaves', (await call('POST', `${API}/${id}/leave`, admin)).status === 204);

    console.log('\n10. The owner deletes');
    check('the owner deletes the group', (await call('DELETE', `${API}/${id}`, owner)).status === 204);
    check('it is gone', (await call('GET', `${API}/${id}`, owner)).status === 404);
    check('its members rows went with it', (await prisma.chantGroupMember.count({ where: { groupId: id } })) === 0);
  } finally {
    await sub.quit();
    await prisma.chantGroup.deleteMany({ where: { ownerId: owner.id } });
    await prisma.notification.deleteMany({ where: { userId: { in: [owner.id, admin.id, member.id, stranger.id] } } });
    await prisma.user.deleteMany({ where: { id: { in: [owner.id, admin.id, member.id, stranger.id] } } });
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  await prisma.$disconnect();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (error) => {
  console.error(error);
  await prisma.$disconnect();
  process.exit(1);
});
