// AI chat — shown to readers as "Ask Sakha", a friend to talk dharma with.
//
// The reply is streamed (Server-Sent Events) from the provider through here to
// the app; the app never talks to a provider and never sees a key. The shape of
// one request, and the things that bound its cost and its wait:
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
//   4. *nobody waits for housekeeping*: the summary is its own model call, so it
//      runs after the reply has gone out (`compactInBackground`), never in front
//      of it; the next reply uses whatever the summary is by then.
//   5. the *name stays out of the prompt*: Sakha writes `{name}` where it would
//      say the reader's first name and the server fills it in on the way out
//      (utils/chat-name.js). What is stored keeps the token.
//
// SSE events, in order: `meta` · `delta`… · `done`, or `error` at any point. A
// request the server refuses before streaming gets an
// ordinary JSON error instead, with a status and `error.code` the app maps to a
// screen: CREDITS_EXHAUSTED (402) and CONVERSATION_LIMIT (409).
//
// An `error` event never carries what the provider or our own code said: the app writes its own words for
// the code, and utils/chat-errors.js decides which code a failure is reported as.
//
// A message can carry one picture. It is uploaded first (`uploadImage`: checked, drawn again as a JPEG and stored),
// then named by its key when the message is sent; only the newest picture in the chat goes to the model.

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import logger from '../../config/logger.js';
import { IMAGE_TOKEN_ESTIMATE, IMAGE_UPLOAD_MAX_BYTES, MIN_REPLY_TOKENS } from '../../config/chat.js';
import * as ai from '../../services/ai/index.js';
import * as tokens from '../../services/ai/tokens.js';
import * as wallet from '../../services/ai-wallet.js';
import * as chatImages from '../../services/chat-images.js';
import * as chatSettings from '../../services/chat-settings.js';
import * as s3 from '../../services/s3.js';
import * as chatImage from '../../utils/chat-image.js';
import * as context from '../../utils/chat-context.js';
import * as chatName from '../../utils/chat-name.js';
import { forReader } from '../../utils/chat-errors.js';
import { ok, created, noContent, paginated } from '../../utils/respond.js';
import { readPage } from '../../utils/pagination.js';
import { AppError, notFound, conflict } from '../../utils/errors.js';

// A summary is a single cheap-model call; the lock outlives any sane one and expires on its own if the process dies.
const COMPACTION_LOCK_SECONDS = 90;
// How long a reader's own request (tidy, start a new chat) waits for a compaction already under way.
const COMPACTION_WAIT_MS = 20_000;

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

// [firstName] is the reader's, for filling in Sakha's `{name}`; what the reader typed is shown as typed.
async function presentMessage(m, summarizedThroughSeq = 0, firstName = null) {
  return {
    id: m.id,
    seq: m.seq,
    role: m.role === 'USER' ? 'user' : 'assistant',
    content: m.role === 'USER' ? m.content : chatName.fill(m.content, firstName),
    // A link to the picture sent with it, or null. The bucket is private, so the link is signed when asked for.
    imageUrl: m.imagePath ? await s3.presignGet(m.imagePath) : null,
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

// [limits] when the caller has them already; settings are cached, but a reply should not ask twice.
async function limitFor(conversation, opened, limits = null) {
  limits ??= await chatSettings.limits();
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

// One compaction per conversation at a time: two would both start from the same summary and the later write would
// throw the earlier one's away. A background run that finds one going just leaves it to finish; a reader's own request
// (tidy, start a new chat) waits for it, because it needs the result.
async function withCompactionLock(conversationId, work, { wait = false } = {}) {
  const key = `chat:compact:${conversationId}`;
  const give = Date.now() + (wait ? COMPACTION_WAIT_MS : 0);
  for (;;) {
    const got = await redis.set(key, '1', 'EX', COMPACTION_LOCK_SECONDS, 'NX').catch(() => 'OK');
    if (got) break;
    if (Date.now() >= give) return null;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  try {
    return await work();
  } finally {
    await redis.del(key).catch(() => null);
  }
}

/**
 * Folds older messages into the conversation's summary with the cheap model and charges the wallet for it.
 *
 * It reads the conversation itself, inside the lock, so it works from the summary as it is now and not as the caller
 * saw it a moment ago. Returns null when it could not run (another compaction holds the lock, or the conversation is
 * gone), else `{ conversation, compacted }`: the conversation as it stands, and whether this call changed the summary.
 * Nothing to do, or a reader who cannot afford it, is `compacted: false` — a conversation is never blocked just because
 * tidying it would cost credits.
 */
async function compact({ conversationId, user, limits, force = false, keep, wait = false }) {
  return withCompactionLock(conversationId, async () => {
    const conversation = await prisma.chatConversation.findUnique({ where: { id: conversationId } });
    if (!conversation) return null;
    const nothing = { conversation, compacted: false };

    const plan = context.planCompaction({ messages: await loadLive(conversation), limits, force, keep });
    if (!plan) return nothing;

    const request = context.summarizerRequest({
      existingSummary: conversation.contextSummary,
      messages: plan.messages,
      maxTokens: limits.summaryMaxTokens,
    });
    const needed = tokens.estimate(request.system) + tokens.estimate(request.prompt) + limits.summaryMaxTokens;

    const opened = await wallet.open(user);
    if (!opened.wallet || wallet.room(opened, null).available < needed) return nothing;

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
      if (!summary) return nothing;

      const spent = result.usage.inputTokens + result.usage.outputTokens;
      await wallet.debit({
        userId: user.id, tokens: spent, source: 'SUMMARIZATION', referenceId: conversation.id, timezone: user.timezone,
      });
      const updated = await prisma.chatConversation.update({
        where: { id: conversation.id },
        data: { contextSummary: summary, summarizedThroughSeq: plan.upToSeq, tokensUsed: { increment: spent } },
      });
      return { conversation: updated, compacted: true };
    } catch (error) {
      // The conversation carries on with its window of recent messages; the next reply tries again. A chat cleared
      // while its summary was being written is not a fault.
      const gone = error.code === 'P2025';
      logger[gone ? 'debug' : 'warn']({ err: error.message, conversationId: conversation.id }, 'chat compaction failed');
      return nothing;
    }
  }, { wait });
}

// After a reply has gone out: tidy the history without anyone waiting for it. In this process, not a queue — the work is
// one cheap-model call, and a summary lost to a restart is simply made after the next reply, which checks again.
function compactInBackground({ conversationId, user, limits }) {
  compact({ conversationId, user, limits }).catch((error) =>
    logger.warn({ err: error.message, conversationId }, 'chat background compaction failed')
  );
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

// A conversation with all its messages, and whether it is full.
async function presentDetail(conversation, user) {
  const [messages, opened] = await Promise.all([
    prisma.chatMessage.findMany({ where: { conversationId: conversation.id }, orderBy: { seq: 'asc' }, take: 1000 }),
    wallet.open(user),
  ]);
  const firstName = chatName.firstNameOf(user.name);
  return {
    ...presentConversation(conversation, await limitFor(conversation, opened)),
    messages: await Promise.all(messages.map((m) => presentMessage(m, conversation.summarizedThroughSeq, firstName))),
  };
}

/** GET /api/app/chat/conversations/:id */
export const get = async (req, res) => {
  const conversation = await owned(req.valid.params.id, req.auth.user.id);
  return ok(res, await presentDetail(conversation, req.auth.user));
};

/** GET /api/app/chat/current */
export const current = async (req, res) => {
  const conversation = await prisma.chatConversation.findFirst({
    where: { userId: req.auth.user.id },
    orderBy: { lastMessageAt: 'desc' },
  });
  return ok(res, conversation ? await presentDetail(conversation, req.auth.user) : null);
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
  const pictures = await chatImages.keysWhere({ conversationId: req.valid.params.id });
  await prisma.chatConversation.delete({ where: { id: req.valid.params.id } });
  await chatImages.deleteFiles(pictures);
  return noContent(res);
};

/**
 * DELETE /api/app/chat/conversations — the reader's "clear chat". Every conversation goes, not just the
 * newest, so nothing of what Sakha remembered (the running summary lives on the conversation) is left
 * behind, and the pictures sent in them go too. Credits already spent stay spent: the ledger refers to
 * conversations by id only.
 */
export const clearAll = async (req, res) => {
  const user = req.auth.user;
  // Not while a reply is being written: it would be saved into a conversation that no longer exists.
  return withLock(user.id, async () => {
    const pictures = await chatImages.keysWhere({ conversation: { userId: user.id } });
    await prisma.chatConversation.deleteMany({ where: { userId: user.id } });
    await chatImages.deleteFiles(pictures);
    return noContent(res);
  });
};

// ── Pictures ───────────────────────────────────────────────────────────────

const notAvailable = () =>
  new AppError(402, 'CHAT_NOT_AVAILABLE', 'Ask Sakha is not part of your plan yet.', { canUpgrade: true });
const picturesOff = () => new AppError(403, 'IMAGE_NOT_AVAILABLE', 'Pictures are not available right now.');
const unusablePicture = (message = 'That picture cannot be used') => new AppError(422, 'IMAGE_NOT_USABLE', message);

/** POST /api/app/chat/images — the body is the picture. Stored as a clean JPEG; the key goes with the next message. */
export const uploadImage = async (req, res) => {
  const user = req.auth.user;
  const [limits, opened] = await Promise.all([chatSettings.limits(), wallet.open(user)]);
  if (!opened.allowance?.isEnabled || !opened.wallet) throw notAvailable();
  if (limits.imageInput <= 0) throw picturesOff();

  const bytes = req.body;
  if (!Buffer.isBuffer(bytes) || bytes.length === 0) throw new AppError(400, 'IMAGE_NOT_USABLE', 'No picture was sent');
  if (bytes.length > IMAGE_UPLOAD_MAX_BYTES) throw new AppError(413, 'IMAGE_TOO_LARGE', 'That picture is too large');

  const picture = await chatImage.prepare(bytes, { maxEdge: limits.imageMaxEdge });
  const key = s3.buildKey('chatImage', picture.contentType);
  await s3.putObject(key, picture.buffer, picture.contentType);
  await chatImages.claim(key, user.id);

  return ok(res, { key, url: await s3.presignGet(key), width: picture.width, height: picture.height });
};

/**
 * The picture a new message names, checked: a key this server generated for a chat picture, uploaded by this reader
 * and not used yet. Null when the message carries none.
 */
async function claimedPicture(key, userId, limits) {
  if (!key) return null;
  if (limits.imageInput <= 0) throw picturesOff();
  if (!chatImages.isChatImageKey(key) || !(await chatImages.isClaimedBy(key, userId))) throw unusablePicture();
  return key;
}

/**
 * What would go to the model: the system prompt and the messages, with the picture note added when a message
 * carries a picture. Good for the cost pre-check; `reply()` builds the system prompt again once the pictures are
 * read, because only then is it known which ones will really be sent.
 */
function promptFor({ persona, conversation, live, limits, userText, pictureKey, withName }) {
  const messages = context.buildMessages({ live, recentMessages: limits.recentMessages, userText, userImageKey: pictureKey });
  const withImage = messages.some((m) => m.imageKey);
  return { messages, system: context.buildSystem({ persona, summary: conversation.contextSummary, withImage, withName }) };
}

/**
 * Turns each `imageKey` into the picture itself for the provider. A picture that is gone from storage, or pictures
 * switched off since it was sent, becomes the note that there was one, so the chat carries on.
 */
async function withPictures(messages, limits) {
  return Promise.all(
    messages.map(async ({ imageKey, ...message }) => {
      if (!imageKey) return message;
      const bytes = limits.imageInput > 0 ? await s3.getObjectBuffer(imageKey) : null;
      if (!bytes) return { ...message, content: context.withPlaceholder(message.content, true) };
      return { ...message, image: { mimeType: 'image/jpeg', base64: bytes.toString('base64') } };
    })
  );
}

// ── Sending ────────────────────────────────────────────────────────────────

async function reply(req, res, { regenerate }) {
  const user = req.auth.user;
  const firstName = chatName.firstNameOf(user.name);
  const { id } = req.valid.params;
  const text = regenerate ? null : req.valid.body.content.trim();
  const startedAt = Date.now();

  return withLock(user.id, async () => {
    let conversation = await owned(id, user.id);
    // Nothing below depends on anything else here, so it is read together rather than one after another.
    const [persona, limits, opened, liveRows] = await Promise.all([
      chatSettings.systemPrompt(), chatSettings.limits(), wallet.open(user), loadLive(conversation),
    ]);

    if (text && text.length > limits.maxInputChars) {
      throw new AppError(400, 'MESSAGE_TOO_LONG', `Please keep a message under ${limits.maxInputChars} characters.`);
    }

    if (!opened.allowance?.isEnabled || !opened.wallet) throw notAvailable();

    let pictureKey = regenerate ? null : await claimedPicture(req.valid.body.imageKey, user.id, limits);

    // Hard limits first: a full conversation is a clear "start a new chat".
    const full = await limitFor(conversation, opened, limits);
    if (full && !regenerate) throw limitError(full);

    // Regenerate = answer the last user message again. Whatever assistant text
    // follows it is dropped (its credits were spent and stay spent).
    let userText = text;
    let live = liveRows;
    let answered = null; // the question a regenerate answers again
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
      pictureKey = lastUser.imagePath || null;
      answered = lastUser;
    }

    // Cheap pre-check, before opening a stream: can this person afford even the prompt?
    const withName = Boolean(firstName);
    const quickPrompt = context.estimatePrompt(promptFor({ persona, conversation, live, limits, userText, pictureKey, withName }));
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
    let tidyAfter = false; // set once a reply has gone out whole and the history has outgrown its window
    try {
      // 1. The prompt, and what is left to spend on the answer. A history that has outgrown its window is not
      //    compacted here: the prompt takes the newest messages and the summary as it stands, and the summary is
      //    brought up to date after the reply (below), so nobody waits for a model call that is not their answer.
      const draft = promptFor({ persona, conversation, live, limits, userText, pictureKey, withName });
      // Read before the question is saved: saving moves a fresh upload to its permanent key.
      const messages = await withPictures(draft.messages, limits);
      // Built from what is really sent: pictures switched off, or a file gone from storage, must not leave the
      // persona describing a picture the model was never given.
      const system = context.buildSystem({
        persona, summary: conversation.contextSummary, withImage: messages.some((m) => m.image), withName,
      });
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
            data: {
              conversationId: conversation.id,
              seq,
              role: 'USER',
              content: userText,
              // Saving moves the upload out of temp/ and keeps its permanent key (config/database.js).
              imagePath: pictureKey,
              tokenCount: tokens.estimate(userText) + (pictureKey ? IMAGE_TOKEN_ESTIMATE : 0),
            },
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
            // A picture alone gives nothing to name the chat by.
            ...(firstMessage && userText && conversation.title === 'New chat' ? { title: context.titleFrom(userText) } : {}),
          },
        });
        return { question, answer, conversation: updated };
      });
      assistant = rows.answer;
      conversation = rows.conversation;
      if (rows.question && pictureKey) await chatImages.release(pictureKey);
      stream.send('meta', {
        conversation: presentConversation(conversation),
        userMessage: rows.question && (await presentMessage(rows.question)),
        assistantMessageId: assistant.id,
      });

      // 4. Stream.
      const streamStartedAt = Date.now();
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

      // What is saved is what the model wrote, `{name}` and all; what is sent is the reader's first name in its place
      // (and again whenever the message is read back), so the name is never part of the history the model is shown.
      const filler = chatName.createFiller(firstName);
      const sendDelta = (text) => {
        if (text) stream.send('delta', { text });
      };
      let content = '';
      let status = 'COMPLETE';
      let failure = null;
      let lastFlush = Date.now();
      let firstTokenAt = null;

      try {
        for await (const piece of run.text) {
          firstTokenAt ??= Date.now();
          content += piece;
          sendDelta(filler.push(piece));
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
      // Whatever the filler was holding back in case it was the start of `{name}` was only ever text.
      sendDelta(filler.flush());
      const streamedAt = Date.now();

      // 5. Settle. Nothing arrived and the provider billed nothing → nothing is charged. The writes do not depend on
      //    one another, so they go together, and the reader is not left waiting on a chain of round trips.
      const billed = content.length > 0 || !run.usage.estimated;
      const spent = billed ? run.usage.inputTokens + run.usage.outputTokens : 0;
      const dropAnswer = !content && status !== 'COMPLETE';
      const conversationChange = {
        ...(dropAnswer ? { messageCount: { decrement: 1 } } : {}),
        ...(spent > 0 ? { tokensUsed: { increment: spent } } : {}),
      };
      const answerId = assistant.id;

      const [savedAnswer, settledConversation, openedAfter] = await Promise.all([
        dropAnswer
          ? prisma.chatMessage.delete({ where: { id: answerId } }).then(() => null, () => null)
          : prisma.chatMessage.update({
            where: { id: answerId },
            data: {
              content, status, tokenCount: tokens.estimate(content),
              inputTokens: run.usage.inputTokens, outputTokens: run.usage.outputTokens, model: run.model,
            },
          }),
        Object.keys(conversationChange).length
          ? prisma.chatConversation.update({ where: { id: conversation.id }, data: conversationChange })
          : conversation,
        // The charge is one transaction of its own; the wallet is read again only once it has landed.
        spent > 0
          ? wallet.debit({
            userId: user.id, tokens: spent, source: 'CHAT',
            referenceId: dropAnswer ? conversation.id : answerId, timezone: user.timezone,
          }).then(() => wallet.open(user))
          : opened,
      ]);
      assistant = savedAnswer;
      conversation = settledConversation;

      if (failure) {
        logger.warn({ err: failure.message, code: failure.code, conversationId: conversation.id }, 'chat stream failed');
        // Whatever broke while reading the provider's stream is a provider failure, even a dropped socket.
        const reason = failure instanceof AppError ? failure : new AppError(502, 'AI_FAILED', failure.message);
        stream.send('error', { ...forReader(reason), partial: Boolean(content), messageId: assistant?.id || null });
      } else {
        stream.send('done', {
          message: assistant ? await presentMessage(assistant, 0, firstName) : null,
          conversation: presentConversation(conversation, await limitFor(conversation, openedAfter, limits)),
          credits: await wallet.statusFrom(openedAfter, user),
        });
        // The summary is brought up to date once the reader has the whole answer (below).
        tidyAfter = Boolean(context.planCompaction({
          messages: context.liveMessages(
            [...live, answered || rows.question, savedAnswer].filter(Boolean), conversation.summarizedThroughSeq,
          ),
          limits,
        }));
      }
      logger.debug({
        conversationId: conversation.id,
        beforeStreamMs: streamStartedAt - startedAt,
        firstTokenMs: firstTokenAt ? firstTokenAt - streamStartedAt : null,
        streamMs: streamedAt - streamStartedAt,
        settleMs: Date.now() - streamedAt,
      }, 'chat reply timing');
    } catch (error) {
      if (assistant) {
        // Don't leave an empty placeholder behind.
        await prisma.chatMessage.deleteMany({ where: { id: assistant.id, content: '' } }).catch(() => null);
      }
      // The real reason stays in the log; the reader is sent a fixed line (utils/chat-errors.js).
      const level = error instanceof AppError ? 'warn' : 'error';
      logger[level]({ err: error?.message, code: error?.code, conversationId: conversation.id }, 'chat reply failed');
      stream.send('error', forReader(error));
    } finally {
      clearInterval(heartbeat);
      if (!clientGone) res.end();
    }
    // The reader has everything they asked for; only now is the summary brought up to date. The reply lock is released
    // as this returns, so their next message is not held up by it.
    if (tidyAfter) compactInBackground({ conversationId: conversation.id, user, limits });
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

    // Waits for a tidy already under way, then makes sure the summary is as far on as the reader asked for.
    const result = await compact({ conversationId: conversation.id, user, limits, force: true, wait: true });
    const current = result?.conversation || conversation;
    const opened = await wallet.open(user);
    return ok(res, {
      compacted: Boolean(result?.compacted),
      conversation: presentConversation(current, await limitFor(current, opened, limits)),
      credits: await wallet.statusFrom(opened, user),
    });
  });
};

/** POST /api/app/chat/conversations/:id/continue */
export const continueChat = async (req, res) => {
  const user = req.auth.user;
  return withLock(user.id, async () => {
    let conversation = await owned(req.valid.params.id, user.id);
    const limits = await chatSettings.limits();

    // Fold everything into the summary so the new chat starts with the whole of it. This waits for any tidy already
    // under way and then runs its own, because the new chat must start from a summary that has the last turns in it.
    await compact({ conversationId: conversation.id, user, limits, force: true, keep: 0, wait: true });
    conversation = await owned(conversation.id, user.id);
    // Anything still live was not folded in: could not afford it, or the summary came back empty. The older summary
    // goes forward, the recent turns do not.
    const carried = (await loadLive(conversation)).length === 0;

    const next = await prisma.chatConversation.create({
      data: { userId: user.id, contextSummary: conversation.contextSummary, carriedFromId: conversation.id },
    });
    return created(res, { conversation: presentConversation(next), carriedEverything: carried });
  });
};
