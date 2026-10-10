import '../../core/constants/storage_keys.dart';
import '../local_store.dart';

/// Where the reader last stopped in each chapter, so the play button can offer
/// to carry on from there.
abstract class ReadingMemory {
  /// The verse id last played in [context] (a chapter), or null.
  String? lastVerseId(String context);
  Future<void> remember(String context, String verseId);
  Future<void> forget(String context);
}

class LocalStoreReadingMemory implements ReadingMemory {
  Map<String, dynamic> get _all => LocalStore.instance.readJson(BoxKeys.readingLastPlayed) ?? {};

  @override
  String? lastVerseId(String context) {
    final value = _all[context];
    return value is String && value.isNotEmpty ? value : null;
  }

  @override
  Future<void> remember(String context, String verseId) {
    final all = _all;
    all[context] = verseId;
    // The newest 50 chapters are enough; the box is not a history.
    while (all.length > 50) {
      all.remove(all.keys.first);
    }
    return LocalStore.instance.write(BoxKeys.readingLastPlayed, all);
  }

  @override
  Future<void> forget(String context) {
    final all = _all..remove(context);
    return LocalStore.instance.write(BoxKeys.readingLastPlayed, all);
  }
}

class InMemoryReadingMemory implements ReadingMemory {
  final Map<String, String> values = {};

  @override
  String? lastVerseId(String context) => values[context];

  @override
  Future<void> remember(String context, String verseId) async => values[context] = verseId;

  @override
  Future<void> forget(String context) async => values.remove(context);
}
