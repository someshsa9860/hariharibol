// Tunables for the developer companion app's feed and its pushes. Fixed numbers, not AppSettings: they
// protect the server and the developer's phone, and changing one is a deploy on purpose.

export const devops = {
  QUEUE: 'devops',
  // Events one API process may queue in a window. A burst beyond this is counted, not queued — the
  // error path must never become the thing that takes the server down.
  EMIT_BURST: 40,
  EMIT_WINDOW_MS: 10_000,
  // Errors are counted in memory and sent as one batch this often.
  ERROR_FLUSH_MS: 15_000,
  ERROR_SIGNATURES_PER_BATCH: 10,
  // 5xx in the last ERROR_SPIKE_WINDOW_MIN minutes that counts as a spike, and how long before the next spike alert.
  ERROR_SPIKE_THRESHOLD: 20,
  ERROR_SPIKE_WINDOW_MIN: 5,
  ERROR_SPIKE_COOLDOWN_S: 15 * 60,
  // The same alert (same dedupe key) is not raised again inside this time.
  ALERT_COOLDOWN_S: 30 * 60,
  // Health thresholds, checked by the worker every two minutes.
  QUEUE_WAITING_ALERT: 500,
  QUEUE_FAILED_ALERT: 25,
  DB_SLOW_MS: 1500,
  EVENT_KEEP_DAYS: 30,

  // Push to the developer's phone.
  PUSH_FOREGROUND_TTL_S: 75, // the app says it is open every 30 s; past this it counts as background
  PUSH_MAX_PER_HOUR: 8, // every kind together, per recipient
  PUSH_CRITICAL_MAX_PER_HOUR: 6, // criticals have their own allowance, so a quiet hour cannot be eaten by chatter
  PUSH_CHAT_GAP_S: 120, // one chat push per conversation per two minutes; the rest wait for the digest
  PUSH_DIGEST_MIN_GAP_S: 15 * 60, // a digest never follows another push sooner than this
  PUSH_DIGEST_MAX_ITEMS: 200, // kept per recipient while waiting; older ones are dropped, the feed still has them
  PUSH_PREFS_TTL_S: 365 * 86_400,

  // Reader → developer chat.
  CHAT_MAX_LENGTH: 2000,
  CHAT_USER_PUSH_GAP_S: 5 * 60, // the reader gets at most one push per conversation in this time
};
