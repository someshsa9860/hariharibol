// The developer's feed, off the request path.
//
//   event          one event from services/dev-events.js `emit()`: de-duplicate, store, send over the websocket,
//                  and let services/dev-push.js decide about a push.
//   user.push      the developer replied to a reader: a push to them, at most one per conversation per few minutes.
//   errors         a batch of 5xx counted by the API (services/dev-events.js `recordError()`): raises "new kind of
//                  error" once per signature a day, and "error spike" when the last few minutes pass a threshold.
//   devops.health  every two minutes: database speed, queue backlogs and failures.
//   devops.digest  every five minutes: the digest push for whatever waited (services/dev-push.js).
//   devops.prune   daily: drop feed rows past EVENT_KEEP_DAYS.

import { createHash } from 'node:crypto';

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { devops } from '../../config/devops.js';
import { queues, QUEUE_NAMES } from '../index.js';
import * as websocket from '../../services/websocket.js';
import * as devPush from '../../services/dev-push.js';
import * as notify from '../../services/notify.js';
import { greetedTitle, notice } from '../../utils/messages.js';

const minuteBucket = (at = Date.now()) => Math.floor(at / 60_000);

// Store one event, show it live, then consider a push. `chat` carries the conversation for the push rules.
export async function publish({ type, severity = 'info', title, body = null, data = null }, { chat } = {}) {
  const row = await prisma.devEvent.create({ data: { type, severity, title, body, data } });
  const event = {
    id: row.id,
    type: row.type,
    severity: row.severity,
    title: row.title,
    body: row.body,
    data: row.data,
    createdAt: row.createdAt,
  };
  websocket.toPermission('dev.access', 'dev.event', event);
  await devPush.consider(event, { conversationId: chat });
  return event;
}

// Returns true when this key may be raised now (and starts its cooldown).
async function claim(key, cooldownS) {
  if (!key) return true;
  const ok = await redis.set(`dev:ded:${key}`, '1', 'EX', cooldownS || devops.ALERT_COOLDOWN_S, 'NX');
  return ok === 'OK';
}

async function onEvent(data) {
  if (!(await claim(data.dedupeKey, data.cooldownS))) return { skipped: 'cooldown' };
  const chat = data.type === 'chat.message' ? data.data?.conversationId : undefined;
  const event = await publish(data, { chat });
  return { id: event.id };
}

async function onErrors({ total, items }) {
  const bucket = minuteBucket();
  await redis.incrby(`dev:err:${bucket}`, total);
  await redis.expire(`dev:err:${bucket}`, 3600);

  let fresh = 0;
  for (const item of items) {
    const hash = createHash('sha1').update(item.sig).digest('hex').slice(0, 16);
    const isNew = await redis.set(`dev:errsig:${hash}`, '1', 'EX', 86_400, 'NX');
    if (isNew !== 'OK') continue;
    fresh += 1;
    await publish({
      type: 'error.new',
      severity: 'warning',
      title: `New error: ${item.method} ${item.route}`,
      body: item.message,
      data: { status: item.status, count: item.count, method: item.method, route: item.route },
    });
  }

  // Sum of the last N minutes.
  const keys = Array.from({ length: devops.ERROR_SPIKE_WINDOW_MIN }, (_, i) => `dev:err:${bucket - i}`);
  const sum = (await redis.mget(keys)).reduce((n, v) => n + (Number(v) || 0), 0);
  let spike = false;
  if (sum >= devops.ERROR_SPIKE_THRESHOLD && (await claim('error.spike', devops.ERROR_SPIKE_COOLDOWN_S))) {
    spike = true;
    await publish({
      type: 'error.spike',
      severity: 'critical',
      title: `${sum} server errors in ${devops.ERROR_SPIKE_WINDOW_MIN} minutes`,
      body: items
        .slice(0, 3)
        .map((i) => `${i.count}× ${i.method} ${i.route}`)
        .join('\n'),
      data: { total: sum, top: items.slice(0, 5) },
    });
  }
  return { fresh, spike };
}

async function alert(key, title, body, data) {
  if (!(await claim(`health:${key}`, devops.ALERT_COOLDOWN_S))) return false;
  await publish({ type: 'health.alert', severity: 'critical', title, body, data });
  return true;
}

async function onHealthCheck() {
  const raised = [];

  const started = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  const dbMs = Date.now() - started;
  if (dbMs > devops.DB_SLOW_MS && (await alert('db-slow', 'Database is slow', `A trivial query took ${dbMs} ms.`, { dbMs }))) raised.push('db-slow');

  for (const name of QUEUE_NAMES) {
    const counts = await queues[name].getJobCounts('waiting', 'failed');
    if (counts.waiting >= devops.QUEUE_WAITING_ALERT && (await alert(`waiting:${name}`, `Queue "${name}" is backing up`, `${counts.waiting} jobs are waiting.`, { queue: name, ...counts }))) {
      raised.push(`waiting:${name}`);
    }
    if (counts.failed >= devops.QUEUE_FAILED_ALERT && (await alert(`failed:${name}`, `Queue "${name}" has failed jobs`, `${counts.failed} failed jobs are stored.`, { queue: name, ...counts }))) {
      raised.push(`failed:${name}`);
    }
  }
  return { dbMs, raised };
}

// The developer replied: the reader's phone gets one push per conversation per few minutes; in between, the
// message still reaches an open app over the websocket and counts in the unread badge.
async function onUserPush({ userId, conversationId, body }) {
  const free = await redis.set(`dev:userpush:${conversationId}`, '1', 'EX', devops.CHAT_USER_PUSH_GAP_S, 'NX');
  if (free !== 'OK') return { skipped: 'gap' };
  const { name, chain } = await notify.recipient(userId);
  await notify.toUser(userId, {
    type: 'SYSTEM',
    title: greetedTitle(name, chain, notice('devReplyTitle', chain)),
    body,
    data: { deeplink: 'hariharibol://developer' },
    campaign: `dev-chat:${conversationId}:${Math.floor(Date.now() / 86_400_000)}`,
    source: 'dev-chat',
  });
  return { sent: true };
}

async function onPrune() {
  const cutoff = new Date(Date.now() - devops.EVENT_KEEP_DAYS * 86_400_000);
  const { count } = await prisma.devEvent.deleteMany({ where: { createdAt: { lt: cutoff } } });
  return { pruned: count };
}

export default async function devopsProcessor(job) {
  switch (job.name) {
    case 'event':
      return onEvent(job.data);
    case 'user.push':
      return onUserPush(job.data);
    case 'errors':
      return onErrors(job.data);
    case 'devops.health':
      return onHealthCheck();
    case 'devops.digest':
      return devPush.flushDigests();
    case 'devops.prune':
      return onPrune();
    default:
      logger.warn({ job: job.name }, 'unknown devops job');
      return { skipped: true };
  }
}
