// Mantras and their per-language renderings.

const { prisma } = require('../../config/database');
const audit = require('../../services/audit');
const s3 = require('../../services/s3');
const { ok, created, noContent, paginated } = require('../../utils/respond');
const { paginate } = require('../../utils/pagination');
const { notFound, badRequest } = require('../../utils/errors');

/** GET /api/admin/mantras */
exports.list = async (req, res) => {
  const { q, category, isPublished } = req.valid.query;

  const { items, page } = await paginate(prisma.mantra, {
    where: {
      ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
      ...(category ? { category } : {}),
      ...(isPublished !== undefined ? { isPublished } : {}),
    },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      deity: { select: { slug: true, name: true } },
      guru: { select: { slug: true, name: true } },
      _count: { select: { translations: true } },
    },
    query: req.valid.query,
  });

  return paginated(res, await s3.presignList(items, ['audioPath']), page);
};

/** GET /api/admin/mantras/:id */
exports.get = async (req, res) => {
  const mantra = await prisma.mantra.findUnique({
    where: { id: req.valid.params.id },
    include: { deity: true, guru: true, translations: { orderBy: { languageCode: 'asc' } } },
  });
  if (!mantra) throw notFound('Mantra');

  return ok(res, {
    ...(await s3.presignFields(mantra, ['audioPath'])),
    translations: await s3.presignList(mantra.translations, ['audioPath']),
  });
};

exports.create = async (req, res) => {
  const mantra = await prisma.mantra.create({ data: req.valid.body });
  await audit.record(req, {
    action: 'mantra.create',
    entityType: 'Mantra',
    entityId: mantra.id,
    after: req.valid.body,
  });
  return created(res, mantra);
};

exports.update = async (req, res) => {
  const before = await prisma.mantra.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Mantra');

  const mantra = await prisma.mantra.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, {
    action: 'mantra.update',
    entityType: 'Mantra',
    entityId: mantra.id,
    before,
    after: mantra,
  });

  return ok(res, mantra);
};

/**
 * POST /api/admin/mantras/:id/publish
 *
 * Audio is checked before publishing, not just its presence in the column. A
 * mantra whose audio key points at nothing shows a play button that does
 * nothing, which is worse than a mantra with no audio at all — the reader
 * cannot tell whether it is their connection or ours.
 */
exports.publish = async (req, res) => {
  const { isPublished } = req.valid.body;

  const mantra = await prisma.mantra.findUnique({
    where: { id: req.valid.params.id },
    include: { _count: { select: { translations: true } } },
  });
  if (!mantra) throw notFound('Mantra');

  if (isPublished) {
    if (!mantra.audioPath) throw badRequest('Upload the recitation audio before publishing');
    const audioExists = await s3.objectExists(mantra.audioPath);
    if (!audioExists) throw badRequest('The audio file is missing from storage');
    if (!mantra.durationMs) {
      throw badRequest('Set the approximate duration — the in-app chant pacing needs it');
    }
    if (mantra._count.translations === 0) {
      throw badRequest('Add at least one language rendering before publishing');
    }
  }

  const updated = await prisma.mantra.update({ where: { id: mantra.id }, data: { isPublished } });

  await audit.record(req, {
    action: isPublished ? 'mantra.publish' : 'mantra.unpublish',
    entityType: 'Mantra',
    entityId: mantra.id,
    after: { isPublished },
  });

  return ok(res, updated);
};

exports.remove = async (req, res) => {
  const mantra = await prisma.mantra.findUnique({ where: { id: req.valid.params.id } });
  if (!mantra) throw notFound('Mantra');
  if (mantra.isPublished) throw badRequest('Unpublish the mantra before deleting it');

  await prisma.mantra.delete({ where: { id: mantra.id } });
  await audit.record(req, {
    action: 'mantra.delete',
    entityType: 'Mantra',
    entityId: mantra.id,
    before: { slug: mantra.slug },
  });

  return noContent(res);
};

/**
 * PUT /api/admin/mantras/:id/translations
 * One language's rendering. `text` is what someone chanting in that script
 * reads; `meaning` is what someone reading in that language sees — the app
 * selects the two by different user settings, so both belong on this row.
 */
exports.upsertTranslation = async (req, res) => {
  const { languageCode } = req.valid.body;
  const mantraId = req.valid.params.id;

  const mantra = await prisma.mantra.findUnique({ where: { id: mantraId }, select: { id: true } });
  if (!mantra) throw notFound('Mantra');

  const translation = await prisma.mantraTranslation.upsert({
    where: { mantraId_languageCode: { mantraId, languageCode } },
    update: req.valid.body,
    create: { ...req.valid.body, mantraId },
  });

  await audit.record(req, {
    action: 'mantra.translation.upsert',
    entityType: 'MantraTranslation',
    entityId: translation.id,
    after: { mantraId, languageCode },
  });

  return ok(res, translation);
};

exports.deleteTranslation = async (req, res) => {
  await prisma.mantraTranslation.delete({ where: { id: req.valid.params.translationId } });
  return noContent(res);
};
