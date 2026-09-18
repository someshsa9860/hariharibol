import '../core/constants/api_paths.dart';
import '../models/verse.dart';
import 'api_client.dart';

/// One verse, and the things hung off it while reading: every acharya's
/// rendering, and the curated links to other verses.
class VerseService {
  VerseService._();

  static final VerseService instance = VerseService._();

  final ApiClient _api = ApiClient.instance;

  Future<Verse> get(String verseId) async {
    final response = await _api.get(ApiPaths.verse(verseId));
    return Verse.fromJson(response.json);
  }

  /// Every published rendering, in full — for comparing acharyas side by
  /// side. The verse's own [Verse.translation] covers the ordinary case.
  Future<List<VerseTranslation>> translations(
    String verseId, {
    String? translator,
    String? languageCode,
  }) async {
    final response = await _api.get(
      ApiPaths.verseTranslations(verseId),
      query: {'translator': ?translator, 'languageCode': ?languageCode},
    );
    return response.list
        .whereType<Map>()
        .map((item) => VerseTranslation.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<RelatedVerse>> related(String verseId) async {
    final response = await _api.get(ApiPaths.verseRelated(verseId));
    return response.list
        .whereType<Map>()
        .map((item) => RelatedVerse.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
