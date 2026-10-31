import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../core/constants/chant_sync_config.dart';
import '../models/api_failure.dart';
import '../models/chant_sitting.dart';
import '../models/json.dart';

/// The sittings the phone holds right now.
typedef ChantLedgerReader = List<ChantSitting> Function();

/// Changes one sitting the phone holds: [change] is given what is held (null
/// when nothing is) and answers what to hold now, or null to leave it as it is.
typedef ChantLedgerUpdater =
    void Function(String clientId, ChantSitting? Function(ChantSitting? current) change);

/// Sends sittings in one request, each as `ChantSitting.toRequest` wrote it, and
/// answers the `clientId`s the server took.
typedef ChantSittingsSender = Future<List<String>> Function(List<Json> sittings);

typedef _Prepared = ({Json json, List<int> malaIndexes});

/// Sends the chanting kept on the phone to the account, in batches.
///
/// The phone is where chanting is written first (`ChantLedger`); this runs after,
/// in the background, and never throws, so nothing on screen waits for it and
/// nothing is lost to a bad connection. A sitting that could not be sent stays
/// on the phone and goes up with the next batch, even days later.
///
/// **Batches, not chants.** [schedule] is a throttle: the first call after a send
/// starts a [ChantSyncConfig.batchInterval] timer and the calls after it leave
/// that timer alone, so a sitting costs a request every two minutes however fast
/// it is chanted. (A debounce would never fire while someone chants.) Whoever
/// builds this says the other moments to [syncNow]: the app opening, closing or
/// coming to the front, the connection returning, a sitting ending.
///
/// **What is sent** is every sitting with something the server has not been told
/// (`ChantSitting.isDirty`), at most [ChantSyncConfig.sittingsPerRequest] to a
/// request and [ChantSyncConfig.requestsPerRun] requests to a run. A sitting is
/// sent once in a run, so one being chanted right now cannot keep a run going;
/// what it gained meanwhile goes up in the next. The server keeps a sitting by
/// its `clientId`, so one sent twice (the answer was lost) is still one.
///
/// **One at a time.** Asking while a run is going makes it run once more when it
/// ends. After a failure it tries again later — 30 seconds, then double, up to
/// 15 minutes — unless the server said when, or the session is over (signing in
/// again starts a run).
///
/// It does nothing without a signed-in account, and does not listen to the
/// network or the app's state itself.
class ChantSyncer {
  ChantSyncer({
    required this._send,
    required this._read,
    required this._update,
    required this._userId,
  });

  final ChantSittingsSender _send;
  final ChantLedgerReader _read;
  final ChantLedgerUpdater _update;
  final String? Function() _userId;

  Timer? _timer;
  Future<bool>? _running;
  bool _again = false;
  bool _stopped = false;
  int _failures = 0;

  /// Whether a run is waiting for its time — the next batch, or a retry.
  bool get isScheduled => _timer?.isActive ?? false;

  /// Something was counted: send it with the next batch. Calls while a batch is
  /// already waiting change nothing, so the wait is [ChantSyncConfig.batchInterval]
  /// from the first, not from the last. With [after] the run is set for then,
  /// replacing whatever was waiting.
  void schedule({Duration? after}) {
    if (_stopped || _userId() == null) return;
    if (after == null && isScheduled) return;
    _timer?.cancel();
    _timer = Timer(after ?? ChantSyncConfig.batchInterval, () => unawaited(syncNow()));
  }

  /// Changes a sitting the phone holds (see [ChantLedgerUpdater]) and asks for it
  /// to go up with the next batch. The write is on the phone at once; the request
  /// is not.
  void record(String clientId, ChantSitting? Function(ChantSitting? current) change) {
    _update(clientId, change);
    schedule();
  }

  /// Sends what is waiting now. Completes, with whether the server took
  /// anything, when this run, and any asked for during it, is over.
  Future<bool> syncNow() {
    if (_stopped) return Future.value(false);
    final running = _running;
    if (running != null) {
      _again = true;
      return running;
    }
    _timer?.cancel();
    return _running = _guarded().whenComplete(() {
      _running = null;
      if (_again) {
        _again = false;
        schedule(after: Duration.zero);
      }
    });
  }

  void dispose() {
    _stopped = true;
    _timer?.cancel();
  }

  Future<bool> _guarded() async {
    try {
      return await _run();
    } catch (error) {
      debugPrint('[ChantSync] failed: $error');
      _retryLater();
      return false;
    }
  }

  void _handle(ApiFailure failure) {
    switch (failure.kind) {
      case FailureKind.unauthorized:
        // The session is gone; signing in again starts a run.
        return;
      case FailureKind.rateLimited:
        _retryLater(failure.retryAfter);
      default:
        // Nothing in the request is at fault (a refused one is dealt with where
        // it happens), so it is tried again — a route not yet released, a server
        // down, a phone with no signal all mend themselves.
        _retryLater();
    }
  }

  void _retryLater([Duration? asked]) {
    _failures += 1;
    final backoff = ChantSyncConfig.retryFirst * pow(2, min(_failures - 1, 10)).toInt();
    final longest = ChantSyncConfig.retryLongest;
    schedule(after: asked ?? (backoff > longest ? longest : backoff));
  }

  Future<bool> _run() async {
    final user = _userId();
    if (user == null) return false;

    var sentAny = false;
    var requests = 0;
    var oneByOne = false;
    final tried = <String>{};

    while (true) {
      final waiting = [
        for (final sitting in _read())
          if (sitting.isDirty && !tried.contains(sitting.clientId)) sitting,
      ];
      if (waiting.isEmpty) return sentAny;
      if (requests >= ChantSyncConfig.requestsPerRun) {
        // More is waiting than one run sends; the rest goes straight after.
        schedule(after: Duration.zero);
        return sentAny;
      }

      final batch = waiting.take(oneByOne ? 1 : ChantSyncConfig.sittingsPerRequest).toList();
      final prepared = [for (final sitting in batch) sitting.toRequest()];
      tried.addAll(batch.map((sitting) => sitting.clientId));
      requests += 1;

      final List<String> took;
      try {
        took = await _send([for (final request in prepared) request.json]);
      } on ApiFailure catch (failure) {
        if (failure.kind != FailureKind.validation) {
          _handle(failure);
          return sentAny;
        }
        // Refused for what is in it. One sitting alone is left as it is — nothing
        // is dropped — while the others carry on; several together are sent one at
        // a time from here, so that one cannot hold the rest back.
        debugPrint('[ChantSync] refused: $failure');
        if (batch.length > 1) {
          oneByOne = true;
          tried.removeAll(batch.map((sitting) => sitting.clientId));
        }
        continue;
      }

      // Signed out, or into another account, while it was on its way: the answer
      // is not for whoever is here now.
      if (_userId() != user) return sentAny;

      sentAny = true;
      _failures = 0;
      _acknowledge(batch, prepared, took.toSet(), tried);
    }
  }

  /// Notes on the phone what the server took. The sitting is compared with what
  /// was *sent*, not what it is now, so a chant counted while the request was on
  /// its way is still waiting for the next one.
  void _acknowledge(
    List<ChantSitting> batch,
    List<_Prepared> prepared,
    Set<String> took,
    Set<String> tried,
  ) {
    for (var i = 0; i < batch.length; i++) {
      final sent = batch[i];
      if (!took.contains(sent.clientId)) continue;

      final malaIndexes = prepared[i].malaIndexes;
      _update(
        sent.clientId,
        (current) => current?.acknowledged(
          sentRounds: sent.rounds,
          sentBeads: sent.beads,
          sentFinished: sent.finished,
          sentMalas: {for (final index in malaIndexes) index: sent.pendingMalas[index]!},
        ),
      );

      // A very long sitting goes up over more than one request.
      if (malaIndexes.length >= ChantSyncConfig.malasPerSitting) tried.remove(sent.clientId);
    }
  }
}
