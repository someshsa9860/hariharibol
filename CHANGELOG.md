# Changelog

All notable changes to HariHariBol are documented here.

---

## [1.0.0] - 2026-05-18

### Added (Jobs 1–41)

#### Foundation & Infrastructure
- **Job 1** — Initial repository scaffold: NestJS backend, Next.js admin panel, Flutter mobile app, Next.js webapp & website skeleton
- **Job 2** — Prisma schema (532+ lines): all models, relationships, indexes, and migration system
- **Job 3** — JWT authentication: Google OAuth, Apple Sign-In, access/refresh token rotation, device tracking
- **Job 4** — Email & device-level ban cascade; JwtGuard with `@Public()` decorator
- **Job 5** — Docker Compose setup: Postgres, Redis, NestJS backend, Nginx reverse proxy
- **Job 6** — Storage factory pattern: S3 / local seamless switch, public/private folders, WebP image variants (sm/md/lg)
- **Job 7** — Helmet, CORS, compression, rate limiting (Throttler), global ValidationPipe
- **Job 8** — HttpExceptionFilter for consistent error format; ResponseInterceptor; DeviceIdInterceptor

#### Content Modules — Backend
- **Job 9** — Sampradayas module: CRUD, follow/unfollow, image upload
- **Job 10** — Books module: books, chapters, cantos, verses by number, slug-based lookup
- **Job 11** — Verses module: list, detail, random, favorites toggle, search
- **Job 12** — Mantras module: list, detail, admin CRUD, category support
- **Job 13** — Narrations module: CRUD with saint attribution
- **Job 14** — Groups & Messages: group creation, join/leave, real-time chat via Socket.IO
- **Job 15** — Chanting logs: POST log, GET stats, weekly/monthly/all-time history
- **Job 16** — Recommendations: personalized verse & mantra suggestions via guru-affinity signal

#### AI Integration
- **Job 17** — AIProviderService: Gemini (preferred) + OpenAI GPT wrapper; content moderation; token counting
- **Job 18** — Verse of Day system: manual selection, AI generation, explanation, history tracking; public + admin APIs
- **Job 19** — Real image generation: Gemini Imagen REST API + DALL-E 3 with graceful fallback
- **Job 20** — AppSettings DB persistence: encrypted API key storage; AI provider configuration via admin panel
- **Job 21** — Scheduled verse-of-day: Bull Queue + daily cron trigger with AI fallback
- **Job 22** — GuruDev chatbot: streaming SSE, verse citations, conversation history, safety moderation

#### Notifications & FCM
- **Job 23** — FCM topic infrastructure: verse-of-day, announcements, reminders topics
- **Job 24** — Topic subscribe/unsubscribe per device; batch FCM sending (500-device chunks)
- **Job 25** — User notification preferences API: `PATCH /api/v1/users/me/notification-preferences`
- **Job 26** — In-app notifications module: CRUD, read/unread state

#### Admin Panel (Next.js)
- **Job 27** — Admin login, dashboard with key metrics, sidebar navigation
- **Job 28** — Sampradayas, Books, Verses, Mantras CRUD pages with image upload
- **Job 29** — User management (list, ban, unban), moderation queue (approve/reject)
- **Job 30** — Verse of Day management: manual select, AI generate, image create, config panel
- **Job 31** — Analytics dashboard: user growth charts, engagement metrics, retention data
- **Job 32** — Audit log UI, settings page (AI provider, API keys, appearance)
- **Job 33** — Translations workspace: key-based translation editor with save/approve flow

#### Web App (Next.js — `webapp/`)
- **Job 34** — Auth flow: Google OAuth login, Axios 401 interceptor with refresh queue, Zustand store
- **Job 35** — Home feed: verse of day, sampradaya list, followed sampradayas, random verse
- **Job 36** — Book reader: book list, chapter navigator, verse reader with reading-progress bar; dark mode
- **Job 37** — Mantras, chanting tracker, GuruDev chat, groups & community chat
- **Job 38** — Profile, settings, search, toast notifications, error boundaries

#### Website (Next.js — `website/`)
- **Job 38** — Landing page with hero, stats, and CTA; books/sampradayas browse; verse of day
- **Job 39** — SEO meta tags, Open Graph, Twitter cards, sitemap; dark mode; 404 / error pages

#### Mobile App (Flutter)
- **Job 36** — Splash screen, login (Google + Apple), home screen, verse detail
- **Job 37** — Bottom navigation, sampradayas, groups listing, chanting tracker (japa counter)
- **Job 38** — Mantra library with audio playback, favorites screen, FCM notifications scaffold
- **Job 39** — Book library, chapter reader, profile screen with dark mode, GuruDev chat UI
- **Job 40** — GoRouter navigation, Dio JWT refresh interceptor, shared widget library, animations

#### DevOps & Cross-Cutting
- **Job 39** — Redis caching layer: hot-path reads cached, TTL-based invalidation
- **Job 40** — Performance: next/image enforcement, Next.js config optimization, font loading
- **Job 41** — Production readiness: remove `console.log` dev artifacts, add `enableShutdownHooks()`, Logger, clean CORS, docs finalized

### Changed
- Swagger/OpenAPI docs restricted to `NODE_ENV !== 'production'`
- All `.catch(console.error)` in frontend replaced with silent catches
- Backend startup log migrated from `console.log` to NestJS `Logger`
- FEATURES.md pending section updated to reflect actual remaining gaps
- CLAUDE.md Current Status updated to ~95% complete

### Fixed
- TypeScript strict-null safety across all modules (Job 40 sweep)
- DTO validation gaps on group/message endpoints
- JWT guard edge cases on public endpoints
- Image variant generation path collisions in storage service

---

## Pre-release History

| Tag | Date | Description |
|-----|------|-------------|
| v0.9.0 | 2026-04-27 | Verse of Day + FCM topic + AI image generation |
| v0.8.0 | 2026-04-15 | Admin panel complete (all CRUD pages) |
| v0.7.0 | 2026-04-01 | GuruDev chatbot + AppSettings persistence |
| v0.6.0 | 2026-03-20 | Mobile app polish — all major screens |
| v0.5.0 | 2026-03-05 | Web app & website complete |
| v0.4.0 | 2026-02-15 | All backend content modules + AI integration |
| v0.3.0 | 2026-02-01 | Auth, storage, Docker, notifications |
| v0.2.0 | 2026-01-20 | Prisma schema, core module scaffold |
| v0.1.0 | 2026-01-10 — | Initial repo setup |
