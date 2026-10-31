// The syncer that sends the chanting kept on the phone: in batches and not per
// chant, nothing lost to a failure, one run at a time. The server is a function
// the test scripts; the clock is the widget tester's, so a two-minute wait is a
// `pump`.

import 'dart:async';

import 'package:flutter_test/flutter_test.dart';

import 'package:hariharibol/core/constants/chant_sync_config.dart';
import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/chant_sitting.dart';
import 'package:hariharibol/models/json.dart';
import 'package:hariharibol/services/chant_syncer.dart';

ApiFailure failure(FailureKind kind, {Duration? retryAfter}) =>
    ApiFailure(kind: kind, retryAfter: retryAfter);

Json mala(int index) => {'index': index, 'beads': 108, 'durationMs': 4000, 'avgGapMs': 30};

/// The phone's record, a scripted server and a syncer between them.
class Rig {
  Rig({this.user = 'user-1'}) {
    syncer = ChantSyncer(
      send: _send,
      read: () => held.values.toList(),
      update: update,
      userId: () => user,
    );
  }

  String? user;
  final held = <String, ChantSitting>{};
  final requests = <List<Json>>[];

  /// While set, a request waits for it: the time it is "on its way".
  Completer<void>? gate;

  /// Answers an error to throw for a request, or null to let it through.
  Object? Function(List<Json> sittings)? fail;

  /// Whether the server takes the sittings it is sent.
  bool takes = true;

  late final ChantSyncer syncer;

  List<String> get sentIds => [
        for (final request in requests)
          for (final sitting in request) sitting['clientId'] as String,
      ];

  Future<List<String>> _send(List<Json> sittings) async {
    requests.add(sittings);
    final wait = gate;
    if (wait != null) await wait.future;
    final error = fail?.call(sittings);
    if (error != null) throw error;
    return takes ? [for (final sitting in sittings) sitting['clientId'] as String] : const [];
  }

  void update(String clientId, ChantSitting? Function(ChantSitting? current) change) {
    final next = change(held[clientId]);
    if (next != null) held[clientId] = next;
  }

  /// A sitting counted on the phone, written straight to the record (no ask for a send).
  void put(
    String clientId, {
    int rounds = 1,
    int beads = 0,
    String? mantraId,
    Map<int, Json> malas = const {},
  }) {
    held[clientId] = ChantSitting(
      clientId: clientId,
      day: '2026-10-06',
      startedAt: DateTime(2026, 10, 6, 5),
      mantraId: mantraId,
      rounds: rounds,
      beads: beads,
      pendingMalas: malas,
    );
  }

  bool dirty(String clientId) => held[clientId]!.isDirty;
}

void main() {
  group('batching', () {
    testWidgets('a chant is on the phone at once and goes up two minutes later', (tester) async {
      final rig = Rig();

      rig.syncer.record('a', (current) => (current ?? ChantSitting(
            clientId: 'a',
            day: '2026-10-06',
            startedAt: DateTime(2026, 10, 6, 5),
          )).counted(rounds: 1, beads: 0));

      expect(rig.held['a']!.rounds, 1);
      expect(rig.requests, isEmpty);
      expect(rig.syncer.isScheduled, isTrue);

      await tester.pump(ChantSyncConfig.batchInterval - const Duration(seconds: 1));
      expect(rig.requests, isEmpty);

      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(rig.requests, hasLength(1));
      expect(rig.dirty('a'), isFalse);

      rig.syncer.dispose();
    });

    testWidgets('more chants while it waits do not push the batch back', (tester) async {
      final rig = Rig()..put('a');

      rig.syncer.schedule();
      await tester.pump(const Duration(minutes: 1));
      rig.syncer.schedule();
      rig.syncer.schedule();
      await tester.pump(const Duration(minutes: 1));
      await tester.pump();

      // Two minutes from the first, not from the last.
      expect(rig.requests, hasLength(1));

      rig.syncer.dispose();
    });

    testWidgets('schedule(after:) replaces the wait', (tester) async {
      final rig = Rig()..put('a');

      rig.syncer.schedule();
      rig.syncer.schedule(after: const Duration(seconds: 5));

      await tester.pump(const Duration(seconds: 5));
      await tester.pump();
      expect(rig.requests, hasLength(1));

      // The first timer is gone, not left to send a second time.
      await tester.pump(ChantSyncConfig.batchInterval);
      await tester.pump();
      expect(rig.requests, hasLength(1));

      rig.syncer.dispose();
    });

    testWidgets('syncNow sends at once and puts the wait aside', (tester) async {
      final rig = Rig()..put('a');
      rig.syncer.schedule();

      final took = await rig.syncer.syncNow();

      expect(took, isTrue);
      expect(rig.requests, hasLength(1));
      expect(rig.syncer.isScheduled, isFalse);
      expect(rig.held['a']!.synced, isTrue);
      expect(rig.held['a']!.syncedRounds, 1);

      rig.syncer.dispose();
    });

    testWidgets('with nothing to tell the server, no request is made', (tester) async {
      final rig = Rig()..put('a');
      await rig.syncer.syncNow();
      rig.requests.clear();

      expect(await rig.syncer.syncNow(), isFalse);
      expect(rig.requests, isEmpty);

      rig.syncer.dispose();
    });

    testWidgets('a sitting opened and left with no bead is never sent', (tester) async {
      final rig = Rig()..put('empty', rounds: 0, beads: 0);

      await rig.syncer.syncNow();

      expect(rig.requests, isEmpty);

      rig.syncer.dispose();
    });

    testWidgets('sends the sittings as the request carries them', (tester) async {
      final rig = Rig()..put('a', rounds: 2, beads: 40, mantraId: 'hare', malas: {1: mala(1)});

      await rig.syncer.syncNow();

      final sent = rig.requests.single.single;
      expect(sent['clientId'], 'a');
      expect(sent['mantraId'], 'hare');
      expect(sent['rounds'], 2);
      expect(sent['beads'], 40);
      expect((sent['malas'] as List).single, mala(1));
      expect(rig.held['a']!.pendingMalas, isEmpty);

      rig.syncer.dispose();
    });

    testWidgets('a sitting the server does not take stays waiting', (tester) async {
      final rig = Rig()
        ..put('a')
        ..takes = false;

      await rig.syncer.syncNow();

      expect(rig.requests, hasLength(1));
      expect(rig.dirty('a'), isTrue);
      expect(rig.held['a']!.synced, isFalse);

      rig.syncer.dispose();
    });

    testWidgets('one request holds up to 25 sittings', (tester) async {
      final rig = Rig();
      for (var i = 0; i < 60; i++) {
        rig.put('s$i');
      }

      await rig.syncer.syncNow();

      expect([for (final request in rig.requests) request.length], [25, 25, 10]);
      expect(rig.held.values.every((sitting) => !sitting.isDirty), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('a run stops at 8 requests and the rest follows at once', (tester) async {
      final rig = Rig();
      const perRun = ChantSyncConfig.sittingsPerRequest * ChantSyncConfig.requestsPerRun;
      for (var i = 0; i < perRun + 5; i++) {
        rig.put('s$i');
      }

      await rig.syncer.syncNow();
      expect(rig.requests, hasLength(ChantSyncConfig.requestsPerRun));
      expect(rig.syncer.isScheduled, isTrue);

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      expect(rig.requests, hasLength(ChantSyncConfig.requestsPerRun + 1));
      expect(rig.requests.last, hasLength(5));
      expect(rig.held.values.every((sitting) => !sitting.isDirty), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('a sitting is sent once in a run, however long it stays dirty', (tester) async {
      final rig = Rig()
        ..put('a')
        ..takes = false;

      await rig.syncer.syncNow();

      expect(rig.sentIds, ['a']);

      rig.syncer.dispose();
    });

    testWidgets('a very long sitting goes up over more than one request', (tester) async {
      final malas = {for (var i = 1; i <= 250; i++) i: mala(i)};
      final rig = Rig()..put('long', rounds: 250, malas: malas);

      await rig.syncer.syncNow();

      final counts = [for (final request in rig.requests) (request.single['malas'] as List).length];
      expect(counts, [ChantSyncConfig.malasPerSitting, 50]);
      expect(rig.held['long']!.pendingMalas, isEmpty);
      expect(rig.dirty('long'), isFalse);

      rig.syncer.dispose();
    });
  });

  group('a chant counted while the request is on its way', () {
    testWidgets('is not marked as sent, and goes up with the next', (tester) async {
      final rig = Rig()
        ..put('a')
        ..gate = Completer<void>();

      final run = rig.syncer.syncNow();
      await tester.pump();
      expect(rig.requests.single.single['rounds'], 1);

      // Another round, counted while the first is away.
      rig.update('a', (current) => current!.counted(rounds: 2, beads: 0));
      rig.gate!.complete();
      await run;

      expect(rig.held['a']!.syncedRounds, 1);
      expect(rig.held['a']!.rounds, 2);
      expect(rig.dirty('a'), isTrue);

      rig.gate = null;
      await rig.syncer.syncNow();

      expect(rig.requests.last.single['rounds'], 2);
      expect(rig.dirty('a'), isFalse);

      rig.syncer.dispose();
    });

    testWidgets('a round changed meanwhile stays waiting, the others go', (tester) async {
      final rig = Rig()
        ..put('a', malas: {1: mala(1), 2: mala(2)})
        ..gate = Completer<void>();

      final run = rig.syncer.syncNow();
      await tester.pump();

      final changed = {...mala(2), 'durationMs': 9000};
      rig.update('a', (current) => current!.counted(rounds: 1, beads: 0, malas: [changed]));
      rig.gate!.complete();
      await run;

      expect(rig.held['a']!.pendingMalas.keys, [2]);
      expect(rig.held['a']!.pendingMalas[2]!['durationMs'], 9000);

      rig.syncer.dispose();
    });
  });

  group('when it fails', () {
    testWidgets('it waits 30 seconds, then doubles, up to 15 minutes', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => failure(FailureKind.network));

      expect(await rig.syncer.syncNow(), isFalse);

      for (final seconds in [30, 60, 120, 240, 480, 900, 900]) {
        final before = rig.requests.length;
        await tester.pump(Duration(seconds: seconds - 1));
        expect(rig.requests.length, before, reason: 'not before $seconds s');
        await tester.pump(const Duration(seconds: 1));
        await tester.pump();
        expect(rig.requests.length, before + 1, reason: 'at $seconds s');
      }
      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('a success starts the wait again from 30 seconds', (tester) async {
      final rig = Rig()..put('a');
      var failing = true;
      rig.fail = (_) => failing ? failure(FailureKind.server) : null;

      await rig.syncer.syncNow();
      await tester.pump(const Duration(seconds: 30));
      await tester.pump();
      await tester.pump(const Duration(seconds: 60));
      await tester.pump();
      expect(rig.requests, hasLength(3));

      failing = false;
      await tester.pump(const Duration(seconds: 120));
      await tester.pump();
      expect(rig.requests, hasLength(4));
      expect(rig.dirty('a'), isFalse);
      expect(rig.syncer.isScheduled, isFalse);

      failing = true;
      rig.put('b');
      await rig.syncer.syncNow();
      await tester.pump(const Duration(seconds: 29));
      await tester.pump();
      expect(rig.requests, hasLength(5));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(rig.requests, hasLength(6));

      rig.syncer.dispose();
    });

    testWidgets('a rate limit waits as long as the server said', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => failure(FailureKind.rateLimited, retryAfter: const Duration(seconds: 7)));

      await rig.syncer.syncNow();

      await tester.pump(const Duration(seconds: 6));
      expect(rig.requests, hasLength(1));
      await tester.pump(const Duration(seconds: 1));
      await tester.pump();
      expect(rig.requests, hasLength(2));

      rig.syncer.dispose();
    });

    testWidgets('a session that is over is not retried', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => failure(FailureKind.unauthorized));

      expect(await rig.syncer.syncNow(), isFalse);

      expect(rig.syncer.isScheduled, isFalse);
      await tester.pump(const Duration(hours: 1));
      expect(rig.requests, hasLength(1));
      expect(rig.dirty('a'), isTrue);

      // Signing in again asks for a run, and it goes through.
      rig.fail = null;
      await rig.syncer.syncNow();
      expect(rig.dirty('a'), isFalse);

      rig.syncer.dispose();
    });

    testWidgets('a route the server does not have yet is tried again', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => failure(FailureKind.notFound));

      await rig.syncer.syncNow();

      expect(rig.syncer.isScheduled, isTrue);
      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('an error of the app\'s own does not escape, and is tried again', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => StateError('not a request failure'));

      expect(await rig.syncer.syncNow(), isFalse);

      expect(rig.syncer.isScheduled, isTrue);
      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('several refused together are sent one at a time, and none is dropped', (tester) async {
      final rig = Rig()
        ..put('a')
        ..put('b')
        ..put('c')
        ..fail = ((sittings) {
          if (sittings.length > 1) return failure(FailureKind.validation);
          return sittings.single['clientId'] == 'b' ? failure(FailureKind.validation) : null;
        });

      await rig.syncer.syncNow();

      expect([for (final request in rig.requests) request.length], [3, 1, 1, 1]);
      expect(rig.dirty('a'), isFalse);
      expect(rig.dirty('c'), isFalse);
      // The one the server refuses stays on the phone, and is not hammered.
      expect(rig.dirty('b'), isTrue);
      expect(rig.syncer.isScheduled, isFalse);

      rig.syncer.dispose();
    });

    testWidgets('one sitting refused alone is left as it is', (tester) async {
      final rig = Rig()
        ..put('a')
        ..fail = ((_) => failure(FailureKind.validation));

      await rig.syncer.syncNow();

      expect(rig.requests, hasLength(1));
      expect(rig.dirty('a'), isTrue);
      expect(rig.syncer.isScheduled, isFalse);

      rig.syncer.dispose();
    });
  });

  group('one run at a time', () {
    testWidgets('asking during a run joins it, and runs once more after', (tester) async {
      final rig = Rig()
        ..put('a')
        ..gate = Completer<void>();

      final first = rig.syncer.syncNow();
      await tester.pump();
      rig.put('b');
      final second = rig.syncer.syncNow();

      expect(identical(first, second), isTrue);
      expect(rig.requests, hasLength(1));

      rig.gate!.complete();
      rig.gate = null;
      await first;
      expect(rig.syncer.isScheduled, isTrue);

      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      expect(rig.requests, hasLength(2));
      expect(rig.requests.last.single['clientId'], 'b');

      rig.syncer.dispose();
    });

    testWidgets('never has two requests in flight', (tester) async {
      final rig = Rig()
        ..put('a')
        ..gate = Completer<void>();

      unawaited(rig.syncer.syncNow());
      unawaited(rig.syncer.syncNow());
      unawaited(rig.syncer.syncNow());
      await tester.pump();

      expect(rig.requests, hasLength(1));

      rig.gate!.complete();
      rig.gate = null;
      await tester.pump(const Duration(milliseconds: 1));
      await tester.pump();
      rig.syncer.dispose();
    });
  });

  group('without an account', () {
    testWidgets('nothing is sent and nothing is scheduled', (tester) async {
      final rig = Rig(user: null)..put('a');

      rig.syncer.schedule();
      expect(rig.syncer.isScheduled, isFalse);
      expect(await rig.syncer.syncNow(), isFalse);

      expect(rig.requests, isEmpty);
      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('an answer that arrives after another account signed in is not for them', (tester) async {
      final rig = Rig()
        ..put('a')
        ..gate = Completer<void>();

      final run = rig.syncer.syncNow();
      await tester.pump();
      rig.user = 'user-2';
      rig.gate!.complete();

      expect(await run, isFalse);
      expect(rig.held['a']!.synced, isFalse);
      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });

    testWidgets('signing out while a request is away leaves the sitting waiting', (tester) async {
      final rig = Rig()
        ..put('a')
        ..gate = Completer<void>();

      final run = rig.syncer.syncNow();
      await tester.pump();
      rig.user = null;
      rig.gate!.complete();
      await run;

      expect(rig.dirty('a'), isTrue);

      rig.syncer.dispose();
    });
  });

  group('dispose', () {
    testWidgets('stops the wait, and later asks do nothing', (tester) async {
      final rig = Rig()..put('a');
      rig.syncer.schedule();

      rig.syncer.dispose();

      expect(rig.syncer.isScheduled, isFalse);
      await tester.pump(const Duration(minutes: 5));
      expect(rig.requests, isEmpty);

      expect(await rig.syncer.syncNow(), isFalse);
      rig.syncer.schedule();
      expect(rig.syncer.isScheduled, isFalse);
      expect(rig.requests, isEmpty);
    });
  });
}
