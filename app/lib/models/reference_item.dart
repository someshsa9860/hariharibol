import 'json.dart';

/// Deities, gurus, translators and issues all come back in the same shape, so
/// they share one model rather than four identical ones.
class ReferenceItem {
  const ReferenceItem({
    required this.id,
    required this.slug,
    required this.name,
    this.description,
    this.imageUrl,
    this.fullImageUrl,
    this.displayOrder = 0,
  });

  final String id;
  final String slug;
  final String name;
  final String? description;
  final String? imageUrl;

  /// A 9:16 picture that fills the chant screen. Only deities have one, and
  /// only where staff uploaded it.
  final String? fullImageUrl;
  final int displayOrder;

  factory ReferenceItem.fromJson(Json json) => ReferenceItem(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        description: asStringOrNull(json['description']),
        imageUrl: asStringOrNull(json['imageUrl']),
        fullImageUrl: asStringOrNull(json['fullImageUrl']),
        displayOrder: asInt(json['displayOrder']),
      );
}
