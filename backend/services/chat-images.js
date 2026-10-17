// Pictures sent to Ask Sakha: whose an upload is until a message takes it, and clearing them away with the chat.
//
// An upload is a generated key under `chat/images/` (see `POST /api/app/chat/images`). It is only a claim until a
// message carries it: Redis remembers which reader it was made for, so one reader cannot attach another's picture by
// guessing a key, and the entry goes when it is used or after a day. A picture nobody attaches is swept from
// `temp/` by the monthly prune like any unsaved upload.

import { prisma } from '../config/database.js';
import { redis } from '../config/redis.js';
import logger from '../config/logger.js';
import * as s3 from './s3.js';

const OWNER_TTL_SECONDS = 24 * 60 * 60;
const ownerKey = (key) => `chat:image:${key}`;

/** True for a key this server generated for a chat picture — never one taken from the client's own invention. */
export const isChatImageKey = (key) => s3.isGeneratedKey(key) && s3.keyHasPrefix(key, s3.PREFIXES.chatImage);

/** Records that [key] was uploaded by [userId] and may be attached to their next message. */
export const claim = (key, userId) => redis.set(ownerKey(key), userId, 'EX', OWNER_TTL_SECONDS);

export async function isClaimedBy(key, userId) {
  return (await redis.get(ownerKey(key)).catch(() => null)) === userId;
}

/** A claimed upload is used once: after this the key is not accepted again. */
export const release = (key) => redis.del(ownerKey(key)).catch(() => null);

/** The stored pictures of the messages matching [where] (a `ChatMessage` filter). Read before the rows are deleted. */
export async function keysWhere(where) {
  const rows = await prisma.chatMessage.findMany({
    where: { ...where, imagePath: { not: null } },
    select: { imagePath: true },
  });
  return rows.map((row) => row.imagePath);
}

/** Deletes the files, best effort: a file left behind is a leak of storage, not a reason to fail a delete. */
export async function deleteFiles(keys) {
  await Promise.all(
    keys.map((key) => s3.deleteObject(key).catch((error) => logger.warn({ err: error.message, key }, 'chat picture not deleted')))
  );
}
