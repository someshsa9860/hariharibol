# HariHariBol — Backend

Plain Node.js. No TypeScript, no build step. Express, Prisma, Postgres, Redis.

The rules this is built to are in [CLAUDE.md](CLAUDE.md). This file is how to run it.

## Getting started

```bash
cp .env.example .env          # then fill in DATABASE_URL and JWT_SECRET
npm install
npx prisma migrate dev        # creates the schema
npm run seed                  # roles, languages, issues, deities, plans, settings
npm run dev                   # http://localhost:4000
```

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

## Commands

| | |
|---|---|
| `npm run dev` | API with reload |
| `npm run worker` | Background jobs |
| `npm run websocket` | Realtime server |
| `npm run deeplink` | Deeplink server |
| `npm run seed` | Reference data (safe to re-run) |
| `npm run prisma:migrate` | Create and apply a migration |
| `npm run prisma:studio` | Browse the database |
| `npm run docs:export` | Write `docs/openapi.json` |

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
