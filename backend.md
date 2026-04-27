# Backend — Node.js API

> **Purpose:** Core API powering the mobile app and admin panel. Handles auth, content delivery, multi-language translation, AI chatbot orchestration, real-time group chat, and the device + email ban-cascade system.

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Runtime | Node.js 20 LTS | |
| Framework | **NestJS** (recommended) | Modular, opinionated, scales well; alternative: Express + custom structure |
| Language | TypeScript (strict mode) | Type safety across the codebase |
| Database | **MongoDB** (recommended) | Flexible for verses + translations; alternative: PostgreSQL with JSONB |
| ODM/ORM | Mongoose / Prisma | |
| Real-time | Socket.IO | Group chat |
| Auth | JWT (access + refresh) | Google + Apple ID token verification |
| Validation | Zod or class-validator | |
| AI Provider | TBD (Claude / OpenAI / Gemini) | For GuruDev chat + moderation |
| File Storage | AWS S3 / GCS | Audio, images, book exports |
| Cache | Redis | Sessions, rate limits, hot content |
| Queue | BullMQ (Redis) | Async jobs (moderation, notifications) |
| Email | Resend / SendGrid | Transactional only |
| Logging | Pino + structured logs | |
| Monitoring | Sentry | |
| Testing | Jest + Supertest | |

---

## Folder Structure

```
backend/
├── src/
│   ├── main.ts                      # App bootstrap
│   ├── app.module.ts                # Root module
│   │
│   ├── common/                      # Shared utilities
│   │   ├── decorators/              # @CurrentUser, @Public, @Roles
│   │   ├── filters/                 # Exception filters
│   │   ├── guards/                  # AuthGuard, RolesGuard
│   │   ├── interceptors/            # Logging, transform
│   │   ├── pipes/                   # Validation
│   │   └── utils/                   # Helpers
│   │
│   ├── config/                      # Env config + validation
│   │   ├── app.config.ts
│   │   ├── db.config.ts
│   │   ├── auth.config.ts
│   │   └── ai.config.ts
│   │
│   ├── modules/
│   │   ├── auth/                    # Google + Apple auth, JWT, refresh
│   │   ├── users/                   # Profile, preferences
│   │   ├── devices/                 # Device tracking
│   │   ├── sampradayas/             # Sampraday CRUD + follow
│   │   ├── books/                   # Books, chapters, verses
│   │   ├── verses/                  # Verse-of-the-day, by category, detail
│   │   ├── narrations/              # Saint commentaries
│   │   ├── mantras/                 # Public mantras per sampraday
│   │   ├── chanting/                # Chant logs, stats, streaks
│   │   ├── favorites/               # User favorites (verses, mantras)
│   │   ├── translations/            # i18n key system
│   │   ├── languages/               # Supported languages
│   │   ├── recommendations/         # Personalized verses + mantras
│   │   ├── groups/                  # Sampraday group chat
│   │   ├── messages/                # Group messages + moderation
│   │   ├── moderation/              # AI moderation pipeline
│   │   ├── bans/                    # Device + email ban cascade
│   │   ├── chatbot/                 # GuruDev AI chat
│   │   ├── notifications/           # Push notifications (FCM + APNs)
│   │   ├── admin/                   # Admin-only endpoints
│   │   └── analytics/               # Event tracking
│   │
│   ├── infrastructure/
│   │   ├── database/                # Mongoose connection, base schemas
│   │   ├── ai/                      # AI provider abstraction
│   │   ├── storage/                 # S3/GCS wrapper
│   │   ├── cache/                   # Redis wrapper
│   │   ├── queue/                   # BullMQ wrapper
│   │   └── push/                    # FCM + APNs wrapper
│   │
│   └── seeders/
│       ├── seed.ts                  # Master seeder runner
│       ├── languages.seeder.ts
│       ├── sampradayas.seeder.ts
│       ├── bhagavad-gita.seeder.ts
│       ├── srimad-bhagavatam.seeder.ts
│       ├── mantras.seeder.ts
│       ├── narrations.seeder.ts
│       └── data/                    # JSON source files
│           ├── bhagavad-gita.json
│           ├── srimad-bhagavatam.json
│           ├── sampradayas.json
│           └── mantras.json
│
├── test/                            # E2E tests
├── scripts/                         # Migration, backup, util scripts
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── docker-compose.yml               # Local dev: Mongo + Redis
├── Dockerfile
├── nest-cli.json
├── package.json
├── tsconfig.json
└── README.md
```

---

## Database Schema (MongoDB)

### `users`
```ts
{
  _id: ObjectId,
  email: string,                    // from Google/Apple
  email_verified: boolean,
  name: string,
  avatar_url: string,
  auth_provider: 'google' | 'apple',
  provider_user_id: string,         // sub from ID token
  language_preference: string,      // locale code, e.g. 'en', 'hi', 'gu'
  followed_sampradayas: ObjectId[], // -> sampradayas
  preferred_guru_signal: {          // for GuruDev personalization
    sampraday_affinity: { [sampraday_id: string]: number },
    deity_affinity: { [deity: string]: number },
    last_calculated: Date
  },
  is_banned: boolean,
  banned_reason?: string,
  banned_at?: Date,
  created_at: Date,
  updated_at: Date,
  last_active_at: Date
}
```

### `devices`
```ts
{
  _id: ObjectId,
  device_id: string,                // unique, persists across logout
  device_type: 'ios' | 'android',
  device_model: string,
  os_version: string,
  app_version: string,
  user_ids: ObjectId[],             // all users who logged in on this device
  push_tokens: { fcm?: string, apns?: string },
  is_banned: boolean,
  banned_reason?: string,
  banned_at?: Date,
  first_seen_at: Date,
  last_seen_at: Date
}
```

### `bans`
```ts
{
  _id: ObjectId,
  type: 'email' | 'device',
  value: string,                    // email address or device_id
  reason: string,
  cascaded_from?: ObjectId,         // -> bans (which ban triggered this)
  cascade_chain: ObjectId[],        // full ancestry
  triggered_by: 'ai' | 'admin',
  admin_id?: ObjectId,
  evidence_message_ids: ObjectId[], // messages that led to ban
  created_at: Date,
  is_active: boolean,
  unbanned_at?: Date,
  unbanned_by?: ObjectId,
  unban_reason?: string
}
```

### `sampradayas`
```ts
{
  _id: ObjectId,
  slug: string,                     // 'gaudiya-vaishnavism'
  name_key: string,                 // -> translations
  description_key: string,          // -> translations (long form)
  short_description_key: string,
  founder_key: string,
  founder_image_url: string,
  primary_deity_key: string,
  primary_deity_image_url: string,
  philosophy_key: string,
  key_disciples: [{
    name_key: string,
    description_key: string,
    image_url?: string
  }],
  hero_image_url: string,
  thumbnail_url: string,
  category_keys: string[],          // 'vaishnav', 'shaiv', 'shakta', 'smarta', etc.
  founding_year?: number,
  region_key?: string,
  is_published: boolean,
  display_order: number,
  follower_count: number,           // denormalized
  created_at: Date,
  updated_at: Date
}
```

### `books`
```ts
{
  _id: ObjectId,
  slug: string,                     // 'bhagavad-gita'
  title_key: string,
  description_key: string,
  cover_image_url: string,
  author_key: string,               // 'Vyasa' etc.
  total_chapters: number,
  total_verses: number,
  display_order: number,
  is_published: boolean
}
```

### `chapters`
```ts
{
  _id: ObjectId,
  book_id: ObjectId,
  number: number,                   // 1, 2, 3...
  title_key: string,
  summary_key: string,
  total_verses: number
}
```

### `verses`
```ts
{
  _id: ObjectId,
  book_id: ObjectId,
  chapter_id: ObjectId,
  chapter_number: number,
  verse_number: number,
  sanskrit: string,                 // original devanagari (not translated)
  transliteration: string,          // IAST or Harvard-Kyoto
  word_meanings: [{                 // optional, per-word breakdown
    word: string,
    meaning_key: string
  }],
  translation_key: string,          // primary translation
  category_keys: string[],          // 'devotion', 'knowledge', 'surrender'
  related_sampraday_ids: ObjectId[],
  related_deity_keys: string[],
  audio_url?: string,               // recitation
  is_verse_of_day_eligible: boolean
}
```

### `narrations`
```ts
{
  _id: ObjectId,
  verse_id: ObjectId,
  saint_name_key: string,           // 'Adi Shankaracharya'
  saint_image_url?: string,
  source_key: string,               // 'Gita Bhashya', 'Sri Bhashya'
  source_year?: number,
  narration_key: string,            // -> translations (long-form)
  sampraday_id?: ObjectId,
  display_order: number,
  is_published: boolean
}
```

### `mantras`
```ts
{
  _id: ObjectId,
  sampraday_id: ObjectId,
  name_key: string,
  sanskrit: string,
  transliteration: string,
  meaning_key: string,
  significance_key: string,
  audio_url?: string,
  is_public: boolean,               // false = private to initiated only
  recommended_count?: number,       // suggested daily count, e.g. 108
  category: 'mahamantra' | 'beej' | 'stotra' | 'name' | 'other',
  related_deity_key: string,
  display_order: number
}
```

### `translations`
```ts
{
  _id: ObjectId,
  key: string,                      // unique, e.g. 'sampraday.gaudiya.name'
  namespace: 'ui' | 'content',
  translations: {
    [locale: string]: {             // 'en', 'hi', 'gu', 'mr', 'sa'
      text: string,
      status: 'draft' | 'review' | 'approved',
      translated_by?: ObjectId,
      reviewed_by?: ObjectId,
      updated_at: Date
    }
  }
}
```

### `languages`
```ts
{
  _id: ObjectId,
  code: string,                     // 'en', 'hi', 'gu'
  name_native: string,              // 'हिन्दी'
  name_english: string,             // 'Hindi'
  is_rtl: boolean,
  is_active: boolean,
  display_order: number,
  fallback_code?: string            // defaults to 'en'
}
```

### `chant_logs`
```ts
{
  _id: ObjectId,
  user_id: ObjectId,
  mantra_id: ObjectId,
  count: number,                    // chants in this session
  duration_seconds?: number,
  date: Date,                       // truncated to day for stats
  created_at: Date
}
```

### `favorites`
```ts
{
  _id: ObjectId,
  user_id: ObjectId,
  type: 'verse' | 'mantra' | 'narration',
  target_id: ObjectId,
  created_at: Date
}
// Index: { user_id: 1, type: 1, target_id: 1 } unique
```

### `follows`
```ts
{
  _id: ObjectId,
  user_id: ObjectId,
  sampraday_id: ObjectId,
  created_at: Date
}
// Index: { user_id: 1, sampraday_id: 1 } unique
```

### `groups`
```ts
{
  _id: ObjectId,
  sampraday_id: ObjectId,
  name_key: string,
  description_key: string,
  member_count: number,             // denormalized
  is_active: boolean,
  created_at: Date
}
```

### `group_members`
```ts
{
  _id: ObjectId,
  group_id: ObjectId,
  user_id: ObjectId,
  role: 'member' | 'moderator' | 'admin',
  joined_at: Date,
  last_read_at: Date
}
```

### `messages`
```ts
{
  _id: ObjectId,
  group_id: ObjectId,
  user_id: ObjectId,
  content: string,
  status: 'pending' | 'approved' | 'hidden',
  moderation: {
    ai_verdict: 'safe' | 'disrespectful' | 'spam' | 'off_topic',
    ai_confidence: number,
    ai_reason?: string,
    reviewed_by_admin?: ObjectId,
    reviewed_at?: Date
  },
  hidden_reason?: string,
  created_at: Date
}
```

### `chatbot_sessions`
```ts
{
  _id: ObjectId,
  user_id: ObjectId,
  title: string,                    // auto-generated from first message
  guru_persona_used: string,        // detected affinity at session start
  message_count: number,
  created_at: Date,
  updated_at: Date
}
```

### `chatbot_messages`
```ts
{
  _id: ObjectId,
  session_id: ObjectId,
  role: 'user' | 'assistant',
  content: string,
  citations: [{                     // verses referenced by AI
    verse_id: ObjectId,
    excerpt: string
  }],
  tokens_used?: number,
  created_at: Date
}
```

---

## API Surface (REST)

All endpoints prefixed with `/api/v1`. All return JSON. All authenticated endpoints require `Authorization: Bearer <jwt>` and `X-Device-ID` header.

### Auth (`/auth`)
- `POST /auth/google` — Body: `{ id_token, device_info }` → returns `{ access_token, refresh_token, user }`
- `POST /auth/apple` — Body: `{ id_token, device_info }` → same as above
- `POST /auth/refresh` — Body: `{ refresh_token }` → new access token
- `POST /auth/logout` — Invalidates refresh token (device record stays)
- `DELETE /auth/account` — Permanent account deletion (DPDP compliance)

### Users (`/users`)
- `GET /users/me` — Current user profile
- `PATCH /users/me` — Update profile (name, avatar, language_preference)
- `GET /users/me/stats` — Chant stats, favorites count, etc.

### Languages (`/languages`)
- `GET /languages` — All active languages

### Translations (`/translations`)
- `GET /translations/:locale` — All UI strings for a locale (cached aggressively)
- `GET /translations/:locale/content` — Content translations for a locale
- `GET /translations/:locale/keys?keys=key1,key2` — Bulk fetch specific keys

### Sampradayas (`/sampradayas`)
- `GET /sampradayas?lang=en` — List all (with localized fields)
- `GET /sampradayas/:slug?lang=en` — Detail
- `GET /sampradayas/:id/mantras?lang=en` — Public mantras of sampraday
- `POST /sampradayas/:id/follow` — Follow
- `DELETE /sampradayas/:id/follow` — Unfollow
- `GET /sampradayas/me/followed` — User's followed sampradayas

### Books (`/books`)
- `GET /books?lang=en` — All books
- `GET /books/:slug?lang=en` — Book detail with chapters
- `GET /books/:slug/chapters/:number?lang=en` — Chapter with verse list
- `GET /books/:slug/chapters/:number/verses/:verseNumber?lang=en` — Single verse with narrations

### Verses (`/verses`)
- `GET /verses/of-the-day?lang=en` — Verse of the day (deterministic per day)
- `GET /verses/random?lang=en&category=devotion` — Random verse by category
- `GET /verses/categories?lang=en` — All categories
- `GET /verses/:id?lang=en` — Verse detail with narrations
- `GET /verses/:id/narrations?lang=en` — Narrations only

### Mantras (`/mantras`)
- `GET /mantras?lang=en&sampraday_id=xxx` — Filter by sampraday
- `GET /mantras/:id?lang=en` — Detail

### Chanting (`/chanting`)
- `POST /chanting/log` — Body: `{ mantra_id, count, duration_seconds? }`
- `GET /chanting/stats?range=daily|weekly|monthly` — Stats
- `GET /chanting/history?page=1&limit=20` — Recent logs
- `GET /chanting/streaks` — Current + longest streak

### Favorites (`/favorites`)
- `POST /favorites` — Body: `{ type, target_id }`
- `DELETE /favorites/:id`
- `GET /favorites?type=verse&page=1` — User's favorites

### Recommendations (`/recommendations`)
- `GET /recommendations/home?lang=en` — Personalized home feed (verses, mantras, narrations)

### Groups (`/groups`)
- `GET /groups/me` — User's joined groups (one per followed sampraday)
- `GET /groups/:id?lang=en` — Group detail
- `GET /groups/:id/messages?before=<message_id>&limit=50` — Paginated messages (only `approved`)
- `POST /groups/:id/messages` — Body: `{ content }` → triggers moderation pipeline
- `POST /groups/:id/join`
- `POST /groups/:id/leave`
- `POST /groups/:id/messages/:messageId/report` — User reports a message

### GuruDev Chatbot (`/chatbot`)
- `GET /chatbot/sessions?page=1` — User's chat sessions
- `POST /chatbot/sessions` — New session
- `GET /chatbot/sessions/:id` — Session with messages
- `POST /chatbot/sessions/:id/messages` — Body: `{ content }` → SSE stream of assistant response
- `DELETE /chatbot/sessions/:id`
- `GET /chatbot/suggested-prompts?lang=en` — Personalized starter prompts

### Admin (`/admin/*`) — separate auth, role-based
- `GET /admin/dashboard/stats`
- `GET /admin/users?search=...`
- `POST /admin/users/:id/ban`
- `POST /admin/users/:id/unban`
- `GET /admin/bans?page=1`
- `GET /admin/bans/:id/cascade-tree`
- `GET /admin/moderation/queue` — Hidden messages awaiting review
- `POST /admin/moderation/messages/:id/approve`
- `POST /admin/moderation/messages/:id/confirm-hide`
- Full CRUD for sampradayas, books, chapters, verses, narrations, mantras, translations
- `GET /admin/audit-logs`

### WebSocket (`/socket`)
- Namespace: `/groups`
- Events:
  - `join_group` (client → server) `{ group_id }`
  - `leave_group` (client → server)
  - `new_message` (server → client) `{ message }` (after moderation passes)
  - `message_hidden` (server → client) `{ message_id, reason }` (only sender sees this)
  - `typing` (bi-directional)

---

## Critical Subsystems

### 1. Ban Cascade System

**Trigger paths:**
1. AI moderation flags 3 messages from a user → auto-ban that user's email
2. Admin manually bans an email or device

**Cascade logic on email ban:**
```
banEmail(email):
  1. Mark user.is_banned = true, hide all their messages
  2. Find all devices where user has logged in (devices.user_ids contains user._id)
  3. For each such device:
     - Mark device.is_banned = true
     - Find all OTHER user_ids on that device
     - For each other user, recursively banEmail() unless already banned
     - Stop recursion when no new entities are added
  4. Record full cascade chain in `bans.cascade_chain`
```

**Cascade logic on device ban:**
```
banDevice(device_id):
  1. Mark device.is_banned = true
  2. Find all user_ids on that device
  3. For each user, banEmail() (which will then check other devices)
```

**Login enforcement:**
- Every auth request checks: is email banned? is device banned? → reject with 403

**Important:** Cascade must be wrapped in DB transaction or marked atomic to prevent partial state.

### 2. AI Moderation Pipeline

```
User sends message → POST /groups/:id/messages
  ↓
Save message with status='pending'
  ↓
Queue moderation job (BullMQ)
  ↓
Worker calls AI: "Is this message respectful within Sanatan Dharma context?"
  - System prompt includes community guidelines
  - Returns: { verdict, confidence, reason }
  ↓
If verdict=safe (confidence > 0.85):
  - Update message.status='approved'
  - Broadcast via WebSocket
If verdict=disrespectful/spam:
  - Update message.status='hidden'
  - Increment user.strikes
  - If strikes >= 3 → trigger ban cascade
  - Notify only the sender (not the group)
If confidence < threshold:
  - Send to admin moderation queue
```

### 3. GuruDev Personalization

**Affinity calculation (runs nightly + on demand):**
- Each favorited verse contributes points to: its `related_sampraday_ids` and `related_deity_keys`
- Each chant log contributes points to: mantra's `sampraday_id` and `related_deity_key`
- Each followed sampraday contributes a strong fixed score
- Weighted recency: recent activity counts more
- Result stored in `user.preferred_guru_signal`

**At chat time:**
- Top affinity sampraday determines GuruDev "persona"
- System prompt includes that sampraday's teaching tradition, key acharyas to reference
- RAG retrieval prioritizes verses + narrations from that tradition
- Display name uses sampraday's reverent term ("Acharya", "Maharaj", "Swamiji", etc.) without naming a specific living person

### 4. i18n Translation Lookup

**On any content endpoint with `?lang=xx`:**
1. Load entity (e.g. sampraday) which contains `*_key` fields
2. Collect all keys
3. Single batch fetch from `translations` collection: `find({ key: { $in: keys } })`
4. Map each key → translation for requested locale (fallback to `en` if missing)
5. Return entity with resolved strings (keys replaced with text)

**Caching:** Redis cache per-locale-per-entity-version, invalidated on translation update.

---

## Seeding Strategy

**Run order matters.** Single command: `npm run seed`

1. `languages` — en, hi, gu, mr, sa (initial set)
2. `translations` — UI strings (from a master JSON file managed in repo)
3. `sampradayas` — major Vaishnav, Shaiv, Shakta, Smarta, Datta, etc. with full content
4. `books` — Bhagavad Gita, Srimad Bhagavatam metadata
5. `chapters` — for each book
6. `verses` — full verse import from JSON sources
7. `narrations` — saint commentaries, attributed
8. `mantras` — public mantras tagged by sampraday
9. `categories` — verse categories with translations

**Idempotency:** Each seeder uses `upsert` by slug/key, safe to re-run.

**Source data validation:** Every JSON seed file passes through Zod schema validation before insert.

---

## Security Checklist

- [ ] All inputs validated with Zod (no manual validation)
- [ ] Helmet.js security headers
- [ ] CORS allowlist (admin panel domain + mobile app schemes)
- [ ] Rate limiting per IP + per user (`@nestjs/throttler`)
- [ ] AI chatbot: per-user daily limit + per-minute limit
- [ ] JWT secrets in env, rotated quarterly
- [ ] Refresh tokens stored hashed in DB
- [ ] Apple/Google ID tokens verified with their public keys (don't trust client)
- [ ] No PII in logs
- [ ] DB user has minimum required permissions
- [ ] All admin actions logged in audit trail
- [ ] Soft delete for content (never hard delete published verses/narrations)
- [ ] Backups: automated daily, encrypted, 30-day retention

---

## Task List (Priority Order)

### 🔴 P0 — Foundation
1. Initialize NestJS project with TypeScript strict mode
2. Set up folder structure as above
3. Configure ESLint + Prettier + Husky pre-commit hooks
4. Create `.env.example` with all required variables documented
5. Set up `docker-compose.yml` with MongoDB + Redis for local dev
6. Configure Pino logger with request ID tracing
7. Set up Sentry error reporting
8. Configure config module with Zod env validation (fail fast on missing vars)
9. Set up base exception filter + response transform interceptor
10. Health check endpoint (`/health`) with DB + Redis ping

### 🔴 P0 — Database Foundation
11. Mongoose connection module with retry logic
12. Define base schema with timestamps + soft-delete plugin
13. Create all schemas (users, devices, sampradayas, books, chapters, verses, narrations, mantras, translations, languages, follows, favorites, chant_logs, groups, group_members, messages, bans, chatbot_sessions, chatbot_messages)
14. Add all indexes (compound indexes on hot queries)
15. Migration framework setup (migrate-mongo or custom)

### 🔴 P0 — Auth Module
16. Google ID token verification (using `google-auth-library`)
17. Apple ID token verification (using `apple-signin-auth`)
18. JWT service (sign access + refresh tokens)
19. Refresh token storage (hashed in DB) + rotation
20. AuthGuard + Public decorator
21. CurrentUser decorator
22. `POST /auth/google` endpoint
23. `POST /auth/apple` endpoint
24. `POST /auth/refresh` endpoint
25. `POST /auth/logout` endpoint
26. `DELETE /auth/account` endpoint (account deletion)

### 🔴 P0 — Device Tracking
27. Device middleware that extracts `X-Device-ID` header
28. Device upsert on every authenticated request (update last_seen_at)
29. Link user to device on login (add to user_ids array if new)
30. Device ban check in AuthGuard

### 🔴 P0 — i18n System
31. Translation schema + service
32. `GET /translations/:locale` endpoint with Redis caching
33. Translation resolver utility (entity + keys → resolved entity)
34. Fallback to default locale logic
35. Translation cache invalidation on update

### 🔴 P0 — Content Modules (CRUD + read endpoints)
36. Languages module + endpoints
37. Sampradayas module + endpoints (list, detail, follow, unfollow)
38. Books module + endpoints
39. Chapters module + endpoints
40. Verses module + endpoints (verse-of-the-day, random by category, detail)
41. Narrations module + endpoints
42. Mantras module + endpoints
43. Verse categories module
44. Favorites module + endpoints

### 🔴 P0 — Chanting
45. Chanting log endpoint
46. Stats aggregation (daily/weekly/monthly)
47. Streak calculation logic
48. History pagination

### 🔴 P0 — Recommendations
49. Affinity calculation service (sampraday + deity scoring)
50. Personalized home feed endpoint (verses + mantras + narrations from followed sampradayas + affinity)

### 🔴 P0 — Seeders
51. Seeder runner with order management
52. Languages seeder
53. UI translations seeder (from master JSON)
54. Sampradayas seeder with rich content for each major sampraday
55. Bhagavad Gita seeder (all 700 verses with multi-language translations)
56. Srimad Bhagavatam seeder (all 12 cantos)
57. Mantras seeder
58. Narrations seeder (verified saint commentaries with citations)
59. Categories seeder

### 🔴 P0 — Ban Cascade
60. Bans schema + service
61. Email ban function
62. Device ban function
63. Recursive cascade with cycle detection
64. Ban check in AuthGuard
65. Audit log for every ban action
66. Admin endpoints to view + manage bans
67. Comprehensive unit tests for cascade logic

### 🟠 P1 — Group Chat
68. Groups + group_members modules
69. Auto-join group when following sampraday (or join button)
70. Messages module
71. `POST /groups/:id/messages` endpoint (saves as pending, queues moderation)
72. Socket.IO gateway for `/groups` namespace
73. Real-time broadcast of approved messages
74. Hidden message notification to sender only
75. Message pagination endpoint

### 🟠 P1 — AI Moderation
76. AI provider abstraction (interface for Claude/OpenAI/Gemini)
77. Moderation prompt + community guidelines
78. BullMQ moderation queue + worker
79. Strike tracking on user
80. Auto-ban trigger on threshold
81. Admin override (approve hidden message)
82. Moderation accuracy logging (for tuning)

### 🟠 P1 — GuruDev Chatbot
83. Chatbot sessions + messages schemas
84. AI provider call wrapper (with retries, timeouts, token tracking)
85. RAG: vector search or keyword search over verses + narrations
86. Persona system prompt builder (uses user's affinity)
87. SSE streaming response endpoint
88. Per-user rate limiter
89. Citation extraction from AI response → link to verses
90. Suggested prompts endpoint (personalized)
91. Session management endpoints

### 🟠 P1 — Notifications
92. FCM integration
93. APNs integration
94. Push token registration endpoint
95. Notification dispatch service
96. Verse-of-the-day daily push (scheduled job)

### 🟠 P1 — Admin API
97. Admin auth (separate from user auth, with 2FA)
98. Roles + permissions (super-admin, content-editor, moderator)
99. Dashboard stats endpoint
100. User management endpoints
101. Content CRUD endpoints (sampraday, book, verse, narration, mantra)
102. Translation management endpoints (with workflow status)
103. Moderation queue endpoints
104. Audit log endpoint

### 🟠 P1 — Infrastructure
105. Redis cache module
106. S3/GCS storage module (signed URLs for uploads)
107. BullMQ queue module
108. Backup script (daily mongodump → S3)

### 🟡 P2 — Quality & Performance
109. Comprehensive unit tests (services, ban cascade especially)
110. Integration tests for auth flow + content endpoints
111. Load testing with k6 or Artillery
112. Database query profiling + index tuning
113. Response caching layer for hot content
114. CDN for static assets

### 🟡 P2 — Future
115. Vector database for better RAG (Pinecone/Weaviate)
116. Webhook system for third-party integrations
117. Public read-only API (rate-limited) for the open-source community
118. GraphQL gateway (optional, alongside REST)

---

## Environment Variables (`.env.example`)

```bash
# App
NODE_ENV=development
PORT=3000
APP_URL=http://localhost:3000

# Database
MONGODB_URI=mongodb://localhost:27017/sanatan
REDIS_URL=redis://localhost:6379

# Auth
JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=30d

# Google
GOOGLE_CLIENT_ID_IOS=
GOOGLE_CLIENT_ID_ANDROID=
GOOGLE_CLIENT_ID_WEB=

# Apple
APPLE_CLIENT_ID=
APPLE_TEAM_ID=
APPLE_KEY_ID=
APPLE_PRIVATE_KEY=

# AI Provider
AI_PROVIDER=claude  # or openai, gemini
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GEMINI_API_KEY=

# Storage
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
S3_BUCKET=
S3_REGION=

# Push Notifications
FCM_SERVER_KEY=
APNS_KEY_ID=
APNS_TEAM_ID=
APNS_PRIVATE_KEY=

# Monitoring
SENTRY_DSN=

# Admin
ADMIN_PANEL_URL=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001
```

---

*Document version: 1.0 — Last updated: April 27, 2026*
