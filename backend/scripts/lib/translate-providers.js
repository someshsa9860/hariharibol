// Which AI providers can translate, what each is called, which model it uses unless told otherwise, and how
// to build an `ask` for one. The one place that knows both; everything else asks by provider name.

import * as anthropic from './claude-translate-client.js';
import * as openai from './openai-translate-client.js';
import * as gemini from './gemini-translate-client.js';

// GPT-6 Luna is the default: on ten Tamil / Hindi / Marathi verses it beat Gemini Flash-Lite on all four parts, and
// its list price is a twentieth of Claude Sonnet's (about $0.9 for the whole Gita in one language).
// When a part needs more care, give it to Claude from the admin page or with `--provider anthropic`.
export const DEFAULT_PROVIDER = 'openai';

export const PROVIDERS = {
  anthropic: {
    label: 'Claude',
    company: 'Anthropic',
    defaultModel: anthropic.DEFAULT_MODEL,
    keyEnv: 'ANTHROPIC_API_KEY',
    modelEnv: 'ANTHROPIC_MODEL',
    costUsd: anthropic.costUsd,
    create: anthropic.createClaude,
    // Throws when the model cannot do what is asked at this effort (some Claude models cannot think "off").
    check: anthropic.thinkingSettings,
  },
  openai: {
    label: 'GPT',
    company: 'OpenAI',
    defaultModel: openai.DEFAULT_MODEL,
    keyEnv: 'OPENAI_API_KEY',
    modelEnv: 'TRANSLATION_OPENAI_MODEL',
    costUsd: openai.costUsd,
    create: openai.createOpenAI,
    check: (model, effort) => openai.reasoningEffort(effort),
  },
  gemini: {
    label: 'Gemini',
    company: 'Google',
    defaultModel: gemini.DEFAULT_MODEL,
    keyEnv: 'GEMINI_API_KEY',
    modelEnv: 'TRANSLATION_GEMINI_MODEL',
    costUsd: gemini.costUsd,
    create: gemini.createGemini,
    // Throws for a model that cannot think "off" (the Pro models).
    check: gemini.thinkingBudget,
  },
};

export const PROVIDER_IDS = Object.keys(PROVIDERS);

export function providerOf(id = DEFAULT_PROVIDER) {
  const p = PROVIDERS[id];
  if (!p) throw new Error(`Unknown provider "${id}" — use ${PROVIDER_IDS.join(' or ')}`);
  return p;
}

export const costFor = (provider, model, usage) => providerOf(provider).costUsd(model, usage);

/** `{ ask, model, effort }` for this provider; throws at once if the model cannot do what is asked. */
export function createAsk({ provider = DEFAULT_PROVIDER, ...options }) {
  const p = providerOf(provider);
  p.check(options.model || p.defaultModel, options.effort ?? 'off');
  return p.create({ ...options, model: options.model || p.defaultModel });
}
