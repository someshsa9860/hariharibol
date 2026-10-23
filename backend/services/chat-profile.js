// What Sakha has noticed about a reader (SakhaProfile), and what the reader said they are struggling with today.
//
//   learn      after a reply has gone out, the cheap model reads the reader's message once and the profile is updated —
//              traits (a few short fields and notes) and keywords (what every message was about). Never in front of a
//              reply: it runs in the background, paid for from the same wallet (source PROFILE), and a reader who cannot
//              afford it is simply not read.
//   forPrompt  the traits and today's struggles, for buildSystem. The keywords are never read here.
//   view / setLearning / remove   the reader's own say over it.
//
// The rules about what a profile may hold are pure and live in utils/chat-profile.js.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import { PROFILE, TODAY_ISSUES } from '../config/chat.js';
import * as ai from './ai/index.js';
import * as tokens from './ai/tokens.js';
import * as wallet from './ai-wallet.js';
import * as rules from '../utils/chat-profile.js';
import { toDateColumn, localDateString } from '../utils/date.js';
import { conflict } from '../utils/errors.js';

// One model call; the lock outlives any sane one and expires by itself if the process dies.
const LOCK_SECONDS = 60;
// How long a reader's own request (delete, switch) waits for a reading already under way.
const WAIT_MS = 15_000;

// Two readings at once would both start from the same profile and the later write would throw the earlier one away; and a
// delete must not be followed by a reading that was already under way. A background reading that finds one going waits
// its turn too, so no message is skipped.
async function withLock(userId, work) {
  const key = `chat:profile:${userId}`;
  const give = Date.now() + WAIT_MS;
  for (;;) {
    const got = await redis.set(key, '1', 'EX', LOCK_SECONDS, 'NX').catch(() => 'OK');
    if (got) break;
    if (Date.now() >= give) return null;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  try {
    return await work();
  } finally {
    await redis.del(key).catch(() => null);
  }
}

const present = (row) => ({
  learning: row ? row.learning : true,
  traits: rules.cleanTraits(row?.traits),
  keywords: row?.keywords || [],
  updatedAt: row?.updatedAt || null,
});

/** The reader's profile as they see it: everything stored, including the keywords. */
export async function view(userId) {
  return present(await prisma.sakhaProfile.findUnique({ where: { userId } }));
}

/** Stops or restarts the reading. Off also stops the use of what is stored; the stored profile stays until deleted. */
export async function setLearning(userId, learning) {
  const row = await withLock(userId, () =>
    prisma.sakhaProfile.upsert({ where: { userId }, create: { userId, learning }, update: { learning } })
  );
  if (!row) throw conflict('Sakha is just updating this — please try again in a moment');
  return present(row);
}

/**
 * Deletes everything: the traits and the keywords. With learning switched off the row stays (empty) so the switch is
 * remembered; otherwise the row goes.
 */
export async function remove(userId) {
  const done = await withLock(userId, async () => {
    const row = await prisma.sakhaProfile.findUnique({ where: { userId } });
    if (!row) return true;
    if (row.learning) await prisma.sakhaProfile.delete({ where: { userId } });
    else await prisma.sakhaProfile.update({ where: { userId }, data: { traits: {}, keywords: [], messagesRead: 0 } });
    return true;
  });
  if (!done) throw conflict('Sakha is just updating this — please try again in a moment');
}

/**
 * What goes into the prompt about this reader: `{ traits, issues }`. A failure to read either is no reason to fail a
 * reply, so it comes back as nothing.
 */
export async function forPrompt(user) {
  try {
    const today = toDateColumn(localDateString(user.timezone));
    const [row, reports] = await Promise.all([
      prisma.sakhaProfile.findUnique({ where: { userId: user.id }, select: { learning: true, traits: true } }),
      prisma.userIssue.findMany({
        where: { userId: user.id, date: today },
        orderBy: { reportedAt: 'desc' },
        take: TODAY_ISSUES.max * 3,
        select: { intensity: true, note: true, issue: { select: { name: true } } },
      }),
    ]);
    return {
      traits: row && row.learning ? rules.cleanTraits(row.traits) : null,
      issues: reports.map((r) => ({ name: r.issue.name, intensity: r.intensity, note: r.note })),
    };
  } catch (error) {
    logger.warn({ err: error.message, userId: user.id }, 'chat profile read failed');
    return { traits: null, issues: [] };
  }
}

/**
 * Reads one message of the reader's and updates the profile. Returns whether the profile was read. A message too short
 * to say anything, learning switched off, a wallet that cannot afford it and a model that fails are all "not read" —
 * never an error to the caller.
 */
export async function learn({ user, text, conversationId }) {
  if (!rules.worthReading(text)) return false;

  const read = await withLock(user.id, async () => {
    const row = await prisma.sakhaProfile.findUnique({ where: { userId: user.id } });
    if (row && !row.learning) return false;

    const request = rules.extractorRequest({ traits: row?.traits, text });
    const needed = tokens.estimate(request.system) + tokens.estimate(request.prompt) + PROFILE.maxOutputTokens;
    const opened = await wallet.open(user);
    if (!opened.wallet || wallet.room(opened, null).available < needed) return false;

    let result;
    try {
      result = await ai.complete({
        operation: ai.OPERATIONS.CHAT_PROFILE,
        purpose: 'summary',
        system: request.system,
        prompt: request.prompt,
        json: true,
        maxTokens: PROFILE.maxOutputTokens,
        temperature: 0.1,
        userId: user.id,
        targetType: 'chat',
        targetId: conversationId,
      });
    } catch (error) {
      logger.warn({ err: error.message, userId: user.id }, 'chat profile reading failed');
      return false;
    }

    await wallet.debit({
      userId: user.id,
      tokens: result.usage.inputTokens + result.usage.outputTokens,
      source: 'PROFILE',
      referenceId: conversationId,
      timezone: user.timezone,
      bonus: opened.bonus,
    });

    const next = rules.readExtraction({ json: result.json, traits: row?.traits, keywords: row?.keywords });
    if (!next.changed) return true;
    await prisma.sakhaProfile.upsert({
      where: { userId: user.id },
      create: { userId: user.id, traits: next.traits, keywords: next.keywords, messagesRead: 1 },
      update: { traits: next.traits, keywords: next.keywords, messagesRead: { increment: 1 } },
    });
    return true;
  });
  return Boolean(read);
}

/** After a reply, without anyone waiting for it. */
export function learnInBackground(args) {
  learn(args).catch((error) => logger.warn({ err: error.message, userId: args.user?.id }, 'chat profile background reading failed'));
}
