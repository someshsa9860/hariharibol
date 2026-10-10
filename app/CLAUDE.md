# App — HariHariBol Mobile

Flutter app (iOS + Android). Clean, simple, conventional. No clever architecture.

## Non-negotiables

1. **Nothing is hardcoded.** No magic strings, colors, sizes, durations or endpoints inline. Everything comes from l10n, theme tokens, or config.
2. **Standard localization.** Use Flutter's own l10n (ARB files + generated delegates). Every user-facing string goes through it from day one — never added retroactively.
   - **Services write no words.** A failure made on the phone (`api_client`, `auth_service`) has an
     empty `message` and a `FailureKind` or a `ClientFailureCode`; the screen shows it with
     `failure.describe(AppLocalizations.of(context))` (`core/format/failure_text.dart`), which prefers
     the server's own message and otherwise reads the ARB. Never show `failure.message` directly.
   - **Quotes, dashes and joins are copy too** (`labelQuotedMeaning`, `labelTranslatorCredit`,
     `searchResultsTitle`, …) — marks and word order differ by language. Dates and money take the
     reader's locale (`Localizations.localeOf(context)`), never the device default.
   - **The app language setting drives the UI locale** (`providers/locale_provider.dart`, see "Three languages"),
     but only for a language that ships an ARB file. Adding `app_hi.arb` is all it takes for Hindi to switch on.
3. **Standard color system.** One palette defined in the theme, used everywhere.
4. **This is not styled as a "spiritual app."** No ancient/ornamental theming. Follow standard design patterns with consistent color, padding and spacing throughout.

## Toolchain

**Flutter 3.44.2 / Dart 3.12.2**, pinned in `.flutter-version`. The first `flutter`
on `PATH` is usually a different one (several SDKs are installed here), and
`drift_dev` will not resolve against an older analyzer.

`./run.sh`, `./build_bundle.sh` and `./build_ipa.sh` go through
[tool/flutter.sh](tool/flutter.sh), which finds the pinned SDK on `PATH` itself
(or `FLUTTER_SDK=` in `config.sh`) — no `export PATH` needed. Use it for anything
else too: `tool/flutter.sh test`, `tool/flutter.sh pub get`, `tool/flutter.sh analyze`.

A build with the wrong SDK leaves `.dart_tool` unusable for the right one: the
native-asset hook cache (`.dart_tool/hooks_runner/*/*/hook.dill`) is not keyed by SDK,
and an IDE's Dart daemon can re-point `package_config.json` at its own SDK. Both end
in `Invalid kernel binary format version` or `ui.HitTestResponse` not found, and
neither is a code bug. `tool/flutter.sh` deletes the hook dirs another SDK built and
re-runs `pub get` when the framework path is wrong, so it heals itself. A bare
`flutter` run in a terminal or IDE skips that; the next script run cleans up after it.
For VS Code set `dart.flutterSdkPath` to the pinned SDK in `.vscode/settings.json`.

To move to a new SDK, change `.flutter-version` and `pubspec.yaml` together.
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
├── db/                          # Drift: tables, DAOs, the offline library
├── repositories/                # BookRepository — what screens ask for book text (local first)
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
- **One deliberate exception: the weekday initials** in the routine tab's date strip are each printed in a colour of their own (`AppColors.weekdayLight` / `weekdayDark`, Thursday yellow, Saturday black, Wednesday red). Decoration only — see "The routine tab". Nothing else breaks the rule.
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
- **Auto-count** (`services/mantra_auto_chant_session.dart`) listens, transcribes on the phone
  (VAD gates the recogniser, `mantra_detection_engine.dart`) and counts a repetition when the
  transcript matches one of the open mantra's `chantPhrases` by **≥ 50%** (`mantra_phrase_matcher.dart`:
  spellings folded to a rough sound, edit distance, stricter for very short mantras, held back until a
  match is settled so half a chant is never counted twice). Phrases come from the API per mantra (seeded
  in `backend/prisma/seed/chant-phrases.js`, fallback `transliteration`), so any mantra opened works with
  no app change. Tuning is in `AutoChantConfig`; `test/mantra_phrase_matcher_test.dart`.
  - **Two recognisers.** The bundled English one (above) is the default and always the fallback. A person
    can instead download **Omnilingual ASR 300M** (365 MB, `services/mantra_accurate_model.dart`, a row in the
    setup sheet — `widgets/chant/auto_chant_model_row.dart`, `providers/auto_chant_model_provider.dart`),
    which writes the chant in Devanagari. `MantraDetectionEngine.start` uses it when it is on disk: the worker
    then gathers a stretch of voice and decodes it once, as it ends or after `accurateMaxUtteranceSeconds`, where
    the bundled one streams. It is held to `accurateMatchThreshold` (65%) and is also matched against the
    mantra's own script (`Mantra.scriptPhrase`). **Nothing is offered until `AUTO_CHANT_MODEL_URL` is set** at
    build time, and not on a phone with under `accurateMinRamMegabytes`. Every Indic script is folded to
    the same sounds first (`services/indic_sounds.dart`) because the model picks a script itself.
    The offline numbers, and why, are in `tool/auto_chant_bench/` and `assets/models/auto_chant/NOTICE.md`.
    **Not yet tried on a phone:** latency (about 0.35x real time on one desktop thread, so a 3 s chant may be
    counted 1-3 s after it ends) and memory.
  - **A short phrase must end near the start of what was heard** (`shortPhraseReach`), or a lone "Om" counted in
    any sentence containing the sound — 99 false counts in 24 minutes of ordinary speech, now 1.
  - **It logs what it is doing** (`services/auto_chant_log.dart`): every line starts `[AutoChant hh:mm:ss.mmm]`,
    so filtering the console on `AutoChant` shows only this. On in debug and profile builds, off in release
    unless built with `--dart-define=AUTO_CHANT_LOG=true` (`AutoChantConfig.logging`). The lines carry what
    was heard, so they are for the developer's console, not for analytics. Read them top to bottom:
    `enabling` → `microphone is streaming` → `engine: ready` → `LISTENING` → `alive:` every 5 s (audio
    chunks and level — `no audio` / `delivering silence` warnings point at the mic) → `voice detected` →
    `heard: "…"` → `COUNTED +1` → `bead #N added to the counter`. A miss logs `NOT counted … matched 38%,
    needs 50%`; a voice with no words logs `produced no words`; a dead worker logs `worker isolate crashed`
    or `exited`. `worker:` lines come from the background isolate and say whether the recogniser keeps up.
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

## The routine tab

`views/dashboard/routine_tab.dart`. A strip of days (`widgets/routine/routine_date_strip.dart`, 120 days back and 60 ahead — `RoutineConfig`) sits under the title; the day picked there is the day listed below. Scrolling back is how old routines are read.

- **Each day has its own list.** A task is added *for* a day (`RoutineTask.day`) and stays on it. The optional **daily routine** (`DailyRoutineItem`, managed in `daily_routine_sheet.dart` from the repeat button) shows on every day from the day it was added, and each day keeps its own check (`routine.checks`, `{day: [ids]}`). Removing a daily item sets its `until` instead of deleting it, so past days still show it. Days are `yyyy-MM-dd` keys (`routineDayKey`).
- **Device-only**, in `LocalStore` (`routine.tasks`, `routine.daily`, `routine.checks`). Tasks saved before they had a day are dated to the old `routine.date` the first time they are read.
- **A date chip** (`routine_day_chip.dart`) is: the weekday initial (`DateFormat('EEEEE')`, so it follows the locale) in the weekday's colour; the date number inside a ring that fills as the day is checked off (a filled disc once complete, a tick under it); and the Vaishnava tilak under it on Ekadashi. The full date, "Ekadashi" and "n of m done" are the semantic label — colour is never the only signal.
- **The weekday colours are decoration**, the one exception to the colour rule, and are tokens in `app_colors.dart`. Saturday is black in light mode and white in dark.
- **Ekadashi is computed on the phone** (`services/ekadashi_calendar.dart`, Meeus's low-precision sun and moon): the 11th tithi of either fortnight, judged at 06:00 local. It matches the 2025 almanac dates (`test/routine_test.dart`) but **can differ from a temple's printed date by a day** — the Vaishnava Dvadashi rules are not applied. The heading badge says so in its tooltip. A day that holds two sunrises of the tithi is marked on both.
- **The tilak and the peacock feather are drawn, not shipped** (`widgets/common/vaishnava_tilak_icon.dart`, `peacock_feather_icon.dart`), like the motifs. The feather is the Reels button beside the tab bar (`NavAction.iconBuilder`).

## The launch animation

`views/splash/splash_view.dart` plays a 2.6 s sequence over `widgets/splash/`: a soft light and
expanding rings behind (`splash_backdrop.dart`), the logo coming into focus (`splash_logo.dart`),
and the tagline tightening into place (`splash_tagline.dart`, ARB key `splashTagline`). **Every
number — each beat's start, end and curve, sizes, alphas — is in
`core/constants/splash_config.dart`**; retime it there, not in the widgets.

- **The router holds the splash.** The session is restored before `runApp`, so without a hold the
  splash would last one frame. `SplashGate` (`core/navigation/`) is shut at launch; the redirect
  leaves `/splash` alone until the view opens it, then sends the person on as usual. A tap opens
  it early. Deep links are untouched — only the splash location waits.
- **Reduce-motion** shows the finished logo for `reducedMotionHold` and moves nothing.
- **One picture, one arrival.** The logo is a single image, so `SplashLogo` does not assemble it
  from parts: it is uncovered outward from the eye of the feather in a soft-edged circle
  (`bloom`), comes into focus — a little small, low and blurred, sharpening as it settles
  (`focus`) — and one sheen crosses it (`glint`). At the end of the timeline each of those has
  wound back to doing nothing, so the last frame, and the reduce-motion frame, is exactly the
  asset. The widget tree is identical on every frame, otherwise the image would be re-mounted when
  a layer was added or dropped. The blur wraps the reveal rather than sitting under it: a blur
  spills past the picture's edge and a mask only covers the picture, so blurred ink would leak
  round a reveal that had not reached it.
- **The eye.** The light behind the logo, the rings and the reveal all spread from the heart of the
  feather's eye, `SplashConfig.logoEye` — a fraction of the logo's width and height, measured off
  `assets/hariharibol_trprt.png`. `SplashView` turns it into a screen position for the backdrop.
  **A different picture means measuring it again**, or the light spreads from the wrong place.
  `logoWidth` and `logoLift` place the logo; on a screen too narrow it shrinks inside the margins.
- **Colour.** The light and rings take scheme colours, so they follow the palette rule. The logo
  keeps its own colours in both themes — it is artwork, not UI, and was drawn to sit on cream and
  on black alike.
- **The native screens are plain ground, no logo** — a static one would pop when Flutter's first
  frame replaced it. iOS: `LaunchScreen.storyboard` over the `LaunchGround` colour set (light and
  dark). Android: `launch_ground` in `values/` and `values-night/`, used by both
  `launch_background.xml` files. All three **must equal `AppColors.paper` / `paperDark`**; native
  files cannot import a Dart constant, so retuning the palette means editing them by hand.
  Android 12+ draws its own system splash (icon on that colour) regardless.
- **Tests.** `SplashGate.instance.open()` in `setUp` is what lets router tests reach their screen;
  the `launch animation` group in `test/auth_flow_test.dart` closes it again to test the hold.
  `test/splash_logo_test.dart` checks the picture is in the bundle, that every moment of the
  timeline can be drawn without an exception, and that the last frame matches the plain asset
  pixel for pixel.

## Logos and app icons

There are two pictures, and each has one job. Nothing else is a logo — don't add a third.

- **`assets/hariharibol_trprt.png`** (transparent) is the logo the app *shows*: the splash and the
  sign-in screen. Everything reaches it through `AppAssets.logo` (`core/constants/app_assets.dart`),
  so a new picture is one path to change. It is the only logo listed under `assets:` in
  `pubspec.yaml`.
- **`assets/hariharibol.png`** (square, on white) is the *icon master*. The launcher icons are cut
  from it and it ships as those, not as a file the app loads — so it is deliberately **not** in
  `pubspec.yaml` and adds nothing to the bundle.

`python3 tool/generate_app_icons.py` (needs Pillow) rewrites every launcher icon from the master:
the whole of iOS `AppIcon.appiconset` (flattened to opaque RGB, because the App Store rejects an
icon with alpha) and on Android the legacy `mipmap-*/ic_launcher.png` plus the adaptive icon's
`ic_launcher_foreground.png`. The adaptive icon's XML (`mipmap-anydpi-v26/ic_launcher.xml`) and its
white background (`ic_launcher_background` in `values/colors.xml`) are written by hand and the
script leaves them alone.

- **A launcher crops an adaptive icon to its own mask** (circle, squircle, …); only a circle 66/108
  across is never cut. The artwork is shrunk (`ADAPTIVE_INSET`) so its farthest point stays inside
  that circle. Change the shape of the master and recheck it against a circular mask before
  trusting the inset.
- **There is no monochrome (themed-icon) layer.** The logo is multi-colour artwork; a themed icon
  would need a single-colour silhouette drawn for the purpose.
- **Native launch screens carry no logo** — see above.

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

## Silent offline books

Opening a book makes it readable offline, with no prompt and no progress screen. The server
exports each chapter (Gita) or canto (Bhagavatam) to S3 weekly; the app downloads only what
it lacks, straight from S3 — see [backend/README.md](../backend/README.md#book-cache--silent-offline-books).

```
book opened ─► BookSyncManager.syncBook ─► GET manifest ─► BookSyncPlanner (what is missing / newer / different hash,
                                                              the unit being read first, then neighbours)
            ─► queue (2 at once, de-duplicated, paused offline) ─► BookUnitDownloader
                  POST download-url ─► GET S3 (timeouts, backoff, Range resume, one link refresh)
                  ─► isolate: gunzip + SHA-256 + parse ─► BookDao.replaceUnit (ONE transaction)
```

- **`db/`** — Drift v2: `books`, `units` (cantos and chapters), `verses`, `verse_translations`
  (every language of every verse), `download_state`, and the FTS5 table `verse_fts` (created in
  `SearchDao.createIndex`, not a Drift table). Written by **one** method, `BookDao.replaceUnit`:
  old verses, translations and search rows out, new ones in, and `download_state` set to `done`
  at the downloaded version and hash — all in one transaction, so a unit is never half-updated.
  Version 1 (a one-language cache) is dropped on upgrade; the sync refills it.
- **`repositories/book_repository.dart`** — the only thing screens ask for book text. Local first;
  a unit not on the phone is queued at the front and awaited (`readerWait`), and only then does
  it fall back to the ordinary API. Short works (no chapters) are not exported: they come from the
  API and are saved whole (`unitType: 'book'`).
- **Language is chosen at read time**, not download time: every language is on the phone, so changing
  the reading language needs no download. `BookRepository.pickTranslation` is the server's
  `language.pick` against local rows.
- **The file carries audio keys, never links** (a link would change the hash hourly).
  `Verse.audioPath` is a key; `Verse.audioUrl` a link. Links come from `/audio-urls`.
- **Background**: `book_sync_background.dart` asks the OS (workmanager) to finish unfinished
  units when the app is backgrounded — network connected, battery not low. The sync endpoints are
  public, so the background isolate needs no sign-in. `resumePending()` also runs at launch.
  **iOS and Android registration is not exercised here** (no device or Xcode in CI): Android needs
  nothing extra; iOS has `BGTaskSchedulerPermittedIdentifiers`, `UIBackgroundModes: processing` and
  `WorkmanagerPlugin.registerBGProcessingTask` in `AppDelegate.swift`. Try it on a device before relying on it.
- **A `done` unit keeps its old text** while a newer version downloads, and keeps it if that fails.
  A failed unit is retried each time its book opens, when the network returns, and at launch until
  `BookSyncConfig.autoRetryLimit`.
- **UI**: `bookSyncSummaryProvider(bookId)` / `bookUnitStatesProvider(bookId)` expose "n of m"; the
  only visible trace is the quiet icon in `BookDownloadAction`.
- **Tests**: `test/book_db_test.dart` (transaction, FTS, migration), `book_sync_planner_test.dart`,
  `book_sync_manager_test.dart` (queue, priority, dedupe, pause, restart), `book_unit_downloader_test.dart`
  (resume, refresh, backoff, hash), `book_repository_test.dart`. Fakes in `test/support/`.

## Three languages

Three settings, each its own, stored on the device (`providers/language_settings_provider.dart`,
`models/language_settings.dart`). Changing one never changes another.

| Setting | Drives | Default |
|---|---|---|
| **App** | menus, buttons, labels — the UI locale (`appLocaleProvider`); only a language with an ARB file | device language if shipped, else English |
| **Reading** | translation, meaning, purport on screen (`readingChainProvider`: reading → app → en) | device language, else English |
| **Speaking** | verse audio and spoken meaning/purport (`speakingChainProvider`: speaking → en) | device language, else English |

First value: stored → the account's own choice (app and reading only) → the phone's language → English.
App and reading are also sent to the account, best effort (the server shapes some responses by them);
speaking has no server field. Sanskrit verse text is always Sanskrit — it is not one of the three.
Settings → **Languages** has a row and picker for each. `test/language_settings_test.dart`.

## Reading aloud

A play button on each verse (only where there is something to play) and **Read aloud** at the top of
the page. Each verse is: its recitation (if it has audio) → the meaning → the purport.

```
ReadingAudio ─► ReadingPlaybackController ─┬─ VerseAudioCache ─► AudioLinkResolver ─► POST /audio-urls
 (prepare, session,   (run-numbered loop:  ├─ JustAudioFilePlayer           (key → link, remembered 50 min)
  lock screen)         verse→meaning→      └─ AdaptiveTtsEngine ─► SherpaTtsEngine (installed voice)
                       purport, next verse)                     └► PlatformTtsEngine (flutter_tts)
```

- **What is said follows the *speaking* language**, not what is on screen: the offline files hold every
  language, so `BookRepository.spokenRenderings` + `ReadingItems.build` pick the meaning and the purport
  per speaking chain. A section carries candidates (hi meaning, en purport — common), and the first one
  a voice exists for is spoken. The meaning is the translation; `wordMeanings: true` puts the word-for-word
  breakdown before it.
- **Recitations** are downloaded on first play and kept (`VerseAudioCache`, keyed by storage key, 200 MB LRU),
  and the next verse is fetched while this one plays. A verse with no audio, or one that will not load, is
  skipped silently and reading goes on to the meaning.
- **Highlight and section**: the verse being read is outlined and its eyebrow says which part is heard
  ("Verse 7 · Purport"); `ReadingPlayerBar` shows previous / pause / next / stop. Auto-play scrolls to the verse.
- **Remembers the last verse** per chapter (`ReadingMemory`); the button offers "Resume from verse N".
- **Background and the lock screen**: `audio_service` with our own `AudioHandler` (`ReadingAudioHandler`)
  over the controller. **`just_audio_background` is not used**: it makes *every* `AudioPlayer` in the app
  require a `MediaItem` tag, which would break the chant-along player and the reels soundtrack. Android:
  `AudioServiceActivity`, the service + receiver and media-playback foreground permissions are in
  `AndroidManifest.xml`; iOS: `UIBackgroundModes` has `audio`.
- **Focus and interruptions** (`InterruptionPolicy`, over `audio_session`): a call or another app's audio
  pauses and resumes when the system allows; headphones unplugged pauses and never auto-resumes; a reader's
  own pause is never undone.
- **Not yet tried on a phone**: the lock-screen controls, the foreground service, audio focus with a real
  call. The logic is covered by `test/reading_playback_test.dart` and `test/reading_audio_ui_test.dart`
  with fake players; the platform wiring is not.

## Spoken meaning and purport (voices)

**One interface** — `TtsEngine` (`speak`, `pause`, `resume`, `stop`, a `progress` stream, `canSpeak`) — so an
engine can be swapped. Three implementations: `SherpaTtsEngine` (offline neural), `PlatformTtsEngine`
(`flutter_tts`), and `AdaptiveTtsEngine`, which the player uses: neural when a voice is installed for the
language, the phone's voice otherwise (and again from the failed chunk if the neural one dies part-way).
**Speech never waits on a download.**

- **Chunks, no gap.** `TextChunker` splits at sentence ends (`.?!` and the danda `।॥`), then clauses, then
  words, never over 220 characters. `ChunkedSpeaker` asks for chunk N+1 *before* awaiting chunk N's playback.
- **Off the UI thread.** `SherpaSynthesizer` loads the model once in its own isolate; only finished PCM comes
  back (`TransferableTypedData`). Played through just_audio as a small WAV per chunk, deleted after.
- **`TtsModelManager`** maps each language to a voice from a manifest — the bundled
  `assets/tts/tts_models.json`, replaced at run time by `--dart-define=TTS_MODELS_MANIFEST_URL=…` (cached
  for offline). It downloads on demand with `Range` resume (the `.part` file survives a restart), backoff,
  **SHA-256 check before anything is unpacked**, extraction in an isolate (top folder stripped, path-escaping
  entries skipped), install by renaming a finished folder into place, delete, and a status stream for the UI.
  Downloads start on their own only on Wi-Fi (when the speaking language is chosen, or a language is first
  spoken without a voice); Settings → Voices downloads and deletes by hand anywhere.
- **A voice with no checksum is never installed.** The bundled manifest lists candidates as
  `enabled: false` with empty url/sha256, **because I could not confirm the files exist or compute their
  checksums** (GitHub releases and Hugging Face were unreachable from the build environment). Until someone
  does, every language uses the phone's voice. To enable one: download the model archive, `shasum -a 256` it,
  fill `url`, `sizeBytes`, `sha256`, set `enabled: true`.

### Which model — and why this engine

| Option | Offline | Indic coverage | Size | Licence | Verdict |
|---|---|---|---|---|---|
| **sherpa-onnx + Piper (VITS)** | yes | Hindi, Telugu, Malayalam, Nepali voices exist; English very good | ~60 MB (medium) | Apache-2.0 engine; **each voice has its own card** | **Chosen engine.** `sherpa_onnx` is already in the app (auto-count), so no new native runtime; runs in an isolate; Android + iOS |
| sherpa-onnx + MMS-TTS (VITS) | yes | Hindi, Bengali, Tamil, Telugu, Kannada, Marathi, Gujarati, Malayalam… | tens of MB each | **CC-BY-NC 4.0 — non-commercial** | Listed, **disabled**: do not ship in a commercial build without a licence decision |
| sherpa-onnx + Kokoro | yes | mostly English | 80–300 MB | Apache-2.0 | Too big for the gain; English only needs Piper |
| AI4Bharat IndicTTS / Indic-Parler | yes | the best Indic quality | large; not packaged for sherpa | MIT / Apache | Worth a later look: needs ONNX export |
| Platform voice (`flutter_tts`) | usually | whatever the phone has (Google TTS has hi/bn/ta/te/kn/ml/mr/gu packs) | 0 | — | **Always the fallback** |

These are from my knowledge of the projects, not from checking their release pages today — verify a voice
before enabling it. Quality and latency (real-time factor on a mid-range phone) are **not measured**.

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
