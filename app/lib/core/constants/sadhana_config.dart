/// The numbers behind a day's rounds: the goal they are counted against, and when
/// a round may be finished early.
///
/// Nobody is stopped at their target: chanting past it moves the goal up a rung,
/// so the count reads 17 / 32, never 17 / 16.
abstract final class SadhanaConfig {
  /// The rungs above the person's target, in order. A rung at or below the
  /// target is skipped (a target of 40 goes straight to 64).
  static const List<int> roundGoalSteps = [32, 64, 108];

  /// Past the last rung the goal is the next multiple of this: 112, 128, 144…
  static const int roundGoalBeyondStep = 16;

  /// The beads in a standard round, which [finishableAfterBeads] is out of.
  static const int standardRoundBeads = 108;

  /// A round more than this many beads into a standard round may be finished
  /// early: someone chanting on a mala in their hand can be a few beads ahead of
  /// the counter, and should not have to wait for it.
  static const int finishableAfterBeads = 90;

  /// Whether a round [beadsInRound] into one of [beadsPerRound] may be finished
  /// early — the same share of the round as [finishableAfterBeads] is of 108, so
  /// a day with shorter rounds is held to the same fraction.
  static bool canFinishRound(int beadsInRound, int beadsPerRound) =>
      beadsInRound * standardRoundBeads > finishableAfterBeads * beadsPerRound;
}
