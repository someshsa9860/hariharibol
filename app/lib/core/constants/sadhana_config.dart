/// The goal a day's rounds are counted against, once the person's own target is
/// passed. Nobody is stopped at their target: chanting past it moves the goal
/// up a rung, so the count reads 17 / 32, never 17 / 16.
abstract final class SadhanaConfig {
  /// The rungs above the person's target, in order. A rung at or below the
  /// target is skipped (a target of 40 goes straight to 64).
  static const List<int> roundGoalSteps = [32, 64, 108];

  /// Past the last rung the goal is the next multiple of this: 112, 128, 144…
  static const int roundGoalBeyondStep = 16;
}
