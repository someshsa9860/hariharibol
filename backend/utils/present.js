// Turns database rows into the shape the clients consume.
//
// Two things have to happen to almost every content row before it leaves, and
// both are easy to forget one endpoint at a time:
//
//   1. Language resolution. A verse or mantra carries renderings in several
//      languages; which one a user sees depends on their three settings and the
//      fallback order between them.
//   2. Media signing. Every `*Path` column is a private S3 key. Returning it
//      raw gives the client something it cannot fetch.
//
// This is shaping, not business logic — controllers still own what to fetch and
// what to write. It lives in utils/ rather than services/ because it holds no
// state and talks to nothing.

import * as s3 from '../services/s3.js';
import * as language from './language.js';
import { DEFAULT_LANGUAGE } from '../config/constants.js';

// Prisma `include` blocks for the joins a shaped verse needs. Kept next to the
// shaping code so the two cannot drift — a shape that reads `verse.translations`
// only works if the query asked for them.
const includes = {
  /**
   * `userId` is optional — a signed-out reader gets the content joins only,
   * the same shape as before. Signed in, this is what lets the chapter
   * reading screen show favourite/highlight/note state and whether "related
   * verses" has anything behind it, without a second round trip per verse.
   */
  verse: (readingChain, userId) => ({
    book: { select: { id: true, slug: true, title: true, bookNumber: true, type: true } },
    chapter: { select: { id: true, number: true, title: true } },
    translations: {
      where: { isPublished: true, languageCode: { in: readingChain } },
      include: { translator: { select: { id: true, slug: true, name: true, imagePath: true } } },
      orderBy: { displayOrder: 'asc' },
    },
    explanations: { where: { isPublished: true, languageCode: { in: readingChain } } },
    _count: { select: { linksFrom: true } },
    ...(userId
      ? {
          favorites: { where: { userId }, select: { id: true } },
          highlights: { where: { userId }, select: { id: true } },
          notes: { where: { userId }, select: { id: true } },
        }
      : {}),
  }),

  /**
   * Everything a shaped reel reads. `userId` is required rather than optional
   * — unlike a verse, a reel is never served to a signed-out reader, and the
   * like/save/follow flags are what the action rail renders from.
   */
  reel: (userId, readingChain = [DEFAULT_LANGUAGE]) => ({
    creator: {
      select: {
        id: true,
        userId: true,
        displayName: true,
        avatarPath: true,
        isVerified: true,
        followerCount: true,
        followers: { where: { followerId: userId }, select: { followerId: true } },
      },
    },
    media: { orderBy: { displayOrder: 'asc' } },
    audioTracks: true,
    verse: {
      select: {
        id: true,
        verseId: true,
        bookNumber: true,
        cantoNumber: true,
        chapterNumber: true,
        verseNumber: true,
        verseNumberEnd: true,
        // What a text box bound to the verse is filled from — see `bindOverlays`.
        sanskrit: true,
        transliteration: true,
        book: { select: { title: true } },
        translations: {
          where: { isPublished: true, languageCode: { in: readingChain } },
          orderBy: { displayOrder: 'asc' },
          select: { languageCode: true, meaning: true },
        },
      },
    },
    mantra: { select: { id: true, slug: true, name: true } },
    deity: { select: { id: true, slug: true, name: true, imagePath: true } },
    likes: { where: { userId }, select: { userId: true } },
    favorites: { where: { userId }, select: { id: true } },
  }),

  /**
   * A comment and the two things every row needs beside its text: who wrote it,
   * and whether this reader has already liked it.
   */
  reelComment: (userId) => ({
    user: { select: { id: true, name: true, avatarUrl: true } },
    likes: { where: { userId }, select: { userId: true } },
  }),

  mantra: (mantraChain, readingChain) => ({
    deity: { select: { id: true, slug: true, name: true, imagePath: true } },
    guru: { select: { id: true, slug: true, name: true, imagePath: true } },
    translations: {
      where: {
        isPublished: true,
        languageCode: { in: [...new Set([...mantraChain, ...readingChain])] },
      },
    },
  }),
};

/**
 * One verse, in the reader's language.
 *
 * The full translation list is returned alongside the resolved one: the app
 * shows a chosen acharya by default but lets the reader switch, and a second
 * round trip for that would be a poor trade for a few hundred bytes.
 */
async function verse(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);

  const translation = language.pick(row.translations, chain);
  const explanation = language.pick(row.explanations, chain);

  return {
    id: row.id,
    verseId: row.verseId,
    bookNumber: row.bookNumber,
    cantoNumber: row.cantoNumber,
    chapterNumber: row.chapterNumber,
    verseNumber: row.verseNumber,
    verseNumberEnd: row.verseNumberEnd,
    type: row.type,
    sanskrit: row.sanskrit,
    transliteration: row.transliteration,
    wordMeanings: row.wordMeanings,
    audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
    tags: row.tags,

    // Present only when the verse was fetched with a signed-in `userId` in its
    // include (see `includes.verse`) — absent (rather than false) for a
    // signed-out reader would be more correct, but `false`/`0` let the client
    // render the same way either way instead of null-checking per field.
    favoriteId: row.favorites?.[0]?.id ?? null,
    isFavorite: Boolean(row.favorites?.length),
    highlightId: row.highlights?.[0]?.id ?? null,
    isHighlighted: Boolean(row.highlights?.length),
    noteCount: row.notes?.length ?? 0,
    // Only ever the count of outgoing links — see VerseLink's own comment on
    // why the relation is directional. Lets the client show the "related
    // verses" affordance only where there is something behind it.
    relatedCount: row._count?.linksFrom ?? 0,

    book: row.book || null,
    chapter: row.chapter || null,

    translation: translation
      ? {
          id: translation.id,
          languageCode: translation.languageCode,
          type: translation.type,
          meaning: translation.meaning,
          purport: translation.purport,
          sourceRef: translation.sourceRef,
          translator: translation.translator,
        }
      : null,

    // Other renderings the reader can switch to, without their full text.
    availableTranslations: (row.translations || []).map((t) => ({
      id: t.id,
      languageCode: t.languageCode,
      type: t.type,
      translator: t.translator,
    })),

    // App-written or generated, and deliberately not presented as commentary —
    // an acharya's purport and our own explanation are different things and are
    // never allowed to look the same.
    explanation: explanation ? { text: explanation.text, source: explanation.source } : null,
  };
}

const verses = (rows, user) => Promise.all((rows || []).map((row) => verse(row, user)));

/**
 * One mantra.
 *
 * The script and the meaning are chosen by *different* settings — mantraLanguage
 * for the text, readingLanguage for what it means — so a single response may
 * combine two rows of MantraTranslation. Someone chanting in Devanagari while
 * reading English is the normal case, not an edge one.
 */
async function mantra(row, user) {
  if (!row) return null;

  const scriptChain = language.mantraChain(user);
  const readChain = language.readingChain(user);

  const script = language.pick(row.translations, scriptChain);
  const meaning = language.pick(row.translations, readChain);

  // Per-language audio wins; the base recitation is the fallback.
  const audioPath = script?.audioPath || row.audioPath;

  return {
    id: row.id,
    slug: row.slug,
    name: script?.name || row.name,
    description: meaning?.description || row.description,
    category: row.category,
    sampradaya: row.sampradaya,
    tags: row.tags,

    // Falls back to the Devanagari source when every chosen language misses.
    text: script?.text || row.sanskrit,
    textLanguage: script?.languageCode || 'sa',
    transliteration: row.transliteration,

    meaning: meaning?.meaning || null,
    purport: meaning?.purport || null,
    meaningLanguage: meaning?.languageCode || null,

    audioUrl: audioPath ? await s3.presignGet(audioPath) : null,
    // Drives the in-app chant pacing, so it must hold even before audio loads.
    durationMs: script?.durationMs || row.durationMs,

    standardRounds: row.standardRounds,
    standardCount: row.standardCount,

    deity: row.deity ? await s3.presignFields(row.deity, ['imagePath']) : null,
    guru: row.guru ? await s3.presignFields(row.guru, ['imagePath']) : null,
  };
}

const mantras = (rows, user) => Promise.all((rows || []).map((row) => mantra(row, user)));

/** A book, with its title in the reader's language where one exists. */
async function book(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);

  return {
    id: row.id,
    bookNumber: row.bookNumber,
    slug: row.slug,
    type: row.type,
    title: language.localised(row, 'title', 'titleI18n', chain),
    description: language.localised(row, 'description', 'descriptionI18n', chain),
    sourceLanguage: row.sourceLanguage,
    coverImageUrl: row.coverImagePath ? await s3.presignGet(row.coverImagePath) : null,
    audioUrl: row.audioPath ? await s3.presignGet(row.audioPath) : null,
    totalCantos: row.totalCantos,
    totalChapters: row.totalChapters,
    totalVerses: row.totalVerses,
    tags: row.tags,
    deity: row.deity || null,
  };
}

const books = (rows, user) => Promise.all((rows || []).map((row) => book(row, user)));

/** Chapters and cantos share a shape — a number, a localised title, a count. */
function section(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);
  return {
    id: row.id,
    number: row.number,
    cantoNumber: row.cantoNumber ?? null,
    title: language.localised(row, 'title', 'titleI18n', chain),
    summary: language.localised(row, 'summary', 'summaryI18n', chain),
    totalChapters: row.totalChapters ?? undefined,
    totalVerses: row.totalVerses,
  };
}

const sections = (rows, user) => (rows || []).map((row) => section(row, user));

/** Reference rows — deities, gurus, translators, issues. */
async function reference(row, user) {
  if (!row) return null;
  const chain = language.readingChain(user);
  return {
    id: row.id,
    slug: row.slug,
    name: language.localised(row, 'name', 'nameI18n', chain),
    description: row.description ?? null,
    imageUrl: row.imagePath ? await s3.presignGet(row.imagePath) : null,
    displayOrder: row.displayOrder,
  };
}

const references = (rows, user) => Promise.all((rows || []).map((row) => reference(row, user)));

/** "Bhagavad Gita 2.47" — a reel's verse as a person cites it. Null without a book to name. */
function reelVerseLabel(verse) {
  if (!verse?.book?.title) return null;
  const numbers = [verse.cantoNumber, verse.chapterNumber].filter((n) => n != null);
  const own = verse.verseNumberEnd ? `${verse.verseNumber}-${verse.verseNumberEnd}` : `${verse.verseNumber}`;
  return `${verse.book.title} ${[...numbers, own].join('.')}`;
}

/**
 * Fills a reel's bound text boxes from its verse, in this reader's language.
 *
 * A reel made from a template stores each box's `bind` ("translation",
 * "sanskrit"…) next to the text it was written with. Reading the verse here,
 * rather than trusting that text, is what lets one reel show a Hindi reader the
 * Hindi translation and an English reader the English — and what makes a
 * corrected translation show up on reels already made. If the verse or the
 * field is gone the stored text stands, so a box is never blanked.
 */
function bindOverlays(overlays, verse, user) {
  if (!Array.isArray(overlays) || !overlays.some((o) => o?.bind)) return overlays ?? [];
  if (!verse) return overlays;

  const translation = language.pick(verse.translations, language.readingChain(user));
  const fields = {
    sanskrit: verse.sanskrit,
    transliteration: verse.transliteration,
    translation: translation?.meaning,
    reference: reelVerseLabel(verse),
  };

  return overlays.map((overlay) => {
    const text = overlay?.bind ? fields[overlay.bind]?.trim() : null;
    return text ? { ...overlay, text: text.slice(0, 2000) } : overlay;
  });
}

/**
 * One reel, shaped for the feed.
 *
 * Deliberately light on the verse/mantra it references — id and enough to
 * label a card, not the full translation. A reader who taps through fetches
 * that verse or mantra the normal way; pulling its whole shape into every feed
 * item would triple the payload for content most cards never get opened.
 */
async function reel(row, user) {
  if (!row) return null;

  // AUDIO reels carry their content as one row per language in `audioTracks`
  // (ReelAudioTrack) rather than a single path — resolved the same way a
  // Narration or VerseTranslation is, via the reader's mantra-language chain.
  // `mantraChain` always ends in "sa", so a Sanskrit-only reel still resolves
  // for every reader; `audioTracks[0]` is only reached if that somehow misses.
  const audioTrack =
    row.mediaType === 'AUDIO'
      ? language.pick(row.audioTracks, language.mantraChain(user)) || row.audioTracks?.[0] || null
      : null;

  const [videoUrl, audioUrl, thumbnailUrl, media, creatorAvatarUrl, deityImageUrl] =
    await Promise.all([
      row.videoPath ? s3.presignGet(row.videoPath) : null,
      // AUDIO reels: the resolved narration track is the content. Otherwise:
      // `audioTrackPath` is the optional background track over video/images —
      // see the Reel model comment.
      audioTrack
        ? s3.presignGet(audioTrack.audioPath)
        : row.audioTrackPath
          ? s3.presignGet(row.audioTrackPath)
          : null,
      row.thumbnailPath ? s3.presignGet(row.thumbnailPath) : null,
      Promise.all(
        (row.media || []).map(async (m) => ({
          id: m.id,
          imageUrl: await s3.presignGet(m.imagePath),
          displayOrder: m.displayOrder,
        }))
      ),
      row.creator?.avatarPath ? s3.presignGet(row.creator.avatarPath) : null,
      row.deity?.imagePath ? s3.presignGet(row.deity.imagePath) : null,
    ]);

  return {
    id: row.id,
    mediaType: row.mediaType,
    videoUrl,
    audioUrl,
    audioLanguageCode: audioTrack?.languageCode ?? null,
    thumbnailUrl,
    media,
    durationMs: audioTrack?.durationMs ?? row.durationMs,
    width: row.width,
    height: row.height,

    caption: row.caption,
    tags: row.tags,
    languageCode: row.languageCode,

    // Text placed on the frame in the admin editor, drawn by the app at watch
    // time — percentages of the frame, see routes/admin/reel.js.
    overlays: bindOverlays(row.overlays, row.verse, user),

    viewCount: row.viewCount,
    likeCount: row.likeCount,
    commentCount: row.commentCount,
    shareCount: row.shareCount,

    // Only meaningful for a signed-in reader, which every caller of this
    // shaper currently is — the feed does not have a public, signed-out mode.
    isLiked: (row.likes || []).length > 0,
    isSaved: (row.favorites || []).length > 0,

    // Whether the reader already follows whoever posted this. Present so the
    // follow button on a feed card renders in its settled state rather than
    // flashing "Follow" and correcting itself a moment later.
    isFollowingCreator: (row.creator?.followers || []).length > 0,

    // A creator watching their own reel from their profile gets the delete
    // and pin affordances; nobody else does.
    isMine: Boolean(user && row.creator?.userId && row.creator.userId === user.id),

    publishedAt: row.publishedAt,
    createdAt: row.createdAt,

    creator: row.creator
      ? {
          id: row.creator.id,
          displayName: row.creator.displayName,
          avatarUrl: creatorAvatarUrl,
          isVerified: row.creator.isVerified,
          followerCount: row.creator.followerCount ?? 0,
        }
      : null,

    verse: row.verse
      ? {
          id: row.verse.id,
          verseId: row.verse.verseId,
          bookNumber: row.verse.bookNumber,
          chapterNumber: row.verse.chapterNumber,
          verseNumber: row.verse.verseNumber,
          // Named by the API so the app need not know which book a number means.
          label: reelVerseLabel(row.verse),
        }
      : null,
    mantra: row.mantra ? { id: row.mantra.id, slug: row.mantra.slug, name: row.mantra.name } : null,
    deity: row.deity
      ? { id: row.deity.id, slug: row.deity.slug, name: row.deity.name, imageUrl: deityImageUrl }
      : null,
  };
}

const reels = (rows, user) => Promise.all((rows || []).map((row) => reel(row, user)));

/**
 * One comment.
 *
 * A hidden comment is returned rather than dropped: removing the row from the
 * list would renumber every reply under it and make a thread read as though it
 * had never happened. The text is replaced instead, so the shape of the
 * conversation survives a moderation takedown.
 */
function reelComment(row, user) {
  if (!row) return null;

  return {
    id: row.id,
    reelId: row.reelId,
    parentId: row.parentId,
    text: row.isHidden ? null : row.text,
    isHidden: row.isHidden,
    isPinned: row.isPinned,
    likeCount: row.likeCount,
    replyCount: row.replyCount,
    isLiked: (row.likes || []).length > 0,
    // Drives whether the sheet offers "delete" or "report" on a long press.
    isMine: Boolean(user && row.userId === user.id),
    createdAt: row.createdAt,
    author: row.user
      ? { id: row.user.id, name: row.user.name, avatarUrl: row.user.avatarUrl }
      : null,
  };
}

const reelComments = (rows, user) => (rows || []).map((row) => reelComment(row, user));

/**
 * A creator's public profile.
 *
 * `user` decides two fields the row itself cannot: whether the reader follows
 * this creator, and whether the reader *is* them — a creator opening their own
 * profile should not be offered a follow button.
 */
async function creator(row, user) {
  if (!row) return null;

  const [avatarUrl, coverImageUrl] = await Promise.all([
    row.avatarPath ? s3.presignGet(row.avatarPath) : null,
    row.coverImagePath ? s3.presignGet(row.coverImagePath) : null,
  ]);

  return {
    id: row.id,
    displayName: row.displayName,
    bio: row.bio,
    avatarUrl: avatarUrl || row.user?.avatarUrl || null,
    coverImageUrl,
    socialLinks: row.socialLinks || null,
    isVerified: row.isVerified,
    followerCount: row.followerCount,
    reelCount: row.reelCount,
    totalViews: row.totalViews,
    isFollowing: (row.followers || []).length > 0,
    isMe: Boolean(user && row.userId === user.id),
    createdAt: row.createdAt,
  };
}

const creators = (rows, user) => Promise.all((rows || []).map((row) => creator(row, user)));

export {
  includes,
  verse,
  verses,
  mantra,
  mantras,
  book,
  books,
  section,
  sections,
  reference,
  references,
  reel,
  reels,
  reelComment,
  reelComments,
  creator,
  creators,
};
