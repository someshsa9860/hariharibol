import 'dart:async';

import 'package:flutter/foundation.dart';

import '../core/constants/storage_keys.dart';
import '../models/json.dart';
import '../models/reading_place.dart';
import 'local_store.dart';

/// Where the reader had got to in each book, kept on the phone.
///
/// One key holds the whole map (book slug → place): there are a handful of
/// books, and one small write per stop is cheaper than a key to look after for
/// each. Not remembering is better than failing a screen, so a store that is
/// not open (a test) or fails is never an error here.
abstract final class ReadingPlaceStore {
  /// Stands in for the store in a widget test, where a write started under the
  /// fake clock never finishes and would hold the store's lock for every test
  /// after it (see "The routine tab" in app/CLAUDE.md).
  static Map<String, ReadingPlace>? _memory;

  @visibleForTesting
  static void keepInMemory() => _memory = {};

  @visibleForTesting
  static void keepInStore() => _memory = null;

  /// Every saved place, by book slug.
  static Map<String, ReadingPlace> readAll() {
    final memory = _memory;
    if (memory != null) return Map.of(memory);
    try {
      final stored = LocalStore.instance.readJson(BoxKeys.readingPlaces);
      if (stored == null) return {};
      final places = <String, ReadingPlace>{};
      for (final entry in stored.entries) {
        final place = ReadingPlace.fromJson(entry.value);
        if (place != null) places[entry.key] = place;
      }
      return places;
    } catch (_) {
      return {};
    }
  }

  /// Replaces what is saved with [places].
  static void writeAll(Map<String, ReadingPlace> places) {
    final memory = _memory;
    if (memory != null) {
      memory
        ..clear()
        ..addAll(places);
      return;
    }
    try {
      final Json json = {
        for (final entry in places.entries) entry.key: entry.value.toJson(),
      };
      unawaited(
        LocalStore.instance
            .write(BoxKeys.readingPlaces, json)
            .catchError((_) {}),
      );
    } catch (_) {
      // See above.
    }
  }
}
