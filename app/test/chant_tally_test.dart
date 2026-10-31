// What the phone's own chanting adds to the server's figures for the day, and
// above all that each mantra keeps its own count: sixteen rounds of one mantra
// and one of another are 16 and 1, never 17 and 17.

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/chant_sitting.dart';
import 'package:hariharibol/models/chant_tally.dart';
import 'package:hariharibol/models/sadhana.dart';

const day = '2026-10-06';
const hare = 'hare-krishna';
const shiva = 'om-namah-shivaya';

ChantSitting sitting(
  String clientId, {
  String? mantraId,
  int rounds = 0,
  int beads = 0,
  String onDay = day,
}) =>
    ChantSitting(
      clientId: clientId,
      day: onDay,
      startedAt: DateTime(2026, 10, 6, 5),
      mantraId: mantraId,
      rounds: rounds,
      beads: beads,
    );

ChantSession onServer(String clientId, {String? mantraId, int rounds = 0}) => ChantSession(
      id: 'server-$clientId',
      clientId: clientId,
      source: 'IN_APP',
      rounds: rounds,
      beads: 0,
      startedAt: DateTime(2026, 10, 6, 5),
      mantraId: mantraId,
    );

/// The server's day: [completed] rounds in all, made of [sessions].
SadhanaToday serverDay({int completed = 0, List<ChantSession> sessions = const []}) => SadhanaToday(
      date: day,
      day: SadhanaDay(roundTarget: 16, roundsCompleted: completed, tasksTotal: 0, tasksDone: 0),
      tasks: const [],
      sessions: sessions,
      streak: 0,
      beadsPerRound: 108,
    );

void main() {
  group('unsentRounds', () {
    test('counts a sitting the server has not heard of, all of it', () {
      expect(
        unsentRounds(sittings: [sitting('a', rounds: 3)], day: day, sessions: const []),
        3,
      );
    });

    test('counts only what the server lacks of a sitting it has heard of', () {
      final sessions = [onServer('a', rounds: 2)];
      expect(unsentRounds(sittings: [sitting('a', rounds: 5)], day: day, sessions: sessions), 3);
    });

    test('is zero once the server holds everything, and never negative', () {
      final sessions = [onServer('a', rounds: 5)];
      expect(unsentRounds(sittings: [sitting('a', rounds: 5)], day: day, sessions: sessions), 0);
      expect(unsentRounds(sittings: [sitting('a', rounds: 4)], day: day, sessions: sessions), 0);
    });

    test('matches by clientId, not by mantra or position', () {
      // The server has a sitting of the same mantra with the same rounds, but not
      // this one: the phone's rounds are still unsent.
      final sessions = [onServer('other', mantraId: hare, rounds: 4)];
      final mine = sitting('a', mantraId: hare, rounds: 4);
      expect(unsentRounds(sittings: [mine], day: day, sessions: sessions), 4);
    });

    test('a server sitting without a clientId matches nothing', () {
      final manual = ChantSession(
        id: 'manual',
        source: 'MANUAL',
        rounds: 4,
        beads: 0,
        startedAt: DateTime(2026, 10, 6, 5),
      );
      expect(unsentRounds(sittings: [sitting('a', rounds: 4)], day: day, sessions: [manual]), 4);
    });

    test('leaves out sittings of another day', () {
      final sittings = [sitting('a', rounds: 3), sitting('b', rounds: 9, onDay: '2026-10-05')];
      expect(unsentRounds(sittings: sittings, day: day, sessions: const []), 3);
    });

    test('where picks sittings and except leaves one out', () {
      final sittings = [
        sitting('a', mantraId: hare, rounds: 2),
        sitting('b', mantraId: shiva, rounds: 1),
        sitting('c', mantraId: hare, rounds: 4),
      ];
      expect(
        unsentRounds(
          sittings: sittings,
          day: day,
          sessions: const [],
          where: (each) => each.mantraId == hare,
        ),
        6,
      );
      expect(
        unsentRounds(sittings: sittings, day: day, sessions: const [], except: 'c'),
        3,
      );
    });

    test('a sitting with only beads has no rounds to add', () {
      expect(
        unsentRounds(sittings: [sitting('a', beads: 80)], day: day, sessions: const []),
        0,
      );
    });
  });

  group('each mantra keeps its own count', () {
    // Sixteen rounds of the mahamantra, then one of Om Namah Shivaya — the case
    // that read 17 on the mahamantra.
    final sessions = [
      onServer('hare-1', mantraId: hare, rounds: 16),
      onServer('shiva-1', mantraId: shiva, rounds: 1),
    ];
    final today = serverDay(completed: 17, sessions: sessions);

    test('the mahamantra stays at 16 and Om Namah Shivaya is 1', () {
      expect(mantraRoundsWithPhone(const [], today, hare), 16);
      expect(mantraRoundsWithPhone(const [], today, shiva), 1);
    });

    test('the day, which counts them all, is 17', () {
      expect(dayRoundsWithPhone(const [], today), 17);
    });

    test('the plain counter has none of either', () {
      expect(mantraRoundsWithPhone(const [], today, null), 0);
    });

    test("the phone's unsent rounds go to their own mantra only", () {
      final held = [sitting('hare-2', mantraId: hare, rounds: 2)];

      expect(mantraRoundsWithPhone(held, today, hare), 18);
      expect(mantraRoundsWithPhone(held, today, shiva), 1);
      expect(dayRoundsWithPhone(held, today), 19);
    });

    test('the sitting being counted right now is left out by except', () {
      final held = [sitting('now', mantraId: hare, rounds: 3)];

      expect(mantraRoundsWithPhone(held, today, hare, except: 'now'), 16);
      expect(dayRoundsWithPhone(held, today, except: 'now'), 17);
    });

    test('a sitting the server holds in full adds nothing, however it is matched', () {
      final held = [sitting('hare-1', mantraId: hare, rounds: 16)];

      expect(mantraRoundsWithPhone(held, today, hare), 16);
      expect(dayRoundsWithPhone(held, today), 17);
    });
  });

  group('roundsBeforeSitting', () {
    final now = DateTime(2026, 10, 6, 7);

    test('splits the ring from the day', () {
      final today = serverDay(
        completed: 17,
        sessions: [
          onServer('hare-1', mantraId: hare, rounds: 16),
          onServer('shiva-1', mantraId: shiva, rounds: 1),
        ],
      );

      final forHare = roundsBeforeSitting(const [], today, hare, now);
      expect(forHare.mantra, 16);
      expect(forHare.day, 17);

      final forShiva = roundsBeforeSitting(const [], today, shiva, now);
      expect(forShiva.mantra, 1);
      expect(forShiva.day, 17);
    });

    test('adds rounds the phone has not sent', () {
      final today = serverDay(completed: 2, sessions: [onServer('a', mantraId: hare, rounds: 2)]);
      final held = [
        sitting('a', mantraId: hare, rounds: 3),
        sitting('b', mantraId: shiva, rounds: 1),
      ];

      final forHare = roundsBeforeSitting(held, today, hare, now);
      expect(forHare.mantra, 3);
      expect(forHare.day, 4);
    });

    test("with the server's day not loaded, goes by the phone's own record of today", () {
      final held = [
        sitting('a', mantraId: hare, rounds: 4),
        sitting('b', mantraId: shiva, rounds: 1),
        sitting('c', mantraId: hare, rounds: 7, onDay: '2026-10-05'),
      ];

      final forHare = roundsBeforeSitting(held, null, hare, now);
      expect(forHare.mantra, 4);
      expect(forHare.day, 5);

      final plain = roundsBeforeSitting(held, null, null, now);
      expect(plain.mantra, 0);
      expect(plain.day, 5);
    });

    test('is zero for a day with nothing in it', () {
      final result = roundsBeforeSitting(const [], serverDay(), hare, now);
      expect(result.mantra, 0);
      expect(result.day, 0);
    });
  });

  group('the Jap tab and Home', () {
    test('plusRounds lays the phone over the day and the streak', () {
      final today = serverDay(completed: 0);
      final merged = today.plusRounds(2);

      expect(merged.day.roundsCompleted, 2);
      // A day with no rounds on the server is a day the run carries on through.
      expect(merged.streak, today.streak + 1);
    });

    test('plusRounds with nothing to add is the same day', () {
      final today = serverDay(completed: 3);
      expect(identical(today.plusRounds(0), today), isTrue);
    });

    test('plusRounds on a day that has rounds does not add to the streak again', () {
      final today = serverDay(completed: 3);
      expect(today.plusRounds(1).streak, today.streak);
    });

    test('withPhone shows the phone before the feed has caught up', () {
      const feed = SadhanaSummary(
        today: SadhanaDay(roundTarget: 16, roundsCompleted: 1, tasksTotal: 0, tasksDone: 0),
        streak: 4,
      );
      final loaded = serverDay(completed: 1);

      final shown = feed.withPhone(loaded, 2);
      expect(shown.today!.roundsCompleted, 3);
    });

    test('withPhone leaves the feed alone when the Jap tab has not loaded', () {
      const feed = SadhanaSummary(
        today: SadhanaDay(roundTarget: 16, roundsCompleted: 1, tasksTotal: 0, tasksDone: 0),
        streak: 4,
      );
      expect(identical(feed.withPhone(null, 5), feed), isTrue);
    });

    test('withPhone keeps "day not started" while nothing has been chanted', () {
      const feed = SadhanaSummary();
      final shown = feed.withPhone(serverDay(), 0);

      expect(shown.dayStarted, isFalse);
    });

    test('withPhone starts the day for rounds only the phone knows', () {
      const feed = SadhanaSummary();
      final shown = feed.withPhone(serverDay(), 1);

      expect(shown.dayStarted, isTrue);
      expect(shown.today!.roundsCompleted, 1);
    });
  });

  group('serverRoundsOf', () {
    test('sums the sittings of one mantra, and null is the plain counter', () {
      final today = serverDay(
        sessions: [
          onServer('a', mantraId: hare, rounds: 2),
          onServer('b', mantraId: hare, rounds: 3),
          onServer('c', mantraId: shiva, rounds: 1),
          onServer('d', rounds: 4),
        ],
      );

      expect(today.serverRoundsOf(hare), 5);
      expect(today.serverRoundsOf(shiva), 1);
      expect(today.serverRoundsOf(null), 4);
      expect(today.serverRoundsOf('unknown'), 0);
    });
  });
}
