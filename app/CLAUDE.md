# App — HariHariBol Mobile

Flutter app (iOS + Android). Clean, simple, conventional. No clever architecture.

## Non-negotiables

1. **Nothing is hardcoded.** No magic strings, colors, sizes, durations or endpoints inline. Everything comes from l10n, theme tokens, or config.
2. **Standard localization.** Use Flutter's own l10n (ARB files + generated delegates). Every user-facing string goes through it from day one — never added retroactively.
3. **Standard color system.** One palette defined in the theme, used everywhere.
4. **This is not styled as a "spiritual app."** No ancient/ornamental theming. Follow standard design patterns with consistent color, padding and spacing throughout.

## Structure

```
app/lib/
├── main.dart
├── l10n/                        # ARB files + generated localizations
├── core/
│   ├── theme/                   # colors, typography, spacing, padding — the single source
│   ├── constants/               # everything else that would otherwise be hardcoded
│   ├── navigation/              # go_router config + navigation singleton + loading handler
│   └── session/                 # session singleton (Hive-backed)
├── models/                      # every model lives here
├── views/
│   ├── auth/                    # login_view.dart …
│   └── dashboard/               # one dart file per tab
├── widgets/
│   ├── auth/                    # {widget_name}.dart
│   └── dashboard/
└── services/                    # fcm_service.dart, socket_service.dart, tracking_service.dart
```

## Files and widgets

- **500 lines maximum per dart file.** Aim well below it.
- **`views/` is one level deep.** A single subdir per module — `auth`, `dashboard`. No nesting beyond that.
- **Dashboard tabs each get their own dart file.**
- **Custom widgets live in `widgets/{module}/{widget_name}.dart`**, never inside the view file. The only exception is a widget small enough that extracting it would cost more than it saves.
- Views stay thin: layout and wiring, not widget definitions.

## State management

Bloc or Riverpod — **one of them, chosen once, used everywhere.** See _Decisions needed_ below.

## Offline storage

**Drift.** SQLite with a type-safe Dart API, actively maintained, and the default recommendation for new Flutter apps in 2026.

Why it fits here:
- Our content is relational — books → cantos → chapters → verses, plus translations and mantras. That is SQL's home ground.
- Type-safe queries catch mistakes at compile time instead of runtime.
- Reactive `Stream` queries drive the UI directly, so offline reads and live updates use one mechanism.
- FTS5 gives real full-text search for verse lookup, without bolting on a search library.

**Do not use:**
- **Realm** — MongoDB deprecated the Atlas Device SDKs in September 2024; support ended September 2025.
- **Isar** — development has stalled; treat as legacy.
- **Original `hive`** — effectively unmaintained. Use `hive_ce` (the community fork) where key-value storage is wanted.

ObjectBox is the only other serious option, and is worth revisiting **only** if we later need built-in device sync — which we do not, since the backend owns sync.

## Session and tokens

- **One session singleton class** owns both tokens. Nothing else reads or writes them.
- Tokens are persisted with **`flutter_secure_storage`** (iOS Keychain / Android Keystore) — they are credentials, so they belong in platform secure storage rather than a plain database file. Non-sensitive session state (last user, preferences, cached flags) uses **`hive_ce`**.
- **Refresh token: 1 year**, re-issued every time it is used.
- **Access token: 7 days**, rotated **silently** in the background — the user must never see an auth interruption, a re-login prompt, or a failed request caused by rotation.
- Requests that fail on an expired access token are retried transparently after refresh.

## Authentication

- **Google and Apple sign-in only.** No email/password, no OTP.
- **Sign-in must be fast** — pick the best-maintained packages and keep the flow to the minimum number of round trips.
- The backend requires proof that account creation came from a real client, so sign-up carries a client attestation token. See [backend/CLAUDE.md](../backend/CLAUDE.md).

## Services

`services/` holds all of them — FCM, socket, tracking (Firebase Analytics), and any that follow. One file per service, each self-contained.

## Navigation

- **go_router** for routing.
- **A single navigation singleton** manages all navigation. Views call it; they do not touch `Navigator` directly.
- That singleton also owns the **loading handler** so loading dialogs show and dismiss consistently, without leaks or stuck overlays.

## Decisions needed

- **State management** — Bloc or Riverpod. Riverpod suits this structure well (compile-safe, less boilerplate, easy to test); Bloc is more prescriptive and better if you want strict event/state discipline across a team.
- **Access token lifetime** — 7 days is long for an access token (typical is minutes to hours). It means a stolen token stays valid for a week and cannot be easily revoked. The 1-year rotating refresh token already delivers the "never asked to log in again" experience, so a shorter access token costs nothing in UX. Worth reconsidering.

## Notes carried over

- The previous Flutter app is archived on the `unorganized` branch at `mobile_app/` — reference only, not a base to copy.
- The Android signing keystore (`key.jks`, `key.properties`) and Firebase configs are backed up outside the repo at `../hariharibol-local-secrets/`. The keystore is irreplaceable — losing it blocks Play Store updates for the existing listing.
