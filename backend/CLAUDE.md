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
| `utils/ai-free-tier.js` | **Pure.** The pools and which model is in which, the 90% stop (`SAFETY`), and the models an admin may pick (`USABLE_MODELS`) — `test/ai-free-tier.test.js` |
| `services/ai/token-tally.js` | The token calculator, below |
| `services/ai/free-tier.js` | The switch, and the one question every caller asks: `check('text')` → a model, or `reason: 'off' \| 'spent'`. `status()` and `save()` serve the admin page |
| `routes/admin/ai.js`, `controllers/admin/ai.js` | `GET /api/admin/ai/free-tier` (`ai.read`: the switch, the pools against today's count, the count model by model, what chat would use right now) and `PUT` (`setting.write`: `{ enabled?, textModel?, bonusPoolTokens?, bonusMaxPerUser? }`; a model outside `USABLE_MODELS` is a 400; audit action `ai.free-tier.update`). `GET /api/admin/chat/settings` also returns `engines` for the three purposes |

- **The switch is off until an admin turns it on** (admin → AI usage → *Use OpenAI free tier*; `AppSetting`
  `ai.free_tier.enabled`, with `ai.free_tier.text_model`), so a database that has never
  seen it behaves as before. A `ai.free_tier.translation_model` row left by an earlier version is read by nothing and can be deleted. It exists so data sharing can be switched off at OpenAI one day without a deploy.
- **Only `gpt-4o-mini`, `gpt-4.1-mini` and `gpt-4.1-nano` are offered.** They are in the 2.5 M pool and take plain request
  parameters; the `gpt-5.x` and `o` models in the pools want reasoning parameters `openai.js` has not been run with. Defaults:
  `gpt-4o-mini` for chat (a saved model that is no longer offered reads as its default).
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
- **Book translation never uses the free models** — the admin runs and the command-line script keep to the models their plan
  names (`gpt-6-luna` by default), whatever the switch says; the free models have limits a translation cannot work within. The
  runs' OpenAI requests are still counted in the token calculator, so the day's tally stays honest for chat.
- **Privacy.** With the switch on, what readers write to Sakha and any picture they send goes to OpenAI and is shared under
  that programme. With it off, chat can still reach OpenAI as the paid fallback when the set provider fails, unless
  `AI_FALLBACK_MODEL` is blank. **Turn the switch off before turning data sharing off at OpenAI** — the free models are then
  billed at their normal rates, and the switch would still prefer them to the paid default.
- **Not verified:** that OpenAI really bills these calls at nothing — there is no API to read the free allowance, so watch the
  Usage page at platform.openai.com after a day with the switch on.
- Tests: `test/ai-free-tier.test.js` (pure) and `test/translate-providers.test.js`; `scripts/chat-e2e.js` section 17 (the
  chain, failing over, the switch, the tally, the audit rows — both providers faked) and `scripts/translation-e2e.js` section 9b
  (a run never moves to a free model: switch on, free pool spent, switch turned off mid-run, a mixed plan). Under Node 20 run the unit files one at a time with `node --test <file>`.

### Cost rule: AI never runs on the request path

(The exceptions are **AI chat**, below — a person is waiting for a reply and pays for it from their own wallet — and **a reader's own mantras**, further down: a person is waiting for a list of suggestions, and it is bounded per reader per day instead of by a wallet.)

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
| `services/chat-profile.js`, `controllers/app/chat-profile.js`, `utils/chat-profile.js` | What Sakha has noticed about a reader (`SakhaProfile`): the background reading of each message, the prompt's view of it, and the reader's own say (`GET` / `PATCH` / `DELETE /chat/profile`, routes in `routes/app/chat.js`). The rules for what a profile may hold are **pure** — `test/chat-profile.test.js` |

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
- **Sakha answers first and ties it to Krishna last** (`config/chat.js`). Whatever is asked, the answer comes first,
  genuine and complete; then, at the very end, **one closing paragraph of one to three sentences** ties the matter to
  Krishna (a pastime, a verse it is certain of, or an invitation to remember a holy name) and differs from reply to
  reply. It is **left out** for someone grieving, frightened, ill or in distress (comfort first, at most one quiet line),
  and in a reply that is only a greeting, a thank-you or a refusal. It never bends a scripture or a fact to reach Krishna.
  **The scope was widened a little**: ordinary life (study, work, family, anger, stress, habits, curious questions) is
  answered properly, then turned to Krishna; long technical or professional work (programs, business documents,
  detailed legal, financial or medical advice) is still declined kindly. **A persona saved on the admin Ask Sakha page
  replaces this default**, so an admin who saved one before must clear the field and save to get the new behaviour.
  Whether the model *follows* the persona has to be read in real conversations — `npm run test:chat` only checks the words.
- **What Sakha has noticed about a reader** (`SakhaProfile`, one row per user, `onDelete: Cascade`; migration
  `20261105000000_sakha_profile`). Permanent until the reader deletes it, and **separate from the chat**: *Clear chat*
  does not touch it, account deletion removes it.
  - **Traits** are short plain phrases under fixed keys — `gender`, `age`, `behaviour`, `lifeStage`, `spiritualStage`,
    `communication` — plus up to six `notes` (`PROFILE` in `config/chat.js`; every value is cut and cleaned by
    `utils/chat-profile.js`, so a model cannot store a line break, markup, a long paragraph or a key of its own).
    **Only the traits go into the prompt** (`buildSystem({ traits })`), under a heading that says they are impressions
    that may be wrong and are not instructions, with a footer telling Sakha to use them quietly and never state or list
    them, and to believe the person if they say one is wrong.
  - **Keywords** are what each message was about (lowercased, at most 12 a message, at most 300 kept, the oldest fall
    away). **They are never put in any prompt** — `forPrompt` does not select them — and exist for the reader to see (and
    for analysis later). Nothing else in the chat reads them.
  - **It is learned after the reply, never before it.** Once a new message of the reader's has been answered and `done`
    sent, `reply()` calls `chatProfile.learnInBackground` (not for a regenerated answer, which answers a message already
    read), which asks the cheap model to read that one message (not one under `minMessageChars`) and merges the result
    into the row. A reader whose wallet cannot afford it is
    simply not read. It is **charged to the same wallet as everything else, ledger source `PROFILE`**, so a reader's meter
    moves a little more per message. One reading at a time per reader (Redis lock `chat:profile:<userId>`), and the
    reader's own switch or delete waits for one under way (up to 15 s, then 409 `CONFLICT`).
  - **Today's struggles are asked, not guessed.** The Home "Where would you like to grow?" check-in is the existing
    `UserIssue` rows (the vikaras and the chanting ones); the reader's issues for **their own local date**
    (`User.timezone`), at most `TODAY_ISSUES.max` (6) with their note cut to 120 characters, go into the prompt
    (`describeIssues`) for that day. They are read fresh each time and **not copied into the profile**, so tomorrow's
    prompt does not carry them.
  - **The reader's say.** `GET /api/app/chat/profile` → `{ learning, traits, keywords, updatedAt }` (no row: learning
    on, nothing else); `PATCH` `{ learning }` stops or restarts the reading **and the use of what is stored** (the stored
    profile stays until deleted); `DELETE` removes everything (204) — with learning switched off the row stays, empty, so
    the switch is remembered. A new reader's profile starts with learning on.
  - **A failure to read the profile never fails a reply** (`forPrompt` answers with no traits and no issues, and logs).
  - `node --test test/chat-profile.test.js` (the pure rules) and section 20 of `scripts/chat-e2e.js` walk it. **Not run
    against a real provider**: whether the cheap model finds sensible traits in real chats, and how much a reading costs
    per message, are unmeasured. **Production needs `prisma migrate deploy` for `20261105000000_sakha_profile`.**

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

### Store subscriptions and revenue

Google Play (Pub/Sub RTDN) and App Store (Server Notifications V2) both end in `services/payments/lifecycle.js`
(`applyStoreState`, `applyRefund`, `reconcile`): subscription status, one `Payment` per charge (a free trial is a row of 0,
`isTrial`), and a push to the reader on subscribe / upgrade / renewal / cancel / grace / expiry / refund. `google.js` and
`apple.js` only normalise the store's answer. Every payment stores, once, its original amount and currency, **`grossInrMinor`,
`commissionInrMinor`, `netInrMinor`** (paise), the rate used and where it came from (`money.js`, `fx.js`; Frankfurter then
open.er-api.com, cached per day in `FxRate`). Commission is a configured rate (`PLAY_COMMISSION_RATE`, `APPLE_COMMISSION_RATE`,
`RAZORPAY_FEE_RATE`) because the stores do not report it. Credentials are file paths (`GOOGLE_PLAY_SERVICE_ACCOUNT_PATH`,
`APPLE_PRIVATE_KEY_PATH`). Worker jobs `subscription.reconcile` (6-hourly) and `payment.fx.backfill` (daily). Console steps and
limits: [docs/store-subscriptions.md](docs/store-subscriptions.md). `npm run test:store-subscriptions` (needs only the database
and Redis). **Not run against the real stores. Production needs `prisma migrate deploy` for `20261101000000_store_revenue`.**

## Server wording in the user's language

What the server says in its own voice — error messages and every notification — is in the person's language;
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
- **Every push written for a person opens "Hari Bol <first name>"** — never "Hi" or "Dear" — in the reader's script
  ("हरि बोल Somesh"), or "Hari Bol" alone when the account has no usable name. `greeted(name, chain, sentence)` opens a body
  ("Hari Bol Somesh, 3 rounds left today."), `greetedTitle(name, chain, title)` a title ("Hari Bol Somesh — Your sloka for
  today"); the name is `firstNameOf` (`utils/chat-name.js`: first word, cleaned, 30 characters) and `notify.recipient(userId)`
  loads `{ name, chain }` for a sender that has only an id (`utils/recipient.js` is the pure half). **The chain is the *app*
  language** for everything except the daily sloka and the etiquette push, which follow the *reading* language because the
  verse in them is in it. Where the greeting goes: the chant reminder, the sloka and etiquette pushes, the donation thanks,
  the subscription pushes (trial, subscribed, changed, downgrade, renewed, cancelled, resumed, grace, expired, refunded),
  the referral reward, the reply to a support ticket, the developer's reply and the reel comment / reply pushes. **A
  message written by staff or by the developer keeps its own words** (the support reply, the developer's reply, an admin's
  broadcast or direct message): only the title is ours. **The festival push has no name** — it is one message for everyone,
  so the readers are grouped by app language and each group gets one send (`campaign` `festival:<id>:<days>:<lang>`); the
  festival's name and description are the calendar's data and go as saved.
- **The wording of a notification** lives in `NOTICES` in `utils/messages.js` (the English source; there is no
  `locales/en.json`) and in every `locales/*.json`. `notice(id, chain, params)` is the localized text or the English;
  `{0}` `{1}` `{2}` are filled by position. Dates in a body are `longDate(date, chain)` in `utils/date.js` (the language's
  own month names, India's calendar day). A body that follows the greeting starts in lower case in English.
- **Adding a message**: an id in *every* `locales/*.json` (`test/messages.test.js` fails on a missing id or a changed
  `{0}`; for a notification also add it to `NOTICES`), then, for an error, a rule in `utils/messages.js`. **Adding a
  language**: one new file with all the ids.
- The translations are AI-drafted and **not yet read by a native speaker**.
- **Not translated, on purpose or not yet:** the admin API and the admin and developer apps (staff, English); developer-facing
  messages; the festival names and descriptions (database content); the server-rendered fallback pages in `views/deeplink/`
  and the privacy / terms pages; the OTP and welcome email templates (nothing sends them today); the finance reminder (goes
  to the super admin). The website's own screens are English as well — see [website/CLAUDE.md](../website/CLAUDE.md).
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

## Home recommendations ("For what you are working on")

`GET /api/app/home/issue-verses` (`controllers/app/home.js`, `issueVerses`) answers the Home row of verses for the
vikaras the reader has reported lately. Signed in only, no AI call, no wallet charge; `?languages=` works as on `/home`.

- **What counts.** `UserIssue` rows of published `VIKARA` issues dated within `ISSUE_LOOKBACK_DAYS` (14) of the reader's
  own local date. At most `ISSUE_VERSES_MAX_ISSUES` (3) issues, most reported first, then most recent (`rankIssues`).
  At most `ISSUE_VERSES_PER_ISSUE` (2) verses per issue, so at most 6 items. Empty `items` when nothing qualifies.
- **Which verses.** The same candidate query the sloka picker uses (`topVersesForIssue` in `controllers/app/sloka.js`),
  so Home can never show a verse the sloka cannot pick: sloka-eligible, in a published book, in the eligible book numbers.
  Verses the reader was given lately (`recentVerseIds`) are left out, and a verse already shown under an earlier issue is
  skipped.
- **Fixed for the day.** Within each issue's top band (`topBand`, weights ≥ 80% of the best) the start is
  `dayNumber(date) mod length` (`rotate`). The same day gives the same order, so pull-to-refresh does not reshuffle the row;
  the next day starts elsewhere. Nothing is stored and no `Math.random` is used.
- **Pure helpers** live in `utils/home-issues.js` (`rankIssues`, `rotate`, `topBand`, `dayNumber`) with no I/O, so
  `node --test test/home-issue-verses.test.js` can run without loading Prisma or Redis. Keep it that way: a test that imports
  a module which opens the database hangs the process.
- **Tuning** is in `config/home.js`, not in the controller.
- **Tests.** `node --test test/home-issue-verses.test.js` (11 checks). `npm run test:home-issue-verses`
  (`scripts/home-issue-verses-e2e.js`, 13 checks over HTTP with throwaway users, issues and links, all removed afterwards):
  sign-in required, empty when nothing is reported, vikaras only, the ineligible-verse exclusion, the order by count, the
  per-issue and total limits, the same answer twice in a day, the `languages` parameter (and a malformed one refused), and
  a report older than the lookback ignored. **Not covered by the e2e:** the skipping of verses the reader was given lately
  (`recentVerseIds` needs sloka rows to seed).
- **Not done:** no admin control for the lookback or the counts, and no Home card in the app yet (the app side is outside
  this change).

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
  seed → importers → seed. **The Bhagavatam's 335 chapters are seeded from `section-titles/bhagavatam/<code>.js`** (`{ canto: [headings] }`, found by canto and number; `en.js` holds the English headings as printed on vedabase.io and the test checks every language against it), translated by Claude from those English headings and not read by a native speaker; `seedSectionTitles()` fills them like the others, so production needs `npm run seed` (or Maintenance → Seed reference data) and then Maintenance → Export the offline books. `npm run translate:chapter-titles` (`scripts/translate-chapter-titles.js`) reads each chapter's English heading from the database and has the translation provider (Claude by default, `--provider`) write all 11 languages, one call per canto per language, saving only languages a chapter lacks (so an admin edit is never replaced; `--dry-run`, `--cantos`, `--langs`). Needs the chapters imported and `ANTHROPIC_API_KEY`; run it on the server, then the book export. It remains for fixing or redoing a language. `test/bhagavatam-chapter-titles.test.js` checks the seed files and `test/chapter-titles.test.js` covers its checks with a fake model; **no live call has been made**. The Gita's titles are its traditional names in the reader's own script;
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
- **The phone sends its chanting in a batch: `PUT …/chant/sync`** (`controllers/app/chant-sync.js`). The app counts into its own
  storage first and sends when it closes, opens, comes back online and every few minutes, so one request carries up to
  `CHANT_SYNC_MAX_SITTINGS` (25) sittings, each under the `clientId` the phone made when the sitting began
  (`ChantSession.clientId`, unique with `userId`; migration `20261113000000_chant_client_id`, nullable, so rows from the older
  routes are untouched).
  - **Sending a sitting twice is one sitting** — a lost answer, a retry or two sends racing all land on the same row (a unique
    violation from the race is read back and updated, not failed). Rounds are upserted by `[sessionId, index]`.
  - **A sitting belongs to the day it began**, in the user's timezone (`localDateString(timezone, startedAt)`), however late it
    arrives; the older `start` route can only say "now". The start is held inside `[now − CHANT_SYNC_MAX_AGE_DAYS (400), now]`
    so a wrong phone clock cannot write into the far past or future. Every day touched is recounted once (`recountDay`) and the
    new totals come back in `days`.
  - **Rounds only rise.** A copy with more rounds replaces rounds and beads; at equal rounds the larger beads win; fewer rounds
    are ignored, so an older copy that arrives late cannot undo a newer one. `finish` closes the sitting once (the end is not
    moved by a later finish), and an update after the end is accepted — the final sync has to land.
  - **A mantra that cannot be opened** (unpublished since, someone else's private one, gone) does not fail the batch: the rounds
    are kept under no mantra. The referral check and the tradition check run as for the older routes, and a failure of either
    never changes the answer.
  - The older `start` / `patch` / `detail` routes stay for builds from before this one.
  - `npm run test:chant-sync` (`scripts/chant-sync-e2e.js`, 42 checks: replay, late arrival on its original day, rounds never
    backwards, a late update after the end, two mantras keeping their own rounds, another account's identical client id, a
    clamped start, refusals, a full batch). **Production needs `prisma migrate deploy` for `20261113000000_chant_client_id` and a
    restart of the API; release the app with it, as an older app simply keeps using the old routes.**

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
and imports what was saved into the database, which is also a background job (a second run model, `TranslationImportRun`, below). The pipeline is the same one `npm run translate:claude` uses
(`scripts/lib/claude-translate-*.js`, described in
[scripts/README.md](scripts/README.md#translating-the-gita-with-claude)); this section is the part that runs it
inside the API, worker and websocket containers.

| File | Job |
|---|---|
| `routes/admin/translation.js`, `controllers/admin/translation.js` | Seventeen routes under `/api/admin/translations`: `overview`, `coverage`, `estimate`, `runs` (list), `runs` (start), `runs/:id`, `runs/:id/resume`, `runs/:id/cancel`, `output/:language/chapters/:chapter`, `output/:language/verses/:verseId`, `imports` (`GET` what the database holds per language, `POST` queue an import, or with `dryRun` preview one), and the import runs: `imports/runs` (list, `?kind=TRANSLATION|VIKARA`), `imports/runs/:id` (the run and its feed), `imports/runs/:id/cancel`, and the vikara import's pair `imports/vikaras` (`GET` what the database holds from the tags, `POST` queue it, or with `dryRun` preview it). `translation.read` for reads, `translation.run` for start / resume / cancel, `translation.import` for queueing and cancelling an import |
| `services/translation.js` | Opens the S3 workspace, per-language coverage read from the `TranslationProgress` table (one row per book × chapter × language; `syncProgress` counts S3 into it — the worker for a run's chapters when it stops, `startRecount` in the background for the whole book when the table is empty, was counted under another version, or Recount is pressed; Redis lock `translation:coverage:recount:<book>` carries its progress; `npm run backfill:translation-progress`, also on the Maintenance page, is the resumable one-off; migration `20261030000000_translation_progress`), the estimate, the activity feed (Redis `translation:feed:{runId}`, 200 lines, 30 days), the start lock, `addRunJob` |
| `services/translation-import.js` | `importLanguage`: reads a language's chapter files from storage and writes them to `VerseTranslation`, or with `dryRun` only says what it would do. It calls `onChapter(line, done, total)` after each chapter and stops between chapters when `shouldStop()` says so, which is how the worker reports progress and honours Cancel. Also the import run's plumbing: `publishImportRun` (the websocket event), the activity feed in Redis (`pushImportFeed`, `readImportFeed`), `addImportRunJob` / `dropImportRunJob` and `reconcileImportRuns` |
| `utils/translation-import.js` | Pure functions, no I/O: how a file's verse becomes a row's columns (`rowFromEntry`), whether it is the verse the database holds (`placeProblem`), what differs (`changedColumns`), `reasonOf`, and for the run row `presentImportRun`, `summaryOf` (the one-line result) and `LIVE_IMPORT_STATUSES`. `test/translation-import.test.js` holds them |
| `services/vikara-import.js`, `utils/vikara-import.js` | The Bhagavatam's **vikara import**: `importVikaras` reads the tag files (`issues/json/srimad-bhagavatam/c<canto>-ch-<n>.json`) and links verses to the six `Issue` rows (`VerseIssue`), or with `dryRun` only says what it would do; `vikaraStatus` is what the page shows (verses and links per vikara). The pure half is `slugsOf`, the per-chapter line and `vikaraSummaryOf`. `test/vikara-import.test.js` holds the pure half; sections 12–13 of `npm run test:translation-import` walk the rest |
| `jobs/processors/translation.js` | The BullMQ processor: runs the pipeline verse by verse, heartbeats, and decides what a stop means |
| `jobs/processors/translation-import.js` | The BullMQ processor for an import (`translation-import.run` with `{ runId }`, queue `translation-import`, `attempts: 1`): claims the `TranslationImportRun`, calls `importLanguage` (or `importVikaras` when the row's `kind` is `VIKARA`), writes progress, the heartbeat and an activity line after every chapter, notices a Cancel between chapters, and ends the run COMPLETED, FAILED or CANCELLED. `onJobFailed` marks a run whose job BullMQ gave up on |
| `utils/translation-run.js` | Pure functions, no I/O: `classifyError`, `retryDelayMs`, `presentRun`, how a pipeline event reads in the feed. `test/translation-run.test.js` holds them |
| `config/translation.js` | Every timing and limit, with a comment each. Change a number here, not in the processor |
| `prisma/migrations/20261013000000_translation_runs` | `TranslationRun` and the two permissions |
| `prisma/migrations/20261018000000_verse_translation_version` | `VerseTranslation.transliteration`, `wordMeanings`, `translatedBy`, `version`, and the `translation.import` permission. Idempotent (`IF NOT EXISTS`, `ON CONFLICT DO NOTHING`) |
| `prisma/migrations/20261111000000_translation_import_runs` | `TranslationImportRun`. No permission change: the three above already cover it |
| `prisma/migrations/20261112000000_vikara_import_runs` | `TranslationImportRun.kind` (`TRANSLATION` default, or `VIKARA`). No permission change |

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
- **A run never uses OpenAI's free models.** The free-tier switch (rules under AI, "OpenAI's free tokens, the engine chain and the
  token calculator") is for chat only: `execute` in the processor plans on exactly the models the row names (OpenAI's default is
  `gpt-6-luna`, `service.model('openai')`) and never swaps a part, whatever the switch or the day's tally says. Every lane's
  request is still counted in the token calculator (`countedAsk`), so the tally chat reads includes what a run spent.
  `sameParts` stays in `conclude` so a run that began on a free model under the earlier behaviour still resumes cleanly.
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
  presented run) and `translation.activity` (`{ runId, at, kind, level, text, verseId? }`, one feed line). An import has
  the same pair, `translation-import.run` and `translation-import.activity` (`{ runId, at, kind, level, text }`), to the
  same audience. The page still works without the socket by polling.
- **A language already translated under the current `TRANSLATION_VERSION` is not translated again.** A verse is
  *current* when Prabhupāda's translation exists and Claude's stamp on it (`aiTranslation.version`) is the running
  version, or there is no stamp (a person's text, which is never replaced). Any other version, newer or older, is
  *outdated* and is translated again. `start` with nothing but current verses in the chosen chapters creates no run and
  answers 409 `error.details = { upToDate: true, version }`; the estimate carries `version` and `outdated`, and
  coverage `upToDate` per language and chapter. To translate it all again, set a new `TRANSLATION_VERSION`.
- **Import puts storage into the database; storage stays the truth.** `POST /imports` `{ language, book?, chapters?,
  publish?, dryRun? }` queues a `TranslationImportRun` and answers 201 at once; **the worker does the copying, not the API
  process** (a Bhagavatam language is hundreds of chapters). It reads `json/bhagavat-gita/<language>/ch-<n>.json` and writes
  the Prabhupāda `TRANSLATION` row of each verse:
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
  - **A language import never makes vikara links.** The vikara tags are not in the language files any more (below), and an
    old-shaped entry that still carries an `issues` array is read for its translation only. The Bhagavatam's tags have their
    own import.
  - **Hidden unless `publish`.** A new row has `isPublished: false`; an existing row's visibility is never lowered; `publish: true`
    raises it and needs `verse.publish` as well as `translation.import`. The readers' endpoints only serve published rows.
  - **One transaction per chapter.** A failed chapter is reported with its reason and rolled back (its counts are zeroed), the
    others carry on, and running it again is harmless. `dryRun` does the same work and writes nothing; it is what the page
    shows before the button is pressed, and **it is the one part that still runs inside the request** (it only reads, makes
    no run and takes no lock, but for the Bhagavatam's 335 chapters it is slow).
  - **An import is a run, like a translation.** The `TranslationImportRun` row is the truth and its `jobId` names the only
    BullMQ job allowed to work it, as above, so a stale or duplicate job does nothing. Its states are QUEUED → RUNNING →
    COMPLETED, FAILED or CANCELLED, never PAUSED: an import waits on nothing, and a chapter that cannot be written is a line
    in the result, not a stop. FAILED is for something that broke outside any one chapter (the book or translator missing
    from the database, storage unreachable). After every chapter the processor writes `doneChapters` of `totalChapters`, the
    last chapter finished and the heartbeat, and adds a line to the activity feed (Redis `translation-import:feed:<runId>`,
    newest first, 200 lines); when the run ends the row carries the same report `dryRun` gives. `reconcileImportRuns` (worker
    boot and every 2 min, beside `reconcileRuns`) re-queues a QUEUED / RUNNING row whose job has gone missing.
  - **A shutdown hands an import back, and it starts over.** The run goes back to QUEUED and its job is delayed 2 s; the next
    worker runs `importLanguage` again from the first chapter, and the chapters already written come out `unchanged`, so the
    finished report of a run that was handed over counts those as unchanged rather than created.
  - **One live import per language and book.** A Redis lock (`translation:import:<book>:<language>`, `importLockSeconds`)
    is held only while the row is being made, so two clicks a moment apart cannot both pass; a second that meets it gets 409
    "being started". What actually refuses is the database: a QUEUED or RUNNING import of that language and book gives 409
    with `error.details.runId`, which the page turns into "Open that import". A preview neither waits for the lock nor takes
    it. The audit row `translation.import` is written when the run is queued (who, and what was asked: language, book,
    publish, chapters or "all"); a preview, a refusal and a lost race write none. The page also offers Import only while no
    translation run for that language is live; the API does not enforce that.
  - **Cancel** (`POST /imports/runs/:id/cancel`, `translation.import`, audited as `translation.import.cancel`): a RUNNING
    import is asked to stop and does so after the chapter in progress, keeping the report of what it did (the chapters written
    stay written). A QUEUED one, or a RUNNING one with no heartbeat for 90 s (nobody is working it), goes to CANCELLED at once
    and its job is taken off the queue. A finished import answers 409.
  - **Reading them back:** `GET /imports/runs` (newest first; `status`, `language`, `book`), `GET /imports/runs/:id` (the run
    and its feed) and `GET /overview`, which carries `activeImports` so the page can show the live ones. The admin page shows
    only the live ones and the one its dialog is following; nothing there lists finished imports yet.
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
- **Vikara tags: a separate file, and a separate import (Bhagavatam in Marathi only).** Which of the six vikaras (`kama`,
  `krodha`, `lobha`, `moha`, `mada`, `matsarya`; `VIKARA_SLUGS`) a verse genuinely helps with is asked only for the
  Śrīmad-Bhāgavatam when Marathi is among the languages (`issuesAsked` in `scripts/lib/claude-translate-run.js`), and is
  saved **beside** the language files, never in them: `issues/json/srimad-bhagavatam/c<canto>-ch-<n>.json` (for a test
  folder, `issues/json/<folder>/ch-<n>.json`; `issuesChapterKey` in `claude-translate-store.js`). One file per chapter,
  the language-file shape with a single language, `en`: `{ bookNumber, bookSlug, bookName, cantoNumber, chapterNumber,
  chapterName, language: 'en', verses: [{ verseId, bookNumber, cantoNumber, chapterNumber, verseNumber, verseNumberEnd,
  sanskrit, issues }] }`. **`issues: []` is the usual and correct answer** (most verses help with none), so the prompt
  (`PROMPT_VERSION` 9, `ISSUES_INSTRUCTION`) names a vikara only when the verse itself speaks to it, and a name outside the
  six is dropped on save. The tag file is written first within each verse's save, so a failed tag save leaves the verse
  retryable. A translation run neither imports nor reads these files.
- **The vikara import is a second kind of import run, not a second system.** `POST /imports/vikaras` `{ chapters?, dryRun? }`
  (`translation.import`) queues a `TranslationImportRun` with `kind: 'VIKARA'` (`language` `en`, `book`
  `srimad-bhagavatam`, never published) on the same `translation-import` queue, and the same processor works it
  (`importVikaras`), with the same progress, heartbeat, activity feed, websocket events (`translation-import.run` /
  `.activity`, now carrying `kind`), Cancel and reconcile. `GET /imports/runs?kind=` filters; `overview.activeImports` holds
  both kinds. Only one vikara import may be live (409 with `error.details.runId`; Redis lock
  `translation:import-vikara:srimad-bhagavatam`); a vikara import and a language import do not block each other. Audit
  action `translation.vikara-import`. The rules:
  - **A verse is found by its `verseId` and checked with the same `placeProblem`** as a translation import; a verse the
    database lacks or that disagrees is reported and left alone. It never creates a `Verse`.
  - **A verse that already has any `VerseIssue` link is left alone, and nothing is ever deleted**, so links put there by
    the seed, by hand or by an earlier import are never replaced and a second import changes nothing. Re-tagging a verse that
    is already linked is therefore not something this import does.
  - **A verse with no tags writes nothing** (counted `noTags`); a name that is not one of the six is ignored and counted
    (`ignored`). If any of the six has no `Issue` row the import is refused with 422 "Run the seed first" before anything
    is written.
  - **One transaction per chapter**, with the verses locked `FOR UPDATE` so two imports (or a seed) cannot both find a verse
    unlinked and double its links. A chapter that fails is reported and rolled back, the others carry on; a chapter with
    no tag file is `found: false`, not an error.
  - The report is `{ dryRun, totals: { chapters, notFound, inStorage, tagged, noTags, verses, links, alreadyLinked, ignored,
    missing, conflicts, failedChapters }, chapters: [{ chapter, found, inStorage, tagged, noTags, verses, links,
    alreadyLinked, ignored, missing, conflicts, error }] }`. `GET /imports/vikaras` answers `{ book, verses, links, vikaras:
    [{ slug, name, inDatabase, links }] }`.
  - **Chapters translated before the tags were kept apart have no tag file.** The 13 verses of Bhagavatam 10.1 already in
    `mr/c10-ch-1.json` carry old `issues` arrays that nothing reads; because a translation run skips a verse already done
    under the current version, they get tags only if translated again (a new `TRANSLATION_VERSION`).
- `npm run test:translation` (`scripts/translation-e2e.js`, 259 checks) walks it against the real database, Redis and a real
  BullMQ worker with Claude faked: start, progress, credit pause and Resume, a 529 retry, cancel, a killed
  worker, a flushed queue, permissions, the version rule, and the output endpoints. Its section 12 walks the queued import:
  who may, what it refuses, a 201 with a run that names its job, the live events, a second import refused with the first's
  id, the list / one / overview reads, a real `translation-import` worker taking a run (Malayalam has nothing in storage, so
  every chapter reads "no file" and nothing is written), a failure explained and one not, cancel of a waiting, a working
  and a stalled import, a superseded or finished job skipped, a shutdown handing the run back, `reconcileImportRuns`, the
  preview and the audit rows, and a vikara import queued, worked by the real worker (with no tag file in storage, so it reads two chapters and links nothing), listed by `?kind=` and refused twice.
  `npm run test:translation-import` (`scripts/translation-import-e2e.js`, 98 checks) walks `importLanguage` against the real database
  with a throwaway book and a local folder: new, replaced in place with the id kept, unchanged, a part cleared, refused
  verses, a rolled-back chapter, the visibility rules, dry runs and two imports at once (section 12: a language import never
  makes vikara links; section 13: the vikara import — tagged, empty and unknown-name verses, a verse already linked, a verse
  the database lacks, a chapter with no file, a rolled-back chapter, a second import changing nothing). `npm test` needs Node ≥ 21 for its
  test glob; under Node 20 run
  `node --test test/translation-run.test.js test/translation-import.test.js test/claude-translate.test.js`.
- **Not exercised:** a real Claude call (the e2es fake the model). GPT-6 Luna and Gemini have been called live, and Luna has
  written Tamil chapters 1–4 and run a Malayalam job through the worker against the real bucket. Try one verse with
  `npm run translate:claude:test -- --provider anthropic` before relying on Claude. The import has not been run against the
  Gita's real S3 files either; do a `dryRun` from the page first. The queued import has been walked only by the two e2es
  above (a throwaway book and language, a worker started inside the script); it has not run against a live API, the
  production worker container, a browser or the real files.
- **Production needs `prisma migrate deploy` for `20261111000000_translation_import_runs` and `20261112000000_vikara_import_runs`
  (adds `TranslationImportRun.kind`), and a restart of the API and the worker** (the worker registers the `translation-import` queue and its reconcile timer at boot). No seed, no permission
  change. Deploy the admin panel with the API: `POST /imports` now answers 201 with a queued run instead of 200 with the
  result, and `GET /overview` carries `activeImports`, which an older panel does not read. **The vikara import also needs the
  six `Issue` rows (`npm run seed`)** and, to have anything to import, a Marathi Bhagavatam translation run made after the tag
  files were introduced. Neither the tag writing nor the vikara import has run against a real model, the real bucket, a
  browser or a phone; both e2es use a throwaway book and a local folder.

## Sharing, deep links and refer and earn

One feature on three parts (backend, website, app); the three must agree on the link grammar.

**Links.** A piece of content gets an opaque random code (base58, 10 chars, `ShareLink` row) and is shared as
`https://hariharibol.com/shloka/<code>` (verse), `/naam/<code>` (mantra), `/darshan/<code>` (reel). The route words are
the app's own terms; the code reveals nothing about the content and is not guessable. An invitation is
`/satsang/<REFERRALCODE>` and is a separate family: opening content never attributes a referral. The grammar lives in
`utils/share.js` (`parseLink`, `contentUrl`, `referralUrl`), `website/src/lib/share-link.ts` and
`app/lib/core/share_links.dart`; change one, change all three (each has a test).

**Routes** (`routes/app/share.js`, `routes/app/referral.js`, `routes/web/share.js`, all documented in the route table):
`POST /api/app/share/link`, `GET /share/background/quote`, `POST /share/background` (AI card picture, debits the
reader's AI wallet, refunds once on failure, idempotent per request key), `GET /share/background/:id[/image]`;
`GET /referral/me`, `/referral/mine`, `POST /referral/attribute`; public `GET /api/web/share/:route/:code`,
`/referral/:code`, `/app-links`. Image generation uses `services/share-image.js`.

**Referral rules** are in `config/referral.js`, each with an env override: attributed once, only within 7 days of
signing up; the new person qualifies by finishing one full round within 30 days; the referrer then gets 30 days of
Ārta (`REFERRAL_REWARD_PLAN_SLUG`), at most 12 rewards a rolling year. The reward is an **`EntitlementGrant`** row,
not a fake subscription: `services/entitlement.js` reads grants beside subscriptions and payments, a grant starts
after the paid period or the previous grant so it never shortens anything, and a unique `(userId, requestKey)` makes
a retry grant nothing twice. Qualification runs from `controllers/app/sadhana.js` when a round is saved.

**Deploy.** `prisma migrate deploy` for `20261027000000_share_referral` (the seed is not involved). Env:
`APPLE_TEAM_ID`, `ANDROID_CERT_SHA256` (comma separated), `PLAY_STORE_URL`, `APP_STORE_URL`. Empty is deliberate: the
association files then list nothing and the page hides the store badge instead of linking somewhere invented.
`deeplink/index.js` serves `/.well-known/apple-app-site-association` and `assetlinks.json`; `deploy/server/nginx.conf`
proxies both on the apex domain. `npm run test:share-referral` (57 checks, provider faked) and
`node --test test/share.test.js`.
**A private mantra (a reader's own, below) is never shared:** `services/share.js` needs `isPublished`, so `POST /share/link`
answers 404 and a resolve 410; the app hides Share for it, and `controllers/app/reel-make.js` takes only `PUBLIC` mantras.

## Readers' own mantras

A reader who chants something we do not hold (Jap tab → **Add your mantra**) says or types it, the AI names related
**well-known** mantras, the reader ticks up to 5, and each tick becomes a `Mantra` row only that reader (and anyone else who
asks for the same one) can open. At **11 readers** it becomes the catalogue's own, in every language. App half: "Readers' own
mantras" in [app/CLAUDE.md](../app/CLAUDE.md). `services/user-mantra.js` is a service, not a controller, because the
controller and the worker both use it (the worker writes the extra languages, `translateMissing`); the pure half (cleaning the text, the prompts,
checking what the AI sent) is `utils/mantra-own.js`, the visibility rule `utils/mantra-visibility.js`, the picture search
`services/public-image.js`, every number `config/mantra-own.js`.

**The flow** (all under `/api/app/mantras`; `/own…` is registered before `/:slug`):

| Call | What happens |
|---|---|
| `POST /own/suggest` `{text}` | Text cleaned (2–200 characters). Operation `mantra.suggest` returns up to 8 mantras; each is checked, labelled `new` / `shared` (someone else holds it) / `yours` / `catalog` (public), and the list is held in Redis for **1 hour** under a `suggestionId`. 422 `MANTRA_INPUT_NOT_USABLE`, 429, 503 `MANTRA_AI_UNAVAILABLE`. |
| `POST /own` `{suggestionId, picks}` | **The phone sends back index numbers only**, so nothing but what the AI itself suggested can ever be saved. At most 5. An existing mantra is not made twice: the reader is given `MantraAccess` to it. A new one gets `mantra.details` (every field a catalogue mantra has), a picture, `mantraType = PRIVATE`, `isPublished = false`, `createdById`, and `mantra.translate` for English + the reading languages of the readers who asked. 201 `{items:[{index,status,mantra}]}`; 409 `MANTRA_LIMIT`, 410 (suggestions expired), 429, 503. |
| `PUT /own/:slug/image` | The reader's own picture (raw body, 5 MB, re-encoded and stripped like a chat picture). Only the one who made it. 403, 404, 413 `IMAGE_TOO_LARGE`, 422 `IMAGE_NOT_USABLE`. |
| `DELETE /own/:slug` | The reader leaves it: their `MantraAccess`, favourite and preferred-mantra pointer go; the mantra itself (and an uploaded picture) is deleted only when no reader holds it and no chant session or reel refers to it. 204. |

**It is the one place besides the chat where a reader's words reach an AI provider, and it is not wallet-charged.** `ai.complete`
(`services/ai/index.js`) debits no wallet, so the limits are the guard: **20 suggestions and 10 creations per reader per UTC day**,
**50 own mantras** held at once, the `ai` rate-limit bucket on suggest and create (`write` on image and delete), and the usage is
still logged to `AiUsageLog` (operations `mantra.suggest`, `mantra.details`, `mantra.translate`). A new mantra made by two readers
at once is serialised by `withLock`, so it is made once.

**"Well known" is layered, not one rule.** The prompt asks only for mantras with a long recorded tradition, addressed to a
deity or a saint of the Hindu bhakti and wider Indian traditions (the model answers `wellKnown: true`, a `kind` of deity or saint
and `addressedTo`); `utils/mantra-own.js` then rejects any item that is not `wellKnown === true`, has another kind, or has no
`addressedTo`, and a **deity mantra needs a deity and a saint's mantra a guru**. **Living persons are excluded by the prompt
only** — nothing in the code can tell. **Whether a mantra is well known is the model's judgment.**

**A deity or guru we do not hold is created, unpublished.** The AI's `addressedTo` is matched to `Deity` / `Guru` by slug and
name; when nothing matches, a row is created with `isPublished: false` (no picture, no `nameI18n`) so an admin can review it, add
a picture and publish it. Until then the mantra shows without that chip. A different spelling of an existing name can still make
a duplicate.

**Visibility** (`visibleTo(user)`): published, or private **and** the reader has a `MantraAccess` row. A private mantra stays
`isPublished = false` for good, so every public path (search, the catalogue, share, reels, the export) already leaves it out;
the Jap list puts a reader's own first (`PRIVATE_DISPLAY_ORDER = -1`). `Mantra.matchKey` (name + text, normalised) is how
"someone already holds this" is found; it goes stale if an admin edits the name or text.

**Promotion at 11 readers** (`promote`): sets `PUBLIC`, publishes, gives it a `displayOrder` after the curated catalogue
(`PROMOTED_DISPLAY_ORDER`), **drops any picture a reader uploaded and its S3 object** (a private upload is not made public), and
queues translation into every supported language. Readers keep their access rows. `controllers/admin/mantra.js` makes a
published `PRIVATE` mantra `PUBLIC` on save (the admin guard); an admin has no way to hide a private mantra except deleting it.

**Pictures:** `findPicture` searches **Wikimedia Commons** by a few words the AI gave and takes a file only when Commons marks it
public domain or CC0, JPEG or PNG, at least 400 px wide, on `upload.wikimedia.org`; the address is stored in `imageUrl` and
hotlinked (nothing is downloaded, and the credit is not kept). Any trouble is no picture. `imagePath` (the reader's upload) wins
over `imageUrl`. No AI image is ever generated.

**Error wording:** the new `AppError` codes (`MANTRA_INPUT_NOT_USABLE`, `MANTRA_AI_UNAVAILABLE`, `MANTRA_LIMIT`, `IMAGE_NOT_USABLE`,
`IMAGE_TOO_LARGE`) have **no `locales/*.json` ids, so the server text is English**; the app words every one by its code (and 410 /
413 by status, which `ApiClient._kindFor` maps to `unknown`). A new code that is not in the app shows the app's general line.

**Tests:** `node --test test/mantra-own.test.js` (46) and `npm run test:mantra-own` (`scripts/mantra-own-e2e.js`, 146 checks: needs
Postgres and Redis only; it fakes the AI and blanks the AWS keys itself). **Not run against a real AI provider, Wikimedia from a
server, or S3.** **Production needs `prisma migrate deploy` for `20261104000000_user_mantras`** (no seed).

## Active users, live presence and the per-person admin page

- **`UserActiveDay`** (migration `20261031000000_user_active_days`): one row per person per Indian calendar day on which they made a
  signed-in request, with the platform (`X-Platform`) of the first one. It is the history behind daily / weekly / monthly active users
  and retention — `User.lastActiveAt` only knows the last time, so it cannot say how many people were active last Tuesday.
  Written by `services/presence.js` `touch()` from `middleware/auth.js`, at most once a day per person (a Redis gate, then an
  upsert); the migration rebuilds earlier days once from `SadhanaDay`, `ChantSession`, `ReelView`, `ReadingProgress`, sign-up and
  `lastActiveAt` dates, which is **approximate** (only days that left a row). Days are `Asia/Kolkata`, like the dashboard.
- **Presence** is a Redis sorted set `presence:users` (userId → last seen ms), refreshed at most every 20 s per person; "online" is
  seen in the last 5 minutes. **The websocket container pushes `presence.update`** to every socket with `system.read` every 5 s
  when someone arrived or left (and every 20 s regardless) with the counts and the people who joined / dropped; nothing is sent
  when no admin is connected. `GET /api/admin/system/live` is the first paint and the polling fallback.
- **`GET /api/admin/system/activity?days=7–180`**: daily active users, new sign-ups, rolling weekly and monthly actives, stickiness
  (DAU ÷ MAU), day-1 / 7 / 30 retention of people who joined in the last 60 days (a figure appears only once that many days have
  passed), and today's split by platform. `GET /system/analytics` now takes its DAU / WAU / MAU from the same record.
- **`/api/admin/users/:id/{overview,chanting,daily,engagement,billing}`** (`user.read`, `controllers/admin/user-detail.js`): one
  endpoint per tab of the admin's person page. Read only, no secrets, and **what a person says to Sakha is never shown** (titles and
  counts only). Per-mantra totals, sittings, streaks, day-by-day rounds against target, reading progress, saved items, notes, reels
  watched, notifications, devices, plan / subscriptions / payments, the Sakha wallet and ledger, and referral grants.
- Tests: `npm run test:admin-users` (31 checks over HTTP and the websocket; needs the API **and** `node websocket/index.js` running).
  **Not run at scale:** the presence write is one Redis `SET NX` per signed-in request, one `ZADD` per person per 20 s, and one
  upsert per person per day.

## Where a person is (IP location)

`User` carries `countryCode`, `country`, `state`, `district`, `city` and `locationUpdatedAt` (migration `20261106000000_user_location`),
worked out from the caller's IP address by `services/geo-ip.js`: MaxMind's **GeoLite2-City** `.mmdb` read from disk with the `maxmind`
package, so a lookup is a few microseconds in memory and **no reader's address is sent to anyone**. State is the record's first
subdivision, district its second. Setup is in [secrets/README.md](secrets/README.md): the file is not in the repo (the licence forbids
redistributing it, and `secrets/` is ignored) and `GEOIP_DB_PATH` names it.

- **When it is written.** On the hourly `lastActiveAt` write in `middleware/auth.js` (`touchLastActive`, gated by the Redis key
  `active:<userId>`), in the same `UPDATE`: no extra write and nothing on the request path (the function is not awaited). So a new
  account is placed on its first signed-in request and someone who travels within the hour. `req.ip` is the real client because
  `trust proxy` is 1 and Apache / nginx set `X-Forwarded-For`.
- **The raw IP is not stored.** Only the place is. A lookup that finds nothing (database not installed, private / loopback address,
  an address MaxMind does not know) **leaves the last known place standing**; it never blanks it.
- **Optional.** Blank `GEOIP_DB_PATH`, or a file that is not there, and `locate()` answers null: the API boots and the columns stay
  empty. A file that cannot be opened logs one warning. It is read once, so restart the API after replacing it.
- **What it can say.** Country is nearly always right, state usually, city often. **District is rare** (MaxMind fills a second
  subdivision mostly in the UK and a few other countries; for India it is usually null). A VPN, a company network or a mobile
  carrier's gateway shows that network's place, not the phone's. Do not use it for anything that needs to be right about one person.
- **Memory.** The database is a Buffer outside the Node heap, roughly the size of the file (60–70 MB for GeoLite2-City): watch it
  against the API container's 512 MB limit on first deploy.
- **Shown in** the admin Users list (a Location column) and the person's page (`user.read`, `controllers/admin/user.js`,
  `user-detail.js`). Not in any app or website response. Disclosed on the privacy page.
- Tests: `node --test test/geo-ip.test.js` (the pure parts and "no database" behaviour). **Not in the suite:** a lookup against a real
  database, since the file cannot be committed; it was checked by hand against MaxMind's published `GeoLite2-City-Test.mmdb`
  (London, Boxford with a district, Milton WA) and through the running API with an `X-Forwarded-For` header.
- **Production needs** `prisma migrate deploy` for `20261106000000_user_location`, then the `.mmdb` in the server's secrets folder
  and `GEOIP_DB_PATH=/app/secrets/GeoLite2-City.mmdb` in the API's `.env`, then a restart (see [deploy/README.md](../deploy/README.md)).
  Existing users get a place the next time they make a signed-in request after the hour gate expires; there is no backfill.

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

## Scene prompts (admin → Scenes)

`SceneRun` + `jobs/processors/scenes.js` + `services/scenes.js` + `utils/scenes.js` (pure: file names, prompt, schema, checks, limiter) + `controllers/admin/scene.js`. Built like translation runs; read those first. One request per chapter with the Hindi meaning of each verse (from `hi/` in the bucket, else `VerseTranslation`), answer checked so every verse is in a scene (asked again once with the problems), saved to `json/<book>/scenes/sk-<canto>-ch-<n>.json` (old file backed up) and listed in `_index.json`. A 429 is always a wait, never "credit". One run at a time. Settings: `SCENES_PROVIDER`, `SCENES_GEMINI_MODEL`, `SCENES_RPM`, `SCENES_TPM`, `SCENES_RPD`. Tests: `npm run test:scenes`, `test/scenes.test.js`.

**The provider and model are chosen per run.** `POST /api/admin/scenes/runs` and `GET …/estimate` take an optional `provider` (`anthropic`, `openai`, `gemini`) and `model`; left out, the run uses `SCENES_PROVIDER` and that provider's configured model (`service.model(provider)`). The catalogue is the one the translation scripts use, `scripts/lib/translate-providers.js` (`providerChoices` for the picker, `whyNotUsable` for a model that cannot be run). The start is refused with a 422 before anything is queued when the server has no key for the provider (the message names the setting, e.g. `ANTHROPIC_API_KEY`) or the model cannot be used (e.g. `gemini-2.5-pro` always thinks, `claude-fable-5-1` cannot turn thinking off); an unknown provider is a 400. The run row stores `provider` and `model`, and the worker builds its client from them (`makeAsk`). **The request/token limiter (`SCENES_RPM`, `SCENES_TPM`) is Gemini's free tier and is applied only to a Gemini run** (`limitsFor(provider)`); another provider has none of our own, so its estimate counts only the model's time to write a storyboard, and `limits` in the estimate is `null`. The estimate's cost is the catalogue's price for the chosen model (`null` when it has none). `npm run test:scenes` (61 checks) walks it, including the 422s and the Gemini-only limits.


## Narration (admin → Narration (AI voices))

**Built on the backend and the admin panel. The unit suites pass (`node --test test/narration.test.js test/narration-engines.test.js test/narration-admin.test.js`, 36 + 12 + 10); `npm run test:narration` (`scripts/narration-e2e.js`, 53 checks) passes against a throwaway local Postgres and Redis with a fake engine and the clips written to a temporary folder. No text-to-speech engine and no real S3 bucket has been called, and the migration is not applied to any real database.** The translation of each verse (not the purport) is spoken by a text-to-speech engine and stored in S3, started and watched from the admin panel. Not to be confused with the guru `Narration` model.

- **Files**: `NarrationRun` + `NarrationClip` (migration `20261121000000_narration_runs`, which also grants `narration.read` / `narration.run` to admin and super_admin; `config/constants.js` lists the two for `npm run seed`), `config/narration.js` (engines, voices, languages, defaults, limits; spreads `config/translation.js` for heartbeat, retries and feed), `utils/narration.js` (pure: keys, hash, staleness, splitting, cost, error classes, presenters), `services/narration.js` (sources, clips, `_index.json`, feed, job), `services/narration-engines.js` (Google Chirp 3 HD and Gemini TTS requests), `jobs/processors/narration.js` (the worker; queue `narration`, `attempts: 1`, concurrency 1), `controllers/admin/narration.js`, `routes/admin/narration.js`.
- **Two kinds of run.** `NARRATION`: chapters of a book in one voice. `COMPARE`: one verse in up to `narration.maxTargets` (6) voices, to listen before choosing; it replaces earlier clips of that verse in those voices. A run is a row; the job only works it (the same contract as Scenes: Cancel on a running run sets `cancelRequested`, Resume is for paused or failed, `reconcileRuns` re-queues a lost job). Runs are worked one at a time in the order made, across the whole queue.
- **Admin API** `/api/admin/narration`: reads (`narration.read`) `overview`, `voices`, `languages`, `estimate`, `runs`, `runs/:id` (with the feed), `compare/:id` (cells with a short-lived clip address), `clips`, `clips/:id`; writes (`narration.run`) `POST runs`, `POST compare`, `POST runs/:id/resume`, `POST runs/:id/cancel`. Starting takes a Redis lock `narration:start:<book>` for 20 s and refuses (409) a second live run of the same kind for the same book; an unknown voice, a missing engine key, unset storage, or a compare verse with no text is a 422. `estimate` reads up to 20 chapters and leaves out clips already made; more are sampled and scaled up (`sampled: true`). The engine's `price.verified` is passed through and the panel shows an unverified price as such; an engine with no price gives `costUsd: null`.
- **Rules** (from `NARRATION_PROGRESS.md`): the narrated text is the translation; the default book is the Gita; the S3 layout is `narration/api/<book>/<language>/<engine>/<model>/<voice>/[canto-<n>/]ch-<n>/<verseNumber>.<ext>` with an `_index.json` in each voice folder; a clip made from the same text (hash, which includes `pipelineVersion`) is not made again unless `force`; a target stops after 5 refusals in a row; verses with no text are left out with a warning; the book's English chapter files are cached for `translation.sourceCacheSeconds` (10 minutes), so a corrected translation reaches a run after that; no `AiUsageLog` rows and no minute meter; overwritten clips are not backed up.
- **Not verified**: the Chirp price (USD 30 per million characters), its 5,000-byte limit and 200 requests a minute, the Gemini TTS model ids, its `maxBytes` (2000) and `rpm` (10, a guess) and its price (unknown) come from third-party summaries. Check them against Google's pages before a long run and correct `config/narration.js`; try one verse in Compare first. Whether each voice speaks Hindi is unchecked. `ffmpeg` is not needed by this code and is not installed on the server.
- **Tests**: `node --test test/narration-admin.test.js` (routes, permissions, schemas, 404 / 409 branches with the row stubbed) and `npm run test:narration` (`scripts/narration-e2e.js`, 53 checks: the processor against real Postgres and Redis with a fake engine and the clips written to a temporary folder, then an API copy on its own port; refuses to run while a worker is connected to the `narration` queue).
- **Production needs** `prisma migrate deploy` for `20261121000000_narration_runs`, a restart of the API and the worker, the admin panel deployed with the API, and `GOOGLE_TTS_API_KEY` (Chirp) and/or `GEMINI_API_KEY` plus optionally `NARRATION_GEMINI_TTS_MODEL` (Gemini TTS) on the server and the worker.
- **Not done**: the app and the website do not play these clips (they would need a chosen voice per book and language, and an export); no page lists the clips of a whole voice; no live engine or bucket has been used.

## Hindu calendar

- **Computing** is pure and database-free: `services/panchang.js` (one day at one place; its header lists the method) and `services/festivals.js` (a year of days and festival rules). Add a festival by adding a row to `FESTIVAL_RULES` (amanta month, paksha, tithi, and the time of day the tithi must be running: sunrise, midday, aparahna, sunset, pradosh, nishita, moonrise). Ekadashi names are by *amanta* month (`EKADASHI_NAMES`), not the purnimanta month north-Indian almanacs print.
- **Storing** is `services/panchang-store.js` (`saveYear`), used by `npm run seed:panchang [year] [place]` and the admin Generate button. `isEdited` rows are never overwritten; a festival's `notify` choice is made once, at creation.
- **Place**: `AppSetting` `panchang.location`; places are `LOCATIONS` in `services/panchang.js`. Generate a year for a place before selecting it.
- **Push**: two jobs on the `notification` queue. `festival.plan` (`jobs/processors/festival-plan.js`) is the only schedule, **04:45 IST** (`tz: 'Asia/Kolkata'`): it asks `dueFestivals` whether any push is due today and, if so, queues `festival.notify` as a delayed job for **05:00 IST** (`jobId festival-notify-<date>`, so planning twice queues once; run after 05:00 it goes at once); a day with nothing due queues nothing. `festival.notify` (`jobs/processors/festival-notify.js`) sends: a festival is **always announced on its own day** ("X today"), and `Festival.notifyDaysBefore` (default `[1]`) adds earlier heads-ups ("X tomorrow"), so an observance is announced the day before *and* on the day unless it is set to `[]`. `notifiedDays` records what has gone, so a rerun never repeats a push. It goes to every user with a push-capable device, dated by the calendar place's today. `npm run test:panchang` covers the day-of push and the planner.
- **Parana (fast-breaking) push**: the morning after an Ekadashi fast, a `PARANA` festival row says when the fast may be broken. `services/parana.js` (pure) is the rule: after sunrise, inside Dvadashi, never in Hari Vasara (the first quarter of Dvadashi). If Hari Vasara ends before Pratahkala (the first fifth of the day) does, the window is `[max(sunrise, Hari Vasara end), min(Pratahkala end, Dvadashi end)]`; otherwise it starts no earlier than the end of Madhyahna (3/5) and ends at Dvadashi's end or Aparahna's (4/5), falling back to `[Hari Vasara end, Dvadashi end]` when that is empty; a Dvadashi that ended before sunrise gives `[sunrise, Pratahkala end]`. `services/festivals.js` makes one `slug: 'parana'` row per distinct fast date (two when Smarta and Vaishnava dates differ) on the day after it, with `details` = `{ekadashi, fastDate, twoDates, alsoFastToday, startsAt, endsAt, hariVasaraEndsAt, dwadashiEndsAt, afterMadhyahna, place, timezone}` and `notifyDaysBefore: []` (`SAME_DAY_KINDS`: parana is pushed that morning only, never "tomorrow"). The wording is `utils/festival-message.js` (pure; `festival-notify.js` calls it): "Fast-breaking time: 5:55 AM to 6:20 AM", times in the reader's language and the calendar place's timezone through `clockTime` (`utils/date.js`), naming the place. **It is built from `details`, not from `description`**, because an admin's PATCH sets `isEdited` for any change (the notify switch too) and would otherwise swap the wording; an edited `description` is therefore not what the push says. Where two dates exist the body is conditional ("If you kept the {0} fast yesterday, break it today…", `paranaBodyIfYesterday`) and, when that day is itself the other fast day, adds `paranaFastToday`, so nobody still fasting is told to break. Notices `paranaTitle`, `paranaBody`, `paranaBodyIfYesterday`, `paranaFastToday` in `utils/messages.js` and all 11 `locales/*.json` (**AI-drafted, not read by a native speaker**). Like every festival push it is one message per app language with no "Hari Bol <name>". Admin, website and app know the kind (`PARANA`, a sunrise-over-horizon glyph, sky blue; `app/assets/calendar/parana.svg`, `FestivalKind.parana`). **Checked** against Drik Panchang's New Delhi pages for 8 windows (within about a minute) and on every 2026 Ekadashi for the rule's invariants (`test/panchang.test.js`, `test/parana-notify.test.js`, `test/messages.test.js`; `node --test` on those three). **Known gaps:** the Vaishnava date of Shravana Putrada 2026 is one day off Drik's (the existing Ekadashi push has the same date), so that Vaishnava parana is not generated; for Padmini the "Smarta" date differs from Drik's single date (the conditional wording covers it); an "after Madhyahna" window can fall in the afternoon; the windows are for the one calendar place only. **Production needs `prisma migrate deploy` for `20261108000000_parana_festival_kind` (adds the enum value), then `npm run seed:panchang` to make the parana rows for 2026 (and 2027 when wanted; rows already there are updated in place with their notify choices kept, and admin-edited rows are skipped), then a restart of the API and the worker.** Not run against a database or a real push.
- **Translation** (admin → Hindu calendar → *Translations* tab): the calendar's words in the 11 app languages other than English (hi mr gu bn ta te kn or pa ml as, `languages` in `config/calendar.js`, the same as Devotee etiquette's), made by an AI run the way Scenes, Translations and Etiquette are, with **the provider and model chosen per run**. Three kinds of word (`KINDS`): a festival's `NAME` (a parana's Ekadashi, `details.ekadashi`, included), a festival's `DESCRIPTION` (**not a parana's**: that one is built for its date from `details`, so it is never asked for), and a panchang `TERM` (`TERM_FIELDS`: tithi, nakshatra, yoga, karana, the two lunar months, sun and moon sign; each goes in the prompt with what it is, because "Mesha" as a rashi and as a sankranti are the same word). **A translation is keyed by (kind, language, sha1 of the trimmed English)** (`sourceKeyOf` in `utils/calendar-translation.js`), not by the row it came from: the same word is translated once however many days and years use it, a new year of generated rows needs nothing translated that already is, and an admin's edit of a festival's English makes the new wording show as missing. Rows: `CalendarTranslation` (the text, `translatedBy`, `runId`, `isEdited`) and `CalendarRun` (like `SceneRun`/`EtiquetteRun`: status, `jobId`, pause reason, resume time, counts, tokens, `force`, provider and model).
  - **The run** is `jobs/processors/calendar.js` on the `calendar` queue (concurrency 1, `attempts: 1`; the row names the only job allowed to work it; `reconcileRuns` every 2 minutes in the worker): `services/calendar-translation.js` collects the words (`collectItems`), takes those with no translation in the language (`itemsToTranslate`; with `force` the ones a run wrote too, **never an `isEdited` row, forced or not**), and asks `batchSize` (40) at a time for `{items:[{ref,text}]}`. Each answer is checked (`checkAnswer`: every ref present, none empty, not far longer than the English, **written in the language's script** — at least half the letters, digits and spaces ignored); a batch that fails is asked again with the problems named, up to `invalidTries` (2), then the run FAILS with the words it could not do (what passed is kept and what the failed asks cost is counted). A refused key, no credit or a missing key pauses it for a person (Resume); a busy provider (429/5xx) pauses and retries by itself (`resumeAt`); one run at a time (an earlier queued or live run holds the later ones back), one live run per language (409). Resume carries on at the first word with no translation. Tokens are on the row and in the token calculator (`services/ai/token-tally.js`) under the provider and model; live progress is the websocket events `calendar.run` / `calendar.activity`, sent to `panchang.translate`. Start-time checks are the Scenes ones: no key → 422 naming the setting, a model that cannot run → 422, a bad language or provider → 400, everything already translated → 409 with `details.upToDate`.
  - **Admin API** `/api/admin/panchang/translation` (`controllers/admin/calendar-translation.js`, `routes/admin/calendar-translation.js`), all behind **`panchang.translate`** (a different permission from `panchang.manage`, which gates the calendar page and editing days and festivals): `GET /overview` (words by kind, coverage by language, the providers with their models and whether each has a key, active runs), `GET /items` (paged; `language`, `kind`, `state` = translated / missing / edited, `q` searches the English and the translation), `PUT /items` (write one by hand: marked `isEdited` and `translatedBy: 'admin'`, so no run replaces it; 404 for a word the calendar does not hold, or one held under another kind), `DELETE /items/:id`, `GET /estimate` (`language`, `force`, `provider`, `model`), `GET`/`POST /runs`, `GET /runs/:id` (the run and its feed), `POST /runs/:id/resume`, `POST /runs/:id/cancel`. Audited as `calendar.run.start|resume|cancel` and `calendar.translation.save|delete`.
  - **What readers get.** `GET /api/app/calendar` and `/calendar/upcoming` take an optional `?language=` (one code; a list or a longer name is a 400); without it the signed-in reader's app language, then the browser's, then English. `wordsFor(chain, days, festivals)` reads the translations in one query and the presenters (`presentDay`, `presentFestival` in `services/panchang-store.js`) use them for `tithi.name`, `nakshatra.name`, `yoga`, `karana`, `month`, `monthPurnimanta`, `sunSign`, `moonSign`, and a festival's `name` and `description` (a parana's description is left as built); **a word with no translation is English**, and dates, times and numbers are the same in every language. The festival push uses the same words (`message()` in `utils/festival-message.js`, called by `festival-notify.js` once per app language): the title around the translated name, the body the translated description (or the name and paksha), and a parana's body the translated Ekadashi with its times. The app does not send `?language=` yet (it follows the account's app language), and was not changed.
  - **Tests**: `node --test test/calendar-translation.test.js` (21: the key, the prompt, the answer checks) and `npm run test:calendar-translation` (`scripts/calendar-translation-e2e.js`, 116 checks, provider faked, local Postgres and Redis, no worker connected; it makes its own festivals and a panchang day in 2031 and removes them, and makes the `panchang.manage` permission only if the database lacks it): the words collected, a run end to end, tokens in the calculator, every way it stops (key, limit, credit, wrong script, a word left out, Cancel), Resume, a forced run keeping an editor's words, the queue, the push wording, and the admin and public APIs including 403/400/404/409/422.
  - **Production needs `prisma migrate deploy` for `20261109000000_calendar_translation`** (the two tables and `panchang.translate`, granted to admin and super_admin by the migration itself; `npm run seed` keeps it in step), **then a restart of the API and the worker** (the worker registers the `calendar` queue), then run the translations from the admin page. **Not done / not checked:** no live provider call has been made, so what a model writes for these words (and what a run costs) is unmeasured; the translations will be AI drafts, not read by a native speaker; the admin page was type-checked and built but not driven in a browser.
- **API**: public `GET /api/app/calendar?from&to&language` (max 62 days) and `/calendar/upcoming?days&language`; admin `/api/admin/panchang` (permission `panchang.manage`) and `/api/admin/panchang/translation` (permission `panchang.translate`).

## Devotee etiquette

- **What it is**: short English guidance for every devotee, one row per item in `Etiquette` (slug, category, title, summary, body, `reference`, `author`, `sourceName`, `sourceUrl`, `status`, `excludedReason`, `isEdited`), one row per language in `EtiquetteTranslation` (`isPublished`, `translatedBy`, `runId`, `isEdited`). `EtiquetteStatus` is `PUBLISHED` (readers see it and it can be the day's push), `DRAFT`, or `EXCLUDED` (kept with `excludedReason`, never shown or pushed — etiquette that would set one deity or faith above another). **A non-published item is a 404 in the app API**, whoever asks. The nine categories and the translation languages are in `config/etiquette.js`; the status list and pure helpers are `utils/etiquette.js`.
- **Seed**: `prisma/seed/etiquette/` (nine category files, `sources.js`, `index.js`) — 95 items, 93 `PUBLISHED` and 2 `EXCLUDED`. The wording is original; each item cites a `reference`, whose teaching it is in `author` (the speaker of the verse, a teacher, a temple or a scripture — never the author of the books we cite, since the app does not show his name yet), and a `sourceName` / `sourceUrl`; the names in `author` and `sourceName` are centralised in `sources.js`. `checkItems` refuses text that names the hidden author (`AppConfig.showAuthorName` is false) and over-long fields (the `LIMITS` there match the columns, `author` included). It is idempotent: a missing item is added, and an item already there keeps its wording, `status` and `isEdited` exactly as they are. The only thing a run writes to an existing row is a blank field (a missing `author`, say: a row made before the column existed), filled from the seed. `npm run seed:etiquette` (`scripts/seed-etiquette.js`), `npm run seed` runs it too, and the admin Maintenance page has a `seed-etiquette` entry. Purity rules were deliberately left out.
- **The daily push**: cron `etiquette.deliver` (`config/cron.js`, queue `notification`, every 15 minutes) → `jobs/processors/etiquette-deliver.js`. A reader gets it when their local time reaches the setting `etiquette.delivery.time` (default `ETIQUETTE_DEFAULT_DELIVERY_TIME`, `07:15`; **it must be a multiple of 15 minutes**, so each reader falls in exactly one run's window). `EtiquetteDay` holds one shared item per date (`dayFor` takes the least recently used, and replaces it if it was un-published since); `EtiquetteDelivery (userId, date)` is unique, so a repeated run cannot send twice. Recipients are users who are not banned and have a `Device` with `app: 'main'`, an `fcmToken` and `isBanned: false`, read in batches of 500. The title is "Hari Bol <first name>" in the reader's *reading* language (see "Server wording in the user's language"), the body is the item's title and summary clipped to 220 characters, the data is `{ deeplink: 'hariharibol://etiquette/<id>', etiquetteId, category }`, the type `NotificationType.ETIQUETTE`. The worker registers the repeatable job at boot (`jobs/schedules.js`), so **a deploy needs the worker restarted**.
- **Translation runs** are built like Scenes and Translations — read those first. The `EtiquetteRun` row is the truth and the BullMQ `etiquette` queue (`attempts: 1`) only works it: `jobs/processors/etiquette.js` + `services/etiquette.js` (`itemsToTranslate`, `itemsForRun`, `saveTranslations`, `coverage`, the feed in Redis `etiquette:feed:<runId>`, `reconcileRuns`). A run translates one language's published items that have no translation (every one with `force`); **a translation an editor wrote by hand is never replaced, with or without `force`**. `batchSize` 8, `invalidTries` 2, `maxTokens` 16,000; a reply that comes back still in English is rejected by the script block of the language. One live run per language. Statuses are `TranslationRunStatus`; out-of-credit or a bad key pauses (Resume), a busy provider retries by itself. Websocket events `etiquette.run` and `etiquette.activity` go to `etiquette.translate`. Saved rows are `isPublished: true` with `translatedBy`. The default provider is `TRANSLATION_PROVIDER` (OpenAI), `provider` and `model` can be chosen when the run is started.
- **API**: app `GET /api/app/etiquette/today`, `GET /api/app/etiquette?category=`, `GET /api/app/etiquette/:id` (all take `languages` for the reader's chain; `today` uses the reader-local date); admin `/api/admin/etiquette` — `overview`, `items` (list, add, get, edit, `status`), `items/:id/translations/:language` (PUT, DELETE), `estimate`, `runs` (list, start, get, `resume`, `cancel`). Permissions **`etiquette.manage`** (items, translations by hand) and **`etiquette.translate`** (estimate and runs). Migration `20261103000000_devotee_etiquette` creates both and grants them to `admin` and `super_admin` itself.
- **Tests**: `node --test test/etiquette.test.js test/messages.test.js` (46 + 14, no database) and `npm run test:etiquette` (`scripts/etiquette-e2e.js`, 114 checks against a real Postgres and Redis, provider not called — it now also covers `author` round-tripping through the admin and app APIs, and the seed filling in a missing `author` on an edited row without touching its other edits). Run the e2e against a scratch database with the AWS and Firebase variables blanked — the dev `.env` points at real AWS.
- **Not done**: no live provider call has been made by a run, no push has left a machine, and the translations (and the server wording in `locales/*.json` for the etiquette push) are AI-drafted.

## Prayers

Stotras, aartis and prayers a reader reads **in their own script**, each verse with a collapsible meaning. **"Prayer" here is not a mantra's opening prayer** (`Mantra.prayerMantraId`, "Opening prayers" above, `PRAYER` in `NotificationType`, the app's `fallback_prayer.dart`): that is a different feature and nothing here touches it.

- **What it is**: `Prayer` (slug, `category`, `sortOrder`, `originalLanguage`, English `title` / `summary` / `about`, `author`, `reference`, `sourceName` / `sourceUrl`, `status`), `PrayerVerse` (`position`, the original `text` in its own script with a line break per line, the English `meaning`, `textChangedAt`) and, per language, `PrayerTranslation` (title, summary, about) and `PrayerVerseTranslation` (the verse's `text` in that language's script, and its `meaning`). Both translation tables carry `translatedBy`, `runId` and `isEdited`. `PrayerStatus` is `PUBLISHED` or `DRAFT`; **a draft is a 404 in the app API**, whoever asks, and is never translated. The eight categories (`morning`, `evening`, `meals`, `guru`, `deity`, `aarti`, `peace`, `other`), the twelve `ORIGINAL_LANGUAGES` and every number a run uses are in `config/prayer.js`; the pure rules are `utils/prayer.js`. **No seed**: no prayer ships with the code, an admin enters them (admin → Prayers).
- **Which script a reader gets, and how it is made** (`howText(original, target)` in `config/prayer.js`; **the server decides and tells the app, the app never derives it**):
  - `same` — the reader's script is the original's (`sa`, `hi`, `mr` are one script; `bn`, `as` another). Nothing is stored.
  - `rule` — the original is Devanagari and the target is one of `RULE_TARGETS` (`bn as gu te kn or pa ml`): the phone converts it at read time with `fromDevanagari` (`utils/script.js`, and the app's copy of it). Nothing is stored.
  - `model` — everything else: **English (Roman letters) and Tamil from Devanagari, and any non-Devanagari original into another script**. A run writes it and it is stored as the verse's `PrayerVerseTranslation.text` (`'en'` holds the Roman rendering only; English prose is the `Prayer` row itself, so `'en'` has no `PrayerTranslation` row and no meaning row). Tamil is left to the model because it has one letter for ka / kha / ga / gha, so the rule would merge them.
  - **A rendering goes stale** when the verse's text changes: `textChangedAt` is bumped only then (a meaning-only edit does not, and changing `originalLanguage` stamps every verse), and a stored rendering whose `renderedAt` is older, and that no person wrote, is asked for again. A hand-written rendering or meaning (`isEdited`) is never replaced by a run.
- **Translation runs** are built like Etiquette, Scenes and Translations — read those first. The `PrayerRun` row is the truth and the BullMQ `prayer` queue (`attempts: 1`, one run at a time) only works it: `jobs/processors/prayer.js` + `services/prayer.js` (`prayersToTranslate`, `prayersForRun`, `saveHeader`, `saveVerses`, `coverage`, `reconcileRuns`, the activity feed in Redis `prayer:feed:<runId>`). **`needsOf` in `utils/prayer.js` is the one place that decides what a prayer still needs in a language, and `coverage()` mirrors it in SQL — change both together** (the e2e checks that they agree).
  - For each prayer (in `sortOrder`, `createdAt`, `id` order) a run makes a **header request** (title, plus summary and about when the English has them; never for `'en'`) and then **slices of 12 verses** (`sliceVerses`), asking for the rendering only where `howText` is `model` and for the meaning wherever the English one is filled. Each answer is checked before anything is saved (`checkHeader`, `checkAnswer`): the title or piece empty, a verse missing or repeated, a rendering with a different number of lines from its verse, text not written in the language's script (a Roman rendering must be Latin letters, not Indic). **Only the pieces that pass are kept**, a failed one is asked for again up to `invalidTries` (2) with what was wrong, and then the run stops on it (FAILED, Resume works). A prayer may have `maxVerses` (400) at most.
  - **A run never writes over a person's words** and never touches a draft. One live run per language; a start with nothing to do is 409 `{ upToDate: true }`. Statuses are `TranslationRunStatus`; out-of-credit, a bad key or a missing one pauses for a person (Resume), a busy provider retries by itself, exactly as in "Translation runs". Cancel on a RUNNING run that is not stalled only sets `cancelRequested` (it stops after the request in progress); a queued, paused or stalled run is cancelled at once and its job dropped. Every request is counted in the token calculator (`services/ai/token-tally.js`). The default provider is `TRANSLATION_PROVIDER` (OpenAI); `provider` and `model` can be chosen when a run is started, and a provider with no key or a model that cannot run is a 422. **A run never uses OpenAI's free models**, like every book translation.
  - Websocket events `prayer.run` (the whole presented run) and `prayer.activity` (one feed line) go to roles with `prayer.translate`.
- **API**: app `GET /api/app/prayers` (the published prayers with their title and summary in the reader's chain, no verses, and only the categories that have any) and `GET /api/app/prayers/:id` (the prayer in full: `scripts` — first `original` with the languages that read it as written, then one entry per `rule` language, and one per `model` language **only when every verse has a rendering in it** (a half-written script is not offered) — and the verses, each with `text`, `meaning` and every stored rendering, a hand-written one for a `rule` language included: the phone shows it in place of the rule's output); both take `languages` and need a signed-in reader (a signed-out call is 403). Admin `/api/admin/prayers`, 17 routes: **`prayer.manage`** — `overview`, `items` (list, add), `items/:id` (get, edit, delete), `items/:id/verses` (PUT: the whole ordered list, with stable ids, so a translation never loses its verse), `items/:id/status`, `items/:id/translations/:language` (get, PUT, DELETE: by hand); **`prayer.translate`** — `estimate`, `runs` (list, start), `runs/:id`, `runs/:id/resume`, `runs/:id/cancel`. Audit actions `prayer.create`, `.update`, `.verses`, `.status`, `.delete`, `.translation.save`, `.translation.delete`, `.run.start`, `.run.resume`, `.run.cancel`. Migration `20261114000000_prayers` creates both permissions and grants them to `admin` and `super_admin` itself.
- **Tests**: `node --test test/prayer.test.js` (68, no database; `test/strict-schemas.test.js` also holds the prayer schemas) and `npm run test:prayer` (`scripts/prayer-e2e.js`, 153 checks, passing; real local Postgres and Redis, **the provider faked**: what a run would do, a run into Hindi, Tamil, Roman English and Telugu, nothing asked twice, hand edits kept, a stale rendering, slicing, the page's counts against `needsOf`, the queue order, every way a run can stop, the admin API and the app API, and a run started through the API). Run it with `FIREBASE_PROJECT_ID= FIREBASE_CLIENT_EMAIL= FIREBASE_PRIVATE_KEY= GOOGLE_SERVICE_ACCOUNT_PATH= AWS_ACCESS_KEY_ID= AWS_SECRET_ACCESS_KEY=` in front (the dev `.env` points at real AWS) and **with no worker connected**, or the real worker would take its runs. It makes its own prayers (slug prefix `e2e-`) and removes them. Its "page's counts agree with what a run would do" section is what caught `coverage()` reading `'\S'` in a tagged SQL template as the letter S — keep that check when `needsOf` or `coverage()` changes.
- **Production needs `prisma migrate deploy` for `20261114000000_prayers`, a restart of the API and the worker (the worker registers the `prayer` queue and its reconcile timer at boot), and the admin panel deployed with the API.** Release the API before the app: an app that asks for `/prayers` an older API does not have gets a 404 (it shows its ordinary "could not load" state). No seed.
- **Texts to start from (not imported)**: `npm run fetch:prayers` (`scripts/fetch-prayers.js`, the list in `scripts/lib/prayer-catalogue.js`) fetches 53 originals — Vaiṣṇava songs from kksongs.org, the rest from Sanskrit Wikisource — into `public/prayers/json/<slug>.json` in the `Prayer` / `PrayerVerse` shape, and writes `public/prayers/PRAYERS.md` (the list, 10 still wanted with no free source, 1 excluded for copyright, every correction made to a page). Nothing reads them yet: there is no import, they are not in the database or on S3, every `meaning` is null, and no one who reads the scripts has checked them. A file's `roman` is kksongs' Roman (IAST but with ṁ for the anusvāra) and is null for the Wikisource ones; a Bengali song's `devanagari` copy has no column. See `scripts/README.md`.
- **Not done / not checked**: no run has called a real provider and nothing has run on a phone, so the translations and transliterations are AI-drafted and not read by anyone who reads the script; **the Roman style (IAST) and the Tamil convention are the owner's to confirm** (the prompt names them: `utils/prayer.js`, `userPrompt`); the admin page has no tests of its own (it type-checks and builds).
- See [admin/CLAUDE.md](../admin/CLAUDE.md) "Prayers page and its translations" and [app/CLAUDE.md](../app/CLAUDE.md) "Prayers".
## Quotes (the chanting page)

- **What it is**: short quotations shown on the chanting page in place of the deity picture and the mala (the app's *Deity | Quotes* switch, see "The quotes on the chanting page" in [app/CLAUDE.md](../app/CLAUDE.md)). One row per quote in `Quote` (slug, `text` ≤ 1000, `author`, `reference`, `sourceName`, `sourceUrl`, `status` PUBLISHED / DRAFT / EXCLUDED — the etiquette enum —, `excludedReason`, `isEdited`, `sortOrder`), its translations in `QuoteTranslation` (one `text` per language, `translatedBy`, `runId`, `isEdited`, `isPublished`), and the translation runs in `QuoteRun` (the `EtiquetteRun` columns). Built as a copy of devotee etiquette without the days and pushes: read that section for the run model.
- **The author is always stored.** Whether the app draws it is `AppConfig.showQuoteAuthor` (false), the quote twin of `showAuthorName`; the data never decides.
- **Seed**: `prisma/seed/quotes/` (`quotes.js`, `index.js`) — 54 quotes, 30 of them purport sentences and 24 verse translations, all from vedabase.io. **Every `text` was checked by machine to be a verbatim stretch of the page `sourceUrl` names** when the file was made; add a quote only the same way, from its page and never from memory. A translation's `author` reads "Śrī Kṛṣṇa, as translated by …" (the speaker), a purport's is the teacher. `checkQuotes` refuses a missing field, an over-long field (text ≤ 400 for a chanting screen), a duplicate and a non-https link. Idempotent: a missing quote is added, and a quote already there keeps its wording, `status` and `isEdited`; only a blank field is filled from the seed. `npm run seed:quotes` (`scripts/seed-quotes.js`); `npm run seed` runs it; the admin Maintenance page has `seed-quotes`. **Not included: lecture and letter quotes** (their exact wording could not be checked against a page).
- **Translation runs**: `jobs/processors/quote.js` on the `quote` queue (`attempts: 1`, concurrency 1, `reconcileRuns` every 2 minutes in the worker), websocket `quote.run` / `quote.activity` to `quote.translate`, `services/quote.js`, pure rules in `utils/quote.js` (prompt, schema, `checkAnswer`: every quote returned, non-empty, in the language's script). Twenty quotes go in a request (`config/quote.js`). A translation an editor wrote is never replaced.
- **API**: admin `/api/admin/quotes` (overview, items CRUD, status, hand translations, estimate, runs) behind `quote.manage` and `quote.translate` (both granted to admin and super_admin by the migration); app `GET /api/app/quotes?languages=` returns **every published quote** in the reader's reading chain plus a `version` (count, newest update, chain) so the app can keep its copy.
- **Tests**: `node --test test/quote.test.js` (7, no database). **No e2e walk was written and nothing was run against a database or a live provider.**
- **Production needs `prisma migrate deploy` for `20261119000000_quotes`, a restart of the API and the worker, then `npm run seed:quotes`.**

## Rich pushes (admin Notifications page)

The three admin sends (`POST /api/admin/notifications/audience|topic|user/:id`) take optional `image` (an uploaded key — kind `pushImage`, committed and signed — or an `https://` link), `style` (`auto|picture|text`), `importance` (`urgent|quiet`), `link` (a tap target: one of `TARGETS` in `utils/push-rich.js`, written `hariharibol://<word>?…`) and `actions` (≤ 2 buttons, each with its own link). `GET /api/admin/notifications/options` lists the targets. `utils/push-rich.js` validates and builds the data (`deeplink`, the verse's place in the daily sloka's own keys, `style`, `importance`, `actions` as JSON); `utils/push-message.js` builds the FCM message: a normal notification message with `imageUrl` (Android) and `apns.fcmOptions.imageUrl` + `mutable-content` (iOS service extension), the Android channel `default` or `updates` and priority from importance; **with buttons Android gets data only** (title/body/image in `data`) because FCM cannot draw buttons, and iOS gets an alert the extension adds buttons to. No schema change: the extras live in the push's `data`, so they show in the notification detail, and analytics (`pushId`) are untouched. `node --test test/push-rich.test.js`. A laptop's `http://localhost` picture link is sent without a picture. Not run against Firebase.

## Push analytics (sent → delivered → opened → read)

Every push belongs to a `PushCampaign` (`services/push-campaign.js`): one row per message however many people got it. `notify.toUser/toUsers/toTopic` make or find it (`campaign` option; senders that name none share one per type per day) and put its id in the push data as `pushId`. The server counts `sentDevices` / `failedDevices` from FCM's answer (topic sends: the mirrored subscriber count). The app reports `DELIVERED`, `OPENED` and `ENGAGED` (with `durationMs` and the screen) to `POST /api/app/notifications/events`; one `PushEvent` per device per kind, a longer stay replaces a shorter one. Admin: `GET /api/admin/notifications/campaigns` and `/campaigns/:id` (funnel, stay buckets, platforms; `minSeconds`, default 10, is what counts as "read"). **Delivered is a floor:** a notification the OS draws while the app is closed runs no app code, so only its tap shows; a tap counts as delivered. Reporting phones only — older app builds report nothing. Production needs `prisma migrate deploy` for `20261029000000_push_analytics`. `node --test test/push-campaign.test.js`; the SQL and endpoints have not been run against a database.

## Maintenance commands

The admin **Maintenance** page (`system.maintenance`, super admin only — `admin` does not carry it) runs scripts from the fixed list in `config/maintenance.js` (`seed`, `seed:panchang`, `recount:books` …) through `services/maintenance.js`: `npm run <script>` spawned in the API container, one at a time, killed after 15 minutes, output kept in memory (256 KB) and polled by the page every second. It is not a shell — the request names an id from the list. Every start and finish is an `AuditLog` row (`maintenance.start` / `maintenance.finish`). Output is per API process, so with several API containers each has its own run. `prisma migrate` is not on the list: the production image installs without dev dependencies. Production needs `npm run seed` once after this ships (adds the permission).

## Finance (super admin only)

`services/finance.js`, `controllers/admin/finance.js`, `routes/admin/finance.js` (`/api/admin/finance/*`), permission **`finance.manage`** — held by `super_admin` alone (the `admin` role is excluded in `config/constants.js`; migration `20261101000100_finance` grants it to `super_admin` itself, so the deploy is enough and the seed need not be run). Everything is INR; money is paise.

- **Revenue** is read from `Payment` by `paidAt`, in IST calendar months: `grossInrMinor`, `commissionInrMinor`, `netInrMinor` (written by the store-payments code). A free trial is a row of zeros (`isTrial`), so it adds nothing and is only counted. A refund comes off the month it was *refunded* in (`refundedAt`), not the month it was paid. Payments whose INR columns are still null (FX lookup pending) are counted and flagged, not summed.
- **AI cost** is read from `AiUsageLog.costMicros` (US dollars) and converted at `finance.usd_inr_rate` (AppSetting, default 88, set from the Finance page). Grouped by `operation` prefix: `chat*` Ask Sakha, `translation*`, `scenes*`, image/picture/background, the rest "Verses and other AI". **Confirming a month fixes the rate it was converted at** (`FinanceMonth.usdInrRate`); reopening clears it.
- **Manual lines** are `FinanceEntry` (CREDIT/DEBIT, category advertising / purchase / salary / tools / other, amount in paise, an IST date, a note), added any day. Profit = net revenue + credits − AI − debits.
- **Month end:** the worker job `finance.remind` (09:00 IST, `config/cron.js`, `jobs/processors/finance-remind.js`) pushes (`SYSTEM` notification) and emails (`views/emails/finance-reminder.ejs`) every super admin once a day on the last two days of a month and the first seven days of the next, until `FinanceMonth.costsConfirmedAt` is set. The admin panel banner (`GET /finance/pending`) stays until it is confirmed.
- `npm run test:finance` (43 checks, needs the API; fakes the date for the reminder). **Production needs `prisma migrate deploy` for `20261101000100_finance`; nothing else.**

## Support, feedback and the store-rating prompt

`SupportTicket` (kind `TICKET` or `FEEDBACK`, category from `CATEGORIES` in `services/support.js` (bug, payment, account, content, feature, translation, suggestion, other), status `OPEN`/`IN_PROGRESS`/`RESOLVED`, optional 1–5 `rating`, `screenshotKey`, `deviceInfo` JSON the app attaches, `details` JSON (below), `userUnread`) with its conversation in `SupportMessage`, and `ReviewPrompt` (each time the app showed or declined the store's rating sheet). Reader side `routes/app/support.js` + `controllers/app/support.js` (`/api/app/support/...`: `tickets`, `tickets/:id`, `tickets/:id/messages`, `media`, `unread`, `review-check`, `review-prompts`); desk side `routes/admin/support.js` + `controllers/admin/support.js` under permission **`support.manage`** (migration `20261102000000_support_feedback` grants it to `admin` and `super_admin`; `config/constants.js` lists it for new databases).

- **A staff reply** saves the message, sets `userUnread`, moves OPEN to IN_PROGRESS, and pushes the reader through `notify.toUser` (`NotificationType.SUPPORT`, deeplink `hariharibol://ticket?id=…`). A reader's follow-up on a RESOLVED ticket reopens it. 10 tickets a day per reader.
- **Feature and translation requests** are tickets with a topic. A `translation` ticket must carry `details: {bookSlug, languageCode}`; `translationDetails` (`controllers/app/support.js`) checks the book is in the library and the language is one the app reads, and stores both names (`bookTitle`, `languageName`) beside them so the desk needs no join. Anything else is a 400. Its note is optional. Every other ticket needs a message, and feedback needs its rating.
- **Live replies** (`services/websocket.js` EVENTS): `support.reply` to the reader on a staff reply and `support.updated` to the reader on a status change (both `toUser`); `support.inbox` to every `support.manage` holder (`toPermission`) with `change` of `new` (reader opens a ticket), `reader` (follow-up), `staff` (reply) or `status`. The FCM push still goes out with each staff reply (`type: 'SUPPORT'`, deeplink), so a backgrounded reader is told; the socket is for an open screen.
- **Screenshots** go up first (`POST /support/media`, body is the file, JPEG/PNG/WebP up to 5 MB, judged from bytes, S3 prefix `support/images`), then the ticket names the key.
- **Asking for a store rating** (`services/support.js` `reviewCheck`): only after `STREAK_DAYS` (7) consecutive days with a round chanted (`trigger=streak`) or, for `session`, once the reader has five chanting days; never within `PROMPT_GAP_DAYS` (90) of a `SHOWN`/`LIKED`/`UNHAPPY` prompt, never within 60 days of writing in, never after feedback of 3 stars or less in the last 180 days. A `DISMISSED` pre-prompt is logged but does not start the quiet period. The app keeps its own 90-day local gate in front of this.
- `npm run test:support` walks it (needs the API, a database and Redis): 44 checks, all passing, including the sockets (a Redis subscriber sees each `support.reply`, `support.updated` and `support.inbox` go to the right person or permission and to no one else). The provider is not involved. Production needs `prisma migrate deploy` for `20261102000000_support_feedback` (if not yet applied) and `20261120000000_support_requests` (adds `SupportTicket.details`; nullable, so existing tickets are unchanged).

## Developer companion (the owner's app: live feed, alerts, chat)

The Flutter app in `dev_app/` is for the owner. It signs in through the same Google endpoint as everyone, and
every route it calls checks the **`dev.access`** permission (`routes/admin/dev.js`): the super admin has it
(migration `20261102000000_dev_companion` grants it), the **admin role does not** unless a role is given it,
and the websocket refuses `?app=dev` without it (close code 4003). `POST /auth/social` with `app: 'dev'` signs in only an *existing* account that holds `dev.access` (403 otherwise) and never creates a reader account — that branch is not covered by `test:dev-companion` (it needs a real Google token). The ticket tab also needs `support.manage`.

| Piece | Where |
|---|---|
| Models | `DevEvent` (the feed, 30 days), `DevConversation` (one per reader, unread counts both ways), `DevMessage`; `Device.app` (`main` or `dev`) |
| Producing events | `services/dev-events.js` `emit(type, {...})` — fire and forget, never throws, queues a job on the `devops` queue, per-process burst limit. Called from sign-up (`controllers/app/auth.js`), new ticket / feedback / ticket reply (`controllers/app/support.js`), chat messages (`services/dev-chat.js`) |
| Errors | The error handler calls `recordError()`: counted **in memory** and flushed every 15 s as one job. The worker raises `error.new` once per signature a day and `error.spike` (critical) at 20 5xx in 5 minutes |
| Health | `devops.health` every 2 min: database speed, queue backlog and failed jobs → `health.alert` (critical, once per 30 min per cause) |
| The worker | `jobs/processors/devops.js`: stores the event, publishes `dev.event` to every socket holding `dev.access`, then `services/dev-push.js` decides about a push. Tunables in `config/devops.js` |
| Chat | `services/dev-chat.js`; reader side `/api/app/developer-chat` (get / messages / unread / read), developer side `/api/admin/dev/conversations…`. Both ends get `dev.chat.message` over the socket |
| API | `/api/admin/dev/summary`, `/feed`, `/conversations`, `/users?q=`, `/prefs` |

**Pushes to the owner are rationed** (`services/dev-push.js`): none while the app says it is in the foreground
(it sends `{type:'ping', foreground}` every 30 s; the websocket container keeps `dev:fg:<user>` for 75 s); critical
events push at once from their own allowance (6 an hour); a reader's chat message pushes at most once per
conversation per 2 minutes; everything else waits in a list and leaves as **one digest push** ("3 new sign-ups,
1 new ticket") no sooner than 15 minutes after the last push; 8 pushes an hour in all. The owner can mute types
in the app (`/api/admin/dev/prefs`, kept in Redis). A push for the reader (`developer replied`) is limited to one
per conversation per 5 minutes. `fcm.sendToUser` now takes an `app` (`main` by default), so a reader's pushes never
reach the companion app and the other way round. The dev app registers its token with `POST /api/app/devices`
and `app: 'dev'`.

**Production needs** `prisma migrate deploy` for `20261102000000_dev_companion` and a restart of the API, the
worker and the websocket container (the worker owns the new `devops` queue and its three schedules).
`npm run test:dev-companion` walks it (31 checks; needs the API, worker and websocket running, Postgres and Redis).
Not run against Firebase: no push has left a machine.

## Marketing (email campaigns)

Bulk email to readers and invitees, run from the admin **Marketing** page. Design: `marketting-plan.md`. Permissions
`marketing.read` / `.manage` / `.send` (`send` is the super admin only, so the admin role can prepare but not reach people).

- **Run pattern = Etiquette's.** A `MarketingCampaign` row is the truth; the BullMQ `marketing` queue job only works it
  (`jobs/processors/marketing.js`, concurrency 1, `attempts: 1`, heartbeat, `cancelRequested` / `pauseRequested`, reconcile
  timer). Websocket `marketing.run` / `marketing.activity` go to `marketing.read`. `marketing.tick` (every minute) starts
  scheduled campaigns. Totals are recounted from the delivery rows (`recount()` in `services/marketing-run.js`).
- **No double sends.** One `MarketingDelivery` per campaign and reader/invitee (unique); a send claims PENDING→SENDING
  before SMTP; a SENDING row left by a dead worker becomes FAILED "Interrupted" and is never retried blindly.
- **Content** is blocks (`utils/marketing-blocks.js`), merge fields `{{name|fallback}}`, rendered to table HTML + text with
  every value escaped (`services/marketing-render.js`). A reader gets the first APPROVED variant in their reading-language
  chain, else English. AI drafts/translations (`services/marketing-ai.js`) are drafts until a person approves them.
  Sakha profile keywords and chat text never enter marketing context.
- **Consent.** Opt-out and the weekly cap are checked at send time; unsubscribe is `/unsubscribe/<code>` on the site and the
  one-click header; suppression keeps an HMAC of the address (key from `JWT_SECRET`), not the address. Invitees need an
  attestation on import (`MarketingConsentLog`).
- **Tracking.** Links are `/l/<code>/<n>` on the website (`website/src/app/l`), which asks `GET /api/web/marketing/click/…`
  and redirects; scanners are stored but flagged. The open pixel is approximate. Attribution (`MarketingAttribution`):
  click, sign-up (invitees matched by address after sign-in), app open and Play install referrer (`/get-app?mkt=<code>`).
- **Self-protection.** Hard-bounce > 2% or complaints > 0.1% over the last 500 sends (judged after 100) pauses the run;
  daily cap (IST midnight), weekly cap per reader; `AI_PER_USER` has a cost cap and a 5-recipient sample to approve first.
  Bounces/complaints come in through the SES SNS webhook (`/api/webhooks/marketing-email`, signature and own topic ARN
  checked) or a shared secret.
- Settings: `marketing.*` (rate, daily cap, weekly cap, from name, reply-to, **postal address — required to start**, AI max cost).
- **Also changed:** `services/setting.js getNumber` returned 0 for a setting that was never set (it now returns the fallback);
  `services/sadhana-stats.js` holds the streak and favourite-mantra logic moved out of `controllers/app/sadhana.js`.

**Tested:** `node --test test/marketing-*.test.js` (33) and `npm run test:marketing` (37 checks over HTTP with a fake mail
server; needs Postgres, Redis, migrations and `npm run seed`). **Not done / not run:** no real SES send, no real SNS message,
no live AI call (provider faked), WhatsApp (Phase 3: tables exist, nothing sends) and the Flutter app (Phase 4: preferences
screen, app-open / install attribution calls), `GET/PATCH /api/app/marketing/preferences`, `POST /open` and `/install` exist
but no app calls them. **Production needs** `prisma migrate deploy` for `20261116000000_marketing`,
`20261117000000_marketing_whatsapp`, `20261118000000_marketing_run_state`, a restart of the API and the worker, the
`MARKETING_*` values above, SES verified-domain + configuration set + SNS topic, and the postal address setting.
