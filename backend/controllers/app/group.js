// Private chanting groups, and the live room a group chants in.
//
// Roles: the OWNER made the group and is the only one who can delete it. An ADMIN may invite,
// remove ordinary members and make other admins. A MEMBER chants. A group is invisible to
// anyone who is not in it or invited to it — to everyone else it is a 404, not a 403.
//
// The live room is WebRTC audio, phone to phone. The server never carries sound: it records who
// is in the room, hands out the ICE servers, and relays the handshake messages (offer, answer,
// candidate) from one member to another over the websocket. Only the newcomer sends offers, so
// two people never offer to each other at once.

import { prisma } from '../../config/database.js';
import { ok, created, noContent } from '../../utils/respond.js';
import * as errors from '../../utils/errors.js';
import * as websocket from '../../services/websocket.js';
import * as notify from '../../services/notify.js';
import * as ice from '../../services/ice.js';
import {
  GROUP_LIVE_MAX,
  GROUP_MEMBERS_MAX,
  GROUPS_PER_USER_MAX,
  GROUP_LIVE_STALE_MS,
} from '../../config/constants.js';

const { EVENTS } = websocket;

const isAdmin = (role) => role === 'OWNER' || role === 'ADMIN';

const personSelect = { id: true, name: true, avatarUrl: true };
const mantraSelect = { id: true, slug: true, name: true };

// ── Lookups ────────────────────────────────────────────────────────────────

/** The caller's row in a group, with the group. A stranger gets 404 so a private group stays private. */
async function membership(groupId, userId, { status = 'ACTIVE', admin = false } = {}) {
  const row = await prisma.chantGroupMember.findUnique({
    where: { groupId_userId: { groupId, userId } },
    include: { group: true },
  });
  if (!row || (status && row.status !== status)) throw errors.notFound('Group');
  if (admin && !isAdmin(row.role)) throw errors.forbidden('Only a group admin can do this');
  return row;
}

async function activeMemberIds(groupId) {
  const rows = await prisma.chantGroupMember.findMany({
    where: { groupId, status: 'ACTIVE' },
    select: { userId: true },
  });
  return rows.map((row) => row.userId);
}

const staleBefore = () => new Date(Date.now() - GROUP_LIVE_STALE_MS);

/** The open live session, or null. One whose people have all gone quiet is closed here and now. */
async function openSession(groupId) {
  const session = await prisma.chantGroupSession.findFirst({
    where: { groupId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) return null;

  const present = await prisma.chantGroupParticipant.count({
    where: { sessionId: session.id, leftAt: null, lastSeenAt: { gt: staleBefore() } },
  });
  if (present > 0) return session;

  await closeSession(session);
  return null;
}

async function closeSession(session) {
  const now = new Date();
  await prisma.$transaction([
    prisma.chantGroupParticipant.updateMany({
      where: { sessionId: session.id, leftAt: null },
      data: { leftAt: now },
    }),
    prisma.chantGroupSession.updateMany({ where: { id: session.id, endedAt: null }, data: { endedAt: now } }),
  ]);
}

function participantsOf(sessionId) {
  return prisma.chantGroupParticipant.findMany({
    where: { sessionId, leftAt: null, lastSeenAt: { gt: staleBefore() } },
    orderBy: { joinedAt: 'asc' },
    include: { user: { select: personSelect } },
  });
}

const presentPerson = (user) => ({ id: user.id, name: user.name, avatarUrl: user.avatarUrl });

function presentMember(row) {
  return {
    ...presentPerson(row.user),
    role: row.role,
    status: row.status,
    joinedAt: row.joinedAt,
  };
}

async function liveState(groupId) {
  const session = await openSession(groupId);
  if (!session) return null;
  const people = await participantsOf(session.id);
  return {
    sessionId: session.id,
    startedAt: session.startedAt,
    startedBy: session.startedBy,
    participants: people.map((p) => presentPerson(p.user)),
  };
}

async function presentGroup(group, myRole, extra = {}) {
  const [memberCount, live, mantra] = await Promise.all([
    prisma.chantGroupMember.count({ where: { groupId: group.id, status: 'ACTIVE' } }),
    liveState(group.id),
    group.mantraId ? prisma.mantra.findUnique({ where: { id: group.mantraId }, select: mantraSelect }) : null,
  ]);
  return {
    id: group.id,
    name: group.name,
    description: group.description,
    ownerId: group.ownerId,
    mantra,
    myRole,
    memberCount,
    live,
    createdAt: group.createdAt,
    ...extra,
  };
}

/** Tell every active member (but one, if asked) that the group changed. */
async function broadcastChange(groupId, what, exceptUserId) {
  const ids = await activeMemberIds(groupId);
  for (const id of ids) {
    if (id !== exceptUserId) websocket.toUser(id, EVENTS.GROUP_CHANGED, { groupId, what });
  }
}

async function checkMantra(mantraId) {
  if (!mantraId) return;
  const mantra = await prisma.mantra.findUnique({ where: { id: mantraId }, select: { id: true } });
  if (!mantra) throw errors.badRequest('That mantra does not exist');
}

// ── Groups ─────────────────────────────────────────────────────────────────

/** GET /api/app/groups — my groups, and the invitations waiting for an answer. */
export const list = async (req, res) => {
  const userId = req.auth.user.id;
  const rows = await prisma.chantGroupMember.findMany({
    where: { userId },
    include: { group: true },
    orderBy: { createdAt: 'desc' },
  });

  const mine = rows.filter((row) => row.status === 'ACTIVE');
  const invited = rows.filter((row) => row.status === 'INVITED');

  const groups = await Promise.all(mine.map((row) => presentGroup(row.group, row.role)));
  const invitations = await Promise.all(
    invited.map(async (row) => {
      const inviter = row.invitedById
        ? await prisma.user.findUnique({ where: { id: row.invitedById }, select: personSelect })
        : null;
      return {
        groupId: row.groupId,
        name: row.group.name,
        description: row.group.description,
        invitedBy: inviter ? presentPerson(inviter) : null,
        invitedAt: row.createdAt,
      };
    })
  );

  return ok(res, { groups, invitations });
};

/** POST /api/app/groups */
export const create = async (req, res) => {
  const userId = req.auth.user.id;
  const { name, description, mantraId } = req.valid.body;

  const owned = await prisma.chantGroup.count({ where: { ownerId: userId } });
  if (owned >= GROUPS_PER_USER_MAX) throw errors.conflict(`You can own up to ${GROUPS_PER_USER_MAX} groups`);
  await checkMantra(mantraId);

  const group = await prisma.chantGroup.create({
    data: {
      name,
      description: description || null,
      mantraId: mantraId || null,
      ownerId: userId,
      members: { create: { userId, role: 'OWNER', status: 'ACTIVE', joinedAt: new Date() } },
    },
  });

  return created(res, await presentGroup(group, 'OWNER'));
};

/** GET /api/app/groups/:id — members, and who is chanting now. */
export const read = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id);
  const members = await prisma.chantGroupMember.findMany({
    where: { groupId: me.groupId },
    include: { user: { select: personSelect } },
    orderBy: { createdAt: 'asc' },
  });

  // Who is waiting on an invitation is for admins; everyone else sees the people who are in.
  const visible = members.filter((row) => row.status === 'ACTIVE' || isAdmin(me.role));
  return ok(res, await presentGroup(me.group, me.role, { members: visible.map(presentMember) }));
};

/** PATCH /api/app/groups/:id */
export const update = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id, { admin: true });
  const { name, description, mantraId } = req.valid.body;
  if (mantraId) await checkMantra(mantraId);

  const group = await prisma.chantGroup.update({
    where: { id: me.groupId },
    data: {
      ...(name !== undefined ? { name } : {}),
      ...(description !== undefined ? { description: description || null } : {}),
      ...(mantraId !== undefined ? { mantraId: mantraId || null } : {}),
    },
  });

  await broadcastChange(group.id, 'updated', req.auth.user.id);
  return ok(res, await presentGroup(group, me.role));
};

/** DELETE /api/app/groups/:id — the owner only; admins cannot, however many they are. */
export const remove = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id);
  if (me.role !== 'OWNER') throw errors.forbidden('Only the person who made the group can delete it');

  const ids = await activeMemberIds(me.groupId);
  await prisma.chantGroup.delete({ where: { id: me.groupId } });
  for (const id of ids) {
    if (id !== req.auth.user.id) websocket.toUser(id, EVENTS.GROUP_CHANGED, { groupId: me.groupId, what: 'deleted' });
  }
  return noContent(res);
};

// ── Members ────────────────────────────────────────────────────────────────

/** POST /api/app/groups/:id/invite — by the email the person signed up with. */
export const invite = async (req, res) => {
  const inviterId = req.auth.user.id;
  const me = await membership(req.valid.params.id, inviterId, { admin: true });
  const email = req.valid.body.email.trim().toLowerCase();

  const person = await prisma.user.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, isBanned: false },
    select: personSelect,
  });
  if (!person) throw errors.notFound('Someone with that email');

  const existing = await prisma.chantGroupMember.findUnique({
    where: { groupId_userId: { groupId: me.groupId, userId: person.id } },
  });
  if (existing?.status === 'ACTIVE') throw errors.conflict('They are already in this group');
  if (existing?.status === 'INVITED') return ok(res, { invited: true, person: presentPerson(person) });

  const members = await prisma.chantGroupMember.count({ where: { groupId: me.groupId } });
  if (members >= GROUP_MEMBERS_MAX) throw errors.conflict(`A group holds up to ${GROUP_MEMBERS_MAX} people`);

  await prisma.chantGroupMember.create({
    data: { groupId: me.groupId, userId: person.id, role: 'MEMBER', status: 'INVITED', invitedById: inviterId },
  });

  const inviterName = req.auth.user.name || 'Someone';
  await notify.toUser(person.id, {
    type: 'SYSTEM',
    title: me.group.name,
    body: `${inviterName} invited you to chant together`,
    data: { kind: 'group_invite', groupId: me.groupId },
  });
  websocket.toUser(person.id, EVENTS.GROUP_INVITED, { groupId: me.groupId, name: me.group.name });

  return created(res, { invited: true, person: presentPerson(person) });
};

/** POST /api/app/groups/:id/accept */
export const accept = async (req, res) => {
  const userId = req.auth.user.id;
  const me = await membership(req.valid.params.id, userId, { status: 'INVITED' });

  await prisma.chantGroupMember.update({
    where: { groupId_userId: { groupId: me.groupId, userId } },
    data: { status: 'ACTIVE', joinedAt: new Date() },
  });
  await broadcastChange(me.groupId, 'member-joined', userId);
  return ok(res, await presentGroup(me.group, 'MEMBER'));
};

/** POST /api/app/groups/:id/decline */
export const decline = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id, { status: 'INVITED' });
  await prisma.chantGroupMember.delete({
    where: { groupId_userId: { groupId: me.groupId, userId: req.auth.user.id } },
  });
  return noContent(res);
};

/** POST /api/app/groups/:id/leave — everyone but the owner, who deletes the group instead. */
export const leave = async (req, res) => {
  const userId = req.auth.user.id;
  const me = await membership(req.valid.params.id, userId);
  if (me.role === 'OWNER') {
    throw errors.conflict('The person who made the group cannot leave it — delete the group instead');
  }

  await dropFromLiveRoom(me.groupId, userId);
  await prisma.chantGroupMember.delete({ where: { groupId_userId: { groupId: me.groupId, userId } } });
  await broadcastChange(me.groupId, 'member-left', userId);
  return noContent(res);
};

/** DELETE /api/app/groups/:id/members/:userId — remove a member, or take back an invitation. */
export const removeMember = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id, { admin: true });
  const targetId = req.valid.params.userId;

  const target = await prisma.chantGroupMember.findUnique({
    where: { groupId_userId: { groupId: me.groupId, userId: targetId } },
  });
  if (!target) throw errors.notFound('Member');
  if (target.role === 'OWNER') throw errors.forbidden('The person who made the group cannot be removed');
  if (targetId === req.auth.user.id) throw errors.badRequest('Use leave to leave a group');
  if (target.role === 'ADMIN' && me.role !== 'OWNER') {
    throw errors.forbidden('Only the person who made the group can remove an admin');
  }

  await dropFromLiveRoom(me.groupId, targetId);
  await prisma.chantGroupMember.delete({ where: { groupId_userId: { groupId: me.groupId, userId: targetId } } });
  if (target.status === 'ACTIVE') {
    websocket.toUser(targetId, EVENTS.GROUP_CHANGED, { groupId: me.groupId, what: 'removed' });
    await broadcastChange(me.groupId, 'member-left', req.auth.user.id);
  }
  return noContent(res);
};

/** PUT /api/app/groups/:id/members/:userId/role — an admin makes another admin; only the owner takes it back. */
export const setRole = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id, { admin: true });
  const targetId = req.valid.params.userId;
  const { role } = req.valid.body;

  const target = await prisma.chantGroupMember.findUnique({
    where: { groupId_userId: { groupId: me.groupId, userId: targetId } },
  });
  if (!target || target.status !== 'ACTIVE') throw errors.notFound('Member');
  if (target.role === 'OWNER') throw errors.forbidden('The role of the person who made the group cannot change');
  if (role === 'MEMBER' && me.role !== 'OWNER') {
    throw errors.forbidden('Only the person who made the group can take admin away');
  }

  await prisma.chantGroupMember.update({
    where: { groupId_userId: { groupId: me.groupId, userId: targetId } },
    data: { role },
  });
  websocket.toUser(targetId, EVENTS.GROUP_CHANGED, { groupId: me.groupId, what: 'role' });
  await broadcastChange(me.groupId, 'role', targetId);
  return ok(res, { userId: targetId, role });
};

// ── The live room ──────────────────────────────────────────────────────────

/** Mark someone as out of the open session, and tell the room. */
async function dropFromLiveRoom(groupId, userId) {
  const session = await prisma.chantGroupSession.findFirst({ where: { groupId, endedAt: null } });
  if (!session) return;
  const { count } = await prisma.chantGroupParticipant.updateMany({
    where: { sessionId: session.id, userId, leftAt: null },
    data: { leftAt: new Date() },
  });
  if (!count) return;
  await afterLeaving(session, groupId, userId);
}

async function afterLeaving(session, groupId, userId) {
  const remaining = await participantsOf(session.id);
  if (!remaining.length) {
    await closeSession(session);
    for (const id of await activeMemberIds(groupId)) {
      websocket.toUser(id, EVENTS.GROUP_LIVE, { groupId, live: false });
    }
    return;
  }
  for (const p of remaining) {
    websocket.toUser(p.userId, EVENTS.GROUP_PARTICIPANT, { groupId, userId, joined: false });
  }
}

function roomPayload(groupId, session, people, userId) {
  return {
    sessionId: session.id,
    iceServers: ice.iceServers(userId),
    // The people already in the room: the newcomer offers to each of them.
    participants: people.filter((p) => p.userId !== userId).map((p) => presentPerson(p.user)),
    maxParticipants: GROUP_LIVE_MAX,
  };
}

/** Put the caller in the session. */
async function enter(groupId, session, user) {
  const present = await participantsOf(session.id);
  const already = present.some((p) => p.userId === user.id);
  if (!already && present.length >= GROUP_LIVE_MAX) {
    throw errors.conflict(`The room is full — ${GROUP_LIVE_MAX} people can chant together at a time`);
  }

  const now = new Date();
  await prisma.chantGroupParticipant.upsert({
    where: { sessionId_userId: { sessionId: session.id, userId: user.id } },
    create: { sessionId: session.id, userId: user.id },
    update: { leftAt: null, lastSeenAt: now, joinedAt: now },
  });

  for (const p of present) {
    if (p.userId !== user.id) {
      websocket.toUser(p.userId, EVENTS.GROUP_PARTICIPANT, {
        groupId,
        joined: true,
        person: presentPerson(user),
      });
    }
  }
  return participantsOf(session.id);
}

/** GET /api/app/groups/:id/live — who is chanting now, without joining. */
export const liveStatus = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id);
  return ok(res, { live: await liveState(me.groupId) });
};

/** POST /api/app/groups/:id/live/start — an admin opens the room (and is in it). */
export const liveStart = async (req, res) => {
  const user = req.auth.user;
  const me = await membership(req.valid.params.id, user.id, { admin: true });

  let session = await openSession(me.groupId);
  const fresh = !session;
  if (!session) {
    session = await prisma.chantGroupSession.create({ data: { groupId: me.groupId, startedBy: user.id } });
  }

  const people = await enter(me.groupId, session, user);

  if (fresh) {
    const others = (await activeMemberIds(me.groupId)).filter((id) => id !== user.id);
    for (const id of others) {
      websocket.toUser(id, EVENTS.GROUP_LIVE, { groupId: me.groupId, live: true, sessionId: session.id });
    }
    const starter = user.name || 'Someone';
    // One push each; the in-app list gets the row too, so a missed push still leaves a trace.
    await Promise.all(
      others.map((id) =>
        notify.toUser(id, {
          type: 'SYSTEM',
          title: me.group.name,
          body: `${starter} is chanting now — join in`,
          data: { kind: 'group_live', groupId: me.groupId },
        })
      )
    );
  }

  return ok(res, roomPayload(me.groupId, session, people, user.id));
};

/** POST /api/app/groups/:id/live/join */
export const liveJoin = async (req, res) => {
  const user = req.auth.user;
  const me = await membership(req.valid.params.id, user.id);

  const session = await openSession(me.groupId);
  if (!session) throw errors.gone('Nobody is chanting in this group right now');

  const people = await enter(me.groupId, session, user);
  return ok(res, roomPayload(me.groupId, session, people, user.id));
};

/** POST /api/app/groups/:id/live/heartbeat — "still here"; the answer says whether the room is. */
export const liveHeartbeat = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id);
  const session = await openSession(me.groupId);
  if (!session) return ok(res, { open: false });

  const { count } = await prisma.chantGroupParticipant.updateMany({
    where: { sessionId: session.id, userId: req.auth.user.id, leftAt: null },
    data: { lastSeenAt: new Date() },
  });
  return ok(res, { open: true, joined: count > 0 });
};

/** POST /api/app/groups/:id/live/leave */
export const liveLeave = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id);
  await dropFromLiveRoom(me.groupId, req.auth.user.id);
  return noContent(res);
};

/** POST /api/app/groups/:id/live/end — an admin closes the room for everybody. */
export const liveEnd = async (req, res) => {
  const me = await membership(req.valid.params.id, req.auth.user.id, { admin: true });
  const session = await prisma.chantGroupSession.findFirst({ where: { groupId: me.groupId, endedAt: null } });
  if (session) {
    await closeSession(session);
    for (const id of await activeMemberIds(me.groupId)) {
      websocket.toUser(id, EVENTS.GROUP_LIVE, { groupId: me.groupId, live: false, ended: true });
    }
  }
  return noContent(res);
};

/**
 * POST /api/app/groups/:id/live/signal — one WebRTC handshake message to one person in the room.
 * Both must be in the open session, so a stale tab or a removed member cannot reach anyone.
 */
export const liveSignal = async (req, res) => {
  const fromId = req.auth.user.id;
  const me = await membership(req.valid.params.id, fromId);
  const { to, kind, data } = req.valid.body;

  const session = await openSession(me.groupId);
  if (!session) throw errors.gone('Nobody is chanting in this group right now');

  const both = await prisma.chantGroupParticipant.count({
    where: { sessionId: session.id, userId: { in: [fromId, to] }, leftAt: null },
  });
  if (to === fromId || both < 2) throw errors.notFound('That person in the room');

  websocket.toUser(to, EVENTS.GROUP_SIGNAL, { groupId: me.groupId, from: fromId, kind, data });
  return noContent(res);
};
