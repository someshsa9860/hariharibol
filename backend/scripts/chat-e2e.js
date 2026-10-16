// Walks AI chat end to end against the real database and the real app, with the
// AI provider faked:
//
//   npm run test:chat
//
// Needs Postgres and Redis (the usual .env) and a seeded database (`npm run seed`).
// It boots the API in this process on a free port and replaces `fetch` for the
// Gemini host with a scripted server, so no key and no network are needed. What
// it checks: the stream and its events, that exactly the provider's reported
// tokens are debited, the daily cap, stopping a reply, compaction and the prompt
// that follows it, regenerate, the conversation limit and carrying a summary into
// a new chat, and the admin panel's grant / allowance / persona endpoints.

process.env.NODE_ENV = 'test';
process.env.AI_PROVIDER = 'gemini';
process.env.GEMINI_API_KEY = 'fake-key';
process.env.GEMINI_ADVANCED_MODEL = 'gemini-advanced-test';

const { prisma } = await import('../config/database.js');
const { redis } = await import('../config/redis.js');
const authService = await import('../services/auth.js');
const wallet = await import('../services/ai-wallet.js');
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
const USAGE = { promptTokenCount: 30, candidatesTokenCount: 20 };

globalThis.fetch = async (url, init) => {
  if (!String(url).includes('generativelanguage.googleapis.com')) return realFetch(url, init);
  const body = JSON.parse(init.body);
  sent.push({ url: String(url), body });
  const enc = new TextEncoder();

  if (!String(url).includes('streamGenerateContent')) {
    // Summarization (non-streaming).
    return Response.json({
      candidates: [{ content: { parts: [{ text: 'PERSON — Asha, prefers Hindi.\nINTERESTS — Sri Vaishnava.\nPRACTICES — 16 rounds daily.' }] } }],
      usageMetadata: { promptTokenCount: 200, candidatesTokenCount: 40 },
    });
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

async function main() {
  const free = await prisma.subscriptionPlan.findFirst({ where: { isFree: true }, include: { aiConfig: true } });
  if (!free?.aiConfig) { console.error('\nNo free plan with an AI allowance. Run `npm run seed` first.\n'); process.exit(1); }
  const original = free.aiConfig;

  const asha = await makeUser('asha');
  const bob = await makeUser('bob');
  const admin = await makeUser('admin', 'super_admin');

  try {
    console.log('\n1. Status — a meter, never tokens');
    let r = await call('GET', '/app/chat/status', { token: asha.token });
    check('200', r.status === 200);
    check('the description states the Sri Vaishnava orientation', /Sri Vaishnava/.test(r.json.data.description));
    check('level name from the plan', r.json.data.credits.levelName === 'Jigyasu');
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
    check('the system prompt is the persona', sent.at(-1).body.systemInstruction.parts[0].text.includes('Sri Vaishnava'));
    check('the key is not sent in the URL', !sent.at(-1).url.includes('fake-key'));

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
    for (let i = 0; i < window; i += 1) {
      reply = [`Answer ${i}.`];
      await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: `Question number ${i} about japa` } });
    }
    const conv = await prisma.chatConversation.findUnique({ where: { id: convId } });
    check('older messages were folded into a summary', !!conv.contextSummary && conv.summarizedThroughSeq > 0);
    check('the summary keeps the person’s details (from the summarizer)', /Asha/.test(conv.contextSummary));
    const summaries = await ledger(asha.user.id, { source: 'SUMMARIZATION' });
    check('the summarization was charged to the same wallet (200 + 40)', summaries.length >= 1 && summaries[0].tokens === 240);
    const summaryCall = sent.findLast((x) => !x.url.includes('streamGenerateContent'));
    check('summarization used the cheap model', summaryCall.url.includes('gemini-2.0-flash-lite'));
    reply = ['ok'];
    await stream(`/app/chat/conversations/${convId}/messages`, { token: asha.token, body: { content: 'one more thing' } });
    const prompt = sent.at(-1).body;
    const sentText = JSON.stringify(prompt);
    check('the next prompt carries the summary', prompt.systemInstruction.parts[0].text.includes('PERSON — Asha'));
    check('…and not the folded-away messages', !sentText.includes('Question number 0 about japa'));
    check('…but does carry the newest', sentText.includes('one more thing'));
    r = await call('GET', `/app/chat/conversations/${convId}`, { token: asha.token });
    check('folded messages are still in the conversation for display', r.json.data.messages.some((m) => m.content === 'Question number 0 about japa' && m.summarized === true));

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
    check('the new chat’s first prompt includes the carried summary', sent.at(-1).body.systemInstruction.parts[0].text.includes('PERSON — Asha'));

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

    r = await call('PUT', `/admin/chat/plans/${free.id}`, { token: admin.token, body: { levelName: 'Jigyasu', isEnabled: true, dailyTokens: 6000, walletTokens: 90000, renewal: 'MONTHLY', conversationTokens: 20000, modelTier: 'ADVANCED' } });
    check('allowances can be edited', r.status === 200);
    reply = ['advanced'];
    await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'which model?' } });
    check('the model tier takes effect at once, with no deploy', sent.at(-1).url.includes('gemini-advanced-test'));
    check('raising the wallet credited the difference', !!(await prisma.aiWalletTransaction.findFirst({ where: { userId: asha.user.id, source: 'PLAN_RENEWAL', note: 'Allowance raised' } })));

    r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { systemPrompt: 'You are a test persona.', limits: { recentMessages: 8, compactAtTokens: 3000, keepRecentOnCompact: 4, summaryMaxTokens: 450, maxMessages: 120, maxOutputTokens: 1200, maxInputChars: 4000 } } });
    check('the persona can be edited', r.status === 200);
    await new Promise((res) => setTimeout(res, 50));
    await redis.del('setting:chat.system_prompt');
    reply = ['persona'];
    await stream(`/app/chat/conversations/${next.id}/messages`, { token: asha.token, body: { content: 'who are you?' } });
    check('…and is used on the next message', sent.at(-1).body.systemInstruction.parts[0].text.startsWith('You are a test persona.'));
    r = await call('PUT', '/admin/chat/settings', { token: admin.token, body: { systemPrompt: '' } });
    check('an empty persona restores the default', /Sri Vaishnava/.test(r.json.data.systemPrompt));

    console.log('\n12. Renewal');
    await prisma.aiWallet.update({ where: { userId: asha.user.id }, data: { balance: 100, periodEnd: new Date(Date.now() - 1000) } });
    const result = await wallet.renewDue();
    const renewed = await prisma.aiWallet.findUnique({ where: { userId: asha.user.id } });
    check('the scheduled job tops an ended period back up to the allocation', result.renewed >= 1 && renewed.balance === renewed.allocation && renewed.periodEnd > new Date());

  } finally {
    await prisma.aiPlanConfig.update({ where: { id: original.id }, data: { levelName: original.levelName, dailyTokens: original.dailyTokens, walletTokens: original.walletTokens, modelTier: original.modelTier } }).catch(() => null);
    await prisma.user.deleteMany({ where: { id: { in: [asha.user.id, bob.user.id, admin.user.id] } } }).catch(() => null);
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
