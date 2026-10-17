import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/app_config.dart';
import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import '../models/auth_session.dart';
import '../models/json.dart';
import 'device_service.dart';
import 'firebase_service.dart';
import 'sse_parser.dart';

/// A parsed response: the `data` the API sent, and the `meta` block beside it
/// when the endpoint paginates.
class ApiResponse {
  const ApiResponse(this.data, this.meta, {this.statusCode});

  final dynamic data;
  final Json? meta;

  /// The HTTP status. Almost nothing needs it — but sign-in does, because a
  /// 201 means the account was just created and a 200 means it already
  /// existed, and that is the only signal the app gets.
  final int? statusCode;

  Json get json => asJson(data) ?? const {};
  List<dynamic> get list => data is List ? data as List<dynamic> : const [];
}

/// Stops a request that is still running — the Stop button on a chat reply.
/// Wraps Dio's token so nothing outside this file needs to import Dio.
class ApiCancelToken {
  final CancelToken _token = CancelToken();

  bool get isCancelled => _token.isCancelled;

  void cancel() {
    if (!_token.isCancelled) _token.cancel();
  }
}

/// The only thing in the app that speaks HTTP.
///
/// It does three jobs nothing else should have to think about:
///
///   1. Attaches the device headers and the bearer token to every request.
///   2. Keeps the session alive without being noticed. The server answers "I
///      do not know you" with 403 and the code `UNAUTHENTICATED`; the client
///      then swaps the refresh token for a new pair and replays the request, so
///      an expiry is invisible. The access token is also renewed once it is a
///      day old, long before it expires ([renewAccessTokenIfDue]).
///   3. Signs nobody out by accident. **Only the server answering the refresh
///      itself with 403 ends a session.** A dead network, a timeout, a 5xx, a
///      429, a page from a proxy: none of them says the session is bad, so each
///      leaves the person signed in and the refresh token untouched for the
///      next try.
///   4. Turns every failure into an [ApiFailure], so no view ever sees a
///      `DioException`.
class ApiClient {
  ApiClient._() {
    _dio = Dio(_options());
    _refreshDio = Dio(_options());
    _wire();
  }

  /// A client whose requests go to [adapter] instead of the network, for tests
  /// that script the server's answers.
  @visibleForTesting
  ApiClient.forTesting({required HttpClientAdapter adapter}) {
    _dio = Dio(_options())..httpClientAdapter = adapter;
    _refreshDio = Dio(_options())..httpClientAdapter = adapter;
    _wire();
  }

  static BaseOptions _options() => BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        contentType: Headers.jsonContentType,
        // Only 2xx is a success. Everything else has to reach the error
        // interceptor, because that is where a 403 UNAUTHENTICATED gets its
        // silent refresh.
        validateStatus: (status) => status != null && status >= 200 && status < 300,
      );

  void _wire() {
    _dio.interceptors.add(
      InterceptorsWrapper(onRequest: _onRequest, onError: _onError),
    );

    if (kDebugMode) {
      _dio.interceptors.add(
        LogInterceptor(requestBody: true, responseBody: true, error: true),
      );
    }
  }

  static final ApiClient instance = ApiClient._();

  late final Dio _dio;

  /// Used only for the refresh call. It carries no interceptors, so a refused
  /// refresh cannot start a second refresh.
  late final Dio _refreshDio;

  Future<_Refresh>? _refreshInFlight;

  /// When this run of the app last got a new pair, and when it last tried and
  /// could not. They keep [renewAccessTokenIfDue] from asking again and again:
  /// the first even if the phone's clock and the server's disagree about how old
  /// a token is, the second while the network is down.
  DateTime? _lastRenewal;
  DateTime? _lastRenewalFailure;

  Future<ApiResponse> get(
    String path, {
    Map<String, dynamic>? query,
    bool attested = false,
  }) =>
      _send('GET', path, query: query, attested: attested);

  Future<ApiResponse> post(
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool attested = false,
  }) =>
      _send('POST', path, body: body, query: query, attested: attested);

  /// POSTs a file as the body itself, with [contentType] saying what it is —
  /// no multipart to build. The bytes stay in the request, so the silent
  /// refresh can send them again.
  Future<ApiResponse> postBytes(
    String path,
    Uint8List bytes, {
    required String contentType,
    ApiCancelToken? cancel,
  }) async {
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: bytes,
        cancelToken: cancel?._token,
        options: Options(
          method: 'POST',
          contentType: contentType,
          sendTimeout: AppConfig.uploadTimeout,
        ),
      );
      return _unwrap(response);
    } on DioException catch (error) {
      throw _toFailure(error);
    }
  }

  /// POSTs and returns the reply as a stream of Server-Sent Events.
  ///
  /// The future completes when the server has answered with its headers. A
  /// refusal before streaming starts (a 402, a 409) is an ordinary JSON error
  /// and is thrown here as an [ApiFailure] with its code and details intact, so
  /// a caller treats it exactly like any other failed call. After that, a
  /// dropped connection is an [ApiFailure] on the stream. Cancelling [cancel]
  /// closes the connection, which is how the server learns to stop writing.
  ///
  /// The bearer token and the silent refresh work as for any other call.
  Future<Stream<SseEvent>> postEventStream(
    String path, {
    Object? body,
    ApiCancelToken? cancel,
  }) async {
    try {
      final response = await _dio.request<ResponseBody>(
        path,
        data: body,
        cancelToken: cancel?._token,
        options: Options(
          method: 'POST',
          responseType: ResponseType.stream,
          headers: const {Headers.acceptHeader: ApiHeaders.eventStream},
          receiveTimeout: AppConfig.streamReceiveTimeout,
        ),
      );
      final stream = response.data?.stream;
      if (stream == null) return const Stream<SseEvent>.empty();
      return guardStream(parseSse(stream));
    } on DioException catch (error) {
      await _readErrorBody(error);
      throw _toFailure(error);
    }
  }

  /// What goes wrong mid-stream is named for what it is. A dropped socket is
  /// the network; a read that stalls is a timeout; anything else is a fault in
  /// our own code and is `unknown` — calling it "the connection" is how a parser
  /// bug once looked like a bad signal.
  ///
  /// Written as `await for`, not `yield*`: `yield*` passes the source's errors
  /// on without ever throwing them here, so this `try` would catch nothing.
  @visibleForTesting
  Stream<SseEvent> guardStream(Stream<SseEvent> source) async* {
    try {
      await for (final event in source) {
        yield event;
      }
    } on ApiFailure {
      rethrow;
    } on DioException catch (error) {
      throw _toFailure(error);
    } on TimeoutException {
      throw const ApiFailure(kind: FailureKind.timeout);
    } on IOException {
      throw const ApiFailure(kind: FailureKind.network);
    } catch (error) {
      debugPrint('Event stream failed unexpectedly: $error');
      throw const ApiFailure(kind: FailureKind.unknown);
    }
  }

  /// A refused stream request still has a body to read: the JSON error. It is
  /// decoded in place so [_toFailure] sees it like any other error response.
  Future<void> _readErrorBody(DioException error) async {
    final response = error.response;
    final data = response?.data;
    if (response == null || data is! ResponseBody) return;
    try {
      final bytes = <int>[];
      await for (final piece in data.stream) {
        bytes.addAll(piece);
      }
      response.data = jsonDecode(utf8.decode(bytes, allowMalformed: true));
    } catch (_) {
      response.data = null;
    }
  }

  Future<ApiResponse> put(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<ApiResponse> patch(String path, {Object? body}) => _send('PATCH', path, body: body);

  Future<ApiResponse> delete(String path, {Object? body}) => _send('DELETE', path, body: body);

  Future<ApiResponse> _send(
    String method,
    String path, {
    Object? body,
    Map<String, dynamic>? query,
    bool attested = false,
  }) async {
    try {
      final response = await _dio.request<dynamic>(
        path,
        data: body,
        queryParameters: query,
        options: Options(
          method: method,
          // Read back in _onRequest — the App Check call is async and only
          // worth making for the endpoints that check it.
          extra: attested ? const {_attestedFlag: true} : null,
        ),
      );
      return _unwrap(response);
    } on DioException catch (error) {
      throw _toFailure(error);
    }
  }

  static const String _attestedFlag = 'attested';
  static const String _retriedFlag = 'retried';

  /// The code the API puts on "I do not know who you are" (a 403), as opposed
  /// to `FORBIDDEN`, which is a signed-in person who may not do this.
  static const String _unauthenticated = 'UNAUTHENTICATED';

  /// Calls that prove who is asking some other way, so they carry no bearer
  /// token and never start a refresh: sign-in presents the provider's token,
  /// and sign-out the refresh token itself.
  static const Set<String> _noBearerPaths = {ApiPaths.signInSocial, ApiPaths.logout};

  /// Everything here is wrapped, and `handler.next` is reached on every path.
  ///
  /// Dio waits on the handler, not on this function: if it throws before
  /// calling one, the request is never completed and never fails either — it
  /// simply hangs, for as long as the app is open. A missing header is a far
  /// smaller problem than a screen that never loads, so a failure to build one
  /// is logged and the request goes out without it.
  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      final session = AppSession.instance;
      final device = DeviceService.instance;

      options.headers[ApiHeaders.deviceId] = device.deviceId;
      options.headers[ApiHeaders.platform] = device.platform;
      options.headers[ApiHeaders.appVersion] = device.appVersion;

      // Before sign-in there is no chosen app language, so the phone's own is
      // sent: the server words its errors (a failed sign-in, a bad code) in it.
      final user = session.user;
      options.headers[ApiHeaders.acceptLanguage] =
          user?.appLanguage ?? PlatformDispatcher.instance.locale.languageCode;

      final token = session.accessToken;
      if (token != null && !_noBearerPaths.contains(options.path)) {
        options.headers[ApiHeaders.authorization] = 'Bearer $token';
      }

      // A token that has got old is swapped in the background. This request goes
      // out with the one it has, which is still good, and does not wait.
      unawaited(renewAccessTokenIfDue());

      if (options.extra[_attestedFlag] == true) {
        final attestation = await FirebaseService.instance.appCheckToken();
        if (attestation != null) {
          options.headers[ApiHeaders.appCheck] = attestation;
        }
      }
    } catch (error) {
      debugPrint('Could not build the request headers: $error');
    }

    handler.next(options);
  }

  /// "I do not know who you are" means the access token aged out. Refresh once,
  /// replay once.
  ///
  /// Several requests can fail together on launch, so the refresh is
  /// single-flight: the first one starts it, the rest await the same future and
  /// then replay with the token it produced.
  ///
  /// What the refresh came to decides the rest. Renewed: replay. Rejected (the
  /// server said 403): the session is over, and `_doRefresh` has already
  /// cleared it. Unavailable (anything else): the session is untouched and the
  /// caller is told what went wrong — the network, a timeout, the server — not
  /// that they were signed out.
  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final request = error.requestOptions;

    final alreadyRetried = request.extra[_retriedFlag] == true;
    final isAuthCall = request.path == ApiPaths.refresh || _noBearerPaths.contains(request.path);
    if (alreadyRetried || isAuthCall || !await _isUnauthenticated(error)) {
      return handler.next(error);
    }

    final refresh = await _refreshTokens();
    switch (refresh.outcome) {
      case _Outcome.rejected:
        return handler.next(error);
      case _Outcome.unavailable:
        return handler.next(error.copyWith(error: refresh.failure));
      case _Outcome.renewed:
        break;
    }

    try {
      request.extra[_retriedFlag] = true;
      request.headers[ApiHeaders.authorization] = 'Bearer ${AppSession.instance.accessToken}';
      final replay = await _dio.fetch<dynamic>(request);
      return handler.resolve(replay);
    } on DioException catch (retryError) {
      return handler.next(retryError);
    }
  }

  /// Whether the server refused this request for not knowing who sent it. A 403
  /// with any other code is a signed-in person who may not do this, and
  /// renewing the token would change nothing. 401 is what the API said before
  /// it moved to 403, so a server not yet updated still gets its refresh.
  Future<bool> _isUnauthenticated(DioException error) async {
    final status = error.response?.statusCode;
    if (status == 401) return true;
    if (status != 403) return false;

    // A refused stream request arrives with its body still unread.
    await _readErrorBody(error);
    return _codeOf(error.response) == _unauthenticated;
  }

  String? _codeOf(Response<dynamic>? response) =>
      asStringOrNull(asJson(asJson(response?.data)?['error'])?['code']);

  /// Swaps the access token for a new one when it is [AppConfig.accessRenewAfter]
  /// old, so a person who is signed in never meets an expired one.
  ///
  /// Called on launch, when the app comes back to the front, and with every
  /// request (all cheap when nothing is due). It never waits for the network on
  /// anyone's behalf and never throws: a failure is remembered for
  /// [AppConfig.renewRetryAfter] and the token in hand — good for days yet —
  /// carries on. Only the server answering 403 signs the person out.
  Future<void> renewAccessTokenIfDue() async {
    final session = AppSession.instance;
    final tokens = session.tokens;
    if (!session.isSignedIn || tokens == null || _refreshInFlight != null) return;

    final now = DateTime.now();
    final failedAt = _lastRenewalFailure;
    if (failedAt != null && now.difference(failedAt) < AppConfig.renewRetryAfter) return;
    final renewedAt = _lastRenewal;
    if (renewedAt != null && now.difference(renewedAt) < AppConfig.accessRenewAfter) return;
    if (!tokens.accessDueForRenewal(now, AppConfig.accessRenewAfter)) return;

    await _refreshTokens();
  }

  Future<_Refresh> _refreshTokens() {
    return _refreshInFlight ??= _doRefresh().then((result) {
      switch (result.outcome) {
        case _Outcome.renewed:
          _lastRenewal = DateTime.now();
          _lastRenewalFailure = null;
        case _Outcome.unavailable:
          _lastRenewalFailure = DateTime.now();
        case _Outcome.rejected:
          break;
      }
      return result;
    }).whenComplete(() => _refreshInFlight = null);
  }

  Future<_Refresh> _doRefresh() async {
    final session = AppSession.instance;
    final refreshToken = session.refreshToken;
    // Nothing to renew with: already signed out.
    if (refreshToken == null) return const _Refresh.rejected();

    try {
      final response = await _refreshDio.post<dynamic>(
        ApiPaths.refresh,
        data: {
          'refreshToken': refreshToken,
          'deviceId': DeviceService.instance.deviceId,
        },
      );

      final body = asJson(response.data);
      if (response.statusCode != 200 || body == null || body['success'] != true) {
        return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));
      }

      // The refresh endpoint returns the user as well, so a profile change made
      // on another device lands here without an extra call.
      final refreshed = AuthSession.fromJson(asJson(body['data']) ?? const {});
      if (refreshed.tokens.isEmpty) {
        return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));
      }

      await session.updateTokens(refreshed.tokens);
      await session.updateUser(refreshed.user);
      return const _Refresh.renewed();
    } on DioException catch (error) {
      // The one answer that ends a session: the server, in its own envelope,
      // saying it does not know this refresh token (expired, revoked, spent,
      // or the account is gone). A 403 page from something in front of the API
      // has no such code and says nothing about the session.
      if (error.response?.statusCode == 403 && _codeOf(error.response) == _unauthenticated) {
        // Not if a newer sign-in has replaced the session in the meantime.
        if (session.refreshToken == refreshToken) await session.clear();
        return const _Refresh.rejected();
      }
      return _Refresh.unavailable(_toFailure(error));
    } catch (error) {
      debugPrint('Token renewal failed, keeping the session: $error');
      return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));
    }
  }

  /// Pulls `data` and `meta` out of the envelope. Only 2xx reaches here — a
  /// 204 arrives with no body at all, which is a success with nothing in it.
  ApiResponse _unwrap(Response<dynamic> response) {
    final body = asJson(response.data);
    if (body == null) return ApiResponse(null, null, statusCode: response.statusCode);
    return ApiResponse(body['data'], asJson(body['meta']), statusCode: response.statusCode);
  }

  ApiFailure _toFailure(DioException error) {
    if (error.error is ApiFailure) return error.error as ApiFailure;

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiFailure(kind: FailureKind.timeout);
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        if (error.error is SocketException || error.error is HttpException) {
          return const ApiFailure(kind: FailureKind.network);
        }
        break;
      case DioExceptionType.cancel:
        return const ApiFailure(kind: FailureKind.unknown, code: ClientFailureCode.cancelled);
      case DioExceptionType.badCertificate:
        return const ApiFailure(
          kind: FailureKind.network,
          code: ClientFailureCode.insecureConnection,
        );
      case DioExceptionType.badResponse:
      default:
        break;
    }

    final response = error.response;
    final body = asJson(response?.data);
    final detail = asJson(body?['error']);
    final status = response?.statusCode ?? 0;

    return ApiFailure(
      kind: _kindFor(status, asStringOrNull(detail?['code'])),
      message: asString(detail?['message']),
      code: asStringOrNull(detail?['code']),
      statusCode: status,
      details: detail?['details'],
      retryAfter: _retryAfter(response),
    );
  }

  Duration? _retryAfter(Response<dynamic>? response) {
    final header = response?.headers.value('retry-after');
    final seconds = int.tryParse(header ?? '');
    return seconds == null ? null : Duration(seconds: seconds);
  }

  FailureKind _kindFor(int status, String? code) => switch (status) {
        400 || 422 => FailureKind.validation,
        401 => FailureKind.unauthorized,
        403 => code == _unauthenticated ? FailureKind.unauthorized : FailureKind.forbidden,
        404 => FailureKind.notFound,
        409 => FailureKind.conflict,
        429 => FailureKind.rateLimited,
        >= 500 => FailureKind.server,
        _ => FailureKind.unknown,
      };
}

enum _Outcome { renewed, rejected, unavailable }

/// What asking for a new token pair came to. Only [rejected] means the session
/// is over; [unavailable] carries what went wrong, for the caller to word.
class _Refresh {
  const _Refresh.renewed() : outcome = _Outcome.renewed, failure = null;
  const _Refresh.rejected() : outcome = _Outcome.rejected, failure = null;
  const _Refresh.unavailable(ApiFailure this.failure) : outcome = _Outcome.unavailable;

  final _Outcome outcome;
  final ApiFailure? failure;
}
