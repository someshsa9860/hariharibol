# Plan: meal routine alerts open their prayer

Status: not started. The backend and push-routing parts are partly done (see below). The app steps are not yet edited.

Split into two plans:

- [backend/PLAN-meal-prayer-read-action.md](backend/PLAN-meal-prayer-read-action.md): changes in `backend/`.
- [app/PLAN-meal-prayer-read-action.md](app/PLAN-meal-prayer-read-action.md): changes in `app/`.

## Goal

A breakfast, lunch or dinner routine alert links to its meal prayer. Its notification gets a **Read** button. Tapping it opens the prayer read page at `/prayers/<slug>`.

## Decisions

- Meal detection matches the routine task title against the localised breakfast, lunch and dinner labels in every supported locale. No schema change, so the title syncs across devices.
- All three meals map to `prasada-sevaya` for now, as one code constant. The user may change it later.
- The Read button reuses the existing push-action machinery. The payload carries an `actions` JSON list, resolved by `pushActionRoute`.
- The "Read" label reuses the existing `tabLibrary` translations for the button text. The new `routineAlertRead` key copies them into all 12 ARB files.
- Prayers are DRAFT until an admin publishes them, so the Read page returns 404 until then.

## Already done

- `app/lib/core/constants/push_config.dart`: `deeplinkPrayer = 'prayer'`.
- `app/lib/services/push_link.dart`: `prayer` case and `_prayerPath` helper.
- `backend/controllers/app/prayer.js`: `get` matches by id or slug. Not yet syntax-checked.

## Verification (whole change)

- `node --check backend/controllers/app/prayer.js`
- In `app/`: `app/tool/flutter.sh gen-l10n`, then `app/tool/flutter.sh analyze` and `app/tool/flutter.sh test`. If the SDK is missing, say so and rely on reading the code.

## Caveats for the final report

- Prayers are DRAFT until an admin publishes them.
- The meal→prayer mapping is a code constant.
- Only the notification changes. The routine list UI is untouched.
- Nothing has run on a device. Android and iOS Read behaviour is untested.
