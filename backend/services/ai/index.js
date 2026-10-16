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
import * as tokens from './tokens.js';

const providers = { GEMINI: gemini, OPENAI: openai };

// Which provider answers and with which model. The provider comes from `.env`
// (AI_PROVIDER) unless the admin panel has set `ai.provider`, which wins — so
// switching is a one-line .env change on an install that has never touched that
// setting. `purpose` picks the model: the normal one, the stronger one for
// plans on the ADVANCED tier, or the cheap one that writes summaries.
async function resolveProvider({ purpose = 'text' } = {}) {
  const name = String(await settings.get(SETTING_KEYS.AI_PROVIDER, env.AI_PROVIDER)).toUpperCase();
  const provider = providers[name];
  if (!provider) throw new AppError(500, 'AI_MISCONFIGURED', `Unknown AI provider: ${name}`);

  let model;
  if (purpose === 'summary') model = provider.summaryModel;
  else if (purpose === 'advanced') model = provider.advancedModel;
  else model = await settings.get(SETTING_KEYS.AI_MODEL_TEXT, provider.defaultModel);
  return { provider, model: model || provider.defaultModel };
}

async function logUsage({ provider, model, operation, targetType, targetId, userId, result, error }) {
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
        costMicros: result
          ? provider.costMicros(model, result.inputTokens || 0, result.outputTokens || 0)
          : 0,
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
async function withinBudget() {
  const budget = await settings.getNumber(SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS, 0);
  if (!budget) return true;

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const spent = await prisma.aiUsageLog.aggregate({
    where: { createdAt: { gte: monthStart } },
    _sum: { costMicros: true },
  });

  return (spent._sum.costMicros || 0) < budget;
}

/**
 * Run one completion.
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

  const { provider, model } = await resolveProvider({ purpose });
  const startedAt = Date.now();

  try {
    const result = await provider.complete({ model, system, prompt, messages, json, maxTokens, temperature });
    await logUsage({ provider, model, operation, targetType, targetId, userId, result });

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
        costMicros: provider.costMicros(model, result.inputTokens, result.outputTokens),
      },
    };
  } catch (error) {
    await logUsage({ provider, model, operation, targetType, targetId, userId, error });
    throw error;
  }
}

/**
 * Stream a chat reply.
 *
 *   const run = await ai.stream({ operation, system, messages, userId, estimatedInput, signal });
 *   for await (const text of run.text) send(text);
 *   run.usage   // { inputTokens, outputTokens, costMicros, estimated }
 *
 * `run.usage` is filled in however the loop ends — finished, broken out of
 * (the reader pressed stop), aborted by `signal`, or failed. When the provider
 * never got to report its count (a cut stream), the usage is estimated locally
 * from what was sent and what arrived, and `estimated` says so. That is the
 * number the wallet is charged and the usage log records, so a stopped reply
 * is never free and never double-charged.
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

  const { provider, model } = await resolveProvider({ purpose });

  const run = {
    provider: provider.name,
    model,
    finishReason: null,
    usage: { inputTokens: 0, outputTokens: 0, costMicros: 0, estimated: true },
    receivedText: '',
  };

  run.text = (async function* () {
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
      throw error;
    } finally {
      // Runs on completion, on break (return()) and on error alike.
      const complete = reported && (reported.inputTokens || reported.outputTokens);
      const inputTokens = complete ? reported.inputTokens : estimatedInput;
      const outputTokens = complete ? reported.outputTokens : tokens.estimate(run.receivedText);
      run.usage = {
        inputTokens,
        outputTokens,
        costMicros: provider.costMicros(model, inputTokens, outputTokens),
        estimated: !complete,
      };
      await logUsage({
        provider, model, operation, targetType, targetId, userId,
        result: { inputTokens, outputTokens },
        error: failure,
      });
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
};

export { complete, stream, OPERATIONS, resolveProvider, withinBudget, providers };
