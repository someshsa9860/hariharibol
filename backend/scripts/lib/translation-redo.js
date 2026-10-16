// Putting right the few words a Malayalam or Tamil Gita translation left in English. The text around them is
// good, so nothing is retranslated: the Roman words are found by rule, a model is asked only for the wording of each
// gap, and the gaps are filled into the saved text — which can change nowhere else.
//
// Pure functions, no I/O (`npm test` covers them). The command line is scripts/redo-translation-parts.js.
//
//   romanSpans(lang, text)            the English words in a text: [{ id, start, end, text, roman, suffix, context }]
//   sortSpans(spans, { sanskrit, keep })   which the rules fill, which stay, which go to the model
//   touchUpPrompt({ lang, … })        what the model is asked for
//   gapsFrom(answer, spans)           the model's answer checked, as Map(id → wording)
//   fillGaps(text, spans, wording)    the text with the gaps filled

import { language } from './claude-translate-languages.js';
import { PART_LABELS } from './claude-translate-parts.js';
import { TRANSLATOR } from './claude-translate-source.js';
import { DIACRITIC, foreignRuns, iastTo } from './translation-script-fix.js';

/** What one word is always rendered as, per language, so every redone text agrees. The counts are from the saved corpus. */
export const GLOSSARY = {
  ta: [
    { english: 'transcendental (and transcendence, transcendentalist …)', rendering: 'அதீத', note: 'அதீத is the stem; it is in 103 of the 288 verses that say transcend-, against 55 of ஆழ்நிலை and 51 of அப்பாற்பட்ட' },
    { english: 'transcendentalist (a person)', rendering: 'ஆழ்நிலைவாதி', note: 'this is how 1.6.15, 1.6.19, 1.6.37, 1.6.44 and 1.15.11 word a transcendentalist; அதீதவாதி is not used anywhere' },
    { english: 'material', rendering: 'ஜட', note: 'ஜட is in 59 of 111 translations that say material, against 27 of பௌதிக' },
    { english: 'living entity, living entities', rendering: 'உயிர்வாழி (உயிர்வாழிகள்)', note: 'உயிர்வாழி is in 34 of 46 translations that say living entity' },
  ],
  ml: [
    { english: 'transcendental (and transcendence, transcendentalist …)', rendering: 'അതീന്ദ്രിയ', note: 'അതീന്ദ്രിയ is the stem; it is in 239 of the 288 verses that say transcend-, against 58 of അതീത and 22 of ദിവ്യ' },
    { english: 'material', rendering: 'ഭൗതിക', note: 'ഭൗതിക is in 107 of 111 translations that say material' },
  ],
};

/** A replacement is a few words; longer than this the model has rewritten a sentence. */
export const MAX_WORDING = 80;

/** A word that belongs to the English one in front of it — "transmigrate ചെയ്യുന്നു" is one verb, so the wording replaces both. */
const TAIL = {
  ml: /^\s+ചെയ്[\p{L}\p{M}]*/u,
  ta: /^\s+(?:ஆனதாக|ஆனது|ஆன|ஆகும்|ஆக|செய்[\p{L}\p{M}]*)(?![\p{L}\p{M}])/u,
};

/** A consonant standing alone between spaces is the stub of a word the model began and dropped (ஒரு த transcendentalist), not a word. */
const BARE_CONSONANT = /(?:^|\s)[\u0b95-\u0bb9\u0d15-\u0d3a]\s$/u;

/**
 * The English words in `text`: runs of Roman letters with no IAST diacritic (one with a diacritic is Sanskrit and
 * `fixProse` converts it). An ending joined by a hyphen ("transcendence-இல்") belongs to the span, and so does a
 * light verb or copula standing right after it ("transmigrate ചെയ്യുന്നു"), so the wording that replaces it carries
 * its own ending and reads as one phrase. So does a stub just before it: a lone consonant, or any of `fragments`
 * (a half-written word the audit found, such as "பொர" for பொருள்) — the wording replaces both. Ordered as they stand
 * in the text, `id` counting from 1.
 */
export function romanSpans(lang, text, { fragments = [] } = {}) {
  const spans = [];
  for (const run of foreignRuns(lang, text)) {
    if (run.kind !== 'latin' || DIACRITIC.test(run.text.normalize('NFC'))) continue;
    const suffix = /^[-‑][\p{L}][\p{L}\p{M}]*/u.exec(text.slice(run.end))?.[0] ?? TAIL[lang]?.exec(text.slice(run.end))?.[0] ?? '';
    const before = text.slice(0, run.start);
    const stub = fragments.find((f) => before.endsWith(`${f} `) && /(^|\s)$/.test(before.slice(0, before.length - f.length - 1)))
      ?? BARE_CONSONANT.exec(before)?.[0].trimStart().trimEnd();
    const start = stub ? run.start - (before.length - before.lastIndexOf(stub, before.length)) : run.start;
    const broken = stub ?? '';
    const end = run.end + suffix.length;
    spans.push({
      id: spans.length + 1,
      start,
      end,
      text: text.slice(start, end),
      roman: run.text,
      suffix,
      stub: broken,
      context: text.slice(Math.max(0, start - 14), end + 10).replace(/\n/g, ' '),
    });
  }
  return spans;
}

const same = (a, b) => a.normalize('NFC').toLowerCase() === b.normalize('NFC').toLowerCase();

/**
 * Splits the spans three ways: `kept` are left exactly as they stand (the word is the subject of the sentence — a
 * purport discussing the English word "worship"), `converted` are Sanskrit written without diacritics (bhajanti) and
 * are put into the language's script by rule, and `ask` go to the model.
 * @returns {{ ask: object[], kept: object[], converted: Map<number, string> }}
 */
export function sortSpans(lang, spans, { sanskrit = [], keep = [] } = {}) {
  const ask = [];
  const kept = [];
  const converted = new Map();
  for (const span of spans) {
    if (keep.some((w) => same(w, span.roman))) kept.push(span);
    else if (sanskrit.some((w) => same(w, span.roman))) converted.set(span.id, iastTo(lang, span.roman.normalize('NFC').toLowerCase()) + span.suffix);
    else ask.push(span);
  }
  return { ask, kept, converted };
}

/** The language's own letters, and nothing else: no Roman, no other Indic script. Returns what is wrong with a piece of wording. */
export function wordingProblems(lang, wording) {
  const problems = [];
  if (typeof wording !== 'string' || !wording.trim()) return ['it is empty'];
  if (wording !== wording.trim()) problems.push('it has a space at either end');
  if (wording.length > MAX_WORDING) problems.push(`it is ${wording.length} characters, over ${MAX_WORDING}`);
  if (/\n/.test(wording)) problems.push('it has a line break');
  const foreign = foreignRuns(lang, wording);
  if (foreign.length) problems.push(`it has ${foreign[0].kind === 'latin' ? 'Roman' : 'other-script'} letters: "${foreign[0].text.slice(0, 30)}"`);
  return problems;
}

/**
 * Whether `wording` writes the broken start again. A short stub (one letter, a letter and its vowel sign) is a word on its
 * own only if it stands alone — "த" is inside ஆழ்நிலைவாதி — so it must match a whole word; a longer one ("பொர",
 * "ஆதிச்") also counts when the wording begins with it, because that is the same half-word carried on.
 */
export function reusesStub(wording, stub) {
  const words = wording.trim().split(/\s+/);
  const run = stub.trim().split(/\s+/);
  for (let i = 0; i + run.length <= words.length; i++) if (run.every((w, j) => words[i + j] === w)) return true;
  return stub.length > 2 && wording.startsWith(stub);
}

/** The answer's `gaps` as Map(id → wording); throws with every problem if one is missing, repeated, unknown or not clean. */
export function gapsFrom(lang, answer, spans) {
  const problems = [];
  const wording = new Map();
  const answered = new Set(); // a gap with a refused wording is not also "missing"
  for (const gap of Array.isArray(answer?.gaps) ? answer.gaps : []) {
    const span = spans.find((s) => s.id === gap?.id);
    if (!span) problems.push(`gap ${gap?.id}: there is no such gap`);
    else if (answered.has(gap.id)) problems.push(`gap ${gap.id}: given twice`);
    else {
      answered.add(gap.id);
      const bad = wordingProblems(lang, gap.text);
      if (span.stub && typeof gap.text === 'string' && reusesStub(gap.text, span.stub)) bad.push(`it keeps the broken start "${span.stub}", which is not a word — write the whole phrase without it`);
      if (bad.length) problems.push(`gap ${gap.id}: ${bad.join('; ')}`);
      else wording.set(gap.id, gap.text);
    }
  }
  for (const span of spans) if (!answered.has(span.id)) problems.push(`gap ${span.id}: no wording given`);
  if (problems.length) throw Object.assign(new Error(problems.join(' | ')), { problems });
  return wording;
}

/** `text` with each span in `wording` (Map id → wording) replaced. Spans without wording stay as they are. */
export function fillGaps(text, spans, wording) {
  let out = text;
  for (const span of spans.slice().sort((a, b) => b.start - a.start)) {
    if (!wording.has(span.id)) continue;
    if (out.slice(span.start, span.end) !== span.text) throw new Error(`gap ${span.id}: the text is not what was read ("${span.text}")`);
    out = out.slice(0, span.start) + wording.get(span.id) + out.slice(span.end);
  }
  return out;
}

/* ---------- the saved text a touch-up reaches ---------- */

const ownRows = (verse, lang) => (verse.commentaries || []).filter((c) => c.translatorSlug === TRANSLATOR && c.language === lang);

/**
 * The prose fields of one part of a saved verse: [{ label, text, set(verse, text) }]. A translation or purport is one
 * row, word meanings one field per entry.
 */
export function proseFields(lang, verse, part) {
  if (part === 'translation' || part === 'purport') {
    return ownRows(verse, lang)
      .filter((row) => row.type === part)
      .map((row) => ({ label: part, text: row.text || '', set: (v, text) => { ownRows(v, lang).find((r) => r.type === part).text = text; } }));
  }
  if (part === 'wordMeanings') {
    return (verse.wordMeanings || []).map((entry, i) => ({ label: `word ${i + 1}`, text: entry.meaning || '', set: (v, text) => { v.wordMeanings[i].meaning = text; } }));
  }
  throw new Error(`"${part}" is not a part with prose in it`);
}

/** The English the field was made from, to show the model. */
export function englishOf(unit, part, label) {
  if (part === 'translation') return unit.translation;
  if (part === 'purport') return (unit.purport || []).join('\n\n');
  const i = Number(/^word (\d+)$/.exec(label)?.[1]) - 1;
  const entry = unit.wordMeanings?.[i];
  return entry ? `${entry.word} — ${entry.meaning}` : '';
}

/* ---------- the question ---------- */

/** The text with the gaps marked, so the model sees each one in place: …【1: transcendence-இல்】… */
export function marked(text, spans) {
  let out = text;
  for (const span of spans.slice().sort((a, b) => b.start - a.start)) out = out.slice(0, span.start) + `【${span.id}: ${span.text}】` + out.slice(span.end);
  return out;
}

export const GAPS_SCHEMA = {
  type: 'object',
  properties: { gaps: { type: 'array', items: { type: 'object', properties: { id: { type: 'integer' }, text: { type: 'string' } }, required: ['id', 'text'], additionalProperties: false } } },
  required: ['gaps'],
  additionalProperties: false,
};

/**
 * What the model is asked: the wording of each gap, nothing else. It cannot change the text around a gap, so the
 * request says so and the answer cannot reach it either (`fillGaps` writes only into the spans).
 * @returns {{ system: string, user: string, schema: object }}
 */
export function touchUpPrompt({ lang, part, label, english, text, spans, problems = [], glossary = GLOSSARY[lang] ?? [], hint = '' }) {
  const { name, endonym } = language(lang);
  const system = [
    `You finish one passage of Śrīla Prabhupāda's Bhagavad-gītā As It Is in ${name} (${endonym}). It was translated well, except that a few words were left in English. Each is marked 【n: …】 in the passage. For each one you give the ${name} wording.`,
    '',
    'RULES',
    `- Answer with the wording for each gap and nothing else. The passage around a gap is kept exactly as it is and you cannot change it.`,
    `- The wording replaces everything between 【 and 】 — the English word, and with it any ${name} ending joined to it by a hyphen, the verb that goes with it (ചെയ്യുന്നു, செய்கிறது, ஆன …) and a broken start of a word standing in front of it (a few letters that stop short, such as "த" or "பொர"). That broken start is a mistake in the text, not part of it: do not write it again. So carry the ending yourself: the case ending, the verb form, the plural, whatever the words next to the gap need to read correctly.`,
    `- Say everything the English words in a gap say, and nothing more: a broken start in front of the English was the translator's try at one of them, so its meaning is still wanted. Do not repeat a word the passage already has beside the gap.`,
    `- Write ${name} letters only (${endonym}). No Roman letters, no letters of another script, no quotation marks round it. A few words at most; never a sentence.`,
    `- The register is Prabhupāda's devotional ${name}: the words a ${name}-speaking devotee reads in his books, plain and respectful.`,
    ...(glossary.length ? ['', 'FIXED RENDERINGS (so every passage agrees)', ...glossary.map((g) => `- ${g.english} → ${g.rendering}. ${g.note}.`)] : []),
  ].join('\n');
  const user = [
    `Passage: ${PART_LABELS[part] ?? part}${label && label !== part ? ` (${label})` : ''}`,
    '',
    'English original:',
    english,
    '',
    `${name} passage, gaps marked:`,
    marked(text, spans),
    '',
    'Gaps:',
    ...spans.map((s) => `${s.id}: ${s.text}`),
    ...(hint ? ['', `Note on this passage: ${hint}`] : []),
    ...(problems.length ? ['', 'Your last answer was refused:', ...problems.map((p) => `- ${p}`), 'Answer again.'] : []),
  ].join('\n');
  return { system, user, schema: GAPS_SCHEMA };
}
