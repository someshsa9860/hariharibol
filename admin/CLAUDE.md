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
│   │   ├── use-table.ts     # useDataTable: search/filter/sort/paging in the URL, selection, bulk runs
│   │   ├── csv.ts           # toCsv / downloadCsv (guards against spreadsheet formula injection)
│   │   └── utils.ts
│   ├── components/
│   │   ├── ui/               # button, card, table, badge, dialog, dropdown, checkbox, …
│   │   ├── layout/            # sidebar, topbar, shell
│   │   ├── data-table.tsx    # the one table every list screen renders through
│   │   └── table-filters.tsx # FilterSelect, FlagFilter, DateRangeFilter — plug into a table's URL state
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
the one `DataTable` component against the resource's real `GET` list
endpoint — no page is a placeholder. Create/edit uses whatever the simplest
correct form is per resource; nothing here justifies a form-generation layer
yet.

A list page is `useDataTable({id, path, filters})` plus a `columns` array plus
`<DataTable table columns …/>`. That gives it, without any per-page code:

- **Search, filters, sort, page and page size live in the URL**, so a filtered
  view survives a refresh and can be pasted to a colleague. A page that hosts
  several tables passes `scope` (`pay.status=…`). Selection is component state;
  column visibility is a personal preference in localStorage
  (`hhb_admin_cols:<id>`).
- **Sorting is the server's.** A column's `sort` value must be a key in that
  endpoint's whitelist (`readSort` in `backend/utils/pagination.js`); sorting
  the loaded page client-side would lie about the rest of the rows. An
  endpoint that has no whitelist gets no sortable columns
  (the reference lists, for example).
- **Bulk actions** — pass `bulkActions` and rows get checkboxes. `runBulk`
  fires the per-row call five at a time and reports "done N of M" (failed rows
  stay selected); `runOnce` is for the rare endpoint that takes the whole
  selection. Destructive or money-moving actions are deliberately per-row
  (refunds).
- **CSV export** — a column with `csv` is exported, hidden or not; "All
  matching" pages the API 100 at a time and stops at 5,000 rows.

Adding a filter means adding it to the endpoint's zod schema in
`backend/routes/admin/` first — the panel only offers what the API can serve.

## Notes carried over

- Admins are not a separate account type. They are rows in the same users
  table as everyone else, distinguished by a `role` column, and reach admin
  surfaces only when their role and permissions allow it. See
  [backend/CLAUDE.md](../backend/CLAUDE.md).
- Admin API endpoints live under `backend/routes/admin/` and
  `backend/controllers/admin/`.
- The previous Next.js admin panel is archived on the `unorganized` branch at
  `admin/` — reference only, not a pattern to carry forward.
- **Reels can be made and published here; they cannot yet be moderated.**
  `backend/controllers/admin/reel.js` covers create, edit, publish, unpublish
  and delete (see below). What is still missing is the review side — reel and
  comment reports, creator applications and rejection — and the backend
  endpoints for it. See the "Reels — what is not there" section of the root
  [CLAUDE.md](../CLAUDE.md).

## The reel editor

`routes/reels.tsx` is an ordinary list page. `routes/reel-editor.tsx` is the one
screen that is not a table or a form: a 9:16 frame in the middle, text layers on
the left, and Media / Text / Details on the right. It is split by job, not by
layer:

| File | Job |
|---|---|
| `lib/reel-doc.ts` | The document the editor changes (`ReelDoc`), its undo history, and the two conversions to and from the API. **The overlay shape here is a contract** with `backend/routes/admin/reel.js` and the app's `models/reel_overlay.dart` — change all three together. |
| `lib/upload.ts` | Sign → PUT → verify, with progress. Dev storage needs the bearer token on the PUT; a real presigned S3 URL must not get one. |
| `components/reel-stage.tsx` | The frame: drag, width and size handles, snap and safe-area guides, playback. |
| `components/reel-layers.tsx`, `reel-text-inspector.tsx` | The layer list and the selected box's settings. |
| `components/reel-media-panel.tsx`, `reel-details-panel.tsx`, `verse-picker.tsx` | Media upload, caption/tags/links, and choosing a verse from any book. |

Things to know before changing it:

- **Text is a layer, not burned into the video.** A box stores `x`, `y`, `width`
  and `size` as percentages of the frame, plus a style / colour / alignment
  *name*. The app resolves the names against its own fonts and palette, so the
  editor's colours (`COLOR_PREVIEW`) only need to look about right.
- **The API stores the whole document each save**, and a create is always a
  draft. Publishing is a separate call that the API refuses if the creator is
  not approved or the media is missing from storage.
- **Uploads are never deleted** from storage when a reel or a file is replaced.
- **Signed media URLs expire.** They are refreshed on every save; an editor left
  open for a long time can hold stale ones.
- **The bucket needs CORS for the admin origin** (`PUT`, and `GET` for
  thumbnail-from-frame). Local dev storage does not.
- **Playback is clocked by one element** — the video when there is one,
  otherwise the audio — and the play button follows that element's own
  play/pause events. Background music loops on its own length and is re-synced
  to the video on play, seek and every video loop. A media error shows a
  "Reload media" button that fetches fresh signed links.
- **A new reel's first save must not remount the editor.** It moves to
  `/reels/:id` with `state.editorKey: 'new'`, so the undo history and any upload
  still in flight survive. Edits made while a save is in the air are kept as
  unsaved, and blob: URLs from this browser's uploads are kept over the fresh
  signed ones so the player does not reload.
- **Editor-only conveniences are not part of the document**: hiding a box (H),
  the copy/paste clipboard (`hhb_admin_reel_clipboard` in localStorage, so a box
  can move between reels), the text presets and the 3×3 position grid all
  produce ordinary overlays. The "sits under the app's buttons" warning uses
  `SAFE_AREAS` in `reel-stage.tsx` — keep it in step with the app's reel chrome.
- Not built: timed text (a box is always on screen), templates.
