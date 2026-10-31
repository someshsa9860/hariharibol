import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../services/local_store.dart';
import '../services/routine_alert_service.dart';

/// Whether the routine's alerts can come right on time, and asking for it — the
/// system's side of the routine screen's card. A test puts a fake here.
final routineOnTimeAccessProvider = Provider<RoutineOnTimeAccess>((ref) => RoutineAlertService.instance);

/// When "Not now" was last pressed on that card. The phone's answer, kept in
/// [BoxKeys.routineOnTimeDismissed]; null when it never was.
class RoutineOnTimeDismissedNotifier extends Notifier<DateTime?> {
  @override
  DateTime? build() {
    final at = LocalStore.instance.read<int>(BoxKeys.routineOnTimeDismissed);
    return at == null ? null : DateTime.fromMillisecondsSinceEpoch(at);
  }

  Future<void> dismiss(DateTime at) async {
    state = at;
    await LocalStore.instance.write(BoxKeys.routineOnTimeDismissed, at.millisecondsSinceEpoch);
  }
}

final routineOnTimeDismissedProvider =
    NotifierProvider<RoutineOnTimeDismissedNotifier, DateTime?>(RoutineOnTimeDismissedNotifier.new);
