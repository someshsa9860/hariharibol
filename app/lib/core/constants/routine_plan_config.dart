/// The numbers behind the daily routine that is worked out for someone when they
/// first set up the app, and the one limit the routine keeps: a bedtime is never
/// before noon. All minutes after midnight unless a name says otherwise.
///
/// **The numbers to change** if the suggested wake-up feels too early or too
/// late: [chantPaceFactor] (how much longer than the mantra's own time a round
/// really takes) and [morningChantDeadlineMinute] (when the morning rounds should
/// be done).
abstract final class RoutinePlanConfig {
  // ── The limit ─────────────────────────────────────────────────────────
  /// A bedtime is a time in the evening, so nobody's is before noon. An earlier
  /// one is refused: it is either a mistake or a bedtime after midnight.
  static const int sleepEveningStartMinute = 12 * 60;

  // ── How the wake-up is worked out ─────────────────────────────────────
  /// The earliest wake-up that is *suggested*, however many rounds there are.
  /// Someone can still choose earlier by hand.
  static const int wakeEarliestSuggestedMinute = 4 * 60;

  /// The morning rounds should be finished by now (before breakfast).
  static const int morningChantDeadlineMinute = 7 * 60;

  /// From waking to sitting down to chant: washing, water, a little quiet.
  static const int prepMinutes = 45;

  /// One round's real time over the time its chants add up to. A round has the
  /// prayer, the settling and the pauses between chants in it; a mantra's
  /// `durationMs` is only the chant.
  static const double chantPaceFactor = 1.5;

  /// How many beads a round has.
  static const int beadsPerRound = 108;

  /// One chant's time when the mantra is not known (the Hare Krishna mantra's).
  static const int fallbackChantMs = 4000;

  /// The shortest the morning chanting is shown to take, however few the rounds.
  static const int minChantWindowMinutes = 20;

  /// Times are offered in steps of this many minutes.
  static const int stepMinutes = 15;

  // ── The routine's other rows ──────────────────────────────────────────
  static const int wakeWindowMinutes = 30;
  static const int sleepWindowMinutes = 60;

  /// The latest the morning chanting is allowed to be shown running to; more
  /// rounds than fit run on into the day and the plan says so.
  static const int latestChantEndMinute = 11 * 60 + 30;

  /// Breakfast starts at least this long after the morning chanting ends.
  static const int breakfastGapMinutes = 15;

  /// The evening rows are laid out for a 10 PM bedtime. A bedtime earlier than
  /// that moves them earlier by the difference, but not before the middle of the
  /// afternoon.
  static const int eveningLayoutSleepMinute = 22 * 60;
  static const int earliestEveningMinute = 15 * 60;

  /// The sleep the day must leave when the bedtime is suggested.
  static const int minSleepMinutes = 6 * 60;

  // ── The rounds step ───────────────────────────────────────────────────
  static const int minRounds = 1;
  static const int maxRounds = 200;
  static const int defaultRounds = 16;
  static const List<int> roundQuickPicks = [4, 8, 16, 32, 64];
}
