// The arithmetic behind AI credits — pure, no database, so it can be tested to
// the last token. services/ai-wallet.js feeds it rows and writes what it says.
//
// Vocabulary: a *wallet* holds tokens and refills on a schedule; a plan's
// *daily cap* limits how many can be spent per local day, whatever the wallet
// holds. Readers see neither number — only `percent`, 100 → 0.

const FALLBACK_TZ = 'Asia/Kolkata';

function validZone(timeZone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(0);
    return timeZone;
  } catch {
    return FALLBACK_TZ;
  }
}

/** The calendar date ("YYYY-MM-DD") it is right now, for a person in `timeZone`. */
export function localDateKey(at, timeZone) {
  const zone = validZone(timeZone || FALLBACK_TZ);
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: zone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(at);
  const get = (type) => parts.find((p) => p.type === type).value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}

// How far `timeZone` is ahead of UTC at the instant `at`, in ms.
function offsetMs(at, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
  }).formatToParts(at);
  const get = (type) => Number(parts.find((p) => p.type === type).value);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

/** The instant the day after `at` begins, for someone in `timeZone`. */
export function nextLocalMidnight(at, timeZone) {
  const zone = validZone(timeZone || FALLBACK_TZ);
  const [y, m, d] = localDateKey(at, zone).split('-').map(Number);
  const wallMidnight = Date.UTC(y, m - 1, d + 1, 0, 0, 0);
  // The offset can differ either side of a daylight-saving change, so settle it twice.
  let guess = wallMidnight - offsetMs(new Date(wallMidnight), zone);
  guess = wallMidnight - offsetMs(new Date(guess), zone);
  return new Date(guess);
}

/** The same day-of-month, `months` later (clamped to the month's end). */
export function addMonths(date, months = 1) {
  const result = new Date(date.getTime());
  const day = result.getUTCDate();
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDay));
  return result;
}

const clampPercent = (n) => Math.max(0, Math.min(100, Math.round(n)));

/**
 * What the reader sees.
 *
 *   percent     — the lower of the two limits: what is left of the wallet, and
 *                 what is left of today's cap. 100 → 0.
 *   limitedBy   — which of them is the lower: 'wallet' | 'daily' | null (both full)
 *   exhausted   — nothing can be spent right now.
 */
export function creditMeter({ balance, allocation, dailyUsed = 0, dailyLimit = 0, bonusTotal = 0, bonusUsed = 0 }) {
  // Today's free-tier bonus is more of both: more to spend today, and more of the day's cap.
  const bonusLeft = Math.max(0, bonusTotal - bonusUsed);
  const walletPercent = allocation + bonusTotal > 0 ? clampPercent(((Math.max(0, balance) + bonusLeft) / (allocation + bonusTotal)) * 100) : 0;
  const dailyPercent = dailyLimit > 0
    ? clampPercent(((dailyLimit + bonusTotal - dailyUsed - Math.min(bonusUsed, bonusTotal)) / (dailyLimit + bonusTotal)) * 100)
    : 100;

  const percent = Math.min(walletPercent, dailyPercent);
  let limitedBy = null;
  if (percent < 100) limitedBy = dailyPercent < walletPercent ? 'daily' : 'wallet';

  const exhausted = balance + bonusLeft <= 0 || (dailyLimit > 0 && dailyUsed >= dailyLimit && bonusLeft <= 0);
  return { percent, walletPercent, dailyPercent, limitedBy, exhausted };
}

/**
 * How many tokens may be spent right now: the smallest of what the wallet
 * holds, what is left of today's cap and what is left for this conversation.
 * A limit of 0 means "no limit".
 */
export function spendable({ balance, dailyUsed = 0, dailyLimit = 0, conversationUsed = 0, conversationLimit = 0, bonusLeft = 0 }) {
  // The wallet's side is held back by the daily cap; today's bonus is spent beside it, outside both.
  const walletSide = [Math.max(0, balance)];
  if (dailyLimit > 0) walletSide.push(Math.max(0, dailyLimit - dailyUsed));
  const candidates = [Math.min(...walletSide) + Math.max(0, bonusLeft)];
  if (conversationLimit > 0) candidates.push(Math.max(0, conversationLimit - conversationUsed));
  return Math.min(...candidates);
}

/**
 * How many ordinary replies a wallet of `tokens` pays for, said the way a reader can
 * weigh it — a count, never the tokens. It is an estimate, so it is rounded down to a
 * multiple of five once it is ten or more ("about 200", not 203): precision it does not
 * have would read as a promise.
 */
export function repliesIn(tokens, perReply) {
  if (!(tokens > 0) || !(perReply > 0)) return 0;
  const whole = Math.floor(tokens / perReply);
  return whole >= 10 ? whole - (whole % 5) : whole;
}

/**
 * Which limit stopped a call that `spendable()` said was too small. The order
 * is the order the reader can do something about: a full conversation is solved
 * by a new chat, a daily cap by tomorrow, an empty wallet by upgrading.
 */
export function whyBlocked({
  balance, dailyUsed = 0, dailyLimit = 0, conversationUsed = 0, conversationLimit = 0, needed = 1, bonusLeft = 0,
}) {
  if (conversationLimit > 0 && conversationLimit - conversationUsed < needed) return 'CONVERSATION';
  if (dailyLimit > 0 && dailyLimit - dailyUsed + bonusLeft < needed) return 'DAILY';
  if (balance + bonusLeft < needed) return 'WALLET';
  return null;
}

/**
 * Settles a wallet against its plan's allowance. Returns what to write.
 *
 *   - no wallet yet            → a full one
 *   - allowance raised         → the difference is credited (plan change or an edit in the panel)
 *   - allowance lowered        → the allocation drops, the balance is left alone
 *   - period over (MONTHLY)    → topped up to the allocation; a balance already above it is untouched
 */
export function reconcileWallet({ wallet, allowance, planId, now = new Date() }) {
  const periodEnd = allowance.renewal === 'MONTHLY' ? addMonths(now, 1) : null;

  if (!wallet) {
    return {
      create: { planId, balance: allowance.walletTokens, allocation: allowance.walletTokens, periodStart: now, periodEnd },
      credit: allowance.walletTokens > 0 ? { tokens: allowance.walletTokens, note: 'Starting allowance' } : null,
    };
  }

  const update = {};
  let credit = null;

  if (wallet.planId !== planId) update.planId = planId;

  if (allowance.walletTokens !== wallet.allocation) {
    update.allocation = allowance.walletTokens;
    if (allowance.walletTokens > wallet.allocation) {
      credit = { tokens: allowance.walletTokens - wallet.allocation, note: 'Allowance raised' };
    }
  }

  // A wallet that now renews gets a period; one that stops renewing loses it.
  if (allowance.renewal === 'NEVER' && wallet.periodEnd) {
    update.periodEnd = null;
  } else if (allowance.renewal === 'MONTHLY' && !wallet.periodEnd) {
    update.periodStart = now;
    update.periodEnd = periodEnd;
  } else if (wallet.periodEnd && now >= wallet.periodEnd) {
    const base = Math.max(0, wallet.balance + (credit?.tokens || 0));
    const topUp = Math.max(0, allowance.walletTokens - base);
    credit = { tokens: (credit?.tokens || 0) + topUp, note: 'Monthly renewal' };
    update.periodStart = now;
    update.periodEnd = periodEnd;
  }

  return { update: Object.keys(update).length ? update : null, credit: credit?.tokens > 0 ? credit : null, renewed: Boolean(update.periodEnd && update.periodStart) };
}
