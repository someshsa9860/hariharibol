// Facts used in more than one place. Every value that differs per environment comes from an environment variable
// (see .env.example) and has a working default, so `npm run dev` needs no setup.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hariharibol.com').replace(/\/$/, '');

/** The API as the browser reaches it. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.hariharibol.com').replace(/\/$/, '');

/** The API as the Next server reaches it — may be an internal address. */
export const SERVER_API_BASE = (process.env.API_BASE_URL ?? API_BASE).replace(/\/$/, '');

/** Where Apple sends the popup back to. The client ids, and App Check's keys, are read at run time: lib/runtime-config.ts. */
export const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ?? `${SITE_URL}/`;

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sss.ramkrishnahari';
export const CONTACT_EMAIL = 'hello@hariharibol.com';
export const APP_VERSION = '2.0.0';

/**
 * Śrīla Prabhupāda's name is not shown beside his translations and purports until permission to name him has been
 * given; set this to true then. Only the credit goes — his texts stay, and every other translator is still named.
 * The app has the same switch (`AppConfig.showAuthorName`).
 */
export const SHOW_AUTHOR_NAME = false;
/** The translator `SHOW_AUTHOR_NAME` is about. */
export const AUTHOR_SLUG = 'prabhupada';

/**
 * Where the library's texts were taken from, named on `/sources`. Shown as text, not links: the page names its sources,
 * it does not send anyone to them. The app lists the same (`app/lib/core/constants/text_sources.dart`).
 */
export const TEXT_SOURCES = [
  {
    label: 'Bhagavad-gītā: the Sanskrit text, the English translation and purports, and the commentaries of Śrī Rāmānujācārya, Śrī Madhvācārya and Śrīdhara Svāmī',
    address: 'github.com/vedicscriptures/bhagavad-gita',
  },
  { label: 'Śrīmad-Bhāgavatam, Cantos 1–9: the Sanskrit text, the English translation and purports', address: 'srimad-bhagavatam.github.io' },
  { label: 'Śrīmad-Bhāgavatam, Cantos 10–12: the Sanskrit text, the English translation and purports', address: 'vedabase.io' },
  { label: 'Dnyāneshwarī: Sant Dnyāneshwar’s Marathi ovīs on the Bhagavad-gītā', address: 'mr.wikisource.org' },
] as const;

export const DEFAULT_LANGUAGE = 'en';
/** Cookie the server reads to render a chapter in the reader's language; the browser writes it. */
export const READING_COOKIE = 'hhb_read';

export const LEGAL_LINKS = [
  { label: 'Privacy', href: `${API_BASE}/api/web/pages/privacy` },
  { label: 'Terms', href: `${API_BASE}/api/web/pages/terms` },
  { label: 'Delete account', href: `${API_BASE}/api/web/pages/account-deletion` },
] as const;
