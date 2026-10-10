// Server health, storage and product analytics for the admin panel. Kept
// separate from controllers/admin/dashboard.js: that one is counts a human
// checks every day, this one is "is the box OK" plus "what are people
// actually doing" — different audiences, different refresh cadence.

import os from 'node:os';
import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

import { prisma } from '../../config/database.js';
import { redis } from '../../config/redis.js';
import * as logBuffer from '../../config/log-buffer.js';
import * as s3 from '../../services/s3.js';
import { ok } from '../../utils/respond.js';
import { localDateString, toDateColumn, shiftDays } from '../../utils/date.js';

/**
 * GET /api/admin/system/health
 * Process and database vitals — enough to answer "is the box OK" without a
 * separate monitoring service. This is the one API process only; the worker,
 * websocket and deeplink containers each run their own.
 */
export const health = async (req, res) => {
  const mem = process.memoryUsage();

  const [{ size: dbSizeBytes }] = await prisma.$queryRaw`
    SELECT pg_database_size(current_database()) AS size
  `;

  return ok(res, {
    process: {
      uptimeSeconds: Math.round(process.uptime()),
      nodeVersion: process.version,
      memory: { rssBytes: mem.rss, heapUsedBytes: mem.heapUsed, heapTotalBytes: mem.heapTotal },
    },
    os: {
      loadAvg: os.loadavg(),
      cpuCount: os.cpus().length,
      freeMemBytes: os.freemem(),
      totalMemBytes: os.totalmem(),
    },
    database: {
      sizeBytes: Number(dbSizeBytes),
    },
  });
};

const STORAGE_CACHE_KEY = 'admin:storage-summary';
const STORAGE_CACHE_TTL = 600; // 10 minutes — a full bucket listing is not free

async function localStorageSummary() {
  const byKind = [];
  for (const [kind, prefix] of Object.entries(s3.PREFIXES)) {
    let sizeBytes = 0;
    let count = 0;
    // The saved location, and the one from before everything moved under hariharibol/.
    for (const dir of [path.join(s3.LOCAL_STORAGE_ROOT, s3.ROOT, prefix), path.join(s3.LOCAL_STORAGE_ROOT, prefix)]) {
      try {
        for (const file of await readdir(dir)) {
          const stats = await stat(path.join(dir, file));
          if (stats.isFile()) {
            sizeBytes += stats.size;
            count += 1;
          }
        }
      } catch {
        // Directory doesn't exist yet — nothing uploaded of this kind.
      }
    }
    byKind.push({ kind, sizeBytes, count });
  }
  return byKind;
}

async function s3StorageSummary() {
  const totals = new Map(Object.keys(s3.PREFIXES).map((kind) => [kind, { sizeBytes: 0, count: 0 }]));
  const prefixToKind = new Map(Object.entries(s3.PREFIXES).map(([kind, prefix]) => [prefix, kind]));

  let ContinuationToken;
  do {
    const page = await s3.client.send(
      new ListObjectsV2Command({ Bucket: s3.BUCKET, ContinuationToken, MaxKeys: 1000 })
    );
    for (const obj of page.Contents ?? []) {
      if (s3.isTempKey(obj.Key)) continue; // unsaved uploads are not content
      const topPrefix = [...prefixToKind.keys()].find((p) => s3.keyHasPrefix(obj.Key, p));
      const kind = topPrefix ? prefixToKind.get(topPrefix) : null;
      const bucket = kind ? totals.get(kind) : null;
      if (bucket) {
        bucket.sizeBytes += obj.Size ?? 0;
        bucket.count += 1;
      }
    }
    ContinuationToken = page.IsTruncated ? page.NextContinuationToken : undefined;
  } while (ContinuationToken);

  return [...totals.entries()].map(([kind, v]) => ({ kind, ...v }));
}

/**
 * GET /api/admin/system/storage
 * Bytes and object count per upload kind (mantra audio, reel video, …).
 * Cached for ten minutes — a full bucket listing is one S3 call per 1,000
 * objects, not something to pay for on every dashboard load.
 */
export const storage = async (req, res) => {
  const cached = await redis.get(STORAGE_CACHE_KEY).catch(() => null);
  if (cached) return ok(res, JSON.parse(cached));

  const byKind = s3.useLocalStorage ? await localStorageSummary() : await s3StorageSummary();
  const totalBytes = byKind.reduce((sum, k) => sum + k.sizeBytes, 0);
  const payload = { mode: s3.useLocalStorage ? 'local' : 's3', totalBytes, byKind, cachedAt: new Date().toISOString() };

  await redis.set(STORAGE_CACHE_KEY, JSON.stringify(payload), 'EX', STORAGE_CACHE_TTL).catch(() => null);
  return ok(res, payload);
};

/**
 * GET /api/admin/system/logs
 * The last N lines this process has logged, redacted the same way stdout is
 * — see config/logger.js. Not a log aggregator: restart the process and the
 * buffer is empty again.
 */
export const logs = async (req, res) => {
  const limit = req.valid.query.limit || 200;
  return ok(res, logBuffer.recent(limit));
};

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index];
}

/**
 * GET /api/admin/system/requests
 * Response times and status codes, read straight out of the same ring buffer
 * as /logs — pino-http (app.js) already logs "request completed" with
 * `req`, `res` and `responseTime` on every request, so this is a filter over
 * that, not a second tracking system. Same caveat as /logs: only as far back
 * as the buffer goes, and only this process.
 */
export const requests = async (req, res) => {
  const entries = logBuffer
    .recent(500)
    .filter((line) => line.req && line.res && typeof line.responseTime === 'number')
    .map((line) => ({
      method: line.req.method,
      path: line.req.url.split('?')[0],
      status: line.res.statusCode,
      durationMs: line.responseTime,
      at: line.time,
    }));

  const durations = entries.map((e) => e.durationMs).sort((a, b) => a - b);
  const byStatusClass = { '2xx': 0, '3xx': 0, '4xx': 0, '5xx': 0 };
  for (const e of entries) {
    const key = `${Math.floor(e.status / 100)}xx`;
    if (byStatusClass[key] !== undefined) byStatusClass[key] += 1;
  }

  return ok(res, {
    recent: entries.slice(-100).reverse(),
    summary: {
      count: entries.length,
      avgDurationMs: durations.length ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length) : 0,
      p95DurationMs: percentile(durations, 95),
      byStatusClass,
    },
    slowest: [...entries].sort((a, b) => b.durationMs - a.durationMs).slice(0, 10),
  });
};

/**
 * GET /api/admin/system/analytics
 * DAU/WAU/MAU from User.lastActiveAt (a live cross-section — there is no
 * historical log of who was active on a past day, only "most recently
 * active when"), a 30-day Sadhana activity trend (SadhanaDay does have a
 * date per user, so that one is a real time series), and what people are
 * actually chanting and watching.
 */
export const analytics = async (req, res) => {
  const today = localDateString('Asia/Kolkata');
  const dayStart = toDateColumn(today);
  const weekAgo = toDateColumn(shiftDays(today, -7));
  const monthAgo = toDateColumn(shiftDays(today, -30));
  const rangeStart = toDateColumn(shiftDays(today, -30));

  const [dau, wau, mau, sadhanaSeries, mantraRows, reels] = await Promise.all([
    prisma.user.count({ where: { lastActiveAt: { gte: dayStart } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: weekAgo } } }),
    prisma.user.count({ where: { lastActiveAt: { gte: monthAgo } } }),
    prisma.$queryRaw`
      SELECT "date"::text AS date, COUNT(DISTINCT "userId")::int AS "activeUsers"
      FROM "SadhanaDay"
      WHERE "date" >= ${rangeStart} AND ("roundsCompleted" > 0 OR "tasksDone" > 0)
      GROUP BY "date"
      ORDER BY "date" ASC
    `,
    prisma.chantSession.groupBy({
      by: ['mantraId'],
      where: { mantraId: { not: null }, createdAt: { gte: monthAgo } },
      _sum: { rounds: true },
      _count: { _all: true },
      orderBy: { _sum: { rounds: 'desc' } },
      take: 10,
    }),
    prisma.reel.findMany({
      where: { status: 'PUBLISHED' },
      orderBy: { viewCount: 'desc' },
      take: 10,
      select: {
        id: true,
        caption: true,
        viewCount: true,
        likeCount: true,
        commentCount: true,
        shareCount: true,
        creator: { select: { displayName: true } },
      },
    }),
  ]);

  const mantras = await prisma.mantra.findMany({
    where: { id: { in: mantraRows.map((r) => r.mantraId) } },
    select: { id: true, name: true },
  });
  const mantraById = new Map(mantras.map((m) => [m.id, m.name]));

  return ok(res, {
    activeUsers: { daily: dau, weekly: wau, monthly: mau },
    sadhanaActivity: sadhanaSeries,
    topMantras: mantraRows.map((r) => ({
      mantraId: r.mantraId,
      name: mantraById.get(r.mantraId) ?? 'Unknown',
      sessions: r._count._all,
      rounds: r._sum.rounds ?? 0,
    })),
    topReels: reels.map((r) => ({
      id: r.id,
      caption: r.caption,
      creatorName: r.creator.displayName,
      viewCount: r.viewCount,
      likeCount: r.likeCount,
      commentCount: r.commentCount,
      shareCount: r.shareCount,
    })),
  });
};
