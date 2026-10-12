# App — HariHariBol Mobile

Flutter app (iOS + Android). Clean, simple, conventional. No clever architecture.

## Non-negotiables

1. **Nothing is hardcoded.** No magic strings, colors, sizes, durations or endpoints inline — everything comes from l10n, theme tokens, or config.
2. **Standard localization.** Flutter's own l10n (ARB files + generated delegates). Every user-facing string goes through it from day one, never retroactively.
   - **The one rule: text added to `lib/l10n/app_en.arb` is translated into every other `app_*.arb`
     in the same change** (`hi mr gu bn ta te kn or pa ml as`; Sanskrit has no UI file). Same keys in
     the same order, no `@key` metadata (English alone has it), same placeholders and ICU shape, Latin
     digits. Then `tool/flutter.sh gen-l10n` and commit `lib/l10n/generated/`. If an English text's
     *meaning* changes, re-translate it everywhere or give it a new key — key parity can't see a
     changed value. `gen-l10n` only warns and the app then silently shows English, so
     **`test/l10n_parity_test.dart` enforces it**. CI doesn't run the app's tests — run it. New
     language, house style, devotional glossary: [lib/l10n/README.md](lib/l10n/README.md).
   - **Services write no words.** A failure made on the phone (`api_client`, `auth_service`) has an empty
     `message` and a `FailureKind` or `ClientFailureCode`; screens show
     `failure.describe(AppLocalizations.of(context))` (`core/format/failure_text.dart`: the server's own
     message if there is one, else the ARB). Never show `failure.message`.
   - **Quotes, dashes and joins are copy too** (`labelQuotedMeaning`, `labelTranslatorCredit`,
     `searchResultsTitle`, …): marks and word order differ by language. Dates and money take the reader's
     locale (`Localizations.localeOf(context)`), never the device default.
   - **The app-language setting drives the UI locale** (`providers/locale_provider.dart`, see "Three
     languages") for a language that ships an ARB file — all twelve do today.
3. **Standard color system.** One palette defined in the theme, used everywhere.
4. **This is not styled as a "spiritual app."** No ancient/ornamental theming. Standard design patterns with consistent color, padding and spacing.

## Toolchain

**Flutter 3.44.2 / Dart 3.12.2**, pinned in `.flutter-version`. The first `flutter` on `PATH` is usually a
different SDK, and `drift_dev` won't resolve against an older analyzer, so run everything through
[tool/flutter.sh](tool/flutter.sh): `tool/flutter.sh test | analyze | pub get | gen-l10n` (`./run.sh`,
`./build_bundle.sh`, `./build_ipa.sh` already do). It finds the pinned SDK on `PATH`, or `FLUTTER_SDK=` in `config.sh`.

A build with the wrong SDK (a bare `flutter`, an IDE's Dart daemon) leaves `.dart_tool` unusable for the
right one: `Invalid kernel binary format version` or `ui.HitTestResponse` not found. Not a code bug — the
next `tool/flutter.sh` run deletes the stale native-asset hook dirs and re-runs `pub get`. VS Code: set
`dart.flutterSdkPath` to the pinned SDK in `.vscode/settings.json`. To move SDK, change `.flutter-version`
and `pubspec.yaml` (`sdk: ^3.12.2`) together.

## Build-time configuration

Nothing that differs per environment is committed. Every `--dart-define` has a working default:

| Define | Default | Why |
|---|---|---|
| `API_BASE_URL` | `https://api.hariharibol.com` | Point a debug build at a laptop. Android emulators reach the host at `10.0.2.2`. |
| `GOOGLE_SERVER_CLIENT_ID` | — | The **web** client id. Android needs it as `serverClientId` or Google returns no ID token. |
| `GOOGLE_IOS_CLIENT_ID` | — | Normally read from `GoogleService-Info.plist`; exists because that file is a secret. |
| `TTS_MODELS_MANIFEST_URL` | bundled `assets/tts/tts_models.json` | Replaces the voice manifest at run time ("Spoken meaning and purport"). |
| `AUTO_CHANT_MODEL_URL` | — | Without it the optional 365 MB recogniser is never offered ("The chant counter"). |
| `AUTO_CHANT_LOG` | on in debug/profile, off in release | Auto-count console log. |

**Firebase is optional at boot.** Its config files are secrets and not in the repository, so
`FirebaseService.init()` catches its own failure: push and analytics go quiet, App Check returns no token,
everything else works (the backend's `APP_CHECK_ENABLED=false` in development is the other half).

## Structure

```
app/lib/
├── main.dart                    # boot only — storage, device, firebase, session, runApp
├── app.dart                     # MaterialApp.router: theme, l10n, router
├── l10n/                        # app_en.arb + 11 app_xx.arb + README.md + generated/ (`flutter gen-l10n`)
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

`providers/` is not a layer — it holds the Riverpod objects that connect a service to a view. Services do
the work; providers make the result watchable.

## Files and widgets

- **500 lines maximum per dart file**; aim well below it.
- **`views/` is one level deep** — a single subdir per module (`auth`, `dashboard`), and each dashboard tab its own dart file. Views stay thin: layout and wiring, not widget definitions.
- **Custom widgets live in `widgets/{module}/{widget_name}.dart`**, never in the view file — unless extracting one would cost more than it saves.

## Design language

An **editorial layout on warm paper**, not a Material dashboard. Every screen is built from the same few pieces; don't re-invent them per view.

- **Palette** — `core/theme/app_colors.dart`; both `ColorScheme`s are written out by hand in `AppTheme._scheme`.
- **Heading serif** — `AppTypography.serif` (Georgia, Noto Serif on Android; **nothing bundled**) on `display*` and `headline*` at **regular weight**: hierarchy comes from size and space, not bold. `AppTypography.numeral` is serif figures for counts and streaks.
- **`AppTypography.eyebrow`** (`widgets/common/eyebrow.dart`) — letterspaced small caps naming a block. Pass sentence case; the widget uppercases.
- **`Motif` / `MotifPanel`** (`widgets/common/motif.dart`) — lotus, sun, crescent line art, **drawn not shipped**, coloured by the card it lands on. It is the fallback for a missing image, never a grey box.

### The colour rule

**Light mode is dark orange, saffron and white. Dark mode is black and white. There is no fourth colour, in either.** Light has no grey (neutrals are tints and shades of the one orange hue); dark has no orange (it glows on black and pulls the eye off the verse, so the accent is white).

- **Never `ColorScheme.fromSeed`** — it derives a tertiary by rotating the hue. Both schemes state every role.
- **Never `Colors.*`** except `Colors.transparent`; no `Color(0xFF…)` outside `app_colors.dart` (motif gradients are `AppColors.panelFrom`/`panelTo`).
- **Saffron is a fill, never text** (about 2:1 on white); what sits on it is `ink`.
- **One exception:** the weekday initials in the routine date strip (`AppColors.weekdayLight`/`weekdayDark`). Decoration only.
- **Colour never carries meaning alone.** No green for success or red for danger; every state also has an icon or a word.

`test/palette_test.dart` checks the hue of every role in both schemes and 4.5:1 contrast for body and muted text.

Also: **cards are a lighter plane with a hairline, never a shadow** (the `cardTheme` does it — no hand-rolled `BoxDecoration`); **Devanagari never takes the serif** (verse text uses `AppTypography.verse`, which carries the extra leading matras need); **no control that does nothing** — ship the section without the affordance.

## The chant counter

`views/chant/chant_view.dart`. A `ChantRecorder` (`services/chant_recorder.dart`, pure Dart, clock injected) stamps every tap: a round is the next `beadsPerRound` taps, so a round's start, end and duration are read off the taps, not stored. A chant's duration is its **gap** since the tap before it; the first tap of a sitting has none and every average leaves it out. Changed rounds go up with the 2-second session sync (`PUT …/chant/session/:id/detail`, idempotent per round); a failed send is put back on the recorder.

- **Word detection** (`chant_speech_listener.dart`) is a separate switch from auto-count. It runs on the phone with sherpa-onnx and the same bundled model — offline, no Google/Apple speech service — and is English-trained, so Sanskrit is approximate. Each tap's words go to `…/transcripts`, which the server **deletes after 7 days**. Audio is never recorded or uploaded.
- **Auto-count** (`mantra_auto_chant_session.dart`): a VAD gates the recogniser, and a repetition counts when the transcript matches one of the mantra's `chantPhrases` by **≥ 36%** (`AutoChantConfig.matchThreshold` — the one number to change; `mantra_phrase_matcher.dart`), and it counts as soon as it settles, **without waiting for a pause**, so an unbroken chant is counted as it goes. The bundled English model writes Sanskrit as loose syllables, so the old 50% left real chanting uncounted; the price is that other speech reaches the bar more easily (plain English scored 18–27% against the Mahamantra in the tests). The first count in a stretch needs the 36% whatever the mantra; a further one in the same stretch needs more when the phrase is very short. The downloadable recogniser keeps its own 50% bar (`accurateMatchThreshold`). Phrases come from the API per mantra (seed `backend/prisma/seed/chant-phrases.js`, fallback `transliteration`), so a new mantra needs no app change. Tuning is in `AutoChantConfig`. A short phrase must end near the start of what was heard (`shortPhraseReach`), or a lone "Om" is counted inside any sentence containing the sound (99 false counts in 24 minutes of speech, now 1).
  - **Two recognisers.** The bundled English one (6 MB) is the default and the fallback. A person can instead download **Omnilingual ASR 300M** (365 MB, `mantra_accurate_model.dart`), which writes Devanagari, is held to 50% (`accurateMatchThreshold`; the offline bench's no-false-counts-in-24-minutes result was at 65% and has **not been re-run at 50%**) and is also matched against `Mantra.scriptPhrase`; every Indic script is folded to the same sounds first (`indic_sounds.dart`). **Not offered until `AUTO_CHANT_MODEL_URL` is set**, nor on a phone under `accurateMinRamMegabytes`. Numbers and why: `tool/auto_chant_bench/`, `assets/models/auto_chant/NOTICE.md`. **Not yet tried on a phone:** latency (about 0.35x real time on one desktop thread, so a 3 s chant may be counted 1–3 s after it ends) and memory.
    **For testing, an Android debug build can carry it inside the app** (`tool/fetch_auto_chant_model.sh` puts the two files, checked against the same SHA-256s, in the git-ignored `android/app/src/debug/assets/auto_chant/`; profile and release builds never include them). `MantraAccurateModel.adoptBundled` copies them out of the package (`MainActivity.kt`, off the main thread, never held whole in memory) into the folder a download uses the first time the setup sheet or the engine needs them, so the sheet says it is on with no download and no `AUTO_CHANT_MODEL_URL`. A phone under `accurateMinRamMegabytes` is never given the copy, and **Remove stays removed** (a marker beside the folder) — only a reinstall brings it back. iOS has no equivalent.
  - **The virtual pause** (`chant_virtual_pause.dart`, `AutoChantConfig.virtualPause*`). The sharper recogniser decodes a stretch of voice only once it ends, and a chant with no pause never ends. So each mantra has a *standard chanting time* — `Mantra.durationMs` (admin **Mantras** page), or, where it has none, `chantSecondsPerLetter` × the letters of its standard phrase (`MantraAutoChantSession.standardChantMs`) — and once a stretch has run 80% of it the next dip in the voice ends it; with no dip it ends at 140%. The microphone keeps recording and the next stretch starts at once: only the audio handed to the recogniser is cut. One repetition per piece is counted soon after it is said instead of in a lump up to 12 s later, and a repetition is not halved by a fixed time limit. The bundled English recogniser streams and counts as it goes, so it has no use for this. Log lines: `worker: virtual pause …`. The numbers are tuned on synthetic tones, not on a real chanter — see `test/chant_virtual_pause_test.dart`.
  - **Going to the background and coming back.** On `paused` auto-count stops (the mic does not listen unseen) and `MantraAutoChantSession.suspend` remembers it was on; on `resumed` `resume` starts it again — the person is not left with a dead counter after a glance at another app. Switching it off (or the recording starting) clears that memory, so it does not turn itself back on against their wishes. Starts and stops run one at a time in order, and a start still loading the recogniser when the app is sent away gives up rather than leave the mic on. Word detection is not restarted. Not covered by a test (the session builds its own microphone and engine), so try it on a phone.
  - **It logs** (`auto_chant_log.dart`; lines start `[AutoChant hh:mm:ss.mmm]`; on in debug/profile, off in release unless `AUTO_CHANT_LOG=true`). The lines carry what was heard — developer console only, never analytics. Auto-count prints `heard: "…"` with how much of the mantra it was and what it needed (`— 62% of the mantra, needs 50%`) next to `COUNTED +n` / `NOT counted`; word detection prints `words heard: "…"`.
- **"Heard live" card** (`widgets/chant/chant_heard_card.dart`, under the undo button): the words the phone is hearing as they come, a bar for how near they came to the mantra with a tick at the mark they had to reach (`heard_match_meter.dart`), *Counted +n* / *Not counted* (icon and words, not colour), and the few stretches before. It reads a `HeardWords` notifier (`services/heard_words.dart`, pure Dart) that **`MantraAutoChantSession.hearing`** and **`ChantSpeechListener.hearing`** each own and fill from their transcripts; it takes no part in counting. Auto-count's is shown when both are on (it also knows the match); the card is absent when neither is. The running line keeps its last `AutoChantConfig.heardLiveWords` words so a long unbroken chant doesn't grow it. "Not counted" waits for the stretch to end. The words are the recogniser's own but **only ever in Devanagari or Roman**: `HeardWords.hear` runs them through `readableScripts` (`indic_sounds.dart`), which moves every other Indic script onto Devanagari (`રામ` → `राम`) and drops anything else — the sharper model has no language setting and will write a chant in Urdu or Chinese letters. It is a display filter and nothing more: the phrase matcher is still given the text as heard (Om Namah Shivaya often comes out in Urdu letters and would otherwise never count), and the console log keeps the raw text, adding `— the card shows "…"` when it differs. A stretch with nothing readable in it is not kept as a line, though a repetition it counted still counts. With the bundled English model a Sanskrit mantra shows as English-sounding words; that is the model, not a bug. Forcing the model itself to write Devanagari only (pushing every other script's output bias to −1000) was tried and **rejected**: it removes the Urdu but returns empty text for short Om / Rama chants, which the model spreads across scripts. `test/heard_words_test.dart`, `test/chant_heard_card_test.dart`.
- **Setup is one sheet** (`widgets/chant/chant_setup_sheet.dart`). Auto-count and word detection each have their own `record` recorder and both want the microphone; whether they can run together is per device — check on hardware before promising both.
- **Chant along** (a mantra's mala recording): `Mantra.malaAudioUrl` / `malaAudioStartMs` / `malaAudioEndMs`, and `hasMalaAudio` is false unless the end is after the start. `widgets/chant/chant_along_card.dart` plays it; the stretch is split evenly into one round's beads and a chant is counted as it **finishes** (`chant_mala_timing.dart`, pure; `chant_mala_player.dart`, `just_audio`). Other halves: [backend/CLAUDE.md](../backend/CLAUDE.md), [admin/CLAUDE.md](../admin/CLAUDE.md).
  - **Only listening counts.** A seek (the bar, or a jump of more than `ChantAudioConfig.continuousStep`) counts nothing; playing a stretch again counts it again.
  - **The mic features rest while it plays** (the speaker would be heard as chanting): starting the recording switches them off, and turning either on pauses it.
  - **It stops when the person does** (background, sitting closed). While it plays the screen is held awake (`wakelock_plus`) — a locked screen stops the audio and the count. `ChantMalaPlayer.dispose` lets the screen go *first*.
  - **A stale link is asked for again once** (signed for an hour): `MantraService.get` re-fetches before the card says it failed.
  - **Tests** swap `malaAudioPlayerProvider` for `FakeAudioPlayer` / `FakeWakelock` (`test/fake_audio_player.dart`). Under `testWidgets` a stream `cancel()` doesn't finish during `pump`, and frames stop once the lifecycle is `paused` — resume before leaving the screen. **Not yet tried by hand on a phone:** playback itself.

## The routine tab

`views/dashboard/routine_tab.dart`: a strip of days (`widgets/routine/routine_date_strip.dart`; 120 back, 60 ahead — `RoutineConfig`) over the list for the day picked.

- **Each day has its own list.** A task is added *for* a day (`RoutineTask.day`). The optional **daily routine** (`DailyRoutineItem`) shows on every day from the day it was added, each day keeping its own check (`routine.checks`, `{day: [ids]}`). Removing a daily item sets its `until` rather than deleting it, so past days still show it. Days are `yyyy-MM-dd` keys (`routineDayKey`).
- **Device-only**, in `LocalStore` (`routine.tasks`, `routine.daily`, `routine.checks`); tasks saved before they had a day are dated to the old `routine.date` on first read.
- **Ekadashi is computed on the phone** (`services/ekadashi_calendar.dart`, Meeus's low-precision sun and moon: the 11th tithi of either fortnight, judged at 06:00 local). It matches the 2025 almanac (`test/routine_test.dart`) but **can differ from a temple's printed date by a day** — the Vaishnava Dvadashi rules aren't applied. A day holding two sunrises of the tithi is marked on both.
- A date chip's weekday initial follows the locale (`DateFormat('EEEEE')`) and its semantic label carries the full date, "Ekadashi" and "n of m done" — colour is never the only signal. The tilak and the peacock feather (the Reels button, `NavAction.iconBuilder`) are drawn, not shipped.

## The launch animation

`views/splash/splash_view.dart` plays a 2.6 s sequence over `widgets/splash/`. **Every number — beat timings, curves, sizes, alphas — is in `core/constants/splash_config.dart`**; retime it there, not in the widgets.

- **The router holds the splash.** The session is restored before `runApp`, so without a hold the splash would last one frame. `SplashGate` (`core/navigation/`) is shut at launch; the redirect leaves `/splash` alone until the view opens it (a tap opens it early). Deep links are untouched. **Reduce-motion** shows the finished logo for `reducedMotionHold` and moves nothing.
- **The last frame is exactly the asset.** The logo is uncovered outward from the eye of the feather (`bloom`), comes into focus (`focus`) and takes one sheen (`glint`), and each winds back to nothing. Keep the widget tree identical on every frame — adding or dropping a layer re-mounts the image.
- **The eye** (`SplashConfig.logoEye`, a fraction of the logo's size, measured off `assets/hariharibol_trprt.png`) is where the light, rings and reveal spread from. **A different picture means measuring it again.** The logo keeps its own colours in both themes — artwork, not UI.
- **The native launch screens are plain ground, no logo** (a static one would pop when Flutter's first frame replaced it): iOS `LaunchScreen.storyboard` over the `LaunchGround` colour set, Android `launch_ground` in `values/` and `values-night/`. All three **must equal `AppColors.paper` / `paperDark`**; native files can't import a Dart constant, so retuning the palette means editing them by hand.
- **Tests.** `SplashGate.instance.open()` in `setUp` lets router tests reach their screen (the `launch animation` group in `test/auth_flow_test.dart` closes it to test the hold). `test/splash_logo_test.dart` checks the last frame equals the plain asset pixel for pixel.

## Logos and app icons

Two pictures, one job each — don't add a third.

- **`assets/hariharibol_trprt.png`** (transparent) is the logo the app *shows* (splash, sign-in), always through `AppAssets.logo`. It is the only logo under `assets:` in `pubspec.yaml`.
- **`assets/hariharibol.png`** (square, on white) is the *icon master*: launcher icons are cut from it and it ships as those, so it is deliberately **not** in `pubspec.yaml`.

`python3 tool/generate_app_icons.py` (needs Pillow) rewrites every launcher icon from the master: all of iOS `AppIcon.appiconset` (flattened to opaque RGB — the App Store rejects alpha) and Android's legacy `mipmap-*/ic_launcher.png` plus the adaptive `ic_launcher_foreground.png`. The adaptive XML and its white background (`ic_launcher_background` in `values/colors.xml`) are hand-written; the script leaves them alone.

- A launcher crops an adaptive icon to its own mask; only a circle 66/108 across is never cut, so the artwork is shrunk (`ADAPTIVE_INSET`) to keep its farthest point inside. Change the master's shape and recheck it against a circular mask.
- There is no monochrome (themed-icon) layer: the logo is multi-colour and a themed icon needs a single-colour silhouette.

## Push notifications

Firebase shows the notification itself while the app is closed or in the background; the app's part is how it looks and where a tap goes. **While the app is open Android shows nothing**, so there is nothing to tap.

- **The small icon is `android/app/src/main/res/drawable/ic_stat_feather.xml`**, named in `AndroidManifest.xml` as `com.google.firebase.messaging.default_notification_icon`, with `notification_accent` (saffron, in `values/colors.xml`) as the colour. Android paints a notification's small icon as one flat colour and ignores the rest, so it must be a single-colour shape — without one it falls back to the launcher icon, which is drawn as a plain square. It is the peacock feather the Reels button draws (`PeacockFeatherIcon`), filled instead of outlined. It is not cut from the logo (a silhouette of that is a blob), so `tool/generate_app_icons.py` does not touch it. The accent must equal `AppColors.saffron`. iOS shows the app icon and needs nothing.
- **A tap opens what the notification points at** (`services/push_link.dart`): `FcmService` hands the payload of a tap — from the background (`onMessageOpenedApp`) or one that launched the app (`getInitialMessage`) — to `PushLinks`, which holds it until `DashboardView` is on screen (signed in, past the launch animation and the language picker) and then pushes the route *over* it, so back lands on Home. `pushRoute` decides the route: a verse's place in its book (`bookSlug`, `cantoNumber`, `chapterNumber`, `verseNumber` — the daily sloka sends these, so a tap needs no lookup and works offline) opens that chapter scrolled to the verse; otherwise the `hariharibol://sadhana` / `premium` deeplink; anything else just opens the app. The data keys are `PushConfig`'s and must match what the backend sends. `test/push_link_test.dart`.
- **Not yet tried on a phone:** the icon and the tap from a real push. The logic is covered; the Firebase and Android wiring is not.

## State and storage

- **Riverpod** everywhere — no second state solution. A Drift stream becomes a provider directly, so offline data and UI state share one mechanism, and views stay small (the 500-line rule depends on it).
- **Drift** (SQLite: type-safe, reactive streams, FTS5 for verse search) holds the offline library — the content is relational (books → cantos → chapters → verses, translations, mantras). ObjectBox is the only other serious option; revisit it only if device sync is ever needed (the backend owns sync).
- **Do not use** Realm (Atlas Device SDKs deprecated Sept 2024, support ended Sept 2025), Isar (stalled), or original `hive` (unmaintained — use `hive_ce` for key-value storage).

## Silent offline books

Opening a book makes it readable offline, with no prompt and no progress screen. The server exports each chapter (Gita) or canto (Bhagavatam) to S3 weekly; the app downloads only what it lacks, straight from S3 — see [backend/README.md](../backend/README.md#book-cache--silent-offline-books).

`BookSyncManager.syncBook` → manifest → `BookSyncPlanner` (missing / newer / different hash; the unit being read first, then neighbours) → queue (2 at once, de-duplicated, paused offline) → `BookUnitDownloader` (S3 with timeouts, backoff, `Range` resume, one link refresh) → isolate (gunzip + SHA-256 + parse) → `BookDao.replaceUnit`.

- **`db/`** — Drift v2: `books`, `units` (cantos and chapters), `verses`, `verse_translations` (every language of every verse), `download_state`, and the FTS5 table `verse_fts` (made in `SearchDao.createIndex`, not a Drift table). `BookDao.replaceUnit` is the **one** writer and works in one transaction, so a unit is never half-updated. Version 1 (a one-language cache) is dropped on upgrade; the sync refills it.
- **`repositories/book_repository.dart`** is the only thing screens ask for book text: local first; a unit not on the phone is queued at the front and awaited (`readerWait`), and only then does it fall back to the API. Short works (no chapters) aren't exported; they come from the API and are saved whole (`unitType: 'book'`).
- **Language is chosen at read time**, not download time — every language is on the phone (`BookRepository.pickTranslation`).
- **The file carries audio keys, never links** (a link would change the hash hourly): `Verse.audioPath` is a key, `Verse.audioUrl` a link, and links come from `/audio-urls`.
- **A `done` unit keeps its old text** while a newer version downloads, and if that fails. A failed unit is retried when its book opens, when the network returns, and at launch, until `BookSyncConfig.autoRetryLimit`.
- **Background** (`book_sync_background.dart`, workmanager) finishes unfinished units when the app is backgrounded (network connected, battery not low); the sync endpoints are public, so no sign-in is needed. **Not exercised on a device:** iOS needs `BGTaskSchedulerPermittedIdentifiers`, `UIBackgroundModes: processing` and `WorkmanagerPlugin.registerBGProcessingTask` in `AppDelegate.swift` — try it before relying on it.
- Tests: `test/book_*_test.dart`, fakes in `test/support/`.

## Three languages

Three settings, each its own, stored on the device (`providers/language_settings_provider.dart`, `models/language_settings.dart`); changing one never changes another.

| Setting | Drives | Default |
|---|---|---|
| **App** | menus, buttons, labels — the UI locale (`appLocaleProvider`); only a language with an ARB file (otherwise the choice is kept and the UI stays in a shipped language) | device language if shipped, else English |
| **Reading** | translation, meaning, purport on screen (`readingChainProvider`: reading → app → en) | device language, else English |
| **Speaking** | verse audio and spoken meaning/purport (`speakingChainProvider`: speaking → en) | device language, else English |

First value: stored → the account's own choice (app and reading only) → the phone's language → English. App and reading are also sent to the account, best effort (the server shapes some responses by them); speaking has no server field. Sanskrit verse text is always Sanskrit — it is not one of the three. Settings → **Languages** has a row and picker for each. `test/language_settings_test.dart`.

## A verse on the reading screen

`widgets/library/verse_block.dart` draws every verse (the chapter reader and short works alike), top to bottom: Devanagari → transliteration → **Word meanings** → translation → purport.

- **Word meanings** (`word_meanings_section.dart`) is closed until opened. Open or closed is **one setting for every verse**, kept on the device (`wordMeaningsOpenProvider`, `BoxKeys.wordMeaningsOpen`), not per verse. One row to a word — the Sanskrit left, its meaning right; a word with no Sanskrit shows only its meaning. A verse with no word-for-word draws **nothing**, not a heading over an empty list; likewise a verse with no Devanagari just starts at the transliteration.
- The purport and "Word meanings" share `collapsible_section.dart`. The purport is shut again each time a verse is built; only Word meanings is remembered.
- **A poetic expansion is never the default rendering** (`BookRepository.pickTranslation`, mirrored on the server by `language.pickTranslation`): Dnyaneshwari's Marathi ovis on the Gita are the *secondary* version, reached through "Compare translations", and open by default only when a verse has nothing else in the reader's chain. A Marathi reader therefore gets the next language (English) until a standard Marathi translation is added. `test/pick_translation_test.dart`, `test/verse_word_meanings_test.dart`. (A widget test cannot await a `LocalStore` write under its fake clock — the word-meanings widget tests swap the provider for an in-memory one.)
- **Spoken meaning is not covered by that rule yet:** `spokenRenderings` hands over every language and the speaking chain picks, so a Marathi speaking language would read the ovi as the meaning.

## Reading aloud

A play button on each verse (only where there is something to play) and **Read aloud** at the top of the page. Each verse is: its recitation (if it has audio) → the meaning → the purport. `ReadingAudio` → `ReadingPlaybackController` (run-numbered loop) → `VerseAudioCache` + `AudioLinkResolver` (`POST /audio-urls`, link remembered 50 min) for recitations, `AdaptiveTtsEngine` for speech.

- **What is said follows the *speaking* language**, not what is on screen: `BookRepository.spokenRenderings` + `ReadingItems.build` pick the meaning and purport per speaking chain, and the first candidate a voice exists for is spoken. `wordMeanings: true` puts the word-for-word breakdown before the meaning.
- **Recitations** download on first play and are kept (`VerseAudioCache`, 200 MB LRU); the next verse is fetched while this one plays. A verse with no audio, or one that won't load, is skipped silently. The last verse per chapter is remembered (`ReadingMemory`). **Which file a verse has is the server's decision**: its own `audioPath`, or the recording in its book's `recitationParent` folder (the Gita's — see "Verse recitations" in [backend/CLAUDE.md](../backend/CLAUDE.md)). The app only sees a key, so it has no folder logic and a book gains recitations without an app release; a phone shows them once its copy of the book has synced again.
- **Background and the lock screen:** `audio_service` with our own `ReadingAudioHandler`. **`just_audio_background` is not used** — it makes *every* `AudioPlayer` require a `MediaItem` tag, which would break the chant-along player and the reels soundtrack. Android: `AudioServiceActivity`, the service + receiver and media-playback foreground permissions are in `AndroidManifest.xml`; iOS: `UIBackgroundModes` has `audio`.
- **Interruptions** (`InterruptionPolicy`, over `audio_session`): a call or another app's audio pauses and resumes when the system allows; unplugged headphones pause and never auto-resume; a reader's own pause is never undone.
- **Not yet tried on a phone:** the lock-screen controls, the foreground service, audio focus with a real call. The logic is covered with fake players (`test/reading_playback_test.dart`, `reading_audio_ui_test.dart`); the platform wiring is not.

## Spoken meaning and purport (voices)

One interface, `TtsEngine`, so an engine can be swapped: `SherpaTtsEngine` (offline neural), `PlatformTtsEngine` (`flutter_tts`) and `AdaptiveTtsEngine`, which the player uses — neural when a voice is installed for the language, the phone's voice otherwise (and again from the failed chunk if the neural one dies part-way). **Speech never waits on a download.** Text is split into chunks of at most 220 characters (`TextChunker`) and chunk N+1 is requested before N finishes (`ChunkedSpeaker`); `SherpaSynthesizer` runs in its own isolate, so the UI thread only receives finished audio.

- **`TtsModelManager`** maps each language to a voice from a manifest — the bundled `assets/tts/tts_models.json`, replaced at run time by `TTS_MODELS_MANIFEST_URL` (cached for offline). Downloads resume (`Range`), back off, **check SHA-256 before anything is unpacked** and install by renaming a finished folder into place. They start on their own only on Wi-Fi; Settings → Voices downloads and deletes by hand anywhere.
- **A voice with no checksum is never installed.** The bundled manifest lists candidates as `enabled: false` with empty url/sha256, because their files could not be confirmed to exist or checksummed when this was written (GitHub releases and Hugging Face were unreachable from the build environment). Until someone downloads an archive, runs `shasum -a 256` on it, fills `url`, `sizeBytes`, `sha256` and sets `enabled: true`, every language uses the phone's voice.
- **Why this engine.** sherpa-onnx + Piper (VITS): `sherpa_onnx` is already in the app for auto-count, it is offline, runs on Android and iOS, and the engine is Apache-2.0 (**each voice has its own licence card**). MMS-TTS covers more Indic languages but is **CC-BY-NC, non-commercial** — listed, disabled, not for a commercial build without a licence decision. Kokoro is too big for the gain; AI4Bharat IndicTTS / Indic-Parler have the best Indic quality but need an ONNX export. The platform voice is always the fallback. This is from knowledge of the projects, not a check of their release pages — verify a voice before enabling it. Quality and latency on a mid-range phone are **not measured**.

## Session and tokens

- **One session singleton** owns both tokens; nothing else reads or writes them. They are persisted with **`flutter_secure_storage`** (Keychain / Keystore) — credentials don't belong in a plain database file. Non-sensitive session state (last user, preferences, cached flags) uses **`hive_ce`**.
- **Refresh token: 1 year**, re-issued every time it is used. **Access token: 7 days**, rotated **silently** — the user must never see an auth interruption, a re-login prompt, or a failed request caused by rotation. A request that fails on an expired access token is retried transparently after refresh.

## Authentication

- **Google and Apple sign-in only** — no email/password, no OTP. Keep it fast: the best-maintained packages and the fewest round trips.
- The backend requires proof that account creation came from a real client, so sign-up carries a client attestation token — see [backend/CLAUDE.md](../backend/CLAUDE.md).

## Services and navigation

- `services/` holds all services (FCM, socket, tracking/Firebase Analytics, …) — one self-contained file each.
- **go_router** through **a single navigation singleton**: views call it and never touch `Navigator`. It also owns the **loading handler**, so loading dialogs show and dismiss consistently, without leaks or stuck overlays.

## Decisions needed

- **Access token lifetime.** 7 days is long for an access token (typical is minutes to hours): a stolen token stays valid for a week and can't easily be revoked. The 1-year rotating refresh token already gives "never asked to log in again", so a shorter access token costs nothing in UX. Worth reconsidering.

## Firebase and signing

Both are secrets and neither is in the repository, so a fresh clone must build without them: the google-services Gradle plugin is applied only when `android/app/google-services.json` exists, the release signing config only when `android/key.properties` does, and `FirebaseService` records a failed init rather than crashing. Nothing here is optional in a real build.

| What | Where it comes from | Lands at |
|---|---|---|
| Firebase config | `flutterfire configure --project=hari-hari-bol` | `android/app/google-services.json`, `ios/Runner/GoogleService-Info.plist`, `lib/firebase_options.dart` |
| Signing keystore | `../hariharibol-local-secrets/` (identical copy in the old `sadhana` app) | `android/app/key.jks`, `android/key.properties` |

- **Identity is fixed:** `com.sss.ramkrishnahari` on both platforms, Firebase project `hari-hari-bol`. It matches the existing store listings, which is what keeps the Play upload and the irreplaceable keystore usable — changing it orphans the listing and every installed copy. Don't let `flutter create` reset it.
- **Google Sign-In needs the signing SHA registered with Firebase**, or Android fails with a bare `DEVELOPER_ERROR`. Release and debug SHA-1 and SHA-256 are registered; add a machine's own debug SHA with `firebase apps:android:sha:create <androidAppId> <sha>`. **Play App Signing re-signs the upload**, so the SHA-1 from the Play Console must be registered too before sign-in works on a store build.
- The Gradle plugin turns `google-services.json` into `default_web_client_id`, the `serverClientId` google_sign_in needs to get an ID token at all. iOS reads its client id from `GoogleService-Info.plist` and needs `REVERSED_CLIENT_ID` as a URL scheme in `Info.plist`.
- The backend verifies the ID token's audience against `GOOGLE_CLIENT_IDS` and `APPLE_BUNDLE_IDS`; they must list these same client ids or every sign-in is rejected as unverifiable.
- **iOS minimum is 15.0** — the Firebase iOS SDK requires it. It is set in `Runner.xcodeproj` and the `Podfile`; both must agree.

## Notes carried over

- The previous Flutter app is archived on the `unorganized` branch at `mobile_app/` — reference only, not a base to copy.
- The Android signing keystore (`key.jks`, `key.properties`) and Firebase configs are backed up outside the repo at `../hariharibol-local-secrets/`. The keystore is irreplaceable — losing it blocks Play Store updates for the existing listing.
