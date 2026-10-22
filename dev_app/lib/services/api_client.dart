import 'dart:async';
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

/// What a call hands back: the `data` of the server's envelope, its `meta`, and the status.
class ApiResponse {
  const ApiResponse(this.data, this.meta, {this.statusCode});

  final dynamic data;
  final Json? meta;
  final int? statusCode;

  Json get json => asJson(data) ?? const {};
  List<dynamic> get list => data is List ? data as List<dynamic> : const [];
}

/// The one HTTP client. It attaches the headers every request carries and the bearer token, renews the access
/// token before it is old, and answers a 403 `UNAUTHENTICATED` with one silent refresh and one replay. The only
/// thing that signs the developer out is the server refusing a refresh.
class ApiClient {
  ApiClient._() {
    _dio = Dio(_options());
    _refreshDio = Dio(_options());
    _wire();
  }

  @visibleForTesting
  ApiClient.forTesting({required HttpClientAdapter adapter}) {
    _dio = Dio(_options())..httpClientAdapter = adapter;
    _refreshDio = Dio(_options())..httpClientAdapter = adapter;
    _wire();
  }

  static final ApiClient instance = ApiClient._();

  late final Dio _dio;
  late final Dio _refreshDio;

  Future<_Refresh>? _refreshInFlight;
  DateTime? _lastRenewal;
  DateTime? _lastRenewalFailure;

  static BaseOptions _options() => BaseOptions(
        baseUrl: AppConfig.apiBaseUrl,
        connectTimeout: AppConfig.connectTimeout,
        receiveTimeout: AppConfig.receiveTimeout,
        contentType: Headers.jsonContentType,
        // Only 2xx is a success; the rest must reach the error interceptor, which is where a 403 gets its refresh.
        validateStatus: (status) => status != null && status >= 200 && status < 300,
      );

  void _wire() {
    _dio.interceptors.add(InterceptorsWrapper(onRequest: _onRequest, onError: _onError));
  }

  Future<ApiResponse> get(String path, {Map<String, dynamic>? query}) => _send('GET', path, query: query);

  Future<ApiResponse> post(String path, {Object? body, bool attested = false}) =>
      _send('POST', path, body: body, attested: attested);

  Future<ApiResponse> put(String path, {Object? body}) => _send('PUT', path, body: body);

  Future<ApiResponse> patch(String path, {Object? body}) => _send('PATCH', path, body: body);

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
        options: Options(method: method, extra: attested ? const {_attestedFlag: true} : null),
      );
      return _unwrap(response);
    } on DioException catch (error) {
      throw _toFailure(error);
    }
  }

  static const String _attestedFlag = 'attested';
  static const String _retriedFlag = 'retried';

  static const Set<String> _noBearerPaths = {ApiPaths.signInSocial, ApiPaths.logout};

  Future<void> _onRequest(RequestOptions options, RequestInterceptorHandler handler) async {
    try {
      final session = AppSession.instance;
      final device = DeviceService.instance;

      options.headers[ApiHeaders.deviceId] = device.deviceId;
      options.headers[ApiHeaders.platform] = device.platform;
      options.headers[ApiHeaders.appVersion] = device.appVersion;
      options.headers[ApiHeaders.acceptLanguage] = PlatformDispatcher.instance.locale.languageCode;

      final token = session.accessToken;
      if (token != null && !_noBearerPaths.contains(options.path)) {
        options.headers[ApiHeaders.authorization] = 'Bearer $token';
      }

      // A token that has got old is swapped in the background; this request goes out with the one it has.
      unawaited(renewAccessTokenIfDue());

      if (options.extra[_attestedFlag] == true) {
        final attestation = await FirebaseService.instance.appCheckToken();
        if (attestation != null) options.headers[ApiHeaders.appCheck] = attestation;
      }
    } catch (error) {
      debugPrint('Could not build the request headers: $error');
    }
    handler.next(options);
  }

  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final request = error.requestOptions;
    final alreadyRetried = request.extra[_retriedFlag] == true;
    final isAuthCall = request.path == ApiPaths.refresh || _noBearerPaths.contains(request.path);
    if (alreadyRetried || isAuthCall || !_isUnauthenticated(error)) return handler.next(error);

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
      return handler.resolve(await _dio.fetch<dynamic>(request));
    } on DioException catch (retryError) {
      return handler.next(retryError);
    }
  }

  bool _isUnauthenticated(DioException error) {
    final status = error.response?.statusCode;
    if (status == 401) return true;
    return status == 403 && _codeOf(error.response) == ApiCodes.unauthenticated;
  }

  String? _codeOf(Response<dynamic>? response) =>
      asStringOrNull(asJson(asJson(response?.data)?['error'])?['code']);

  /// Swaps an old access token for a new one. Called on launch, on coming back to the app and on every request;
  /// does nothing unless the token is due.
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

  /// The socket asks for a good token before it reconnects.
  Future<bool> ensureFreshToken() async {
    final result = await _refreshTokens();
    return result.outcome == _Outcome.renewed;
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
    if (refreshToken == null) return const _Refresh.rejected();

    try {
      final response = await _refreshDio.post<dynamic>(
        ApiPaths.refresh,
        data: {'refreshToken': refreshToken, 'deviceId': DeviceService.instance.deviceId},
      );
      final body = asJson(response.data);
      if (response.statusCode != 200 || body == null || body['success'] != true) {
        return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));
      }
      final refreshed = AuthSession.fromJson(asJson(body['data']) ?? const {});
      if (refreshed.tokens.isEmpty) return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));

      await session.updateTokens(refreshed.tokens);
      return const _Refresh.renewed();
    } on DioException catch (error) {
      // The one answer that ends a session: the server saying it does not know this refresh token.
      if (error.response?.statusCode == 403 && _codeOf(error.response) == ApiCodes.unauthenticated) {
        if (session.refreshToken == refreshToken) await session.clear();
        return const _Refresh.rejected();
      }
      return _Refresh.unavailable(_toFailure(error));
    } catch (error) {
      debugPrint('Token renewal failed, keeping the session: $error');
      return const _Refresh.unavailable(ApiFailure(kind: FailureKind.unknown));
    }
  }

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
      case DioExceptionType.cancel:
        return const ApiFailure(kind: FailureKind.unknown, code: ClientFailureCode.cancelled);
      case DioExceptionType.badCertificate:
        return const ApiFailure(kind: FailureKind.network, code: ClientFailureCode.insecureConnection);
      case DioExceptionType.badResponse:
      case DioExceptionType.transformTimeout:
    }

    final response = error.response;
    final detail = asJson(asJson(response?.data)?['error']);
    final status = response?.statusCode ?? 0;
    return ApiFailure(
      kind: _kindFor(status, asStringOrNull(detail?['code'])),
      message: asString(detail?['message']),
      code: asStringOrNull(detail?['code']),
      statusCode: status,
      details: detail?['details'],
    );
  }

  FailureKind _kindFor(int status, String? code) => switch (status) {
        400 || 422 => FailureKind.validation,
        401 => FailureKind.unauthorized,
        403 => code == ApiCodes.unauthenticated ? FailureKind.unauthorized : FailureKind.forbidden,
        404 => FailureKind.notFound,
        409 => FailureKind.conflict,
        429 => FailureKind.rateLimited,
        >= 500 => FailureKind.server,
        _ => FailureKind.unknown,
      };
}

enum _Outcome { renewed, rejected, unavailable }

class _Refresh {
  const _Refresh.renewed() : outcome = _Outcome.renewed, failure = null;
  const _Refresh.rejected() : outcome = _Outcome.rejected, failure = null;
  const _Refresh.unavailable(ApiFailure this.failure) : outcome = _Outcome.unavailable;

  final _Outcome outcome;
  final ApiFailure? failure;
}
