import { test } from 'node:test';
import assert from 'node:assert/strict';

import { PAGES, createFilter, extract, parse } from '../utils/chat-actions.js';

test('parse understands pages, mantras and verses', () => {
  assert.deepEqual(parse('[[open:page:reels]]'), { kind: 'page', page: 'reels' });
  assert.deepEqual(parse('[[open:PAGE: Jap ]]'), { kind: 'page', page: 'jap' });
  assert.deepEqual(parse('[[open:mantra:maha mantra]]'), { kind: 'mantra', query: 'maha mantra' });
  assert.deepEqual(parse('[[open:verse:bhagavad-gita:2.47]]'), { kind: 'verse', book: 'bhagavad-gita', numbers: [2, 47] });
  assert.deepEqual(parse('[[open:verse:srimad-bhagavatam:1.2.6]]'), {
    kind: 'verse', book: 'srimad-bhagavatam', numbers: [1, 2, 6],
  });
});

test('parse refuses what it does not know', () => {
  for (const bad of [
    '[[open:page:admin]]', '[[open:page:]]', '[[open:url:https://example.com]]', '[[open:verse:bg:abc]]',
    '[[open:verse:bg:2]]', '[[open:verse:bg:1.2.3.4]]', '[[open:verse::2.47]]', '[[open:mantra:]]', '[[close:page:home]]', 'open', null,
  ]) {
    assert.equal(parse(bad), null, String(bad));
  }
  assert.ok(PAGES.includes('reels') && !PAGES.includes('admin'));
});

test('a marker is taken out of the text and returned as an action', () => {
  const { text, action } = extract('Here you go.\n\n[[open:page:reels]]');
  assert.equal(text, 'Here you go.');
  assert.deepEqual(action, { kind: 'page', page: 'reels' });
});

test('only the first marker of a reply is kept', () => {
  const { text, action } = extract('One. [[open:page:home]] Two. [[open:page:reels]]');
  assert.equal(action.page, 'home');
  assert.ok(!text.includes('[['));
});

test('a marker split across chunks at every position is still removed', () => {
  const full = 'Sure, let us go.\n[[open:verse:bhagavad-gita:2.47]]';
  for (let cut = 1; cut < full.length; cut += 1) {
    const filter = createFilter();
    const a = filter.push(full.slice(0, cut));
    const b = filter.push(full.slice(cut));
    const c = filter.flush();
    const text = a.text + b.text + c.text;
    const actions = [...a.actions, ...b.actions, ...c.actions];
    assert.equal(text.trimEnd(), 'Sure, let us go.', `cut ${cut}`);
    assert.equal(actions.length, 1, `cut ${cut}`);
    assert.equal(actions[0].kind, 'verse');
  }
});

test('one character at a time gives the same result', () => {
  const full = 'Ok [[open:mantra:om]] done';
  const filter = createFilter();
  let text = '';
  const actions = [];
  for (const ch of full) {
    const r = filter.push(ch);
    text += r.text;
    actions.push(...r.actions);
  }
  const rest = filter.flush();
  text += rest.text;
  actions.push(...rest.actions);
  assert.equal(text, 'Ok  done');
  assert.deepEqual(actions, [{ kind: 'mantra', query: 'om' }]);
});

test('brackets that are not a marker are ordinary text', () => {
  const { text, action } = extract('See [[1]] and [x] and [[note]] and a lone [ here.');
  assert.equal(text, 'See [[1]] and [x] and [[note]] and a lone [ here.');
  assert.equal(action, null);
});

test('a marker that is not understood is still removed, with no action', () => {
  const { text, action } = extract('Hello [[open:page:admin]] there');
  assert.equal(text, 'Hello  there');
  assert.equal(action, null);
});

test('a marker cut short at the end of the stream is dropped, not shown', () => {
  const filter = createFilter();
  const a = filter.push('Almost [[open:pa');
  const b = filter.flush();
  assert.equal(a.text + b.text, 'Almost ');
  assert.deepEqual([...a.actions, ...b.actions], []);
});

test('a trailing single bracket is released at the end', () => {
  const filter = createFilter();
  const a = filter.push('a list [');
  const b = filter.flush();
  assert.equal(a.text + b.text, 'a list [');
});
