# Marketing: bulk email + WhatsApp campaigns (backend + admin panel)

## Context

HariHariBol has no way to reach people outside push notifications. The mailer sends one OTP at a time over SMTP, the admin push composer runs inside the HTTP request, `User` stores no phone number or marketing consent, share-link clicks are a bare counter, and the admin panel has no rich-content editor. The goal is a **Marketing** area that:

- sends **bulk email** and **WhatsApp** (Meta's official Cloud API directly, no BSP) to **existing users** (personalised from their activity, in their *reading language*) and to **external invitees** (one template to a list);
- lets an admin **draft templates with AI**, choosing provider and model, and review them before anything is sent;
- puts **trackable deep links** in every message: a tap is recorded, opens the app if installed or the right store if not, and the person's later activity is visible;
- looks and behaves like the rest of the admin panel.

### Decisions already made (from the user)

| Topic | Decision |
|---|---|
| Email delivery | Amazon SES in `ap-south-1`, used through its SMTP interface (no SDK). Production access case is open with AWS. Bounces and complaints come back through an SES configuration set and SNS, plus SMTP replies at send time. The mailer stays provider-neutral (any SMTP works). |
| Existing users' email consent | On by default, one-tap unsubscribe, a toggle in the app. |
| WhatsApp numbers for existing users | In-app opt-in screen with verification. |
| Order | Email first, then WhatsApp. App changes last. |

### Constraints found in the code (shape the design)

- `services/mailer.js` is one-message-at-a-time and must stay untouched for OTPs; marketing gets its own pooled transport (separate sender reputation).
- No `phone`, consent, unsubscribe, bounce or suppression anywhere; `User.email` can be a legacy placeholder (`@legacy.invalid`, `utils/legacy.js isPlaceholderEmail`) or an Apple relay address.
- The right queued shape is the **Run pattern** (`EtiquetteRun`, `jobs/processors/etiquette.js`, `services/etiquette.js`, websocket `*.run` / `*.activity`), not `broadcastAudience`, which is synchronous and capped at 50,000.
- Per-run provider and model: `scripts/lib/translate-providers.js` (`providerChoices`, `whyNotUsable`, `createAsk`) embedded as `providers` in an `/overview` response, shown by `admin/src/components/model-picker.tsx`. `createAsk` bypasses the OpenAI free-tier chain and does **not** write `AiUsageLog`.
- Deep links today: `hariharibol.com/shloka|naam|darshan|satsang/<code>` are Next.js pages; the grammar lives in three files that change together (`backend/utils/share.js`, `website/src/lib/share-link.ts`, `app/lib/core/share_links.dart`). No per-click row, no deferred deep linking, and the Dart parser drops every query parameter except `path`.
- Sakha rule: `SakhaProfile.keywords` and chat text never go into any prompt. Marketing context uses sadhana and reading data only.
- Admin has **no** rich-text editor, iframe preview, CSV parser or segment filters (Users list filters only role, premium, banned).

## Design

### 1. Content: block templates, per-language variants

- A **template** (`MarketingTemplate`, channel EMAIL or WHATSAPP) has one **variant per language** (`MarketingTemplateVariant`: language, subject, preheader, `blocks` JSON, `status` DRAFT or APPROVED, `source` AI or HUMAN, `editedByHuman`).
- Email body = ordered **blocks** (`heading`, `paragraph`, `verse`, `button`, `image`, `divider`, `spacer`). No raw HTML, no new editor dependency: a block list editor copies `admin/src/components/prayer-verses-editor.tsx` (move up/down, remove, add). One server renderer (`services/marketing-render.js`) turns blocks into table-based inline-styled HTML plus a plain-text part, inside a fixed layout (`views/emails/marketing-layout.ejs`: logo, footer with unsubscribe and postal address). The same JSON is the AI's output schema, so AI output is validated, escaped and cannot inject markup.
- **Merge fields** (allow-listed, validated on save, with fallbacks `{{favoriteMantra|your mantra}}`): `greeting` (via `hariBol(name, chain)` in `utils/messages.js`, "Hari Bol Somesh"), `firstName`, `favoriteMantra`, `avgRounds`, `streak`, `daysSinceChant`, `lastBook`, `versesRead`, `plan`.
- Language pick per recipient: `readingChain(user)` from `utils/language.js` (`[readingLanguage, appLanguage, 'en']`). **Only APPROVED variants are sent**; a reader whose language has none gets English. The Review step shows "N readers get English because Marathi is not approved".
- Footer, unsubscribe page and consent wording are server notices: add ids to `NOTICES` in `utils/messages.js` and all 11 `backend/locales/*.json` (`test/messages.test.js` enforces parity). AI-drafted, not native-reviewed.

### 2. Personalisation for existing users

`services/marketing-context.js` builds a small **context card** per user in batches (never one query per user):

- `UserPreferenceProfile.avgRoundsPerDay / chantConsistency / preferredBookNumber` (one `findMany … in`)
- favourite mantra: `chantSession.groupBy([userId, mantraId])` over 60 days, falling back to `SadhanaProfile.preferredMantraId / legacyFavoriteMantra`
- streak: `sadhanaDay` with `roundsCompleted>0`, last 60 days, counted in JS
- reading: latest `ReadingProgress` plus summed `versesRead`
- plan from `Subscription`, `isPremium`, days since `lastActiveAt` / joined

The card is ~60 tokens, e.g. `{firstName, lang, favoriteMantra, avgRoundsPerDay, streakDays, daysSinceLastChant, lastBook, plan}`. Move `favouriteMantra` and `currentStreak` out of `controllers/app/sadhana.js` into `services/sadhana-stats.js` and have the controller import them (small refactor; existing `test:sadhana` must still pass).

Two personalisation modes on a campaign:
1. **MERGE** (default, free): template + merge fields, rendered at send time.
2. **AI_PER_USER**: the template is a brief. The model writes each person's copy from their context card, in their reading language, using the chosen provider and model. Safeguards: an admin must approve a 5-recipient sample first; cost is estimated before start; a `maxCostUsd` cap pauses the run when reached; each result is stored on the delivery row (`aiBlocks`) so it can be audited. Falls back to MERGE for that person if the model's answer fails validation.

### 3. AI template drafting (provider and model choice)

- `services/marketing-ai.js`: `draftTemplate`, `translateVariant`, `writePersonal`, all on `createAsk`. Prompt carries the project's content rules (devotional tone, no non-devotee commentary, no medical or financial promises, no pressure or fake urgency, allowed merge fields, length limits per channel).
- `GET /api/admin/marketing/overview` returns `providers: providerChoices({apiKey, model})`; the panel reuses `ModelPicker`. Start/generate returns **422** for a missing key or an unusable model (same wording as `controllers/admin/etiquette.js start`).
- Generation is **one language per request** (synchronous, a few seconds); "Translate to all" loops over languages in the panel with per-language progress, so no new run type. Regenerating a variant with `editedByHuman` asks for confirmation (hand-written words are never silently replaced, as elsewhere in the panel).
- Tokens and cost: on the template/campaign row, `tally.record(...)`, and an `AiUsageLog` row (`operation: marketing.*`) for GEMINI/OPENAI calls so Finance's AI-cost line sees it (mirror whatever the Etiquette run does for Anthropic; `AiProvider` has no ANTHROPIC value).

### 4. Audiences

- **Existing users**: `MarketingSegment` (saved filter JSON). `services/marketing-audience.js` turns a filter into a Prisma `where` and a count. Filters (new, none exist): reading/app language, country/state, plan or donor, signed-up window, last-active within / lapsed N days, chanted in last N days or never, streak ≥ N, favourite mantra, book read, platform (`Device.platform`). Always excluded: banned, placeholder emails, unsubscribed, suppressed, weekly-capped.
- **External**: `MarketingList` + `MarketingContact` (+ `MarketingListMember`), imported by CSV (admin parses client-side with a small `parseCsv` added to `admin/src/lib/csv.ts`; server dry-run then commit in chunks, reporting invalid, duplicate, already-a-user, suppressed). Email is normalised with `inbox()` from `utils/share.js`; phones to E.164. Each import needs a **consent attestation** (checkbox + note) stored with the rows. **WhatsApp contacts without a recorded opt-in are refused** (Meta policy).
- At start the worker **materialises** the audience into `MarketingDelivery` rows (cursor paging 500). That gives exact counts, idempotency (`@@unique([campaignId, userId])`, `@@unique([campaignId, contactId])`) and resume.
- `holdoutPercent` is **not** in this plan; add later if uplift measurement is wanted.

### 5. Consent, unsubscribe, suppression

- `MarketingPreference` (per user, lazily created; no row = email on, WhatsApp off): `emailEnabled`, WhatsApp phone, `whatsappVerifiedAt / OptInAt / OptOutAt`. Cascades on account deletion.
- `MarketingSuppression` (channel, **HMAC hash of the address**, reason UNSUBSCRIBE / HARD_BOUNCE / COMPLAINT / MANUAL / WHATSAPP_STOP): survives account deletion without keeping the address. Checked at materialise **and** at send time.
- `MarketingConsentLog`: every opt-in/out with source, wording version, time.
- Every email: `List-Unsubscribe` (https + mailto), `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, `Precedence: bulk`, footer link. Public API `POST /api/web/marketing/unsubscribe/:code` (one-click, honoured immediately) plus a website `unsubscribe/[code]` page with a resubscribe option.
- Frequency cap: `marketing.weekly_cap` (default 2 per channel per rolling 7 days), skip reason CAP.
- Privacy page (`backend/views/pages/privacy.ejs`) gets a marketing section (email, WhatsApp, open/click tracking); the account-deletion page lists what is purged.

### 6. Tracked links and attribution

- `MarketingLink` (per campaign: index, kind WEB or APP, target, label) + `MarketingDelivery.code` (opaque, unique). A recipient link is `https://hariharibol.com/l/<deliveryCode>/<n>` (no per-link-per-user rows).
- Website route handler `website/src/app/l/[code]/[n]/route.ts` calls `GET /api/web/marketing/click/:code/:n`, which records a `MarketingClick` (marks scanners and prefetchers with `isBot`; ignores HEAD) and answers `{url}`; the handler 302s. No nginx change.
- Destination handling: WEB links redirect with `utm_*`. APP links (picked with `admin/src/components/push-link-field.tsx`, the same destinations push uses, plus a new `webPathFor(target)` in `backend/utils/push-rich.js`) go to the existing `get-app` logic: store by user agent, Play URL carrying `referrer=utm_source%3Dmkt%26utm_content%3D<code>`.
- If the app is installed and `/l/*` is an App Link / Universal Link (add to the association files in `backend/deeplink/` and the Android intent filter), the app opens the URL itself, calls `POST /api/app/marketing/open {code, n}`, records the in-app open against the signed-in user and navigates. (Phase 4.)
- `MarketingAttribution` (userId, campaignId, deliveryId?, kind CLICK / APP_OPEN / INSTALL_REFERRER / SIGNUP_EMAIL_MATCH) unique per user+campaign+kind. **Email match** is the robust path for external invitees on both platforms: when someone signs up with an address that is in `MarketingContact`, attribute the sign-up to that contact's latest campaign. Android Install Referrer covers tapped links; iOS has no equivalent (the existing invite-code route stays the fallback). Open-pixel opens are shown as "approximate" (Apple Mail Privacy Protection inflates them).
- **"Tap a link, see their activity"**: for identified deliveries, `GET /api/admin/marketing/campaigns/:id/impact` and the recipient dialog join clickers to `SadhanaDay`, `ChantSession`, `ReadingProgress`, `ReelView` for 24 h / 7 days after the click versus the 7 days before. No new tracking tables are needed for existing users.

### 7. Sending engine (email)

- `services/marketing-mailer.js`: nodemailer pooled transport (`pool:true`, `maxConnections`, `maxMessages`), env `MARKETING_SMTP_*` falling back to `SMTP_*`, `MARKETING_MAIL_FROM`, Reply-To setting. Multipart text + html. Error classes: SMTP 5xx user-unknown = hard bounce, suppress; 4xx or timeout = retry up to 3 then FAILED; auth/connection = pause the whole run.
- `POST /api/webhooks/marketing-email` is the SNS HTTPS endpoint for the SES configuration set. It confirms `SubscriptionConfirmation` only for our own topic ARN, verifies the SNS message signature (signing-certificate URL must be on `amazonaws.com`), and handles `Bounce` (Permanent suppresses at once; Transient is only counted), `Complaint` (suppress and mark unsubscribed) and `Delivery`. Mail carries the `X-SES-CONFIGURATION-SET` header; the SES message id from the SMTP reply is stored as `providerMessageId` and used to match notifications to deliveries. A second tiny adapter accepts a generic `{type, email}` JSON with a shared secret for any other SMTP provider.
- **Self-protection**: a run pauses itself when the hard-bounce rate exceeds 2% or the complaint rate exceeds 0.1% over its most recent 500 sends (SES starts reviewing an account at 5% bounces and 0.1% complaints). The first campaign is sent in small ramp-up batches.
- `MarketingCampaign` copies the run pattern from `EtiquetteRun`: status DRAFT, SCHEDULED, QUEUED, RUNNING, PAUSED, COMPLETED, FAILED, CANCELLED, heartbeat, `cancelRequested`, `retriesInARow`, totals, token and cost columns, plus `channel`, template, audience (segment filter snapshot or list ids), mode, provider/model, `maxCostUsd`, `scheduledAt`, `ratePerMinute`.
- New queue `marketing` (attempts 1, concurrency 1) in `backend/jobs/index.js`; processor `jobs/processors/marketing.js` (claim, materialise, send in pages of 200 with a Redis token-bucket limiter, per-recipient try/catch, cancel check between pages, `classifyError` from `utils/translation-run.js`); reconcile timer, `abortActiveRuns`, `onJobFailed` wired in `worker/index.js`; cron `marketing.tick` every minute (in `config/cron.js`) starts due SCHEDULED campaigns.
- Websocket events `marketing.run` / `marketing.activity` (add to `EVENTS` in `services/websocket.js`, `toPermission('marketing.send', …)`).
- `start` follows `controllers/admin/etiquette.js start`: 422 for key/model, Redis start lock, 409 with `details.runId` if one is running, `audit.record`.

### 8. WhatsApp (Phase 3): Meta WhatsApp Cloud API, direct

- Env: `WHATSAPP_ACCESS_TOKEN` (system-user token), `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`, `WHATSAPP_API_VERSION`.
- `services/whatsapp.js` (plain `fetch`): `sendTemplate`, `sendText` (inside the 24-hour window), `listTemplates`, `createTemplate` (submit for approval), `deleteTemplate`, `uploadMedia`, `getNumberHealth` (quality rating, messaging-limit tier). Error map: not on WhatsApp, 24 h window closed, Meta per-user marketing cap, rate limit, template-parameter errors, expired token (pauses the run).
- `WhatsAppTemplate` (name, language, category MARKETING / UTILITY / AUTHENTICATION, status, `metaTemplateId`, components JSON, `variableMap` {1: firstName}, rejection reason, quality). Features: sync statuses from Meta, create and submit, header image, **URL button with dynamic suffix** pointing at the tracked link (this is the "tap to install the app" button), quick-reply buttons (e.g. "Stop updates"), copy-code button. AI drafting reuses section 3 with the WhatsApp schema and Meta's limits (body ≤1024, header/footer ≤60, no placeholder at start or end, examples required); validated server-side before submit.
- Webhook `GET/POST /api/webhooks/whatsapp`: verify token, **HMAC `X-Hub-Signature-256`** on POST, `statuses` (sent, delivered, read, failed with code) update `MarketingDelivery`, inbound `messages` stored in `WhatsAppMessage` / `WhatsAppChat` (tracks `lastInboundAt` for the 24 h window). STOP / UNSUBSCRIBE → suppression; START → opt-in; HELP → fixed reply.
- Sending reuses the section 7 engine: audience = users with a verified WhatsApp opt-in + contacts with an attested opt-in, template picked per recipient by language chain, throttled to `marketing.whatsapp.rate_per_second` and to the number's tier (pause on tier/rate errors). Cost estimate uses an editable per-message figure in settings (Meta's rate card varies by category and country; not hard-coded).
- Opt-in for existing users (server side, used by the Phase 4 app screen): `POST /api/app/marketing/whatsapp/start` (phone to E.164, sends an AUTHENTICATION template code **over WhatsApp**, proving ownership and that the number is on WhatsApp), `/verify`, `/stop`; limits 3 per hour and 5 per day per user. Every step writes `MarketingConsentLog`.
- Minimal admin inbox: chat list, thread, free-text reply only while the window is open, mark handled.

### 9. Admin panel (`admin/`), nothing new in dependencies

Nav: a **Marketing** section in `admin/src/lib/nav.ts` (icons `Megaphone`, `Mail`, `MessageCircle`), gated per item. Flat route files per admin CLAUDE.md:

| Route | File | Contents |
|---|---|---|
| `/marketing` | `routes/marketing.tsx` | Setup card (SMTP configured? WhatsApp token valid? sender/postal address set?), stat row, campaigns `DataTable`, full-page campaign editor (steps: Audience → Content → Review and schedule), campaign detail via `DetailDialog` (live progress, funnel, link table, failures, impact, activity feed, Pause / Resume / Cancel, audit trail) |
| `/marketing/templates` | `routes/marketing-templates.tsx` | List + `<DialogContent page>` editor: language tabs, block editor, sandboxed-iframe preview (language and sample-user pickers, phone/desktop width, light/dark), AI panel (brief, tone, `ModelPicker`, estimate, generate, translate all, approve per variant) |
| `/marketing/audiences` | `routes/marketing-audiences.tsx` | Tabs: Segments (builder + live count + sample), Contacts and lists (CSV import dialog modelled on `translation-import-dialog.tsx`), Suppression (search, add, remove) |
| `/marketing/whatsapp` | `routes/marketing-whatsapp.tsx` | Number health, templates (sync / create / status), inbox, opt-ins (Phase 3) |

Supporting: `lib/marketing.ts` (keys, types, queries, mutations, `useMarketingLive` using `useSocketEvent`, polling 30 s live / 4 s busy / 15 s otherwise), components `marketing-block-editor`, `marketing-email-preview`, `marketing-ai-panel`, `marketing-audience-builder`, `marketing-csv-import-dialog`, `marketing-funnel` (funnel bars from `notification-stats.tsx`). Tokens and utilities only, dark mode, URL-held tab state, dirty-guard on editors, limits mirrored from the backend zod, `confirm()` before Cancel / delete. The admin keeps no business logic: the preview calls the server renderer.

### 10. Permissions, settings, migrations

- Permissions in `config/constants.js` + migration: `marketing.read`, `marketing.manage` (templates, audiences, contacts, AI drafting), `marketing.send` (start, schedule, cancel, test send, WhatsApp reply). **Default: `read` and `manage` to admin and super_admin; `send` to super_admin only** (it reaches real people and spends money; changeable on the Roles page).
- Settings (`SETTING_KEYS` + `KNOWN` in `controllers/admin/setting.js`): `marketing.email.rate_per_minute` (120), `marketing.email.daily_cap` (our own ceiling, default 50,000 to match the SES quota requested in the production-access case; the run stops for the day when it is reached and resumes at midnight IST; set below the real SES quota while warming up), `marketing.weekly_cap` (2), `marketing.from_name`, `marketing.reply_to`, `marketing.postal_address`, `marketing.ai.max_cost_usd`, `marketing.whatsapp.rate_per_second`, `marketing.whatsapp.cost_per_message`.
- Migrations after `20261115000000_routine_open_target`: `20261116000000_marketing` (email tables, preference/consent/suppression, permissions) and `20261117000000_marketing_whatsapp` (WhatsApp tables). Production needs `prisma migrate deploy`, a restart of API and worker, the website deployed with the API, and new env values.

## Phases

1. **Foundations (backend + website)**: models/migration, permissions, preferences, consent log, suppression, contacts/lists/CSV endpoints, audience builder, context loader, block validator and renderer, tracked links, public unsubscribe/click/open routes, website `/l` and `/unsubscribe`, NOTICES + locales, privacy text.
2. **Email campaigns (backend + admin)**: marketing mailer, queue/processor/run endpoints/scheduler, AI draft/translate/per-user, all admin pages, tests, docs.
3. **WhatsApp**: Meta client, webhooks, templates, send, inbox, opt-in endpoints, admin page.
4. **App (cannot be compiled here, no Flutter SDK)**: Settings → "Updates and offers" (email toggle, WhatsApp opt-in with code verify, stop), `/l/` link handling in `share_links.dart` / `deep_link_service.dart`, Android intent filter, install referrer, strings in all 12 ARBs.

Until Phase 4 ships, the *existing-user* WhatsApp audience is empty (no numbers) and app-open attribution is unavailable; email click tracking, email-match attribution and external WhatsApp lists all work.

## Critical files

Reuse or follow: `backend/jobs/processors/etiquette.js`, `services/etiquette.js`, `controllers/admin/etiquette.js`, `utils/translation-run.js`, `scripts/lib/translate-providers.js`, `services/mailer.js` (pattern only), `utils/messages.js`, `utils/language.js`, `utils/recipient.js`, `utils/share.js` (`inbox`), `utils/legacy.js`, `jobs/processors/preferences.js` (user batch paging), `controllers/app/sadhana.js` (stats to extract), `config/cron.js`, `worker/index.js`, `services/websocket.js`, `routes/web/share.js`; `admin/src/components/{model-picker,push-link-field,push-preview,translation-import-dialog,prayer-verses-editor,translation-bits}.tsx`, `admin/src/routes/{etiquette,prayers,notifications}.tsx`, `admin/src/lib/{etiquette,use-table,csv,nav}.ts`, `admin/src/router.tsx`; `website/src/app/get-app/page.tsx`, `website/src/app/robots.ts`.

New: `backend/{services/marketing-*.js, controllers/admin/marketing*.js, routes/admin/marketing*.js, routes/web/marketing.js, routes/app/marketing.js, routes/webhook/*, jobs/processors/marketing.js, config/marketing.js, views/emails/marketing-layout.ejs, test/marketing-*.test.js, scripts/marketing-e2e.js}`, `admin/src/{routes/marketing*.tsx, lib/marketing.ts, components/marketing-*.tsx}`, `website/src/app/{l/[code]/[n]/route.ts, unsubscribe/[code]/page.tsx}`.

Docs to update: root `CLAUDE.md` status row, `backend/CLAUDE.md` (Marketing), `admin/CLAUDE.md`, `website/CLAUDE.md`, `app/CLAUDE.md` (Phase 4), `backend/.env.example`, `deploy/README.md` (env and DNS).

## Owner tasks (outside the code)

- **Email (SES, ap-south-1)**: verify the sending domain as an SES identity in `ap-south-1` with Easy DKIM, add a custom MAIL FROM domain (SPF alignment) and a DMARC record, create a configuration set with an SNS event destination (bounce, complaint, delivery) pointing at `/api/webhooks/marketing-email`, turn on the account-level suppression list for bounces and complaints, create SES SMTP credentials, and keep a monitored Reply-To and unsubscribe mailbox. Warm up with small sends. The production-access case must be approved first; until then SES only sends to verified addresses. Apple private-relay addresses only deliver if the sending domain is registered with Apple.
- **Before the first marketing send**: the privacy page must already carry the marketing section (section 5), because the AWS case reply says recipients are told about it.
- **WhatsApp**: Meta Business verification, a dedicated number (not already on the WhatsApp app), display-name approval, a system-user token, the webhook URL registered, templates approved (can take hours to days).
- A postal address for the email footer; legal review of the consent wording (India's DPDP Act, and CAN-SPAM for overseas readers).

## Risks and honest limits

- Open counts are approximate; email-scanner clicks are flagged, not perfectly filtered.
- iOS has no install attribution; only email match and the invite code work there.
- Attribution after install on Android depends on the Play referrer and is best effort.
- AI-drafted copy and the 11 translations of notices are not read by native speakers; variants are APPROVED by a human before any send.
- WhatsApp quality: low read rates or blocks lower the number's quality rating and tier; the cap and STOP handling are there to protect it.
- Admin pages and the Dart work will only be type-checked and built, not driven in a browser or on a phone, unless run by hand.

## Verification

- `node --test test/marketing-*.test.js`: block validator and renderer (escaping, merge fields and fallbacks, unknown field rejected), audience `where`-builder, batch context loader against seeded rows, link token and click recording (bot flag), suppression hashing, weekly cap, SMTP error classification, CSV normalisation (email dedupe, E.164), WhatsApp payload builders and webhook signature check.
- `npm run test:marketing` (new e2e, local Postgres and Redis): nodemailer `jsonTransport` as the fake SMTP, AI provider faked, a fake Graph server for WhatsApp. Walks template → approve → audience → start → pause → resume → cancel, unsubscribe, bounce suppression, no duplicate sends on a restart mid-run, 422 for a missing key or unusable model.
- Existing suites still green: `test:chat`, `test:sadhana`, `node --test test/messages.test.js`, the full `node --test test/*.test.js`.
- Admin: `tsc -b` and `vite build`; drive the pages in a browser with a local SMTP catcher (real email render in light and dark), the CSV import and a campaign through its live progress.
- WhatsApp: Meta's free test number and sandbox recipient list, with the webhook exposed through a tunnel; confirm template sync, a send, delivered/read statuses, STOP.
- Phase 4: `flutter analyze`, `app/test/l10n_parity_test.dart`, a parse test for `/l/<code>/<n>`.
