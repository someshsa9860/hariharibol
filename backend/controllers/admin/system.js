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
import * as presence from '../../services/presence.js';
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
    distinctActive(dayStart),
    distinctActive(weekAgo),
    distinctActive(monthAgo),
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


// People active on or after a day: from the daily record (UserActiveDay), which is the true history.
async function distinctActive(since) {
  const [row] = await prisma.$queryRaw`SELECT COUNT(DISTINCT "userId")::int AS n FROM "UserActiveDay" WHERE "date" >= ${since}`;
  return row.n;
}

/**
 * GET /api/admin/system/activity?days=30
 * The history behind the headline numbers: a daily series of active users and new sign-ups, rolling weekly and
 * monthly actives, stickiness (DAU ÷ MAU), what share of each day's sign-ups came back on day 1 / 7 / 30, and
 * today's split by platform. Days are Indian calendar days, like the dashboard's.
 */
export const activity = async (req, res) => {
  const days = Math.min(Math.max(Number.parseInt(req.valid?.query?.days ?? '30', 10) || 30, 7), 180);
  const today = localDateString('Asia/Kolkata');
  const from = toDateColumn(shiftDays(today, -(days - 1)));
  const todayCol = toDateColumn(today);

  const [daily, signups, rolling, platformToday, newToday, retention, firstDay] = await Promise.all([
    prisma.$queryRaw`
      SELECT "date"::text AS date, COUNT(*)::int AS active
      FROM "UserActiveDay" WHERE "date" >= ${from} GROUP BY "date" ORDER BY "date"`,
    prisma.$queryRaw`
      SELECT (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date::text AS date, COUNT(*)::int AS signups
      FROM "User" WHERE "createdAt" >= ${from}::date - interval '1 day' GROUP BY 1 ORDER BY 1`,
    // For each day in range: people active in the 7 / 30 days ending that day.
    prisma.$queryRaw`
      SELECT d::date::text AS date,
        (SELECT COUNT(DISTINCT "userId")::int FROM "UserActiveDay" a WHERE a."date" > d::date - 7 AND a."date" <= d::date) AS wau,
        (SELECT COUNT(DISTINCT "userId")::int FROM "UserActiveDay" a WHERE a."date" > d::date - 30 AND a."date" <= d::date) AS mau
      FROM generate_series(${from}::date, ${todayCol}::date, interval '1 day') d ORDER BY d`,
    prisma.$queryRaw`
      SELECT COALESCE("platform", 'unknown') AS platform, COUNT(*)::int AS n
      FROM "UserActiveDay" WHERE "date" = ${todayCol} GROUP BY 1 ORDER BY n DESC`,
    prisma.$queryRaw`
      SELECT COUNT(*)::int AS n FROM "User"
      WHERE (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date = ${todayCol}`,
    // Cohort = people who joined that day; a retention figure exists only once that many days have passed.
    prisma.$queryRaw`
      WITH cohort AS (
        SELECT "id", (("createdAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Kolkata')::date AS joined
        FROM "User" WHERE "createdAt" >= ${toDateColumn(shiftDays(today, -60))}
      )
      SELECT
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 1)::int AS d1_base,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 1 AND EXISTS (SELECT 1 FROM "UserActiveDay" a WHERE a."userId" = cohort."id" AND a."date" = joined + 1))::int AS d1,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 7)::int AS d7_base,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 7 AND EXISTS (SELECT 1 FROM "UserActiveDay" a WHERE a."userId" = cohort."id" AND a."date" BETWEEN joined + 1 AND joined + 7))::int AS d7,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 30)::int AS d30_base,
        COUNT(*) FILTER (WHERE joined <= ${todayCol}::date - 30 AND EXISTS (SELECT 1 FROM "UserActiveDay" a WHERE a."userId" = cohort."id" AND a."date" BETWEEN joined + 1 AND joined + 30))::int AS d30
      FROM cohort`,
    prisma.$queryRaw`SELECT MIN("date")::text AS d FROM "UserActiveDay"`,
  ]);

  const byDate = (rows, key) => new Map(rows.map((r) => [r.date, r[key]]));
  const dailyMap = byDate(daily, 'active');
  const signupMap = byDate(signups, 'signups');
  const rollMap = new Map(rolling.map((r) => [r.date, r]));
  const series = [];
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = shiftDays(today, -i);
    const active = dailyMap.get(date) ?? 0;
    const roll = rollMap.get(date);
    series.push({ date, active, signups: signupMap.get(date) ?? 0, wau: roll?.wau ?? 0, mau: roll?.mau ?? 0, stickiness: roll?.mau ? Math.round((active / roll.mau) * 1000) / 10 : 0 });
  }
  const r = retention[0] || {};
  const pct = (n, base) => (base > 0 ? Math.round((n / base) * 1000) / 10 : null);

  return ok(res, {
    days,
    series,
    today: { active: dailyMap.get(today) ?? 0, newUsers: newToday[0]?.n ?? 0, byPlatform: platformToday },
    retention: { d1: pct(r.d1, r.d1_base), d7: pct(r.d7, r.d7_base), d30: pct(r.d30, r.d30_base), cohortSize: r.total ?? 0 },
    // The record starts when this was first deployed (older days are rebuilt from other tables and are approximate).
    historySince: firstDay[0]?.d ?? null,
  });
};

/**
 * GET /api/admin/system/live
 * Who is online right now (seen within five minutes), with the people themselves for the live list. The websocket
 * container publishes the same numbers on a timer (`presence.update`); this is the first paint and the fallback.
 */
export const live = async (req, res) => {
  const [counts, recent] = await Promise.all([presence.counts(), presence.recent(presence.ONLINE_WINDOW_S, 50)]);
  const people = await presence.describe(recent.map((r) => r.userId));
  const at = new Map(recent.map((r) => [r.userId, r.at]));
  return ok(res, {
    online: counts[presence.ONLINE_WINDOW_S],
    last15m: counts[900],
    lastHour: counts[3600],
    people: people.map((u) => ({ ...u, seenAt: at.get(u.id) })),
    at: Date.now(),
  });
};
