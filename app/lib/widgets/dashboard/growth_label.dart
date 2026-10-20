import '../../l10n/generated/app_localizations.dart';
import '../../models/sloka.dart';

/// The quality a struggle is the other side of — what the reader is growing
/// toward by working on it — in their language.
///
/// The server's issue list names the weakness ("Anger", "Could not finish my
/// rounds"); this card is for a devotee going forward, so the app names the
/// strength instead: kāma → self-mastery, krodha → calm, and so on. Keyed by the
/// seeded slug, which is what the verses are mapped to, so nothing about the API
/// changes. Null for any slug the app has no name for (an issue an admin added
/// later) — callers fall back to the name the server sent, so a chip is never
/// blank and never wrong.
String? growthLabel(AppLocalizations text, String slug) =>
    switch (slug.trim().toLowerCase()) {
      'kama' => text.growthKama,
      'krodha' => text.growthKrodha,
      'lobha' => text.growthLobha,
      'moha' => text.growthMoha,
      'mada' => text.growthMada,
      'matsarya' => text.growthMatsarya,
      'missed-chanting-time' => text.growthMissedChantingTime,
      'unmet-round-target' => text.growthUnmetRoundTarget,
      _ => null,
    };

/// [growthLabel], or [fallback] — the issue's own name — when there is none.
String growthLabelOr(AppLocalizations text, String slug, String fallback) =>
    growthLabel(text, slug) ?? fallback;

/// Why a personal verse was chosen, said as growth. The server's line is
/// "Because you mentioned anger", which frames the verse as an answer to a
/// failing; when the app can name the quality it says that instead. Anything
/// else keeps the server's line.
String? growthReason(AppLocalizations text, PersonalSloka sloka) {
  final issue = sloka.issue;
  final quality = issue == null ? null : growthLabel(text, issue.slug);
  return quality == null ? sloka.reason : text.homeGrowReason(quality);
}
