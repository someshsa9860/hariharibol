import 'json.dart';

/// A reader's own words against a verse — private, never shown to anyone
/// else. Distinct from [VerseExplanation] in `verse.dart`, which is
/// app-written and shown to every reader.
class VerseNote {
  const VerseNote({
    required this.id,
    required this.verseId,
    required this.text,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String verseId;
  final String text;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory VerseNote.fromJson(Json json) => VerseNote(
        id: asString(json['id']),
        verseId: asString(json['verseId']),
        text: asString(json['text']),
        createdAt: asDate(json['createdAt']),
        updatedAt: asDate(json['updatedAt']),
      );
}
