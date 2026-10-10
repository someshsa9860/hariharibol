import '../core/constants/api_paths.dart';
import '../models/book_cache.dart';
import 'api_client.dart';

/// The three public endpoints behind the silent offline sync. Reading them
/// needs no account, so the background worker can use them without a session.
class BookCacheApi {
  BookCacheApi({ApiClient? client}) : _api = client ?? ApiClient.instance;

  final ApiClient _api;

  /// Every downloadable unit of [book] (a slug or an id), with version and hash.
  Future<CacheManifest> manifest(String book) async {
    final response = await _api.get(ApiPaths.bookManifest(book));
    return CacheManifest.fromJson(response.json);
  }

  /// A link to one unit, valid for minutes, with the hash its bytes must have.
  Future<UnitLink> downloadUrl(String book, String unitId) async {
    final response = await _api.post(ApiPaths.bookDownloadUrl(book), body: {'unitId': unitId});
    return UnitLink.fromJson(response.json);
  }

  /// Playable links for the verses in [verseIds] that have audio.
  Future<Map<String, String>> audioUrls(String book, List<String> verseIds) async {
    if (verseIds.isEmpty) return const {};
    final response = await _api.post(ApiPaths.bookAudioUrls(book), body: {'verseIds': verseIds});
    final urls = response.json['urls'];
    if (urls is! Map) return const {};
    return {for (final e in urls.entries) e.key.toString(): e.value.toString()};
  }
}
