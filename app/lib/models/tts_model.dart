import 'json.dart';

/// Where the files of an installed voice are, relative to its folder.
class TtsModelFiles {
  const TtsModelFiles({required this.model, required this.tokens, this.dataDir, this.lexicon});

  final String model;
  final String tokens;

  /// espeak-ng data, which Piper voices need to turn text into phonemes.
  final String? dataDir;
  final String? lexicon;

  factory TtsModelFiles.fromJson(Json json) => TtsModelFiles(
        model: asString(json['model']),
        tokens: asString(json['tokens'], 'tokens.txt'),
        dataDir: asStringOrNull(json['dataDir']),
        lexicon: asStringOrNull(json['lexicon']),
      );
}

/// One downloadable voice.
///
/// Installable only if it is [enabled] **and** has a [url] and a [sha256]: a
/// file that cannot be checked is never installed. The manifest lists
/// candidates with `enabled: false` until the file's existence and checksum
/// have been confirmed.
class TtsModelSpec {
  const TtsModelSpec({
    required this.id,
    required this.name,
    required this.languages,
    required this.engine,
    required this.url,
    required this.sizeBytes,
    required this.sha256,
    required this.files,
    this.archive = 'tar.bz2',
    this.license = '',
    this.speakerId = 0,
    this.enabled = true,
  });

  final String id;
  final String name;

  /// Language codes this voice can speak ("hi", "en").
  final List<String> languages;

  /// `sherpa-vits` is the only engine today.
  final String engine;
  final String url;
  final int sizeBytes;
  final String sha256;

  /// `tar.bz2`, `zip`, or `file` (a single file, no unpacking).
  final String archive;
  final TtsModelFiles files;
  final String license;
  final int speakerId;
  final bool enabled;

  bool get installable => enabled && url.isNotEmpty && sha256.length == 64;

  bool speaks(String language) => languages.contains(language);

  factory TtsModelSpec.fromJson(Json json) => TtsModelSpec(
        id: asString(json['id']),
        name: asString(json['name']),
        languages: asStringList(json['languages']),
        engine: asString(json['engine'], 'sherpa-vits'),
        url: asString(json['url']),
        sizeBytes: asInt(json['sizeBytes']),
        sha256: asString(json['sha256']).toLowerCase(),
        archive: asString(json['archive'], 'tar.bz2'),
        files: TtsModelFiles.fromJson(asJson(json['files']) ?? const {}),
        license: asString(json['license']),
        speakerId: asInt(json['speakerId']),
        enabled: asBool(json['enabled'], true),
      );
}

class TtsModelManifest {
  const TtsModelManifest({required this.version, required this.models});

  static const TtsModelManifest empty = TtsModelManifest(version: 0, models: []);

  final int version;
  final List<TtsModelSpec> models;

  /// The voice that speaks [language], preferring one that can be installed.
  TtsModelSpec? forLanguage(String language) {
    TtsModelSpec? candidate;
    for (final model in models) {
      if (!model.speaks(language)) continue;
      if (model.installable) return model;
      candidate ??= model;
    }
    return candidate;
  }

  TtsModelSpec? byId(String id) {
    for (final model in models) {
      if (model.id == id) return model;
    }
    return null;
  }

  factory TtsModelManifest.fromJson(Json json) => TtsModelManifest(
        version: asInt(json['version']),
        models: asList(json['models'], TtsModelSpec.fromJson).where((m) => m.id.isNotEmpty).toList(),
      );
}

/// Where a voice stands, for the settings screen.
sealed class TtsModelStatus {
  const TtsModelStatus();
}

class TtsNotInstalled extends TtsModelStatus {
  const TtsNotInstalled();
}

class TtsDownloading extends TtsModelStatus {
  const TtsDownloading({required this.received, required this.total});

  final int received;
  final int total;
  double get fraction => total <= 0 ? 0 : (received / total).clamp(0, 1).toDouble();
}

class TtsVerifying extends TtsModelStatus {
  const TtsVerifying();
}

class TtsExtracting extends TtsModelStatus {
  const TtsExtracting();
}

class TtsInstalled extends TtsModelStatus {
  const TtsInstalled(this.sizeBytes);

  final int sizeBytes;
}

class TtsFailed extends TtsModelStatus {
  const TtsFailed(this.reason);

  final String reason;
}
