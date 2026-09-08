// Fixed values the code compares against. Anything an admin should be able to
// change at runtime belongs in the AppSetting table instead, not here.

// ── Roles ──────────────────────────────────────────────────────────────────
// Standard set. `user` is what every account gets on signup; the rest are
// granted from the admin panel.
const ROLES = {
  USER: 'user',
  MODERATOR: 'moderator',
  ADMIN: 'admin',
  SUPER_ADMIN: 'super_admin',
};

// ── Permissions ────────────────────────────────────────────────────────────
// "<resource>.<action>". The group is only for laying out the admin UI.
const PERMISSIONS = {
  // content
  'book.read': { group: 'content', name: 'View books' },
  'book.write': { group: 'content', name: 'Create and edit books' },
  'book.publish': { group: 'content', name: 'Publish and unpublish books' },
  'book.delete': { group: 'content', name: 'Delete books' },
  'verse.read': { group: 'content', name: 'View verses' },
  'verse.write': { group: 'content', name: 'Create and edit verses' },
  'verse.publish': { group: 'content', name: 'Publish verse translations' },
  'verse.delete': { group: 'content', name: 'Delete verses' },
  'mantra.read': { group: 'content', name: 'View mantras' },
  'mantra.write': { group: 'content', name: 'Create and edit mantras' },
  'mantra.publish': { group: 'content', name: 'Publish mantras' },
  'mantra.delete': { group: 'content', name: 'Delete mantras' },
  'translator.manage': { group: 'content', name: 'Manage translators' },
  'reference.manage': { group: 'content', name: 'Manage deities, gurus, languages, issues' },
  'sloka.manage': { group: 'content', name: 'Curate the daily sloka' },
  'media.upload': { group: 'content', name: 'Upload media to S3' },

  // users
  'user.read': { group: 'users', name: 'View users' },
  'user.write': { group: 'users', name: 'Edit users' },
  'user.ban': { group: 'users', name: 'Ban and unban users and devices' },
  'user.delete': { group: 'users', name: 'Delete users' },
  'role.manage': { group: 'users', name: 'Manage roles and permissions' },
  'notification.send': { group: 'users', name: 'Send broadcasts' },

  // system
  'payment.read': { group: 'system', name: 'View payments and subscriptions' },
  'payment.refund': { group: 'system', name: 'Refund payments' },
  'plan.manage': { group: 'system', name: 'Manage subscription plans' },
  'setting.read': { group: 'system', name: 'View app settings' },
  'setting.write': { group: 'system', name: 'Change app settings' },
  'ai.read': { group: 'system', name: 'View AI usage and spend' },
  'ai.run': { group: 'system', name: 'Trigger AI batch jobs' },
  'audit.read': { group: 'system', name: 'View the audit log' },
  'job.manage': { group: 'system', name: 'Inspect and retry background jobs' },
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);

// Which permissions each standard role carries. `super_admin` is intentionally
// not listed — it is granted everything, including permissions added later.
const ROLE_PERMISSIONS = {
  [ROLES.USER]: [],
  [ROLES.MODERATOR]: [
    'book.read',
    'verse.read',
    'verse.write',
    'mantra.read',
    'sloka.manage',
    'user.read',
    'media.upload',
  ],
  [ROLES.ADMIN]: ALL_PERMISSIONS.filter(
    (slug) => !['user.delete', 'role.manage', 'setting.write', 'payment.refund'].includes(slug)
  ),
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,
};

// ── Books ──────────────────────────────────────────────────────────────────
// First segment of every verseId. Baked into the already-scraped content — do
// not renumber. Only these two are ever eligible as a daily sloka.
const BOOK_NUMBERS = { BHAGAVAD_GITA: 1, SRIMAD_BHAGAVATAM: 2 };
const SLOKA_ELIGIBLE_BOOK_NUMBERS = [BOOK_NUMBERS.BHAGAVAD_GITA, BOOK_NUMBERS.SRIMAD_BHAGAVATAM];

// ── Language fallbacks ─────────────────────────────────────────────────────
const DEFAULT_LANGUAGE = 'en';
const SOURCE_LANGUAGE = 'sa';

// ── Sadhana ────────────────────────────────────────────────────────────────
const BEADS_PER_ROUND = 108;
const DEFAULT_ROUND_TARGET = 16;

// ── Pagination ─────────────────────────────────────────────────────────────
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

// ── AppSetting keys ────────────────────────────────────────────────────────
// The settings the code actually reads. Listed so the admin panel can render
// them without a hardcoded copy of its own.
const SETTING_KEYS = {
  AI_PROVIDER: 'ai.provider',
  AI_MODEL_TEXT: 'ai.model.text',
  AI_MONTHLY_BUDGET_MICROS: 'ai.budget.monthly_micros',
  SLOKA_DELIVERY_HOUR: 'sloka.delivery.default_hour',
  FREE_MOOD_SLOKA_QUOTA: 'sloka.mood.free_quota_per_month',
  SIGNUP_ENABLED: 'auth.signup.enabled',
};

// ── Cache keys and TTLs ────────────────────────────────────────────────────
const CACHE = {
  userAuth: (userId) => `auth:user:${userId}`,
  userAuthTtl: 300,
  setting: (key) => `setting:${key}`,
  settingTtl: 60,
  dailySloka: (date) => `sloka:daily:${date}`,
  dailySlokaTtl: 3600,
};

export {
  ROLES,
  PERMISSIONS,
  ALL_PERMISSIONS,
  ROLE_PERMISSIONS,
  BOOK_NUMBERS,
  SLOKA_ELIGIBLE_BOOK_NUMBERS,
  DEFAULT_LANGUAGE,
  SOURCE_LANGUAGE,
  BEADS_PER_ROUND,
  DEFAULT_ROUND_TARGET,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  SETTING_KEYS,
  CACHE,
};
