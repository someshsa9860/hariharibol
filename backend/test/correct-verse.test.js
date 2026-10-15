import test from 'node:test';
import assert from 'node:assert/strict';

import { chooseText, cutTail } from '../scripts/lib/correct-verse.js';

test('cutTail removes navigation labels and chapter footers, only at the end', () => {
  assert.equal(cutTail('Real purport. Text 9 Text 11'), 'Real purport.');
  assert.equal(cutTail('Real purport. Texts 6-7 Text 9'), 'Real purport.');
  assert.equal(cutTail('Real purport. CHAPTER THREE Text 6'), 'Real purport.');
  assert.equal(cutTail('Real purport. Chapter Forty-seven Text 48'), 'Real purport.');
  assert.equal(cutTail('See Text 9 for this. It ends well.'), 'See Text 9 for this. It ends well.');
  assert.equal(cutTail('Thus end the Bhaktivedanta purports of the First Canto, Seventh Chapter'), '');
  assert.equal(cutTail('Done. END OF THE FIRST CANTO'), 'Done.');
});

test('chooseText: same words keep the source, minus junk', () => {
  assert.deepEqual(chooseText('A b c.', 'A b c.'), { text: 'A b c.', action: 'same' });
  assert.equal(chooseText('A b c. Text 4', 'A b c.').action, 'junk');
});

test('chooseText: a dropped sentence and a misspelling become vedabase\'s', () => {
  assert.equal(chooseText('One. Three.', 'One. Two. Three.').text, 'One. Two. Three.');
  assert.equal(chooseText('The planeary systems.', 'The planetary systems.').action, 'reworded');
});

test('chooseText: what the source has beyond vedabase is kept, except glue in a translation', () => {
  const long = 'Translation. ' + 'glued neighbour text '.repeat(10);
  assert.equal(chooseText('Purport (SB 7.5.31).', 'Purport.').action, 'kept-extra');
  assert.equal(chooseText(long, 'Translation.', { extraIsJunk: true }).text, 'Translation.');
  assert.equal(chooseText('Only mine.', '').text, 'Only mine.');
});
