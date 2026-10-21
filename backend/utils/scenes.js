// What the Scenes page and its worker agree on, as pure functions (no I/O, so `npm test` covers them): where a
// chapter's scene file lives and what it is called, the prompt a chapter is sent with and the shape the answer must
// have, the checks on that answer, the text an admin copies, the rate limiter that keeps a run under the free tier,
// and how a run is sent to the page.

import { scenes } from '../config/scenes.js';
import { bookOf, chapterLabel, chapterParts } from '../scripts/lib/claude-translate-source.js';

/** Bumped when the prompt or the shape of the output changes, so a file says which rules made it. */
export const PROMPT_VERSION = '1';

const PREFIX = { 'srimad-bhagavatam': 'sk', 'bhagavat-gita': 'bg' };

/** `sk-1-ch-1.json` for canto 1 chapter 1 of the Bhagavatam, `bg-ch-2.json` for the Gita's second chapter. */
export function sceneFile(chapterId, book = 'srimad-bhagavatam') {
  const { canto, chapter } = chapterParts(chapterId, book);
  return canto ? `${PREFIX[book]}-${canto}-ch-${chapter}.json` : `${PREFIX[book]}-ch-${chapter}.json`;
}

/** `json/srimad-bhagavatam/scenes/sk-1-ch-1.json` — beside the book's `en/`, `hi/` … folders. */
export const sceneKey = (chapterId, book = 'srimad-bhagavatam') => `json/${bookOf(book).folder}/${scenes.folder}/${sceneFile(chapterId, book)}`;

/** The index of what has been written, one small file per book, so the page never lists the bucket. */
export const indexKey = (book = 'srimad-bhagavatam') => `json/${bookOf(book).folder}/${scenes.folder}/${scenes.indexFile}`;

/* ---------- the prompt ---------- */

export const SYSTEM_PROMPT = `You are a storyboard writer for short devotional films made from Śrīmad-Bhāgavatam. You are given one chapter as its verses, each with its Hindi meaning. Turn the chapter into a sequence of scenes that an AI video generator can film, in the order of the chapter.

Rules:
- Stay faithful to the verses. Show what the text says; do not add events, teachings or characters it does not contain.
- Be reverent. Deities, sages and devotees are shown with dignity, in traditional Vedic settings. Nothing violent, sensual or mocking is shown in detail; where the text tells of such things, show the moment around it (a face, a hand, the setting).
- Cover every verse: each verse reference must appear in exactly one scene. A scene covers one verse or a few that belong together (aim for one scene per 2 to 6 verses, between 3 and 30 scenes in all).
- Every scene has a Hindi narration (Devanagari) read by a calm narrator. Spoken dialogue is written only where the verses have someone speaking; give it as lines with the speaker's name, in Hindi. A scene may have no dialogue.
- "visualPrompt" is in English and is complete on its own: who is in the frame, what they are doing, the place, the light and the time of day, so a generator needs nothing else. Name each character the way "characters" describes them. No on-screen text, captions or logos.
- "characters" describes how each recurring character looks (in English), once, so every scene draws them the same way. "style" is one English line for the look of the whole film.
- "durationSec" is how long the scene runs, 5 to 15 seconds, enough to say its narration.`;

/** The user message: the chapter, then each verse with its reference and Hindi meaning. */
export function userPrompt({ bookTitle, chapterRef, chapterName, verses }) {
  const lines = verses.map((v) => `[${v.ref}] ${v.hindi}`);
  return [
    `Book: ${bookTitle}`,
    `Chapter ${chapterRef}${chapterName ? `: ${chapterName}` : ''}`,
    `Verses: ${verses.length}`,
    '',
    'Hindi meaning of each verse:',
    ...lines,
    '',
    'Write the storyboard. Use the verse references exactly as written in the square brackets.',
  ].join('\n');
}

/** The JSON Schema of the answer (gemini-translate-client turns it into Gemini's `responseSchema`). */
export const SCENES_SCHEMA = {
  type: 'object',
  properties: {
    chapterTitle: { type: 'string', description: 'A short Hindi title for the chapter' },
    summary: { type: 'string', description: 'Two or three Hindi sentences: what happens in the chapter' },
    style: { type: 'string', description: 'One English line: the look of the whole film' },
    characters: {
      type: 'array',
      items: {
        type: 'object',
        properties: { name: { type: 'string' }, look: { type: 'string', description: 'English: age, build, clothes, ornaments, colour' } },
        required: ['name', 'look'],
      },
    },
    scenes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Short Hindi title' },
          verseRefs: { type: 'array', items: { type: 'string' }, description: 'The verse references this scene covers, as given' },
          setting: { type: 'string', description: 'English: where and when' },
          visualPrompt: { type: 'string', description: 'English: the complete prompt for the video generator' },
          camera: { type: 'string', description: 'English: shot and movement' },
          mood: { type: 'string', description: 'English: a few words' },
          narration: { type: 'string', description: 'Hindi narration for the narrator' },
          dialogues: {
            type: 'array',
            items: {
              type: 'object',
              properties: { speaker: { type: 'string' }, line: { type: 'string', description: 'Hindi' } },
              required: ['speaker', 'line'],
            },
          },
          sound: { type: 'string', description: 'English: music and ambient sound' },
          durationSec: { type: 'integer' },
        },
        required: ['title', 'verseRefs', 'setting', 'visualPrompt', 'camera', 'mood', 'narration', 'dialogues', 'sound', 'durationSec'],
      },
    },
  },
  required: ['chapterTitle', 'summary', 'style', 'characters', 'scenes'],
};

const text = (value) => (typeof value === 'string' ? value.trim() : '');

/**
 * Checks and tidies an answer. → `{ ok: true, value }` or `{ ok: false, problems: [...] }`.
 * Scenes are renumbered from 1 in the order given; a verse reference the chapter does not have, or a verse in no scene,
 * is a problem (the model is asked again), because a storyboard that skips a verse is not the chapter.
 */
export function checkAnswer(data, verseRefs) {
  const problems = [];
  if (!data || !Array.isArray(data.scenes) || data.scenes.length === 0) return { ok: false, problems: ['no scenes'] };

  const known = new Set(verseRefs);
  const covered = new Set();
  const out = data.scenes.map((scene, i) => {
    const refs = (Array.isArray(scene.verseRefs) ? scene.verseRefs : []).map((r) => text(r)).filter(Boolean);
    for (const ref of refs) {
      if (!known.has(ref)) problems.push(`scene ${i + 1} names verse "${ref}", which is not in the chapter`);
      covered.add(ref);
    }
    if (!text(scene.visualPrompt)) problems.push(`scene ${i + 1} has no visual prompt`);
    if (!text(scene.narration) && !(scene.dialogues || []).length) problems.push(`scene ${i + 1} has no narration`);
    return {
      number: i + 1,
      title: text(scene.title),
      verseRefs: refs,
      setting: text(scene.setting),
      visualPrompt: text(scene.visualPrompt),
      camera: text(scene.camera),
      mood: text(scene.mood),
      narration: text(scene.narration),
      dialogues: (Array.isArray(scene.dialogues) ? scene.dialogues : []).map((d) => ({ speaker: text(d.speaker), line: text(d.line) })).filter((d) => d.line),
      sound: text(scene.sound),
      durationSec: Math.min(30, Math.max(3, Math.round(Number(scene.durationSec) || 8))),
    };
  });

  const missing = verseRefs.filter((ref) => !covered.has(ref));
  if (missing.length) problems.push(`verses not in any scene: ${missing.slice(0, 8).join(', ')}${missing.length > 8 ? ` and ${missing.length - 8} more` : ''}`);
  if (problems.length) return { ok: false, problems };

  return {
    ok: true,
    value: {
      chapterTitle: text(data.chapterTitle),
      summary: text(data.summary),
      style: text(data.style),
      characters: (Array.isArray(data.characters) ? data.characters : []).map((c) => ({ name: text(c.name), look: text(c.look) })).filter((c) => c.name),
      scenes: out,
    },
  };
}

/** The file saved for a chapter: what the model wrote, and enough about how it was made to trust or redo it. */
export function buildFile({ book, chapterId, chapterName, verses, missingHindi, value, provider, model, usage, runId, now = new Date() }) {
  const { canto, chapter } = chapterParts(chapterId, book);
  return {
    meta: {
      book,
      bookTitle: bookOf(book).title,
      canto,
      chapter,
      chapterId,
      chapterRef: chapterLabel(chapterId, book),
      chapterName: chapterName || null,
      file: sceneFile(chapterId, book),
      sourceLanguage: 'hi',
      verseCount: verses.length,
      missingHindi,
      sceneCount: value.scenes.length,
      totalSeconds: value.scenes.reduce((n, s) => n + s.durationSec, 0),
      promptVersion: PROMPT_VERSION,
      provider,
      model,
      usage,
      runId: runId ?? null,
      generatedAt: now.toISOString(),
    },
    ...value,
  };
}

/* ---------- the text an admin copies ---------- */

/**
 * One scene as a prompt to paste into a video generator. On its own it carries the film's look and the looks of the
 * characters who appear in it, so it needs nothing else; inside the whole chapter (`alone: false`) those are said once.
 */
export function scenePromptText(file, scene, { alone = true } = {}) {
  const wanted = `${scene.visualPrompt} ${scene.dialogues.map((d) => d.speaker).join(' ')}`.toLowerCase();
  const cast = alone ? (file.characters || []).filter((c) => wanted.includes(c.name.toLowerCase())) : [];
  return [
    alone && file.style && `Style: ${file.style}`,
    cast.length && `Characters:\n${cast.map((c) => `- ${c.name}: ${c.look}`).join('\n')}`,
    `Scene ${scene.number}${scene.title ? ` — ${scene.title}` : ''} (${scene.durationSec}s)`,
    scene.setting && `Setting: ${scene.setting}`,
    `Visual: ${scene.visualPrompt}`,
    scene.camera && `Camera: ${scene.camera}`,
    scene.mood && `Mood: ${scene.mood}`,
    scene.sound && `Sound: ${scene.sound}`,
    scene.narration && `Narration (Hindi): ${scene.narration}`,
    scene.dialogues.length && `Dialogue (Hindi):\n${scene.dialogues.map((d) => `${d.speaker}: ${d.line}`).join('\n')}`,
  ]
    .filter(Boolean)
    .join('\n');
}

/** The whole chapter as one document: summary, look, characters, then every scene. */
export function chapterPromptText(file) {
  const m = file.meta;
  return [
    `${m.bookTitle} ${m.chapterRef}${file.chapterTitle ? ` — ${file.chapterTitle}` : ''}`,
    file.summary,
    file.style && `Style: ${file.style}`,
    file.characters.length && `Characters:\n${file.characters.map((c) => `- ${c.name}: ${c.look}`).join('\n')}`,
    ...file.scenes.map((s) => scenePromptText(file, s, { alone: false })),
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** The saved file as the page reads it: the file, plus the copyable text of the chapter and of each scene. */
export function presentFile(file) {
  return {
    ...file,
    promptText: chapterPromptText(file),
    scenes: file.scenes.map((s) => ({ ...s, promptText: scenePromptText(file, s) })),
  };
}

/* ---------- staying under the free tier ---------- */

/** Rough input tokens of a request: Devanagari costs about one token for every two characters. */
export const estimateTokens = (...texts) => Math.ceil(texts.reduce((n, t) => n + String(t).length, 0) / 2);

/**
 * A sliding minute: `acquire(estimate)` waits until one more request and `estimate` more input tokens fit under the
 * limits, and says how long it waited through `onWait`. A request bigger than the whole per-minute allowance goes
 * through alone (waiting could never make room). `settle(entry, actual)` replaces the estimate with what the
 * provider counted. `usage()` is the minute as it stands, for the page.
 */
export function createLimiter({ rpm, tpm, now = () => Date.now(), sleep = (ms, signal) => new Promise((resolve, reject) => {
  const timer = setTimeout(resolve, ms);
  signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')); }, { once: true });
}) }) {
  let window = [];
  const prune = () => {
    const edge = now() - 60_000;
    window = window.filter((e) => e.at > edge);
  };
  const used = () => ({ requests: window.length, tokens: window.reduce((n, e) => n + e.tokens, 0) });

  return {
    async acquire(estimate, { signal, onWait = () => {} } = {}) {
      for (;;) {
        prune();
        const u = used();
        const fitsRequests = u.requests < rpm;
        const fitsTokens = u.tokens + estimate <= tpm || u.requests === 0;
        if (fitsRequests && fitsTokens) break;
        // Wait until the oldest request has left the minute, then look again.
        const wait = Math.max(1000, window[0].at + 60_000 - now() + 250);
        onWait(wait, fitsRequests ? 'tokens' : 'requests');
        await sleep(wait, signal);
      }
      const entry = { at: now(), tokens: estimate };
      window.push(entry);
      return entry;
    },
    settle(entry, actual) {
      if (actual > 0) entry.tokens = actual;
    },
    usage() {
      prune();
      return { ...used(), rpm, tpm };
    },
  };
}

/* ---------- a run, as the page receives it ---------- */

/** @param {object} row a SceneRun */
export function presentRun(row, now = new Date()) {
  const done = row.doneChapters;
  const total = row.totalChapters;
  const handled = done + row.skippedChapters;
  const left = Math.max(0, total - handled);
  const perChapter = handled > 0 && row.activeSeconds > 0 ? row.activeSeconds / handled : null;
  const stalled = row.status === 'RUNNING' && row.heartbeatAt && now - new Date(row.heartbeatAt) > scenes.staleHeartbeatSeconds * 1000;
  return {
    id: row.id,
    book: row.book,
    bookTitle: bookOf(row.book).title,
    provider: row.provider,
    model: row.model,
    status: row.status,
    pauseReason: row.pauseReason,
    statusMessage: row.statusMessage,
    stopReason: row.stopReason,
    errorChapter: row.errorChapter,
    errorChapterRef: row.errorChapter ? chapterLabel(row.errorChapter, row.book) : null,
    resumeAt: row.resumeAt,
    cancelRequested: row.cancelRequested,
    chapters: row.chapters,
    force: row.force,
    progress: {
      total,
      done,
      skipped: row.skippedChapters,
      percent: total ? Math.min(100, Math.round((handled / total) * 100)) : 0,
      currentChapter: row.currentChapter,
      currentRef: row.currentChapter ? chapterLabel(row.currentChapter, row.book) : null,
      etaSeconds: perChapter && row.status === 'RUNNING' ? Math.round(perChapter * left) : null,
      secondsPerChapter: perChapter ? Math.round(perChapter) : null,
    },
    usage: { inputTokens: row.inputTokens, outputTokens: row.outputTokens, calls: row.calls },
    attempts: row.attempts,
    requestedBy: row.requestedById ? { id: row.requestedById, name: row.requestedByName } : null,
    createdAt: row.createdAt,
    startedAt: row.startedAt,
    finishedAt: row.finishedAt,
    heartbeatAt: row.heartbeatAt,
    stalled: Boolean(stalled),
  };
}
