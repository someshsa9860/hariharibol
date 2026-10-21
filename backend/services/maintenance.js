// Runs one allowlisted npm script at a time and keeps its output for the admin
// page to read. State is in this process's memory: a restart forgets the
// output, and with more than one API container each has its own run — the audit
// log is the record that outlasts both.

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { maintenance } from '../config/maintenance.js';
import * as audit from './audit.js';
import logger from '../config/logger.js';
import { conflict, notFound } from '../utils/errors.js';

const root = fileURLToPath(new URL('..', import.meta.url));

let current = null;
const finished = [];

const view = (run, since = 0) => ({
  id: run.id,
  command: run.command,
  status: run.status, // running | succeeded | failed | timed_out
  exitCode: run.exitCode,
  startedAt: run.startedAt,
  finishedAt: run.finishedAt,
  startedBy: run.startedBy,
  // Output is addressed by character count so the page can ask only for the new part.
  offset: run.dropped + run.output.length,
  output: run.output.slice(Math.max(0, since - run.dropped)),
  dropped: run.dropped,
});

export const list = () => maintenance.commands.map(({ id, title, description }) => ({ id, title, description }));

export const snapshot = (since = 0, runId) => {
  const run = [current, ...finished].find((r) => r && (!runId || r.id === runId)) ?? null;
  return {
    commands: list(),
    running: !!current,
    run: run ? view(run, runId === run.id ? since : 0) : null,
    history: finished.map((r) => ({ id: r.id, command: r.command, status: r.status, exitCode: r.exitCode, startedAt: r.startedAt, finishedAt: r.finishedAt, startedBy: r.startedBy })),
  };
};

export const start = async (req, id) => {
  const command = maintenance.commands.find((c) => c.id === id);
  if (!command) throw notFound('Command');
  if (current) throw conflict(`“${current.command.title}” is still running`);

  const run = {
    id: randomUUID(),
    command: { id: command.id, title: command.title },
    status: 'running',
    exitCode: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    startedBy: req.auth.user.name || req.auth.user.email || String(req.auth.user.id),
    output: '',
    dropped: 0,
  };
  current = run;

  const append = (chunk) => {
    run.output += chunk.toString();
    const over = run.output.length - maintenance.maxOutputBytes;
    if (over > 0) {
      run.output = run.output.slice(over);
      run.dropped += over;
    }
  };

  const child = spawn('npm', ['run', command.script], { cwd: root, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] });
  const timer = setTimeout(() => {
    run.status = 'timed_out';
    append(`\n[stopped: ran longer than ${Math.round(maintenance.timeoutMs / 60000)} minutes]\n`);
    child.kill('SIGKILL');
  }, maintenance.timeoutMs);

  child.stdout.on('data', append);
  child.stderr.on('data', append);

  const settle = (code, error) => {
    if (current !== run) return;
    clearTimeout(timer);
    if (error) append(`\n[could not start: ${error.message}]\n`);
    run.exitCode = code;
    if (run.status === 'running') run.status = code === 0 ? 'succeeded' : 'failed';
    run.finishedAt = new Date().toISOString();
    current = null;
    finished.unshift(run);
    finished.length = Math.min(finished.length, maintenance.keepRuns);
    audit
      .record(req, { action: 'maintenance.finish', entityType: 'Maintenance', entityId: run.id, after: { command: command.script, status: run.status, exitCode: code } })
      .catch((err) => logger.error({ err: err.message }, 'could not record a maintenance run'));
  };
  child.on('error', (error) => settle(null, error));
  child.on('close', (code) => settle(code));

  await audit.record(req, { action: 'maintenance.start', entityType: 'Maintenance', entityId: run.id, after: { command: command.script } });
  return view(run);
};
