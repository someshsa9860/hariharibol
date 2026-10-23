// Readers' own mantras — the half that talks to the database and the AI. The pure half (cleaning, prompts, checking
// what the AI sent) is utils/mantra-own.js; the routes are in routes/app/mantra.js. See "Readers' own mantras" in
// backend/CLAUDE.md for the whole flow.
//
//   suggest   what the reader typed → the AI names related mantras → kept on the server under a `suggestionId`
//   create    the reader sends back only the numbers they chose → the AI writes the catalogue entry → saved PRIVATE
//   access    a mantra we already hold is not made twice: the reader is given access to it, so both can open it
//   promote   11 readers with access → the mantra becomes the catalogue's own, in every language
//   translate English + the reading languages of the readers who asked; every language once promoted
//
// Nothing the reader typed is ever saved, and nothing is saved that the AI did not suggest and `utils/mantra-own.js`
// did not accept.

import crypto from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import * as cfg from '../config/mantra-own.js';
import * as ai from './ai/index.js';
import * as s3 from './s3.js';
import { withLock } from './redis-lock.js';
import { findPicture } from './public-image.js';
import { queues, JOBS } from '../jobs/index.js';
import * as own from '../utils/mantra-own.js';
import * as chatImage from '../utils/chat-image.js';
import { AppError, badRequest, forbidden, gone, notFound, tooMany } from '../utils/errors.js';

const suggestionKey = (id) => `mantra-own:suggestions:${id}`;

// How long a reader waits for another who is making the very same mantra at the moment (about 6 seconds in all).
const LOCK_ATTEMPTS = 20;
const LOCK_WAIT_MS = 300;

const aiUnavailable = () =>
  new AppError(503, 'MANTRA_AI_UNAVAILABLE', 'Mantra suggestions are not available right now. Please try again in a little while.');

// ── Limits ─────────────────────────────────────────────────────────────────

/** Counts one use of `kind` today (UTC) for `userId`; refuses the one past `limit`. */
async function countToday(kind, userId, limit) {
  const key = `mantra-own:${kind}:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const used = await redis.incr(key);
  if (used === 1) await redis.expire(key, 2 * 24 * 60 * 60);
  if (used > limit) throw tooMany('You have reached today’s limit for adding mantras. Please try again tomorrow.');
}

// ── What the database already holds ────────────────────────────────────────

/**
 * The values the catalogue already uses, so an AI answer lands in the same vocabulary as every other mantra:
 * categories and traditions as they are, deities and saints (gurus) as rows. Never empty: a fresh database falls back
 * to the seeded ones.
 */
export async function reference() {
  const [categories, sampradayas, deities, gurus] = await Promise.all([
    prisma.mantra.groupBy({ by: ['category'], where: { mantraType: 'PUBLIC' }, _count: { _all: true }, orderBy: { _count: { category: 'desc' } } }),
    prisma.mantra.groupBy({ by: ['sampradaya'], where: { mantraType: 'PUBLIC' }, _count: { _all: true }, orderBy: { _count: { sampradaya: 'desc' } } }),
    prisma.deity.findMany({ select: { id: true, slug: true, name: true, sampradaya: true, imagePath: true }, orderBy: { slug: 'asc' } }),
    prisma.guru.findMany({ select: { id: true, slug: true, name: true, sampradaya: true, imagePath: true }, orderBy: { slug: 'asc' } }),
  ]);

  return {
    categories: categories.length ? categories.map((row) => row.category) : ['name'],
    sampradayas: sampradayas.length ? sampradayas.map((row) => row.sampradaya) : ['vaishnav'],
    deities,
    gurus,
  };
}

/** Gives the mantras that have no `matchKey` yet theirs (the catalogue as it was before readers could add any). */
async function fillMatchKeys() {
  const rows = await prisma.mantra.findMany({ where: { matchKey: null }, select: { id: true, sanskrit: true, transliteration: true }, take: 500 });
  for (const row of rows) {
    await prisma.mantra.update({ where: { id: row.id }, data: { matchKey: own.matchKeyOf(row) } });
  }
}

/**
 * For each of `items` (`{ keys }`), the mantra we already hold that is the same one, or null: a published catalogue
 * mantra, else a reader's private one. The catalogue's own wins, then the oldest.
 */
async function existingFor(items, userId) {
  await fillMatchKeys();

  const keys = [...new Set(items.flatMap((item) => item.keys))];
  if (!keys.length) return items.map(() => null);

  const rows = await prisma.mantra.findMany({
    where: { matchKey: { in: keys }, OR: [{ isPublished: true }, { mantraType: 'PRIVATE' }] },
    select: {
      id: true,
      slug: true,
      name: true,
      matchKey: true,
      mantraType: true,
      access: { where: { userId }, select: { id: true } },
    },
    orderBy: [{ isPublished: 'desc' }, { createdAt: 'asc' }],
  });

  return items.map((item) => rows.find((row) => item.keys.includes(row.matchKey)) ?? null);
}

/** How a mantra we hold stands for this reader: in the catalogue, already theirs, or another reader's to be shared. */
const statusOf = (row) => (!row ? 'new' : row.mantraType === 'PUBLIC' ? 'catalog' : row.access.length ? 'yours' : 'shared');

// ── Step 1: suggestions ────────────────────────────────────────────────────

/**
 * What the reader typed or said → related mantras to choose from.
 * Returns `{ suggestionId, items: [{ index, name, sanskrit, transliteration, kind, addressedTo, status, slug }] }`;
 * `items` is empty (and there is no id) when the AI found nothing it was sure of, which includes any mantra that does
 * not belong to a well-known deity or saint. `kind` is `deity` or `saint` and `addressedTo` their name. `status` is
 * `new`, `shared`, `yours` or `catalog`; only the first two can be chosen.
 */
export async function suggest(user, input) {
  const text = own.cleanInput(input);
  if (!text) throw new AppError(422, 'MANTRA_INPUT_NOT_USABLE', 'Type or say a mantra');

  await countToday('suggest', user.id, cfg.SUGGESTS_PER_DAY);

  let suggestions;
  try {
    const result = await ai.complete({
      operation: ai.OPERATIONS.MANTRA_SUGGEST,
      ...own.suggestRequest(text),
      json: true,
      userId: user.id,
      temperature: 0.2,
      maxTokens: cfg.SUGGEST_MAX_TOKENS,
    });
    suggestions = own.parseSuggestions(result.json);
  } catch (error) {
    logger.warn({ err: String(error?.message).slice(0, 200), userId: user.id }, 'mantra suggestion failed');
    throw aiUnavailable();
  }

  if (!suggestions.length) return { suggestionId: null, items: [] };

  const held = await existingFor(suggestions, user.id);
  const suggestionId = crypto.randomBytes(12).toString('hex');
  await redis.set(suggestionKey(suggestionId), JSON.stringify({ userId: user.id, items: suggestions }), 'EX', cfg.SUGGESTION_TTL_SECONDS);

  return {
    suggestionId,
    items: suggestions.map((item, index) => ({
      index,
      name: item.name,
      sanskrit: item.sanskrit,
      transliteration: item.transliteration,
      kind: item.kind,
      addressedTo: item.addressedTo,
      status: statusOf(held[index]),
      slug: held[index]?.slug ?? null,
    })),
  };
}

async function loadSuggestions(suggestionId, userId) {
  const raw = await redis.get(suggestionKey(suggestionId));
  const stored = raw ? JSON.parse(raw) : null;
  // Someone else's id is as good as none: it must not reveal that it exists.
  if (!stored || stored.userId !== userId) throw gone('These suggestions have expired — please search again');
  return stored.items;
}

// ── Step 2: creating ───────────────────────────────────────────────────────

/**
 * The deity or saint a mantra belongs to: the row we hold (`slug`, from `rows`), else one made from the name the AI
 * gave (`fresh`: `{ name, description }`). A new one is not shown in the public lists until an admin has given it a
 * picture and published it; the mantra shows its name from the moment it is made.
 */
async function figureFor(model, rows, slug, fresh, sampradaya) {
  if (slug) return rows.find((row) => row.slug === slug) ?? null;
  if (!fresh) return null;

  const { name, description } = fresh;
  const wanted = own.slugFor(name, new Set());
  const find = () => model.findFirst({ where: { OR: [{ slug: wanted }, { name: { equals: name, mode: 'insensitive' } }] } });

  const found = await find();
  if (found) return found;

  try {
    return await model.create({ data: { slug: wanted, name, description, sampradaya, isPublished: false } });
  } catch (error) {
    if (error.code === 'P2002') return find(); // another reader's mantra made it a moment ago
    throw error;
  }
}

const deityFor = (detail, ref) => figureFor(prisma.deity, ref.deities, detail.deitySlug, detail.newDeity, detail.sampradaya);
const guruFor = (detail, ref) => figureFor(prisma.guru, ref.gurus, detail.guruSlug, detail.newGuru, detail.sampradaya);

/** Saves one new PRIVATE mantra with its English and Sanskrit rows, for `user`, and returns it. */
async function createOne(user, detail, deity, guru, imageUrl) {
  const phrases = own.chantPhrasesOf(detail.transliteration, detail.chantPhrases);
  const base = own.slugFor(detail.name, new Set());

  for (let attempt = 0; ; attempt++) {
    const taken = new Set((await prisma.mantra.findMany({ where: { slug: { startsWith: base } }, select: { slug: true } })).map((row) => row.slug));
    try {
      return await prisma.mantra.create({
        data: {
          slug: own.slugFor(detail.name, taken),
          name: detail.name,
          description: detail.description,
          deityId: deity?.id ?? null,
          guruId: guru?.id ?? null,
          sanskrit: detail.sanskrit,
          transliteration: detail.transliteration,
          category: detail.category,
          sampradaya: detail.sampradaya,
          tags: detail.tags,
          durationMs: own.durationFor(detail),
          chantPhrases: phrases,
          chantWords: own.chantWordsOf(phrases),
          standardCount: detail.standardCount ?? own.DEFAULT_STANDARD_COUNT,
          mantraType: 'PRIVATE',
          isPublished: false,
          displayOrder: cfg.PRIVATE_DISPLAY_ORDER,
          createdById: user.id,
          matchKey: own.matchKeyOf(detail),
          imageUrl,
          access: { create: { userId: user.id } },
          // The same two rows every catalogue mantra starts with: the Sanskrit, and the English meaning with the
          // Roman spelling as its text. The reading languages come after (translateMissing).
          translations: {
            create: [
              { languageCode: 'sa', text: detail.sanskrit, isPublished: true },
              { languageCode: 'en', text: detail.transliteration, meaning: detail.meaning, purport: detail.purport, isPublished: true },
            ],
          },
        },
      });
    } catch (error) {
      if (error.code === 'P2002' && attempt < 3) continue; // the slug was taken a moment ago: look again
      throw error;
    }
  }
}

/** Gives `user` access to a private mantra. True when they did not have it. */
async function grantAccess(mantraId, userId) {
  const { count } = await prisma.mantraAccess.createMany({ data: [{ mantraId, userId }], skipDuplicates: true });
  return count > 0;
}

function enqueueTranslate(mantraId, languages) {
  queues.content
    .add(JOBS.MANTRA_TRANSLATE, { mantraId, languages })
    .catch((error) => logger.warn({ err: error.message, mantraId }, 'could not queue the mantra translation'));
}

/**
 * What follows a reader gaining access to a private mantra: their reading language is added to it, and at
 * `PUBLIC_AFTER_READERS` readers it becomes the catalogue's own.
 */
async function afterAccess(mantraId, user) {
  const mantra = await prisma.mantra.findUnique({ where: { id: mantraId }, select: { mantraType: true, _count: { select: { access: true } } } });
  if (!mantra || mantra.mantraType !== 'PRIVATE') return;

  if (mantra._count.access >= cfg.PUBLIC_AFTER_READERS) {
    await promote(mantraId);
    return;
  }
  if (user.readingLanguage && user.readingLanguage !== 'en') enqueueTranslate(mantraId, [user.readingLanguage]);
}

/**
 * Makes a private mantra the catalogue's own and queues every language for it. A picture a reader uploaded is not
 * carried into the catalogue unseen: it goes, and the one found on the web (if any) stays.
 */
export async function promote(mantraId) {
  const before = await prisma.mantra.findUnique({ where: { id: mantraId }, select: { imagePath: true } });
  const { count } = await prisma.mantra.updateMany({
    where: { id: mantraId, mantraType: 'PRIVATE' },
    data: { mantraType: 'PUBLIC', isPublished: true, displayOrder: cfg.PROMOTED_DISPLAY_ORDER, imagePath: null },
  });
  if (count === 0) return false;

  if (before?.imagePath) await s3.deleteObject(before.imagePath).catch(() => {});
  logger.info({ mantraId }, 'reader mantra became public');
  enqueueTranslate(mantraId, 'all');
  return true;
}

/**
 * The mantras the reader chose → saved or shared.
 * `picks` are the numbers from `suggest`; the text never comes back from the phone. Returns
 * `{ items: [{ index, status, mantraId, slug }] }` where `status` is `created`, `shared` (another reader's mantra,
 * now theirs too), `already` (theirs or in the catalogue) or `failed` (the AI had nothing usable for it).
 */
export async function create(user, { suggestionId, picks }) {
  const chosen = [...new Set(picks)];
  if (!chosen.length || chosen.length > cfg.MAX_PICKS) throw badRequest(`Choose between 1 and ${cfg.MAX_PICKS} mantras`);

  const stored = await loadSuggestions(suggestionId, user.id);
  if (chosen.some((index) => !Number.isInteger(index) || !stored[index])) throw badRequest('Choose from the suggestions');

  const picked = chosen.map((index) => ({ index, ...stored[index] }));
  const held = await existingFor(picked, user.id);

  const adding = held.filter((row) => statusOf(row) === 'new' || statusOf(row) === 'shared').length;
  const mine = await prisma.mantraAccess.count({ where: { userId: user.id, mantra: { mantraType: 'PRIVATE' } } });
  if (mine + adding > cfg.MAX_OWN_MANTRAS) {
    throw new AppError(409, 'MANTRA_LIMIT', `You can keep up to ${cfg.MAX_OWN_MANTRAS} of your own mantras. Remove one to add another.`);
  }

  await countToday('create', user.id, cfg.CREATES_PER_DAY);

  // The AI writes the entries first, so a failure there leaves nothing half done.
  const fresh = picked.filter((_, i) => statusOf(held[i]) === 'new');
  const ref = await reference();
  let details = [];
  if (fresh.length) {
    try {
      const result = await ai.complete({
        operation: ai.OPERATIONS.MANTRA_DETAILS,
        ...own.detailsRequest(fresh, ref),
        json: true,
        userId: user.id,
        temperature: 0.3,
        maxTokens: cfg.DETAILS_MAX_TOKENS,
      });
      details = own.parseDetails(result.json, fresh, ref);
    } catch (error) {
      logger.warn({ err: String(error?.message).slice(0, 200), userId: user.id }, 'mantra details failed');
      throw aiUnavailable();
    }
  }

  // Pictures are looked for together; the deity (or, for a saint's mantra, the saint) we already have a picture of
  // needs none.
  const pictures = await Promise.all(
    details.map((detail) => {
      if (!detail) return null;
      const [rows, slug, fresh] = detail.kind === 'saint' ? [ref.gurus, detail.guruSlug, detail.newGuru] : [ref.deities, detail.deitySlug, detail.newDeity];
      const known = slug ? rows.find((row) => row.slug === slug) : null;
      if (known?.imagePath) return null;
      return findPicture(detail.imageQuery || fresh?.name || known?.name || detail.name);
    })
  );

  const items = [];
  for (const [i, pick] of picked.entries()) {
    const status = statusOf(held[i]);

    if (status === 'catalog' || status === 'yours') {
      items.push({ index: pick.index, status: 'already', mantraId: held[i].id, slug: held[i].slug });
      continue;
    }
    if (status === 'shared') {
      items.push(await share(held[i], user, pick.index));
      continue;
    }

    const at = fresh.indexOf(pick);
    const detail = details[at];
    if (!detail) {
      items.push({ index: pick.index, status: 'failed', mantraId: null, slug: null });
      continue;
    }
    items.push(await createGuarded(user, pick, detail, ref, pictures[at]));
  }

  return { items };
}

async function share(row, user, index) {
  await grantAccess(row.id, user.id);
  await afterAccess(row.id, user);
  return { index, status: 'shared', mantraId: row.id, slug: row.slug };
}

/**
 * Creates the mantra, unless someone else has made it in the meantime (two readers asking for the same new mantra at
 * once): the key is locked, and the second to arrive is shared the first one's.
 */
async function createGuarded(user, pick, detail, ref, imageUrl) {
  // Making a mantra takes well under a second, so a lock that is held is waited for a few seconds: the reader who
  // held it has made the mantra by then, and this one is shared it instead of failing.
  for (let attempt = 0; attempt < LOCK_ATTEMPTS; attempt++) {
    const outcome = await withLock(`mantra-own:create:${pick.keys[0]}`, 60_000, async () => {
      const [again] = await existingFor([pick], user.id);
      if (again) {
        const status = statusOf(again);
        return status === 'shared' ? share(again, user, pick.index) : { index: pick.index, status: 'already', mantraId: again.id, slug: again.slug };
      }

      const deity = await deityFor(detail, ref);
      const guru = await guruFor(detail, ref);
      const mantra = await createOne(user, detail, deity, guru, imageUrl);
      await afterAccess(mantra.id, user);
      return { index: pick.index, status: 'created', mantraId: mantra.id, slug: mantra.slug };
    });

    if (outcome) return outcome.value;
    await sleep(LOCK_WAIT_MS);
  }
  return { index: pick.index, status: 'failed', mantraId: null, slug: null };
}

// ── Leaving and the picture ────────────────────────────────────────────────

/**
 * Takes a private mantra off a reader's list: their access, favourite and standing choice go. When no reader is left
 * and nothing refers to it (no chanting, no reel) it is deleted.
 */
export async function leave(user, slug) {
  const mantra = await prisma.mantra.findUnique({
    where: { slug },
    select: { id: true, mantraType: true, imagePath: true, access: { where: { userId: user.id }, select: { id: true } } },
  });
  if (!mantra || mantra.mantraType !== 'PRIVATE' || mantra.access.length === 0) throw notFound('Mantra');

  await prisma.$transaction([
    prisma.mantraAccess.deleteMany({ where: { mantraId: mantra.id, userId: user.id } }),
    prisma.favorite.deleteMany({ where: { userId: user.id, mantraId: mantra.id } }),
    prisma.sadhanaProfile.updateMany({ where: { userId: user.id, preferredMantraId: mantra.id }, data: { preferredMantraId: null } }),
  ]);

  const [readers, sessions, reels] = await Promise.all([
    prisma.mantraAccess.count({ where: { mantraId: mantra.id } }),
    prisma.chantSession.count({ where: { mantraId: mantra.id } }),
    prisma.reel.count({ where: { mantraId: mantra.id } }),
  ]);
  if (readers === 0 && sessions === 0 && reels === 0) {
    await prisma.mantra.deleteMany({ where: { id: mantra.id, mantraType: 'PRIVATE' } });
    if (mantra.imagePath) await s3.deleteObject(mantra.imagePath).catch(() => {});
  }
}

/**
 * Replaces the picture of a private mantra with one the reader uploaded: checked, drawn again as a JPEG and stored.
 * Only the reader who added the mantra may; it is a single picture for everyone who shares it.
 */
export async function changeImage(user, slug, bytes) {
  const mantra = await prisma.mantra.findUnique({
    where: { slug },
    select: { id: true, mantraType: true, createdById: true, imagePath: true, access: { where: { userId: user.id }, select: { id: true } } },
  });
  if (!mantra || mantra.mantraType !== 'PRIVATE' || mantra.access.length === 0) throw notFound('Mantra');
  if (mantra.createdById !== user.id) throw forbidden('Only the reader who added this mantra can change its picture');

  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new AppError(400, 'IMAGE_NOT_USABLE', 'No picture was sent');
  if (bytes.length > cfg.IMAGE_MAX_BYTES) throw new AppError(413, 'IMAGE_TOO_LARGE', 'That picture is too large');

  const picture = await chatImage.prepare(bytes, { maxEdge: cfg.IMAGE_MAX_EDGE });
  const key = s3.buildKey('mantraImage', picture.contentType);
  await s3.putObject(key, picture.buffer, picture.contentType);

  // The write moves the object out of temp/ and stores its permanent key.
  await prisma.mantra.update({ where: { id: mantra.id }, data: { imagePath: key } });
  if (mantra.imagePath) await s3.deleteObject(mantra.imagePath).catch(() => {});
  return mantra.id;
}

// ── Other languages ────────────────────────────────────────────────────────

const BATCH = 4; // languages asked for in one AI call

/**
 * Writes the name, description, meaning and purport of a mantra in `languages` (codes, or `'all'` for every active
 * reading language), for the languages it does not have whole. A language is saved only when the AI's answer for it
 * is complete and in its own script; one that is not is left for the next request. Returns
 * `{ translated: [codes], missing: [codes], busy }`; `busy` means another run holds the mantra and nothing was done.
 */
export async function translateMissing(mantraId, languages) {
  const mantra = await prisma.mantra.findUnique({ where: { id: mantraId }, include: { translations: true } });
  const english = mantra?.translations.find((row) => row.languageCode === 'en');
  if (!english?.meaning || !english?.purport) return { translated: [], missing: [], busy: false };

  const known = await prisma.language.findMany({ where: { isActive: true, isReadingLanguage: true }, select: { code: true, englishName: true } });
  const names = Object.fromEntries(known.map((language) => [language.code, language.englishName]));

  const wanted = languages === 'all' ? known.map((language) => language.code) : languages;
  const have = new Set(mantra.translations.filter((row) => row.name && row.meaning && row.purport).map((row) => row.languageCode));
  const todo = [...new Set(wanted)].filter((code) => code !== 'en' && code !== 'sa' && names[code] && own.knowsScript(code) && !have.has(code));
  if (!todo.length) return { translated: [], missing: [], busy: false };

  const outcome = await withLock(`mantra-own:translate:${mantraId}`, 5 * 60_000, async () => {
    const translated = [];
    for (let at = 0; at < todo.length; at += BATCH) {
      const batch = todo.slice(at, at + BATCH);
      const result = await ai.complete({
        operation: ai.OPERATIONS.MANTRA_TRANSLATE,
        ...own.translateRequest(
          { name: mantra.name, description: mantra.description, meaning: english.meaning, purport: english.purport },
          Object.fromEntries(batch.map((code) => [code, names[code]]))
        ),
        json: true,
        targetType: 'Mantra',
        targetId: mantraId,
        temperature: 0.2,
        maxTokens: cfg.TRANSLATE_MAX_TOKENS,
      });

      for (const [code, entry] of Object.entries(own.parseTranslations(result.json, batch))) {
        const row = { name: entry.name, description: entry.description, text: own.textFor(code, mantra), meaning: entry.meaning, purport: entry.purport, isPublished: true };
        await prisma.mantraTranslation.upsert({
          where: { mantraId_languageCode: { mantraId, languageCode: code } },
          create: { mantraId, languageCode: code, ...row },
          update: row,
        });
        translated.push(code);
      }
    }
    return translated;
  });

  if (!outcome) return { translated: [], missing: todo, busy: true };
  return { translated: outcome.value, missing: todo.filter((code) => !outcome.value.includes(code)), busy: false };
}
