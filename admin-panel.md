# Admin Panel — Next.js Dashboard

> **Purpose:** Internal tool for the team to manage all platform content (sampradayas, books, verses, narrations, mantras, translations), moderate user-generated content, manage bans, and monitor platform health.

> **Users:** Super-admin, content editors, translators, moderators. NOT exposed to end devotees.

---

## Tech Stack

| Concern | Choice | Notes |
|---------|--------|-------|
| Framework | **Next.js 15** (App Router) | RSC + Server Actions |
| Language | TypeScript (strict) | |
| Styling | Tailwind CSS v4 | |
| UI Components | **shadcn/ui** | Owned components, customizable |
| Forms | React Hook Form + Zod | |
| Tables | TanStack Table | Sorting, filtering, pagination |
| Rich Text | TipTap | For narrations + descriptions |
| Charts | Recharts | Dashboard analytics |
| Auth | NextAuth.js (admin-only) + 2FA | TOTP (Google Authenticator compatible) |
| API Client | TanStack Query (React Query) | Cache + mutations |
| Icons | Lucide React | |
| State | Zustand (light) + React Query | Avoid Redux |
| Notifications | Sonner | Toast |
| Date | date-fns | |
| File Upload | uploadthing or direct-to-S3 signed URLs | |
| Deployment | Vercel or self-hosted (Node) | |

---

## Folder Structure

```
admin-panel/
├── src/
│   ├── app/                              # Next.js App Router
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   └── 2fa/
│   │   │       └── page.tsx
│   │   │
│   │   ├── (dashboard)/                  # Protected layout
│   │   │   ├── layout.tsx                # Sidebar + topbar
│   │   │   ├── page.tsx                  # Dashboard home
│   │   │   │
│   │   │   ├── users/
│   │   │   │   ├── page.tsx              # User list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # User detail
│   │   │   │
│   │   │   ├── bans/
│   │   │   │   ├── page.tsx              # Ban list
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # Ban detail with cascade tree
│   │   │   │
│   │   │   ├── sampradayas/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx          # Edit
│   │   │   │
│   │   │   ├── books/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx
│   │   │   │       └── chapters/
│   │   │   │           └── [chapterNumber]/
│   │   │   │               └── verses/
│   │   │   │                   └── [verseNumber]/
│   │   │   │                       └── page.tsx  # Verse editor
│   │   │   │
│   │   │   ├── narrations/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── mantras/
│   │   │   │   ├── page.tsx
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx
│   │   │   │
│   │   │   ├── translations/
│   │   │   │   ├── page.tsx              # Translation dashboard (coverage matrix)
│   │   │   │   ├── workspace/
│   │   │   │   │   └── page.tsx          # Side-by-side translator
│   │   │   │   └── import-export/
│   │   │   │       └── page.tsx          # CSV/JSON bulk
│   │   │   │
│   │   │   ├── languages/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── moderation/
│   │   │   │   ├── page.tsx              # Hidden messages queue
│   │   │   │   ├── groups/
│   │   │   │   │   └── page.tsx          # Group oversight
│   │   │   │   └── strikes/
│   │   │   │       └── page.tsx          # Users with strikes
│   │   │   │
│   │   │   ├── notifications/
│   │   │   │   └── page.tsx              # Compose + send push
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   ├── audit-log/
│   │   │   │   └── page.tsx
│   │   │   │
│   │   │   └── settings/
│   │   │       ├── page.tsx              # Personal settings
│   │   │       ├── team/
│   │   │       │   └── page.tsx          # Team members + roles
│   │   │       └── api-keys/
│   │   │           └── page.tsx
│   │   │
│   │   ├── api/                          # API routes (proxy to backend if needed)
│   │   │   └── auth/
│   │   │       └── [...nextauth]/
│   │   │           └── route.ts
│   │   │
│   │   ├── layout.tsx
│   │   └── globals.css
│   │
│   ├── components/
│   │   ├── ui/                           # shadcn components
│   │   ├── layout/
│   │   │   ├── sidebar.tsx
│   │   │   ├── topbar.tsx
│   │   │   ├── breadcrumbs.tsx
│   │   │   └── user-menu.tsx
│   │   ├── data-table/
│   │   │   ├── data-table.tsx            # Reusable TanStack Table wrapper
│   │   │   ├── pagination.tsx
│   │   │   └── filters.tsx
│   │   ├── forms/
│   │   │   ├── translation-input.tsx     # Multi-language input
│   │   │   ├── image-upload.tsx
│   │   │   ├── rich-editor.tsx           # TipTap wrapper
│   │   │   └── sanskrit-input.tsx        # Devanagari-friendly input
│   │   ├── moderation/
│   │   │   ├── message-card.tsx
│   │   │   ├── ai-verdict-badge.tsx
│   │   │   └── ban-cascade-tree.tsx
│   │   ├── content/
│   │   │   ├── verse-editor.tsx
│   │   │   ├── narration-card.tsx
│   │   │   └── sampraday-form.tsx
│   │   └── charts/
│   │       ├── line-chart.tsx
│   │       ├── bar-chart.tsx
│   │       └── stat-card.tsx
│   │
│   ├── lib/
│   │   ├── api/                          # API client layer
│   │   │   ├── client.ts                 # Axios/fetch wrapper
│   │   │   ├── users.ts
│   │   │   ├── sampradayas.ts
│   │   │   ├── books.ts
│   │   │   ├── verses.ts
│   │   │   ├── narrations.ts
│   │   │   ├── mantras.ts
│   │   │   ├── translations.ts
│   │   │   ├── moderation.ts
│   │   │   └── bans.ts
│   │   ├── auth/
│   │   │   ├── auth-options.ts           # NextAuth config
│   │   │   └── permissions.ts            # Role-based access checks
│   │   ├── validators/                   # Zod schemas (shared with backend ideally)
│   │   ├── utils.ts
│   │   └── constants.ts
│   │
│   ├── hooks/
│   │   ├── use-auth.ts
│   │   ├── use-permission.ts
│   │   ├── use-debounce.ts
│   │   └── use-table-state.ts
│   │
│   ├── stores/                           # Zustand
│   │   ├── ui-store.ts
│   │   └── filter-store.ts
│   │
│   ├── types/                            # Shared types (ideally from backend package)
│   │   └── api.ts
│   │
│   └── middleware.ts                     # Auth + role guards
│
├── public/
├── .env.example
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
├── components.json                       # shadcn config
└── package.json
```

---

## Roles & Permissions

| Role | Access |
|------|--------|
| **super_admin** | Everything: team management, all CRUD, ban management, settings |
| **content_editor** | Create/edit sampradayas, books, verses, narrations, mantras. No bans, no team. |
| **translator** | Translation workspace only. Edit translations in approved languages. |
| **moderator** | Moderation queue, group oversight, view bans, manual ban (with super_admin approval for cascades) |
| **viewer** | Read-only dashboard + analytics |

Permissions checked both in middleware (route level) and in components (UI level — hide buttons the user can't use).

---

## Screens (Detailed)

### 1. Login (`/login`)
- Email + password
- Redirects to `/2fa` after correct credentials
- "Forgot password" → email reset link
- No public sign-up — admins are invited only

### 2. 2FA (`/2fa`)
- TOTP code input (6 digits)
- "Use backup code" link
- On success → redirect to dashboard

### 3. Dashboard Home (`/`)
- **Top stat cards:** Total users, active users (24h), total verses, total narrations, hidden messages today, pending translations
- **Charts:** User growth (last 30 days), most viewed verses, most followed sampradayas, daily chant counts
- **Recent activity:** Latest registrations, latest bans, latest content edits
- **System health:** API uptime, DB status, AI provider status

### 4. Users (`/users`)
- Searchable, filterable table: name, email, sampradayas followed, status, joined date
- Filters: banned/active, registration date range, language, has_chants
- Click row → user detail
- Bulk actions: export CSV (super_admin only)

### 5. User Detail (`/users/[id]`)
- Profile info (read-only)
- Followed sampradayas
- Linked devices (with last seen, model)
- Chant stats
- Recent messages (with moderation status)
- Strike count
- Action buttons: Ban (with reason), Unban, View ban history

### 6. Bans (`/bans`)
- Table: type (email/device), value, reason, triggered by (AI/admin), date, status, cascade size
- Filter by type, triggered_by, active/inactive
- Click row → ban detail

### 7. Ban Detail (`/bans/[id]`)
- Full ban info
- **Cascade tree visualization** — shows: this ban → triggered these other bans → which triggered these...
- Evidence messages (the messages that led to ban)
- Action: Unban with reason (for the entire cascade or just this node)

### 8. Sampradayas (`/sampradayas`)
- Card grid view (visual) + list view toggle
- Card shows: thumbnail, name, follower count, status (published/draft), last updated
- "New Sampraday" button (top right)
- Reorder via drag-and-drop (display_order)

### 9. Sampraday Editor (`/sampradayas/[id]`)
- Tabs: **Basic Info** | **Content** | **Disciples** | **Mantras** | **Media** | **SEO/Meta**
- **Basic Info:** Slug, name (multi-lang inputs side-by-side), categories, founding year, region, founder name, founder image upload, primary deity, deity image upload
- **Content:** Short description, philosophy (rich text), key teachings (rich text) — all multi-language
- **Disciples:** Add/remove key disciples list with name + bio + image
- **Mantras:** Linked mantras (jump to mantras section to add new)
- **Media:** Hero image, thumbnail, gallery
- **Publish toggle** + "Save as draft"

### 10. Books (`/books`)
- Table: title, author, total chapters, total verses, status, last updated
- "New Book" + "Bulk Import JSON" buttons

### 11. Book Editor (`/books/[id]`)
- Basic info (title multi-lang, description, cover, author)
- Chapter list (table) → click chapter → chapter editor
- Bulk verse import (JSON or CSV)

### 12. Chapter & Verse Navigation
- `/books/[id]/chapters/[chapterNumber]` — chapter overview, verse list
- `/books/[id]/chapters/[chapterNumber]/verses/[verseNumber]` — verse editor

### 13. Verse Editor (Critical Screen)
**Layout:**
- **Left column (40%):**
  - Sanskrit input (Devanagari, with IME helper)
  - Transliteration input
  - Word meanings table (word → meaning, multi-lang)
  - Categories multi-select (devotion, knowledge, surrender, etc.)
  - Related sampradayas multi-select
  - Related deities multi-select
  - Audio URL field + upload
  - "Verse of day eligible" toggle
- **Right column (60%):**
  - Tabbed multi-language translation editor (one tab per active language)
  - Each tab: large textarea for translation, status (draft/review/approved), translator name
  - Save per language
- **Bottom section:** Linked narrations (list), "Add narration" button

### 14. Narrations (`/narrations`)
- Table: saint, source, attached verse (book/chapter/verse), language coverage, status
- Filter by saint, source, sampraday, verse
- Click → editor

### 15. Narration Editor (`/narrations/[id]`)
- Saint name (multi-lang)
- Saint image
- Source (multi-lang) e.g. "Gita Bhashya"
- Source year
- Attached verse (search + select)
- Sampraday (optional)
- Narration text (rich text, multi-language tabs)
- **Source citation required** (URL or book reference)
- Publish toggle

### 16. Mantras (`/mantras`)
- Card grid: name, sampraday, public/private badge, audio indicator
- Filter by sampraday, deity, category, public/private

### 17. Mantra Editor (`/mantras/[id]`)
- Sampraday selection (required)
- Name (multi-lang)
- Sanskrit text (large)
- Transliteration
- Meaning (multi-lang, rich text)
- Significance (multi-lang)
- Audio file upload
- Recommended count (e.g. 108)
- Category (mahamantra, beej, stotra, name)
- Related deity
- **Public toggle** (private mantras hidden from app)

### 18. Translations Dashboard (`/translations`)
- **Coverage matrix:** rows = languages, columns = namespaces (UI / Sampradayas / Books / Verses / Narrations / Mantras), cells = % translated + count
- Click cell → filtered workspace
- "Missing translations" widget (top untranslated keys by usage)
- Translator leaderboard (who translated most this month)

### 19. Translation Workspace (`/translations/workspace`)
- **Filters bar:** namespace, language pair (source → target), status (draft/review/approved/missing)
- **Side-by-side editor:**
  - Left: source text (English by default)
  - Right: target language input
  - Below: context (where this string is used), notes for translator
- Keyboard shortcut: `Ctrl+Enter` save and next
- Inline AI translation suggestion (admin-triggered, requires review)

### 20. Translation Import/Export (`/translations/import-export`)
- Export: select language + namespace → download CSV/JSON
- Import: upload CSV/JSON → preview diff → confirm
- Versioning: every import creates a snapshot for rollback

### 21. Languages (`/languages`)
- List: code, native name, English name, RTL flag, active toggle, fallback
- Add new language flow

### 22. Moderation Queue (`/moderation`)
- Hidden messages list with: sender, content, AI verdict, AI reason, AI confidence, timestamp, group
- Actions per message: **Approve & Restore** | **Confirm Hide** | **Escalate to Ban**
- Filter by AI verdict, confidence range, group, sampraday
- Bulk actions

### 23. Group Oversight (`/moderation/groups`)
- Table: group name, sampraday, member count, messages last 24h, hidden rate, flagged users count
- Sort by hidden rate (find problematic groups)
- Click group → group activity detail

### 24. Strikes (`/moderation/strikes`)
- Users with 1+ strike, sorted by strike count
- Quick action: ban, view messages, reset strikes (super_admin only)

### 25. Notifications (`/notifications`)
- Compose: title, body, deep link, multi-language
- Audience: all users, by language, by followed sampraday, by activity level
- Schedule: now or future date/time
- Sent history with delivery stats

### 26. Analytics (`/analytics`)
- Tabs: **Engagement** | **Content** | **Retention** | **Funnel**
- Engagement: DAU/MAU, session length, screens/session
- Content: top verses, top sampradayas, top mantras (chant counts)
- Retention: cohort analysis
- Funnel: install → signup → first chant → first follow → return day 7

### 27. Audit Log (`/audit-log`)
- Every admin action: who, what, when, before/after diff
- Filter by admin, action type, date range, entity
- Read-only, immutable

### 28. Settings — Personal (`/settings`)
- Update name, email, password, avatar
- 2FA setup / regenerate backup codes
- Active sessions (logout from device)

### 29. Settings — Team (`/settings/team`)
- Invite admin (email + role)
- Pending invites
- Active admins (name, role, last login, deactivate button)
- Role assignment

### 30. Settings — API Keys (`/settings/api-keys`)
- For internal services / future integrations
- Create, view (one-time), revoke

---

## Critical UX Patterns

### Multi-language Input Component
For every translatable field across the app, a consistent component:
- Tabs at top: one per active language (with native name)
- Active tab shows large input/textarea
- Each tab has indicator: ✅ approved, ✏️ draft, ⚠️ missing
- Save button saves all languages at once
- "Copy from English" helper for new languages

### Image Upload
- Drag & drop or click
- Auto-resize for thumbnails
- Show upload progress
- Replace existing image confirmation
- Keep original + serve optimized versions

### Rich Text Editor (TipTap)
- Bold, italic, underline, headings, lists, links, blockquotes
- Sanskrit-friendly (no auto-correct, allows Devanagari)
- No raw HTML pasting (sanitize on paste)

### Confirmation Modals
- Required for: delete, ban, publish, bulk actions
- "Type DELETE to confirm" for destructive actions on published content

### Keyboard Shortcuts
- `Cmd/Ctrl + S` — Save
- `Cmd/Ctrl + K` — Global search
- `Cmd/Ctrl + Enter` — Save and next (in translation workspace)
- `Esc` — Close modal

---

## Design System

### Colors (Tailwind)
- **Primary:** Saffron tones (devotional, but professional admin context — muted)
  - `--primary: hsl(28 80% 52%)` — saffron-orange
- **Accent:** Deep indigo / Krishna blue
- **Success:** Standard green
- **Warning:** Amber
- **Destructive:** Red
- **Background:** Cream/off-white in light, deep slate in dark
- **Both light + dark themes** — admin panel supports both, persisted in localStorage

### Typography
- **Sans:** Inter (UI)
- **Devanagari:** Noto Sans Devanagari (for Sanskrit display)
- **Mono:** JetBrains Mono (for IDs, JSON previews)

### Spacing
- Base unit: 4px (Tailwind default)
- Cards: `p-6`, table cells: `px-4 py-3`

### Layout
- **Desktop-first** (admins use laptops/desktops)
- Min width: 1280px (acceptable degradation below)
- Sidebar: 240px expanded, 64px collapsed
- Topbar: 56px height
- Content max-width: 1440px (centered)

---

## Task List (Priority Order)

### 🔴 P0 — Foundation
1. Initialize Next.js 15 project with App Router, TypeScript strict
2. Install Tailwind v4, configure design tokens
3. Set up shadcn/ui with custom theme
4. Configure ESLint + Prettier
5. Set up folder structure as above
6. Configure environment variables
7. Set up TanStack Query provider
8. Set up React Hook Form + Zod
9. Create base API client (with auth interceptor)
10. Build layout shell (sidebar + topbar + content area)

### 🔴 P0 — Auth
11. Implement NextAuth.js with credentials provider (calls backend)
12. Build login page
13. Implement 2FA TOTP flow (build 2FA page)
14. Auth middleware for route protection
15. Permissions module (role checks)
16. usePermission hook
17. Logout flow

### 🔴 P0 — Layout & Nav
18. Sidebar with collapsible groups (Content, Moderation, Translations, Settings)
19. Topbar with breadcrumbs, user menu, theme toggle
20. Mobile responsive shell (hamburger menu)
21. Loading + error boundaries

### 🔴 P0 — Reusable Components
22. DataTable wrapper around TanStack Table (sorting, filtering, pagination, row selection)
23. Multi-language input component
24. Image upload component
25. Rich text editor (TipTap wrapper)
26. Confirmation dialog
27. Stat card
28. Filter bar component
29. Pagination component

### 🔴 P0 — Dashboard Home
30. Stats fetching + cards
31. Recent activity widget
32. System health widget
33. Charts (user growth, top content)

### 🔴 P0 — User Management
34. User list page with search + filters
35. User detail page
36. Ban/unban modal with reason
37. View linked devices section

### 🔴 P0 — Sampraday Management
38. Sampraday list (card grid + list views)
39. Sampraday create page
40. Sampraday editor with all tabs (Basic / Content / Disciples / Mantras / Media)
41. Drag-and-drop reorder
42. Publish/draft toggle

### 🔴 P0 — Book & Verse Management
43. Book list page
44. Book editor
45. Bulk verse import (JSON upload with preview)
46. Chapter view
47. Verse editor (the big screen) — left column with Sanskrit/categories/relations
48. Verse editor — right column with multi-language translation tabs
49. Linked narrations section in verse editor

### 🔴 P0 — Narration Management
50. Narration list
51. Narration editor with saint info + source citation
52. Verse linker (search + select verse)
53. Multi-language rich text editor

### 🔴 P0 — Mantra Management
54. Mantra list (card grid)
55. Mantra editor with audio upload
56. Public/private toggle with warning

### 🔴 P0 — Translation System
57. Translation coverage dashboard with matrix
58. Translation workspace (side-by-side editor)
59. Save with status workflow (draft/review/approved)
60. Keyboard shortcuts (Ctrl+Enter)
61. Translation import (CSV/JSON with preview)
62. Translation export (CSV/JSON)

### 🔴 P0 — Languages
63. Languages list
64. Add language flow

### 🟠 P1 — Ban Management
65. Bans list page
66. Ban detail with cascade tree visualization (recursive tree component)
67. Evidence messages display
68. Unban flow (single node or full cascade)

### 🟠 P1 — Moderation
69. Hidden messages queue page
70. Message card with AI verdict + reasoning
71. Approve/Confirm Hide/Escalate actions
72. Bulk actions
73. Group oversight page
74. Strikes page

### 🟠 P1 — Notifications
75. Notification composer with multi-language
76. Audience selector
77. Schedule + preview
78. Sent history with stats

### 🟠 P1 — Analytics
79. Engagement tab
80. Content tab
81. Retention cohort table
82. Funnel visualization

### 🟠 P1 — Audit Log
83. Audit log table with filters
84. Diff viewer for content changes

### 🟠 P1 — Settings
85. Personal settings page (profile, password, 2FA)
86. Team management page (invites, roles)
87. API keys page

### 🟡 P2 — Polish
88. Global search (Cmd+K) — search across users, content, translations
89. Inline AI translation suggestions (with review)
90. Bulk content operations (publish/unpublish many)
91. Content versioning (revert to previous version)
92. Export reports (PDF/CSV)
93. Onboarding tour for new admins

### 🟡 P2 — Quality
94. E2E tests with Playwright (login, create sampraday, edit verse, translation flow)
95. Component tests for critical forms
96. Accessibility audit (WCAG AA)
97. Storybook for UI components

---

## Environment Variables (`.env.example`)

```bash
# App
NEXT_PUBLIC_APP_NAME=Sanatan Admin
NEXT_PUBLIC_API_URL=http://localhost:3000/api/v1

# NextAuth
NEXTAUTH_URL=http://localhost:3001
NEXTAUTH_SECRET=

# Backend integration
ADMIN_API_TOKEN=               # for server-side calls

# File upload
NEXT_PUBLIC_S3_BUCKET=
S3_UPLOAD_KEY=
S3_UPLOAD_SECRET=
S3_REGION=

# Monitoring
NEXT_PUBLIC_SENTRY_DSN=
```

---

## Performance Targets
- Initial load (TTI): < 2s on broadband
- Route transitions: < 300ms
- Table rendering with 1000 rows: smooth (virtualization)
- Image uploads: progress shown, async

## Accessibility
- All interactive elements keyboard-accessible
- Proper ARIA labels
- Focus management in modals
- Color contrast WCAG AA minimum
- Screen reader friendly tables and forms

---

*Document version: 1.0 — Last updated: April 27, 2026*
