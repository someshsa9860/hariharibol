import 'json.dart';

/// One thing Sakha may have noticed about the reader, in the order the profile
/// sheet lists them. [name] is the key the server sends it under.
enum SakhaTrait { gender, age, behaviour, lifeStage, spiritualStage, communication }

/// What Sakha has noted about the reader from their chats, as
/// `GET /api/app/chat/profile` sends it.
///
/// It is the reader's own: they can stop it being learned ([learning]) and
/// delete it. The values are the words Sakha wrote, shown as they are stored.
/// [keywords] are the subjects the chats touched — shown here so nothing is
/// hidden, but the server never puts them in a request to a model.
class SakhaProfile {
  const SakhaProfile({
    this.learning = true,
    this.fields = const {},
    this.notes = const [],
    this.keywords = const [],
    this.updatedAt,
  });

  /// False once the reader has asked Sakha to stop noticing: nothing new is
  /// noted and what is saved is not used.
  final bool learning;

  /// The traits that have a value; a trait nobody has noted is absent.
  final Map<SakhaTrait, String> fields;
  final List<String> notes;
  final List<String> keywords;
  final DateTime? updatedAt;

  /// Nothing has been noted, so there is nothing to show or to delete.
  bool get isEmpty => fields.isEmpty && notes.isEmpty && keywords.isEmpty;

  SakhaProfile copyWith({bool? learning}) => SakhaProfile(
        learning: learning ?? this.learning,
        fields: fields,
        notes: notes,
        keywords: keywords,
        updatedAt: updatedAt,
      );

  factory SakhaProfile.fromJson(Json json) {
    final traits = asJson(json['traits']) ?? const <String, dynamic>{};
    return SakhaProfile(
      // A reader nobody has written about yet is being learned from.
      learning: asBool(json['learning'], true),
      fields: {
        for (final trait in SakhaTrait.values) trait: ?asStringOrNull(traits[trait.name]),
      },
      notes: asStringList(traits['notes']),
      keywords: asStringList(json['keywords']),
      updatedAt: asDate(json['updatedAt']),
    );
  }
}
