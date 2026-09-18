import 'book.dart';
import 'json.dart';
import 'mantra.dart';
import 'verse.dart';

/// Something bookmarked. Exactly one of [verse], [mantra] or [book] is set, and
/// [type] says which — the API decides it, so the app never has to guess from
/// which field happens to be non-null.
class Favorite {
  const Favorite({
    required this.id,
    required this.type,
    this.createdAt,
    this.verse,
    this.mantra,
    this.book,
  });

  final String id;

  /// `verse`, `mantra` or `book`.
  final String type;
  final DateTime? createdAt;

  final Verse? verse;
  final Mantra? mantra;
  final Book? book;

  bool get isVerse => type == 'verse';
  bool get isMantra => type == 'mantra';
  bool get isBook => type == 'book';

  factory Favorite.fromJson(Json json) => Favorite(
        id: asString(json['id']),
        type: asString(json['type']),
        createdAt: asDate(json['createdAt']),
        verse: asJson(json['verse']) == null ? null : Verse.fromJson(asJson(json['verse'])!),
        mantra: asJson(json['mantra']) == null ? null : Mantra.fromJson(asJson(json['mantra'])!),
        book: asJson(json['book']) == null ? null : Book.fromJson(asJson(json['book'])!),
      );
}
