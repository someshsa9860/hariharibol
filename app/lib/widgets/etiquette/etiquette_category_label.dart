import '../../l10n/generated/app_localizations.dart';
import '../../models/etiquette.dart';

/// A category's name in the reader's language. The server files etiquette under
/// an id and sends an English name beside it; the name is used only for an id
/// the app has no words for yet, so a category added later is never blank.
String etiquetteCategoryLabel(AppLocalizations text, String id, {String? fallback}) {
  return switch (id) {
    EtiquetteCategory.temple => text.etiquetteCategoryTemple,
    EtiquetteCategory.deity => text.etiquetteCategoryDeity,
    EtiquetteCategory.prasad => text.etiquetteCategoryPrasad,
    EtiquetteCategory.holyName => text.etiquetteCategoryHolyName,
    EtiquetteCategory.guruVaishnava => text.etiquetteCategoryGuruVaishnava,
    EtiquetteCategory.speechMind => text.etiquetteCategorySpeechMind,
    EtiquetteCategory.dailyLife => text.etiquetteCategoryDailyLife,
    EtiquetteCategory.scripture => text.etiquetteCategoryScripture,
    EtiquetteCategory.holyPlaces => text.etiquetteCategoryHolyPlaces,
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
