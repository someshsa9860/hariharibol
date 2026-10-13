// The words on the daily sloka card. No canvas, no database — the functions are
// loaded on their own.
//
//   npm test

import test from 'node:test';
import assert from 'node:assert/strict';

import { cardStanzas, fitVerse, wrapLine } from '../utils/sloka-card-text.js';
import { versePlace } from '../utils/sloka-push.js';

test('a Gita verse keeps its lines and loses its own number', () => {
  const sanskrit = 'कर्मण्येवाधिकारस्ते मा फलेषु कदाचन |\nमा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ||२-४७|||';
  assert.deepEqual(cardStanzas(sanskrit), [
    ['कर्मण्येवाधिकारस्ते मा फलेषु कदाचन ।', 'मा कर्मफलहेतुर्भूर्मा ते सङ्गोऽस्त्वकर्मणि ॥'],
  ]);
});

test('a speaker line stays as the first line of the verse', () => {
  const sanskrit = 'धृतराष्ट्र उवाच |\nधर्मक्षेत्रे कुरुक्षेत्रे समवेता युयुत्सवः |\nमामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ||१-१|||';
  const [stanza] = cardStanzas(sanskrit);
  assert.equal(stanza[0], 'धृतराष्ट्र उवाच ।');
  assert.equal(stanza.length, 3);
  assert.equal(stanza[2], 'मामकाः पाण्डवाश्चैव किमकुर्वत सञ्जय ॥');
});

test('a Bhagavatam verse is one run, split at its danda, with the number dropped', () => {
  const sanskrit = 'य: प्रियार्थमुतङ्कस्य धुन्धुनामासुरं बली । सुतानामेकविंशत्या सहस्रैरहनद् वृत: ॥ २२ ॥';
  assert.deepEqual(cardStanzas(sanskrit), [
    ['यः प्रियार्थमुतङ्कस्य धुन्धुनामासुरं बली ।', 'सुतानामेकविंशत्या सहस्रैरहनद् वृतः ॥'],
  ]);
});

test('a compound verse is one stanza per verse in it', () => {
  const sanskrit = 'वाचमग्नौ सवक्तव्यामिन्द्रे शिल्पं करावपि । पदानि गत्या वयसि रत्योपस्थं प्रजापतौ ॥ २६ ॥ मृत्यौ पायुं विसर्गं च यथास्थानं विनिर्दिशेत् । दिक्षु श्रोत्रं सनादेन स्पर्शेनाध्यात्मनि त्वचम् ॥ २७ ॥';
  const stanzas = cardStanzas(sanskrit);
  assert.equal(stanzas.length, 2);
  assert.ok(stanzas.every((lines) => lines.length === 2 && lines[1].endsWith('॥')));
});

test('nothing to show comes back as no stanzas', () => {
  assert.deepEqual(cardStanzas(''), []);
  assert.deepEqual(cardStanzas(null), []);
  assert.deepEqual(cardStanzas('॥ २२ ॥'), []);
});

// Every character is `size / 2` wide, so what fits is easy to work out by hand.
const measure = (text, size) => [...text].length * size * 0.5;
const box = { measure, width: 1000, height: 360, maxSize: 56, minSize: 32, lineHeight: 1.6, stanzaGap: 0.5 };

test('a short verse is drawn at the largest size', () => {
  const fit = fitVerse([['क ख ग ।', 'घ ङ च ॥']], box);
  assert.equal(fit.size, 56);
  assert.deepEqual(fit.lines.map((l) => l.text), ['क ख ग ।', 'घ ङ च ॥']);
});

test('a longer verse is drawn smaller, with its lines kept whole', () => {
  const lines = Array.from({ length: 5 }, (_, i) => `${'अ'.repeat(28)} ${i}`);
  const fit = fitVerse([lines], box);
  assert.equal(fit.size, 44);
  assert.equal(fit.lines.length, 5);
});

test('a line too wide for the box is broken at a space', () => {
  const line = Array.from({ length: 8 }, () => 'अ'.repeat(9)).join(' ');
  const fit = fitVerse([[line]], box);
  assert.ok(fit.lines.length > 1);
  assert.ok(fit.lines.every((l) => measure(l.text, fit.size) <= box.width));
  assert.ok(fit.lines.length * fit.size * box.lineHeight <= box.height);
});

test('a verse that cannot fit at the smallest size is cut and ends in an ellipsis', () => {
  const stanza = Array.from({ length: 4 }, () => `${'अ'.repeat(40)} ।`);
  const fit = fitVerse(Array.from({ length: 6 }, () => stanza), box);
  assert.equal(fit.size, 32);
  assert.ok(fit.lines.length < 24);
  assert.match(fit.lines.at(-1).text, / …$/);
  assert.doesNotMatch(fit.lines.at(-1).text, /[।॥]/);
  assert.ok(fit.lines.every((l) => measure(l.text, fit.size) <= box.width));
});

test('the ellipsis never pushes the last line past the width', () => {
  const full = `${'अ'.repeat(28)} ${'ब'.repeat(28)} ${'क'.repeat(3)}`; // 62 chars: 992 of 1000 at 32
  const fit = fitVerse(Array.from({ length: 5 }, () => [full, full, full]), box);
  assert.ok(measure(fit.lines.at(-1).text, fit.size) <= box.width);
});

test('each stanza after the first is marked with a gap before it', () => {
  const fit = fitVerse([['क ।'], ['ख ।'], ['ग ।']], box);
  assert.deepEqual(fit.lines.map((l) => l.gapBefore), [false, true, true]);
});

test('a danda never wraps onto a line of its own', () => {
  const line = `${'अ'.repeat(20)} ${'ब'.repeat(20)} ॥`;
  for (const piece of wrapLine(line, 40, 800, measure)) assert.doesNotMatch(piece, /^[।॥]/);
});

test('the place is how a person cites the verse', () => {
  assert.equal(versePlace({ cantoNumber: null, chapterNumber: 2, verseNumber: 47 }), '2.47');
  assert.equal(versePlace({ cantoNumber: 1, chapterNumber: 1, verseNumber: 1 }), '1.1.1');
  assert.equal(
    versePlace({ cantoNumber: 7, chapterNumber: 12, verseNumber: 26, verseNumberEnd: 28 }),
    '7.12.26-28'
  );
});
