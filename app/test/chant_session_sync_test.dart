// What the counter writes on the phone as it is chanted: nothing before the
// first bead, one sitting under one id however many writes, the figures and the
// rounds following the recorder, and a send that ends the sitting and waits for
// the batch. The server is a function the test scripts.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chant_sitting.dart';
import 'package:hariharibol/models/json.dart';
import 'package:hariharibol/models/routine_task.dart';
import 'package:hariharibol/services/chant_recorder.dart';
import 'package:hariharibol/services/chant_session_sync.dart';
import 'package:hariharibol/services/chant_syncer.dart';

/// The phone's record and a scripted server, with a syncer between them.
class Rig {
  Rig() {
    syncer = ChantSyncer(
      send: _send,
      read: () => held.values.toList(),
      update: update,
      userId: () => 'user-1',
    );
  }

  final held = <String, ChantSitting>{};
  final requests = <List<Json>>[];

  /// While set, a request waits for it: the time it is "on its way".
  Completer<void>? gate;

  /// An error to throw for a request, or null to let it through.
  Object? Function(List<Json> sittings)? fail;

  late final ChantSyncer syncer;

  Future<List<String>> _send(List<Json> sittings) async {
    requests.add(sittings);
    final wait = gate;
    if (wait != null) await wait.future;
    final error = fail?.call(sittings);
    if (error != null) throw error;
    return [for (final sitting in sittings) sitting['clientId'] as String];
  }

  void update(String clientId, ChantSitting? Function(ChantSitting? current) change) {
    final next = change(held[clientId]);
    if (next != null) held[clientId] = next;
  }

  /// The one sitting on the phone.
  ChantSitting get only => held.values.single;
}

/// A counter with [beadsPerRound] beads to the round, a clock the test moves,
/// and the sitting it writes.
class Counter {
  Counter({int beadsPerRound = 4, this.mantraId = 'hare-krishna'}) {
    recorder = ChantRecorder(beadsPerRound: beadsPerRound, now: () => clock);
    session = ChantSessionSync(
      recorder: recorder,
      mantraId: mantraId,
      syncer: rig.syncer,
      now: () => clock,
    );
  }

  final String? mantraId;
  final rig = Rig();
  var clock = DateTime(2026, 10, 6, 5, 30);

  late final ChantRecorder recorder;
  late final ChantSessionSync session;

  /// Counts [beads] beads, a second apart, and writes the sitting after each.
  void chant(int beads) {
    for (var i = 0; i < beads; i++) {
      clock = clock.add(const Duration(seconds: 1));
      recorder.tap();
      session.schedule();
    }
  }
}

Counter counter({int beadsPerRound = 4, String? mantraId = 'hare-krishna'}) {
  final value = Counter(beadsPerRound: beadsPerRound, mantraId: mantraId);
  addTearDown(value.rig.syncer.dispose);
  return value;
}

void main() {
  group('before the first bead', () {
    test('a counter opened and left writes nothing', () async {
      final c = counter();

      c.session.schedule();
      await c.session.send(finish: true);

      expect(c.rig.held, isEmpty);
      expect(c.rig.requests, isEmpty);
      expect(c.rig.syncer.isScheduled, isFalse);
    });

    test('a round carried in from an earlier sitting is not a chant here', () async {
      final c = counter();
      c.recorder.carry(3);

      c.session.schedule();
      await c.session.send(finish: true);

      expect(c.rig.held, isEmpty);
      expect(c.rig.requests, isEmpty);
    });
  });

  group('the first bead', () {
    test('makes the sitting, dated and timed from the clock, for its mantra', () {
      final c = counter();
      c.chant(1);

      final sitting = c.rig.only;
      expect(sitting.mantraId, 'hare-krishna');
      expect(sitting.day, routineDayKey(DateTime(2026, 10, 6)));
      expect(sitting.startedAt, DateTime(2026, 10, 6, 5, 30, 1));
      expect(sitting.rounds, 0);
      expect(sitting.beads, 1);
      expect(sitting.isDirty, isTrue);
      expect(sitting.clientId, matches(RegExp(r'^[0-9a-f]{32}$')));
    });

    test('asks for a batch, and sends nothing yet', () {
      final c = counter();
      c.chant(1);

      expect(c.rig.syncer.isScheduled, isTrue);
      expect(c.rig.requests, isEmpty);
    });

    test('the plain counter has no mantra', () {
      final c = counter(mantraId: null);
      c.chant(1);

      expect(c.rig.only.mantraId, isNull);
    });
  });

  group('one sitting', () {
    test('keeps its id, its day and its start however many beads follow', () {
      final c = counter();
      c.chant(1);
      final first = c.rig.only;

      // Past midnight, and a long time on: the sitting is still the one begun.
      c.clock = DateTime(2026, 10, 7, 0, 10);
      c.chant(2);

      expect(c.rig.held, hasLength(1));
      expect(c.rig.only.clientId, first.clientId);
      expect(c.rig.only.day, first.day);
      expect(c.rig.only.startedAt, first.startedAt);
      expect(c.rig.only.beads, 3);
    });

    test('two counters are two sittings', () {
      final a = counter();
      final b = counter();
      a.chant(1);
      b.chant(1);

      expect(a.rig.only.clientId, isNot(b.rig.only.clientId));
    });
  });

  group('the figures follow the recorder', () {
    test('beads into a round, and rounds finished', () {
      final c = counter();

      c.chant(3);
      expect(c.rig.only.rounds, 0);
      expect(c.rig.only.beads, 3);

      c.chant(1);
      expect(c.rig.only.rounds, 1);
      expect(c.rig.only.beads, 0);

      c.chant(5);
      expect(c.rig.only.rounds, 2);
      expect(c.rig.only.beads, 1);
    });

    test('an undo takes a bead back', () {
      final c = counter();
      c.chant(3);

      c.recorder.undo();
      c.session.schedule();

      expect(c.rig.only.beads, 2);
      expect(c.rig.only.rounds, 0);
    });

    test('an undo after the sitting was sent is waiting to be sent again', () async {
      final c = counter();
      c.chant(3);
      await c.session.send();
      expect(c.rig.only.isDirty, isFalse);

      c.recorder.undo();
      c.session.schedule();

      expect(c.rig.only.beads, 2);
      expect(c.rig.only.isDirty, isTrue);
    });

    test('a round finished early counts as a round', () {
      final c = counter(beadsPerRound: 12);
      c.chant(11);

      c.recorder.finishRound();
      c.session.schedule();

      expect(c.rig.only.rounds, 1);
      expect(c.rig.only.beads, 0);
    });

    test('a round picked up part-way finishes with the next beads', () {
      final c = counter();
      c.recorder.carry(3);

      c.chant(1);

      expect(c.rig.only.rounds, 1);
      expect(c.rig.only.beads, 0);
    });
  });

  group('the rounds', () {
    test('a finished round is carried with its figures', () {
      final c = counter();
      c.chant(4);

      final rounds = c.rig.only.pendingMalas;
      expect(rounds.keys, [1]);
      expect(rounds[1]!['index'], 1);
      expect(rounds[1]!['complete'], isTrue);
    });

    test('the round in progress is carried too, and is the next one', () {
      final c = counter();
      c.chant(5);

      final rounds = c.rig.only.pendingMalas;
      expect(rounds.keys.toList()..sort(), [1, 2]);
      expect(rounds[1]!['complete'], isTrue);
      expect(rounds[2]!['complete'], isFalse);
    });

    test('a bead in one round does not rewrite the rounds before it', () {
      final c = counter();
      c.chant(4);
      final before = c.rig.only.pendingMalas[1];

      c.chant(1);

      expect(c.rig.only.pendingMalas[1], before);
      expect(c.rig.only.pendingMalas.keys.toList()..sort(), [1, 2]);
    });

    test('once they are sent only the new ones wait', () async {
      final c = counter();
      c.chant(5);
      await c.session.send();
      expect(c.rig.only.pendingMalas, isEmpty);
      expect(c.rig.requests.single.single['malas'], hasLength(2));

      c.chant(1);

      // Round 2 got a bead: round 1 is on the server and is not sent again.
      expect(c.rig.only.pendingMalas.keys, [2]);
    });
  });

  group('send', () {
    test('ends the sitting, in the same request', () async {
      final c = counter();
      c.chant(5);
      c.clock = DateTime(2026, 10, 6, 6, 15);

      await c.session.send(finish: true);

      final request = c.rig.requests.single.single;
      expect(request['clientId'], c.rig.only.clientId);
      expect(request['mantraId'], 'hare-krishna');
      expect(request['rounds'], 1);
      expect(request['beads'], 1);
      expect(request['finish'], isTrue);
      expect(request['endedAt'], DateTime(2026, 10, 6, 6, 15).millisecondsSinceEpoch);

      expect(c.rig.only.finished, isTrue);
      expect(c.rig.only.endedAt, DateTime(2026, 10, 6, 6, 15));
      expect(c.rig.only.isDirty, isFalse);
    });

    test('without finish leaves the sitting open', () async {
      final c = counter();
      c.chant(2);

      await c.session.send();

      final request = c.rig.requests.single.single;
      expect(request.containsKey('finish'), isFalse);
      expect(request.containsKey('endedAt'), isFalse);
      expect(c.rig.only.finished, isFalse);
    });

    test('sends at once and does not wait for the batch', () async {
      final c = counter();
      c.chant(2);
      expect(c.rig.requests, isEmpty);

      await c.session.send();

      expect(c.rig.requests, hasLength(1));
    });

    test('completes only when the request is over', () async {
      final c = counter();
      c.chant(2);
      c.rig.gate = Completer<void>();

      var over = false;
      final sending = c.session.send(finish: true).then((_) => over = true);
      await Future<void>.delayed(Duration.zero);

      expect(c.rig.requests, hasLength(1));
      expect(over, isFalse);

      c.rig.gate!.complete();
      await sending;

      expect(over, isTrue);
      expect(c.rig.only.isDirty, isFalse);
    });

    test('a failure is not an error: the sitting stays for the next batch', () async {
      final c = counter();
      c.chant(5);
      c.rig.fail = (_) => const ApiFailure(kind: FailureKind.network);

      await c.session.send(finish: true);

      expect(c.rig.requests, hasLength(1));
      expect(c.rig.only.finished, isTrue);
      expect(c.rig.only.isDirty, isTrue);
      expect(c.rig.only.rounds, 1);
      expect(c.rig.only.pendingMalas.keys.toList()..sort(), [1, 2]);
      // And it is asked for again by itself.
      expect(c.rig.syncer.isScheduled, isTrue);
    });

    test('after a failure the next send carries it all', () async {
      final c = counter();
      c.chant(5);
      c.rig.fail = (_) => const ApiFailure(kind: FailureKind.network);
      await c.session.send(finish: true);

      c.rig.fail = null;
      c.chant(0);
      await c.rig.syncer.syncNow();

      expect(c.rig.requests, hasLength(2));
      final retry = c.rig.requests.last.single;
      expect(retry['rounds'], 1);
      expect(retry['finish'], isTrue);
      expect(retry['malas'], hasLength(2));
      expect(c.rig.only.isDirty, isFalse);
    });

    test('also sends a sitting from earlier that the phone still holds', () async {
      final c = counter();
      c.rig.held['earlier'] = ChantSitting(
        clientId: 'earlier',
        day: '2026-10-06',
        startedAt: DateTime(2026, 10, 6, 4),
        mantraId: 'om-namah-shivaya',
        rounds: 2,
      );
      c.chant(2);

      await c.session.send();

      final sent = [for (final sitting in c.rig.requests.single) sitting['clientId']];
      expect(sent, containsAll(['earlier', c.rig.held.keys.firstWhere((id) => id != 'earlier')]));
      expect(c.rig.held['earlier']!.isDirty, isFalse);
    });

    test('a counter that chanted nothing still lets an earlier sitting go', () async {
      final c = counter();
      c.rig.held['earlier'] = ChantSitting(
        clientId: 'earlier',
        day: '2026-10-06',
        startedAt: DateTime(2026, 10, 6, 4),
        rounds: 3,
      );

      await c.session.send(finish: true);

      expect(c.rig.requests, hasLength(1));
      expect(c.rig.requests.single.single['clientId'], 'earlier');
    });
  });

  group('two mantras on one day', () {
    test('are two sittings with their own mantra and their own rounds', () async {
      final hare = counter();
      final shiva = counter(mantraId: 'om-namah-shivaya');
      // One phone, one record.
      final record = hare.rig.held;

      hare.chant(8);
      shiva.chant(4);
      record.addAll(shiva.rig.held);

      final byMantra = {for (final each in record.values) each.mantraId: each.rounds};
      expect(byMantra, {'hare-krishna': 2, 'om-namah-shivaya': 1});
    });
  });
}
