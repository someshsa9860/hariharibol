// OpenAI, over its REST API. Present so that "swap the provider" is a setting
// change rather than a rewrite — the abstraction in index.js is only real if
// there is a second implementation behind it.

import env from '../../config/env.js';
import { AppError } from '../../utils/errors.js';
import { parseSse } from './sse.js';

const BASE = 'https://api.openai.com/v1';

// USD per million tokens. `reasoning` marks a model that thinks before it answers:
// those tokens are billed and reported as output, and the model takes different
// request parameters (see `tuning`). A model used here wants a row, for its price
// and for what it accepts; an unlisted one is priced as gpt-4o-mini and sent the
// classic parameters.
const PRICING = {
  'gpt-6-luna': { input: 0.1, output: 0.5, reasoning: true },
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

const DEFAULT_PRICE = { input: 0.15, output: 0.6 };

// The sampling parameters of a request. A reasoning model refuses every
// `temperature` but its own default unless it is told not to think, so it is
// sent the effort (`OPENAI_REASONING_EFFORT`, `none` unless set) and the
// temperature only alongside `none`. Every other model takes the temperature and
// would refuse an effort.
function tuning(model, temperature) {
  if (!PRICING[model]?.reasoning) return { temperature };
  const effort = env.OPENAI_REASONING_EFFORT;
  return effort === 'none' ? { reasoning_effort: effort, temperature } : { reasoning_effort: effort };
}

// A message as the API takes it: its words, or — when it carries `image: { mimeType, base64 }` — a list of the words
// and the picture as a data URL. Anything else on the message (the key it was fetched by) is left behind.
function toApiMessage(m) {
  if (!m.image) return { role: m.role, content: m.content };
  const parts = [];
  if (m.content) parts.push({ type: 'text', text: m.content });
  parts.push({ type: 'image_url', image_url: { url: `data:${m.image.mimeType};base64,${m.image.base64}` } });
  return { role: m.role, content: parts };
}

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

async function complete({ model, system, prompt, messages: history, json = false, maxTokens = 1024, temperature = 0.4, signal }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'OpenAI is not configured');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  if (history) messages.push(...history.map(toApiMessage));
  else messages.push({ role: 'user', content: prompt });

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      messages,
      ...tuning(model, temperature),
      // Not `max_tokens`: reasoning models refuse it, and for them this also bounds the thinking.
      max_completion_tokens: maxTokens,
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
  messages.push(...history.map(toApiMessage));

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    signal,
    body: JSON.stringify({
      model,
      messages,
      ...tuning(model, temperature),
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
// Whether a key is set — the engine chain in index.js leaves out a provider that could only answer "not configured".
export const isConfigured = () => Boolean(env.OPENAI_API_KEY);
export const defaultModel = env.OPENAI_MODEL;
export const summaryModel = env.OPENAI_SUMMARY_MODEL;
export const advancedModel = env.OPENAI_ADVANCED_MODEL || env.OPENAI_MODEL;
export { complete, stream, costMicros, PRICING };
