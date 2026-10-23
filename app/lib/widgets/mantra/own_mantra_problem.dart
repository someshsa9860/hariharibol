import '../../core/constants/own_mantra_config.dart';
import '../../core/format/failure_text.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';

/// What the reader is told when adding a mantra or changing its picture fails.
///
/// The API's own words for these are English only, so they never reach the
/// reader: each case is worded here, in their language, by its code (or, for a
/// suggestion that expired and a picture that was too big, by its status, which
/// the client has no kind for).
String ownMantraProblem(AppLocalizations text, ApiFailure failure) {
  if (failure.statusCode == OwnMantraConfig.statusExpired) return text.ownMantraErrorExpired;
  if (failure.statusCode == OwnMantraConfig.statusTooLarge) return text.ownMantraPictureTooLarge;

  return switch (failure.code) {
    OwnMantraConfig.codeInputNotUsable => text.ownMantraErrorNotUsable,
    OwnMantraConfig.codeListFull => text.ownMantraErrorLimit,
    OwnMantraConfig.codeAiUnavailable => text.ownMantraErrorUnavailable,
    OwnMantraConfig.codePictureTooLarge => text.ownMantraPictureTooLarge,
    OwnMantraConfig.codePictureNotUsable => text.ownMantraPictureNotUsable,
    _ => switch (failure.kind) {
        FailureKind.rateLimited => text.ownMantraErrorLimitReached,
        // Only the reader who added a mantra may change its picture.
        FailureKind.forbidden => text.ownMantraPictureForbidden,
        _ => failure.ownWords(text),
      },
  };
}
