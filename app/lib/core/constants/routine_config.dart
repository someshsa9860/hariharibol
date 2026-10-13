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
}
