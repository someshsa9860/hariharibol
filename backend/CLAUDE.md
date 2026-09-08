# Backend — HariHariBol API

Plain **Node.js. No TypeScript.** Simple, readable code. Prisma for the database.

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
│   ├── s3.js              # uploads + presigned URLs (bucket is private)
│   ├── auth.js            # tokens, google/apple verification, permission cache
│   ├── entitlement.js     # who is Premium, and why
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

1. **JavaScript, not TypeScript.** No build step for the API code.

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

**The app is free.** Paywalling is the exception, not the model — default any new
feature to free unless there is a decision otherwise.

| Free | Premium |
|---|---|
| All books, verses, mantras and translations | Mood-driven sloka: reporting a struggle and getting a verse chosen for it |
| Chanting, sadhana targets, tasks, reports | |
| The global sloka of the day | |
| A personal daily sloka, drawn from the eligible pool | The same slot, but *chosen from what you reported* |

The paid feature is the one with a per-user AI cost behind it, so spend follows
revenue rather than running ahead of it.

**Free readers get a monthly quota** (`sloka.mood.free_quota_per_month`,
default 3) before the paywall applies. Gating the feature completely would mean
most people never experience the one thing that makes Premium worth buying. The
quota counts *days*, not requests — one personal sloka exists per person per
date, so someone working out what is really bothering them can re-report without
being charged for changing their mind.

**Everything that picks a verse must respect the same line.** Both
`GET /sloka/mine` and the nightly build job only use `UserIssue` when the reader
is Premium; a free reader gets a verse from the eligible pool. Without that,
reporting a struggle to the free endpoint and reading the personal sloka the
next morning would be the paid feature through an unlocked side door.

**Premium is earned two ways**, and they are worth equal access:

- an **active subscription** — one monthly plan, named "Premium"
- **any donation, of any amount**, through Google Play, Apple or Razorpay. A
  donor keeps premium permanently: `premiumUntil` stays null.

`User.isPremium` is a cache, owned by the payment webhooks and the daily job, and
rebuildable from `Subscription` and `Payment` at any time. Read entitlement from
it; never scatter subscription logic through controllers.

**Payments are one ledger.** Subscriptions and donations both land in `Payment`,
separated by `purpose`. They arrive the same way and reconcile the same way, so
splitting them would mean maintaining two of everything.

`(provider, externalId)` is unique on both `Payment` and `Subscription` because
every provider retries webhooks — without that constraint a retry credits the
user twice. Store money as integer minor units (paise, cents); floats drift.

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
