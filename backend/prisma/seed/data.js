// The seed data.
//
// Kept apart from the seeding logic so the two are readable separately: this
// file is about *what* the platform starts with, index.js is about how it gets
// written.

const { ROLES, ROLE_PERMISSIONS, PERMISSIONS, SETTING_KEYS } = require('../../config/constants');

// ── Roles ──────────────────────────────────────────────────────────────────
// Marked isSystem so they cannot be deleted from the panel: removing the role
// every account points at is not a mistake worth leaving available.

const roles = [
  {
    slug: ROLES.USER,
    name: 'User',
    description: 'An ordinary account. What everyone gets on signup.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.USER],
  },
  {
    slug: ROLES.MODERATOR,
    name: 'Moderator',
    description: 'Edits verses and curates the daily sloka. Cannot touch users or money.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.MODERATOR],
  },
  {
    slug: ROLES.ADMIN,
    name: 'Admin',
    description: 'Everything except deleting accounts, changing roles, secrets and refunds.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.ADMIN],
  },
  {
    slug: ROLES.SUPER_ADMIN,
    name: 'Super admin',
    description: 'Everything, including permissions added in future.',
    isSystem: true,
    permissions: ROLE_PERMISSIONS[ROLES.SUPER_ADMIN],
  },
];

const permissions = Object.entries(PERMISSIONS).map(([slug, meta]) => ({
  slug,
  name: meta.name,
  group: meta.group,
}));

// ── Languages ──────────────────────────────────────────────────────────────
// The three flags decide which of a user's three choices a language may fill.
// Sanskrit is a mantra language and not an app language — nobody wants the
// settings screen in Sanskrit, and there are no Sanskrit meanings to read.

const languages = [
  { code: 'en', nativeName: 'English', englishName: 'English', displayOrder: 1 },
  { code: 'hi', nativeName: 'हिन्दी', englishName: 'Hindi', displayOrder: 2 },
  { code: 'mr', nativeName: 'मराठी', englishName: 'Marathi', displayOrder: 3 },
  {
    code: 'sa',
    nativeName: 'संस्कृतम्',
    englishName: 'Sanskrit',
    isAppLanguage: false,
    isReadingLanguage: false,
    displayOrder: 4,
  },
  { code: 'gu', nativeName: 'ગુજરાતી', englishName: 'Gujarati', displayOrder: 5 },
  { code: 'bn', nativeName: 'বাংলা', englishName: 'Bengali', displayOrder: 6 },
  { code: 'ta', nativeName: 'தமிழ்', englishName: 'Tamil', displayOrder: 7 },
  { code: 'te', nativeName: 'తెలుగు', englishName: 'Telugu', displayOrder: 8 },
  { code: 'kn', nativeName: 'ಕನ್ನಡ', englishName: 'Kannada', displayOrder: 9 },
  { code: 'or', nativeName: 'ଓଡ଼ିଆ', englishName: 'Odia', displayOrder: 10 },
];

// ── Issues ─────────────────────────────────────────────────────────────────
// The six vikaras, and the two practice difficulties the user named. A fixed
// list rather than free text, because these are what VerseIssue maps slokas to
// — free text would give the picker nothing to match against.

const issues = [
  {
    slug: 'kama',
    name: 'Kama',
    nameI18n: { hi: 'काम', mr: 'काम' },
    category: 'VIKARA',
    description: 'Lust, craving, wanting what will not satisfy.',
    displayOrder: 1,
  },
  {
    slug: 'krodha',
    name: 'Krodha',
    nameI18n: { hi: 'क्रोध', mr: 'क्रोध' },
    category: 'VIKARA',
    description: 'Anger, irritation, losing your temper.',
    displayOrder: 2,
  },
  {
    slug: 'lobha',
    name: 'Lobha',
    nameI18n: { hi: 'लोभ', mr: 'लोभ' },
    category: 'VIKARA',
    description: 'Greed, holding on, never having enough.',
    displayOrder: 3,
  },
  {
    slug: 'moha',
    name: 'Moha',
    nameI18n: { hi: 'मोह', mr: 'मोह' },
    category: 'VIKARA',
    description: 'Attachment and delusion, mistaking what is temporary for what lasts.',
    displayOrder: 4,
  },
  {
    slug: 'mada',
    name: 'Mada',
    nameI18n: { hi: 'मद', mr: 'मद' },
    category: 'VIKARA',
    description: 'Pride, arrogance, thinking yourself above others.',
    displayOrder: 5,
  },
  {
    slug: 'matsarya',
    name: 'Matsarya',
    nameI18n: { hi: 'मात्सर्य', mr: 'मत्सर' },
    category: 'VIKARA',
    description: 'Envy, resenting what someone else has been given.',
    displayOrder: 6,
  },
  {
    slug: 'missed-chanting-time',
    name: 'Could not chant on time',
    category: 'PRACTICE',
    description: 'The day gets away and the chanting time passes.',
    displayOrder: 7,
  },
  {
    slug: 'unmet-round-target',
    name: 'Could not finish my rounds',
    category: 'PRACTICE',
    description: 'Starting the rounds but not completing the target.',
    displayOrder: 8,
  },
];

// ── Deities ────────────────────────────────────────────────────────────────
// Vaishnav only for now. Every row carries `sampradaya` so other traditions can
// be added later without a migration that has to guess what these belong to.

const deities = [
  { slug: 'krishna', name: 'Krishna', nameI18n: { hi: 'कृष्ण', mr: 'कृष्ण' }, displayOrder: 1 },
  { slug: 'radha', name: 'Radha', nameI18n: { hi: 'राधा', mr: 'राधा' }, displayOrder: 2 },
  { slug: 'vishnu', name: 'Vishnu', nameI18n: { hi: 'विष्णु', mr: 'विष्णू' }, displayOrder: 3 },
  { slug: 'rama', name: 'Rama', nameI18n: { hi: 'राम', mr: 'राम' }, displayOrder: 4 },
  { slug: 'narasimha', name: 'Narasimha', nameI18n: { hi: 'नरसिंह' }, displayOrder: 5 },
  { slug: 'narayana', name: 'Narayana', nameI18n: { hi: 'नारायण' }, displayOrder: 6 },
  { slug: 'lakshmi', name: 'Lakshmi', nameI18n: { hi: 'लक्ष्मी' }, displayOrder: 7 },
  { slug: 'hanuman', name: 'Hanuman', nameI18n: { hi: 'हनुमान' }, displayOrder: 8 },
  { slug: 'jagannath', name: 'Jagannath', nameI18n: { hi: 'जगन्नाथ' }, displayOrder: 9 },
  { slug: 'vitthal', name: 'Vitthal', nameI18n: { mr: 'विठ्ठल', hi: 'विट्ठल' }, displayOrder: 10 },
];

// ── Gurus ──────────────────────────────────────────────────────────────────
// The Vaishnav parampara. Overlaps with translators by design: the same person
// can be both, but lineage and authorship are different things.

const gurus = [
  { slug: 'chaitanya-mahaprabhu', name: 'Sri Chaitanya Mahaprabhu', displayOrder: 1 },
  { slug: 'ramanujacharya', name: 'Sri Ramanujacharya', displayOrder: 2 },
  { slug: 'madhvacharya', name: 'Sri Madhvacharya', displayOrder: 3 },
  { slug: 'vallabhacharya', name: 'Sri Vallabhacharya', displayOrder: 4 },
  { slug: 'nimbarkacharya', name: 'Sri Nimbarkacharya', displayOrder: 5 },
  { slug: 'prabhupada', name: 'A. C. Bhaktivedanta Swami Prabhupada', displayOrder: 6 },
  { slug: 'dnyaneshwar', name: 'Sant Dnyaneshwar', displayOrder: 7 },
  { slug: 'tukaram', name: 'Sant Tukaram', displayOrder: 8 },
  { slug: 'namdev', name: 'Sant Namdev', displayOrder: 9 },
  { slug: 'eknath', name: 'Sant Eknath', displayOrder: 10 },
];

// ── Translators ────────────────────────────────────────────────────────────
// Devotional commentators only. No academic or non-devotee commentary is
// published on this platform — that rule is enforced by what gets seeded here
// and by who is added later, not by anything in the code.

const translators = [
  {
    slug: 'prabhupada',
    name: 'A. C. Bhaktivedanta Swami Prabhupada',
    bio: 'Founder-acharya of ISKCON. Bhagavad-gita As It Is and the Srimad-Bhagavatam.',
    displayOrder: 1,
  },
  {
    slug: 'ramanujacharya',
    name: 'Sri Ramanujacharya',
    bio: 'Sri Vaishnava acharya. The Gita Bhashya.',
    displayOrder: 2,
  },
  {
    slug: 'madhvacharya',
    name: 'Sri Madhvacharya',
    bio: 'Dvaita acharya. The Gita Bhashya and Gita Tatparya.',
    displayOrder: 3,
  },
  {
    slug: 'vishwanath-chakravarti',
    name: 'Srila Vishwanath Chakravarti Thakur',
    bio: 'Gaudiya Vaishnava acharya. The Sarartha Varshini commentary.',
    displayOrder: 4,
  },
  {
    slug: 'baladeva-vidyabhushana',
    name: 'Srila Baladeva Vidyabhushana',
    bio: 'Gaudiya Vaishnava acharya. The Gita Bhushana commentary.',
    displayOrder: 5,
  },
  {
    slug: 'sridhara-swami',
    name: 'Sridhara Swami',
    bio: 'The Subodhini commentary on the Srimad Bhagavatam.',
    displayOrder: 6,
  },
  {
    slug: 'dnyaneshwar',
    name: 'Sant Dnyaneshwar',
    bio: 'The Dnyaneshwari — the Gita in Marathi ovi, expanded rather than translated.',
    displayOrder: 7,
  },
];

// ── Books ──────────────────────────────────────────────────────────────────
// Seeded unpublished, purely to reserve the book numbers. Those numbers are the
// first segment of every verse id and are already baked into the scraped source
// files, so they must not be handed out to anything else. The verses themselves
// arrive through the import.

const books = [
  {
    bookNumber: 1,
    slug: 'bhagavad-gita',
    type: 'SCRIPTURE',
    title: 'Bhagavad Gita',
    titleI18n: { hi: 'भगवद्गीता', mr: 'भगवद्गीता' },
    description: 'The song of the Lord, spoken to Arjuna on the field of Kurukshetra.',
    displayOrder: 1,
  },
  {
    bookNumber: 2,
    slug: 'srimad-bhagavatam',
    type: 'SCRIPTURE',
    title: 'Srimad Bhagavatam',
    titleI18n: { hi: 'श्रीमद्भागवतम्', mr: 'श्रीमद्भागवत' },
    description: 'The Bhagavata Purana, in twelve cantos.',
    displayOrder: 2,
  },
];

// Srimad Bhagavatam is the only book in the library organised by canto.
const cantos = [
  'Creation',
  'The Cosmic Manifestation',
  'The Status Quo',
  'The Creation of the Fourth Order',
  'The Creative Impetus',
  'Prescribed Duties for Mankind',
  'The Science of God',
  'Withdrawal of the Cosmic Creations',
  'Liberation',
  'The Summum Bonum',
  'General History',
  'The Age of Deterioration',
].map((title, index) => ({ number: index + 1, title }));

// ── Subscription plan ──────────────────────────────────────────────────────
// One plan. Price in paise, never a float.

const plans = [
  {
    slug: 'premium-monthly',
    name: 'Premium',
    description:
      'Unlimited mood-driven slokas. Everything else in the app is free, and always will be.',
    priceMinor: 9900, // ₹99
    currency: 'INR',
    periodDays: 30,
    isActive: true,
  },
];

// ── Push topics ────────────────────────────────────────────────────────────

const topics = [
  {
    key: 'sloka-of-day',
    name: 'Sloka of the day',
    description: 'The global daily verse. One call to Firebase reaches everyone subscribed.',
  },
  {
    key: 'announcements',
    name: 'Announcements',
    description: 'Occasional news about the app.',
  },
];

// ── Settings ───────────────────────────────────────────────────────────────
// Only values that must change without a deploy. API keys are not seeded — they
// are entered from the panel and stored encrypted.

const settings = [
  { key: SETTING_KEYS.AI_PROVIDER, value: 'GEMINI' },
  { key: SETTING_KEYS.AI_MODEL_TEXT, value: 'gemini-2.0-flash' },
  // 0 means no cap. Set one before running a batch pass.
  { key: SETTING_KEYS.AI_MONTHLY_BUDGET_MICROS, value: '0' },
  { key: SETTING_KEYS.SLOKA_DELIVERY_HOUR, value: '6' },
  // Three free mood slokas a month before the paywall. Enough to feel what
  // Premium is for; gating it completely would mean most people never do.
  { key: SETTING_KEYS.FREE_MOOD_SLOKA_QUOTA, value: '3' },
  { key: SETTING_KEYS.SIGNUP_ENABLED, value: 'true' },
];

module.exports = {
  roles,
  permissions,
  languages,
  issues,
  deities,
  gurus,
  translators,
  books,
  cantos,
  plans,
  topics,
  settings,
};
