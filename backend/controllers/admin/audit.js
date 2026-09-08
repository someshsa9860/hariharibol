// The audit log — who changed what.

const { prisma } = require('../../config/database');
const { ok, paginated } = require('../../utils/respond');
const { paginate } = require('../../utils/pagination');

/** GET /api/admin/audit */
exports.list = async (req, res) => {
  const { actorId, action, entityType, entityId, from, to } = req.valid.query;

  const { items, page } = await paginate(prisma.auditLog, {
    where: {
      ...(actorId ? { actorId } : {}),
      ...(action ? { action: { startsWith: action } } : {}),
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
            },
          }
        : {}),
    },
    orderBy: { createdAt: 'desc' },
    include: { actor: { select: { id: true, name: true, email: true } } },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/**
 * GET /api/admin/audit/entity/:entityType/:entityId
 * Everything that has happened to one record, oldest first — the history of a
 * book, a user, a plan.
 */
exports.forEntity = async (req, res) => {
  const { entityType, entityId } = req.valid.params;

  const entries = await prisma.auditLog.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: 'asc' },
    include: { actor: { select: { id: true, name: true, email: true } } },
  });

  return ok(res, entries);
};

/** GET /api/admin/audit/actions — the distinct action names, for the filter dropdown. */
exports.actions = async (req, res) => {
  const rows = await prisma.auditLog.groupBy({
    by: ['action'],
    _count: { _all: true },
    orderBy: { _count: { action: 'desc' } },
    take: 100,
  });

  return ok(res, rows.map((row) => ({ action: row.action, count: row._count._all })));
};
