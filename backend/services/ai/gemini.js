// Gemini, over its REST API. Called through services/ai/index.js — nothing
// outside this directory requires this file.
//
// Plain fetch rather than the vendor SDK: the surface we use is two endpoints,
// and an SDK here would be a dependency to keep current for no benefit.

const env = require('../../config/env');
const { AppError } = require('../../utils/errors');

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

// USD-per-million × tokens lands directly in millionths of a dollar, which is
// exactly what AiUsageLog.costMicros stores — no float ever reaches the column.
function costMicros(model, inputTokens, outputTokens) {
  const price = PRICING[model] || DEFAULT_PRICE;
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}

async function complete({ model, system, prompt, json = false, maxTokens = 1024, temperature = 0.4 }) {
  const apiKey = env.GEMINI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'Gemini is not configured');

  const response = await fetch(`${BASE}/models/${model}:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: system ? { parts: [{ text: system }] } : undefined,
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
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
    throw new AppError(502, 'AI_FAILED', `Gemini responded ${response.status}`, body.slice(0, 500));
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const usage = data.usageMetadata || {};

  return {
    text,
    inputTokens: usage.promptTokenCount || 0,
    outputTokens: usage.candidatesTokenCount || 0,
  };
}

module.exports = { name: 'GEMINI', complete, costMicros, PRICING, defaultModel: env.GEMINI_MODEL };
