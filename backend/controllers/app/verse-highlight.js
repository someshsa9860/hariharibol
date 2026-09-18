// Whole-verse highlights. Shape mirrors controllers/app/favorite.js
// deliberately — both are per-user-per-verse toggles — but the two stay
// separate models because they answer different questions: a favourite is
// "save this for later", a highlight is "this matters, right here".

import { prisma } from '../../config/database.js';
import { created, noContent } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/** POST /api/app/verse-highlights */
export const add = async (req, res) => {
  const user = req.auth.user;
  const { verseId } = req.valid.body;

  const verse = await prisma.verse.findUnique({ where: { id: verseId }, select: { id: true } });
  if (!verse) throw notFound('Verse');

  const highlight = await prisma.verseHighlight.upsert({
    where: { userId_verseId: { userId: user.id, verseId } },
    update: {},
    create: { userId: user.id, verseId },
  });

  return created(res, highlight);
};

/** DELETE /api/app/verse-highlights/:id */
export const remove = async (req, res) => {
  const { count } = await prisma.verseHighlight.deleteMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id },
  });
  if (!count) throw notFound('Highlight');
  return noContent(res);
};
