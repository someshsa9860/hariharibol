import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { narration } from '../config/narration.js';
import {
  EngineError, audioSeconds, chapterFolder, classifyNarrationError, clipKey, estimate, indexKey, joinWav, presentClip, presentRun, safeSegment,
  splitForEngine, targetKey, targetProblem, textHash, voiceFolder, voiceFor,
} from '../utils/narration.js';
import { ConfigError, retryDelayMs } from '../utils/translation-run.js';

const BHAGAVATAM = 'srimad-bhagavatam';
const GITA = 'bhagavat-gita';

// A WAV file of the given PCM bytes, with the 44-byte header Gemini's output has.
function wav(dataBytes, { rate = 24000, channels = 1, bits = 16 } = {}) {
  const fmt = Buffer.alloc(16);
  fmt.writeUInt16LE(1, 0);
  fmt.writeUInt16LE(channels, 2);
  fmt.writeUInt32LE(rate, 4);
  fmt.writeUInt32LE((rate * channels * bits) / 8, 8);
  fmt.writeUInt16LE((channels * bits) / 8, 12);
  fmt.writeUInt16LE(bits, 14);
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + dataBytes.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  fmt.copy(head, 20);
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(dataBytes.length, 40);
  return Buffer.concat([head, dataBytes]);
}

// An MP3 frame header: MPEG-1 Layer III, 128 kbit/s, 44.1 kHz. Sixteen thousand bytes of it is one second.
function mp3(bytes, { id3 = false } = {}) {
  const frames = Buffer.alloc(bytes);
  frames.set([0xff, 0xfb, 0x90, 0x00]);
  if (!id3) return frames;
  const tag = Buffer.from([0x49, 0x44, 0x33, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x04, 0, 0, 0, 0]); // ID3v2.3, body 4 bytes
  return Buffer.concat([tag, frames]);
}

const run = (over = {}) => ({
  id: 'run1', kind: 'NARRATION', book: BHAGAVATAM, language: 'en', engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore',
  targets: null, results: null, chapters: [102], verseIds: null, force: false, status: 'RUNNING', pauseReason: null, statusMessage: null,
  stopReason: null, currentVerse: '2.1.2.3', errorVerse: null, resumeAt: null, cancelRequested: false, jobId: 'job', attempts: 1,
  retriesInARow: 0, totalVerses: 10, doneVerses: 2, skippedVerses: 1, failedVerses: 1, characters: 1000, audioSeconds: 12.5, calls: 4,
  activeSeconds: 40, requestedById: 'u1', requestedByName: 'Admin', createdAt: new Date(0), updatedAt: new Date(0), startedAt: new Date(0),
  finishedAt: null, heartbeatAt: new Date(), ...over,
});

describe('where a clip is saved', () => {
  it('names a Bhagavatam verse by canto, chapter and verse, under the voice that said it', () => {
    assert.equal(
      clipKey({ book: BHAGAVATAM, language: 'en', engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore', chapterId: 102, verseNumber: '5', ext: 'mp3' }),
      'narration/api/srimad-bhagavatam/en/google-chirp/chirp-3-hd/Kore/canto-1/ch-2/5.mp3',
    );
  });

  it('names a Gita verse by chapter alone, and keeps a grouped verse as its range', () => {
    assert.equal(
      clipKey({ book: GITA, language: 'hi', engine: 'gemini-tts', model: 'gemini-2.5-flash-preview-tts', voice: 'Kore', chapterId: 18, verseNumber: '51-53', ext: 'wav' }),
      'narration/api/bhagavat-gita/hi/gemini-tts/gemini-2.5-flash-preview-tts/Kore/ch-18/51-53.wav',
    );
  });

  it('keeps each voice in its own folder, with its index beside its clips', () => {
    const chirp = { book: GITA, language: 'en', engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore' };
    const other = { ...chirp, voice: 'Puck' };
    assert.equal(voiceFolder(chirp), 'narration/api/bhagavat-gita/en/google-chirp/chirp-3-hd/Kore');
    assert.notEqual(voiceFolder(chirp), voiceFolder(other));
    assert.equal(indexKey(chirp), `${voiceFolder(chirp)}/_index.json`);
    assert.equal(chapterFolder(102, BHAGAVATAM), 'canto-1/ch-2');
  });

  it('refuses a name that could be read as a path, rather than changing it', () => {
    assert.equal(safeSegment('Kore'), 'Kore');
    assert.equal(safeSegment('gemini-3.8-flash-tts'), 'gemini-3.8-flash-tts');
    assert.throws(() => safeSegment('../etc'), /cannot be part of a narration file name/);
    assert.throws(() => safeSegment('a b'), /cannot be part/);
    assert.throws(() => safeSegment(''), /cannot be part/);
  });
});

describe('cutting a verse to fit an engine', () => {
  it('leaves a short verse whole, with its spaces made single', () => {
    assert.deepEqual(splitForEngine('  Krishna   speaks.  ', 100), ['Krishna speaks.']);
    assert.deepEqual(splitForEngine('', 100), []);
    assert.deepEqual(splitForEngine(null, 100), []);
  });

  it('cuts a long English verse at sentence ends, each piece under the limit, and loses no words', () => {
    const text = Array.from({ length: 40 }, (_, i) => `This is sentence number ${i + 1}, said in a calm voice.`).join(' ');
    const pieces = splitForEngine(text, 300);
    assert.ok(pieces.length > 1);
    for (const piece of pieces) assert.ok(Buffer.byteLength(piece, 'utf8') <= 300);
    assert.equal(pieces.join(' '), text);
  });

  it('measures Devanagari in bytes, so a Hindi piece never goes over the limit', () => {
    const hindi = 'राजा परीक्षित गंगा तट पर बैठे थे। '.repeat(20).trim();
    const pieces = splitForEngine(hindi, 120);
    assert.ok(pieces.length > 1);
    for (const piece of pieces) assert.ok(Buffer.byteLength(piece, 'utf8') <= 120);
    assert.equal(pieces.join(' '), hindi);
  });

  it('cuts a word longer than the limit between characters, never inside one', () => {
    const word = 'क'.repeat(100); // three bytes each
    const pieces = splitForEngine(word, 100);
    assert.ok(pieces.length > 1);
    for (const piece of pieces) {
      assert.ok(Buffer.byteLength(piece, 'utf8') <= 100);
      assert.equal(Buffer.from(piece, 'utf8').toString('utf8'), piece);
    }
    assert.equal(pieces.join(''), word);
  });
});

describe('joining and measuring audio', () => {
  it('joins WAV pieces into one file whose header matches its data', () => {
    const a = wav(Buffer.alloc(4800, 1), { rate: 24000 }); // 4800 bytes at 48000 bytes a second: a tenth of a second
    const b = wav(Buffer.alloc(9600, 2), { rate: 24000 }); // two tenths
    const joined = joinWav([a, b]);
    assert.equal(joined.length, 44 + 4800 + 9600);
    assert.equal(joined.readUInt32LE(4), joined.length - 8);
    assert.equal(joined.readUInt32LE(40), 14400);
    assert.ok(Math.abs(audioSeconds(joined, 'wav') - 0.3) < 1e-9);
  });

  it('hands back a single piece as it is', () => {
    const only = wav(Buffer.alloc(100));
    assert.equal(joinWav([only]), only);
  });

  it('refuses pieces that are not in the same format', () => {
    assert.throws(() => joinWav([wav(Buffer.alloc(10)), wav(Buffer.alloc(10), { rate: 16000 })]), /same WAV format/);
    assert.throws(() => joinWav([wav(Buffer.alloc(10)), Buffer.from('not audio')]), /not a WAV file/);
  });

  it('gives a WAV its exact length and an MP3 its length from the bitrate of its frames', () => {
    assert.equal(audioSeconds(wav(Buffer.alloc(96000)), 'wav'), 2); // 24 kHz, 16-bit mono: 48000 bytes a second
    assert.equal(audioSeconds(mp3(16000), 'mp3'), 1); // 128 kbit/s
    assert.equal(audioSeconds(mp3(16000, { id3: true }), 'mp3'), 1); // the tag is skipped
    assert.equal(audioSeconds(Buffer.from('nothing here'), 'mp3'), 0);
    assert.equal(audioSeconds(Buffer.from('nothing here'), 'ogg'), 0);
  });
});

describe('telling clips apart', () => {
  const base = { text: 'Krishna speaks.', language: 'en', engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore' };

  it('is the same for the same text and target, and different when any of them changes', () => {
    assert.equal(textHash(base), textHash({ ...base }));
    assert.notEqual(textHash(base), textHash({ ...base, text: 'Krishna speaks now.' }));
    assert.notEqual(textHash(base), textHash({ ...base, voice: 'Puck' }));
    assert.notEqual(textHash(base), textHash({ ...base, language: 'hi' }));
  });

  it('names a comparison target as engine/model/voice', () => {
    assert.equal(targetKey({ engine: 'gemini-tts', model: 'gemini-2.5-flash-preview-tts', voice: 'Kore' }), 'gemini-tts/gemini-2.5-flash-preview-tts/Kore');
  });
});

describe('whether a voice can be used', () => {
  it('accepts a known engine, model, voice and language', () => {
    assert.equal(targetProblem({ engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore', language: 'en' }), null);
  });

  it('says what is wrong, in a sentence', () => {
    assert.match(targetProblem({ engine: 'nope', model: 'x', voice: 'Kore', language: 'en' }), /no engine called "nope"/);
    assert.match(targetProblem({ engine: 'google-chirp', model: 'gpt', voice: 'Kore', language: 'en' }), /no model "gpt"/);
    assert.match(targetProblem({ engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Nobody', language: 'en' }), /no voice "Nobody"/);
    assert.match(targetProblem({ engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore', language: 'ta' }), /not set up for the language "ta"/);
  });

  it('calls Chirp voices by language and Gemini voices by their own name', () => {
    assert.equal(voiceFor('google-chirp', 'en', 'Kore'), 'en-US-Chirp3-HD-Kore');
    assert.equal(voiceFor('google-chirp', 'hi', 'Kore'), 'hi-IN-Chirp3-HD-Kore');
    assert.equal(voiceFor('gemini-tts', 'hi', 'Kore'), 'Kore');
  });
});

describe('the cost preview', () => {
  it('counts characters and requests, and prices Chirp by the million characters', () => {
    const e = estimate({ engine: 'google-chirp', texts: ['Hello world.', 'राम'] });
    assert.equal(e.verses, 2);
    assert.equal(e.characters, 12 + 3);
    assert.equal(e.requests, 2);
    assert.equal(e.priced, true);
    assert.equal(e.priceVerified, false);
    assert.ok(Math.abs(e.costUsd - (15 * 30) / 1_000_000) < 1e-12);
    assert.equal(e.minutesAtLimit, 1);
  });

  it('gives no price for Gemini, whose price is not known here', () => {
    const e = estimate({ engine: 'gemini-tts', texts: ['Hello world.'] });
    assert.equal(e.priced, false);
    assert.equal(e.costUsd, null);
  });

  it('counts the requests a long verse needs, not the verses', () => {
    const long = Array.from({ length: 200 }, () => 'A sentence that goes on for a little while.').join(' ');
    const e = estimate({ engine: 'gemini-tts', texts: [long] });
    assert.equal(e.verses, 1);
    assert.ok(e.requests > 1);
  });
});

describe('what a failure from an engine means', () => {
  it('pauses for a person when the key is refused, and names the setting to check', () => {
    const d = classifyNarrationError(new EngineError('denied', { engine: 'google-chirp', status: 401 }), 0);
    assert.equal(d.action, 'pause');
    assert.equal(d.reason, 'auth');
    assert.match(d.message, /GOOGLE_TTS_API_KEY/);
  });

  it('pauses for billing when the answer says the account is not paid up', () => {
    const d = classifyNarrationError(new EngineError('Billing is not enabled for this project', { engine: 'google-chirp', status: 403 }), 0);
    assert.equal(d.reason, 'credit');
  });

  it('pauses for a model or voice the engine does not know', () => {
    const d = classifyNarrationError(new EngineError('not found', { engine: 'gemini-tts', status: 404 }), 0);
    assert.equal(d.action, 'pause');
    assert.equal(d.reason, 'config');
  });

  it('retries a rate limit by itself, doubling the wait, until its retries run out', () => {
    const first = classifyNarrationError(new EngineError('slow down', { engine: 'google-chirp', status: 429 }), 0);
    assert.equal(first.reason, 'rate_limit');
    assert.equal(first.retryInMs, retryDelayMs(0, narration));
    assert.ok(first.retryInMs > 0);
    const last = classifyNarrationError(new EngineError('slow down', { engine: 'google-chirp', status: 429 }), narration.maxAutoRetries);
    assert.equal(last.retryInMs, undefined);
    assert.match(last.message, /press Resume/);
  });

  it('retries a server error, and a dropped connection', () => {
    assert.equal(classifyNarrationError(new EngineError('oops', { engine: 'gemini-tts', status: 503 }), 0).reason, 'unavailable');
    const reset = Object.assign(new Error('fetch failed'), { cause: { code: 'ECONNRESET' } });
    assert.equal(classifyNarrationError(reset, 0).reason, 'unavailable');
  });

  it('fails a text the engine refuses, since waiting will not change it', () => {
    const d = classifyNarrationError(new EngineError('bad argument', { engine: 'google-chirp', status: 400 }), 0);
    assert.equal(d.action, 'fail');
    assert.match(d.message, /refused this request \(400\)/);
  });

  it('fails an answer that came back without audio, with what it said, not as a refusal', () => {
    const d = classifyNarrationError(new EngineError('google-chirp answered without audio', { engine: 'google-chirp', status: 200 }), 0);
    assert.equal(d.action, 'fail');
    assert.equal(d.message, 'google-chirp answered without audio');
  });

  it('retries an engine that did not answer in time, and does not blame S3 for it', () => {
    const d = classifyNarrationError(new EngineError('gemini-tts did not answer within 120 seconds.', { engine: 'gemini-tts', status: 504 }), 0);
    assert.equal(d.reason, 'unavailable');
    assert.match(d.message, /Google could not be reached or is overloaded/);
    assert.doesNotMatch(d.message, /S3/);
  });

  it('pauses for a configuration problem on the worker', () => {
    const d = classifyNarrationError(new ConfigError('GEMINI_API_KEY is not set on the worker.'), 0);
    assert.equal(d.reason, 'config');
    assert.match(d.message, /GEMINI_API_KEY is not set/);
  });

  it('pauses for storage when S3 will not accept the server, and retries when S3 is busy', () => {
    assert.equal(classifyNarrationError(Object.assign(new Error('denied'), { name: 'AccessDenied' }), 0).reason, 'storage');
    assert.equal(classifyNarrationError(Object.assign(new Error('slow'), { name: 'SlowDown' }), 0).reason, 'unavailable');
  });

  it('tries an unknown error a couple of times, then fails with its message', () => {
    const odd = new Error('something new');
    const first = classifyNarrationError(odd, 0);
    assert.equal(first.action, 'pause');
    assert.equal(first.retryInMs, narration.unknownRetryMs);
    const spent = classifyNarrationError(odd, narration.unknownRetries);
    assert.equal(spent.action, 'fail');
    assert.match(spent.message, /something new/);
  });

});

describe('a run and a clip as the pages receive them', () => {
  it('counts the verses handled, the time left and the cost of a Chirp narration', () => {
    const p = presentRun(run(), new Date());
    assert.equal(p.progress.total, 10);
    assert.equal(p.progress.done, 2);
    assert.equal(p.progress.skipped, 1);
    assert.equal(p.progress.failed, 1);
    assert.equal(p.progress.percent, 40); // 4 of 10 handled
    assert.equal(p.progress.secondsPerVerse, 10); // 40 active seconds over 4 handled
    assert.equal(p.progress.etaSeconds, 60); // 6 left at 10 seconds each
    assert.ok(Math.abs(p.usage.costUsd - 0.03) < 1e-12); // 1000 characters at $30 a million
    assert.equal(p.engineLabel, narration.engines['google-chirp'].label);
    assert.equal(p.languageName, 'English');
    assert.equal(p.bookTitle, 'Śrīmad-Bhāgavatam');
    assert.equal(p.stalled, false);
  });

  it('leaves the cost out when the engine has no known price', () => {
    const p = presentRun(run({ engine: 'gemini-tts', model: 'gemini-2.5-flash-preview-tts' }), new Date());
    assert.equal(p.usage.costUsd, null);
  });

  it('flags a running run whose heartbeat has stopped', () => {
    const old = new Date(Date.now() - (narration.staleHeartbeatSeconds + 10) * 1000);
    assert.equal(presentRun(run({ heartbeatAt: old }), new Date()).stalled, true);
    assert.equal(presentRun(run({ status: 'PAUSED', heartbeatAt: old }), new Date()).stalled, false);
  });

  it('adds up the cost of a comparison from each voice it made', () => {
    const cells = [
      { engine: 'google-chirp', characters: 500 },
      { engine: 'google-chirp', characters: 500 },
    ];
    const p = presentRun(run({ kind: 'COMPARE', engine: null, model: null, voice: null, targets: [{}, {}], results: cells }), new Date());
    assert.ok(Math.abs(p.usage.costUsd - 0.03) < 1e-12);
    const unpriced = presentRun(run({ kind: 'COMPARE', engine: null, model: null, voice: null, results: [...cells, { engine: 'gemini-tts', characters: 500 }] }), new Date());
    assert.equal(unpriced.usage.costUsd, null);
  });

  it('presents a clip without its file address, which the controller adds', () => {
    const c = presentClip({
      id: 'c1', book: BHAGAVATAM, language: 'en', engine: 'google-chirp', model: 'chirp-3-hd', voice: 'Kore', verseId: '2.1.2.3', textHash: 'abc',
      s3Key: 'narration/api/x.mp3', contentType: 'audio/mpeg', bytes: 10, seconds: 1, characters: 12, runId: null, createdAt: new Date(0), updatedAt: new Date(0),
    });
    assert.equal(c.s3Key, 'narration/api/x.mp3');
    assert.equal(c.url, undefined);
    assert.equal(c.textHash, undefined);
  });
});
