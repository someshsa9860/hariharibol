// A picture sent to Ask Sakha: what the bytes really are, and the copy that is kept.
//
// The phone has already scaled the picture down, but the server never takes that on trust. It reads the first
// bytes to learn the format and the size (without decoding — a small file can unpack to a huge image), refuses
// what it will not open, and draws the picture again as a JPEG no larger than the admin's `imageMaxEdge`. Drawing
// again is what drops the camera's metadata (where it was taken, which phone) and turns a sideways photo upright,
// and it means one format reaches the model whatever the phone sent.

import { createCanvas, loadImage } from '@napi-rs/canvas';

import { IMAGE_JPEG_QUALITY, IMAGE_MAX_PIXELS } from '../config/chat.js';
import { AppError } from './errors.js';

const JPEG_START = [0xff, 0xd8, 0xff];
const PNG_START = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (buffer, bytes, at = 0) => bytes.every((b, i) => buffer[at + i] === b);
const ascii = (buffer, from, to) => buffer.toString('latin1', from, to);

// JPEG: walk the segments to the first "start of frame", which holds the height and width.
function jpegSize(buffer) {
  let at = 2;
  while (at + 9 < buffer.length) {
    if (buffer[at] !== 0xff) return null;
    const marker = buffer[at + 1];
    if (marker === 0xff) {
      at += 1; // fill byte
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      at += 2; // markers with no length
      continue;
    }
    const length = buffer.readUInt16BE(at + 2);
    // SOF0–SOF15, except DHT (c4), JPG (c8) and DAC (cc), which share the range.
    if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) {
      return { height: buffer.readUInt16BE(at + 5), width: buffer.readUInt16BE(at + 7) };
    }
    if (length < 2) return null;
    at += 2 + length;
  }
  return null;
}

// An EXIF orientation of 5–8 turns the picture a quarter, so width and height swap once it is drawn upright.
// Only the pixel count matters for the size check, so the swap needs no care here.

function pngSize(buffer) {
  if (buffer.length < 24 || ascii(buffer, 12, 16) !== 'IHDR') return null;
  return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
}

function webpSize(buffer) {
  if (buffer.length < 30) return null;
  const kind = ascii(buffer, 12, 16);
  if (kind === 'VP8 ') {
    return { width: buffer.readUInt16LE(26) & 0x3fff, height: buffer.readUInt16LE(28) & 0x3fff };
  }
  if (kind === 'VP8L') {
    const bits = buffer.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8X') {
    return { width: buffer.readUIntLE(24, 3) + 1, height: buffer.readUIntLE(27, 3) + 1 };
  }
  return null;
}

/** `{ format, width, height }` read from the header, or null when the bytes are not a JPEG, PNG or WebP. */
export function sniff(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) return null;

  let format = null;
  let size = null;
  if (startsWith(buffer, JPEG_START)) {
    format = 'jpeg';
    size = jpegSize(buffer);
  } else if (startsWith(buffer, PNG_START)) {
    format = 'png';
    size = pngSize(buffer);
  } else if (ascii(buffer, 0, 4) === 'RIFF' && ascii(buffer, 8, 12) === 'WEBP') {
    format = 'webp';
    size = webpSize(buffer);
  }

  if (!format || !size || !size.width || !size.height) return null;
  return { format, ...size };
}

const unusable = (message) => new AppError(422, 'IMAGE_NOT_USABLE', message);

/**
 * The picture as it will be kept: `{ buffer, contentType, width, height }`, a JPEG whose longest side is at
 * most [maxEdge]. Throws a 422 `IMAGE_NOT_USABLE` for anything that is not a readable picture; the app words that
 * itself, so the message here is for the log.
 */
export async function prepare(buffer, { maxEdge }) {
  const info = sniff(buffer);
  if (!info) throw unusable('Not a JPEG, PNG or WebP picture');
  if (info.width * info.height > IMAGE_MAX_PIXELS) throw unusable('The picture is too large to open');

  let image;
  try {
    image = await loadImage(buffer);
  } catch {
    throw unusable('The picture could not be read');
  }

  // `image` is already upright: the decoder applies the EXIF orientation.
  const longest = Math.max(image.width, image.height);
  const scale = longest > maxEdge ? maxEdge / longest : 1;
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = createCanvas(width, height);
  const context = canvas.getContext('2d');
  // JPEG has no transparency; a PNG with some would turn black.
  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return { buffer: canvas.toBuffer('image/jpeg', IMAGE_JPEG_QUALITY), contentType: 'image/jpeg', width, height };
}
