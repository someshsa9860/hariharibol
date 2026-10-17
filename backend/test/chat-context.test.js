import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMessages, buildSystem, capSummary, conversationLimit, liveMessages, planCompaction, summarizerRequest, titleFrom,
  withPlaceholder,
} from '../utils/chat-context.js';
import {
  DEFAULT_LIMITS, IMAGE_GUIDANCE, IMAGE_PLACEHOLDER, NAME_GUIDANCE, NAME_TOKEN,
} from '../config/chat.js';
import * as tokens from '../services/ai/tokens.js';

const limits = { ...DEFAULT_LIMITS, recentMessages: 6, compactAtTokens: 1000, keepRecentOnCompact: 2 };

// u1 a2 u3 a4 … alternating, starting with the user.
const convo = (n, tokenCount = 50) =>
  Array.from({ length: n }, (_, i) => ({
    seq: i + 1, role: i % 2 === 0 ? 'USER' : 'ASSISTANT', content: `m${i + 1}`, status: 'COMPLETE', tokenCount,
  }));

test('summarized, empty and failed messages are not sent', () => {
  const rows = [
    { seq: 1, role: 'USER', content: 'old', status: 'COMPLETE' },
    { seq: 2, role: 'ASSISTANT', content: 'old', status: 'COMPLETE' },
    { seq: 3, role: 'USER', content: 'hello', status: 'COMPLETE' },
    { seq: 4, role: 'ASSISTANT', content: '', status: 'PARTIAL' },
    { seq: 5, role: 'ASSISTANT', content: 'cut off but useful', status: 'STOPPED' },
    { seq: 6, role: 'ASSISTANT', content: 'boom', status: 'ERROR' },
  ];
  assert.deepEqual(liveMessages(rows, 2).map((m) => m.seq), [3, 5]);
});

test('a short conversation is left alone', () => {
  assert.equal(planCompaction({ messages: convo(4), limits }), null);
});

test('too many messages triggers compaction, keeping the newest', () => {
  const plan = planCompaction({ messages: convo(8), limits });
  // keep 2 → cut at 6; message 7 (index 6) is a USER so the cut stands.
  assert.deepEqual(plan.messages.map((m) => m.seq), [1, 2, 3, 4, 5, 6]);
  assert.equal(plan.upToSeq, 6);
});

test('too many tokens triggers compaction even with few messages', () => {
  const plan = planCompaction({ messages: convo(5, 400), limits });
  assert.ok(plan);
  assert.ok(plan.messages.length >= 1 && plan.messages.length < 5);
});

test('what is kept always begins with a user message', () => {
  const plan = planCompaction({ messages: convo(8), limits, keep: 3 });
  // cut = 5 → index 5 is an ASSISTANT (seq 6), so one more is summarized.
  assert.equal(plan.upToSeq, 6);
  const rest = convo(8).filter((m) => m.seq > plan.upToSeq);
  assert.equal(rest[0].role, 'USER');
});

test('forcing compacts below the threshold; keeping nothing folds everything', () => {
  assert.equal(planCompaction({ messages: convo(4), limits, force: true }).upToSeq, 2);
  assert.equal(planCompaction({ messages: convo(4), limits, force: true, keep: 0 }).upToSeq, 4);
  assert.equal(planCompaction({ messages: convo(2), limits, force: true }), null, 'nothing to fold when it is all "recent"');
});

test('the prompt is persona, then the summary, then recent messages, then the new one', () => {
  assert.equal(buildSystem({ persona: 'P', summary: null }), 'P');
  const system = buildSystem({ persona: 'P', summary: '  PERSON — Asha  ' });
  assert.ok(system.startsWith('P\n\n'));
  assert.ok(system.endsWith('PERSON — Asha'));

  const messages = buildMessages({ live: convo(10), recentMessages: 4, userText: 'new' });
  assert.deepEqual(messages.map((m) => m.content), ['m7', 'm8', 'm9', 'm10', 'new']);
  assert.equal(messages[messages.length - 1].content, 'new');
  assert.equal(messages[0].role, 'user');
});

test('a window that would open on a reply drops it, and same-side messages merge', () => {
  // last 4 of 10 are m7(u) m8(a) m9(u) m10(a) → starts with user; ask for 3 → m8(a) m9(u) m10(a)
  const messages = buildMessages({ live: convo(10), recentMessages: 3, userText: 'next' });
  assert.equal(messages[0].role, 'user');
  assert.deepEqual(messages.map((m) => m.role), ['user', 'assistant', 'user']);
  assert.equal(messages[0].content, 'm9');

  const merged = buildMessages({ live: [{ role: 'USER', content: 'a' }], recentMessages: 5, userText: 'b' });
  assert.deepEqual(merged, [{ role: 'user', content: 'a\n\nb' }]);
});

test('the prompt stays small however long the conversation gets', () => {
  const long = convo(400, 80).map((m) => ({ ...m, content: 'devotion '.repeat(40) }));
  const sent = buildMessages({ live: long, recentMessages: limits.recentMessages, userText: 'and now?' });
  assert.equal(sent.length <= limits.recentMessages + 1, true);
  assert.ok(tokens.estimateMessages(sent) < 1500);
});

test('the summarizer is told what to keep and that the text is data', () => {
  const { system, prompt } = summarizerRequest({
    existingSummary: 'PERSON — Asha', messages: convo(2), maxTokens: 400,
  });
  for (const heading of ['PERSON', 'INTERESTS', 'PRACTICES', 'OPEN QUESTIONS']) assert.ok(system.includes(heading));
  assert.match(system, /sampradaya/i);
  assert.match(system, /vows/i);
  assert.match(system, /DATA/);
  assert.ok(prompt.includes('PERSON — Asha'));
  assert.ok(prompt.includes('PERSON: m1') && prompt.includes('GUIDE: m2'));
});

test('a summary is held to its cap', () => {
  const capped = capSummary('word '.repeat(2000), 100);
  assert.ok(tokens.countText(capped) <= 100);
  assert.equal(capSummary(null, 100), '');
});

test('hard limits: messages and per-plan tokens', () => {
  assert.equal(conversationLimit({ conversation: { messageCount: 5, tokensUsed: 0 }, maxMessages: 120, conversationTokenLimit: 0 }), null);
  assert.equal(conversationLimit({ conversation: { messageCount: 120, tokensUsed: 0 }, maxMessages: 120, conversationTokenLimit: 0 }), 'MESSAGES');
  assert.equal(conversationLimit({ conversation: { messageCount: 3, tokensUsed: 20000 }, maxMessages: 120, conversationTokenLimit: 20000 }), 'TOKENS');
  assert.equal(conversationLimit({ conversation: { messageCount: 9999, tokensUsed: 9999 }, maxMessages: 0, conversationTokenLimit: 0 }), null, '0 means unlimited');
});

test('titles are one tidy line', () => {
  assert.equal(titleFrom('  What is\n bhakti? '), 'What is bhakti?');
  assert.equal(titleFrom(''), 'New chat');
  assert.ok(titleFrom('x'.repeat(200)).length <= 60);
});

// ── Pictures ────────────────────────────────────────────────────────────────

test('a picture alone is worth sending; an empty message and a failed one are not', () => {
  const rows = [
    { seq: 1, role: 'USER', content: '', imagePath: 'chat/images/a.jpg', status: 'COMPLETE' },
    { seq: 2, role: 'ASSISTANT', content: 'A temple.', status: 'COMPLETE' },
    { seq: 3, role: 'USER', content: '', imagePath: null, status: 'COMPLETE' },
    { seq: 4, role: 'USER', content: '', imagePath: 'chat/images/b.jpg', status: 'ERROR' },
  ];
  assert.deepEqual(liveMessages(rows, 0).map((m) => m.seq), [1, 2]);
});

test('a note stands in for a picture that is not sent', () => {
  assert.equal(withPlaceholder('What is this?', true), `What is this?\n\n${IMAGE_PLACEHOLDER}`);
  assert.equal(withPlaceholder('', true), IMAGE_PLACEHOLDER);
  assert.equal(withPlaceholder('  ', true), IMAGE_PLACEHOLDER);
  assert.equal(withPlaceholder('Just words', false), 'Just words');
});

test('the note on pictures is added to the persona only when there is one', () => {
  assert.equal(buildSystem({ persona: 'P', summary: null }), 'P');
  assert.equal(buildSystem({ persona: 'P', summary: null, withImage: true }), `P\n\n${IMAGE_GUIDANCE}`);
  const both = buildSystem({ persona: 'P', summary: 'PERSON — Asha', withImage: true });
  assert.ok(both.includes(IMAGE_GUIDANCE) && both.endsWith('PERSON — Asha'));
  assert.ok(both.indexOf(IMAGE_GUIDANCE) < both.indexOf('PERSON — Asha'));
});

test('the note on the name is added only for a reader who has one, and never holds the name itself', () => {
  assert.equal(buildSystem({ persona: 'P', summary: null }), 'P');
  assert.equal(buildSystem({ persona: 'P', summary: null, withName: true }), `P\n\n${NAME_GUIDANCE}`);
  const all = buildSystem({ persona: 'P', summary: 'PERSON — Asha', withImage: true, withName: true });
  assert.ok(all.indexOf(IMAGE_GUIDANCE) < all.indexOf(NAME_GUIDANCE));
  assert.ok(all.indexOf(NAME_GUIDANCE) < all.indexOf('PERSON — Asha'));
  assert.ok(NAME_GUIDANCE.includes(NAME_TOKEN));
});

test('the summarizer is told the name token is not a fact to record', () => {
  const { system } = summarizerRequest({ existingSummary: '', messages: convo(2), maxTokens: 400 });
  assert.ok(system.includes(NAME_TOKEN));
  assert.match(system, /not a fact to record/);
});

test('the new message carries its own picture', () => {
  const messages = buildMessages({ live: convo(2), recentMessages: 6, userText: 'What is this?', userImageKey: 'chat/images/new.jpg' });
  const last = messages[messages.length - 1];
  assert.equal(last.content, 'What is this?');
  assert.equal(last.imageKey, 'chat/images/new.jpg');
  // The earlier turns carry no picture.
  assert.ok(messages.slice(0, -1).every((m) => !m.imageKey));
});

test('only the newest picture is sent as a picture; older ones become a note', () => {
  const live = [
    { seq: 1, role: 'USER', content: 'first', imagePath: 'chat/images/one.jpg', status: 'COMPLETE' },
    { seq: 2, role: 'ASSISTANT', content: 'A deity.', status: 'COMPLETE' },
    { seq: 3, role: 'USER', content: 'second', imagePath: 'chat/images/two.jpg', status: 'COMPLETE' },
    { seq: 4, role: 'ASSISTANT', content: 'A temple.', status: 'COMPLETE' },
  ];

  // A text question: the newest picture in the history is the one still sent.
  const text = buildMessages({ live, recentMessages: 6, userText: 'and its history?' });
  const sent = text.filter((m) => m.imageKey);
  assert.deepEqual(sent.map((m) => m.imageKey), ['chat/images/two.jpg']);
  assert.ok(text[0].content.includes(IMAGE_PLACEHOLDER), 'the first picture is a note');
  assert.ok(text[0].content.startsWith('first'));
  assert.ok(!text[0].imageKey);

  // A new picture takes the place: nothing before it is sent as a picture.
  const fresh = buildMessages({ live, recentMessages: 6, userText: 'now this', userImageKey: 'chat/images/three.jpg' });
  assert.deepEqual(fresh.filter((m) => m.imageKey).map((m) => m.imageKey), ['chat/images/three.jpg']);
  assert.ok(fresh[2].content.includes(IMAGE_PLACEHOLDER), 'the second picture is a note too');
});

test('a picture that fell out of the window is not sent', () => {
  const live = [
    { seq: 1, role: 'USER', content: 'old', imagePath: 'chat/images/old.jpg', status: 'COMPLETE' },
    ...convo(6).map((m) => ({ ...m, seq: m.seq + 1 })),
  ];
  const messages = buildMessages({ live, recentMessages: 4, userText: 'next' });
  assert.ok(messages.every((m) => !m.imageKey));
  assert.ok(messages.every((m) => !m.content.includes(IMAGE_PLACEHOLDER)));
});

test('a picture with no words keeps its place when messages merge', () => {
  // A picture alone, then a reply that failed (so is not sent), then another message from the same side.
  const live = [{ seq: 1, role: 'USER', content: '', imagePath: 'chat/images/a.jpg', status: 'COMPLETE' }];
  const messages = buildMessages({ live, recentMessages: 6, userText: 'what is it?' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].role, 'user');
  assert.equal(messages[0].imageKey, 'chat/images/a.jpg');
  assert.ok(messages[0].content.endsWith('what is it?'));
});

test('a new picture with no words is still a message', () => {
  const messages = buildMessages({ live: [], recentMessages: 6, userText: '', userImageKey: 'chat/images/a.jpg' });
  assert.equal(messages.length, 1);
  assert.equal(messages[0].imageKey, 'chat/images/a.jpg');
});

test('the summarizer is told that a picture was shared, never given the picture', () => {
  const messages = [
    { seq: 1, role: 'USER', content: 'Who is this?', imagePath: 'chat/images/a.jpg' },
    { seq: 2, role: 'ASSISTANT', content: 'Lord Krishna.' },
    { seq: 3, role: 'USER', content: '', imagePath: 'chat/images/b.jpg' },
  ];
  const { prompt } = summarizerRequest({ existingSummary: '', messages, maxTokens: 400 });
  assert.ok(prompt.includes(`PERSON: Who is this?\n\n${IMAGE_PLACEHOLDER}`));
  assert.ok(prompt.includes(`PERSON: ${IMAGE_PLACEHOLDER}`));
  assert.ok(!prompt.includes('chat/images'));
});

test('a picture counts towards the prompt', () => {
  const plain = [{ role: 'user', content: 'What is this?' }];
  const withPicture = [{ role: 'user', content: 'What is this?', imageKey: 'chat/images/a.jpg' }];
  const loaded = [{ role: 'user', content: 'What is this?', image: { mimeType: 'image/jpeg', base64: 'AAAA' } }];
  assert.ok(tokens.estimateMessages(withPicture) > tokens.estimateMessages(plain));
  // The estimate is the same before the pixels are loaded and after, so the pre-check and the real call agree.
  assert.equal(tokens.estimateMessages(withPicture), tokens.estimateMessages(loaded));
});
