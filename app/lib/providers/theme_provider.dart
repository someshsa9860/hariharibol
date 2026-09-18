import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/constants/storage_keys.dart';
import '../services/local_store.dart';

/// Light, dark, or whatever the phone is doing.
///
/// Stored on the device rather than on the account: someone reading at night on
/// their phone and in daylight on a tablet wants different answers, and the
/// server has no way to know which is which.
class ThemeModeNotifier extends Notifier<ThemeMode> {
  @override
  ThemeMode build() {
    return _parse(LocalStore.instance.read<String>(BoxKeys.themeMode));
  }

  Future<void> set(ThemeMode mode) async {
    state = mode;
    await LocalStore.instance.write(BoxKeys.themeMode, mode.name);
  }

  /// Anything unrecognised — a value from an older build, or nothing at all —
  /// falls back to following the system.
  static ThemeMode _parse(String? stored) => switch (stored) {
        'light' => ThemeMode.light,
        'dark' => ThemeMode.dark,
        _ => ThemeMode.system,
      };
}

final themeModeProvider = NotifierProvider<ThemeModeNotifier, ThemeMode>(ThemeModeNotifier.new);
