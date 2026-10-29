// Marketing copy written by a model, in the provider and model the admin chose: a template drafted from a brief, a variant
// translated into another language, and (AI_PER_USER) one reader's copy written from their context card.
//
// Everything a model returns is the same block list an admin writes (utils/marketing-blocks.js), checked by the same
// validator, so it cannot hold markup, an unknown merge field or a link slot that does not exist; an answer that fails is
// asked for again once with the problems named, then refused. A reader's chat with Sakha is never an input (see
// services/marketing-context.js).
//
// The calls go through `createAsk`, which bypasses the chat's OpenAI free-tier chain on purpose (the provider and model are
// the admin's choice) and logs nothing itself, so this file counts the tokens: in the token calculator for every provider,
// and in AiUsageLog (so Finance's AI cost line sees it) for the two providers that table can name.

import { prisma } from '../config/database.js';
import env from '../config/env.js';
import logger from '../config/logger.js';
import { languages as appLanguages } from '../config/etiquette.js';
import { marketing } from '../config/marketing.js';
import * as tally from './ai/token-tally.js';
import { PROVIDERS, PROVIDER_IDS, createAsk, costFor, providerOf, providerChoices, whyNotUsable } from '../scripts/lib/translate-providers.js';
import { BLOCKS_SCHEMA, MERGE_FIELDS, cleanModelBlocks, validateBlocks, validateLine, LIMITS } from '../utils/marketing-blocks.js';

export const LANGUAGES = [{ code: 'en', name: 'English', endonym: 'English' }, ...appLanguages.map(({ code, name, endonym }) => ({ code, name, endonym }))];
export const languageInfo = (code) => LANGUAGES.find((l) => l.code === code) ?? null;

export const defaultProvider = () => (PROVIDER_IDS.includes(marketing.provider) ? marketing.provider : 'openai');
export const apiKey = (provider = defaultProvider()) => env[providerOf(provider).keyEnv] || '';
export const modelFor = (provider = defaultProvider()) => env[providerOf(provider).modelEnv] || providerOf(provider).defaultModel;
export const providers = () => providerChoices({ apiKey, model: modelFor });

/** The 422 reason a start / generate is refused for, or null: no key, or a model that cannot run. */
export function whyNotRunnable(provider, model) {
  if (!PROVIDER_IDS.includes(provider)) return `"${provider}" is not an AI provider here.`;
  const info = PROVIDERS[provider];
  if (!apiKey(provider)) return `${info.keyEnv} is not set on the server, so ${info.company} cannot be called.`;
  const bad = whyNotUsable(provider, model);
  return bad ? `${model} cannot be used here: ${bad}` : null;
}

let injectedAsk = null;
/** A test hands in a fake `ask({ system, user, schema, maxTokens }) → { data, usage }`. Pass null to go back. */
export const useAsk = (fn) => {
  injectedAsk = fn;
};

const makeAsk = ({ provider, model, signal }) =>
  injectedAsk || createAsk({ provider, apiKey: apiKey(provider), model, effort: 'off', signal, onWait: () => {} }).ask;

/* ---------- the prompts ---------- */

const FIELD_LIST = Object.entries(MERGE_FIELDS).map(([k, v]) => `{{${k}|fallback}} — ${v.label}`).join('; ');

const RULES = `You write short emails for HariHariBol, an app where people read the Bhagavad-gita and Śrīmad-Bhāgavatam, chant mantras (japa) and talk with Sakha, a devotional friend. The readers are devotees and seekers, mostly in India.

Rules:
- Warm, respectful, plain words, in the voice of a kind friend, never a salesman. A short email: a heading, two or three short paragraphs, at most one verse, one button.
- Devotional content only. No comment on other faiths, no claims about health, money or miracles, no pressure, no fake urgency ("last chance", "only today"), no guilt about not chanting.
- Never name the sender's sampradaya. Say "Sakha" for the chat friend; never call it an AI, assistant or bot.
- Merge fields, written exactly {{name|fallback}} where the fallback is what to write when the reader has no value: ${FIELD_LIST}. Use only these. A fallback must read naturally in the language of the email. Do not invent other fields. Open with {{greeting}} (it already says "Hari Bol <name>").
- Blocks: heading (text, level 1 or 2), paragraph (text), verse (text, optional sanskrit, optional source), button (label, link: 1 for the main destination, 2 for a second), image (url, alt — only if the brief gives you a picture link), divider, spacer. Use "link": 1 on the main button. Never write a URL in any text; the buttons carry the links.
- Limits: subject ${LIMITS.subject} characters, preheader ${LIMITS.preheader}, heading ${LIMITS.heading}, paragraph ${LIMITS.paragraph}, button label ${LIMITS.button}.
- Write in the script of the language asked for. Keep Sanskrit and devotional terms (Kṛṣṇa, japa, mantra, prasāda, Gītā, Sakha) as devotees write them in that language.`;

const draftUser = ({ brief, tone, language }) =>
  [`Write the email in ${language.name} (${language.endonym}).`, tone ? `Tone: ${tone}.` : '', '', 'What the email is for:', brief, '', 'Return subject, preheader and blocks.'].filter((l, i, a) => l !== '' || a[i - 1] !== '').join('\n');

const translateUser = ({ variant, language }) =>
  [
    `Translate this email into ${language.name} (${language.endonym}). Keep the same blocks in the same order, the same merge fields (change only their fallbacks into ${language.name}) and the same link numbers.`,
    '',
    JSON.stringify({ subject: variant.subject, preheader: variant.preheader || '', blocks: variant.blocks }),
  ].join('\n');

const personalUser = ({ variant, card, language }) =>
  [
    `Write this reader's own email in ${language.name} (${language.endonym}). The brief below is what the campaign wants to say; use the reader's facts only where they make it more personal, never list them, and never mention that you know them. Leave out any fact that is missing. No merge fields: write the finished words, opening with the greeting given.`,
    '',
    `Greeting: ${card.greeting}`,
    `Reader: ${JSON.stringify(Object.fromEntries(Object.entries(card).filter(([k, v]) => k !== 'greeting' && v !== '')))}`,
    '',
    'Brief (an email to adapt):',
    JSON.stringify({ subject: variant.subject, preheader: variant.preheader || '', blocks: variant.blocks }),
    '',
    'Keep the same link numbers on buttons.',
  ].join('\n');

/* ---------- the loop shared by all three ---------- */

class CopyError extends Error {
  constructor(message, problems = []) {
    super(message);
    this.name = 'CopyError';
    this.problems = problems;
  }
}
export { CopyError };

function check(data, { allowFields }) {
  const subjectProblems = validateLine(data?.subject, LIMITS.subject, 'The subject');
  const preheaderProblems = validateLine(data?.preheader ?? '', LIMITS.preheader, 'The preheader', false);
  const { ok, blocks, errors } = validateBlocks(cleanModelBlocks(data?.blocks));
  const problems = [...subjectProblems, ...preheaderProblems, ...errors];
  if (!allowFields) {
    const joined = JSON.stringify(data ?? {});
    if (/\{\{/.test(joined)) problems.push('The copy still contains a {{ merge field }}; write the finished words.');
  }
  return { ok: ok && problems.length === 0, problems, copy: ok ? { subject: String(data.subject).trim(), preheader: String(data.preheader ?? '').trim(), blocks } : null };
}

async function record({ provider, model, operation, targetId, userId, usage, ok, errorMessage }) {
  const input = (usage?.inputTokens ?? 0) + (usage?.cacheReadTokens ?? 0) + (usage?.cacheWriteTokens ?? 0);
  const output = usage?.outputTokens ?? 0;
  const costMicros = Math.round(costFor(provider, model, usage || {}) * 1_000_000) || 0;
  await tally.record({ provider, model, inputTokens: input, outputTokens: output });
  if (provider === 'openai' || provider === 'gemini') {
    await prisma.aiUsageLog
      .create({ data: { provider: provider.toUpperCase(), model, operation, targetType: 'MarketingTemplate', targetId: targetId || null, userId: userId || null, inputTokens: input, outputTokens: output, costMicros, succeeded: ok, errorMessage: errorMessage ? String(errorMessage).slice(0, 500) : null } })
      .catch((err) => logger.warn({ err: err.message }, 'marketing ai usage log failed'));
  }
  return { inputTokens: input, outputTokens: output, costMicros };
}

/**
 * Asks, checks, and asks once more with the problems named. → `{ copy, usage: { inputTokens, outputTokens, calls, costMicros } }`.
 * Throws CopyError when both answers fail the checks; any other error is the provider's and goes up as it is.
 */
async function generate({ provider, model, operation, system, user, targetId, userId, signal, allowFields = true, tries = 2 }) {
  const ask = makeAsk({ provider, model, signal });
  const total = { inputTokens: 0, outputTokens: 0, calls: 0, costMicros: 0 };
  let problems = [];
  for (let attempt = 1; attempt <= tries; attempt += 1) {
    let result;
    try {
      result = await ask({ system, user: attempt === 1 ? user : `${user}\n\nYour last answer had these problems; fix them: ${problems.join('; ')}`, schema: BLOCKS_SCHEMA, maxTokens: marketing.aiMaxTokens });
    } catch (err) {
      if (err?.usage) {
        const used = await record({ provider, model, operation, targetId, userId, usage: err.usage, ok: false, errorMessage: err.message });
        total.inputTokens += used.inputTokens; total.outputTokens += used.outputTokens; total.costMicros += used.costMicros; total.calls += 1;
      }
      err.spent = total;
      throw err;
    }
    const used = await record({ provider, model, operation, targetId, userId, usage: result.usage, ok: true });
    total.inputTokens += used.inputTokens; total.outputTokens += used.outputTokens; total.costMicros += used.costMicros; total.calls += 1;
    const checked = check(result.data, { allowFields });
    if (checked.ok) return { copy: checked.copy, usage: total };
    problems = checked.problems;
  }
  throw Object.assign(new CopyError(`The model's answer did not pass the checks: ${problems.slice(0, 3).join(' ')}`, problems), { spent: total });
}

/* ---------- the three jobs ---------- */

/** A new template in one language from a brief. */
export const draftTemplate = ({ brief, tone, language, provider, model, templateId, userId, signal }) =>
  generate({ provider, model, operation: 'marketing.draft', system: RULES, user: draftUser({ brief, tone, language: languageInfo(language) }), targetId: templateId, userId, signal });

/** An existing variant (`{ subject, preheader, blocks }`) into another language. */
export const translateVariant = ({ variant, language, provider, model, templateId, userId, signal }) =>
  generate({ provider, model, operation: 'marketing.translate', system: RULES, user: translateUser({ variant, language: languageInfo(language) }), targetId: templateId, userId, signal });

/** One reader's copy from the template as a brief and their card. No merge fields in the answer. */
export const writePersonal = ({ variant, card, language, provider, model, templateId, signal }) =>
  generate({ provider, model, operation: 'marketing.personal', system: RULES, user: personalUser({ variant, card, language: languageInfo(language) }), targetId: templateId, signal, allowFields: false });

/** A rough size of a per-reader run, for the estimate before it starts. Tokens per reader are an estimate, not a promise. */
export function estimatePerReader(variant, readers, provider, model) {
  const briefChars = JSON.stringify({ s: variant.subject, b: variant.blocks }).length;
  const inputPer = Math.round((RULES.length + briefChars + 400) / 3.5);
  const outputPer = Math.round(briefChars / 3 + 100);
  const usage = { inputTokens: inputPer, outputTokens: outputPer };
  const usdPer = costFor(provider, model, usage) || 0;
  return { readers, inputTokensPer: inputPer, outputTokensPer: outputPer, usdPer, usd: usdPer * readers, priced: usdPer > 0 };
}

export { RULES as SYSTEM_PROMPT };
