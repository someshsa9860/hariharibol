// Run a fixed list of backend scripts from the admin panel. See
// config/maintenance.js for the list and services/maintenance.js for the runner.

import * as maintenance from '../../services/maintenance.js';
import { ok } from '../../utils/respond.js';

/** GET /api/admin/maintenance — the commands, and the current or a named run's output from `since`. */
export const overview = async (req, res) => {
  const { since, run } = req.valid.query;
  return ok(res, maintenance.snapshot(since, run));
};

/** POST /api/admin/maintenance/run */
export const run = async (req, res) => ok(res, await maintenance.start(req, req.valid.body.command));
