// The rules of sending a campaign that need no database: what a mail server's answer means, when a run has damaged the
// sender's reputation, which language variant a reader is sent, how long to wait between sends. Pure, so `npm test`
// covers it. services/marketing-run.js and jobs/processors/marketing.js apply them.

import { marketing } from '../config/marketing.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';

/* ---------- a mail server's answer ---------- */

const NO_SUCH_MAILBOX = /user unknown|unknown user|no such user|does not exist|mailbox (unavailable|not found|does not exist)|recipient (address )?rejected|invalid (recipient|mailbox)|address rejected|no mailbox|undeliverable/i;

/**
 * What a failed send means. → `{ kind, message }`:
 *   hard_bounce  the address does not exist: suppress it, never write again
 *   invalid      nodemailer refused the address before sending: treat as a hard bounce
 *   retry        a temporary failure (4xx, a timeout for this message): try again later, up to marketing.maxSendAttempts
 *   auth         the login was refused or the account is suspended: no message can be sent; pause the whole run
 *   connection   the server cannot be reached: pause the whole run, try again by itself
 *   rejected     the server refused this message for its content or policy (5xx): failed, address kept
 */
export function classifyMailError(err) {
  const code = String(err?.code || '');
  const response = Number(err?.responseCode) || 0;
  const text = `${err?.response || ''} ${err?.message || ''}`.trim();
  const message = text.slice(0, 300) || 'The mail server refused the message.';

  if (code === 'EAUTH' || response === 535 || response === 530 || response === 534) return { kind: 'auth', message };
  if (code === 'EENVELOPE') return { kind: 'invalid', message };
  if (['ECONNECTION', 'ESOCKET', 'EDNS', 'ECONNREFUSED', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNRESET'].includes(code)) return { kind: 'connection', message };
  if (code === 'ETIMEDOUT' || code === 'ECONNECTION_TIMEOUT') return { kind: 'retry', message };
  if (response >= 400 && response < 500) return { kind: 'retry', message };
  if (response >= 500) {
    const noMailbox = [550, 551, 553].includes(response) && (NO_SUCH_MAILBOX.test(text) || /\b5\.1\.[1-6]\b/.test(text));
    return { kind: noMailbox ? 'hard_bounce' : 'rejected', message };
  }
  return { kind: 'retry', message };
}

/** The Amazon SES message id from the SMTP reply ("250 Ok 0100018f-…"), or null. */
export function sesMessageId(info) {
  const m = /\bOk\s+([0-9a-zA-Z-]{20,})/.exec(String(info?.response || ''));
  return m ? m[1] : null;
}

/** How long to wait before the nth automatic retry of one message (n = 1 for the first retry). */
export const retryDelayMs = (n, cfg = marketing) => Math.min(cfg.retryBaseMs * 2 ** Math.max(0, n - 1), cfg.retryMaxMs);

/* ---------- reputation ---------- */

/**
 * Judges the most recent sends: `outcomes` is a list of `'ok' | 'bounce' | 'complaint'`, newest last. Under
 * reputationMinSample sends no rate is judged. → `{ pause, reason, bounceRate, complaintRate, sample }`.
 */
export function judgeReputation(outcomes, cfg = marketing) {
  const recent = outcomes.slice(-cfg.reputationWindow);
  const sample = recent.length;
  const bounces = recent.filter((o) => o === 'bounce').length;
  const complaints = recent.filter((o) => o === 'complaint').length;
  const bounceRate = sample ? bounces / sample : 0;
  const complaintRate = sample ? complaints / sample : 0;
  if (sample < cfg.reputationMinSample) return { pause: false, reason: null, bounceRate, complaintRate, sample };
  if (bounceRate > cfg.maxBounceRate) {
    return { pause: true, reason: 'bounce_rate', bounceRate, complaintRate, sample, message: `${(bounceRate * 100).toFixed(1)}% of the last ${sample} emails bounced (the limit is ${cfg.maxBounceRate * 100}%). Paused to protect the sender; clean the list before resuming.` };
  }
  if (complaintRate > cfg.maxComplaintRate) {
    return { pause: true, reason: 'complaint_rate', bounceRate, complaintRate, sample, message: `${(complaintRate * 100).toFixed(2)}% of the last ${sample} emails drew a spam complaint (the limit is ${cfg.maxComplaintRate * 100}%). Paused to protect the sender.` };
  }
  return { pause: false, reason: null, bounceRate, complaintRate, sample };
}

/* ---------- language ---------- */

/**
 * The variant a reader is sent: the first language of their chain that has an APPROVED variant, else English. →
 * `{ variant, language, fellBack }` or null when not even English is approved. `fellBack` is true when the reader's own
 * first language had none.
 */
export function pickVariant(variants, chain) {
  const approved = new Map((variants || []).filter((v) => v.status === 'APPROVED').map((v) => [v.language, v]));
  const order = [...new Set([...(chain || []), DEFAULT_LANGUAGE])];
  for (const code of order) {
    const variant = approved.get(code);
    if (variant) return { variant, language: code, fellBack: code !== order[0] };
  }
  return null;
}

/* ---------- pace and days ---------- */

/** The gap between two sends so that `perMinute` are made a minute. */
export const gapMs = (perMinute) => Math.ceil(60_000 / Math.max(1, perMinute));

/** The calendar day in India, `YYYY-MM-DD`: the daily cap resets at midnight there. */
export function istDay(now = new Date()) {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

/** When the daily cap lifts: the next midnight in India. */
export function nextIstMidnight(now = new Date()) {
  const ist = new Date(now.getTime() + 330 * 60_000);
  ist.setUTCHours(24, 0, 5, 0);
  return new Date(ist.getTime() - 330 * 60_000);
}

/* ---------- headers ---------- */

/** The headers every marketing email carries so a mail program can offer its own Unsubscribe button. */
export function listHeaders({ unsubscribeUrl, mailto, configurationSet, campaignId }) {
  const targets = [`<${unsubscribeUrl}>`];
  if (mailto) targets.push(`<mailto:${mailto}?subject=unsubscribe>`);
  return {
    'List-Unsubscribe': targets.join(', '),
    'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    Precedence: 'bulk',
    'X-Auto-Response-Suppress': 'OOF, AutoReply',
    ...(configurationSet ? { 'X-SES-CONFIGURATION-SET': configurationSet } : {}),
    ...(campaignId ? { 'X-SES-MESSAGE-TAGS': `campaign=${campaignId}` } : {}),
  };
}
