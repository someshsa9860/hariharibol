// The chanting-page quotes, the pure parts: a quote in a reader's language, what the app receives, the checks on a
// translation answer, how a run reads on the admin page, and the English seed data itself. No database.
//
//   node --test test/quote.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { languageInfo, wording, present, userPrompt, checkAnswer, presentRun, TRANSLATE_SCHEMA } from '../utils/quote.js';
import { quoteItems, checkQuotes } from '../prisma/seed/quotes/index.js';

const quote = {
  id: 'q1',
  slug: 'chant-and-be-happy',
  text: 'Chant Hare Krishna and be happy.',
  author: 'A. C. Bhaktivedanta Swami Prabhupada',
  reference: 'Lecture, 1969',
  sourceName: 'Vedabase',
  sourceUrl: 'https://vedabase.io/en/library/',
  translations: [
    { languageCode: 'hi', text: 'हरे कृष्ण का जप करो और सुखी रहो।', isPublished: true },
    { languageCode: 'ta', text: '', isPublished: true },
    { languageCode: 'gu', text: 'હરે કૃષ્ણ', isPublished: false },
  ],
};

test('wording follows the reader’s chain and stops at English', () => {
  assert.deepEqual(wording(quote, ['hi', 'en']), { text: quote.translations[0].text, language: 'hi' });
  assert.equal(wording(quote, ['ta', 'en']).language, 'en'); // an empty translation is no translation
  assert.equal(wording(quote, ['gu', 'en']).language, 'en'); // an unpublished one is hidden
  assert.equal(wording(quote, ['en', 'hi']).text, quote.text); // English ends the walk
  assert.equal(wording(quote).text, quote.text);
});

test('present always carries the author, the reference and the source', () => {
  const p = present(quote, ['hi', 'en']);
  assert.equal(p.language, 'hi');
  assert.equal(p.author, quote.author);
  assert.equal(p.reference, quote.reference);
  assert.equal(p.sourceUrl, quote.sourceUrl);
  assert.equal('translations' in p, false);
});

test('checkAnswer keeps the good answers and names the bad', () => {
  const asked = [{ slug: 'a', text: 'x' }, { slug: 'b', text: 'y' }, { slug: 'c', text: 'z' }, { slug: 'd', text: 'w' }];
  const data = { items: [{ slug: 'a', text: 'हरे कृष्ण' }, { slug: 'b', text: 'Hare Krishna' }, { slug: 'c', text: '  ' }] };
  const checked = checkAnswer(data, asked, 'hi');
  assert.equal(checked.ok, false);
  assert.deepEqual(checked.items, [{ slug: 'a', text: 'हरे कृष्ण' }]);
  assert.equal(checked.problems.length, 3);
  assert.ok(checked.problems.some((p) => p.includes('"d" is missing')));
  assert.ok(checked.problems.some((p) => p.includes('not written in Hindi')));
});

test('the prompt and schema name every quote by slug', () => {
  const prompt = userPrompt({ languageName: 'Hindi', endonym: 'हिन्दी', items: [{ slug: 'a', text: 'Hello' }] });
  assert.ok(prompt.includes('"slug":"a"') && prompt.includes('Hindi'));
  assert.deepEqual(TRANSLATE_SCHEMA.properties.items.items.required, ['slug', 'text']);
  assert.equal(languageInfo('en'), null);
  assert.equal(languageInfo('mr').name, 'Marathi');
});

test('presentRun reports progress', () => {
  const run = presentRun({ id: 'r', language: 'hi', provider: 'openai', model: 'm', status: 'RUNNING', totalItems: 10, doneItems: 5, activeSeconds: 50, heartbeatAt: new Date(), inputTokens: 1, outputTokens: 2, calls: 1 });
  assert.equal(run.progress.percent, 50);
  assert.equal(run.progress.etaSeconds, 50);
  assert.equal(run.stalled, false);
});

test('the seed is clean, and every quote has a source it can be checked at', () => {
  assert.deepEqual(checkQuotes(quoteItems), []);
  for (const item of quoteItems) assert.match(item.sourceUrl, /^https:\/\/(vedabase\.io|prabhupada\.io|prabhupada\.com)\//);
});

test('checkQuotes refuses a missing source, a duplicate and a long quote', () => {
  const ok = { slug: 'a-b', text: 'Short.', reference: 'r', author: 'a', sourceName: 's', sourceUrl: 'https://vedabase.io/x', status: 'PUBLISHED' };
  assert.deepEqual(checkQuotes([ok]), []);
  assert.ok(checkQuotes([{ ...ok, sourceUrl: '' }]).length);
  assert.ok(checkQuotes([{ ...ok, sourceUrl: 'http://x' }]).length);
  assert.ok(checkQuotes([ok, { ...ok, slug: 'c-d' }]).some((p) => p.includes('twice')));
  assert.ok(checkQuotes([{ ...ok, text: 'x'.repeat(401) }]).length);
});
