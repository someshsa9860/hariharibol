// A small in-memory ring buffer of this process's recent log lines, read by
// the admin panel's live log view (routes/admin/system.js). Deliberately not
// a log aggregator — it only holds what the API process itself has logged
// since it last restarted, and the worker/websocket/deeplink containers keep
// their own buffers, unseen here. Good enough for "what just happened," not a
// shipped, searchable log history.

const MAX_LINES = 500;
const lines = [];

function push(entry) {
  lines.push(entry);
  if (lines.length > MAX_LINES) lines.shift();
}

function recent(limit = 200) {
  return lines.slice(-limit);
}

export { push, recent };
