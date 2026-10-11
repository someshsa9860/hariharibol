import '../../l10n/generated/app_localizations.dart';
import '../../models/mantra_category.dart';

/// What a mantra category is called, in the reader's language.
///
/// A category is a free-text slug (`Mantra.category`), so only the four the
/// seed publishes under have a name in the ARB files. Any other — one an admin
/// typed into the Mantras page — is shown as its slug, title-cased: readable,
/// just not translated, and never a blank chip.
String mantraCategoryLabel(AppLocalizations text, String slug) =>
    switch (slug.trim().toLowerCase()) {
      MantraCategory.beej => text.mantraCategoryBeej,
      MantraCategory.gayatri => text.mantraCategoryGayatri,
      MantraCategory.mahamantra => text.mantraCategoryMahamantra,
      MantraCategory.name => text.mantraCategoryName,
      _ => _titleCase(slug.trim()),
    };

String _titleCase(String slug) =>
    slug.isEmpty ? slug : slug[0].toUpperCase() + slug.substring(1);
