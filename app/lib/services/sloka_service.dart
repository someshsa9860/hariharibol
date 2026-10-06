import '../core/constants/api_paths.dart';
import '../models/sloka.dart';
import 'api_client.dart';

/// The personal sloka — today's, and the one asked for by naming a struggle.
class SlokaService {
  SlokaService._();

  static final SlokaService instance = SlokaService._();

  final ApiClient _api = ApiClient.instance;

  /// Names a struggle and gets a verse chosen for it.
  Future<PersonalSloka> forMood(String issueSlug, {int? intensity, String? note}) async {
    final response = await _api.post(
      ApiPaths.slokaMood,
      body: {
        'issueSlug': issueSlug,
        'intensity': ?intensity,
        if (note != null && note.isNotEmpty) 'note': note,
      },
    );
    return PersonalSloka.fromJson(response.json);
  }

  /// Separates "delivered" from "actually read". Fire and forget: nothing on
  /// screen depends on it, and a failure must never interrupt reading.
  Future<void> markSeen(String id) => _api.post(ApiPaths.slokaSeen(id));

  /// Every struggle reported today, each with the verse it was answered with —
  /// what a mood already answered today reopens to, since only the latest of
  /// these still shows on the dashboard.
  Future<List<PersonalSloka>> moodToday() async {
    final response = await _api.get(ApiPaths.slokaMoodToday);
    return response.list
        .whereType<Map>()
        .map((item) => PersonalSloka.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
