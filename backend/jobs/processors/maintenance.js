// Housekeeping.
//
// Three tables grow forever if nothing prunes them, and all three are diagnostic
// rather than operational — losing an old row costs nothing, keeping every row
// eventually costs a slow query on a screen someone opens daily.
//
// Retention is deliberately generous. Disk is cheaper than the afternoon spent
// wishing the log went back further.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import * as s3 from '../../services/s3.js';

const RETENTION_DAYS = {
  // Who changed what. The longest, because this is the one that answers
  // questions nobody thought to ask at the time.
  auditLog: 365,
  // Spend per call. A year covers any billing question worth asking.
  aiUsageLog: 365,
  // Read notifications. The unread ones are never pruned — an unread message is
  // still waiting to be read, however old.
  notification: 180,
  // Spent and revoked refresh tokens. Live ones are untouched.
  refreshToken: 30,
};

const cutoff = (days) => new Date(Date.now() - days * 86400000);

export default async function maintenanceProcessor(job) {
  // The transcript sweep is daily where everything below is weekly, and shares
  // the queue — so it is told apart by name rather than run with the rest.
  if (job.name === 'chant.transcripts.prune') {
    const count = (await prisma.chantTapTranscript.deleteMany({ where: { expiresAt: { lt: new Date() } } }))
      .count;
    logger.info({ count }, 'chant transcript prune finished');
    return { chantTranscript: count };
  }

  // Monthly: uploads that were never saved onto a row. Anything younger than a
  // month is kept — a form left open over a weekend must still be saveable.
  if (job.name === 's3.temp.prune') {
    const { deleted } = await s3.pruneTemp(cutoff(30));
    logger.info({ deleted }, 's3 temp prune finished');
    return { s3Temp: deleted };
  }

  const results = {};

  results.auditLog = (
    await prisma.auditLog.deleteMany({ where: { createdAt: { lt: cutoff(RETENTION_DAYS.auditLog) } } })
  ).count;

  results.aiUsageLog = (
    await prisma.aiUsageLog.deleteMany({
      where: { createdAt: { lt: cutoff(RETENTION_DAYS.aiUsageLog) } },
    })
  ).count;

  results.notification = (
    await prisma.notification.deleteMany({
      where: { readAt: { not: null }, createdAt: { lt: cutoff(RETENTION_DAYS.notification) } },
    })
  ).count;

  // Tokens that are already dead — rotated, revoked, or past their expiry.
  // A live refresh token is never touched here; that would sign people out.
  results.refreshToken = (
    await prisma.refreshToken.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { rotatedAt: { lt: cutoff(RETENTION_DAYS.refreshToken) } },
          { revokedAt: { lt: cutoff(RETENTION_DAYS.refreshToken) } },
        ],
      },
    })
  ).count;

  // Devices nobody has opened in a year, with no account attached. A device row
  // that belongs to a user is kept regardless — it is part of their record.
  results.device = (
    await prisma.device.deleteMany({
      where: { userId: null, lastSeenAt: { lt: cutoff(365) } },
    })
  ).count;

  logger.info(results, 'maintenance prune finished');
  return results;
};
