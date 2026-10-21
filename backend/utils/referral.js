// The referral rules, with no database. Opening a shared verse is not a referral; only a code from
// /satsang/<code> claimed by a signed-in new reader is. test/referral.test.js walks every branch.

export const DEFAULT_RULES = Object.freeze({
  // How long after signing up a reader can still claim a code. Beyond this they are not "new".
  claimWindowDays: 7,
  // Things a referred reader must do (a chant sitting, a verse read, a sadhana day) before the referrer is rewarded.
  qualifyActions: 1,
  // Anyone claiming must have been signed up for at least this long, so a throwaway account made in one sitting
  // does not qualify in the same breath.
  qualifyAfterHours: 24,
  // At most this many months a person can earn in a rolling year.
  maxRewardsPerYear: 12,
  rewardDays: 30,
  rewardPlanSlug: 'arta',
});

const DAY = 86_400_000;
const HOUR = 3_600_000;

/**
 * May this reader claim this code right now? Returns `{ ok: true }` or `{ ok: false, reason }`. The reasons are
 * stable strings: the API sends them and the apps word them.
 */
export function canClaim({ referrerId, referee, alreadyReferred, now = new Date(), rules = DEFAULT_RULES }) {
  if (!referrerId) return { ok: false, reason: 'CODE_UNKNOWN' };
  if (referrerId === referee.id) return { ok: false, reason: 'SELF_REFERRAL' };
  if (alreadyReferred) return { ok: false, reason: 'ALREADY_REFERRED' };
  if (now - referee.createdAt > rules.claimWindowDays * DAY) return { ok: false, reason: 'NOT_NEW' };
  return { ok: true };
}

/** Has a pending referral earned its reward yet? `reason` says what is still missing. */
export function qualifies({ referral, actions, rewardsThisYear, now = new Date(), rules = DEFAULT_RULES }) {
  if (referral.status !== 'PENDING') return { ok: false, reason: 'NOT_PENDING' };
  if (now - referral.refereeCreatedAt < rules.qualifyAfterHours * HOUR) return { ok: false, reason: 'TOO_SOON' };
  if (actions < rules.qualifyActions) return { ok: false, reason: 'NOT_ACTIVE_YET' };
  if (rewardsThisYear >= rules.maxRewardsPerYear) return { ok: false, reason: 'LIMIT_REACHED' };
  return { ok: true };
}

/**
 * When the granted month runs. It starts when the person's current Ārta-or-better access ends (so a paying
 * subscriber loses nothing and gains a full month at the end), or now when they have none; it only ever extends.
 * `coveredUntil` is the latest end of access they already hold at that tier, or null.
 */
export function rewardWindow({ coveredUntil, now = new Date(), rules = DEFAULT_RULES }) {
  const startsAt = coveredUntil && coveredUntil > now ? coveredUntil : now;
  return { startsAt, endsAt: new Date(startsAt.getTime() + rules.rewardDays * DAY) };
}
