// The console — a short list of backend commands and a SQL box, for super admins.
//
// Both are deliberately narrow:
//   • Commands are a fixed list (below). Nothing the browser sends is ever turned
//     into a shell string — the id picks an entry, and the few arguments an entry
//     takes are validated and passed as separate argv items, never through a shell.
//   • SQL runs in one transaction with a statement timeout. Read mode is a READ ONLY
//     transaction, so Postgres itself refuses any write. Write mode needs an explicit
//     confirmation and rolls back unless told otherwise.
// Every run, success or failure, is written to the audit log.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { prisma } from '../../config/database.js';
import * as audit from '../../services/audit.js';
import { ok, created } from '../../utils/respond.js';
import { badRequest, notFound, conflict } from '../../utils/errors.js';

const BACKEND_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PRISMA_BIN = path.join(BACKEND_DIR, 'node_modules', '.bin', 'prisma');

// ── Commands ───────────────────────────────────────────────────────────────

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SLUG = /^[a-z][a-z0-9_]{1,40}$/;

// `argv` builds the child's argument list from the validated params. `risk` only
// changes how the panel asks for confirmation. Long-running generators
// (translate:*) are left out on purpose — they have their own pages and queues.
const COMMANDS = [
  {
    id: 'seed',
    title: 'Seed reference data',
    description:
      'Upserts permissions, roles, languages, deities, gurus and plans. Safe to repeat, but it resets each standard role to its default permissions.',
    risk: 'caution',
    argv: () => ['npm', 'run', 'seed'],
  },
  {
    id: 'recount-books',
    title: 'Recount books, cantos and chapters',
    description: 'Rebuilds the verse counts from the verse rows.',
    risk: 'safe',
    argv: () => ['npm', 'run', 'recount:books'],
  },
  {
    id: 'cache-books',
    title: 'Export the offline book cache',
    description: 'Writes the book export to S3 that phones sync from (normally weekly).',
    risk: 'safe',
    argv: () => ['npm', 'run', 'cache:books'],
  },
  {
    id: 'backfill-sampradaya',
    title: 'Backfill sampradaya',
    description: 'Fills the sampradaya on rows that are missing it.',
    risk: 'caution',
    argv: () => ['npm', 'run', 'backfill:sampradaya'],
  },
  {
    id: 'fill-status',
    title: 'Fill status report',
    description: 'Reports how complete the Prabhupāda source text is.',
    risk: 'safe',
    argv: () => ['npm', 'run', 'fill:status'],
  },
  {
    id: 'promote-user',
    title: 'Give a user a role',
    description: 'Sets the role of an account that has already signed in once. Defaults to super_admin.',
    risk: 'danger',
    params: [
      { name: 'email', label: 'Email', placeholder: 'someone@example.com', required: true },
      { name: 'role', label: 'Role slug', placeholder: 'super_admin', required: false },
    ],
    validate: ({ email, role }) => {
      if (!EMAIL.test(email || '')) throw badRequest('Enter a valid email address');
      if (role && !SLUG.test(role)) throw badRequest('A role slug is lowercase letters, digits and underscores');
    },
    argv: ({ email, role }) => ['npm', 'run', 'promote-admin', '--', email, role || 'super_admin'],
  },
  {
    id: 'migrate-status',
    title: 'Migration status',
    description: 'Which Prisma migrations are applied and which are pending.',
    risk: 'safe',
    needs: PRISMA_BIN,
    argv: () => [PRISMA_BIN, 'migrate', 'status'],
  },
  {
    id: 'migrate-deploy',
    title: 'Apply pending migrations',
    description: 'prisma migrate deploy — applies every migration not yet in the database.',
    risk: 'danger',
    needs: PRISMA_BIN,
    argv: () => [PRISMA_BIN, 'migrate', 'deploy'],
  },
];

const MAX_OUTPUT = 200_000;
const MAX_RUNS = 20;
const RUN_TIMEOUT_MS = 10 * 60 * 1000;

// Kept in memory: this is a tool for one person at a time, the output is only
// interesting while it is running, and the audit log keeps the durable record.
// Because it is memory, it is per API process — behind several replicas the
// status poll could land on another one.
const runs = new Map();
let active = null;

const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

const describe = (cmd) => ({
  id: cmd.id,
  title: cmd.title,
  description: cmd.description,
  risk: cmd.risk,
  params: cmd.params ?? [],
  available: !cmd.needs || existsSync(cmd.needs),
  unavailableReason:
    cmd.needs && !existsSync(cmd.needs)
      ? 'The Prisma CLI is not installed in this deployment (it is a dev dependency). Run it from your machine or the deploy script.'
      : null,
});

const view = (run) => ({
  id: run.id,
  commandId: run.commandId,
  title: run.title,
  status: run.status,
  exitCode: run.exitCode,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  truncated: run.truncated,
  output: run.output,
});

/** GET /api/admin/console/commands */
export const listCommands = async (req, res) => {
  const recent = [...runs.values()].reverse().map((run) => ({ ...view(run), output: undefined }));
  return ok(res, { commands: COMMANDS.map(describe), recent, activeRunId: active });
};

/** POST /api/admin/console/commands/:id/run */
export const runCommand = async (req, res) => {
  const cmd = COMMANDS.find((c) => c.id === req.valid.params.id);
  if (!cmd) throw notFound('Command');
  if (!describe(cmd).available) throw badRequest(describe(cmd).unavailableReason);
  if (active) throw conflict('Another command is still running — wait for it to finish');

  const params = req.valid.body.params ?? {};
  const known = new Set((cmd.params ?? []).map((p) => p.name));
  for (const key of Object.keys(params)) if (!known.has(key)) throw badRequest(`Unknown parameter: ${key}`);
  for (const p of cmd.params ?? []) {
    if (p.required && !String(params[p.name] ?? '').trim()) throw badRequest(`${p.label} is required`);
  }
  cmd.validate?.(params);

  const [file, ...args] = cmd.argv(params);
  const run = {
    id: randomUUID(),
    commandId: cmd.id,
    title: cmd.title,
    status: 'running',
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    truncated: false,
    output: '',
  };
  runs.set(run.id, run);
  while (runs.size > MAX_RUNS) runs.delete(runs.keys().next().value);
  active = run.id;

  const append = (chunk) => {
    if (run.output.length >= MAX_OUTPUT) {
      run.truncated = true;
      return;
    }
    run.output += chunk.toString().replace(ANSI, '');
  };

  const finish = (status, exitCode) => {
    if (run.status !== 'running') return;
    run.status = status;
    run.exitCode = exitCode;
    run.finishedAt = new Date().toISOString();
    if (active === run.id) active = null;
    audit.record(req, {
      action: 'console.command',
      entityType: 'console',
      entityId: run.id,
      after: { command: cmd.id, params, status, exitCode },
    });
  };

  // No shell: argv goes to the program as-is, so a value can never become a command.
  const child = spawn(file, args, { cwd: BACKEND_DIR, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => {
    append('\n— stopped: ran longer than 10 minutes —\n');
    child.kill('SIGKILL');
    finish('timeout', null);
  }, RUN_TIMEOUT_MS);

  child.stdout.on('data', append);
  child.stderr.on('data', append);
  child.on('error', (err) => {
    clearTimeout(timer);
    append(`\n${err.message}\n`);
    finish('failed', null);
  });
  child.on('close', (code) => {
    clearTimeout(timer);
    finish(code === 0 ? 'succeeded' : 'failed', code);
  });

  return created(res, view(run));
};

/** GET /api/admin/console/runs/:id */
export const getRun = async (req, res) => {
  const run = runs.get(req.valid.params.id);
  if (!run) throw notFound('Run');
  return ok(res, view(run));
};

// ── SQL ────────────────────────────────────────────────────────────────────

const MAX_ROWS = 1000;
const STATEMENT_TIMEOUT_MS = 15_000;

// A comment or leading whitespace must not hide what a statement starts with.
const stripLeading = (sql) => sql.replace(/^(\s+|--[^\n]*\n?|\/\*[\s\S]*?\*\/)+/, '');
const firstWord = (sql) => (stripLeading(sql).match(/^[a-zA-Z]+/)?.[0] ?? '').toLowerCase();

const READ_WORDS = new Set(['select', 'with', 'show', 'explain', 'values', 'table']);
// Transaction control would end the guarded transaction early; SET/RESET could
// loosen it. Neither has a use in a one-statement box.
const CONTROL_WORDS = new Set(['begin', 'start', 'commit', 'end', 'rollback', 'abort', 'savepoint', 'release', 'set', 'reset']);

// Makes rows JSON-safe: BigInt (counts, ids), Buffer (bytea), Date handled by JSON.
function plain(value) {
  if (typeof value === 'bigint') return value.toString();
  if (Buffer.isBuffer(value)) return `\\x${value.toString('hex')}`;
  if (Array.isArray(value)) return value.map(plain);
  if (value && typeof value === 'object' && !(value instanceof Date) && typeof value.toJSON !== 'function') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, plain(v)]));
  }
  return value;
}

/** POST /api/admin/console/sql */
export const runSql = async (req, res) => {
  const { mode, confirm, dryRun } = req.valid.body;
  const sql = req.valid.body.sql.trim().replace(/;+\s*$/, '');
  if (!sql) throw badRequest('Write a query first');

  const word = firstWord(sql);
  if (CONTROL_WORDS.has(word)) {
    throw badRequest(`"${word.toUpperCase()}" is not allowed here — each run is already its own transaction`);
  }
  if (mode === 'read' && !READ_WORDS.has(word)) {
    throw badRequest('Read mode takes SELECT, WITH, SHOW, EXPLAIN, VALUES or TABLE. Switch to write mode for anything else.');
  }
  if (mode === 'write' && !confirm) throw badRequest('Confirm the write first');

  const started = Date.now();
  const entry = { mode, sql: sql.slice(0, 4000), dryRun: mode === 'write' ? dryRun : undefined };

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        if (mode === 'read') await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
        await tx.$executeRawUnsafe(`SET LOCAL statement_timeout = ${STATEMENT_TIMEOUT_MS}`);

        // Rows come back from anything that selects or has RETURNING; the rest only
        // report how many rows they touched.
        const returnsRows = READ_WORDS.has(word) || /\breturning\b/i.test(sql);
        let out;
        if (returnsRows) {
          // Capped in the database for SELECT/WITH so a huge table is never pulled whole.
          const capped = word === 'select' || word === 'with' ? `SELECT * FROM (\n${sql}\n) AS console_q LIMIT ${MAX_ROWS + 1}` : sql;
          const rows = await tx.$queryRawUnsafe(capped);
          out = { kind: 'rows', rows: plain(rows.slice(0, MAX_ROWS)), truncated: rows.length > MAX_ROWS };
        } else {
          out = { kind: 'count', affected: await tx.$executeRawUnsafe(sql) };
        }

        // Undo a write that was only a trial. Throwing is how Prisma rolls back.
        if (mode === 'write' && dryRun) throw Object.assign(new Error('dry-run'), { dryRunResult: out });
        return out;
      },
      { timeout: STATEMENT_TIMEOUT_MS + 5000, maxWait: 5000 }
    ).catch((err) => {
      if (err?.dryRunResult) return { ...err.dryRunResult, rolledBack: true };
      throw err;
    });

    const ms = Date.now() - started;
    audit.record(req, {
      action: 'console.sql',
      entityType: 'console',
      after: { ...entry, ok: true, ms, rows: result.rows?.length, affected: result.affected, rolledBack: result.rolledBack || false },
    });

    return ok(res, {
      ...result,
      columns: result.rows?.[0] ? Object.keys(result.rows[0]) : [],
      rowLimit: MAX_ROWS,
      ms,
    });
  } catch (err) {
    audit.record(req, { action: 'console.sql', entityType: 'console', after: { ...entry, ok: false, error: String(err.message).slice(0, 500) } });
    // A bad query is the caller's, not a server bug — show Postgres' own message.
    throw badRequest(String(err.meta?.message ?? err.message).replace(/^\s*Invalid `[^`]*` invocation:?\s*/s, '').trim().slice(0, 1500));
  }
};

/** GET /api/admin/console/schema — every table and its columns, for the side panel. */
export const schema = async (req, res) => {
  const rows = await prisma.$queryRaw`
    SELECT c.table_name AS "table", c.column_name AS "column", c.data_type AS "type",
           c.is_nullable = 'YES' AS "nullable",
           COALESCE(pc.reltuples, 0)::bigint AS "estimate"
    FROM information_schema.columns c
    LEFT JOIN pg_class pc ON pc.relname = c.table_name AND pc.relkind = 'r'
    WHERE c.table_schema = 'public'
    ORDER BY c.table_name, c.ordinal_position`;

  const tables = new Map();
  for (const r of rows) {
    if (!tables.has(r.table)) tables.set(r.table, { name: r.table, estimate: Math.max(0, Number(r.estimate)), columns: [] });
    tables.get(r.table).columns.push({ name: r.column, type: r.type, nullable: r.nullable });
  }
  return ok(res, [...tables.values()]);
};
