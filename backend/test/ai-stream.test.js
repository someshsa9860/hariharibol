// The two providers' streaming parsers, fed canned wire data through a fake
// fetch: pieces arrive in order, split across network chunks, and the token
// counts the provider reports are what comes back.

import test from 'node:test';
import assert from 'node:assert/strict';

process.env.DATABASE_URL ??= 'postgresql://x:x@localhost:5432/x';
process.env.JWT_SECRET ??= 'test-secret-test-secret-123';
process.env.GEMINI_API_KEY = 'g-key';
process.env.OPENAI_API_KEY = 'o-key';

const { parseSse } = await import('../services/ai/sse.js');
const gemini = await import('../services/ai/gemini.js');
const openai = await import('../services/ai/openai.js');

const enc = new TextEncoder();
const bodyOf = (chunks) =>
  new ReadableStream({
    start(controller) {
      for (const c of chunks) controller.enqueue(enc.encode(c));
      controller.close();
    },
  });

async function collect(iterable) {
  const out = [];
  for await (const x of iterable) out.push(x);
  return out;
}

function fakeFetch(chunks, { status = 200, onRequest } = {}) {
  globalThis.fetch = async (url, init) => {
    onRequest?.(url, init);
    return new Response(status === 200 ? bodyOf(chunks) : 'upstream said no', { status });
  };
}

test('SSE events survive being split mid-line and mid-event', async () => {
  const events = await collect(parseSse(bodyOf(['data: {"a"', ':1}\n\nda', 'ta: two\r\n\r\n: ping\n\ndata: x\ndata: y\n\n'])));
  assert.deepEqual(events.map((e) => e.data), ['{"a":1}', 'two', 'x\ny']);
});

test('SSE keeps multi-byte characters intact across chunks', async () => {
  const bytes = enc.encode('data: कृष्ण\n\n');
  const half = Math.floor(bytes.length / 2);
  const body = new ReadableStream({
    start(c) { c.enqueue(bytes.slice(0, half)); c.enqueue(bytes.slice(half)); c.close(); },
  });
  assert.equal((await collect(parseSse(body)))[0].data, 'कृष्ण');
});

test('Gemini: text pieces, then the usage Gemini reported (thinking counts as output)', async () => {
  let seen;
  fakeFetch([
    'data: {"candidates":[{"content":{"parts":[{"text":"Hari"}]}}]}\n\n',
    'data: {"candidates":[{"content":{"parts":[{"text":" bol"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":1}}\n\n',
    'data: {"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"!"}]}}],"usageMetadata":{"promptTokenCount":10,"candidatesTokenCount":3,"thoughtsTokenCount":4}}\n\n',
  ], { onRequest: (url, init) => { seen = { url, init }; } });

  const out = await collect(gemini.stream({
    model: 'gemini-2.0-flash', system: 'sys', messages: [{ role: 'user', content: 'hi' }, { role: 'assistant', content: 'yo' }, { role: 'user', content: 'again' }],
  }));
  assert.equal(out.filter((o) => o.text).map((o) => o.text).join(''), 'Hari bol!');
  const done = out.at(-1);
  assert.deepEqual([done.done, done.inputTokens, done.outputTokens, done.finishReason], [true, 10, 7, 'stop']);

  assert.ok(seen.url.includes(':streamGenerateContent?alt=sse'));
  assert.ok(!seen.url.includes('g-key'), 'the key is not in the URL');
  assert.equal(seen.init.headers['x-goog-api-key'], 'g-key');
  const sent = JSON.parse(seen.init.body);
  assert.deepEqual(sent.contents.map((c) => c.role), ['user', 'model', 'user']);
  assert.equal(sent.systemInstruction.parts[0].text, 'sys');
});

test('Gemini: a blocked prompt is reported, not thrown', async () => {
  fakeFetch(['data: {"promptFeedback":{"blockReason":"SAFETY"}}\n\n']);
  const out = await collect(gemini.stream({ model: 'm', messages: [{ role: 'user', content: 'x' }] }));
  assert.equal(out.at(-1).finishReason, 'blocked');
});

test('OpenAI: deltas, the usage-only final chunk, and [DONE]', async () => {
  let sent;
  fakeFetch([
    'data: {"choices":[{"delta":{"role":"assistant","content":""}}]}\n\n',
    'data: {"choices":[{"delta":{"content":"Om"}}]}\n\n',
    'data: {"choices":[{"delta":{"content":" namo"},"finish_reason":"stop"}]}\n\n',
    'data: {"choices":[],"usage":{"prompt_tokens":21,"completion_tokens":5}}\n\n',
    'data: [DONE]\n\n',
  ], { onRequest: (url, init) => { sent = JSON.parse(init.body); } });

  const out = await collect(openai.stream({ model: 'gpt-4o-mini', system: 'sys', messages: [{ role: 'user', content: 'hi' }], maxTokens: 99 }));
  assert.equal(out.filter((o) => o.text).map((o) => o.text).join(''), 'Om namo');
  const done = out.at(-1);
  assert.deepEqual([done.inputTokens, done.outputTokens, done.finishReason], [21, 5, 'stop']);
  assert.equal(sent.stream, true);
  assert.deepEqual(sent.stream_options, { include_usage: true });
  assert.equal(sent.max_completion_tokens, 99);
  assert.deepEqual(sent.messages.map((m) => m.role), ['system', 'user']);
});

test('a provider that is busy is a retryable 503, any other failure a 502', async () => {
  fakeFetch([], { status: 429 });
  await assert.rejects(collect(openai.stream({ model: 'm', messages: [] })), { status: 503, code: 'AI_BUSY' });
  fakeFetch([], { status: 400 });
  await assert.rejects(collect(gemini.stream({ model: 'm', messages: [] })), { status: 502, code: 'AI_FAILED' });
});

test('aborting the signal ends the stream with an AbortError', async () => {
  globalThis.fetch = async (url, init) => {
    return new Response(new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode('data: {"choices":[{"delta":{"content":"a"}}]}\n\n'));
        init.signal.addEventListener('abort', () => controller.error(init.signal.reason));
      },
    }));
  };
  const abort = new AbortController();
  const seen = [];
  await assert.rejects(async () => {
    for await (const piece of openai.stream({ model: 'm', messages: [], signal: abort.signal })) {
      seen.push(piece.text);
      abort.abort();
    }
  });
  assert.deepEqual(seen, ['a']);
});
