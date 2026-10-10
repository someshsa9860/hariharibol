import 'dart:async';
import 'dart:io';
import 'dart:math';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:dio/io.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/book_sync_config.dart';
import '../models/api_failure.dart';
import '../models/book_cache.dart';
import 'book_cache_api.dart';

/// A unit fetched, checked and parsed — ready for `BookDao.replaceUnit`.
class DownloadedUnit {
  const DownloadedUnit({required this.payload, required this.version, required this.hash});

  final UnitPayload payload;

  /// What the server said this is — from the download link, which is newer than
  /// the manifest if the unit changed in between.
  final int version;
  final String hash;
}

/// Downloads one unit straight from S3.
///
/// Asks the API for a short-lived link, fetches the file with timeouts and
/// exponential backoff, resumes a body that broke off part-way (a `Range`
/// request from where it stopped), asks for a fresh link once if S3 says the
/// first expired, then checks the SHA-256 and parses the JSON in an isolate.
class BookUnitDownloader {
  BookUnitDownloader({
    required this._api,
    Dio? dio,
    Future<void> Function(Duration)? sleep,
    Random? random,
    this.attempts = BookSyncConfig.attempts,
  })  : _dio = dio ?? _defaultDio(),
        _sleep = sleep ?? Future<void>.delayed,
        _random = random ?? Random();

  final BookCacheApi _api;
  final Dio _dio;
  final Future<void> Function(Duration) _sleep;
  final Random _random;
  final int attempts;

  static Dio _defaultDio() {
    final dio = Dio(BaseOptions(
      connectTimeout: BookSyncConfig.connectTimeout,
      receiveTimeout: BookSyncConfig.receiveTimeout,
      validateStatus: (status) => status != null && (status == 200 || status == 206),
    ));
    // The file is gzipped. Left to the HTTP client, a Range request would hand
    // the decoder half a gzip stream; unpacking is done once, in the isolate.
    dio.httpClientAdapter = IOHttpClientAdapter(createHttpClient: () => HttpClient()..autoUncompress = false);
    return dio;
  }

  /// Delay before retry [attempt] (1-based): doubles each time, capped, with up
  /// to a quarter extra so a hundred phones do not retry in step.
  Duration backoff(int attempt) {
    final base = BookSyncConfig.backoffBase * pow(2, attempt - 1).toInt();
    final capped = base > BookSyncConfig.backoffMax ? BookSyncConfig.backoffMax : base;
    return capped + Duration(milliseconds: (capped.inMilliseconds * 0.25 * _random.nextDouble()).round());
  }

  Future<DownloadedUnit> download(String book, ManifestUnit unit) async {
    Object? last;
    // A corrupt body is fetched again from a new link; a file that is simply
    // newer than this app (schema) is not retried.
    for (var round = 1; round <= 2; round++) {
      final link = await _withRetry(() => _api.downloadUrl(book, unit.unitId));
      if (link.schemaVersion > BookSyncConfig.supportedSchemaVersion) {
        throw UnitIntegrityException('schema ${link.schemaVersion} is newer than this app understands');
      }
      final bytes = await _fetch(book, unit, link);
      try {
        final payload = await compute(
          verifyAndParseUnit,
          (bytes: bytes, expectedHash: link.hash, maxSchema: BookSyncConfig.supportedSchemaVersion),
        );
        return DownloadedUnit(payload: payload, version: link.version, hash: link.hash);
      } on UnitIntegrityException catch (error) {
        if (error.reason.contains('newer than this app')) rethrow;
        last = error;
      }
    }
    throw last ?? const UnitIntegrityException('download failed');
  }

  /// The raw bytes behind [link], with resume, backoff and one link refresh.
  Future<Uint8List> _fetch(String book, ManifestUnit unit, UnitLink first) async {
    final received = BytesBuilder(copy: false);
    var url = first.url;
    var refreshed = false;

    for (var attempt = 1;; attempt++) {
      try {
        final response = await _dio.get<ResponseBody>(
          url,
          options: Options(
            responseType: ResponseType.stream,
            headers: received.length > 0 ? {'Range': 'bytes=${received.length}-'} : null,
          ),
        );
        // A server that ignored the Range header sends the whole file again.
        if (response.statusCode == 200 && received.length > 0) received.clear();
        await for (final chunk in response.data!.stream.timeout(BookSyncConfig.receiveTimeout)) {
          received.add(chunk);
        }
        return received.takeBytes();
      } catch (error) {
        final status = error is DioException ? error.response?.statusCode : null;

        // An expired or refused link: get a fresh one, once, and start over.
        if ((status == 403 || status == 401) && !refreshed) {
          refreshed = true;
          received.clear();
          url = (await _withRetry(() => _api.downloadUrl(book, unit.unitId))).url;
          continue;
        }
        // The range no longer fits the file (it was replaced): start over.
        if (status == 416) received.clear();

        if (!_retryable(error, status) || attempt >= attempts) rethrow;
        await _sleep(backoff(attempt));
      }
    }
  }

  Future<T> _withRetry<T>(Future<T> Function() action) async {
    for (var attempt = 1;; attempt++) {
      try {
        return await action();
      } on ApiFailure catch (failure) {
        final transient = failure.kind == FailureKind.network ||
            failure.kind == FailureKind.timeout ||
            failure.kind == FailureKind.server;
        if (!transient || attempt >= attempts) rethrow;
        await _sleep(backoff(attempt));
      }
    }
  }

  /// Timeouts, dropped connections, a body that ended early, 5xx and 429 are
  /// worth another go; any other 4xx is an answer.
  bool _retryable(Object error, int? status) {
    if (error is DioException) {
      if (status == null) return true;
      return status >= 500 || status == 429 || status == 416 || status == 408;
    }
    return error is TimeoutException || error is IOException || error is StateError;
  }
}
