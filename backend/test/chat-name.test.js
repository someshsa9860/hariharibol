import test from 'node:test';
import assert from 'node:assert/strict';

import { createFiller, fill, firstNameOf } from '../utils/chat-name.js';

const T = '{name}';

// Every way the model's text can be cut into two pieces, run through a fresh filler each time.
function everySplit(text, name) {
  const results = [];
  for (let i = 0; i <= text.length; i += 1) {
    const filler = createFiller(name);
    results.push(filler.push(text.slice(0, i)) + filler.push(text.slice(i)) + filler.flush());
  }
  return results;
}

test('firstNameOf takes the first word of the account name', () => {
  assert.equal(firstNameOf('Somesh Sharma'), 'Somesh');
  assert.equal(firstNameOf('  Radha   Rani '), 'Radha');
  assert.equal(firstNameOf('Sri'), 'Sri');
});

test('firstNameOf keeps names in any script, with their marks and joiners', () => {
  assert.equal(firstNameOf('राधा कृष्ण'), 'राधा');
  assert.equal(firstNameOf('கிருஷ்ணன்'), 'கிருஷ்ணன்');
  assert.equal(firstNameOf('క్ష్మ'), 'క్ష్మ');
  assert.equal(firstNameOf('ക്ഷ‍േത്രം'), 'ക്ഷ‍േത്രം');
  assert.equal(firstNameOf("D'Souza Anna"), "D'Souza");
  assert.equal(firstNameOf('Anne-Marie Roy'), 'Anne-Marie');
});

test('firstNameOf strips what markdown or a link would act on', () => {
  assert.equal(firstNameOf('**Rama** Das'), 'Rama');
  assert.equal(firstNameOf('[Hari](http://x.example) Das'), 'Harihttpx.example');
  assert.equal(firstNameOf('<b>Hari</b>'), 'bHarib');
  assert.equal(firstNameOf('Hari{name}'), 'Hariname');
  assert.equal(firstNameOf('`Gopal`'), 'Gopal');
});

test('firstNameOf is cut to thirty characters, by code point', () => {
  const long = 'A'.repeat(80);
  assert.equal([...firstNameOf(long)].length, 30);
  const wide = '𝒜'.repeat(40);
  assert.equal([...firstNameOf(wide)].length, 30);
});

test('firstNameOf is null when there is no name to use', () => {
  for (const nothing of [null, undefined, '', '   ', '123', '!!!', '--', '…', '😀']) {
    assert.equal(firstNameOf(nothing), null, JSON.stringify(nothing));
  }
});

test('fill puts the name where the token is, whatever its case', () => {
  assert.equal(fill(`Hari Bol, ${T}!`, 'Radha'), 'Hari Bol, Radha!');
  assert.equal(fill('Welcome {NAME} and {Name}.', 'Radha'), 'Welcome Radha and Radha.');
  assert.equal(fill('No token here.', 'Radha'), 'No token here.');
  assert.equal(fill('', 'Radha'), '');
  assert.equal(fill(null, 'Radha'), null);
});

test('fill does not treat the name as a replacement pattern', () => {
  assert.equal(fill(`Hi ${T}`, '$&'), 'Hi $&');
  assert.equal(fill(`Hi ${T}`, "$'"), "Hi $'");
  assert.equal(fill(`Hi ${T}`, '$1'), 'Hi $1');
});

test('fill without a name removes the token and the comma that set it off', () => {
  assert.equal(fill(`Hari Bol, ${T}! How are you?`, null), 'Hari Bol! How are you?');
  assert.equal(fill(`${T}, welcome back.`, null), 'welcome back.');
  assert.equal(fill(`Be gentle with yourself ${T}.`, null), 'Be gentle with yourself.');
  assert.equal(fill(`Hello ${T}`, null), 'Hello');
  assert.equal(fill(`${T}`, null), '');
});

test('the filler gives the same text however the token is cut across pieces', () => {
  const text = `Hari Bol, ${T}! Be well, ${T}.`;
  for (const out of everySplit(text, 'Radha')) assert.equal(out, 'Hari Bol, Radha! Be well, Radha.');
});

test('the filler never sends a piece of the token', () => {
  const filler = createFiller('Radha');
  const sent = [];
  for (const piece of ['Hari Bol, {', 'na', 'me', '}', '! ', '{n', 'ame}']) sent.push(filler.push(piece));
  sent.push(filler.flush());
  for (const piece of sent) assert.ok(!piece.includes('{'), JSON.stringify(piece));
  assert.equal(sent.join(''), 'Hari Bol, Radha! Radha');
});

test('the filler holds a lone brace back, then lets it go if it was only text', () => {
  const filler = createFiller('Radha');
  assert.equal(filler.push('A set looks like {'), 'A set looks like ');
  assert.equal(filler.push('1, 2}'), '{1, 2}');
  assert.equal(filler.flush(), '');
});

test('the filler flushes a token that never finished as the text it was', () => {
  const filler = createFiller('Radha');
  assert.equal(filler.push('Cut off at {na'), 'Cut off at ');
  assert.equal(filler.flush(), '{na');
});

test('the filler sends a long reply without holding it back', () => {
  const filler = createFiller('Radha');
  assert.equal(filler.push('Plain words, no braces.'), 'Plain words, no braces.');
  assert.equal(filler.push(' More.'), ' More.');
  assert.equal(filler.flush(), '');
});

test('the filler for a reader with no name drops the token', () => {
  const text = `Hari Bol, ${T}! Be well, ${T}.`;
  for (const out of everySplit(text, null)) assert.ok(!out.includes('{'), out);
  const filler = createFiller(null);
  assert.equal(filler.push('Hello {na'), 'Hello ');
  assert.equal(filler.push('me}!'), '!');
  assert.equal(filler.flush(), '');
});
