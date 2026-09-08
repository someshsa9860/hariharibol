// One-time codes.
//
// Sign-in does not use these — that is Google and Apple only. OTP covers the
// places where we need to prove someone still controls an address or is still
// at the keyboard: changing the email on an account, and stepping up before a
// destructive admin action.
//
// Codes live in Redis, never in Postgres. They expire on their own, they are
// worthless five minutes later, and a table of them is a table someone has to
// remember to prune.
//
// Only a hash of the code is stored, and verification is constant-time —
// otherwise the comparison itself leaks the code one character at a time.

import crypto from 'node:crypto';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import * as mailer from './mailer.js';
import { badRequest, tooMany } from '../utils/errors.js';

const TTL_SECONDS = 10 * 60;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

const PURPOSES = {
  EMAIL_CHANGE: 'email-change',
  ACCOUNT_DELETE: 'account-delete',
  ADMIN_STEP_UP: 'admin-step-up',
};

const codeKey = (purpose, subject) => `otp:${purpose}:${subject}`;
const cooldownKey = (purpose, subject) => `otp:cooldown:${purpose}:${subject}`;

const hash = (code, subject) =>
  crypto.createHash('sha256').update(`${subject}:${code}`).digest('hex');

// Six digits, uniformly distributed. Math.random() is not acceptable for
// anything that grants access.
function generateCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

async function issue({ purpose, subject, email, template = 'otp', data = {} }) {
  if (!Object.values(PURPOSES).includes(purpose)) throw badRequest('Unknown OTP purpose');

  const onCooldown = await redis.get(cooldownKey(purpose, subject));
  if (onCooldown) throw tooMany('A code was just sent. Please wait a moment before asking again.');

  const code = generateCode();
  await redis.set(
    codeKey(purpose, subject),
    JSON.stringify({ hash: hash(code, subject), attempts: 0 }),
    'EX',
    TTL_SECONDS
  );
  await redis.set(cooldownKey(purpose, subject), '1', 'EX', RESEND_COOLDOWN_SECONDS);

  await mailer.send({
    to: email,
    subject: 'Your HariHariBol verification code',
    template,
    data: { ...data, code, minutes: TTL_SECONDS / 60 },
  });

  logger.info({ purpose, subject }, 'otp issued');
  return { expiresInSeconds: TTL_SECONDS };
}

// Consumes the code on success. A correct code is single-use — leaving it live
// for the rest of its window would make a shoulder-surfed code replayable.
async function verify({ purpose, subject, code }) {
  const key = codeKey(purpose, subject);
  const raw = await redis.get(key);
  if (!raw) throw badRequest('That code has expired. Please request a new one.');

  const record = JSON.parse(raw);

  if (record.attempts >= MAX_ATTEMPTS) {
    await redis.del(key);
    throw tooMany('Too many incorrect codes. Please request a new one.');
  }

  const expected = Buffer.from(record.hash, 'hex');
  const actual = Buffer.from(hash(String(code || ''), subject), 'hex');
  const matches = expected.length === actual.length && crypto.timingSafeEqual(expected, actual);

  if (!matches) {
    record.attempts += 1;
    const ttl = await redis.ttl(key);
    await redis.set(key, JSON.stringify(record), 'EX', Math.max(ttl, 1));
    throw badRequest(`Incorrect code. ${MAX_ATTEMPTS - record.attempts} attempts left.`);
  }

  await redis.del(key);
  return true;
}

export { PURPOSES, issue, verify, TTL_SECONDS };
