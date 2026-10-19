// Which mantra "Chant now" opens with when the reader has not chosen one. Pure: the controller does the
// grouping query and hands the totals in.
//
// A person who has just arrived from the old server has chanted next to nothing here, but a great deal there.
// Their one real favourite (Om Namah Shivay, say) should not be pushed aside by a single round of something else
// tried today, so the stand-in carried over from the old server outranks a handful of recent rounds; a person who
// has settled into a practice here (FAVOURITE_MIN_ROUNDS in the window) is going by what they chant now.

// Fewer rounds than this in the window is "trying things", not a habit. A day's standing target is 16.
const FAVOURITE_MIN_ROUNDS = 5;

const byRounds = (a, b) => b.rounds - a.rounds || b.sessions - a.sessions;

/**
 * Candidate mantra ids, best first; the caller takes the first one that is still published.
 * `recent` and `allTime` are `[{ id, rounds, sessions }]`; `legacyId` is the carried-over favourite or null.
 */
function favouriteCandidates({ recent = [], allTime = [], legacyId = null, minRounds = FAVOURITE_MIN_ROUNDS }) {
  const recentRanked = recent.filter((m) => m.id).sort(byRounds);
  const allRanked = allTime.filter((m) => m.id).sort(byRounds);

  const habit = recentRanked.filter((m) => m.rounds >= minRounds);
  const ids = [
    ...habit.map((m) => m.id),
    ...(legacyId ? [legacyId] : []),
    ...recentRanked.map((m) => m.id),
    ...allRanked.map((m) => m.id),
  ];
  return [...new Set(ids)];
}

export { FAVOURITE_MIN_ROUNDS, favouriteCandidates };
