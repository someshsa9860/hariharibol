// Every environment variable the backend reads, in one place, validated once at
// boot. Nothing else in the codebase touches `process.env` — if a value is not
// listed here it does not exist as far as the app is concerned.
//
// Booting with a bad config fails immediately and loudly. A missing secret that
// only shows up on the first payment webhook is far more expensive.

import 'dotenv/config';
import { z } from 'zod';

const csv = (value) =>
  String(value || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_BASE_URL: z.string().default('http://localhost:4000'),
  WEB_BASE_URL: z.string().default('http://localhost:3000'),
  APP_SCHEME: z.string().default('hariharibol'),

  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  REDIS_URL: z.string().default('redis://localhost:6379'),

  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  ACCESS_TOKEN_TTL: z.string().default('7d'),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(365),

  GOOGLE_CLIENT_IDS: z.string().default(''),
  APPLE_BUNDLE_IDS: z.string().default(''),

  APP_CHECK_ENABLED: z.coerce.boolean().default(false),
  FIREBASE_PROJECT_ID: z.string().optional(),
  FIREBASE_CLIENT_EMAIL: z.string().optional(),
  FIREBASE_PRIVATE_KEY: z.string().optional(),

  AWS_REGION: z.string().default('ap-south-1'),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  S3_BUCKET: z.string().default('hariharibol-media'),
  S3_PRESIGN_TTL_SECONDS: z.coerce.number().default(3600),

  AI_PROVIDER: z.enum(['GEMINI', 'OPENAI']).default('GEMINI'),
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_MODEL: z.string().default('gemini-2.0-flash'),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL: z.string().default('gpt-4o-mini'),

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

  WS_PORT: z.coerce.number().default(4001),
  DEEPLINK_PORT: z.coerce.number().default(4002),

  DOCS_ENABLED: z.coerce.boolean().default(true),
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
  appleBundleIds: csv(parsed.data.APPLE_BUNDLE_IDS),
  // Multi-line PEM keys survive .env only as escaped newlines.
  firebasePrivateKey: (parsed.data.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  applePrivateKey: (parsed.data.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
};

export default env;
