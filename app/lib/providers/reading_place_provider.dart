import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/reading_place.dart';
import '../services/reading_place_store.dart';
import 'session_provider.dart';

/// Where the reader stopped in each book, by book slug.
///
/// Read from the phone when it is first needed, so the Read tab can say "Canto
/// 2 · Chapter 10 · Verse 4" on its first frame instead of waiting for a
/// request. Rebuilt when the account changes, so one person's places are never
/// shown to the next.
class ReadingPlacesNotifier extends Notifier<Map<String, ReadingPlace>> {
  @override
  Map<String, ReadingPlace> build() {
    ref.watch(currentUserProvider.select((user) => user?.id));
    return ReadingPlaceStore.readAll();
  }

  /// Remembers [place] as where the reader is in [slug]. Does nothing (no write,
  /// no rebuild) when it is already what is saved, which is most scroll stops.
  void remember(String slug, ReadingPlace place) {
    if (state[slug] == place) return;
    state = {...state, slug: place};
    ReadingPlaceStore.writeAll(state);
  }
}

final readingPlacesProvider =
    NotifierProvider<ReadingPlacesNotifier, Map<String, ReadingPlace>>(
      ReadingPlacesNotifier.new,
    );
