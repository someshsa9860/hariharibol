import 'json.dart';
import 'reference_item.dart';

/// A mantra, already resolved by the API into the reader's two languages: the
/// script comes from their mantra language, the meaning from their reading
/// language. Chanting in Devanagari while reading English is the normal case.
class Mantra {
  const Mantra({
    required this.id,
    required this.slug,
    required this.name,
    required this.text,
    required this.textLanguage,
    this.description,
    this.category,
    this.sampradaya,
    this.tags = const [],
    this.transliteration,
    this.meaning,
    this.purport,
    this.meaningLanguage,
    this.audioUrl,
    this.durationMs = 0,
    this.standardRounds = 0,
    this.standardCount = 0,
    this.deity,
    this.guru,
  });

  final String id;
  final String slug;
  final String name;

  /// The mantra itself, in the reader's chosen script.
  final String text;
  final String textLanguage;

  final String? description;
  final String? category;
  final String? sampradaya;
  final List<String> tags;
  final String? transliteration;
  final String? meaning;
  final String? purport;
  final String? meaningLanguage;

  final String? audioUrl;

  /// Roughly how long one repetition takes. Drives the chant pacer, which must
  /// work before — or without — the audio loading.
  final int durationMs;

  final int standardRounds;
  final int standardCount;

  final ReferenceItem? deity;
  final ReferenceItem? guru;

  Duration get duration => Duration(milliseconds: durationMs);
  bool get hasAudio => (audioUrl ?? '').isNotEmpty;

  factory Mantra.fromJson(Json json) => Mantra(
        id: asString(json['id']),
        slug: asString(json['slug']),
        name: asString(json['name']),
        text: asString(json['text']),
        textLanguage: asString(json['textLanguage'], 'sa'),
        description: asStringOrNull(json['description']),
        category: asStringOrNull(json['category']),
        sampradaya: asStringOrNull(json['sampradaya']),
        tags: asStringList(json['tags']),
        transliteration: asStringOrNull(json['transliteration']),
        meaning: asStringOrNull(json['meaning']),
        purport: asStringOrNull(json['purport']),
        meaningLanguage: asStringOrNull(json['meaningLanguage']),
        audioUrl: asStringOrNull(json['audioUrl']),
        durationMs: asInt(json['durationMs']),
        standardRounds: asInt(json['standardRounds']),
        standardCount: asInt(json['standardCount']),
        deity: asJson(json['deity']) == null ? null : ReferenceItem.fromJson(asJson(json['deity'])!),
        guru: asJson(json['guru']) == null ? null : ReferenceItem.fromJson(asJson(json['guru'])!),
      );
}
