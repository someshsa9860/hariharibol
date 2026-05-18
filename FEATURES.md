# HariHariBol — Feature Status

Last updated: 2026-05-18 (Job 41 production readiness)

Legend: ✅ Implemented · 🔄 Partial / in-progress · ❌ Not started

---

## Authentication & Security

| Feature | Status | Notes |
|---|---|---|
| Google OAuth (mobile) | ✅ | `POST /api/v1/auth/google` |
| Apple Sign-In (mobile) | ✅ | `POST /api/v1/auth/apple` |
| Admin username/password login | ✅ | `POST /api/v1/auth/admin/login`, bcrypt |
| JWT access token (15-min expiry) | ✅ | HS256, verified by JwtGuard |
| Refresh token rotation | ✅ | Single-use; replay-protected |
| Refresh token stored in webapp | ✅ | Persisted in localStorage store |
| httpOnly cookie for admin panel | ✅ | `admin_token` cookie |
| `@Public()` decorator for open endpoints | ✅ | Reflector-based bypass |
| Device tracking & fingerprinting | ✅ | deviceId, OS, app version, FCM token |
| Email-level & device-level ban cascade | ✅ | Checked on every auth flow |
| Rate limiting on sensitive endpoints | ✅ | Throttler: login 10/min, refresh 3/min |
| Axios 401 interceptor with token refresh | ✅ | Queue-based, prevents duplicate refreshes |

---

## Content Modules — Backend

| Module | Endpoints | Status |
|---|---|---|
| Sampradayas | GET list, GET detail, POST/DELETE follow, GET me/followed | ✅ |
| Books | GET list, GET by ID/slug, GET chapters, GET cantos, GET chapter verses, GET verse by number | ✅ |
| Verses | GET list, GET by ID, GET random, GET narrations, POST toggle-favorite | ✅ |
| Verse of Day | GET today, GET history, admin CRUD (select, generate, generate-image, config) | ✅ |
| Mantras | GET list, GET by ID, admin CRUD | ✅ |
| Narrations | CRUD | ✅ |
| Groups | GET list, GET by ID, POST create, POST join/leave, GET members | ✅ |
| Messages | CRUD with group context | ✅ |
| Chanting logs | POST log, GET stats, GET history (week/month/all) | ✅ |
| Favorites | Toggle verse/mantra favorites | ✅ |
| Chatbot sessions | CRUD sessions, streaming SSE messages | ✅ |
| Recommendations | Personalized verse & mantra suggestions | ✅ |
| Bans | Admin ban/unban users | ✅ |
| Notifications | In-app, push (FCM topics), email stub | ✅ |
| Analytics | Metrics, user growth, engagement | ✅ |
| Admin panel API | Dashboard stats, moderation, settings | ✅ |

---

## Storage System

| Feature | Status |
|---|---|
| Factory pattern (S3 / local) | ✅ |
| Public / private folder separation | ✅ |
| Content-based paths (sampradayas/{id}, etc.) | ✅ |
| Image variant generation (sm/md/lg) | ✅ |
| WebP compression with per-size quality | ✅ |
| Centralized storage config | ✅ |

---

## AI Integration

| Feature | Status | Notes |
|---|---|---|
| AIProviderService wrapper | ✅ | Supports gemini + openai |
| Gemini text generation | ✅ | Verse selection, explanation |
| OpenAI GPT text generation | ✅ | Fallback |
| Gemini image generation (REST) | ✅ | With graceful fallback |
| DALL-E 3 image generation | ✅ | With graceful fallback |
| Content moderation (safety check) | ✅ | |
| GuruDev chatbot (AI responses) | ✅ | Streaming SSE |
| AppSettings persistence for AI config | ✅ | Encrypted API key storage |

---

## Notifications

| Feature | Status | Notes |
|---|---|---|
| FCM topic infrastructure | ✅ | verse-of-day, announcements, reminders |
| Topic subscribe / unsubscribe | ✅ | Per device, per topic |
| Batch FCM message sending | ✅ | 500-device chunk limit handled |
| User notification preferences | ✅ | `PATCH /api/v1/users/me/notification-preferences` |
| In-app notifications | ✅ | |
| Email notifications | 🔄 | Service stub; no real SMTP/provider wired |

---

## Admin Panel (Next.js)

| Feature | Status |
|---|---|
| Dashboard with key metrics | ✅ |
| Sampradaya management (CRUD + image upload) | ✅ |
| Books management | ✅ |
| Verses management | ✅ |
| Mantras management | ✅ |
| User management (list, ban, unban) | ✅ |
| Moderation queue (approve/reject) | ✅ |
| Verse of Day management (manual/AI/image) | ✅ |
| Analytics dashboard (charts, metrics) | ✅ |
| Settings (AI provider, API keys) | ✅ |
| Audit log view | 🔄 | Schema exists; UI placeholder only |
| Role-based access (SuperAdmin/Admin/Moderator) | ❌ | All admin users treated equally |

---

## Web App (Next.js — `webapp/`)

| Page / Feature | Route | Status |
|---|---|---|
| Login (Google OAuth) | `/login` | ✅ |
| Home feed (verse of day, sampradayas) | `/home` | ✅ |
| Book reader | `/books`, `/books/[id]`, `/books/[id]/[chapter]` | ✅ |
| Mantra library | `/mantras` | ✅ |
| Chanting tracker | `/chanting` | ✅ |
| Verse of Day | `/verse-of-day` | ✅ |
| GuruDev AI chat | `/gurudev` | ✅ |
| Sampradaya browser | `/sampradayas`, `/sampradayas/[id]` | ✅ |
| Groups | `/groups`, `/groups/[id]` | ✅ |
| Search | `/search` | ✅ |
| User profile | `/profile` | ✅ |
| Settings | `/settings` | ✅ |
| Axios 401 → refresh → retry | (api.ts) | ✅ |
| Dark mode | (global) | ✅ |
| Toast notifications | (global) | ✅ |

---

## Website (Next.js — `website/`)

| Page | Route | Status |
|---|---|---|
| Landing page | `/` | ✅ |
| Books browse | `/books`, `/books/[id]`, `/books/[id]/[chapter]` | ✅ |
| Sampradayas browse | `/sampradayas`, `/sampradayas/[id]` | ✅ |
| Verse of Day | `/verse-of-day` | ✅ |
| Mantras browse | `/mantras` | ✅ |
| Search | `/search` | ✅ |
| Login | `/login` | ✅ |

---

## Mobile App (Flutter)

| Feature | Status |
|---|---|
| Clean Architecture (domain/data/presentation) | ✅ |
| Riverpod state management | ✅ |
| Google sign-in with device tracking | ✅ |
| Apple sign-in | ✅ |
| Secure token storage (flutter_secure_storage) | ✅ |
| JWT refresh interceptor (Dio) | ✅ |
| Splash screen with auth check | ✅ |
| Home screen (verse of day, sampradayas, random verse) | ✅ |
| Verse detail screen | ✅ |
| Pull-to-refresh | ✅ |
| Design tokens (#C75A1A saffron, #FBF7EF cream) | ✅ |
| go_router navigation | ✅ |
| Offline caching (Hive) | 🔄 | Infrastructure ready; not all pages wired |
| Push notifications (FCM) | 🔄 | Firebase SDK added; topic subscribe not wired |
| Chanting tracker screen | ❌ | |
| Favorites screen | ❌ | |
| GuruDev chat screen | ❌ | |
| Groups screen | ❌ | |

---

## Infrastructure & DevOps

| Feature | Status |
|---|---|
| Docker Compose (Postgres, Redis, backend) | ✅ |
| Nginx reverse proxy config | ✅ |
| Redis caching layer (CacheService) | ✅ |
| Pagination service (safe 1–100 per page) | ✅ |
| Global ValidationPipe (whitelist, transform) | ✅ |
| HttpExceptionFilter (consistent error format) | ✅ |
| Helmet + CORS + compression middleware | ✅ |
| Swagger / OpenAPI docs (dev only) | ✅ |
| Prisma ORM + migration system | ✅ |
| WebSocket adapter (Socket.IO) | ✅ |
| Health endpoint | ✅ | `GET /health` — public, returns status/uptime |
| CI/CD pipeline | ❌ | |
| Database seeding scripts | ❌ | |

---

## Pending / Out-of-Scope Work

1. **Email SMTP integration** — stub in place; real provider (SendGrid / Resend / SES) not wired
2. **Admin RBAC full enforcement** — schema + guard scaffold exists; role-based route locks not wired
3. **Mobile chanting/favorites/groups screens** — not built (Flutter)
4. **Database seeding scripts** — no sample-data seed; `prisma/seed.ts` exists for admin user only
5. **CI/CD pipeline** — Docker Compose + Nginx ready; cloud CI config not created
6. **Google/Apple OAuth client IDs** — env-var driven; need real credentials configured per deployment
