import 'dart:async';
import 'dart:math';

import 'package:flutter/foundation.dart';

import '../core/constants/routine_config.dart';
import '../core/constants/storage_keys.dart';
import '../models/api_failure.dart';
import '../models/routine_data.dart';
import '../models/routine_sync.dart';
import '../models/routine_task.dart';
import 'local_store.dart';
import 'routine_service.dart';

/// Keeps the routine on the account in step with the one on the phone.
///
/// The phone is the source of truth for what it does: every change is written
/// locally first and this runs after, in the background, so nothing on screen
/// ever waits for it and nothing is lost to a bad connection. It never throws.
///
/// **How a sync works.** The routine as the server last answered is kept
/// (`BoxKeys.routineSynced`, the *base*). What differs between that and the
/// routine now is what this phone has changed, and that is what is sent: no
/// bookkeeping is done where a change is made, and a phone with a routine from
/// before syncing existed uploads it for free, because everything is "new"
/// against an empty base. The server applies it and answers with the routine as
/// it stands, which includes what other phones sent; [mergeSynced] turns that
/// into the new routine. Where two phones changed the same row, the one that
/// reaches the server last wins.
///
/// **One at a time.** Asking while a sync is running makes it run once more
/// when it finishes. After a failure it tries again later — 30 seconds, then
/// double, up to 15 minutes — unless the server refused the request, which no
/// repetition would change.
///
/// It does nothing without a signed-in account, and does not listen to the
/// network or the app's state itself: whoever builds it says when to sync.
class RoutineSyncer {
  RoutineSyncer({
    required this._remote,
    required this._read,
    required this._write,
    required this._userId,
    LocalStore? store,
    DateTime Function()? clock,
  }) : _store = store ?? LocalStore.instance,
       _clock = clock ?? DateTime.now;

  final RoutineRemote _remote;
  final RoutineData Function() _read;
  final Future<void> Function(RoutineData) _write;
  final String? Function() _userId;
  final LocalStore _store;
  final DateTime Function() _clock;

  Timer? _timer;
  Future<void>? _running;
  bool _again = false;
  bool _stopped = false;
  int _failures = 0;

  /// Whether a sync is waiting for its time — after a change, or after a
  /// failure worth trying again.
  bool get isScheduled => _timer?.isActive ?? false;

  /// Something changed: send it once things settle, [after] by default the
  /// debounce. A newer call replaces an older one that has not fired.
  void schedule({Duration? after}) {
    if (_stopped || _userId() == null) return;
    _timer?.cancel();
    _timer = Timer(after ?? RoutineConfig.syncDebounce, () => unawaited(syncNow()));
  }

  /// Syncs now. Completes when this round, and any asked for during it, is over.
  Future<void> syncNow() {
    if (_stopped) return Future.value();
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

  Future<void> _guarded() async {
    try {
      await _run();
      _failures = 0;
    } on ApiFailure catch (failure) {
      _handle(failure);
    } catch (error) {
      debugPrint('[RoutineSync] failed: $error');
      _retryLater();
    }
  }

  void _handle(ApiFailure failure) {
    switch (failure.kind) {
      case FailureKind.unauthorized:
        // The session is gone; signing in again starts a sync.
        return;
      case FailureKind.validation || FailureKind.forbidden || FailureKind.notFound:
        // Refused for what it says, and it would say the same again.
        debugPrint('[RoutineSync] refused: $failure');
        return;
      case FailureKind.rateLimited:
        _retryLater(failure.retryAfter);
      default:
        _retryLater();
    }
  }

  void _retryLater([Duration? asked]) {
    _failures += 1;
    final backoff = RoutineConfig.syncRetryFirst * pow(2, min(_failures - 1, 10)).toInt();
    final longest = RoutineConfig.syncRetryLongest;
    schedule(after: asked ?? (backoff > longest ? longest : backoff));
  }

  Future<void> _run() async {
    final user = _userId();
    if (user == null) return;

    final sent = _read();
    final base = _readBase(user);
    // By calendar, not by 24-hour days: across a clock change the latter lands
    // on the evening before.
    final today = routineDay(_clock());
    final since = routineDayKey(
      DateTime(today.year, today.month, today.day - RoutineConfig.pastDays),
    );

    RoutineData? server;
    for (final piece in RoutineChanges.between(base, sent).chunked(RoutineConfig.syncChunkRows)) {
      server = await _remote.sync(piece, since: since);
    }

    // Signed out, or into another account, while it was on its way: the answer
    // is not for whoever is here now.
    if (server == null || _userId() != user) return;

    final now = _read();
    final result = mergeSynced(sent: sent, now: now, server: server, since: since);

    // The routine first, then the base. The other way round, a crash between
    // them would leave a base that holds rows the routine does not, which the
    // next sync would read as removals and send.
    final saved = result.merged.sameAs(now) ? Future<void>.value() : _write(result.merged);
    await saved;
    await _store.write(BoxKeys.routineSynced, {'owner': user, ...result.base.toJson()});

    if (!RoutineChanges.between(sent, now).isEmpty) schedule();
  }

  /// The routine as the server last answered, or nothing for a phone that has
  /// not synced — or that last synced as someone else.
  RoutineData _readBase(String user) {
    final stored = _store.readJson(BoxKeys.routineSynced);
    if (stored == null || stored['owner'] != user) return const RoutineData();
    return RoutineData.fromJson(stored);
  }
}
