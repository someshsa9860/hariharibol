// Reads the Gita translations (translation + word list) against the SANSKRIT and reports wording errors.
// Read-only: it works on a local copy of the bucket and writes one JSON line per verse (or verse group) to --out.
//
//   node review.mjs --from DIR --langs hi,mr --chapters 1 --out runs/x.jsonl [--model M] [--effort off|low|medium] [--max-spend 5]
//
// DIR is laid out like json/bhagavat-gita/ in the bucket (en/, sa/, hi/ … each with ch-<n>.json).
//   en/  Prabhupāda's English — the text the translators were given
//   sa/  the Sanskrit, and the word-by-word list (its English column is Prabhupāda's)
//   <l>/ the translation being checked
// Why it exists: the pipeline's translators saw only the English, never the Sanskrit, so where Prabhupāda's English names a
// different thing than the Sanskrit word does (dharma-kṣetre → "place of pilgrimage") every language copied it ("tīrtha").
// Verses Prabhupāda translated together (1.16–18, 1.32–35 …) carry one shared translation; they are reviewed as one unit.
// Run again with the same --out and it skips what is done (a verse that errored is tried again).

import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import { config as loadEnv } from 'dotenv';

const here = dirname(fileURLToPath(import.meta.url));
const backend = resolve(here, '../../..');
loadEnv({ path: resolve(backend, '.env') });

const { values } = parseArgs({
  options: {
    from: { type: 'string' }, langs: { type: 'string' }, chapters: { type: 'string' }, verses: { type: 'string' }, out: { type: 'string' },
    model: { type: 'string' }, provider: { type: 'string' }, effort: { type: 'string' }, 'max-spend': { type: 'string' }, concurrency: { type: 'string' }, 'dry-run': { type: 'boolean' },
  },
});
if (!values.from || !values.out) throw new Error('--from DIR and --out FILE are required');

const { createAsk, providerOf } = await import(resolve(backend, 'scripts/lib/translate-providers.js'));
const { language } = await import(resolve(backend, 'scripts/lib/claude-translate-languages.js'));
const { FatalApiError, RefusalError } = await import(resolve(backend, 'scripts/lib/claude-translate-client.js'));

const langs = (values.langs || 'hi,mr').split(',').map((s) => s.trim());
const chapters = values.chapters ? values.chapters.split(',').map(Number) : Array.from({ length: 18 }, (_, i) => i + 1);
const onlyVerses = values.verses ? new Set(values.verses.split(',')) : null;
const provider = values.provider || 'anthropic';
const model = values.model || providerOf(provider).defaultModel;
const effort = values.effort || 'off';
const maxSpend = Number(values['max-spend'] ?? 5);
const concurrency = Number(values.concurrency ?? 6);
const from = resolve(values.from);
const outFile = resolve(values.out);

const read = (rel) => JSON.parse(readFileSync(resolve(from, rel), 'utf8'));
const prabhupada = (v, type) => v?.commentaries?.find((c) => c.translatorSlug === 'prabhupada' && c.type === type)?.text ?? null;
const squash = (t) => (t || '').replace(/\s+/g, ' ').trim();
const clean = (t) => squash((t || '').replace(/^।।[\d.]+।।\s*/, '').replace(/\(टिप्पणी[^)]*\)/g, ''));
const count = (text, find) => (find ? text.split(find).length - 1 : 0);

/* ---------- prompt ---------- */

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['issues'],
  properties: {
    issues: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        // the order matters: the model writes the reason and commits to a verdict before it writes the fix
        required: ['part', 'verseId', 'index', 'reason', 'genuine', 'kind', 'confidence', 'find', 'replace'],
        properties: {
          part: { type: 'string', enum: ['translation', 'wordMeanings'] },
          verseId: { type: 'string' },
          index: { type: 'integer' },
          reason: { type: 'string' },
          genuine: { type: 'boolean' },
          kind: { type: 'string', enum: ['term', 'wrong', 'grammar'] },
          confidence: { type: 'string', enum: ['certain', 'likely'] },
          find: { type: 'string' },
          replace: { type: 'string' },
        },
      },
    },
  },
};

function systemPrompt(lang) {
  const L = language(lang).name;
  return `You are a native-level proofreader of ${L} who also reads Sanskrit. You are checking the ${L} edition of Bhagavad-gītā As It Is (A. C. Bhaktivedanta Swami Prabhupāda) in a Vaishnava reading app. Readers treat the text as sacred, and many know the Sanskrit.

The ${L} was made by translating Prabhupāda's English. Prabhupāda's English is the authority for meaning and wording: a ${L} that says what his English says is correct, even where his English is looser, broader or more explanatory than the Sanskrit. You are not asked to improve his English or to bring the ${L} closer to the literal Sanskrit.

You find three kinds of real error, and give the smallest correction for each.

1. "term" — the ${L} follows the English gloss and in doing so names a DIFFERENT THING than the Sanskrit word names: another place, person, deity, concept or practice. The test: a reader who knows Sanskrit sees this ${L} word next to the Sanskrit word and says "that is not what this word means". The model case: dharma-kṣetre means "in the field/land of dharma"; Prabhupāda's English glosses it "in the place of pilgrimage"; the ${L} says tīrtha/pilgrimage place — a different thing. The correction uses the Sanskrit term itself in ${L}'s script (dharma-kṣetra) or its plain meaning.
   NOT a "term" error — leave these: a gloss that is merely looser, broader, narrower or more interpretive than the Sanskrit. Examples to leave alone: vīrya-vān "very powerful", viśiṣṭāḥ "especially powerful", nara-puṅgava "hero in human society", bhīma-karmā "superhuman task", mahā-śaṅkha "terrific conchshell", raṇa-samudyame "in this great trial of arms", nimittāni "causes", vīra "hero", a name rendered by its epithet, "friends" where the Sanskrit says kinsmen. If the sense is the same or close, it is not an error.
2. "wrong" — the ${L} does not say what Prabhupāda's English says: a wrong sense of a word, a wrong word, a lost or added negation, a wrong person, number, relation or direction (father for son, left for right, a name given to the wrong person), a dropped or invented meaning, an English word left untranslated, nonsense.
3. "grammar" — a mistake any native proofreader would correct: spelling, wrong case ending or postposition, gender/number/person agreement, wrong tense or verb form, a wrong or disrespectful form of address for Kṛṣṇa, Arjuna, sages or elders, broken spacing, a construction that is not good ${L}.

Most verses have no error: an empty list is the usual and correct answer. Report only what you are sure of. Never report style, synonyms, or rewordings you would prefer; a different but acceptable word or spelling is not an error. Never report Sanskrit words, names or lines. Do not remove or add whole sentences.

HOW TO ANSWER
- "verseId": the verse the line belongs to. For the translation use the FIRST verse of the group when verses share one translation.
- "find" is copied character for character from the ${L} text you were given and occurs exactly once in it. Make it just long enough to be unique and to carry any agreeing word (postposition, case ending, verb) that must change with it.
- "replace" is what that stretch becomes: ${L} only, same register, script and spelling conventions as the rest of the text, every agreement still correct, never empty and never identical to "find".
- part "translation" → index -1. part "wordMeanings" → index is the number of the word-list line and "find" comes from the ${L} column of that line.
- If a correction in the translation should be mirrored in the word list (or the other way round), report both.
- "reason": one short English sentence naming the Sanskrit word or the rule, written first.
- "genuine": true only if, having written the reason, you still hold that a native proofreader with Prabhupāda's English beside them would mark this as an error. If it turns out to be acceptable, alternative spelling, a matter of taste, or already what the English says, do not list it at all.
- "confidence": "certain" only when a good ${L} reader would surely agree; otherwise "likely".`;
}

function userPrompt(lang, unit) {
  const L = language(lang).name;
  const lines = [];
  const together = unit.verses.length > 1;
  if (together) lines.push(`These ${unit.verses.length} verses (${unit.ids.join(', ')}) share ONE translation.`);
  for (const { sa, mine } of unit.verses) {
    lines.push(`\n=== VERSE ${sa.verseId}${sa.speaker ? `  (spoken by ${sa.speaker})` : ''} ===`);
    lines.push(`SANSKRIT:\n${sa.sanskrit}`);
    lines.push(`WORD LIST — index | Sanskrit | English | ${L}:`);
    const n = Math.max(sa.wordMeanings.length, mine.wordMeanings.length);
    for (let i = 0; i < n; i++) {
      lines.push(`${i} | ${sa.wordMeanings[i]?.word ?? '—'} | ${sa.wordMeanings[i]?.meaning ?? '—'} | ${mine.wordMeanings[i]?.meaning ?? '—'}`);
    }
  }
  lines.push(`\nENGLISH TRANSLATION (Prabhupāda${together ? ', all these verses together' : ''}): ${unit.english}`);
  lines.push(`\n${L.toUpperCase()} TRANSLATION:\n${unit.own}`);
  if (lang === 'hi') {
    const ref = (slug) => unit.verses.map(({ mine }) => clean(mine.commentaries.find((c) => c.translatorSlug === slug && c.type === 'translation')?.text)).filter(Boolean).join(' ');
    lines.push(`\nFOR COMPARISON ONLY, Hindi by two human translators (do not copy; use them to see how a Hindi reader says it):\n- Ramsukhdas: ${ref('ramsukhdas')}\n- Tejomayananda: ${ref('tejomayananda')}`);
  }
  return lines.join('\n');
}

/** Keep an issue only if it can be applied: it names a verse of the unit, `find` occurs exactly once, and it changes something. */
function check(unit, issue) {
  const verse = unit.verses.find((v) => v.sa.verseId === issue.verseId);
  if (!verse) return 'verseId is not in this unit';
  if (issue.genuine !== true) return 'the model itself withdrew it';
  if (issue.find === issue.replace) return 'find equals replace';
  if (!issue.replace.trim()) return 'replace is empty';
  if (!issue.find.trim()) return 'find is empty';
  if (issue.part === 'translation') {
    if (issue.verseId !== unit.ids[0]) return 'translation issue not on the first verse of the group';
    const n = count(unit.own, issue.find);
    return n === 1 ? null : `find occurs ${n} times in the translation`;
  }
  const entry = verse.mine.wordMeanings[issue.index];
  if (!entry) return `no word-list line ${issue.index}`;
  const n = count(entry.meaning, issue.find);
  return n === 1 ? null : `find occurs ${n} times in line ${issue.index}`;
}

/* ---------- run ---------- */

const done = new Set();
if (existsSync(outFile)) {
  for (const line of readFileSync(outFile, 'utf8').split('\n')) if (line.trim()) { const r = JSON.parse(line); if (!r.error) done.add(`${r.lang}|${r.ids[0]}`); }
}
mkdirSync(dirname(outFile), { recursive: true });

const units = [];
for (const lang of langs) {
  for (const ch of chapters) {
    const sas = read(`sa/ch-${ch}.json`).verses;
    const ens = new Map(read(`en/ch-${ch}.json`).verses.map((v) => [v.verseId, v]));
    const owns = new Map(read(`${lang}/ch-${ch}.json`).verses.map((v) => [v.verseId, v]));
    let last = null;
    for (const sa of sas) {
      const mine = owns.get(sa.verseId);
      const english = squash(prabhupada(ens.get(sa.verseId), 'translation'));
      const own = prabhupada(mine, 'translation');
      if (!mine || !english || !own) continue;
      if (last && last.english === english && squash(last.own) === squash(own)) last.verses.push({ sa, mine }), last.ids.push(sa.verseId);
      else units.push((last = { lang, english, own, ids: [sa.verseId], verses: [{ sa, mine }] }));
    }
  }
}
const jobs = units.filter((u) => !done.has(`${u.lang}|${u.ids[0]}`) && (!onlyVerses || u.ids.some((id) => onlyVerses.has(id))));
console.log(`${jobs.length} unit(s) to review (${units.length - jobs.length} skipped) — model ${model}, effort ${effort}, concurrency ${concurrency}`);
if (values['dry-run']) {
  const j = jobs.find((u) => u.ids.length > 1) ?? jobs[0];
  if (j) console.log(`\n--- system (${j.lang}) ---\n${systemPrompt(j.lang)}\n\n--- user ---\n${userPrompt(j.lang, j)}`);
  process.exit(0);
}

const controller = new AbortController();
process.on('SIGINT', () => { console.log('\nstopping after the calls in progress …'); controller.abort(); });
const { keyEnv } = providerOf(provider);
const apiKey = process.env[keyEnv];
if (!apiKey) throw new Error(`${keyEnv} is not set`);
const { ask } = createAsk({ provider, apiKey, model, effort, signal: controller.signal, onWait: (m) => console.log(`   ${m}`) });

let spent = 0, finished = 0, flagged = 0, kept = 0, dropped = 0, tokensIn = 0, tokensOut = 0;
let stopped = null;
const queue = [...jobs];

async function worker() {
  while (queue.length && !stopped) {
    if (controller.signal.aborted) { stopped = 'interrupted'; return; }
    if (spent >= maxSpend) { stopped = 'max-spend'; return; }
    const unit = queue.shift();
    try {
      const res = await ask({ system: systemPrompt(unit.lang), user: userPrompt(unit.lang, unit), schema: SCHEMA, maxTokens: 6000 });
      spent += res.costUsd ?? 0;
      tokensIn += res.usage.inputTokens + res.usage.cacheReadTokens + res.usage.cacheWriteTokens;
      tokensOut += res.usage.outputTokens;
      const issues = [], rejected = [];
      for (const issue of res.data.issues ?? []) {
        const why = check(unit, issue);
        (why ? rejected : issues).push(why ? { ...issue, rejectedBecause: why } : issue);
      }
      appendFileSync(outFile, `${JSON.stringify({ lang: unit.lang, ids: unit.ids, issues, rejected, costUsd: res.costUsd })}\n`);
      finished++;
      kept += issues.length; dropped += rejected.length;
      if (issues.length) flagged++;
      if (finished % 25 === 0) console.log(`  ${finished}/${jobs.length}  flagged ${flagged} units / ${kept} issues (${dropped} unusable)  $${spent.toFixed(2)}`);
    } catch (err) {
      spent += err.costUsd ?? 0;
      if (controller.signal.aborted) { stopped = 'interrupted'; return; }
      if (err instanceof FatalApiError || err instanceof RefusalError) { stopped = err.message; return; } // the next verse would fail the same way
      console.log(`  ${unit.lang} ${unit.ids[0]}: ${err.message}`);
      appendFileSync(outFile, `${JSON.stringify({ lang: unit.lang, ids: unit.ids, error: err.message })}\n`); // a later run tries it again
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`\nDone: ${finished} reviewed, ${flagged} flagged, ${kept} issues kept, ${dropped} unusable, $${spent.toFixed(2)} (${tokensIn} in / ${tokensOut} out tokens)${stopped ? ` — stopped: ${stopped}` : ''}`);
