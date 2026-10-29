// The content of a marketing email: the block validator, merge fields and the renderer. No database.
//
//   node --test test/marketing-blocks.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import { MERGE_FIELDS, cleanModelBlocks, fieldProblems, fieldsIn, fieldsUsed, fill, linkSlotsUsed, validateBlocks, validateLine } from '../utils/marketing-blocks.js';
import { renderEmail } from '../services/marketing-render.js';

const good = [
  { type: 'heading', text: '{{greeting}}' },
  { type: 'paragraph', text: 'Your {{favoriteMantra|mantra}} is waiting, {{firstName|friend}}.' },
  { type: 'verse', text: 'Always think of Me.', sanskrit: 'मन्मना भव', source: 'Bhagavad-gita 9.34' },
  { type: 'button', label: 'Chant now', link: 1 },
  { type: 'divider' },
  { type: 'spacer', size: 'large' },
];

test('a good list of blocks passes and keeps only the known keys', () => {
  const { ok, blocks, errors } = validateBlocks([...good, { type: 'paragraph', text: 'hi', evil: '<script>' }]);
  assert.deepEqual(errors, []);
  assert.ok(ok);
  assert.equal(blocks.at(-1).evil, undefined);
  assert.equal(blocks[0].level, 1);
});

test('unknown block, empty text, too long text, bad link slot and no blocks are each refused with the block named', () => {
  assert.match(validateBlocks([{ type: 'script' }]).errors[0], /Block 1 is not a known block/);
  assert.match(validateBlocks([{ type: 'paragraph', text: '   ' }]).errors[0], /Block 1 text is empty/);
  assert.match(validateBlocks([{ type: 'paragraph', text: 'x'.repeat(2001) }]).errors[0], /2001 characters/);
  assert.match(validateBlocks([{ type: 'button', label: 'Go', link: 9 }]).errors[0], /link slot must be a whole number from 1 to 5/);
  assert.match(validateBlocks([{ type: 'button', label: 'Go' }]).errors[0], /needs a link slot/);
  assert.equal(validateBlocks([]).ok, false);
  assert.equal(validateBlocks('nope').ok, false);
});

test('an image must be an https link', () => {
  assert.match(validateBlocks([{ type: 'image', url: 'http://x.test/a.png', alt: 'a' }]).errors.join(), /https/);
  assert.match(validateBlocks([{ type: 'image', url: 'javascript:alert(1)', alt: 'a' }]).errors.join(), /not a link|https/);
  assert.equal(validateBlocks([{ type: 'image', url: 'https://x.test/a.png', alt: 'a' }]).ok, true);
});

test('merge fields: only the listed names are accepted, with or without a fallback', () => {
  assert.deepEqual(fieldsIn('Hi {{ firstName | friend }} {{streak}}').map((f) => f.name), ['firstName', 'streak']);
  assert.deepEqual(fieldProblems('{{firstName|friend}} and {{streak}}'), []);
  assert.match(fieldProblems('{{password}}')[0], /not a merge field/);
  assert.match(fieldProblems('a {{ broken')[0], /"{{" or "}}"/);
  assert.equal(validateBlocks([{ type: 'paragraph', text: 'Hello {{secret}}' }]).ok, false);
  assert.ok(validateLine('Hello {{firstName|friend}}', 150, 'The subject').length === 0);
  assert.match(validateLine('line\nbreak', 150, 'The subject')[0], /one line/);
});

test('fill uses the value, then the fallback, then nothing, and tidies the gap', () => {
  assert.equal(fill('Hi {{firstName|friend}}!', { firstName: 'Somesh' }), 'Hi Somesh!');
  assert.equal(fill('Hi {{firstName|friend}}!', { firstName: '' }), 'Hi friend!');
  assert.equal(fill('Hi {{firstName}}, welcome', {}), 'Hi, welcome');
  assert.equal(fill('{{streak|0}} days', { streak: 9 }), '9 days');
});

test('every merge field has a label and a sample', () => {
  for (const [name, field] of Object.entries(MERGE_FIELDS)) {
    assert.ok(field.label && field.sample, name);
  }
});

test('which fields and link slots a variant uses', () => {
  assert.deepEqual(linkSlotsUsed(good), [1]);
  assert.deepEqual(fieldsUsed({ subject: '{{firstName|x}}', blocks: good }).sort(), ['favoriteMantra', 'firstName', 'greeting']);
});

test('a model’s empty optional keys are dropped before checking', () => {
  const cleaned = cleanModelBlocks([{ type: 'verse', text: 'x', sanskrit: '', source: null, link: 0 }]);
  assert.deepEqual(cleaned, [{ type: 'verse', text: 'x' }]);
  assert.equal(validateBlocks(cleaned).ok, true);
});

test('the renderer escapes every value, so no markup can reach a reader', async () => {
  const blocks = [
    { type: 'heading', text: '<img src=x onerror=alert(1)>' },
    { type: 'paragraph', text: 'Hi {{firstName|friend}} <b>bold</b>\nnext line' },
    { type: 'button', label: '"><script>x</script>', link: 1 },
    { type: 'image', url: 'https://x.test/a.png?a=1&b="2"', alt: '<alt>' },
  ];
  const mail = await renderEmail({
    variant: { subject: 'S {{firstName|friend}}', preheader: 'pre', blocks },
    card: { firstName: '<i>Somesh</i>' },
    hrefOf: (slot) => `https://hariharibol.com/l/CODE/${slot}`,
    language: 'hi',
    unsubscribeUrl: 'https://hariharibol.com/unsubscribe/CODE',
    postalAddress: '1 Temple Road, Vrindavan',
    openPixel: 'https://api.test/open/CODE',
  });
  assert.doesNotMatch(mail.html, /<script/i);
  assert.doesNotMatch(mail.html, /<img src=x/);
  assert.doesNotMatch(mail.html, /<b>bold<\/b>/);
  assert.match(mail.html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(mail.html, /&lt;i&gt;Somesh&lt;\/i&gt;/);
  assert.match(mail.html, /next line/);
  assert.match(mail.html, /href="https:\/\/hariharibol.com\/l\/CODE\/1"/);
  assert.match(mail.html, /unsubscribe\/CODE/);
  assert.match(mail.html, /1 Temple Road/);
  assert.match(mail.html, /open\/CODE/);
  assert.match(mail.html, /lang="hi"/);
  // The footer is worded in the reader's language, and the text part carries the same links.
  assert.match(mail.html, /सदस्यता छोड़ें/);
  assert.match(mail.text, /https:\/\/hariharibol.com\/l\/CODE\/1/);
  assert.match(mail.text, /unsubscribe\/CODE/);
  assert.equal(mail.subject, 'S <i>Somesh</i>'); // the subject is a header, not HTML
});

test('the invitee footer says why they are getting it', async () => {
  const mail = await renderEmail({ variant: { subject: 's', blocks: [{ type: 'paragraph', text: 'hi' }] }, hrefOf: () => '#', language: 'en', unsubscribeUrl: 'https://x.test/u', invitee: true });
  assert.match(mail.html, /invitation list/);
});
