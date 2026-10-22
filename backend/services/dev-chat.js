// The line between a reader and the developer: one conversation per reader, messages both ways.
//
// A message is one insert and one update in a transaction, then a websocket publish (fire and forget) and
// a queued job for the push decision — nothing slower runs on the request.

import { prisma } from '../config/database.js';
import { devops } from '../config/devops.js';
import * as websocket from './websocket.js';
import * as devEvents from './dev-events.js';
import { queues } from '../jobs/index.js';
import logger from '../config/logger.js';

const preview = (body) => body.replace(/\s+/g, ' ').trim().slice(0, 200);

export const present = (m) => ({
  id: m.id,
  conversationId: m.conversationId,
  fromDeveloper: m.fromDeveloper,
  body: m.body,
  createdAt: m.createdAt,
});

export async function findOrCreate(userId) {
  return prisma.devConversation.upsert({ where: { userId }, update: {}, create: { userId } });
}

/** `fromDeveloper` false: the reader wrote. True: the developer replied (`authorId` is the developer). */
export async function addMessage(conversation, { body, fromDeveloper, authorId = null }) {
  const text = body.trim();
  const [message, updated] = await prisma.$transaction([
    prisma.devMessage.create({ data: { conversationId: conversation.id, fromDeveloper, authorId, body: text } }),
    prisma.devConversation.update({
      where: { id: conversation.id },
      data: {
        lastMessageAt: new Date(),
        lastMessagePreview: preview(text),
        ...(fromDeveloper ? { userUnread: { increment: 1 } } : { devUnread: { increment: 1 } }),
      },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true } } },
    }),
  ]);

  const shown = present(message);
  // Both ends see it live: the reader's other devices too, so the thread stays the same everywhere.
  websocket.toUser(updated.userId, 'dev.chat.message', shown);
  websocket.toPermission('dev.access', 'dev.chat.message', {
    ...shown,
    user: updated.user,
    devUnread: updated.devUnread,
  });

  if (fromDeveloper) {
    queue('user.push', { userId: updated.userId, conversationId: updated.id, body: preview(text) });
  } else {
    devEvents.emit('chat.message', {
      title: updated.user.name || updated.user.email,
      body: preview(text),
      data: { conversationId: updated.id, userId: updated.userId },
    });
  }
  return { message: shown, conversation: updated };
}

function queue(name, data) {
  queues[devops.QUEUE]
    .add(name, data, { removeOnComplete: 50, removeOnFail: 50 })
    .catch((err) => logger.debug({ err: err.message, name }, 'dev chat job not queued'));
}

/** Messages newest-last, a page at a time: `before` is a message id, `limit` at most 100. */
export async function page(conversationId, { before, limit = 50 } = {}) {
  const take = Math.min(Math.max(Number(limit) || 50, 1), 100);
  const rows = await prisma.devMessage.findMany({
    where: { conversationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: take + 1,
    ...(before ? { cursor: { id: before }, skip: 1 } : {}),
  });
  const hasMore = rows.length > take;
  return { messages: rows.slice(0, take).reverse().map(present), hasMore };
}
