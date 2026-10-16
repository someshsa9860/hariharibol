// AI chat — the devotional assistant.
//
// The reply is streamed (Server-Sent Events) from the provider through here to
// the app; the app never talks to a provider and never sees a key. The shape of
// one request, and the three things that bound its cost:
//
//   1. the *prompt is kept small*: persona + a running summary of older
//      messages + the newest few (utils/chat-context.js). Old messages are
//      folded into `ChatConversation.contextSummary` by the cheap model when the
//      history grows, and stay in the table for display.
//   2. the *call is paid for first*: the wallet is checked (daily cap, balance,
//      per-conversation share) before the provider is contacted, and the reply
//      is capped to what is left (services/ai-wallet.js).
//   3. the *actual usage is charged after*: the provider's own token counts, for
//      the reply and for every summary, debit the same wallet.
//
// SSE events, in order: `meta` · `status` (compacting) · `delta`… · `done`, or
// `error` at any point. A request the server refuses before streaming gets an
// ordinary JSON error instead, with a status and `error.code` the app maps to a
// screen: CREDITS_EXHAUSTED (402) and CONVERSATION_LIMIT (409).

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { MIN_REPLY_TOKENS } from '../../config/chat.js';
import * as ai from '../../services/ai/index.js';
import * as tokens from '../../services/ai/tokens.js';
import * as wallet from '../../services/ai-wallet.js';
import * as chatSettings from '../../services/chat-settings.js';
import * as context from '../../utils/chat-context.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { AppError, notFound, conflict } from '../../utils/errors.js';

// ── Presenters ─────────────────────────────────────────────────────────────
// Token counts never leave the server in these.

function presentConversation(c, limit = null) {
  return {
    id: c.id,
    title: c.title,
    messageCount: c.messageCount,
    hasSummary: Boolean(c.contextSummary),
    carriedFromId: c.carriedFromId,
    createdAt: c.createdAt,
    lastMessageAt: c.lastMessageAt,
    // 'MESSAGES' | 'TOKENS' when this chat cannot take another message.
    limitReached: limit,
  };
}

function presentMessage(m, summarizedThroughSeq = 0) {
  return {
    id: m.id,
    seq: m.seq,
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.content,
    status: m.status,
    createdAt: m.createdAt,
    // Folded into the summary: still shown, no longer sent to the model.
    summarized: m.seq <= summarizedThroughSeq,
  };
}

// ── Helpers ────────────────────────────────────────────────────────────────

async function owned(id, userId) {
  const conversation = await prisma.chatConversation.findFirst({ where: { id, userId } });
  if (!conversation) throw notFound('Conversation');
  return conversation;
}

async function limitFor(conversation, opened) {
  const limits = await chatSettings.limits();
  return context.conversationLimit({
    conversation,
    maxMessages: limits.maxMessages,
    conversationTokenLimit: opened.allowance?.conversationTokens || 0,
  });
}

function creditsError(opened, user, reason, status) {
  const messages = {
    DAILY: 'You have used today’s credits. They refill at midnight — you can continue then, or upgrade for more.',
    WALLET: 'Your credits have run out. They renew with your plan, or you can upgrade to keep going.',
    CONVERSATION: 'This chat has used its share of credits. Start a new chat — I will carry on from where we were.',
  };
  return new AppError(402, 'CREDITS_EXHAUSTED', messages[reason] || messages.WALLET, {
    limitedBy: reason === 'DAILY' ? 'daily' : 'wallet',
    resetsAt: status?.resetsAt ?? null,
    canUpgrade: Boolean(status?.canUpgrade),
    startNewChat: reason === 'CONVERSATION',
  });
}

function limitError(reason) {
  return new AppError(
    409,
    'CONVERSATION_LIMIT',
    'This chat has grown long. Start a new chat and I will carry our conversation forward.',
    { reason, canContinue: true }
  );
}

// One reply at a time per person: two streams racing would both pass the
// credit check against the same balance.
async function withLock(userId, work) {
  const key = `chat:lock:${userId}`;
  const got = await redis.set(key, '1', 'EX', 240, 'NX').catch(() => 'OK');
  if (!got) throw conflict('Please wait for the current reply to finish');
  try {
    return await work();
  } finally {
    await redis.del(key).catch(() => null);
  }
}

function openStream(res) {
  res.status(200).set({
    'Content-Type': 'text/event-stream; charset=utf-8',
    // no-transform keeps `compression` from buffering the stream.
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
  return {
    send(event, data) {
      if (res.writableEnded || res.destroyed) return;
      res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    },
    ping() {
      if (!res.writableEnded && !res.destroyed) res.write(': ping\n\n');
    },
  };
}

// ── Compaction ─────────────────────────────────────────────────────────────

/**
 * Folds older messages into the conversation's summary with the cheap model and
 * charges the wallet for it. Returns the updated conversation, or null if
 * nothing was compacted (nothing to do, or the reader cannot afford it — a
 * conversation is never blocked just because tidying it would cost credits).
 */
async function compact({ conversation, live, user, limits, force = false, keep }) {
  const plan = context.planCompaction({ messages: live, limits, force, keep });
  if (!plan) return null;

  const request = context.summarizerRequest({
    existingSummary: conversation.contextSummary,
    messages: plan.messages,
    maxTokens: limits.summaryMaxTokens,
  });
  const needed = tokens.estimate(request.system) + tokens.estimate(request.prompt) + limits.summaryMaxTokens;

  const opened = await wallet.open(user);
  if (!opened.wallet || wallet.room(opened, null).available < needed) return null;

  try {
    const result = await ai.complete({
      operation: ai.OPERATIONS.CHAT_SUMMARY,
      purpose: 'summary',
      system: request.system,
      prompt: request.prompt,
      maxTokens: Math.ceil(limits.summaryMaxTokens * 1.5),
      temperature: 0.2,
      userId: user.id,
      targetType: 'chat',
      targetId: conversation.id,
    });

    const summary = context.capSummary(result.text, limits.summaryMaxTokens);
    if (!summary) return null;

    const spent = result.usage.inputTokens + result.usage.outputTokens;
    await wallet.debit({
      userId: user.id, tokens: spent, source: 'SUMMARIZATION', referenceId: conversation.id, timezone: user.timezone,
    });
    return await prisma.chatConversation.update({
      where: { id: conversation.id },
      data: { contextSummary: summary, summarizedThroughSeq: plan.upToSeq, tokensUsed: { increment: spent } },
    });
  } catch (error) {
    // The conversation carries on with its window of recent messages; the next
    // message tries again.
    logger.warn({ err: error.message, conversationId: conversation.id }, 'chat compaction failed');
    return null;
  }
}

async function loadLive(conversation) {
  const rows = await prisma.chatMessage.findMany({
    where: { conversationId: conversation.id, seq: { gt: conversation.summarizedThroughSeq } },
    orderBy: { seq: 'asc' },
  });
  return context.liveMessages(rows, conversation.summarizedThroughSeq);
}

// ── Status and conversations ───────────────────────────────────────────────

/** GET /api/app/chat/status */
export const getStatus = async (req, res) => {
  const [credits, description, limits] = await Promise.all([
    wallet.status(req.auth.user),
    chatSettings.description(),
    chatSettings.limits(),
  ]);
  return ok(res, { description, credits, limits: { maxInputChars: limits.maxInputChars, maxMessages: limits.maxMessages } });
};

/** GET /api/app/chat/conversations */
export const list = async (req, res) => {
  const { page, pageSize, skip, take } = readPage(req.valid.query);
  const where = { userId: req.auth.user.id };
  const [rows, total] = await Promise.all([
    prisma.chatConversation.findMany({ where, orderBy: { lastMessageAt: 'desc' }, skip, take }),
    prisma.chatConversation.count({ where }),
  ]);
  return paginated(res, rows.map((c) => presentConversation(c)), { page, pageSize, total });
};

/** POST /api/app/chat/conversations */
export const create = async (req, res) => {
  const conversation = await prisma.chatConversation.create({
    data: { userId: req.auth.user.id, title: req.valid.body.title || 'New chat' },
  });
  return created(res, presentConversation(conversation));
};

/** GET /api/app/chat/conversations/:id */
export const get = async (req, res) => {
  const conversation = await owned(req.valid.params.id, req.auth.user.id);
  const [messages, opened] = await Promise.all([
    prisma.chatMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { seq: 'asc' }, take: 1000 }),
    wallet.open(req.auth.user),
  ]);
  return ok(res, {
    ...presentConversation(conversation, await limitFor(conversation, opened)),
    messages: messages.map((m) => presentMessage(m, conversation.summarizedThroughSeq)),
  });
};

/** PATCH /api/app/chat/conversations/:id */
export const rename = async (req, res) => {
  await owned(req.valid.params.id, req.auth.user.id);
  const conversation = await prisma.chatConversation.update({
    where: { id: req.valid.params.id },
    data: { title: req.valid.body.title },
  });
  return ok(res, presentConversation(conversation));
};

/** DELETE /api/app/chat/conversations/:id */
export const remove = async (req, res) => {
  await owned(req.valid.params.id, req.auth.user.id);
  await prisma.chatConversation.delete({ where: { id: req.valid.params.id } });
  return noContent(res);
};

// ── Sending ────────────────────────────────────────────────────────────────

async function reply(req, res, { regenerate }) {
  const user = req.auth.user;
  const { id } = req.valid.params;
  const text = regenerate ? null : req.valid.body.content.trim();

  return withLock(user.id, async () => {
    let conversation = await owned(id, user.id);
    const [persona, limits] = await Promise.all([chatSettings.systemPrompt(), chatSettings.limits()]);

    if (text && text.length > limits.maxInputChars) {
      throw new AppError(400, 'MESSAGE_TOO_LONG', `Please keep a message under ${limits.maxInputChars} characters.`);
    }

    let opened = await wallet.open(user);
    if (!opened.allowance?.isEnabled || !opened.wallet) {
      throw new AppError(402, 'CHAT_NOT_AVAILABLE', 'AI chat is not part of your plan yet.', { canUpgrade: true });
    }

    // Hard limits first: a full conversation is a clear "start a new chat".
    const full = await limitFor(conversation, opened);
    if (full && !regenerate) throw limitError(full);

    // Regenerate = answer the last user message again. Whatever assistant text
    // follows it is dropped (its credits were spent and stay spent).
    let userText = text;
    let live = await loadLive(conversation);
    if (regenerate) {
      while (live.length && live[live.length - 1].role === 'ASSISTANT') {
        const last = live.pop();
        await prisma.chatMessage.delete({ where: { id: last.id } });
        conversation = await prisma.chatConversation.update({
          where: { id: conversation.id }, data: { messageCount: { decrement: 1 } },
        });
      }
      const lastUser = live.pop();
      if (!lastUser || lastUser.role !== 'USER') throw new AppError(400, 'NOTHING_TO_REGENERATE', 'There is no message to answer.');
      userText = lastUser.content;
    }

    // Cheap pre-check, before opening a stream: can this person afford even the prompt?
    const quickPrompt = context.estimatePrompt({
      system: context.buildSystem({ persona, summary: conversation.contextSummary }),
      messages: context.buildMessages({ live, recentMessages: limits.recentMessages, userText }),
    });
    const quick = wallet.room(opened, conversation);
    if (quick.available < quickPrompt + MIN_REPLY_TOKENS) {
      throw creditsError(opened, user, quick.blockedBy(quickPrompt + MIN_REPLY_TOKENS) || 'WALLET', await wallet.status(user));
    }

    // ── From here on the answer is a stream ─────────────────────────────
    const stream = openStream(res);
    const heartbeat = setInterval(() => stream.ping(), 15000);
    const abort = new AbortController();
    let clientGone = false;
    res.on('close', () => {
      if (!res.writableEnded) {
        clientGone = true;
        abort.abort();
      }
    });

    let assistant = null;
    try {
      // 1. Compact first if the history has grown.
      const wouldCompact = context.planCompaction({ messages: live, limits });
      if (wouldCompact) {
        stream.send('status', { phase: 'compacting' });
        const updated = await compact({ conversation, live, user, limits });
        if (updated) {
          conversation = updated;
          live = live.filter((m) => m.seq > conversation.summarizedThroughSeq);
          opened = await wallet.open(user);
        }
      }

      // 2. The prompt, and what is left to spend on the answer.
      const system = context.buildSystem({ persona, summary: conversation.contextSummary });
      const messages = context.buildMessages({ live, recentMessages: limits.recentMessages, userText });
      const estimatedInput = context.estimatePrompt({ system, messages });
      const room = wallet.room(opened, conversation);
      const maxTokens = Math.min(limits.maxOutputTokens, room.available - estimatedInput);
      if (maxTokens < MIN_REPLY_TOKENS) {
        throw creditsError(opened, user, room.blockedBy(estimatedInput + MIN_REPLY_TOKENS) || 'WALLET', await wallet.status(user));
      }

      // 3. Save the question and an empty answer (flushed as it grows, so a
      //    crash leaves the reader what had arrived rather than nothing).
      const firstMessage = conversation.messageCount === 0;
      const base = conversation.lastSeq;
      const rows = await prisma.$transaction(async (tx) => {
        let question = null;
        let seq = base;
        if (!regenerate) {
          seq += 1;
          question = await tx.chatMessage.create({
            data: { conversationId: conversation.id, seq, role: 'USER', content: userText, tokenCount: tokens.estimate(userText) },
          });
        }
        seq += 1;
        const answer = await tx.chatMessage.create({
          data: { conversationId: conversation.id, seq, role: 'ASSISTANT', content: '', status: 'PARTIAL' },
        });
        const updated = await tx.chatConversation.update({
          where: { id: conversation.id },
          data: {
            lastSeq: seq,
            messageCount: { increment: regenerate ? 1 : 2 },
            lastMessageAt: new Date(),
            ...(firstMessage && conversation.title === 'New chat' ? { title: context.titleFrom(userText) } : {}),
          },
        });
        return { question, answer, conversation: updated };
      });
      assistant = rows.answer;
      conversation = rows.conversation;
      stream.send('meta', {
        conversation: presentConversation(conversation),
        userMessage: rows.question && presentMessage(rows.question),
        assistantMessageId: assistant.id,
      });

      // 4. Stream.
      const run = await ai.stream({
        operation: ai.OPERATIONS.CHAT_REPLY,
        purpose: opened.allowance.modelTier === 'ADVANCED' ? 'advanced' : 'text',
        system,
        messages,
        maxTokens,
        userId: user.id,
        targetType: 'chat',
        targetId: conversation.id,
        signal: abort.signal,
        estimatedInput,
      });

      let content = '';
      let status = 'COMPLETE';
      let failure = null;
      let lastFlush = Date.now();

      try {
        for await (const piece of run.text) {
          content += piece;
          stream.send('delta', { text: piece });
          if (Date.now() - lastFlush > 2500) {
            lastFlush = Date.now();
            prisma.chatMessage.update({ where: { id: assistant.id }, data: { content } }).catch(() => null);
          }
        }
      } catch (error) {
        if (abort.signal.aborted) status = 'STOPPED';
        else {
          failure = error;
          status = content ? 'PARTIAL' : 'ERROR';
        }
      }
      if (abort.signal.aborted && status === 'COMPLETE') status = 'STOPPED';

      // 5. Settle. Nothing arrived and the provider billed nothing → nothing is charged.
      const billed = content.length > 0 || !run.usage.estimated;
      const spent = billed ? run.usage.inputTokens + run.usage.outputTokens : 0;

      if (!content && status !== 'COMPLETE') {
        await prisma.chatMessage.delete({ where: { id: assistant.id } }).catch(() => null);
        await prisma.chatConversation.update({ where: { id: conversation.id }, data: { messageCount: { decrement: 1 } } });
        assistant = null;
      } else {
        assistant = await prisma.chatMessage.update({
          where: { id: assistant.id },
          data: {
            content, status, tokenCount: tokens.estimate(content),
            inputTokens: run.usage.inputTokens, outputTokens: run.usage.outputTokens, model: run.model,
          },
        });
      }

      if (spent > 0) {
        await wallet.debit({
          userId: user.id, tokens: spent, source: 'CHAT', referenceId: assistant?.id || conversation.id, timezone: user.timezone,
        });
        conversation = await prisma.chatConversation.update({
          where: { id: conversation.id }, data: { tokensUsed: { increment: spent } },
        });
      }

      if (failure) {
        logger.warn({ err: failure.message, conversationId: conversation.id }, 'chat stream failed');
        stream.send('error', {
          code: failure.code || 'AI_FAILED',
          message: 'I could not finish that reply. Please try again.',
          retryable: true,
          partial: Boolean(content),
          messageId: assistant?.id || null,
        });
      } else {
        const after = await wallet.open(user);
        stream.send('done', {
          message: assistant && presentMessage(assistant),
          conversation: presentConversation(conversation, await limitFor(conversation, after)),
          credits: await wallet.status(user),
        });
      }
    } catch (error) {
      if (assistant) {
        // Don't leave an empty placeholder behind.
        await prisma.chatMessage.deleteMany({ where: { id: assistant.id, content: '' } }).catch(() => null);
      }
      if (!(error instanceof AppError)) logger.error({ err: error.message }, 'chat reply failed');
      stream.send('error', {
        code: error.code || 'SERVER_ERROR',
        message: error instanceof AppError ? error.message : 'Something went wrong. Please try again.',
        retryable: !(error instanceof AppError) || error.status >= 500,
        details: error.details,
      });
    } finally {
      clearInterval(heartbeat);
      if (!clientGone) res.end();
    }
    return undefined;
  });
}

/** POST /api/app/chat/conversations/:id/messages  (text/event-stream) */
export const send = (req, res) => reply(req, res, { regenerate: false });

/** POST /api/app/chat/conversations/:id/regenerate  (text/event-stream) */
export const regenerate = (req, res) => reply(req, res, { regenerate: true });

// ── Compact and continue ───────────────────────────────────────────────────

/** POST /api/app/chat/conversations/:id/compact */
export const compactNow = async (req, res) => {
  const user = req.auth.user;
  return withLock(user.id, async () => {
    const conversation = await owned(req.valid.params.id, user.id);
    const limits = await chatSettings.limits();
    const live = await loadLive(conversation);

    const updated = await compact({ conversation, live, user, limits, force: true });
    const current = updated || conversation;
    const opened = await wallet.open(user);
    return ok(res, {
      compacted: Boolean(updated),
      conversation: presentConversation(current, await limitFor(current, opened)),
      credits: await wallet.status(user),
    });
  });
};

/** POST /api/app/chat/conversations/:id/continue */
export const continueChat = async (req, res) => {
  const user = req.auth.user;
  return withLock(user.id, async () => {
    let conversation = await owned(req.valid.params.id, user.id);
    const limits = await chatSettings.limits();
    const live = await loadLive(conversation);

    // Fold everything into the summary so the new chat starts with the whole of it.
    let carried = true;
    if (live.length) {
      const updated = await compact({ conversation, live, user, limits, force: true, keep: 0 });
      if (updated) conversation = updated;
      else carried = false; // could not afford it: the older summary goes forward, the recent turns do not
    }

    const next = await prisma.chatConversation.create({
      data: { userId: user.id, contextSummary: conversation.contextSummary, carriedFromId: conversation.id },
    });
    return created(res, { conversation: presentConversation(next), carriedEverything: carried });
  });
};
