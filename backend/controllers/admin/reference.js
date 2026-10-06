// Reference data: deities, gurus, translators, languages, issues and FCM
// topics.
//
// Six tables that need exactly the same five handlers, so they are built from
// utils/crud.js rather than written out thirty times. Each still appears here
// under its own name, so the file you open to find "how do I edit deities" is
// the one you would guess.
//
// Anything with rules of its own — books, verses, mantras, slokas, money — has
// a hand-written controller instead.

import { prisma } from '../../config/database.js';
import { makeCrud } from '../../utils/crud.js';
import { ok } from '../../utils/respond.js';
import { badRequest } from '../../utils/errors.js';

export const deity = makeCrud({
  model: prisma.deity,
  entityType: 'Deity',
  searchFields: ['name', 'slug'],
  mediaFields: ['imagePath'],
});

export const guru = makeCrud({
  model: prisma.guru,
  entityType: 'Guru',
  searchFields: ['name', 'slug'],
  mediaFields: ['imagePath'],
});

export const translator = makeCrud({
  model: prisma.translator,
  entityType: 'Translator',
  searchFields: ['name', 'slug'],
  mediaFields: ['imagePath'],
  include: { _count: { select: { translations: true } } },
});

export const language = makeCrud({
  model: prisma.language,
  entityType: 'Language',
  searchFields: ['englishName', 'nativeName', 'code'],
  orderBy: [{ displayOrder: 'asc' }, { englishName: 'asc' }],
});

export const issue = makeCrud({
  model: prisma.issue,
  entityType: 'Issue',
  searchFields: ['name', 'slug'],
  mediaFields: ['imagePath'],
  include: { _count: { select: { verseLinks: true, reports: true } } },
});

export const topic = makeCrud({
  model: prisma.fcmTopic,
  entityType: 'FcmTopic',
  searchFields: ['name', 'key'],
  orderBy: [{ key: 'asc' }],
  include: { _count: { select: { subscriptions: true } } },
});

/**
 * GET /api/admin/reference/issues/coverage
 *
 * How many verses are mapped to each issue. Worth its own endpoint because an
 * issue with nothing mapped to it is a silent failure: a user reports it, the
 * picker finds nothing, and they get a fallback verse that has no connection to
 * what they said. Nothing else in the panel would show that.
 */
export const issueCoverage = async (req, res) => {
  const issues = await prisma.issue.findMany({
    where: { isPublished: true },
    orderBy: [{ category: 'asc' }, { displayOrder: 'asc' }],
    include: { _count: { select: { verseLinks: true, reports: true } } },
  });

  return ok(
    res,
    issues.map((issue) => ({
      id: issue.id,
      slug: issue.slug,
      name: issue.name,
      category: issue.category,
      mappedVerses: issue._count.verseLinks,
      timesReported: issue._count.reports,
      // Below this, the picker is choosing from too small a pool and people
      // will start seeing the same verse repeatedly.
      isThin: issue._count.verseLinks < 5,
    }))
  );
};

/**
 * DELETE guard for languages.
 * A language that users have selected cannot simply vanish — their profile
 * would point at a code that no longer exists. Deactivating it hides it from
 * the picker while leaving existing choices intact.
 */
export const deleteLanguage = async (req, res) => {
  const language = await prisma.language.findUnique({ where: { id: req.valid.params.id } });
  if (!language) throw badRequest('No such language');

  const inUse = await prisma.user.count({
    where: {
      OR: [
        { appLanguage: language.code },
        { mantraLanguage: language.code },
        { readingLanguage: language.code },
      ],
    },
  });

  if (inUse > 0) {
    throw badRequest(
      `${inUse} account(s) use ${language.englishName}. Deactivate it instead of deleting it.`
    );
  }

  await prisma.language.delete({ where: { id: language.id } });
  return ok(res, { deleted: true });
};
