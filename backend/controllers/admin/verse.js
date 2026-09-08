// Verses and everything attached to them — translations, explanations,
// narrations, cross-links, and the sloka-eligible flag.
//
// Two rules run through this file:
//
//   1. `verseId` is immutable. It is the dotted key baked into the scraped
//      source files and used by every deeplink, bookmark and share. Editing one
//      silently breaks links that already exist.
//   2. VerseTranslation and VerseExplanation are never mixed. The first is an
//      acharya's rendering; the second is ours, or the AI's. Keeping them in
//      separate tables is what makes it impossible for generated text to appear
//      under an acharya's name, and that separation is the point — not an
//      implementation detail to tidy away later.

const { prisma } = require('../../config/database');
const audit = require('../../services/audit');
const s3 = require('../../services/s3');
const { ok, created, noContent, paginated } = require('../../utils/respond');
const { paginate } = require('../../utils/pagination');
const { notFound, badRequest } = require('../../utils/errors');
const { SLOKA_ELIGIBLE_BOOK_NUMBERS } = require('../../config/constants');

/** GET /api/admin/verses */
exports.list = async (req, res) => {
  const { q, bookId, canto, chapter, isSlokaEligible, untranslated } = req.valid.query;

  const { items, page } = await paginate(prisma.verse, {
    where: {
      ...(bookId ? { bookId } : {}),
      ...(canto ? { cantoNumber: canto } : {}),
      ...(chapter ? { chapterNumber: chapter } : {}),
      ...(isSlokaEligible !== undefined ? { isSlokaEligible } : {}),
      // The editorial worklist: what still has no published rendering at all.
      ...(untranslated ? { translations: { none: { isPublished: true } } } : {}),
      ...(q
        ? {
            OR: [
              { verseId: { contains: q } },
              { sanskrit: { contains: q, mode: 'insensitive' } },
              { transliteration: { contains: q, mode: 'insensitive' } },
            ],
          }
        : {}),
    },
    orderBy: [{ bookNumber: 'asc' }, { cantoNumber: 'asc' }, { chapterNumber: 'asc' }, { verseNumber: 'asc' }],
    include: {
      book: { select: { slug: true, title: true } },
      _count: { select: { translations: true, explanations: true, narrations: true, issueLinks: true } },
    },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/** GET /api/admin/verses/:verseId — everything attached, published or not. */
exports.get = async (req, res) => {
  const verse = await prisma.verse.findUnique({
    where: { verseId: req.valid.params.verseId },
    include: {
      book: { select: { id: true, slug: true, title: true, bookNumber: true } },
      chapter: { select: { id: true, number: true, title: true } },
      translations: { include: { translator: { select: { slug: true, name: true } } } },
      explanations: true,
      narrations: { include: { guru: { select: { slug: true, name: true } } } },
      issueLinks: { include: { issue: { select: { slug: true, name: true, category: true } } } },
      linksFrom: { include: { targetVerse: { select: { verseId: true } } } },
    },
  });
  if (!verse) throw notFound('Verse');

  return ok(res, await s3.presignFields(verse, ['audioPath']));
};

/** POST /api/admin/verses */
exports.create = async (req, res) => {
  const body = req.valid.body;

  const book = await prisma.book.findUnique({ where: { id: body.bookId } });
  if (!book) throw notFound('Book');

  const verse = await prisma.verse.create({
    data: { ...body, bookNumber: book.bookNumber },
  });

  await audit.record(req, {
    action: 'verse.create',
    entityType: 'Verse',
    entityId: verse.id,
    after: { verseId: verse.verseId },
  });

  return created(res, verse);
};

/** PATCH /api/admin/verses/:verseId */
exports.update = async (req, res) => {
  const before = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!before) throw notFound('Verse');

  if (req.valid.body.verseId && req.valid.body.verseId !== before.verseId) {
    throw badRequest('verseId cannot be changed — deeplinks and bookmarks already point at it');
  }

  const verse = await prisma.verse.update({ where: { id: before.id }, data: req.valid.body });
  await audit.record(req, {
    action: 'verse.update',
    entityType: 'Verse',
    entityId: verse.id,
    before,
    after: verse,
  });

  return ok(res, verse);
};

/** DELETE /api/admin/verses/:verseId */
exports.remove = async (req, res) => {
  const verse = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!verse) throw notFound('Verse');

  await prisma.verse.delete({ where: { id: verse.id } });
  await audit.record(req, {
    action: 'verse.delete',
    entityType: 'Verse',
    entityId: verse.id,
    before: { verseId: verse.verseId },
  });

  return noContent(res);
};

/**
 * POST /api/admin/verses/sloka-eligibility
 *
 * Marks verses as usable for the daily and personalised sloka. Bulk, because
 * curating this pool is done a chapter at a time rather than one verse at a
 * time.
 *
 * Only the Gita and the Bhagavatam are ever eligible. A short work — an aarti,
 * a stotra — is not something to hand someone as the verse for their day, and
 * the restriction is enforced here rather than trusted to whoever is clicking.
 */
exports.setSlokaEligibility = async (req, res) => {
  const { verseIds, isSlokaEligible } = req.valid.body;

  const verses = await prisma.verse.findMany({
    where: { verseId: { in: verseIds } },
    select: { id: true, verseId: true, bookNumber: true },
  });

  const missing = verseIds.filter((id) => !verses.some((v) => v.verseId === id));
  if (missing.length) throw notFound(`Verses: ${missing.slice(0, 5).join(', ')}`);

  if (isSlokaEligible) {
    const ineligible = verses.filter((v) => !SLOKA_ELIGIBLE_BOOK_NUMBERS.includes(v.bookNumber));
    if (ineligible.length) {
      throw badRequest(
        `Only Bhagavad Gita and Srimad Bhagavatam verses can be slokas. Rejected: ${ineligible
          .map((v) => v.verseId)
          .slice(0, 5)
          .join(', ')}`
      );
    }
  }

  const updated = await prisma.verse.updateMany({
    where: { id: { in: verses.map((v) => v.id) } },
    data: { isSlokaEligible },
  });

  await audit.record(req, {
    action: 'verse.sloka-eligibility',
    entityType: 'Verse',
    after: { count: updated.count, isSlokaEligible },
  });

  return ok(res, { updated: updated.count });
};

// ── Translations ───────────────────────────────────────────────────────────

/** PUT /api/admin/verses/:verseId/translations — create or replace one rendering. */
exports.upsertTranslation = async (req, res) => {
  const { translatorId, languageCode, type = 'TRANSLATION' } = req.valid.body;

  const verse = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!verse) throw notFound('Verse');

  const translation = await prisma.verseTranslation.upsert({
    where: {
      verseId_translatorId_languageCode_type: {
        verseId: verse.id,
        translatorId,
        languageCode,
        type,
      },
    },
    update: req.valid.body,
    create: { ...req.valid.body, verseId: verse.id, type },
  });

  await audit.record(req, {
    action: 'verse.translation.upsert',
    entityType: 'VerseTranslation',
    entityId: translation.id,
    after: { verseId: verse.verseId, translatorId, languageCode, type },
  });

  return ok(res, translation);
};

exports.deleteTranslation = async (req, res) => {
  await prisma.verseTranslation.delete({ where: { id: req.valid.params.translationId } });
  await audit.record(req, {
    action: 'verse.translation.delete',
    entityType: 'VerseTranslation',
    entityId: req.valid.params.translationId,
  });
  return noContent(res);
};

// ── Explanations ───────────────────────────────────────────────────────────

/**
 * PUT /api/admin/verses/:verseId/explanation
 * App-written or AI-generated. Written once per language and reused by every
 * reader shown that verse — never stored as a translation, so it can never be
 * mistaken for something an acharya said.
 */
exports.upsertExplanation = async (req, res) => {
  const { languageCode, text, source = 'MANUAL', isPublished } = req.valid.body;

  const verse = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!verse) throw notFound('Verse');

  const explanation = await prisma.verseExplanation.upsert({
    where: { verseId_languageCode: { verseId: verse.id, languageCode } },
    update: { text, source, isPublished },
    create: { verseId: verse.id, languageCode, text, source, isPublished },
  });

  await audit.record(req, {
    action: 'verse.explanation.upsert',
    entityType: 'VerseExplanation',
    entityId: explanation.id,
    after: { verseId: verse.verseId, languageCode, source },
  });

  return ok(res, explanation);
};

// ── Narrations ─────────────────────────────────────────────────────────────

exports.createNarration = async (req, res) => {
  const verse = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!verse) throw notFound('Verse');

  const narration = await prisma.narration.create({
    data: { ...req.valid.body, verseId: verse.id },
  });

  await audit.record(req, {
    action: 'narration.create',
    entityType: 'Narration',
    entityId: narration.id,
    after: { verseId: verse.verseId },
  });

  return created(res, narration);
};

exports.updateNarration = async (req, res) => {
  const narration = await prisma.narration.update({
    where: { id: req.valid.params.narrationId },
    data: req.valid.body,
  });
  return ok(res, narration);
};

exports.deleteNarration = async (req, res) => {
  await prisma.narration.delete({ where: { id: req.valid.params.narrationId } });
  return noContent(res);
};

// ── Cross-links ────────────────────────────────────────────────────────────

/**
 * POST /api/admin/verses/:verseId/links
 * Links are directional — "expands on" does not read the same in reverse, so
 * A→B and B→A are separate rows and the editor decides whether both exist.
 */
exports.createLink = async (req, res) => {
  const { targetVerseId, relation, note } = req.valid.body;

  const [source, target] = await Promise.all([
    prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } }),
    prisma.verse.findUnique({ where: { verseId: targetVerseId } }),
  ]);

  if (!source) throw notFound('Source verse');
  if (!target) throw notFound('Target verse');
  if (source.id === target.id) throw badRequest('A verse cannot link to itself');

  const link = await prisma.verseLink.create({
    data: { sourceVerseId: source.id, targetVerseId: target.id, relation, note },
  });

  return created(res, link);
};

exports.deleteLink = async (req, res) => {
  await prisma.verseLink.delete({ where: { id: req.valid.params.linkId } });
  return noContent(res);
};

// ── Verse ↔ issue mapping ──────────────────────────────────────────────────

/**
 * PUT /api/admin/verses/:verseId/issues
 *
 * The table the personalised sloka actually reads. `weight` decides which verse
 * wins when several speak to the same struggle.
 *
 * This is the highest-leverage editorial surface in the system and the one
 * worth curating by hand: a handful of well-chosen verses per issue does more
 * than a complete but careless mapping of all 18,700. A wrong sloka for someone
 * in the middle of krodha is worse than no personalisation at all.
 */
exports.setIssues = async (req, res) => {
  const { issues } = req.valid.body;

  const verse = await prisma.verse.findUnique({ where: { verseId: req.valid.params.verseId } });
  if (!verse) throw notFound('Verse');

  const issueRows = await prisma.issue.findMany({
    where: { slug: { in: issues.map((i) => i.slug) } },
  });
  const bySlug = new Map(issueRows.map((row) => [row.slug, row]));

  const unknown = issues.filter((i) => !bySlug.has(i.slug));
  if (unknown.length) throw badRequest(`Unknown issues: ${unknown.map((i) => i.slug).join(', ')}`);

  await prisma.$transaction([
    prisma.verseIssue.deleteMany({ where: { verseId: verse.id } }),
    prisma.verseIssue.createMany({
      data: issues.map((i) => ({
        verseId: verse.id,
        issueId: bySlug.get(i.slug).id,
        weight: i.weight ?? 50,
      })),
    }),
  ]);

  await audit.record(req, {
    action: 'verse.issues.set',
    entityType: 'Verse',
    entityId: verse.id,
    after: { verseId: verse.verseId, issues },
  });

  return ok(res, { verseId: verse.verseId, issues });
};
