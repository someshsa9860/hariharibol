import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../providers/reading_place_provider.dart';

/// Opens a book where the reader left it: the chapter they were in, scrolled to
/// the verse they had reached. A book never opened has no place, and opens on
/// its own page to choose from.
///
/// Shared by the Read tab and Home's row of books, so a book opens the same
/// way wherever it is tapped. The book's page stays reachable from the reader
/// (its "Contents" action) for anyone who wants a different chapter.
void openBook(WidgetRef ref, String slug) {
  final place = ref.read(readingPlacesProvider)[slug];
  AppNavigator.instance.push(
    place == null
        ? AppRoutes.bookPath(slug)
        : AppRoutes.chapterPath(
            slug,
            place.chapter,
            canto: place.canto,
            verse: place.verse,
          ),
  );
}
