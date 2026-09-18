import 'json.dart';

/// One grouping mantras are published under — "mahamantra", "gayatri" and so
/// on — with how many published mantras are in it.
///
/// There is no separate display name: the slug is shown title-cased. A second
/// column for that would be one more thing to seed and keep in sync for a
/// handful of categories that read fine as-is.
class MantraCategory {
  const MantraCategory({required this.slug, required this.count});

  final String slug;
  final int count;

  String get label => slug.isEmpty
      ? slug
      : slug[0].toUpperCase() + slug.substring(1);

  factory MantraCategory.fromJson(Json json) => MantraCategory(
        slug: asString(json['category']),
        count: asInt(json['count']),
      );
}
