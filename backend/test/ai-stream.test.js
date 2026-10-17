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

// What each kind of OpenAI model is sent: a reasoning model (gpt-6-luna) answers 400 to a temperature other than
// its default unless it is told not to think, and every older model answers 400 to a reasoning effort.
async function bodiesSent(model, effort) {
  const { default: env } = await import('../config/env.js');
  const before = env.OPENAI_REASONING_EFFORT;
  if (effort) env.OPENAI_REASONING_EFFORT = effort;
  try {
    const sent = [];
    const onRequest = (url, init) => sent.push(JSON.parse(init.body));
    fakeFetch(['data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\ndata: [DONE]\n\n'], { onRequest });
    await collect(openai.stream({ model, messages: [{ role: 'user', content: 'hi' }], maxTokens: 50 }));
    fakeFetch([JSON.stringify({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 3, completion_tokens: 2 } })], { onRequest });
    const done = await openai.complete({ model, prompt: 'hi', maxTokens: 50, temperature: 0.2 });
    assert.deepEqual([done.text, done.inputTokens, done.outputTokens], ['ok', 3, 2]);
    return sent;
  } finally {
    env.OPENAI_REASONING_EFFORT = before;
  }
}

test('OpenAI: gpt-6-luna is told not to think, which is what lets it keep the temperature', async () => {
  const [streamed, completed] = await bodiesSent('gpt-6-luna');
  assert.equal(streamed.reasoning_effort, 'none');
  assert.equal(streamed.temperature, 0.6);
  assert.equal(completed.reasoning_effort, 'none');
  assert.equal(completed.temperature, 0.2);
});

test('OpenAI: gpt-6-luna set to think is sent the effort and no temperature', async () => {
  for (const body of await bodiesSent('gpt-6-luna', 'low')) {
    assert.equal(body.reasoning_effort, 'low');
    assert.ok(!('temperature' in body), 'any temperature but the default is a 400 while it thinks');
  }
});

test('OpenAI: an older model is sent a temperature and no effort', async () => {
  for (const body of await bodiesSent('gpt-4o-mini', 'low')) {
    assert.ok(!('reasoning_effort' in body));
    assert.ok(typeof body.temperature === 'number');
  }
});

test('OpenAI: both calls bound the reply with max_completion_tokens, which reasoning models need', async () => {
  for (const body of await bodiesSent('gpt-6-luna')) {
    assert.equal(body.max_completion_tokens, 50);
    assert.ok(!('max_tokens' in body));
  }
});

test('OpenAI: gpt-6-luna costs $0.10 in and $0.50 out per million tokens', () => {
  assert.equal(openai.costMicros('gpt-6-luna', 1_000_000, 0), 100_000);
  assert.equal(openai.costMicros('gpt-6-luna', 0, 1_000_000), 500_000);
});

const PICTURE = { mimeType: 'image/jpeg', base64: 'QUJD' };
const done = 'data: {"choices":[],"usage":{"prompt_tokens":1,"completion_tokens":1}}\n\ndata: [DONE]\n\n';

test('Gemini: a picture goes in as an inline part beside its words, and a picture alone is still a message', async () => {
  let sent;
  fakeFetch(['data: {"candidates":[{"finishReason":"STOP","content":{"parts":[{"text":"ok"}]}}]}\n\n'], {
    onRequest: (url, init) => { sent = JSON.parse(init.body); },
  });
  await collect(gemini.stream({
    model: 'gemini-2.0-flash',
    system: 's',
    messages: [
      { role: 'user', content: 'What is this?', image: PICTURE, imageKey: 'chat/images/a.jpg' },
      { role: 'assistant', content: 'A temple.' },
      { role: 'user', content: '', image: PICTURE },
    ],
  }));
  assert.deepEqual(sent.contents[0].parts, [{ text: 'What is this?' }, { inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }]);
  assert.deepEqual(sent.contents[1].parts, [{ text: 'A temple.' }]);
  assert.deepEqual(sent.contents[2].parts, [{ inlineData: { mimeType: 'image/jpeg', data: 'QUJD' } }], 'no empty text part');
  assert.ok(!JSON.stringify(sent).includes('chat/images'), 'the storage key is not sent to the provider');
});

test('OpenAI: a picture goes in as a data URL beside its words, and a plain message stays plain text', async () => {
  const bodies = [];
  fakeFetch([done], { onRequest: (url, init) => bodies.push(JSON.parse(init.body)) });
  await collect(openai.stream({
    model: 'gpt-6-luna',
    system: 's',
    messages: [
      { role: 'user', content: 'What is this?', image: PICTURE, imageKey: 'chat/images/a.jpg' },
      { role: 'assistant', content: 'A temple.' },
      { role: 'user', content: '', image: PICTURE },
    ],
  }));
  const [, first, second, third] = bodies[0].messages;
  assert.deepEqual(first.content, [
    { type: 'text', text: 'What is this?' },
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } },
  ]);
  assert.equal(second.content, 'A temple.');
  assert.deepEqual(third.content, [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,QUJD' } }], 'no empty text part');
  assert.ok(!JSON.stringify(bodies[0]).includes('chat/images'), 'the storage key is not sent to the provider');
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
