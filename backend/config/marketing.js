// How the Marketing campaigns behave: the fixed limits, the timing the worker keeps, and the reputation
// thresholds. Read by services/marketing-run.js, utils/marketing-send.js, utils/marketing-blocks.js and
// utils/marketing-links.js. The numbers an admin can change (the pace, the caps, the costs) are settings
// (`marketing.*` in config/constants.js) and are read where they are used.

const marketing = {
  // A campaign has at most this many tracked destinations. A reader's link is /l/<code>/<position>.
  maxLinks: 5,
  // An email body is capped so a template stays a short message.
  maxBlocks: 40,

  // Delivery codes are opaque and this long (MarketingDelivery.code is VarChar(16)).
  codeLength: 16,

  // The worker touches the campaign row this often while a run works. It is also how often a pause or a
  // cancel is noticed, so either takes at most this long to bite.
  heartbeatMs: 5_000,
  // The page warns "no heartbeat" when a RUNNING campaign has been quiet this long (the worker died).
  staleHeartbeatSeconds: 90,
  // A campaign whose worker died is handed to another this many times before BullMQ gives up on it.
  maxStalledCount: 20,
  // The worker re-queues a campaign whose background job has gone missing (Redis flushed) this often,
  // and once on boot.
  reconcileEveryMs: 2 * 60_000,
  // The Start button takes this lock for a moment, so two clicks cannot both create a run.
  startLockSeconds: 20,

  // Readers are written to MarketingDelivery in pages of this size when a campaign starts; the sends
  // then run in pages of sendPageSize, with a check for a pause or cancel between pages.
  materialisePageSize: 500,
  sendPageSize: 200,

  // A failure that is probably temporary (the mail server busy or unreachable) is tried again this many
  // times, waiting from retryBaseMs, doubling, up to retryMaxMs between tries.
  maxSendAttempts: 3,
  // The run itself, when the mail server cannot be reached, waits and tries again this many times before it asks for a person.
  maxAutoRetries: 8,
  retryBaseMs: 30_000,
  retryMaxMs: 15 * 60_000,

  // The run pauses itself when, over its most recent reputationWindow sends, the hard-bounce or the
  // complaint rate is above the limit. Below reputationMinSample sends the rates are not judged: one
  // bounce in five sends is not a trend.
  reputationWindow: 500,
  reputationMinSample: 100,
  maxBounceRate: 0.02,
  maxComplaintRate: 0.001,

  // AI_PER_USER: the sample an admin approves before the rest of the audience is written.
  aiSampleSize: 5,

  // A campaign run's activity feed lives in Redis (key prefix, then the campaign id)
  feedKey: 'marketing:feed',
  // and how much of it is kept: this many lines, for this many days.
  feedLines: 200,
  feedDays: 30,

  // The wording the consent log records. Change it when the words shown to people change.
  consentWordingVersion: '2026-10-29',

  // Defaults for the settings an admin can change (marketing.* in config/constants.js).
  defaultRatePerMinute: 120,
  defaultDailyCap: 50_000,
  defaultWeeklyCap: 2,

  // The model that writes marketing copy unless the admin picks another, and the most it may answer with.
  provider: 'openai',
  aiMaxTokens: 4000,

  // WhatsApp opt-in: how many verification codes one person may ask for.
  optInPerHour: 3,
  optInPerDay: 5,
};

export { marketing };
