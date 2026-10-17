import test from 'node:test';
import assert from 'node:assert/strict';
import { createCanvas, loadImage } from '@napi-rs/canvas';

import { prepare, sniff } from '../utils/chat-image.js';
import { AppError } from '../utils/errors.js';

// A picture to hand in: left half red, right half blue.
function picture(width, height, type = 'image/jpeg') {
  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  context.fillStyle = '#ff0000';
  context.fillRect(0, 0, width / 2, height);
  context.fillStyle = '#0000ff';
  context.fillRect(width / 2, 0, width / 2, height);
  return canvas.toBuffer(type, 95);
}

// The same JPEG with an EXIF block saying "turn it a quarter clockwise" (orientation 6), as a phone held upright writes.
function sideways(jpeg) {
  const tiff = Buffer.from([
    0x4d, 0x4d, 0x00, 0x2a, 0x00, 0x00, 0x00, 0x08, 0x00, 0x01,
    0x01, 0x12, 0x00, 0x03, 0x00, 0x00, 0x00, 0x01, 0x00, 0x06, 0x00, 0x00,
    0x00, 0x00, 0x00, 0x00,
  ]);
  const body = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
  const length = body.length + 2;
  const app1 = Buffer.concat([Buffer.from([0xff, 0xe1, length >> 8, length & 0xff]), body]);
  return Buffer.concat([jpeg.subarray(0, 2), app1, jpeg.subarray(2)]);
}

const refused = (error) => error instanceof AppError && error.status === 422 && error.code === 'IMAGE_NOT_USABLE';

test('sniff names the format and the size from the header alone', () => {
  assert.deepEqual(sniff(picture(40, 20)), { format: 'jpeg', width: 40, height: 20 });
  assert.deepEqual(sniff(picture(30, 50, 'image/png')), { format: 'png', width: 30, height: 50 });
  assert.deepEqual(sniff(picture(64, 32, 'image/webp')), { format: 'webp', width: 64, height: 32 });
});

test('sniff reads past an EXIF block to the real size', () => {
  assert.deepEqual(sniff(sideways(picture(40, 20))), { format: 'jpeg', width: 40, height: 20 });
});

test('sniff refuses what is not a picture', () => {
  assert.equal(sniff(Buffer.from('GIF89a' + 'x'.repeat(40))), null);
  assert.equal(sniff(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>')), null);
  assert.equal(sniff(Buffer.from('%PDF-1.7 ' + 'x'.repeat(40))), null);
  assert.equal(sniff(Buffer.alloc(100)), null);
  assert.equal(sniff(Buffer.alloc(0)), null);
  assert.equal(sniff(null), null);
  assert.equal(sniff('not a buffer at all, but long enough'), null);
});

test('sniff refuses a header that is cut short or claims no size', () => {
  const jpeg = picture(40, 20);
  assert.equal(sniff(jpeg.subarray(0, 12)), null, 'cut before the frame header');
  assert.equal(sniff(Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(30)])), null);
  const png = picture(30, 50, 'image/png');
  assert.equal(sniff(png.subarray(0, 20)), null);
});

test('a picture is drawn again as a JPEG', async () => {
  for (const type of ['image/png', 'image/webp', 'image/jpeg']) {
    const out = await prepare(picture(300, 200, type), { maxEdge: 1280 });
    assert.equal(out.contentType, 'image/jpeg');
    assert.equal(sniff(out.buffer).format, 'jpeg');
    assert.deepEqual([out.width, out.height], [300, 200], 'a small picture is not scaled up');
  }
});

test('a large picture is scaled down so its longest side is at most maxEdge', async () => {
  const wide = await prepare(picture(2000, 1000), { maxEdge: 800 });
  assert.deepEqual([wide.width, wide.height], [800, 400]);

  const tall = await prepare(picture(1000, 3000), { maxEdge: 600 });
  assert.deepEqual([tall.width, tall.height], [200, 600]);

  const decoded = await loadImage(wide.buffer);
  assert.deepEqual([decoded.width, decoded.height], [800, 400], 'the kept file has the size that was reported');
});

test('a sideways photo comes out upright and loses its metadata', async () => {
  const out = await prepare(sideways(picture(40, 20)), { maxEdge: 1280 });
  // Orientation 6 turns a 40×20 file into a 20×40 picture.
  assert.deepEqual([out.width, out.height], [20, 40]);
  assert.ok(!out.buffer.includes(Buffer.from('Exif', 'latin1')), 'no EXIF block in what is kept');

  // Red was the left half, and a clockwise quarter turn puts the left on top.
  const decoded = await loadImage(out.buffer);
  const canvas = createCanvas(decoded.width, decoded.height);
  const context = canvas.getContext('2d');
  context.drawImage(decoded, 0, 0);
  const top = context.getImageData(10, 5, 1, 1).data;
  const bottom = context.getImageData(10, 35, 1, 1).data;
  assert.ok(top[0] > 200 && top[2] < 60, `top should be red, was ${[...top]}`);
  assert.ok(bottom[2] > 200 && bottom[0] < 60, `bottom should be blue, was ${[...bottom]}`);
});

test('transparent pixels become white, not black', async () => {
  const canvas = createCanvas(20, 20); // never painted: fully transparent
  const out = await prepare(canvas.toBuffer('image/png'), { maxEdge: 1280 });
  const decoded = await loadImage(out.buffer);
  const check = createCanvas(20, 20);
  const context = check.getContext('2d');
  context.drawImage(decoded, 0, 0);
  const [r, g, b] = context.getImageData(10, 10, 1, 1).data;
  assert.ok(r > 240 && g > 240 && b > 240, `expected white, got ${[r, g, b]}`);
});

test('garbage, other formats and truncated files are refused with a 422', async () => {
  const jpeg = picture(300, 200);
  const cases = {
    'plain text': Buffer.from('hello, this is not a picture at all'),
    'a GIF': Buffer.from('GIF89a' + 'x'.repeat(60)),
    'an SVG': Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"></svg>'),
    'empty': Buffer.alloc(0),
    'a JPEG with its body cut off': jpeg.subarray(0, 24),
  };
  for (const [name, bytes] of Object.entries(cases)) {
    await assert.rejects(prepare(bytes, { maxEdge: 1280 }), refused, name);
  }
});

test('a header that claims an enormous picture is refused before it is decoded', async () => {
  // A real PNG header, with the size field rewritten to 20000 × 20000 (400 million pixels).
  const png = Buffer.from(picture(30, 50, 'image/png'));
  png.writeUInt32BE(20000, 16);
  png.writeUInt32BE(20000, 20);
  await assert.rejects(prepare(png, { maxEdge: 1280 }), (error) => refused(error) && /too large/i.test(error.message));
});

test('a file whose header is fine but whose pixels are damaged is refused', async () => {
  const png = Buffer.from(picture(300, 200, 'image/png'));
  // Keep the signature and the header chunk, overwrite the pixel data.
  png.fill(0x7f, 60, png.length - 12);
  await assert.rejects(prepare(png, { maxEdge: 1280 }), refused);
});
