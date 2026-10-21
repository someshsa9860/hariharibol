// Every environment variable the backend reads, in one place, validated once at
// boot. Nothing else in the codebase touches `process.env` — if a value is not
// listed here it does not exist as far as the app is concerned.
//
// Booting with a bad config fails immediately and loudly. A missing secret that
// only shows up on the first payment webhook is far more expensive.

import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import 'dotenv/config';
import { z } from 'zod';

const csv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

// `z.coerce.boolean()` is Boolean(value), and Boolean('false') is true — every
// flag set to "false" in a .env file would read as on. This reads the word.
const flag = (fallback) =>
  z
    .string()
    .optional()
    .transform((value) => {
      if (value === undefined || value.trim() === '') return fallback;
      return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
    });

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  ADMIN_BASE_URL: z.string().default('http://localhost:5183'),
  APP_SCHEME: z.string().default('hariharibol'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('7d'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(365),
  // A refresh token that was spent this recently is answered with a fresh pair
  // instead of being treated as stolen: the usual cause is a phone that sent the
  // refresh, lost the reply, and asks again once its signal is back — which can
  // be minutes later, hence five. 0 turns the allowance off.
  REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().min(0).default(300),

  GOOGLE_CLIENT_IDS: z.string().default(''),
  APPLE_BUNDLE_IDS: z.string().default(''),

  APP_CHECK_ENABLED: flag(false),

  // Carrying people over from the old app's server (POST /auth/legacy, services/legacy.js). The URL is
  // the old server's migration route in full; the key is the secret both servers hold (HHB_MIGRATION_KEY
  // over there), sent as X-Migration-Key. Leave either blank and the feature is off: the endpoint answers
  // 503 and the app keeps the old token for later.
  LEGACY_MIGRATION_URL: z
    .string()
    .trim()
    .refine((value) => !value || /^https?:\/\/\S+$/i.test(value), 'must be a full http(s) URL')
    .default(''),
  LEGACY_MIGRATION_KEY: z
    .string()
    .trim()
    .refine((value) => !value || value.length >= 32, 'must be at least 32 characters')
    .default(''),
  LEGACY_MIGRATION_TIMEOUT_MS: z.coerce.number().int().min(1000).max(30000).default(8000),

  // Path to the Firebase service account JSON — see secrets/README.md. Either
  // absolute, or relative to the backend directory. Takes precedence over the
  // three FIREBASE_* fields below, which remain for hosts where mounting a
  // file is more trouble than setting variables.
  GOOGLE_SERVICE_ACCOUNT_PATH: z.string().optional(),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('hariharibol-media'),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().default(3600),

  // Weekly export of every book's text to S3 for the app's silent offline sync.
  // See config/book-cache.js and the "Book cache" section of backend/README.md.
  BOOK_CACHE_ENABLED: flag(true),
  BOOK_CACHE_CRON: z.string().default('0 0 * * 0'), // Sunday 00:00
  BOOK_CACHE_TZ: z.string().default('Asia/Kolkata'),
  BOOK_CACHE_PREFIX: z.string().default('books/caches'),
  BOOK_CACHE_DOWNLOAD_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  // A changed book is exported once its writes have been quiet this long (an import is many statements).
  BOOK_CACHE_QUIET_SECONDS: z.coerce.number().int().min(0).max(3600).default(90),

  // "gemini" or "openai", in any case.
  AI_PROVIDER: z
    .string()
    .default('gemini')
    .transform((value) => value.trim().toUpperCase())
    .pipe(z.enum(['GEMINI', 'OPENAI'])),
  GEMINI_API_KEY: z.string().optional(),
  // Google retires Gemini models without warning: every 2.0 model and 2.5 Flash-Lite answer 404 ("no longer
  // available") as of 2026-10-17, and 3.5 Flash-Lite is the replacement its error message names.
  GEMINI_MODEL: z.string().default('gemini-3.5-flash-lite'),
  // Chat: the cheap model that writes conversation summaries, and the stronger
  // one for plans whose model tier is ADVANCED. Both fall back to the main model.
  GEMINI_SUMMARY_MODEL: z.string().default('gemini-3.5-flash-lite'),
  GEMINI_ADVANCED_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_SUMMARY_MODEL: z.string().default('gpt-4o-mini'),
  OPENAI_ADVANCED_MODEL: z.string().optional(),
  // The last resort of every AI call (chat included): when the free tier is spent and the provider that is set
  // (Gemini, say) is not working, OpenAI answers with this model, at its paid rate. Blank turns the fallback off.
  AI_FALLBACK_MODEL: z.string().default('gpt-6-luna').transform((value) => value.trim()),
  // How hard a reasoning model (gpt-6-luna) thinks before it answers. Every thinking token is billed — and
  // taken from a reader's wallet — as output, and the reply waits for them, so chat defaults to `none`.
  // Models that do not reason ignore it. Blank means the default.
  OPENAI_REASONING_EFFORT: z
    .string()
    .default('none')
    .transform((value) => value.trim().toLowerCase() || 'none')
    .pipe(z.enum(['none', 'low', 'medium', 'high'])),

  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  PUBSUB_VERIFICATION_TOKEN: z.string().optional(),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().optional(),
  APPLE_ISSUER_ID: z.string().optional(),
  APPLE_KEY_ID: z.string().optional(),
  APPLE_PRIVATE_KEY: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  MAIL_FROM: z.string().default('HariHariBol <no-reply@hariharibol.com>'),

  // An AI model translating the Gita (scripts/translate-claude.js, and the admin panel's Translations page,
  // which runs it in the worker) — GPT-6 Luna unless a part is given to Claude or Gemini. Without a key the
  // page still opens and shows what is saved; a run pauses with a message saying the key is missing.
  // TRANSLATION_VERSION is checked where it is used (versionFrom) — it ends up in file names.
  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().optional(),
  // The other providers a run can use, and which one the Translations page offers first (anthropic | openai | gemini; default openai).
  OPENAI_API_KEY: z.string().optional(),
  TRANSLATION_OPENAI_MODEL: z.string().optional(),
  TRANSLATION_GEMINI_MODEL: z.string().optional(), // Gemini's key is GEMINI_API_KEY, above
  TRANSLATION_PROVIDER: z.enum(['anthropic', 'openai', 'gemini']).optional(),
  TRANSLATION_VERSION: z.string().optional(),

  // Group chanting (WebRTC). Audio goes phone to phone; STUN finds the way, TURN relays when no
  // direct path exists. TURN is optional but, without it, people behind some mobile carriers
  // and strict networks cannot be heard. TURN_SECRET is coturn's `static-auth-secret`: the API
  // hands each person a username/password that expires, so no fixed password reaches a client.
  STUN_URLS: z.string().default('stun:stun.l.google.com:19302'),
  TURN_URLS: z.string().optional(),
  TURN_SECRET: z.string().optional(),
  TURN_TTL_SECONDS: z.coerce.number().default(3600),

  WS_PORT: z.coerce.number().default(4001),
  DEEPLINK_PORT: z.coerce.number().default(4002),

  DOCS_ENABLED: flag(true),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
  // eslint-disable-next-line no-console
  console.error(`Invalid environment configuration:\n${problems.join('\n')}`);
  process.exit(1);
}

const env = {
  ...parsed.data,
  isProduction: parsed.data.NODE_ENV === 'production',
  isDevelopment: parsed.data.NODE_ENV === 'development',
  googleClientIds: csv(parsed.data.GOOGLE_CLIENT_IDS),
  stunUrls: csv(parsed.data.STUN_URLS),
  turnUrls: csv(parsed.data.TURN_URLS),
  appleBundleIds: csv(parsed.data.APPLE_BUNDLE_IDS),
  legacyMigrationEnabled: Boolean(parsed.data.LEGACY_MIGRATION_URL && parsed.data.LEGACY_MIGRATION_KEY),
  // Resolved against the backend directory so the .env can hold the short,
  // obvious `secrets/…json` rather than a path that only works from one cwd.
  googleServiceAccountPath: parsed.data.GOOGLE_SERVICE_ACCOUNT_PATH
    ? resolve(dirname(fileURLToPath(import.meta.url)), '..', parsed.data.GOOGLE_SERVICE_ACCOUNT_PATH)
    : null,
  // Multi-line PEM keys survive .env only as escaped newlines.
  firebasePrivateKey: (parsed.data.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  applePrivateKey: (parsed.data.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

export default env;
