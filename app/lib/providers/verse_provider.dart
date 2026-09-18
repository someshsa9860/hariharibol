import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/verse.dart';
import '../services/verse_service.dart';

/// Every published rendering of one verse, for the compare-translations
/// sheet. Keyed by the verse's dotted `verseId`.
final verseTranslationsProvider =
    FutureProvider.family.autoDispose<List<VerseTranslation>, String>((ref, verseId) {
  return VerseService.instance.translations(verseId);
});

/// Curated cross-links out of one verse, for the related-verses sheet.
final verseRelatedProvider =
    FutureProvider.family.autoDispose<List<RelatedVerse>, String>((ref, verseId) {
  return VerseService.instance.related(verseId);
});
