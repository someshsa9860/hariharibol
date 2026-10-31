# Plan (app): routine alerts open their page

Part of [../PLAN-meal-prayer-read-action.md](../PLAN-meal-prayer-read-action.md). Paths are relative to `app/`. The server half is in [../backend/PLAN-meal-prayer-read-action.md](../backend/PLAN-meal-prayer-read-action.md).

A routine alert is a local notification set on the phone (`services/routine_alert_plan.dart`, `services/routine_alert_service.dart`). Each kind of routine gets a button that opens its own page:

| Routine | Button label | Opens |
|---|---|---|
| Breakfast, lunch, dinner | Read | the meal prayer (`/prayers/prasada-sevaya`) |
| Morning chanting, evening chanting | Chant | the counter with the reader's favourite mantra |
| Scripture reading | Read | the last book read, at the last place |

## Already done

- `lib/core/constants/push_config.dart`: `deeplinkPrayer = 'prayer'`, plus the existing `deeplinkChant` and `deeplinkRead`.
- `lib/services/push_link.dart`: `prayer` case and `_prayerPath`. `pushActions`, `pushActionRoute` and `PushLinks.tapped(data, actionId:)` already resolve a button's own link.

## What the phone already has, and what it lacks

- **Favourite mantra.** `SadhanaToday.chantMantraSlug` (`models/sadhana.dart`) is the profile choice, else the favourite. `openChant(ref, mantraSlug:)` (`widgets/dashboard/open_chant.dart`) loads the mantra and pushes `AppRoutes.chant` with it. It needs a `WidgetRef` and is async. `deeplinkRoute` is synchronous and returns only a route string, so a chant button cannot reach `openChant` directly.
- **Last place.** `ReadingPlaceStore.readAll()` (`services/reading_place_store.dart`) is synchronous and local. `openBook(ref, slug)` (`widgets/library/open_book.dart`) is the decision (place → `chapterPath`, else `bookPath`) but also takes a `WidgetRef`. The deeplink has to make the same decision without one.
- **Backend data.** `GET /api/app/routine/nudges` will return `opens` per kind; `GET /api/app/progress/latest` returns the server's newest place. **Neither is called by the app yet.** The app's routine sync does not need them, because the phone already knows each task's title and window.
- **Preset mapping.** `RoutineTask` has no preset or kind field (only id, title, category, window). `RoutinePreset` (`core/constants/routine_presets.dart`) has the labels in `routinePreset*` ARB keys, read through `routinePresetLabel`.

## Steps

1. **Routine kind from the title.** Create `lib/services/routine_kind_match.dart` with a pure function `RoutineKind? routineKindOf(String title)`. It compares the title, trimmed and lower-cased, with the localised label of each `RoutinePreset` in every `AppLocalizations` locale (`supportedLocales`). It returns:
   - `RoutineKind.meal` for the breakfast, lunch and dinner presets;
   - `RoutineKind.chant` for morningChant and eveningChant;
   - `RoutineKind.read` for scriptureReading;
   - null for everything else.
   Keep the mapping in one constants file (`core/constants/routine_alert_config.dart`), not inline.
2. **Constants.** In `lib/core/constants/routine_config.dart` add:
   - `alertReadActionId = 'routine_read'`
   - `alertReadCategoryId = 'routine_alert_read'`
   - `alertChantPrayerSlug`-style values belong in config, not in code: the meal prayer slug `prasada-sevaya`, and the deeplink query keys.
3. **Deeplinks.** In `lib/core/constants/push_config.dart` and `lib/services/push_link.dart`:
   - `deeplinkChant` with `?slug=<mantra>` opens the counter with that mantra. Because `deeplinkRoute` is synchronous, the chant route cannot carry the loaded `Mantra` as `extra`. Choose one of:
     a. **Simple (proposed):** route to `AppRoutes.mantraPath(slug)`, the mantra's page, which has the "chant this" button. Costs one tap; no new plumbing.
     b. **Full:** a `PushLinks` opener that calls `loadMantra` and then pushes `AppRoutes.chant` with `extra`. Gives one tap but adds an async path to `PushLinks`.
   - `deeplinkRead` with `?book=<slug>` resolves synchronously in `deeplinkRoute`: read `ReadingPlaceStore.readAll()[slug]`, return `chapterPath` (with canto and verse) if it exists, else `bookPath(slug)`. This is the same decision as `openBook`, moved into a pure function `readingRouteFor(slug, places)` so both use it.
   - Add a test that both callers give the same route.
4. **Alert plan.** In `lib/services/routine_alert_plan.dart`:
   - Add `kind` (nullable `RoutineKind`) and `target` (the deeplink for the Read or Chant button, nullable) to `RoutineAlert`. The target is computed when planning, from the title and the favourite mantra.
   - `planRoutineAlerts` takes an injectable `kindOf` (default `routineKindOf`) and a `chantSlug` (nullable), so the favourite can be passed in. Tests pass fakes.
   - Payload gets an `actions` JSON list with at most one entry: `{"id":"routine_read","label":<label>,"deeplink":<target>}`. Two buttons would be allowed, but one keeps the notification simple.
   - `signature` includes `target`, so a changed favourite or changed place reschedules the alert.
5. **Scheduling.** In `lib/services/routine_alert_service.dart`:
   - Add `readLabel` and `chantLabel` to `RoutineAlertWords`, and include them in `signature`.
   - Android: when `alert.target` is set, add an `AndroidNotificationAction` with id `routine_read`, label from the words, `showsUserInterface: true`.
   - iOS: an alert with a target uses category `routine_alert_read`. `_registerCategory` registers it with Done and the page button (`.foreground`) beside the existing `routine_alert` category.
6. **Widget.** In `lib/widgets/routine/routine_alerts.dart`, pass `readLabel: strings.routineAlertRead` and `chantLabel: strings.routineAlertChant` into `RoutineAlertWords`. The chant favourite comes from the sadhana provider (`sadhanaTodayProvider`), watched there, so a favourite change re-plans.
7. **Place for reading.** Decision (see below). Proposed: the phone's `ReadingPlaceStore` first, because it is synchronous and works offline. The server's `progress/latest` is used only when the local store has no entry for any book, to pick up a reader's place on a new phone. This call is made from the routine alerts widget, not from the alert plan, so the plan stays pure.
8. **Strings.** Add `routineAlertRead` ("Read") and `routineAlertChant` ("Chant") to `lib/l10n/app_en.arb`, and the same keys to the other 11 `app_*.arb` files. Use the existing `tabLibrary` and `tabJap` translations as the starting words. Run `tool/flutter.sh gen-l10n`. If the SDK is unavailable, add the getters to each `lib/l10n/generated/app_localizations*.dart` by hand.
9. **iOS delegate.** In `ios/Runner/AppDelegate.swift`:
   - `setRoutineCategory` also registers `routine_alert_read` with the page action (`options: [.foreground]`).
   - `willPresent` shows the banner for both routine categories.
   - `didReceive` for `routine_read` skips the `pushActions` channel and calls super, so flutter_local_notifications is the only path that navigates. This avoids a double open.
   - Swift constants must match `RoutineConfig` (same rule as the existing ones).
10. **Tap path.** Check the local notification tap handler in `LocalPushService`. It must pass the response's `actionId` into `PushLinks.tapped(data, actionId: ...)`, so the button resolves through `pushActionRoute`. If it does not, add it.
11. **Tests.**
    - `test/routine_kind_match_test.dart`: each preset's label in each locale maps to its kind; a renamed or unknown title maps to null.
    - `test/routine_alert_plan_test.dart`: a meal alert carries the prayer target and the `actions` list; a chant alert carries the favourite mantra target; a chant alert with no favourite carries no target; a read alert with no saved place targets the book page; the signature changes with the target.
    - `test/push_link_test.dart` (extend): `hariharibol://prayer/prasada-sevaya` → `/prayers/prasada-sevaya`; `hariharibol://mantra?slug=om-namah-shivaya` → mantra page; `hariharibol://read?book=…` with a saved place → chapter route, without → book route.
    - Widget or unit test: the readers' place decision gives the same route as `openBook`.

## Done when

- `tool/flutter.sh gen-l10n`, `analyze` and `test` pass, or the report says the SDK was missing and the code was checked by reading.
- `test/l10n_parity_test.dart` passes: all 12 ARB files carry both new keys.

## Decisions and caveats for the final report

- **Reading place source.** Local `ReadingPlaceStore` first (offline, instant, but lost on a new phone) with the server's `progress/latest` as fallback. The other way round would follow the reader across phones but needs a network call inside a notification tap. Owner to confirm.
- **Chant target.** The mantra's page (one extra tap) versus loading the counter directly. Proposed: the mantra's page now; the direct route later if wanted.
- **Renamed tasks lose their button.** The kind comes from the title against the preset labels. A task renamed to something else gets no button. Fixing this needs a kind field on `RoutineTask`, which is a schema change across sync; not in this plan.
- **No break-chanting preset.** The backend has `breakChant`, but `RoutinePreset` has no break-chanting entry, so the app cannot match it. The alert gets no button until a preset exists.
- **The app does not yet call the new backend endpoints** (`routine/nudges` `opens`, `progress/latest`). This plan uses local data first; the endpoints are the fallback and the source of the kind list if the title match is ever replaced.
- **The meal mapping is a code constant.** All three meals open `prasada-sevaya`.
- Prayers are DRAFT until an admin publishes them, so the meal Read button 404s until then.

## Not tested

- Android and iOS button behaviour on a device.
- The new Swift is never built here.
- No live API is called.
