// The pure half of the book export: how a unit becomes bytes, how those bytes
// become a hash, and whether a unit needs uploading. No I/O, so it is tested
// without a database or a bucket (test/book-cache.test.js).

import crypto from 'node:crypto';
import zlib from 'node:zlib';

/**
 * JSON with every object's keys sorted, at every depth, and no whitespace.
 * `JSON.stringify` keeps insertion order, and Prisma/Postgres do not promise one,
 * so without this the same content could hash differently from run to run and
 * every unit would be re-uploaded weekly for nothing. `undefined` is dropped,
 * as JSON.stringify does.
 */
function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null';
  if (value instanceof Date) return JSON.stringify(value.toISOString());
  if (Array.isArray(value)) return `[${value.map((v) => canonicalize(v === undefined ? null : v)).join(',')}]`;
  const parts = [];
  for (const key of Object.keys(value).sort()) {
    if (value[key] === undefined) continue;
    parts.push(`${JSON.stringify(key)}:${canonicalize(value[key])}`);
  }
  return `{${parts.join(',')}}`;
}

const sha256 = (data) => crypto.createHash('sha256').update(data).digest('hex');

/**
 * Bytes and hash for one unit's body. The hash is of the uncompressed bytes —
 * what the app has after decompressing — so the app checks what it holds against
 * the manifest without caring how the transfer was encoded.
 */
function serialize(body) {
  const bytes = Buffer.from(canonicalize(body), 'utf8');
  return { bytes, hash: sha256(bytes), sizeBytes: bytes.length };
}

// mtime 0 and a fixed level: the same input gives the same bytes on every run.
const gzip = (bytes) => zlib.gzipSync(bytes, { level: 9, mtime: 0 });

/**
 * Whether a unit must be uploaded.
 *   existing  the manifest row for this unit, or null
 *   hash      hash of the freshly built unit
 *   fileExists  whether the S3 object is really there (null = not checked)
 * Returns 'create' | 'update' | 'repair' | 'skip'. 'repair' is the case where the
 * manifest says the file exists and it does not — re-uploaded at the same
 * version, because the content did not change.
 */
function plan(existing, hash, fileExists = true) {
  if (!existing) return 'create';
  if (existing.hash !== hash) return 'update';
  if (fileExists === false) return 'repair';
  return 'skip';
}

/** The version a unit carries after [action]. Repairs do not bump it. */
function nextVersion(existing, action) {
  if (action === 'create') return 1;
  if (action === 'update') return (existing?.version ?? 0) + 1;
  return existing.version;
}

/** Delay before retry [attempt] (1-based): base, 2×base, 4×base … with jitter. */
function backoffMs(attempt, baseMs, random = Math.random) {
  const exp = baseMs * 2 ** (attempt - 1);
  return Math.round(exp * (0.75 + random() * 0.5));
}

/** Runs [fn] up to [retries] times, waiting [sleep](backoffMs) between tries. */
async function withRetry(fn, { retries, baseMs, sleep = (ms) => new Promise((r) => setTimeout(r, ms)), onRetry }) {
  let lastError;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
      onRetry?.(err, attempt);
      await sleep(backoffMs(attempt, baseMs));
    }
  }
  throw lastError;
}

export { canonicalize, sha256, serialize, gzip, plan, nextVersion, backoffMs, withRetry };
