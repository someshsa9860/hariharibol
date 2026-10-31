import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import env from '../config/env.js';
import { synthesize } from '../services/narration-engines.js';
import { EngineError } from '../utils/narration.js';
import { ConfigError } from '../utils/translation-run.js';

// A fetch that answers once with the given status and body, and remembers what it was asked.
function fakeFetch(status, body, { raw = false } = {}) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    const text = raw ? body : JSON.stringify(body);
    return { ok: status >= 200 && status < 300, status, statusText: 'x', text: async () => text };
  };
  return { fetch, calls };
}

// The sample rate a WAV header says.
const wavRate = (buf) => buf.readUInt32LE(24);

describe('Google Chirp', () => {
  const target = { engine: 'google-chirp', model: 'chirp-3-hd', language: 'en', voice: 'Kore' };

  it('posts the text and voice, takes the key from a header and returns the MP3', async () => {
    const mp3 = Buffer.from([0xff, 0xfb, 0x90, 0x00, 1, 2, 3]);
    const { fetch, calls } = fakeFetch(200, { audioContent: mp3.toString('base64') });
    const out = await synthesize(target, 'Hare Krishna', { fetch, key: 'k-chirp' });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, 'https://texttospeech.googleapis.com/v1/text:synthesize');
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'k-chirp');
    assert.ok(!calls[0].url.includes('k-chirp'), 'the key must never be in the URL');
    assert.deepEqual(calls[0].body, {
      input: { text: 'Hare Krishna' },
      voice: { languageCode: 'en-US', name: 'en-US-Chirp3-HD-Kore' },
      audioConfig: { audioEncoding: 'MP3' },
    });
    assert.ok(calls[0].init.signal, 'a request has a timeout');
    assert.deepEqual(out.audio, mp3);
    assert.equal(out.contentType, 'audio/mpeg');
    assert.equal(out.ext, 'mp3');
  });

  it('turns a refusal into an EngineError with the status and the provider message, and no URL', async () => {
    const { fetch } = fakeFetch(400, { error: { message: 'Input text too long for this voice' } });
    await assert.rejects(synthesize(target, 'x', { fetch, key: 'k' }), (err) => {
      assert.ok(err instanceof EngineError);
      assert.equal(err.status, 400);
      assert.equal(err.engine, 'google-chirp');
      assert.match(err.message, /Input text too long/);
      assert.ok(!err.message.includes('googleapis'), 'no URL in the message');
      return true;
    });
  });

  it('an engine that does not answer in time is a 504 EngineError, not a network failure', async () => {
    const fetch = async () => {
      throw Object.assign(new Error('The operation was aborted due to timeout'), { name: 'TimeoutError' });
    };
    await assert.rejects(synthesize(target, 'x', { fetch, key: 'k' }), (err) => {
      assert.ok(err instanceof EngineError);
      assert.equal(err.status, 504);
      assert.equal(err.engine, 'google-chirp');
      assert.match(err.message, /did not answer within 120 seconds/);
      return true;
    });
  });

  it('a success answer without audio is an EngineError, not a silent empty clip', async () => {
    const { fetch } = fakeFetch(200, {});
    await assert.rejects(synthesize(target, 'x', { fetch, key: 'k' }), EngineError);
  });

  it('refuses to run without a key, naming the setting, and never calls the network', async () => {
    const saved = env.GOOGLE_TTS_API_KEY;
    env.GOOGLE_TTS_API_KEY = '';
    try {
      const { fetch, calls } = fakeFetch(200, {});
      await assert.rejects(synthesize(target, 'x', { fetch }), (err) => {
        assert.ok(err instanceof ConfigError);
        assert.match(err.message, /GOOGLE_TTS_API_KEY/);
        return true;
      });
      assert.equal(calls.length, 0);
    } finally {
      env.GOOGLE_TTS_API_KEY = saved;
    }
  });
});

describe('Gemini TTS', () => {
  const target = { engine: 'gemini-tts', model: 'gemini-2.5-flash-preview-tts', language: 'en', voice: 'Kore' };

  it('posts the request in the Interactions shape and finds the audio in the answer', async () => {
    const wav = Buffer.from('RIFF0000WAVEfmt data', 'ascii');
    const { fetch, calls } = fakeFetch(200, { steps: [{ type: 'model_output', content: [{ output_audio: { data: wav.toString('base64') } }] }] });
    const out = await synthesize(target, 'Om', { fetch, key: 'k-gem' });

    assert.equal(calls[0].url, 'https://generativelanguage.googleapis.com/v1beta/interactions');
    assert.equal(calls[0].init.headers['x-goog-api-key'], 'k-gem');
    assert.deepEqual(calls[0].body, {
      model: 'gemini-2.5-flash-preview-tts',
      input: [{ type: 'user_input', content: [{ type: 'text', text: 'Om' }] }],
      response_format: { type: 'audio' },
      generation_config: { speech_config: [{ voice: 'Kore' }] },
    });
    assert.deepEqual(out.audio, wav);
    assert.equal(out.contentType, 'audio/wav');
    assert.equal(out.ext, 'wav');
  });

  it('wraps raw 16-bit PCM in a WAV header at the rate the answer names', async () => {
    const pcm = Buffer.alloc(480, 7);
    const { fetch } = fakeFetch(200, { output_audio: { data: pcm.toString('base64'), mime_type: 'audio/L16;codec=pcm;rate=16000' } });
    const out = await synthesize(target, 'Om', { fetch, key: 'k' });

    assert.equal(out.audio.toString('ascii', 0, 4), 'RIFF');
    assert.equal(out.audio.toString('ascii', 8, 12), 'WAVE');
    assert.equal(out.audio.length, 44 + pcm.length);
    assert.equal(out.audio.readUInt32LE(40), pcm.length, 'data chunk length');
    assert.equal(wavRate(out.audio), 16000);
    assert.equal(out.audio.readUInt16LE(34), 16, 'bits a sample');
    assert.deepEqual(out.audio.subarray(44), pcm);
  });

  it('uses the documented 24 kHz when the PCM answer gives no rate', async () => {
    const pcm = Buffer.alloc(100, 1);
    const { fetch } = fakeFetch(200, { output_audio: { data: pcm.toString('base64'), mime_type: 'audio/L16' } });
    const out = await synthesize(target, 'Om', { fetch, key: 'k' });
    assert.equal(wavRate(out.audio), 24000);
  });

  it('an audio type it does not know is an EngineError rather than a guessed file', async () => {
    const { fetch } = fakeFetch(200, { output_audio: { data: Buffer.alloc(10).toString('base64'), mime_type: 'audio/ogg' } });
    await assert.rejects(synthesize(target, 'Om', { fetch, key: 'k' }), /unexpected format "audio\/ogg"/);
  });

  it('a 429 is an EngineError with the status, so the classifier can wait and retry', async () => {
    const { fetch } = fakeFetch(429, { error: { message: 'Resource exhausted' } });
    await assert.rejects(synthesize(target, 'Om', { fetch, key: 'k' }), (err) => err instanceof EngineError && err.status === 429);
  });

  it('refuses to run without GEMINI_API_KEY, and says so', async () => {
    const saved = env.GEMINI_API_KEY;
    env.GEMINI_API_KEY = '';
    try {
      const { fetch, calls } = fakeFetch(200, {});
      await assert.rejects(synthesize(target, 'Om', { fetch }), (err) => err instanceof ConfigError && /GEMINI_API_KEY/.test(err.message));
      assert.equal(calls.length, 0);
    } finally {
      env.GEMINI_API_KEY = saved;
    }
  });
});

describe('an engine that is not one of ours', () => {
  it('is refused before anything is sent', async () => {
    const { fetch, calls } = fakeFetch(200, {});
    await assert.rejects(synthesize({ engine: 'nope', language: 'en', voice: 'Kore' }, 'x', { fetch, key: 'k' }), /no engine called "nope"/);
    assert.equal(calls.length, 0);
  });
});
