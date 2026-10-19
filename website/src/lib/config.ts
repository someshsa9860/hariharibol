// Facts used in more than one place. Every value that differs per environment comes from an environment variable
// (see .env.example) and has a working default, so `npm run dev` needs no setup.

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? 'https://hariharibol.com').replace(/\/$/, '');

/** The API as the browser reaches it. */
export const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://api.hariharibol.com').replace(/\/$/, '');

/** The API as the Next server reaches it — may be an internal address. */
export const SERVER_API_BASE = (process.env.API_BASE_URL ?? API_BASE).replace(/\/$/, '');

export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';
export const APPLE_CLIENT_ID = process.env.NEXT_PUBLIC_APPLE_CLIENT_ID ?? '';
export const APPLE_REDIRECT_URI = process.env.NEXT_PUBLIC_APPLE_REDIRECT_URI ?? `${SITE_URL}/`;

/** Firebase web config as JSON, and the reCAPTCHA Enterprise key, for App Check (the API asks for it on sign-in). */
export const FIREBASE_CONFIG = process.env.NEXT_PUBLIC_FIREBASE_CONFIG ?? '';
export const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY ?? '';

export const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sss.ramkrishnahari';
export const CONTACT_EMAIL = 'hello@hariharibol.com';
export const APP_VERSION = '2.0.0';

export const DEFAULT_LANGUAGE = 'en';
/** Cookie the server reads to render a chapter in the reader's language; the browser writes it. */
export const READING_COOKIE = 'hhb_read';

export const LEGAL_LINKS = [
  { label: 'Privacy', href: `${API_BASE}/api/web/pages/privacy` },
  { label: 'Terms', href: `${API_BASE}/api/web/pages/terms` },
  { label: 'Delete account', href: `${API_BASE}/api/web/pages/account-deletion` },
] as const;
