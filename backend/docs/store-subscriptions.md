# Store subscriptions: setup and how they work

What you have to do outside the code so that Google Play and App Store subscriptions
reach the backend, and what the backend does with them. Everything in `.env` is listed
with its comment in [`.env.example`](../.env.example). **JSON and key credentials are
always files**: drop them in `backend/secrets/` (git-ignored) and put the path in the
variable.

## 1. Google Play

### 1a. Subscription products (Play Console)
Monetize with Play → Products → Subscriptions → Create subscription.

- **Product ID** must be the slug the app uses: `<plan-slug>_monthly` (for example `arta_monthly`).
  The same string goes in the admin panel's **Plans → Prices → Product id** for provider Google Play.
- Add a **base plan** (monthly, auto-renewing) with the price, then optionally an **offer**
  with a **free trial** phase (eligibility: new customers). Activate both.
- Set the same `trialDays` on the plan's price in the admin panel (it is only used to say
  "7 days free" in the app and as a fallback to recognise a trial payment).

### 1b. Service account for the API (`GOOGLE_PLAY_SERVICE_ACCOUNT_PATH`)
1. Google Cloud Console → pick (or create) a project → **APIs & Services → Library → Google Play Android Developer API → Enable**.
2. **IAM & Admin → Service accounts → Create service account** (no roles needed) → open it →
   **Keys → Add key → Create new key → JSON**. Save the file as `backend/secrets/play-service-account.json`.
3. Play Console → **Users and permissions → Invite new users** → paste the service account's
   email (`…@….iam.gserviceaccount.com`) → under **Account permissions** tick
   *View app information and download bulk reports (read-only)*, *View financial data, orders and cancellation survey responses* and
   *Manage orders and subscriptions*. (Older consoles: Setup → API access → link the project → grant access.)
   It can take up to a few hours to take effect.
4. `GOOGLE_PLAY_PACKAGE_NAME` = the app's package name (`com.sss.ramkrishnahari`).

### 1c. Real-time notifications (Pub/Sub → our URL)
This is how cancellations, renewals, grace periods, expiry and refunds reach the backend.

1. Same Cloud project → **Pub/Sub → Topics → Create topic**, e.g. `play-rtdn`.
2. On the topic → **Permissions → Add principal** `google-play-developer-notifications@system.gserviceaccount.com`
   with role **Pub/Sub Publisher**.
3. **Subscriptions → Create subscription** on that topic, delivery type **Push**, endpoint URL:

   `https://<api-host>/api/webhooks/payments/google?token=<PUBSUB_VERIFICATION_TOKEN>`

   Make the token with `openssl rand -hex 24` and put the same value in `.env`.
   *Optional, stronger:* tick **Enable authentication**, choose a service account and an audience,
   and set `PUBSUB_AUDIENCE` and `PUBSUB_SERVICE_ACCOUNT_EMAIL` to match. Either proof is accepted;
   in production the endpoint refuses requests with neither.
4. Play Console → the app → **Monetize with Play → Monetization setup → Real-time developer notifications**
   → topic name `projects/<project-id>/topics/play-rtdn`, notification content **Subscriptions, voided purchases and all**
   (or at least subscriptions and voided purchases) → **Send test notification**. The API log shows "google play test notification received".
5. Test purchases: Play Console → **Settings → License testing** → add tester Gmail accounts.
   Test subscriptions renew every few minutes. They grant access but are **not saved as revenue in production**.

## 2. App Store

### 2a. Subscription products (App Store Connect)
App → **Monetization → Subscriptions** → create a **subscription group** (e.g. "HariHariBol plans"), then one
subscription per plan, with **Product ID** `<plan-slug>_monthly`, duration 1 month, price. Add an
**Introductory offer → Free** for the free trial. Put the same product ids on the plans in the admin panel (provider App Store).
Upgrades/downgrades between plans work because all plans are in one group (put them in order of rank, highest first).

### 2b. API key (`APPLE_ISSUER_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY_PATH`)
App Store Connect → **Users and Access → Integrations → In-App Purchase** → **Generate In-App Purchase Key**
(role needed: Admin). The page shows the **Issuer ID** (top) and the key's **Key ID**; **download the `AuthKey_XXXX.p8`
once** (Apple will not show it again) and save it as `backend/secrets/AuthKey_<KEYID>.p8`. The app's bundle id must be in `APPLE_BUNDLE_IDS`.

### 2c. Server notifications
App → **General → App Information → App Store Server Notifications**:

- **Production Server URL**: `https://<api-host>/api/webhooks/payments/apple`
- **Sandbox Server URL**: the same
- **Version 2**.

There is no secret to configure: a notification is only a prompt, and the backend always re-reads the
real state from Apple's API with the key above before writing anything.
Make sure the **Paid Applications agreement**, banking and tax forms are complete (Business → Agreements), or
no purchase will go through. Test with a **Sandbox Apple Account** (Users and Access → Sandbox).

## 3. What the backend does with each event

All of it is in `services/payments/lifecycle.js`; the stores' own words are mapped in `google.js` / `apple.js`.

| Store event | Subscription | Payment row | Push to the reader |
|---|---|---|---|
| Bought, no trial | `ACTIVE` | gross/commission/net in INR | "Plan upgraded to X" |
| Bought with free trial | `IN_TRIAL` | **one row, amount 0, `isTrial`, all INR 0** | "Your X free trial has begun" |
| Trial converts / monthly renewal | period moves forward | new row | "Subscription renewed" |
| Auto-renew switched off | `CANCELLED`, access until period end | – | "Subscription cancelled… keep it until DATE" |
| Auto-renew switched back on | `ACTIVE` | – | "Auto-renew is back on" |
| Renewal payment fails, grace period | `GRACE`, still has access | none (not paid) | "We could not renew your plan" |
| On hold / billing retry | `EXPIRED` (no access), `billingIssueAt` set | none | – |
| Expired | `EXPIRED` | – | "Your subscription has ended" |
| Refunded / revoked / chargeback | `REFUNDED`, access ends now | `REFUNDED`, figures kept, `refundedAt` set | "Your payment was refunded" |
| Upgrade / plan change | plan follows the product; Google's old token is ended | new charge | "Plan upgraded to X" / "Your plan is now X" |
| Downgrade (Apple, next renewal) | unchanged until it takes effect | – | "Your plan will change to X" |

Safety nets: the same state applied twice changes nothing and sends nothing (idempotent on
`(provider, order/transaction id)`); a transient store failure answers 5xx so the sender retries;
the worker job `subscription.reconcile` (every 6 hours) re-reads from the store every subscription whose
paid period has run out, so a lost notification cannot leave anyone wrongly premium (or wrongly locked out).
The app's own verify call (`POST /api/app/subscription/verify`) goes through the same code, and the app now sends the
reader's id with the purchase so a notification that beats the verify call can still be attributed on Google.

## 4. Revenue data (for the admin panel and the finance section)

Every `Payment` row stores, once, when it is recorded (never recomputed):

| Column | Meaning |
|---|---|
| `amountMinor`, `currency` | what the payer was charged, in their currency (0 for a free trial) |
| `commissionMinor`, `netMinor` | the platform's cut and what is left, in that currency |
| **`grossInrMinor`, `commissionInrMinor`, `netInrMinor`** | the same in **paise (INR)**; `gross - commission = net` exactly |
| `fxRate`, `fxSource`, `fxDate` | INR per 1 unit of `currency`, where it came from, which day |
| `commissionRate`, `commissionSource` | the fraction used (e.g. 0.15) and `RATE` (our configured rate), `STORE` (reported by the store) or `NONE` (trial) |
| `isTrial` | a free trial: a real row so history is complete, worth 0 |
| `status`, `paidAt`, `refundedAt`, `purpose` | revenue is `status = SUCCEEDED` by `paidAt`; `purpose` separates `SUBSCRIPTION` from `DONATION` |

**Exchange rates**: Frankfurter (European Central Bank reference rates for the payment's day, free, no key) first;
if that fails or does not cover the currency, open.er-api.com (today's rate, free, no key). Each day's rate per currency is
stored once in `FxRate`, so all payments of that day convert the same way. If no source is reachable the INR columns stay
empty and the worker job `payment.fx.backfill` (daily) fills them in.

**Commission**: Apple and Google do not report their cut in notifications, so the commission is
`PLAY_COMMISSION_RATE` / `APPLE_COMMISSION_RATE` (default 15%) times the price. Compare the monthly total with the
Play Console financial report and the App Store Connect payments report once and adjust the rates if they differ.

## 5. Known limits (read these)

- **Nothing here has been run against the real stores.** The logic is tested with faked store responses
  (`npm run test:store-subscriptions`); the first real purchases (license tester / sandbox) are the real test.
  The Google field used to spot a free trial (`offerPhase.freeTrialPhase`) is read defensively; if Google does not send it, a first
  charge on a price with `trialDays > 0` is treated as the trial.
- **Tax**: the price a store reports can include GST/VAT, while the store's commission is taken on the price without it.
  Gross is "what the payer paid". If your payout reports differ from `net`, adjust the commission rates rather than the code.
- **Prices**: the amount recorded for a renewal is the subscription's current price; an introductory price or a price change
  is not separated out.
- **Apple signatures**: notifications are not signature-checked; they are only a prompt and the state is re-read from Apple's API
  (so a forged one can cause a re-read, nothing more).
- **Partial refunds** are treated as full refunds.
- **Production**: run `prisma migrate deploy` for `20261101000000_store_revenue`. It adds columns and the `FxRate` table, and fills in
  existing rupee payments (gross, plus commission at the default rates). No seed is needed. Then set the variables above and restart
  the API and the worker (the two new jobs are registered by the worker).
