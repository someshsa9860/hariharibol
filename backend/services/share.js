// Shared links: turn a verse, mantra or reel into an opaque code, and a code back into what a stranger may see.
//
// A link is per target, not per sender (ShareLink has @@unique([kind, targetId])), so a link names no one. What
// `resolve` returns is the *public* view only — a verse's text and reference, a mantra's name, a published reel's
// caption — which is exactly what the landing page and its Open Graph tags show. Unpublished things resolve as
// "missing", the same answer as a code that never existed, so the endpoint cannot be used to probe for drafts.

import { prisma } from '../config/database.js';
import * as s3 from './s3.js';
import { newCode, normaliseCode, isShareKind } from '../utils/share.js';
import { badRequest, notFound } from '../utils/errors.js';

const REEL_OK = { status: 'PUBLISHED', creator: { status: 'APPROVED' } };

/** The public view of a target, or null when it is not (or no longer) public. */
async function load(kind, targetId) {
  if (kind === 'SHLOKA') {
    const verse = await prisma.verse.findUnique({
      where: { verseId: targetId },
      include: {
        book: { select: { title: true, slug: true, isPublished: true } },
        translations: { where: { isPublished: true, languageCode: 'en' }, select: { meaning: true }, take: 1 },
      },
    });
    if (!verse || !verse.book.isPublished) return null;
    return {
      title: `${verse.book.title} ${verse.verseId}`,
      sanskrit: verse.sanskrit,
      transliteration: verse.transliteration,
      meaning: verse.translations[0]?.meaning ?? null,
      imageUrl: null,
      place: {
        bookSlug: verse.book.slug, cantoNumber: verse.cantoNumber, chapterNumber: verse.chapterNumber, verseNumber: verse.verseNumber,
        verseId: verse.verseId,
      },
    };
  }
  if (kind === 'MANTRA') {
    const mantra = await prisma.mantra.findFirst({
      where: { slug: targetId, isPublished: true },
      select: { name: true, description: true, sanskrit: true, slug: true },
    });
    if (!mantra) return null;
    return { title: mantra.name, sanskrit: mantra.sanskrit, transliteration: null, meaning: mantra.description, imageUrl: null, place: { slug: mantra.slug } };
  }
  const reel = await prisma.reel.findFirst({
    where: { id: targetId, ...REEL_OK },
    select: { id: true, caption: true, thumbnailPath: true },
  });
  if (!reel) return null;
  return {
    title: 'A reel on HariHarBol', sanskrit: null, transliteration: null, meaning: reel.caption,
    imageUrl: await s3.presignGet(reel.thumbnailPath), place: { reelId: reel.id },
  };
}

/** POST — find or make the link for a target. Refuses a target that is not public, so no code exists for a draft. */
export async function linkFor(kind, targetId) {
  if (!isShareKind(kind)) throw badRequest('Unknown kind of content');
  if (!(await load(kind, targetId))) throw notFound('Content');

  const existing = await prisma.shareLink.findUnique({ where: { kind_targetId: { kind, targetId } } });
  if (existing && !existing.revokedAt) return existing;

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.shareLink.upsert({
        where: { kind_targetId: { kind, targetId } },
        update: { revokedAt: null },
        create: { kind, targetId, code: newCode() },
      });
    } catch (error) {
      // A code collision (P2002 on `code`) is one in 30^10; try a fresh one. A race on (kind, targetId) is
      // won by whoever got there first, and the next findUnique returns theirs.
      if (error.code !== 'P2002') throw error;
      const raced = await prisma.shareLink.findUnique({ where: { kind_targetId: { kind, targetId } } });
      if (raced) return raced;
    }
  }
  throw new Error('could not make a share code');
}

/**
 * GET — a code to what it opens. `state` is 'ok', 'missing' (never existed, or not public) or 'gone' (revoked).
 * `kind` is checked against the path the link was opened on, so /shloka/<a mantra's code> is not a thing.
 */
export async function resolve(rawCode, expectedKind = null) {
  const code = normaliseCode(rawCode);
  if (!code) return { state: 'missing' };

  const link = await prisma.shareLink.findUnique({ where: { code } });
  if (!link || (expectedKind && link.kind !== expectedKind)) return { state: 'missing' };
  if (link.revokedAt) return { state: 'gone', kind: link.kind, code };

  const content = await load(link.kind, link.targetId);
  if (!content) return { state: 'gone', kind: link.kind, code };

  // Fire and forget: a counter must never slow or fail the page.
  prisma.shareLink.update({ where: { id: link.id }, data: { opens: { increment: 1 } } }).catch(() => {});

  return { state: 'ok', kind: link.kind, code, targetId: link.targetId, content };
}
