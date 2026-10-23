// The producer side of the developer's live feed.
//
// Anything worth the developer's attention calls `emit()`. It returns at once and never throws: the event
// is put on the `devops` queue and the worker (jobs/processors/devops.js) stores it, sends it over the
// websocket and decides whether it deserves a push. Nothing here touches the database, and a Redis hiccup
// costs a lost event, never a failed request.
//
// Two guards keep it from hurting the server it watches:
//   - a per-process burst limit, so a storm of events cannot flood Redis;
//   - errors go through `recordError()`, which only counts in memory and sends one batch every few
//     seconds, so a failing endpoint under load costs one counter increment per request.

import { queues } from '../jobs/index.js';
import logger from '../config/logger.js';
import { devops } from '../config/devops.js';

// What the feed calls things. Listed so the producer, the worker and the app agree on the strings.
export const EVENT_TYPES = {
  ERROR_BATCH: 'error.batch', // internal: becomes error.new / error.spike in the worker
  ERROR_NEW: 'error.new',
  ERROR_SPIKE: 'error.spike',
  HEALTH_ALERT: 'health.alert',
  USER_SIGNUP: 'user.signup',
  TICKET_NEW: 'ticket.new',
  FEEDBACK_NEW: 'feedback.new',
  CHAT_MESSAGE: 'chat.message',
};

let windowStart = 0;
let inWindow = 0;
let dropped = 0;

function allowed() {
  const now = Date.now();
  if (now - windowStart > devops.EMIT_WINDOW_MS) {
    if (dropped) logger.warn({ dropped }, 'dev events dropped by the burst limit');
    windowStart = now;
    inWindow = 0;
    dropped = 0;
  }
  if (inWindow >= devops.EMIT_BURST) {
    dropped += 1;
    return false;
  }
  inWindow += 1;
  return true;
}

/**
 * Queue one event for the developer's feed. Fire and forget.
 *
 * `dedupeKey` + `cooldownS`: the worker raises an event with this key at most once per cooldown.
 */
export function emit(type, { severity = 'info', title, body, data, dedupeKey, cooldownS } = {}) {
  try {
    if (!title || !allowed()) return;
    queues[devops.QUEUE]
      .add('event', { type, severity, title, body: body || null, data: data || null, dedupeKey, cooldownS }, {
        removeOnComplete: 50,
        removeOnFail: 50,
        attempts: 2,
        backoff: { type: 'fixed', delay: 5000 },
      })
      .catch((err) => logger.debug({ err: err.message, type }, 'dev event not queued'));
  } catch (err) {
    logger.debug({ err: err.message, type }, 'dev event failed');
  }
}

// ── 5xx errors: counted in memory, flushed in batches ───────────────────────

const errors = new Map(); // signature → { count, method, route, status, message }
let flushTimer = null;

function signature(method, route, message) {
  return `${method} ${route} ${String(message).slice(0, 120)}`;
}

// Never throws and does no I/O; called from the error handler on every 5xx.
export function recordError({ method, route, status, message }) {
  try {
    const key = signature(method, route, message);
    const entry = errors.get(key);
    if (entry) entry.count += 1;
    else if (errors.size < 200) errors.set(key, { count: 1, method, route, status, message: String(message).slice(0, 300) });
    if (!flushTimer) {
      flushTimer = setTimeout(flushErrors, devops.ERROR_FLUSH_MS);
      flushTimer.unref?.();
    }
  } catch {
    /* counting errors must not cause one */
  }
}

export function flushErrors() {
  flushTimer = null;
  if (errors.size === 0) return;
  const all = [...errors.entries()].map(([sig, value]) => ({ sig, ...value }));
  errors.clear();
  all.sort((a, b) => b.count - a.count);
  const total = all.reduce((sum, e) => sum + e.count, 0);
  // A batch is one queue job whatever happened, however many different errors it holds.
  try {
    queues[devops.QUEUE]
      .add('errors', { total, items: all.slice(0, devops.ERROR_SIGNATURES_PER_BATCH) }, { removeOnComplete: 20, removeOnFail: 20 })
      .catch((err) => logger.debug({ err: err.message }, 'error batch not queued'));
  } catch {
    /* see above */
  }
}
