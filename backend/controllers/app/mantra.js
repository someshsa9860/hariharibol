// Mantras.
//
// The response combines two different language choices, and that is the whole
// point of the model: the mantra's *script* comes from the user's
// mantraLanguage, what it *means* comes from their readingLanguage. Someone
// chanting in Devanagari while reading English is the ordinary case here, not
// an edge one. See utils/present.js for the resolution.

import { prisma } from '../../config/database.js';
import * as present from '../../utils/present.js';
import * as language from '../../utils/language.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound } from '../../utils/errors.js';

/** GET /api/app/mantras */
export const list = async (req, res) => {
  const { category, deity, guru, tag, q } = req.valid.query;
  const user = req.auth.user;

  const where = {
    isPublished: true,
    ...(category ? { category } : {}),
    ...(deity ? { deity: { slug: deity } } : {}),
    ...(guru ? { guru: { slug: guru } } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q ? { name: { contains: q, mode: 'insensitive' } } : {}),
  };

  const { items, page } = await paginate(prisma.mantra, {
    where,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: present.includes.mantra(language.mantraChain(user), language.readingChain(user)),
    query: req.valid.query,
  });

  return paginated(res, await present.mantras(items, user), page);
};

/** GET /api/app/mantras/:slug */
export const get = async (req, res) => {
  const user = req.auth.user;

  const mantra = await prisma.mantra.findFirst({
    where: { slug: req.valid.params.slug, isPublished: true },
    include: present.includes.mantra(language.mantraChain(user), language.readingChain(user)),
  });
  if (!mantra) throw notFound('Mantra');

  const shaped = await present.mantra(mantra, user);

  let isFavorite = false;
  let myRounds = 0;

  if (user) {
    const [favorite, chanted] = await Promise.all([
      prisma.favorite.findUnique({
        where: { userId_mantraId: { userId: user.id, mantraId: mantra.id } },
        select: { id: true },
      }),
      prisma.chantSession.aggregate({
        where: { userId: user.id, mantraId: mantra.id },
        _sum: { rounds: true },
      }),
    ]);
    isFavorite = Boolean(favorite);
    myRounds = chanted._sum.rounds || 0;
  }

  return ok(res, {
    ...shaped,
    // Which languages this mantra exists in at all, so the app can tell a
    // reader their chosen language is not available for this one rather than
    // silently showing them the fallback.
    availableLanguages: mantra.translations.map((t) => t.languageCode),
    isFavorite,
    myRounds,
  });
};

/** GET /api/app/mantras/categories — the category list, with counts. */
export const categories = async (req, res) => {
  const grouped = await prisma.mantra.groupBy({
    by: ['category'],
    where: { isPublished: true },
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });

  return ok(
    res,
    grouped.map((row) => ({ category: row.category, count: row._count._all }))
  );
};
