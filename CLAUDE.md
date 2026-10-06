| Reels | Built end to end, consumer side. Feed (ranked, watch-aware), player, view/like/comment/share/save/report, one-level comment threads, creator profiles and following, and the text an admin laid over a reel (`models/reel_overlay.dart`, `widgets/reels/reel_overlays.dart`). `npm run seed:reels` puts six playable demo reels on a laptop. **Creator self-publishing is deliberately not built** — see below. |
# HariHariBol

A spiritual learning platform: Vedic verses, mantras, narrations, chanting.

This is a **deliberate rebuild**. The previous version grew too complex to navigate and was retired. Its full source is archived on the `unorganized` branch — read from it with `git show unorganized:<path>`, don't copy its patterns forward.

## Layout

| Dir | What | Rules |
|---|---|---|
| `app/` | Mobile app (Flutter) | [app/CLAUDE.md](app/CLAUDE.md) |
| `backend/` | API (plain Node.js) | [backend/CLAUDE.md](backend/CLAUDE.md) |
| `admin/` | Admin panel | [admin/CLAUDE.md](admin/CLAUDE.md) |

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

**CI** — `.github/workflows/` is preserved from the previous setup (ECR build+push). Trigger branches and paths will need updating when the new structure lands.

## Status

| Part | Where it is |
|---|---|
| `backend/` | Built. 43-model Prisma schema, app/web/admin/webhook routes, worker, websocket, deeplink, docs. Migrated and seeded locally; `npm run test:auth` walks the session lifecycle end to end and `npm run test:reels` walks the reels surface (77 assertions, every denormalised counter checked against its rows) and `npm run test:chant` the chant tap record (rounds, transcripts and their 7-day expiry). |
| `app/` | Foundation built. Sign-in (Google/Apple), session and silent token rotation, theme, l10n, router, dashboard fed by `/api/app/home`. Firebase and release signing are wired for `com.sss.ramkrishnahari` — see [app/CLAUDE.md](app/CLAUDE.md). Sadhana and library tabs are routed and empty. |
| Reels | Built end to end, consumer side. Feed (ranked, watch-aware), player, view/like/comment/share/save/report, one-level comment threads, creator profiles and following. `npm run seed:reels` puts six playable demo reels on a laptop. **Creator publishing is deliberately not built** — see below. |
| `admin/` | Foundation built. React + Vite + TypeScript SPA — see [admin/CLAUDE.md](admin/CLAUDE.md). Sign-in reuses the app's Google-only `/api/app/auth/social`, gated by role permissions from `/api/admin/me`. Dashboard, users & roles, content (books/verses/mantras/reference data/daily sloka), payments, notifications, settings, AI usage, audit log, jobs, and a system health/analytics page, all wired to the existing `backend/routes/admin/` API plus a new `backend/routes/admin/system.js`. **Reels** are made and published from a multi-feature editor (video / slideshow / audio upload, draggable text, verse picker, undo) over `backend/routes/admin/reel.js`; `npm run test:admin-reels` walks it. **Reels moderation still isn't here** — reel/comment reports and creator approval have no reviewer until `backend/controllers/admin/` grows the endpoints for them. |

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
