import 'json.dart';

/// What the studio is making a card from — a verse, a mantra or a reel. One shape for all three, so every entry
/// point hands the same thing to the same screen.
class ShareStudioArgs {
  const ShareStudioArgs({
    required this.kind,
    required this.targetId,
    required this.title,
    this.sanskrit,
    this.transliteration,
    this.meaning,
    this.onShared,
  });

  /// `SHLOKA`, `MANTRA` or `REEL` — the API's `ShareKind`.
  final String kind;

  /// The verse's `verseId`, the mantra's slug, or the reel's id.
  final String targetId;
  final String title;
  final String? sanskrit;
  final String? transliteration;
  final String? meaning;

  /// Called when the system share sheet reports a completed share (never for a backed-out sheet) — a reel counts
  /// its shares from here.
  final void Function()? onShared;
}

/// A link the server made for something: the code is random and names no one.
class ShareLink {
  const ShareLink({required this.code, required this.url, required this.appUri});

  factory ShareLink.fromJson(Json json) => ShareLink(
        code: json['code'] as String,
        url: json['url'] as String,
        appUri: json['appUri'] as String,
      );

  final String code;
  final String url;
  final String appUri;
}

/// What a link opens, for the app's link handler.
class ResolvedShare {
  const ResolvedShare({required this.kind, required this.place});

  factory ResolvedShare.fromJson(Json json) {
    final content = asJson(json['content']) ?? const {};
    return ResolvedShare(kind: json['kind'] as String, place: asJson(content['place']) ?? const {});
  }

  final String kind;
  final Json place;
}

/// Whether an AI background can be made now. Never tokens: a yes/no and about how many the wallet holds.
class BackgroundQuote {
  const BackgroundQuote({required this.available, required this.canAfford, required this.backgroundsLeft});

  factory BackgroundQuote.fromJson(Json json) => BackgroundQuote(
        available: json['available'] == true,
        canAfford: json['canAfford'] == true,
        backgroundsLeft: (json['backgroundsLeft'] as num?)?.toInt() ?? 0,
      );

  final bool available;
  final bool canAfford;
  final int backgroundsLeft;
}
