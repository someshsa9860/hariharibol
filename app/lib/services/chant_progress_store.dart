import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/storage_keys.dart';
import 'local_store.dart';

/// The round a person left part-way, kept on the phone for each mantra.
///
/// Closing the counter, or the app being taken away, must not cost anyone the
/// beads of a round: reopening the same mantra carries on from the count it was
/// left at. Only that one number is kept — not the taps behind it — and the key
/// is removed when the round completes, so nothing builds up.
///
/// The store may not be open (a test) or may fail; not remembering is better
/// than failing a tap, so neither is an error here.
abstract final class ChantProgressStore {
  /// Stands in for the store in a widget test, where a write started under the
  /// fake clock never finishes and would hold the store's lock for every test
  /// after it (see "The routine tab" in app/CLAUDE.md).
  static Map<String, int>? _memory;

  @visibleForTesting
  static void keepInMemory() => _memory = {};

  @visibleForTesting
  static void keepInStore() => _memory = null;

  /// Beads left in the round in progress for [mantraId], 0 when none.
  static int read(String? mantraId) {
    final memory = _memory;
    if (memory != null) return memory[BoxKeys.chantProgress(mantraId)] ?? 0;
    try {
      return LocalStore.instance.read<int>(BoxKeys.chantProgress(mantraId)) ?? 0;
    } catch (_) {
      return 0;
    }
  }

  /// Remembers [beads] into the round, or forgets the round when it is 0.
  static void write(String? mantraId, int beads) {
    final memory = _memory;
    if (memory != null) {
      if (beads > 0) {
        memory[BoxKeys.chantProgress(mantraId)] = beads;
      } else {
        memory.remove(BoxKeys.chantProgress(mantraId));
      }
      return;
    }
    try {
      final key = BoxKeys.chantProgress(mantraId);
      unawaited(
        (beads > 0 ? LocalStore.instance.write(key, beads) : LocalStore.instance.delete(key))
            .catchError((_) {}),
      );
    } catch (_) {
      // See above.
    }
  }
}
