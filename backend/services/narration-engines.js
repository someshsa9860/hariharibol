// The two text-to-speech engines the narration pages call: Google Cloud Text-to-Speech (the Chirp 3 HD voices) and Gemini's
// speech model. `synthesize` takes one target and one piece of text and returns the audio the engine made. The request
// shapes are here; the network is the only I/O, and `fetch` can be passed in so a test answers for it.
//
// The key goes in the x-goog-api-key header, never in the URL, so it cannot end up in a log line that prints a URL.

import env from '../config/env.js';
import { engines, languages, narration } from '../config/narration.js';
import { EngineError, voiceFor } from '../utils/narration.js';
import { ConfigError } from '../utils/translation-run.js';

const CHIRP_URL = 'https://texttospeech.googleapis.com/v1/text:synthesize';
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/interactions';

// Gemini answers with 16-bit mono PCM at this rate when the audio is not already a WAV file.
const GEMINI_PCM_RATE = 24_000;

function keyFor(engine) {
  const name = engines[engine].keyEnv;
  const key = env[name];
  if (!key) throw new ConfigError(`${name} is not set on the worker.`);
  return key;
}

// One POST. A non-2xx answer becomes an EngineError carrying the status and the provider's own message (kept for the
// log and the run's error line, never for the reader). A timeout becomes a 504 EngineError, so the classifier reads it as
// the engine being busy. Any other network failure is not caught here: the classifier reads its code.
async function post(url, body, { engine, key, fetch, signal }) {
  const timeout = AbortSignal.timeout(narration.requestTimeoutMs);
  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify(body),
      // A Cancel from the admin page (the caller's signal) stops the call too, not only the timeout.
      signal: signal ? AbortSignal.any([timeout, signal]) : timeout,
    });
  } catch (err) {
    if (err?.name === 'TimeoutError') {
      throw new EngineError(`${engine} did not answer within ${narration.requestTimeoutMs / 1000} seconds.`, { engine, status: 504 });
    }
    throw err;
  }
  const raw = await response.text();
  let data = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = null;
  }
  if (!response.ok) {
    const message = data?.error?.message || raw.slice(0, 200) || response.statusText || 'no reply';
    throw new EngineError(`${engine} answered ${response.status}: ${String(message).slice(0, 300)}`, { engine, status: response.status });
  }
  return data;
}

/** Chirp: one request, the MP3 comes back base64 in `audioContent`. */
async function chirp(target, text, deps) {
  const data = await post(
    CHIRP_URL,
    {
      input: { text },
      voice: { languageCode: languages[target.language].code, name: voiceFor('google-chirp', target.language, target.voice) },
      audioConfig: { audioEncoding: 'MP3' },
    },
    { engine: 'google-chirp', key: deps.key, fetch: deps.fetch, signal: deps.signal },
  );
  if (!data?.audioContent) throw new EngineError('google-chirp answered without audio', { engine: 'google-chirp', status: 200 });
  return Buffer.from(data.audioContent, 'base64');
}

/**
 * Gemini's speech model, through the Interactions API. The audio is found by walking the answer for an audio part, because
 * the exact place differs between the SDK's shape (`output_audio.data`) and the REST one. A WAV comes back as it is; raw
 * PCM is given a WAV header so it plays anywhere.
 */
async function gemini(target, text, deps) {
  const data = await post(
    GEMINI_URL,
    {
      model: target.model,
      input: [{ type: 'user_input', content: [{ type: 'text', text }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: target.voice }] },
    },
    { engine: 'gemini-tts', key: deps.key, fetch: deps.fetch, signal: deps.signal },
  );
  const part = findAudioPart(data);
  if (!part) throw new EngineError('gemini-tts answered without audio', { engine: 'gemini-tts', status: 200 });
  const mime = String(part.mime_type ?? part.mimeType ?? '');
  const bytes = Buffer.from(part.data, 'base64');
  if (bytes.subarray(0, 4).toString('ascii') === 'RIFF') return bytes;
  if (/l16|pcm/i.test(mime)) return pcmToWav(bytes, Number(/rate=(\d+)/.exec(mime)?.[1]) || GEMINI_PCM_RATE);
  throw new EngineError(`gemini-tts answered audio in an unexpected format "${mime}"`, { engine: 'gemini-tts', status: 200 });
}

function findAudioPart(node) {
  if (!node || typeof node !== 'object') return null;
  if (node.output_audio && typeof node.output_audio.data === 'string') return node.output_audio;
  if (node.type === 'audio' && typeof node.data === 'string') return node;
  for (const value of Object.values(node)) {
    const hit = findAudioPart(value);
    if (hit) return hit;
  }
  return null;
}

/** A 16-bit mono PCM stream with its 44-byte WAV header. */
function pcmToWav(pcm, rate) {
  const head = Buffer.alloc(44);
  head.write('RIFF', 0, 'ascii');
  head.writeUInt32LE(36 + pcm.length, 4);
  head.write('WAVE', 8, 'ascii');
  head.write('fmt ', 12, 'ascii');
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20); // PCM
  head.writeUInt16LE(1, 22); // mono
  head.writeUInt32LE(rate, 24);
  head.writeUInt32LE(rate * 2, 28); // bytes a second: rate × 2 bytes × 1 channel
  head.writeUInt16LE(2, 32); // bytes a sample
  head.writeUInt16LE(16, 34); // bits a sample
  head.write('data', 36, 'ascii');
  head.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([head, pcm]);
}

/**
 * Make the audio for one piece of text in one target. `deps.fetch` and `deps.key` are for tests; in the worker they are
 * left out, so the global fetch and the key from the environment are used. `deps.signal` stops the call when it aborts.
 * Returns the audio with its type and extension.
 */
export async function synthesize(target, text, deps = {}) {
  const engine = engines[target.engine];
  if (!engine) throw new Error(`no engine called "${target.engine}"`);
  const resolved = { fetch: deps.fetch ?? globalThis.fetch, key: deps.key ?? keyFor(target.engine), signal: deps.signal };
  const audio = target.engine === 'google-chirp' ? await chirp(target, text, resolved) : await gemini(target, text, resolved);
  return { audio, contentType: engine.format.contentType, ext: engine.format.ext };
}
