| Subscriptions | Built on all three parts. Plans (tiers, with a real `free` baseline), a price per provider × billing period (optional free trial), and a feature catalogue with a value per plan — all editable in the admin panel's **Plans** page, so benefits added later need no schema change. Google Play and App Store purchases are bought via `in_app_purchase` and verified server to server; donors keep the donor plan permanently. **The paid plans are the four devotees of Gita 7.16 — Ārta, Jijñāsu, Arthārthī, Jñānī (₹49 / ₹99 / ₹199 / ₹399 a month)** over Free; what they add is Ask Sakha, and the Plans screen says it in replies a month, never tokens. Product ids `<slug>_monthly` still have to be created in the Play Console and App Store Connect, and **production needs `prisma migrate deploy`** for `20261024000000_devotee_plans` (it does not run the seed). See [backend/CLAUDE.md](backend/CLAUDE.md). `npm run test:subscriptions` walks it. |
| Reels | Built end to end, consumer side. Feed (ranked, watch-aware), player, view/like/comment/share/save/report, one-level comment threads, creator profiles and following, and the text an admin laid over a reel (`models/reel_overlay.dart`, `widgets/reels/reel_overlays.dart`). `npm run seed:reels` puts six playable demo reels on a laptop. **Creator self-publishing is deliberately not built** — see below. **Reels is the last tab of the bottom bar (Read is the third)**, edge to edge under a dark bar, and pauses itself when another tab or a screen (the chat) is over it; the routine moved from the bar to a screen opened from a Home card to make room. |
# HariHariBol

A spiritual learning platform: Vedic verses, mantras, narrations, chanting.

This is a **deliberate rebuild**. The previous version grew too complex to navigate and was retired. Its full source is archived on the `unorganized` branch — read from it with `git show unorganized:<path>`, don't copy its patterns forward.

## Layout

| Dir | What | Rules |
|---|---|---|
| `app/` | Mobile app (Flutter) | [app/CLAUDE.md](app/CLAUDE.md) |
| `backend/` | API (plain Node.js) | [backend/CLAUDE.md](backend/CLAUDE.md) |
| Ask Sakha (chat) | **Built on all three parts; backend walked end to end (`npm run test:chat`, provider faked).** Readers chat with **Sakha**, a devotional friend, under the name **Ask Sakha**; "AI chat" survives only in code, the `/chat` routes and these docs, and no string a reader sees says "AI", "assistant" or "bot". Sakha is branded, not disguised: it never claims to be a person, and the description the app shows says in one plain line that Sakha is a digital companion and names no sampradaya. **A reader has one conversation** — no list; the chat opens from **the raised centre button of the bottom bar** (Home · Jap · **Sakha** · Reels · Read; its icon is `app/assets/sakha_icon.svg`, a placeholder until the real one is dropped in) and from a card on Home, and a button in the app bar clears it (the summary Sakha remembers goes with it). The app has token-by-token streaming, stop / answer again / try again, a credit meter on the title's line and an upgrade card, a welcome with horizontal starter cards and quick replies, **a picture with a message** (one per message, re-encoded and stripped of its location on the server, kept until the chat is cleared or the account deleted, only the newest sent to the model) and **speaking a message** with the phone's own recogniser (the words land in the box and are never sent by themselves) — see "AI chat" in [app/CLAUDE.md](app/CLAUDE.md); the admin **Ask Sakha** page edits persona, limits, plan allowances and wallets. Sakha is for every tradition and faith: its heart is Vaishnava bhakti, which it shares by gentle invitation — one small step at a time, never pressure — and it **names no sampradaya** to readers (but never denies its outlook if sincerely asked), respectful of other traditions, behind the provider-agnostic `services/ai/` (Gemini and OpenAI both stream). **A failure never reaches a reader as a system message:** a stream error carries a fixed line and a code (`backend/utils/chat-errors.js`), and the app words every case itself, in the reader's language — offline, timed out, connection lost, busy, not available, could not finish, wait, too long, chat full. Context is kept small: persona + a running `contextSummary` + the newest few messages, older ones folded in by the cheap model **in the background after a reply, never before it** (a reply does not wait for the summary; one tidy at a time per conversation). **Sakha greets the reader by first name without the name ever being in a prompt:** the model writes a `{name}` placeholder and the server fills it in as the reply streams out (`backend/utils/chat-name.js`); the database keeps the placeholder. Every AI operation debits one token wallet per user with a ledger; readers see a credit meter, never tokens; per-plan allowances, daily cap (resets at the user's local midnight), model tier and the persona are edited in the admin **Ask Sakha** page. See "AI chat" in [backend/CLAUDE.md](backend/CLAUDE.md). **The OpenAI provider has been run live (`gpt-6-luna` and `gpt-4o-mini`, streaming and not); the chat as a whole has not been run against a real provider, nor on a phone against a live API; no picture has reached a real model, and voice, camera and photo picking have not run on a device** (Gemini's default `gemini-2.0-flash` is no longer served — it answers 404); the 11 non-English translations are AI-drafted. |
| `admin/` | Admin panel | [admin/CLAUDE.md](admin/CLAUDE.md) |
| `website/` | Public landing page (React, prerendered) | [website/CLAUDE.md](website/CLAUDE.md) |

Each part carries its own rules file. Read the relevant one before writing code in it.

## Guiding principle

**Simple over clever.** The last rebuild failed because the owner could not find his own routes and controllers. Every structural decision is judged by one question: can a developer open the repo and find the thing they're looking for without being told where it is?

- Predictable folder names over clever abstraction
- Flat over deeply nested
- Obvious file names — `routes/app/user.js` beats `modules/users/infrastructure/http/user.routes.js`
- Don't add a layer until it earns its place

## Conventions

**Commits** — `<type>: <description>` under 70 chars. Types: `feat`, `fix`, `refactor`, `docs`, `chore`.

**Branches** — `feat/<name>`, `fix/<name>`.

**Secrets** — never committed. `.env`, Firebase configs (`google-services.json`, `GoogleService-Info.plist`, `firebase_options.dart`) and Android signing keys (`key.jks`, `key.properties`) are gitignored. Local copies of the previous project's are backed up outside the repo at `../hariharibol-local-secrets/` — the Android keystore there is irreplaceable.

**App text** — a string added to `app/lib/l10n/app_en.arb` is translated into every other `app_*.arb` in the same change. `app/test/l10n_parity_test.dart` fails when one is missing; see [app/CLAUDE.md](app/CLAUDE.md).

**CI and deploys** — `.github/workflows/` builds the backend and admin images (ECR) and the website. Nothing runs on `main` (no CI, no deploy); **the workflows run only for the `production` branch — check, then deploy to the server — when `main` is merged into it** (or a workflow is run by hand from `production`). See "Releasing" in [deploy/README.md](deploy/README.md).

## Status

| Part | Where it is |
|---|---|
| `backend/` | Built. 43-model Prisma schema, app/web/admin/webhook routes, worker, websocket, deeplink, docs. Migrated and seeded locally; `npm run test:auth` walks the session lifecycle end to end and `npm run test:reels` walks the reels surface (77 assertions, every denormalised counter checked against its rows) and `npm run test:chant` the chant record (sittings, round summaries, the per-mantra history, transcripts and their 7-day expiry) and `npm run test:mantra-prayer` a mantra's opening prayer and `npm run test:book-counts` the verse counts on books, cantos and chapters, which are rebuilt from the rows (`npm run recount:books`) rather than copied from the source files. |
| `app/` | Foundation built. Sign-in (Google/Apple), session and silent token rotation, theme, l10n, router, dashboard fed by `/api/app/home`. Firebase and release signing are wired for `com.sss.ramkrishnahari` — see [app/CLAUDE.md](app/CLAUDE.md). Sadhana and library tabs are routed and empty. Chant auto count counts by sound alone — one chant for each standard chanting time of it (`Mantra.durationMs`, admin Mantras page; shortened as a sitting goes on), detected by the bundled Silero voice detector; nothing is recognised, so no word lists. With auto count off a tap waits half a standard time. A mantra can have an **opening prayer** (mahamantra → Panchatattva) shown before every round, the round in progress is **kept on the phone per mantra**, and the analytics are that mantra's, rounds only — see "The chant counter" in [app/CLAUDE.md](app/CLAUDE.md). (A recogniser matching allowed English words was tried and removed: it wrote nothing close to the Sanskrit.) The switch is on the counter and is remembered. **Not tried on a phone**; see "Auto count" in [app/CLAUDE.md](app/CLAUDE.md). |
| Reels | Built end to end, consumer side. Feed (ranked, watch-aware), player, view/like/comment/share/save/report, one-level comment threads, creator profiles and following. `npm run seed:reels` puts six playable demo reels on a laptop. **Reels can also be made in bulk from a book's verses** (below), and a reel from a verse offers "More like this". **Creator publishing is deliberately not built** — see below. |
| Chant along | Built on all three parts. A mantra can carry one recording of a whole mala and where the chanting starts and ends in it; the chant counter plays it (play / pause, a draggable bar) and counts one chant as each finishes, so the audio and the count run together. Uploaded on the admin **Mantras** page, stored as three nullable columns on `Mantra` that are all set or all null, and sent to the app as a link plus the span — see [backend/CLAUDE.md](backend/CLAUDE.md), [admin/CLAUDE.md](admin/CLAUDE.md) and "The chant counter" in [app/CLAUDE.md](app/CLAUDE.md). `npm run test:mantra-mala` walks the API side. **Not yet tried by hand:** the admin upload form, and playback on a phone (the app's tests drive the real screen with a fake player). |
| Routine | Built on the app and the backend. The Routine tab (tasks per day, an optional daily routine, ticks with the time done) is kept on the phone first and mirrored to the account in the background, so it works offline and follows someone to a new phone: three tables (`RoutineTask`, `RoutineDailyItem`, `RoutineCheck`) and `POST /api/app/routine/sync`, with the phone sending only what changed since the server last answered — see "The routine tab" in [app/CLAUDE.md](app/CLAUDE.md) and "Routine" in [backend/CLAUDE.md](backend/CLAUDE.md). `npm run test:routine` walks the API; the app's side is tested against a fake server. **Not tried on a phone, and not yet run between a phone and a live API.** Last write wins between phones; switching accounts drops the previous account's unsynced edits; the Home sadhana card does not count routine items. |
| Jap tab offline | **Built on the app only; not tried on a phone.** The Jap tab opens, lists the mantras and starts the counter with no connection: today's screen and the mantras are saved as the API last sent them and shown first, then replaced when the network answers; a failed request leaves them standing and pull to refresh says so. Cleared on sign-out; the mantra copies are also dropped when the account's languages change. The chant-along recording is not saved — see "The Jap tab offline" in [app/CLAUDE.md](app/CLAUDE.md). `app/test/jap_offline_test.dart`. |
| `admin/` | Foundation built. React + Vite + TypeScript SPA — see [admin/CLAUDE.md](admin/CLAUDE.md). Sign-in reuses the app's Google-only `/api/app/auth/social`, gated by role permissions from `/api/admin/me`. Dashboard, users & roles, content (books/verses/mantras/reference data/daily sloka), payments, notifications, settings, AI usage, audit log, jobs, and a system health/analytics page, all wired to the existing `backend/routes/admin/` API plus a new `backend/routes/admin/system.js`. **Reels** are made and published from a multi-feature editor (video / slideshow / audio upload, draggable text, verse picker, undo) over `backend/routes/admin/reel.js`; `npm run test:admin-reels` walks it. **Reels from verses**: pick a book (and canto / chapter / range / topic / keywords), design one template in the same editor, and one draft reel per verse is made — see "Reels from verses" below; `npm run test:reel-recipes` walks it. **Creators are managed in the admin panel** (Creators page, or "Make creator" on a user): a creator is the same `User` with a `CreatorProfile`, never a separate account or role, so an admin can be a creator too; permission `creator.manage` (run `npm run seed` in `backend/` on an existing database to add it). **Reels moderation still isn't here** — reel/comment reports and creator approval have no reviewer until `backend/controllers/admin/` grows the endpoints for them. |
| `website/` | Built. The landing page as a React + Vite + TypeScript site, prerendered at build time so the HTML carries the content — see [website/CLAUDE.md](website/CLAUDE.md). Looks and behaves the same as the static page it replaced. CI builds it and uploads `website/dist`; **that workflow change has not run on GitHub yet.** |
| Offline books, reading aloud, languages | **Silent offline books** (weekly S3 export → manifest → per-unit sync into Drift, [backend/README.md](backend/README.md#book-cache--silent-offline-books)), **three independent languages** (app / reading / speaking), and **verse recitation** (a verse's Sanskrit recording from S3, per verse or auto-play — **nothing is spoken over it**, whatever the language; the offline-neural-voice text-to-speech layer is still built but the reader no longer uses it) — see "Silent offline books", "Three languages", "Reading aloud" and "Spoken meaning and purport" in [app/CLAUDE.md](app/CLAUDE.md). **Not tried on a device:** background sync and lock-screen playback. **No neural voice is enabled yet** — each needs its URL and SHA-256 confirmed first. |
| Book, canto and chapter titles by language | **Built on all three parts; not tried on a device.** The book screen, a canto's chapter list and the chapter lists title themselves in the *reading* language, and re-title live when it changes (`titleI18n` / `summaryI18n` / `descriptionI18n` from the API, picked on the phone, stopping at English). Seeded in the 11 reading languages for the two books, the Bhagavatam's 12 cantos and the Gita's 18 chapters (`backend/prisma/seed/section-titles/`, fill-missing so admin edits stick); the admin **Books → Titles in other languages** dialog views and edits every title. **The Bhagavatam's 335 chapter titles are not seeded** (English until an admin fills them), and **every seeded title is AI-drafted, not read by a native speaker**. A changed title reaches phones that already hold the book with the next export. The Reading settings sheet also closes on choosing a language and has Hide checkboxes for Sanskrit, transliteration, word meanings and purport. See "Book, canto and chapter titles" in [app/CLAUDE.md](app/CLAUDE.md), "Translated titles" in [backend/CLAUDE.md](backend/CLAUDE.md) and "Titles in other languages" in [admin/CLAUDE.md](admin/CLAUDE.md). |
| Gita translation (Claude) | **Built on the backend and the admin panel; no live Claude call has been made.** `backend/scripts/translate-claude.js` translates Prabhupāda's Gita (translation, transliteration, word meanings, purport) into hi / mr / ta (bn te kn ml also supported), each verse scored 1–3 and saved to S3 as `json/bhagavat-gita/<lang>/ch-<n>.json`. The admin **Translations** page runs the same pipeline as a BullMQ job in the worker: pick a language, see an estimate, follow progress live over the websocket, read the output beside the English. It survives a refresh, pauses on out-of-credit or a bad key (Resume), retries on its own when Anthropic is busy, and resumes at the first unsaved verse — see "Translation runs" in [backend/CLAUDE.md](backend/CLAUDE.md) and "Translations" in [admin/CLAUDE.md](admin/CLAUDE.md). A language already translated under the current `TRANSLATION_VERSION` is not translated again (only missing or older-version verses are). An **Import** button copies a language's saved files into the database: translation, purport, transliteration and word meanings go onto the verse's `VerseTranslation` row (new nullable columns, with `translatedBy` / `version`), a row that is already there is replaced in place with its id kept, and new rows are hidden until the import is told to make them visible. `npm run test:translation` and `npm run test:translation-import` walk it; the page was driven in a real browser. **Not done:** the app and the offline book export read the imported `transliteration` (the reading page shows it in the reader's script) but not `wordMeanings`, and nothing marks a text as machine-made yet, and the import has not been run against the real S3 files. |
| OpenAI free tokens, engine chain, token calculator | **Built on the backend and the admin panel; not run against OpenAI's real free allowance.** OpenAI gives this organisation free daily tokens (250,000 across the large models, 2,500,000 across the mini ones; `gpt-6-luna` is **not** free). An admin switch on **AI usage → Use OpenAI free tier** (**off until turned on**, so data sharing can be dropped later) makes chat and the admin translation runs use a free model (`gpt-4o-mini` / `gpt-4.1-mini` by default) until a model-by-model token tally, which stops at 90% of a pool, says the day's tokens are spent; then translation goes back to `gpt-6-luna`, and chat goes to the provider that is set and, if that fails, to `AI_FALLBACK_MODEL` (`gpt-6-luna`). Every call fails over along that chain, the stronger chat tier never uses the free models, and the admin pages show which provider and model answers (AI usage → *Right now*, Ask Sakha → *Answering with*). See "OpenAI's free tokens, the engine chain and the token calculator" in [backend/CLAUDE.md](backend/CLAUDE.md) and "AI usage and the OpenAI free tier" in [admin/CLAUDE.md](admin/CLAUDE.md). `npm run test:chat` (section 17), `npm run test:translation` (section 9b) and `test/ai-free-tier.test.js` walk it; the card was driven in a real browser. **Not done:** confirming OpenAI bills these calls at nothing (check its Usage page after a day with the switch on), and `gpt-4.1-mini` on the Indic languages has not been compared with `gpt-6-luna`. With the switch on, readers' chat goes to OpenAI under its data-sharing programme. |

### Reels — what is not there

Everything a reader does with a reel is built, and staff can now put one there:
the admin panel's reel editor creates, edits, publishes, unpublishes and
deletes reels on behalf of an **approved** creator. **What a creator can do for
themselves is not built** — there is no apply-to-be-a-creator flow, no upload
from the app, no create/delete of your own reel, and no moderation queue for
reports or rejection.

That is a deliberate line, not an oversight. Self-serve publishing needs a
reviewer: `Reel.status` defaults to `PENDING_REVIEW` and `CreatorProfile.status`
to `PENDING`, and the thing that moves either one is a moderation queue in the
admin panel. The panel is built and the editor is in it, but that queue isn't,
because the backend has no reel-report or creator-approval endpoints yet for it
to call. Building upload in the app first would mean either reels that nobody
can approve, or auto-publishing whatever is sent — on a devotional platform
with a stated content rule, the second is not an option. Admin-made reels don't
have that problem: a person with `reel.publish` looks at the reel before they
publish it.

The reader-side surface is written so the creator side drops in without being
retrofitted: `GET /reels/:id` and the creator profile already return a
creator's own unpublished reels, `present.reel` already sets `isMine`, and the
grid already badges a reel awaiting review.

### Reels from verses

An admin picks a book, narrows it (canto, chapter, verse range, a topic tag, keywords),
designs **one template** in the reel editor — a background image or video, optional
music, and text boxes that can be *bound* to a verse field — and the API makes one
draft reel per matching verse (`backend/controllers/admin/reel-recipe.js`, panel page
`admin/src/routes/reel-recipe.tsx`). Three decisions worth knowing before changing it:

- **The reel keeps its verse, and bound boxes keep their binding.** The app is sent the
  reel with each bound box's text re-read from the verse in the *reader's* language
  (`bindOverlays` in `backend/utils/present.js`), so one reel shows a Hindi reader the
  Hindi translation, and a corrected translation reaches reels already made. The text
  stored at creation is only a fallback. No app change was needed for this.
- **Standard tags, built in one place** (`backend/utils/reel-tags.js`): `book:<slug>`,
  `canto:<slug>-<n>`, `chapter:<slug>-[<canto>-]<n>`, plus the book / canto / chapter
  names as plain hashtags. The `book:` / `canto:` / `chapter:` keys are scoped by book
  and are what `GET /api/app/reels/:id/similar` ranks on (same chapter, then canto,
  then book, then shared hashtags); a GIN index on `Reel.tags` backs it. The app shows
  "More like this" only for a reel carrying one of those keys.
- **Re-running makes the next batch.** Verses that already have a reel from the template
  are excluded *before* the limit, and `(templateId, verseId)` is unique.

Audio is either each verse's own recitation (verses without one are not candidates) or
the template's background music. Drafts unless the run is published, which needs
`reel.publish`. Background music / recitation on a video or slideshow reel is now played
by the app (`widgets/reels/reel_soundtrack.dart`); before this it was sent and ignored.

<!-- code-review-graph MCP tools -->
## MCP Tools: code-review-graph

**IMPORTANT: This project has a knowledge graph. ALWAYS use the
code-review-graph MCP tools BEFORE using Grep/Glob/Read to explore
the codebase.** The graph is faster, cheaper (fewer tokens), and gives
you structural context (callers, dependents, test coverage) that file
scanning cannot.

### When to use graph tools FIRST

- **Exploring code**: `semantic_search_nodes` or `query_graph` instead of Grep
- **Understanding impact**: `get_impact_radius` instead of manually tracing imports
- **Code review**: `detect_changes` + `get_review_context` instead of reading entire files
- **Finding relationships**: `query_graph` with callers_of/callees_of/imports_of/tests_for
- **Architecture questions**: `get_architecture_overview` + `list_communities`

Fall back to Grep/Glob/Read **only** when the graph doesn't cover what you need.

### Key Tools

| Tool | Use when |
| ------ | ---------- |
| `detect_changes` | Reviewing code changes — gives risk-scored analysis |
| `get_review_context` | Need source snippets for review — token-efficient |
| `get_impact_radius` | Understanding blast radius of a change |
| `get_affected_flows` | Finding which execution paths are impacted |
| `query_graph` | Tracing callers, callees, imports, tests, dependencies |
| `semantic_search_nodes` | Finding functions/classes by name or keyword |
| `get_architecture_overview` | Understanding high-level codebase structure |
| `refactor_tool` | Planning renames, finding dead code |

### Workflow

1. The graph auto-updates on file changes (via hooks).
2. Use `detect_changes` for code review.
3. Use `get_affected_flows` to understand impact.
4. Use `query_graph` pattern="tests_for" to check coverage.
