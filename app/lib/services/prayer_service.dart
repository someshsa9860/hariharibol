import 'package:flutter/foundation.dart' show visibleForTesting;

import '../core/constants/api_paths.dart';
import '../models/prayer.dart';
import 'api_client.dart';
import 'languages_query.dart';
import 'response_cache.dart';

/// Prayers. Every call names the reader's reading chain, so the meanings come
/// back in the language just chosen rather than the one the account last heard
/// about (see "Three languages" in app/CLAUDE.md). Read only.
///
/// Every answer is kept for offline use, under the languages it was asked in.
class PrayerService {
  PrayerService._() : _api = ApiClient.instance;

  /// A service that talks through [api] instead of the app's own client, for
  /// tests that script the server.
  @visibleForTesting
  PrayerService.forTesting(ApiClient api) : _api = api;

  static final PrayerService instance = PrayerService._();

  final ApiClient _api;

  /// The categories that have anything, and every prayer (without its verses).
  Future<PrayerList> list(List<String> languages) async {
    final response = await _api.getOrSaved(ApiPaths.prayers, query: languagesQuery(languages));
    return PrayerList.fromJson(response.json);
  }

  PrayerList? savedList(List<String> languages) {
    final copy = _api.saved(ApiPaths.prayers, query: languagesQuery(languages));
    return copy == null ? null : PrayerList.fromJson(copy.json);
  }

  /// One prayer in full, with its verses and the scripts it can be shown in.
  Future<Prayer> prayer(String id, List<String> languages) async {
    final response = await _api.getOrSaved(ApiPaths.prayer(id), query: languagesQuery(languages));
    return Prayer.fromJson(response.json);
  }

  /// One prayer as last saved. Only its own page will do: a row in the saved
  /// list has no verses, so a prayer never opened is not there offline.
  Prayer? savedPrayer(String id, List<String> languages) {
    final copy = _api.saved(ApiPaths.prayer(id), query: languagesQuery(languages));
    return copy == null ? null : Prayer.fromJson(copy.json);
  }

  /// When this prayer's own page was last saved, or null. The warmer fetches the
  /// ones never saved and those saved long ago.
  DateTime? prayerSavedAt(String id, List<String> languages) =>
      ResponseCache.instance.read(ApiPaths.prayer(id), languagesQuery(languages))?.savedAt;
}
