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

**The Play bundle** is `./build_bundle.sh` → `build/app/outputs/bundle/release/app-release.aab`. It always uses
`https://api.hariharibol.com` and **ignores `API_BASE_URL` in `config.sh`** (that file is for running on a laptop and
usually says `localhost`); `RELEASE_API_BASE_URL=https://…` builds against something else, and anything not `https://`
is refused. **No code or resource shrinking**: `shrink=false` in `android/gradle.properties` (Flutter's Gradle plugin
turns R8 on unless it is false), so a release has no `mapping.txt` and class names are intact. The build number is the
`+N` in `pubspec.yaml`; Play refuses an upload whose number it has already seen, so raise it before each upload.
`build_ipa.sh` does not have the production guard yet.

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
- **Two exceptions, both in the routine tab.** The weekday initials in the date strip (`AppColors.weekdayLight`/`weekdayDark`), decoration only. And **how on time a ticked task was**: yellow early, green on time, red late (`AppColors.early/onTime/late`, `earlyLight` … `lateDark`). The owner asked for exactly those three, and they are the one place where the colour *is* the information a person scans for — but they are never alone: every status also has a word ("Early", "On time", "Late") on the pill and a check mark, and the words are in ordinary ink. Light yellow is a dark amber (`B07A00`) because `CA8A04` was 2.94:1 on the card. `test/routine_status_test.dart` holds all three to 3:1 against the card in both themes and checks the words stay readable over their wash.
- **Colour never carries meaning alone.** No green for success or red for danger outside that exception; every state also has an icon or a word.

`test/palette_test.dart` checks the hue of every role in both schemes and 4.5:1 contrast for body and muted text.

Also: **cards are a lighter plane with a hairline, never a shadow** (the `cardTheme` does it — no hand-rolled `BoxDecoration`); **Devanagari never takes the serif** (verse text uses `AppTypography.verse`, which carries the extra leading matras need); **no control that does nothing** — ship the section without the affordance.

## The chant counter

`views/chant/chant_view.dart`. A `ChantRecorder` (`services/chant_recorder.dart`, pure Dart, clock injected) stamps every tap: a round is the next `beadsPerRound` taps, so a round's start, end and duration are read off the taps, not stored. A chant's duration is its **gap** since the tap before it; the first tap of a sitting has none and every average leaves it out. **The taps stay in memory** — a round goes up as a summary (beads, start, end, duration, mean gap; `ChantMalaLog.toJson`), never as its taps, and the analytics show rounds only. A round carried over from an earlier sitting (below) has no known duration: it shows "–" and is left out of the averages and the fastest. Changed rounds go up with the session sync (`PATCH …/chant/session/:id` for the totals, then `PUT …/chant/session/:id/detail`, idempotent per round); a failed send is put back on the recorder. **The sync is batched, not per chant**: the first tap after a send starts a `ChantSyncConfig.batchInterval` (30 s) timer that later taps do not restart, so a sitting costs two requests every 30 s however fast it is chanted. Closing the counter and sending the app to the background send at once; only the app being *killed* can lose up to one interval. It used to wait for 2 s of quiet, which a chant outlasts, so nearly every chant sent two requests (and the server's 60-writes-a-minute limit was in reach).

- **Auto count counts sound, at the mantra's own speed.** A small voice detector (Silero VAD, `mantra_detection_engine.dart`, the only model) says whether anyone is making sound, and `voice_chant_counter.dart` (pure Dart, injected clock, `test/voice_chant_counter_test.dart`) counts **one chant per standard time of sound** (`Mantra.durationMs`, "Standard chanting time" in ms): none while silent, resuming when sound returns, and a last unfinished chant counts if ≥ 60% was chanted (`partialChantShare`). Chanting faster than the standard time is counted at the standard pace; slower is counted as it comes. A mantra with no standard time uses 0.1 s × the letters of its text, never under 1 s (`MantraAutoChantSession.standardChantMsOf`) — a guess, so set the real time on the admin Mantras page (the mahamantra is 4000). **Nothing is recognised**, so it works for Sanskrit as for anything else.
  - **A sitting speeds up.** Each chant counted is taken to last 1% less than the one before (`AutoChantConfig.speedUpPerChant`), down to 65% of the standard time (`fastestShare`, reached after about 43 chants), because a devotee chants faster as they settle. It is reset by closing the counter; both numbers are in `AutoChantConfig` — raise them if auto count falls behind, lower them if it runs ahead.
  - **With the switch off, a tap needs a chant's worth of time behind it.** A hand tap sooner than half of the standard time (`manualTapGapShare`, `MantraAutoChantSession.manualTapGapOf`; the standard time itself, not the sped-up one) after the last is ignored, silently, or the count would run ahead of the chanting. The first tap of a sitting is always taken, and so is any tap with no mantra (no standard time). With auto count on the sound is the count and a tap is only a correction.
  - **Why not words.** It used to listen with a 6 MB English-only recogniser and count a chant when it wrote one of the mantra's allowed English words. On a phone it wrote "ORCHI" and "ALL NO SULA" for the mahamantra, nothing matched, and the count stayed 0. The recogniser, its model (`kws/`), `word_chant_counter.dart` and `Mantra.chantWords` are gone from the app; they are in git history. **The backend column and the admin "Allowed English words" field are still there and nothing reads them.**
  - **The switch is on the counter** (`widgets/chant/auto_chant_switch.dart`, under the undo button) for any chant that has a mantra. The choice is **remembered** (`BoxKeys.autoChantEnabled`), and the counter **starts listening by itself** when it opens if it was left on. **Leaving the counter stops it and frees the microphone, the detector isolate and the model** (`MantraAutoChantSession.dispose`). Switching it on shows a loading dialog (`_AutoChantLoadingDialog`, `chantAutoCountLoading`) until it is listening. A plain counter with no mantra has no switch (there is no standard time to count by).
  - **Foreground only.** On `paused` auto count stops (the mic does not listen unseen) and `suspend` remembers it was on; on `resumed` `resume` starts it again. Background listening was asked about and deliberately **not built** (Android 14+ needs a microphone-type foreground service). Starts and stops run one at a time, in order; a start still loading when the app is sent away gives up rather than leave the mic on. Not covered by a test (the session builds its own microphone and engine) — try it on a phone.
- **A mantra can have an opening prayer** (`Mantra.prayer`, one level: the mahamantra's is the Panchatattva mantra; set on the admin Mantras page, see "Opening prayers" in [backend/CLAUDE.md](../backend/CLAUDE.md)). The counter opens on the prayer — its name, text and `chantPrayerHint` — with the ring, the mala card and the auto-count switch held back. A tap on the ring after the prayer's own standard time brings up the mantra; **that tap is not a chant and is not recorded** (earlier ones are ignored). Counting begins there: `ChantRecorder.beginChanting()` makes the first chant, and the tap delay, run from that tap. **It comes again before every round** — the moment the last bead of a round is counted, the prayer is shown, auto count is suspended and a playing mala recording paused, so neither counts the prayer. A round picked up part-way (below) is not asked for its prayer again. `ChantView` takes a `clock` for tests (`test/chant_prayer_test.dart`).
- **The round in progress is kept on the phone, for each mantra.** `ChantProgressStore` (`services/chant_progress_store.dart`) writes one number per mantra — beads into the current round, key `BoxKeys.chantProgress(mantraId)`, `any` for the plain counter — after every bead and every undo, and forgets it when a round completes, so nothing builds up and nothing expires. Opening the same mantra again starts the recorder at that count (`ChantRecorder.carry`) instead of 0; the server needs no change, because the day's total sums finished rounds only, so the new sitting finishing the round counts it once. There is no "start the round again" button — undo takes beads back one at a time. In a widget test call `ChantProgressStore.keepInMemory()` (and `keepInStore()` after): a store write started under a test's fake clock never finishes and hangs the next test's `setUp` (see "The routine tab").
- **Analytics are for the mantra on the counter, and rounds only.** The insights button opens `ChantAnalyticsView` with the mantra's id and name (`ChantAnalyticsArgs`); the history behind it asks `GET /chant/sessions?mantraId=` (`none` for the plain counter) and lists only sittings with at least one finished round, each opening into its finished rounds (`ChantMalaTile`: beads, time, mean gap — no per-chant rows). `chantHistoryProvider` is a family on the mantra id.
- **Word transcripts are no longer recorded by the app.** `ChantRecorder.attachHeard`, `SadhanaService.saveChantTranscripts` and the server's transcripts endpoint remain (and the 7-day expiry), but nothing in the app feeds them.
- **The deity on the counter.** `Mantra.deity` carries two pictures: `imageUrl` (the list picture) and `fullImageUrl` (9:16). **A deity with a picture has it in the middle of the ring at full strength, with no number over it** (`ChantDisc.pictureUrl`; it fills the space inside the beads, in a circle with a hairline rim). The count moves to one line under the ring (`widgets/chant/chant_disc_count.dart`: rounds, their label, beads / 108; it wraps at large text sizes). A mantra with no deity picture is unchanged — the count is the middle (`MalaRing.showCount`). The ring uses `imageUrl`, or `fullImageUrl` when that is all there is (`ChantView._ringPicture`). **One expand button sits on the picture's lower-right rim** (`ChantDisc.onOpenPicture`, tooltip `chantFullPicture`; it is not a bead) and opens `views/chant/chant_fullscreen_view.dart` — the 9:16 picture filling the screen (`BoxFit.cover`), or, for a deity with only the list picture, that picture whole (`BoxFit.contain`, so nothing is cropped). **A tap anywhere in the full-screen view is a bead**, and a close button and the running count float on top; it owns no count, it listens to `_counted` on the counter. The old *Full-screen picture* text button under the switch is gone. With a picture `ChantDisc` is the ring *and* its count line, so a test that taps the ring taps `find.byType(TapScale)`, not `find.byType(ChantDisc)` (its centre is then the count line). `test/chant_disc_picture_test.dart`. Not tried on a phone.
- **"Chant now" opens the mantra you keep chanting.** `SadhanaToday.chantMantraSlug` is the mantra chosen in the profile, else `favoriteMantra` from `GET /sadhana/today` (the most rounds over 60 days), else the plain counter. Used by the Jap tab and the Home sadhana card.
- **Chant along** (a mantra's mala recording): `Mantra.malaAudioUrl` / `malaAudioStartMs` / `malaAudioEndMs`, and `hasMalaAudio` is false unless the end is after the start. `widgets/chant/chant_along_card.dart` plays it; the stretch is split evenly into one round's beads and a chant is counted as it **finishes** (`chant_mala_timing.dart`, pure; `chant_mala_player.dart`, `just_audio`). Other halves: [backend/CLAUDE.md](../backend/CLAUDE.md), [admin/CLAUDE.md](../admin/CLAUDE.md).
  - **Only listening counts.** A seek (the bar, or a jump of more than `ChantAudioConfig.continuousStep`) counts nothing; playing a stretch again counts it again.
  - **The mic features rest while it plays** (the speaker would be heard as chanting): starting the recording switches them off, and turning either on pauses it.
  - **It stops when the person does** (background, sitting closed). While it plays the screen is held awake (`wakelock_plus`) — a locked screen stops the audio and the count. `ChantMalaPlayer.dispose` lets the screen go *first*.
  - **A stale link is asked for again once** (signed for an hour): `MantraService.get` re-fetches before the card says it failed.
  - **Tests** swap `malaAudioPlayerProvider` for `FakeAudioPlayer` / `FakeWakelock` (`test/fake_audio_player.dart`). Under `testWidgets` a stream `cancel()` doesn't finish during `pump`, and frames stop once the lifecycle is `paused` — resume before leaving the screen. **Not yet tried by hand on a phone:** playback itself.

## The routine tab

`views/dashboard/routine_tab.dart`: a strip of days (`widgets/routine/routine_date_strip.dart`; 120 back, 60 ahead — `RoutineConfig`) over the list for the day picked.

- **Each day has its own list.** A task is added *for* a day (`RoutineTask.day`). The optional **daily routine** (`DailyRoutineItem`) shows on every day from the day it was added, each day keeping its own check (`routine.checks`, `{day: {id: minute|null}}`). Removing a daily item sets its `until` rather than deleting it, so past days still show it. Days are `yyyy-MM-dd` keys (`routineDayKey`).
- **Kept on the phone first, mirrored to the account.** `LocalStore` (`routine.tasks`, `routine.daily`, `routine.checks`) is what the screen reads and every change writes to before anything else, so nothing waits on the network and it works offline; tasks saved before they had a day are dated to the old `routine.date` on first read, and checks saved as `{day: [ids]}` (before times were kept) load as ticked with no time. The sync is described in the next bullet.
- **Sync** (`POST /api/app/routine/sync`, see "Routine" in [backend/CLAUDE.md](../backend/CLAUDE.md)). The routine as the server last answered is kept as the **base** (`routine.synced`, which also records its owner); what differs between the base and the routine now (`RoutineChanges.between`, `models/routine_sync.dart`) is what is sent, so no change site does any bookkeeping and a phone that already holds a routine uploads it with no migration. The server applies it and answers with the daily routine and the tasks and ticks from `since` (today − 120 days) on; `mergeSynced` takes the server's version of those days, keeps the phone's older days, and lays back any edit made while the request was away (which goes up next). **Last write wins** between phones, so a task removed on one phone and edited on another comes back. `services/routine_syncer.dart` runs it: debounced 3 s after a change (`RoutineNotifier._persist` asks), one at a time, again on app resume / pause and when the connection returns (`providers/routine_sync_provider.dart`), 30 s doubling to 15 min after a failure, **never repeated after a refusal** (400/403/404) and stopped on 401. It does nothing without a signed-in user. Requests are cut at 500 rows. Titles are cut to 200 characters when typed (`routineTitle`) and again when sent, so one over-long row can never become a request the server keeps refusing.
- **One account's routine is never uploaded into another's.** `routine.owner` says whose routine is on the phone; when a different account signs in, `RoutineNotifier.build` shows an empty list and wipes the keys and the base (unsynced offline edits of the account that left are lost). A routine from before accounts owned it is claimed by whoever opens it first; an empty one claims nothing until its first change. **Nothing is written from `build()` for an empty routine**: a Hive write started while a widget test's fake clock is running never finishes and holds the store's write lock, hanging the next test's `setUp` (this took `auth_flow_test.dart` down once; it also stubs the `connectivity_status` channel because a signed-in app now listens to it).
- **Bottom inset.** The nav bar floats over the tab and the dashboard passes its height down as `MediaQuery` bottom padding; the list and the empty state add it plus `AppSpacing.xxl` to their own padding, or the last row sits under the bar (`test/routine_layout_test.dart`).
- **A standard time range.** A task may carry a `RoutineWindow` (`windowStart`/`windowEnd`, minutes after midnight; never wraps midnight, `end > start`, `end < 1440` — `RoutineWindow.isValid`, and a stored range that is not one loads as none). Ticking notes the time (`doneAt`), and `RoutineTask.status` is `pending` / `done` (ticked, nothing to judge against) / `early` / `onTime` / `late`; **both ends of the range are on time**. The slot a task is grouped under is *derived* from where its range opens (`RoutineSlot.at`); the old Morning/Afternoon/Evening chips are gone from the sheet.
- **The add sheet** (`widgets/routine/add_routine_task_sheet.dart`): the name is an editable `DropdownMenu` over the standard routines (`core/constants/routine_presets.dart`: wake up, morning chanting, exercise, breakfast, lunch, evening chanting, dinner, scripture reading, sleep — each with a category and usual range, in the order of the day), so anything else is typed. Picking one fills the category and the range; all three can still be changed. Opening the menu lists every routine even with a name in the field; typing filters it, and a name that matches none leaves no menu at all (`menuStyle` padding is zero so an empty menu has no height) — an unfiltered menu laid over the category chips swallowed the taps meant for them. `enableSearch` is off, or "Done" would swap what was typed for the first match. The range is `RoutineWindowField` (From / To boxes opening the system time picker; a start moved past the end carries the end to start + 60 min; an invalid range says so and disables Save). **The form scrolls and Save is pinned, both above the keyboard**, and the tab's `Scaffold` has `resizeToAvoidBottomInset: false`, so nothing behind or inside the sheet overflows. A new range opens at 6:00–7:00 (`RoutineConfig`).
- **Ticking and changing the time** (`RoutineTab._toggle`/`_editTime`): tapping a row ticks it at the time it is now, or unticks it (the time goes with the tick). On a day that is not today "now" means nothing, so it asks, opening the picker at the start of the range. The pill ("On time · 6:42 AM") is its own button that changes the time; the status is worked out again. Times are shown the way the phone shows times (`TimeOfDay.format`), so 12/24-hour follows its setting. Pending is grey (icon, range), done is coloured by status (see "The colour rule").
- **Tests:** `routine_sync_model_test.dart` (changes, chunking, merge) and `routine_syncer_test.dart` (the syncer against a fake server with the real store; the notifier's ownership rules), `routine_layout_test.dart` (the bottom inset), `routine_status_test.dart` (the range, status, colours, old data), `routine_sheet_test.dart` (the sheet above the keyboard, names, ranges, chips), `routine_check_test.dart` (ticking, the pill, changing the time). A widget test that saves must `settleSaves`: a save writes three keys one after another, every step needing real time and then a pump, so it queues probe writes and pumps until they land, then ends with one write made in real time (`runAsync`). Without that last write the store's write lock ends on a future from the finished test's fake clock, and the next test's `setUp` (`LocalStore.clear()`) waits on it forever — it looks like a hang, not a failure. The time picker is driven through its keyboard entry. **`routine_check_test.dart`'s "a task from before times were kept can be given one" fails after noon**: the picker opens at the time now and the helper types an hour without choosing AM, so 6:30 becomes 6:30 PM. **Not tried by hand on a phone, and the sync has not run between a phone and a live API** (the backend has its own end-to-end walk, `npm run test:routine`).
- **Ekadashi is computed on the phone** (`services/ekadashi_calendar.dart`, Meeus's low-precision sun and moon: the 11th tithi of either fortnight, judged at 06:00 local). It matches the 2025 almanac (`test/routine_test.dart`) but **can differ from a temple's printed date by a day** — the Vaishnava Dvadashi rules aren't applied. A day holding two sunrises of the tithi is marked on both.
- A date chip's weekday initial follows the locale (`DateFormat('EEEEE')`) and its semantic label carries the full date, "Ekadashi" and "n of m done" — colour is never the only signal. The tilak is drawn, not shipped. The peacock feather (the Reels button, `NavAction.iconBuilder`) is the opposite: `PeacockFeatherIcon` draws `assets/peacock_feather.svg` (`AppAssets.peacockFeather`, `flutter_svg`) in its own colours in both themes; `test/peacock_feather_icon_test.dart` checks it renders.

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

Firebase shows the notification itself while the app is closed or in the background; the app's part is how it looks and where a tap goes. **While the app is open Android shows nothing by itself** — the app draws it instead (next bullet).

- **A push that arrives while the app is open is drawn by the app (Android).** `widgets/push/push_foreground.dart` wraps every screen (`MaterialApp.builder` in `app.dart`), listens to `FirebaseMessaging.onMessage` and hands each message that has a notification part to `LocalPushService` (`services/local_push_service.dart`, `flutter_local_notifications`). It fetches the push's picture with a plain Dio (the link is presigned — no `Authorization` header; over `PushConfig.imageMaxBytes` or failing, it is drawn without one), shows a big-picture notification (big-text without a picture) on the `PushConfig.androidChannelId` channel, and puts the push's data in the notification's payload so a tap goes through `PushLinks` like any other. **iOS is not done this way**: `FcmService.init` calls `setForegroundNotificationPresentationOptions` and the system draws it; drawing it here too would show it twice. The channel (`default`, the id the backend sends) is created with the high importance that makes a push appear on screen and is named by `pushChannelName`; the widget supplies the name because **services write no words**, and it renames the channel when the app language changes. The plugin needs Android core-library desugaring (`build.gradle.kts`). A message with no notification part is data for the app and is not drawn. Inert when Firebase is not configured. **Not tried on a phone yet** — send one with `backend/scripts/sloka-push-demo.js … --token` while the app is open.
- **The small icon is `android/app/src/main/res/drawable/ic_stat_feather.xml`**, named in `AndroidManifest.xml` as `com.google.firebase.messaging.default_notification_icon`, with `notification_accent` (saffron, in `values/colors.xml`) as the colour. Android paints a notification's small icon as one flat colour and ignores the rest, so it must be a single-colour shape — without one it falls back to the launcher icon, which is drawn as a plain square. It is the peacock feather the Reels button shows (`PeacockFeatherIcon`, from `assets/peacock_feather.svg`), as a single-colour silhouette. It is not cut from the logo (a silhouette of that is a blob), so `tool/generate_app_icons.py` does not touch it. The accent must equal `AppColors.saffron`. iOS shows the app icon and needs nothing.
- **A tap opens what the notification points at** (`services/push_link.dart`): `FcmService` hands the payload of a tap — from the background (`onMessageOpenedApp`) or one that launched the app (`getInitialMessage`) — to `PushLinks`, which holds it until `DashboardView` is on screen (signed in, past the launch animation and the language picker) and then pushes the route *over* it, so back lands on Home. `pushRoute` decides the route: a verse's place in its book (`bookSlug`, `cantoNumber`, `chapterNumber`, `verseNumber` — the daily sloka sends these, so a tap needs no lookup and works offline) opens that chapter scrolled to the verse (see below); otherwise the `hariharibol://sadhana` / `premium` deeplink; anything else just opens the app. The data keys are `PushConfig`'s and must match what the backend sends. `test/push_link_test.dart`.
- **The chapter scrolls to the tapped verse with `revealListItem`** (`widgets/library/reveal_list_item.dart`, called from `ChapterReadView._scrollToTarget`). A one-shot `Scrollable.ensureVisible` cannot work here: the chapter is a lazy `ListView`, a verse far down has no widget yet, and with no widget there is no context to scroll to. So the helper walks toward the verse — each step jumps by the items between the verse and the nearest built one, at the average height measured so far, then looks again — and once the verse exists brings it to rest. Three things it has to survive, each with a test: the list's length is only an estimate until the end is laid out, so a jump can land **past the real end** where only unkeyed items (header, footer) are built (it pulls back to the real end); the verse's offset moves while the items above it are measured (it re-checks where the verse rests and corrects, up to 3 times); and a verse **taller than the screen** (a long purport) is aligned by its top edge, because `alignment: 0.1` would put it above the top and cut its first lines off. A verse that is not in the list ends the walk (40 steps at most) instead of scrolling forever. `test/reveal_list_item_test.dart` drives a 120-verse lazy list of uneven heights, not `ChapterReadView` itself.
- **Not yet tried on a phone:** the icon, the tap from a real push, the scroll to the verse on a real chapter, and the foreground notification. The logic is covered; the Firebase and Android wiring is not.

## State and storage

- **Riverpod** everywhere — no second state solution. A Drift stream becomes a provider directly, so offline data and UI state share one mechanism, and views stay small (the 500-line rule depends on it).
- **Drift** (SQLite: type-safe, reactive streams, FTS5 for verse search) holds the offline library — the content is relational (books → cantos → chapters → verses, translations, mantras). ObjectBox is the only other serious option; revisit it only if device sync is ever needed (the backend owns sync).
- **Do not use** Realm (Atlas Device SDKs deprecated Sept 2024, support ended Sept 2025), Isar (stalled), or original `hive` (unmaintained — use `hive_ce` for key-value storage).

## Silent offline books

Opening a book makes it readable offline, with no prompt and no progress screen. The server exports each chapter (Gita) or canto (Bhagavatam) to S3 weekly; the app downloads only what it lacks, straight from S3 — see [backend/README.md](../backend/README.md#book-cache--silent-offline-books).

`BookSyncManager.syncBook` → manifest → `BookSyncPlanner` (missing / newer / different hash; the unit being read first, then neighbours) → queue (2 at once, de-duplicated, paused offline) → `BookUnitDownloader` (S3 with timeouts, backoff, `Range` resume, one link refresh) → isolate (gunzip + SHA-256 + parse) → `BookDao.replaceUnit`.

- **`db/`** — Drift, schema 4 (history in `app_database.dart`): `books`, `units` (cantos and chapters), `verses`, `verse_translations` (every language of every verse), `download_state`, and the FTS5 table `verse_fts` (made in `SearchDao.createIndex`, not a Drift table). `BookDao.replaceUnit` is the **one** writer and works in one transaction, so a unit is never half-updated. Version 1 (a one-language cache) is dropped on upgrade; the sync refills it.
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
| **Speaking** | spoken meaning/purport (`speakingChainProvider`: speaking → en) — **nothing in the reader uses it now**, see "Reading aloud" | device language, else English |

First value: stored → the account's own choice (app and reading only) → the phone's language → English. App and reading are also sent to the account, best effort (the server shapes some responses by them); speaking has no server field. Sanskrit verse text is always Sanskrit — it is not one of the three. Settings → **Languages** has a row and picker for each. `test/language_settings_test.dart`.

## A verse on the reading screen

`widgets/library/verse_block.dart` draws every verse (the chapter reader and short works alike), top to bottom: Devanagari → transliteration → **Word meanings** → translation → purport.

- **The transliteration follows the reading language** (`BookRepository.pickTransliteration`, mirrored on the server by `language.pickTransliteration`). Each `verse_translations` row can carry the verse in its language's own script (Marathi, Bengali, Telugu, Kannada ... — written by the Claude translation import); the verse takes the first language in the reading chain that has one; failing that, a language with its own script (Kannada, Bengali, Telugu, Gujarati ... — `hasIndicScript`) gets the verse's Devanagari carried across into it (`core/format/indic_script.dart`, a port of the server's `fromDevanagari` in `backend/utils/script.js`; keep the two together), so nothing is read in Roman letters just because no transliteration was imported; else the verse's own Roman (IAST) text, which is what English, Hindi and Marathi readers see. The conversion is mechanical — Tamil in particular folds aspirates onto plain consonants — so an imported transliteration always wins over it. **A transliteration in the same script as the Devanagari above it is not drawn** (`core/format/script.dart` `sameScript`, used by `verse_block.dart`): a Hindi or Marathi reader's would only repeat the verse. To show it anyway, return `transliteration` unchanged from `_transliterationToShow` in `verse_block.dart`. Drift schema 4 added the column; a phone fills it when it next downloads a unit, which the server's new file hash asks for. `test/script_test.dart`, `test/verse_transliteration_test.dart`, `test/indic_script_test.dart` (the same cases as `backend/test/pick-transliteration.test.js`). The Home sloka card (`verse_hero_card.dart`) drops a transliteration in the verse's own script the same way. Nothing needs re-downloading: the conversion is made on the phone from the Devanagari it already holds.
- **A mantra follows the reading language too** — name, text and meaning all arrive in it (the server's `mantraTextChain`, see [backend/CLAUDE.md](../backend/CLAUDE.md)), so a Kannada reader sees Kannada letters on the Chant list, the detail page, the counter, Home, favourites and search. The Roman line under a mantra's text (`mantra_detail_view.dart`) is for a reader of Devanagari only: under Kannada letters it is the thing the reading language replaces, and under Roman text it would repeat it (`test/mantra_transliteration_test.dart`). Changing the reading language asks for the mantra list, a mantra's page and the Home feed again once the account has taken the new language (`LanguageSettingsNotifier._refetchServerShaped`); a phone that is offline keeps what it has until the request can be made.
- **Word meanings** (`word_meanings_section.dart`) is closed until opened. Open or closed is **one setting for every verse**, kept on the device (`wordMeaningsOpenProvider`, `BoxKeys.wordMeaningsOpen`), not per verse. One row to a word — the Sanskrit left, its meaning right; a word with no Sanskrit shows only its meaning. A verse with no word-for-word draws **nothing**, not a heading over an empty list; likewise a verse with no Devanagari just starts at the transliteration.
- The purport and "Word meanings" share `collapsible_section.dart`. The purport is shut again each time a verse is built; only Word meanings is remembered.
- **Parts the reader can hide.** Reading settings (the sheet from the reader's app bar) has a **Hide** group of checkboxes: Sanskrit, transliteration, word meanings, purport (`VersePart`, `models/verse_part.dart`). Nothing is hidden until a box is ticked; the choice is **one setting for every verse in every book**, kept on the device (`hiddenVersePartsProvider`, `BoxKeys.readingHiddenPart(part.name)`, one key per part). `VerseBlock` takes `hidden` and draws neither the part nor its heading; the translation is not one of them. The chapter reader and short works both pass it. Tapping a language in the same sheet sets the reading language **and closes the sheet**, so the book is served in it at once. `test/reading_hide_parts_test.dart`. The group added three strings to every ARB (`readingHideLabel`, `readingHideSanskrit`, `readingHideTransliteration`); word meanings and purport reuse `verseWordMeanings` and `mantraPurport`.

## Book, canto and chapter titles

The book screen, a canto's chapter list and the chapter list of a book without cantos title themselves in the **reading** language (`readingChainProvider`: reading → app → en), the same chain a verse's translation uses.

- **Two forms arrive for each title**: the plain English `title` and a `titleI18n` map `{ code: text }` (`summaryI18n` on a canto or chapter, `descriptionI18n` on a book). `Book` and `BookSection` keep both; `titleFor(chain)`, `summaryFor(chain)` and `descriptionFor(chain)` return the first language in the chain with a non-blank text. **A pick stops at English** and falls to the plain column, like the server's `language.localised`: someone reading English with the app in Hindi is not handed a Hindi title. `core/format/localised.dart` (`parseLocalised`, `pickLocalised`) holds both halves; a map that is not text, or a column holding bad JSON, costs a title its translation and never a screen.
- **The widget picks, not the repository.** `BookHeader`, `CantoHeader` and the list screens (`book_detail_view.dart`, `chapter_list_view.dart`) call `titleFor` with `ref.watch(readingChainProvider)`, so a change of reading language re-titles the list where it stands, with no reload and no new request. Offline is the same: `books.title_i18n` and `units.title_i18n` / `summary_i18n` (they were already columns; stored as JSON text) feed the same pick, so signed-out, offline and a mid-sync race all show the same titles.
- **The Gita keeps its Sanskrit name in the plain `title`** and Prabhupāda's English heading in `titleI18n.en`; the Bhagavatam's plain titles are English. Both are covered because the server always puts `en` in the map and the pick prefers it; the plain column is only the last resort.
- **The rows are `SectionTile`** (number on a tinted square, title, facts) with `SectionCounts` for "12 cantos / 335 chapters / 18000 verses". Each count is its own chip and each fact its own line, never one joined sentence — the joining word differs by language. The number is also in the semantics label ("Chapter 1, <title>, 46 verses") so it is not carried by the square alone.
- **The title moves into the app bar on scroll** (`book_detail_view.dart`). The header's heading carries a `GlobalKey` (`BookHeader.titleKey`, also taken by `ShortWorkVerses`); once the list has scrolled past the heading's bottom edge the bar shows the book's title, centred (`centerTitle: true`), cross-faded in, and it is not built at all before that, so the title is never on screen or read out twice. **It is judged in scroll offsets** (`getOffsetToReveal` against `metrics.pixels`), never from where the heading was last drawn: a scroll notification arrives before the next layout, so a position read from the render tree is a frame behind and, after a fling, stays wrong until the next scroll. `test/book_titles_screen_test.dart` drags a 20-chapter list up and back.
- **A canto header is optional.** The chapter list shows `CantoHeader` (CANTO 1, its title and summary, counts) only when the canto list loaded and knows that canto; a failed canto list leaves the chapters, not an error.
- Titles come from the server and the admin **Titles** dialog; the app writes none. A title lives in its unit's file, so a changed title changes that unit's hash and a phone fetches the Gita chapter or Bhagavatam canto file again after the next book export. `test/localised_test.dart`, `test/book_repository_test.dart`, `test/book_titles_screen_test.dart` (the screens driven with a Marathi reader, a Hindi reader falling back to English, a live switch to English, the Bhagavatam's cantos, a canto's header, a failing canto list).
- **A poetic expansion is never the default rendering** (`BookRepository.pickTranslation`, mirrored on the server by `language.pickTranslation`): Dnyaneshwari's Marathi ovis on the Gita are the *secondary* version, reached through "Compare translations", and open by default only when a verse has nothing else in the reader's chain. A Marathi reader therefore gets the next language (English) until a standard Marathi translation is added. `test/pick_translation_test.dart`, `test/verse_word_meanings_test.dart`. (A widget test cannot await a `LocalStore` write under its fake clock — the word-meanings widget tests swap the provider for an in-memory one.)

## Reading aloud

A play button on each verse (only on a verse that has a recording) and **Read aloud** at the top of the page (it plays the chapter's recordings one after another). **A verse plays its Sanskrit recording and nothing else** — no spoken meaning or purport, whatever the reading or speaking language is. That is deliberate: the Gita has a recording of every verse (`Book.recitationParent`), and the English text was being read over it. `ReadingAudio` → `ReadingPlaybackController` (run-numbered loop) → `VerseAudioCache` + `AudioLinkResolver` (`POST /audio-urls`, link remembered 50 min). `ReadingItems.build(verses)` takes no language at all; `ReadingState` has no "section". Nothing in the reader reads a translation aloud.

- **The text-to-speech layer is still in the app but unused by the reader** (`TtsEngine`, Settings → Voices, `VoiceRequests` on choosing a speaking language, `SpeechText`, the `readingSection*` / `readingAudioNowPlaying` / `labelVerseWithSection` strings). Left in place so spoken meaning can come back without a rebuild; delete it if it will not.
- **Recitations** download on first play and are kept (`VerseAudioCache`, 200 MB LRU); the next verse is fetched while this one plays. A verse with no audio, or one that won't load, is skipped silently. The last verse per chapter is remembered (`ReadingMemory`). **Which file a verse has is the server's decision**: its own `audioPath`, or the recording in its book's `recitationParent` folder (the Gita's — see "Verse recitations" in [backend/CLAUDE.md](../backend/CLAUDE.md)). The app only sees a key, so it has no folder logic and a book gains recitations without an app release; a phone shows them once its copy of the book has synced again.
- **Background and the lock screen:** `audio_service` with our own `ReadingAudioHandler`. **`just_audio_background` is not used** — it makes *every* `AudioPlayer` require a `MediaItem` tag, which would break the chant-along player and the reels soundtrack. Android: `AudioServiceActivity`, the service + receiver and media-playback foreground permissions are in `AndroidManifest.xml`; iOS: `UIBackgroundModes` has `audio`.
- **Interruptions** (`InterruptionPolicy`, over `audio_session`): a call or another app's audio pauses and resumes when the system allows; unplugged headphones pause and never auto-resume; a reader's own pause is never undone.
- **Not yet tried on a phone:** the lock-screen controls, the foreground service, audio focus with a real call. The logic is covered with fake players (`test/reading_playback_test.dart`, `reading_audio_ui_test.dart`); the platform wiring is not.

## Spoken meaning and purport (voices) — not used by the reader at present

The reading player no longer speaks (see "Reading aloud"); this describes the engine that is still built and still reachable from Settings → Voices. One interface, `TtsEngine`, so an engine can be swapped: `SherpaTtsEngine` (offline neural), `PlatformTtsEngine` (`flutter_tts`) and `AdaptiveTtsEngine` — neural when a voice is installed for the language, the phone's voice otherwise (and again from the failed chunk if the neural one dies part-way). **Speech never waits on a download.** Text is split into chunks of at most 220 characters (`TextChunker`) and chunk N+1 is requested before N finishes (`ChunkedSpeaker`); `SherpaSynthesizer` runs in its own isolate, so the UI thread only receives finished audio.

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
