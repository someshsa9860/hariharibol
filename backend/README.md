# HariHariBol — Backend

Plain Node.js — **ESM, no TypeScript, no build step**. Express, Prisma, Postgres, Redis.

The rules this is built to are in [CLAUDE.md](CLAUDE.md). This file is how to run it.

## Getting started

```bash
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev        # creates the schema
npm run seed                  # roles, languages, issues, deities, plans, settings, the books
npm run dev                   # http://localhost:4000
```

The books come with no chapters or verses yet. Those are loaded by the importers,
which read the scripture source bucket, and then the seed runs once more for the
stories that point at those chapters — the order is in
[scripts/README.md](scripts/README.md#a-new-database-start-to-finish).

Then open **http://localhost:4000/docs** — every endpoint, with what it does and
what it needs.

### With Docker

```bash
docker compose up --build
```

Brings up Postgres, Redis and all four application containers.

## The four processes

Separate containers, separate failure modes. One image, four commands.

| | Command | Port | What it does |
|---|---|---|---|
| **api** | `npm start` | 4000 | The HTTP API and the docs |
| **worker** | `npm run worker` | — | BullMQ jobs; owns the cron schedule |
| **websocket** | `npm run websocket` | 4001 | Live connections, fed from Redis |
| **deeplink** | `npm run deeplink` | 4002 | Shared links and the store association files |

The API never processes jobs and never holds a socket. It publishes to Redis and
the other two pick it up, so a twenty-minute AI batch pass cannot compete with
request handling for the same event loop.

## Where things are

```
server.js          starts the HTTP server, nothing else
app.js             the express app — every route family is mounted here
config/            env, database, redis, cors, cron, logger, constants
middleware/        auth, attestation, rate limits, errors
routes/            app/ · web/ · admin/ · webhook/
controllers/       mirrors routes/ exactly, file for file
services/          shared infrastructure: auth, s3, fcm, ai/, payments/, …
utils/             small helpers — router, present, dates, languages
jobs/              queue definitions and processors
views/             email templates and server-rendered pages
docs/              the OpenAPI document, built from the routes
prisma/            schema and seed
```

Two conventions worth knowing before you write anything:

**Routes carry their own documentation and access rules.** A route is registered
through `utils/router.js`, which takes a metadata object alongside the handler:

```js
router.post(
  '/mood',
  {
    summary: 'Report a struggle and receive a sloka for it',
    description: '…',
    limit: 'write',
    body: z.object({ issueSlug: z.string() }),
    responds: { 201: 'The chosen sloka' },
  },
  controller.mood
);
```

That object is the docs, the validation and the auth guard. A route without a
`summary` throws at boot, and every route requires a signed-in user unless it
says `public: true` — so an undocumented or unguarded endpoint cannot be written
by accident.

**Validated input lands on `req.valid`**, never `req.body`. `req.valid.body`,
`req.valid.query`, `req.valid.params`.

**Modules are ESM.** Relative imports need the `.js` extension, directories are
imported as `.../index.js`, and there is no `__dirname` — use
`import.meta.dirname`. Most modules export named bindings, so import them as a
namespace:

```js
import * as s3 from '../services/s3.js';        // named exports
import router from './routes/app/index.js';      // a genuine single value
```

A plain default import of a module that has no default export gives you
`undefined` rather than an error, so it is worth getting right first time.

## Commands

| | |
|---|---|
| `npm run dev` | API with reload |
| `npm run worker` | Background jobs |
| `npm run websocket` | Realtime server |
| `npm run deeplink` | Deeplink server |
| `npm run seed` | Reference data (safe to re-run) |
| `npm run recount:books` | Rebuild verse / chapter / canto counts from the rows (`-- --dry-run` to look first) |
| `npm run prisma:migrate` | Create and apply a migration |
| `npm run prisma:studio` | Browse the database |
| `npm run docs:export` | Write `docs/openapi.json` |

## Book cache — silent offline books

The app makes a book readable offline without ever asking the API for its text. Once a
week the worker exports every book to S3; the app reads a manifest, then downloads only
the files it lacks, straight from S3.

```
 weekly cron ─► services/book-cache.js ─► s3://<bucket>/books/caches/…      (gzipped JSON)
                      │                         ▲
                      └─► BookCacheUnit table   │ presigned link (15 min)
                              ▲                 │
 app ─► GET  /api/app/books/:book/manifest      │   what exists, version, hash
     ─► POST /api/app/books/:book/download-url ─┘   { unitId } → link
```

### S3 layout

```
books/caches/manifest.json                        every unit, all books
books/caches/bhagavad-gita/chapter-<n>.json       one per chapter
books/caches/srimad-bhagavatam/canto-<n>.json     one per canto (all its chapters)
books/staging/<book>/…                            uploads in flight (this, and only this, is deleted)
```

The cut is per book in `config/book-cache.js` (`UNIT_TYPES`); a scripture not listed is cut
by canto if it has cantos, else by chapter. Short works are not exported — the API returns
them in one call. **The job never deletes anything under `books/caches/`, and no S3
lifecycle rule may expire that prefix**: a phone that last synced a year ago must still
find its file. Not under `hariharibol/` like uploaded media: these are generated, not
referenced by a row's media key.

Each file holds, per verse: `id`, `verseId`, numbers, `sanskrit`, `transliteration`,
`wordMeanings`, `audioPath` (a key — a link in the file would change its hash every hour;
the app trades keys for links at `/audio-urls`), and every **published** translation in
every language (`meaning`, `purport`, translator, `languageCode`, `type`); plus book, unit
and chapter metadata, `schemaVersion` and `updatedAt`.

### How a run decides what to upload

1. Build the unit; serialise with sorted keys (`utils/book-cache.js`) and hash the bytes (SHA-256).
2. Compare with `BookCacheUnit.hash`. Same hash and the file exists → **skip** (no transfer, no write).
3. New or different → gzip, upload to `books/staging/`, copy over the live key, delete the staging copy,
   then upsert the row with `version + 1`. File missing but hash unchanged → re-upload at the same version.
4. If anything changed, rewrite `manifest.json` from the table.

A Redis lock (`lock:book-cache:export`, renewed while running, expires on its own) means two
workers — or a worker and a manual trigger — never export at once; the second reports
`locked: true`. Each unit retries 3× with exponential backoff, then the queue retries the
job; finished units are skipped by hash, so a retry is cheap. The report: checked, created,
changed, repaired, skipped, failed, bytes uploaded.

### Configuration

| Variable | Default | |
|---|---|---|
| `BOOK_CACHE_ENABLED` | `true` | `false` removes the schedule |
| `BOOK_CACHE_CRON` | `0 0 * * 0` | Sunday 00:00 |
| `BOOK_CACHE_TZ` | `Asia/Kolkata` | IANA zone the cron is read in (other jobs are UTC) |
| `BOOK_CACHE_PREFIX` | `books/caches` | |
| `BOOK_CACHE_DOWNLOAD_TTL_SECONDS` | `900` | life of a download link |

### Running it by hand

```bash
npm run cache:books                           # what the cron does
npm run cache:books -- --dry-run              # report only, write nothing
npm run cache:books -- --book bhagavad-gita   # one book
npm run cache:books -- --force                # re-upload everything, bump versions

# or as an admin (permission job.manage): queue it, or run it in the request
POST /api/admin/book-cache/run   { "wait": true, "dryRun": true, "books": ["bhagavad-gita"] }
GET  /api/admin/book-cache       # what is exported, per book
```

With no AWS keys in development the files land in `backend/storage/books/caches/`.

### Tests

```bash
npm test                  # hashing, canonical JSON, diff decision, retry, lock (no services needed)
npm run test:book-cache   # the export and all four endpoints over HTTP (API running, AWS keys blank)
```

## First admin

The seed deliberately creates no admin — a seeded account with a known email is
a credential in version control. Sign in through the app, then promote yourself:

```bash
npx prisma studio     # User → set roleId to the super_admin role
```

## A few things that will save you time

**Dates are the user's, not the server's.** Sadhana days, slokas and reminders
are anchored to `User.timezone`. Someone in Toronto and someone in Mumbai are on
different dates at the same instant, and getting this wrong shows up as a
missing day in someone's practice record. Use `utils/date.js`.

**Three languages, not one.** Each user picks an app language, a mantra language
and a reading language, independently. A mantra response may combine two of
them — the script from one, the meaning from another. `utils/present.js` handles
the resolution; don't do it by hand.

**Media columns hold S3 keys, not URLs.** The bucket is private. `presignGet`
signs at response time; a stored URL would be a permanent public link that also
expires.

**AI never runs on a request.** Model calls happen in `jobs/processors/ai.js`,
ahead of time, and write into `VerseIssue` and `VerseExplanation`. Serving a
user is then a database query. If you find yourself wanting `services/ai` from a
controller, the answer is a job.

**Money is integer minor units.** Paise, cents. Never a float — it drifts as
soon as it is summed.

**Webhooks are the truth about payments.** The client-side verify endpoints
exist so nobody stares at a paywall they have just paid to remove. Both write
through the same upsert on `(provider, externalId)`, because providers retry.
