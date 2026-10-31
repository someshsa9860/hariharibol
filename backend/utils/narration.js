// The pure rules of the narration pages, as functions with no I/O (so `npm test` covers them): where a clip lives in
// S3, how a verse is cut to fit an engine's text limit, how clips are joined and how long they run, what a cost preview
// and a run look like to the admin panel, and what a failure from a text-to-speech engine means. The engines are in
// services/narration-engines.js, the run in jobs/processors/narration.js, the plumbing in services/narration.js.

import { createHash } from 'node:crypto';

import { narration } from '../config/narration.js';
import { bookOf, chapterLabel, chapterParts } from '../scripts/lib/claude-translate-source.js';
import { ConfigError, retryDelayMs } from './translation-run.js';

/** An engine's own answer that was not a success. `status` is the HTTP status; a network failure has none. */
export class EngineError extends Error {
  constructor(message, { engine, status }) {
    super(message);
    this.name = 'EngineError';
    this.engine = engine;
    this.status = status;
  }
}

/* ---------- where a clip lives ---------- */

/**
 * A folder or file name in S3, kept as it is when it is plain. Anything else is refused rather than changed: two different
 * names must never end up in the same folder.
 */
export function safeSegment(value) {
  const text = String(value ?? '');
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(text)) throw new Error(`"${text}" cannot be part of a narration file name`);
  return text;
}

/** One voice's folder: narration/api/<book>/<language>/<engine>/<model>/<voice>. Its clips and its _index.json sit in it. */
export function voiceFolder({ book, language, engine, model, voice }) {
  return [narration.folder, safeSegment(book), safeSegment(language), safeSegment(engine), safeSegment(model), safeSegment(voice)].join('/');
}

/** A chapter's folder inside a voice's: canto-<n>/ch-<n> for the Bhagavatam, ch-<n> for the Gita (no cantos). */
export function chapterFolder(chapterId, book) {
  const { canto, chapter } = chapterParts(chapterId, book);
  return canto == null ? `ch-${chapter}` : `canto-${canto}/ch-${chapter}`;
}

/**
 * The file one verse's clip is in. The verse is named by its number as the book gives it ("47", or "51-53" for a grouped
 * verse), so the path reads the way the book does.
 */
export function clipKey({ book, language, engine, model, voice, chapterId, verseNumber, ext }) {
  return `${voiceFolder({ book, language, engine, model, voice })}/${chapterFolder(chapterId, book)}/${safeSegment(verseNumber)}.${safeSegment(ext)}`;
}

/** The index of one voice's clips, kept beside them. */
export const indexKey = (target) => `${voiceFolder(target)}/${narration.indexFile}`;

/** A target as one string, the way a comparison's results name it: engine/model/voice. */
export const targetKey = ({ engine, model, voice }) => `${engine}/${model}/${voice}`;

/**
 * Whether a stored clip still says what the verse says now. It covers the text, the target and the pipeline version, so a
 * changed translation, a new voice or a bumped pipeline makes a new clip and an unchanged one is kept.
 */
export function textHash({ text, language, engine, model, voice }) {
  return createHash('sha256')
    .update(JSON.stringify([narration.pipelineVersion, language, engine, model, voice, String(text ?? '').trim()]))
    .digest('hex');
}

/**
 * Whether a clip already made can stand for a verse: it was made from the same text (the hash), and when the run is asked
 * to make everything again, only a clip made by this run stands (`since` is when the run first started).
 */
export function clipStands(clip, hash, { force = false, since = null } = {}) {
  if (!clip || clip.textHash !== hash) return false;
  if (!force) return true;
  return Boolean(since) && new Date(clip.updatedAt) >= new Date(since);
}

/* ---------- the text an engine is given ---------- */

const bytes = (text) => Buffer.byteLength(text, 'utf8');

/**
 * A verse's text cut into pieces an engine takes in one request, each at most `maxBytes` of UTF-8. Cuts fall at the end of a
 * sentence (a full stop, ?, ! or the Devanagari danda) where they can, then at a space; a word longer than the limit by
 * itself is cut between two characters. Whitespace is made single, which a voice does not hear.
 */
export function splitForEngine(text, maxBytes) {
  const clean = String(text ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const pieces = clean.split(/(?<=[.!?।])\s+/).flatMap((sentence) => smaller(sentence, maxBytes));
  return packed(pieces, maxBytes);
}

// A sentence longer than one request is cut at spaces; a word longer than one request is cut between characters.
function smaller(text, maxBytes) {
  if (bytes(text) <= maxBytes) return [text];
  const out = [];
  let current = '';
  for (const word of text.split(' ')) {
    if (bytes(word) > maxBytes) {
      if (current) out.push(current);
      out.push(...hardCut(word, maxBytes));
      current = '';
      continue;
    }
    const joined = current ? `${current} ${word}` : word;
    if (bytes(joined) > maxBytes) {
      out.push(current);
      current = word;
    } else {
      current = joined;
    }
  }
  if (current) out.push(current);
  return out;
}

function hardCut(word, maxBytes) {
  const out = [];
  let current = '';
  for (const char of word) {
    if (current && bytes(current + char) > maxBytes) {
      out.push(current);
      current = '';
    }
    current += char;
  }
  if (current) out.push(current);
  return out;
}

// Sentences go back together into as few requests as the limit allows.
function packed(pieces, maxBytes) {
  const out = [];
  let current = '';
  for (const piece of pieces) {
    const joined = current ? `${current} ${piece}` : piece;
    if (current && bytes(joined) > maxBytes) {
      out.push(current);
      current = piece;
    } else {
      current = joined;
    }
  }
  if (current) out.push(current);
  return out;
}

/* ---------- the audio ---------- */

/** The fields of a WAV file this module needs, or null when the buffer is not one. */
function readWav(buf) {
  if (buf.length < 12 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  let fmt = null;
  let data = null;
  for (let at = 12; at + 8 <= buf.length; ) {
    const id = buf.toString('ascii', at, at + 4);
    const size = buf.readUInt32LE(at + 4);
    const body = at + 8;
    if (id === 'fmt ') fmt = buf.subarray(body, body + size);
    if (id === 'data') data = buf.subarray(body, Math.min(body + size, buf.length));
    at = body + size + (size % 2);
  }
  return fmt && data ? { fmt, data } : null;
}

/**
 * The WAV files of one speech, one after another, as a single WAV file. Gemini TTS answers with WAV; a long verse is cut
 * into requests, and the pieces are joined here. All pieces must be in the same format.
 */
export function joinWav(buffers) {
  if (buffers.length === 1) return buffers[0];
  const parts = buffers.map(readWav);
  if (parts.some((part) => !part)) throw new Error('a piece of the speech is not a WAV file');
  const { fmt } = parts[0];
  if (parts.some((part) => !part.fmt.equals(fmt))) throw new Error('the pieces of the speech are not in the same WAV format');
  const data = Buffer.concat(parts.map((part) => part.data));
  const header = Buffer.alloc(28 + fmt.length);
  header.write('RIFF', 0, 'ascii');
  header.writeUInt32LE(20 + fmt.length + data.length, 4);
  header.write('WAVE', 8, 'ascii');
  header.write('fmt ', 12, 'ascii');
  header.writeUInt32LE(fmt.length, 16);
  fmt.copy(header, 20);
  header.write('data', 20 + fmt.length, 'ascii');
  header.writeUInt32LE(data.length, 24 + fmt.length);
  return Buffer.concat([header, data]);
}

const MPEG1_LAYER3_KBPS = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const MPEG2_LAYER3_KBPS = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];

/**
 * How long a clip plays, in seconds. A WAV's length is exact. An MP3's is worked out from the bitrate of its first frame,
 * which is exact for a constant-bitrate file and close for most others. Returns 0 when it cannot tell.
 */
export function audioSeconds(buf, ext) {
  if (ext === 'wav') {
    const wav = readWav(buf);
    const byteRate = wav?.fmt.readUInt32LE(8);
    return byteRate ? wav.data.length / byteRate : 0;
  }
  if (ext === 'mp3') {
    // An ID3 tag comes first when there is one; its size is four "syncsafe" bytes at 6..9.
    const start = buf.length > 10 && buf.toString('ascii', 0, 3) === 'ID3'
      ? 10 + (((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f))
      : 0;
    for (let i = start; i + 4 <= buf.length; i++) {
      if (buf[i] !== 0xff || (buf[i + 1] & 0xe0) !== 0xe0) continue;
      const version = (buf[i + 1] >> 3) & 3; // 3 = MPEG-1, 2 = MPEG-2, 0 = MPEG-2.5
      const layer = (buf[i + 1] >> 1) & 3; // 1 = Layer III
      const index = (buf[i + 2] >> 4) & 15;
      if (layer !== 1 || version === 1 || index === 0 || index === 15) continue;
      const kbps = version === 3 ? MPEG1_LAYER3_KBPS[index] : MPEG2_LAYER3_KBPS[index];
      return ((buf.length - start) * 8) / (kbps * 1000);
    }
  }
  return 0;
}

/* ---------- what a target is, and what a run costs ---------- */

/** Why a voice cannot be used for a target, as one sentence for the page, or null when it can. */
export function targetProblem({ engine, model, voice, language }) {
  const e = narration.engines[engine];
  if (!e) return `There is no engine called "${engine}".`;
  if (!e.models.includes(model)) return `${e.label} has no model "${model}".`;
  if (!e.voices.includes(voice)) return `${e.label} has no voice "${voice}".`;
  if (!narration.languages[language]) return `Narration is not set up for the language "${language}".`;
  return null;
}

/** The name an engine is called with: Chirp names a voice per language ("en-US-Chirp3-HD-Kore"), Gemini by its own name. */
export function voiceFor(engine, language, voice) {
  if (engine === 'google-chirp') {
    const lang = narration.languages[language];
    if (!lang) throw new Error(`Narration is not set up for the language "${language}".`);
    return `${lang.code}-Chirp3-HD-${voice}`;
  }
  return voice;
}

/**
 * The cost preview: characters and engine requests for the verses' texts, the price where one is known, and the least time
 * the engine's request rate allows. Nothing is sent to the engine.
 */
export function estimate({ engine, texts }) {
  const e = narration.engines[engine];
  const characters = texts.reduce((n, t) => n + [...String(t)].length, 0);
  const requests = texts.reduce((n, t) => n + splitForEngine(t, e.maxBytes).length, 0);
  const perMillion = e.price.usdPerMillionChars;
  return {
    verses: texts.length,
    characters,
    requests,
    priced: perMillion != null,
    priceVerified: e.price.verified,
    costUsd: perMillion == null ? null : (characters * perMillion) / 1_000_000,
    minutesAtLimit: Math.ceil(requests / e.rpm),
  };
}

/* ---------- what a failure from an engine means ---------- */

// A bill that has not been paid or a balance that is empty: waiting does not fix it.
const CREDIT = /billing|credit|payment|spend limit|insufficient/i;
// Errors from the network or from S3 that go away by themselves.
const NETWORK_CODES = ['ECONNRESET', 'ETIMEDOUT', 'ENOTFOUND', 'EAI_AGAIN', 'ECONNREFUSED', 'EPIPE', 'ECONNABORTED'];
const S3_DENIED = ['AccessDenied', 'InvalidAccessKeyId', 'SignatureDoesNotMatch', 'NoSuchBucket', 'ExpiredToken', 'InvalidToken', 'CredentialsProviderError', 'Forbidden'];
const S3_BUSY = ['SlowDown', 'ServiceUnavailable', 'InternalError', 'RequestTimeout', 'NetworkingError'];

const engineInfo = (engine) => narration.engines[engine] ?? { label: engine || 'the engine', company: 'The text-to-speech service', keyEnv: 'its API key setting' };

/**
 * Decides what a narration run does about an error that stopped it, the way classifyError does for translation:
 *
 *   pause + retryInMs  - probably temporary (the engine busy, the network, S3): try again by itself
 *   pause              - needs a person (no billing, a bad key, no access to the bucket, a model or voice it does not know)
 *   fail               - waiting will not mend it (the engine refused this text): the message says why
 *
 * Every clip made so far is in S3, so a resumed run carries on from the first one that is not.
 *
 * @param {Error} err
 * @param {number} retriesInARow  automatic retries since a clip was last made
 * @returns {{ action: 'pause'|'fail', reason: string, message: string, retryInMs?: number }}
 */
export function classifyNarrationError(err, retriesInARow = 0, cfg = narration) {
  const text = String(err?.message || err || 'unknown error');
  const retry = (reason, message) =>
    retriesInARow < cfg.maxAutoRetries
      ? { action: 'pause', reason, message, retryInMs: retryDelayMs(retriesInARow, cfg) }
      : { action: 'pause', reason, message: `${message} It has been retried ${retriesInARow} times without making a clip; press Resume when it is fixed.` };

  if (err instanceof ConfigError) {
    return { action: 'pause', reason: 'config', message: `${err.message} Fix it on the worker, then press Resume.` };
  }

  if (err instanceof EngineError && err.status != null) {
    const { company, keyEnv, label } = engineInfo(err.engine);
    const status = err.status;
    if (status === 401 || status === 403) {
      return CREDIT.test(text)
        ? { action: 'pause', reason: 'credit', message: `${company} says billing is not set up or the balance has run out. Fix it in the ${company} console, then press Resume. (${text.slice(0, 200)})` }
        : { action: 'pause', reason: 'auth', message: `${company} rejected the key (${status}). Check ${keyEnv} on the server, then press Resume.` };
    }
    if (status === 404) {
      return { action: 'pause', reason: 'config', message: `${label} does not know this model or voice. Check the choice on the run, then press Resume. (${text.slice(0, 200)})` };
    }
    if (status === 429) return retry('rate_limit', `${company} is rate-limiting this key.`);
    if (status >= 500 && status < 600) return retry('unavailable', `${company} could not be reached or is overloaded.`);
    // The engine answered, just without audio in it: waiting does not change that, so the message says what it sent.
    if (status < 300) return { action: 'fail', reason: 'error', message: text.slice(0, 300) };
    return { action: 'fail', reason: 'error', message: `${company} refused this request (${status}): ${text.slice(0, 300)}` };
  }

  const code = err?.code ?? err?.cause?.code;
  if (NETWORK_CODES.includes(code)) return retry('unavailable', 'The text-to-speech service could not be reached.');

  const s3Status = err?.$metadata?.httpStatusCode;
  if (S3_DENIED.includes(err?.name) || s3Status === 401 || s3Status === 403) {
    return { action: 'pause', reason: 'storage', message: `The server is not allowed to write the narration files (${err?.name || 'access denied'}). Check the server's AWS credentials and S3_BUCKET, then press Resume.` };
  }
  if (S3_BUSY.includes(err?.name) || (s3Status >= 500 && s3Status < 600)) return retry('unavailable', 'S3 could not be reached.');

  if (retriesInARow < cfg.unknownRetries) {
    return { action: 'pause', reason: 'error', message: `Unexpected error: ${text.slice(0, 300)}`, retryInMs: cfg.unknownRetryMs };
  }
  return { action: 'fail', reason: 'error', message: `Unexpected error: ${text.slice(0, 500)}` };
}

/* ---------- a run and a clip, as the pages receive them ---------- */

// What a run's engine spent, in dollars, or null when one of its engines has no known price.
function costOf(row) {
  const used = row.kind === 'COMPARE'
    ? (row.results || []).map((r) => ({ engine: r.engine, characters: r.characters || 0 }))
    : [{ engine: row.engine, characters: row.characters }];
  let total = 0;
  for (const { engine, characters } of used) {
    const perMillion = narration.engines[engine]?.price.usdPerMillionChars;
    if (perMillion == null) return null;
    total += (characters * perMillion) / 1_000_000;
  }
  return total;
}

/**
 * A narration run as the page receives it. For a comparison (kind COMPARE) a unit is one voice's clip of the verse, so its
 * progress counts voices; for a narration run a unit is a verse.
 * @param {object} row a NarrationRun
 */
export function presentRun(row, now = new Date()) {
  const handled = row.doneVerses + row.skippedVerses + row.failedVerses;
  const left = Math.max(0, row.totalVerses - handled);
  const perUnit = handled > 0 && row.activeSeconds > 0 ? row.activeSeconds / handled : null;
  const stalled = row.status === 'RUNNING' && (!row.heartbeatAt || now - new Date(row.heartbeatAt) > narration.staleHeartbeatSeconds * 1000);
  const engine = narration.engines[row.engine];
  return {
    id: row.id,
    kind: row.kind,
    book: row.book,
    bookTitle: bookOf(row.book).title,
    language: row.language,
    languageName: narration.languages[row.language]?.label ?? row.language,
    engine: row.engine,
    engineLabel: engine?.label ?? row.engine,
    model: row.model,
    voice: row.voice,
    targets: row.targets,
    results: row.results,
    chapters: row.chapters,
    chapterLabels: (row.chapters || []).map((id) => chapterLabel(id, row.book)),
    verseIds: row.verseIds,
    force: row.force,
    status: row.status,
    pauseReason: row.pauseReason,
    statusMessage: row.statusMessage,
    stopReason: row.stopReason,
    errorVerseId: row.errorVerse,
    resumeAt: row.resumeAt,
    cancelRequested: row.cancelRequested,
    progress: {
      total: row.totalVerses,
      done: row.doneVerses,
      skipped: row.skippedVerses,
      failed: row.failedVerses,
      percent: row.totalVerses ? Math.min(100, Math.round((handled / row.totalVerses) * 100)) : 0,
      currentVerseId: row.currentVerse,
      etaSeconds: perUnit && row.status === 'RUNNING' ? Math.round(perUnit * left) : null,
      secondsPerVerse: perUnit ? Math.round(perUnit) : null,
    },
    usage: { characters: row.characters, audioSeconds: row.audioSeconds, calls: row.calls, costUsd: costOf(row) },
    attempts: row.attempts,
    requestedBy: row.requestedById ? { id: row.requestedById, name: row.requestedByName } : null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    stalled,
  };
}

/** @param {object} row a NarrationClip; the page gets its file's address separately, when it asks for it. */
export function presentClip(row) {
  return {
    id: row.id,
    book: row.book,
    language: row.language,
    engine: row.engine,
    model: row.model,
    voice: row.voice,
    verseId: row.verseId,
    s3Key: row.s3Key,
    contentType: row.contentType,
    bytes: row.bytes,
    seconds: row.seconds,
    characters: row.characters,
    runId: row.runId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
