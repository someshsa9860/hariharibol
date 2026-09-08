// Writes AuditLog. RBAC on its own only records who *could* have done
// something; this records who did.
//
// Only the fields that changed are stored, not whole rows — a table of full
// before/after snapshots grows faster than the data it describes, and nobody
// ever reads it.

const { prisma } = require('../config/database');
const logger = require('../config/logger');

// Never written into an audit row, even when they changed.
const REDACTED = new Set(['tokenHash', 'password', 'providerPayload', 'value']);

function diff(before, after) {
  if (!before || !after) return { before: before || null, after: after || null };

  const changedBefore = {};
  const changedAfter = {};
  const fields = new Set([...Object.keys(before), ...Object.keys(after)]);

  for (const field of fields) {
    if (REDACTED.has(field)) continue;
    const a = before[field];
    const b = after[field];
    if (JSON.stringify(a) === JSON.stringify(b)) continue;
    changedBefore[field] = a ?? null;
    changedAfter[field] = b ?? null;
  }

  return { before: changedBefore, after: changedAfter };
}

// Never throws. An audit write failing must not fail the action it describes —
// the action already happened, and losing the log is the smaller problem.
async function record(req, entry) {
  const { action, entityType, entityId, before, after } = entry;
  try {
    const changes = diff(before, after);
    await prisma.auditLog.create({
      data: {
        actorId: req?.auth?.user?.id || null,
        action,
        entityType,
        entityId: entityId || null,
        before: changes.before,
        after: changes.after,
        ipAddress: req?.ip ? String(req.ip).slice(0, 45) : null,
        userAgent: req?.get ? req.get('User-Agent') : null,
      },
    });
  } catch (err) {
    logger.error({ err: err.message, action, entityType, entityId }, 'audit write failed');
  }
}

module.exports = { record, diff };
