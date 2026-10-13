// How the admin panel's translation runs behave when things go wrong, and what a run asks Claude for.
// Read by jobs/processors/translation.js and utils/translation-run.js. The pipeline itself (prompt,
// validation, saving) is scripts/lib/claude-translate-*.js and has its own defaults.

const translation = {
  // The worker touches the run row this often while the job runs. It is also how often a cancel
  // request is noticed, so Cancel takes at most this long to bite.
  heartbeatMs: 5_000,
  // The page warns "no heartbeat" when a RUNNING run has been quiet this long (the worker died or
  // is stuck; BullMQ gives the job back to another worker by itself, which then carries on).
  staleHeartbeatSeconds: 90,

  // What a run asks Claude for. No thinking: the work is a faithful rendering of given text, and
  // thinking tokens are billed as output. These are the CLI's defaults.
  effort: 'off',
  maxTokens: 64_000,
  maxRounds: 4,

  // A failure that is probably temporary — Anthropic or S3 busy or unreachable — pauses the run and
  // tries again by itself: after retryBaseMs, doubling up to retryMaxMs, at most maxAutoRetries times
  // without a single verse saved in between. Then it waits for a person (Resume).
  retryBaseMs: 5 * 60_000,
  retryMaxMs: 60 * 60_000,
  maxAutoRetries: 12,

  // An error nobody foresaw (a bug, a dropped database connection) gets this many quiet retries
  // before the run is marked FAILED and the message is shown.
  unknownRetries: 2,
  unknownRetryMs: 2 * 60_000,

  // The activity feed lives in Redis: this many lines per run, for this many days.
  feedLines: 200,
  feedDays: 30,

  // Saved-verse counts per language come from reading every chapter file in S3; the answer is
  // kept this long, and dropped when a run stops.
  coverageCacheSeconds: 300,
  coverageCacheKey: 'translation:coverage',

  // The English chapter files never change under a run, so a process keeps them this long instead
  // of fetching them for every estimate, chapter view and attempt.
  sourceCacheSeconds: 600,
  // Chapter files read from S3 at once when counting or estimating.
  readConcurrency: 6,

  // The worker re-queues a run whose background job has gone missing (Redis flushed, a job lost
  // after a crash) this often, and once on boot.
  reconcileEveryMs: 2 * 60_000,
  // A job whose worker died is handed to another this many times before BullMQ gives up on it.
  maxStalledCount: 20,
};

export { translation };
