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

  /// How wide one day is in the strip, gap included, and how tall.
  static const double dayExtent = 52;
  static const double stripHeight = 92;

  /// The date number's disc, and the progress ring drawn round it.
  static const double dayDisc = 36;
  static const double dayRing = 42;
  static const double ringStroke = 2.5;
}
