// OpenAI, over its REST API. Present so that "swap the provider" is a setting
// change rather than a rewrite — the abstraction in index.js is only real if
// there is a second implementation behind it.

const env = require('../../config/env');
const { AppError } = require('../../utils/errors');

const BASE = 'https://api.openai.com/v1';

// USD per million tokens.
const PRICING = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};

const DEFAULT_PRICE = { input: 0.15, output: 0.6 };

function costMicros(model, inputTokens, outputTokens) {
  const price = PRICING[model] || DEFAULT_PRICE;
  return Math.round(inputTokens * price.input + outputTokens * price.output);
}

async function complete({ model, system, prompt, json = false, maxTokens = 1024, temperature = 0.4 }) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) throw new AppError(503, 'AI_UNAVAILABLE', 'OpenAI is not configured');

  const messages = [];
  if (system) messages.push({ role: 'system', content: system });
  messages.push({ role: 'user', content: prompt });

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
    throw new AppError(502, 'AI_FAILED', `OpenAI responded ${response.status}`, body.slice(0, 500));
  }

  const data = await response.json();
  return {
    text: data.choices?.[0]?.message?.content || '',
    inputTokens: data.usage?.prompt_tokens || 0,
    outputTokens: data.usage?.completion_tokens || 0,
  };
}

module.exports = { name: 'OPENAI', complete, costMicros, PRICING, defaultModel: env.OPENAI_MODEL };
