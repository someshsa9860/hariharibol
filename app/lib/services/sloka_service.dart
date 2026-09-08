import '../core/constants/api_paths.dart';
import '../models/sloka.dart';
import 'api_client.dart';

/// The personal sloka — today's, and the one asked for by naming a struggle.
class SlokaService {
  SlokaService._();

  static final SlokaService instance = SlokaService._();

  final ApiClient _api = ApiClient.instance;

  /// Names a struggle and gets a verse chosen for it.
  ///
  /// Throws an [ApiFailure] with status 402 once the free monthly quota is
  /// used up — the caller shows the message the backend wrote, which names
  /// the quota, rather than inventing paywall copy of its own.
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
}
