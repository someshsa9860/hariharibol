// Devotee etiquette, the pure parts: which item a date gets, an item in a reader's language, the push, the checks on a
// translation answer, how a run reads on the admin page, and the English seed data itself. No database.
//
//   node --test test/etiquette.test.js

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORY_IDS, categories, languages } from '../config/etiquette.js';
import {
  STATUSES,
  categoryName,
  isCategory,
  languageInfo,
  pickNext,
  wording,
  present,
  etiquettePush,
  userPrompt,
  estimateTokens,
  scriptShare,
  checkAnswer,
  presentRun,
  TRANSLATE_SCHEMA,
} from '../utils/etiquette.js';
import { etiquetteItems, checkItems } from '../prisma/seed/etiquette/index.js';

/* ---------- which item a date gets ---------- */

const pool = [
  { id: 'c', sortOrder: 3 },
  { id: 'a', sortOrder: 1 },
  { id: 'b', sortOrder: 2 },
];

test('pickNext: nothing published gives null', () => {
  assert.equal(pickNext([], new Map()), null);
});

test('pickNext: never-used items come first, in their order', () => {
  assert.equal(pickNext(pool, new Map()), 'a');
  assert.equal(pickNext(pool, new Map([['a', '2026-10-01']])), 'b');
  assert.equal(
    pickNext(pool, new Map([['a', '2026-10-01'], ['b', '2026-10-02']])),
    'c'
  );
});

test('pickNext: once all have had a day, the one given longest ago', () => {
  const used = new Map([
    ['a', '2026-10-03'],
    ['b', '2026-10-01'],
    ['c', '2026-10-02'],
  ]);
  assert.equal(pickNext(pool, used), 'b');
});

test('pickNext: a tie on date goes to sortOrder, then id', () => {
  const used = new Map([
    ['a', '2026-10-01'],
    ['b', '2026-10-01'],
    ['c', '2026-10-01'],
  ]);
  assert.equal(pickNext(pool, used), 'a');
  const same = [
    { id: 'y', sortOrder: 5 },
    { id: 'x', sortOrder: 5 },
  ];
  assert.equal(pickNext(same, new Map()), 'x');
});

test('pickNext: an item that is not published is never in the pool, so it is never picked', () => {
  // The caller passes only PUBLISHED rows; a used-date for an id outside the pool changes nothing.
  const used = new Map([['gone', '2026-01-01']]);
  assert.equal(pickNext(pool, used), 'a');
});

test('pickNext: walking a long run visits every item once before any repeats', () => {
  const items = Array.from({ length: 7 }, (_, i) => ({ id: `i${i}`, sortOrder: i }));
  const used = new Map();
  const seen = [];
  for (let day = 1; day <= 14; day += 1) {
    const id = pickNext(items, used);
    used.set(id, `2026-11-${String(day).padStart(2, '0')}`);
    seen.push(id);
  }
  assert.deepEqual(seen.slice(0, 7), items.map((i) => i.id));
  assert.deepEqual(seen.slice(7), items.map((i) => i.id));
});

/* ---------- an item in a reader's language ---------- */

const item = {
  id: 'e1',
  slug: 'remove-your-shoes',
  category: 'temple',
  title: 'Remove your shoes',
  summary: 'Leave your footwear outside.',
  body: 'The temple is a clean and holy place.',
  reference: 'ref',
  author: 'An author',
  sourceName: 'A source',
  sourceUrl: 'https://example.org/page',
  translations: [
    { languageCode: 'hi', title: 'जूते उतारें', summary: 'जूते बाहर रखें।', body: 'मंदिर एक पवित्र स्थान है।', isPublished: true },
    { languageCode: 'mr', title: 'चपला काढा', summary: 'चपला बाहेर ठेवा.', body: 'मंदिर पवित्र आहे.', isPublished: false },
    { languageCode: 'ta', title: 'காலணிகளை', summary: '   ', body: 'உடல்', isPublished: true },
  ],
};

test('wording: the first language in the chain with a full translation wins', () => {
  const w = wording(item, ['hi', 'en']);
  assert.equal(w.language, 'hi');
  assert.equal(w.title, 'जूते उतारें');
});

test('wording: English is the plain columns and ends the walk', () => {
  const w = wording(item, ['en', 'hi']);
  assert.equal(w.language, 'en');
  assert.equal(w.title, 'Remove your shoes');
  assert.equal(wording(item).language, 'en');
});

test('wording: an unpublished translation is skipped', () => {
  assert.equal(wording(item, ['mr', 'en']).language, 'en');
});

test('wording: a translation with a blank part is skipped', () => {
  assert.equal(wording(item, ['ta', 'en']).language, 'en');
});

test('wording: falls to the next language, then English', () => {
  assert.equal(wording(item, ['mr', 'hi', 'en']).language, 'hi');
  assert.equal(wording({ ...item, translations: undefined }, ['hi']).language, 'en');
});

test('present: the app shape, with the source or nulls', () => {
  const a = present(item, ['hi', 'en']);
  assert.deepEqual(Object.keys(a).sort(), ['author', 'body', 'category', 'id', 'language', 'reference', 'slug', 'sourceName', 'sourceUrl', 'summary', 'title']);
  assert.equal(a.language, 'hi');
  assert.equal(a.author, 'An author');
  assert.equal(a.sourceUrl, 'https://example.org/page');
  const bare = present({ id: 'x', slug: 'x', category: 'temple', title: 't', summary: 's', body: 'b' }, ['en']);
  assert.equal(bare.reference, null);
  assert.equal(bare.author, null);
  assert.equal(bare.sourceName, null);
  assert.equal(bare.sourceUrl, null);
});

/* ---------- the push ---------- */

test('etiquettePush: English reader with a name', () => {
  const p = etiquettePush({ item, user: { name: 'Somesh Sharma', readingLanguage: 'en', appLanguage: 'en' } });
  assert.equal(p.title, 'Hari Bol Somesh — Devotee etiquette');
  assert.equal(p.body, 'Remove your shoes\nLeave your footwear outside.');
  assert.deepEqual(p.data, { deeplink: 'hariharibol://etiquette/e1', etiquetteId: 'e1', category: 'temple' });
});

test('etiquettePush: no name drops it, no ugly gap', () => {
  const p = etiquettePush({ item, user: { name: null, readingLanguage: 'en', appLanguage: 'en' } });
  assert.equal(p.title, 'Hari Bol — Devotee etiquette');
  assert.ok(!/\s{2,}/.test(p.title));
});

test('etiquettePush: a Hindi reader gets the Hindi title and the Hindi item', () => {
  const p = etiquettePush({ item, user: { name: 'Somesh', readingLanguage: 'hi', appLanguage: 'en' } });
  assert.match(p.title, /भक्त शिष्टाचार/);
  assert.equal(p.body, 'जूते उतारें\nजूते बाहर रखें।');
});

test('etiquettePush: a long summary is cut, with an ellipsis, near the configured length', () => {
  const long = { ...item, summary: 'word '.repeat(200).trim(), translations: [] };
  const p = etiquettePush({ item: long, user: { name: 'A', readingLanguage: 'en', appLanguage: 'en' } });
  assert.ok(p.body.endsWith('…'));
  assert.ok(p.body.length < 300);
});

/* ---------- the translation prompt ---------- */

test('userPrompt: names the language and carries each item as one JSON line', () => {
  const text = userPrompt({ languageName: 'Hindi', endonym: 'हिन्दी', items: [{ slug: 'a', title: 'T', summary: 'S', body: 'B' }] });
  assert.match(text, /Translate into Hindi \(हिन्दी\)/);
  assert.ok(text.includes('{"slug":"a","title":"T","summary":"S","body":"B"}'));
});

test('TRANSLATE_SCHEMA: asks for slug, title, summary and body on every item', () => {
  assert.deepEqual(TRANSLATE_SCHEMA.properties.items.items.required, ['slug', 'title', 'summary', 'body']);
});

test('estimateTokens: half a token a character, rounded up', () => {
  assert.equal(estimateTokens('abcd', 'ef'), 3);
  assert.equal(estimateTokens(''), 0);
});

/* ---------- the checks on an answer ---------- */

const hi = languageInfo('hi');
const asked = [
  { slug: 'one', title: 'Remove your shoes', summary: 'Leave your footwear outside the temple door.', body: 'The temple is a clean and holy place.' },
  { slug: 'two', title: 'Dress modestly', summary: 'Wear clean, simple clothes.', body: 'Modest dress keeps the mind steady.' },
];
const good = (slug) => ({ slug, title: 'जूते बाहर उतारें', summary: 'मंदिर के द्वार के बाहर जूते रखें।', body: 'मंदिर एक स्वच्छ और पवित्र स्थान है।' });

test('scriptShare: counts only letters and marks, and the block asked for', () => {
  assert.equal(scriptShare('नमस्ते', hi.block), 1);
  assert.equal(scriptShare('hello', hi.block), 0);
  assert.equal(scriptShare('123 ... !!', hi.block), 0);
  const mixed = scriptShare('नमस्ते hello', hi.block);
  assert.ok(mixed > 0.3 && mixed < 0.7, `got ${mixed}`);
});

test('checkAnswer: a complete answer in the right script passes', () => {
  const r = checkAnswer({ items: [good('one'), good('two')] }, asked, 'hi');
  assert.equal(r.ok, true);
  assert.deepEqual(r.problems, []);
  assert.deepEqual(r.items.map((i) => i.slug), ['one', 'two']);
});

test('checkAnswer: a missing item is named and the rest is kept', () => {
  const r = checkAnswer({ items: [good('one')] }, asked, 'hi');
  assert.equal(r.ok, false);
  assert.deepEqual(r.problems, ['"two" is missing']);
  assert.deepEqual(r.items.map((i) => i.slug), ['one']);
});

test('checkAnswer: an empty part is refused', () => {
  const r = checkAnswer({ items: [{ ...good('one'), body: '  ' }, good('two')] }, asked, 'hi');
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /"one" has an empty part/);
  assert.deepEqual(r.items.map((i) => i.slug), ['two']);
});

test('checkAnswer: English left in place of a translation is refused', () => {
  const r = checkAnswer({ items: [{ slug: 'one', title: 'Remove your shoes', summary: 'Leave them outside.', body: 'Clean and holy.' }, good('two')] }, asked, 'hi');
  assert.equal(r.ok, false);
  assert.match(r.problems[0], /"one" is not written in Hindi/);
});

test('checkAnswer: another Indian script is not Hindi either', () => {
  const tamil = { slug: 'one', title: 'காலணிகளை வெளியே விடுங்கள்', summary: 'கோயில் வாசலுக்கு வெளியே.', body: 'கோயில் புனிதமான இடம்.' };
  const r = checkAnswer({ items: [tamil, good('two')] }, asked, 'hi');
  assert.match(r.problems[0], /not written in Hindi/);
  assert.equal(checkAnswer({ items: [tamil, { ...tamil, slug: 'two' }] }, asked, 'ta').ok, true);
});

test('checkAnswer: a summary far longer than the English is refused', () => {
  const summary = 'मंदिर '.repeat(200);
  const r = checkAnswer({ items: [{ ...good('one'), summary }, good('two')] }, asked, 'hi');
  assert.ok(r.problems.some((p) => /"one"/.test(p) && /too long|far longer/.test(p)));
});

test('checkAnswer: a title over the limit is refused', () => {
  const r = checkAnswer({ items: [{ ...good('one'), title: 'जूते '.repeat(100) }, good('two')] }, asked, 'hi');
  assert.match(r.problems[0], /"one" has a title or summary that is too long/);
});

test('checkAnswer: rubbish in, nothing out, every item reported missing', () => {
  for (const data of [null, undefined, {}, { items: 'x' }, { items: [null, 5, {}] }]) {
    const r = checkAnswer(data, asked, 'hi');
    assert.equal(r.ok, false);
    assert.equal(r.items.length, 0);
    assert.equal(r.problems.length, 2);
  }
});

test('checkAnswer: slugs are matched after trimming, and extra items are ignored', () => {
  const r = checkAnswer({ items: [{ ...good('one'), slug: ' one ' }, good('two'), good('stray')] }, asked, 'hi');
  assert.equal(r.ok, true);
  assert.deepEqual(r.items.map((i) => i.slug), ['one', 'two']);
});

test('checkAnswer: the text is trimmed', () => {
  const r = checkAnswer({ items: [{ ...good('one'), title: '  जूते उतारें  ' }, good('two')] }, asked, 'hi');
  assert.equal(r.items[0].title, 'जूते उतारें');
});

/* ---------- a run, as the page receives it ---------- */

const row = {
  id: 'r1',
  language: 'hi',
  provider: 'openai',
  model: 'gpt-6-luna',
  force: false,
  status: 'RUNNING',
  pauseReason: null,
  statusMessage: null,
  stopReason: null,
  resumeAt: null,
  cancelRequested: false,
  totalItems: 40,
  doneItems: 10,
  currentSlug: 'x',
  activeSeconds: 100,
  inputTokens: 1000,
  outputTokens: 2000,
  calls: 3,
  attempts: 1,
  requestedById: 'u1',
  requestedByName: 'Admin',
  createdAt: new Date('2026-10-22T10:00:00Z'),
  startedAt: new Date('2026-10-22T10:00:01Z'),
  finishedAt: null,
  heartbeatAt: new Date('2026-10-22T10:05:00Z'),
};

test('presentRun: progress, estimate and usage', () => {
  const p = presentRun(row, new Date('2026-10-22T10:05:10Z'));
  assert.equal(p.languageName, 'Hindi');
  assert.deepEqual(p.progress, { total: 40, done: 10, percent: 25, currentSlug: 'x', etaSeconds: 300 });
  assert.deepEqual(p.usage, { inputTokens: 1000, outputTokens: 2000, calls: 3 });
  assert.deepEqual(p.requestedBy, { id: 'u1', name: 'Admin' });
  assert.equal(p.stalled, false);
});

test('presentRun: a quiet heartbeat marks a running run stalled; a paused one is not', () => {
  assert.equal(presentRun(row, new Date('2026-10-22T10:20:00Z')).stalled, true);
  assert.equal(presentRun({ ...row, status: 'PAUSED' }, new Date('2026-10-22T10:20:00Z')).stalled, false);
});

test('presentRun: no estimate before anything is done, or once stopped', () => {
  assert.equal(presentRun({ ...row, doneItems: 0, activeSeconds: 0 }).progress.etaSeconds, null);
  assert.equal(presentRun({ ...row, status: 'PAUSED' }).progress.etaSeconds, null);
});

test('presentRun: an empty run is 0%, and no requester is null', () => {
  const p = presentRun({ ...row, totalItems: 0, doneItems: 0, requestedById: null });
  assert.equal(p.progress.percent, 0);
  assert.equal(p.requestedBy, null);
});

/* ---------- categories and languages ---------- */

test('categories: ids are unique, named, and recognised', () => {
  assert.equal(new Set(CATEGORY_IDS).size, CATEGORY_IDS.length);
  for (const c of categories) {
    assert.ok(c.name, `${c.id} has no name`);
    assert.equal(isCategory(c.id), true);
    assert.equal(categoryName(c.id), c.name);
  }
  assert.equal(isCategory('nonsense'), false);
  assert.equal(categoryName('nonsense'), 'nonsense');
});

test('languages: each has a script block and a name', () => {
  assert.equal(languages.length, 11);
  for (const l of languages) {
    assert.ok(l.name && l.endonym, l.code);
    assert.equal(l.block.length, 2);
    assert.ok(l.block[0] < l.block[1]);
  }
  assert.equal(languageInfo('xx'), null);
});

test('statuses are the three the database knows', () => {
  assert.deepEqual(STATUSES, ['PUBLISHED', 'DRAFT', 'EXCLUDED']);
});

/* ---------- the English seed ---------- */

test('seed: the whole list passes its own checks', () => {
  assert.deepEqual(checkItems(etiquetteItems), []);
});

test('seed: every category has items, in the app order, and sortOrder reads in that order', () => {
  for (const c of categories) {
    assert.ok(etiquetteItems.some((i) => i.category === c.id), `${c.id} is empty`);
  }
  const orders = etiquetteItems.map((i) => i.sortOrder);
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b));
  assert.equal(new Set(orders).size, orders.length, 'sortOrder must be unique');
});

test('seed: the two items that disparage another deity are kept but excluded, with a reason', () => {
  const excluded = etiquetteItems.filter((i) => i.status === 'EXCLUDED');
  assert.equal(excluded.length, 2);
  for (const i of excluded) assert.ok(i.excludedReason && i.excludedReason.length > 20, i.slug);
  assert.ok(etiquetteItems.filter((i) => i.status === 'PUBLISHED').length >= 90);
});

test('seed: nothing published speaks ill of a god', () => {
  const published = etiquetteItems.filter((i) => i.status === 'PUBLISHED');
  const bad = /\b(false god|demigod worship is|inferior god|worthless god|blaspheme)\b/i;
  for (const i of published) assert.ok(!bad.test(`${i.title} ${i.summary} ${i.body}`), i.slug);
});

test('seed: the summary is short enough for a lock screen', () => {
  for (const i of etiquetteItems) assert.ok(i.summary.length <= 220, `${i.slug}: ${i.summary.length}`);
});

test('seed: every source is an https page on a host we meant to cite', () => {
  const hosts = new Set(etiquetteItems.map((i) => new URL(i.sourceUrl).host));
  for (const h of hosts) assert.match(h, /\./);
  assert.ok(hosts.size >= 5, `only ${hosts.size} source sites`);
});

test('checkItems: names every kind of fault', () => {
  const base = etiquetteItems.find((i) => i.status === 'PUBLISHED');
  const bad = (patch) => checkItems([{ ...base, ...patch }]);

  assert.match(bad({ slug: 'Bad Slug' }).join(), /slug must be lower-case/);
  assert.match(bad({ category: 'nope' }).join(), /unknown category/);
  assert.match(bad({ title: '' }).join(), /title is empty/);
  assert.match(bad({ summary: 'x'.repeat(221) }).join(), /summary is 221 characters/);
  assert.match(bad({ sourceUrl: 'http://example.org' }).join(), /https/);
  assert.match(bad({ body: ' padded ' }).join(), /spaces at either end/);
  assert.match(bad({ status: 'EXCLUDED', excludedReason: undefined }).join(), /needs an excludedReason/);
  assert.match(bad({ excludedReason: 'because' }).join(), /only an excluded item/);
  assert.match(bad({ status: 'DRAFT' }).join(), /status must be/);
  assert.match(bad({ reference: 'Śrīla Prabhupāda, Nectar of Devotion' }).join(), /names the author/);
  assert.match(bad({ author: 'Śrīla Prabhupāda' }).join(), /names the author/);
  assert.match(bad({ author: '' }).join(), /author is empty/);
  assert.match(bad({ author: undefined }).join(), /author is empty/);
  assert.match(bad({ author: 'x'.repeat(201) }).join(), /author is 201 characters/);
  assert.match(checkItems([base, base]).join(), /slug is used twice/);
});

test('seed: every item says who it is by, and never with the hidden name', () => {
  for (const i of etiquetteItems) {
    assert.ok(typeof i.author === 'string' && i.author.trim().length > 0, `${i.slug}: no author`);
    assert.ok(i.author.length <= 200, `${i.slug}: author too long`);
    assert.doesNotMatch(i.author, /prabhup/i, i.slug);
  }
});

test('seed: an item from one of our two books names the verse in its reference', () => {
  const books = etiquetteItems.filter((i) => /^(Bhagavad-gītā|Śrīmad-Bhāgavatam)(?=\s)/.test(i.reference));
  assert.ok(books.some((i) => i.reference.startsWith('Bhagavad-gītā')), 'no Bhagavad-gītā item found');
  assert.ok(books.some((i) => i.reference.startsWith('Śrīmad-Bhāgavatam')), 'no Śrīmad-Bhāgavatam item found');
  for (const i of books) assert.match(i.reference, /\d/, `${i.slug}: ${i.reference}`);
});
