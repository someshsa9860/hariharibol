// What the model is told, and the shape it must answer in. Changing the system prompt or the
// user-message layout changes what comes back: bump PROMPT_VERSION (it is stored in every
// saved part, so a later reader can tell which prompt produced it).
//
// A call carries only the instructions and the source text of the parts it is asked for (the "lane" of
// claude-translate-parts.js): a call that writes the transliteration is not told how to translate a purport
// and is not sent one. The model is sent Prabhupada's English translation and purport, the verse's
// transliteration (the Sanskrit in Roman letters, line by line) and its word-by-word list (each Sanskrit
// word in Roman letters with its English meaning). The Devanagari verse and every other commentator's
// text are never sent.

import { language } from './claude-translate-languages.js';
import { PARTS, PART_LABELS } from './claude-translate-parts.js';
import { BOOK, bookOf } from './claude-translate-source.js';
import { VIKARA_SLUGS } from './claude-translate-validate.js';

export const PROMPT_VERSION = '9';

// The Bhagavatam's vikara tags: asked for Marathi only, and read from the English meaning and purport, so
// the answer does not depend on which language is being written.
export const ISSUES_BOOK = 'srimad-bhagavatam';
export const ISSUES_LANG = 'mr';
export { VIKARA_SLUGS };
// The tags feed the app's "what are you struggling with" picker, so a tag is a promise that someone struggling with
// that vikara will find it spoken to here. A loose question ("helps the reader overcome") tags every verse about
// Kṛṣṇa with moha, so the test is what the text itself says, and none is the usual answer. The same bar as
// scripts/seed-verse-issues.js: no passing mentions, no righteous anger, no Lord's wrath.
const ISSUES_INSTRUCTION = `Also return "issues": the vikaras (inner enemies) that a reader struggling with one would find spoken to in this verse, judged from its translation and purport below. Use only these names, in lowercase exactly as written: kama (lust, craving, wanting what will not satisfy), krodha (anger, irritation), lobha (greed, holding on, never having enough), moha (attachment to body, family and possessions, and mistaking what is temporary for what lasts), mada (pride, arrogance), matsarya (envy).
Tag a vikara only when the text itself names it, explains how it arises or what it does, shows it at work in someone, or teaches how to be free of it. That hearing about Kṛṣṇa benefits everyone in general is not a reason to tag, and neither is a passing mention or a vice that appears only in a list.
Most verses have no tag, so return [] for them: narration, questions put to a sage, genealogies, descriptions of the Lord, His body and His pastimes, and general praise of hearing or devotion. The Lord's own anger, or His killing of a demon, is not krodha for the reader to overcome. The usual answer is none or one; give two only when the text clearly speaks to both, and never fill the list. When unsure, return [].`;

/** Whether this call asks the model for the vikara tags: Bhagavatam, Marathi among the languages, and the meaning or purport in the call. */
export function issuesAsked(bookId, langCodes, parts) {
  return bookId === ISSUES_BOOK && langCodes.includes(ISSUES_LANG) && has(parts, 'translation', 'purport');
}

/** One language's answer shape with the vikara tags added: an array of the six names, possibly empty. No `uniqueItems`: OpenAI's strict mode rejects it (400), and the validator drops repeats anyway. */
function withIssues(perLanguage) {
  const issues = { type: 'array', items: { type: 'string', enum: VIKARA_SLUGS } };
  return { ...perLanguage, properties: { ...perLanguage.properties, issues }, required: [...perLanguage.required, 'issues'] };
}

const has = (parts, ...names) => names.some((n) => parts.includes(n));
const orderOf = (parts) => PARTS.filter((p) => parts.includes(p));
const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

const QUOTED = { translation: '"translation"', transliteration: '"transliteration"', wordMeanings: '"wordMeanings"', purport: '"purport"' };

/** The system prompt for the given parts of the Gita; all four by default. */
function compose(parts) {
  const text = has(parts, 'translation', 'purport');
  const textWhat = list(['translation', 'purport'].filter((p) => parts.includes(p)));
  const script = has(parts, 'transliteration', 'wordMeanings');
  const out = [];

  const jobs = [];
  if (text) jobs.push(`render A. C. Bhaktivedanta Swami Prabhupāda's English ${textWhat} of the Bhagavad-gītā into Indian languages`);
  if (parts.includes('transliteration')) jobs.push("write each verse's Sanskrit in those languages' scripts");
  if (parts.includes('wordMeanings')) jobs.push("give each verse's word-by-word meanings in those languages");
  out.push(`You are a translator of devotional scripture working for a Vaishnava learning app. You ${list(jobs)}, for sincere readers who will treat the text as sacred.`);
  out.push(
    text
      ? "The aim is Prabhupāda's own words in another language: the reader receives exactly what Prabhupāda wrote, nothing more and nothing less, and it reads as correct, natural and respectful to a native speaker."
      : "The aim is Prabhupāda's own text in another language's script: the reader receives exactly what Prabhupāda wrote, nothing more and nothing less, spelled and worded as that language's devotional books do."
  );
  out.push(
    `For every verse you return, per language: ${list(orderOf(parts).map((p) => `${{ translation: 'the translation', purport: 'the purport', transliteration: "the verse in that language's script", wordMeanings: 'the word-by-word meanings' }[p]} (${QUOTED[p]})`))}, with a rating of each ("correctness") and, when something is doubtful, a "note".`
  );

  if (text) {
    out.push(`TRANSLATION AND PURPORT — PRABHUPĀDA'S WORDS, AS THEY ARE
- The English you are given is the only source. Render exactly what it says, as it says it. Nothing from any other translator, commentator or edition, and nothing from your own knowledge of the verse, goes in: no other author's wording, and no explanation, example, gloss or clarification of your own. Do not add, drop, explain, summarise, soften, modernise, merge, reorder or "improve" anything. No footnotes, notes, headings or translator's remarks.
- Go sentence by sentence, in the same order, with the same number of sentences. A long sentence stays one sentence unless the language cannot bear it.
- Keep parentheses, brackets, quotation marks, emphasis, numbers and verse references as they are in the English. Write every number with ASCII digits (0-9), never the language's own digits. A reference such as "Bg. 7.14" keeps its numbers; write the abbreviation in the target script.
- Theology is rendered exactly as the English states it — never neutralised, and never padded with comparisons or disclaimers.`);
    out.push(`NATIVE GRAMMAR, CLARITY AND RESPECT
- Being faithful does not mean keeping the English word order. Inside each sentence, write as a well-educated native speaker writes: the language's own word order, case endings, verb agreement and tense, correct spelling and punctuation. It must read as correct, natural prose in that language, not as a translation.
- Plain and understandable: a devout ordinary reader should follow it at the first reading. Prefer the common word that the language's devotional books use over a rare, archaic or heavily Sanskritised one — but where the English itself uses a Sanskrit term, keep that term.
- Respectful: the register of a respected spiritual book, not a news or textbook register and not a literal word-for-word gloss. Honorifics and divine names keep their full weight: "Lord", "the Supreme Personality of Godhead", "Śrīla Prabhupāda", "Kṛṣṇa". Use the traditional respectful form of each language, never a flatter equivalent.
- Address and refer to Kṛṣṇa, Arjuna, sages and elders with the respectful verb forms the language has (for example "म्हणाले" in Marathi, "बोले" in Hindi, "கூறினார்" in Tamil).`);
  }

  if (has(parts, 'translation', 'purport', 'wordMeanings')) {
    out.push(`NAMES AND SANSKRIT TERMS
- Proper names and Sanskrit terms in the English (Kṛṣṇa, Arjuna, Bhagavān, dharma, karma, yoga, ātmā, brahman, guṇa, māyā, kṣatriya …) are written in the target script in the spelling that language's devotional literature uses. They are transcribed, not translated into a descriptive phrase — unless the English itself explains them in words.
- Spell the same name the same way every time, in every ${text ? 'paragraph' : 'entry'}.`);
  }

  if (script) {
    out.push(`THE TARGET SCRIPT
- Write the Sanskrit only with the letters and signs of the target language's own script (plus its danda, ASCII digits and ordinary punctuation). Never put a character of another Indic script — Devanagari, Bengali, Gujarati, Kannada … — into the text, and never leave Roman letters in it.
- Where the target script has no sign for something Sanskrit uses, write it the way that language's printed editions do (in Tamil, for example, the visarga ḥ is ஃ), never with a letter borrowed from another script.`);
  }

  if (parts.includes('transliteration')) {
    const others = orderOf(parts).filter((p) => p !== 'transliteration' && p !== 'purport');
    out.push(`VERSE TRANSLITERATION
- You are given the Sanskrit verse as lines of Roman transliteration (for example "dharmakṣetre kurukṣetre samavetā yuyutsavaḥ ."). Return "transliteration": the same verse written in the target language's script, exactly one string for each line given, in the same order. This is a change of script, not a translation — every syllable of the Sanskrit is kept; nothing is translated, explained, respelled by meaning, added or dropped.
- Spell the Sanskrit the way that language's printed editions of the Bhagavad-gītā do: Hindi and Marathi in Devanagari exactly as Sanskrit is written there (anusvāra, visarga, avagraha, conjuncts); Bengali, Tamil, Telugu, Kannada and Malayalam in their own script, with the extra letters that script uses for Sanskrit sounds (for example the Grantha letters in Tamil and Malayalam).
- A line's closing " ." is the danda and a closing "||2-47||" is the verse number: write both as that language's books print them (for example । and ॥ in Devanagari), with the verse number in ASCII digits exactly as given. A line that has only a speaker's name and "uvāca" stays that line.${others.length ? `\n- The same Sanskrit word is spelled the same way here, in ${list(others.map((p) => QUOTED[p]))}.` : ''}`);
  }

  if (parts.includes('wordMeanings')) {
    out.push(`WORD-BY-WORD MEANINGS
- You are given a numbered list of entries, each a Sanskrit word in Roman letters (as Prabhupāda prints it, e.g. "dharma-kṣetre") and its English meaning.
- Return "wordMeanings": exactly one object per entry, in the same order, with the same count. Never merge, split, drop or reorder entries.
- "word": the same Sanskrit word written in the target language's script, spelled as that language's devotional literature spells it (dharma-kṣetre → धर्म-क्षेत्रे in Hindi and Marathi, ಧರ್ಮ-ಕ್ಷೇತ್ರೇ in Kannada). Keep the hyphens and the case endings exactly as given; do not translate the word or replace it with its meaning. A word given as two words (e.g. "dhṛtarāṣṭraḥ uvāca") stays two words.
- "meaning": the English meaning translated into the target language, as short as the English is, in the same respectful register (the meaning of an entry is a gloss, not a sentence — do not turn it into one). ${has(parts, 'translation', 'purport') ? `Terms are rendered exactly as in ${list(['translation', 'purport'].filter((p) => parts.includes(p)).map((p) => QUOTED[p]))} so they agree.` : 'Terms are rendered the way that language\'s devotional literature renders them, the same way every time.'}`);
  }

  const careful = [];
  careful.push(`- ${list(orderOf(parts).map((p) => QUOTED[p]))} come back, every time. An empty array is right only where the input says "(none)" or "(no purport)" — never leave a part empty to save effort when the English gave it.`.replace(' come back,', parts.length > 1 ? ' all come back,' : ' comes back,'));
  if (parts.includes('transliteration')) careful.push('- "transliteration" has exactly as many strings as the lines you were given, each the same Sanskrit line in the target script, with no line break inside a string.');
  if (text) careful.push('- Every sentence and every clause of the English is present, in order — nothing shortened, even in languages that need fewer words than English.', '- Every number, parenthesis, bracket and quotation mark of the English is present exactly where it belongs.');
  if (parts.includes('wordMeanings')) careful.push('- "wordMeanings" has exactly as many entries as the list you were given, each word in the target script and each meaning translated.');
  if (parts.includes('purport')) careful.push('- Every purport paragraph is translated in full, and the array has exactly as many strings as the English has paragraphs, with no line break inside any string.');
  if (has(parts, 'translation', 'purport', 'wordMeanings')) careful.push("- Each sacred or technical term is rendered the same way every time within one language, and as an unambiguous word in that language (a word that means something else to an ordinary reader there is avoided or made clear by the English's own context).");
  careful.push(text ? "- The text reads like a natural, respected devotional book in that language — correct grammar and traditional honorific forms — not like a translation, and carries nothing that is not Prabhupāda's." : "- Everything is in the target script only, spelled as that language's printed devotional books spell it, and carries nothing that is not in the source.");
  out.push(`GET IT RIGHT THE FIRST TIME
This is a single attempt: the answer is saved as written, and your ratings are how a reviewer finds the verses that need another look. So, as you write each language, make sure of these:
${careful.join('\n')}`);

  out.push(`CORRECTNESS RATING
After writing a language, rate each of its parts — ${list(orderOf(parts).map((p) => QUOTED[p]))} — honestly, with 1, 2 or 3 (give 3 for a part there is none of, such as the purport of a verse that has none):
- 3 = perfect: ${text ? "every sentence of Prabhupāda's text is rendered completely and exactly, the grammar is right and the wording is natural and respectful to a native reader" : 'every syllable and every entry is rendered completely and exactly, spelled as that language\'s printed books spell it'}; you would not change a word.
- 2 = good: complete and faithful, but you are not fully sure of a wording, a term or the spelling of some phrase.
- 1 = needs a second round: something is missing, the meaning is uncertain, or you know a native reader would find it wrong.
Never give 3 out of habit — a wrong 3 hides a verse that needed another look. If any rating is below 3, "note" says in one short English sentence what is doubtful; otherwise "note" is an empty string.`);

  const fields = [];
  if (parts.includes('transliteration')) fields.push('"transliteration" is the verse in that script, one string per line (an empty array when none is given)');
  if (parts.includes('translation')) fields.push('"translation" is the translated translation text');
  if (parts.includes('wordMeanings')) fields.push('"wordMeanings" is the translated word-by-word list described above (an empty array when none is given)');
  if (parts.includes('purport')) fields.push('"purport" is an array with exactly one string for each purport paragraph, in order, each paragraph translated in full (an empty array when the English has no purport)');
  out.push(`OUTPUT
- Answer with the JSON object the schema asks for and nothing else.
- For each requested language: ${fields.join('; ')}; "correctness" has the ${orderOf(parts).length === 1 ? 'rating' : `${orderOf(parts).length} ratings`}; "note" is as described above.
- Write each language in its own script: Hindi and Marathi in Devanagari (as Hindi and as Marathi — they are different languages), Bengali, Tamil, Telugu, Kannada and Malayalam in their own scripts.`);

  return out.join('\n\n');
}

/** The instructions for all four parts. */
export const SYSTEM_PROMPT = compose(PARTS);

/**
 * The system prompt for a book and the parts a call writes. The Gita's is the text above; another book's is
 * the same rules with its own title where the Gita's stood (and its own speakers and reference in the examples).
 * @param {string} [bookId]
 * @param {string[]} [parts]  which of translation, purport, transliteration, wordMeanings the call writes
 */
export function systemPromptFor(bookId = BOOK, parts = PARTS) {
  const wanted = orderOf(parts);
  if (!wanted.length) throw new Error('A prompt needs at least one part');
  const base = wanted.length === PARTS.length ? SYSTEM_PROMPT : compose(wanted);
  if (bookId === BOOK) return base;
  return base
    .replaceAll('Bhagavad-gītā', bookOf(bookId).title)
    .replace('"Bg. 7.14"', '"SB 1.2.17"')
    .replace('Kṛṣṇa, Arjuna, sages and elders', 'Kṛṣṇa, sages, kings and elders')
    .replace('(Kṛṣṇa, Arjuna, Bhagavān,', '(Kṛṣṇa, Parīkṣit, Bhagavān,');
}

/** JSON Schema for the answer: one object per requested language, holding only the requested parts. */
export function answerSchema(langCodes, parts = PARTS, bookId = BOOK) {
  const wanted = orderOf(parts);
  const rating = { type: 'integer', enum: [1, 2, 3] };
  const shapes = {
    transliteration: { type: 'array', items: { type: 'string' } },
    translation: { type: 'string' },
    purport: { type: 'array', items: { type: 'string' } },
    wordMeanings: {
      type: 'array',
      items: {
        type: 'object',
        properties: { word: { type: 'string' }, meaning: { type: 'string' } },
        required: ['word', 'meaning'],
        additionalProperties: false,
      },
    },
  };
  const perLanguage = {
    type: 'object',
    properties: {
      ...Object.fromEntries(wanted.map((p) => [p, shapes[p]])),
      // The model's own 1-3 rating of each part; the run lowers it further when its checks find a problem.
      correctness: {
        type: 'object',
        properties: Object.fromEntries(wanted.map((part) => [part, rating])),
        required: [...wanted],
        additionalProperties: false,
      },
      note: { type: 'string' },
    },
    required: [...wanted, 'correctness', 'note'],
    additionalProperties: false,
  };
  return {
    type: 'object',
    properties: Object.fromEntries(langCodes.map((c) => [c, issuesAsked(bookId, [c], parts) ? withIssues(perLanguage) : perLanguage])),
    required: [...langCodes],
    additionalProperties: false,
  };
}

/**
 * The user message for one call: the verse, and the source text of the parts asked for only.
 *
 * @param {{ ref: string, translation: string, purport: string[], transliteration?: string[], wordMeanings?: object[] }} unit
 * @param {string[]} langCodes
 * @param {Record<string, string[]>} [problems]  per language, what was wrong with the last try
 * @param {string} [bookId]
 * @param {string[]} [parts]
 */
export function userPrompt(unit, langCodes, problems = {}, bookId = BOOK, parts = PARTS) {
  const langs = langCodes.map((c) => `${c} (${language(c).name})`).join(', ');
  const wanted = orderOf(parts);
  const lines = [`${bookOf(bookId).title} ${unit.ref}`, '', `Write, for: ${langs}.`, `Parts: ${wanted.map((p) => PART_LABELS[p].toLowerCase()).join(', ')}.`];
  if (issuesAsked(bookId, langCodes, parts)) lines.push('', ISSUES_INSTRUCTION);

  if (wanted.includes('translation')) lines.push('', '<translation>', unit.translation, '</translation>');
  if (wanted.includes('purport')) {
    const purport = unit.purport.length ? unit.purport.map((p, i) => `<paragraph n="${i + 1}">\n${p}\n</paragraph>`).join('\n') : '(no purport)';
    lines.push('', `<purport paragraphs="${unit.purport.length}">`, purport, '</purport>');
  }
  if (wanted.includes('transliteration')) {
    const verse = unit.transliteration || [];
    lines.push('', `<transliteration lines="${verse.length}">`);
    lines.push(...(verse.length ? verse.map((l, i) => `<line n="${i + 1}">${l}</line>`) : ['(none)']));
    lines.push('</transliteration>');
  }
  if (wanted.includes('wordMeanings')) {
    const words = unit.wordMeanings || [];
    lines.push('', `<word_meanings count="${words.length}">`);
    lines.push(...(words.length ? words.map((w, i) => `${i + 1}. ${w.word || '(no word)'} — ${w.meaning}`) : ['(none)']));
    lines.push('</word_meanings>');
  }
  const retry = langCodes.filter((c) => problems[c]?.length);
  if (retry.length) {
    lines.push('', 'An earlier attempt for these languages could not be used. Write again from the source above, fixing every point:');
    for (const c of retry) {
      lines.push(`- ${c}: ${problems[c].slice(0, 6).join('; ')}`);
    }
  }
  return lines.join('\n');
}
