// What an admin can add to a push beyond its words: a picture, a style, where a
// tap goes, up to two action buttons, and how loud it is.
//
// Pure apart from `resolveImage`'s signing of an uploaded key (storage is loaded
// only then), so `npm test` loads it on its own. The app reads the same names (`app/lib/core/constants/
// push_config.dart`, `app/lib/services/push_link.dart`) and the admin preview
// (`admin/src/lib/push-preview.ts`) lists the same targets — keep the three in step.

import { badRequest } from './errors.js';

const SCHEME = 'hariharibol';

// The app's own words for where a tap can go. `params` are the query values each
// one takes; `required` must be present. `sakha` is Ask Sakha (the route is
// still /chat inside the app).
const TARGETS = {
  home: { label: 'Home', params: [] },
  sakha: { label: 'Ask Sakha', params: [] },
  jap: { label: 'Jap counter', params: [] },
  chant: { label: 'Chant counter', params: [] },
  read: { label: 'Read (library)', params: [] },
  reels: { label: 'Reels', params: [] },
  routine: { label: 'Routine', params: [] },
  calendar: { label: 'Hindu calendar', params: [] },
  premium: { label: 'Plans', params: [] },
  refer: { label: 'Refer and earn', params: [] },
  search: { label: 'Search', params: [] },
  support: { label: 'Help and feedback', params: [] },
  ticket: { label: 'A support ticket', params: ['id'], required: ['id'] },
  mantra: { label: 'A mantra', params: ['slug'], required: ['slug'] },
  reel: { label: 'A reel', params: ['id'], required: ['id'] },
  verse: {
    label: 'A verse',
    params: ['book', 'canto', 'chapter', 'verse'],
    required: ['book', 'chapter'],
  },
};

const STYLES = ['auto', 'picture', 'text'];
const IMPORTANCE = ['urgent', 'quiet'];

// The Android channel each importance lands on. The app creates both
// (`LocalPushService.ensureChannels`); a channel FCM names that does not exist
// falls back to the app's default one.
const CHANNELS = { urgent: 'default', quiet: 'updates' };

/** `hariharibol://verse?book=gita&chapter=2`, or null when nothing is chosen. */
function linkToUri(link) {
  if (!link?.target) return null;
  const target = TARGETS[link.target];
  if (!target) throw badRequest(`Unknown tap target: ${link.target}`);
  const query = new URLSearchParams();
  for (const name of target.params) {
    const value = String(link[name] ?? '').trim();
    if (value) query.set(name, value);
  }
  for (const name of target.required || []) {
    if (!query.get(name)) throw badRequest(`"${target.label}" needs a ${name}`);
  }
  const text = query.toString();
  return `${SCHEME}://${link.target}${text ? `?${text}` : ''}`;
}

/**
 * The picture as a link a phone can open. An uploaded key is signed; a pasted
 * link must be https (FCM refuses anything else, and that failure reads as a dead
 * token — see services/fcm.js). Null when the signed link is not https, which is
 * a laptop's http://localhost.
 */
async function resolveImage(image) {
  const value = String(image || '').trim();
  if (!value) return null;
  if (/^https:\/\//i.test(value)) return value;
  if (/^[a-z]+:\/\//i.test(value)) throw badRequest('The picture link must start with https://');
  const s3 = await import('../services/s3.js');
  if (!s3.isGeneratedKey(value)) throw badRequest('That is not an uploaded picture');
  const key = await s3.commitKey(value);
  const url = await s3.presignGet(key);
  return url?.startsWith('https://') ? url : null;
}

/**
 * Turns the admin's choices into what a send needs:
 *   image       the https link, or null
 *   data        extra FCM data (all strings): the tap link, the verse's place,
 *               the style, the action buttons as JSON
 *   importance  'urgent' | 'quiet'
 *   hasActions  Android then gets a data-only message, which the app draws
 */
async function build({ image, style = 'auto', importance = 'urgent', link, actions } = {}) {
  const data = {};

  const deeplink = linkToUri(link);
  if (deeplink) {
    data.deeplink = deeplink;
    // The verse's place travels in the keys the daily sloka already uses, so a
    // tap opens it the same way.
    if (link.target === 'verse') {
      data.bookSlug = String(link.book).trim();
      data.chapterNumber = String(link.chapter).trim();
      if (String(link.canto ?? '').trim()) data.cantoNumber = String(link.canto).trim();
      if (String(link.verse ?? '').trim()) data.verseNumber = String(link.verse).trim();
    }
  }

  const buttons = (actions || [])
    .filter((a) => a?.label?.trim())
    .slice(0, 2)
    .map((a, index) => {
      const uri = linkToUri(a.link);
      if (!uri) throw badRequest(`Button "${a.label}" needs somewhere to go`);
      return { id: `a${index + 1}`, label: a.label.trim(), deeplink: uri };
    });
  if (buttons.length) data.actions = JSON.stringify(buttons);

  const picture = await resolveImage(image);
  // 'auto' draws the picture big when there is one and the whole text when not.
  const resolvedStyle = style === 'auto' ? (picture ? 'picture' : 'text') : style;
  // The app draws data-only pushes itself and needs to know how loud.
  if (importance === 'quiet') data.importance = 'quiet';
  data.style = resolvedStyle === 'picture' && !picture ? 'text' : resolvedStyle;

  return { image: picture, data, importance, hasActions: buttons.length > 0 };
}

export { SCHEME, TARGETS, STYLES, IMPORTANCE, CHANNELS, linkToUri, resolveImage, build };
