// The referral rules, in one place. Everything here has an environment override
// so a rule can change without a code change; the defaults are the product's.
//
//   A person is referred once, by the first valid code they present.
//   They must be new: the account is at most ATTRIBUTION_WINDOW_DAYS old when
//   the code is presented, and a code presented after that is ignored.
//   They qualify by finishing QUALIFY_ROUNDS full rounds of chanting (a round is
//   108 beads) — a real first step in the practice, not merely opening a link.
//   They must do it within QUALIFY_WITHIN_DAYS of being attributed.
//   The reward is REWARD_DAYS days of the REWARD_PLAN_SLUG plan.
//   One person can earn at most REWARD_LIMIT_PER_YEAR rewards in a rolling year.

const int = (name, fallback) => {
  const value = Number.parseInt(process.env[name] ?? '', 10);
  return Number.isFinite(value) && value >= 0 ? value : fallback;
};

export default {
  ATTRIBUTION_WINDOW_DAYS: int('REFERRAL_ATTRIBUTION_WINDOW_DAYS', 7),
  QUALIFY_ROUNDS: int('REFERRAL_QUALIFY_ROUNDS', 1),
  QUALIFY_WITHIN_DAYS: int('REFERRAL_QUALIFY_WITHIN_DAYS', 30),
  REWARD_DAYS: int('REFERRAL_REWARD_DAYS', 30),
  REWARD_PLAN_SLUG: process.env.REFERRAL_REWARD_PLAN_SLUG || 'arta',
  REWARD_LIMIT_PER_YEAR: int('REFERRAL_REWARD_LIMIT_PER_YEAR', 12),
  // Attributions one account may make per day from one referrer is not limited;
  // what is limited is how many people one referrer can have pending at once.
  MAX_PENDING_PER_REFERRER: int('REFERRAL_MAX_PENDING', 50),
};
