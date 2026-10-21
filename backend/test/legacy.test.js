// The rules for carrying a person over from the old app's server: which of its emails can be used, and which
// of our mantras one of theirs is. The mantras below are the seeded ones (prisma/seed/data.js) — the old
// spellings are what people type: "Om Namah Shivay", "Aum", a title in Devanagari. No database.
//
//   node --test test/legacy.test.js

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  candidateFrom,
  cleanName,
  closeness,
  emailForApp,
  httpsUrl,
  isPlaceholderEmail,
  matchMantra,
  pickFavourite,
  placeholderEmail,
  skeleton,
  textsOf,
  usableEmail,
} from '../utils/legacy.js';

// ── The email ───────────────────────────────────────────────────────────────

test('an address is trimmed and put in lower case', () => {
  assert.equal(usableEmail('  Asha.Rao+bhakti@Gmail.COM '), 'asha.rao+bhakti@gmail.com');
  assert.equal(usableEmail("o'brien@example.co.in"), "o'brien@example.co.in");
});

test('what the old Google/Apple sign-in wrote in place of an address is not one', () => {
  assert.equal(usableEmail('asha@2024-05-01-12:30:00'), null);
  assert.equal(usableEmail('asha@2024-05-01'), null);
});

test('nothing, junk and too much are not addresses', () => {
  for (const value of [null, undefined, '', '   ', 'asha', 'asha@', '@gmail.com', 'a b@c.com', 'a@b', 42, {}, 'x'.repeat(250) + '@gmail.com']) {
    assert.equal(usableEmail(value), null, String(value));
  }
});

test('our own stand-in address is never taken for a real one', () => {
  assert.equal(usableEmail(placeholderEmail(7)), null);
  assert.equal(usableEmail('someone@LEGACY.invalid'), null);
});

test('a stand-in address is recognised, and the app is sent none', () => {
  const stand = placeholderEmail(1042);
  assert.equal(stand, 'legacy-1042@legacy.invalid');
  assert.equal(isPlaceholderEmail(stand), true);
  assert.equal(isPlaceholderEmail(stand.toUpperCase()), true);
  assert.equal(isPlaceholderEmail('asha@gmail.com'), false);
  assert.equal(isPlaceholderEmail(null), false);

  assert.equal(emailForApp(stand), null);
  assert.equal(emailForApp('asha@gmail.com'), 'asha@gmail.com');
});

test('a name is one line of at most 100 characters, or nothing', () => {
  assert.equal(cleanName('  Asha \n\t Rao  '), 'Asha Rao');
  assert.equal(cleanName('a\u0000b'), 'a b');
  assert.equal(cleanName('x'.repeat(300)).length, 100);
  assert.equal(cleanName('   '), null);
  assert.equal(cleanName(null), null);
  assert.equal(cleanName(12), null);
});

test('a picture link is kept only when it is https', () => {
  assert.equal(httpsUrl('https://example.com/a.jpg'), 'https://example.com/a.jpg');
  assert.equal(httpsUrl(' https://example.com/a.jpg '), 'https://example.com/a.jpg');
  assert.equal(httpsUrl('http://example.com/a.jpg'), null);
  assert.equal(httpsUrl('javascript:alert(1)'), null);
  assert.equal(httpsUrl('not a url'), null);
  assert.equal(httpsUrl(''), null);
  assert.equal(httpsUrl(null), null);
  assert.equal(httpsUrl('https://example.com/' + 'a'.repeat(1100)), null);
});

// ── The consonants of a text ────────────────────────────────────────────────

test('every way of writing Om Namah Shivaya gives the same consonants', () => {
  const spellings = [
    'Om Namah Shivay',
    'om namah shivaya',
    'OM NAMAH SHIVAYA',
    'Oṁ Namaḥ Śivāya',
    'Om Namo Shivaya'.replace('Namo', 'Nama'),
    'om  namah   shivaaya',
    'ॐ नमः शिवाय',
    'ओम् नमः शिवाय',
    'ओम नमः शिवाय',
    'Om-Namah-Shivaya',
    '🕉 Om Namah Shivaya 🕉',
  ];
  for (const text of spellings) assert.equal(skeleton(text), 'mnmsvy', text);
});

test('Om, however it is written', () => {
  for (const text of ['Om', 'OM', 'Aum', 'Ohm', 'Oṁ', 'ॐ', 'ओम्', 'ओम']) assert.equal(skeleton(text), 'm', text);
});

test('sh, bh, ch, kh and the accented letters are single sounds', () => {
  assert.equal(skeleton('Shiva'), skeleton('Śiva'));
  assert.equal(skeleton('Shiva'), skeleton('Siva'));
  assert.equal(skeleton('Krishna'), skeleton('Kṛṣṇa'));
  assert.equal(skeleton('Krishna'), skeleton('कृष्ण'));
  assert.equal(skeleton('Bhagavate'), skeleton('Bagavate'));
});

test('a doubled letter is one, and it is the same in Devanagari', () => {
  const jagannath = skeleton('Jagannatha');
  assert.equal(skeleton('Jaggannath'), jagannath);
  assert.equal(skeleton('Jagannath'), jagannath);
  assert.equal(skeleton('जगन्नाथ'), jagannath);
});

test('Jai, Jay and Jaya agree, in either script', () => {
  assert.equal(skeleton('Jai'), skeleton('Jay'));
  assert.equal(skeleton('Jai'), skeleton('Jaya'));
  assert.equal(skeleton('जय'), skeleton('Jay'));
  assert.equal(skeleton('Vaishnava'), skeleton('वैष्णव'));
});

test('w is v, and the anusvara is n or m as it is spoken', () => {
  assert.equal(skeleton('Mrityunjaya'), skeleton('मृत्युञ्जय'));
  assert.equal(skeleton('Wasudeva'), skeleton('Vasudeva'));
  assert.equal(skeleton('Mantra'), skeleton('मंत्र'));
  assert.equal(skeleton('Mantra'), skeleton('मन्त्र'));
  assert.equal(skeleton('Namah'), skeleton('नमः'));
  assert.equal(skeleton('Om'), skeleton('ओं'));
});

test('words that repeat stay repeated; a doubled letter is joined only inside a word', () => {
  assert.notEqual(skeleton('Hare Hare'), skeleton('Hare'));
  assert.equal(skeleton('Hare Rama'), skeleton('Harerama'));
});

test('the whole mahamantra in Devanagari reads like the same in Roman', () => {
  const devanagari = 'हरे कृष्ण हरे कृष्ण । कृष्ण कृष्ण हरे हरे ॥\nहरे राम हरे राम । राम राम हरे हरे ॥';
  const roman = 'Hare Kṛṣṇa Hare Kṛṣṇa, Kṛṣṇa Kṛṣṇa Hare Hare\nHare Rāma Hare Rāma, Rāma Rāma Hare Hare';
  assert.equal(skeleton(devanagari), skeleton(roman));
  assert.ok(skeleton(roman).length > 20);
});

test('nothing to read gives nothing', () => {
  for (const value of [undefined, null, '', '   ', '123 !!', '॥ । ॥', 5, {}]) assert.equal(skeleton(value), '');
});

test('a very long text is cut, not slow', () => {
  assert.ok(skeleton('Hare Krishna '.repeat(2000)).length <= 400);
});

// ── How close two are ───────────────────────────────────────────────────────

test('the same consonants are 1, even when there are few', () => {
  assert.equal(closeness('mnmsvy', 'mnmsvy'), 1);
  assert.equal(closeness('m', 'm'), 1);
  assert.equal(closeness('', 'm'), 0);
  assert.equal(closeness('m', ''), 0);
});

test('a run inside a longer text counts when it is long enough and a fair share of it', () => {
  assert.ok(closeness('nmsvy', 'mnmsvy') > 0.95);
  assert.ok(closeness('mnmsvy', 'nmsvy') > 0.95);
  // "mntr" is in far too many: too short.
  assert.equal(closeness('mntr', 'krsngytrmntr'), 0);
  // Long enough, but a sliver of the other.
  assert.equal(closeness('rkrsn', 'rkrsn' + 'x'.repeat(30)), 0);
});

test('a few differences count at the threshold, and fewer in a short text', () => {
  assert.ok(closeness('mrtynjymntr', 'mrtynjymntl') < 0.95);
  const a = 'srkrsncytnprbnytnd';
  assert.ok(closeness(a, a.slice(0, -1) + 'x') > 0.9);
  assert.equal(closeness('mnmsv', 'mnmsx'), 0); // one in five is 0.8
});

// ── Which of our mantras is theirs ──────────────────────────────────────────

const SEED = [
  { slug: 'hare-krishna-mahamantra', name: 'Hare Krishna Mahamantra', sanskrit: 'हरे कृष्ण हरे कृष्ण । कृष्ण कृष्ण हरे हरे ॥\nहरे राम हरे राम । राम राम हरे हरे ॥', transliteration: 'Hare Kṛṣṇa Hare Kṛṣṇa, Kṛṣṇa Kṛṣṇa Hare Hare\nHare Rāma Hare Rāma, Rāma Rāma Hare Hare' },
  { slug: 'panchatattva-mantra', name: 'Panchatattva Mantra', sanskrit: 'श्री कृष्ण चैतन्य प्रभु नित्यानन्द । श्री अद्वैत गदाधर श्रीवासादि गौर भक्त वृन्द ॥', transliteration: 'Śrī Kṛṣṇa Chaitanya Prabhu Nityānanda, Śrī Advaita Gadādhara Śrīvāsādi Gaura-bhakta-vṛnda' },
  { slug: 'om-namo-bhagavate-vasudevaya', name: 'Vasudeva Dwadashakshari Mantra', sanskrit: 'ॐ नमो भगवते वासुदेवाय', transliteration: 'Oṁ Namo Bhagavate Vāsudevāya' },
  { slug: 'rama-taraka-mantra', name: 'Rama Taraka Mantra', sanskrit: 'श्री राम जय राम जय जय राम', transliteration: 'Śrī Rāma Jaya Rāma Jaya Jaya Rāma' },
  { slug: 'nrisimha-mantra', name: 'Nrisimha Maha-mantra', sanskrit: 'उग्रं वीरं महाविष्णुं ज्वलन्तं सर्वतोमुखम् । नृसिंहं भीषणं भद्रं मृत्युमृत्युं नमाम्यहम् ॥', transliteration: 'Ugraṁ vīraṁ mahā-viṣṇuṁ jvalantaṁ sarvato-mukham, Nṛsiṁhaṁ bhīṣaṇaṁ bhadraṁ mṛtyu-mṛtyuṁ namāmy aham' },
  { slug: 'krishna-gayatri', name: 'Krishna Gayatri Mantra', sanskrit: 'ॐ देवकीनन्दनाय विद्महे वासुदेवाय धीमहि । तन्नो कृष्णः प्रचोदयात् ॥', transliteration: 'Oṁ Devakī-nandanāya Vidmahe Vāsudevāya Dhīmahi, Tanno Kṛṣṇaḥ Pracodayāt' },
  { slug: 'vishnu-gayatri', name: 'Vishnu Gayatri Mantra', sanskrit: 'ॐ नारायणाय विद्महे वासुदेवाय धीमहि । तन्नो विष्णुः प्रचोदयात् ॥', transliteration: 'Oṁ Nārāyaṇāya Vidmahe Vāsudevāya Dhīmahi, Tanno Viṣṇuḥ Pracodayāt' },
  { slug: 'pranava-om', name: 'Om (Pranava)', sanskrit: 'ॐ', transliteration: 'Oṁ' },
  { slug: 'om-namah-shivaya', name: 'Panchakshara Mantra', sanskrit: 'ॐ नमः शिवाय', transliteration: 'Oṁ Namaḥ Śivāya' },
  { slug: 'maha-mrityunjaya-mantra', name: 'Maha Mrityunjaya Mantra', sanskrit: 'ॐ त्र्यम्बकं यजामहे सुगन्धिं पुष्टिवर्धनम् । उर्वारुकमिव बन्धनान्मृत्योर्मुक्षीय माऽमृतात् ॥', transliteration: 'Oṁ Tryambakaṁ yajāmahe sugandhiṁ puṣṭi-vardhanam, Urvārukam iva bandhanān mṛtyor mukṣīya māmṛtāt' },
  { slug: 'shiva-gayatri', name: 'Shiva Gayatri Mantra', sanskrit: 'ॐ तत्पुरुषाय विद्महे महादेवाय धीमहि । तन्नो रुद्रः प्रचोदयात् ॥', transliteration: 'Oṁ Tatpuruṣāya Vidmahe Mahādevāya Dhīmahi, Tanno Rudraḥ Pracodayāt' },
].map((row, index) => ({
  ...row,
  id: `m${index}`,
  // What a reading language adds: the name and the text in its own script.
  translations: row.slug === 'om-namah-shivaya'
    ? [{ name: 'पंचाक्षर मंत्र', text: 'ॐ नमः शिवाय' }, { name: 'ஓம் நமசிவாய', text: 'ஓம் நம சிவாய' }]
    : [],
}));

const CANDIDATES = SEED.map(candidateFrom);
const idOf = (slug) => SEED.find((row) => row.slug === slug).id;
const match = (...fields) => matchMantra(fields, CANDIDATES)?.slug ?? null;

test('Om Namah Shivay is the Panchakshara mantra, whatever its name here', () => {
  assert.equal(match('Om Namah Shivay'), 'om-namah-shivaya');
  assert.equal(match('om namah shivaya'), 'om-namah-shivaya');
  assert.equal(match('OM NAMAH SHIVAYA'), 'om-namah-shivaya');
  assert.equal(match('Om Namah Shivay', 'ॐ नमः शिवाय', 'ॐ नमः शिवाय'), 'om-namah-shivaya');
  assert.equal(match('ॐ नमः शिवाय'), 'om-namah-shivaya');
  assert.equal(match('ओम नमः शिवाय'), 'om-namah-shivaya');
  // Its name here is "Panchakshara Mantra", so the name the old app may have used finds it too.
  assert.equal(match('Panchakshari'), 'om-namah-shivaya');
  // A different text that only mentions it is not it.
  assert.equal(match('Namashivaya Stotram'), null);
});

test('part of a mantra is it, when the part is most of it', () => {
  assert.equal(match('Namah Shivaya'), 'om-namah-shivaya');
  assert.equal(match('Om Nmah Shiv'), 'om-namah-shivaya');
});

test('the title, the subtitle or the mantra itself can be the one that says which', () => {
  assert.equal(match('My favourite', null, 'ॐ नमः शिवाय'), 'om-namah-shivaya');
  assert.equal(match('Daily mantra', 'Hare Krishna Mahamantra'), 'hare-krishna-mahamantra');
});

test('Om is Om', () => {
  for (const title of ['Om', 'Aum', 'Ohm', 'ॐ', 'OM']) assert.equal(match(title), 'pranava-om', title);
});

test('Hare Krishna is the mahamantra, not the Panchatattva mantra that also says Krishna', () => {
  assert.equal(match('Hare Krishna'), 'hare-krishna-mahamantra');
  assert.equal(match('Hare Krishna Hare Krishna Krishna Krishna Hare Hare'), 'hare-krishna-mahamantra');
  assert.equal(match('Hare Krishna Maha Mantra'), 'hare-krishna-mahamantra');
  assert.equal(match('हरे कृष्ण महामंत्र'), 'hare-krishna-mahamantra');
});

test('the whole mahamantra in Devanagari is it exactly', () => {
  const scored = matchMantra(['हरे कृष्ण हरे कृष्ण । कृष्ण कृष्ण हरे हरे ॥ हरे राम हरे राम । राम राम हरे हरे ॥'], CANDIDATES);
  assert.equal(scored.slug, 'hare-krishna-mahamantra');
  assert.equal(scored.score, 1);
});

test('the other mantras by their usual names', () => {
  assert.equal(match('Maha Mrityunjaya'), 'maha-mrityunjaya-mantra');
  assert.equal(match('Mahamrityunjaya Mantra'), 'maha-mrityunjaya-mantra');
  assert.equal(match('Om Namo Bhagavate Vasudevaya'), 'om-namo-bhagavate-vasudevaya');
  assert.equal(match('Shri Ram Jai Ram Jai Jai Ram'), 'rama-taraka-mantra');
  assert.equal(match('Vishnu Gayatri'), 'vishnu-gayatri');
  assert.equal(match('Shiva Gayatri Mantra'), 'shiva-gayatri');
});

test('a spelling with a different vowel, a doubled letter or a stray word still finds it', () => {
  assert.equal(match('Om Naamah Shivaaya'), 'om-namah-shivaya');
  assert.equal(match('Om Namah Sivayya'), 'om-namah-shivaya');
  assert.equal(match('Om Namah Shivaya (108 times)'), 'om-namah-shivaya');
});

test('two that fit about equally are not guessed between', () => {
  // Three gayatris, none of them "the" Gayatri; and Maha Mantra is the Hare Krishna one or the Nrisimha one.
  assert.equal(match('Gayatri Mantra'), null);
  assert.equal(match('Maha Mantra'), null);
});

test('too little to go on, or not ours, is no match', () => {
  for (const title of ['Mantra', 'Shiva', 'Krishna', 'Ram', 'Hari', 'Radhe Krishna', 'Jai Shri Ram', 'Ganesh Mantra', '', '   ', '12345']) {
    assert.equal(match(title), null, title);
  }
  assert.equal(matchMantra([], CANDIDATES), null);
  assert.equal(matchMantra(['Om Namah Shivaya'], []), null);
});

test('an exact match is not undone by a close one, but two exact ones are not told apart', () => {
  const twin = candidateFrom({ id: 'twin', slug: 'shivaya-namah', name: 'Om Namah Shivaya', sanskrit: 'ॐ नमः शिवाय' });
  assert.equal(matchMantra(['Om Namah Shivaya'], [...CANDIDATES, twin]), null);

  const close = candidateFrom({ id: 'close', slug: 'om-namah-shivaya-long', name: 'Om Namah Shivaya Shivaya Namah' });
  assert.equal(matchMantra(['Om Namah Shivaya'], [...CANDIDATES, close]).slug, 'om-namah-shivaya');
});

test('candidateFrom reads every way a mantra is written, once each', () => {
  const candidate = candidateFrom(SEED.find((row) => row.slug === 'om-namah-shivaya'));
  assert.equal(candidate.slug, 'om-namah-shivaya');
  assert.deepEqual([...new Set(candidate.skeletons)], candidate.skeletons);
  assert.ok(candidate.skeletons.includes('mnmsvy'));
  assert.ok(candidate.skeletons.length >= 2);
  assert.deepEqual(candidateFrom({ id: 'x', slug: null, name: null, sanskrit: null }).skeletons, []);
});

test('textsOf takes only the three texts an old mantra has', () => {
  assert.deepEqual(textsOf({ id: 1, title: 'A', subtitle: null, mantra: 'C', count: 9 }), ['A', 'C']);
});

// ── The one chanted most ────────────────────────────────────────────────────

const old = (id, title, count, rest = {}) => ({ id, title, subtitle: null, mantra: null, count, ...rest });

test('the most chanted mantra that is ours is the favourite', () => {
  const favourite = pickFavourite(
    [old(1, 'Hare Krishna', 120), old(2, 'Om Namah Shivay', 5400), old(3, 'Maha Mrityunjaya', 300)],
    CANDIDATES
  );
  assert.equal(favourite.mantraId, idOf('om-namah-shivaya'));
  assert.equal(favourite.slug, 'om-namah-shivaya');
  assert.equal(favourite.via, 'name');
  assert.equal(favourite.count, 5400);
  assert.equal(favourite.title, 'Om Namah Shivay');
  assert.deepEqual(favourite.unmatched, []);
});

test('one that is not ours is passed over, and named for the log', () => {
  const favourite = pickFavourite(
    [old(1, 'Gayatri Mantra', 9000), old(2, 'Jai Shri Ram', 8000), old(3, 'Hare Krishna', 100)],
    CANDIDATES
  );
  assert.equal(favourite.slug, 'hare-krishna-mahamantra');
  assert.deepEqual(favourite.unmatched, ['Gayatri Mantra', 'Jai Shri Ram']);
});

test('nothing of theirs being ours is no favourite', () => {
  const favourite = pickFavourite([old(1, 'Gayatri Mantra', 9000), old(2, 'Ganesh Mantra', 10)], CANDIDATES);
  assert.equal(favourite.mantraId, null);
  assert.equal(favourite.slug, null);
  assert.deepEqual(favourite.unmatched, ['Gayatri Mantra', 'Ganesh Mantra']);
  assert.equal(pickFavourite([], CANDIDATES).mantraId, null);
});

test('a tie goes to the one the old server listed first', () => {
  const favourite = pickFavourite([old(1, 'Om', 100), old(2, 'Om Namah Shivaya', 100)], CANDIDATES);
  assert.equal(favourite.slug, 'pranava-om');
  const other = pickFavourite([old(2, 'Om Namah Shivaya', 100), old(1, 'Om', 100)], CANDIDATES);
  assert.equal(other.slug, 'om-namah-shivaya');
});

test('an answer written by hand decides before any matching', () => {
  const overrides = { 7: 'hare-krishna-mahamantra' };
  const favourite = pickFavourite([old(7, 'Maha Mantra', 900), old(8, 'Om Namah Shivaya', 100)], CANDIDATES, { overrides });
  assert.equal(favourite.slug, 'hare-krishna-mahamantra');
  assert.equal(favourite.via, 'override');
  assert.equal(favourite.score, 1);
  // Without it Maha Mantra is ambiguous and the next one is taken.
  assert.equal(pickFavourite([old(7, 'Maha Mantra', 900), old(8, 'Om Namah Shivaya', 100)], CANDIDATES).slug, 'om-namah-shivaya');
});

test('an answer by hand for a mantra that is not published here is ignored', () => {
  const overrides = { 7: 'a-mantra-we-do-not-have' };
  const favourite = pickFavourite([old(7, 'Om Namah Shivaya', 900)], CANDIDATES, { overrides });
  assert.equal(favourite.slug, 'om-namah-shivaya');
  assert.equal(favourite.via, 'name');
});

test('a mantra with no title is read from its subtitle and its text', () => {
  const favourite = pickFavourite([{ id: 4, title: null, subtitle: null, mantra: 'ॐ नमः शिवाय', count: 10 }], CANDIDATES);
  assert.equal(favourite.slug, 'om-namah-shivaya');
  const none = pickFavourite([{ id: 4, title: null, subtitle: null, mantra: null, count: 10 }], CANDIDATES);
  assert.deepEqual(none.unmatched, ['#4']);
});
