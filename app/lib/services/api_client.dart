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

/// A parsed response: the `data` the API sent, and the `meta` block beside it
/// when the endpoint paginates.
class ApiResponse {
  const ApiResponse(this.data, this.meta);

  final dynamic data;
  final Json? meta;

  Json get json => asJson(data) ?? const {};
  List<dynamic> get list => data is List ? data as List<dynamic> : const [];
}

/// The only thing in the app that speaks HTTP.
///
/// It does three jobs nothing else should have to think about:
///
///   1. Attaches the device headers and the bearer token to every request.
///   2. Rotates the access token silently on a 401 and replays the request, so
///      an expiry is invisible — no re-login prompt, no failed call.
///   3. Turns every failure into an [ApiFailure], so no view ever sees a
///      `DioException`.
class ApiClient {
  ApiClient._() {
    final options = BaseOptions(
      baseUrl: AppConfig.apiBaseUrl,
      connectTimeout: AppConfig.connectTimeout,
      receiveTimeout: AppConfig.receiveTimeout,
      contentType: Headers.jsonContentType,
      // Only 2xx is a success. Everything else has to reach the error
      // interceptor, because that is where a 401 gets its silent refresh.
      validateStatus: (status) => status != null && status >= 200 && status < 300,
    );

    _dio = Dio(options);
    _refreshDio = Dio(options);

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

  /// Used only for the refresh call. It carries no interceptors, so a 401 on a
  /// refresh cannot start a second refresh.
  late final Dio _refreshDio;

  Future<bool>? _refreshInFlight;

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

      final user = session.user;
      if (user != null) {
        options.headers[ApiHeaders.acceptLanguage] = user.appLanguage;
      }

      final token = session.accessToken;
      if (token != null) {
        options.headers[ApiHeaders.authorization] = 'Bearer $token';
      }

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

  /// A 401 means the access token aged out. Refresh once, replay once.
  ///
  /// Several requests can fail together on launch, so the refresh is
  /// single-flight: the first 401 starts it, the rest await the same future and
  /// then replay with the token it produced.
  Future<void> _onError(DioException error, ErrorInterceptorHandler handler) async {
    final response = error.response;
    final request = error.requestOptions;

    final isAuthProblem = response?.statusCode == 401;
    final alreadyRetried = request.extra[_retriedFlag] == true;
    final isRefreshCall = request.path == ApiPaths.refresh;

    if (!isAuthProblem || alreadyRetried || isRefreshCall) {
      return handler.next(error);
    }

    final refreshed = await _refreshTokens();
    if (!refreshed) {
      await AppSession.instance.clear();
      return handler.next(error);
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

  Future<bool> _refreshTokens() {
    return _refreshInFlight ??= _doRefresh().whenComplete(() => _refreshInFlight = null);
  }

  Future<bool> _doRefresh() async {
    final session = AppSession.instance;
    final refreshToken = session.refreshToken;
    if (refreshToken == null) return false;

    try {
      final response = await _refreshDio.post<dynamic>(
        ApiPaths.refresh,
        data: {
          'refreshToken': refreshToken,
          'deviceId': DeviceService.instance.deviceId,
        },
      );

      if (response.statusCode != 200) return false;

      final body = asJson(response.data);
      if (body == null || body['success'] != true) return false;

      // The refresh endpoint returns the user as well, so a profile change made
      // on another device lands here without an extra call.
      final refreshed = AuthSession.fromJson(asJson(body['data']) ?? const {});
      if (refreshed.tokens.isEmpty) return false;

      await session.updateTokens(refreshed.tokens);
      await session.updateUser(refreshed.user);
      return true;
    } catch (_) {
      return false;
    }
  }

  /// Pulls `data` and `meta` out of the envelope. Only 2xx reaches here — a
  /// 204 arrives with no body at all, which is a success with nothing in it.
  ApiResponse _unwrap(Response<dynamic> response) {
    final body = asJson(response.data);
    if (body == null) return const ApiResponse(null, null);
    return ApiResponse(body['data'], asJson(body['meta']));
  }

  ApiFailure _toFailure(DioException error) {
    if (error.error is ApiFailure) return error.error as ApiFailure;

    switch (error.type) {
      case DioExceptionType.connectionTimeout:
      case DioExceptionType.sendTimeout:
      case DioExceptionType.receiveTimeout:
        return const ApiFailure(
          kind: FailureKind.timeout,
          message: 'That took too long. Please try again.',
        );
      case DioExceptionType.connectionError:
      case DioExceptionType.unknown:
        if (error.error is SocketException || error.error is HttpException) {
          return const ApiFailure(
            kind: FailureKind.network,
            message: 'No connection. Check your internet and try again.',
          );
        }
        break;
      case DioExceptionType.cancel:
        return const ApiFailure(kind: FailureKind.unknown, message: 'Request cancelled.');
      case DioExceptionType.badCertificate:
        return const ApiFailure(
          kind: FailureKind.network,
          message: 'The connection is not secure.',
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
      kind: _kindFor(status),
      message: asString(detail?['message'], 'Something went wrong. Please try again.'),
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

  FailureKind _kindFor(int status) => switch (status) {
        400 || 422 => FailureKind.validation,
        401 => FailureKind.unauthorized,
        403 => FailureKind.forbidden,
        404 => FailureKind.notFound,
        409 => FailureKind.conflict,
        429 => FailureKind.rateLimited,
        >= 500 => FailureKind.server,
        _ => FailureKind.unknown,
      };
}
