// Reference data — the lists the app fills its pickers and filters from.
//
// All of it is seeded and then managed from admin, which means adding a
// language or a deity is a data change rather than an app release. The app
// should read these rather than hardcoding anything.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as s3 from '../../services/s3.js';
import { ok } from '../../utils/respond.js';

/**
 * GET /api/app/reference/languages
 * Each language says which of the three slots it can be used for — Sanskrit is
 * a mantra language and not an app language, so the settings screen can grey
 * out what does not apply instead of accepting it and being refused later.
 */
export const languages = async (req, res) => {
  const languages = await prisma.language.findMany({
    where: { isActive: true },
    orderBy: [{ displayOrder: 'asc' }, { englishName: 'asc' }],
    select: {
      code: true,
      nativeName: true,
      englishName: true,
      isRtl: true,
      isAppLanguage: true,
      isMantraLanguage: true,
      isReadingLanguage: true,
    },
  });

  return ok(res, languages);
};

/** GET /api/app/reference/deities */
export const deities = async (req, res) => {
  const deities = await prisma.deity.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(res, await present.references(deities, req.auth.user));
};

/** GET /api/app/reference/gurus */
export const gurus = async (req, res) => {
  const gurus = await prisma.guru.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
  });
  return ok(res, await present.references(gurus, req.auth.user));
};

/**
 * GET /api/app/reference/translators
 * The acharyas and saints whose renderings we carry. Devotional commentators
 * only — the content rule for this project is that no academic or non-devotee
 * commentary is published, and it is enforced by what gets seeded here.
 */
export const translators = async (req, res) => {
  const translators = await prisma.translator.findMany({
    where: { isPublished: true },
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: {
      bookLinks: {
        include: { book: { select: { slug: true, title: true, bookNumber: true } } },
      },
    },
  });

  return ok(
    res,
    await Promise.all(
      translators.map(async (row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        bio: row.bio,
        sampradaya: row.sampradaya,
        imageUrl: row.imagePath ? await s3.presignGet(row.imagePath) : null,
        books: row.bookLinks.map((link) => ({
          ...link.book,
          seriesName: link.seriesName,
          isDefault: link.isDefault,
        })),
      }))
    )
  );
};
