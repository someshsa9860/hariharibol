// Gemini, over its REST API. Called through services/ai/index.js — nothing
// outside this directory requires this file.
//
// Plain fetch rather than the vendor SDK: the surface we use is two endpoints,
// and an SDK here would be a dependency to keep current for no benefit.

import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { parseSse } from './sse.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

// USD per million tokens, as published. Batch work is where the money goes, so
// these exist to make AiUsageLog.costMicros a real number rather than a guess.
// Update them when the price list changes — a stale table under-reports spend.
const PRICING = {
  'gemini-2.0-flash': { input: 0.075, output: 0.3 },
  'gemini-2.0-flash-lite': { input: 0.0375, output: 0.15 },
  'gemini-1.5-flash': { input: 0.075, output: 0.3 },
  'gemini-1.5-pro': { input: 1.25, output: 5 },
};

const DEFAULT_PRICE = { input: 0.075, output: 0.3 };

// Chat history is already `{ role: 'user' | 'assistant', content }`; Gemini calls the model "model".
const toContents = (messages) =>
  messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));

// Thinking models bill their reasoning as output, and report it separately.
const outputTokensOf = (usage) => (usage.candidatesTokenCount || 0) + (usage.thoughtsTokenCount || 0);

function failure(status, body) {
  const busy = status === 429 || status === 503;
  return new AppError(
    busy ? 503 : 502,
    busy ? 'AI_BUSY' : 'AI_FAILED',
    `Gemini responded ${status}`,
    body.slice(0, 500)
  );
}

// USD-per-million × tokens lands directly in millionths of a dollar, which is
// exactly what AiUsageLog.costMicros stores — no float ever reaches the column.
function costMicros(model, inputTokens, outputTokens) {
  const price = PRICING[model] || DEFAULT_PRICE;
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}

async function complete({ model, system, prompt, messages, json = false, maxTokens = 1024, temperature = 0.4 }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'Gemini is not configured');

  const response = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: messages ? toContents(messages) : [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
        // Asking for JSON at the API level beats asking for it in the prompt —
        // the model cannot then wrap the object in prose or a code fence.
        responseMimeType: json ? 'application/json' : 'text/plain',
      },
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw failure(response.status, body);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const usage = data.usageMetadata || {};

  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: outputTokensOf(usage),
  };
}

/**
 * Stream a reply. Yields `{ text }` pieces as they arrive, then one
 * `{ done: true, inputTokens, outputTokens, finishReason }`. Aborting `signal`
 * ends the request; the caller then has no usage from us and estimates it.
 */
async function* stream({ model, system, messages, maxTokens = 1024, temperature = 0.6, signal }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'Gemini is not configured');

  // The key goes in a header, not the URL, so it never lands in an access log.
  const response = await fetch(`${BASE}/models/${model}:streamGenerateContent?alt=sse`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    signal,
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: toContents(messages),
      generationConfig: { temperature, maxOutputTokens: maxTokens },
    }),
  });
  if (!response.ok) throw failure(response.status, await response.text());

  let inputTokens = 0;
  let outputTokens = 0;
  let finishReason = null;

  for await (const event of parseSse(response.body)) {
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      continue;
    }
    if (data.error) throw new AppError(502, 'AI_FAILED', data.error.message || 'Gemini stream error');
    if (data.promptFeedback?.blockReason) finishReason = 'blocked';

    const candidate = data.candidates?.[0];
    const text = candidate?.content?.parts?.map((p) => p.text || '').join('') || '';
    if (text) yield { text };
    if (candidate?.finishReason) finishReason = candidate.finishReason === 'STOP' ? 'stop' : candidate.finishReason.toLowerCase();

    // Cumulative: the last chunk that carries it is the total.
    if (data.usageMetadata) {
      inputTokens = data.usageMetadata.promptTokenCount || inputTokens;
      outputTokens = outputTokensOf(data.usageMetadata) || outputTokens;
    }
  }

  yield { done: true, inputTokens, outputTokens, finishReason };
}

// The shape services/ai/index.js expects of every provider: a name for the
// usage log, a completion call, a cost function and a default model.
export const name = 'GEMINI';
export const defaultModel = env.GEMINI_MODEL;
export const summaryModel = env.GEMINI_SUMMARY_MODEL;
export const advancedModel = env.GEMINI_ADVANCED_MODEL || env.GEMINI_MODEL;
export { complete, stream, costMicros, PRICING };
