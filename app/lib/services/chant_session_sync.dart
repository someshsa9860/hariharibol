import 'dart:async';

import '../core/constants/chant_sync_config.dart';
import 'chant_recorder.dart';
import 'sadhana_service.dart';

/// Sends a sitting to the server as it goes: the session, its running totals, and
/// the rounds and words the [ChantRecorder] has kept since the last send.
///
/// Taps are sent in batches. The first one after a send starts the clock, and the
/// ones after it ride along without restarting it, so a steady chanter is saved
/// every [ChantSyncConfig.batchInterval] and not once per chant. Nothing here
/// ever interrupts chanting: a failed request is put back and the next one
/// carries it.
class ChantSessionSync {
  ChantSessionSync({required this.recorder, required this.mantraId});

  final ChantRecorder recorder;
  final String? mantraId;

  String? _sessionId;

  /// Running while taps are waiting to be sent.
  Timer? _timer;

  /// The sitting is over for the screen: a session still starting is not
  /// scheduled for.
  bool _closed = false;

  /// Opens the session. Chanting does not wait on the network: a tap before the
  /// session exists still counts locally, and the next send retries the start.
  Future<void> start() async {
    try {
      final session = await SadhanaService.instance.startSession(mantraId: mantraId);
      if (_closed) return;
      _sessionId = session.id;
      // Whatever was counted before the session existed goes up with it.
      if (recorder.hasUnsent) schedule();
    } catch (_) {
      // The next send starts it again.
    }
  }

  /// Marks that something is waiting to be sent.
  void schedule() {
    _timer ??= Timer(ChantSyncConfig.batchInterval, () {
      _timer = null;
      unawaited(send());
    });
  }

  /// Sends what is waiting now, without waiting out the batch — for when the app
  /// is about to go where a timer may not run.
  void flush() {
    final timer = _timer;
    if (timer == null) return;
    timer.cancel();
    _timer = null;
    unawaited(send());
  }

  /// Stops the batch clock; whatever is waiting is left for a final [send].
  void cancel() {
    _timer?.cancel();
    _timer = null;
  }

  /// The screen is gone: nothing more is scheduled.
  void close() {
    _closed = true;
    cancel();
  }

  /// Sends the running totals, then the rounds and words that changed.
  /// [finish] ends the session.
  Future<void> send({bool finish = false}) async {
    var id = _sessionId;
    id ??= await _retryStart();
    if (id == null) return;

    try {
      await SadhanaService.instance.updateSession(
        id,
        rounds: recorder.completedMalas,
        beads: recorder.beadsInMala,
        finish: finish,
      );
    } catch (_) {
      // A background send failing is not something to interrupt chanting for.
      // The next tap schedules another one with the same running totals.
    }

    await _sendRecord(id);
  }

  /// What fails is put back on the recorder, so the next send carries it.
  Future<void> _sendRecord(String id) async {
    final malas = recorder.takeDirtyMalas();
    final heard = recorder.takeUnsentHeard();
    if (malas.isEmpty && heard.isEmpty) return;

    try {
      if (malas.isNotEmpty) await SadhanaService.instance.saveChantDetail(id, malas);
      if (heard.isNotEmpty) await SadhanaService.instance.saveChantTranscripts(id, heard);
    } catch (_) {
      recorder.restoreUnsent(malas: malas, heard: heard);
    }
  }

  Future<String?> _retryStart() async {
    try {
      final session = await SadhanaService.instance.startSession(mantraId: mantraId);
      _sessionId = session.id;
      return session.id;
    } catch (_) {
      return null;
    }
  }
}
