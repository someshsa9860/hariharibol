import test from 'node:test';
import assert from 'node:assert/strict';

import { sniffImage, sniffAudio } from '../utils/reel-media.js';

const pad = (head) => Buffer.concat([Buffer.from(head), Buffer.alloc(32)]);

test('images are told by their bytes', () => {
  assert.equal(sniffImage(pad([0xff, 0xd8, 0xff, 0xe0])), 'image/jpeg');
  assert.equal(sniffImage(pad([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])), 'image/png');
  assert.equal(sniffImage(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBP'), Buffer.alloc(8)])), 'image/webp');
  assert.equal(sniffImage(Buffer.from('<html>not a picture at all</html>')), null);
});

test('audio is told by its bytes', () => {
  assert.equal(sniffAudio(pad(Buffer.from('ID3'))), 'audio/mpeg');
  assert.equal(sniffAudio(Buffer.concat([Buffer.alloc(4), Buffer.from('ftypM4A '), Buffer.alloc(8)])), 'audio/mp4');
  assert.equal(sniffAudio(Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WAVE'), Buffer.alloc(8)])), 'audio/wav');
  assert.equal(sniffAudio(pad([0xff, 0xf1])), 'audio/aac');
  assert.equal(sniffAudio(pad([0xff, 0xfb])), 'audio/mpeg');
  assert.equal(sniffAudio(Buffer.from('plain text, definitely not music')), null);
});
