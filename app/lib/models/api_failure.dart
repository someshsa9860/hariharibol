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

class ApiFailure implements Exception {
  const ApiFailure({
    required this.kind,
    required this.message,
    this.code,
    this.statusCode,
    this.details,
    this.retryAfter,
  });

  final FailureKind kind;

  /// Safe to show. The backend writes these for humans; anything that is not
  /// gets replaced with a generic string before it reaches a view.
  final String message;

  /// The backend's machine-readable code, when it sent one.
  final String? code;

  final int? statusCode;
  final Object? details;
  final Duration? retryAfter;

  bool get isNetwork => kind == FailureKind.network || kind == FailureKind.timeout;
  bool get isAuth => kind == FailureKind.unauthorized;

  @override
  String toString() => 'ApiFailure(${kind.name}, $statusCode, $code): $message';
}
