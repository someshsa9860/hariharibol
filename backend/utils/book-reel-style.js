// Checks a book reel style: every field is valid or the default, so a bad save can never break a reel.
// No database or network, so it is tested on its own.

import { DEFAULT_BOOK_REEL_STYLE, BOOK_REEL_COLOR_KEYS, BOOK_REEL_FLAG_KEYS } from '../config/book-reel.js';

const HEX = /^#[0-9a-fA-F]{6}$/;
const clamp = (value, min, max, fallback) =>
  Number.isFinite(value) ? Math.min(Math.max(value, min), max) : fallback;

export function normalise(stored) {
  const result = { ...DEFAULT_BOOK_REEL_STYLE };
  for (const key of BOOK_REEL_COLOR_KEYS) if (HEX.test(stored[key] ?? '')) result[key] = stored[key];
  for (const key of BOOK_REEL_FLAG_KEYS) if (stored[key] !== undefined) result[key] = Number(stored[key]) > 0 ? 1 : 0;
  if (['gradient', 'solid', 'image'].includes(stored.background)) result.background = stored.background;
  if (typeof stored.imageKey === 'string' && stored.imageKey) result.imageKey = stored.imageKey;
  result.imageDim = clamp(stored.imageDim, 0, 90, result.imageDim);
  result.textScale = clamp(stored.textScale, 0.7, 1.5, result.textScale);
  result.minPageSeconds = clamp(stored.minPageSeconds, 2, 30, result.minPageSeconds);
  result.wordsPerSecond = clamp(stored.wordsPerSecond, 1, 8, result.wordsPerSecond);
  // No picture without a background that uses it.
  if (result.background === 'image' && !result.imageKey) result.background = 'gradient';
  return result;
}
