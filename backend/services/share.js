// Share links: turning a piece of content into a public code, and a public code
// back into content that is safe to show to anyone.
//
// The resolver is the only place that decides what a stranger may see. It answers
// from the canonical records every time (a link keeps no copy of the text), and
// it says `status` rather than throwing for a link that used to work, so a page
// can tell "never existed" from "taken down".

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import * as present from '../utils/present.js';
import * as s3 from './s3.js';
import { CONTENT_ROUTES, CODE_PATTERN, contentUrl, newCode } from '../utils/share.js';
import { badRequest, notFound } from '../utils/errors.js';

const TARGET_PATTERN = {
  VERSE: /^\d+(\.\d+){1,3}(-\d+)?$/,
  MANTRA: /^[a-z0-9][a-z0-9-]{0,99}$/,
  REEL: /^[a-z0-9]{20,30}$/,
};

/** Does this content exist, and may it be shown to anyone? */
async function isPublic(type, targetId) {
  if (type === 'VERSE') {
    const row = await prisma.verse.findUnique({ where: { verseId: targetId }, select: { book: { select: { isPublished: true } } } });
    return Boolean(row?.book.isPublished);
  }
  if (type === 'MANTRA') {
    return Boolean(await prisma.mantra.findFirst({ where: { slug: targetId, isPublished: true }, select: { id: true } }));
  }
  return Boolean(await prisma.reel.findFirst({ where: { id: targetId, status: 'PUBLISHED' }, select: { id: true } }));
}

/**
 * The code for this user sharing this content. Sharing the same thing twice
 * gives the same link, so a link shared in two groups counts as one.
 */
export async function linkFor({ userId, type, targetId }) {
  if (!CONTENT_ROUTES[type]) throw badRequest('Unknown content type');
  if (!TARGET_PATTERN[type].test(targetId)) throw badRequest('That is not a valid id for this kind of content');
  if (!(await isPublic(type, targetId))) throw notFound('Content');

  const existing = await prisma.shareLink.findFirst({
    where: { createdById: userId, type, targetId, revokedAt: null },
    select: { code: true },
  });
  const code = existing?.code
    || (await createWithFreshCode({ type, targetId, createdById: userId })).code;

  return { code, type, url: contentUrl(env.WEB_BASE_URL, type, code) };
}

async function createWithFreshCode(data) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      return await prisma.shareLink.create({ data: { ...data, code: newCode() }, select: { code: true } });
    } catch (err) {
      if (err.code !== 'P2002') throw err; // a collision on `code`: draw another
    }
  }
  throw new Error('could not find a free share code');
}

const gone = (status) => ({ status });

/**
 * What a visitor sees for a code. `status` is one of
 * `ok | not_found | revoked | unavailable`. Counts a visit on `ok`.
 */
export async function resolve(code, type, { language = 'en', count = true } = {}) {
  if (!CODE_PATTERN.test(code)) return gone('not_found');
  const link = await prisma.shareLink.findUnique({ where: { code } });
  // A code opened under the wrong path (a reel code on /shloka) is not a link.
  if (!link || link.type !== type) return gone('not_found');
  if (link.revokedAt) return gone('revoked');

  const content = await load(link.type, link.targetId, language);
  if (!content) return gone('unavailable');

  if (count) prisma.shareLink.update({ where: { id: link.id }, data: { clicks: { increment: 1 } } }).catch(() => {});

  return {
    status: 'ok',
    type: link.type,
    code: link.code,
    canonicalUrl: contentUrl(env.WEB_BASE_URL, link.type, link.code),
    ...content,
  };
}

async function load(type, targetId, language) {
  const reader = { appLanguage: language, readingLanguage: language, mantraLanguage: 'sa' };

  if (type === 'VERSE') {
    const verse = await prisma.verse.findUnique({
      where: { verseId: targetId },
      include: {
        book: { select: { slug: true, title: true, bookNumber: true, isPublished: true, recitationParent: true } },
        chapter: { select: { number: true, title: true } },
        translations: { where: { isPublished: true }, include: { translator: { select: { slug: true, name: true } } }, orderBy: { displayOrder: 'asc' } },
        explanations: { where: { isPublished: true } },
      },
    });
    if (!verse?.book.isPublished) return null;
    const shown = await present.verse(verse, reader);
    return {
      title: `${verse.book.title} ${verse.verseId}`,
      reference: verse.book.title,
      verseId: verse.verseId,
      sanskrit: shown.sanskrit,
      transliteration: shown.transliteration,
      text: shown.translation?.meaning || null,
      language: shown.translation?.languageCode || 'en',
      // No purport and no audio: a share page quotes, it does not republish a book.
      imageUrl: null,
      continuePath: `/verse/${verse.verseId}`,
    };
  }

  if (type === 'MANTRA') {
    const mantra = await prisma.mantra.findFirst({
      where: { slug: targetId, isPublished: true },
      select: { name: true, slug: true, description: true, sanskrit: true, transliteration: true },
    });
    if (!mantra) return null;
    return {
      title: mantra.name,
      reference: 'Mantra',
      sanskrit: mantra.sanskrit,
      transliteration: mantra.transliteration,
      text: mantra.description,
      language: 'en',
      imageUrl: null,
      continuePath: `/jap/${mantra.slug}`,
    };
  }

  const reel = await prisma.reel.findFirst({
    where: { id: targetId, status: 'PUBLISHED' },
    select: { id: true, caption: true, thumbnailPath: true, creator: { select: { displayName: true } } },
  });
  if (!reel) return null;
  return {
    title: reel.caption ? reel.caption.slice(0, 80) : 'A reel on HariHariBol',
    reference: reel.creator?.displayName ? `By ${reel.creator.displayName}` : 'Reel',
    sanskrit: null,
    transliteration: null,
    text: reel.caption,
    language: 'en',
    imageUrl: reel.thumbnailPath ? await s3.presignGet(reel.thumbnailPath) : null,
    continuePath: `/reels/${reel.id}`,
  };
}
