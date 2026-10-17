import express from 'express';

import { IMAGE_UPLOAD_MAX_BYTES } from '../../config/chat.js';
import { createRouter, z, schemas } from '../../utils/router.js';
import { AppError } from '../../utils/errors.js';
import * as controller from '../../controllers/app/chat.js';

const router = createRouter({
  tag: 'Chat',
  prefix: '/chat',
  description:
    'Ask Sakha — the AI chat, which the app presents as a friend called Sakha rather than labelling it AI. ' +
    'Replies stream as Server-Sent Events; the app never talks to an AI ' +
    'provider. Readers see a credit meter (a percentage), never token counts. A request refused before ' +
    'streaming starts gets an ordinary JSON error: 402 `CREDITS_EXHAUSTED` (details: `limitedBy`, ' +
    '`resetsAt`, `canUpgrade`, `startNewChat`) or 409 `CONVERSATION_LIMIT` (call `/continue`).',
});

const conversationParams = z.object({ id: z.string().min(1) });

// The picture arrives as the request body itself, whatever its Content-Type says: what it really is, is judged from
// its bytes (utils/chat-image.js). The parser's own "too large" becomes the chat's own error.
const rawPicture = express.raw({ type: () => true, limit: IMAGE_UPLOAD_MAX_BYTES });
const readPicture = (req, res, next) =>
  rawPicture(req, res, (error) =>
    next(error?.type === 'entity.too.large' ? new AppError(413, 'IMAGE_TOO_LARGE', 'That picture is too large') : error)
  );

router.get(
  '/status',
  {
    summary: 'Chat status',
    description:
      'What to show before and around a chat: Sakha’s description (states its Sri Vaishnava ' +
      'orientation), the reader’s credit meter — `percent` 100→0, `limitedBy` ("daily" resets at their ' +
      'local midnight, "wallet" at `renewsAt`), `exhausted`, `canUpgrade`, their devotee `levelName` — ' +
      'and the input limits.',
    limit: 'read',
    responds: { 200: 'Description, credits and limits' },
  },
  controller.getStatus
);

router.post(
  '/images',
  {
    summary: 'Upload a picture to send to Sakha',
    description:
      'The request body is the picture itself (JPEG, PNG or WebP; the phone has already scaled it down). The ' +
      'server checks what the bytes really are, draws the picture again as a JPEG no larger than the admin’s ' +
      '`imageMaxEdge` (which drops the camera’s metadata and turns a sideways photo upright) and keeps that. ' +
      'Returns `{ key, url }`: send `key` as `imageKey` with the next message, within a day, and only once. ' +
      'The picture stays until the reader clears the chat or deletes the account. 402 `CHAT_NOT_AVAILABLE` ' +
      'when the plan has no chat, 403 `IMAGE_NOT_AVAILABLE` when pictures are switched off, 400 / 422 ' +
      '`IMAGE_NOT_USABLE` for an empty body or something that is not a readable picture, 413 `IMAGE_TOO_LARGE`.',
    limit: 'write',
    middleware: readPicture,
    responds: {
      200: 'The key to send with the message, and a link to the picture',
      400: 'Empty body',
      402: 'CHAT_NOT_AVAILABLE',
      403: 'IMAGE_NOT_AVAILABLE',
      413: 'IMAGE_TOO_LARGE',
      422: 'IMAGE_NOT_USABLE',
    },
  },
  controller.uploadImage
);

router.get(
  '/current',
  {
    summary: 'My conversation',
    description:
      'What the app opens: the conversation with the most recent activity, in the same shape as ' +
      '`/conversations/:id`, or `null` when the reader has not said anything yet (the first message ' +
      'creates one). The app shows one conversation, so this is the only read it makes.',
    limit: 'read',
    responds: { 200: 'The conversation with messages, or null' },
  },
  controller.current
);

router.get(
  '/conversations',
  {
    summary: 'List my conversations',
    description: 'Newest activity first.',
    limit: 'read',
    query: schemas.page,
    responds: { 200: 'A page of conversations' },
  },
  controller.list
);

router.post(
  '/conversations',
  {
    summary: 'Start a conversation',
    description: 'Creates an empty conversation. Sending the first message also names it from that message.',
    limit: 'write',
    body: z.object({ title: z.string().trim().min(1).max(120).optional() }),
    responds: { 201: 'The new conversation' },
  },
  controller.create
);

router.get(
  '/conversations/:id',
  {
    summary: 'Get a conversation',
    description:
      'The conversation and all its messages in order. `summarized: true` marks messages already folded ' +
      'into the context summary — still shown, no longer sent to the model. `status` is COMPLETE, ' +
      'PARTIAL (the stream broke), STOPPED (the reader stopped it) or ERROR. `limitReached` is ' +
      '"MESSAGES" or "TOKENS" when a new chat is needed.',
    limit: 'read',
    params: conversationParams,
    responds: { 200: 'The conversation with messages', 404: 'Not yours or not found' },
  },
  controller.get
);

router.patch(
  '/conversations/:id',
  {
    summary: 'Rename a conversation',
    limit: 'write',
    params: conversationParams,
    body: z.object({ title: z.string().trim().min(1).max(120) }),
    responds: { 200: 'The conversation' },
  },
  controller.rename
);

router.delete(
  '/conversations',
  {
    summary: 'Clear my chat',
    description:
      'Deletes all of the reader’s conversations and messages, the pictures sent in them, and with them the ' +
      'summary Sakha kept of earlier talk — a clean start. Credits already spent are not returned. 409 while ' +
      'a reply is being written.',
    limit: 'write',
    responds: { 204: 'Cleared', 409: 'A reply is being written' },
  },
  controller.clearAll
);

router.delete(
  '/conversations/:id',
  {
    summary: 'Delete a conversation',
    description:
      'Removes the conversation, its messages and the pictures sent in it. Credits already spent are not returned.',
    limit: 'write',
    params: conversationParams,
    responds: { 204: 'Deleted' },
  },
  controller.remove
);

router.post(
  '/conversations/:id/messages',
  {
    summary: 'Send a message (streams the reply)',
    description:
      'Responds `text/event-stream`. Events: `meta` {conversation, userMessage, assistantMessageId}; ' +
      '`status` {phase:"compacting"} while older messages are summarized; `delta` {text} per piece; ' +
      '`done` {message, conversation, credits}; `error` {code, message, retryable, partial, messageId}. ' +
      'Closing the connection stops the reply: what had arrived is kept as a STOPPED message and only ' +
      'the tokens actually used are charged. One reply at a time per person (409). A message is words, a ' +
      'picture (`imageKey` from `POST /chat/images`) or both; messages carry `imageUrl` when they have one.',
    limit: 'chat',
    params: conversationParams,
    body: z
      .object({
        content: z.string().trim().max(20000).default(''),
        imageKey: z.string().min(1).max(500).optional(),
      })
      .refine((body) => body.content || body.imageKey, { message: 'Say something or send a picture', path: ['content'] }),
    responds: {
      200: 'Server-Sent Events stream',
      402: 'CREDITS_EXHAUSTED or CHAT_NOT_AVAILABLE',
      422: 'IMAGE_NOT_USABLE — the picture is not one this reader uploaded, or it has expired',
      409: 'CONVERSATION_LIMIT, or a reply is already being written',
    },
  },
  controller.send
);

router.post(
  '/conversations/:id/regenerate',
  {
    summary: 'Regenerate the last reply (streams)',
    description:
      'Answers the last user message again, replacing the reply after it. Same stream as ' +
      'sending a message. Spent credits are not returned.',
    limit: 'chat',
    params: conversationParams,
    responds: { 200: 'Server-Sent Events stream', 402: 'CREDITS_EXHAUSTED' },
  },
  controller.regenerate
);

router.post(
  '/conversations/:id/compact',
  {
    summary: 'Compact the context now',
    description:
      'Folds the older messages into the conversation’s summary with the cheap model, leaving the newest ' +
      'few as they are. Costs a few credits. `compacted: false` means there was nothing worth folding, ' +
      'or not enough credits to do it.',
    limit: 'ai',
    params: conversationParams,
    responds: { 200: 'Whether anything was compacted' },
  },
  controller.compactNow
);

router.post(
  '/conversations/:id/continue',
  {
    summary: 'Continue in a new chat',
    description:
      'For a conversation at its limit. Summarizes everything so far and starts a new conversation that ' +
      'carries the summary forward. `carriedEverything: false` means credits did not stretch to ' +
      'summarizing the latest turns, so only the earlier summary came along.',
    limit: 'ai',
    params: conversationParams,
    responds: { 201: 'The new conversation' },
  },
  controller.continueChat
);

export default router;
