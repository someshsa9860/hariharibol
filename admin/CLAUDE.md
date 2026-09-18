# Admin — HariHariBol Admin Panel

Admin panel for content management, moderation and configuration.

## Rules

**Stack** — React + Vite + TypeScript. A plain SPA, no server-side rendering —
the admin panel has no SEO surface and nothing it renders needs to exist
before JS runs, so SSR would only add a build/runtime mode with nothing to
show for it. It is a pure client of the JSON API already built at
`backend/routes/admin/` (documented at `/docs`); it holds no database access
and no business logic of its own.

- **Tailwind CSS** for styling, with a small set of hand-written primitives
  (button, card, table, badge, dialog, dropdown, etc.) in `src/components/ui/`
  — the shadcn/ui pattern (Radix primitives + `class-variance-authority` +
  `tailwind-merge`), written directly into the repo rather than pulled from a
  registry, so every primitive is something a developer can open and read.
- **Recharts** for graphs — the standard choice for React, no new rendering
  model to learn.
- **TanStack Query** for server state — every admin page is "fetch a page of
  something from the API," and it replaces fifteen hand-rolled
  loading/error/refetch states with one pattern.
- **React Router** for routing.

**Look** — an ordinary SaaS admin dashboard: neutral slate/zinc palette,
sidebar + topbar, data tables, KPI cards, charts. **Deliberately not the
app's saffron/devotional theme.** The audience here is staff moderating and
configuring the platform, not a devotee in worship — a content-heavy neutral
theme reads faster for scanning tables and numbers, and keeps "the app" and
"the tool used to run the app" visually distinct so nobody mistakes one for
the other.

**Structure** — flat, one file per admin section, mirroring
`backend/routes/admin/` group for group:

```
admin/
├── src/
│   ├── main.tsx            # entry
│   ├── app.tsx              # providers (query client, auth, router)
│   ├── router.tsx           # route table, permission-gated
│   ├── lib/
│   │   ├── api.ts           # fetch client, envelope parsing, token refresh
│   │   ├── auth.tsx         # AuthContext, Google sign-in, session storage
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/               # button, card, table, badge, dialog, …
│   │   ├── layout/            # sidebar, topbar, shell
│   │   └── data-table.tsx    # one generic paginated/searchable table, reused everywhere
│   └── routes/                # one file per section: dashboard.tsx, users.tsx, books.tsx …
```

A route file's name is the resource it manages and nothing else —
`routes/users.tsx` handles `/api/admin/users`. No `modules/`, no
`features/<name>/`, no folder-per-page — a page is one file until it
genuinely cannot be, per the repo's flat-over-nested rule.

**Auth — Google only, no separate admin login.** The panel signs in through
the same `POST /api/app/auth/social` endpoint as the mobile app
(`provider: 'GOOGLE'`, `platform: 'web'`) via Google Identity Services in the
browser — one users table, one auth service, per `backend/CLAUDE.md`. There
is no admin-specific password or session type. A signed-in account reaches
admin screens only if its role carries the permission each screen needs;
`GET /api/admin/me` is what the panel reads to decide what to show.

The **first** admin account is not seeded with a literal email in a
committed file — same reasoning `prisma/seed/index.js` already gives for not
seeding one at all: a known email sitting in version control is a
credential. Instead `backend/scripts/promote-admin.js <email>` promotes an
already-signed-in user to `super_admin`, run once by hand after that
person's first Google sign-in.

**Data tables over bespoke forms, for now.** Every list screen goes through
the one `DataTable` component (pagination, search, filters) against the
resource's real `GET` list endpoint — no page is a placeholder. Create/edit
uses whatever the simplest correct form is per resource; nothing here
justifies a form-generation layer yet.

## Notes carried over

- Admins are not a separate account type. They are rows in the same users
  table as everyone else, distinguished by a `role` column, and reach admin
  surfaces only when their role and permissions allow it. See
  [backend/CLAUDE.md](../backend/CLAUDE.md).
- Admin API endpoints live under `backend/routes/admin/` and
  `backend/controllers/admin/`.
- The previous Next.js admin panel is archived on the `unorganized` branch at
  `admin/` — reference only, not a pattern to carry forward.
- **Reels moderation is not here yet.** `backend/controllers/admin/` has no
  reel/report/creator-approval controllers — that backend work has to land
  before this panel can grow a moderation queue for it. See the "Reels — what
  is not there" section of the root [CLAUDE.md](../../CLAUDE.md).
