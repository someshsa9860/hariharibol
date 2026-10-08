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
    this.malaAudioUrl,
    this.malaAudioStartMs = 0,
    this.malaAudioEndMs = 0,
    this.chantPhrases = const [],
    this.standardRounds = 0,
    this.standardCount = 0,
    this.deity,
    this.guru,
    this.availableLanguages = const [],
    this.isFavorite = false,
    this.myRounds = 0,
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

  /// One whole mala chanted on a recording — optional. The counter plays it
  /// and counts along: the chanting runs from [malaAudioStartMs] to
  /// [malaAudioEndMs] on the recording (an opening prayer before it is not a
  /// chant), and that stretch is split evenly into the round's chants.
  final String? malaAudioUrl;
  final int malaAudioStartMs;
  final int malaAudioEndMs;

  /// How this mantra may sound when chanted, one full repetition each in plain
  /// Roman letters — what auto count matches the live transcript against.
  /// Empty for a mantra the API has none for; see [spokenPhrases].
  final List<String> chantPhrases;

  final int standardRounds;
  final int standardCount;

  final ReferenceItem? deity;
  final ReferenceItem? guru;

  /// Set only by `GET /mantras/:slug` — the list endpoint does not resolve
  /// these, so they stay at their defaults for every card in a row.
  final List<String> availableLanguages;
  final bool isFavorite;

  /// Rounds this reader has chanted of this mantra, lifetime. 0 when signed
  /// out or never chanted — same as not being shown at all.
  final int myRounds;

  /// What auto count listens for: the API's phrases, or failing those the
  /// transliteration, when there is one.
  List<String> get spokenPhrases {
    if (chantPhrases.isNotEmpty) return chantPhrases;
    final fallback = transliteration?.trim() ?? '';
    return fallback.isEmpty ? const [] : [fallback];
  }

  Duration get duration => Duration(milliseconds: durationMs);
  bool get hasAudio => (audioUrl ?? '').isNotEmpty;

  /// A recording with no stretch to count over is not one the counter can
  /// follow — the API sends all three or none, this guards the same rule.
  bool get hasMalaAudio => (malaAudioUrl ?? '').isNotEmpty && malaAudioEndMs > malaAudioStartMs;

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
        malaAudioUrl: asStringOrNull(json['malaAudioUrl']),
        malaAudioStartMs: asInt(json['malaAudioStartMs']),
        malaAudioEndMs: asInt(json['malaAudioEndMs']),
        chantPhrases: asStringList(json['chantPhrases']),
        standardRounds: asInt(json['standardRounds']),
        standardCount: asInt(json['standardCount']),
        deity: asJson(json['deity']) == null ? null : ReferenceItem.fromJson(asJson(json['deity'])!),
        guru: asJson(json['guru']) == null ? null : ReferenceItem.fromJson(asJson(json['guru'])!),
        availableLanguages: asStringList(json['availableLanguages']),
        isFavorite: asBool(json['isFavorite']),
        myRounds: asInt(json['myRounds']),
      );
}
