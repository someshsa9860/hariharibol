import 'json.dart';

/// What someone is struggling with — the vocabulary the app offers for it.
///
/// A fixed, seeded list rather than free text, because these are what verses
/// are mapped to: `VerseIssue` is the table the personalisation reads, and a
/// text box would give the picker nothing to match against.
class Issue {
  const Issue({
    required this.id,
    required this.slug,
    required this.name,
    required this.category,
    this.description,
    this.imageUrl,
    this.displayOrder = 0,
  });

  final String id;
  final String slug;
  final String name;

  /// `VIKARA` — the six inner enemies — or `PRACTICE`, the sadhana
  /// difficulties. `OTHER` exists for anything seeded later.
  final String category;

  final String? description;
  final String? imageUrl;
  final int displayOrder;

  bool get isVikara => category == 'VIKARA';
  bool get isPractice => category == 'PRACTICE';

  factory Issue.fromJson(Json json) => Issue(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        category: asString(json['category'], 'OTHER'),
        description: asStringOrNull(json['description']),
        imageUrl: asStringOrNull(json['imageUrl']),
        displayOrder: asInt(json['displayOrder']),
      );
}
