// AI spend and the batch passes.
//
// The rule this screen exists to keep honest: AI never runs on the request
// path. Every model call happens in a job, ahead of time, and writes its result
// into VerseIssue or VerseExplanation — so serving a user is a database query
// and the total spend is bounded by the size of the corpus rather than by how
// many people use the app.
//
// If the spend chart ever tracks user growth instead of content growth,
// something has started calling the model on a request.

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import * as ai from '../../services/ai/index.js';
import { queues } from '../../jobs/index.js';
import { ok, paginated } from '../../utils/respond.js';
import { paginate } from '../../utils/pagination.js';

/** GET /api/admin/ai/usage — the log, filterable by operation. */
export const usage = async (req, res) => {
  const { operation, provider, succeeded } = req.valid.query;

  const { items, page } = await paginate(prisma.aiUsageLog, {
    where: {
      ...(operation ? { operation } : {}),
      ...(provider ? { provider } : {}),
      ...(succeeded !== undefined ? { succeeded } : {}),
    },
    orderBy: { createdAt: 'desc' },
    query: req.valid.query,
  });

  return paginated(res, items, page);
};

/**
 * GET /api/admin/ai/spend
 * Cost per operation for the window, plus the month to date against the budget.
 */
export const spend = async (req, res) => {
  const days = req.valid.query.days || 30;
  const since = new Date(Date.now() - days * 86400000);

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const [byOperation, thisMonth, failures, config] = await Promise.all([
    prisma.aiUsageLog.groupBy({
      by: ['operation'],
      where: { createdAt: { gte: since } },
      _sum: { costMicros: true, inputTokens: true, outputTokens: true },
      _count: { _all: true },
    }),
    prisma.aiUsageLog.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { costMicros: true },
    }),
    prisma.aiUsageLog.count({ where: { createdAt: { gte: since }, succeeded: false } }),
    ai.resolveProvider(),
  ]);

  return ok(res, {
    days,
    provider: config.provider.name,
    model: config.model,
    // Millionths of a dollar throughout — an integer, because summing floats
    // over hundreds of thousands of calls drifts.
    monthToDateMicros: thisMonth._sum.costMicros || 0,
    failures,
    byOperation: byOperation.map((row) => ({
      operation: row.operation,
      calls: row._count._all,
      costMicros: row._sum.costMicros || 0,
      inputTokens: row._sum.inputTokens || 0,
      outputTokens: row._sum.outputTokens || 0,
    })),
  });
};

/**
 * POST /api/admin/ai/jobs/issue-map
 *
 * Queues the pass that proposes verse-to-issue mappings. It writes suggestions,
 * not truth: the pool it fills is the one the personalised sloka draws from, and
 * a wrong verse for someone in the middle of krodha is worse than no
 * personalisation at all. An editor confirms what it proposes.
 */
export const runIssueMap = async (req, res) => {
  const { bookNumber, limit = 100, dryRun = false } = req.valid.body;

  const job = await queues.ai.add('issue-map', {
    bookNumber,
    limit,
    dryRun,
    requestedBy: req.auth.user.id,
  });

  await audit.record(req, {
    action: 'ai.job.issue-map',
    entityType: 'AiJob',
    entityId: job.id,
    after: { bookNumber, limit, dryRun },
  });

  return ok(res, { jobId: job.id, queued: true });
};

/**
 * POST /api/admin/ai/jobs/explanations
 * Fills VerseExplanation for verses that have none in the target language.
 * Written once per verse per language and reused by every reader — which is
 * what keeps this a fixed cost rather than a per-user one.
 */
export const runExplanations = async (req, res) => {
  const { languageCode = 'en', bookNumber, limit = 100 } = req.valid.body;

  const job = await queues.ai.add('explanations', {
    languageCode,
    bookNumber,
    limit,
    requestedBy: req.auth.user.id,
  });

  await audit.record(req, {
    action: 'ai.job.explanations',
    entityType: 'AiJob',
    entityId: job.id,
    after: { languageCode, bookNumber, limit },
  });

  return ok(res, { jobId: job.id, queued: true });
};

/**
 * GET /api/admin/ai/coverage
 * What the batch passes have and have not reached yet — the worklist.
 */
export const coverage = async (req, res) => {
  const [eligible, withIssues, withExplanation] = await Promise.all([
    prisma.verse.count({ where: { isSlokaEligible: true } }),
    prisma.verse.count({ where: { isSlokaEligible: true, issueLinks: { some: {} } } }),
    prisma.verse.count({
      where: { isSlokaEligible: true, explanations: { some: { languageCode: 'en' } } },
    }),
  ]);

  return ok(res, {
    eligibleVerses: eligible,
    mappedToIssues: withIssues,
    withEnglishExplanation: withExplanation,
    remaining: {
      issueMapping: eligible - withIssues,
      explanations: eligible - withExplanation,
    },
  });
};
