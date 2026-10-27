import 'dart:async';

import '../core/constants/storage_keys.dart';
import 'local_store.dart';

/// The two switches on the counter that are remembered on the phone: auto count,
/// and whether it listens with the microphone.
///
/// The store is not open in a test and a read can fail, so a failed read is the
/// default and a failed write is not remembering — better than failing to switch.
class ChantSwitchStore {
  const ChantSwitchStore._();

  /// Whether auto count was left on. Off if it never was set.
  static bool get autoChant {
    try {
      return LocalStore.instance.read<bool>(BoxKeys.autoChantEnabled) ?? false;
    } catch (_) {
      return false;
    }
  }

  static void saveAutoChant(bool enabled) {
    try {
      unawaited(LocalStore.instance.write(BoxKeys.autoChantEnabled, enabled));
    } catch (_) {
      // Not remembering is better than failing to switch it.
    }
  }

  /// Whether auto count listens with the microphone. On if it never was set.
  static bool get microphone {
    try {
      return LocalStore.instance.read<bool>(BoxKeys.autoChantMicrophone) ?? true;
    } catch (_) {
      return true;
    }
  }

  static void saveMicrophone(bool useMicrophone) {
    try {
      unawaited(
        LocalStore.instance.write(BoxKeys.autoChantMicrophone, useMicrophone).catchError((_) {}),
      );
    } catch (_) {
      // Not remembering is better than failing to switch it.
    }
  }
}
