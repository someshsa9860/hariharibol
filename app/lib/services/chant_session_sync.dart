import '../models/chant_sitting.dart';
import '../models/routine_task.dart';
import 'chant_recorder.dart';
import 'chant_syncer.dart';

/// Writes one sitting of the counter on the phone, and asks for it to go up.
///
/// Every call writes what the [ChantRecorder] holds into the phone's record of
/// chanting (`ChantLedger`) at once, so nothing waits on the network and nothing
/// is lost to a lost signal or a closed app. Sending is the [ChantSyncer]'s: a
/// batch every couple of minutes however fast it is chanted, and again when the
/// app is opened, sent to the back or finds a connection.
///
/// The sitting gets its id at the first bead, so a counter opened and left with
/// nothing counted leaves no row behind, and the same id is used for every write
/// after, which is how the server knows it is one sitting and not many.
class ChantSessionSync {
  ChantSessionSync({
    required this.recorder,
    required this.mantraId,
    required this.syncer,
    DateTime Function()? now,
  }) : _now = now ?? DateTime.now;

  final ChantRecorder recorder;
  final String? mantraId;
  final ChantSyncer syncer;
  final DateTime Function() _now;

  String? _clientId;

  /// Something was counted (or taken back): write the sitting down and ask for a
  /// batch.
  void schedule() => _record();

  /// Writes the sitting down, ends it if [finish], and sends what is waiting now
  /// — not only this sitting's, but any the phone still holds. Completes when the
  /// send is over; a failed one is not an error here, the sitting stays on the
  /// phone for the next batch.
  Future<void> send({bool finish = false}) async {
    _record(finish: finish);
    await syncer.syncNow();
  }

  void _record({bool finish = false}) {
    // Nothing was counted in this sitting: nothing to keep, nothing to end.
    if (recorder.tapCount == 0 && _clientId == null) return;

    final now = _now();
    final id = _clientId ??= ChantSitting.newClientId();
    final malas = [for (final mala in recorder.takeDirtyMalas()) mala.toJson()];
    final rounds = recorder.completedMalas;
    final beads = recorder.beadsInMala;

    syncer.record(id, (current) {
      var sitting =
          current ??
          ChantSitting(
            clientId: id,
            day: routineDayKey(now),
            startedAt: now,
            mantraId: mantraId,
          );
      sitting = sitting.counted(rounds: rounds, beads: beads, malas: malas);
      return finish ? sitting.copyWith(finished: true, endedAt: now) : sitting;
    });
  }
}
