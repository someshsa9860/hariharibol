// Second look at what review.mjs flagged. Each flagged unit goes back to the model, with its proposed edits numbered, and a
// stricter rubric: apply only if the current text is really wrong and the replacement is right. Writes runs/<out> (one line per unit).
//
//   node verify.mjs --from DIR --in runs/full.jsonl --out runs/verified.jsonl [--effort low] [--max-spend 10]
//
// Edits about 1.1.1 dharma-kṣetre are skipped here: they are applied by hand-written patches (patches/term-fixes.json).

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
    from: { type: 'string' }, in: { type: 'string' }, out: { type: 'string' }, model: { type: 'string' }, provider: { type: 'string' }, effort: { type: 'string' },
    'max-spend': { type: 'string' }, concurrency: { type: 'string' }, 'dry-run': { type: 'boolean' },
  },
});
if (!values.from || !values.in || !values.out) throw new Error('--from DIR, --in FILE and --out FILE are required');

const { createAsk, providerOf } = await import(resolve(backend, 'scripts/lib/translate-providers.js'));
const { language } = await import(resolve(backend, 'scripts/lib/claude-translate-languages.js'));
const { FatalApiError, RefusalError } = await import(resolve(backend, 'scripts/lib/claude-translate-client.js'));
const { loadUnit, unitPrompt, check } = await import('./units.mjs');

const provider = values.provider || 'anthropic';
const model = values.model || providerOf(provider).defaultModel;
const effort = values.effort || 'low';
const maxSpend = Number(values['max-spend'] ?? 10);
const concurrency = Number(values.concurrency ?? 8);
const from = resolve(values.from);
const outFile = resolve(values.out);

const SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['verdicts'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['n', 'analysis', 'verdict', 'find', 'replace'],
        properties: {
          n: { type: 'integer' },
          analysis: { type: 'string' },
          verdict: { type: 'string', enum: ['apply', 'reject'] },
          find: { type: 'string' },
          replace: { type: 'string' },
        },
      },
    },
  },
};

const system = (lang) => {
  const L = language(lang).name;
  return `You are the second, stricter proofreader of a ${L} edition of Bhagavad-gītā As It Is (Prabhupāda). A first reviewer proposed numbered edits. Most proposals are not real errors. You decide each one, and nothing changes in this sacred text unless you are sure.

Prabhupāda's English is the authority; the ${L} is its translation. A ${L} that says what his English says is correct even where his English is looser than the Sanskrit or glosses a term in his own way. Do not bring the ${L} closer to the literal Sanskrit.

APPLY only if BOTH hold:
1. The current ${L} is really wrong: it does not say what the English says (wrong sense, lost or added negation, wrong person/number/relation, dropped or invented meaning, untranslated English word), or it is plainly ungrammatical or misspelt for a native reader, or it names a different thing than the Sanskrit word does (dharma-kṣetre → "pilgrimage place").
2. Your replacement is correct, natural ${L}, minimal, in the same register and spelling conventions as its surroundings, with every agreement still right (case ending, postposition, verb form, gender, number). Read the whole sentence with the replacement in place before you decide.

REJECT: variant spellings and alternative acceptable words; style or taste; anything that follows the English; anything the proposer hedged; a replacement you are not fully sure of; a change that makes the word list disagree with the translation of the same verse. When in doubt, reject.

For each proposal give "analysis" first (two sentences at most), then the verdict. For "apply" you may improve "find"/"replace" (the find must occur exactly once in the text it is taken from); for "reject" repeat the proposal's find and replace unchanged.`;
};

const rows = readFileSync(resolve(values.in), 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
const done = new Set();
if (existsSync(outFile)) for (const l of readFileSync(outFile, 'utf8').split('\n')) if (l.trim()) { const r = JSON.parse(l); if (!r.error) done.add(`${r.lang}|${r.ids[0]}`); }
mkdirSync(dirname(outFile), { recursive: true });

const jobs = rows
  .filter((r) => r.issues?.length && !done.has(`${r.lang}|${r.ids[0]}`))
  .map((r) => ({ ...r, issues: r.issues.filter((i) => !(i.verseId === '1.1.1' && /dharma/i.test(i.reason))) }))
  .filter((r) => r.issues.length);
console.log(`${jobs.length} unit(s) to verify — model ${model}, effort ${effort}`);

const proposals = (job) => job.issues.map((i, n) => `${n}. [${i.part}${i.part === 'wordMeanings' ? ` line ${i.index}` : ''}, verse ${i.verseId}] "${i.find}" → "${i.replace}"   (${i.kind}, ${i.confidence}) ${i.reason}`).join('\n');
const promptFor = (job) => `${unitPrompt(job.lang, loadUnit(from, job.lang, job.ids))}\n\n=== PROPOSED EDITS ===\n${proposals(job)}`;

if (values['dry-run']) { if (jobs[0]) console.log(`${system(jobs[0].lang)}\n\n${promptFor(jobs[0])}`); process.exit(0); }

const controller = new AbortController();
process.on('SIGINT', () => { console.log('\nstopping after the calls in progress …'); controller.abort(); });
const { keyEnv } = providerOf(provider);
const apiKey = process.env[keyEnv];
if (!apiKey) throw new Error(`${keyEnv} is not set`);
const { ask } = createAsk({ provider, apiKey, model, effort, signal: controller.signal, onWait: (m) => console.log(`   ${m}`) });

let spent = 0, finished = 0, applied = 0, rejected = 0, stopped = null;
const queue = [...jobs];
async function worker() {
  while (queue.length && !stopped) {
    if (controller.signal.aborted) { stopped = 'interrupted'; return; }
    if (spent >= maxSpend) { stopped = 'max-spend'; return; }
    const job = queue.shift();
    try {
      const unit = loadUnit(from, job.lang, job.ids);
      const res = await ask({ system: system(job.lang), user: promptFor(job), schema: SCHEMA, maxTokens: 8000 });
      spent += res.costUsd ?? 0;
      const out = [];
      for (const v of res.data.verdicts ?? []) {
        const orig = job.issues[v.n];
        if (!orig) continue;
        if (v.verdict !== 'apply') { rejected++; continue; }
        const issue = { ...orig, find: v.find, replace: v.replace, verifierNote: v.analysis };
        const why = check(unit, issue);
        if (why) { rejected++; out.push({ ...issue, rejectedBecause: why }); continue; }
        applied++;
        out.push(issue);
      }
      appendFileSync(outFile, `${JSON.stringify({ lang: job.lang, ids: job.ids, apply: out.filter((i) => !i.rejectedBecause), unusable: out.filter((i) => i.rejectedBecause), costUsd: res.costUsd })}\n`);
      finished++;
      if (finished % 25 === 0) console.log(`  ${finished}/${jobs.length}  apply ${applied} / reject ${rejected}  $${spent.toFixed(2)}`);
    } catch (err) {
      spent += err.costUsd ?? 0;
      if (controller.signal.aborted) { stopped = 'interrupted'; return; }
      if (err instanceof FatalApiError || err instanceof RefusalError) { stopped = err.message; return; }
      console.log(`  ${job.lang} ${job.ids[0]}: ${err.message}`);
      appendFileSync(outFile, `${JSON.stringify({ lang: job.lang, ids: job.ids, error: err.message })}\n`);
    }
  }
}
await Promise.all(Array.from({ length: concurrency }, worker));
console.log(`\nDone: ${finished} verified, ${applied} to apply, ${rejected} rejected, $${spent.toFixed(2)}${stopped ? ` — stopped: ${stopped}` : ''}`);
