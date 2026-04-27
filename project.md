# Sanatan Devotee Platform — Project Plan

> **Mission:** Build one trustworthy platform where devotees of every sampraday within Sanatan Dharma can connect, learn from authentic scripture, and counter misinformation.
>
> **Spiritual Focus:** Krishna, Shree Gurudev Datta, and avatars of Vishnu — while respecting all sampradayas equally.

---

## Stack Overview

| Layer | Technology |
|-------|-----------|
| Backend | Node.js (framework TBD — Express / NestJS / Fastify) |
| Database | TBD (MongoDB recommended for dynamic content + translations) |
| Admin Panel | Next.js (App Router) + Tailwind |
| Mobile App | Flutter (iOS + Android) |
| Auth | Google + Apple Sign-In only |
| AI (GuruDev + Moderation) | TBD (Claude / OpenAI / Gemini) |
| Storage | S3 / GCS for media, books, audio |
| Hosting | TBD |

---

## Priority Legend

- 🔴 **P0** — Must have for MVP launch (blocker)
- 🟠 **P1** — Important, ship soon after MVP
- 🟡 **P2** — Nice to have, post-launch
- 🟢 **P3** — Future / v2

---

# PHASE 0 — PLANNING & DESIGN FOUNDATION

### 🔴 P0 — Foundation
1. **Finalize tech stack decisions** — database, backend framework, AI provider, hosting, launch languages
2. **Finalize project name & branding** — used everywhere (repos, package IDs, domains, store listings)
3. **Define MVP scope** — agree on which features ship in v1 vs v2 to avoid scope creep
4. **Create design system in Figma** — colors, typography, spacing, components, icons (devotional aesthetic, calm + premium)
5. **Wireframe all core screens** — Home, Verse Detail, GuruDev Chat, Chanting, Sampraday Detail, Group Chat, Read Book, Profile, Settings
6. **High-fidelity Figma designs** — based on approved wireframes, with auto-layout + variables for clean code generation
7. **Design glassmorphism components** for iOS 26+ separately from standard components
8. **Content & moderation policy document** — what counts as wrong/disrespectful comment, how AI judges it, appeal process

---

# PHASE 1 — REPOSITORY & INFRASTRUCTURE SETUP

### 🔴 P0 — Foundation
9. **Set up monorepo or 3 separate repos** — backend, admin-panel, mobile-app (recommend: separate repos with shared types package)
10. **Backend repo scaffold** — folder structure (routes, controllers, services, models, middlewares, validators, seeders, utils, config)
11. **Admin panel repo scaffold** — Next.js with App Router, Tailwind, shadcn/ui, auth middleware
12. **Flutter app scaffold** — clean architecture (presentation / domain / data layers), routing (go_router), state management (Riverpod or Bloc)
13. **Set up linting + formatting** — ESLint + Prettier (backend/admin), `flutter_lints` (mobile)
14. **Set up Git workflow** — branching strategy, PR template, commit conventions
15. **Configure environment management** — `.env.example` files, secrets management (do not commit secrets)
16. **CI/CD pipeline basics** — GitHub Actions for lint/test on PR

### 🟠 P1
17. **Docker setup** for backend + database (local dev parity)
18. **Staging + Production environments** with separate databases
19. **Error monitoring** — Sentry integration in all 3 codebases

---

# PHASE 2 — CORE BACKEND (Node.js)

### 🔴 P0 — Auth & User
20. **Database schema design** — users, devices, sampradayas, books, chapters, verses, translations, narrations, mantras, groups, messages, bans, follows, favorites
21. **Google OAuth integration** — verify ID token, create/update user
22. **Apple Sign-In integration** — verify ID token, handle Apple's email relay
23. **JWT issue + refresh token system** — short-lived access token + long-lived refresh token
24. **Auth middleware** — protect routes, attach user context
25. **Device tracking system** — generate/store unique device ID, link to user account, multi-device support
26. **User profile endpoints** — get/update profile, language preference, followed sampradayas

### 🔴 P0 — Content System
27. **Sampraday CRUD endpoints** — list, get details, follow/unfollow
28. **Book CRUD endpoints** — list, chapters, verses with pagination
29. **Verse endpoints** — random verse by category, verse of the day, verse detail with narrations
30. **Mantra endpoints** — by sampraday, public-only filter
31. **Narration endpoints** — verse-related commentary from saints, attributed correctly
32. **Favorites system** — favorite verses, mantras, narrations
33. **Chanting log endpoints** — log chant counts, history, stats
34. **Recommendation logic** — verses + mantras based on followed sampradayas + chant history + favorites

### 🔴 P0 — Internationalization (i18n)
35. **Translation key system** — every dynamic content piece has a `translation_key`, lookup table maps key → language → translated text
36. **Scalable translation schema** — new language = add column/document, no code changes
37. **Locale endpoint** — return all UI strings + content for a given locale in one call
38. **Fallback logic** — if translation missing for locale X, fallback to English (or configurable default)

### 🔴 P0 — Seeding
39. **Bhagavad Gita seeder** — import existing JSON (all 18 chapters, 700 verses, multi-language translations)
40. **Srimad Bhagavatam seeder** — import structured JSON (12 cantos)
41. **Sampraday seeder** — major sampradayas with founder, deity, philosophy, key disciples, key mantras (Gaudiya, Sri, Madhva, Pushtimarg, Nimbarka, Vallabh, Datta sampradaya, etc.)
42. **Mantra seeder** — public mantras tagged by sampraday and deity
43. **Narration seeder** — verse commentaries from authentic acharyas (Shankaracharya, Ramanujacharya, Madhvacharya, Prabhupada, etc.) with proper attribution
44. **Categories seeder** — verse categories (devotion, knowledge, action, surrender, dharma, etc.)
45. **Languages seeder** — supported languages + locale codes

### 🟠 P1 — Group Chat & Moderation
46. **Group schema** — one or more groups per sampraday, members, admins
47. **Real-time chat** — WebSocket (Socket.IO) for group messages
48. **AI moderation pipeline** — every message passes through AI before broadcast; classify as safe / disrespectful / spam
49. **Hidden message logic** — disrespectful messages are hidden but logged with reason
50. **Strike + ban cascade system** —
   - Track strikes per user
   - Hide all past messages from banned user
   - Block email → check all devices linked to email → block those devices
   - Block device → check all emails linked to device → block those emails
   - Maintain `bans` collection with `email`, `device_id`, `reason`, `cascaded_from`
51. **Admin override** — admin can unban, review hidden messages, see ban audit trail

### 🟠 P1 — GuruDev AI Chatbot
52. **Chat session schema** — per-user conversation history
53. **GuruDev personality engine** —
   - Detect user's preferred guru figure from: liked verses, chant categories, followed sampradayas, narration favorites
   - Adjust system prompt to reflect that guru's teaching style (e.g., Prabhupada-flavored vs Ramanuja-flavored vs Datta tradition)
   - Always grounded in scripture, never invents teachings
54. **AI provider integration** — Claude/OpenAI/Gemini API wrapper with retries + rate limits
55. **RAG system** — retrieve relevant verses + narrations to ground every AI response (prevents hallucination of false teachings)
56. **Chat history endpoints** — list, get, delete conversations
57. **Per-user rate limits** on chatbot to control API costs

### 🟡 P2
58. **Audio narration storage** — chanting audio, mantra recitation, verse recitation by saints
59. **Push notifications backend** — verse of the day, group activity, follow updates (FCM + APNs)
60. **Analytics events** — track which verses/sampradayas/categories are most engaged with

---

# PHASE 3 — ADMIN PANEL (Next.js)

### 🔴 P0 — Core Admin
61. **Admin auth** — separate admin login (email/password + 2FA), role-based access (super-admin, content-editor, moderator)
62. **Dashboard** — key metrics (users, active devices, hidden messages today, top sampradayas)
63. **User management** — search, view, ban/unban, see linked devices + emails
64. **Ban management** — list bans, see cascade tree, manually unban with reason

### 🔴 P0 — Content Management
65. **Sampraday management UI** — full CRUD with rich editor for philosophy, image upload for founder/deity, key disciples list
66. **Book management UI** — books, chapters, verses with bulk import (JSON upload)
67. **Verse editor** — original Sanskrit, transliteration, word meanings, translations per language, attached narrations
68. **Mantra management** — add/edit, mark public/private, tag by sampraday + deity
69. **Narration management** — attach narrations to verses, attribute to saint, source citation required
70. **Category management** — verse categories, sampraday categories

### 🔴 P0 — Translation Workspace
71. **Translation dashboard** — see what's translated vs missing per language
72. **Side-by-side translation editor** — English (or source) on left, target language on right
73. **Bulk translation import/export** — CSV/JSON for translators working offline
74. **Translation status workflow** — draft → review → approved → published

### 🟠 P1 — Moderation
75. **Hidden messages review queue** — see flagged messages, AI reasoning, decide: confirm hide / restore / escalate to ban
76. **Group oversight** — see active groups, message volume, flagged content rate
77. **Audit log** — every admin action logged with timestamp + admin ID

### 🟡 P2
78. **Push notification composer** — schedule and send notifications to user segments
79. **Analytics dashboards** — engagement, retention, content performance
80. **Backup & export tools** — export content for backup

---

# PHASE 4 — MOBILE APP (Flutter)

### 🔴 P0 — Foundation
81. **Theme system** — light/dark themes, devotional color palette, typography (Sanskrit-friendly fonts like Noto Sans Devanagari)
82. **Routing setup** — go_router with auth-aware redirects, deep linking
83. **State management** — Riverpod (recommended) or Bloc throughout
84. **API client** — Dio with interceptors (auth token, refresh on 401, error handling)
85. **Local storage** — Hive or Drift for offline cache (favorites, recent verses, settings)
86. **Localization setup** — Flutter `intl` package, dynamic locale switching (whole app re-renders in new language)

### 🔴 P0 — Auth & Onboarding
87. **Splash screen** — devotional, fast, no friction
88. **Google Sign-In flow** — one tap, no extra info collection
89. **Apple Sign-In flow** — required for iOS App Store approval
90. **Device ID generation** — persist across logout, send with every API call
91. **Language selector on first launch** — but skippable (default to system locale)

### 🔴 P0 — Bottom Navigation (3 tabs)
92. **Tab bar widget** — 3 tabs: Home, GuruDev, Chanting (consider 4th tab for Read Book)
93. **iOS 26+ glass effect** — detect iOS version, apply glassmorphism to tab bar + cards
94. **Android Material 3** — equivalent treatment respecting platform conventions

### 🔴 P0 — Tab 1: Home
95. **Verse of the day card** — hero card with verse, source, tap to expand
96. **Verses by category** — horizontal scrolling sections (Devotion, Knowledge, Surrender, etc.)
97. **Verse detail screen** — Sanskrit + transliteration + translation + word meanings + saint narrations + source attribution
98. **Verse interaction** — favorite, share (as image), copy
99. **Followed sampraday section** — once user follows, show related verses + announcements
100. **Daily wisdom widget** — short narration excerpt
101. **Pull-to-refresh** with new content

### 🔴 P0 — Tab 2: GuruDev AI Chat
102. **Chat UI** — message bubbles, typing indicator, markdown rendering, code-of-conduct disclaimer
103. **GuruDev avatar + name** — dynamically reflects user's affinity (no fixed name, no fixed face)
104. **Send message + receive streaming response** — for natural feel
105. **Conversation history** — list past chats, resume any, delete
106. **Suggested prompts** — "Explain Bhagavad Gita 2.47", "What is bhakti?", "Story of Krishna and Sudama"
107. **Citation display** — when AI references a verse, show source link to verse detail

### 🔴 P0 — Tab 3: Chanting
108. **Sampraday grid** — visual grid of all sampradayas with iconic image + name
109. **Sampraday detail screen** — founder, primary deity, philosophy summary, key disciples, public mantras, follow button
110. **Mantra detail screen** — Sanskrit, meaning, audio play, chant counter, set japa goal
111. **Chant counter** — tap to increment, mala (108) tracking, daily goal, streak
112. **Chanting history** — daily/weekly/monthly stats, total counts per mantra
113. **Quick chant access** — chanting also accessible as floating action button on Home

### 🟠 P1 — Tab 4: Read Book (recommended addition)
114. **Books library** — grid of available books (Bhagavad Gita, Srimad Bhagavatam at launch)
115. **Reader UI** — chapter selector, verse navigation, font size, day/night mode, bookmark
116. **Reading progress tracking** — last read position, % complete per book
117. **Inline narrations** — tap verse to see commentaries without leaving reader
118. **Search within book** — find verse by keyword

### 🟠 P1 — Groups
119. **Group list per followed sampraday**
120. **Group chat UI** — message bubbles, sender name, timestamp, hidden message indicator
121. **Send message with optimistic UI** — show pending → confirmed/hidden after AI moderation
122. **Member list** — see who's in group
123. **Report message** button (manual escalation)

### 🟠 P1 — Profile & Settings
124. **Profile screen** — name, photo, followed sampradayas, favorite verses, chant stats
125. **Settings** — language, theme, notifications, account, logout, delete account
126. **App language switcher** — entire app updates immediately on change
127. **Privacy policy + terms screens**
128. **About screen** — mission statement, contact, version

### 🟡 P2
129. **Offline mode** — cached verses + favorited content available offline
130. **Audio player** — play mantras, recitations with background mode + lock screen controls
131. **Share verse as image** — beautifully designed share cards with attribution
132. **Widget (iOS/Android home screen)** — verse of the day widget
133. **Apple Watch / Wear OS** — chant counter complication

---

# PHASE 5 — INTEGRATION & SECURITY

### 🔴 P0
134. **End-to-end auth testing** — Google + Apple flows on real devices
135. **Device + email ban cascade testing** — comprehensive scenarios
136. **Rate limiting** — backend endpoints (auth, chat, AI calls, posting messages)
137. **Input validation + sanitization** — all backend endpoints (Joi/Zod)
138. **CORS + security headers** — Helmet.js, proper CORS allowlist
139. **API versioning strategy** — `/api/v1/...` from day one
140. **Secrets rotation plan** — JWT secret, OAuth credentials, AI keys
141. **Database backups** — automated daily, retention policy

### 🟠 P1
142. **Penetration testing** — basic OWASP top 10 review
143. **Privacy policy & GDPR/India DPDP compliance** — data export, account deletion
144. **Terms of service** — including community guidelines
145. **App Store + Play Store privacy declarations**

---

# PHASE 6 — TESTING

### 🔴 P0
146. **Backend unit tests** — services, validators, ban cascade logic (critical)
147. **Backend integration tests** — auth flows, content endpoints
148. **Flutter widget tests** — critical screens (Home, Chat, Chanting)
149. **Manual QA pass** — full feature checklist on iOS + Android
150. **Beta testing program** — TestFlight (iOS) + Play Console internal testing (Android), invite ~50 devotees from different sampradayas for content + cultural review

### 🟠 P1
151. **Load testing** — backend can handle expected concurrent users
152. **AI moderation accuracy testing** — golden dataset of clean + problematic messages, measure precision/recall

---

# PHASE 7 — LAUNCH PREPARATION

### 🔴 P0
153. **App Store assets** — icon, screenshots (all required sizes), preview video, description, keywords
154. **Play Store assets** — same as above
155. **App Store + Play Store listings** in launch languages
156. **Production deployment** — backend, admin panel, database
157. **DNS + SSL** — production domains with valid certs
158. **Submit to App Store** (Apple review takes 1–7 days)
159. **Submit to Play Store**
160. **Landing website** — marketing site explaining the platform's mission

### 🟠 P1
161. **Launch announcement plan** — outreach to devotee communities, satsangs, temples
162. **Support email + FAQ**
163. **Community guidelines published** publicly

---

# PHASE 8 — POST-LAUNCH (v1.1+)

### 🟠 P1
164. **More books** — Ramayana, Mahabharata excerpts, Upanishads, Vishnu Purana
165. **Live satsang/discourse streaming**
166. **Donation / seva integration** — for temples, gaushalas (with full transparency)
167. **Calendar of festivals + ekadashi reminders**
168. **Panchang (Hindu calendar) integration**

### 🟡 P2
169. **Verified saint/teacher accounts** — gurus from various sampradayas can post
170. **Q&A from verified teachers**
171. **Pilgrimage guide** — major Hindu sacred sites with practical info
172. **Temple directory + locator**

### 🟢 P3
173. **Web app** — same content, browser-accessible
174. **Multi-region content moderation team** — beyond AI, human reviewers per language
175. **Open-source verse + translation database** for the broader Hindu tech community

---

# OPEN DECISIONS NEEDED FROM YOU

Before we can lock down this plan and start Phase 0:

1. **Project / app name?**
2. **Database** — MongoDB or PostgreSQL?
3. **Backend framework** — Express, NestJS, or Fastify?
4. **AI provider** — Anthropic Claude / OpenAI / Google Gemini?
5. **Hosting** — AWS / GCP / DigitalOcean / Vercel + Railway?
6. **Launch languages** — exactly which ones for v1?
7. **Should "Read Book" be a 4th tab or a section inside Home?**
8. **Budget for AI API calls** — affects rate limits and model choice
9. **Team size** — solo, small team, or hiring?

---

# RECOMMENDED EXECUTION ORDER

**Sprint 1 (Weeks 1–2):** Phase 0 + Phase 1 (planning, design, scaffolding)
**Sprint 2 (Weeks 3–5):** Phase 2 P0 backend (auth, content, i18n, seeding)
**Sprint 3 (Weeks 6–7):** Phase 3 P0 admin panel
**Sprint 4 (Weeks 8–11):** Phase 4 P0 mobile app (auth, home, chanting)
**Sprint 5 (Weeks 12–13):** GuruDev AI + Groups + Moderation
**Sprint 6 (Weeks 14–15):** Integration, testing, security
**Sprint 7 (Weeks 16–17):** Beta + launch prep
**Sprint 8 (Week 18):** Launch 🚀

*Timeline assumes 1–2 developers working consistently. Adjust based on team size.*

---

*Document version: 1.0 — Last updated: April 27, 2026*
