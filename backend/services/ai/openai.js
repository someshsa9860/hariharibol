// OpenAI, over its REST API. Present so that "swap the provider" is a setting
// change rather than a rewrite — the abstraction in index.js is only real if
// there is a second implementation behind it.

import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { parseSse } from './sse.js';

const BASE = 'https://api.openai.com/v1';

// USD per million tokens.
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

const DEFAULT_PRICE = { input: 0.15, output: 0.6 };

function failure(status, body) {
  const busy = status === 429 || status === 503;
  return new AppError(
    busy ? 503 : 502,
    busy ? 'AI_BUSY' : 'AI_FAILED',
    `OpenAI responded ${status}`,
    body.slice(0, 500)
  );
}

function costMicros(model, inputTokens, outputTokens) {
  const price = PRICING[model] || DEFAULT_PRICE;
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}

async function complete({ model, system, prompt, messages: history, json = false, maxTokens = 1024, temperature = 0.4 }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'OpenAI is not configured');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (history) messages.push(...history);
  else messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: json ? { type: 'json_object' } : undefined,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw failure(response.status, body);
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

/**
 * Stream a reply. Same contract as gemini.stream: `{ text }` pieces, then one
 * `{ done: true, inputTokens, outputTokens, finishReason }`.
 */
async function* stream({ model, system, messages: history, maxTokens = 1024, temperature = 0.6, signal }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'OpenAI is not configured');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push(...history);

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_completion_tokens: maxTokens,
      stream: true,
      // Without this the stream carries no token counts at all.
      stream_options: { include_usage: true },
    }),
  });
  if (!response.ok) throw failure(response.status, await response.text());

  let inputTokens = 0;
  let outputTokens = 0;
  let finishReason = null;

  for await (const event of parseSse(response.body)) {
    if (event.data === '[DONE]') break;
    let data;
    try {
      data = JSON.parse(event.data);
    } catch {
      continue;
    }
    if (data.error) throw new AppError(502, 'AI_FAILED', data.error.message || 'OpenAI stream error');

    const choice = data.choices?.[0];
    const text = choice?.delta?.content;
    if (text) yield { text };
    if (choice?.finish_reason) finishReason = choice.finish_reason;

    if (data.usage) {
      inputTokens = data.usage.prompt_tokens || 0;
      outputTokens = data.usage.completion_tokens || 0;
    }
  }

  yield { done: true, inputTokens, outputTokens, finishReason };
}

export const name = 'OPENAI';
export const defaultModel = env.OPENAI_MODEL;
export const summaryModel = env.OPENAI_SUMMARY_MODEL;
export const advancedModel = env.OPENAI_ADVANCED_MODEL || env.OPENAI_MODEL;
export { complete, stream, costMicros, PRICING };
