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

**Staying signed in.** The panel follows the same rules as the app (see "Session and
tokens" in [app/CLAUDE.md](../app/CLAUDE.md)): the server says "not signed in" with a
403 whose code is `UNAUTHENTICATED`, which makes `lib/api.ts` swap the refresh token
for a new pair and retry once (one refresh shared by every request that failed
together). Only the refresh call itself being answered 403 sends the person to the
sign-in page; a network error, a timeout, a 5xx or a 429 during the refresh leaves them
signed in and the request fails with `ApiRequestError(503, 'SESSION_CHECK_FAILED')`.
`restore()` in `lib/auth.tsx` does the same on a reload: it clears the stored tokens only
when the server answers 403, so a refresh of the browser tab while the API is down does
not sign anyone out. **Not driven in a browser after this change; the type check is the
only check it has had.**

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

## Detail pages, audit trails and live numbers

- **Nothing opens in a small pop-up any more.** A row in a table opens a **full page**:
  - the people table goes to its own route, `/users/:id` (`routes/user-detail.tsx`): Overview, Chanting (per mantra and every
    sitting), Daily record (day by day, with a chart), Reading & activity, Plan & wallet, and Audit log — one backend endpoint per
    tab, see "Active users, live presence and the per-person admin page" in [backend/CLAUDE.md](../backend/CLAUDE.md);
  - every other section's view opens through `DetailDialog` (`components/detail-dialog.tsx`), which **keeps its old props but now
    renders a page over the working area** (a portal into `#detail-root` in `components/layout/shell.tsx`) with a Back button; the
    browser's Back and Escape close it;
  - big editors (`<DialogContent page>` in `components/ui/dialog.tsx`: books, mantras, reference data, creators, verses, scenes,
    translations, roles, sloka, calendar, plan features, the translation / titles / reader dialogs) are full pages too, with the same
    Back handling. Quick questions (confirm, ban, change role, pick a verse) stay small on purpose.
- **Every detail page shows the audit trail for its record.** Pass `audit={{ entityType, entityId }}` to `DetailDialog` (or render
  `<EntityAudit scope=…/>`): it lists the staff changes recorded for that record (`GET /api/admin/audit?entityType=&entityId=`,
  before / after on demand) and, for a person, what they did as staff. It renders nothing for someone without `audit.read`.
  `entityType` is whatever the controller wrote (`Book`, `Mantra`, `Payment`, `Notification`, …); a record whose controller writes
  no audit rows (a store subscription, say) simply shows "Nothing recorded yet".
- **Live numbers** (`components/live-presence.tsx`, on the Dashboard and Analytics): online now / last 15 minutes / last hour,
  who is active, and a feed of people arriving and going quiet, updated by the websocket's `presence.update` (polled every 15 s
  when the socket is down). **Analytics** also has daily active users and sign-ups, weekly / monthly actives, stickiness, retention
  and today's platform split.
- Driven in a real browser against a local API and websocket: the live card, the person page and its tabs, analytics, and an audit
  row opening as a page and closing with the browser's Back. **Not driven:** the other sections' pages one by one, dark mode, and a
  narrow window.

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

## Titles in other languages

The **Books** page's row menu has **Titles in other languages** (**View titles…** without `book.write`), which opens
`components/book-titles-dialog.tsx`: the title of the book, each canto and each chapter in every reading language, with the
English beside it. A language is picked on the left (with how many titles it has, a tick when it is complete); every title is a
box on the right, grouped Book / Cantos / Chapters (or "Canto N chapters"), and a select narrows the list to **only those
without a title**.

- **A blank box is "no title in this language"**, and is how a wrong one is withdrawn — the app then reads the next language
  in the reader's chain, ending in English. English itself is never edited here: it is the source, carried through untouched.
- **Edits stay in the dialog until Save**, which sends one `PATCH` for each title that changed, all its languages together
  (`{ titleI18n }` replaces the whole map, so the other languages and `en` are sent back with it). A partial failure says
  "N of M titles saved" and leaves the rest as drafts; closing with unsaved changes asks first.
- **The English column is `titleI18n.en ?? title`.** The Gita's chapters keep the Sanskrit name in the plain `title` and the
  English heading in the map; showing `title` would call the Sanskrit "English".
- The languages come from `GET /api/admin/books/languages` (active reading languages but English, in display order), the
  book from the existing `GET /books/:id`. The dialog says seeded titles are AI-drafted and unreviewed, and that phones get a
  change with the next book export.
- Driven in a real headless Chrome against the local API (the Gita with 11 languages, then the Bhagavatam with 348 titles —
  about 75 ms a keystroke): English column, edit, blank, Save, the saved map checked through the API, the unsaved-close
  prompt, the missing-only filter and a second language. That script is not kept in the repo; the API side is
  `npm run test:book-titles`.

## Daily sloka

`routes/slokas.tsx`: pool health, today's delivery and the calendar. **Edit**, or a badge under *Unset days*, opens one dialog
for a day — which verse, and an optional background picture.

- **The verse is chosen, not typed.** `components/sloka-verse-picker.tsx` is four selects — Book → Canto (only for a book that
  has cantos, the Bhagavatam) → Chapter → Verse — with the verse's Sanskrit under them. Changing a select clears the ones below
  it, and the chosen verse id goes up through `onChange` (`''` until one is picked), so Save stays off until there is a verse. A
  chapter reads "Chapter n — title (k)", k being how many of its verses can be chosen.
- **Only the sloka pool is offered**, from `GET /api/admin/slokas/picker` (one request, `sloka.manage` alone — see "Setting a
  day's sloka" in [../backend/CLAUDE.md](../backend/CLAUDE.md)), so a verse the select can show is one the API accepts. To make
  more verses choosable, mark them eligible on the Verses page; the picker never widens itself.
- **Editing opens on the day's verse**, book down to verse filled in from its id. If that verse has since left the pool, the
  dialog says so in amber and Save stays off until another is chosen — the API would refuse it anyway.
- **The background picture** is an `ImageUploadField` (kind `slokaImage` in `lib/upload.ts`; JPEG, PNG or WebP). The dialog holds
  it as `Picture`, and a save sends `imagePath` **only if it was changed there**: left out, the day keeps its picture (so
  changing only the verse never loses it), a new key replaces it, `null` removes it. The field's optional `onBusyChange` says a
  file is still on its way, and **Save waits for it** — otherwise a quick save would go without the picture.
- **Uploads are never deleted** from storage when a picture is replaced or removed, as with reels.
- **Nothing in the app shows the picture yet** — it is stored and sent as `imageUrl`, no more; see the backend section.
- Driven in a real headless Chrome against the local API (choosing through both books, prefill on edit, upload, replace, remove,
  keeping the picture when only the verse changes, a verse that left the pool, a picker that fails to load, a phone-width
  window). That script is not kept in the repo; the API side is `npm run test:admin-sloka`.

## Translations

**Per-part models.** The start dialog has a row per part (Translation, Transliteration, Word meanings, Purport): tick it, pick provider, model and thinking effort. Rows that match share one request per verse; the estimate lists each group, and a running run shows one progress bar per group. Start is blocked if any chosen provider lacks its API key. The plan is sent as `plan` (see `Plan` in `lib/translation.ts`).

**Two books, two providers.** The page has a book switcher (Bhagavad-gītā / Śrīmad-Bhāgavatam, `?book=`); each book has its own languages grid, runs, import and output reader, and both can run at once. The start dialog picks the provider (disabled when its API key is missing) and model (default from `settings.providers`), shows the estimate with approximate cost before Start ("unknown" when the model has no price), and for the Bhagavatam chooses by canto (double-click a canto to pick chapters). Chapter ids for the Bhagavatam are canto × 100 + chapter; use `chapterName` / `cantoOf` from `lib/translation.ts`.

`routes/translations.tsx` (`/translations`, Content section, permission `translation.read`) is where an admin
starts, follows and reads the AI translation of the Gita (GPT-6 Luna by default; Claude and Gemini can take any part). The work happens in the backend's worker — see
"Translation runs" in [../backend/CLAUDE.md](../backend/CLAUDE.md) — so this page is a window onto it and holds
nothing that matters itself.

| File | Job |
|---|---|
| `lib/translation.ts` | Types, the queries and mutations (the import's are `useImportPreview`, `useImportTranslations`, `useImportRun`, `useCancelImportRun`; the vikara import's are `useVikaraStatus`, `useVikaraPreview`, `useImportVikaras`, `useVikaraRuns`), and `useTranslationLive()`, which patches the query cache from socket events: `translation.run` / `.activity` and the import's `translation-import.run` / `.activity` |
| `lib/socket.ts` | The one shared websocket: `useSocketEvent`, `useSocketStatus`, `useOnReconnect` |
| `routes/translations.tsx` | The page: health strip, **Runs** / **Output** tabs, in-progress cards, the language grid, history |
| `components/translation-run-panel.tsx` | One run in full: progress, spend, activity feed, Resume / Cancel (`PAUSE` maps a pause reason to what to tell the admin) |
| `components/translation-start-dialog.tsx` | New translation: language, chapters, verse limit, spending limit, a live estimate, and what blocks a start |
| `components/translation-import-dialog.tsx` | Import into the database: language, a live preview of what it would do (nothing is written until the button), chapters to tick, whether to make the result visible; then it follows the queued import live (status, progress bar, activity feed, **Cancel import**) and shows what was done |
| `components/vikara-import-section.tsx` | **The Bhagavatam's vikara tags**, a separate module on the same page (Runs tab, Śrīmad-Bhāgavatam only, between Languages and History): what the database holds (verses and links, a chip per vikara), the last import, and **Import from S3** (`translation.import`) |
| `components/translation-output.tsx` | The reader: language pills, an 18-chapter strip, a verse list with scores, and English beside the translation |
| `components/translation-bits.tsx` | Small shared pieces: status and score badges, progress bar, durations, money |

- **Nothing on the page is state worth losing.** The tab, the open run, the language, chapter and verse live in the
  URL (`?tab=runs|output`, `?run=`, `?lang=`, `?chapter=`, `?verse=`), the rest on the server, so a refresh or a pasted
  link lands on the same view. The only local preference is side-by-side vs. translation only
  (`hhb_admin_translation_view`).
- **The socket makes it live; polling makes it correct.** `translation.run` and `translation.activity` events, and the
  import's `translation-import.run` and `translation-import.activity`, patch the query cache directly, and a reconnect
  invalidates it. Polling is every 30 s while the socket is live, otherwise every
  4 s with a run in progress and 15 s without — so a dead websocket (a proxy that does not forward `/ws`) costs
  latency, not correctness. The header says **Live**, **Connecting…** or **Updating every few seconds**.
- **`lib/socket.ts` connects to `VITE_WS_URL`**, or when that is blank works the address out from `VITE_API_URL`:
  `/ws` on the API host (how production nginx serves it) and port 4001 on localhost, where the websocket is its own
  process (`WS_PORT`). So `VITE_WS_URL` is only for a setup that differs. It reconnects with backoff and jitter,
  renews the access token on close code 4001, pings every 25 s, and gives up quietly on 4003 (this role may not
  listen).
- **Start is gated by the server's overview**, not guessed: no API key for a provider the run would use (`OPENAI_API_KEY` for the default), the app's bucket not reachable (or without the Gita in it)
  or a bad `TRANSLATION_VERSION` disable it with the reason; "no worker online" only warns (the run waits in the
  queue). A second start for a language that has a live run gets a 409 and an "Open that run" link.
- **Without `translation.run` the page is read-only**: no Start, Resume / Try again or Cancel; View output stays.
- **A language already translated under the current version is not translated again.** Its card says "Up to date · version X" and
  its Translate button is off; verses Claude made under another version are counted as older, and the start dialog sends
  only those and the missing ones (the server decides — the page just shows `outdated` and `upToDate`). Everything current
  gives "already translated under version X. To translate it again, set a new TRANSLATION_VERSION", and Start is off.
- **Import** (`translation.import`; the box to make translations visible also needs `verse.publish`) is on every card with
  something saved, and not while a run or an import for that language is live. The dialog is mounted only while open and starts
  from the clicked language, so it never previews the wrong one. Changing the language or the visibility box previews again
  (`POST /imports` with `dryRun`, answered at once and never cached; it is the one part of an import that still runs in the
  request); chapters that have something to do arrive ticked. **The button queues the import and the worker does it**: the
  dialog switches to following that run (`useImportRun`: a status badge, a progress bar, the activity feed, the totals when it
  ends), and **Cancel import** (after a `confirm()`) asks the worker to stop after the chapter in progress, so what was
  imported stays. Closing the dialog does not stop it: the card shows "Importing into the database: n/m chapters" with a
  progress bar and an **Open import** button, the Health strip and the book tab count it, and Import is not offered on that
  card until it ends. A second import of the same language and book (another admin, another tab) gets a 409, and the dialog
  offers "Open that import"; while another is live it also disables its own button with a note. When a run ends the cards
  refresh to say what the database holds ("N in the database, M visible to readers · K from an older version"). **A verse
  already there is replaced in place, its id kept**; new ones are hidden unless the box is ticked. The dialog warns when the
  translations it replaces are visible to readers now, and that a verse edited by hand on the Verses page is replaced by what
  is in storage.
- **Vikara tags are a separate module, not part of a language's Import.** The Marathi translation run saves, apart from the
  language files, which of the six vikaras each Bhagavatam verse helps with (usually none) in
  `issues/json/srimad-bhagavatam/c<canto>-ch-<n>.json`; a language's **Import** never touches them. On the Śrīmad-Bhāgavatam's
  Runs tab a **Vikara tags** card shows the counts from the database (`GET /imports/vikaras`), the last import, and
  **Import from S3** (**Open import** while one is live). The dialog is the same shape as the language import: a dry run
  (`POST /imports/vikaras` with `dryRun`, answered at once, never cached, slow for 335 chapters) lists the chapters that have a
  tag file with *In storage / Tagged / None / To add / Already linked*; chapters with links to add start ticked; the button
  queues a run of `kind: 'VIKARA'` on the same worker queue, and the dialog follows it through the shared `ImportRunView`
  (status, progress bar, activity feed, **Cancel import**), then shows what was linked. **A verse that already has vikara
  links is left alone and nothing is ever removed**, so importing twice changes nothing; the six `Issue` rows must exist
  (`npm run seed`) or the card says so and the server refuses. One vikara import may be live (409, "Open that import").
  `AnyImportRun` (`kind: 'TRANSLATION' | 'VIKARA'`) is what the overview's `activeImports`, the run reads and the socket carry,
  so the language cards and the language dialog filter to `kind === 'TRANSLATION'`, and the book tab's "n active" counts both.
- **Only live imports are shown.** The page lists imports that are queued or running (`overview.activeImports`) and the one its
  dialog is following; finished ones are not listed anywhere yet (`GET /imports/runs` is there for a history view).
- The cards, the start dialog, the preview and the earlier, in-request import were driven in a real headless Chrome against a
  copy of the API reading a fake Gita folder (preview, import, import again, make visible, a read-only account); that script
  is not kept in the repo. **The queued import (following a run in the dialog, the progress block on the card, Cancel import,
  "Open that import") and the vikara module both type-check (`tsc -b`) and build (`vite build`) but were not driven in a browser**, and the panel has not
  run against a live worker. The API side is walked by `npm run test:translation` (section 12).

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

## AI usage and the OpenAI free tier

`routes/ai-usage.tsx` (`/ai`, permission `ai.read`) opens with `components/ai-free-tier-card.tsx` — the card for OpenAI's
free daily tokens — above the spend, coverage and recent-calls tables it already had. The rules live in
[../backend/CLAUDE.md](../backend/CLAUDE.md#openais-free-tokens-the-engine-chain-and-the-token-calculator); the card only
shows them and changes the settings, over `GET` / `PUT /api/admin/ai/free-tier`. **It is for chat only: book translation never uses the free models**, and the card says so.

- **The switch** (*Use OpenAI free tier*, the `Switch` primitive in `components/ui/switch.tsx`: a `role="switch"` button, name
  from `aria-labelledby`) is **off until someone turns it on**. Next to it, an amber note says what goes to OpenAI while it is
  on and to turn it off *before* data sharing is turned off at OpenAI. One select picks the free model for chat; the API accepts only the models it offers (`usableModels`) and the select reverts if the save is refused.
- **Without `setting.write` it is read-only** (a plain `admin` has `ai.read` but not `setting.write`): switch and select are
  disabled with a line saying why, and the API answers 403 to the `PUT` regardless.
- **Right now** lists what chat would try, in order, each with where the choice came from
  (`components/ai-engines.tsx`, shared with Ask Sakha — the number is the order). **Free tokens today** shows each pool against
  its 90% stop, and a table gives the day's count model by model with an *All models* total. The data refreshes every 30 s;
  the count is the app's own (the footnote says what it cannot see) and the day is UTC, with the reset shown in the viewer's time.
- **The token table scrolls inside its box on a phone** (`whitespace-nowrap`), not the page.
- **Recent calls** now show the model by default (it was hidden), so which provider answered is visible per call.
- Driven in a real headless Chrome against a second copy of the API and this dev server (a plain admin read-only and refused,
  the super admin's switch and (then) both selects saved and read back through the API — the translation select has since been removed — a model outside the list refused with the
  select reverting, everything put back through the page, phone width with no sideways scroll, dark theme, the Ask Sakha card
  against the API). That script is not kept in the repo; the API side is in `scripts/chat-e2e.js` section 17.
- `components/ui/badge.tsx`: the **warning** variant now reads `dark:text-warning`. Its foreground token is near-black in the
  dark theme, which is unreadable on the amber tint; the badge is shared by many pages ("Missing", "Paused", "Unpublished"…),
  all of which gained readable dark-mode text.

The free-tier card also has **Daily bonus for every reader**: the pool of tokens shared out each day (up to the large free pool)
and the most one reader gets; it shows today's share and the readers counted. Both save with *Save bonus* over `PUT
/api/admin/ai/free-tier`. The Ask Sakha limits gained **Open things in the app** (`appActions`, 1/0).

## Ask Sakha

`routes/chat.tsx` (`/chat`, System section beside AI usage, permission `chat.manage`; the sidebar and the page say
**Ask Sakha** — the route, the permission and the API path keep the name `chat`) is where staff run Sakha, the
devotional friend readers talk to. One file, a usage summary on top and three tabs, all over `/api/admin/chat/*`
(`backend/routes/admin/chat.js`):

- **Persona & limits** — `GET`/`PUT /settings`: the system prompt, the description the app shows (it names no sampradaya,
  and says plainly that Sakha is a digital companion, not a person — keep that line when editing), and the nine limits — the last two are **Pictures allowed** (`imageInput`, 1 or 0: whether a message may carry a picture; 0 switches pictures off for everyone and text still works) and **Picture size** (`imageMaxEdge`, 256–4096 pixels: a picture is kept and sent no larger than this on its longest side). A picture is sent to the model provider, so switching it off is the privacy lever. The persona never needs to mention pictures: the server adds its own note to the prompt only when a picture is really sent. "Reset to default" fills the field with the built-in default; saving an empty
  prompt or description also restores it. **A saved prompt or description replaces the built-in default**, so a
  changed default in `backend/config/chat.js` does not reach a database that already holds one — clear the field and
  save. `limits` is always sent whole.
- **Plan allowances** — `GET /plans`, `PUT /plans/:planId`, one row and one Save per plan: level name
  (Sadhaka / Arta / Jijnasu / …), enabled, daily tokens (0 = no cap), wallet tokens (what 100% of the user's meter means),
  renewal, per-conversation tokens (0 = no cap), model tier. A plan with `config: null` uses the free plan's
  allowance and is badged so.
- **Wallets** — `GET /wallets?q=` (searchable, paged), then `GET /users/:userId` for balance, allocation, today's
  use, the meter percent, period end and the last 50 ledger rows. **Grant** (`POST …/grant`, tokens above 0) and
  **Adjust** (`POST …/adjust`, signed) both require a note; both land in the ledger and the audit log.
- **Usage** — `GET /stats`: conversations, messages, active users and tokens by ledger source for the last 30 days.

Above the tabs, **Answering with** says which provider and model are behind a reply: three lists — replies, replies on the
stronger tier, chat summaries — each in the order it is tried (`engines` in `GET /settings`, drawn by `components/ai-engines.tsx`),
with a link to the free-tier card on AI usage when the person has `ai.read`. It shows what is configured, not what is healthy:
a first row naming a model that has been retired still reads as first while the `fallback` row behind it is the one answering
(the Model column on AI usage → recent calls shows which engine really did).

Raw token numbers appear only on this page; readers in the app see a percentage. Every query key starts with
`chat`, so one invalidation refreshes the page after a write.

## Scenes page

`routes/scenes.tsx`, `components/scenes-run.tsx` (run panel, start dialog), `components/scenes-viewer.tsx` (reading-style view with copy and download), `lib/scenes.ts`. State is in the URL (`tab`, `canto`, `chapter`, `run`). Permissions `scenes.read` / `scenes.run`.

**The start dialog chooses the AI provider and model** with the shared `components/model-picker.tsx` (see "Hindu calendar" below): a provider list that says where its key is missing, and that provider's models with their prices; a model the run cannot use is listed but cannot be picked, with the reason. The estimate is asked again for the choice (`?provider=&model=`) and shows its cost and time; **the free-tier request and token limits are shown only for Gemini**. The server refuses a provider with no key or an unusable model (422) and the dialog shows its message. The run panel names the provider and model of the run. Type-checks (`tsc -b`) and builds; not driven in a browser.

## Narration page

`routes/narration.tsx` (**Content** group, nav label "Narration (AI voices)", permission `narration.read`; the buttons need `narration.run`) and `lib/narration.ts`. Two tabs, kept in the URL (`tab`, `run`, `compare`): **Runs** (the active runs with progress, the engine's counts, the activity feed, Resume / Cancel, and a table of all runs; *New narration run* opens a dialog with book, language, engine / model / voice, chapters and *make again*, and shows an estimate of verses, characters, requests, time and cost before it starts) and **Compare voices** (one verse in up to six voices, then an audio player for each clip once made). The top card is the checklist: storage, worker, and each engine's key. An engine's price is shown as "not verified" until `price.verified` is true, and "no price known" gives no cost. Live through the websocket events `narration.run` and `narration.activity` (`narration.clip` is not used by the page), with polling as the fallback. `npm run build` passes, and the page was driven in a real browser (Playwright) against a local API and a throwaway database: the checklist, the start dialog and its estimate, a paused run, and a finished comparison with its audio players rendered. The websocket, a live worker and real audio were not exercised.

## Book reader and book auditor

Books → row menu → **Read verses** opens `components/book-reader-dialog.tsx`: one chapter at a time, in a chosen language, laid out like the website's reader (Sanskrit, transliteration, word meanings, translation, purport; unpublished translations marked). It is read-only for everyone except the **`book_auditor`** role, which alone holds `book.audit` — **super admin and admin are deliberately excluded** (`AUDITOR_ONLY` in `backend/config/constants.js`). The auditor gets a pencil beside each piece; saves go to `PATCH /api/admin/verses/:verseId/content` and `PATCH /api/admin/verses/:verseId/translations/:translationId` (audited as `verse.audit` / `verse.translation.audit`). Reading uses `GET /api/admin/books/:id/reader`. Not run in a browser or against a database. The older Verses page still lets `verse.write` holders edit word meanings. Production needs `npm run seed` (adds the permission and role), then assign the role in Users / Roles & permissions.

## Admins, Add user, Add admin

The **Admins** page (`routes/admins.tsx`, permission `role.manage`, so super admin only) lists users whose role carries any permission (`GET /api/admin/users?staff=true`). **Add admin** and **Add user** (Users page, `user.write`) both post to `POST /api/admin/users` with an email: the API makes a placeholder account (`authProvider = LEGACY`, the same one the old-app carry-over uses) with the chosen role, and the first Google or Apple sign-in with that address adopts it and keeps the role (`claimLegacy`). Any role other than `user` needs `role.manage`. No migration and no seed change. Add creator picks an existing account, so add the person first. The Users list has a **Location** column (city, district, state, country from the person's IP address, blank until they have been seen with the location database installed) and the person's page a *Location (from IP)* row — see "Where a person is (IP location)" in [backend/CLAUDE.md](../backend/CLAUDE.md). Type-checks; not driven in a browser.

## Finance

`/finance` (`routes/finance.tsx`, nav System → Finance, permission `finance.manage`, super admin only). A month picker; revenue (gross, commission, net, refunds, free trials as ₹0), AI cost by kind with the dollar rate editor, credits and debits (add / edit / delete), a twelve-month table, and **Confirm month** (fixes that month's dollar rate and stops the reminder; Reopen undoes it). `components/finance-banner.tsx` shows an amber bar on every page for the super admin while last month (or this month, in its last two days) is unconfirmed. See "Finance" in [backend/CLAUDE.md](../backend/CLAUDE.md).

## Notifications: picture, style, tap target, buttons

The Notifications page (`routes/notifications.tsx`) sends a title and body and, optionally, a **picture** (uploaded with kind `pushImage`, or a pasted `https://` link), a **style** (automatic / big picture / big text), an **importance** (urgent / quiet), a **tap target** and up to **two buttons**. The tap targets are the app's own words (`lib/push-link.ts` — Ask Sakha, Jap, Read, Reels, a mantra, a reel, a verse …) and must match `backend/utils/push-rich.js` and the app's `push_link.dart`. A live **preview** (`components/push-preview.tsx`) draws Android and iPhone, collapsed and expanded; it is an approximation drawn in the page, not a real device. Send stays disabled while a picture uploads or a target is missing a value. Type-checks (`tsc -b`); not driven in a browser.

## Support

`routes/support.tsx` (**Users** group, permission `support.manage`): the list of tickets and feedback with filter chips (status, ticket or feedback, category, 2/3 stars or less) and search, a summary row (open, in progress, resolved, average rating), and a dialog per row with the sender, the device details the app attached, the screenshot, the conversation, a status select and a reply box. Replying pushes the reader (`/api/admin/support/...`, see "Support, feedback and the store-rating prompt" in [backend/CLAUDE.md](../backend/CLAUDE.md)). The push composer's tap targets gained `support` and `ticket` (keep `lib/push-link.ts` in step with `backend/utils/push-rich.js`). Type-checks (`tsc --noEmit`); not driven in a browser.

## Quotes page

`routes/quotes.tsx` (**Content** group, `/quotes`, permission `quote.manage`, icon `Quote`; `router.tsx` wraps it in `<Protected permission="quote.manage">`). A copy of the Devotee etiquette page: counts, a table (search over the quote and its reference, status and "missing in…" filters), `components/quote-item-dialog.tsx` (the quote, author, reference, source name and link — **all required** — publish / hold back / exclude with a reason, and each language's translation by hand), and a **Translations** tab (`components/quote-run.tsx`, only with `quote.translate`: estimate, provider and model, live panel over `quote.run` / `quote.activity`, Resume, Cancel). Client and types are `lib/quote.ts`; the API is `/api/admin/quotes` — see "Quotes" in [backend/CLAUDE.md](../backend/CLAUDE.md). Type-checks (`tsc`) and builds (`vite build`); not driven in a browser.

## Devotee etiquette page

`routes/etiquette.tsx` (**Content** group, `/etiquette`, permission `etiquette.manage`, icon `Flower2` in `lib/nav.ts`; `router.tsx` wraps it in `<Protected permission="etiquette.manage">`). Two tabs. **Etiquette**: overview cards (items by status, translated by language, the delivery time, today's item), filters (category, status, language, untranslated) and search over title, summary, body and slug, and a table; a dialog (`components/etiquette-item-dialog.tsx`) adds or edits an item (its limits mirror the columns: title 160, summary 300, body 4000, reference 200, author 200, source name 120; **every item needs an author** — the speaker of the verse, or the teacher or temple that published the page — so the dialog will not add an item, or save an old one that has none, until it is filled in; the table has an Author column), publishes, holds back or **excludes** it (an exclusion asks for a reason and the item stays in the database, never shown or pushed), and shows and edits each language's translation by hand (an edited translation is kept by every later run). **Translations** (`components/etiquette-run.tsx`, shown and used only with `etiquette.translate`): pick a language, see the estimate, optionally a provider and model, start a run, watch the live panel (progress, tokens, the activity feed over the websocket events `etiquette.run` / `etiquette.activity`), and Resume or Cancel. The client and types are `lib/etiquette.ts`. The API is `/api/admin/etiquette` — see "Devotee etiquette" in [backend/CLAUDE.md](../backend/CLAUDE.md). Type-checks (`tsc -b`) and builds (`vite build`); not driven in a browser. The push composer has no etiquette tap target (the daily push is the only one that sends it).

## Prayers page and its translations

`routes/prayers.tsx` (**Content** group, `/prayers`, permission `prayer.manage`, icon `HandHeart` in `lib/nav.ts`; `router.tsx` wraps it in `<Protected permission="prayer.manage">`) exports `PrayersPage`. A prayer is a devotional text of several verses that a reader says or sings (a guru vandana, an aarti, a morning prayer). **It is not a mantra's opening prayer** (`Mantra.prayerMantraId`, see "Mantra chanting time and opening prayer" above), so every new name is `Prayer*` / `prayers*`. The page is an overview row (shown to readers, drafts, verses, and a by-category line), a **New prayer** button and two tabs: **Prayers**, a table (category and status filters, search, the editors' own order by default; Open, Publish, Hold back and Delete in the row menu, and bulk Publish / Hold back), and, **only for someone who also has `prayer.translate`**, **Translations** (without the permission the tab bar is not drawn). What matters is in the URL: `?item=<id>` the open prayer, `?tab=translations`, `?run=<id>` the open run, and `?translate=<code>` a language to start (a prayer's language editor links there; the link is spent as soon as the dialog opens). The API is `/api/admin/prayers` — see "Prayers" in [backend/CLAUDE.md](../backend/CLAUDE.md). Built like the Devotee etiquette page (the items) and the Hindu calendar's Translations tab (the runs):

| File | Job |
|---|---|
| `lib/prayers.ts` | Types, constants (the status and "how a language gets its script" labels, the eight starter categories, the twelve languages a prayer can be written in), every query and mutation, and `usePrayersLive`: the websocket events `prayer.run` / `prayer.activity` only make the queries current sooner, and polling (30 s with a socket, 4 s while a run is busy, 15 s otherwise) covers a missing socket |
| `routes/prayers.tsx` | The page: overview, the two tabs, the table and its bulk actions |
| `components/prayer-dialog.tsx` | One dialog for one prayer. `NewPrayer` sends the details and the pasted verses as one request, as a draft; `ExistingPrayer` holds the English details, the verses, the languages, and publish / hold back / delete. Its limits mirror the columns (title 200, summary 400, author, reference and source name 200, source link 500) |
| `components/prayer-form-bits.tsx` | The small parts the dialog and its editors share (the dirty-key helper, the error line, the character counter, the verse font stack), kept apart so the files do not import each other in a circle |
| `components/prayer-verses-editor.tsx` | The ordered list of verses, original and English meaning side by side: move up / down, remove, **Paste several** (split on blank lines), at most 400. Saved as one list; a row without an id is new |
| `components/prayer-language-editor.tsx` | A prayer's languages: a chip per language with its state (translated, partly, missing, out of date, hand-written), then the heading (title, summary, about; not for English) and each verse's rendering and meaning |
| `components/prayer-run.tsx` | One run in full (progress, tokens, why it stopped, the activity feed, Resume / Cancel) and **the start dialog: language, "Translate again", provider and model through the shared `components/model-picker.tsx`, a live estimate, and what blocks a start** |
| `components/prayer-translation-section.tsx` | The Translations tab: runs in progress and the queue, a card per language (how many published prayers it holds, partly, missing, out of date, hand-written, and how it gets its script), and the history of runs |

- **A verse is never translated, only spelled; only prose is translated.** A run writes each prayer's title, summary and about and each verse's meaning in the language, and writes the verse out in that language's script where a rule cannot. How a language gets its script is the server's answer (`how`): `same` (the original's own script; nothing is stored and the editor says the verse is shown as the original), `rule` (converted automatically when read; the editor shows the rule's output and an override per verse, and an empty override means "use the automatic one") or `model` (a stored rendering, written by a run or by hand). English as a run language gives only the Roman rendering, with no heading and no meaning.
- **Words an editor wrote are never replaced by a run**, even with "Translate again" (kept per row, `isEdited`). A rendering whose original was changed after it was written shows **Out of date**; a run rewrites those, and the page counts them.
- **Runs cover published prayers only**; a draft is skipped until it is published. A start is blocked in the dialog when the chosen provider has no key (the message names the setting), when the model cannot be used, when everything is already translated, or while a run into that language is live ("Open that run", from the 409's `details.runId`). "No worker is online" only warns: the run waits in the queue.
- **Verses are saved as one ordered list with stable ids**, so a verse keeps its translations when it is moved or edited. Removing a verse deletes what was written for it in the other languages, so the editor asks first; changing the language a prayer is written in, when translations exist, asks first as well (every rendering was made from the old text and will show Out of date).
- **Unsaved work is guarded.** Each editor reports whether it is dirty to the dialog (the same registry the other dialogs use); closing the dialog, leaving a language for another, or following the link to the Translations tab asks before throwing it away. The language editor takes the server's copy again only while it is clean, so a socket refetch (a run finishing) never overwrites an edit in progress.
- **Known limitation:** the route is gated on `prayer.manage`, so someone with `prayer.translate` alone cannot reach the page. Both built-in roles (admin, super admin) have both; the migration `20261114000000_prayers` grants them.
- **Written against the plan's contract before the backend routes existed**; the backend (`routes/admin/prayer.js`, `controllers/admin/prayer.js`) now exists and its overview field names (`counts`, `categories`, `publishedTotal`, `translation`, `active`) were checked against the page's reading of them, but the page itself has never been driven against it, so they are still the first place to look if a card shows nothing. No tests were written for it.
- Type-checks and builds; not driven in a browser.

## Hindu calendar page and its translations

`routes/calendar.tsx` (`/calendar`, **Content** group, nav entry gated on `panchang.manage`) exports `CalendarPage`, which is the month grid (`CalendarMonth`: generate a year, edit a day or a festival, the Push and Shown switches, the place) and, **for someone who also has `panchang.translate`**, a second tab, **Translations** (`?tab=translations`; the tab is in the URL and the tab bar is not drawn at all without the permission, so a calendar editor sees the page as before). The translation side is in four files, built like the Devotee etiquette page's Translations tab, and the API is `/api/admin/panchang/translation` — see "Hindu calendar" in [backend/CLAUDE.md](../backend/CLAUDE.md):

| File | Job |
|---|---|
| `lib/calendar-translation.ts` | Types, the queries and mutations, and the live patching of the query cache from the websocket events `calendar.run` / `calendar.activity` (polling covers a missing socket) |
| `components/calendar-translation-section.tsx` | The tab: in-progress runs, a card per language (how many of the calendar's words it has, how many were written by hand), the words themselves (search, filter by kind and by translated / missing / edited, correct one by hand, delete one so a run writes it again) and the history of runs |
| `components/calendar-translation-run.tsx` | One run in full (progress, tokens, why it stopped, the activity feed, Resume / Cancel) and **the start dialog: language, "translate again", provider and model, a live estimate, and what blocks a start** |
| `components/model-picker.tsx` | **The provider and model choice, shared with the Scenes start dialog.** The list of providers and their models comes from the server (`overview.translation.providers` here, `settings.providers` in Scenes), so a model added to `backend/scripts/lib/translate-providers.js` appears with no panel release; a provider whose key is missing says which setting, and a model the run cannot use is listed with the reason and cannot be picked. A model that is not listed can be typed (the server validates it) |

- **Words an editor wrote are never replaced by a run**, even with "translate again"; the card says how many there are. A hand edit marks the row `isEdited`.
- **Gating:** a start is blocked in the dialog when the chosen provider has no key (the message names the setting), when the model cannot be used, when everything is already translated (the server's 409 `upToDate`), or while a run into that language is live ("Open that run"). "No worker online" only warns, as elsewhere: the run waits in the queue.
- **Known limitation:** the route is gated on `panchang.manage`, so someone with `panchang.translate` alone cannot reach the page. Both built-in roles (admin, super admin) have both.
- The pre-existing `lib/calendar-icons.ts` carries the Parana icon; keep it in step with the app's and the website's copies.
- Type-checks (`tsc -b`) and builds (`vite build`); **not driven in a browser**.

## Marketing page

`routes/marketing.tsx` (tabs Campaigns / Templates / Audiences) with `components/marketing-campaign.tsx` (editor dialog and
the detail dialog: live progress, controls, funnel, links, failures, feed), `marketing-template-editor.tsx` (a variant per
language, block editor, sandboxed preview, test send to yourself, approve, AI draft/translate with `ModelPicker`),
`marketing-audience-filter.tsx` (filter with a live count) and `marketing-audiences.tsx` (segments, lists, CSV import with
the consent attestation, do-not-send lookup). `lib/marketing.ts` has the types and keeps queries current from the
`marketing.run` / `marketing.activity` events. Permissions: `marketing.read` to see, `.manage` to prepare, `.send` to start /
schedule / pause / resume / cancel. `tsc -b` and `vite build` pass; **the page was not driven in a browser.** See "Marketing"
in backend/CLAUDE.md.
