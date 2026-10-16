import { createRouter, z, schemas } from '../../utils/router.js';
import * as controller from '../../controllers/app/chat.js';

const router = createRouter({
  tag: 'Chat',
  prefix: '/chat',
  description:
    'The devotional assistant. Replies stream as Server-Sent Events; the app never talks to an AI ' +
    'provider. Readers see a credit meter (a percentage), never token counts. A request refused before ' +
    'streaming starts gets an ordinary JSON error: 402 `CREDITS_EXHAUSTED` (details: `limitedBy`, ' +
    '`resetsAt`, `canUpgrade`, `startNewChat`) or 409 `CONVERSATION_LIMIT` (call `/continue`).',
});

const conversationParams = z.object({ id: z.string().min(1) });

router.get(
  '/status',
  {
    summary: 'Chat status',
    description:
      'What to show before and around a chat: the assistant’s description (states its Sri Vaishnava ' +
      'orientation), the reader’s credit meter — `percent` 100→0, `limitedBy` ("daily" resets at their ' +
      'local midnight, "wallet" at `renewsAt`), `exhausted`, `canUpgrade`, their devotee `levelName` — ' +
      'and the input limits.',
    limit: 'read',
    responds: { 200: 'Description, credits and limits' },
  },
  controller.getStatus
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
  '/conversations/:id',
  {
    summary: 'Delete a conversation',
    description: 'Removes the conversation and its messages. Credits already spent are not returned.',
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
      'the tokens actually used are charged. One reply at a time per person (409).',
    limit: 'chat',
    params: conversationParams,
    body: z.object({ content: z.string().trim().min(1).max(20000) }),
    responds: {
      200: 'Server-Sent Events stream',
      402: 'CREDITS_EXHAUSTED or CHAT_NOT_AVAILABLE',
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
      'Answers the last user message again, replacing the assistant message after it. Same stream as ' +
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
