// Where the translated chapters, their backups and the run's bookkeeping live. Two
// interchangeable stores with the same methods: S3 (the real thing: the bucket the scripture
// JSON is read from, using the SOURCE_* credentials) and a plain folder (tests and dry local
// runs).
//
// A translated chapter is one object per language beside the English and Sanskrit ones:
//   json/bhagavat-gita/en/ch-2.json     the English (already there)
//   json/bhagavat-gita/hi/ch-2.json     Hindi
// It grows one verse at a time, so it is rewritten after every verse — but only ever with a
// condition: `write` carries the tag (S3 ETag) of the object it read, and fails with a
// ConflictError if someone else changed it since. Nothing is overwritten blind.

import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

import { BOOK } from './claude-translate-source.js';

/** What a run is labelled with when TRANSLATION_VERSION is not set. */
export const DEFAULT_VERSION = '1.0-12-10-26';

/** The version a run is stamped with: TRANSLATION_VERSION, else the default. Safe to use in a file name. */
export function versionFrom(value) {
  const version = (value || '').trim() || DEFAULT_VERSION;
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,39}$/.test(version)) {
    throw new Error(`TRANSLATION_VERSION "${version}" may only use letters, digits, ".", "_" and "-" (at most 40 characters)`);
  }
  return version;
}

/** `json/bhagavat-gita/<lang>/ch-<n>.json` — next to the English (`en/`) and Sanskrit (`sa/`) chapter files. */
export const langChapterKey = (lang, chapterNumber) => `json/${BOOK}/${lang}/ch-${chapterNumber}.json`;

/** The run's bookkeeping (spend, last verse, the "a run is active" flag), one per translation version. */
export const checkpointKey = (version) => `json/reports/translate-${BOOK}-${version}.json`;

/** Where a copy of an existing object goes before it is first changed: the folder `upload-verse-source.js` uses. */
export const backupKey = (key, date = new Date()) => `json-backup-${date.toISOString().slice(0, 10)}/${key}`;

/** The object was changed (or created) by someone else since it was read. */
export class ConflictError extends Error {}

/** Store backed by S3, using the client and bucket from lib/source-s3.js. */
export async function s3Store() {
  const { CopyObjectCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const { client, bucket } = await import('./source-s3.js');
  if (!client) throw new Error('SOURCE_LOCAL_DIR is set — S3 output needs the real bucket. Unset it, or use --local-store <dir>.');

  const missing = (err) => err.name === 'NoSuchKey' || err.name === 'NotFound' || err.$metadata?.httpStatusCode === 404;

  async function size(key) {
    try {
      return (await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))).ContentLength;
    } catch (err) {
      if (missing(err)) return null;
      throw err;
    }
  }

  async function read(key) {
    try {
      const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      return { json: JSON.parse(await res.Body.transformToString()), tag: res.ETag };
    } catch (err) {
      if (missing(err)) return null;
      throw err;
    }
  }

  return {
    describe: `s3://${bucket}/`,
    read,
    getJson: async (key) => (await read(key))?.json ?? null,
    /** Writes `body` only if the object is still the one read (`tag`), or does not exist yet (`tag` null). → the new tag. */
    async write(key, body, tag = null) {
      try {
        const res = await client.send(new PutObjectCommand({
          Bucket: bucket, Key: key, Body: body, ContentType: 'application/json', ...(tag ? { IfMatch: tag } : { IfNoneMatch: '*' }),
        }));
        return res.ETag;
      } catch (err) {
        const status = err.$metadata?.httpStatusCode;
        // 412: the condition failed. 409: another conditional write to the same key was in flight.
        if (status === 412 || status === 409 || err.name === 'PreconditionFailed' || err.name === 'ConditionalRequestConflict') throw new ConflictError(key);
        throw err;
      }
    },
    /** Unconditional write, for the run's own bookkeeping. */
    async put(key, body) {
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body, ContentType: 'application/json' }));
    },
    /** Copies `key` to its backup key and checks the copy. Keeps an earlier backup of the same day. → the backup key. */
    async backup(key) {
      const to = backupKey(key);
      const want = await size(key);
      if (want == null) return null;
      if ((await size(to)) == null) {
        await client.send(new CopyObjectCommand({ Bucket: bucket, Key: to, CopySource: `${bucket}/${key}` }));
        if ((await size(to)) !== want) throw new Error(`backup of ${key} to ${to} does not match the original`);
      }
      return to;
    },
  };
}

/** Store backed by a local folder laid out like the bucket. */
export function dirStore(dir) {
  const path = (key) => join(dir, key);
  const tagOf = (buf) => createHash('sha1').update(buf).digest('hex');
  const write = (key, body) => {
    mkdirSync(dirname(path(key)), { recursive: true });
    const tmp = `${path(key)}.tmp`;
    writeFileSync(tmp, body);
    renameSync(tmp, path(key));
  };
  const read = async (key) => {
    if (!existsSync(path(key))) return null;
    const buf = readFileSync(path(key));
    return { json: JSON.parse(buf.toString('utf8')), tag: tagOf(buf) };
  };
  return {
    describe: `${dir}/`,
    read,
    getJson: async (key) => (await read(key))?.json ?? null,
    async write(key, body, tag = null) {
      const current = existsSync(path(key)) ? tagOf(readFileSync(path(key))) : null;
      if (current !== tag) throw new ConflictError(key);
      write(key, body);
      return tagOf(Buffer.from(body));
    },
    async put(key, body) {
      write(key, body);
    },
    async backup(key) {
      const to = backupKey(key);
      if (!existsSync(path(key))) return null;
      if (!existsSync(path(to))) {
        mkdirSync(dirname(path(to)), { recursive: true });
        copyFileSync(path(key), path(to));
        if (statSync(path(to)).size !== statSync(path(key)).size) throw new Error(`backup of ${key} to ${to} does not match the original`);
      }
      return to;
    },
  };
}

/**
 * A throwaway copy of the layout under `root` (for `--test`): reads fall back to the real object
 * — a Hindi chapter that already exists is the starting point — but every write goes under `root`,
 * so the real chapter files and the real bookkeeping are never touched.
 */
export function testStore(real, root) {
  const to = (key) => root + key;
  const read = async (key) => {
    const own = await real.read(to(key));
    if (own || key.startsWith('json/reports/')) return own; // the real bookkeeping is not this run's
    const original = await real.read(key);
    // The copy under `root` does not exist yet, so the first write there is a create.
    return original ? { json: original.json, tag: null } : null;
  };
  return {
    describe: `${real.describe}${root}`,
    read,
    getJson: async (key) => (await read(key))?.json ?? null,
    write: (key, body, tag) => real.write(to(key), body, tag),
    put: (key, body) => real.put(to(key), body),
    backup: async () => null,
  };
}
