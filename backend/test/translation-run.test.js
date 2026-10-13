// What the Translations page and its worker agree on: what a failure means, how long to wait, how a run
// reaches the page and how an event reads in the feed. Pure functions — no database, no Redis.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { FatalApiError, RefusalError } from '../scripts/lib/claude-translate-client.js';
import { TooLongError, VerseFailedError } from '../scripts/lib/claude-translate-run.js';
import { ConfigError, classifyError, describeEvent, microsOf, presentRun, retryDelayMs, usdOf } from '../utils/translation-run.js';

const cfg = { retryBaseMs: 1000, retryMaxMs: 8000, maxAutoRetries: 3, unknownRetries: 2, unknownRetryMs: 500 };

const withStatus = (status, message = 'x', name = 'Error') => Object.assign(new Error(message), { status, name });
const named = (name, extra = {}) => Object.assign(new Error(name), { name, ...extra });

describe('retryDelayMs', () => {
  it('doubles from the base and stops at the ceiling', () => {
    assert.deepEqual([0, 1, 2, 3, 4, 10].map((n) => retryDelayMs(n, cfg)), [1000, 2000, 4000, 8000, 8000, 8000]);
  });
});

describe('money', () => {
  it('rounds to millionths of a dollar and back', () => {
    assert.equal(microsOf(1.234567), 1_234_567);
    assert.equal(microsOf(0.1 + 0.2), 300_000);
    assert.equal(usdOf(1_500_000), 1.5);
    assert.equal(microsOf(null), 0);
    assert.equal(usdOf(undefined), 0);
  });
});

describe('classifyError — a person has to act', () => {
  it('pauses on a missing setting, without retrying', () => {
    const out = classifyError(new ConfigError('ANTHROPIC_API_KEY is not set'), 0, cfg);
    assert.equal(out.action, 'pause');
    assert.equal(out.reason, 'config');
    assert.equal(out.retryInMs, undefined);
  });

  it('pauses on a rejected key (401 and 403)', () => {
    for (const status of [401, 403]) {
      const out = classifyError(new FatalApiError('invalid x-api-key', status), 0, cfg);
      assert.deepEqual([out.action, out.reason, out.retryInMs], ['pause', 'auth', undefined]);
    }
  });

  it('pauses when the credit has run out, however Anthropic words it', () => {
    for (const err of [
      new FatalApiError('Your credit balance is too low to access the Anthropic API', 400),
      new FatalApiError('anything', 402),
      new FatalApiError('You have reached your specified workspace API usage limits', 400),
      withStatus(429, 'You have reached your usage limit'),
    ]) {
      const out = classifyError(err, 0, cfg);
      assert.deepEqual([out.action, out.reason, out.retryInMs], ['pause', 'credit', undefined], err.message);
    }
  });

  it('pauses on an unknown model (404)', () => {
    const out = classifyError(new FatalApiError('model: nope', 404), 0, cfg);
    assert.deepEqual([out.action, out.reason], ['pause', 'config']);
  });

  it('pauses when the bucket will not let the server in', () => {
    for (const err of [named('AccessDenied'), named('InvalidAccessKeyId'), named('X', { $metadata: { httpStatusCode: 403 } })]) {
      const out = classifyError(err, 0, cfg);
      assert.deepEqual([out.action, out.reason, out.retryInMs], ['pause', 'storage', undefined], err.name);
    }
  });

  it('pauses on missing SOURCE settings', () => {
    const out = classifyError(new Error('SOURCE_S3_BUCKET is not set — see backend/scripts/README.md for how to export it.'), 0, cfg);
    assert.deepEqual([out.action, out.reason], ['pause', 'config']);
  });
});

describe('classifyError — probably temporary', () => {
  it('retries a rate limit with a growing wait', () => {
    assert.equal(classifyError(withStatus(429, 'slow down'), 0, cfg).retryInMs, 1000);
    assert.equal(classifyError(withStatus(429, 'slow down'), 2, cfg).retryInMs, 4000);
    assert.equal(classifyError(withStatus(429, 'slow down'), 0, cfg).reason, 'rate_limit');
  });

  it('retries an overloaded or broken Anthropic and a dropped connection', () => {
    for (const err of [withStatus(529, 'overloaded'), withStatus(500), withStatus(503), named('APIConnectionError'), named('Error', { code: 'ECONNRESET' })]) {
      const out = classifyError(err, 0, cfg);
      assert.deepEqual([out.action, out.reason], ['pause', 'unavailable'], err.message + err.name);
      assert.ok(out.retryInMs > 0);
    }
  });

  it('retries S3 being busy, including a failed save', () => {
    for (const err of [named('SlowDown'), named('X', { $metadata: { httpStatusCode: 503 } }), new Error('S3 save of json/x/ch-2.json failed: socket hang up')]) {
      const out = classifyError(err, 0, cfg);
      assert.deepEqual([out.action, out.reason], ['pause', 'unavailable']);
      assert.ok(out.retryInMs > 0);
    }
  });

  it('retries when the command-line script holds the version', () => {
    const out = classifyError(new Error('Another run looks active for this version'), 0, cfg);
    assert.deepEqual([out.action, out.reason], ['pause', 'busy']);
    assert.ok(out.retryInMs > 0);
  });

  it('stops retrying after maxAutoRetries and waits for a person', () => {
    const out = classifyError(withStatus(529), cfg.maxAutoRetries, cfg);
    assert.equal(out.action, 'pause');
    assert.equal(out.retryInMs, undefined);
    assert.match(out.message, /press Resume/);
  });
});

describe('classifyError — the run cannot go on', () => {
  it('fails on a verse that could not be made, and names it', () => {
    const out = classifyError(new VerseFailedError('1.2.47', { mr: ['missing purport'] }), 0, cfg);
    assert.deepEqual([out.action, out.verseId], ['fail', '1.2.47']);
    assert.match(out.message, /1\.2\.47/);
    assert.match(out.message, /missing purport/);
  });

  it('fails on a verse too long for one answer, and on a refusal', () => {
    const tooLong = classifyError(new TooLongError('1.1.20', 'ta', 64000), 0, cfg);
    assert.deepEqual([tooLong.action, tooLong.verseId], ['fail', '1.1.20']);
    assert.equal(classifyError(new RefusalError('refusal'), 0, cfg).action, 'fail');
  });

  it('fails on a request Anthropic calls invalid (nothing to wait for)', () => {
    assert.equal(classifyError(new FatalApiError('max_tokens too large', 400), 0, cfg).action, 'fail');
  });
});

describe('classifyError — nobody foresaw it', () => {
  it('retries twice quietly, then fails with the message', () => {
    const bug = new TypeError("Cannot read properties of undefined (reading 'x')");
    assert.equal(classifyError(bug, 0, cfg).retryInMs, 500);
    assert.equal(classifyError(bug, 1, cfg).retryInMs, 500);
    const out = classifyError(bug, 2, cfg);
    assert.equal(out.action, 'fail');
    assert.match(out.message, /Cannot read properties/);
  });

  it('copes with a thrown string and with nothing', () => {
    assert.equal(classifyError('boom', 0, cfg).action, 'pause');
    assert.equal(classifyError(undefined, 5, cfg).action, 'fail');
  });
});

describe('presentRun', () => {
  const row = {
    id: 'r1', language: 'mr', version: '1.0', model: 'm', status: 'RUNNING', pauseReason: null, statusMessage: null,
    stopReason: null, errorVerseId: null, resumeAt: null, cancelRequested: false, chapters: [2, 3], verseLimit: null,
    budgetMicros: 5_000_000, totalVerses: 200, doneVerses: 50, currentVerseId: '1.2.51', score1: 1, score2: 9, score3: 40,
    inputTokens: 1000, outputTokens: 2000, calls: 60, costMicros: 2_500_000, activeSeconds: 500, attempts: 1,
    requestedById: 'u1', requestedByName: 'Asha', createdAt: new Date(), startedAt: new Date(), finishedAt: null,
    heartbeatAt: new Date(),
  };

  it('works out progress, pace, eta, money and the requester', () => {
    const run = presentRun(row);
    assert.deepEqual(run.progress, { total: 200, done: 50, percent: 25, currentVerseId: '1.2.51', etaSeconds: 1500, secondsPerVerse: 10 });
    assert.deepEqual(run.scores, { 1: 1, 2: 9, 3: 40 });
    assert.equal(run.usage.costUsd, 2.5);
    assert.equal(run.budgetUsd, 5);
    assert.deepEqual(run.requestedBy, { id: 'u1', name: 'Asha' });
    assert.equal(run.languageName, 'Marathi');
    assert.equal(run.stalled, false);
  });

  it('gives no eta before a verse is done, and never above 100%', () => {
    assert.equal(presentRun({ ...row, doneVerses: 0 }).progress.etaSeconds, null);
    assert.equal(presentRun({ ...row, doneVerses: 300 }).progress.percent, 100);
    assert.equal(presentRun({ ...row, totalVerses: 0, doneVerses: 0 }).progress.percent, 0);
  });

  it('calls a RUNNING run with no recent heartbeat stalled, and only that', () => {
    const now = new Date();
    assert.equal(presentRun({ ...row, heartbeatAt: new Date(now - 120_000) }, now).stalled, true);
    assert.equal(presentRun({ ...row, heartbeatAt: null }, now).stalled, true);
    assert.equal(presentRun({ ...row, heartbeatAt: new Date(now - 10_000) }, now).stalled, false);
    assert.equal(presentRun({ ...row, status: 'PAUSED', heartbeatAt: new Date(now - 120_000) }, now).stalled, false);
  });

  it('survives a language it does not know and a run without a budget or requester', () => {
    const run = presentRun({ ...row, language: 'xx', budgetMicros: null, requestedById: null });
    assert.equal(run.languageName, 'xx');
    assert.equal(run.budgetUsd, null);
    assert.equal(run.requestedBy, null);
  });
});

describe('describeEvent', () => {
  it('words a saved verse, warning on a score of 1', () => {
    const line = describeEvent('verse', { verseId: '1.2.7', correctness: { mr: 3 }, rounds: 1, calls: 1, costUsd: 0.0123 });
    assert.equal(line.kind, 'verse');
    assert.equal(line.level, 'info');
    assert.equal(line.verseId, '1.2.7');
    assert.match(line.text, /1\.2\.7 saved · score 3/);
    assert.equal(describeEvent('verse', { verseId: '1.2.8', correctness: { mr: 1 } }).level, 'warn');
  });

  it('words each kind of trouble', () => {
    assert.match(describeEvent('warning', { verseId: 'v', correctness: 2, warnings: ['a', 'b'] }).text, /\(\+1 more\)/);
    assert.match(describeEvent('incomplete', { verseId: 'v', missing: ['purport'] }).text, /purport/);
    assert.match(describeEvent('rejected', { verseId: 'v', errors: ['no json'] }).text, /no json/);
    assert.match(describeEvent('bad-json', { verseId: 'v' }).text, /not valid JSON/);
    assert.match(describeEvent('call-failed', { verseId: 'v', kind: 'truncated', costUsd: 0.2 }).text, /ran out of room.*\$0\.20/);
    assert.match(describeEvent('split', { verseId: 'v' }).text, /two parts/);
    assert.match(describeEvent('save-retry', { key: 'k', error: 'e' }).text, /trying again/);
    assert.equal(describeEvent('wait', { message: 'rate limited' }).text, 'rate limited');
  });

  it('says nothing for events that are only bookkeeping', () => {
    assert.equal(describeEvent('verse-start', { verseId: 'v' }), null);
    assert.equal(describeEvent('call', {}), null);
    assert.equal(describeEvent('nonsense'), null);
  });
});
