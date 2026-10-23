// A reader's line to the developer — one conversation, no list. The developer answers from the companion
// app (controllers/admin/dev.js); both sides are services/dev-chat.js.

import { prisma } from '../../config/database.js';
import * as chat from '../../services/dev-chat.js';
import { ok, created } from '../../utils/respond.js';

/** GET /api/app/developer-chat — the conversation and its newest messages; opening it marks the replies read. */
export const get = async (req, res) => {
  const { before, limit } = req.valid.query;
  const conversation = await chat.findOrCreate(req.auth.user.id);
  const { messages, hasMore } = await chat.page(conversation.id, { before, limit });
  if (!before && conversation.userUnread > 0) {
    await prisma.devConversation.update({ where: { id: conversation.id }, data: { userUnread: 0 } });
  }
  return ok(res, { id: conversation.id, unread: 0, messages, hasMore });
};

/** GET /api/app/developer-chat/unread — the badge. */
export const unread = async (req, res) => {
  const row = await prisma.devConversation.findUnique({ where: { userId: req.auth.user.id }, select: { userUnread: true } });
  return ok(res, { count: row?.userUnread || 0 });
};

/** POST /api/app/developer-chat/messages */
export const send = async (req, res) => {
  const conversation = await chat.findOrCreate(req.auth.user.id);
  const { message } = await chat.addMessage(conversation, { body: req.valid.body.body, fromDeveloper: false, authorId: req.auth.user.id });
  return created(res, message);
};

/** POST /api/app/developer-chat/read — a reply arrived while the screen was open. */
export const markRead = async (req, res) => {
  await prisma.devConversation.updateMany({ where: { userId: req.auth.user.id }, data: { userUnread: 0 } });
  return ok(res, { count: 0 });
};
