import 'json.dart';
import 'verse.dart';

/// The mood a sloka answers — one of the six vikaras, or a practice problem
/// like missed rounds. Sent as `{ slug, name }` inline with a personal sloka.
class SlokaIssue {
  const SlokaIssue({required this.slug, required this.name});

  final String slug;
  final String name;

  factory SlokaIssue.fromJson(Json json) => SlokaIssue(
        slug: asString(json['slug']),
        name: asString(json['name']),
      );
}

/// A verse chosen for one person on one day, with the reason it was chosen.
class PersonalSloka {
  const PersonalSloka({
    required this.id,
    required this.verse,
    this.reason,
    this.issue,
    this.seenAt,
  });

  final String id;
  final Verse verse;

  /// Why this verse, in plain language. Written ahead of time by the daily job,
  /// never generated while the screen is waiting.
  final String? reason;
  final SlokaIssue? issue;
  final DateTime? seenAt;

  bool get isUnseen => seenAt == null;

  factory PersonalSloka.fromJson(Json json) => PersonalSloka(
        id: asString(json['id']),
        verse: Verse.fromJson(asJson(json['verse']) ?? const {}),
        reason: asStringOrNull(json['reason']),
        issue: asJson(json['issue']) == null ? null : SlokaIssue.fromJson(asJson(json['issue'])!),
        seenAt: asDate(json['seenAt']),
      );
}

/// The same verse for everyone, for one date.
class DailySloka {
  const DailySloka({required this.verse, this.imageUrl});

  final Verse verse;
  final String? imageUrl;

  factory DailySloka.fromJson(Json json) => DailySloka(
        verse: Verse.fromJson(asJson(json['verse']) ?? const {}),
        imageUrl: asStringOrNull(json['imageUrl']),
      );
}
