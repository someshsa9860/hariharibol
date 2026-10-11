import 'json.dart';

/// One grouping mantras are published under — "mahamantra", "gayatri" and so
/// on — with how many published mantras are in it.
///
/// The server sends the slug and no display name. The four the seed publishes
/// under are named in the ARB files, so they read in the reader's language
/// (`mantraCategoryLabel`); one an admin adds later is shown as its slug,
/// title-cased, until it is given an entry there.
class MantraCategory {
  const MantraCategory({required this.slug, required this.count});

  /// The slugs the seed publishes under — the ones that have a translated name.
  static const beej = 'beej';
  static const gayatri = 'gayatri';
  static const mahamantra = 'mahamantra';
  static const name = 'name';

  final String slug;
  final int count;

  factory MantraCategory.fromJson(Json json) => MantraCategory(
        slug: asString(json['category']),
        count: asInt(json['count']),
      );
}
