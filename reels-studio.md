# Admin-generated scripture Reels ("Reel Studio")

## Context

Reels today only exist by hand: `npm run seed:reels` or a row typed into Prisma
Studio. The root `CLAUDE.md` deliberately left *creator* publishing unbuilt —
that gate exists because an outside creator's upload needs a reviewer before
it's trusted. Staff setting up official scripture content is a different
case: the admin *is* the reviewer, there's nothing to moderate.

The ask is to let an admin design a reusable visual "look" once (background
image/video, logo, font, a simple animation) and then mass-produce Reels from
Bhagavad Gita / Srimad Bhagavatam verses against that look — with the verse
text itself shown in whatever language the *viewer* reads, including
transliteration for South Indian readers who don't read Devanagari.

Two architecture questions were resolved with the user before writing this
plan:

1. **Text is rendered client-side, at watch time** — not baked into a video
   file per language. A generated Reel is a `(template, verse)` pair; the app
   draws the verse text over the template's background live, resolving it
   through the *same* per-language chain already used for verse translations
   (`backend/utils/language.js`). This matters because the backend has **no**
   ffmpeg/sharp/canvas anywhere in the running app today (confirmed by
   exploration — the only `ffmpeg` reference is a dev-only seed script never
   installed in the Docker image), and the project runs on a single $15/mo
   EC2 box with no spare CPU for video encoding. Baking would mean installing
   ffmpeg + fonts in the worker image and doing real encoding work; rendering
   live costs nothing extra the app doesn't already pay for a caption.
2. **The admin "canvas" is a live preview with drag-to-position, not a full
   layered editor.** The admin panel has no canvas/form library today (forms
   are plain `useState` + a `Dialog`, per `admin/CLAUDE.md`'s own "nothing
   justifies a form-generation layer yet"). A Fabric.js/Konva editor would be
   several times the effort for a first version. Instead: a form for the real
   choices (background asset, logo asset, font, animation) plus one preview
   panel showing them composed with a sample verse, where the logo and the
   text box are dragged to position and that position is saved as x/y/size
   numbers.

## What already exists and will be reused as-is

- **Per-language verse text** — `Verse.sanskrit`/`transliteration` and
  `VerseTranslation` (per `verseId` × `translatorId` × `languageCode`) already
  cover exactly this. `backend/utils/language.js`'s `readingChain(user)` +
  `pick(rows, chain)` / `localised(row, ...)` is the existing resolver — reuse
  it verbatim, the same way `present.js` already resolves `ReelAudioTrack` by
  language.
- **S3 upload flow** — `backend/services/s3.js` (`PREFIXES`,
  `ALLOWED_CONTENT_TYPES`, `presignUpload`/`presignFields`) and
  `controllers/admin/upload.js` + `routes/admin/upload.js` (presign → PUT →
  verify) need only new `PREFIXES` entries, not new machinery.
- **Admin CRUD shape** — `controllers/admin/reference.js` / `routes/admin/*`
  pattern (one file per resource, `createRouter({tag, prefix, description})`
  from `utils/router.js`, audit-logged). `utils/crud.js`'s generic builder is
  *not* used here — per its own documented boundary, a resource with real
  behavior (JSON config, generation logic) doesn't fit it.
- **Admin frontend shape** — flat `routes/*.tsx`, local `useState` forms in a
  `Dialog` (see `books.tsx`/`mantras.tsx`), `useResourceList`/`useResource`
  wrappers over `lib/api.ts`. No react-hook-form/zod in this app — don't
  introduce one for just this feature.
- **BullMQ jobs** — `jobs/processors/ai.js`'s shape (loop rows,
  `job.updateProgress(...)`, write straight to Prisma, no separate `Job`
  table) is the template for the one background job this feature needs.

## Phase 1 — Backend

**Schema** (`backend/prisma/schema.prisma`):
- New `ReelTemplate` model: `id`, `name`, `isActive Boolean @default(true)`,
  `config Json` — one JSON blob, documented inline with its shape like every
  other `Json` field in this schema:
  ```prisma
  config Json
  // {
  //   background: { type: "IMAGE"|"VIDEO", path: string },
  //   logo:      { path: string, x, y, widthPct } | null,
  //   text:      { x, y, widthPct, fontFamily, fontSize, color, align },
  //   animation: { type: "NONE"|"FADE_IN"|"KEN_BURNS", durationMs }
  // }
  ```
  Plus `createdBy` (admin user id), timestamps.
- `Reel.templateId String?` + relation to `ReelTemplate`, and `Reel.verseId`
  (already exists) becomes the verse whose text is rendered. Deliberately
  **not** a new `ReelMediaType` — `mediaType` keeps meaning "what plays"
  (video/image background), `templateId` is the orthogonal "overlay verse
  text on it" flag. Add a unique constraint on `(templateId, verseId)` so
  "generate" can't double-create the same reel.
- Verify (during implementation) whether `Reel.creatorId` is required and
  whether an official/system `CreatorProfile` already exists (the existing
  test fixtures use a `HariHariBol` display name for non-user reels — check
  `prisma/seed/` for it). If none exists, seed one `CreatorProfile` owned by
  no end user, `status: APPROVED`, to own every generated reel.

**S3** (`backend/services/s3.js`): add `reelTemplateBackground` and
`reelTemplateLogo` prefixes; allow `video/mp4` for the background kind
(reusing the existing MP4-only rule) and image types for the logo.

**Admin controllers/routes** (new files, mirroring existing 1:1 naming):
- `controllers/admin/reelTemplate.js` + `routes/admin/reelTemplate.js` —
  plain list/get/create/update/remove for `ReelTemplate`, audit-logged like
  every other admin write.
- `controllers/admin/reel.js` + `routes/admin/reel.js` — the first admin
  controller for `Reel` itself:
  - `GET /api/admin/reels` — paginated list, filterable by `templateId` /
    `bookNumber`, for the "manage generated reels" screen.
  - `POST /api/admin/reels/generate` — body `{ templateId, bookNumber,
    chapterNumber?, count? }`. Looks up matching `Verse` rows not already
    paired with that template (the unique constraint above), inserts one
    `Reel` per verse: `mediaType` taken from `template.config.background.type`,
    `templateId`, `verseId`, `creatorId` = the system creator,
    `status: 'PUBLISHED'`, `publishedAt: now()` — no moderation queue,
    because there's no outside submitter here. Runs synchronously for small
    batches (≤200 verses); above that, enqueue a `reel` BullMQ job
    (`jobs/processors/reel.js`, same shape as `jobs/processors/ai.js`) so a
    "generate all of Bhagavatam" request doesn't block the request thread.
  - `DELETE /api/admin/reels/:id` — for pruning a bad batch and regenerating.

**Presenter** (`backend/utils/present.js`): when `reel.templateId` is set,
additionally resolve and attach:
- the template's `config`, with `background.path`/`logo.path` signed to URLs
  the same way other media fields are (`presignFields`/`presignGet`);
- the linked verse's text for the caller, via `readingChain(user)` +
  `pick`/`localised` — `{ sanskrit, transliteration, translation }` — as a new
  `templateVerse` field on the reel payload.

## Phase 2 — Admin UI

New sidebar section "Reel Studio" (per `admin/CLAUDE.md`'s flat structure,
two resource files, not a nested `reel-studio/` folder):

- `admin/src/routes/reel-templates.tsx` — a `DataTable` list of templates
  (name, background thumbnail, active toggle) and a create/edit `Dialog`
  containing:
  - plain fields for name, background type/asset (upload via the existing
    `POST /api/admin/uploads` presign flow — this is the **first** admin
    screen to actually use a file picker, since none exists today), logo
    asset, font choice, font size/color, animation choice;
  - a preview panel — one new shared component `admin/src/components/
    template-preview.tsx` — that renders the chosen background `<img>`/
    `<video>` with the logo and a sample verse text positioned absolutely on
    top; both are plain `position: absolute` elements dragged via pointer
    handlers that update `x`/`y` (as percentages) in the form's local state.
    No canvas library needed.
- `admin/src/routes/reels.tsx` — a `DataTable` of generated reels (verse
  reference, template, status, view count) plus a "Generate" dialog: pick a
  template, pick a source (book + chapter, or a count of "next unused"
  verses), submit → calls `POST /api/admin/reels/generate` and shows the
  created count (or, for a large batch, "queued" with a link to
  `/api/admin/jobs`, reusing the existing jobs screen rather than building a
  new progress UI).

Font choice should be limited to whatever fonts the Flutter app actually
bundles (check `app/pubspec.yaml`/`assets/fonts` during implementation) so
"font style" picked in admin is guaranteed to render as chosen on device —
this list is a small hardcoded dropdown, not free text.

## Phase 3 — App (Flutter)

- `app/lib/models/reel.dart` — add `templateId`, a nested template-config
  model (background/logo/text/animation, mirroring the backend JSON shape),
  and `templateVerse` (`sanskrit`/`transliteration`/`translation`, all
  nullable — the resolver may not have a match in every language).
- `app/lib/widgets/reels/reel_template_player.dart` (new) — background layer
  (`ReelVideoPlayer`-style loop if `background.type == VIDEO`, else
  `AppImage`) + a positioned logo `AppImage` + a positioned verse-text
  `Text`, animated per `animation.type` (`AnimatedOpacity` for fade-in, a
  slow `Transform.scale` tween for ken-burns, nothing for none). `isActive`
  gates animation start/stop the same way `ReelVideoPlayer`/`ReelAudioPlayer`
  gate playback.
- `app/lib/widgets/reels/reel_page.dart` — `_media()` gets a new first branch:
  `if (reel.templateId != null) return ReelTemplatePlayer(...)`, ahead of the
  existing `isVideo`/`isAudio` branches.
- `app/lib/widgets/reels/reel_grid_tile.dart` — templated reels get their own
  badge glyph (e.g. `Icons.auto_awesome_rounded`) ahead of the
  video/audio/collections check, so a scripture reel reads distinctly in a
  grid.

## Verification

- Backend: extend the existing `npm run test:reels`-style script (or add a
  focused one) asserting `POST /api/admin/reels/generate` creates exactly one
  `Reel` per matching verse, skips verses already paired with that template,
  and that `present.reel` resolves `templateVerse` correctly for a caller
  with a South Indian reading language (transliteration present, no raw
  Devanagari assumed).
- Admin: run the dev server, create a template end-to-end (upload a
  background + logo, drag both into position, save), run "Generate" against
  a small chapter, confirm the reels list shows the new rows.
- App: `flutter analyze` (clean) and `flutter test`, including a new
  `reel_template_player_test.dart` mirroring `reel_page_test.dart`'s
  conventions (renders without exception, shows the resolved verse text,
  respects `isActive`).

## Open items to confirm while implementing (not blocking the plan)

- Whether `Reel.creatorId` is nullable or needs a seeded system
  `CreatorProfile`.
- The exact font family list the Flutter app already bundles, to constrain
  the admin's font dropdown to what will actually render.
