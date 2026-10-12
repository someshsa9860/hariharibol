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

`deliver()` in `jobs/processors/sloka.js` pushes each user's sloka at their own hour. **The body is the
verse** — Sanskrit first (so the collapsed notification shows it), then its meaning in the reader's
language, then "Bhagavad Gita 2.47" — built by `slokaPush` in `utils/sloka-push.js` (pure; `npm test`). Why
it was chosen (`UserDailySloka.reason`, "Because you mentioned …") is no longer in the push; the app shows it.

- **The data carries the verse's place in its book** — `bookSlug`, `cantoNumber`, `chapterNumber`,
  `verseNumber` beside `verseId` and the `hariharibol://sloka/<verseId>` deeplink — so the app opens the
  chapter at the verse without a lookup. The app reads those names from `PushConfig`
  (`app/lib/core/constants/push_config.dart`); rename one and rename it there.
- **The verse is read per push**, after the delivery-hour check, not with the pending rows: only the users
  whose hour has come are sent anything, and which translations to fetch depends on who they are.
- **The meaning is cut at 220 characters, the verse at 600** — a push is capped at 4 KB and a Devanagari
  character is three bytes of it.

## Mantra chant phrases

`Mantra.chantPhrases` (`String[]`, default empty) is how a mantra may sound when chanted: plain Roman
spellings, one full repetition each — the standard transliteration plus looser spellings of what an
English-trained recogniser writes down. The app's auto count matches the live transcript against them
(≥ 36% — `AutoChantConfig.matchThreshold` in the app — stricter for a further repetition of a very short mantra), so fast or slurred chanting still counts. Written by the seed
from `prisma/seed/chant-phrases.js` (every run, like the rest of a mantra's seed fields), accepted by the
admin create/update, and sent on every mantra as `chantPhrases`. The admin panel has no field for it yet.
A mantra with none falls back to `transliteration` in the app.

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
