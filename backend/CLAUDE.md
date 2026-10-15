# Backend — HariHariBol API

Plain **Node.js. No TypeScript.** **ESM everywhere** — `"type": "module"`, `import`/`export`, no `require` anywhere. Simple, readable code. Prisma for the database.

## Structure

```
backend/
├── server.js              # entry point — boots the HTTP server, nothing else
├── app.js                 # the express app — mounts every routes/ dir + middleware
├── config/                # one file per concern: cors.js, cron.js, redis.js, database.js …
├── middleware/            # auth, attestation, rate limits, errors
├── routes/
│   ├── app/               # mobile app endpoints
│   ├── web/               # website endpoints
│   ├── admin/             # admin panel endpoints
│   └── webhook/           # provider callbacks — signature-authenticated
├── controllers/
│   ├── app/               # mirrors routes/ exactly, file for file
│   ├── web/
│   ├── admin/
│   └── webhook/
├── services/              # shared infra only
│   ├── ai/                # provider-agnostic AI: index.js, gemini.js, openai.js
│   ├── payments/          # google.js, apple.js, razorpay.js, index.js (the ledger)
│   ├── s3.js              # uploads, temp→saved moves, presigned URLs (bucket is private)
│   ├── auth.js            # tokens, google/apple verification, permission cache
│   ├── entitlement.js     # who is Premium, and why
│   ├── book-counts.js     # verse / chapter / canto counts, rebuilt from the rows
│   ├── fcm.js  notify.js  otp.js  mailer.js  websocket.js
│   ├── setting.js         # AppSetting reads, encrypted secrets
│   └── audit.js
├── utils/                 # small stateless helpers
│   ├── router.js          # documented routes + auth guard + validation
│   ├── present.js         # language resolution + media signing for responses
│   ├── crud.js            # the reference-data CRUD builder
│   └── date.js  language.js  errors.js  respond.js  pagination.js
├── views/                 # email templates + server-rendered pages
├── docs/                  # OpenAPI built from the route registry; served by Scalar
├── jobs/                  # BullMQ queues and processors (Redis-backed)
├── worker/                # background job runner — own Docker container
├── websocket/             # realtime server — own Docker container
├── deeplink/              # deeplink handling — own Docker container
└── prisma/
    ├── schema.prisma      # model format
    └── seed/              # roles, languages, issues, deities, gurus, plan, settings
```

**Two directories that were not in the original list**, and why:

- `utils/` — stateless helpers with no I/O. `services/` is for shared
  infrastructure that talks to something (S3, Firebase, a provider); `utils/` is
  for code that does not. Keeping response shaping and date handling out of
  `services/` is what stops that directory turning into a junk drawer.
- `routes/webhook/` — Razorpay, Google and Apple are not the app, the web or the
  admin panel. They authenticate by signature rather than a token, and filing
  them under one of the three would put a route where nobody would look.

## Rules

1. **JavaScript, not TypeScript, and ESM not CommonJS.** No build step either
   way — Node runs the source as written.

   Three consequences worth knowing before writing a file:

   - **Relative imports carry the `.js` extension**, and a directory is
     imported as `.../index.js`. ESM does not guess.
   - **A module of named exports is imported as a namespace**:
     `import * as s3 from '../services/s3.js'`. A plain `import s3 from …`
     silently yields `undefined` — the one trap worth remembering.
   - **No `__dirname`.** Use `import.meta.dirname`.

   Modules export named bindings by default. `export default` is reserved for
   things that genuinely are one value: an express router, a middleware, a job
   processor.

2. **One `app.js`, one `server.js`.** `server.js` only starts the server. `app.js` wires middleware and mounts every routes directory — reading `app.js` alone should tell you every route family the API exposes.

3. **Routes and controllers are segregated by platform** — `app`, `web`, `admin`. A route file and its controller file mirror each other by path and name: `routes/app/user.js` → `controllers/app/user.js`.

4. **No service layer for controllers.** Controllers hold their own logic and talk to Prisma directly. `services/` is reserved for shared infrastructure that several controllers use — FCM, OTP, websocket, auth. Do not create a `userService` to wrap a `userController`.

5. **All requests pass through auth middleware.** Public endpoints opt out
   explicitly; the default is authenticated.

   The work is split in two, and the split matters. `middleware/auth.js`
   establishes *who is asking* and hangs it on `req.auth` — it never refuses
   anything. `utils/router.js` is what refuses, requiring a signed-in user for
   every route that does not say `public: true`. That is why a public endpoint
   can still personalise for a caller who happens to be signed in, and why
   forgetting to guard a route is not possible.

   Validated input lands on `req.valid` (`.body`, `.query`, `.params`).
   Controllers never read `req.body` directly.

6. **Config lives in `config/`**, one file per concern (cors, crons, redis, database …). No configuration inline in `app.js` or in controllers.

7. **Jobs use BullMQ on Redis.** Queue definitions and processors live in `jobs/`; the `worker/` container runs them. Scheduled work:
   - **daily** — build the global and per-user slokas, then push them, respecting each user's `timezone`
   - **weekly** — rebuild `UserPreferenceProfile` from the week's activity
   - **on demand** — the AI batch passes that fill `VerseIssue` and `VerseExplanation`

8. **`worker/`, `websocket/`, and `deeplink/` each get their own Docker container**, separate from the API container.

9. **Every endpoint is documented**, and it is not possible to skip. Routes are
   registered through `utils/router.js`, which takes the documentation as an
   argument alongside the handler and **throws at boot** if a route has no
   `summary`. The same object carries the access rules and the validation
   schemas, so the docs cannot drift from the behaviour — there is no separate
   spec file to forget to update.

   `docs/openapi.js` reads that registry; **Scalar** renders it at `/docs`.
   Chosen over Swagger UI because it looks considerably better and has a working
   request panel, and a reference nobody enjoys opening is a reference nobody
   reads.

10. **`views/` holds email templates and server-rendered pages** — OTP and notification emails, deeplink landing pages, legal/policy pages. Anything the server renders as HTML rather than returns as JSON.

## Auth, roles and permissions

- **One auth service**, one users table. Admins and normal users are the same record type, separated by a `role` column.
- A single person can be both a normal user and an admin. Admin surfaces are reachable **only** if their role/permissions grant it.
- Use **standard roles**; the permission set is derived from this project's actual content and actions.

## AI

Gemini is the provider we use. It is not the provider the code knows about.

- Everything goes through `services/ai/` behind one interface. Callers ask for a
  completion; they never learn which provider answered. Swapping Gemini for
  something else must touch only `services/ai/`.
- Provider and model come from `AppSetting` (`ai.provider`, `ai.model.text`), so
  they change without a deploy. API keys are secrets — encrypted, never returned.
- Every call is written to `AiUsageLog` with tokens and cost. An AI feature whose
  spend cannot be attributed to an operation does not ship.

### Cost rule: AI never runs on the request path

Generating per user per day does not survive contact with scale — 10,000 users is
10,000 calls every morning, for content that is largely the same. So the work is
done **once, ahead of time**, and serving is a database query:

| Work | When | Cost at serve time |
|---|---|---|
| Map verses → issues (`VerseIssue` weights) | One batch pass over BG + SB, re-run when the taxonomy changes | none |
| Verse explanations (`VerseExplanation`) | Once per verse per language, reused by every user | none |
| Sloka image | Once per `DailySloka` | none |
| Picking a user's sloka | Weighted query over `VerseIssue` × `UserPreferenceProfile` | none |

A user reporting krodha gets a sloka through an indexed lookup, not a model call.
The AI spend is bounded by the size of the corpus, not by how many users we have.

For the bulk passes: use batch mode where the provider offers it (roughly half
price), the cheapest model that does the job, and embeddings rather than chat
completions for anything that is really similarity matching. Cache in Redis.

## Subscriptions, donations and entitlement

**The app is free — everything in it.** There is currently no paywalled
feature: mood-driven sloka (reporting a struggle and getting a verse chosen for
it) was tried as a Premium-only feature and the restriction was deliberately
removed, because it stood between a reader and the whole point of the app. New
features default to free; a decision to gate one behind Premium has to be made
explicitly and is expected to be rare.

`Subscription`, `Payment` and `User.isPremium` still exist — donations are real
money and still need a ledger and a receipt — but nothing in the app currently
reads `isPremium` to withhold a feature. `utils/router.js`'s `premium: true`
route flag is still there for a future feature that does need gating; no route
uses it today.

**Plans, prices and features are data, not code.** Three tables, edited from
the admin panel's Plans page, so a new benefit or a new price never needs a
deploy:

- `SubscriptionPlan` — a tier (`tier` 0 = the `free` baseline every user is on
  with no subscription; paid plans rank above it). The free plan is a real row so
  what a free user gets is edited in the same place as what a paid user gets.
- `PlanPrice` — one row per **provider × billing period**: the store's product
  id, the price, currency and an optional `trialDays` (the plan's free tier).
  Different stores charge different amounts, which is why price is not on the
  plan. A new provider is a `PaymentProvider` value, a module in
  `services/payments/` and rows here — plans are untouched.
- `Feature` + `PlanFeature` — a catalogue of things the product can do
  (`FLAG` on/off, or `LIMIT` with a number, null = unlimited) with a value per
  plan. A plan with no value for a feature gets `Feature.defaultEnabled`, which
  is **on**: new features are free until someone decides otherwise.

Gate something with `entitlement.can(userId, 'feature.key')`, or put
`feature: 'feature.key'` on a route (402 if the plan does not include it). Read
`entitlement.featuresForPlan` for limits. `premium: true` still means "any paid
plan".

**A plan is earned two ways**, and they are worth equal access:

- an **active subscription** — entitled until `currentPeriodEnd`, on the plan
  it was bought through
- **any donation, of any amount**, through Google Play, Apple or Razorpay —
  permanent access (`premiumUntil` stays null) to the highest-tier plan flagged
  `grantedToDonors`

When someone holds both, the higher tier wins. Nothing else decides this —
`services/entitlement.js` does, from the ledger.

`User.isPremium` is a cache (true on any non-free plan), owned by the payment
webhooks and the daily job, and rebuildable from `Subscription` and `Payment`
at any time. Read entitlement from `entitlement.compute`; never scatter
subscription logic through controllers. `npm run test:subscriptions` walks the
whole surface.

**Payments are one ledger.** Subscriptions and donations both land in `Payment`,
separated by `purpose`. They arrive the same way and reconcile the same way, so
splitting them would mean maintaining two of everything.

`(provider, externalId)` is unique on both `Payment` and `Subscription` because
every provider retries webhooks — without that constraint a retry credits the
user twice. Store money as integer minor units (paise, cents); floats drift.

## Book, canto and chapter counts

`Book.totalCantos/totalChapters/totalVerses`, `Canto.totalChapters/totalVerses` and
`Chapter.totalVerses` are **derived**: the reading screens show them and
`controllers/app/book.js` branches on them, but the rows are the truth.

- **One writer: `recountBook()` in `services/book-counts.js`.** It reads the rows, compares,
  and writes only what is wrong. Both importers call it when they finish, and the admin
  controllers call it after a verse, chapter or canto is created or deleted. Nothing keeps
  a running tally with `increment`, and nothing copies a total out of a file — a source
  without `meta.totalVerses` is what put "0 verses" on 134 chapters of Bhagavatam cantos 10–12.
- **A change to where a verse lives is a recount too.** The admin verse PATCH cannot move a
  verse today; if it ever can, it recounts both the old and the new book.
- `npm run recount:books [-- --dry-run]` repairs a database whose counts drifted;
  `npm run test:book-counts` walks the rules over real HTTP.
- **A new database takes the seed twice** (migrate → seed → importers → seed): stories
  point at chapters, and chapters come from `scripts/import-*.js`. See `scripts/README.md`.

## The daily sloka push

`deliver()` in `jobs/processors/sloka.js` pushes each user's sloka at **one time of day on their own clock —
04:30 by default**. **The body is the
verse** — Sanskrit first (so the collapsed notification shows it), then its meaning in the reader's
language, then "Bhagavad Gita 2.47" — built by `slokaPush` in `utils/sloka-push.js` (pure; `npm test`). Why
it was chosen (`UserDailySloka.reason`, "Because you mentioned …") is no longer in the push; the app shows it.

- **Planned, not built:** a personal journey (levels, a nine-week beginner path, moods, the Hindu calendar)
  in place of the picker — [SLOKA-JOURNEY-PLAN.md](SLOKA-JOURNEY-PLAN.md). Read its open questions first.
- **When** — the AppSetting `sloka.delivery.time` (`SETTING_KEYS.SLOKA_DELIVERY_TIME`, `"HH:MM"` 24-hour,
  default `SLOKA_DEFAULT_DELIVERY_TIME` = `04:30`), edited on the admin **Settings** page, which rejects
  anything that is not a time. `sloka.deliver` runs **every 30 minutes** (`SLOKA_DELIVERY_STEP_MINUTES` in
  `config/cron.js`) and sends to whoever's local time falls in the 30 minutes starting at that setting
  (`isDeliveryDue` in `utils/sloka-delivery.js`, pure; `npm test`). One window as wide as the run means every
  reader falls in exactly one run, including zones 15 or 45 minutes off UTC; so 04:30 is delivered at the
  first half hour at or after 04:30, and a time like 04:40 goes out at 05:00. `UserDailySloka.notifiedAt`
  keeps a repeat run from sending twice. The setting is cached for 60 s.
- **The same time for everyone.** The learned `UserPreferenceProfile.bestDeliveryHour` is **no longer read
  by delivery** (the profile still computes it). A per-reader time would be a different design — say so if it
  is wanted back. The old setting `sloka.delivery.default_hour` is removed by the migration
  `20261017000000_sloka_delivery_time`, which also seeds `sloka.delivery.time`.
- **Changing a cron pattern is safe.** BullMQ keys a repeatable job by name + pattern, so an edited pattern used
  to leave the old schedule firing beside the new one. `jobs/schedules.js` now removes any repeatable entry
  that is no longer exactly what `config/cron.js` asks for (pattern *and* timezone) when the worker boots.
  **After deploying this, restart the worker** — that is when `sloka.deliver` moves from hourly to every 30
  minutes and the old entry is dropped.

- **The data carries the verse's place in its book** — `bookSlug`, `cantoNumber`, `chapterNumber`,
  `verseNumber` beside `verseId` and the `hariharibol://sloka/<verseId>` deeplink — so the app opens the
  chapter at the verse without a lookup. The app reads those names from `PushConfig`
  (`app/lib/core/constants/push_config.dart`); rename one and rename it there.
- **The verse is read per push**, after the delivery-time check, not with the pending rows: only the users
  whose time has come are sent anything, and which translations to fetch depends on who they are.
- **The meaning is cut at 220 characters, the verse at 600** — a push is capped at 4 KB and a Devanagari
  character is three bytes of it.
- **A picture goes with it** — `services/sloka-card.js` draws a 4:3 card (1200×900): "Sloka of Day" on top,
  the Sanskrit in the middle, "Srimad Bhagavatam · 1.1.1" along the bottom, over `public/g01-lotus-feet-820x547.jpg`
  blurred and darkened. It is the push's `imageUrl` (Android's big picture; iOS ignores it until the app has a
  notification service extension). **It holds nothing about who it is for**, so it is drawn once per verse, stored in
  the media bucket (`slokas/images/cards/<design>/<verseId>.jpg`) and the same link goes to every reader; the
  meaning stays in the body, in their language. The text work — stripping the verse's own number, one stanza per
  verse of a compound, fitting size to length, cutting what cannot fit with "…" — is `utils/sloka-card-text.js`
  (pure; `npm test`). Fonts are bundled in `assets/fonts/` (Noto Serif Devanagari, Playfair Display, both OFL):
  the image is drawn with `@napi-rs/canvas`, which needs no system fonts and has a prebuilt musl binary for the
  Alpine image.
  - **Changing the photograph** — replace the file; the `<design>` folder in the key is a hash of its bytes
    plus `LAYOUT_VERSION`, so cards are drawn again. Change the layout → bump `LAYOUT_VERSION`.
  - **Title and footer sit in the middle ~70% of the height** because older Android crops the big picture to
    about 17:9 around the centre. Only the thin frame is ever lost.
  - **A card that fails is not a push that fails** — `cardUrl` returns null and the push goes without it. It also
    returns null for any link that is not https (a laptop's `http://localhost` link): FCM refusing an image URL
    comes back `invalid-argument`, which `services/fcm.js` treats as a dead token and clears.
  - **Looking at it** — `node scripts/sloka-card-preview.js [verseId …]` writes JPEGs to
    `storage/sloka-card-preview/` without sending anything. Careful: **`cardUrl` itself uploads**, and a dev
    `.env` with AWS keys writes to the real bucket.

## Mantra standard chanting time and chant phrases

`Mantra.durationMs` is how long **one chant takes at an ordinary pace**, in milliseconds. The app's auto count
listens only for sound and counts one chant for each of these of it, so every mantra should have one. Set on the
admin **Mantras** page ("Standard chanting time"); the seed (`standardChantMs` in `prisma/seed/data.js`) and the
migration `20261014000100_mantra_standard_chant_time` fill it for the seeded mantras **only where it is empty**, so
an admin's value is never overwritten. A mantra with none falls back, in the app, to 0.1 s per letter (min 1 s). The mahamantra is 4000 (migration `20261016000100_mahamantra_standard_chant_time` moves it from the old seeded 8000 only, so an admin who chose 8000 on purpose is indistinguishable and is moved too; the other seeded times are unchanged). The app shortens it as a sitting goes on and waits half of it between hand taps when auto count is off; those numbers live in the app (`AutoChantConfig`). The admin can clear the time again (`durationMs: null`), but **publishing needs one**.

`Mantra.chantWords` (`String[]`, default empty) is the set of **English words the phone's recogniser writes** when the
mantra is chanted — it only knows English, so it turns Sanskrit into the nearest English. The app counts a chant when it
hears one, at most one per `durationMs`. Edited on the admin **Mantras** page ("Allowed English words", lower-case
letters, ≥ 2 each). The seed (`prisma/seed/chant-words.js`) and migration `20261014000200_mantra_chant_words` start each
seeded mantra with the distinct words of its phrase spellings, **only where it has none** — a real list has to be found
by chanting into a debug build and reading what it writes. Empty: the app counts by sound alone. Sent on every mantra
as `chantWords`.

`Mantra.chantPhrases` was what the earlier matcher used; **the app no longer reads it**. Still seeded and sent; safe to
ignore or remove later.

## Opening prayers

`Mantra.prayerMantraId` (nullable, `onDelete: SetNull`, indexed) names another mantra chanted **before** this one — the
Panchatattva mantra before the mahamantra. The chant counter shows the prayer first and again before every round, so the app is
sent it whole and needs no second request.

- **`present.mantra` adds `prayer`**: the prayer presented like any mantra (its own text, translations and `durationMs`, which is
  how long the app makes the reader wait), or `null`. **One level** — the prayer's own prayer is not followed, so two mantras
  pointing at each other cannot loop. **A prayer that is not published is not shown.**
- **The admin validates it** (`checkPrayer` in `controllers/admin/mantra.js`): a mantra cannot be its own prayer and the prayer
  must exist, both a 400 — the foreign key alone would answer 500. The admin list and detail carry `prayerMantra`
  (`{ id, slug, name }`); the body field is `prayerMantraId`, `null` to take it off.
- **Seed**: `prayerMantras` in `prisma/seed/data.js` links the seeded pairs (only where a mantra has none, like the other seeded
  fields); migration `20261016000000_mantra_prayer` adds the column.
- `npm run test:mantra-prayer` walks it over real HTTP (publishing is done in the database there, since the endpoint wants an
  uploaded recording — `test:mantra-mala` covers that).

## Mantra names and translations

A seeded mantra has a name, meaning and purport in every reading language: one file per language in
`prisma/seed/mantra-translations/`, one entry per slug. `en` is written in `seed/data.js`; `sa` is a
deliberate gap (a Sanskrit row carries the original `text` and no prose). The seed **only fills what a row
lacks** — an admin's edit is never overwritten, and a corrected seed file does not reach a database that
already holds the old text (fix that row in the admin Mantras page). `test/mantra-translations.test.js`
fails on a missing language, a missing or extra slug, or text in the wrong script. The translations are
AI-drafted and **not yet read by a native speaker**.

- **A mantra's title follows the *reading* language; its script follows the mantra language.** `present.mantra`
  picks `name` with `language.pickName` (reading → app → en, then `Mantra.name`; it stops at English, so
  someone reading English is not handed their app language's name). Wherever a mantra is named in passing — a
  reel, a chant session, the profile's preferred mantra — use `includes.mantraStub` / `present.mantraStub`,
  never a bare `include: { mantra: true }`. `test/pick-name.test.js`.
- **Search finds the title a reader is shown.** The mantra list's `q` and `/search` match the English `name`
  or a published translated `name` in the reader's reading chain (`language.mantraNameClauses`, the search
  side of `pickName`) — not the name in a language they do not read. Keep the two together.
- **`Mantra.category` is a free-text slug** and the API sends no display name. The app words the four the seed
  uses (`beej`, `gayatri`, `mahamantra`, `name`) from its ARB files (`mantraCategoryLabel`) and shows any other
  title-cased, untranslated — to name a new one, add a `mantraCategory*` key to all twelve ARBs and a line to
  `mantraCategoryLabel` (an app release).

## Book cache (offline books)

Weekly export of book text to `s3://<bucket>/books/caches/` and the manifest / download-url
endpoints the app syncs from — see [README.md](README.md#book-cache--silent-offline-books).
Rules worth knowing before changing it:

- **Only a hash decides an upload.** `utils/book-cache.js` canonicalises (sorted keys, ordered
  verses and translations); anything non-deterministic put in a unit — a presigned URL, a
  `generatedAt` — makes every unit "changed" every week. Audio is a key, links come from `/audio-urls`.
- **Nothing under `books/caches/` is ever deleted**, and no lifecycle rule may touch it. Only
  `books/staging/` is cleaned.
- **Bump `SCHEMA_VERSION`** (config/book-cache.js) when the file shape changes; it is hashed, so
  the next run rewrites every unit.
- Work goes through the `content` queue; the export holds a Redis lock.

## Verse word meanings and the default translation

- `Verse.wordMeanings` is `[{ word: string | null, meaning: string }]`, the shape `utils/word-meanings-schema.js`
  enforces on admin create and update (`word` ≤ 200 chars and may be null, `meaning` required and ≤ 400,
  ≤ 300 entries; `[]` clears). Kept in its own file so a test can load it without starting the route.
  **`scripts/lib/import-verses.js` overwrites it from S3 on a re-import**, so an admin edit does not survive one.
- **`language.pickTranslation(rows, chain)` decides which rendering a verse opens with**, and a
  `POETIC_EXPANSION` (Dnyaneshwari's ovis on the Gita) is never chosen while any other row exists in the
  chain. A Marathi reader gets the next language until a standard Marathi translation is added; the ovi stays
  in `GET /verses/:id/translations`. Use it, not `pick`, wherever a verse's meaning is chosen (`present.js`,
  the reel recipe). The app mirrors it in `BookRepository.pickTranslation`; `test/pick-translation.test.js`
  and the app's `pick_translation_test.dart` hold the same cases.

## Verse recitations

A verse's recitation is one MP3 in storage, and where it is looked for is decided in **one place**:
`verseAudioPath(verse, book)` in `utils/verse-audio.js`.

- **The verse's own `Verse.audioPath` wins.** Failing that, a book with a `Book.recitationParent` (nullable;
  the **Recitation folder** field on the admin Books page) keeps one recording per verse beneath that
  folder — `<parent>/<chapter>/<verse>.mp3`, with the canto ahead of the chapter in a book that has cantos
  and just `<parent>/<verse>.mp3` in a short work. A compound verse (13–14) is filed under its first
  number. Set the folder once and every verse in the book is covered; nothing is written per verse.
- **It builds a key and checks nothing.** A missing file is a failed download, which the app skips
  silently. `test/verse-audio.test.js` holds the layout.
- **Everything that sends or plays a recitation goes through it**: the reader API (`present.verse`), the
  website (`controllers/web/content.js`), the offline export (`services/book-cache.js` puts the key in the
  unit file) and `/audio-urls` (`controllers/app/book-cache.js`), and the reel recipe's "each verse's
  recitation" audio (`controllers/admin/reel-recipe.js`, which also confirms the file exists). A query
  that feeds it must select the verse's `cantoNumber`, `chapterNumber` and `verseNumber` and the book's
  `recitationParent`.
- **The Gita is set by the migration, not only the seed.** `prisma migrate deploy` runs on every release
  and the seed does not, so `20261011000000_book_recitation_parent` sets
  `legacy/bhagvat-gita/mp3/chpaters-sloks` — 701 recordings, one per verse, copied from the old bucket by
  `scripts/import-legacy-media.js`. The seed sets it for a database that has no Gita row yet.
- **Phones get it after the next book export.** The folder changes the Gita's unit files, so the weekly
  export (or `npm run cache:books -- --book bhagavad-gita` on the server, right after the deploy) rewrites
  just those and the app re-syncs them. The dev `.env` points at the real bucket: do not run the export
  locally.
- The app needed no change — it plays a verse's `audioUrl` / `audioPath` whenever it has one.
  `npm run test:book-cache` and `npm run test:reel-recipes` each cover a book that keeps its recitations in a folder.

## Mantra mala recording

A mantra can carry one recording of a whole mala and the stretch of it that is chanting; the
app plays it on the chant counter and counts one chant per `(end − start) ÷ beads-per-round`.
Three nullable columns on `Mantra`: `malaAudioPath` (an S3 **key**, under `mantras/mala/`),
`malaAudioStartMs` and `malaAudioEndMs`.

- **All three or none.** `malaAudioChanges` in `controllers/admin/mantra.js` judges a *patch*
  against the row it would produce, not against the request: changing only the end is fine,
  clearing the recording takes its span with it, and an end that is not after the start is
  refused. A new recording whose file is not in storage is refused, and publishing checks again.
- **The app is sent a link, never the key — and never a link without its span.**
  `malaRecording()` in `utils/present.js` returns `malaAudioUrl` / `malaAudioStartMs` /
  `malaAudioEndMs`, or three nulls. The link is presigned (`S3_PRESIGN_TTL_SECONDS`, an hour by
  default), which is why the app asks again when one will not open.
- **Replacing a recording does not delete the old file** — same as every other upload.
- `npm run test:mantra-mala` walks it over real HTTP. It uploads and deletes real files, so the
  API **and** the script must run with `AWS_ACCESS_KEY_ID=` and `AWS_SECRET_ACCESS_KEY=` blank:
  the dev `.env` points at the real bucket, and blank keys make storage fall back to
  `backend/storage/`.

## Deity pictures and the favourite mantra

- A `Deity` has two pictures: `imagePath` (lists, and the middle of the chant counter) and `fullImagePath`
  (9:16, fills the chant screen; upload kind `deityFullImage`, folder `deities/full`). Both are set on the admin
  **Reference → Deities** tab and sent on a mantra's `deity` as `imageUrl` / `fullImageUrl`.
- `GET /api/app/sadhana/today` also returns `favoriteMantra` (`{ id, slug, name }` or null): the published
  mantra with the most rounds in the user's last 60 days of sessions. The app opens it from "Chant now" when
  no preferred mantra is set.

## Routine (the app's Routine tab)

The phone keeps its routine (tasks per day, the optional daily routine, and its ticks) in local storage and
mirrors it here, so it follows someone to a new phone. Three tables — `RoutineTask`, `RoutineDailyItem`,
`RoutineCheck` — separate from `SadhanaTask` on purpose: that one is a checklist on a `SadhanaDay`, the
routine has categories, a standard time range, a time done at, and daily items that are not rows of any
day. Nothing in `sadhana/tasks` changed.

- **Keyed by the id the phone made**, per user (`@@id([userId, id])`), so two accounts can use the same id
  and a request can only ever reach its own caller's rows. A day is the user's calendar date as
  `YYYY-MM-DD` and times are minutes after midnight — no zone, the way the phone keeps them.
- **One endpoint writes**, `POST /api/app/routine/sync`: removals, then upserts, in a single transaction,
  then the routine as it now stands comes back. Repeating a request changes nothing; the last to arrive
  wins. `GET /api/app/routine` is the same read on its own.
- **`since` bounds the answer**, not what is stored: the whole daily routine always comes back, tasks and
  ticks only from that day on (the app asks for the days its date strip can reach). Older rows are kept.
- Limits are set to what the app can make (title 200, 1000 rows of each kind a request, a range ends after
  it starts and inside the day). A row the server refuses would be refused on every retry, so the app's
  own input limits have to stay inside these.
- Un-ticking drops the time done at on the server too, so a row can never say "not done, at 06:42".

`npm run test:routine` walks it against a running API.

## The chant record (what a sitting stores)

A `ChantSession` is one opening of the counter; `rounds` and `beads` only move forward (`PATCH …/chant/session/:id`), and a
day's total (`recountDay`) sums **finished rounds** of its sessions. That is what lets the app carry a half-finished round into
the next sitting without the day counting it twice: the old sitting keeps its stale partial `beads`, the new one finishes the round.

- **A round is stored as a summary, not as its taps.** `PUT …/chant/session/:id/detail` takes per round `beads`, `startedAt`,
  `endedAt`, `durationMs` and `avgGapMs` (idempotent per `[sessionId, index]`); `complete` only counts with all the beads
  (`beads >= BEADS_PER_ROUND`). A round that was carried over has `durationMs: 0` — unknown, left out of averages. `taps` is still
  accepted (older app builds) and stored when sent, but nothing sends it now; rows already holding taps stay readable.
- **History is per mantra, and only sittings with a finished round.** `GET /chant/sessions` takes `mantraId` (an id, or `none`
  for the plain counter; absent means all) and lists sessions with `rounds > 0`, so a sitting that was opened and left is not
  listed. The app always sends it.
- `npm run test:chant` walks the session lifecycle, the summaries, and the filter.

## Sampradaya from chanting

Which tradition someone follows is **worked out from what they chant**, never chosen.
`User.sampradaya` (null, `shaiva`, `vaishnav`, … whatever `Mantra.sampradaya` carries) is a cache
owned by `services/sampradaya.js` — the same arrangement as `User.isPremium` — and can be rebuilt from
`ChantSession` at any time.

- **A day counts for a tradition** when a bead or round was counted on one of its mantras. Opening
  the counter and leaving does not count, and neither does a sitting with **no mantra attached** —
  the chant screen opens on the mahamantra with nothing chosen, and the manual-rounds sheet has no
  mantra picker, so most chanting says nothing about tradition. Several sittings on one day are one day.
- **Three separate days hold a tradition** (`SAMPRADAYA_MIN_DAYS`), not necessarily in a row, with
  no expiry.
- **The most recent holder wins.** When more than one tradition has three days, the one whose latest
  three days are the later set is the person's. That is what lets it change at any time: three days of
  Vishnu's mantras make a Shaiva Vaishnav, three of Shiva's afterwards make them Shaiva again. It
  goes by the date chanted, not when it was entered, so backfilling old days cannot unseat a recent habit.
- **A dead heat changes nothing** — they keep whoever they were if that is one of the tied, otherwise
  no one yet.
- **Recomputed when a day first gets chanting**, not on every bead: `logManualRounds`, and the first
  bead or round of a live session in `updateSession`. A failure is logged and never fails the request
  that saved the rounds.
- **Mantras are tagged by `sampradaya`, and the default is `vaishnav`.** A universal mantra (the
  seeded `pranava-om` is one) counts as Vaishnav unless its `sampradaya` is changed, so tag it
  deliberately. The admin **Mantras** form has a Sampradaya field for this; blank on a new mantra
  leaves the default.
- Sent on sign-in, token refresh and `GET /api/app/me`. The app does not use it yet.
- `npm run backfill:sampradaya` fills it in for people who chanted before it existed.
  `npm run test:sampradaya` walks the rule over real HTTP with throwaway users.

## Translation runs (admin panel)

The admin **Translations** page translates Prabhupāda's Gita with Claude as a background job and shows it live,
and imports what was saved into the database. The pipeline is the same one `npm run translate:claude` uses
(`scripts/lib/claude-translate-*.js`, described in
[scripts/README.md](scripts/README.md#translating-the-gita-with-claude)); this section is the part that runs it
inside the API, worker and websocket containers.

| File | Job |
|---|---|
| `routes/admin/translation.js`, `controllers/admin/translation.js` | Twelve routes under `/api/admin/translations`: `overview`, `coverage`, `estimate`, `runs` (list), `runs` (start), `runs/:id`, `runs/:id/resume`, `runs/:id/cancel`, `output/:language/chapters/:chapter`, `output/:language/verses/:verseId`, and `imports` (`GET` what the database holds per language, `POST` import or preview). `translation.read` for reads, `translation.run` for start / resume / cancel, `translation.import` for the import |
| `services/translation.js` | Opens the S3 workspace, per-language coverage (cached 300 s), the estimate, the activity feed (Redis `translation:feed:{runId}`, 200 lines, 30 days), the start lock, `addRunJob` |
| `services/translation-import.js` | `importLanguage`: reads a language's chapter files from storage and writes them to `VerseTranslation`, or with `dryRun` only says what it would do |
| `utils/translation-import.js` | Pure functions, no I/O: how a file's verse becomes a row's columns (`rowFromEntry`), whether it is the verse the database holds (`placeProblem`), what differs (`changedColumns`), `reasonOf`. `test/translation-import.test.js` holds them |
| `jobs/processors/translation.js` | The BullMQ processor: runs the pipeline verse by verse, heartbeats, and decides what a stop means |
| `utils/translation-run.js` | Pure functions, no I/O: `classifyError`, `retryDelayMs`, `presentRun`, how a pipeline event reads in the feed. `test/translation-run.test.js` holds them |
| `config/translation.js` | Every timing and limit, with a comment each. Change a number here, not in the processor |
| `prisma/migrations/20261013000000_translation_runs` | `TranslationRun` and the two permissions |
| `prisma/migrations/20261018000000_verse_translation_version` | `VerseTranslation.transliteration`, `wordMeanings`, `translatedBy`, `version`, and the `translation.import` permission. Idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) |

Things to know before changing it:

- **The `TranslationRun` row is the truth, not the queue.** Its `jobId` names the only BullMQ job allowed to work
  it; a job whose id does not match does nothing. That is what makes a duplicate, a leftover or a resurrected job
  harmless, and it is why a page refresh, an API restart or a Redis flush loses nothing: the page reads the row.
- **The processor never fails the BullMQ job itself** (`attempts: 1`, concurrency 1 across all workers).
  `classifyError` turns an error into one of three outcomes, written to the row with a plain-English
  `statusMessage`:
  - **PAUSED, tries again by itself** — Anthropic or S3 busy, the network, 429 / 529. Waits `retryBaseMs` (5 min),
    doubling to `retryMaxMs` (60 min), at most `maxAutoRetries` (12) times *without a verse saved in between*;
    then it waits for a person. Done with `DelayedError` + `moveToDelayed`.
  - **PAUSED until someone presses Resume** — no credit (`credit`), a bad key (`auth`), a missing key or a model that
    cannot do what is asked (`config`), no access to the bucket (`storage`), the budget reached (`budget`).
    Waiting does not fix these; Resume does `job.promote()`.
  - **FAILED** — something nobody foresaw. It gets `unknownRetries` (2) quiet retries first, then the message and
    the verse it stopped on are shown. Resume still works.
  Every verse saved to S3 stays saved, so a resumed run starts at the first verse that is not.
- **One live run per language**, enforced twice: a Redis start-lock and a database check. A second start returns
  409 with `error.details.runId`, which the page turns into "Open that run".
- **A worker that dies mid-run is handled.** The row is touched every `heartbeatMs` (5 s); BullMQ hands the stalled
  job to another worker (`maxStalledCount` 20), and the page warns when a RUNNING run has been quiet for 90 s.
  On SIGTERM the worker hands the run back and exits (`deploy/server/worker.sh` gives it a 40 s stop timeout), so a
  deploy does not cost a retry.
- **`reconcileRuns` is the safety net**: every 2 min and on boot it re-queues any QUEUED / RUNNING / PAUSED run
  whose BullMQ job is missing (a Redis flush, a crash between saving the row and queuing the job).
- **Live progress is two websocket events**, published through Redis `ws:permission` by the API and the worker and
  delivered by the websocket container to sockets whose role has `translation.read`: `translation.run` (the whole
  presented run) and `translation.activity` (`{ runId, at, kind, level, text, verseId? }`, one feed line). The page
  still works without the socket by polling.
- **A language already translated under the current `TRANSLATION_VERSION` is not translated again.** A verse is
  *current* when Prabhupāda's translation exists and Claude's stamp on it (`aiTranslation.version`) is the running
  version, or there is no stamp (a person's text, which is never replaced). Any other version, newer or older, is
  *outdated* and is translated again. `start` with nothing but current verses in the chosen chapters creates no run and
  answers 409 `error.details = { upToDate: true, version }`; the estimate carries `version` and `outdated`, and
  coverage `upToDate` per language and chapter. To translate it all again, set a new `TRANSLATION_VERSION`.
- **Import puts storage into the database; storage stays the truth.** `POST /imports` `{ language, chapters?, publish?,
  dryRun? }` reads `json/bhagavat-gita/<language>/ch-<n>.json` and writes the Prabhupāda `TRANSLATION` row of each verse:
  `meaning` (the translation), `purport`, `transliteration`, `wordMeanings`, and `translatedBy` / `version` from the
  verse's `aiTranslation`. Rules, so nobody has to rediscover them:
  - **The verse is found by its place, and checked.** `verseId` inside the book, and the file's book / canto / chapter / verse
    numbers must agree with the row's. A verse not in the database, or that disagrees, is reported and left alone; an
    import never creates a `Verse`.
  - **An existing row is replaced in place.** The key is the table's own `(verseId, translatorId, languageCode, type)`, so the
    row keeps its `id` and `createdAt`. A part the file no longer has (a purport removed) is cleared, because storage is the
    truth. A row that already matches is counted `unchanged` and not written. Other translators, other languages and the
    English are never touched.
  - **Hidden unless `publish`.** A new row has `isPublished: false`; an existing row's visibility is never lowered; `publish: true`
    raises it and needs `verse.publish` as well as `translation.import`. The readers' endpoints only serve published rows.
  - **One transaction per chapter.** A failed chapter is reported with its reason and rolled back (its counts are zeroed), the
    others carry on, and running it again is harmless. `dryRun` does the same work and writes nothing; it is what the page
    shows before the button is pressed.
  - **One import per language at a time** (Redis `translation:import:<language>`, `importLockSeconds`); a second gets 409. A
    preview neither waits for the lock nor takes it. An audit row `translation.import` records who, what and the totals. The
    page offers Import only while no run for that language is live; the API does not enforce that.
  - **A hand edit on the Verses page is overwritten** by the next import of that verse. Editing a translation there does not
    touch `translatedBy` / `version`, so a hand-edited row can still read "made by Claude" until it is imported again.
  - **The read side is not changed yet.** The app and the offline book export serve `meaning` and `purport`; they do not yet
    send a translation row's `transliteration` or `wordMeanings`, and nothing marks a text as machine-made. That is the next step.
- **The three permissions are inserted by the migrations** (`translation.read`, `translation.run`, `translation.import`) and
  given to `admin` and `super_admin`; any other role gets them on the admin Roles page. Permissions are cached for about 5
  minutes, so a new grant can take that long to show.
- **The bucket is the app's own** (`S3_BUCKET`, the AWS keys the API already has; `json/bhagavat-gita/` sits in it beside
  the book text). Nothing separate to configure: `openWorkspace()` in `services/translation.js` uses
  `services/s3.js`'s client. `SOURCE_S3_BUCKET` is read only if set (the command line's `.env.scripts` setting; it
  would send the server to a different bucket) and `SOURCE_LOCAL_DIR` is for tests. The keys must be allowed to
  **write** under `json/bhagavat-gita/` and `json/reports/`, and to copy to `json-backup-*/`. The page's checklist
  reads the first English chapter, so a bucket it cannot reach or that lacks the scripture is reported there.
- **Needs in the server `.env`** for the `api` and `worker` containers: `ANTHROPIC_API_KEY`, and `TRANSLATION_VERSION`
  (optional). Without a key the page says so and the Start button is disabled.
- **Do not run `npm run translate:claude` while the worker is working a run for the same language.** They write the
  same chapter files; each write is conditional on the object not having changed, so one of them stops, but neither
  knows about the other.
- `npm run test:translation` (`scripts/translation-e2e.js`) walks it against the real database, Redis and a real
  BullMQ worker with Claude faked: start, progress, credit pause and Resume, a 529 retry, cancel, a killed
  worker, a flushed queue, permissions, the version rule, the import's permissions and lock, and the output endpoints.
  `npm run test:translation-import` (`scripts/translation-import-e2e.js`) walks `importLanguage` against the real database
  with a throwaway book and a local folder: new, replaced in place with the id kept, unchanged, a part cleared, refused
  verses, a rolled-back chapter, the visibility rules, dry runs and two imports at once. `npm test` needs Node ≥ 21 for its
  test glob; under Node 20 run
  `node --test test/translation-run.test.js test/translation-import.test.js test/claude-translate.test.js`.
- **Not exercised:** a real Claude call and a write to the real bucket (the e2es use `SOURCE_LOCAL_DIR`; the app's
  bucket has only been read, by the page's check and coverage). Run `npm run translate:claude:test` first. The import
  has not been run against the Gita's real S3 files either; do a `dryRun` from the page first.

## Client attestation on signup

An unauthenticated account-creation request must be provably from **our own clients** — the mobile app or our website. Nobody should be able to create accounts by hitting the API directly.

## Code graph

A code-build-graph package should be wired up and re-run periodically so the structure stays navigable. *(Not currently installed — needs setting up; confirm which package is meant.)*

## Resolved

- **API docs tool — Scalar.** Served at `/docs` from a spec built out of the
  route registry. See rule 9.
- **Attestation — Firebase App Check.** `middleware/attestation.js`, applied to
  sign-in and device registration: Play Integrity on Android, App Attest on iOS,
  reCAPTCHA on web. Firebase was already in the project for push, so it added no
  new vendor. Controlled by `APP_CHECK_ENABLED`, which is off by default outside
  production so a local client can be pointed at the API without a Firebase
  project — turning it off *in* production is a decision someone has to make in
  the environment, and it logs a warning every boot.

## Open questions

- **`code-build-graph`** — still not installed, and no package by that name was
  found on npm. Confirm which tool is meant.

## Storage layout (S3)

One parent folder, `hariharibol/`, holds every saved file: `hariharibol/<kind prefix>/<id>.<ext>`
(prefixes are `PREFIXES` in `services/s3.js`).

A presigned upload never lands there directly. It goes to
`temp/<DD-MM-YY>/hariharibol/<kind prefix>/<id>.<ext>` and that temp key is what the
client gets back. When the client saves a row with it, `config/database.js` (a Prisma
client extension on create/update/upsert) moves the object to the same path without
`temp/<DD-MM-YY>/` and stores the permanent key — plain columns and keys inside JSON
columns alike, so no controller has to call anything. The monthly `s3.temp.prune` job
(`config/cron.js`, 1st of the month 04:00 UTC) deletes temp days older than 30 days —
uploads nobody saved. Keys saved before this layout have no `hariharibol/` root and
still work; nothing rewrites them.
