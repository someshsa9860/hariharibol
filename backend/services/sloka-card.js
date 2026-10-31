// The picture that goes with the daily sloka push: "Sloka of Day" across the
// top, the verse in the middle, the book and verse number along the bottom, all
// over a blurred photograph.
//
// Drawn here rather than designed per verse, once per verse ever — the card
// holds nothing about who it is for (the meaning stays in the push's text, where
// it can be in the reader's own language), so every reader of a verse is sent
// the same file. It is stored in the media bucket and the push carries a link.
//
// Android shows this as the notification's big picture. Older versions crop it
// to about 17:9 around the middle, so the title and footer sit inside that band
// and only the frame is ever lost to the crop.

import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

import logger from '../config/logger.js';
import * as s3 from './s3.js';
import { cardStanzas, fitVerse } from '../utils/sloka-card-text.js';
import { verseLabel, versePlace } from '../utils/sloka-push.js';

const ROOT = path.join(import.meta.dirname, '..');

// The photograph behind every card. Replacing the file is all it takes — the
// stored cards are keyed by what is in it, so they are drawn again.
const BACKGROUND_FILE = path.join(ROOT, 'public', 'g01-lotus-feet-820x547.jpg');

// Bump when the layout below changes, so cards already stored are drawn again.
const LAYOUT_VERSION = 1;

const WIDTH = 1200;
const HEIGHT = 900; // 4:3
const BLUR = 16;

const GOLD = '#F6C46B';
const CREAM = '#FFF3DC';

const TITLE = 'Sloka of Day';
const TITLE_BASELINE = 232;
const FOOTER_BASELINE = 742;

// The verse is centred in this box, as large as it will go inside it.
const VERSE_TOP = 296;
const VERSE_BOTTOM = 650;
const VERSE_WIDTH = 1020;
const VERSE_MAX_SIZE = 56;
const VERSE_MIN_SIZE = 32;
const LINE_HEIGHT = 1.6; // Devanagari needs room for its marks above and below
const STANZA_GAP = 0.5;

const SERIF_LATIN = 'SlokaCardLatin';
const SERIF_DEVANAGARI = 'SlokaCardDevanagari';
GlobalFonts.registerFromPath(path.join(ROOT, 'assets', 'fonts', 'PlayfairDisplay.ttf'), SERIF_LATIN);
GlobalFonts.registerFromPath(
  path.join(ROOT, 'assets', 'fonts', 'NotoSerifDevanagari.ttf'),
  SERIF_DEVANAGARI
);

// The photograph blurred and darkened — the same for every card, so it is made
// once. `designId` changes with the photograph and the layout.
let backdropPromise = null;

async function makeBackdrop() {
  const bytes = await fs.readFile(BACKGROUND_FILE);
  const photo = await loadImage(bytes);
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  // Cover the card, then draw past its edges: a blur fades to transparent at
  // the border of what it is drawn from, which would show as a pale rim.
  const scale = Math.max(WIDTH / photo.width, HEIGHT / photo.height);
  const bleed = BLUR * 3;
  const w = photo.width * scale + bleed * 2;
  const h = photo.height * scale + bleed * 2;
  ctx.filter = `blur(${BLUR}px)`;
  ctx.drawImage(photo, (WIDTH - w) / 2, (HEIGHT - h) / 2, w, h);
  ctx.filter = 'none';

  // Dark enough that cream text reads over the brightest part of the photo,
  // and darker still toward the edges.
  ctx.fillStyle = 'rgba(28, 6, 10, 0.5)';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);
  const vignette = ctx.createRadialGradient(WIDTH / 2, HEIGHT / 2, HEIGHT * 0.3, WIDTH / 2, HEIGHT / 2, HEIGHT * 0.85);
  vignette.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vignette.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const hash = crypto.createHash('sha1').update(bytes).digest('hex').slice(0, 8);
  return { canvas, designId: `${LAYOUT_VERSION}-${hash}` };
}

function backdrop() {
  backdropPromise ??= makeBackdrop().catch((err) => {
    backdropPromise = null; // try again next time rather than fail forever
    throw err;
  });
  return backdropPromise;
}

// A short gold rule with a diamond in the middle.
function ornament(ctx, y) {
  ctx.strokeStyle = GOLD;
  ctx.fillStyle = GOLD;
  ctx.lineWidth = 2;
  const half = 90;
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2 - half, y);
  ctx.lineTo(WIDTH / 2 - 14, y);
  ctx.moveTo(WIDTH / 2 + 14, y);
  ctx.lineTo(WIDTH / 2 + half, y);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(WIDTH / 2, y - 7);
  ctx.lineTo(WIDTH / 2 + 7, y);
  ctx.lineTo(WIDTH / 2, y + 7);
  ctx.lineTo(WIDTH / 2 - 7, y);
  ctx.fill();
}

/**
 * The card for one verse as a JPEG, or null when it has no Sanskrit to show.
 * `verse` is what `loadVerseForPush` reads: sanskrit, numbers and `book.title`.
 */
async function renderCard(verse) {
  const stanzas = cardStanzas(verse.sanskrit);
  if (!stanzas.length) return null;

  const { canvas: base } = await backdrop();
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(base, 0, 0);

  // A thin frame, the one part an old Android crop can take.
  ctx.strokeStyle = 'rgba(246, 196, 107, 0.45)';
  ctx.lineWidth = 2;
  ctx.strokeRect(36, 36, WIDTH - 72, HEIGHT - 72);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.55)';
  ctx.shadowBlur = 14;

  ctx.fillStyle = GOLD;
  ctx.font = `46px ${SERIF_LATIN}`;
  ctx.letterSpacing = '4px';
  ctx.fillText(TITLE, WIDTH / 2, TITLE_BASELINE);
  ctx.letterSpacing = '0px';
  ornament(ctx, TITLE_BASELINE + 36);

  const fit = fitVerse(stanzas, {
    measure: (text, size) => {
      ctx.font = `${size}px ${SERIF_DEVANAGARI}`;
      return ctx.measureText(text).width;
    },
    width: VERSE_WIDTH,
    height: VERSE_BOTTOM - VERSE_TOP,
    maxSize: VERSE_MAX_SIZE,
    minSize: VERSE_MIN_SIZE,
    lineHeight: LINE_HEIGHT,
    stanzaGap: STANZA_GAP,
  });

  // Centre the block, then place each line by the middle of its own row.
  const rows = fit.lines.length * fit.size * LINE_HEIGHT;
  const gaps = fit.lines.filter((l) => l.gapBefore).length * fit.size * STANZA_GAP;
  let y = (VERSE_TOP + VERSE_BOTTOM) / 2 - (rows + gaps) / 2;
  ctx.fillStyle = CREAM;
  ctx.font = `${fit.size}px ${SERIF_DEVANAGARI}`;
  for (const line of fit.lines) {
    if (line.gapBefore) y += fit.size * STANZA_GAP;
    ctx.fillText(line.text, WIDTH / 2, y + fit.size * (LINE_HEIGHT / 2 + 0.3));
    y += fit.size * LINE_HEIGHT;
  }

  ornament(ctx, FOOTER_BASELINE - 56);
  ctx.fillStyle = GOLD;
  ctx.font = `38px ${SERIF_LATIN}`;
  ctx.fillText(`${verse.book.title}  ·  ${versePlace(verse)}`, WIDTH / 2, FOOTER_BASELINE);

  return canvas.toBuffer('image/jpeg', 86);
}

// Where a verse's card is kept. The design id is in the path, so a new photo or
// layout is drawn afresh and nothing has to be deleted.
async function cardKey(verse) {
  const { designId } = await backdrop();
  return `${s3.ROOT}/${s3.PREFIXES.slokaImage}/cards/${designId}/${verse.verseId}.jpg`;
}

/**
 * A link a phone can fetch the verse's card from, or null — the push is sent
 * either way, and a missing card must never be the reason a sloka is not.
 */
async function cardUrl(verse) {
  if (!verse?.sanskrit?.trim() || !verseLabel(verse)) return null;
  try {
    const key = await cardKey(verse);
    if (!(await s3.objectExists(key))) {
      const jpeg = await renderCard(verse);
      if (!jpeg) return null;
      await s3.putObject(key, jpeg, 'image/jpeg', { cacheControl: 'public, max-age=31536000, immutable' });
    }
    const url = await s3.presignGet(key);
    // A laptop's link is http://localhost, which no phone can open — and FCM
    // refuses the whole push over a link it cannot use (utils/push-message.js).
    return url?.startsWith('https://') ? url : null;
  } catch (err) {
    logger.warn({ err: err.message, verseId: verse.verseId }, 'sloka card failed — pushing without it');
    return null;
  }
}

export { renderCard, cardUrl };
