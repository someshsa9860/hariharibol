// AI backgrounds for the Share Studio, paid from the reader's one token wallet (services/ai-wallet.js).
//
// Paid from the wallet balance, outside the daily chat cap (aiWallet.debit `countsToday: false`).
//
// Safe against double charging in three layers:
//   1. `requestId` (the client's idempotency key) is unique per user: a repeated key never starts a second job.
//   2. A per-user Redis lock holds off two different keys at once, so the balance check and the debit cannot race.
//   3. A failure refunds before it reports, and a retry of a FAILED key charges again only because that refund
//      returned the first charge — net one charge per picture delivered.
// The picture is stored as an ordinary temp upload (s3 `shareBackground`), so one that is never used is swept
// by the monthly temp prune; nothing about the reader is stored with it.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import * as aiWallet from './ai-wallet.js';
import * as image from './ai/image.js';
import * as s3 from './s3.js';
import { withLock } from './redis-lock.js';
import { buildPrompt, planFor } from '../utils/share-background.js';
import { AppError, badRequest, conflict } from '../utils/errors.js';

const cost = () => env.SHARE_BACKGROUND_TOKENS;

const insufficient = (reason) =>
  new AppError(402, 'CREDITS_EXHAUSTED', 'Not enough credits for a background', {
    limitedBy: reason, canUpgrade: true,
  });

async function present(row) {
  return {
    id: row.id, status: row.status, prompt: row.prompt,
    imageUrl: row.imagePath ? await s3.presignGet(row.imagePath) : null,
    imageKey: row.imagePath ?? null,
    failReason: row.failReason,
  };
}

/** What the studio shows before asking: can this reader afford a background, and what does it cost. */
export async function quote(user) {
  const opened = await aiWallet.open(user);
  if (!opened.allowance?.isEnabled || !opened.wallet) return { available: false, canAfford: false, imageProviderReady: image.isConfigured() };
  const room = Math.max(0, opened.wallet.balance);
  const status = await aiWallet.statusFrom(opened, user);
  return {
    available: image.isConfigured(),
    canAfford: room >= cost(),
    // About how many backgrounds the wallet holds, for the cost line. An estimate, said as one.
    backgroundsLeft: Math.floor(room / cost()),
    credits: status,
  };
}

export async function generate(user, { requestId, prompt: rawPrompt }) {
  const prompt = buildPrompt(rawPrompt);
  if (!prompt) throw badRequest('Describe the background you would like');

  const existing = await prisma.shareBackground.findUnique({ where: { userId_requestId: { userId: user.id, requestId } } });
  const plan = planFor(existing);
  if (plan === 'REPLAY') return present(existing);
  if (plan === 'WAIT') throw conflict('This background is still being made', { reason: 'IN_PROGRESS' });

  const held = await withLock(`share-bg:${user.id}`, 120_000, () => run(user, { requestId, prompt, existing }));
  if (!held) throw conflict('Another background is being made', { reason: 'IN_PROGRESS' });
  return held.value;
}

async function run(user, { requestId, prompt, existing }) {
  if (!image.isConfigured()) throw new AppError(503, 'IMAGE_NOT_AVAILABLE', 'Backgrounds are not available right now');

  // Check before anything is written or charged.
  const opened = await aiWallet.open(user);
  if (!opened.allowance?.isEnabled || !opened.wallet) throw new AppError(503, 'IMAGE_NOT_AVAILABLE', 'Backgrounds are not available right now');
  // Wallet balance only: the daily cap is chat's throttle, and one picture is larger than a day's chat.
  if (opened.wallet.balance < cost()) throw insufficient('WALLET');

  // One row per key. A race on the same key loses to the unique index here.
  let row;
  try {
    row = existing
      ? await prisma.shareBackground.update({ where: { id: existing.id }, data: { status: 'PENDING', failReason: null, prompt } })
      : await prisma.shareBackground.create({ data: { userId: user.id, requestId, prompt, tokens: cost() } });
  } catch (error) {
    if (error.code === 'P2002') throw conflict('This background is already being made', { reason: 'IN_PROGRESS' });
    throw error;
  }

  await aiWallet.debit({ userId: user.id, tokens: cost(), source: 'OTHER_AI_FEATURE', referenceId: row.id, note: 'Share Studio background', timezone: user.timezone, countsToday: false });

  try {
    const made = await image.generate(prompt);
    const key = s3.buildKey('shareBackground', made.contentType);
    await s3.putObject(key, made.buffer, made.contentType);
    row = await prisma.shareBackground.update({ where: { id: row.id }, data: { status: 'DONE', imagePath: key } });
    return present(row);
  } catch (error) {
    // Refund first, then report: a reader is never charged for a picture they did not get.
    logger.warn({ err: error, userId: user.id, status: error.providerStatus }, 'share background failed');
    await aiWallet.credit({ userId: user.id, tokens: cost(), source: 'OTHER_AI_FEATURE', referenceId: row.id, note: 'Share Studio background refunded' })
      .catch((refundError) => logger.error({ err: refundError, rowId: row.id }, 'share background refund failed — needs a manual credit'));
    await prisma.shareBackground.update({ where: { id: row.id }, data: { status: 'FAILED', failReason: 'The picture could not be made' } }).catch(() => {});
    throw new AppError(502, 'IMAGE_FAILED', 'The picture could not be made — you have not been charged', { retryable: error.retryable !== false });
  }
}

/** The bytes of a finished background, only for the reader who made it. Null otherwise. */
export async function imageBytes(user, id) {
  const row = await prisma.shareBackground.findFirst({ where: { id, userId: user.id, status: 'DONE' }, select: { imagePath: true } });
  return row?.imagePath ? s3.getObjectBuffer(row.imagePath) : null;
}
