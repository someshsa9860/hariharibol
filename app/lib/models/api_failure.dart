/// What every failed call throws.
///
/// The API's error body is `{ success: false, error: { code, message, details } }`,
/// so services never inspect a `DioException` — they catch this and read [kind]
/// to decide between "show a message" and "sign the user out".
enum FailureKind {
  /// No route to the server: aeroplane mode, dead wifi, DNS.
  network,

  /// The request went out but nothing came back in time.
  timeout,

  /// 401 after a refresh attempt already failed. The session is gone.
  unauthorized,

  /// 403 — signed in, but not allowed. Includes a failed attestation check.
  forbidden,

  /// 404.
  notFound,

  /// 400 or 422 — the request was wrong.
  validation,

  /// 409.
  conflict,

  /// 429. [retryAfter] is set when the server said how long to wait.
  rateLimited,

  /// 5xx.
  server,

  /// Anything else, including a body that would not parse.
  unknown,
}

/// The [ApiFailure.code]s the app gives to failures it makes itself. The
/// server's own codes are its business; these carry a `CLIENT_` prefix so the
/// two never meet.
///
/// A failure made on the phone has no text of its own: it has no `BuildContext`
/// to look the words up with, and English written here would never be
/// translated. The screen that shows it asks `describe` (core/format/
/// failure_text.dart), which reads the code and the [FailureKind].
abstract final class ClientFailureCode {
  static const String signIn = 'CLIENT_SIGN_IN';
  static const String insecureConnection = 'CLIENT_INSECURE_CONNECTION';
  static const String cancelled = 'CLIENT_CANCELLED';
}

class ApiFailure implements Exception {
  const ApiFailure({
    required this.kind,
    this.message = '',
    this.code,
    this.statusCode,
    this.details,
    this.retryAfter,
  });

  /// Sign-in did not produce a usable identity token.
  const ApiFailure.signIn() : this(kind: FailureKind.unknown, code: ClientFailureCode.signIn);

  final FailureKind kind;

  /// The words the backend sent, which it writes for humans. Empty for a
  /// failure the app made itself or a reply with no message — never show this
  /// directly; go through `describe`, which falls back to the app's own text.
  final String message;

  /// The backend's machine-readable code, or a [ClientFailureCode].
  final String? code;

  final int? statusCode;
  final Object? details;
  final Duration? retryAfter;

  bool get isNetwork => kind == FailureKind.network || kind == FailureKind.timeout;
  bool get isAuth => kind == FailureKind.unauthorized;

  @override
  String toString() => 'ApiFailure(${kind.name}, $statusCode, $code): $message';
}
