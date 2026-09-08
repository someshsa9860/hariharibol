// A CRUD builder for reference data — deities, gurus, languages, issues,
// translators, topics.
//
// This is the one place a factory earns its keep. Those six tables need exactly
// the same five handlers: list with a search box, read one, create, update,
// delete, each writing an audit row. Hand-writing thirty near-identical
// handlers would produce thirty places for the audit call to be forgotten in.
//
// It is deliberately narrow. Anything with real behaviour behind it — books,
// verses, mantras, slokas, payments — gets a hand-written controller, because
// the moment a resource has rules of its own a generic handler starts fighting
// them. If you find yourself adding options to this file, that is the signal
// the resource has outgrown it.

import * as audit from '../services/audit.js';
import * as s3 from '../services/s3.js';
import { ok, created, noContent, paginated } from './respond.js';
import { notFound } from './errors.js';
import { paginate } from './pagination.js';

/**
 * @param {object}   config
 * @param {function} config.model        the Prisma delegate, e.g. prisma.deity
 * @param {string}   config.entityType   what to record in the audit log
 * @param {string[]} [config.searchFields]  columns ?q= searches, case-insensitively
 * @param {object[]} [config.orderBy]
 * @param {string[]} [config.mediaFields]  `*Path` columns to sign on the way out
 * @param {object}   [config.include]
 */
function makeCrud(config) {
  const {
    model,
    entityType,
    searchFields = ['name'],
    orderBy = [{ displayOrder: 'asc' }, { createdAt: 'desc' }],
    mediaFields = [],
    include,
  } = config;

  const sign = (row) => (mediaFields.length ? s3.presignFields(row, mediaFields) : row);
  const signAll = (rows) => (mediaFields.length ? s3.presignList(rows, mediaFields) : rows);

  return {
    list: async (req, res) => {
      const q = req.valid.query.q;
      const where = q
        ? { OR: searchFields.map((field) => ({ [field]: { contains: q, mode: 'insensitive' } })) }
        : {};

      const { items, page } = await paginate(model, {
        where,
        orderBy,
        include,
        query: req.valid.query,
      });

      return paginated(res, await signAll(items), page);
    },

    get: async (req, res) => {
      const row = await model.findUnique({ where: { id: req.valid.params.id }, include });
      if (!row) throw notFound(entityType);
      return ok(res, await sign(row));
    },

    create: async (req, res) => {
      const row = await model.create({ data: req.valid.body });
      await audit.record(req, {
        action: `${entityType.toLowerCase()}.create`,
        entityType,
        entityId: row.id,
        after: req.valid.body,
      });
      return created(res, await sign(row));
    },

    update: async (req, res) => {
      const before = await model.findUnique({ where: { id: req.valid.params.id } });
      if (!before) throw notFound(entityType);

      const row = await model.update({ where: { id: before.id }, data: req.valid.body });

      // Only what actually changed is written to the audit log — see
      // services/audit.js. A full snapshot per edit grows faster than the data.
      await audit.record(req, {
        action: `${entityType.toLowerCase()}.update`,
        entityType,
        entityId: row.id,
        before,
        after: row,
      });

      return ok(res, await sign(row));
    },

    remove: async (req, res) => {
      const before = await model.findUnique({ where: { id: req.valid.params.id } });
      if (!before) throw notFound(entityType);

      await model.delete({ where: { id: before.id } });
      await audit.record(req, {
        action: `${entityType.toLowerCase()}.delete`,
        entityType,
        entityId: before.id,
        before,
      });

      return noContent(res);
    },
  };
}

export { makeCrud };
