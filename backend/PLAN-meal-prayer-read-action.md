# Plan (backend): routine alerts open their page

Part of [../PLAN-meal-prayer-read-action.md](../PLAN-meal-prayer-read-action.md). The app side is in [../app/PLAN-meal-prayer-read-action.md](../app/PLAN-meal-prayer-read-action.md).

Routine alerts are **local notifications on the phone**. The server sends nothing for them, so there is no push, scheduler or new table. The backend's job is to say, for each routine kind, where its alert opens, and to supply what the phone then looks up.

## What each routine opens

| Routine kind | Opens | What the phone needs from the backend |
|---|---|---|
| breakfast, lunch, dinner | the meal prayer (`prasada-sevaya`) | `opens: { kind: 'prayer', slug }`, and the prayer by slug |
| morningChant, breakChant, eveningChant | the chant counter on the reader's own mantra | `opens: { kind: 'chant' }`; the mantra comes from `GET /api/app/sadhana/today` (`profile.preferredMantra`, else `favoriteMantra`) |
| scriptureReading | the last book read, at the last place | `opens: { kind: 'read' }`; the place from `GET /api/app/progress/latest` |

A kind with no entry in the table opens nothing special, as before.

## Done

1. **Where each kind opens is data, not code.** `RoutineKind` gained `opensKind` (`prayer` / `chant` / `read`, VARCHAR 20) and `prayerSlug` (VARCHAR 80). Set by migration `20261115000000_routine_open_target` (production does not run the seed) and by `prisma/seed/routine-nudges.js` (`opensByKind`) through `prisma/seed/index.js`.
2. **`utils/routine-open.js`** turns a kind row into `opens`. A prayer with no slug gives `null`, so the app never shows a button that leads nowhere. Unit tests: `node --test test/routine-open.test.js` (4 pass).
3. **`GET /api/app/routine/nudges`** now returns `opens` on every kind (`controllers/app/routine.js`).
4. **`GET /api/app/progress/latest`** returns the reader's most recently read book and place, or `null` (`controllers/app/progress.js`, `routes/app/progress.js`). Same shape as one entry of `GET /api/app/progress`.
5. **`GET /api/app/prayers/:id`** accepts a slug and serves only PUBLISHED prayers, so a DRAFT meal prayer is a 404 until an admin publishes it (`controllers/app/prayer.js`).

## Decisions

- **Chanting needs no new endpoint.** `/sadhana/today` already carries the mantra; `mantraStub` gives `id` and `slug`, and `/mantras/:slug` resolves it.
- **Reading resumes from the server's record** (`ReadingProgress`, one row per user per book, newest `lastReadAt` wins). The place follows the reader to a new phone. The phone's own `ReadingPlaceStore` is local and not synced; whether the app prefers it when offline is the app's decision and is not settled here.

## Checks still to run

- `node --check` on every changed JS file: passes (controllers, routes, utils, seed).
- `node --test test/routine-open.test.js`: 4 pass.
- `npx prisma validate`: schema valid.
- Not run: `npm run test:routine` against a running API and database. It should be extended to check `opens` on each kind and `GET /progress/latest` (null for a new reader, the newest book after a save).

## Deploy

Production needs `prisma migrate deploy` for `20261115000000_routine_open_target`, then a restart of the API. A seed is not required (the migration sets the three columns).

## Not tested

- No route has been called against a running API.
- The migration has not been applied to a database.
- The alert, its button and the navigation are the app's job and are not tested here.
