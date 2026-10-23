// The only door to AI in this codebase.
//
// Callers ask for a completion and describe what it is for. They never learn
// which provider answered, and they never name a model — the provider and model
// come from AppSetting so they can be changed without a deploy.
//
// Two rules this file enforces, both from backend/CLAUDE.md:
//
//   1. Every call is logged to AiUsageLog with tokens and cost. A feature whose
//      spend cannot be attributed to an operation does not ship. `operation` is
//      therefore required, not optional.
//   2. AI never runs on the request path. This module is called by the batch
//      jobs in jobs/processors, which write their results into VerseIssue and
//      VerseExplanation. Serving a user is then a database query — a mood-driven
//      sloka costs an indexed lookup, not a model call. Spend scales with the
//      size of the corpus, which is fixed, not with how many users we have.

import { prisma } from '../../config/database.js';
import logger from '../../config/logger.js';
import env from '../../config/env.js';
import { SETTING_KEYS } from '../../config/constants.js';
import * as settings from '../setting.js';
import { AppError } from '../../utils/errors.js';
import * as gemini from './gemini.js';
import * as openai from './openai.js';
import * as freeTier from './free-tier.js';
import * as tally from './token-tally.js';
import * as tokens from './tokens.js';

const providers = { GEMINI: gemini, OPENAI: openai };

// The engines (a provider and a model) that may answer a call, in the order they are tried. `purpose` picks the model:
// the normal one, the stronger one for plans on the ADVANCED tier, or the cheap one that writes summaries.
//
//   1. OpenAI's free-tier model — while the switch is on (admin → AI usage) and today's free tokens are not spent.
//      Not for the stronger tier, so a paying reader's model does not depend on the day's tally.
//   2. The provider and model that are set: the Settings page's `ai.provider` and `ai.model.text`, else `.env`
//      (AI_PROVIDER). Switching is a one-line .env change on an install that has never touched that setting.
//   3. OpenAI's AI_FALLBACK_MODEL (GPT-6 Luna), at its paid rate — the last resort when the engine above is not
//      working: a retired model, a bad key, over quota, down.
//
// An engine that repeats an earlier one is dropped, and so is an OpenAI engine when there is no OpenAI key; the set
// provider stays even without a key, so that its "not configured" reaches whoever asked. `source` says which rule chose
// an engine, and the admin pages show it: 'free-tier', 'settings' (saved on the Settings page), 'env' (.env) or 'fallback'.
async function resolveEngines({ purpose = 'text' } = {}) {
  const engines = [];

  if (purpose !== 'advanced') {
    const free = await freeTier.check('text');
    if (free.model) engines.push({ provider: providers.OPENAI, model: free.model, source: 'free-tier' });
  }

  const saved = await settings.get(SETTING_KEYS.AI_PROVIDER, null);
  const name = String(saved ?? env.AI_PROVIDER).toUpperCase();
  const provider = providers[name];
  if (!provider) throw new AppError(500, 'AI_MISCONFIGURED', `Unknown AI provider: ${name}`);

  let model;
  if (purpose === 'summary') model = provider.summaryModel;
  else if (purpose === 'advanced') model = provider.advancedModel;
  else model = await settings.get(SETTING_KEYS.AI_MODEL_TEXT, provider.defaultModel);
  const set = { provider, model: model || provider.defaultModel, source: saved ? 'settings' : 'env' };
  engines.push(set);

  if (env.AI_FALLBACK_MODEL) engines.push({ provider: providers.OPENAI, model: env.AI_FALLBACK_MODEL, source: 'fallback' });

  const usable = engines.filter((engine) => engine === set || engine.provider.isConfigured());
  return usable.filter((engine, i) => usable.findIndex((other) => other.provider === engine.provider && other.model === engine.model) === i);
}

/** The engine tried first → `{ provider, model, source }`. */
async function resolveProvider({ purpose = 'text' } = {}) {
  const [first] = await resolveEngines({ purpose });
  return first;
}

/** The chain as the admin pages show it, in the order it would be tried right now: `[{ provider, model, source }]`. Empty when the provider setting names no provider. */
async function describeChain(purpose) {
  const engines = await resolveEngines({ purpose }).catch(() => []);
  return engines.map(({ provider, model, source }) => ({ provider: provider.name, model, source }));
}

// Calls on the free tier cost nothing, so they neither show as spend nor count against the monthly budget.
const costOf = ({ provider, model, source }, inputTokens, outputTokens) =>
  source === 'free-tier' ? 0 : provider.costMicros(model, inputTokens, outputTokens);

function failedOver(from, to, error, operation) {
  logger.warn(
    {
      operation,
      from: `${from.provider.name} ${from.model}`,
      to: `${to.provider.name} ${to.model}`,
      code: error?.code,
      error: String(error?.message).slice(0, 200),
    },
    'ai engine failed, trying the next'
  );
}

async function logUsage({ engine, operation, targetType, targetId, userId, result, error }) {
  const { provider, model } = engine;

  // The token calculator counts what the provider actually did: a call that failed before it answered used nothing.
  if (result) {
    await tally.record({ provider: provider.name, model, inputTokens: result.inputTokens, outputTokens: result.outputTokens });
  }

  try {
    await prisma.aiUsageLog.create({
      data: {
        provider: provider.name,
        model,
        operation,
        targetType: targetType || null,
        targetId: targetId || null,
        userId: userId || null,
        inputTokens: result?.inputTokens || 0,
        outputTokens: result?.outputTokens || 0,
        costMicros: result ? costOf(engine, result.inputTokens || 0, result.outputTokens || 0) : 0,
        succeeded: !error,
        errorMessage: error ? String(error.message).slice(0, 500) : null,
      },
    });
  } catch (err) {
    logger.error({ err: err.message, operation }, 'ai usage log failed');
  }
}

// Spend guard. The batch jobs are the only caller, and a prompt change that
// quietly multiplies token use should stop the job rather than the invoice.
//
// The month's total is remembered for a few seconds: chat asks before every reply, the sum reads every row of the month
// (the table is indexed by operation first, so a date alone cannot use the index), and a limit that bites a few seconds
// late costs nothing a monthly budget would notice.
const SPEND_TTL_MS = 20_000;
let spendCache = { at: 0, month: '', micros: 0 };

async function monthSpend() {
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const month = monthStart.toISOString();

  if (spendCache.month === month && Date.now() - spendCache.at < SPEND_TTL_MS) return spendCache.micros;

  const spent = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { costMicros: true },
  });
  spendCache = { at: Date.now(), month, micros: spent._sum.costMicros || 0 };
  return spendCache.micros;
}

async function withinBudget() {
  const budget = await settings.getNumber(SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS, 0);
  if (!budget) return true;
  return (await monthSpend()) < budget;
}

/**
 * Run one completion. When an engine errors, the next one in the chain (resolveEngines) takes the call; if every
 * engine errors, the caller gets the first one's error. Each attempt is logged, the failed ones as failures.
 *
 * @param {object}  request
 * @param {string}  request.operation   what this call is for, e.g. "verse.issue-map".
 *                                      Shows up in AiUsageLog and is how spend is
 *                                      attributed — required.
 * @param {string}  request.prompt
 * @param {string} [request.system]
 * @param {boolean}[request.json]       ask the provider for a JSON object
 * @param {string} [request.targetType] the row this is generating for
 * @param {string} [request.targetId]
 * @returns {Promise<{ text, json, usage, provider, model }>} `provider` and `model` are the engine that answered.
 */
async function complete(request) {
  const {
    operation, prompt, messages, system, json = false, targetType, targetId, userId, maxTokens, temperature,
    purpose = 'text',
  } = request;

  if (!operation) throw new AppError(500, 'AI_MISCONFIGURED', 'Every AI call needs an operation');
  if (!(await withinBudget())) {
    throw new AppError(429, 'AI_BUDGET_EXHAUSTED', 'The monthly AI budget is spent');
  }

  const engines = await resolveEngines({ purpose });
  const log = { operation, targetType, targetId, userId };
  let firstError = null;

  for (const [i, engine] of engines.entries()) {
    const { provider, model } = engine;
    const startedAt = Date.now();

    let result;
    try {
      result = await provider.complete({ model, system, prompt, messages, json, maxTokens, temperature });
    } catch (error) {
      await logUsage({ engine, ...log, error });
      firstError ??= error;
      if (i === engines.length - 1) throw firstError;
      failedOver(engine, engines[i + 1], error, operation);
      continue;
    }

    try {
      await logUsage({ engine, ...log, result });

      logger.debug(
        { operation, model, ms: Date.now() - startedAt, tokens: result.inputTokens + result.outputTokens },
        'ai call'
      );

      return {
        text: result.text,
        // Parsed here so no caller has to guess whether the model wrapped its
        // object in prose. A model that ignored the instruction is a failure of
        // this call, not something for the caller to untangle.
        json: json ? parseJson(result.text, operation) : null,
        usage: {
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costMicros: costOf(engine, result.inputTokens, result.outputTokens),
        },
        provider: provider.name,
        model,
      };
    } catch (error) {
      await logUsage({ engine, ...log, error });
      throw error;
    }
  }
}

/**
 * Stream a chat reply.
 *
 *   const run = await ai.stream({ operation, system, messages, userId, estimatedInput, signal });
 *   for await (const text of run.text) send(text);
 *   run.usage   // { inputTokens, outputTokens, costMicros, estimated }
 *   run.model   // the model that answered
 *
 * `run.usage` is filled in however the loop ends — finished, broken out of
 * (the reader pressed stop), aborted by `signal`, or failed. When the provider
 * never got to report its count (a cut stream), the usage is estimated locally
 * from what was sent and what arrived, and `estimated` says so. That is the
 * number the wallet is charged and the usage log records, so a stopped reply
 * is never free and never double-charged.
 *
 * When an engine errors before it has said anything, the next one in the chain (resolveEngines) takes over and
 * `run.provider` and `run.model` change to it, so read them once the loop has ended. Once words have reached the
 * reader the reply cannot start over: the error is thrown. If every engine errors, the first one's error is.
 */
async function stream(request) {
  const {
    operation, system, messages, userId, targetType, targetId, maxTokens, temperature, signal,
    purpose = 'text', estimatedInput = 0,
  } = request;

  if (!operation) throw new AppError(500, 'AI_MISCONFIGURED', 'Every AI call needs an operation');
  if (!(await withinBudget())) {
    throw new AppError(429, 'AI_BUDGET_EXHAUSTED', 'The monthly AI budget is spent');
  }

  const engines = await resolveEngines({ purpose });

  const run = {
    provider: engines[0].provider.name,
    model: engines[0].model,
    finishReason: null,
    usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, estimated: true },
    receivedText: '',
  };

  run.text = (async function* () {
    let firstError = null;

    for (const [i, engine] of engines.entries()) {
      const { provider, model } = engine;
      run.provider = provider.name;
      run.model = model;
      run.finishReason = null;

      let reported = null;
      let failure = null;
      try {
        for await (const piece of provider.stream({ model, system, messages, maxTokens, temperature, signal })) {
          if (piece.done) {
            reported = piece;
            run.finishReason = piece.finishReason;
            continue;
          }
          run.receivedText += piece.text;
          yield piece.text;
        }
      } catch (error) {
        failure = error;
      } finally {
        // Runs on completion, on break (return()) and on failure alike.
        const complete = reported && (reported.inputTokens || reported.outputTokens);
        const inputTokens = complete ? reported.inputTokens : estimatedInput;
        const outputTokens = complete ? reported.outputTokens : tokens.estimate(run.receivedText);
        run.usage = {
          inputTokens,
          outputTokens,
          costMicros: costOf(engine, inputTokens, outputTokens),
          estimated: !complete,
        };
        // An engine that failed before it said anything used nothing: it is logged as a failure, with no tokens.
        const used = failure && !run.receivedText ? null : { inputTokens, outputTokens };
        await logUsage({ engine, operation, targetType, targetId, userId, result: used, error: failure });
      }

      if (!failure) return;

      firstError ??= failure;
      // Words have gone out, or nobody is waiting any more: another engine cannot take over.
      if (run.receivedText || signal?.aborted) throw failure;
      if (i === engines.length - 1) throw firstError;
      failedOver(engine, engines[i + 1], failure, operation);
    }
  })();

  return run;
}

function parseJson(text, operation) {
  try {
    return JSON.parse(text);
  } catch {
    // Last resort: some models still fence the object despite being asked not to.
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new AppError(502, 'AI_BAD_OUTPUT', `${operation} did not return valid JSON`);
  }
}

// Named operations, so the strings in AiUsageLog stay consistent and the admin
// spend report can group by something real.
const OPERATIONS = {
  VERSE_ISSUE_MAP: 'verse.issue-map',
  VERSE_EXPLANATION: 'verse.explanation',
  SLOKA_REASON: 'sloka.reason',
  CHAT_REPLY: 'chat.reply',
  CHAT_SUMMARY: 'chat.summary',
  CHAT_PROFILE: 'chat.profile',
  MANTRA_SUGGEST: 'mantra.suggest',
  MANTRA_DETAILS: 'mantra.details',
  MANTRA_TRANSLATE: 'mantra.translate',
};

export { complete, stream, OPERATIONS, describeChain, resolveEngines, resolveProvider, withinBudget, providers };
