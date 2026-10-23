// The support desk: tickets and feedback from readers, staff replies, status.
//
// A staff reply is saved, flags the ticket unread for the reader, moves an OPEN ticket to IN_PROGRESS, and
// pushes the reader (`NotificationType.SUPPORT`, deeplink `hariharibol://ticket?id=…`).

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as notify from '../../services/notify.js';
import * as s3 from '../../services/s3.js';
import { ok, created, paginated } from '../../utils/respond.js';
import { paginate, readSort } from '../../utils/pagination.js';
import { notFound } from '../../utils/errors.js';
import { greetedTitle, notice } from '../../utils/messages.js';

export const SORT_COLUMNS = { lastMessageAt: 'lastMessageAt', createdAt: 'createdAt', status: 'status', rating: 'rating' };

const USER = { select: { id: true, email: true, name: true, avatarUrl: true } };

/** GET /api/admin/support/tickets */
export const list = async (req, res) => {
  const { q, status, kind, category, maxRating } = req.valid.query;

  const where = {
    ...(status ? { status } : {}),
    ...(kind ? { kind } : {}),
    ...(category ? { category } : {}),
    ...(maxRating ? { rating: { lte: maxRating } } : {}),
    ...(q
      ? {
          OR: [
            { subject: { contains: q, mode: 'insensitive' } },
            { user: { email: { contains: q, mode: 'insensitive' } } },
            { user: { name: { contains: q, mode: 'insensitive' } } },
            { messages: { some: { body: { contains: q, mode: 'insensitive' } } } },
          ],
        }
      : {}),
  };

  const { items, page } = await paginate(prisma.supportTicket, {
    where,
    orderBy: readSort(req.valid.query, SORT_COLUMNS, { lastMessageAt: 'desc' }),
    select: {
      id: true,
      kind: true,
      category: true,
      status: true,
      subject: true,
      rating: true,
      lastMessageAt: true,
      createdAt: true,
      user: USER,
      _count: { select: { messages: true } },
      messages: { orderBy: { createdAt: 'desc' }, take: 1, select: { body: true, fromStaff: true } },
    },
    query: req.valid.query,
  });

  return paginated(
    res,
    items.map(({ messages, _count, ...ticket }) => ({
      ...ticket,
      messageCount: _count.messages,
      preview: messages[0] ? messages[0].body.slice(0, 140) : null,
      awaitingStaff: messages[0] ? !messages[0].fromStaff : ticket.kind === 'TICKET',
    })),
    page
  );
};

/** GET /api/admin/support/summary — counts for the filter chips and the average rating. */
export const summary = async (req, res) => {
  const [byStatus, byKind, ratings] = await Promise.all([
    prisma.supportTicket.groupBy({ by: ['status'], where: { kind: 'TICKET' }, _count: { _all: true } }),
    prisma.supportTicket.groupBy({ by: ['kind'], _count: { _all: true } }),
    prisma.supportTicket.aggregate({ where: { rating: { not: null } }, _avg: { rating: true }, _count: { _all: true } }),
  ]);
  const count = (rows, key, value) => rows.find((r) => r[key] === value)?._count._all || 0;
  return ok(res, {
    open: count(byStatus, 'status', 'OPEN'),
    inProgress: count(byStatus, 'status', 'IN_PROGRESS'),
    resolved: count(byStatus, 'status', 'RESOLVED'),
    tickets: count(byKind, 'kind', 'TICKET'),
    feedback: count(byKind, 'kind', 'FEEDBACK'),
    averageRating: ratings._avg.rating ? Number(ratings._avg.rating.toFixed(2)) : null,
    ratingCount: ratings._count._all,
  });
};

/** GET /api/admin/support/tickets/:id */
export const get = async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({
    where: { id: req.valid.params.id },
    include: { user: USER, messages: { orderBy: { createdAt: 'asc' } } },
  });
  if (!ticket) throw notFound('Ticket');

  const staffIds = [...new Set(ticket.messages.filter((m) => m.fromStaff).map((m) => m.authorId))];
  const staff = staffIds.length ? await prisma.user.findMany({ where: { id: { in: staffIds } }, select: { id: true, name: true, email: true } }) : [];
  const byId = new Map(staff.map((s) => [s.id, s]));

  const { screenshotKey, ...rest } = ticket;
  return ok(res, {
    ...rest,
    screenshotUrl: screenshotKey ? await s3.presignGet(screenshotKey) : null,
    messages: ticket.messages.map((m) => ({ ...m, author: m.fromStaff ? byId.get(m.authorId) || null : undefined })),
  });
};

/** POST /api/admin/support/tickets/:id/messages */
export const reply = async (req, res) => {
  const ticket = await prisma.supportTicket.findUnique({ where: { id: req.valid.params.id } });
  if (!ticket) throw notFound('Ticket');
  const body = req.valid.body.body.trim();

  const message = await prisma.supportMessage.create({ data: { ticketId: ticket.id, authorId: req.auth.user.id, fromStaff: true, body } });
  await prisma.supportTicket.update({
    where: { id: ticket.id },
    data: {
      lastMessageAt: message.createdAt,
      userUnread: true,
      assigneeId: ticket.assigneeId || req.auth.user.id,
      ...(ticket.status === 'OPEN' ? { status: 'IN_PROGRESS' } : {}),
    },
  });

  await audit.record(req, { action: 'support.reply', entityType: 'SupportTicket', entityId: ticket.id });

  // The reply is saved either way; a push that fails must not turn it into an error.
  // The title greets the reader in their language; the body is the staff member's own words.
  await notify
    .recipient(ticket.userId)
    .then(({ name, chain }) =>
      notify.toUser(ticket.userId, {
        type: 'SUPPORT',
        title: greetedTitle(name, chain, notice('supportReplyTitle', chain)),
        body: body.length > 140 ? `${body.slice(0, 137)}…` : body,
        data: { deeplink: `hariharibol://ticket?id=${ticket.id}`, ticketId: ticket.id },
        campaign: 'support:reply',
        source: 'support',
      })
    )
    .catch(() => null);

  return created(res, message);
};

/** PATCH /api/admin/support/tickets/:id */
export const update = async (req, res) => {
  const { status, assigneeId } = req.valid.body;
  const before = await prisma.supportTicket.findUnique({ where: { id: req.valid.params.id } });
  if (!before) throw notFound('Ticket');

  const data = {};
  if (status && status !== before.status) {
    data.status = status;
    data.resolvedAt = status === 'RESOLVED' ? new Date() : null;
  }
  if (assigneeId !== undefined) data.assigneeId = assigneeId;

  const ticket = await prisma.supportTicket.update({ where: { id: before.id }, data });
  await audit.record(req, {
    action: 'support.update',
    entityType: 'SupportTicket',
    entityId: ticket.id,
    before: { status: before.status, assigneeId: before.assigneeId },
    after: { status: ticket.status, assigneeId: ticket.assigneeId },
  });
  return ok(res, ticket);
};
