import 'package:flutter/foundation.dart' show visibleForTesting;

import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../models/home_feed.dart';
import 'api_client.dart';
import 'languages_query.dart';
import 'local_store.dart';

/// The dashboard, in one call.
///
/// The last good response is kept so a cold launch on a bad connection draws
/// something real instead of a spinner. It is a cache, not storage: the screen
/// shows it immediately and replaces it as soon as the network answers.
class HomeService {
  HomeService._() : _api = ApiClient.instance;

  /// A service that talks through [api] instead of the app's own client, for
  /// tests that script the server.
  @visibleForTesting
  HomeService.forTesting(ApiClient api) : _api = api;

  static final HomeService instance = HomeService._();

  final ApiClient _api;

  /// The dashboard in [languages] (the reading chain, best first). The call names
  /// them itself rather than leaving the server to use the account's: the phone
  /// changes its own reading language at once and tells the account a moment
  /// later, so a dashboard asked for in between came back in the language just left.
  Future<HomeFeed> fetch({List<String>? languages}) async {
    final query = languagesQuery(languages);
    final response = await _api.get(ApiPaths.home, query: query);
    final json = response.json;
    await LocalStore.instance.write(BoxKeys.lastHomePayload, json);
    await LocalStore.instance.write(BoxKeys.lastHomeLanguages, query['languages'] ?? '');
    await LocalStore.instance.write(
      BoxKeys.lastHomeFetchedAt,
      DateTime.now().toUtc().toIso8601String(),
    );
    return HomeFeed.fromJson(json);
  }

  /// The last response — only if it was made for [languages], when they are given.
  /// A copy in another language is not a stand-in for the reader's own.
  HomeFeed? cached({List<String>? languages}) {
    final json = LocalStore.instance.readJson(BoxKeys.lastHomePayload);
    if (json == null) return null;
    if (languages != null) {
      final saved = LocalStore.instance.read<String>(BoxKeys.lastHomeLanguages);
      if (saved != (languagesQuery(languages)['languages'] ?? '')) return null;
    }
    return HomeFeed.fromJson(json);
  }
}
