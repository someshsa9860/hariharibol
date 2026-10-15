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
- Not built: timed text (a box is always on screen).

## Reels from verses

`routes/reel-recipe.tsx` (`/reels/recipe`, from **New reel → From a book's verses…**)
is a three-step page: **Verses** (book, canto, chapter, range, topic, hints, audio,
creator — with a live count and sample), **Design**, **Create**.

The Design step is the reel editor itself. Its three-column surface was lifted out of
`reel-editor.tsx` into `components/reel-designer.tsx`, which edits whatever document it
is handed and knows nothing about saving; the reel editor wraps it with save / publish /
delete, the recipe page with "save as template". Passing `verseTexts` puts it in
*template mode*: the **Verse field** menu adds a box bound to the verse's Sanskrit,
transliteration, translation or reference, shown with a sample verse (the **Preview
with** picker) and filled from each verse when reels are made. A bound box's `bind` is
part of the overlay contract with `backend/routes/admin/reel.js`; the app ignores it
(the API resolves it before sending).

- The template is saved before creating, so reels can point at it and "next batch"
  works; reels already made are unaffected if the template changes or is deleted.
- Background is an image (or several) or a video; AUDIO reels are not offered.
- The position grid and the default box width keep text clear of the app's button
  column (`SAFE_AREAS` in `reel-stage.tsx`) — keep them in step with the app.

## Mantra chanting time and opening prayer

On `routes/mantras.tsx`. **Standard chanting time** (ms) is how long one chant takes at an ordinary pace: the app counts one
chant per this much sound, waits half of it between hand taps when auto count is off, and shortens it as a sitting goes on.
The mahamantra is about 4000. The form always sends it, `null` when blank, so it can be cleared again (publishing needs one).
**Opening prayer** is a select over the first 100 mantras (the API's page limit; the mantra itself is left out): another mantra
the counter shows first and before every round. "None" sends `prayerMantraId: null`. The API refuses a mantra as its own prayer and
shows `prayerMantra` back; the detail dialog lists it.

## Mantra mala recording

A mantra can carry one recording of a whole mala (optional) and the stretch of it that is
chanting. `routes/mantras.tsx` hosts `components/mantra-mala-audio.tsx`: upload it
(`lib/upload.ts`, kind `mantraMalaAudio`), play it back, and mark where the chanting **starts**
and **ends** — type the seconds, or play the recording to the spot and press the crosshair
("Use player position"). It shows the pace the marks give (the stretch ÷ 108), so a wrong mark
is visible before it is saved.

- **The three fields go together**: `malaAudioPath`, `malaAudioStartMs` and `malaAudioEndMs` are
  all set or all null. Save is disabled while `malaAudioProblem()` has something to say, and the
  API refuses the same cases itself (`backend/controllers/admin/mantra.js`).
- **108 is not decided here.** The app splits the stretch by one round's beads, which the API
  sends it; `CHANTS_PER_MALA` in the component only has to be the same number for the preview.
- **Uploads are never deleted** from storage when a recording is replaced, as with reels.

## Verse word meanings

The verse dialog on `routes/verses.tsx` hosts `components/verse-word-meanings.tsx`: a verse's
word-for-word as a list of word / meaning rows — add, remove, move up and down — saved on its own
with **Save word meanings** (`PATCH /api/admin/verses/:id`, `{ wordMeanings }`), separately from the
rest of the verse form.

- **A blank word is saved as no word**, and a row left wholly blank is dropped. A row with a word
  but no meaning is refused (Save is disabled and the row is named), as the API does.
- Read-only without `verse.write`: inputs disabled, no row controls.
- A re-import (`backend/scripts/lib/import-verses.js`) replaces these edits from the source files.

## Translations

`routes/translations.tsx` (`/translations`, Content section, permission `translation.read`) is where an admin
starts, follows and reads Claude's translation of the Gita. The work happens in the backend's worker — see
"Translation runs" in [../backend/CLAUDE.md](../backend/CLAUDE.md) — so this page is a window onto it and holds
nothing that matters itself.

| File | Job |
|---|---|
| `lib/translation.ts` | Types, the queries and mutations, and `useTranslationLive()`, which patches the query cache from socket events |
| `lib/socket.ts` | The one shared websocket: `useSocketEvent`, `useSocketStatus`, `useOnReconnect` |
| `routes/translations.tsx` | The page: health strip, **Runs** / **Output** tabs, in-progress cards, the language grid, history |
| `components/translation-run-panel.tsx` | One run in full: progress, spend, activity feed, Resume / Cancel (`PAUSE` maps a pause reason to what to tell the admin) |
| `components/translation-start-dialog.tsx` | New translation: language, chapters, verse limit, spending limit, a live estimate, and what blocks a start |
| `components/translation-import-dialog.tsx` | Import into the database: language, a live preview of what it would do (nothing is written until the button), chapters to tick, whether to make the result visible, then what was done |
| `components/translation-output.tsx` | The reader: language pills, an 18-chapter strip, a verse list with scores, and English beside the translation |
| `components/translation-bits.tsx` | Small shared pieces: status and score badges, progress bar, durations, money |

- **Nothing on the page is state worth losing.** The tab, the open run, the language, chapter and verse live in the
  URL (`?tab=runs|output`, `?run=`, `?lang=`, `?chapter=`, `?verse=`), the rest on the server, so a refresh or a pasted
  link lands on the same view. The only local preference is side-by-side vs. translation only
  (`hhb_admin_translation_view`).
- **The socket makes it live; polling makes it correct.** `translation.run` and `translation.activity` events patch the
  query cache directly, and a reconnect invalidates it. Polling is every 30 s while the socket is live, otherwise every
  4 s with a run in progress and 15 s without — so a dead websocket (a proxy that does not forward `/ws`) costs
  latency, not correctness. The header says **Live**, **Connecting…** or **Updating every few seconds**.
- **`lib/socket.ts` connects to `VITE_WS_URL`**, or when that is blank works the address out from `VITE_API_URL`:
  `/ws` on the API host (how production nginx serves it) and port 4001 on localhost, where the websocket is its own
  process (`WS_PORT`). So `VITE_WS_URL` is only for a setup that differs. It reconnects with backoff and jitter,
  renews the access token on close code 4001, pings every 25 s, and gives up quietly on 4003 (this role may not
  listen).
- **Start is gated by the server's overview**, not guessed: no `ANTHROPIC_API_KEY`, the app's bucket not reachable (or without the Gita in it)
  or a bad `TRANSLATION_VERSION` disable it with the reason; "no worker online" only warns (the run waits in the
  queue). A second start for a language that has a live run gets a 409 and an "Open that run" link.
- **Without `translation.run` the page is read-only**: no Start, Resume / Try again or Cancel; View output stays.
- **A language already translated under the current version is not translated again.** Its card says "Up to date · version X" and
  its Translate button is off; verses Claude made under another version are counted as older, and the start dialog sends
  only those and the missing ones (the server decides — the page just shows `outdated` and `upToDate`). Everything current
  gives "already translated under version X. To translate it again, set a new TRANSLATION_VERSION", and Start is off.
- **Import** (`translation.import`; the box to make translations visible also needs `verse.publish`) is on every card with
  something saved, and not while a run for that language is live. The dialog is mounted only while open and starts from the
  clicked language, so it never previews the wrong one. Changing the language or the visibility box previews again
  (`POST /imports` with `dryRun`, never cached); chapters that have something to do arrive ticked. The button imports the ticked
  chapters, the result replaces the preview, and the cards refresh to say what the database holds ("N in the database, M visible
  to readers · K from an older version"). **A verse already there is replaced in place, its id kept**; new ones are hidden unless
  the box is ticked. The dialog warns when the translations it replaces are visible to readers now, and that a verse edited
  by hand on the Verses page is replaced by what is in storage.
- Both were driven in a real headless Chrome against a copy of the API reading a fake Gita folder (cards, start dialog, preview,
  import, import again, make visible, a read-only account). That script is not kept in the repo.

Two shared changes were made for this page and apply everywhere:

- `index.css` declares `@custom-variant dark (&:where(.dark, .dark *))`. Tailwind 4's `dark:` follows the OS setting
  by default; the panel's theme switch sets the `.dark` class on `<html>`, so without this a `dark:` utility ignored the
  switch. (Warning-coloured *text* on a tinted background uses `text-amber-800 dark:text-amber-300`; the
  `text-warning-foreground` token is for text on a solid warning fill and is unreadable on dark otherwise.)
- `components/page-header.tsx` stacks the title above the actions on a phone and lets the actions wrap, instead of
  squeezing the title into a narrow column.

Not done: the app does not read a translation row's transliteration or word meanings yet, and nothing in the app says a text
was machine-made. The import puts them in the database (`VerseTranslation`); serving them is the next step — see "Translation
runs" in [../backend/CLAUDE.md](../backend/CLAUDE.md). The **Output** tab still reads the files in storage, not the database.
