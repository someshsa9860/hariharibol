import test from 'node:test';
import assert from 'node:assert/strict';
import { forReader } from '../utils/chat-errors.js';
import { AppError, notFound } from '../utils/errors.js';

// What a failing provider or a bug might say. None of it may reach a reader.
const LEAKS = [
  'Gemini is not configured',
  'OpenAI is not configured',
  'The monthly AI budget is spent',
  'Unknown AI provider: claude',
  'generate_text did not return valid JSON',
  'models/gemini-2.0-flash is not found for API version v1beta',
  'connect ECONNREFUSED 127.0.0.1:5432',
];

test('the chat’s own errors keep their words, their details and their code', () => {
  const details = { limitedBy: 'daily', resetsAt: '2026-10-17T00:00:00.000Z', canUpgrade: true, startNewChat: false };
  const out = forReader(new AppError(402, 'CREDITS_EXHAUSTED', 'You have used today’s credits.', details));
  assert.deepEqual(out, { code: 'CREDITS_EXHAUSTED', message: 'You have used today’s credits.', retryable: false, details });
});

test('provider failures are reported by a code the app knows, in a fixed line', () => {
  for (const [code, status, expected, retryable] of [
    ['AI_BUSY', 503, 'AI_BUSY', true],
    ['AI_UNAVAILABLE', 503, 'AI_UNAVAILABLE', true],
    ['AI_MISCONFIGURED', 500, 'AI_UNAVAILABLE', true],
    ['AI_BUDGET_EXHAUSTED', 429, 'AI_UNAVAILABLE', false],
    ['AI_FAILED', 502, 'AI_FAILED', true],
    ['AI_BAD_OUTPUT', 502, 'AI_FAILED', true],
  ]) {
    const out = forReader(new AppError(status, code, LEAKS[0], { body: LEAKS[5] }));
    assert.equal(out.code, expected, code);
    assert.equal(out.retryable, retryable, code);
    assert.ok(out.message.startsWith('Sakha'), `${code}: ${out.message}`);
    assert.equal('details' in out, false, `${code} must not carry details`);
  }
});

test('no developer text and no details leave through any other error', () => {
  const errors = [
    ...LEAKS.map((text) => new AppError(500, 'AI_MISCONFIGURED', text, { text })),
    ...LEAKS.map((text) => new AppError(502, 'AI_FAILED', text, { text })),
    ...LEAKS.map((text) => new Error(text)),
    notFound('Conversation'),
    Object.assign(new Error('boom'), { code: 'P2002' }),
    Object.assign(new Error('boom'), { code: 'ECONNRESET' }),
    undefined,
    'a string was thrown',
  ];
  for (const error of errors) {
    const out = forReader(error);
    const sent = JSON.stringify(out);
    for (const text of LEAKS) assert.equal(sent.includes(text), false, `${text} leaked in ${sent}`);
    assert.equal('details' in out, false);
    assert.match(out.code, /^(AI_[A-Z]+|SERVER_ERROR)$/);
  }
});

test('a bug is a server error the reader can retry, and its code is not passed on', () => {
  const out = forReader(Object.assign(new Error('relation "ChatMessage" does not exist'), { code: 'P2021' }));
  assert.deepEqual(out, { code: 'SERVER_ERROR', message: 'Something went wrong. Please try again.', retryable: true });
});

test('an AppError the chat does not own is not shown as written', () => {
  const out = forReader(notFound('Conversation'));
  assert.equal(out.code, 'SERVER_ERROR');
  assert.equal(out.message.includes('not found'), false);
});

test('each answer is its own object, so a caller adding fields cannot change the next one', () => {
  const first = forReader(new AppError(503, 'AI_BUSY', 'x'));
  first.partial = true;
  assert.equal('partial' in forReader(new AppError(503, 'AI_BUSY', 'x')), false);
});
