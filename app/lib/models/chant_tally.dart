import 'chant_sitting.dart';
import 'routine_task.dart';
import 'sadhana.dart';

/// The chanting counted on this phone that the server's figures do not hold yet.
///
/// The phone is where chanting is written first and the server hears of it in a
/// batch, so the server's copy of a day can be a few rounds behind. A sitting on
/// the phone is matched to the server's copy of it by its `clientId`; what the
/// phone has beyond that copy — all of it when the server has not heard of the
/// sitting, the rounds since the last batch when it has — is what this counts.
/// Laid over the server's figures it gives the day as it really stands, and it
/// never counts a round twice: once the server has the sitting, the two agree
/// and nothing is left over.
///
/// Only sittings that began on [day] count, the way the server files them.
/// [where] picks some of them (one mantra's), and [except] leaves one out (the
/// sitting the counter is counting right now, which it adds itself).
int unsentRounds({
  required Iterable<ChantSitting> sittings,
  required String day,
  required Iterable<ChantSession> sessions,
  bool Function(ChantSitting sitting)? where,
  String? except,
}) {
  final held = <String, int>{
    for (final session in sessions)
      if (session.clientId != null) session.clientId!: session.rounds,
  };

  var total = 0;
  for (final sitting in sittings) {
    if (sitting.day != day || sitting.clientId == except) continue;
    if (where != null && !where(sitting)) continue;

    final onServer = held[sitting.clientId] ?? 0;
    if (sitting.rounds > onServer) total += sitting.rounds - onServer;
  }
  return total;
}

/// Everything counted today, whoever the mantra: the server's total for the day
/// and what the phone has beyond it.
int dayRoundsWithPhone(Iterable<ChantSitting> sittings, SadhanaToday today, {String? except}) =>
    today.day.roundsCompleted +
    unsentRounds(sittings: sittings, day: today.date, sessions: today.sessions, except: except);

/// The rounds of one mantra today (null: the plain counter), the server's and the
/// phone's. **Each mantra keeps its own count** — sixteen rounds of the
/// mahamantra and one of Om Namah Shivaya are 16 and 1, never 17 and 17.
int mantraRoundsWithPhone(
  Iterable<ChantSitting> sittings,
  SadhanaToday today,
  String? mantraId, {
  String? except,
}) =>
    today.serverRoundsOf(mantraId) +
    unsentRounds(
      sittings: sittings,
      day: today.date,
      sessions: today.sessions,
      where: (sitting) => sitting.mantraId == mantraId,
      except: except,
    );

/// The rounds already counted today when a sitting opens: [mantra] for the ring
/// (this mantra's alone) and [day] for the day's goal (every mantra's).
///
/// With the server's day not loaded (a first launch with no signal) there is only
/// the phone's own record of today to go on, which is what is counted.
({int mantra, int day}) roundsBeforeSitting(
  Iterable<ChantSitting> sittings,
  SadhanaToday? today,
  String? mantraId,
  DateTime now,
) {
  if (today != null) {
    return (
      mantra: mantraRoundsWithPhone(sittings, today, mantraId),
      day: dayRoundsWithPhone(sittings, today),
    );
  }
  final key = routineDayKey(now);
  return (
    mantra: unsentRounds(
      sittings: sittings,
      day: key,
      sessions: const [],
      where: (sitting) => sitting.mantraId == mantraId,
    ),
    day: unsentRounds(sittings: sittings, day: key, sessions: const []),
  );
}
