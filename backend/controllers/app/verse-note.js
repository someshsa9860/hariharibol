// A reader's own notes against a verse. Always scoped to the signed-in
// reader — there is no public listing and no cross-user visibility, unlike
// VerseExplanation which is written once and shown to everyone.

import { prisma } from '../../config/database.js';
import { ok, created, noContent } from '../../utils/respond.js';
import { notFound } from '../../utils/errors.js';

/** GET /api/app/verse-notes?verseId= */
export const list = async (req, res) => {
  const notes = await prisma.verseNote.findMany({
    where: { userId: req.auth.user.id, verseId: req.valid.query.verseId },
    orderBy: { createdAt: 'desc' },
  });
  return ok(res, notes);
};

/** POST /api/app/verse-notes */
export const add = async (req, res) => {
  const { verseId, text } = req.valid.body;

  const verse = await prisma.verse.findUnique({ where: { id: verseId }, select: { id: true } });
  if (!verse) throw notFound('Verse');

  const note = await prisma.verseNote.create({
    data: { userId: req.auth.user.id, verseId, text },
  });
  return created(res, note);
};

/** PATCH /api/app/verse-notes/:id */
export const update = async (req, res) => {
  const { count } = await prisma.verseNote.updateMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id },
    data: { text: req.valid.body.text },
  });
  if (!count) throw notFound('Note');

  const note = await prisma.verseNote.findUnique({ where: { id: req.valid.params.id } });
  return ok(res, note);
};

/** DELETE /api/app/verse-notes/:id */
export const remove = async (req, res) => {
  const { count } = await prisma.verseNote.deleteMany({
    where: { id: req.valid.params.id, userId: req.auth.user.id },
  });
  if (!count) throw notFound('Note');
  return noContent(res);
};
