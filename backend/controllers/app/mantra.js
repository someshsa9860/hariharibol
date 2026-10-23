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
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';
import { notFound } from '../../utils/errors.js';
import { visibleTo } from '../../utils/mantra-visibility.js';
import * as userMantra from '../../services/user-mantra.js';

/** GET /api/app/mantras */
export const list = async (req, res) => {
  const { category, deity, guru, tag, q } = req.valid.query;
  const user = req.auth.user;
  const readingChain = language.readingChain(user);

  // The catalogue, plus the private mantras this reader added (put first by their display order).
  const where = {
    AND: [visibleTo(user)],
    ...(category ? { category } : {}),
    ...(deity ? { deity: { slug: deity } } : {}),
    ...(guru ? { guru: { slug: guru } } : {}),
    ...(tag ? { tags: { has: tag } } : {}),
    ...(q ? { OR: language.mantraNameClauses(q, readingChain) } : {}),
  };

  const { items, page } = await paginate(prisma.mantra, {
    where,
    orderBy: [{ displayOrder: 'asc' }, { name: 'asc' }],
    include: present.includes.mantra(language.mantraTextChain(user), readingChain),
    query: req.valid.query,
  });

  return paginated(res, await present.mantras(items, user), page);
};

/** GET /api/app/mantras/:slug */
export const get = async (req, res) => {
  const user = req.auth.user;

  const mantra = await prisma.mantra.findFirst({
    // Another reader's private mantra is no more found than one that does not exist.
    where: { slug: req.valid.params.slug, AND: [visibleTo(user)] },
    include: present.includes.mantra(language.mantraTextChain(user), language.readingChain(user)),
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
    where: visibleTo(req.auth.user),
    _count: { _all: true },
    orderBy: { category: 'asc' },
  });

  return ok(
    res,
    grouped.map((row) => ({ category: row.category, count: row._count._all }))
  );
};

// ── Mantras the reader adds themselves (services/user-mantra.js) ───────────

/** The mantras with these ids, presented for `user`, by id. */
async function presentedById(ids, user) {
  const rows = ids.length
    ? await prisma.mantra.findMany({
        where: { id: { in: ids } },
        include: present.includes.mantra(language.mantraTextChain(user), language.readingChain(user)),
      })
    : [];
  const shaped = await present.mantras(rows, user);
  return new Map(shaped.map((mantra) => [mantra.id, mantra]));
}

/** POST /api/app/mantras/own/suggest — what the reader typed or said → mantras to choose from. */
export const suggestOwn = async (req, res) => {
  return ok(res, await userMantra.suggest(req.auth.user, req.valid.body.text));
};

/** POST /api/app/mantras/own — the chosen suggestions → saved (or shared), each with the mantra as the app shows it. */
export const createOwn = async (req, res) => {
  const user = req.auth.user;
  const { items } = await userMantra.create(user, req.valid.body);

  const byId = await presentedById(items.map((item) => item.mantraId).filter(Boolean), user);
  return created(res, {
    items: items.map(({ index, status, mantraId }) => ({ index, status, mantra: byId.get(mantraId) ?? null })),
  });
};

/** PUT /api/app/mantras/own/:slug/image — the body is the picture. */
export const changeOwnImage = async (req, res) => {
  const user = req.auth.user;
  const mantraId = await userMantra.changeImage(user, req.valid.params.slug, req.body);

  const byId = await presentedById([mantraId], user);
  return ok(res, byId.get(mantraId));
};

/** DELETE /api/app/mantras/own/:slug — take a private mantra off the reader's list. */
export const leaveOwn = async (req, res) => {
  await userMantra.leave(req.auth.user, req.valid.params.slug);
  return noContent(res);
};
