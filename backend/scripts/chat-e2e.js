// Walks AI chat (Ask Sakha in the app) end to end against the real database and
// the real app, with the AI provider faked:
//
//   npm run test:chat
//
// Needs Postgres and Redis (the usual .env) and a seeded database (`npm run seed`).
// It boots the API in this process on a free port and replaces `fetch` for the
// Gemini host with a scripted server, so no key and no network are needed. What
// it checks: the stream and its events, that exactly the provider's reported
// tokens are debited, the daily cap, stopping a reply, compaction and the prompt
// that follows it, regenerate, the conversation limit and carrying a summary into
// a new chat, the admin panel's grant / allowance / persona endpoints, and that a
// failing provider reaches the app as a fixed line and a code, never its own words, and pictures:
// upload, send, what the provider is given, whose a key is, and clearing them away with the chat. The summary is
// written after the reply has gone out (section 6b), and the reader's name is said by Sakha but never sent to the
// provider (section 16). Section 17 is the engine chain: OpenAI's free tier first while its switch is on and the
// day's free tokens last, then the provider that is set, then GPT-6 Luna — which engine answered, in what order they
// were tried, what was charged and counted, and what the admin panel reports.
//
// Two providers are faked: Gemini (sections 1–16 use only it) and OpenAI (a blank key until section 17 gives it a
// fake one), so a run never reaches either for real, whatever the .env holds. The run also takes over, and puts back,
// the AI settings and the day's token tally.

import { createCanvas } from '@napi-rs/canvas';

process.env.NODE_ENV = 'test';
// Pictures are really stored. With the keys blank, storage falls back to backend/storage/ and the real bucket
// is out of reach (section 15 refuses to run if it is not).
process.env.AWS_ACCESS_KEY_ID = '';
process.env.AWS_SECRET_ACCESS_KEY = '';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'fake-key';
process.env.GEMINI_MODEL = 'gemini-reply-test';
process.env.GEMINI_SUMMARY_MODEL = 'gemini-summary-test';
process.env.GEMINI_ADVANCED_MODEL = 'gemini-advanced-test';
// OpenAI is the free tier and the last resort, and a developer's .env holds a real key for it. Blank here, so nothing in
// sections 1–16 can reach it; section 17 sets a fake key (and the fallback) on the loaded config.
process.env.OPENAI_API_KEY = '';
process.env.AI_FALLBACK_MODEL = '';

const { prisma } = await import('../config/database.js');
const { redis } = await import('../config/redis.js');
const { default: env } = await import('../config/env.js');
const authService = await import('../services/auth.js');
const wallet = await import('../services/ai-wallet.js');
const settings = await import('../services/setting.js');
const tally = await import('../services/ai/token-tally.js');
const s3 = await import('../services/s3.js');
const chatImages = await import('../services/chat-images.js');
const chatConfig = await import('../config/chat.js');
const { sniff } = await import('../utils/chat-image.js');
const { CACHE, SETTING_KEYS } = await import('../config/constants.js');
const { default: app } = await import('../app.js');

let passed = 0;
let failed = 0;
function check(name, ok, detail = '') {
  console.log(`  ${ok ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (ok) passed += 1;
  else failed += 1;
}

// ── The fake Gemini ────────────────────────────────────────────────────────
const realFetch = globalThis.fetch;
const sent = []; // every request made to the "provider", parsed
let reply = ['Namaste. ', 'Bhakti is loving service.']; // pieces of the next streamed reply
let slow = false; // stream slowly so a test can hang up mid-reply
let summaryDelay = 0; // ms a summary takes to come back, so a test can tell whether a reply waited for it
// Make the next streaming call fail: { status, body } (an HTTP error), 'drop' (the connection fails before
// any answer) or 'cut' (the stream breaks after the first words).
let failWith = null;
let summaryFails = null; // { status, body }: the summary calls to Gemini fail
const USAGE = { promptTokenCount: 30, candidatesTokenCount: 20 };

// The fake OpenAI. A streamed reply says `openAiReply` and reports 40 tokens in and 25 out; a call that is not
// streamed (a summary) says OPENAI_SUMMARY and reports 120 and 30. `openAiFails` makes the calls for one model (or `*`,
// all of them) fail with { status, body }.
const openAiSent = []; // every request made to the "OpenAI", parsed
const openAiFails = new Map();
let openAiReply = ['Namaste from OpenAI.'];
const OPENAI_SUMMARY = 'PERSON — Asha, the OpenAI summary.';
const OPENAI_USAGE = { prompt_tokens: 40, completion_tokens: 25 };

// Every reply or summary request, in the order made, as `provider:model` — so a test can say which engines were tried
// and in what order.
const trail = [];

function fakeOpenAi(init) {
  const body = JSON.parse(init.body);
  openAiSent.push(body);
  trail.push(`openai:${body.model}`);

  const failure = openAiFails.get(body.model) ?? openAiFails.get('*');
  if (failure) return new Response(failure.body, { status: failure.status });

  if (!body.stream) {
    return Response.json({ choices: [{ message: { content: OPENAI_SUMMARY } }], usage: { prompt_tokens: 120, completion_tokens: 30 } });
  }
  const enc = new TextEncoder();
  const event = (data) => enc.encode(`data: ${JSON.stringify(data)}\n\n`);
  return new Response(
    new ReadableStream({
      start(controller) {
        for (const content of openAiReply) controller.enqueue(event({ choices: [{ delta: { content } }] }));
        controller.enqueue(event({ choices: [{ delta: {}, finish_reason: 'stop' }] }));
        controller.enqueue(event({ choices: [], usage: OPENAI_USAGE }));
        controller.enqueue(enc.encode('data: [DONE]\n\n'));
        controller.close();
      },
    })
  );
}

globalThis.fetch = async (url, init) => {
  if (String(url).includes('api.openai.com')) return fakeOpenAi(init);
  if (!String(url).includes('generativelanguage.googleapis.com')) return realFetch(url, init);
  const body = JSON.parse(init.body);
  sent.push({ url: String(url), body });
  trail.push(`gemini:${/models\/([^:]+):/.exec(String(url))?.[1]}`);
  const enc = new TextEncoder();

  if (!String(url).includes('streamGenerateContent')) {
    // Summarization (non-streaming).
    if (summaryDelay) await new Promise((r) => setTimeout(r, summaryDelay));
    if (summaryFails) return new Response(summaryFails.body, { status: summaryFails.status });
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'PERSON — Asha, prefers Hindi.\nINTERESTS — Sri Vaishnava.\nPRACTICES — 16 rounds daily.' }] } }],
      usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 40 },
    });
  }

  if (failWith === 'drop') throw new TypeError('fetch failed');
  if (failWith?.status) return new Response(failWith.body, { status: failWith.status });
  if (failWith === 'cut') {
    return new Response(
      new ReadableStream({
        start(controller) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'Half an ' }] } }] })}\n\n`));
          setTimeout(() => controller.error(new TypeError('terminated')), 50);
        },
      })
    );
  }

  const pieces = reply;
  return new Response(
    new ReadableStream({
      async start(controller) {
        // A real fetch stops when its signal aborts; so does this.
        let aborted = false;
        init.signal?.addEventListener('abort', () => { aborted = true; controller.error(init.signal.reason); });
        for (const text of pieces) {
          if (aborted) return;
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] })}\n\n`));
          if (slow) await new Promise((r) => setTimeout(r, 300));
        }
        if (aborted) return;
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }], usageMetadata: USAGE })}\n\n`));
        controller.close();
      },
    })
  );
};

// ── Helpers ────────────────────────────────────────────────────────────────
const server = await new Promise((resolve) => { const s = app.listen(0, () => resolve(s)); });
const BASE = `http://127.0.0.1:${server.address().port}/api`;
const HEAD = { 'content-type': 'application/json', 'x-device-id': 'chat-e2e', 'x-platform': 'ios' };

async function call(method, path, { token, body } = {}) {
  const res = await realFetch(BASE + path, {
    method, headers: { ...HEAD, ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  return { status: res.status, json };
}

/** POST that reads the SSE stream. `stopAfter` hangs up after that many delta events. */
async function stream(path, { token, body, stopAfter } = {}) {
  const abort = new AbortController();
  const res = await realFetch(BASE + path, {
    method: 'POST', headers: { ...HEAD, authorization: `Bearer ${token}` }, body: JSON.stringify(body || {}), signal: abort.signal,
  });
  if (!res.headers.get('content-type')?.includes('text/event-stream')) {
    return { status: res.status, json: await res.json().catch(() => null), events: [] };
  }
  const events = [];
  let buffer = '';
  let deltas = 0;
  const decoder = new TextDecoder();
  try {
    for await (const chunk of res.body) {
      buffer += decoder.decode(chunk, { stream: true });
      let i;
      while ((i = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, i);
        buffer = buffer.slice(i + 2);
        const name = /^event: (.*)$/m.exec(raw)?.[1];
        const data = /^data: (.*)$/m.exec(raw)?.[1];
        if (!name) continue;
        events.push({ name, data: JSON.parse(data) });
        if (name === 'delta' && (stopAfter ?? 0) && ++deltas >= stopAfter) abort.abort();
      }
    }
  } catch { /* hung up on purpose */ }
  return { status: res.status, events };
}

const text = (r) => r.events.filter((e) => e.name === 'delta').map((e) => e.data.text).join('');
const last = (r, name) => r.events.findLast((e) => e.name === name)?.data;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
// The latest request that was a reply (a summary written in the background is also a request, and can come after it).
const lastStream = () => sent.findLast((x) => x.url.includes('streamGenerateContent'));
const summaryCalls = () => sent.filter((x) => !x.url.includes('streamGenerateContent')).length;

/** The summary that follows a reply is written after it: waits until none is under way for this chat. */
async function settled(conversationId) {
  await wait(200); // it starts a moment after the reply ends
  for (let i = 0; i < 200; i += 1) {
    if (!(await redis.get(`chat:compact:${conversationId}`))) return;
    await wait(50);
  }
}

async function makeUser(label, roleSlug = 'user') {
  const role = await prisma.role.findUnique({ where: { slug: roleSlug } });
  const user = await prisma.user.create({
    data: {
      email: `chat-e2e-${label}-${Date.now()}@example.com`, name: label, authProvider: 'GOOGLE',
      providerUserId: `chat-e2e-${label}-${Date.now()}`, roleId: role.id,
    },
  });
  return { user, token: (await authService.issueSession(user, 'chat-e2e')).accessToken };
}

const ledger = (userId, where = {}) => prisma.aiWalletTransaction.findMany({ where: { userId, ...where }, orderBy: { createdAt: 'asc' } });

// ── Pictures ───────────────────────────────────────────────────────────────
const strayKeys = new Set(); // every upload this run made, so none is left in storage
const spareUsers = []; // users made inside a section, removed in the final cleanup

async function makeSpare(label, roleSlug) {
  const made = await makeUser(label, roleSlug);
  spareUsers.push(made.user.id);
  return made;
}

// A picture to send: left half red, right half blue.
function picture(width, height, type = 'image/png') {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, width / 2, height);
  context.fillStyle = '#0000ff';
  context.fillRect(width / 2, 0, width / 2, height);
  return canvas.toBuffer(type, 95);
}

/** POST /app/chat/images — the body is the picture itself. */
async function upload(token, bytes, type = 'application/octet-stream') {
  const res = await realFetch(`${BASE}/app/chat/images`, {
    method: 'POST',
    headers: { 'content-type': type, 'x-device-id': 'chat-e2e', 'x-platform': 'ios', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: bytes,
  });
  let json = null;
  try { json = await res.json(); } catch { /* no body */ }
  if (json?.data?.key) strayKeys.add(json.data.key);
  return { status: res.status, json };
}

const pixelsIn = (request) => request.body.contents.flatMap((c) => c.parts).filter((p) => p.inlineData);
const wordsIn = (request) => request.body.contents.flatMap((c) => c.parts).filter((p) => p.text !== undefined).map((p) => p.text);
const sameBytes = (part, bytes) => Buffer.from(part.inlineData.data, 'base64').equals(bytes);
const exists = (key) => s3.objectExists(key);
const savedKeys = async (userId) =>
  (await prisma.chatMessage.findMany({ where: { conversation: { userId }, imagePath: { not: null } }, select: { imagePath: true } })).map((m) => m.imagePath);

/** A new chat in which [user] sends one picture; resolves to the stored key. */
async function sendOnePicture(user) {
  const { key } = (await upload(user.token, picture(300, 200))).json.data;
  const id = (await call('POST', '/app/chat/conversations', { token: user.token, body: {} })).json.data.id;
  reply = ['Lovely.'];
  await stream(`/app/chat/conversations/${id}/messages`, { token: user.token, body: { content: 'See?', imageKey: key } });
  return (await savedKeys(user.user.id))[0];
}

async function picturesSection({ admin, bob }) {
  console.log('\n15. Pictures — upload, send, keep, switch off, clear');
  check('storage is on this machine for the run, so the real bucket is never touched', s3.useLocalStorage === true);
  if (!s3.useLocalStorage) return;

  const cleo = await makeSpare('cleo');
  // A roomy window, so the chat is never compacted and no picture is folded into a summary part-way.
  const limitsBody = { recentMessages: 40, compactAtTokens: 100000, keepRecentOnCompact: 4, summaryMaxTokens: 450, maxMessages: 120, maxOutputTokens: 1200, maxInputChars: 4000, appActions: 0, imageMaxEdge: 1280 };
  let r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { limits: { ...limitsBody, imageInput: 1 } } });
  check('(pictures on, up to 1280 px, and a window that never compacts)', r.status === 200 && r.json.data.limits.imageInput === 1 && r.json.data.limits.imageMaxEdge === 1280, JSON.stringify(r.json?.data?.limits));

  // — Uploading
  r = await upload(cleo.token, picture(1600, 800), 'image/png');
  const first = r.json?.data;
  check('an upload answers 200 with a key, a link and the size that was kept', r.status === 200 && !!first?.key && !!first?.url, JSON.stringify(r.json));
  check('…a chat-picture key that waits in temp/ until a message takes it', chatImages.isChatImageKey(first.key) && first.key.startsWith('temp/'), first.key);
  const firstBytes = await s3.getObjectBuffer(first.key);
  const info = sniff(firstBytes);
  check('…scaled to the longest edge the admin allows, and drawn again as a JPEG', info?.format === 'jpeg' && first.width === 1280 && first.height === 640 && info.width === 1280, JSON.stringify(info));

  // — Sending it
  const conv = (await call('POST', '/app/chat/conversations', { token: cleo.token, body: {} })).json.data.id;
  reply = ['Red and blue, friend.'];
  let s = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'What do you see?', imageKey: first.key } });
  const asked = last(s, 'meta')?.userMessage;
  check('the reply streams as usual', !!last(s, 'done') && text(s) === 'Red and blue, friend.');
  check('the question comes back with a picture link and no storage path', typeof asked?.imageUrl === 'string' && !JSON.stringify(asked).includes('imagePath'), JSON.stringify(asked));
  let request = sent.at(-1);
  check('the provider was given the picture itself, exactly as stored', pixelsIn(request).length === 1 && pixelsIn(request)[0].inlineData.mimeType === 'image/jpeg' && sameBytes(pixelsIn(request)[0], firstBytes));
  check('…and the persona was told how to treat a picture', request.body.systemInstruction.parts[0].text.includes(chatConfig.IMAGE_GUIDANCE));
  const saved = await prisma.chatMessage.findUnique({ where: { id: asked.id } });
  check('saving moved the upload out of temp/ to its permanent key', !!saved.imagePath && !saved.imagePath.startsWith('temp/') && (await exists(saved.imagePath)) && !(await exists(first.key)), saved.imagePath);
  check('the question weighs what a picture costs', saved.tokenCount >= chatConfig.IMAGE_TOKEN_ESTIMATE, String(saved.tokenCount));
  const debits = await ledger(cleo.user.id, { type: 'DEBIT', source: 'CHAT' });
  check('…but only the provider’s reported tokens were debited (30 + 20)', debits.length === 1 && debits[0].tokens === 50);
  r = await call('GET', '/app/chat/current', { token: cleo.token });
  check('/current gives the picture back as a link, never a key', typeof r.json.data.messages.find((m) => m.role === 'user')?.imageUrl === 'string' && !JSON.stringify(r.json.data).includes('imagePath'));

  // — Whose a key is, and once
  const before = await prisma.chatMessage.count({ where: { conversationId: conv } });
  const refusals = [
    ['an upload that has been used', first.key],
    ['the saved picture’s own key', saved.imagePath],
    ['a key nobody issued', `hariharibol/chat/images/${'a'.repeat(32)}.jpg`],
    ['a key for something else in storage', `hariharibol/reels/${'0'.repeat(32)}.jpg`],
  ];
  for (const [name, imageKey] of refusals) {
    r = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'sneaky', imageKey } });
    check(`${name} is a 422 IMAGE_NOT_USABLE`, r.status === 422 && r.json?.error?.code === 'IMAGE_NOT_USABLE', `${r.status} ${JSON.stringify(r.json?.error)}`);
  }
  check('…and none of them saved anything', (await prisma.chatMessage.count({ where: { conversationId: conv } })) === before);

  const theirs = (await upload(bob.token, picture(400, 300))).json.data;
  r = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'mine now', imageKey: theirs.key } });
  check('another reader’s upload cannot be attached', r.status === 422 && r.json?.error?.code === 'IMAGE_NOT_USABLE');
  const bobsChat = (await call('GET', '/app/chat/current', { token: bob.token })).json.data.id;
  reply = ['Lovely, Bob.'];
  s = await stream(`/app/chat/conversations/${bobsChat}/messages`, { token: bob.token, body: { imageKey: theirs.key } });
  check('…and the refused try did not spend it: its owner can still send it, with no words', !!last(s, 'done') && wordsIn(sent.at(-1)).every((t) => t !== ''));

  // — Several pictures: only the newest is sent as pixels
  const second = (await upload(cleo.token, picture(500, 300, 'image/jpeg'), 'image/jpeg')).json.data;
  const secondBytes = await s3.getObjectBuffer(second.key);
  reply = ['A wider one.'];
  s = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'And this one?', imageKey: second.key } });
  request = sent.at(-1);
  check('with two pictures in the chat, the provider gets one — the newest', !!last(s, 'done') && pixelsIn(request).length === 1 && sameBytes(pixelsIn(request)[0], secondBytes));
  check('…and the earlier one is only a note that there was a picture', wordsIn(request).some((t) => t.includes(chatConfig.IMAGE_PLACEHOLDER)));

  reply = ['Answered again.'];
  s = await stream(`/app/chat/conversations/${conv}/regenerate`, { token: cleo.token });
  request = sent.at(-1);
  check('answering again sends the same picture again', !!last(s, 'done') && pixelsIn(request).length === 1 && sameBytes(pixelsIn(request)[0], secondBytes));

  reply = ['Yes, the same one.'];
  s = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'Was it wide?' } });
  request = sent.at(-1);
  check('a follow-up in words is still about the newest picture', !!last(s, 'done') && pixelsIn(request).length === 1 && sameBytes(pixelsIn(request)[0], secondBytes));

  // — A refusal before the stream leaves the upload good for the retry
  const third = (await upload(cleo.token, picture(300, 300, 'image/jpeg'), 'image/jpeg')).json.data;
  const thirdBytes = await s3.getObjectBuffer(third.key);
  const wallet15 = (await prisma.aiWallet.findUnique({ where: { userId: cleo.user.id } })).balance;
  await prisma.aiWallet.update({ where: { userId: cleo.user.id }, data: { balance: 10 } });
  const calls = sent.length;
  r = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'Look', imageKey: third.key } });
  check('a wallet that cannot cover it is a 402 and the provider is not called', r.status === 402 && r.json?.error?.code === 'CREDITS_EXHAUSTED' && sent.length === calls);
  await prisma.aiWallet.update({ where: { userId: cleo.user.id }, data: { balance: wallet15 } });
  reply = ['Square.'];
  s = await stream(`/app/chat/conversations/${conv}/messages`, { token: cleo.token, body: { content: 'Look', imageKey: third.key } });
  check('…and the same upload then goes through', !!last(s, 'done') && sameBytes(pixelsIn(sent.at(-1))[0], thirdBytes));

  // — A picture on its own
  const conv2 = (await call('POST', '/app/chat/conversations', { token: cleo.token, body: {} })).json.data.id;
  const lone = (await upload(cleo.token, picture(320, 240))).json.data;
  reply = ['A quiet one.'];
  s = await stream(`/app/chat/conversations/${conv2}/messages`, { token: cleo.token, body: { imageKey: lone.key } });
  check('a picture alone is answered, and sent with no empty text beside it', !!last(s, 'done') && pixelsIn(sent.at(-1)).length === 1 && wordsIn(sent.at(-1)).every((t) => t !== ''));
  check('…and does not name the chat', last(s, 'meta').conversation.title === 'New chat', last(s, 'meta').conversation.title);
  r = await stream(`/app/chat/conversations/${conv2}/messages`, { token: cleo.token, body: {} });
  check('a message with neither words nor picture is refused', r.status === 400, String(r.status));

  // — Uploads that are not usable
  const bad = [
    ['text', Buffer.from('this is not a picture at all, really'), 422, 'IMAGE_NOT_USABLE'],
    ['a GIF', Buffer.from(`GIF89a${'x'.repeat(100)}`), 422, 'IMAGE_NOT_USABLE'],
    ['nothing', undefined, 400, 'IMAGE_NOT_USABLE'],
    ['more than the limit', Buffer.alloc(chatConfig.IMAGE_UPLOAD_MAX_BYTES + 1, 1), 413, 'IMAGE_TOO_LARGE'],
  ];
  for (const [name, bytes, status, code] of bad) {
    r = await upload(cleo.token, bytes);
    check(`${name} is a ${status} ${code}`, r.status === status && r.json?.error?.code === code, `${r.status} ${JSON.stringify(r.json?.error)}`);
  }
  r = await upload(null, picture(100, 100));
  check('an upload needs a signed-in reader', r.status === 403);

  // — Switched off in the admin panel
  const pending = (await upload(cleo.token, picture(200, 200))).json.data;
  r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { limits: { ...limitsBody, imageInput: 0 } } });
  check('an admin can switch pictures off', r.status === 200 && r.json.data.limits.imageInput === 0);
  r = await upload(cleo.token, picture(100, 100));
  check('an upload is then a 403 IMAGE_NOT_AVAILABLE', r.status === 403 && r.json?.error?.code === 'IMAGE_NOT_AVAILABLE');
  r = await stream(`/app/chat/conversations/${conv2}/messages`, { token: cleo.token, body: { content: 'Here', imageKey: pending.key } });
  check('…and so is sending one already uploaded', r.status === 403 && r.json?.error?.code === 'IMAGE_NOT_AVAILABLE');
  reply = ['Tell me more.'];
  s = await stream(`/app/chat/conversations/${conv2}/messages`, { token: cleo.token, body: { content: 'What was in the first one?' } });
  request = sent.at(-1);
  check('words still work, and the earlier picture is just a note', !!last(s, 'done') && pixelsIn(request).length === 0 && wordsIn(request).some((t) => t.includes(chatConfig.IMAGE_PLACEHOLDER)));
  check('…with no word to the persona about a picture that is not there', !request.body.systemInstruction.parts[0].text.includes(chatConfig.IMAGE_GUIDANCE));
  r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { limits: { ...limitsBody, imageInput: 1 } } });
  reply = ['I see it.'];
  s = await stream(`/app/chat/conversations/${conv2}/messages`, { token: cleo.token, body: { content: 'Now?', imageKey: pending.key } });
  check('switched back on, the waiting upload goes through', !!last(s, 'done') && pixelsIn(sent.at(-1)).length === 1);

  // — A file that has gone from storage
  const finn = await makeSpare('finn');
  const finnKey = await sendOnePicture(finn);
  await s3.deleteObject(finnKey);
  const finnChat = (await call('GET', '/app/chat/current', { token: finn.token })).json.data.id;
  reply = ['I cannot see it any more.'];
  s = await stream(`/app/chat/conversations/${finnChat}/messages`, { token: finn.token, body: { content: 'Do you still have it?' } });
  request = sent.at(-1);
  check('a picture gone from storage does not stop the chat: it reads as a note', !!last(s, 'done') && pixelsIn(request).length === 0 && wordsIn(request).some((t) => t.includes(chatConfig.IMAGE_PLACEHOLDER)));
  check('…and the persona is not told about a picture it was not given', !request.body.systemInstruction.parts[0].text.includes(chatConfig.IMAGE_GUIDANCE));

  // — Clearing, and leaving
  const kept = await savedKeys(cleo.user.id);
  const bobKept = await savedKeys(bob.user.id);
  check('(every picture sent is in storage before the chat is cleared)', kept.length === 5 && (await Promise.all(kept.map((k) => exists(k)))).every(Boolean), String(kept.length));
  r = await call('DELETE', '/app/chat/conversations', { token: cleo.token });
  check('clearing the chat answers 204', r.status === 204);
  check('…and the picture files go with it', (await Promise.all(kept.map((k) => exists(k)))).every((x) => !x));
  check('another reader’s picture is untouched', bobKept.length === 1 && (await exists(bobKept[0])));

  const dora = await makeSpare('dora');
  const doraKey = await sendOnePicture(dora);
  check('(a reader has a picture in storage)', !!doraKey && (await exists(doraKey)));
  r = await call('DELETE', '/app/auth/account', { token: dora.token });
  check('deleting the account answers 200', r.status === 200, String(r.status));
  check('…and removes their pictures', !(await exists(doraKey)));

  const eve = await makeSpare('eve');
  const eveKey = await sendOnePicture(eve);
  check('(another reader has one too)', !!eveKey && (await exists(eveKey)));
  r = await call('DELETE', `/admin/users/${eve.user.id}`, { token: admin.token });
  check('an admin deleting the user answers 200', r.status === 200, String(r.status));
  check('…and removes their pictures too', !(await exists(eveKey)));
}

// What the admin panel edits. Sections 11 and 15 change the chat's, and the run takes over the AI ones (which engine
// answers, and the free-tier switch), so it puts back exactly what was there.
const CHAT_SETTINGS = ['chat.system_prompt', 'chat.description', 'chat.limits'];
const AI_SETTINGS = [
  SETTING_KEYS.AI_PROVIDER, SETTING_KEYS.AI_MODEL_TEXT,
  SETTING_KEYS.AI_FREE_TIER_ENABLED, SETTING_KEYS.AI_FREE_TIER_TEXT_MODEL, SETTING_KEYS.AI_FREE_TIER_TRANSLATION_MODEL,
  SETTING_KEYS.AI_FREE_TIER_BONUS_POOL, SETTING_KEYS.AI_FREE_TIER_BONUS_MAX_USER,
];
const SAVED_SETTINGS = [...CHAT_SETTINGS, ...AI_SETTINGS];

async function restoreSettings(before) {
  for (const key of SAVED_SETTINGS) {
    const row = before.find((s) => s.key === key);
    if (row) await prisma.appSetting.update({ where: { key }, data: { value: row.value } });
    else await prisma.appSetting.deleteMany({ where: { key } });
    await redis.del(CACHE.setting(key));
  }
}

// The day's token tally is real data in the dev Redis; the run counts into an empty one and puts the other back.
async function saveTally() {
  const key = tally.keyOf();
  return { key, fields: await redis.hgetall(key), ttl: await redis.ttl(key) };
}

async function restoreTally({ key, fields, ttl }) {
  await redis.del(key);
  if (Object.keys(fields).length === 0) return;
  await redis.hset(key, fields);
  if (ttl > 0) await redis.expire(key, ttl);
}

/** Every picture file a run made: the saved ones, and any upload no message took. */
async function removePictures(userIds) {
  const saved = await chatImages.keysWhere({ conversation: { userId: { in: userIds } } });
  await chatImages.deleteFiles([...saved, ...strayKeys]);
}

// ── The reader's name ──────────────────────────────────────────────────────

async function nameSection() {
  console.log('\n16. The reader’s name — said by Sakha, never sent to the model');
  const { NAME_GUIDANCE } = chatConfig;
  const systemOf = (request) => request.body.systemInstruction.parts[0].text;

  // The account holds a full name; only its first word is ever used, and none of it may be sent.
  const zed = await makeSpare('Zorbaxel');
  await prisma.user.update({ where: { id: zed.user.id }, data: { name: 'Zorbaxel Quillfeather' } });
  const from = sent.length;
  const id = (await call('POST', '/app/chat/conversations', { token: zed.token, body: {} })).json.data.id;

  reply = ['Hari Bol, {na', 'me}! You are welcome, {name}.']; // the token is cut between two pieces
  let s = await stream(`/app/chat/conversations/${id}/messages`, { token: zed.token, body: { content: 'Hello there' } });
  const spoken = 'Hari Bol, Zorbaxel! You are welcome, Zorbaxel.';
  check('{name} arrives as the first name, even when it is cut between two pieces', text(s) === spoken, text(s));
  check('…no piece of the token reaches the phone', s.events.filter((e) => e.name === 'delta').every((e) => !e.data.text.includes('{')));
  check('…and the finished message says the same', last(s, 'done')?.message.content === spoken, last(s, 'done')?.message.content);
  check('the model is told to write {name}, and is not told the name', systemOf(lastStream()).includes(NAME_GUIDANCE));
  const stored = await prisma.chatMessage.findFirst({ where: { conversationId: id, role: 'ASSISTANT' } });
  check('what is stored keeps the token, so the name is never in the history', stored.content === 'Hari Bol, {name}! You are welcome, {name}.', stored.content);

  let r = await call('GET', `/app/chat/conversations/${id}`, { token: zed.token });
  check('reading the chat back fills the name in', r.json.data.messages.at(-1).content === spoken, r.json.data.messages.at(-1).content);
  r = await call('GET', '/app/chat/current', { token: zed.token });
  check('…and so does the chat the app opens', r.json.data.messages.at(-1).content === spoken);
  check('what the reader typed is shown as typed', r.json.data.messages[0].content === 'Hello there');

  reply = ['Be well, {name}.'];
  s = await stream(`/app/chat/conversations/${id}/messages`, { token: zed.token, body: { content: 'Thank you' } });
  const replay = JSON.stringify(lastStream().body.contents);
  check('the history sent back to the model still holds the token, not the name', replay.includes('{name}') && !replay.toLowerCase().includes('zorbaxel'));

  reply = ['Again, {name}.'];
  s = await stream(`/app/chat/conversations/${id}/regenerate`, { token: zed.token });
  check('answering again fills it in too', text(s) === 'Again, Zorbaxel.', text(s));

  reply = ['Hare Krishna.'];
  await stream(`/app/chat/conversations/${id}/messages`, { token: zed.token, body: { content: 'One more' } });
  r = await call('POST', `/app/chat/conversations/${id}/compact`, { token: zed.token });
  check('(a summary is written for this chat)', r.status === 200 && r.json.data.compacted === true);
  const request = sent.findLast((x) => !x.url.includes('streamGenerateContent'));
  const summarizerSystem = systemOf(request);
  check('the summariser reads the token as it was stored, and is told not to record it', JSON.stringify(request.body).includes('{name}') && summarizerSystem.includes('not a fact to record'));

  const everything = sent.slice(from).map((x) => JSON.stringify(x)).join('\n').toLowerCase();
  check('the name is nowhere in anything sent to the provider: prompts, history and summaries', !everything.includes('zorbaxel') && !everything.includes('quillfeather'));

  // A reader with no name Sakha could use: no note, and a stray token is dropped rather than shown.
  const none = await makeSpare('123');
  const nid = (await call('POST', '/app/chat/conversations', { token: none.token, body: {} })).json.data.id;
  reply = ['Hari Bol, {name}! Welcome.'];
  s = await stream(`/app/chat/conversations/${nid}/messages`, { token: none.token, body: { content: 'Hello' } });
  check('a reader whose account holds no usable name gets no note about it', !systemOf(lastStream()).includes(NAME_GUIDANCE) && !systemOf(lastStream()).includes('{name}'));
  check('…and a token that slips through is dropped, never shown', !text(s).includes('{') && last(s, 'done')?.message.content === 'Hari Bol! Welcome.', last(s, 'done')?.message.content);
}

// ── Taking the reader somewhere ─────────────────────────────────────────────

async function actionsSection({ admin }) {
  console.log('\n18. Opening things in the app — an offer, only for a place that exists');
  const limitsBody = { recentMessages: 40, compactAtTokens: 100000, keepRecentOnCompact: 4, summaryMaxTokens: 450, maxMessages: 120, maxOutputTokens: 1200, maxInputChars: 4000, imageMaxEdge: 1280, imageInput: 1 };
  const setActions = (on) => call('PUT', '/admin/chat/settings', { token: admin.token, body: { limits: { ...limitsBody, appActions: on } } });
  const systemOf = (request) => request.body.systemInstruction.parts[0].text;
  const reader = await makeSpare('ana');
  const ask = async (pieces, content = 'Take me there') => {
    const id = (await call('POST', '/app/chat/conversations', { token: reader.token, body: {} })).json.data.id;
    reply = pieces;
    return { id, s: await stream(`/app/chat/conversations/${id}/messages`, { token: reader.token, body: { content } }) };
  };

  const book = await prisma.book.findFirst({ where: { bookNumber: 1 }, select: { id: true, slug: true, isPublished: true } });
  if (book && !book.isPublished) await prisma.book.update({ where: { id: book.id }, data: { isPublished: true } }); // an unpublished book is never offered
  const verse = book && await prisma.verse.create({ data: { verseId: 'e2e.1.99.1', bookId: book.id, bookNumber: 1, chapterNumber: 99, verseNumber: 1 } });
  const mantra = await prisma.mantra.create({ data: { slug: 'e2e-zorbax-mantra', name: 'Zorbax Mantra', sanskrit: 'ॐ', category: 'name', isPublished: true } });
  try {
    let r = await setActions(1);
    check('an admin can switch opening things on', r.status === 200 && r.json.data.limits.appActions === 1);

    let q = await ask(['Of course, here are the reels.\n\n[[open:pa', 'ge:reels]]']);
    check('the marker is never shown, even when it is cut in two', text(q.s) === 'Of course, here are the reels.\n\n' && !q.s.events.some((e) => e.data?.text?.includes('[')), JSON.stringify(text(q.s)));
    const offer = last(q.s, 'action');
    check('the reader is offered the page', offer?.type === 'page' && offer.page === 'reels', JSON.stringify(offer));
    check('…before the reply is done', q.s.events.findIndex((e) => e.name === 'action') < q.s.events.findIndex((e) => e.name === 'done'));
    check('…and the saved reply holds no marker', (await prisma.chatMessage.findFirst({ where: { conversationId: q.id, role: 'ASSISTANT' } })).content === 'Of course, here are the reels.');
    check('the model was told how to offer', systemOf(lastStream()).includes(chatConfig.ACTION_GUIDANCE));

    q = await ask(['Opening it. [[open:mantra:zorbax mantra]]']);
    check('a mantra is offered by its name', last(q.s, 'action')?.type === 'mantra' && last(q.s, 'action').slug === 'e2e-zorbax-mantra' && last(q.s, 'action').title === 'Zorbax Mantra', JSON.stringify(last(q.s, 'action')));
    q = await ask(['Here. [[open:mantra:no such mantra anywhere]]']);
    check('a mantra we do not have is not offered, and the text is intact', !last(q.s, 'action') && text(q.s) === 'Here. ' && !!last(q.s, 'done'));

    if (verse) {
      q = await ask([`Yes. [[open:verse:${book.slug}:99.1]]`]);
      const v = last(q.s, 'action');
      check('a verse that exists is offered with its place', v?.type === 'verse' && v.bookSlug === book.slug && v.chapter === 99 && v.verse === 1 && /99\.1$/.test(v.title), JSON.stringify(v));
      q = await ask([`Yes. [[open:verse:${book.slug}:99.7]]`]);
      check('a verse that does not exist is not offered', !last(q.s, 'action'));
    }
    q = await ask(['Sure. [[open:page:admin]]']);
    check('a page the app does not offer is not offered', !last(q.s, 'action') && text(q.s) === 'Sure. ');

    r = await setActions(0);
    q = await ask(['Fine. [[open:page:home]]']);
    check('switched off, the prompt carries no instructions and no offer is made', !systemOf(lastStream()).includes(chatConfig.ACTION_GUIDANCE) && !last(q.s, 'action') && text(q.s) === 'Fine. ');
  } finally {
    await prisma.mantra.delete({ where: { id: mantra.id } }).catch(() => null);
    if (book && !book.isPublished) await prisma.book.update({ where: { id: book.id }, data: { isPublished: false } }).catch(() => null);
    if (verse) await prisma.verse.delete({ where: { id: verse.id } }).catch(() => null);
  }
}

// ── The daily bonus ─────────────────────────────────────────────────────────

async function bonusSection({ admin, original }) {
  console.log('\n19. The free-tier bonus — extra tokens a day, spent first, outside the wallet and the daily cap');
  const reader = await makeSpare('bea');
  const setFreeTier = (body) => call('PUT', '/admin/ai/free-tier', { token: admin.token, body });
  const panel = async () => (await call('GET', '/admin/ai/free-tier', { token: admin.token })).json.data;
  const date = (await import('../utils/ai-credits.js')).localDateKey(new Date(), reader.user.timezone);
  const send = async (content) => {
    const id = (await call('POST', '/app/chat/conversations', { token: reader.token, body: {} })).json.data.id;
    reply = ['Hari Bol.'];
    return stream(`/app/chat/conversations/${id}/messages`, { token: reader.token, body: { content } });
  };
  const day = () => prisma.aiDailyUsage.findUnique({ where: { userId_date: { userId: reader.user.id, date } } });

  // A plan with a small daily cap, so the cap can be used up.
  await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'BASIC', dailyTokens: 3000, walletTokens: 50000 } });
  wallet.clearAllowanceCache();
  await wallet.open(reader.user);
  await prisma.aiDailyUsage.upsert({ where: { userId_date: { userId: reader.user.id, date } }, update: { tokens: 3000 }, create: { userId: reader.user.id, date, tokens: 3000 } });

  await setFreeTier({ enabled: false, bonusPoolTokens: 100000, bonusMaxPerUser: 5000 });
  let s = await send('With the switch off');
  check('with the free tier off there is no bonus: the spent daily cap stops the reply', s.status === 402 && s.json.error.code === 'CREDITS_EXHAUSTED', String(s.status));

  let r = await setFreeTier({ enabled: true });
  let state = r.json.data;
  const expected = Math.min(5000, Math.floor(100000 / Math.max(1, state.bonus.users)));
  check('on, the panel shows the pool shared among the readers, to a ceiling each', state.bonus.active === true && state.bonus.tokens === expected && state.bonus.tokens > 0 && state.bonus.poolTokens === 100000 && state.bonus.maxPerUser === 5000, JSON.stringify(state.bonus));
  r = await setFreeTier({ bonusPoolTokens: 999 * 1000 * 1000 });
  check('a pool above what the free tier holds is refused', r.status === 400, String(r.status));

  const walletBefore = (await prisma.aiWallet.findUnique({ where: { userId: reader.user.id } })).balance;
  s = await send('With the bonus');
  const done = last(s, 'done');
  check('a reader whose daily cap is spent is still answered from the bonus', !!done && done.credits.exhausted === false, String(s.status));
  const used = await day();
  check('…the bonus paid for it, and the wallet and the cap were left alone', used.bonusTokens > 0 && used.tokens === 3000 && (await prisma.aiWallet.findUnique({ where: { userId: reader.user.id } })).balance === walletBefore, JSON.stringify(used));
  check('…and no wallet debit was written', (await ledger(reader.user.id, { type: 'DEBIT', source: 'CHAT' })).length === 0);

  // Only a little bonus left: it pays first, the wallet pays the rest.
  await prisma.aiDailyUsage.update({ where: { userId_date: { userId: reader.user.id, date } }, data: { tokens: 0, bonusTokens: expected - 10 } });
  s = await send('Part bonus, part wallet');
  const after = await day();
  const debit = (await ledger(reader.user.id, { type: 'DEBIT', source: 'CHAT' }))[0];
  check('the last of the bonus is used first, then the wallet pays the rest', !!last(s, 'done') && after.bonusTokens === expected && after.tokens > 0 && debit?.tokens === after.tokens, JSON.stringify([after, debit?.tokens]));

  // Gone for a plan on the stronger model, and when the pool is nothing.
  await prisma.aiDailyUsage.update({ where: { userId_date: { userId: reader.user.id, date } }, data: { tokens: 3000, bonusTokens: 0 } });
  await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'ADVANCED' } });
  wallet.clearAllowanceCache();
  s = await send('On the stronger model');
  check('a plan on the stronger model gets no bonus', s.status === 402, String(s.status));
  await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'BASIC' } });
  wallet.clearAllowanceCache();
  await setFreeTier({ bonusPoolTokens: 0 });
  s = await send('With an empty pool');
  check('a pool of nothing gives nothing', s.status === 402, String(s.status));
  state = await panel();
  check('…and the panel says it is not being given', state.bonus.tokens === 0);
}

// ── The engines ────────────────────────────────────────────────────────────

const chain = (list) => list.map((engine) => `${engine.provider} ${engine.model} ${engine.source}`).join(' → ');
const counted = async (provider, model) =>
  (await tally.today()).find((row) => row.provider === provider && row.model === model) ?? { inputTokens: 0, outputTokens: 0, calls: 0 };

async function enginesSection({ admin, original }) {
  console.log('\n17. The engines — OpenAI’s free tier, then the provider that is set, then GPT-6 Luna');
  const { capOf } = await import('../utils/ai-free-tier.js');
  const developerText = /gemini|openai|gpt|luna|models\/|does not exist|no longer available|overloaded|rate limit|quota/i;

  // OpenAI gets a fake key (its host is faked above) and the paid fallback is on, as it is by default. Sections 9–11 left
  // the plan on a small allowance and the stronger model; this section starts from the normal one.
  const keyBefore = env.OPENAI_API_KEY;
  const fallbackBefore = env.AI_FALLBACK_MODEL;
  env.OPENAI_API_KEY = 'fake-openai-key';
  env.AI_FALLBACK_MODEL = 'gpt-6-luna';
  await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'BASIC', dailyTokens: 0 } });
  wallet.clearAllowanceCache();

  const reader = await makeSpare('gita');

  // A question in a chat of its own → the stream, the chat, and the engines tried for it, in order.
  async function ask(content) {
    const id = (await call('POST', '/app/chat/conversations', { token: reader.token, body: {} })).json.data.id;
    const from = trail.length;
    const s = await stream(`/app/chat/conversations/${id}/messages`, { token: reader.token, body: { content } });
    return { s, id, tried: trail.slice(from).join(' → ') };
  }
  const modelOf = async (s) => (await prisma.chatMessage.findUnique({ where: { id: last(s, 'done').message.id } })).model;
  const debits = async () => (await ledger(reader.user.id, { type: 'DEBIT', source: 'CHAT' })).map((row) => row.tokens);
  const logged = (id) => prisma.aiUsageLog.findMany({ where: { targetType: 'chat', targetId: id, operation: 'chat.reply' } });
  const panel = async () => (await call('GET', '/admin/ai/free-tier', { token: admin.token })).json.data;
  const setFreeTier = (body) => call('PUT', '/admin/ai/free-tier', { token: admin.token, body });
  const gemini = 'gemini:gemini-reply-test';

  try {
    // — With the free tier off, a healthy provider answers alone
    reply = ['Namaste.'];
    let q = await ask('A healthy day');
    check('with the last resort set up, a healthy provider still answers alone', !!last(q.s, 'done') && q.tried === gemini, q.tried);

    // — The provider that is set stops working: GPT-6 Luna answers, and the reader never knows
    failWith = { status: 404, body: '{"error":{"code":404,"message":"models/gemini-reply-test is no longer available to new users"}}' };
    openAiReply = ['Hari Bol, friend.'];
    const geminiBefore = await counted('gemini', 'gemini-reply-test');
    const lunaBefore = await counted('openai', 'gpt-6-luna');
    q = await ask('Asked after the first provider was retired');
    failWith = null;
    check('the provider that is set is tried first, then GPT-6 Luna', q.tried === `${gemini} → openai:gpt-6-luna`, q.tried);
    check('the reader gets the reply, with no error on the way', !!last(q.s, 'done') && !q.s.events.some((e) => e.name === 'error') && text(q.s) === 'Hari Bol, friend.', text(q.s));
    check('…and nothing the reader is sent says which engine wrote it', !/gpt|openai|gemini|luna/i.test(JSON.stringify(q.s.events)));
    check('GPT-6 Luna was asked for a streamed reply', openAiSent.at(-1).model === 'gpt-6-luna' && openAiSent.at(-1).stream === true);
    check('the saved reply names the model that wrote it', (await modelOf(q.s)) === 'gpt-6-luna');
    check('the reader is charged what that model reported (40 + 25)', (await debits()).at(-1) === 65, String((await debits()).at(-1)));
    const tries = await logged(q.id);
    const failedTry = tries.find((row) => row.provider === 'GEMINI');
    const answeredTry = tries.find((row) => row.provider === 'OPENAI');
    check('the usage log shows the failed try as a failure with no tokens', failedTry?.succeeded === false && failedTry.inputTokens === 0 && failedTry.outputTokens === 0 && failedTry.costMicros === 0, JSON.stringify(failedTry));
    check('…and the answer under GPT-6 Luna, at its paid rate', answeredTry?.model === 'gpt-6-luna' && answeredTry.succeeded && answeredTry.inputTokens === 40 && answeredTry.outputTokens === 25 && answeredTry.costMicros > 0, JSON.stringify(answeredTry));
    const geminiAfter = await counted('gemini', 'gemini-reply-test');
    const lunaAfter = await counted('openai', 'gpt-6-luna');
    check('the token calculator counted the model that answered (40 in, 25 out, 1 call)',
      lunaAfter.inputTokens - lunaBefore.inputTokens === 40 && lunaAfter.outputTokens - lunaBefore.outputTokens === 25 && lunaAfter.calls - lunaBefore.calls === 1, JSON.stringify(lunaAfter));
    check('…and nothing for the one that failed before it answered', geminiAfter.calls === geminiBefore.calls && geminiAfter.inputTokens === geminiBefore.inputTokens);

    // — Words already sent cannot be taken back: a second engine does not start over
    failWith = 'cut';
    const openAiBefore = openAiSent.length;
    q = await ask('Cut off halfway through');
    failWith = null;
    const cut = last(q.s, 'error');
    check('a reply that broke off after some words stays with the engine that began it', q.tried === gemini && openAiSent.length === openAiBefore, q.tried);
    check('…the reader keeps those words and is told the reply was cut', text(q.s) === 'Half an ' && cut?.partial === true && cut.code === 'AI_FAILED', JSON.stringify(cut));

    // — Every engine fails: the reader hears about the first one, and is not charged
    failWith = { status: 503, body: 'overloaded: try again later' };
    openAiFails.set('*', { status: 404, body: '{"error":{"message":"The model gpt-6-luna does not exist"}}' });
    const chargedBefore = (await debits()).length;
    q = await ask('Asked while everything is down');
    failWith = null;
    openAiFails.clear();
    const down = last(q.s, 'error');
    check('both engines were tried, in order', q.tried === `${gemini} → openai:gpt-6-luna`, q.tried);
    check('the reader is told about the first one’s trouble (busy), not the last one’s', down?.code === 'AI_BUSY' && down.retryable === true, JSON.stringify(down));
    check('…in a fixed line, none of the providers’ words', /^Sakha/.test(down?.message) && !developerText.test(JSON.stringify(down)), JSON.stringify(down));
    check('nothing was charged and no reply was saved', (await debits()).length === chargedBefore && down?.partial === false && down?.messageId === null);
    const bothFailed = await logged(q.id);
    check('the usage log has both tries, as failures', bothFailed.length === 2 && bothFailed.every((row) => !row.succeeded && row.inputTokens === 0), JSON.stringify(bothFailed.map((row) => [row.provider, row.succeeded])));

    // — No last resort, or no key for it: the chain is the provider that is set, alone
    failWith = { status: 404, body: 'gone' };
    env.AI_FALLBACK_MODEL = '';
    q = await ask('Asked with no last resort');
    check('a blank AI_FALLBACK_MODEL turns the last resort off', q.tried === gemini && last(q.s, 'error')?.code === 'AI_FAILED', q.tried);
    env.AI_FALLBACK_MODEL = 'gpt-6-luna';
    env.OPENAI_API_KEY = '';
    q = await ask('Asked with no key');
    check('…and so does having no OpenAI key: it is not even asked', q.tried === gemini && last(q.s, 'error')?.code === 'AI_FAILED', q.tried);
    env.OPENAI_API_KEY = 'fake-openai-key';
    failWith = null;

    // — The free tier, switched on from the panel
    let r = await call('PUT', '/admin/ai/free-tier', { token: reader.token, body: { enabled: true } });
    check('a reader cannot touch the switch', r.status === 403, String(r.status));
    r = await call('GET', '/admin/ai/free-tier', { token: reader.token });
    check('…or read it', r.status === 403, String(r.status));
    r = await setFreeTier({ textModel: 'gpt-6-luna' });
    check('a model that is not in a free pool is refused', r.status === 400, `${r.status} ${JSON.stringify(r.json?.error)}`);
    r = await setFreeTier({ enabled: true, textModel: 'gpt-4o-mini', translationModel: 'gpt-4.1-mini', bonusPoolTokens: 0 });
    check('an admin switches the free tier on and picks its models', r.status === 200 && r.json.data.enabled === true && r.json.data.models.text === 'gpt-4o-mini' && r.json.data.models.translation === 'gpt-4.1-mini', JSON.stringify(r.json?.data?.models));
    check('…and the change is in the audit log', !!(await prisma.auditLog.findFirst({ where: { actorId: admin.user.id, action: 'ai.free-tier.update' } })));
    let state = await panel();
    check('the panel lists the engines as they would be tried now', chain(state.now.chat) === 'OPENAI gpt-4o-mini free-tier → GEMINI gemini-reply-test settings → OPENAI gpt-6-luna fallback', chain(state.now.chat));
    check('…and translations on the free model while there is room', state.now.translation.onFreeTier === true && state.now.translation.model === 'gpt-4.1-mini' && state.now.translation.reason === null, JSON.stringify(state.now.translation));

    // — On, the free model goes first, and costs nothing
    openAiReply = ['Served with care.'];
    const miniBefore = await counted('openai', 'gpt-4o-mini');
    q = await ask('Asked on the free tier');
    check('the free model answers first, and alone', q.tried === 'openai:gpt-4o-mini' && text(q.s) === 'Served with care.', q.tried);
    check('…and is the model saved on the message', (await modelOf(q.s)) === 'gpt-4o-mini');
    check('the reader’s credits are charged as always (40 + 25)', (await debits()).at(-1) === 65);
    const freeTry = (await logged(q.id)).find((row) => row.provider === 'OPENAI');
    check('the usage log has it at no cost to us', freeTry?.model === 'gpt-4o-mini' && freeTry.succeeded && freeTry.inputTokens === 40 && freeTry.outputTokens === 25 && freeTry.costMicros === 0, JSON.stringify(freeTry));
    const miniAfter = await counted('openai', 'gpt-4o-mini');
    check('the calculator counts it against the free pool (40 in, 25 out, 1 call)',
      miniAfter.inputTokens - miniBefore.inputTokens === 40 && miniAfter.outputTokens - miniBefore.outputTokens === 25 && miniAfter.calls - miniBefore.calls === 1, JSON.stringify(miniAfter));
    state = await panel();
    const pool = state.pools.find((p) => p.id === 'mini');
    check('the panel shows the pool, what is used of it and where the app stops', pool?.used === 65 && pool.limit === 2_500_000 && pool.cap === capOf('mini'), JSON.stringify(pool));
    check('…and the day’s count model by model, each against its pool',
      state.usage.some((row) => row.provider === 'openai' && row.model === 'gpt-4o-mini' && row.pool === 'mini' && row.inputTokens === 40)
      && state.usage.some((row) => row.provider === 'gemini' && row.model === 'gemini-reply-test' && row.pool === null)
      && state.usage.some((row) => row.provider === 'openai' && row.model === 'gpt-6-luna' && row.pool === null));

    // — The free model is busy: the provider that is set takes over …
    openAiFails.set('gpt-4o-mini', { status: 429, body: 'rate limit reached for gpt-4o-mini' });
    reply = ['Answered by the provider that is set.'];
    q = await ask('Asked while the free model is busy');
    check('the free model is tried, then the provider that is set', q.tried === `openai:gpt-4o-mini → ${gemini}`, q.tried);
    check('…which answers, and is the model saved', text(q.s) === 'Answered by the provider that is set.' && (await modelOf(q.s)) === 'gemini-reply-test');
    check('…charged at what it reported (30 + 20)', (await debits()).at(-1) === 50);

    // — … and when that is down too, GPT-6 Luna finishes the job
    failWith = { status: 503, body: 'overloaded' };
    openAiReply = ['Finished by the last resort.'];
    q = await ask('Asked while both are down');
    failWith = null;
    openAiFails.clear();
    check('the free model, then the provider that is set, then GPT-6 Luna', q.tried === `openai:gpt-4o-mini → ${gemini} → openai:gpt-6-luna`, q.tried);
    check('…and the reader still gets an answer', text(q.s) === 'Finished by the last resort.' && (await modelOf(q.s)) === 'gpt-6-luna');

    // — The day’s free tokens are spent: the free model is skipped
    const cap = capOf('mini');
    await redis.hincrby(tally.keyOf(), 'openai|gpt-4o-mini|in', cap);
    reply = ['Answered once the free tokens were spent.'];
    q = await ask('Asked after the free tokens ran out');
    check('the free model is not tried', q.tried === gemini && text(q.s) === 'Answered once the free tokens were spent.', q.tried);
    state = await panel();
    check('the panel says so: the chain starts at the provider that is set', chain(state.now.chat) === 'GEMINI gemini-reply-test settings → OPENAI gpt-6-luna fallback', chain(state.now.chat));
    check('…and translations are back on their own model', state.now.translation.onFreeTier === false && state.now.translation.reason === 'spent' && state.now.translation.model === state.now.translation.paidModel, JSON.stringify(state.now.translation));
    check('…and the pool reads as full', state.pools.find((p) => p.id === 'mini').used >= cap);
    failWith = { status: 404, body: 'gone' };
    openAiReply = ['Spent, and the provider down.'];
    q = await ask('Asked when the free tokens and the provider are both gone');
    failWith = null;
    check('with the free tokens spent and the provider down, GPT-6 Luna answers', q.tried === `${gemini} → openai:gpt-6-luna` && text(q.s) === 'Spent, and the provider down.' && (await modelOf(q.s)) === 'gpt-6-luna', q.tried);
    await redis.hincrby(tally.keyOf(), 'openai|gpt-4o-mini|in', -cap);

    // — Switched off, the free model is not used even though the day’s tokens are not spent
    r = await setFreeTier({ enabled: false });
    check('an admin switches the free tier off', r.status === 200 && r.json.data.enabled === false);
    reply = ['Answered with the switch off.'];
    q = await ask('Asked with the switch off');
    check('the free model is not tried', q.tried === gemini, q.tried);
    state = await panel();
    check('the panel says so: no free model in the chain, translations on their own', chain(state.now.chat) === 'GEMINI gemini-reply-test settings → OPENAI gpt-6-luna fallback' && state.now.translation.onFreeTier === false && state.now.translation.reason === 'off', JSON.stringify(state.now.translation));

    // — The stronger model never borrows the free tier, and still has the last resort behind it
    await setFreeTier({ enabled: true });
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'ADVANCED' } });
    wallet.clearAllowanceCache();
    reply = ['Answered by the stronger model.'];
    q = await ask('Asked on the stronger model');
    check('the free tier is left out though it is on', q.tried === 'gemini:gemini-advanced-test', q.tried);
    failWith = { status: 503, body: 'overloaded' };
    q = await ask('Asked on the stronger model while it is down');
    failWith = null;
    check('…but GPT-6 Luna still stands behind it', q.tried === 'gemini:gemini-advanced-test → openai:gpt-6-luna', q.tried);
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { modelTier: 'BASIC' } });
    wallet.clearAllowanceCache();

    // — The page that edits Sakha shows the same chains
    r = await call('GET', '/admin/chat/settings', { token: admin.token });
    const engines = r.json?.data?.engines;
    check('the Ask Sakha page lists the engines for replies, the stronger tier and summaries',
      chain(engines?.text ?? []) === 'OPENAI gpt-4o-mini free-tier → GEMINI gemini-reply-test settings → OPENAI gpt-6-luna fallback'
      && chain(engines?.advanced ?? []) === 'GEMINI gemini-advanced-test settings → OPENAI gpt-6-luna fallback'
      && chain(engines?.summary ?? []) === 'OPENAI gpt-4o-mini free-tier → GEMINI gemini-summary-test settings → OPENAI gpt-6-luna fallback',
      JSON.stringify(engines));

    // — The summary that tidies a long chat has the same chain
    await setFreeTier({ enabled: false });
    const summaryChat = (await call('POST', '/app/chat/conversations', { token: reader.token, body: {} })).json.data.id;
    for (let i = 0; i < 3; i += 1) {
      reply = [`r${i}`];
      await stream(`/app/chat/conversations/${summaryChat}/messages`, { token: reader.token, body: { content: `q${i}` } });
    }
    summaryFails = { status: 404, body: 'gone' };
    const from = trail.length;
    r = await call('POST', `/app/chat/conversations/${summaryChat}/compact`, { token: reader.token });
    summaryFails = null;
    check('a summary whose model is gone is written by GPT-6 Luna', r.status === 200 && r.json.data.compacted === true && trail.slice(from).join(' → ') === 'gemini:gemini-summary-test → openai:gpt-6-luna', trail.slice(from).join(' → '));
    check('…as a call that is not streamed, and that is the summary kept',
      openAiSent.at(-1).stream !== true && (await prisma.chatConversation.findUnique({ where: { id: summaryChat } })).contextSummary.includes('the OpenAI summary'));
    check('…charged at what it reported (120 + 30)', (await ledger(reader.user.id, { source: 'SUMMARIZATION' })).at(-1)?.tokens === 150);
  } finally {
    env.OPENAI_API_KEY = keyBefore;
    env.AI_FALLBACK_MODEL = fallbackBefore;
    failWith = null;
    summaryFails = null;
    openAiFails.clear();
  }
}

async function main() {
  const free = await prisma.subscriptionPlan.findFirst({ where: { isFree: true }, include: { aiConfig: true } });
  if (!free?.aiConfig) { console.error('\nNo free plan with an AI allowance. Run `npm run seed` first.\n'); process.exit(1); }
  const original = free.aiConfig;
  const settingsBefore = await prisma.appSetting.findMany({ where: { key: { in: SAVED_SETTINGS } } });
  const tallyBefore = await saveTally();

  const asha = await makeUser('asha');
  const bob = await makeUser('bob');
  const admin = await makeUser('admin', 'super_admin');

  try {
    // Whatever the database says about the AI, this run answers with Gemini, its own model, no free tier, and counts
    // from an empty tally — so the model names and the counts below are exact.
    await redis.del(tallyBefore.key);
    await settings.set(SETTING_KEYS.AI_PROVIDER, 'GEMINI');
    await settings.set(SETTING_KEYS.AI_MODEL_TEXT, 'gemini-reply-test');
    await settings.set(SETTING_KEYS.AI_FREE_TIER_ENABLED, 'false');
    await settings.set(SETTING_KEYS.CHAT_LIMITS, JSON.stringify({ appActions: 0 })); // the sections below count tokens; section 18 turns actions on

    console.log('\n1. Status — a meter, never tokens');
    let r = await call('GET', '/app/chat/status', { token: asha.token });
    check('200', r.status === 200);
    check('the description names no sampradaya or tradition as Sakha’s own', !/Vaishnava|Gaudiya|Shaiva|sampradaya|ISKCON/i.test(r.json.data.description));
    check('…introduces Sakha, and does not label it AI or an assistant', /Sakha/.test(r.json.data.description) && !/\bAI\b|assistant/i.test(r.json.data.description));
    check('…but says plainly that Sakha is not a person', /not a person/.test(r.json.data.description));
    check('level name from the plan', r.json.data.credits.levelName === original.levelName);
    check('100% for a new user', r.json.data.credits.percent === 100);
    check('no token numbers anywhere in the response', !/balance|allocation|token/i.test(JSON.stringify(r.json.data.credits)));
    check('a wallet was created with the plan’s allowance', (await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } }))?.balance === original.walletTokens);
    check('…and the starting credit is in the ledger', (await ledger(asha.user.id))[0]?.source === 'PLAN_RENEWAL');

    console.log('\n2. A conversation and a streamed reply');
    r = await call('POST', '/app/chat/conversations', { token: asha.token, body: {} });
    const convId = r.json.data.id;
    check('created', r.status === 201 && r.json.data.title === 'New chat');

    let s = await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: 'What is bhakti?' } });
    check('events arrive in order: meta, delta…, done', s.events[0].name === 'meta' && s.events.at(-1).name === 'done' && s.events.some((e) => e.name === 'delta'));
    check('tokens arrive piece by piece', s.events.filter((e) => e.name === 'delta').length === 2);
    check('the text is the provider’s', text(s) === 'Namaste. Bhakti is loving service.');
    check('the chat is titled from the first message', last(s, 'meta').conversation.title === 'What is bhakti?');
    check('the system prompt is the persona', sent.at(-1).body.systemInstruction.parts[0].text.includes('Vaishnava bhakti'));
    check('…which keeps the sampradaya out of what readers hear, yet never denies it', /do not name a sampradaya/.test(sent.at(-1).body.systemInstruction.parts[0].text) && /never hide or deny it/.test(sent.at(-1).body.systemInstruction.parts[0].text));
    check('…and invites gently — no pressure, no talk of conversion', /You invite; you never push/.test(sent.at(-1).body.systemInstruction.parts[0].text) && /do not use the language of conversion/.test(sent.at(-1).body.systemInstruction.parts[0].text));
    check('…which is Sakha, who never claims to be a person', /You are Sakha/.test(sent.at(-1).body.systemInstruction.parts[0].text) && /not a person/.test(sent.at(-1).body.systemInstruction.parts[0].text));
    check('the key is not sent in the URL', !sent.at(-1).url.includes('fake-key'));
    check('the reply came from the model the Settings page names', sent.at(-1).url.includes('gemini-reply-test') && trail.join() === 'gemini:gemini-reply-test', trail.join());
    const answered = await prisma.chatMessage.findUnique({ where: { id: last(s, 'done').message.id } });
    check('…which is the model saved on the message', answered.model === 'gemini-reply-test', String(answered.model));
    const gemini1 = (await tally.today()).find((row) => row.provider === 'gemini' && row.model === 'gemini-reply-test');
    check('the token calculator counted the call under that provider and model (30 in, 20 out, 1 call)',
      gemini1?.inputTokens === 30 && gemini1.outputTokens === 20 && gemini1.calls === 1, JSON.stringify(gemini1));

    const debits = await ledger(asha.user.id, { type: 'DEBIT' });
    check('exactly the provider’s reported tokens were debited (30 + 20)', debits.length === 1 && debits[0].tokens === 50 && debits[0].source === 'CHAT');
    check('the debit points at the assistant message', debits[0].referenceId === last(s, 'done').message.id);
    check('the usage log has the call, with tokens and the user', !!(await prisma.aiUsageLog.findFirst({ where: { userId: asha.user.id, operation: 'chat.reply', inputTokens: 30, outputTokens: 20 } })));
    check('done carries the new meter', typeof last(s, 'done').credits.percent === 'number');
    const daily = await prisma.aiDailyUsage.findMany({ where: { userId: asha.user.id } });
    check('today’s usage is recorded under the local date', daily.length === 1 && daily[0].tokens === 50);

    console.log('\n3. Reading it back');
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    check('both messages, in order', r.json.data.messages.map((m) => m.role).join() === 'user,assistant');
    check('no token counts leak', !/tokenCount|inputTokens|outputTokens/.test(JSON.stringify(r.json.data)));
    r = await call('GET', '/app/chat/conversations', { token: asha.token });
    check('listed', r.json.data.length === 1);
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: bob.token });
    check('someone else’s chat is a 404', r.status === 404);
    r = await stream(`/app/chat/conversations/${convId}/messages`, { token: bob.token, body: { content: 'hi' } });
    check('…and cannot be written to', r.status === 404);

    console.log('\n4. Stopping a reply');
    reply = ['One ', 'two ', 'three ', 'four ', 'five'];
    slow = true;
    s = await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: 'Count for me' }, stopAfter: 2 });
    slow = false;
    await wait(1500);
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    const stopped = r.json.data.messages.at(-1);
    check('the partial text is kept, marked STOPPED', stopped.status === 'STOPPED' && stopped.content.startsWith('One two'), JSON.stringify(stopped));
    check('only some of it arrived', !stopped.content.includes('five'));
    check('the stopped reply was still charged', (await ledger(asha.user.id, { type: 'DEBIT', source: 'CHAT' })).length === 2);

    console.log('\n5. Regenerate');
    reply = ['A fresh answer.'];
    const before = (await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token })).json.data.messages.length;
    s = await stream(`/app/chat/conversations/${convId}/regenerate`, { token: asha.token });
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    check('the last answer is replaced, not added to', r.json.data.messages.length === before && r.json.data.messages.at(-1).content === 'A fresh answer.');
    check('the question was not asked twice', r.json.data.messages.filter((m) => m.content === 'Count for me').length === 1);

    console.log('\n6. Compaction');
    await prisma.chatConversation.update({ where: { id: convId }, data: { contextSummary: null } });
    const limitsNow = await call('GET', '/app/chat/status', { token: asha.token });
    const window = limitsNow.json.data ? 8 : 8;
    const loopEvents = [];
    for (let i = 0; i < window; i += 1) {
      reply = [`Answer ${i}.`];
      loopEvents.push(...(await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: `Question number ${i} about japa` } })).events);
    }
    await settled(convId);
    check('a reply never says it is compacting: that happens after it', !loopEvents.some((e) => e.name === 'status'));
    const conv = await prisma.chatConversation.findUnique({ where: { id: convId } });
    check('older messages were folded into a summary', !!conv.contextSummary && conv.summarizedThroughSeq > 0);
    check('the summary keeps the person’s details (from the summarizer)', /Asha/.test(conv.contextSummary));
    const summaries = await ledger(asha.user.id, { source: 'SUMMARIZATION' });
    check('the summarization was charged to the same wallet (200 + 40)', summaries.length >= 1 && summaries[0].tokens === 240);
    const summaryCall = sent.findLast((x) => !x.url.includes('streamGenerateContent'));
    check('summarization used the cheap model, not the reply model', summaryCall.url.includes('gemini-summary-test') && !summaryCall.url.includes('gemini-reply-test'), summaryCall.url);
    reply = ['ok'];
    await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: 'one more thing' } });
    const prompt = lastStream().body;
    const sentText = JSON.stringify(prompt);
    check('the next prompt carries the summary', prompt.systemInstruction.parts[0].text.includes('PERSON — Asha'));
    check('…and not the folded-away messages', !sentText.includes('Question number 0 about japa'));
    check('…but does carry the newest', sentText.includes('one more thing'));
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    check('folded messages are still in the conversation for display', r.json.data.messages.some((m) => m.content === 'Question number 0 about japa' && m.summarized === true));

    console.log('\n6b. The summary is written after the reply, not before it');
    summaryDelay = 1500; // a summary that takes a second and a half; a reply that waited for it would show it
    const slowId = (await call('POST', '/app/chat/conversations', { token: asha.token, body: {} })).json.data.id;
    const callsBefore = summaryCalls();
    const took = [];
    for (let i = 0; i < 5; i += 1) { // the fifth makes ten messages, over the window of eight
      reply = [`Slow ${i}.`];
      const t0 = Date.now();
      await stream(`/app/chat/conversations/${slowId}/messages`, { token: asha.token, body: { content: `Slow question ${i}` } });
      took.push(Date.now() - t0);
    }
    check('the reply that outgrew the window was not held up by the summary', took[4] < 1000, `${took[4]} ms against a 1500 ms summary`);
    check('…which is being written now, after it', !!(await redis.get(`chat:compact:${slowId}`)));
    reply = ['Slow 5.'];
    s = await stream(`/app/chat/conversations/${slowId}/messages`, { token: asha.token, body: { content: 'Asked while the summary is being written' } });
    check('the next message goes straight through, not refused for a summary under way', !!last(s, 'done') && !s.events.some((e) => e.name === 'status'));
    check('…using the summary as it stood: not there yet', !lastStream().body.systemInstruction.parts[0].text.includes('PERSON — Asha') && (await prisma.chatConversation.findUnique({ where: { id: slowId } })).summarizedThroughSeq === 0);
    check('…and the second reply did not start a second summary beside the first', summaryCalls() - callsBefore === 1, String(summaryCalls() - callsBefore));
    const askedAt = Date.now();
    r = await call('POST', `/app/chat/conversations/${slowId}/compact`, { token: asha.token });
    check('a reader’s own request to tidy waits for the one under way, then does its own', r.status === 200 && r.json.data.compacted === true && Date.now() - askedAt > 1200, `${Date.now() - askedAt} ms`);
    await settled(slowId);
    const slowConv = await prisma.chatConversation.findUnique({ where: { id: slowId } });
    check('the summary landed, with the messages it covers marked folded', !!slowConv.contextSummary && slowConv.summarizedThroughSeq > 0);
    check('…and the lock is released', !(await redis.get(`chat:compact:${slowId}`)));
    summaryDelay = 0;

    console.log('\n7. Manual compaction');
    const fresh = (await call('POST', '/app/chat/conversations', { token: asha.token, body: {} })).json.data.id;
    for (let i = 0; i < 3; i += 1) { reply = [`r${i}`]; await stream(`/app/chat/conversations/${fresh}/messages`, { token: asha.token, body: { content: `q${i}` } }); }
    r = await call('POST', `/app/chat/conversations/${fresh}/compact`, { token: asha.token });
    check('compacted on request', r.status === 200 && r.json.data.compacted === true && r.json.data.conversation.hasSummary === true);
    r = await call('POST', `/app/chat/conversations/${fresh}/compact`, { token: asha.token });
    check('nothing left worth compacting the second time', r.json.data.compacted === false);

    console.log('\n8. Conversation limits, and carrying on in a new chat');
    await prisma.chatConversation.update({ where: { id: convId }, data: { messageCount: 120 } });
    r = await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: 'more?' } });
    check('409 CONVERSATION_LIMIT with a way forward', r.status === 409 && r.json.error.code === 'CONVERSATION_LIMIT' && r.json.error.details.canContinue === true);
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    check('the conversation reports it is full', r.json.data.limitReached === 'MESSAGES');
    r = await call('POST', `/app/chat/conversations/${convId}/continue`, { token: asha.token });
    const next = r.json.data.conversation;
    check('a new chat starts', r.status === 201 && next.id !== convId && next.carriedFromId === convId && next.hasSummary === true);
    reply = ['Welcome back.'];
    s = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'Where were we?' } });
    check('the new chat’s first prompt includes the carried summary', lastStream().body.systemInstruction.parts[0].text.includes('PERSON — Asha'));

    console.log('\n9. The daily cap');
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { dailyTokens: 100 } });
    wallet.clearAllowanceCache();
    r = await call('GET', '/app/chat/status', { token: asha.token });
    check('the meter shows the daily cap is spent', r.json.data.credits.exhausted === true && r.json.data.credits.limitedBy === 'daily' && r.json.data.credits.percent === 0);
    const calls = sent.length;
    r = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'again' } });
    check('402 CREDITS_EXHAUSTED with an upgrade hint', r.status === 402 && r.json.error.code === 'CREDITS_EXHAUSTED' && r.json.error.details.limitedBy === 'daily' && 'canUpgrade' in r.json.error.details);
    check('the provider was never contacted', sent.length === calls);
    check('the friendly message mentions the refill', /midnight/.test(r.json.error.message));
    await prisma.aiDailyUsage.updateMany({ where: { userId: asha.user.id }, data: { date: '2020-01-01' } });
    r = await call('GET', '/app/chat/status', { token: asha.token });
    check('a new local day lifts the cap with no job', r.json.data.credits.exhausted === false);

    console.log('\n9b. The ledger adds up');
    const rows = await ledger(asha.user.id);
    const net = rows.reduce((sum, t) => sum + (t.type === 'CREDIT' ? t.tokens : -t.tokens), 0);
    const w = await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } });
    check('wallet balance equals the sum of its ledger', net === w.balance, `${net} vs ${w.balance}`);

    console.log('\n10. The wallet running dry');
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { dailyTokens: 0 } });
    wallet.clearAllowanceCache();
    await prisma.aiWallet.update({ where: { userId: asha.user.id }, data: { balance: 10 } });
    r = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'again' } });
    check('402 when the wallet cannot cover the prompt', r.status === 402 && r.json.error.details.limitedBy === 'wallet');
    r = await call('GET', '/app/chat/status', { token: asha.token });
    check('the meter reads nearly empty', r.json.data.credits.percent === 0 && r.json.data.credits.exhausted === false);

    console.log('\n11. Admin: grant, adjust, allowance, persona');
    r = await call('GET', '/app/chat/status', { token: bob.token });
    r = await call('POST', `/admin/chat/users/${asha.user.id}/grant`, { token: asha.token, body: { tokens: 1000, note: 'x' } });
    check('a normal user cannot reach the admin endpoints', r.status === 403);
    r = await call('POST', `/admin/chat/users/${asha.user.id}/grant`, { token: admin.token, body: { tokens: 5000, note: 'Blessing for Ekadashi' } });
    check('grant adds tokens', r.status === 200 && r.json.data.balance === 5010);
    check('…as an ADMIN_GRANT ledger row naming the admin', !!(await prisma.aiWalletTransaction.findFirst({ where: { userId: asha.user.id, source: 'ADMIN_GRANT', createdById: admin.user.id, tokens: 5000 } })));
    r = await call('POST', `/admin/chat/users/${asha.user.id}/adjust`, { token: admin.token, body: { tokens: -10, note: 'correction' } });
    check('adjust can take tokens away', r.json.data.balance === 5000);
    r = await call('GET', `/admin/chat/users/${asha.user.id}`, { token: admin.token });
    check('the admin sees raw numbers and the ledger', r.json.data.wallet.balance === 5000 && r.json.data.transactions.length > 5);
    reply = ['Back in business.'];
    s = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'thank you' } });
    check('after a grant, chat works again', s.events.at(-1)?.name === 'done');

    r = await call('PUT', `/admin/chat/plans/${free.id}`, { token: admin.token, body: { levelName: original.levelName, isEnabled: true, dailyTokens: 6000, walletTokens: 90000, renewal: 'MONTHLY', conversationTokens: 20000, modelTier: 'ADVANCED' } });
    check('allowances can be edited', r.status === 200);
    reply = ['advanced'];
    await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'which model?' } });
    check('the model tier takes effect at once, with no deploy', lastStream().url.includes('gemini-advanced-test'));
    check('raising the wallet credited the difference', !!(await prisma.aiWalletTransaction.findFirst({ where: { userId: asha.user.id, source: 'PLAN_RENEWAL', note: 'Allowance raised' } })));

    r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { systemPrompt: 'You are a test persona.', limits: { recentMessages: 8, compactAtTokens: 3000, keepRecentOnCompact: 4, summaryMaxTokens: 450, maxMessages: 120, maxOutputTokens: 1200, maxInputChars: 4000, appActions: 0 } } });
    check('the persona can be edited', r.status === 200);
    await new Promise((res) => setTimeout(res, 50));
    await redis.del('setting:chat.system_prompt');
    reply = ['persona'];
    await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'who are you?' } });
    check('…and is used on the next message', lastStream().body.systemInstruction.parts[0].text.startsWith('You are a test persona.'));
    r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { systemPrompt: '' } });
    check('an empty persona restores the default', /Vaishnava bhakti/.test(r.json.data.systemPrompt) && /You are Sakha/.test(r.json.data.systemPrompt));

    console.log('\n12. Renewal');
    await prisma.aiWallet.update({ where: { userId: asha.user.id }, data: { balance: 100, periodEnd: new Date(Date.now() - 1000) } });
    const result = await wallet.renewDue();
    const renewed = await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } });
    check('the scheduled job tops an ended period back up to the allocation', result.renewed >= 1 && renewed.balance === renewed.allocation && renewed.periodEnd > new Date());

    console.log('\n13. When the provider fails — a fixed line and a code, never the provider’s words');
    // Everything below is what a provider, or our own code, might say. None of it may reach the app.
    const developerText = /gemini|models\/|no longer available|v1beta|fetch failed|terminated|quota|overloaded|budget|configured/i;
    // Replies only: a long chat may fold older messages into its summary first, and that is charged on its own.
    const debitsBefore = (await ledger(asha.user.id, { type: 'DEBIT', source: 'CHAT' })).length;
    for (const [name, how, code] of [
      ['a busy provider (503)', { status: 503, body: 'overloaded: try again later (gemini-2.0-flash)' }, 'AI_BUSY'],
      ['a rate limit (429)', { status: 429, body: '{"error":{"message":"Resource exhausted: quota for gemini-2.0-flash"}}' }, 'AI_BUSY'],
      ['a retired model (404)', { status: 404, body: '{"error":{"code":404,"message":"models/gemini-2.0-flash is no longer available to new users"}}' }, 'AI_FAILED'],
      ['a connection that drops before any answer', 'drop', 'AI_FAILED'],
    ]) {
      failWith = how;
      s = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: `Asked while ${name}` } });
      failWith = null;
      const error = last(s, 'error');
      check(`${name}: the stream ends with an error event`, s.events.at(-1)?.name === 'error' && !s.events.some((e) => e.name === 'done'));
      check('…reported as a code the app maps', error?.code === code, JSON.stringify(error));
      check('…that can be retried, in a line that names Sakha', error?.retryable === true && /^Sakha/.test(error.message), error?.message);
      check('…carrying nothing the provider said, and no details', !developerText.test(JSON.stringify(error)) && !('details' in error), JSON.stringify(error));
      check('…with no reply saved to the chat', error?.partial === false && error?.messageId === null);
    }
    check('none of those failures was charged', (await ledger(asha.user.id, { type: 'DEBIT', source: 'CHAT' })).length === debitsBefore);
    r = await call('GET', `/app/chat/conversations/${next.id}`, { token: asha.token });
    check('the question is kept for a retry, with no empty reply after it', r.json.data.messages.at(-1).role === 'user' && r.json.data.messages.at(-1).content.startsWith('Asked while a connection'));
    reply = ['Here again.'];
    s = await stream(`/app/chat/conversations/${next.id}/regenerate`, { token: asha.token });
    check('asking again then works', s.events.at(-1)?.name === 'done' && text(s) === 'Here again.');

    failWith = 'cut';
    s = await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'Cut off halfway' } });
    failWith = null;
    const cut = last(s, 'error');
    check('a reply cut off halfway keeps what arrived', text(s) === 'Half an ' && cut?.partial === true && !!cut.messageId, JSON.stringify(cut));
    check('…and is still reported as a failed reply, in a fixed line', cut?.code === 'AI_FAILED' && /^Sakha/.test(cut.message) && !developerText.test(JSON.stringify(cut)));
    r = await call('GET', `/app/chat/conversations/${next.id}`, { token: asha.token });
    check('…saved as a partial reply', r.json.data.messages.at(-1).status === 'PARTIAL' && r.json.data.messages.at(-1).content === 'Half an ');

    console.log('\n14. One conversation — what the app opens, and clearing it');
    const newest = await prisma.chatConversation.findFirst({ where: { userId: asha.user.id }, orderBy: { lastMessageAt: 'desc' } });
    r = await call('GET', '/app/chat/current', { token: asha.token });
    check('/current is the conversation with the latest activity', r.status === 200 && r.json.data?.id === newest.id);
    check('…with its messages, shaped like /conversations/:id', r.json.data.messages.length > 0 && 'limitReached' in r.json.data && r.json.data.messages[0].role);
    r = await call('GET', '/app/chat/current', { token: bob.token });
    check('a reader who has said nothing yet gets null, not an error', r.status === 200 && r.json.data === null);

    reply = ['Still here.'];
    s = await stream(`/app/chat/conversations/${newest.id}/messages`, { token: asha.token, body: { content: 'Do you remember me?' } });
    check('before clearing, what Sakha remembers goes into the prompt', last(s, 'done') && JSON.stringify(lastStream().body).includes('prefers Hindi'));

    reply = ['Namaste, friend.'];
    const bobChat = await stream(`/app/chat/conversations/${(await call('POST', '/app/chat/conversations', { token: bob.token, body: {} })).json.data.id}/messages`, { token: bob.token, body: { content: 'Hello' } });
    check('(another reader has a chat of their own)', last(bobChat, 'done'));

    await settled(newest.id); // a summary still being written would move the balance under the check below
    const balanceBefore = (await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } })).balance;
    const ledgerBefore = (await ledger(asha.user.id)).length;
    await redis.set(`chat:lock:${asha.user.id}`, '1', 'EX', 30);
    r = await call('DELETE', '/app/chat/conversations', { token: asha.token });
    await redis.del(`chat:lock:${asha.user.id}`);
    check('clearing waits while a reply is being written', r.status === 409 && (await prisma.chatConversation.count({ where: { userId: asha.user.id } })) > 0);

    r = await call('DELETE', '/app/chat/conversations', { token: asha.token });
    check('clearing answers 204', r.status === 204);
    check('every conversation of theirs is gone, not just the newest', (await prisma.chatConversation.count({ where: { userId: asha.user.id } })) === 0);
    check('…and every message with them', (await prisma.chatMessage.count({ where: { conversation: { userId: asha.user.id } } })) === 0);
    check('another reader’s chat is untouched', (await prisma.chatConversation.count({ where: { userId: bob.user.id } })) === 1);
    check('credits already spent are not returned, and the ledger keeps its history',
      (await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } })).balance === balanceBefore && (await ledger(asha.user.id)).length === ledgerBefore);
    r = await call('GET', '/app/chat/current', { token: asha.token });
    check('the app opens an empty chat afterwards', r.status === 200 && r.json.data === null);

    reply = ['A fresh start.'];
    r = await call('POST', '/app/chat/conversations', { token: asha.token, body: {} });
    s = await stream(`/app/chat/conversations/${r.json.data.id}/messages`, { token: asha.token, body: { content: 'Hari Bol' } });
    check('a chat after clearing works', last(s, 'done') && text(s) === 'A fresh start.');
    check('…and Sakha has forgotten what it knew', !JSON.stringify(lastStream().body).includes('prefers Hindi'));

    await picturesSection({ admin, bob });
    await nameSection();
    await enginesSection({ admin, original });
    await actionsSection({ admin });
    await bonusSection({ admin, original });

  } finally {
    const everyone = [asha.user.id, bob.user.id, admin.user.id, ...spareUsers];
    await removePictures(everyone).catch((error) => console.error('could not remove the test pictures', error));
    await restoreSettings(settingsBefore).catch((error) => console.error('could not restore the settings', error));
    await restoreTally(tallyBefore).catch((error) => console.error('could not restore the token tally', error));
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { levelName: original.levelName, dailyTokens: original.dailyTokens, walletTokens: original.walletTokens, modelTier: original.modelTier } }).catch(() => null);
    await prisma.auditLog.deleteMany({ where: { actorId: { in: everyone }, action: 'ai.free-tier.update' } }).catch(() => null);
    await prisma.aiUsageLog.deleteMany({ where: { userId: { in: everyone } } }).catch(() => null); // the fake models' calls; the log has no foreign key to cascade
    await prisma.user.deleteMany({ where: { id: { in: everyone } } }).catch(() => null);
    wallet.clearAllowanceCache();
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  server.close();
  await prisma.$disconnect();
  redis.disconnect();
  process.exit(failed ? 1 : 0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
