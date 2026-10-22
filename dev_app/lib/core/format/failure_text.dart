import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';

/// What a person is told when a call fails.
extension ApiFailureText on ApiFailure {
  /// The backend's own words when it sent some, otherwise the app's, in the
  /// reader's language. Every place that shows a failure goes through here, so
  /// no screen can end up with an empty line or with English it wrote itself.
  String describe(AppLocalizations text) => message.isNotEmpty ? message : ownWords(text);

  /// The app's own words for this failure, whatever the server wrote. For a
  /// place where the server's text must never reach the reader — the chat,
  /// whose errors come from a provider rather than from our translated list.
  String ownWords(AppLocalizations text) {
    return switch (code) {
      ClientFailureCode.signIn => text.errorSignIn,
      ClientFailureCode.insecureConnection => text.errorInsecureConnection,
      ClientFailureCode.cancelled => text.errorCancelled,
      ClientFailureCode.notAllowed => text.errorNotAllowed,
      _ => switch (kind) {
          FailureKind.timeout => text.errorTimeout,
          FailureKind.network => text.errorNetwork,
          FailureKind.unauthorized => text.errorSessionExpired,
          FailureKind.forbidden => text.errorNotAllowed,
          _ => text.errorGeneric,
        },
    };
  }
}
