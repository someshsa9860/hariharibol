import '../core/constants/api_paths.dart';
import '../models/favorite.dart';
import 'api_client.dart';

/// Bookmarks — verses, mantras and books, in one list.
class FavoriteService {
  FavoriteService._();

  static final FavoriteService instance = FavoriteService._();

  final ApiClient _api = ApiClient.instance;

  /// [type] narrows to `verse`, `mantra` or `book`.
  Future<List<Favorite>> list({String? type}) async {
    final response = await _api.get(
      ApiPaths.favorites,
      query: type == null ? null : {'type': type},
    );
    return response.list
        .whereType<Map>()
        .map((item) => Favorite.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  /// Idempotent server side: bookmarking something twice returns the existing
  /// row rather than failing, so a double tap is not an error.
  Future<Favorite> add({String? verseId, String? mantraId, String? bookId}) async {
    final response = await _api.post(ApiPaths.favorites, body: {
      'verseId': ?verseId,
      'mantraId': ?mantraId,
      'bookId': ?bookId,
    });
    return Favorite.fromJson(response.json);
  }

  Future<void> remove(String id) => _api.delete(ApiPaths.favorite(id));
}
