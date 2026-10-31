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
  BOOK_AUDITOR: 'book_auditor',
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
  // Held by the book auditor alone — see ROLE_PERMISSIONS.
  'book.audit': { group: 'content', name: 'Correct a book’s text in the reader (Sanskrit, translations, purports)' },
  'mantra.read': { group: 'content', name: 'View mantras' },
  'mantra.write': { group: 'content', name: 'Create and edit mantras' },
  'mantra.publish': { group: 'content', name: 'Publish mantras' },
  'mantra.delete': { group: 'content', name: 'Delete mantras' },
  'translator.manage': { group: 'content', name: 'Manage translators' },
  'reference.manage': { group: 'content', name: 'Manage deities, gurus, languages, issues' },
  'sloka.manage': { group: 'content', name: 'Curate the daily sloka' },
  'panchang.manage': { group: 'content', name: 'Edit the Hindu calendar and festivals' },
  'panchang.translate': { group: 'content', name: 'Start, resume and cancel Hindu calendar translation runs, and edit its translations' },
  'media.upload': { group: 'content', name: 'Upload media to S3' },
  'reelTemplate.read': { group: 'content', name: 'View reel templates' },
  'reelTemplate.write': { group: 'content', name: 'Create and edit reel templates' },
  'reelTemplate.delete': { group: 'content', name: 'Delete reel templates' },
  'reel.read': { group: 'content', name: 'View reels' },
  'reel.write': { group: 'content', name: 'Create and edit reels' },
  'reel.publish': { group: 'content', name: 'Publish and unpublish reels' },
  'reel.generate': { group: 'content', name: 'Generate reels from scripture verses' },
  'reel.delete': { group: 'content', name: 'Delete reels' },
  'translation.read': { group: 'content', name: 'View Claude translation runs and their output' },
  'translation.run': { group: 'content', name: 'Start, resume and cancel Claude translation runs' },
  'scenes.read': { group: 'content', name: 'View AI reel scene prompts and their runs' },
  'scenes.run': { group: 'content', name: 'Start, resume and cancel AI reel scene prompt runs' },
  'narration.read': { group: 'content', name: 'View AI narration runs, voice comparisons and clips' },
  'narration.run': { group: 'content', name: 'Start, resume and cancel AI narration runs and voice comparisons' },
  'translation.import': { group: 'content', name: 'Import Claude translations from storage into the database' },
  'etiquette.manage': { group: 'content', name: 'View and edit devotee etiquette, and set one aside' },
  'etiquette.translate': { group: 'content', name: 'Start, resume and cancel devotee etiquette translation runs' },
  'quote.manage': { group: 'content', name: 'View and edit the quotes shown while chanting, and set one aside' },
  'quote.translate': { group: 'content', name: 'Start, resume and cancel quote translation runs' },

  // marketing — `send` reaches real people and spends money, so the admin role does not carry it by default
  'marketing.read': { group: 'marketing', name: 'See campaigns, templates, lists and their results' },
  'marketing.manage': { group: 'marketing', name: 'Write templates, build lists and segments, import contacts and draft campaigns' },
  'marketing.send': { group: 'marketing', name: 'Start, pause and cancel campaigns that reach people, and send test messages (super admin only)' },

  // users
  'user.read': { group: 'users', name: 'View users' },
  'user.write': { group: 'users', name: 'Edit users' },
  'user.ban': { group: 'users', name: 'Ban and unban users and devices' },
  'user.delete': { group: 'users', name: 'Delete users' },
  'role.manage': { group: 'users', name: 'Manage roles and permissions' },
  'creator.manage': { group: 'users', name: 'Add, approve, edit and remove creators' },
  'notification.send': { group: 'users', name: 'Send broadcasts' },

  // system
  'payment.read': { group: 'system', name: 'View payments and subscriptions' },
  'payment.refund': { group: 'system', name: 'Refund payments' },
  'plan.manage': { group: 'system', name: 'Manage subscription plans' },
  'setting.read': { group: 'system', name: 'View app settings' },
  'setting.write': { group: 'system', name: 'Change app settings' },
  'ai.read': { group: 'system', name: 'View AI usage and spend' },
  'ai.run': { group: 'system', name: 'Trigger AI batch jobs' },
  'chat.manage': { group: 'system', name: 'Edit Ask Sakha’s persona, limits and plan allowances; grant credits' },
  'audit.read': { group: 'system', name: 'View the audit log' },
  'job.manage': { group: 'system', name: 'Inspect and retry background jobs' },
  'system.read': { group: 'system', name: 'View server health, storage and analytics' },
  'finance.manage': { group: 'system', name: 'View revenue, AI cost and the books; add credit and debit entries (super admin only)' },
  'support.manage': { group: 'users', name: 'View and reply to support tickets and feedback' },
  'dev.access': { group: 'system', name: 'Sign in to the developer companion app (live feed, alerts, chat with readers)' },
  'system.maintenance': { group: 'system', name: 'Run the listed maintenance scripts (seed and similar) from the panel' },
};

const ALL_PERMISSIONS = Object.keys(PERMISSIONS);
const AUDITOR_ONLY = ['book.audit'];

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
    'panchang.manage',
    'user.read',
    'media.upload',
  ],
  [ROLES.ADMIN]: ALL_PERMISSIONS.filter(
    (slug) => !['user.delete', 'role.manage', 'setting.write', 'payment.refund', 'system.maintenance', 'finance.manage', 'dev.access', 'marketing.send', ...AUDITOR_ONLY].includes(slug)
  ),
  // Everything, including permissions added later — except the auditor-only ones: a book's
  // text is corrected by one named role so every correction has one accountable hand.
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS.filter((slug) => !AUDITOR_ONLY.includes(slug)),
  [ROLES.BOOK_AUDITOR]: ['book.read', 'verse.read', 'book.audit'],
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

// What speech recognition heard while someone chanted is bulky and only worth
// having while the sitting is fresh, so it is stamped to expire on write and
// swept nightly (see jobs/processors/maintenance.js).
const CHANT_TRANSCRIPT_TTL_DAYS = 7;

// How many separate days someone must chant a tradition's mantras before we
// call them a follower of it — and before a different tradition takes over from
// the one they had. Days, not rounds: one long sitting is not a habit.
const SAMPRADAYA_MIN_DAYS = 3;

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
  // OpenAI's free daily tokens for shared traffic — see services/ai/free-tier.js.
  AI_FREE_TIER_ENABLED: 'ai.free_tier.enabled',
  AI_FREE_TIER_TEXT_MODEL: 'ai.free_tier.text_model',
  // The daily bonus every reader gets while the free tier is on — its pool, and the most one reader can be given.
  AI_FREE_TIER_BONUS_POOL: 'ai.free_tier.bonus_pool',
  AI_FREE_TIER_BONUS_MAX_USER: 'ai.free_tier.bonus_max_per_user',
  SLOKA_DELIVERY_TIME: 'sloka.delivery.time',
  ETIQUETTE_DELIVERY_TIME: 'etiquette.delivery.time',
  SIGNUP_ENABLED: 'auth.signup.enabled',
  BOOK_CACHE_VERSION: 'book.cache_version',
  // AI chat — see config/chat.js for the defaults each falls back to.
  CHAT_SYSTEM_PROMPT: 'chat.system_prompt',
  CHAT_DESCRIPTION: 'chat.description',
  CHAT_LIMITS: 'chat.limits',
  // How book reels (verses drawn as pages) look and which buttons they show — see config/book-reel.js.
  BOOK_REEL_STYLE: 'reels.book_style',
  // Rupees per US dollar, used to put AI spend (billed in dollars) into the books in INR — see services/finance.js.
  FINANCE_USD_INR_RATE: 'finance.usd_inr_rate',
  // Marketing — see config/marketing.js for the limits that are not settings.
  MARKETING_EMAIL_RATE_PER_MINUTE: 'marketing.email.rate_per_minute',
  MARKETING_EMAIL_DAILY_CAP: 'marketing.email.daily_cap',
  MARKETING_WEEKLY_CAP: 'marketing.weekly_cap',
  MARKETING_FROM_NAME: 'marketing.from_name',
  MARKETING_REPLY_TO: 'marketing.reply_to',
  MARKETING_POSTAL_ADDRESS: 'marketing.postal_address',
  MARKETING_AI_MAX_COST_USD: 'marketing.ai.max_cost_usd',
  MARKETING_WHATSAPP_RATE_PER_SECOND: 'marketing.whatsapp.rate_per_second',
  MARKETING_WHATSAPP_COST_PER_MESSAGE: 'marketing.whatsapp.cost_per_message',
};

// When the daily sloka is pushed, in each reader's own timezone, if the
// `sloka.delivery.time` setting is missing or unreadable. "04:30" is the quiet
// hour before sunrise, when a day of practice starts.
const SLOKA_DEFAULT_DELIVERY_TIME = '04:30';

// The same for the day's devotee etiquette (`etiquette.delivery.time`): a quarter past seven, once the morning
// worship has begun and before the day's work.
const ETIQUETTE_DEFAULT_DELIVERY_TIME = '07:15';

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
  CHANT_TRANSCRIPT_TTL_DAYS,
  SAMPRADAYA_MIN_DAYS,
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
  SLOKA_DEFAULT_DELIVERY_TIME,
  ETIQUETTE_DEFAULT_DELIVERY_TIME,
  CACHE,
};
