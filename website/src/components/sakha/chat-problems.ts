// What Sakha says when something goes wrong. The server's own wording is never shown: it may be a provider's text.

export interface ChatProblem { text: string; retry: boolean; upgrade: boolean }

const BY_CODE: Record<string, ChatProblem> = {
  CREDITS_EXHAUSTED: { text: 'You have used your Sakha replies for now. They renew with your plan, or you can upgrade for more.', retry: false, upgrade: true },
  CHAT_NOT_AVAILABLE: { text: 'Sakha is not part of your plan yet. A plan unlocks a few hundred replies a month.', retry: false, upgrade: true },
  CONVERSATION_LIMIT: { text: 'This chat has grown long. Start a new one and Sakha will carry on from where you were.', retry: false, upgrade: false },
  MESSAGE_TOO_LONG: { text: 'That message is too long. Please shorten it a little.', retry: false, upgrade: false },
  NOTHING_TO_REGENERATE: { text: 'There is nothing to answer again yet.', retry: false, upgrade: false },
  IMAGE_NOT_USABLE: { text: 'That picture could not be used. Please try another.', retry: false, upgrade: false },
  IMAGE_NOT_AVAILABLE: { text: 'Pictures are switched off for now. You can still write to Sakha.', retry: false, upgrade: false },
  IMAGE_TOO_LARGE: { text: 'That picture is too large. Please choose a smaller one.', retry: false, upgrade: false },
  AI_BUSY: { text: 'Sakha is busy right now. Please try again in a moment.', retry: true, upgrade: false },
  AI_UNAVAILABLE: { text: 'Sakha is not available right now. Please try again a little later.', retry: true, upgrade: false },
  AI_FAILED: { text: 'Sakha could not finish that reply. Please try again.', retry: true, upgrade: false },
  CONFLICT: { text: 'Sakha is still writing the last reply. Please wait a moment.', retry: false, upgrade: false },
  NETWORK: { text: 'You appear to be offline. Check your connection and try again.', retry: true, upgrade: false },
  TIMEOUT: { text: 'That took too long. Please try again.', retry: true, upgrade: false },
  UNAUTHENTICATED: { text: 'Please sign in again to keep talking with Sakha.', retry: false, upgrade: false },
};

const FALLBACK: ChatProblem = { text: 'Something went wrong. Please try again.', retry: true, upgrade: false };

export const problemFor = (code: string | undefined): ChatProblem => (code && BY_CODE[code]) || FALLBACK;
