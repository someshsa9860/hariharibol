import { test } from 'node:test';
import assert from 'node:assert/strict';

import { readLegacyAccount, nameKey, matchMantra, pickLegacyFavourite } from '../utils/legacy-mantra.js';

const ours = [
  { id: 'shiva', name: 'Om Namah Shivaya', slug: 'om-namah-shivaya', names: ['ॐ नमः शिवाय'] },
  { id: 'hare', name: 'Hare Krishna Mahamantra', slug: 'hare-krishna', names: [] },
  { id: 'gayatri', name: 'Gayatri Mantra', slug: 'gayatri-mantra', names: [] },
];

test('a spelling a letter off is still the same mantra', () => {
  for (const spelled of ['om namah shivay', 'Om Namah Shivaya', 'OM NAMAH SHIVAY', 'om namaha shivaya', 'Om Nama Sivaya']) {
    assert.equal(matchMantra(spelled, ours)?.id, 'shiva', spelled);
  }
});

test('matches on the slug, and never on a guess', () => {
  assert.equal(matchMantra('hare krishna', ours)?.id, 'hare');
  assert.equal(matchMantra('om namo narayanaya', ours), null);
  assert.equal(matchMantra('', ours), null);
  assert.equal(matchMantra('   ', ours), null);
});

test('a name written as one word or two, or as the transliteration, is the same mantra', () => {
  assert.equal(matchMantra('Hare Krishna Maha Mantra', ours)?.id, 'hare');
  const panchakshara = [{ id: 'p', name: 'Panchakshara Mantra', slug: 'p', transliteration: 'Oṃ namaḥ śivāya', names: [] }];
  assert.equal(matchMantra('om namah shivay', panchakshara)?.id, 'p');
});

test('nameKey ignores case, accents and spacing', () => {
  assert.equal(nameKey('Om  Namaḥ Śivāya'), nameKey('om namah shivaya'));
});

test('the most chanted mantra that is also ours wins', () => {
  const entries = [
    { name: 'Some mantra we do not have', count: 99999 },
    { name: 'Hare Krishna', count: 1200 },
    { name: 'om namah shivay', count: 5000 },
  ];
  assert.equal(pickLegacyFavourite(entries, ours), 'shiva');
});

test('two spellings of one mantra add up', () => {
  const entries = [
    { name: 'om namah shivay', count: 600 },
    { name: 'Om Namah Shivaya', count: 600 },
    { name: 'Hare Krishna', count: 1000 },
  ];
  assert.equal(pickLegacyFavourite(entries, ours), 'shiva');
});

test('nothing chanted, or nothing of ours, is no favourite', () => {
  assert.equal(pickLegacyFavourite([], ours), null);
  assert.equal(pickLegacyFavourite(undefined, ours), null);
  assert.equal(pickLegacyFavourite([{ name: 'Hare Krishna', count: 0 }], ours), null);
});

test('the old server answer is read leniently', () => {
  const account = readLegacyAccount({
    id: 42,
    email: 'Devotee@Example.com',
    name: ' Ram ',
    provider: 'apple',
    providerUserId: '001234',
    mantras: [{ name: 'Om Namah Shivay', count: '108' }, { name: '', count: 5 }],
  });
  // the entry with no name makes the whole list unusable rather than half-read
  assert.equal(account.id, '42');
  assert.equal(account.email, 'devotee@example.com');
  assert.equal(account.name, 'Ram');
  assert.equal(account.provider, 'APPLE');
  assert.equal(account.providerUserId, '001234');
  assert.deepEqual(account.mantras, []);
});

test('only an id is required', () => {
  const account = readLegacyAccount({ id: 'abc' });
  assert.deepEqual(account, {
    id: 'abc',
    email: null,
    name: null,
    avatarUrl: null,
    provider: 'GOOGLE',
    providerUserId: null,
    mantras: [],
  });
  assert.equal(readLegacyAccount({}), null);
  assert.equal(readLegacyAccount(null), null);
  assert.equal(readLegacyAccount('nope'), null);
});

test('a bad email costs the email, not the account', () => {
  assert.equal(readLegacyAccount({ id: 1, email: 'not an email' }).email, null);
});
