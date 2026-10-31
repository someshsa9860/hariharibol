/// Numbers the Home screen's added sections use. Nothing here is user-facing.
/// See "Home recommendations" in app/CLAUDE.md.
abstract final class HomeConfig {
  /// The festivals under "This week": today and the days after it, this many in all.
  static const int festivalWeekDays = 7;

  /// Before this hour the morning prayers are offered; from [eveningPrayerFromHour]
  /// the evening ones. Between the two, the prayer row is not shown.
  static const int morningPrayerUntilHour = 12;
  static const int eveningPrayerFromHour = 17;

  /// Prayers at once in the time-of-day row.
  static const int timeOfDayPrayerCount = 3;

  static const double issueVerseCardWidth = 240;
  static const double festivalCardWidth = 200;
  static const double prayerCardWidth = 220;
}
