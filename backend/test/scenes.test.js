import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SCENES_SCHEMA, buildFile, checkAnswer, chapterPromptText, createLimiter, estimateTokens, indexKey, presentFile, presentRun, sceneFile, sceneKey, scenePromptText, userPrompt,
} from '../utils/scenes.js';
import { toGeminiSchema } from '../scripts/lib/gemini-translate-client.js';

const answer = (refs) => ({
  chapterTitle: 'परीक्षित का प्रश्न',
  summary: 'सार',
  style: 'Warm painterly Vedic style',
  characters: [{ name: 'Parikshit', look: 'A young king in white silk' }, { name: 'Shuka', look: 'A radiant young sage' }],
  scenes: refs.map((ref, i) => ({
    title: `दृश्य ${i + 1}`, verseRefs: [ref], setting: 'Riverbank at dawn', visualPrompt: 'Parikshit listens to Shuka by the Ganga', camera: 'slow push-in', mood: 'calm',
    narration: 'राजा परीक्षित गंगा तट पर बैठे थे।', dialogues: [{ speaker: 'Parikshit', line: 'मुझे बताइए।' }], sound: 'flute, river', durationSec: 9,
  })),
});

describe('where a chapter is saved', () => {
  it('names the file sk-<canto>-ch-<n>.json beside the book’s other folders', () => {
    assert.equal(sceneFile(101), 'sk-1-ch-1.json');
    assert.equal(sceneFile(1047), 'sk-10-ch-47.json');
    assert.equal(sceneKey(1213), 'json/srimad-bhagavatam/scenes/sk-12-ch-13.json');
    assert.equal(indexKey(), 'json/srimad-bhagavatam/scenes/_index.json');
    assert.equal(sceneFile(2, 'bhagavat-gita'), 'bg-ch-2.json');
  });
});

describe('the request', () => {
  it('lists every verse with its reference in square brackets', () => {
    const text = userPrompt({ bookTitle: 'Śrīmad-Bhāgavatam', chapterRef: '1.1', chapterName: 'Questions', verses: [{ ref: '1.1.1', hindi: 'एक' }, { ref: '1.1.2-3', hindi: 'दो' }] });
    assert.match(text, /Chapter 1\.1: Questions/);
    assert.match(text, /\[1\.1\.1\] एक/);
    assert.match(text, /\[1\.1\.2-3\] दो/);
  });
  it('asks for a schema Gemini accepts (types in capitals, no additionalProperties)', () => {
    const g = toGeminiSchema(SCENES_SCHEMA);
    assert.equal(g.type, 'OBJECT');
    assert.equal(g.properties.scenes.items.properties.durationSec.type, 'INTEGER');
    assert.doesNotMatch(JSON.stringify(g), /additionalProperties/);
  });
});

describe('checking an answer', () => {
  it('accepts one that covers every verse and numbers the scenes from 1', () => {
    const r = checkAnswer(answer(['1.1.1', '1.1.2']), ['1.1.1', '1.1.2']);
    assert.equal(r.ok, true);
    assert.deepEqual(r.value.scenes.map((s) => s.number), [1, 2]);
  });
  it('refuses one that leaves a verse out, names a verse that is not there, or has no scenes', () => {
    assert.match(checkAnswer(answer(['1.1.1']), ['1.1.1', '1.1.2']).problems.join(), /not in any scene: 1\.1\.2/);
    assert.match(checkAnswer(answer(['1.1.1', '9.9.9']), ['1.1.1']).problems.join(), /9\.9\.9/);
    assert.equal(checkAnswer({ scenes: [] }, ['1.1.1']).ok, false);
    assert.equal(checkAnswer(null, ['1.1.1']).ok, false);
  });
  it('keeps a scene’s length between 3 and 30 seconds', () => {
    const a = answer(['1.1.1']);
    a.scenes[0].durationSec = 400;
    assert.equal(checkAnswer(a, ['1.1.1']).value.scenes[0].durationSec, 30);
  });
});

describe('the text an admin copies', () => {
  const value = checkAnswer(answer(['1.1.1', '1.1.2']), ['1.1.1', '1.1.2']).value;
  const file = buildFile({ book: 'srimad-bhagavatam', chapterId: 101, chapterName: 'Questions', verses: [{}, {}], missingHindi: [], value, provider: 'gemini', model: 'm', usage: { inputTokens: 5, outputTokens: 7 }, runId: 'r', now: new Date('2026-10-21T00:00:00Z') });

  it('records how the file was made', () => {
    assert.equal(file.meta.chapterRef, '1.1');
    assert.equal(file.meta.file, 'sk-1-ch-1.json');
    assert.equal(file.meta.sceneCount, 2);
    assert.equal(file.meta.totalSeconds, 18);
    assert.equal(file.meta.sourceLanguage, 'hi');
  });
  it('a scene on its own carries the style and the characters in it', () => {
    const text = scenePromptText(file, file.scenes[0]);
    assert.match(text, /Style: Warm painterly/);
    assert.match(text, /- Parikshit: A young king/);
    assert.match(text, /- Shuka: A radiant/);
    assert.match(text, /Narration \(Hindi\): राजा/);
    assert.match(text, /Parikshit: मुझे बताइए।/);
  });
  it('the whole chapter says the style and characters once', () => {
    const text = chapterPromptText(file);
    assert.equal(text.match(/Style:/g).length, 1);
    assert.equal(text.match(/Scene \d/g).length, 2);
    assert.equal(presentFile(file).scenes[1].promptText.includes('Scene 2'), true);
  });
});

describe('staying under the limits', () => {
  const clock = () => {
    let t = 1_000_000;
    return { now: () => t, sleep: async (ms) => { t += ms; }, at: () => t };
  };

  it('lets requests through up to the requests a minute, then waits for the oldest to leave', async () => {
    const c = clock();
    const limiter = createLimiter({ rpm: 2, tpm: 1_000_000, now: c.now, sleep: c.sleep });
    const waits = [];
    await limiter.acquire(10, { onWait: (ms) => waits.push(ms) });
    await limiter.acquire(10, { onWait: (ms) => waits.push(ms) });
    assert.equal(waits.length, 0);
    const before = c.at();
    await limiter.acquire(10, { onWait: (ms) => waits.push(ms) });
    assert.ok(waits.length >= 1);
    assert.ok(c.at() - before >= 60_000);
  });
  it('waits when the tokens would go over, and counts what the provider reported instead of the estimate', async () => {
    const c = clock();
    const limiter = createLimiter({ rpm: 100, tpm: 1000, now: c.now, sleep: c.sleep });
    const first = await limiter.acquire(900);
    limiter.settle(first, 100);
    assert.equal(limiter.usage().tokens, 100);
    const waits = [];
    await limiter.acquire(900, { onWait: (ms) => waits.push(ms) }); // 100 + 900 fits
    assert.equal(waits.length, 0);
    await limiter.acquire(500, { onWait: (ms) => waits.push(ms) }); // 1000 + 500 does not
    assert.equal(waits.length >= 1, true);
  });
  it('lets one request bigger than the whole minute through on its own', async () => {
    const c = clock();
    const limiter = createLimiter({ rpm: 5, tpm: 1000, now: c.now, sleep: c.sleep });
    await limiter.acquire(5000);
    assert.equal(limiter.usage().requests, 1);
  });
  it('never waits when there is no limit of our own (a provider other than Gemini’s free tier)', async () => {
    const c = clock();
    const limiter = createLimiter({ rpm: Infinity, tpm: Infinity, now: c.now, sleep: c.sleep });
    const waits = [];
    const before = c.at();
    for (let i = 0; i < 50; i += 1) await limiter.acquire(500_000, { onWait: (ms) => waits.push(ms) });
    assert.equal(waits.length, 0);
    assert.equal(c.at(), before);
    assert.equal(limiter.usage().requests, 50);
    // Infinity is what JSON turns into null, which the admin page reads as "no limit".
    assert.equal(JSON.parse(JSON.stringify(limiter.usage())).rpm, null);
  });
  it('estimates Devanagari at about two characters a token', () => {
    assert.equal(estimateTokens('abcd', 'ef'), 3);
  });
});

describe('a run on the page', () => {
  const row = (extra = {}) => ({
    id: 'r', book: 'srimad-bhagavatam', provider: 'gemini', model: 'm', status: 'RUNNING', chapters: [101, 102, 103, 104], force: false, totalChapters: 4, doneChapters: 1, skippedChapters: 1,
    currentChapter: 103, inputTokens: 10, outputTokens: 20, calls: 2, activeSeconds: 60, attempts: 1, heartbeatAt: new Date(), createdAt: new Date(), ...extra,
  });
  it('counts skipped chapters as handled and estimates the time left from the pace', () => {
    const p = presentRun(row());
    assert.equal(p.progress.percent, 50);
    assert.equal(p.progress.currentRef, '1.3');
    assert.equal(p.progress.secondsPerChapter, 30);
    assert.equal(p.progress.etaSeconds, 60);
    assert.equal(p.stalled, false);
  });
  it('calls a running run with no heartbeat stalled', () => {
    assert.equal(presentRun(row({ heartbeatAt: new Date(Date.now() - 10 * 60_000) })).stalled, true);
  });
});
