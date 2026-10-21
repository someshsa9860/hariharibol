import '../../models/share.dart';
import '../../models/verse.dart';
import 'app_navigator.dart';
import 'app_routes.dart';

/// Opens the share studio for a verse. Every place a verse is shown calls this, so they all make the same card.
/// [translation] is the rendering on screen (a reader may have picked another translator for this verse).
void openVerseShare(Verse verse, {VerseTranslation? translation}) {
  AppNavigator.instance.push(
    AppRoutes.shareStudio,
    extra: ShareStudioArgs(
      kind: 'SHLOKA',
      targetId: verse.verseId,
      title: verse.citation,
      sanskrit: verse.sanskrit,
      transliteration: verse.transliteration,
      meaning: (translation ?? verse.translation)?.meaning,
    ),
  );
}

/// Opens the share studio for a mantra, by its slug.
void openMantraShare({required String slug, required String name, String? text, String? meaning}) {
  AppNavigator.instance.push(
    AppRoutes.shareStudio,
    extra: ShareStudioArgs(kind: 'MANTRA', targetId: slug, title: name, sanskrit: text, meaning: meaning),
  );
}

/// Opens the share studio for a reel. [onShared] is how the reel counts the share.
void openReelShare({required String id, required String title, void Function()? onShared}) {
  AppNavigator.instance.push(
    AppRoutes.shareStudio,
    extra: ShareStudioArgs(kind: 'REEL', targetId: id, title: title, onShared: onShared),
  );
}
