// What tapping a standard routine's alert opens. Pure, so `node --test test/routine-open.test.js` loads it on its own.
//
// The kind row says where it goes (`RoutineKind.opensKind`, and `prayerSlug` for a prayer); the app does the navigating.
// A chant opens the counter on the reader's own mantra (preferred, else the favourite from GET /sadhana/today), and a
// read opens the last book they read (GET /progress/latest). Neither needs the server to name a mantra or a book here.

export const OPENS = Object.freeze({
  PRAYER: 'prayer',
  CHANT: 'chant',
  READ: 'read',
});

/** The `opens` value the app gets for one routine kind, or null when tapping its alert opens nothing special. */
export function opensOf(kind) {
  if (kind.opensKind === OPENS.PRAYER) return kind.prayerSlug ? { kind: OPENS.PRAYER, slug: kind.prayerSlug } : null;
  if (kind.opensKind === OPENS.CHANT || kind.opensKind === OPENS.READ) return { kind: kind.opensKind };
  return null;
}
