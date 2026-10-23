// A picture for a mantra, found on the open web instead of made by an AI (which costs more).
//
// Wikimedia Commons is searched by the few words the AI gave for it, and a file is taken only when Commons itself
// marks it public domain or CC0, is a JPEG or PNG, and is large enough to look like a picture. What comes back is a
// plain https address on Wikimedia's own host; nothing is downloaded or stored here. Any trouble — no answer in time,
// nothing found — is simply no picture: the reader can add one of their own.

import logger from '../config/logger.js';
import { IMAGE_SEARCH_TIMEOUT_MS, IMAGE_SEARCH_URL } from '../config/mantra-own.js';

const THUMB_WIDTH = 1024;
const MIN_WIDTH = 400;
const WIKIMEDIA_HOST = 'upload.wikimedia.org';

// Wikimedia asks every client to say who it is.
const USER_AGENT = 'HariHariBol/1.0 (https://hariharibol.com; mantra pictures)';

const PUBLIC_LICENCE = /^(public domain|pd\b|cc0|cc-0)/i;

/** The licence Commons records for a file, as a short string ('' when it records none). */
const licenceOf = (info) => String(info?.extmetadata?.LicenseShortName?.value ?? info?.extmetadata?.License?.value ?? '');

/** Whether a Commons file is one we may link: public domain / CC0, JPEG or PNG, wide enough, on Wikimedia's host. */
function usable(info) {
  if (!info || !['image/jpeg', 'image/png'].includes(info.mime)) return false;
  if (!PUBLIC_LICENCE.test(licenceOf(info))) return false;
  if (!(info.width >= MIN_WIDTH)) return false;

  try {
    const url = new URL(info.thumburl || info.url);
    return url.protocol === 'https:' && url.hostname === WIKIMEDIA_HOST;
  } catch {
    return false;
  }
}

/**
 * The address of a public picture for `query` (a few English words, such as "Lord Shiva"), or null.
 * Never throws.
 */
export async function findPicture(query) {
  const words = String(query ?? '').replace(/[^\p{L}\p{N} '-]+/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
  if (words.length < 2) return null;

  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    formatversion: '2',
    generator: 'search',
    gsrsearch: `${words} filetype:bitmap`,
    gsrnamespace: '6', // the File: pages
    gsrlimit: '12',
    prop: 'imageinfo',
    iiprop: 'url|mime|size|extmetadata',
    iiurlwidth: String(THUMB_WIDTH),
  });

  try {
    const response = await fetch(`${IMAGE_SEARCH_URL}?${params}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: AbortSignal.timeout(IMAGE_SEARCH_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const pages = (await response.json())?.query?.pages ?? [];
    const found = pages
      .map((page) => ({ index: page.index ?? 0, info: page.imageinfo?.[0] }))
      .sort((a, b) => a.index - b.index)
      .find(({ info }) => usable(info));

    return found ? found.info.thumburl || found.info.url : null;
  } catch (error) {
    logger.warn({ err: error.message, query: words }, 'mantra picture search failed');
    return null;
  }
}
