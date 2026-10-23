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
    knownModels: anthropic.KNOWN_MODELS,
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
    knownModels: openai.KNOWN_MODELS,
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
    knownModels: gemini.KNOWN_MODELS,
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

/**
 * Can `model` run a translation-style request (no thinking) on this provider? → `null` when it can, else the reason.
 * The admin pages ask this before a run is queued, so a model that would fail on its first request is refused up front.
 */
export function whyNotUsable(provider, model) {
  try {
    providerOf(provider).check(model, 'off');
    return null;
  } catch (err) {
    return err.message;
  }
}

/**
 * The providers an admin page offers, each with the models it can pick from: the priced ones, plus the provider's
 * default and the model the server is set to use (which may not be priced). A model that cannot run without thinking is
 * listed with the reason, so the page can show it but not start a run on it.
 *
 * @param {{ apiKey: (provider: string) => string, model: (provider: string) => string }} server
 *   what this page's server side is configured with
 */
export function providerChoices({ apiKey, model }) {
  return PROVIDER_IDS.map((id) => {
    const p = PROVIDERS[id];
    const chosen = model(id);
    const known = new Map(p.knownModels.map((m) => [m.id, m]));
    for (const extra of [chosen, p.defaultModel]) if (!known.has(extra)) known.set(extra, { id: extra, inputPerMillion: null, outputPerMillion: null });
    return {
      id,
      label: p.label,
      company: p.company,
      keyEnv: p.keyEnv,
      apiKeyConfigured: Boolean(apiKey(id)),
      defaultModel: chosen,
      models: [...known.values()].map((m) => ({ ...m, unusableReason: whyNotUsable(id, m.id) })),
    };
  });
}
