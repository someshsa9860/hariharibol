import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';

/// What a person is told when a call fails.
extension ApiFailureText on ApiFailure {
  /// The backend's own words when it sent some, otherwise the app's, in the
  /// reader's language. Every place that shows a failure goes through here, so
  /// no screen can end up with an empty line or with English it wrote itself.
  String describe(AppLocalizations text) {
    if (message.isNotEmpty) return message;

    return switch (code) {
      ClientFailureCode.signIn => text.errorSignIn,
      ClientFailureCode.insecureConnection => text.errorInsecureConnection,
      ClientFailureCode.cancelled => text.errorCancelled,
      _ => switch (kind) {
          FailureKind.timeout => text.errorTimeout,
          FailureKind.network => text.errorNetwork,
          FailureKind.unauthorized => text.errorSessionExpired,
          _ => text.errorGeneric,
        },
    };
  }
}
