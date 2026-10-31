import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/storage_keys.dart';
import '../models/chant_sitting.dart';
import '../models/json.dart';
import 'local_store.dart';

/// The chanting counted on this phone, kept until the server has it.
///
/// One value under [BoxKeys.chantLedger]: `{owner, sittings}`. **The owner is
/// whose chanting it is** — rounds counted by one account are never read, shown
/// or sent for another: asking for a different owner's ledger finds it empty,
/// and the first write for the new owner replaces it. Signing out leaves the
/// ledger alone (`AppSession.clear` does not touch it), so rounds that were
/// never sent are still here when the same person signs in again.
///
/// The store may not be open (a test) or may fail; not remembering is better
/// than failing a tap, so neither is an error here.
abstract final class ChantLedgerStore {
  /// Stands in for the store in a widget test, where a write started under the
  /// fake clock never finishes and would hold the store's lock for every test
  /// after it (see "The routine tab" in app/CLAUDE.md).
  static Json? _memory;

  @visibleForTesting
  static void keepInMemory() => _memory = {};

  @visibleForTesting
  static void keepInStore() => _memory = null;

  /// The sittings kept for [owner], empty when none or when the ledger is
  /// another account's.
  static List<ChantSitting> read(String owner) {
    Json? stored;
    try {
      stored = _memory ?? LocalStore.instance.readJson(BoxKeys.chantLedger);
    } catch (_) {
      return const [];
    }
    if (stored == null || stored['owner'] != owner) return const [];
    return [
      for (final row in asList(stored['sittings'], (json) => ChantSitting.tryFromJson(json))) ?row,
    ];
  }

  /// Keeps [sittings] as [owner]'s, replacing whatever was there.
  static void write(String owner, List<ChantSitting> sittings) {
    final value = {
      'owner': owner,
      'sittings': [for (final sitting in sittings) sitting.toJson()],
    };
    final memory = _memory;
    if (memory != null) {
      memory
        ..clear()
        ..addAll(value);
      return;
    }
    try {
      unawaited(LocalStore.instance.write(BoxKeys.chantLedger, value).catchError((_) {}));
    } catch (_) {
      // See above.
    }
  }
}
