import '../../l10n/generated/app_localizations.dart';
import '../../models/prayer.dart';

/// A category's name in the reader's language. The server files prayers under
/// an id and sends an English name beside it; the name is used only for an id
/// the app has no words for yet, so a category added later is never blank.
String prayerCategoryLabel(AppLocalizations text, String id, {String? fallback}) {
  return switch (id) {
    PrayerCategory.morning => text.prayersCategoryMorning,
    PrayerCategory.evening => text.prayersCategoryEvening,
    PrayerCategory.meals => text.prayersCategoryMeals,
    PrayerCategory.guru => text.prayersCategoryGuru,
    PrayerCategory.deity => text.prayersCategoryDeity,
    PrayerCategory.aarti => text.prayersCategoryAarti,
    PrayerCategory.peace => text.prayersCategoryPeace,
    PrayerCategory.other => text.prayersCategoryOther,
    _ => _named(id, fallback),
  };
}

String _named(String id, String? fallback) {
  final name = fallback?.trim() ?? '';
  if (name.isNotEmpty) return name;
  return [
    for (final word in id.split('-'))
      if (word.isNotEmpty) '${word[0].toUpperCase()}${word.substring(1)}',
  ].join(' ');
}
