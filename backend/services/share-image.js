// AI backgrounds for share cards.
//
// A picture is paid for from the same token wallet as Ask Sakha (services/ai-wallet.js),
// so a reader has one meter and one ledger. What this file adds is the part a chat
// reply does not need: the charge is taken *before* the provider is called, and given
// back if the provider fails, and a repeated request with the same key finds the same
// job instead of being charged again.
//
//   request ──► job row (userId, requestKey unique) ──► room? ──► debit ──► provider
//                                      ▲                                       │
//                       same key finds this row           failure ─► credit back, FAILED
//
// Readers see a percentage and "one background", never tokens.

import crypto from 'node:crypto';

import env from '../config/env.js';
import logger from '../config/logger.js';
import { prisma } from '../config/database.js';
import * as aiWallet from './ai-wallet.js';
import * as s3 from './s3.js';
import { localDateKey } from '../utils/ai-credits.js';
import { badRequest, paymentRequired, AppError } from '../utils/errors.js';

export const COST_TOKENS = Number.parseInt(process.env.SHARE_IMAGE_TOKEN_COST ?? '', 10) || 12000;
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL || 'gpt-image-1';
const TIMEOUT_MS = 90_000;
const STALE_MS = 5 * 60_000;

// Every request carries these, whatever the reader typed: the text on a card is the
// verse, drawn by us, and a generated picture with letters in it would fight it.
const GUARD = 'No letters, no words, no typography, no watermark, no logos, no people’s faces. Calm composition with a clean central space for text.';

export const SUGGESTIONS = [
  'A peaceful golden sunrise behind an ancient Indian temple, warm saffron and gold tones',
  'A still lotus pond at dawn, soft mist, gentle pink and gold light',
  'An abstract devotional texture of flowing saffron and deep maroon, subtle gold dust',
  'A quiet forest clearing with soft shafts of morning light, sacred and serene',
  'A river at twilight with floating oil lamps, deep indigo sky and warm glow',
];

const present = (job) => ({
  id: job.id,
  status: job.status,
  prompt: job.prompt,
  imageUrl: null, // filled by the caller when DONE
  error: job.error,
});

async function withUrl(job) {
  const base = present(job);
  if (job.status === 'DONE' && job.imagePath) base.imageUrl = await s3.presignGet(job.imagePath);
  return base;
}

/** What one background costs this person, as a share of their meter, and whether they can pay it now. */
export async function quote(user) {
  const opened = await aiWallet.open(user);
  const { allowance, wallet } = opened;
  const enabled = Boolean(allowance?.isEnabled && wallet);
  const room = enabled ? aiWallet.room(opened) : null;
  const allocation = wallet?.allocation || 0;
  return {
    enabled,
    affordable: enabled && room.available >= COST_TOKENS,
    costPercent: allocation > 0 ? Math.max(1, Math.round((COST_TOKENS / allocation) * 100)) : null,
    blockedBy: enabled ? room.blockedBy(COST_TOKENS) : 'WALLET',
    canUpgrade: (await aiWallet.status(user)).canUpgrade,
    suggestions: SUGGESTIONS,
  };
}

/**
 * Starts (or finds) a background. Returns the job. Throws 402 when the person has not
 * got the credit — before anything is charged or sent.
 */
export async function generate({ user, requestKey, prompt }) {
  if (!env.OPENAI_API_KEY) throw new AppError(503, 'NOT_AVAILABLE', 'Backgrounds are not available right now');

  const clean = String(prompt || '').replace(/\s+/g, ' ').trim();
  if (clean.length < 8) throw badRequest('Describe the background in a few words');

  const keyed = { userId_requestKey: { userId: user.id, requestKey } };
  let existing = await prisma.shareImageJob.findUnique({ where: keyed });
  // A job stuck in PENDING (the server stopped mid-way) is settled — refunded if it
  // was charged — so it can be asked for again rather than hanging forever.
  if (existing?.status === 'PENDING' && Date.now() - existing.updatedAt.getTime() > STALE_MS) {
    await settleFailure(existing, 'The picture could not be made. You were not charged.');
    existing = await prisma.shareImageJob.findUnique({ where: keyed });
  }
  // The same request again: hand back what it already is. Only a failed, refunded job runs again.
  if (existing && !(existing.status === 'FAILED' && existing.refunded)) return withUrl(existing);

  // Claim the key first (a unique row), so parallel copies of one request produce
  // one job and only the winner goes on to charge.
  let job;
  if (existing) {
    const claimed = await prisma.shareImageJob.updateMany({
      where: { id: existing.id, status: 'FAILED', refunded: true },
      data: { status: 'PENDING', refunded: false, error: null, prompt: clean.slice(0, 600) },
    });
    if (claimed.count !== 1) return withUrl(await prisma.shareImageJob.findUnique({ where: { id: existing.id } }));
    job = await prisma.shareImageJob.findUnique({ where: { id: existing.id } });
  } else {
    try {
      job = await prisma.shareImageJob.create({
        data: { userId: user.id, requestKey, prompt: clean.slice(0, 600), tokens: COST_TOKENS },
      });
    } catch (err) {
      if (err.code !== 'P2002') throw err;
      return withUrl(await prisma.shareImageJob.findUnique({ where: keyed }));
    }
  }

  // Credit is checked before anything is charged or sent.
  const opened = await aiWallet.open(user);
  const room = opened.allowance?.isEnabled && opened.wallet ? aiWallet.room(opened) : null;
  if (!room || room.available < COST_TOKENS) {
    await prisma.shareImageJob.delete({ where: { id: job.id } });
    throw upgrade(user, room ? 'Not enough credit for a background' : 'This plan does not include backgrounds', room ? room.blockedBy(COST_TOKENS) : 'WALLET');
  }

  await aiWallet.debit({
    userId: user.id, tokens: COST_TOKENS, source: 'SHARE_IMAGE', referenceId: job.id,
    note: 'Share card background', timezone: user.timezone,
  });

  try {
    const bytes = await callProvider(clean);
    const key = `${s3.ROOT}/share/backgrounds/${user.id}/${job.id}.png`;
    await s3.putObject(key, bytes, 'image/png');
    job = await prisma.shareImageJob.update({ where: { id: job.id }, data: { status: 'DONE', imagePath: key } });
  } catch (err) {
    logger.error({ err: err.message, jobId: job.id }, 'share background failed');
    await settleFailure(job, 'The picture could not be made. You were not charged.');
    job = await prisma.shareImageJob.findUnique({ where: { id: job.id } });
  }
  return withUrl(job);
}

/**
 * Marks a job failed and gives the charge back — exactly once, and only if a charge
 * was really taken. The flag flips in the same conditional update that moves the job
 * to FAILED, so of two callers only one credits.
 */
async function settleFailure(job, message) {
  const settled = await prisma.shareImageJob.updateMany({
    where: { id: job.id, refunded: false },
    data: { status: 'FAILED', refunded: true, error: message },
  });
  if (settled.count !== 1) return;
  const charged = await prisma.aiWalletTransaction.count({
    where: { userId: job.userId, source: 'SHARE_IMAGE', type: 'DEBIT', referenceId: job.id },
  });
  const returned = await prisma.aiWalletTransaction.count({
    where: { userId: job.userId, source: 'SHARE_IMAGE', type: 'CREDIT', referenceId: job.id },
  });
  if (charged > returned) {
    await aiWallet.credit({ userId: job.userId, tokens: job.tokens, source: 'SHARE_IMAGE', referenceId: job.id, note: 'Refund: background not made' });
    // The day's cap gets it back too, or a failed picture would still use up today.
    const [user, debit] = await Promise.all([
      prisma.user.findUnique({ where: { id: job.userId }, select: { timezone: true } }),
      prisma.aiWalletTransaction.findFirst({ where: { userId: job.userId, source: 'SHARE_IMAGE', type: 'DEBIT', referenceId: job.id }, select: { createdAt: true, tokens: true } }),
    ]);
    if (user && debit) {
      await prisma.aiDailyUsage.updateMany({
        where: { userId: job.userId, date: localDateKey(debit.createdAt, user.timezone), tokens: { gte: debit.tokens } },
        data: { tokens: { decrement: debit.tokens } },
      });
    }
  }
}

export async function find(user, id) {
  const job = await prisma.shareImageJob.findFirst({ where: { id, userId: user.id } });
  return job ? withUrl(job) : null;
}

function upgrade(user, message, blockedBy = 'WALLET') {
  const error = paymentRequired(message);
  error.code = 'CREDIT_REQUIRED';
  error.details = { blockedBy, costPercent: null };
  return error;
}

async function callProvider(prompt) {
  const response = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt: `${prompt}. ${GUARD}`,
      size: '1024x1536',
      n: 1,
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`image provider answered ${response.status}`);
  const body = await response.json();
  const b64 = body?.data?.[0]?.b64_json;
  if (!b64) throw new Error('image provider sent no picture');
  const bytes = Buffer.from(b64, 'base64');
  // A real PNG, not whatever came back.
  if (bytes.length < 1000 || bytes.readUInt32BE(0) !== 0x89504e47) throw new Error('image provider sent something that is not a PNG');
  return bytes;
}

export const newKey = () => crypto.randomBytes(12).toString('hex');
