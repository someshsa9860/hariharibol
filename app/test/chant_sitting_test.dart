// One sitting as the phone keeps it: what was counted, what the server was told,
// and the limits it is held to so a request is never refused again and again.

import 'dart:convert';
import 'dart:math';

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/chant_sync_config.dart';
import 'package:hariharibol/models/chant_sitting.dart';
import 'package:hariharibol/models/json.dart';

final started = DateTime(2026, 10, 6, 5, 30);

ChantSitting sitting({
  String clientId = 'abc',
  String day = '2026-10-06',
  String? mantraId,
  int rounds = 0,
  int beads = 0,
  bool finished = false,
  DateTime? endedAt,
  Map<int, Json> pendingMalas = const {},
  bool synced = false,
  int syncedRounds = 0,
  int syncedBeads = 0,
  bool syncedFinished = false,
}) =>
    ChantSitting(
      clientId: clientId,
      day: day,
      startedAt: started,
      mantraId: mantraId,
      rounds: rounds,
      beads: beads,
      finished: finished,
      endedAt: endedAt,
      pendingMalas: pendingMalas,
      synced: synced,
      syncedRounds: syncedRounds,
      syncedBeads: syncedBeads,
      syncedFinished: syncedFinished,
    );

Json mala(int index, {int beads = 108, int durationMs = 4000, int avgGapMs = 30}) =>
    {'index': index, 'beads': beads, 'durationMs': durationMs, 'avgGapMs': avgGapMs};

/// A sitting the server has been told everything about.
ChantSitting sent({int rounds = 1, int beads = 0, String day = '2026-10-06'}) => sitting(
      day: day,
      rounds: rounds,
      beads: beads,
      synced: true,
      syncedRounds: rounds,
      syncedBeads: beads,
    );

void main() {
  group('newClientId', () {
    test('is 32 hex digits, the length the server takes', () {
      final id = ChantSitting.newClientId();
      expect(id, matches(RegExp(r'^[0-9a-f]{32}$')));
      expect(id.length, inInclusiveRange(8, 64));
    });

    test('is different every time', () {
      final ids = {for (var i = 0; i < 200; i++) ChantSitting.newClientId()};
      expect(ids, hasLength(200));
    });

    test('comes from the random source it is given', () {
      expect(ChantSitting.newClientId(Random(7)), ChantSitting.newClientId(Random(7)));
      expect(ChantSitting.newClientId(Random(7)), isNot(ChantSitting.newClientId(Random(8))));
    });
  });

  group('is there anything to send', () {
    test('a sitting opened and left with no bead is nothing', () {
      expect(sitting().hasChanted, isFalse);
      expect(sitting().isDirty, isFalse);
    });

    test('even one with a round waiting is nothing while no bead was counted', () {
      expect(sitting(pendingMalas: {1: mala(1)}).isDirty, isFalse);
    });

    test('a sitting never sent is waiting once a bead is counted', () {
      expect(sitting(beads: 1).hasChanted, isTrue);
      expect(sitting(beads: 1).isDirty, isTrue);
      expect(sitting(rounds: 1).isDirty, isTrue);
    });

    test('a sitting the server has been told in full is not waiting', () {
      expect(sent(rounds: 2, beads: 40).isDirty, isFalse);
    });

    test('more rounds or beads than were sent are waiting', () {
      expect(sent(rounds: 2).copyWith(rounds: 3).isDirty, isTrue);
      expect(sent(rounds: 2, beads: 10).copyWith(beads: 11).isDirty, isTrue);
    });

    test('an undo that takes the count back below what was sent is waiting too', () {
      expect(sent(rounds: 2, beads: 10).copyWith(beads: 9).isDirty, isTrue);
    });

    test('ending the sitting is waiting until the server has heard it', () {
      final ended = sent().copyWith(finished: true, endedAt: started);
      expect(ended.isDirty, isTrue);
      expect(ended.copyWith(syncedFinished: true).isDirty, isFalse);
    });

    test('a round whose figures changed is waiting', () {
      expect(sent().copyWith(pendingMalas: {1: mala(1)}).isDirty, isTrue);
    });
  });

  group('counted', () {
    test('sets the figures and keeps who and when', () {
      final base = sitting(mantraId: 'hare');
      final next = base.counted(rounds: 2, beads: 30);

      expect(next.rounds, 2);
      expect(next.beads, 30);
      expect(next.clientId, base.clientId);
      expect(next.mantraId, 'hare');
      expect(next.day, base.day);
      expect(next.startedAt, base.startedAt);
    });

    test('holds the figures to what the server takes', () {
      final next = sitting().counted(rounds: 9999, beads: 9999);
      expect(next.rounds, ChantSyncConfig.maxRounds);
      expect(next.beads, ChantSyncConfig.maxBeads);

      final negative = sitting().counted(rounds: -3, beads: -1);
      expect(negative.rounds, 0);
      expect(negative.beads, 0);
    });

    test('holds each round to the limits as well', () {
      final wild = {
        'index': 0,
        'beads': 5000,
        'durationMs': 999999999,
        'avgGapMs': -5,
        'complete': true,
      };
      final held = sitting().counted(rounds: 1, beads: 0, malas: [wild]).pendingMalas;

      expect(held.keys, [1]);
      final row = held[1]!;
      expect(row['index'], 1);
      expect(row['beads'], ChantSyncConfig.maxMalaBeads);
      expect(row['durationMs'], ChantSyncConfig.maxMalaMs);
      expect(row['avgGapMs'], 0);
      // What the model does not know about is carried as it came.
      expect(row['complete'], isTrue);

      final far = sitting().counted(rounds: 1, beads: 0, malas: [mala(9000)]).pendingMalas;
      expect(far.keys, [ChantSyncConfig.maxMalaIndex]);
    });

    test('rounds wait together, a later figure replacing an earlier one for the same round', () {
      var held = sitting().counted(rounds: 0, beads: 5, malas: [mala(1, beads: 5)]);
      held = held.counted(rounds: 1, beads: 0, malas: [mala(1), mala(2, beads: 0)]);

      expect(held.pendingMalas.keys.toList()..sort(), [1, 2]);
      expect(held.pendingMalas[1]!['beads'], 108);
    });

    test('with no rounds given, the ones waiting are kept', () {
      final held = sitting().counted(rounds: 1, beads: 0, malas: [mala(1)]);
      expect(held.counted(rounds: 1, beads: 4).pendingMalas.keys, [1]);
    });
  });

  group('toRequest', () {
    test('carries the sitting as the server reads it', () {
      final request = sitting(
        mantraId: 'hare',
        rounds: 2,
        beads: 40,
        pendingMalas: {1: mala(1)},
      ).toRequest();

      expect(request.json['clientId'], 'abc');
      expect(request.json['mantraId'], 'hare');
      expect(request.json['startedAt'], started.millisecondsSinceEpoch);
      expect(request.json['rounds'], 2);
      expect(request.json['beads'], 40);
      expect(request.json['malas'], [mala(1)]);
      expect(request.malaIndexes, [1]);
    });

    test('leaves out what is not there', () {
      final json = sitting(rounds: 1).toRequest().json;

      expect(json.containsKey('mantraId'), isFalse);
      expect(json.containsKey('endedAt'), isFalse);
      expect(json.containsKey('finish'), isFalse);
      expect(json.containsKey('malas'), isFalse);
    });

    test('says finish only for a sitting that has ended', () {
      final json = sitting(rounds: 1, finished: true, endedAt: started).toRequest().json;

      expect(json['finish'], isTrue);
      expect(json['endedAt'], started.millisecondsSinceEpoch);
    });

    test('sends the oldest 200 rounds, in order, and no more', () {
      final many = {for (var i = 300; i >= 1; i--) i: mala(i)};
      final request = sitting(rounds: 300, pendingMalas: many).toRequest();

      expect(request.malaIndexes, hasLength(ChantSyncConfig.malasPerSitting));
      expect(request.malaIndexes.first, 1);
      expect(request.malaIndexes.last, 200);
      final sentIndexes = [for (final row in request.json['malas'] as List) (row as Json)['index']];
      expect(sentIndexes, request.malaIndexes);
    });

    test('is plain JSON a request body can carry', () {
      final request = sitting(rounds: 1, pendingMalas: {1: mala(1)}, finished: true).toRequest();
      expect(() => jsonEncode(request.json), returnsNormally);
    });
  });

  group('acknowledged', () {
    test('marks the sitting as told, with the figures that were sent', () {
      final told = sitting(rounds: 2, beads: 10).acknowledged(
        sentRounds: 2,
        sentBeads: 10,
        sentFinished: false,
        sentMalas: const {},
      );

      expect(told.synced, isTrue);
      expect(told.syncedRounds, 2);
      expect(told.syncedBeads, 10);
      expect(told.isDirty, isFalse);
    });

    test('goes by what was sent and not by what is counted now', () {
      // Another round was counted while the request was on its way.
      final now = sitting(rounds: 3);
      final told = now.acknowledged(
        sentRounds: 2,
        sentBeads: 0,
        sentFinished: false,
        sentMalas: const {},
      );

      expect(told.syncedRounds, 2);
      expect(told.rounds, 3);
      expect(told.isDirty, isTrue);
    });

    test('forgets a round that has not changed since it was sent', () {
      final told = sitting(rounds: 2, pendingMalas: {1: mala(1), 2: mala(2)}).acknowledged(
        sentRounds: 2,
        sentBeads: 0,
        sentFinished: false,
        sentMalas: {1: mala(1), 2: mala(2)},
      );

      expect(told.pendingMalas, isEmpty);
    });

    test('keeps a round that changed while the request was away', () {
      final changed = mala(2, durationMs: 9000);
      final told = sitting(rounds: 2, pendingMalas: {1: mala(1), 2: changed}).acknowledged(
        sentRounds: 2,
        sentBeads: 0,
        sentFinished: false,
        sentMalas: {1: mala(1), 2: mala(2)},
      );

      expect(told.pendingMalas.keys, [2]);
      expect(told.pendingMalas[2], changed);
      expect(told.isDirty, isTrue);
    });

    test('keeps the rounds that were not in the request', () {
      final told = sitting(rounds: 3, pendingMalas: {1: mala(1), 2: mala(2)}).acknowledged(
        sentRounds: 3,
        sentBeads: 0,
        sentFinished: false,
        sentMalas: {1: mala(1)},
      );

      expect(told.pendingMalas.keys, [2]);
    });

    test('remembers that the end was told', () {
      final ended = sitting(rounds: 1, finished: true, endedAt: started);
      final told = ended.acknowledged(
        sentRounds: 1,
        sentBeads: 0,
        sentFinished: true,
        sentMalas: const {},
      );

      expect(told.syncedFinished, isTrue);
      expect(told.isDirty, isFalse);
    });
  });

  group('written to the phone and read back', () {
    Json passedThroughStorage(ChantSitting value) =>
        jsonDecode(jsonEncode(value.toJson())) as Json;

    test('comes back the same', () {
      final original = sitting(
        mantraId: 'hare',
        rounds: 4,
        beads: 17,
        finished: true,
        endedAt: started.add(const Duration(minutes: 40)),
        pendingMalas: {3: mala(3), 4: mala(4, beads: 17)},
        synced: true,
        syncedRounds: 3,
        syncedBeads: 5,
        syncedFinished: false,
      );

      final back = ChantSitting.tryFromJson(passedThroughStorage(original))!;

      expect(back.clientId, original.clientId);
      expect(back.day, original.day);
      expect(back.startedAt, original.startedAt);
      expect(back.mantraId, 'hare');
      expect(back.rounds, 4);
      expect(back.beads, 17);
      expect(back.finished, isTrue);
      expect(back.endedAt, original.endedAt);
      expect(back.pendingMalas, original.pendingMalas);
      expect(back.synced, isTrue);
      expect(back.syncedRounds, 3);
      expect(back.syncedBeads, 5);
      expect(back.syncedFinished, isFalse);
      expect(back.isDirty, original.isDirty);
    });

    test('a sitting with no mantra and no end comes back with neither', () {
      final back = ChantSitting.tryFromJson(passedThroughStorage(sitting(rounds: 1)))!;

      expect(back.mantraId, isNull);
      expect(back.endedAt, isNull);
      expect(back.pendingMalas, isEmpty);
    });

    test('a row with no id, day or start is not a sitting', () {
      final good = passedThroughStorage(sitting(rounds: 1));

      expect(ChantSitting.tryFromJson({...good}..remove('clientId')), isNull);
      expect(ChantSitting.tryFromJson({...good}..remove('day')), isNull);
      expect(ChantSitting.tryFromJson({...good}..remove('startedAt')), isNull);
      expect(ChantSitting.tryFromJson({...good, 'startedAt': 'yesterday'}), isNull);
      expect(ChantSitting.tryFromJson(const {}), isNull);
    });

    test('a bad round costs that round and not the sitting', () {
      final row = {
        ...passedThroughStorage(sitting(rounds: 2)),
        'pendingMalas': {
          '1': mala(1),
          'two': mala(2),
          '3': 'not a round',
        },
        'endedAt': 'never',
      };

      final back = ChantSitting.tryFromJson(row)!;

      expect(back.pendingMalas.keys, [1]);
      expect(back.endedAt, isNull);
    });

    test('missing figures read as nothing counted', () {
      final back = ChantSitting.tryFromJson({
        'clientId': 'abc',
        'day': '2026-10-06',
        'startedAt': started.millisecondsSinceEpoch,
      })!;

      expect(back.rounds, 0);
      expect(back.beads, 0);
      expect(back.finished, isFalse);
      expect(back.synced, isFalse);
      expect(back.isDirty, isFalse);
    });
  });

  group('keptSittings', () {
    // The 6th: today and yesterday are kept once sent.
    final now = DateTime(2026, 10, 6, 9);

    List<String> kept(List<ChantSitting> all) =>
        [for (final s in keptSittings(all, now)) s.clientId];

    test('keeps a sent sitting from today and from yesterday, not older', () {
      final all = [
        sent(day: '2026-10-06').copyWith(),
        ChantSitting(
          clientId: 'yesterday',
          day: '2026-10-05',
          startedAt: started,
          rounds: 1,
          synced: true,
          syncedRounds: 1,
        ),
        ChantSitting(
          clientId: 'older',
          day: '2026-10-04',
          startedAt: started,
          rounds: 1,
          synced: true,
          syncedRounds: 1,
        ),
      ];

      expect(kept(all), ['abc', 'yesterday']);
    });

    test('keeps one the server has not heard of, however old', () {
      final waiting = ChantSitting(
        clientId: 'weeks-ago',
        day: '2026-08-01',
        startedAt: started,
        rounds: 4,
      );

      expect(kept([waiting]), ['weeks-ago']);
    });

    test('keeps an old one that has more to tell than it has told', () {
      final more = ChantSitting(
        clientId: 'more',
        day: '2026-09-01',
        startedAt: started,
        rounds: 5,
        synced: true,
        syncedRounds: 4,
      );

      expect(kept([more]), ['more']);
    });

    test('drops a sitting with no bead in it', () {
      expect(kept([sitting(clientId: 'empty')]), isEmpty);
    });

    test('crosses a month boundary', () {
      final first = DateTime(2026, 11, 1, 9);
      final all = [
        ChantSitting(
          clientId: 'last-of-october',
          day: '2026-10-31',
          startedAt: started,
          rounds: 1,
          synced: true,
          syncedRounds: 1,
        ),
        ChantSitting(
          clientId: 'the-30th',
          day: '2026-10-30',
          startedAt: started,
          rounds: 1,
          synced: true,
          syncedRounds: 1,
        ),
      ];

      expect([for (final s in keptSittings(all, first)) s.clientId], ['last-of-october']);
    });
  });
}
