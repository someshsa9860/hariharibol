// Stage A: finds where Prabhupāda's ENGLISH (word list or translation) names a different thing than the Sanskrit word does
// (dharma-kṣetre → "place of pilgrimage"). Every translation copied such a gloss, so this is found once, in English, not per language.
// Read-only; one JSON line per verse or verse group in --out. Same options as review.mjs, minus --langs.
//
//   node terms.mjs --from DIR --out runs/terms.jsonl [--chapters 1] [--effort low] [--max-spend 12]

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
    from: { type: 'string' }, chapters: { type: 'string' }, verses: { type: 'string' }, out: { type: 'string' },
    model: { type: 'string' }, effort: { type: 'string' }, 'max-spend': { type: 'string' }, concurrency: { type: 'string' }, 'dry-run': { type: 'boolean' },
  },
});
if (!values.from || !values.out) throw new Error('--from DIR and --out FILE are required');

const { createAsk } = await import(resolve(backend, 'scripts/lib/translate-providers.js'));
const { FatalApiError, RefusalError } = await import(resolve(backend, 'scripts/lib/claude-translate-client.js'));

const chapters = values.chapters ? values.chapters.split(',').map(Number) : Array.from({ length: 18 }, (_, i) => i + 1);
const onlyVerses = values.verses ? new Set(values.verses.split(',')) : null;
const model = values.model || 'claude-sonnet-5-5';
const effort = values.effort || 'low';
const maxSpend = Number(values['max-spend'] ?? 12);
const concurrency = Number(values.concurrency ?? 6);
const from = resolve(values.from);
const outFile = resolve(values.out);

const read = (rel) => JSON.parse(readFileSync(resolve(from, rel), 'utf8'));
const prabhupada = (v) => v?.commentaries?.find((c) => c.translatorSlug === 'prabhupada' && c.type === 'translation')?.text ?? null;
const squash = (t) => (t || '').replace(/\s+/g, ' ').trim();

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['items'],
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['verseId', 'index', 'sanskrit', 'englishGloss', 'sanskritMeans', 'inTranslation', 'differentThing', 'suggestedTerm'],
        properties: {
          verseId: { type: 'string' },
          index: { type: 'integer' },
          sanskrit: { type: 'string' },
          englishGloss: { type: 'string' },
          sanskritMeans: { type: 'string' },
          inTranslation: { type: 'string' },
          differentThing: { type: 'boolean' },
          suggestedTerm: { type: 'string' },
        },
      },
    },
  },
};

const SYSTEM = `You check Prabhupāda's Bhagavad-gītā As It Is against the Sanskrit, for one kind of fault only.

Prabhupāda's word-by-word glosses and his translation are the authority and often interpret the Sanskrit: they are looser, broader, narrower or more explanatory than the literal word. That is his method and is NOT a fault. The fault you look for is narrower: a Sanskrit word or phrase that the English renders as a DIFFERENT THING — another place, person, deity, concept or practice — so that a reader who knows Sanskrit, seeing the English next to the word, would say "that is not what this word means".

The model case: dharma-kṣetre means "in the field/land of dharma". The English says "in the place of pilgrimage". A place of pilgrimage (tīrtha) is a different thing from a field of dharma, so this is reported.

Leave alone (not a different thing): vīrya-vān "very powerful"; viśiṣṭāḥ "especially powerful"; nara-puṅgava "hero in human society"; bhīma-karmā "superhuman task"; mahā-śaṅkha "terrific conchshell"; raṇa-samudyame "in this great trial of arms"; nimittāni "causes"; "friends" for bāndhava; a name given as an epithet, or an epithet as a name, when it is the same person; any gloss that gives the same idea in other words.

Report an item only for a real difference of referent. Most verses have none: an empty list is the usual answer. For each item:
- verseId, index (the word-list line number), sanskrit (the word as printed), englishGloss (the gloss as printed).
- sanskritMeans: what the Sanskrit word itself means, in a few words.
- inTranslation: the words in Prabhupāda's English translation that carry the same fault (copied exactly), or "" if the translation does not.
- differentThing: true only if, on reflection, the English names a different thing. If it is only looser, do not list the item.
- suggestedTerm: a short English rendering that follows the Sanskrit (for the model case: "the field of dharma (dharma-kṣetra)").`;

function userPrompt(unit) {
  const lines = [];
  if (unit.verses.length > 1) lines.push(`These ${unit.verses.length} verses (${unit.ids.join(', ')}) share ONE translation.`);
  for (const sa of unit.verses) {
    lines.push(`\n=== VERSE ${sa.verseId} ===\nSANSKRIT:\n${sa.sanskrit}\nWORD LIST — index | Sanskrit | English gloss:`);
    sa.wordMeanings.forEach((w, i) => lines.push(`${i} | ${w.word} | ${w.meaning}`));
  }
  lines.push(`\nPRABHUPĀDA'S ENGLISH TRANSLATION: ${unit.english}`);
  return lines.join('\n');
}

const done = new Set();
if (existsSync(outFile)) {
  for (const line of readFileSync(outFile, 'utf8').split('\n')) if (line.trim()) { const r = JSON.parse(line); if (!r.error) done.add(r.ids[0]); }
}
mkdirSync(dirname(outFile), { recursive: true });

const units = [];
for (const ch of chapters) {
  const ens = new Map(read(`en/ch-${ch}.json`).verses.map((v) => [v.verseId, v]));
  let last = null;
  for (const sa of read(`sa/ch-${ch}.json`).verses) {
    const english = squash(prabhupada(ens.get(sa.verseId)));
    if (!english || !sa.wordMeanings?.length) continue;
    if (last && last.english === english) last.verses.push(sa), last.ids.push(sa.verseId);
    else units.push((last = { english, ids: [sa.verseId], verses: [sa] }));
  }
}
const jobs = units.filter((u) => !done.has(u.ids[0]) && (!onlyVerses || u.ids.some((id) => onlyVerses.has(id))));
console.log(`${jobs.length} unit(s) to check (${units.length - jobs.length} skipped) — model ${model}, effort ${effort}`);
if (values['dry-run']) { if (jobs[0]) console.log(userPrompt(jobs[0])); process.exit(0); }

const controller = new AbortController();
process.on('SIGINT', () => { console.log('\nstopping after the calls in progress …'); controller.abort(); });
const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
const { ask } = createAsk({ provider: 'anthropic', apiKey, model, effort, signal: controller.signal, onWait: (m) => console.log(`   ${m}`) });

let spent = 0, finished = 0, found = 0, stopped = null;
const queue = [...jobs];
async function worker() {
  while (queue.length && !stopped) {
    if (controller.signal.aborted) { stopped = 'interrupted'; return; }
    if (spent >= maxSpend) { stopped = 'max-spend'; return; }
    const unit = queue.shift();
    try {
      const res = await ask({ system: SYSTEM, user: userPrompt(unit), schema: SCHEMA, maxTokens: 8000 });
      spent += res.costUsd ?? 0;
      const items = (res.data.items ?? []).filter((i) => i.differentThing && unit.ids.includes(i.verseId));
      appendFileSync(outFile, `${JSON.stringify({ ids: unit.ids, items, costUsd: res.costUsd })}\n`);
      finished++; found += items.length;
      if (finished % 50 === 0) console.log(`  ${finished}/${jobs.length}  ${found} items  $${spent.toFixed(2)}`);
    } catch (err) {
      spent += err.costUsd ?? 0;
      if (controller.signal.aborted) { stopped = 'interrupted'; return; }
      if (err instanceof FatalApiError || err instanceof RefusalError) { stopped = err.message; return; }
      console.log(`  ${unit.ids[0]}: ${err.message}`);
      appendFileSync(outFile, `${JSON.stringify({ ids: unit.ids, error: err.message })}\n`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`\nDone: ${finished} checked, ${found} items, $${spent.toFixed(2)}${stopped ? ` — stopped: ${stopped}` : ''}`);
