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
  'reelTemplate.read': { group: 'content', name: 'View reel templates' },
  'reelTemplate.write': { group: 'content', name: 'Create and edit reel templates' },
  'reelTemplate.delete': { group: 'content', name: 'Delete reel templates' },
  'reel.read': { group: 'content', name: 'View reels' },
  'reel.write': { group: 'content', name: 'Create and edit reels' },
  'reel.publish': { group: 'content', name: 'Publish and unpublish reels' },
  'reel.generate': { group: 'content', name: 'Generate reels from scripture verses' },
  'reel.delete': { group: 'content', name: 'Delete reels' },

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
  'system.read': { group: 'system', name: 'View server health, storage and analytics' },
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

// The account that owns every reel a ReelTemplate generates. It never signs
// in — there is no outside creator to attribute auto-generated scripture
// content to, and the admin who runs "generate" is already the reviewer — so
// this exists purely so Reel.creatorId (required, same as any other reel) has
// somewhere to point. Seeded once by prisma/seed/index.js.
const SYSTEM_CREATOR_EMAIL = 'content@hariharibol.app';

// The platform's own reel channel — "HariHariBol". Created by
// scripts/seed-bg-verse-reels.js. The admin panel finds it by this address to
// preselect it as the creator of a new reel; nothing else depends on it.
const OFFICIAL_CREATOR_EMAIL = 'official@hariharibol.com';

// ── Language fallbacks ─────────────────────────────────────────────────────
const DEFAULT_LANGUAGE = 'en';
const SOURCE_LANGUAGE = 'sa';

// ── Sadhana ────────────────────────────────────────────────────────────────
const BEADS_PER_ROUND = 108;
const DEFAULT_ROUND_TARGET = 16;

// ── Pagination ─────────────────────────────────────────────────────────────
const PAGE_SIZE_DEFAULT = 20;
const PAGE_SIZE_MAX = 100;

// The reel feed is swiped, not paged through by number — 11 is enough to fill
// a first screen with a couple ahead of it, without pulling video/image media
// the reader may never reach.
const REEL_PAGE_SIZE_DEFAULT = 11;

// ── Reels ──────────────────────────────────────────────────────────────────

// Comments are read in a sheet over the video, so a page is sized to what fits
// in one without the reader having to fetch again to fill the screen.
const REEL_COMMENT_PAGE_SIZE = 20;

// Replies are collapsed under their parent and opened deliberately, so they
// come in smaller batches than top-level comments.
const REEL_REPLY_PAGE_SIZE = 10;

// Threads go exactly one level deep: replying to a reply attaches to the same
// parent. Instagram and YouTube both do this, and it is the difference between
// a comment list that renders in a fixed indent and one that needs a tree.
const REEL_MAX_COMMENT_DEPTH = 1;

const REEL_COMMENT_MAX_LENGTH = 1000;

// What counts as having watched a reel rather than swiped past it. The client
// reports progress; this is the line at which ReelView.completed flips.
const REEL_COMPLETION_RATIO = 0.9;

// A view is only counted once the reader has actually stayed with the reel.
// Without a floor, a fast swipe through fifty reels would register fifty
// views and make viewCount meaningless as a ranking signal.
const REEL_MIN_VIEW_MS = 3000;

// ── AppSetting keys ────────────────────────────────────────────────────────
// The settings the code actually reads. Listed so the admin panel can render
// them without a hardcoded copy of its own.
const SETTING_KEYS = {
  AI_PROVIDER: 'ai.provider',
  AI_MODEL_TEXT: 'ai.model.text',
  AI_MONTHLY_BUDGET_MICROS: 'ai.budget.monthly_micros',
  SLOKA_DELIVERY_HOUR: 'sloka.delivery.default_hour',
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
  SYSTEM_CREATOR_EMAIL,
  OFFICIAL_CREATOR_EMAIL,
  DEFAULT_LANGUAGE,
  SOURCE_LANGUAGE,
  BEADS_PER_ROUND,
  DEFAULT_ROUND_TARGET,
  PAGE_SIZE_DEFAULT,
  PAGE_SIZE_MAX,
  REEL_PAGE_SIZE_DEFAULT,
  REEL_COMMENT_PAGE_SIZE,
  REEL_REPLY_PAGE_SIZE,
  REEL_MAX_COMMENT_DEPTH,
  REEL_COMMENT_MAX_LENGTH,
  REEL_COMPLETION_RATIO,
  REEL_MIN_VIEW_MS,
  SETTING_KEYS,
  CACHE,
};
