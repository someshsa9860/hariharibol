// The look of book reels and which buttons they show — what an admin edits without a deploy.
// Stored as one JSON AppSetting; anything missing or malformed falls back to config/book-reel.js.

import * as settings from './setting.js';
import * as s3 from './s3.js';
import { SETTING_KEYS } from '../config/constants.js';
import { normalise } from '../utils/book-reel-style.js';

/** The stored style with every field checked, so a bad save can never break a reel. */
export async function style() {
  let stored = {};
  try {
    stored = JSON.parse((await settings.get(SETTING_KEYS.BOOK_REEL_STYLE, null)) || '{}') || {};
  } catch {
    stored = {};
  }
  return normalise(stored);
}

/** What the app is sent: the style with the background picture as a link. */
export async function forApp() {
  const value = await style();
  const { imageKey, ...rest } = value;
  return { ...rest, imageUrl: imageKey ? await s3.presignGet(imageKey) : null };
}

export async function save(value, updatedById) {
  const clean = normalise(value);
  await settings.set(SETTING_KEYS.BOOK_REEL_STYLE, JSON.stringify(clean), {
    description: 'Book reel appearance and buttons (JSON)',
    updatedById,
  });
  return clean;
}
