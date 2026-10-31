import 'dart:async';
import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:hive_ce_flutter/hive_flutter.dart';

import '../core/constants/offline_config.dart';
import '../core/constants/storage_keys.dart';
import '../models/api_failure.dart';
import '../models/json.dart';
import 'api_client.dart';

/// The two calls a service makes to keep an answer for offline use. An
/// extension rather than part of [ApiClient], which only speaks HTTP.
extension KeptForOffline on ApiClient {
  /// A GET whose successful answer is saved, and which, when the server cannot
  /// be reached (no connection, a timeout, a 5xx), returns the saved answer in
  /// its place. A real answer (a 404, a refusal) is never covered up by a
  /// saved one, and with nothing saved the failure is thrown as before.
  Future<ApiResponse> getOrSaved(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await get(path, query: query);
      unawaited(ResponseCache.instance.save(path, query, response.data, response.meta));
      return response;
    } on ApiFailure catch (failure) {
      if (!serverUnreachable(failure)) rethrow;
      final copy = saved(path, query: query);
      if (copy == null) rethrow;
      return copy;
    }
  }

  /// What [getOrSaved] last saved for this GET, or null — read at once, for a
  /// screen that shows it before the network answers.
  ApiResponse? saved(String path, {Map<String, dynamic>? query}) {
    final copy = ResponseCache.instance.read(path, query);
    return copy == null ? null : ApiResponse(copy.data, copy.meta);
  }
}

/// The server could not be asked (no connection, a timeout, a 5xx), as opposed
/// to answering. Only then is a saved copy put in the place of an answer.
bool serverUnreachable(ApiFailure failure) =>
    failure.code != ClientFailureCode.cancelled &&
    (failure.kind == FailureKind.network || failure.kind == FailureKind.timeout || failure.kind == FailureKind.server);

/// One answer as the API last sent it: the envelope's `data` and `meta`, and
/// when it was saved.
class SavedResponse {
  const SavedResponse(this.data, this.meta, this.savedAt);

  final dynamic data;
  final Json? meta;
  final DateTime savedAt;
}

/// The API's answers, kept so a screen still has something true to show with
/// no connection.
///
/// `ApiClient.getOrSaved` saves every successful answer here under its path
/// and query, and hands the saved one back when the request cannot reach the
/// server; `ApiClient.saved` reads one at once, for a screen that shows the
/// copy first and the network's answer when it lands. Which calls are kept is
/// chosen call by call, in the services. See "Offline" in app/CLAUDE.md.
///
/// Its own Hive box, opened at boot without holding up the first frame: until
/// it is open nothing is saved and nothing is found, which is the same as a
/// phone that has not saved anything yet. Answers are kept as JSON text, so
/// what comes back has exactly the shape the network gave. Some are personal
/// (a reader's own tickets, their summary), so the whole box is wiped on
/// sign-out (`AppSession.clear`).
class ResponseCache {
  ResponseCache._();

  static final ResponseCache instance = ResponseCache._();

  Box<dynamic>? _box;
  Future<void>? _opening;

  /// Called once from `main()`, after `LocalStore.init` (which starts Hive).
  /// Never throws: a box that cannot be opened only means nothing is kept.
  Future<void> init() => _opening ??= _open();

  Future<void> _open() async {
    try {
      _box = await Hive.openBox<dynamic>(BoxNames.responses);
    } catch (error) {
      debugPrint('[ResponseCache] could not open: $error');
    }
  }

  /// A box in memory only, for tests.
  @visibleForTesting
  Future<void> openInMemory() async {
    await _box?.close();
    _box = await Hive.openBox<dynamic>('${BoxNames.responses}_test', bytes: Uint8List(0));
    _opening = Future.value();
  }

  /// Path and query, the query sorted so the same request is always one key.
  static String keyFor(String path, Map<String, dynamic>? query) {
    final params = (query ?? const <String, dynamic>{}).entries.where((entry) => entry.value != null).toList()
      ..sort((a, b) => a.key.compareTo(b.key));
    if (params.isEmpty) return path;
    return '$path?${params.map((entry) => '${entry.key}=${entry.value}').join('&')}';
  }

  SavedResponse? read(String path, Map<String, dynamic>? query) {
    final entry = _box?.get(keyFor(path, query));
    if (entry is! Map) return null;
    try {
      final body = asJson(jsonDecode(asString(entry['body'])));
      if (body == null) return null;
      return SavedResponse(
        body['data'],
        asJson(body['meta']),
        DateTime.fromMillisecondsSinceEpoch(asInt(entry['at'])),
      );
    } catch (_) {
      return null;
    }
  }

  /// Keeps an answer. Never throws and is not waited on by the request: the
  /// box's copy in memory changes at once, and the disk catches up.
  Future<void> save(String path, Map<String, dynamic>? query, dynamic data, Json? meta) async {
    final box = _box;
    if (box == null) return;
    try {
      final body = jsonEncode({'data': data, 'meta': meta});
      if (body.length > OfflineConfig.maxSavedResponseLength) return;
      await box.put(keyFor(path, query), {'body': body, 'at': DateTime.now().millisecondsSinceEpoch});
      if (box.length > OfflineConfig.maxSavedResponses) await _evictOldest(box);
    } catch (error) {
      debugPrint('[ResponseCache] could not save $path: $error');
    }
  }

  Future<void> _evictOldest(Box<dynamic> box) {
    int savedAt(dynamic key) {
      final entry = box.get(key);
      return entry is Map ? asInt(entry['at']) : 0;
    }

    final keys = box.keys.toList()..sort((a, b) => savedAt(a).compareTo(savedAt(b)));
    final over = box.length - OfflineConfig.maxSavedResponses + OfflineConfig.evictBatch;
    return box.deleteAll(keys.take(over));
  }

  /// Wipes every saved answer. Used on sign-out.
  Future<void> clear() async {
    try {
      await _box?.clear();
    } catch (error) {
      debugPrint('[ResponseCache] could not clear: $error');
    }
  }
}
