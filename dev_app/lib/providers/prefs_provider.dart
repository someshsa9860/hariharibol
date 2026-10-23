import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/dev_summary.dart';
import '../services/dev_service.dart';

/// Push preferences, kept on the server (so a new phone starts with them).
class PrefsNotifier extends AsyncNotifier<DevPrefs> {
  @override
  Future<DevPrefs> build() => DevService.instance.prefs();

  Future<void> save(DevPrefs next) async {
    final previous = state.value;
    state = AsyncData(next);
    try {
      state = AsyncData(await DevService.instance.savePrefs(next));
    } catch (_) {
      if (previous != null) state = AsyncData(previous);
      rethrow;
    }
  }
}

final prefsProvider = AsyncNotifierProvider<PrefsNotifier, DevPrefs>(PrefsNotifier.new);
