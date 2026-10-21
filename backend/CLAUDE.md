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
│   ├── legacy.js          # asks the previous app's (Laravel) server who an old token belongs to
│   ├── entitlement.js     # who is Premium, and why
│   ├── book-counts.js     # verse / chapter / canto counts, rebuilt from the rows
│   ├── fcm.js  notify.js  otp.js  mailer.js  websocket.js
│   ├── setting.js         # AppSetting reads, encrypted secrets
│   └── audit.js
├── utils/                 # small stateless helpers
│   ├── router.js          # documented routes + auth guard + validation
│   ├── present.js         # language resolution + media signing for responses
│   ├── crud.js            # the reference-data CRUD builder
│   └── date.js  language.js  errors.js  respond.js  pagination.js  legacy.js
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

### Sessions and tokens

The apps (mobile and admin) keep a person signed in for as long as the server says their session is good, so the way the server says "no" is a contract.

- **Access token**: signed JWT (`typ: 'access'`), `ACCESS_TOKEN_TTL` = **7d**, verified in-process (`services/auth.js`). **Refresh token**: random, only its SHA-256 stored (`RefreshToken`), `REFRESH_TOKEN_TTL_DAYS` = **365**, replaced on every use. The apps renew the access token about once a day, so a person in regular use never meets an expired one; one who is away for a while still has a year to come back.
- **"Not signed in" is a 403, never a 401.** `unauthorized()` (`utils/errors.js`) is 403 with code `UNAUTHENTICATED`; `forbidden()` is 403 with code `FORBIDDEN` (signed in, lacks the permission). The apps tell them apart **by code**: only `UNAUTHENTICATED` makes them refresh, and **a 403 `UNAUTHENTICATED` answering `POST /auth/refresh` is the only thing that signs anyone out.** So:
  - throw `unauthorized()` only when a credential is not valid — never for a validation error (400), a rate limit (429), a missing resource (404) or anything that could pass on its own (5xx). A refresh that fails any of those other ways leaves the person signed in to try again;
  - a failed sign-in (a Google or Apple token that does not verify) is `unauthorized()` too, now 403, and the app shows it as a sign-in failure (it sends no bearer then);
  - a new 403 that means "no permission" must use `forbidden()` and its `FORBIDDEN` code, or an app will take it for a lapsed session and refresh in a loop.
- **A spent refresh token is not always theft.** Presenting one that was already used revokes every session on the account — except when it was spent within `REFRESH_REUSE_GRACE_SECONDS` (default 300): the usual cause is a phone that sent the refresh, lost the reply, and asks again when its signal returns, and signing the person out of every device for that is the wrong answer. Inside the window the old token gets a fresh pair and nothing is revoked. **The cost**: someone who has copied a refresh token and replays it inside the window also gets a session of their own (and rotating it then spends the real owner's next token, who gets one more grace). Set it to 0 for the strict behaviour.
- **A bad bearer is refused even on a public route** (`middleware/auth.js` establishes who is asking, and an expired or garbage token is not "nobody"), so a client must send none on sign-in or logout. `POST /auth/logout` is public for the same reason: the refresh token in its body is the credential, and signing out has to work when the access token has already lapsed.
- `npm run test:auth` walks it over real HTTP: the 403/`UNAUTHENTICATED` shape, garbage and expired bearers, rotation, reuse inside and outside the grace window, theft revoking every session, a malformed refresh token (400, not 403), logout, and forged Google/Apple tokens.

### Legacy users (people who used the previous app)

The previous app ("Sadhana": Laravel + MySQL at `https://ramkrishnahari.callvcal.com`, same bundle id) left an access token (a Sanctum token, `id|secret`, no expiry) on each phone. `POST /api/app/auth/legacy` trades it for a session here, so someone who updates is not asked to sign in. Both servers are on the same host. The Laravel half lives in `app/api/HariHariBolApi` (`MigrationController`, `MigrationKeyMiddleware`, route `POST /api/migration/hariharibol`, alias `migration.key`); the app's half is "Signing in from the previous app" in [app/CLAUDE.md](../app/CLAUDE.md).

- **The flow.** The app sends `{ legacyToken, the usual languages / timezone / device fields }` — public, attested and rate-limited like `/auth/social` (tag `signup`), no bearer. `services/legacy.js` `lookup()` posts the token to the old server's migration route with the shared key in `X-Migration-Key`; that server answers who it belongs to and their five most-chanted mantras. This server finds the person by `User.legacyUserId` (unique) or makes the account, then `issueSession`, and answers exactly as `/auth/social` does: **201** for a new account, **200** for one carried over before. Repeating it, or doing it from another phone, gives the same account. **This server never reads the token** — the old server is the authority on it — and a request the old server rejects writes nothing.
- **Two kinds of "no", and the app acts on the difference.** `403 UNAUTHENTICATED` means the old server does not accept the token (never issued, expired, account deleted) and `409 CONFLICT` that the account cannot be had this way (an account here has that email — it is linked first, see below — or it signs in with Google or Apple now, or it is banned): the app deletes its old token on either. **Everything else is `503 LEGACY_UNAVAILABLE`** — not configured, a wrong shared key, the old server down / slow / busy / answering oddly, sign-ups closed — and the app keeps the token for the next launch. Keep it that way: a wrong or rotated key is a 401 `invalid_key` from Laravel and must never become `UNAUTHENTICATED` here, or one misconfiguration would delete every update-day user's way in. The reason for a 503 goes to the log (`old server could not be asked`); neither the token nor the key is ever logged.
- **A legacy token is not proof of who owns an email.** The old `signInCustom` (guarded only by a hard-coded shared header) hands a token to anyone who names an existing email, no password. So a legacy token never opens an existing Google or Apple account (409; it is only linked to it, next point), and a later verified Google / Apple sign-in whose address matches **claims** the account (`claimLegacy` in `controllers/app/auth.js`): every session is revoked first, `authProvider` / `providerUserId` become the provider's, and from then on an old token gets 409. Set **`HHB_MIGRATION_TOKENS_BEFORE`** on the Laravel side to the release date of the app that sends it, so a token minted afterwards by that unguarded endpoint cannot be traded. Old tokens are never revoked by Laravel (there is no logout route), but the old app wipes its own storage on logout, so only people still signed in at update time can migrate.
- **An account here that already has the email is linked, not opened.** The old email is looked up **without regard to case** (`accountsWithEmail` in `controllers/app/auth.js`): Google and Apple store the address as they sent it, the old server's is lower-cased, and the unique index counts `Anna@x.com` and `anna@x.com` as two people — an exact lookup used to miss the first and make a duplicate account. When the holder was proved by Google or Apple, `linkOldIdentity` records which old user it is (`legacyUserId`) and seeds `SadhanaProfile.legacyFavoriteMantraId` where the profile has none (it makes the profile if there is none; a favourite or round target already there is kept), then the route **still answers 409 and issues no session**. The app drops the token and shows its usual sign-in, and the Google / Apple tap lands in that same account, which already knows the person (their old favourite mantra opens "Chant now"). The favourite is written first and the link last, because the link is what stops this running again: a failure in between is simply retried on the next launch. An account already tied to a different old user is left as it is; a LEGACY holder keeps the placeholder-address rule; and as it is an existing account, closed sign-ups do not turn it into a 503. **Why the old token does not just sign them in:** that would let anyone who can ask the old server for a token for an address (its hard-coded header, in a public app, is all `signInCustom` wants) into every Google / Apple account whose address is in the old database. Closing that means changing the old server's sign-in, which today asks for nothing but an email and a shared header; until then the one tap is the price. **Not covered:** someone who signs in here with a different address from the one they used there, and old accounts with no real address (a placeholder, so nothing for Google / Apple to match) — they come across as separate accounts.
- **Accounts.** `AuthProvider.LEGACY`, `providerUserId = legacy:<id>`. The email is the old one (lower case) when it is a real address nobody here has, else a placeholder `legacy-<id>@legacy.invalid` (the old Google / Apple sign-in wrote made-up ones like `name@2024-05-01-12:30:00`); **a placeholder is never sent to the app** (`emailForApp`, applied wherever a user is presented), so an account can have no email on the phone. The name, picture and email are tidied by `utils/legacy.js` (`cleanName`, `httpsUrl`, `usableEmail`).
- **The favourite mantra.** The old server sends the person's top mantras by lifetime count (`sss_namsmaran_record`, else summed from `sss_namsmaran_data`). `utils/legacy.js` `pickFavourite` maps the most-chanted one it can to one of ours — the by-hand `MANTRA_SLUGS` in `config/legacy.js` first, then a match on the consonant skeleton of the name and text (`MATCH` thresholds, deliberately leaning to "no match": a wrong mantra costs more than none) — and stores it as `SadhanaProfile.legacyFavoriteMantraId`. `GET /sadhana/today` falls back to it for `favoriteMantra` (`favouriteMantra` in `controllers/app/sadhana.js`) until the person has chanted here in the last 60 days, so "Chant now" opens on Om Namah Shivaya (or whatever it was) from the first minute, and chanting here takes over by itself. **`MANTRA_SLUGS` is empty on purpose.** The old `mantras` table (48 rows, 44 not deleted) was compared with our 11 published mantras on 2026-10-20 with `node scripts/legacy-match-mantras.js <the old table as JSON>` (reads the database it is pointed at, writes nothing): 7 old rows match, all correctly (Shiva Panchakshari twice → `om-namah-shivaya`, Hare Krishna, "Lord Krishna Mantra" → `om-namo-bhagavate-vasudevaya`, Shiva Gayatri, Narasimha, Maha Mrityunjaya) and none wrongly. The other 37 are not in the catalog at all — Jay Jay Ram Krishna Hari (about half of all old chanting), Swami Samarth, Datta, Ganesh, Hanuman, Narayana, "Om Shri Ramaya Namah", Sai — so an override could only point them at the wrong mantra. Run through `pickFavourite` for every person with chanting, 28 of 68 would get a favourite (Om Namah Shivaya 11, Vasudeva 7, Hare Krishna 6, Narasimha 2, Shiva Gayatri 1, Maha Mrityunjaya 1) and 40 none; **adding those mantras in the admin Mantras page is what raises that number**, and the matcher then finds them by itself. Adding up the old table's duplicate rows of one mantra (ids 1 and 47 are both the Panchakshari) would change nobody's pick, so `pickFavourite` does not. The log line `old favourite mantra` says what matched, how, and which titles matched nothing; use `MANTRA_SLUGS` only for a mantra it gets wrong or cannot tell.
- **Config** (`config/env.js`): `LEGACY_MIGRATION_URL` (`https://ramkrishnahari.callvcal.com/api/migration/hariharibol`), `LEGACY_MIGRATION_KEY` (at least 32 characters, **the same value as Laravel's `HHB_MIGRATION_KEY`**; a random 64-hex string, never committed) and `LEGACY_MIGRATION_TIMEOUT_MS` (8000). Either one missing switches the whole thing off (503), and on the Laravel side an unset or short key makes the route a 404 `not_configured`. Redirects are refused (`redirect: 'error'`: the key is a header). The old server's key lives in its `.env` (`/var/www/html/g-hariharibol-api/.env` on the host; that checkout's config is not cached, so a change is read at once), this one's in `/var/www/hariharibol/server/.env`. The container reads its env file only when it is created: after changing it, re-create the container with `IMAGE_TAG=<running sha> ./api.sh` (a backend deploy does the same). The old server's route, header and key are described in the docblocks of `MigrationController` and `MigrationKeyMiddleware` in that repository, which has no `.env.example`.
- **Schema.** `User.legacyUserId Int? @unique`, `AuthProvider.LEGACY`, `SadhanaProfile.legacyFavoriteMantraId`; migration `20261026000000_legacy_users`, which only adds (an enum value, two nullable columns, their indexes and one foreign key), so the running containers are unaffected while it applies. The deploy applies it itself: `deploy/server/migrate.sh` runs `prisma migrate deploy` in a throwaway container before anything is restarted.
- **Tests.** `npm run test:legacy-migration` (`scripts/legacy-migration-e2e.js`, real HTTP and database against a fake old server: new / returning / concurrent, every refusal, the 503 cases, an account that already has the email in any case — linked, no session, favourite kept, not retied, sign-ups closed, four at once — the claim rule, the favourite mantra; 118 checks) and `node --test test/legacy.test.js` (the matching and tidying helpers). The Laravel route has no automated test of its own; it was checked by hand against the live server (below).
- **Checked on the live old server (2026-10-20, read-only):** the deployed `MigrationController`, `MigrationKeyMiddleware`, `Kernel.php` and `routes/api.php` are byte-identical to the old repository's. With the key set, a wrong key is 401 `invalid_key` and a junk token 401 `invalid_token`. Every column the controller reads exists. All 301 stored tokens belong to `App\Models\User`, none has an `expires_at` (and `sanctum.expiration` is null) and none points at a missing user, so a good token cannot be turned away by the model or expiry tests. `topMantras` gave at most five, most first, every field set, for the heaviest chanter, and `[]` for someone who never chanted; nobody needs the per-mala fallback (195 users, none flagged deleted, 69 with chanting). The running API container reaches the old server's public URL from inside the host (`docker exec hariharibol-api node -e 'fetch(...)'` got the route's own answer back), so the hairpin through the host's own address works. **Not done:** no real token has been traded through the live route (none was minted or taken, and nothing was written to the old database), so the first real sign-in is the first time the whole path runs — watch the API log for `old server could not be asked` and `old favourite mantra` — and nothing has run from a phone.

## AI

Gemini is the provider we use. It is not the provider the code knows about.

- Everything goes through `services/ai/` behind one interface. Callers ask for a
  completion; they never learn which provider answered. Swapping Gemini for
  something else must touch only `services/ai/`.
- Provider and models come from `.env` (`AI_PROVIDER`, `*_MODEL`, `*_SUMMARY_MODEL`,
  `*_ADVANCED_MODEL`); `AppSetting` (`ai.provider`, `ai.model.text`), when set, overrides them
  without a deploy. API keys are secrets — encrypted, never returned.
- Every call is written to `AiUsageLog` with tokens and cost. An AI feature whose
  spend cannot be attributed to an operation does not ship.
- **OpenAI reasoning models (`gpt-6-luna`)** take different request parameters from the older ones, and
  `openai.js` knows which is which from a `reasoning` flag on the model's `PRICING` row: they get
  `reasoning_effort` (`OPENAI_REASONING_EFFORT`, `none` unless set) and a `temperature` only alongside
  `none` — at any other effort OpenAI answers 400 to every temperature but the default. Thinking tokens
  arrive inside `completion_tokens`, so they are billed and debited from a reader's wallet like output; that
  is why chat does not think by default. A model used with this provider needs a `PRICING` row for its price
  and its parameters. Tested in `test/ai-stream.test.js`; run live against `gpt-6-luna` and `gpt-4o-mini`
  (stream and complete) on 2026-10-16.
- **Saved settings beat `.env`, and are cached.** `ai.provider` / `ai.model.text` in `AppSetting` decide
  before `AI_PROVIDER` / `*_MODEL` are read, so a database that still holds them ignores a changed `.env`;
  change them on the admin Settings page (applies on the next call) or clear them. Switching the provider
  without the model sends the old provider's model name to the new one.
- **Gemini retires models without warning.** `gemini-2.0-flash`, `gemini-2.0-flash-lite` and `gemini-2.5-flash-lite` all
  answered 404 on 2026-10-17; `gemini-3.5-flash-lite` works. A retired model saved on the Settings page is not corrected by
  the `.env` default — chat keeps answering only because the engine chain below fails over to `AI_FALLBACK_MODEL`, at the
  price of one wasted request a reply. The Ask Sakha page's **Answering with** card shows the chain.

### OpenAI's free tokens, the engine chain and the token calculator

OpenAI gives this organisation free tokens every day for sharing its API traffic with OpenAI (platform.openai.com →
Settings → Data controls → Sharing). That page, read on 2026-10-17, lists two pools: **250,000 tokens a day** across
`gpt-5.4`, `gpt-5.2`, `gpt-5.1`, `gpt-5`, `gpt-4.1`, `gpt-4o`, `o1`, `o3`, and **2,500,000 a day** across `gpt-5.4-mini`,
`gpt-5.4-nano`, `gpt-5-mini`, `gpt-5-nano`, `gpt-4.1-mini`, `gpt-4.1-nano`, `gpt-4o-mini`, `o3-mini`, `o4-mini`. Past a
pool OpenAI does not refuse — it bills the standard rate — and every other model is billed from the first token:
**`gpt-6-luna` is not free.** The pools are shared by every project on the organisation. The page says only "tokens": the
code adds input and output together and assumes the day ends at midnight UTC, which can only make it stop early.

| File | Job |
|---|---|
| `utils/ai-free-tier.js` | **Pure.** The pools and which model is in which, the 90% stop (`SAFETY`), the models an admin may pick (`USABLE_MODELS`), which translation parts may move to a free model (`isSwappable`, `swapPlan`) and `FreeTierEnded` — `test/ai-free-tier.test.js` |
| `services/ai/token-tally.js` | The token calculator, below |
| `services/ai/free-tier.js` | The switch, and the one question every caller asks: `check('text' \| 'translation')` → a model, or `reason: 'off' \| 'spent'`. `status()` and `save()` serve the admin page |
| `routes/admin/ai.js`, `controllers/admin/ai.js` | `GET /api/admin/ai/free-tier` (`ai.read`: the switch, the pools against today's count, the count model by model, what chat and translation would use right now) and `PUT` (`setting.write`: `{ enabled?, textModel?, translationModel? }`; a model outside `USABLE_MODELS` is a 400; audit action `ai.free-tier.update`). `GET /api/admin/chat/settings` also returns `engines` for the three purposes |

- **The switch is off until an admin turns it on** (admin → AI usage → *Use OpenAI free tier*; `AppSetting`
  `ai.free_tier.enabled`, with `ai.free_tier.text_model` and `ai.free_tier.translation_model`), so a database that has never
  seen it behaves as before. It exists so data sharing can be switched off at OpenAI one day without a deploy.
- **Only `gpt-4o-mini`, `gpt-4.1-mini` and `gpt-4.1-nano` are offered.** They are in the 2.5 M pool and take plain request
  parameters; the `gpt-5.x` and `o` models in the pools want reasoning parameters `openai.js` has not been run with. Defaults:
  `gpt-4o-mini` for chat, `gpt-4.1-mini` for translation (a saved model that is no longer offered reads as its default).
- **The engine chain** (`resolveEngines` in `services/ai/index.js`). A call is tried on, in order: (1) the free-tier model,
  while the switch is on and the pool has room — never for `purpose: 'advanced'`, so a paying reader's model does not depend
  on the day's count; (2) the provider and model that are set (the Settings page, else `.env`); (3) OpenAI
  `AI_FALLBACK_MODEL` (default `gpt-6-luna`, paid; blank turns it off). A repeat is dropped, and so is an OpenAI engine when
  there is no `OPENAI_API_KEY`. Each engine has a `source` — `free-tier`, `settings`, `env`, `fallback` — and
  `ai.describeChain(purpose)` returns the list as it would be tried right now; the admin pages show it (AI usage → *Right now*,
  Ask Sakha → *Answering with*).
- **Failing over.** `complete()` and `stream()` take the next engine when one errors — a retired model, a bad key, over quota,
  a 5xx. A stream does so only while no text has reached the reader and nobody has stopped it; after that the error is thrown,
  as before. **A call that hangs is not an error and is not failed over** — the providers set no timeout of their own, and a
  call the caller aborts (its timeout, the reader's stop) never moves on. Every attempt is written to `AiUsageLog`, failed ones
  with 0 tokens, and only a successful one is added to the tally. A free-tier call is logged with `costMicros` 0, so it is not
  spend and does not draw on `AI_MONTHLY_BUDGET_MICROS`.
- **The token calculator** (`services/ai/token-tally.js`) is a Redis hash `ai:tokens:<UTC day>`, fields
  `<provider>|<model>|in|out|calls`, kept three days — one number for the API and the worker. Chat and the batch passes add to it
  from `logUsage`, every lane of an admin translation run (any provider) from `jobs/processors/translation.js`. **It counts what
  this app sent.** Other projects on the OpenAI organisation draw on the pools unseen and the command-line translation script
  is not counted, which is why use stops at 90% of a pool (`capOf`); a flushed Redis starts the day from zero; a Redis that
  cannot answer reads as empty, so a counter outage never stops a reply. One call can still cross the cap by its own size; the
  margin covers it.
- **Translation runs** are covered in "Translation runs" below: parts on the paid default move to the free model for an
  attempt, every request re-checks, and a run that outlives the day's tokens is requeued onto the paid model.
- **Privacy.** With the switch on, what readers write to Sakha and any picture they send goes to OpenAI and is shared under
  that programme. With it off, chat can still reach OpenAI as the paid fallback when the set provider fails, unless
  `AI_FALLBACK_MODEL` is blank. **Turn the switch off before turning data sharing off at OpenAI** — the free models are then
  billed at their normal rates, and the switch would still prefer them to the paid default.
- **Not verified:** that OpenAI really bills these calls at nothing — there is no API to read the free allowance, so watch the
  Usage page at platform.openai.com after a day with the switch on. `gpt-4.1-mini` has not been tried on the Indic languages;
  compare a chapter with `gpt-6-luna` before leaving it on for a whole language.
- Tests: `test/ai-free-tier.test.js` (pure) and `test/translate-providers.test.js`; `scripts/chat-e2e.js` section 17 (the
  chain, failing over, the switch, the tally, the audit rows — both providers faked) and `scripts/translation-e2e.js` section 9b
  (the swap, the requeue, the tally). Under Node 20 run the unit files one at a time with `node --test <file>`.

### Cost rule: AI never runs on the request path

(The one exception is **AI chat**, below — a person is waiting for a reply and pays for it from their own wallet.)

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

## AI chat

Sakha, the streamed devotional friend readers know as **Ask Sakha** ("AI chat" is the internal name; the routes, the
`chat` API path and the permission keep it). Files, in the order a request meets them:

| File | Job |
|---|---|
| `routes/app/chat.js`, `controllers/app/chat.js` | `status`, `current` (the one conversation the app opens), `images` (upload a picture), conversations CRUD, `DELETE /conversations` (clear everything), the two streaming endpoints (`messages`, `regenerate`), `compact`, `continue` |
| `services/chat-images.js`, `utils/chat-image.js` | A picture sent to Sakha: whose an upload is until a message takes it (Redis), clearing the files away; and the pure part that checks, orients and re-encodes the bytes (`@napi-rs/canvas`) — `test/chat-image.test.js` |
| `routes/admin/chat.js`, `controllers/admin/chat.js` | Persona and limits, per-plan allowance, wallets, grants (permission `chat.manage`) |
| `services/ai/index.js` · `gemini.js` · `openai.js` · `sse.js` | `ai.stream()` / `ai.complete()` behind the provider interface; both providers stream and report usage |
| `services/ai/tokens.js` | Local tokenizer (`js-tiktoken`, o200k) — an estimate for Gemini, so a 10% safety factor |
| `services/ai-wallet.js` | The only writer of `AiWallet`, `AiWalletTransaction`, `AiDailyUsage` |
| `utils/ai-credits.js`, `utils/chat-context.js` | The arithmetic and the prompt/compaction rules — **pure**, tested in `test/` |
| `utils/chat-name.js` | The reader's first name and the `{name}` placeholder: `firstNameOf`, `fill`, `createFiller` (chunk-safe, for the stream) — **pure**, `test/chat-name.test.js` |
| `utils/chat-errors.js` | What the stream's `error` event says: a fixed line and a `code` per failure, never the provider's or the server's own text — **pure**, `test/chat-errors.test.js` |
| `services/chat-settings.js`, `config/chat.js` | Persona, description and limits (AppSetting) and their defaults |

Rules worth knowing before changing it:

- **The prompt is small by construction**: `persona + conversation.contextSummary + the newest
  `recentMessages` + the new message`. When the unsummarized history passes `recentMessages` messages or
  `compactAtTokens` tokens, the older part is folded into `contextSummary` by the *summary* model and
  `summarizedThroughSeq` moves up; those messages stay in the table (`summarized: true` in the API) and are
  never sent again. The summary keeps preferences, interests and sampradaya leaning, practices and vows,
  open questions, and is cut to `summaryMaxTokens`. A cut always leaves a USER message first.
- **A reply is fast because nothing slow stands in front of it, and the tidying happens after it.**
  - **Compaction is a background task, never part of a reply.** After a reply has been settled and `done` sent,
    `reply()` asks `context.planCompaction` (over the history *including* the answer just saved) whether the chat
    now needs folding, and if so starts `compactInBackground` without awaiting it. The summary model is a slow call
    (about a second) that used to delay every third reply; now the reader never waits for it. The stream therefore
    carries no `status` event on a reply any more. The prompt window is bounded (`recentMessages`), so a quick
    follow-up that arrives before the summary lands is still answered correctly — at worst it leaves out the two
    oldest messages for that one turn.
  - **One compaction at a time per conversation** (Redis NX lock `chat:compact:<conversationId>`, 90 s). The
    background run skips when the lock is held (the one running covers it); the explicit **Tidy**
    (`POST …/compact`) and **Start a new chat** (`POST …/continue`) wait up to 20 s for it, because the reader asked
    and is waiting. The run re-reads the conversation inside the lock, so it never summarises a stale window. Redis
    being down fails open, as for the reply lock.
  - **It runs in this process, not in BullMQ**, on purpose: it is one cheap call, a summary that is lost to a
    restart is simply made after the next reply, and `npm run test:chat` can see it. A background failure is logged
    and never reaches the reader (a conversation cleared while it was summarising is the one expected case, P2025,
    logged at debug); its tokens are still debited, the call having been made.
  - **The reply path is parallel.** Persona, limits, the wallet and the history load together, and settling the
    reply (answer row, conversation counters, wallet debit) runs together too; `aiWallet.statusFrom(opened, user)` builds the
    meter from the wallet the reply already opened instead of reading it a second time. `logger.debug`
    "chat reply timing" records `beforeStreamMs`, `firstTokenMs`, `streamMs` and `settleMs` for a reply.
  - **Two cold-start costs are paid at boot or cached.** `services/ai/tokens.js` `warmUp()` builds the tokenizer
    right after the server listens (it blocked the event loop for ~300 ms on the first reply of a process), and
    `services/ai/index.js` remembers the month's AI spend for 20 s (`monthSpend`) — the sum scans the month's usage
    rows whenever a monthly budget is set, and a limit that bites a few seconds late costs nothing a monthly budget
    would notice.
  - **Not done:** the provider call is not overlapped with the save of the new message (the two-step failure cases
    were not worth a few milliseconds), and Node's `fetch` keep-alive (4 s) means a reader pausing longer than that
    between messages pays a new TLS handshake to the provider; tuning that needs a dispatcher (`undici`) this
    project does not depend on and cannot be measured against the fake provider.
- **Sakha uses the reader's first name, and the name is never in a prompt** (`utils/chat-name.js`,
  `NAME_GUIDANCE` in `config/chat.js`). The account name stays on the server; the model is told only to write the
  literal token `{name}` where it would use the reader's first name, and the server fills the token in on the way
  out.
  - **The first name** is the first word of `User.name`, kept to letters, marks, joiners and `'’.-` (so nothing
    that markdown, a link or the token itself would act on survives), at most 30 code points, or none at all when
    there is no letter in it (`firstNameOf`). It is read from the already-loaded session user, not a query.
  - **Where the token is filled**: while streaming (`createFiller` holds back a trailing `{`, `{n`, … `{name` until
    it can tell whether a token is being written, so the app never sees half of one), in the saved message's
    `done` payload and whenever a stored assistant message is presented (history, `current`, regenerate).
    **The database holds the raw token**, which is what lets a reader who later changes their account name see the
    new name in old messages, and what keeps the name out of every row.
  - **Where it never goes**: the persona, the replayed history and the summariser's transcript all carry the token
    unfilled, and the summariser is told that `{name}` is "not a fact to record". `NAME_GUIDANCE` is appended
    only for a reader who has a usable first name (`buildSystem({ withName })`), and it tells the model not to
    use the token inside a quotation, verse, heading, link or code block and never to explain it. A reader with
    no usable name gets the token **removed**, with its comma, so the sentence still reads ("Hari Bol, {name}!" →
    "Hari Bol!"). On the stream that tidy-up of the comma cannot be taken back, so a nameless reader's streamed text
    may keep a stray comma that the saved message does not.
  - **A name the reader types into the chat is their own words**, not account data: it can end up in the summary
    like anything else they say, and if they ask to be called something else the model is told to do that.
  - **Not an agent with a tool.** The alternatives were a tool call that fetches the name (a round trip to the
    model before the first word) or sending the name and trusting the provider with it; the placeholder costs
    nothing on the request path and keeps the name off the wire entirely.
- **Everything costs from one wallet.** Chat replies and summaries both call `aiWallet.debit()` (source
  `CHAT` / `SUMMARIZATION`); any future AI feature uses `OTHER_AI_FEATURE`. The amount is the **provider's
  reported usage**. `ai.stream()` estimates it locally only when a stream is cut before the provider reports
  (`usage.estimated`). A reply that produced no text and no billed usage costs nothing.
- **Pre-check before the provider is called**: `spendable = min(wallet balance, today's cap left,
  conversation share left)` must cover the prompt plus a minimum reply, and the reply is capped to what is
  left (`max_tokens`), so overshoot is bounded by estimation error. One reply at a time per user (Redis lock).
- **Daily cap = a date, not a job.** Spend is recorded under the user's *local* date (`User.timezone`, default
  Asia/Kolkata), so the cap resets at each person's midnight by itself. The hourly `ai.credits.maintain` job
  renews wallets whose month ended (so one nobody opens still refills) and prunes old daily rows.
- **The meter is `min(wallet %, daily %)`** (`creditMeter`). `limitedBy` says which; the 402
  `CREDITS_EXHAUSTED` carries `limitedBy`, `resetsAt`, `canUpgrade`, `startNewChat`.
- **Wallet follows the plan**: created lazily on first use at the plan's `walletTokens`; raising the
  allowance credits the difference; lowering it never claws back; a monthly renewal tops up to the allocation
  and never beyond (an admin grant above it is neither topped up nor taken away).
- **Stopping**: closing the connection aborts the provider request; what arrived is kept as `STOPPED`, and
  the tokens actually used are charged. A provider error after some text is `PARTIAL`. Nothing arrived → the
  empty assistant row is removed and `error.retryable` tells the app to offer retry.
- **Hard limits**: `limits.maxMessages` and the plan's `conversationTokens` → 409 `CONVERSATION_LIMIT`;
  `POST …/continue` folds everything into the summary and starts a new chat with it.
- **Token numbers never reach `/api/app/*`.** Only `/api/admin/chat/*` shows them.
- **A reader has one conversation.** The app opens `GET /chat/current` (the conversation with the latest activity, in the shape of `/conversations/:id`, or `null` before the first message — which creates one). The per-conversation routes and the list stay, for older app builds and for `continue`, which still starts a second chat carrying the summary when the first is full. **`DELETE /chat/conversations` clears the reader's chat**: every conversation, message, the `contextSummary` Sakha keeps, and the stored pictures; 204, or 409 while a reply is being written; credits spent are not returned. Account deletion (`deleteAccount` in `controllers/app/auth.js`) and the admin user delete (`controllers/admin/user.js`) remove the picture files too.
- **Pictures** (`POST /chat/images`, then `imageKey` on `messages`). The request body is the **raw image bytes** (`Content-Type` image/jpeg, png or webp — a GIF, SVG or anything else is 422 `IMAGE_NOT_USABLE`), not multipart. `utils/chat-image.js` checks the header before decoding (`sniff`: format and size, so a "40 000 × 40 000" header is refused before it costs memory), applies the EXIF orientation, draws white behind transparency, scales to `imageMaxEdge` and **re-encodes as a JPEG** — metadata (location, time, device) is dropped by construction. The result is stored under `chat/images/` as an ordinary upload (a `temp/` key that moves to its permanent key when a message row saves it), and the key is **claimed in Redis for 24 hours** (`chat:image:<key>` → the reader's id, `services/chat-images.js`). A message may carry **one** `imageKey` or none; the key must be one this server issued for chat pictures, claimed by this reader, and unused — otherwise 422 `IMAGE_NOT_USABLE`, and another reader's key is refused **without being consumed**. A refused send (a 402 or 409 before the provider) does not consume the claim either; it is released after the message transaction. 403 `IMAGE_NOT_AVAILABLE` when `imageInput` is off, 413 `IMAGE_TOO_LARGE` (`IMAGE_UPLOAD_MAX_BYTES`, 8 MB). A message may be a picture alone; an image-only first message leaves the title "New chat".
  - **Read before the row is saved.** Saving the message moves a fresh upload from `temp/` to its permanent key, so `reply()` reads the bytes **first** (`withPictures`) and builds the system prompt from what is really sent.
  - **Only the newest picture goes to the model as pixels** (`buildMessages` in `utils/chat-context.js`): it is the one a follow-up is about, and an old one would cost its tokens again every turn. Earlier pictures become the text `[the person shared a picture here]` (`IMAGE_PLACEHOLDER`), as they do in the summariser's transcript. Regenerate and follow-ups reuse the newest picture. A picture whose file has gone from storage degrades to the placeholder instead of failing the chat.
  - **`IMAGE_GUIDANCE` is appended to the persona only when a picture is really sent** (`buildSystem({ withImage })`), so an admin-edited persona never has to mention pictures, and a chat with pictures switched off, or a missing file, never has the persona describing a picture the model was not given. (The e2e caught this once: the note was added whenever a message *had* a picture.)
  - **Cost**: a message with a picture carries `tokenCount = estimate(text) + IMAGE_TOKEN_ESTIMATE` (1200) for the pre-check and compaction; the wallet is debited the **provider's reported usage**, as for every reply. Gemini gets `inlineData` parts, OpenAI `image_url` data URLs (`services/ai/gemini.js`, `openai.js`; `services/ai/tokens.js` counts `imageKey` as `IMAGE_TOKEN_ESTIMATE`).
  - **Admin limits** (`chat.limits`, the Ask Sakha page): `imageInput` (0 switches pictures off for everyone; text still works) and `imageMaxEdge` (256–4096, default 1280).
  - A picture is **sent to the model provider**; the app says so on the attach sheet. It is stored until the chat is cleared, the conversation deleted or the account deleted.
  - Migration `20261023000000_chat_message_image` adds `ChatMessage.imagePath` (nullable key). Apply it on every other environment.
- **`services/s3.js` and tests**: with `NODE_ENV=test` and blank AWS keys, storage falls back to `backend/storage/` like development does, so `npm run test:chat` never touches the real bucket (it blanks the keys itself and removes every file it made).
- `npm run test:chat` walks all of it over real HTTP (provider faked): the conversation, streaming, wallets and caps, compaction, the error codes, **section 15 for pictures** (upload, claim and ownership, what the provider is sent, one debit, deletion on clear / account delete / admin delete, switched off, a missing file), **section 6b for the background compaction** (the reply is not held up, the summary lands after `done`, one at a time per conversation, Tidy waits for the one under way) and **section 16 for the name** (the provider is never sent it, the stream and the saved message carry it, a reader with no name loses the token) — 183 assertions. It snapshots and restores the three chat `AppSetting` rows and removes its users and files. `npm test` holds the pure rules (`chat-context`, `chat-name`, `chat-image`, `ai-stream`, `chat-errors`, `ai-credits`).
- **A failure never leaks its reason.** Once the stream has started, the `error` event is built by `forReader`
  (`utils/chat-errors.js`): the chat's own errors (`CREDITS_EXHAUSTED`, `CHAT_NOT_AVAILABLE`, `CONVERSATION_LIMIT`,
  `MESSAGE_TOO_LONG`, `NOTHING_TO_REGENERATE`) pass through as written, with their `details`; a provider failure
  becomes a fixed line under `AI_BUSY`, `AI_UNAVAILABLE` (also a missing key, a wrong provider and a spent monthly
  budget — the last one not retryable) or `AI_FAILED` (also bad output); anything else is `SERVER_ERROR`. The
  provider's response body, a database message or a stack trace stays in the log. The line is English and only a last
  resort for a client that does not know the code: **the app words every `code` itself from its ARB files**, in the
  reader's language, and shows nothing the server wrote (`ChatProblemNotice`). A refusal before streaming (402, 409,
  400) is an ordinary JSON error carrying the chat's own code.
- **Sakha is a friend, not a disguise** (`config/chat.js`). The persona calls itself Sakha, is warm and direct, never
  introduces itself as an "assistant", "chatbot" or "AI model", never claims a body, family or past, and answers
  truthfully and briefly if someone sincerely asks whether it is a person. The description the app shows says in one
  line that Sakha is a digital companion and can make mistakes. A prompt or description saved on the admin Ask Sakha
  page **replaces** these defaults (clear the field and save to restore them).
- **Sakha is for everyone, and shares Vaishnava bhakti by invitation** (`config/chat.js`). Its heart is Vaishnava
  bhakti, but it **names no sampradaya** — not in the description readers see, and not in its answers ("as a Sri
  Vaishnava…" is out); it never asks which tradition or religion someone belongs to and never says aloud what it has
  guessed. It is never made to lie about it: asked sincerely what outlook it speaks from, it says Vaishnava bhakti.
  With a Vaishnava of any line it speaks in that line's own terms; with everyone else it answers the question first,
  starts from common ground and offers **at most one small next step** (a verse, a story, a few minutes of the holy
  name), never in every reply. A decline is accepted at once. Pressure, fear, guilt, rewards, "your faith is lesser"
  and conversion language are ruled out in the prompt, and so is bending a scripture or a fact to flatter
  Vaishnavism; a person in distress is comforted and sold nothing. Wording is checked by `npm run test:chat`; whether
  the model *follows* it has to be read in real conversations — the prompt is only an instruction.
  **The summary memory still records "the tradition or sampradaya they lean towards"** (`summarizerRequest`) — that is
  private to the prompt and lets Sakha speak in a person's own terms; the persona forbids saying it back.

### Opening things in the app (chat actions)

Sakha can offer to open a page, a mantra or a verse when the reader plainly asks ("open the Gita 2.47", "take me to reels").
The model never calls a tool: it ends its reply with one marker (`[[open:page:reels]]`, `[[open:mantra:maha mantra]]`,
`[[open:verse:bhagavad-gita:2.47]]`) that `ACTION_GUIDANCE` (config/chat.js, added to the prompt only while `appActions` is
on) teaches it.

- `utils/chat-actions.js` (pure, `test/chat-actions.test.js`): `parse` knows the eight pages in `PAGES`, a mantra name and a
  book + reference; `createFilter` takes markers out of the stream chunk-safely, like the `{name}` filler. A marker is removed
  whether or not it is understood; only the first of a reply counts.
- `services/chat-actions.js` checks it against the database — a published mantra (slug or name, in the reading chain), a verse
  that exists in a published book (a compound verse is found by either number) — and an offer that resolves to nothing is **not
  sent**. The result is the `action` SSE event, sent just before `done` and only for a reply that completed. The stored reply
  has no marker; **the offer is not stored**, so it is gone when the chat is reopened.
- **It is an offer only.** The app asks "Open X?" and opens nothing until the reader taps Open — a model can guess wrong.
- Admin limit `appActions` (1/0, Ask Sakha → Persona & limits) switches it off; the guidance (~220 tokens a reply) then leaves the
  prompt. Asking Sakha about a verse needs nothing here: the app sends the verse as an ordinary message.

### The free-tier bonus (a larger daily credit while the free tier is on)

While the OpenAI free-tier switch is on and the day's free pool has room, every reader on a plan that uses the ordinary model
gets extra tokens a day. `ai.free_tier.bonus_pool` (default 1,500,000, at most the large free pool) is divided by the readers who
used the chat in the last 7 days (counted from `AiDailyUsage`, cached 10 minutes), up to `ai.free_tier.bonus_max_per_user`
(default 20,000): `utils/ai-bonus.js perUser`, `services/ai/free-tier.js bonus()`.

- **Spent first, outside the wallet and the daily cap.** `AiDailyUsage.bonusTokens` (migration `20261025000000_ai_daily_bonus`)
  counts it; `tokens` stays what the wallet paid, which is what the plan's cap counts. `ai-wallet.debit({ bonus })` splits a
  debit (`ai-bonus.split`) and writes a ledger row only for the wallet's part. `open()` returns `bonus` and `bonusUsed`;
  `room`, `creditMeter` and `whyBlocked` take them, so the meter and the 402 account for it. The bonus is per local day, like
  the cap, and unspent bonus is simply gone.
- **None for a plan on the stronger model** (it never uses the free models, so a bonus would cost money). A call that fails over
  from the free model to a paid one is still charged against the bonus — bounded by the per-reader ceiling.
- Admin: AI usage → *Use OpenAI free tier* → *Daily bonus* (`bonusPoolTokens`, `bonusMaxPerUser` on `PUT /ai/free-tier`;
  `GET` returns `bonus.{tokens,users,active}`). Sections 18–19 of `npm run test:chat` walk both features.

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

### The four devotee plans

The paid plans are the four kinds of devotee in Bhagavad-gita 7.16, above the `free` baseline. What they add is **Ask Sakha**
(plus the ad-free and supporter-badge flags); the rest of the app stays free. They are data, so every number below is
editable on the admin Plans and Ask Sakha pages once it exists — the seed (`prisma/seed/data.js`) and the migration
`20261024000000_devotee_plans` hold the starting values and are **create-only**; change both together.

| Plan | Tier | Month | Ask Sakha wallet | ≈ replies a month | Daily cap | Per chat |
|---|---|---|---|---|---|---|
| Free (*Sadhaka*) | 0 | — | 60,000 | 15 | 6,000 | 20,000 |
| Ārta | 1 | ₹49 | 400,000 | 100 | 24,000 | 40,000 |
| Jijñāsu | 2 | ₹99 | 1,000,000 | 250 | 60,000 | 80,000 |
| Arthārthī | 3 | ₹199 | 2,000,000 | 500 | 120,000 | 100,000 |
| Jñānī | 4 | ₹399 | 4,000,000 | 1,000 | 240,000 | 120,000 |

- **Replies are the unit a reader sees.** `GET /subscription/plans` adds `sakha: { repliesPerMonth }` to each plan
  (`presentSakha`: `repliesIn(walletTokens, TYPICAL_REPLY_TOKENS)`, 4,000 tokens a reply, rounded down to a multiple of 5 once
  ≥ 10; `null` for a plan with no chat or a wallet that does not refill monthly). It is an estimate — a long answer or a
  picture costs more — and **the plans response never carries a token figure** (`npm run test:subscriptions` checks the JSON for
  the word). Paid plans are `MONTHLY` + `ADVANCED`; the wallet is 4,000 × the replies, so changing one means changing the other.
- **Donors earn Jijñāsu** (`grantedToDonors`), the ₹99 plan. **Premium is retired, not deleted**: inactive, no longer granted to
  donors, tier 2 — entitlement ignores `isActive` and its `AiPlanConfig` ("Bhakta", 800k) stays, so anyone who bought it keeps
  access and their wallet until their period ends, and a donor wins the tie with an old Premium subscriber.
- **Store products.** Each price is `<slug>_monthly` on both stores (`arta_monthly`, `jijnasu_monthly`, `artharthi_monthly`,
  `jnani_monthly`). They must be created in the Play Console and App Store Connect at the matching price; until a store lists one
  the app's Subscribe button is disabled, nothing breaks.
- **Cost check.** The margins assume the current cheap default model, roughly ₹0.05–0.07 a reply; an expensive `ADVANCED` model
  changes that and the allowances should be revisited.
- **Names and descriptions are English-only** from the API (Devanagari term first), like every plan.

**Payments are one ledger.** Subscriptions and donations both land in `Payment`,
separated by `purpose`. They arrive the same way and reconcile the same way, so
splitting them would mean maintaining two of everything.

`(provider, externalId)` is unique on both `Payment` and `Subscription` because
every provider retries webhooks — without that constraint a retry credits the
user twice. Store money as integer minor units (paise, cents); floats drift.

## Server wording in the user's language

What the server says in its own voice — error messages and the daily sloka's title — is in the person's language;
content (verses, meanings, names) was already, via `utils/language.js`.

- **Errors follow the *app* language.** `middleware/error.js` (and the rate limiter) call `translateError` with
  `language.requestChain(req)`: the signed-in user's `appLanguage`, else `Accept-Language` (the app sends its phone
  locale before sign-in), else English. Controllers keep throwing English (`notFound('Verse')`); `utils/messages.js`
  recognises the text (`EXACT`, `PATTERNS`, or `BY_CODE` for a failing dependency) and swaps in
  `locales/<lang>.json`. **A message with no rule, or a language with no file, goes out in English** — developer-facing
  messages ("not configured", "run the seed") are deliberately not translated, and neither are the admin API's.
  A "… not found" says only that it was not found, not what (gender and grammar differ per language).
- **The daily sloka follows the *reading* language** — the push title, the fallback body, the book name in "Bhagavad Gita
  2.47" (`Book.titleI18n`), and the "Because you mentioned …" reason with the issue's `nameI18n`. `UserDailySloka.reason`
  is written in English when the pick is made and is only a fallback; `reasonFor` words it at read time. Issue `name` in
  the sloka and home responses is already in the reading language.
- **The sloka picture is not translated.** It is drawn once per verse for everyone (English "Sloka of Day" title and book
  name); a per-language card would need a font per script and one image per language.
- **Adding a message**: an id in *every* `locales/*.json` (`test/messages.test.js` fails on a missing id or a changed
  `{0}`), then a rule in `utils/messages.js`. **Adding a language**: one new file with all the ids.
- The translations are AI-drafted and **not yet read by a native speaker**.
- `language.localised` now stops at English (the plain column), like `pickName`: English reader + Hindi app no longer gets Hindi
  from an `…I18n` column.

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
  keeps a repeat run from sending twice. The setting is cached for 60 s. The rows it loads run up to **UTC's
  tomorrow**, not today: a reader east of UTC is on the next date for the first hours of their day (Kolkata
  until 05:30), so bounding at UTC's today hid their 04:30 sloka until the window had passed and it was never
  sent. `npm run test:sloka-deliver` runs the real `deliver()` with a faked clock for Kolkata, Kiritimati
  and New York (blanks the AWS keys so the card is not stored in the real bucket).
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

## Setting a day's sloka (admin)

`PUT /api/admin/slokas/:date` sets one date's verse and, optionally, a background picture; `GET /api/admin/slokas/picker` is
the list the admin page chooses the verse from. Both need `sloka.manage` and nothing else, so the page works for any role that
can manage slokas, whether or not it can also read books and verses.

- **The picker is the pool, laid out as a tree.** `picker` in `controllers/admin/sloka.js` returns `books → cantos / chapters →
  verses` for every verse `set` would accept — `isSlokaEligible`, in a book of `SLOKA_ELIGIBLE_BOOK_NUMBERS` — in reading
  order. A book with no cantos (the Gita) has an empty `cantos`; each chapter carries its `cantoNumber`. Titles are English,
  `titleI18n.en ?? title`, because the Gita's plain chapter `title` is Devanagari (`englishTitle`). It is **one unpaged
  request**, the Sanskrit included for the preview under the select — the Sanskrit alone is about 88 KB for the 322 verses of a
  seeded dev database. Fine for a pool picked by hand; page it if the pool ever grows by orders of magnitude.
- **`set` still checks the verse itself.** A verse of another book, or one not flagged eligible, is a 400 and nothing is
  written — the picker cannot offer one, but the endpoint does not rely on that.
- **`imagePath` is an upload key**, from `POST /api/admin/uploads` with `kind: 'slokaImage'` (JPEG, PNG or WebP; folder
  `PREFIXES.slokaImage`, `slokas/images`). Left out, the day keeps its picture; a new key replaces it; `null` removes it.
  `assertImage` refuses (400) a key this server did not issue for that folder, or whose file never reached storage; a key the
  row already holds passes untouched, so a form can send back what it was given. The verse is checked before the image and
  nothing is saved unless both pass, so a refused save leaves the upload waiting in `temp/`. Saving moves it out of `temp/`
  like every other upload (see "Storage layout").
- **The push card shares the folder but can never be an `imagePath`**: `slokas/images/cards/<design>/<verseId>.jpg` is not a
  generated key (those are `<prefix>/<32 hex>.<ext>`), so a day cannot be pointed at a card.
- **Replacing or removing a picture does not delete the old file** — same as every other upload.
- **Where it goes:** the calendar (`GET /api/admin/slokas`), the home feed and `GET /api/app/sloka/today` send it as `imageUrl`
  (a presigned link, or `null`). **Nothing user-facing draws it yet** — the app parses it (`models/sloka.dart`) and nothing
  reads it, and the push picture is the one shared card per verse above — so for now the picture is stored and sent, no more.
- `npm run test:admin-sloka` walks it over real HTTP against a running API: who may use it, the picker's content against the
  database, accepted and refused verses, upload → save → permanent key → link, replace, keep, remove, and every kind of refused
  key. It uploads and deletes real files, so the API **and** the script must run with `AWS_ACCESS_KEY_ID=` and
  `AWS_SECRET_ACCESS_KEY=` blank (the script refuses to run otherwise). It uses dates in 2099 and removes what it made; the
  moderator check runs only if a moderator account exists.

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

- **A mantra's title *and* its text follow the *reading* language.** `present.mantra` picks `name` with
  `language.pickName` (reading → app → en, then `Mantra.name`; it stops at English, so someone reading English
  is not handed their app language's name) and `text` with `language.mantraTextChain` (reading → the account's
  mantra language → app → en → sa — the row's own script, Kannada letters for a Kannada reader). An English
  reader therefore gets the Roman text, not Devanagari. The account's `mantraLanguage` is still stored but is only
  the next choice after reading, and the app never changes it. `language.mantraChain` (mantra language first)
  is kept for reel narration only. `test/mantra-text-chain.test.js`. Wherever a mantra is named in passing — a
  reel, a chant session, the profile's preferred mantra — use `includes.mantraStub` / `present.mantraStub`,
  never a bare `include: { mantra: true }`. `test/pick-name.test.js`.
- **Search finds the title a reader is shown.** The mantra list's `q` and `/search` match the English `name`
  or a published translated `name` in the reader's reading chain (`language.mantraNameClauses`, the search
  side of `pickName`) — not the name in a language they do not read. Keep the two together.
- **`Mantra.category` is a free-text slug** and the API sends no display name. The app words the four the seed
  uses (`beej`, `gayatri`, `mahamantra`, `name`) from its ARB files (`mantraCategoryLabel`) and shows any other
  title-cased, untranslated — to name a new one, add a `mantraCategory*` key to all twelve ARBs and a line to
  `mantraCategoryLabel` (an app release).

## Search (verses, mantras, books)

`GET /api/app/search` forgives what a person types. Files: `controllers/app/search.js` (the queries),
`utils/search-query.js` (**pure**, `test/search-query.test.js`), `services/search-vocabulary.js` (the words the library holds).

- **A book named at the start of the query narrows it.** "gita karma", "bhagvat gita surrender", "sb 1.3.28": the leading one to
  three words are matched, by sound and a letter or two out, to a book's slug words, initials, title and the extra names in
  `EXTRA_ALIASES` (matched on the slug, so a renamed title cannot break it) and taken off the query. A bare book name ("gita") is
  **not** a tag — it is a search for the book. The first number ends the name, so "gita 2.47" is the verse. The optional
  `book` slug param (the app's chips) does the same and wins. `scope` in the response says which book and whether the query
  named it (`fromQuery`, with the `text` left over).
- **Words are matched by sound.** Each Roman word becomes a *sound key* (`soundKey`: ṛ→ri, ś/ṣ→s, aspirates and long vowels
  flattened, w→v, doubled letters single), so "krishna", "krsna" and "kṛṣṇa" are one word and "bhagwad" is "bhagavad". A key a
  letter or two away (`tolerance`: ≥3 letters 1, ≥6 letters 2) is the same word typed wrong. The stored spellings behind those
  keys, diacritics and all, are what is matched against the text. The last word also matches longer words (it is still being
  typed). Spacing: two words the library holds only joined are joined, a long unknown word is split in two when both halves
  are words. `meta.corrected` / `corrected` is the query as read once typos are fixed, only when a word had **no** word that
  sounds like it — a different Roman spelling of a known word is not a correction. Words in Devanagari or any other script are
  matched as typed, no fuzziness.
- **The vocabulary** is built from verse transliteration, English translations, book titles and mantra names with one query on the
  first search after a boot and again hourly (`TTL_MS`); a failed build keeps the old one. It does **not** include purports.
- **Verses match in four texts** — Sanskrit, transliteration, the translation and the purport (translations in the reader's
  chain only) — with one regular expression per word, every word required. They are ranked in SQL: a word in the verse itself
  3, in the meaning 2, in the purport 1, +6 when the words appear together as typed, then book order. `searchMatch`
  (`{ field, snippet }`, matched words in `[brackets]`) says where the first hit was. Pages and a `total` come from
  `count(*) OVER()`.
- **Without `type`** the response is a preview (6 of each) with `verseTotal` / `mantraTotal` / `bookTotal`; with `type` it is one
  kind, paginated, best first. A search narrowed to a book returns no mantras or books.
- **Cost.** Every query scans verses (and purports) with `~*`, fine at ~18,700 verses; the next step is a `pg_trgm` GIN index
  on the text columns, which would need a migration. No index exists for it today.
- **Checked** by `npm test` (the pure parts) and by running the controller against a throwaway Postgres with a handful of
  verses. There is no e2e script, and it has **not** been run against the full library, so ranking on real data is unseen.

## Translated titles of books, cantos and chapters

`Book`, `Canto` and `Chapter` carry `titleI18n` (JSON `{ code: text }`); `Canto` and `Chapter` also `summaryI18n`, `Book`
`descriptionI18n`. The plain `title` / `summary` / `description` are the English.

- **What a phone is sent.** `present.book` and `present.section` keep sending `title` picked in the account's language (older
  app builds read that) and add `titleI18n`, `summaryI18n` and `descriptionI18n` (`i18nMap` in `utils/present.js`): blank and
  non-text entries are dropped, **`en` is added from the plain column when the map has none**, and a title with nothing at all
  is `null`. The app picks on the phone along its reading chain, so a change of reading language needs no second request.
- **The Gita's chapters are the trap.** Their plain `title` is the Sanskrit name in Devanagari; Prabhupāda's English heading
  is `titleI18n.en`, which `i18nMap` keeps. The Bhagavatam's plain titles are English and carry no map until the seed or an
  admin writes one. Anything that wants "the English heading" of a chapter reads `titleI18n.en ?? title`, never `title` alone
  (the admin Titles dialog does).
- **Seeds**: `prisma/seed/section-titles/<code>.js`, one per reading language except English, in the shape described in
  `section-titles/index.js` — the two books, the Bhagavatam's 12 cantos and the Gita's 18 chapters. `seedSectionTitles()`
  (`prisma/seed/index.js`, after `seedBooks`) goes through `fillMissing`: **a language is added only where the row has none**,
  so an admin's edit is never put back, and a corrected seed file does not reach a row that is already filled — fix that row
  on the admin Books page → **Titles**. Chapters exist only once the importers have run, so a new database takes
  seed → importers → seed. **The Bhagavatam's 335 chapters have no seeded titles** (there is no authoritative list to follow),
  so they read in English until an admin fills them. The Gita's titles are its traditional names in the reader's own script;
  the cantos' are translations of Prabhupāda's headings. They are AI-drafted and **not yet read by a native speaker**.
  `test/section-titles.test.js` fails on a missing language, a list of the wrong length, or text in the wrong script.
- **Admin**: `GET /api/admin/books/languages` (`book.read`) lists the languages a title can be written in — active reading
  languages but English, in display order — so the Titles dialog does not need the reference-data permission. Titles are saved
  with the existing `PATCH /books/:id`, `/cantos/:id` and `/chapters/:id` `{ titleI18n }`, which **replaces the whole map**: a
  client must send back `en` and every other language it did not change.
- **A changed title changes its unit's hash**, so the next book export rewrites that unit and phones fetch it again (the
  Gita's chapter files, the Bhagavatam's canto files). Run the export on the server after a bulk edit; not locally (see
  "Book cache").
- `npm run test:book-titles` walks the languages endpoint, saving on all three levels, whole-map replacement and the shape a
  phone is sent, against a running API with a throwaway book (deleted again). It uploads nothing, so the dev `.env` is fine.

## Reels for a signed-out visitor (the website)

`GET /reels`, `GET /reels/:id` and `GET /reel-comments` are `public: true`. Signed out, `req.auth.user` is null: the feed
skips the "seen" penalty (the feed shows a reader's own reels like anyone's, signed in or not), and `present.includes.reel` / `reelComment` swap the missing viewer id
for a value that matches no one (`NO_ONE` in `utils/present.js` — a Prisma filter on `undefined` is no filter, which would
show everyone's likes as the visitor's). Everything that writes, `/similar` and `/saved` still need an account.
`npm run test:reels` checks the signed-out feed, one reel, and that liking is still refused.

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
- **A book's text has a version, and the database keeps it.** `Book.contentVersion` is bumped by triggers (migration
  `20261025000000_book_content_version`), not by code in the writers — imports, the admin panel, the translation import and
  psql all write these tables, and a writer that forgot to call something would leave phones on old text. A new table
  the export reads must get the same trigger. A bump with nothing really changed is harmless (the hashes match and nothing is
  uploaded); a missed bump is the harmful direction.
- **`book.cache.sync` (every minute) exports what is due** — `contentVersion > exportedVersion` and `contentChangedAt`
  older than `BOOK_CACHE_QUIET_SECONDS` (`staleBooks`, `exportStaleBooks` in `services/book-cache.js`). `runExport` stamps
  `exportedVersion` only after every unit and the manifest succeeded, to the version it read **before** building; a failed
  unit leaves the book due, and a failing export is left alone for 5 minutes. Do not stamp it anywhere else.
- **The manifest sends `exportedVersion` as `contentVersion`**, never the live `contentVersion`: the files can be behind
  the database, and a phone told the newer number would record a version the files do not hold. The admin status shows
  both and `exportDue`.
- After this migration `exportedVersion` is 0 for every book, so the first minute exports all of them (unchanged units are
  skipped by hash). **Deploying needs `prisma migrate deploy` and a restart of the API and the worker** (so the new
  repeatable job is registered).

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

## Reading language on a book call

`GET /books/:slug/chapters/:number` and `GET /books/:slug/verses` take an optional `?languages=mr,en` (`schemas.languages`:
up to three codes of two or three letters, reading language first). When present it **replaces the account's reading and
app languages for that call** — `language.fromQuery` reads it, `language.withReadingLanguages(user, codes)` returns the user
(or, for a signed-out caller, a bare object) with `readingLanguage = codes[0]` and `appLanguage = codes[1]`, and the controller
uses that for the chain, `present.verses` and `present.section`. Favourites, highlights and notes still belong to the real
account (`req.auth.user?.id`). Without it nothing changes, so older app builds keep working.

**Why it exists.** The app changes its reading language on the phone at once and tells the account in a separate, later
request (`PATCH /me/languages`), so a book call made in between was shaped by the language the reader had just left. Text a
phone already holds from the export is picked on the phone and was never affected; this endpoint serves what it does not hold
(a book not yet downloaded — on a laptop, the Gita, whose export has not been built there). The other book endpoints
(`/chapters/bulk`, the lists) are not changed — the offline copy picks on the phone. `test/reading-languages.test.js`.

**`GET /home` takes the same `?languages=`** (`routes/app/home.js`, `controllers/app/home.js`), for the same reason: the
verse of the day, the books, the mantras and the personal cards (`mySloka`, `continueReading`) are all shaped by
`withReadingLanguages(user, fromQuery(...))` — the mantras by its `mantraTextChain`, the rest by `readingChain` — so the
dashboard follows the reading language the moment the phone changes it, not after `PATCH /me/languages` lands. Without it
the account's own languages are used, so older builds are unaffected. A verse with no translation in the chain still falls
back down it (to English), so a language with no published text shows English, not nothing.

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

### Routine reminders: the verse behind each one

The app schedules a **local** notification for each standard routine; the title is the task's name and the body is a verse.
`RoutineKind` (one row per standard routine, keyed by the app's `RoutinePreset` name: `wakeUp`, `morningChant`, `exercise`,
`breakfast`, `lunch`, `breakChant`, `eveningChant`, `dinner`, `scriptureReading`, `sleep`) and `RoutineNudge` (its verses) hold
the content, seeded from `prisma/seed/routine-nudges.js` (`npm run seed`; add a verse by appending to its kind). Not per user.

- `GET /api/app/routine/nudges` returns every active kind in the order of the day with its verses. A nudge's `text` is the
  verse's translation in the reader's reading language when `verseId` (a `Verse.verseId` such as `1.2.69`) is imported and
  published, else the seeded English (Śrīla Prabhupāda's translation). The link is soft because the book importers run apart
  from the seed. The purport is not sent: a notification carries the verse, and tapping it can open the verse.
- The app takes one verse per kind per day (day-of-year modulo the count), so it works offline once fetched.
- **Voice, later.** `RoutineKind.voiceScript` holds the line to speak with `{name}` ("Hari Bol {name}, ..."); `voiceUrl` in the
  response is always null today. When voice messages exist they will be per user and language, generated from the script, and
  the app will play them with the same alert. Nothing generates or plays one yet.
- **Rounds entered by hand already have an endpoint**: `POST /api/app/sadhana/chant/manual` (`rounds`, optional `date`) adds to
  the day's total, the same table as in-app sittings. The break-chanting reminder is meant to open an entry sheet that calls it.

**Rules the app's scheduling must follow** (decided with the owner; the app side is not built yet):
- Reminders at least **3 hours apart**; when routine times are closer than that, the one with the verse that matters most
  (wake up, chanting, sleep) wins and the rest are dropped, never moved.
- **No reminder in the sleeping hours**, taken from the user's own routine (sleep start to wake up, on the phone's local
  timezone) and kept to **6-8 hours**: a longer gap is cut to 8, a shorter one stretched to 6 around the sleep time.
- **Notification Management** in Settings: each kind can be switched off, and **the voice (AI) message has its own switch**,
  so someone can keep the alert and silence only the voice.

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

**Providers and books (added later).** A run row also carries `provider` (`anthropic` | `openai` | `gemini`) and `book` (`bhagavat-gita` | `srimad-bhagavatam`); the columns default to Claude and the Gita because every run made before they existed was both, but a new run always carries the provider it was started with (the server's default when none is chosen). Providers live in `scripts/lib/translate-providers.js`. **The default is `openai` / `gpt-6-luna`** ($0.10 in / $0.01 cached / $0.50 out per 1M tokens, strict JSON schema output; about $0.9 for the whole Gita in one language): in a ten-verse trial in Tamil, Hindi and Marathi it beat Gemini 3.5 Flash-Lite on all four parts. Claude (`claude-sonnet-5-5`) is one choice away, for the verses or parts Luna scores 1: pick it per part on the admin page, or pass `--provider anthropic` on the command line. Keys: `OPENAI_API_KEY` (the default), `ANTHROPIC_API_KEY`; model overrides `ANTHROPIC_MODEL`, `TRANSLATION_OPENAI_MODEL` (not `OPENAI_MODEL`, which the AI features use); `TRANSLATION_PROVIDER` changes which provider is the default. Books are in `scripts/lib/claude-translate-source.js` (`BOOKS`): the Gita is `json/bhagavat-gita/<lang>/ch-N.json`; the Bhagavatam is English-only at the source and `json/srimad-bhagavatam/<lang>/c<canto>-ch-<n>.json`. A chapter id is the chapter number for the Gita and **canto × 100 + chapter** for the Bhagavatam (147 = SB 1.47). The worker runs one run per book at once (global concurrency 2); a second run of the same book waits, because they share a checkpoint. Start/import locks, coverage cache and the "one live run" rule are per book and language. "Up to date" is decided by version only, whatever the provider. Migration `20261019000000_translation_run_provider`. `npm run test:translation` and `node --test test/translate-*.test.js` cover it. Live `gpt-6-luna` calls have been made: Tamil chapters 1–4 were translated and then corrected with it, and a Malayalam run went through the worker.

**Plans, lanes and Gemini (added later).** A run has a **plan**: for each part (`translation`, `transliteration`, `wordMeanings`, `purport`) a `{provider, model, effort}` — providers are `anthropic`, `openai` (the default), `gemini` (`GEMINI_API_KEY`, `TRANSLATION_GEMINI_MODEL`, REST client `scripts/lib/gemini-translate-client.js`, default `gemini-3.5-flash-lite`; tried live on ten verses, where Luna scored higher on every part, which is why it is not the default). Parts with the same provider|model|effort form a **lane**: one request per verse carrying only that lane's instructions, source text and answer schema. Lanes run in parallel (`Promise.allSettled` in `claude-translate-run.js`) and never wait for each other; each saves only its own parts into the chapter file (writes to one file are queued, conditional, verified). Each part is stamped under `aiTranslation.parts[part]` (provider, model, effort, version, sourceHash, score…); the verse-level `aiTranslation` is a summary (score = lowest part). If a lane fails the others finish their current verse and stop; resume asks only for the missing parts. `TranslationRun.plan` / `lanes` (migration `20261020000000_translation_run_plan`) hold the plan and per-lane progress; `GET /estimate?plan=<json>` and `POST /runs {plan}` take it (without one, every part uses `provider`/`model`). Progress counts verse×lane steps.

The admin **Translations** page translates Prabhupāda's Gita with an AI model (GPT-6 Luna by default; Claude or Gemini can take any part) as a background job and shows it live,
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
- **OpenAI's free daily tokens come first, when the switch is on** (rules and numbers in "OpenAI's free tokens, the engine
  chain and the token calculator" under AI). `execute` in the processor asks `freeTier.check('translation')` before it plans;
  with room, `swapPlan` moves only the parts on the paid default — OpenAI, `gpt-6-luna` (the server's `service.model('openai')`),
  thinking `off` — to the free translation model (`gpt-4.1-mini` unless the admin picked another). A part given to Claude,
  Gemini, another model or a thinking level is never touched. The row keeps the plan that was asked for; the attempt runs,
  and stamps each verse with, the plan it really used, so a verse's `aiTranslation` names the model that wrote it. Every
  lane's request is counted in the token calculator, and a swapped lane re-checks the allowance **before each request**
  (`countedAsk`) and is logged at $0, so the run's spending limit moves only on paid tokens. When the day's tokens run out,
  or the switch goes off, the lane throws `FreeTierEnded`; the processor puts the run straight back in the queue and the next
  attempt plans on the paid model, starting at the first verse not saved — a feed line says so. If a swapped part lands on
  the model another part already uses, the two lanes become one and its `done` restarts from 0 on the bar (cosmetic).
  `scripts/translation-e2e.js` section 9b walks it.
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
  verse's `aiTranslation`. `translatedBy` is the provider's brand — `claude`, `gpt` or `gemini` (`MADE_BY` in
  `scripts/lib/claude-translate-parts.js`) — so Tamil that GPT wrote says `gpt`; the model and effort are in the stamp. Until
  2026-10-16 every row said `claude` whoever wrote it; `fix-translation-script.js --relabel` corrected the saved files. The
  Translations page counts a row as the runs' own when `translatedBy` is any of those labels. Rules, so nobody has to rediscover them:
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
    touch `translatedBy` / `version`, so a hand-edited row can still read as machine-made until it is imported again.
  - **The read side serves `transliteration` now, not yet `wordMeanings`.** The API verse (`present.verse`) and the offline book
    export (`shapeTranslation`, only when the row has one, so a book without them keeps its file hash) send the reader's own-script
    transliteration, chosen by `language.pickTransliteration` along the reading chain and falling back to the verse's Roman text.
    A translation row's `wordMeanings` are still not sent, and nothing marks a text as machine-made. Run
    `node scripts/export-book-cache.js` after an import so phones fetch the changed Gita chapters.
- **The three permissions are inserted by the migrations** (`translation.read`, `translation.run`, `translation.import`) and
  given to `admin` and `super_admin`; any other role gets them on the admin Roles page. Permissions are cached for about 5
  minutes, so a new grant can take that long to show.
- **The bucket is the app's own** (`S3_BUCKET`, the AWS keys the API already has; `json/bhagavat-gita/` sits in it beside
  the book text). Nothing separate to configure: `openWorkspace()` in `services/translation.js` uses
  `services/s3.js`'s client. `SOURCE_S3_BUCKET` is read only if set (the command line's `.env.scripts` setting; it
  would send the server to a different bucket) and `SOURCE_LOCAL_DIR` is for tests. The keys must be allowed to
  **write** under `json/bhagavat-gita/` and `json/reports/`, and to copy to `json-backup-*/`. The page's checklist
  reads the first English chapter, so a bucket it cannot reach or that lacks the scripture is reported there.
- **Needs in the server `.env`** for the `api` and `worker` containers: `OPENAI_API_KEY` (the default provider), plus `ANTHROPIC_API_KEY` or `GEMINI_API_KEY`
  for a part given to Claude or Gemini, and `TRANSLATION_VERSION` (optional). Without the key of a provider the run would use, the page says so and
  the Start button is disabled.
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
- **Not exercised:** a real Claude call (the e2es fake the model). GPT-6 Luna and Gemini have been called live, and Luna has
  written Tamil chapters 1–4 and run a Malayalam job through the worker against the real bucket. Try one verse with
  `npm run translate:claude:test -- --provider anthropic` before relying on Claude. The import has not been run against the
  Gita's real S3 files either; do a `dryRun` from the page first.

## Sharing, deep links and Refer & Earn

Three independent pieces behind `routes/app/share.js` and `routes/app/referral.js`. **Opening a shared link and claiming an
invitation never touch each other**: content codes (`ShareLink`) and referral codes (`ReferralCode`) are separate tables and
separate paths, so opening a verse can never issue a reward.

| File | Job |
|---|---|
| `utils/share.js` | **Pure.** Code alphabet, `newCode`, `normaliseCode`, the path of each kind (`shloka`, `mantra`, `divya` for a reel, `satsang` for an invitation), `keptQuery` (only `utm_*` and `ref` survive — the page can never be turned into an open redirect) — `test/share.test.js` |
| `utils/referral.js` | **Pure.** `canClaim`, `qualifies`, `rewardWindow`, the default rules (`DEFAULT_RULES`) — `test/share.test.js` |
| `services/share.js` | `linkFor(kind, targetId)` (one link per target; refuses what is not public) and `resolve(code, kind)` → `ok` / `missing` / `gone`. A draft, an unpublished mantra and a code of the wrong kind are all just `missing` — the endpoint cannot be used to probe for drafts |
| `services/referral.js` | `codeFor`, `claim`, `qualifyIfDue`, `summary`, `sweep` |
| `services/share-background.js`, `services/ai/image.js`, `utils/share-background.js` | AI backgrounds for the Share Studio |
| `deeplink/index.js` | Serves `/.well-known/apple-app-site-association` and `assetlinks.json` (paths `/shloka/* /mantra/* /divya/* /satsang/*` + the older ones; fingerprints from `ANDROID_CERT_SHA256`) |

- **Link codes** are 10 random characters from a 30-letter alphabet with no `0 O 1 I L U`; nothing in one is derived from the
  content or a person, and **the target is looked up, never decoded**. One link per `(kind, targetId)` (`@@unique`), so sharing a
  verse twice gives the same link and a link names no sender. `kind`: `SHLOKA` (`targetId` = `Verse.verseId`), `MANTRA` (slug),
  `REEL` (id). `GET /share/links/:code` is public and returns only the public view (text, title, a reel's thumbnail, the verse's
  place, store listings); 404 unknown, **410** revoked or no longer public.
- **Referral rules** (`DEFAULT_RULES`, in code, not yet editable in the admin panel): a code can be claimed only by an account at
  most 7 days old; never your own; first claim wins and a second different code is refused (`ALREADY_REFERRED`); the same code
  again is harmless. The reward is earned once the referred reader has been around 24 h **and** has a chant sitting, a reading
  place or a sadhana day; at most 12 months in a rolling year per referrer. `claim` is rate-limited (`referral`, 20/hour).
- **The reward is a `Subscription` row with provider `REFERRAL`** (`PaymentProvider.REFERRAL`) on the `arta` plan, so the same
  `entitlement.js` that serves the app serves the website, and `User.isPremium` is still only written by `entitlement.refresh`.
  It starts when the person's current Ārta-or-better access ends (so a paying subscriber loses nothing and gains a month after
  it), and extends the one referral row instead of adding another. `ReferralReward` is the audit ledger (who, which referral,
  plan, start, end). **Exactly once**: the referral moves `PENDING → REWARDED` in one `updateMany` (only one caller wins), and
  `ReferralReward.referralId` and `Subscription(provider, externalId = referral:<id>)` are unique. It is not a store
  subscription and says so (`autoRenew: false`); nothing here talks to Google, Apple or Razorpay.
- **When a reward is granted**: when the referrer opens `GET /referral/me`, and by `sweep()` inside the hourly
  `ai.credits.maintain` job. Opening a link grants nothing. Revoking a reward (a refund-style reversal) is **not built**.
- **AI backgrounds** (`POST /share/background`, `GET /share/background/quote`, `GET /share/background/:id/image`). Priced at
  `SHARE_BACKGROUND_TOKENS` (default 100,000 ≈ 25 chat replies) from the same wallet as Ask Sakha, ledgered as
  `OTHER_AI_FEATURE`. **It is paid from the wallet balance only, outside the daily cap** (`aiWallet.debit({ countsToday: false })`):
  one picture is larger than a day's chat cap (6,000 on Free), and spending it must not lock someone out of chat until tomorrow.
  So the Free wallet (60,000) cannot afford one and is told so with an upgrade prompt; Ārta (400,000) holds four a month.
  - **Charged once per `requestId`** (unique per user): a repeat of a finished key replays it free; a key in flight is a 409
    `IN_PROGRESS`; a per-user Redis lock stops two different keys racing the balance check. **A failure refunds before it
    reports** (502 `IMAGE_FAILED`, the provider's body never leaves the server), and a retry of the failed key charges again —
    net one charge per picture delivered. The refund does not give back the daily-usage count (backgrounds do not count to it).
  - No credit → 402 `CREDITS_EXHAUSTED` before anything is written. Pictures are stored as `shareBackground` temp uploads (swept
    by the monthly temp prune) and served back only to their maker (`/image`), so a browser can draw them on a canvas.
  - **Not run against OpenAI.** `npm run test:share-referral` fakes `fetch`. The model name (`gpt-image-1`), the `b64_json`
    response and the price are untested against the real API; check the first real call and its cost.
- **Not built**: an admin page for share links / referrals / rules, reward reversal, and device-fingerprint abuse detection
  (deliberately — no personal data is collected for it; the controls are the account-age window, one-claim-per-person, the
  activity requirement, the yearly cap and the rate limit).
- **Tests.** `node --test test/share.test.js` (pure) and `npm run test:share-referral` (62 checks against the real database and
  Redis, and over HTTP when an API is listening: links, kinds, revoked / unpublished, concurrent link creation, every claim
  refusal, six concurrent reward settles → one reward, a month stacked after paid access, the dashboard, a background charged
  once / replayed / refunded / refused without credit, picture ownership, nothing public leaks).
- **Migration** `20261027000000_share_and_referrals` (adds an enum value and five tables); production needs `prisma migrate deploy`.

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
