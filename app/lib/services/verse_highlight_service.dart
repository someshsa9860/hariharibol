import '../core/constants/api_paths.dart';
import '../models/json.dart';
import 'api_client.dart';

/// Whole-verse highlights. Shape mirrors [FavoriteService] deliberately —
/// both are per-user-per-verse toggles — kept as its own service because a
/// highlight and a bookmark answer different questions; see
/// `backend/controllers/app/verse-highlight.js`.
class VerseHighlightService {
  VerseHighlightService._();

  static final VerseHighlightService instance = VerseHighlightService._();

  final ApiClient _api = ApiClient.instance;

  /// Idempotent server side — highlighting an already-highlighted verse
  /// returns the existing row. Returns the highlight's own id, so removing
  /// it later needs no extra lookup.
  Future<String> add(String verseId) async {
    final response = await _api.post(ApiPaths.verseHighlights, body: {'verseId': verseId});
    return asString(response.json['id']);
  }

  Future<void> remove(String id) => _api.delete(ApiPaths.verseHighlight(id));
}
