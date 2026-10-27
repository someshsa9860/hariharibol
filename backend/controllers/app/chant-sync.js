// Chant sync — chanting kept on the phone, sent in a batch.
//
// The app counts into its own storage first and sends later: when the app is closed or
// goes to the background, when it opens again, when the connection comes back, and
// every few minutes in between. So one request carries every sitting that has changed
// since the last one, and it may arrive hours or days after the chanting.
//
// That asks three things of the server, and each is why this is not the older
// start / patch / detail trio:
//
//  - Sending the same sitting twice must be the same sitting. The phone mints an id for
//    a sitting when it begins (`clientId`); a lost answer, a retry, or two sends racing
//    each other all land on the one row.
//  - The day a sitting belongs to is the day it *began*, in the user's timezone, not the
//    day it was sent.
//  - Nothing may go backwards. A sitting's rounds only rise, so an older copy that
//    arrives late cannot take away what a newer one already said.
//
// The older endpoints (controllers/app/sadhana.js) stay: builds from before this one
// still use them, and the manual log is unchanged.

import { prisma } from '../../config/database.js';
import { ok } from '../../utils/respond.js';
import { localDateString } from '../../utils/date.js';
import { BEADS_PER_ROUND, CHANT_SYNC_MAX_AGE_DAYS } from '../../config/constants.js';
import * as referral from '../../services/referral.js';
import * as websocket from '../../services/websocket.js';
import { visibleTo } from '../../utils/mantra-visibility.js';
import { ensureDay, recountDay, learnSampradaya } from './sadhana.js';

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instant a sitting began, kept inside the window the server will place a day in. */
function placedStart(ms, now) {
  const oldest = now - CHANT_SYNC_MAX_AGE_DAYS * DAY_MS;
  return new Date(Math.min(Math.max(ms, oldest), now));
}

/**
 * What a sitting changes on a session that stands at `base`. Rounds only rise, and the
 * beads of the round in progress belong to the highest round count seen: when the round
 * count rises the new beads replace the old ones (a round just ended, so the count falls
 * back towards 0), and at the same count the larger wins.
 */
function progressOf(base, sitting, startedAt, now) {
  const fields = {};
  if (sitting.rounds > base.rounds) {
    fields.rounds = sitting.rounds;
    fields.beads = sitting.beads;
  } else if (sitting.rounds === base.rounds && sitting.beads > base.beads) {
    fields.beads = sitting.beads;
  }

  if (sitting.finish && !base.endedAt) {
    const wanted = sitting.endedAt != null ? sitting.endedAt : now;
    const endedAt = new Date(Math.min(Math.max(wanted, startedAt.getTime()), now));
    fields.endedAt = endedAt;
    fields.durationSeconds = Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
  }
  return fields;
}

/** A round's row from the summary the phone sends. */
function malaData(mala, startedAt) {
  const beads = mala.beads ?? 0;
  return {
    beads,
    startedAt: mala.startedAt != null ? new Date(mala.startedAt) : startedAt,
    endedAt: mala.endedAt != null ? new Date(mala.endedAt) : null,
    durationMs: mala.durationMs ?? 0,
    avgGapMs: mala.avgGapMs ?? 0,
    complete: Boolean(mala.complete) && beads >= BEADS_PER_ROUND,
    taps: [],
  };
}

async function sessionByClientId(userId, clientId) {
  return prisma.chantSession.findUnique({ where: { userId_clientId: { userId, clientId } } });
}

/** One sitting: its session (made if new), its progress, its rounds. */
async function applySitting(user, sitting, mantraIds, now) {
  const startedAt = placedStart(sitting.startedAt, now);
  const day = await ensureDay(user, localDateString(user.timezone, startedAt));
  const mantraId = sitting.mantraId && mantraIds.has(sitting.mantraId) ? sitting.mantraId : null;

  let session = await sessionByClientId(user.id, sitting.clientId);
  const before = session ?? { rounds: 0, beads: 0, endedAt: null };
  const fields = progressOf(before, sitting, startedAt, now);

  if (!session) {
    try {
      session = await prisma.chantSession.create({
        data: {
          userId: user.id,
          sadhanaDayId: day.id,
          mantraId,
          source: 'IN_APP',
          clientId: sitting.clientId,
          startedAt,
          ...fields,
        },
      });
    } catch (err) {
      // Another request made it between the look and the write (two sends racing).
      if (err.code !== 'P2002') throw err;
      session = await sessionByClientId(user.id, sitting.clientId);
      const stored = progressOf(session, sitting, startedAt, now);
      if (Object.keys(stored).length) {
        session = await prisma.chantSession.update({ where: { id: session.id }, data: stored });
      }
    }
  } else if (Object.keys(fields).length) {
    session = await prisma.chantSession.update({ where: { id: session.id }, data: fields });
  }

  let anyComplete = false;
  const malas = sitting.malas ?? [];
  if (malas.length) {
    const saved = await prisma.$transaction(
      malas.map((mala) => {
        const data = malaData(mala, session.startedAt);
        return prisma.chantMala.upsert({
          where: { sessionId_index: { sessionId: session.id, index: mala.index } },
          create: { sessionId: session.id, userId: user.id, index: mala.index, ...data },
          update: data,
        });
      })
    );
    anyComplete = saved.some((mala) => mala.complete);
  }

  // Only a session's first bead or round can add a day to a tradition (see updateSession).
  const first = before.rounds === 0 && before.beads === 0 && (session.rounds > 0 || session.beads > 0);

  return {
    day,
    anyComplete,
    first: first && Boolean(session.mantraId),
    result: {
      clientId: sitting.clientId,
      id: session.id,
      date: day.date.toISOString().slice(0, 10),
      rounds: session.rounds,
      beads: session.beads,
    },
  };
}

/**
 * PUT /api/app/sadhana/chant/sync
 * Every sitting the phone has not yet told us about, or has changed since. Answers with
 * each sitting as stored and the totals of every day it touched.
 */
export const syncChant = async (req, res) => {
  const user = req.auth.user;
  const { sittings } = req.valid.body;
  const now = Date.now();

  // A mantra gone since the chanting (unpublished, removed) must not fail the whole
  // batch: the rounds are what matters, so they are kept under no mantra.
  const wanted = [...new Set(sittings.map((s) => s.mantraId).filter(Boolean))];
  const known = wanted.length
    ? await prisma.mantra.findMany({ where: { id: { in: wanted }, AND: [visibleTo(user)] }, select: { id: true } })
    : [];
  const mantraIds = new Set(known.map((m) => m.id));

  const results = [];
  const days = new Map();
  let anyComplete = false;
  let anyFirst = false;

  // One at a time: they are few, and two sittings of the same day each recount it.
  for (const sitting of sittings) {
    const applied = await applySitting(user, sitting, mantraIds, now);
    results.push(applied.result);
    days.set(applied.day.id, applied.day);
    anyComplete = anyComplete || applied.anyComplete;
    anyFirst = anyFirst || applied.first;
  }

  const recounted = [];
  for (const id of days.keys()) recounted.push(await recountDay(id));

  for (const day of recounted) {
    websocket.toUser(user.id, websocket.EVENTS.CHANT_PROGRESS, {
      date: day.date,
      roundsCompleted: day.roundsCompleted,
      roundTarget: day.roundTarget,
    });
  }

  // Neither may change what the phone is told: a referral's outcome, or a tradition
  // being worked out, is no reason to answer that the chanting was not saved.
  if (anyComplete) referral.evaluate(user.id).catch(() => {});
  if (anyFirst) await learnSampradaya(user.id);

  return ok(res, {
    sittings: results,
    days: recounted.map((day) => ({
      date: day.date.toISOString().slice(0, 10),
      roundsCompleted: day.roundsCompleted,
      roundTarget: day.roundTarget,
    })),
  });
};
