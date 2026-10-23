import '../core/constants/own_mantra_config.dart';
import 'json.dart';
import 'mantra.dart';

/// One mantra the search came up with, before the reader has chosen it. The
/// phone sends back only its [index]; the words stay on the server.
class MantraSuggestion {
  const MantraSuggestion({
    required this.index,
    required this.name,
    required this.sanskrit,
    required this.transliteration,
    required this.kind,
    required this.addressedTo,
    required this.status,
    this.slug,
  });

  final int index;
  final String name;
  final String sanskrit;
  final String transliteration;

  /// [OwnMantraConfig.kindDeity] or [OwnMantraConfig.kindSaint].
  final String kind;

  /// The deity or saint the mantra is for.
  final String addressedTo;

  /// One of the `OwnMantraConfig.status…` words.
  final String status;

  /// Set when the mantra is already held — the catalogue's or the reader's own.
  final String? slug;

  bool get isSaint => kind == OwnMantraConfig.kindSaint;

  /// Only a mantra nobody on the reader's list has can be chosen: the others
  /// are already theirs, or are open to everyone.
  bool get canPick => status == OwnMantraConfig.statusNew || status == OwnMantraConfig.statusShared;

  /// A mantra that is held already can be opened.
  bool get canOpen => (slug ?? '').isNotEmpty && !canPick;

  factory MantraSuggestion.fromJson(Json json) => MantraSuggestion(
        index: asInt(json['index']),
        name: asString(json['name']),
        sanskrit: asString(json['sanskrit']),
        transliteration: asString(json['transliteration']),
        kind: asString(json['kind'], OwnMantraConfig.kindDeity),
        addressedTo: asString(json['addressedTo']),
        status: asString(json['status'], OwnMantraConfig.statusNew),
        slug: asStringOrNull(json['slug']),
      );
}

/// The answer to a search: a handle the server keeps for an hour, and the
/// mantras it found. [items] is empty when nothing well known came up.
class MantraSuggestions {
  const MantraSuggestions({required this.suggestionId, required this.items});

  final String suggestionId;
  final List<MantraSuggestion> items;

  factory MantraSuggestions.fromJson(Json json) => MantraSuggestions(
        suggestionId: asString(json['suggestionId']),
        items: [
          for (final item in json['items'] is List ? json['items'] as List : const [])
            if (item is Map) MantraSuggestion.fromJson(Map<String, dynamic>.from(item)),
        ],
      );
}

/// What came of one chosen mantra. [mantra] is null for a choice that failed.
class OwnMantraResult {
  const OwnMantraResult({required this.index, required this.status, this.mantra});

  /// The suggestion this answers.
  final int index;

  /// One of the `OwnMantraConfig.result…` words.
  final String status;
  final Mantra? mantra;

  OwnMantraResult withMantra(Mantra next) => OwnMantraResult(index: index, status: status, mantra: next);

  bool get added =>
      status == OwnMantraConfig.resultCreated ||
      status == OwnMantraConfig.resultShared ||
      status == OwnMantraConfig.resultAlready;

  /// The picture can be changed only on a private mantra the reader added.
  bool get canChangePicture =>
      status == OwnMantraConfig.resultCreated && (mantra?.isMine ?? false) && (mantra?.isPrivate ?? false);

  factory OwnMantraResult.fromJson(Json json) {
    final mantra = asJson(json['mantra']);
    return OwnMantraResult(
      index: asInt(json['index']),
      status: asString(json['status'], OwnMantraConfig.resultFailed),
      mantra: mantra == null ? null : Mantra.fromJson(mantra),
    );
  }
}
