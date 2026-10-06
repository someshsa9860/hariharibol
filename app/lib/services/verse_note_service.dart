import '../core/constants/api_paths.dart';
import '../models/verse_note.dart';
import 'api_client.dart';

/// A reader's own notes against a verse. Always mine — there is no public
/// listing, unlike [FavoriteService] or the verse itself.
class VerseNoteService {
  VerseNoteService._();

  static final VerseNoteService instance = VerseNoteService._();

  final ApiClient _api = ApiClient.instance;

  Future<List<VerseNote>> list(String verseId) async {
    final response = await _api.get(ApiPaths.verseNotes, query: {'verseId': verseId});
    return response.list
        .whereType<Map>()
        .map((item) => VerseNote.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<VerseNote> add(String verseId, String text) async {
    final response = await _api.post(
      ApiPaths.verseNotes,
      body: {'verseId': verseId, 'text': text},
    );
    return VerseNote.fromJson(response.json);
  }

  Future<VerseNote> update(String id, String text) async {
    final response = await _api.patch(ApiPaths.verseNote(id), body: {'text': text});
    return VerseNote.fromJson(response.json);
  }

  Future<void> remove(String id) => _api.delete(ApiPaths.verseNote(id));
}
