/// Numbers the routine tab needs that are not copy, colour or spacing.
abstract final class RoutineConfig {
  /// How many days before today the date strip reaches — old routines are
  /// browsed by scrolling back to them.
  static const int pastDays = 120;

  /// How many days after today, so a custom task can be set up ahead.
  static const int futureDays = 60;

  /// The hour, local time, at which a day is judged Ekadashi or not: roughly
  /// sunrise, the moment a tithi is said to belong to a day.
  static const int sunriseHour = 6;

  /// Where a rough slot of the day begins, in minutes after midnight. A task's
  /// time range puts it in the slot its start falls in, so the list is still
  /// grouped morning / afternoon / evening without asking for it twice.
  static const int afternoonStartMinute = 12 * 60;
  static const int eveningStartMinute = 17 * 60;

  static const int minutesPerDay = 24 * 60;

  /// The range offered when someone sets one by hand: an hour from this minute.
  static const int newWindowStartMinute = 6 * 60;
  static const int newWindowLengthMinutes = 60;

  /// The clock a time picker opens on for a past or future day, where "now"
  /// would mean nothing.
  static const int otherDayPickerMinute = 12 * 60;

  /// How many standard routines the name menu shows before it scrolls.
  static const double presetMenuHeight = 280;

  /// How wide one day is in the strip, gap included, and how tall.
  static const double dayExtent = 52;
  static const double stripHeight = 92;

  /// The date number's disc, and the progress ring drawn round it.
  static const double dayDisc = 36;
  static const double dayRing = 42;
  static const double ringStroke = 2.5;

  /// The longest name a task or daily item can have: the backend refuses more,
  /// and a refused row would be refused again on every sync.
  static const int maxTitleLength = 200;

  /// How long after a change the routine is sent, so a run of ticks goes up
  /// as one request.
  static const Duration syncDebounce = Duration(seconds: 3);

  /// How long to wait before trying again after a failed sync, doubling each
  /// time up to the longest.
  static const Duration syncRetryFirst = Duration(seconds: 30);
  static const Duration syncRetryLongest = Duration(minutes: 15);

  /// Rows (tasks, daily items, ticks and removals together) in one request. A
  /// phone with a year of history to upload sends it in pieces this size.
  static const int syncChunkRows = 500;

  // ── Task alerts: one notification when a task's time range opens ────────
  /// How many days ahead (today included) the alerts are set. They are set again
  /// whenever the routine changes and the app comes to the front, so the days
  /// roll forward on their own.
  static const int alertDays = 7;

  /// The most alerts set at once. The nearest ones win.
  static const int alertMaxPending = 100;

  /// The same on iOS, which keeps no more than 64 waiting notifications for an
  /// app and quietly drops the rest; a few are left for anything else.
  static const int alertMaxPendingIos = 60;

  /// An alert's notification id is [alertIdBase] plus a number below
  /// [alertIdSpan], worked out from its task and day, so the same alert always
  /// has the same id: setting it again replaces it, and a task ticked in the app
  /// can clear its own notification. A push drawn by the app counts up from 0 and
  /// never reaches the base. Android keeps an id in 32 bits.
  static const int alertIdBase = 1000000;
  static const int alertIdSpan = 1 << 30;

  /// The Android channel the alerts are on, so a reader can silence them in the
  /// phone's settings without touching the daily sloka.
  static const String alertChannelId = 'routine_alerts';

  /// The notification's one button, and what its payload carries.
  static const String alertDoneActionId = 'routine_done';

  /// iOS: the category that puts the button on an alert, and the channel
  /// `AppDelegate` answers on — it registers the category beside the push
  /// buttons' own, and writes a press itself (see `routine_alert_ticks.dart`).
  static const String alertCategoryId = 'routine_alert';
  static const String alertChannel = 'hariharibol/routine_alerts';
  static const String alertTaskKey = 'routineTask';
  static const String alertDayKey = 'routineDay';

  /// What a tap on the alert itself opens (see `deeplinkRoute`).
  static const String alertDeeplink = 'hariharibol://routine';

  /// How long after a change the alerts are set, so a run of ticks is one pass.
  static const Duration alertDebounce = Duration(seconds: 1);

  /// Where a button press waits for the app. The press runs in an isolate of its
  /// own, which cannot reach the routine on the phone (Hive is open in the app's
  /// isolate only), so it is written under this prefix in `shared_preferences`
  /// and the app takes it from there — see `routine_alert_ticks.dart`.
  static const String alertTickPrefix = 'routine.alertTick.';

  /// The app's own isolate listens on this port name for "a press was written",
  /// so a press made with the app open lands at once.
  static const String alertPortName = 'hariharibol/routine_alert_tick';

  /// After "Not now" on the card asking Android for alarms right on time, how
  /// long before it is shown again.
  static const Duration onTimeAskAgain = Duration(days: 30);
}
