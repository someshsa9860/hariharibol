import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../services/local_store.dart';

/// The chanting page's battery saver: fewer animations and less frequent
/// updates. Stored on the device, like the microphone switch, and off until the
/// reader turns it on.
class ChantBatterySaverNotifier extends Notifier<bool> {
  @override
  bool build() {
    try {
      return LocalStore.instance.read<bool>(BoxKeys.chantBatterySaver) ?? false;
    } catch (_) {
      // The store is not open in a test; off is the normal page.
      return false;
    }
  }

  Future<void> set(bool on) async {
    state = on;
    try {
      await LocalStore.instance.write(BoxKeys.chantBatterySaver, on);
    } catch (_) {
      // Not remembering is better than failing to switch it.
    }
  }
}

final chantBatterySaverProvider = NotifierProvider<ChantBatterySaverNotifier, bool>(
  ChantBatterySaverNotifier.new,
);
