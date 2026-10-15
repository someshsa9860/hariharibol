// What the Translations page and its worker agree on, as pure functions (no I/O, so `npm test` covers
// them): what a failure means, how long to wait before trying again, how a run is sent to the page,
// and how a pipeline event reads in the activity feed.

import { translation } from '../config/translation.js';
import { language } from '../scripts/lib/claude-translate-languages.js';
import { FatalApiError, RefusalError } from '../scripts/lib/claude-translate-client.js';
import { chapterLabel } from '../scripts/lib/claude-translate-source.js';
import { providerOf } from '../scripts/lib/translate-providers.js';
import { TooLongError, VerseFailedError } from '../scripts/lib/claude-translate-run.js';

export const ACTIVE_STATUSES = ['QUEUED', 'RUNNING', 'PAUSED'];
export const FINISHED_STATUSES = ['COMPLETED', 'FAILED', 'CANCELLED'];

export const microsOf = (usd) => Math.round((usd || 0) * 1_000_000);
export const usdOf = (micros) => (micros || 0) / 1_000_000;

/** Something the server is missing or set wrongly (no API key, a model that cannot do what is asked). Waiting does not fix it; a person does. */
export class ConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ConfigError';
  }
}

/** How long to wait before the nth automatic retry (0 = the first). */
export function retryDelayMs(retriesInARow, cfg = translation) {
  return Math.min(cfg.retryBaseMs * 2 ** retriesInARow, cfg.retryMaxMs);
}

/* ---------- what a failure means ---------- */

// A hard stop from Anthropic for money, not for rate: waiting does not fix it, topping up does.
const CREDIT = /credit balance|billing|payment|insufficient|usage limit|spend limit|regain access|quota/i;

// Errors from the network or from S3 that go away by themselves.
const NETWORK_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ECONNABORTED'];
const S3_DENIED = ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'NoSuchBucket', 'ExpiredToken', 'InvalidToken', 'CredentialsProviderError', 'Forbidden'];
const S3_BUSY = ['SlowDown', 'ServiceUnavailable', 'InternalError', 'RequestTimeout', 'TimeoutError', 'NetworkingError'];

/**
 * Decides what a run does about an error that stopped it.
 *
 *   pause + retryInMs  - probably temporary (the AI provider or S3 busy, the network): try again by itself
 *   pause              - needs a person (no credit, a bad key, no access to the bucket): Resume afterwards
 *   fail               - something broke that waiting will not mend: the message says what, Resume tries again
 *
 * Nothing is lost either way - every verse saved so far is in S3, and a resumed run carries on from the
 * first one that is not.
 *
 * @param {Error} err
 * @param {number} retriesInARow  automatic retries since a verse was last saved
 * @returns {{ action: 'pause'|'fail', reason: string, message: string, retryInMs?: number, verseId?: string }}
 */
export function classifyError(err, retriesInARow = 0, cfg = translation) {
  const text = String(err?.message || err || 'unknown error');
  const p = providerOf(err?.provider || 'anthropic');
  const retry = (reason, message) =>
    retriesInARow < cfg.maxAutoRetries
      ? { action: 'pause', reason, message, retryInMs: retryDelayMs(retriesInARow, cfg) }
      : { action: 'pause', reason, message: `${message} It has been retried ${retriesInARow} times without saving a verse; press Resume when it is fixed.` };

  if (err instanceof ConfigError) {
    return { action: 'pause', reason: 'config', message: `${err.message} Fix it on the worker, then press Resume.` };
  }

  if (err instanceof FatalApiError) {
    const status = err.status;
    if (status === 401 || status === 403) {
      return { action: 'pause', reason: 'auth', message: `${p.company} rejected the API key (${status}). Check ${p.keyEnv} on the server, then press Resume.` };
    }
    if (status === 402 || CREDIT.test(text)) {
      return { action: 'pause', reason: 'credit', message: `${p.company} credit has run out or a spend limit was reached. Add credit in the ${p.company} console, then press Resume. (${text.slice(0, 200)})` };
    }
    if (status === 404) {
      return { action: 'pause', reason: 'config', message: `${p.company} does not know the configured model. Check ${p.modelEnv} (or the model chosen for the run), then press Resume. (${text.slice(0, 200)})` };
    }
    return { action: 'fail', reason: 'error', message: text };
  }

  // An answer that exhausted the SDK's own retries on 429 / 529 / 5xx, or never connected.
  const status = err?.status;
  if (status === 429) {
    return CREDIT.test(text)
      ? { action: 'pause', reason: 'credit', message: `${p.company}'s usage limit was reached. Add credit or wait for the limit to reset, then press Resume. (${text.slice(0, 200)})` }
      : retry('rate_limit', `${p.company} is rate-limiting this key.`);
  }
  if (status === 529 || (status >= 500 && status < 600) || err?.name === 'APIConnectionError' || err?.name === 'APIConnectionTimeoutError' || NETWORK_CODES.includes(err?.code)) {
    return retry('unavailable', `${p.company} could not be reached or is overloaded.`);
  }

  if (err instanceof RefusalError) {
    return { action: 'fail', reason: 'error', message: `The model declined to translate this verse (${text}).` };
  }
  if (err instanceof VerseFailedError) {
    const why = Object.values(err.problems || {}).flat().slice(0, 3).join('; ');
    return { action: 'fail', reason: 'error', verseId: err.verseId, message: `Verse ${err.verseId} could not be translated after several tries${why ? `: ${why}` : ''}.` };
  }
  if (err instanceof TooLongError) {
    return { action: 'fail', reason: 'error', verseId: err.verseId, message: text };
  }

  // S3 - the app's bucket, where the English is read from and the translations are written to.
  const s3Status = err?.$metadata?.httpStatusCode;
  if (S3_DENIED.includes(err?.name) || s3Status === 401 || s3Status === 403 || /S3 save of .* failed: .*(AccessDenied|Forbidden|InvalidAccessKeyId|SignatureDoesNotMatch)/.test(text)) {
    return { action: 'pause', reason: 'storage', message: `The server is not allowed to read or write the translations bucket (${err?.name || 'access denied'}). Check the server's AWS credentials and S3_BUCKET, then press Resume.` };
  }
  if (S3_BUSY.includes(err?.name) || (s3Status >= 500 && s3Status < 600) || /^S3 save of .* failed/.test(text)) {
    return retry('unavailable', 'S3 could not be reached.');
  }
  if (/is not set — see backend\/scripts\/README\.md|SOURCE_LOCAL_DIR is set/.test(text)) {
    return { action: 'pause', reason: 'config', message: `${text} Set it on the worker, then press Resume.` };
  }

  // The pipeline's own guard: another process (usually the command-line script) is writing this version.
  if (/Another run looks active/.test(text)) {
    return retry('busy', 'Another translation process (the command-line script?) is writing this version.');
  }

  // Anything else: probably a one-off. Two quiet retries, then show the message.
  if (retriesInARow < cfg.unknownRetries) {
    return { action: 'pause', reason: 'error', message: `Unexpected error: ${text.slice(0, 300)}`, retryInMs: cfg.unknownRetryMs };
  }
  return { action: 'fail', reason: 'error', message: `Unexpected error: ${text.slice(0, 500)}` };
}

/* ---------- a run, as the page receives it ---------- */

/**
 * @param {object} row  a TranslationRun
 * @param {Date} [now]
 */
export function presentRun(row, now = new Date()) {
  const done = row.doneVerses;
  const total = row.totalVerses;
  const lang = safeLanguage(row.language);
  const beat = row.heartbeatAt ? new Date(row.heartbeatAt).getTime() : null;
  return {
    id: row.id,
    language: row.language,
    book: row.book,
    chapterLabels: (row.chapters || []).map((id) => chapterLabel(id, row.book)),
    languageName: lang.name,
    endonym: lang.endonym,
    version: row.version,
    provider: row.provider,
    model: row.model,
    status: row.status,
    pauseReason: row.pauseReason,
    statusMessage: row.statusMessage,
    stopReason: row.stopReason,
    errorVerseId: row.errorVerseId,
    resumeAt: row.resumeAt,
    cancelRequested: row.cancelRequested,
    // What was asked for.
    chapters: row.chapters,
    verseLimit: row.verseLimit,
    budgetUsd: row.budgetMicros == null ? null : usdOf(row.budgetMicros),
    progress: {
      total,
      done,
      percent: total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0,
      currentVerseId: row.currentVerseId,
      // Time left at the pace of this run's translating time (pauses are not counted).
      etaSeconds: done > 0 && total > done && row.activeSeconds > 0 ? Math.round((row.activeSeconds / done) * (total - done)) : null,
      secondsPerVerse: done > 0 && row.activeSeconds > 0 ? Math.round(row.activeSeconds / done) : null,
    },
    scores: { 1: row.score1, 2: row.score2, 3: row.score3 },
    usage: {
      inputTokens: row.inputTokens,
      outputTokens: row.outputTokens,
      calls: row.calls,
      costUsd: usdOf(row.costMicros),
    },
    attempts: row.attempts,
    requestedBy: row.requestedById ? { id: row.requestedById, name: row.requestedByName } : null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    // RUNNING but silent: the worker died or is stuck. BullMQ hands the job to another worker by itself
    // (see worker/index.js), so this is a warning, not a verdict.
    stalled: row.status === 'RUNNING' && (beat == null || now.getTime() - beat > translation.staleHeartbeatSeconds * 1000),
  };
}

function safeLanguage(code) {
  try {
    return language(code);
  } catch {
    return { name: code, endonym: code };
  }
}

/* ---------- the activity feed ---------- */

const money = (usd) => `$${(usd ?? 0).toFixed(usd >= 0.1 ? 2 : 3)}`;

/**
 * One pipeline event as a line for the feed, or null when it is not worth one. `level` colours it on the page.
 * Events carry ids, counts and error text, never a model's answer.
 */
export function describeEvent(name, f = {}) {
  const line = describe(name, f);
  return line && { kind: name, ...line };
}

function describe(name, f) {
  switch (name) {
    case 'verse': {
      const score = Object.values(f.correctness || {})[0];
      const cost = f.costUsd == null ? '' : ` · ${money(f.costUsd)}`;
      const extra = f.rounds > 1 ? ` · ${f.rounds} rounds` : '';
      return { level: score === 1 ? 'warn' : 'info', verseId: f.verseId, text: `${f.verseId} saved · score ${score ?? '?'}${extra} · ${f.calls ?? 1} call${f.calls === 1 ? '' : 's'}${cost}` };
    }
    case 'warning':
      return { level: 'warn', verseId: f.verseId, text: `${f.verseId} · score ${f.correctness}: ${(f.warnings || [])[0] ?? 'see the verse'}${(f.warnings || []).length > 1 ? ` (+${f.warnings.length - 1} more)` : ''}` };
    case 'incomplete':
      return { level: 'warn', verseId: f.verseId, text: `${f.verseId} · the answer left out ${(f.missing || []).join(', ')}; asking again` };
    case 'rejected':
      return { level: 'warn', verseId: f.verseId, text: `${f.verseId} · answer unusable (${(f.errors || [])[0] ?? 'no reason given'}); asking again` };
    case 'bad-json':
      return { level: 'warn', verseId: f.verseId, text: `${f.verseId} · the answer was not valid JSON; asking again` };
    case 'call-failed': {
      const what = { truncated: 'ran out of room', 'bad-json': 'was not valid JSON', refused: 'was declined' }[f.kind] ?? 'gave nothing usable';
      return { level: 'warn', verseId: f.verseId, text: `${f.verseId} · a call ${what}${f.costUsd ? ` (${money(f.costUsd)} spent)` : ''}` };
    }
    case 'split':
      return { level: 'info', verseId: f.verseId, text: `${f.verseId} · too long for one answer; asking in two parts` };
    case 'save-conflict':
      return { level: 'warn', text: `${f.key} changed while saving; merged and saved again` };
    case 'save-retry':
      return { level: 'warn', text: `Saving ${f.key} failed (${f.error}); trying again` };
    case 'backup':
      return { level: 'info', text: `Copied the existing ${f.key} to ${f.to} before the first change` };
    case 'wait':
      return { level: 'warn', text: f.message };
    default:
      return null;
  }
}
