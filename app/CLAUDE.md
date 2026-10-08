# App — HariHariBol Mobile

Flutter app (iOS + Android). Clean, simple, conventional. No clever architecture.

## Non-negotiables

1. **Nothing is hardcoded.** No magic strings, colors, sizes, durations or endpoints inline. Everything comes from l10n, theme tokens, or config.
2. **Standard localization.** Use Flutter's own l10n (ARB files + generated delegates). Every user-facing string goes through it from day one — never added retroactively.
3. **Standard color system.** One palette defined in the theme, used everywhere.
4. **This is not styled as a "spiritual app."** No ancient/ornamental theming. Follow standard design patterns with consistent color, padding and spacing throughout.

## Toolchain

**Flutter 3.44.2 / Dart 3.12.2.** Not the copy on `PATH` — that one is 3.38.3,
and `drift_dev` will not resolve against its analyzer. Build with:

```
export PATH="/Users/teja/company/flutter-versions/flutter_3.44.2/bin:$PATH"
```

`pubspec.yaml` pins `sdk: ^3.12.2`, so an older SDK fails loudly at `pub get`
rather than quietly somewhere else.

## Build-time configuration

Nothing that differs per environment is committed. Four `--dart-define`s cover
it, all with working defaults:

| Define | Default | Why |
|---|---|---|
| `API_BASE_URL` | `https://api.hariharibol.com` | Point a debug build at a laptop. Android emulators reach the host at `10.0.2.2`. |
| `GOOGLE_SERVER_CLIENT_ID` | — | The **web** client id. Android needs it as `serverClientId` or Google returns no ID token. |
| `GOOGLE_IOS_CLIENT_ID` | — | Normally read from `GoogleService-Info.plist`; this exists because that file is a secret. |

```
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:4000 \
            --dart-define=GOOGLE_SERVER_CLIENT_ID=…
```

**Firebase is optional at boot.** The config files are secrets and are not in
the repository, so `FirebaseService.init()` catches its own failure: push and
analytics go quiet, App Check returns no token, everything else works. The
backend's `APP_CHECK_ENABLED=false` in development is the other half of that.

**Bundle id: `com.sss.ramkrishnahari`** on both platforms — the same as the
existing store listings, which is what keeps the Play upload and the irreplaceable
keystore usable. Do not let `flutter create` reset it.

## Structure

```
app/lib/
├── main.dart                    # boot only — storage, device, firebase, session, runApp
├── app.dart                     # MaterialApp.router: theme, l10n, router
├── l10n/                        # app_en.arb + generated/ (written by `flutter gen-l10n`)
├── core/
│   ├── theme/                   # colors, typography, spacing, padding — the single source
│   ├── constants/               # api paths, app config, storage keys
│   ├── navigation/              # go_router config + navigation singleton + loading handler
│   └── session/                 # session singleton — owns tokens
├── models/                      # every model lives here, plus json.dart's parse helpers
├── providers/                   # Riverpod providers, one file per feature
├── views/
│   ├── splash/
│   ├── auth/                    # sign_in_view.dart …
│   └── dashboard/               # one dart file per tab
├── widgets/
│   ├── common/                  # loader, error view, empty state, image, section header
│   ├── auth/                    # {widget_name}.dart
│   └── dashboard/
└── services/                    # api_client, auth, user, home, fcm, tracking, device, …
```

`providers/` is not a layer — it holds the Riverpod objects that connect a
service to a view. Services do the work; providers make the result watchable.

## Files and widgets

- **500 lines maximum per dart file.** Aim well below it.
- **`views/` is one level deep.** A single subdir per module — `auth`, `dashboard`. No nesting beyond that.
- **Dashboard tabs each get their own dart file.**
- **Custom widgets live in `widgets/{module}/{widget_name}.dart`**, never inside the view file. The only exception is a widget small enough that extracting it would cost more than it saves.
- Views stay thin: layout and wiring, not widget definitions.

## Design language

The app is an **editorial layout on warm paper**, not a Material dashboard. Every screen is built from the same handful of pieces, and none of them are re-invented per view.

| Piece | Where | What it is |
|---|---|---|
| Palette | `core/theme/app_colors.dart` | See the colour rule below. Both `ColorScheme`s are **written out by hand** in `AppTheme._scheme`. |
| Heading serif | `AppTypography.serif` | Georgia, falling back to Noto Serif on Android. **Nothing is bundled** — a downloaded face is another asset and a flash of unstyled text on every cold start. Applied to `display*` and `headline*` at **regular weight**: hierarchy comes from size and space, not bold. |
| `AppTypography.eyebrow` | via `widgets/common/eyebrow.dart` | The letterspaced small caps that name a block — `VERSE OF THE DAY`, `PRACTICE`. Pass sentence case; the widget uppercases. |
| `AppTypography.numeral` | anywhere a number is looked at | Serif figures for counts and streaks. The UI font's lining figures read as a spreadsheet at that size. |
| `Motif` / `MotifPanel` | `widgets/common/motif.dart` | Lotus, sun and crescent line art, **drawn not shipped**: a few strokes each, so a painter beats an asset, scales to any size and takes its colour from the card it lands on. Ornamental, so `ExcludeSemantics`. |

### The colour rule

**Light mode is dark orange, saffron and white. Dark mode is black and white. There is no fourth colour, in either.**

Light has no grey — the neutrals are all tints and shades of the one orange hue, so a "grey" caption is really the palest brown-orange and near-black body text is really the darkest. Dark has no orange — on a black ground the brand orange glows and pulls the eye off the verse, which is the one thing on the screen meant to be read, so the accent there is simply white.

- **Never `ColorScheme.fromSeed`.** It always derives a tertiary by rotating the hue, which is exactly the fourth colour this design does not have. Both schemes state every role explicitly.
- **Never `Colors.<anything>`** except `Colors.transparent`. No `Color(0xFF…)` outside `app_colors.dart` — including the gradients behind motifs, which are `AppColors.panelFrom`/`panelTo`.
- **Saffron is a fill, never text.** It is about 2:1 on white. What sits on saffron is `ink`.
- **Colour never carries meaning on its own.** There is no green for success and no red for danger — light mode can only vary tone, and dark mode cannot even do that. Every state needs an icon or a word too. This is why the destructive actions in `profile_tab.dart` carry both an icon and a confirmation.

`test/palette_test.dart` enforces all of this: every role in both schemes is checked for hue, and body and muted text are checked for 4.5:1 contrast. Retune the palette and the test tells you what drifted.

Rules that follow from it:

- **Cards are a lighter plane with a hairline, never a shadow.** Elevation on a warm ground reads as dirt. The `cardTheme` already does this — don't hand-roll a `BoxDecoration`.
- **Devanagari never takes the serif.** None of those faces cover it. Verse text uses `AppTypography.verse`, which stays on the platform font and carries the extra leading matras need.
- **A motif is the fallback for a missing image**, not a grey box. Most of the library has no cover art and never will; absence should look deliberate.
- **No control that does nothing.** The verse card's arrow appears only when there is a screen to open; a play button waits on audio existing. Ship the section without the affordance rather than with a dead one.

## The chant counter

`views/chant/chant_view.dart` is the tap counter. Every tap is stamped by a `ChantRecorder`
(`services/chant_recorder.dart`, pure Dart, clock injected — `test/chant_recorder_test.dart`):
a round is simply the next `beadsPerRound` taps, so which round a tap belongs to, and a
round's start, end and duration, are read off the taps rather than stored beside them. A
chant's duration is its **gap** — time since the tap before it; the first tap of a sitting
has none and every average leaves it out.

- **Server record.** Changed rounds go up with the existing 2-second session sync
  (`PUT …/chant/session/:id/detail`, idempotent per round); a failed send is put back on the
  recorder. History is read from `GET …/chant/sessions` and `…/chant/session/:id`.
- **Word detection** (`services/chant_speech_listener.dart` over `services/chant_word_engine.dart`) is a
  separate switch from auto-count, and runs **on the phone with sherpa-onnx** — the same library
  and the same bundled model as auto-count (the keyword zipformer is a small streaming recogniser,
  run through `OnlineRecognizer`), so it needs no Google/Apple speech service and works offline.
  English-trained, so Sanskrit comes out approximate. Each tap takes the words heard since the tap
  before it; they are sent to `…/transcripts`, which the server **deletes after 7 days**. Audio is
  not recorded or uploaded.
- **Setup is one sheet.** Both switches live in `widgets/chant/chant_setup_sheet.dart`, opened from
  the "Auto count & words" button under the ring; its label shows how many are on.
- **Mic sharing.** Auto-count and word detection (both use `record`, each with its own recorder) both want the
  microphone. Whether they can run together is a per-device question — check it on hardware
  before promising both at once.
- **Chant along** (a mantra's mala recording). A mantra can carry one recording of a whole
  mala and where the chanting starts and ends in it (`Mantra.malaAudioUrl` / `malaAudioStartMs`
  / `malaAudioEndMs`; `hasMalaAudio` is false unless the end is after the start). With one, the
  screen shows `widgets/chant/chant_along_card.dart` — play / pause and a bar that can be
  dragged — and the counter counts with the voice: the stretch is split evenly into one
  round's beads, and a chant is counted as it **finishes**. The arithmetic is
  `services/chant_mala_timing.dart` (pure — `test/chant_mala_timing_test.dart`);
  `services/chant_mala_player.dart` is the `just_audio` player around it; `chant_view.dart`
  turns each finished chant into a bead tap. The other halves are in
  [backend/CLAUDE.md](../backend/CLAUDE.md) and [admin/CLAUDE.md](../admin/CLAUDE.md).
  - **Only listening counts.** A seek — the bar, or any reading that jumps more than
    `ChantAudioConfig.continuousStep` — finds its place and counts nothing, so dragging to the
    middle adds no fifty chants and dragging back takes none away. Playing a stretch again
    counts it again: that is another time through.
  - **The mic features rest while it plays.** The speaker would be heard as chanting, so
    starting the recording switches auto-count and word detection off, and turning either on
    pauses the recording.
  - **It stops when the person does.** Paused when the app goes to the background and when the
    sitting is closed (nothing is counted after the last sync). While it plays the screen is
    held awake (`wakelock_plus`) — nobody is tapping, and a locked screen stops the audio and
    the count. `ChantMalaPlayer.dispose` lets the screen go *first*, before awaiting anything.
  - **A stale link is asked for again once.** It is signed for an hour by default; a recording
    that will not open is re-fetched (`MantraService.get`) before the card says it failed.
  - **Tests.** `malaAudioPlayerProvider` is the seam: tests swap in `FakeAudioPlayer` and
    `FakeWakelock` from `test/fake_audio_player.dart`. Under `testWidgets` a stream `cancel()`
    does not finish during `pump`, which is why `dispose` does not wait on one; and frames stop
    once the lifecycle is `paused`, so a test resumes it before leaving the screen.

## State management

**Riverpod.** Used everywhere — no second state solution alongside it.

Chosen for less boilerplate than Bloc, compile-time safety, and because it pairs naturally with Drift's stream queries: a database stream becomes a provider directly, so offline data and UI state share one mechanism. It also keeps view files small, which the 500-line rule depends on.

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

- **Access token lifetime** — 7 days is long for an access token (typical is minutes to hours). It means a stolen token stays valid for a week and cannot be easily revoked. The 1-year rotating refresh token already delivers the "never asked to log in again" experience, so a shorter access token costs nothing in UX. Worth reconsidering.

## Firebase and signing

Both are secrets and neither is in the repository, so a fresh clone has to build without them: the google-services Gradle plugin is applied only when `android/app/google-services.json` exists, the release signing config is created only when `android/key.properties` does, and `FirebaseService` records a failed init rather than crashing. Nothing here is optional in a real build — it is arranged so a checkout is not dead on arrival.

| What | Where it comes from | Lands at |
|---|---|---|
| Firebase config | `flutterfire configure --project=hari-hari-bol` | `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`, `lib/firebase_options.dart` |
| Signing keystore | `../hariharibol-local-secrets/` (identical copy in the old `sadhana` app) | `android/app/key.jks`, `android/key.properties` |

- **Identity is fixed**: `com.sss.ramkrishnahari` on both platforms, Firebase project `hari-hari-bol`. It matches the existing Play listing — changing it orphans the listing and every installed copy.
- **Google Sign-In needs the signing SHA registered with Firebase**, or Android sign-in fails with a bare `DEVELOPER_ERROR`. Release and debug SHA-1 and SHA-256 are registered; add a machine's own debug SHA with `firebase apps:android:sha:create <androidAppId> <sha>`. **Play App Signing re-signs the upload**, so the SHA-1 from the Play Console must be registered too before sign-in works on a store build.
- The Gradle plugin turns `google-services.json` into `default_web_client_id`, which is the `serverClientId` google_sign_in needs to get an ID token at all. iOS reads its client id from `GoogleService-Info.plist`, and needs the `REVERSED_CLIENT_ID` as a URL scheme in `Info.plist`.
- The backend verifies the ID token's audience against `GOOGLE_CLIENT_IDS` and `APPLE_BUNDLE_IDS`. Those must list these same client ids, or every sign-in is rejected as unverifiable.
- **iOS minimum is 15.0** — the Firebase iOS SDK requires it. It is set in `Runner.xcodeproj` and the `Podfile`; both have to agree.

## Notes carried over

- The previous Flutter app is archived on the `unorganized` branch at `mobile_app/` — reference only, not a base to copy.
- The Android signing keystore (`key.jks`, `key.properties`) and Firebase configs are backed up outside the repo at `../hariharibol-local-secrets/`. The keystore is irreplaceable — losing it blocks Play Store updates for the existing listing.
