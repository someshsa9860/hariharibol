import '../core/constants/api_paths.dart';
import '../models/mantra.dart';
import '../models/mantra_category.dart';
import 'api_client.dart';

/// Mantras. Listing and a single mantra are both public — signed out, they
/// simply come back without `isFavorite` or `myRounds`.
class MantraService {
  MantraService._();

  static final MantraService instance = MantraService._();

  final ApiClient _api = ApiClient.instance;

  /// Published mantras, optionally narrowed to one category.
  Future<List<Mantra>> list({String? category}) async {
    final response = await _api.get(
      ApiPaths.mantras,
      query: category == null ? null : {'category': category},
    );
    return response.list
        .whereType<Map>()
        .map((item) => Mantra.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<MantraCategory>> categories() async {
    final response = await _api.get(ApiPaths.mantraCategories);
    return response.list
        .whereType<Map>()
        .map((item) => MantraCategory.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<Mantra> get(String slug) async {
    final response = await _api.get(ApiPaths.mantra(slug));
    return Mantra.fromJson(response.json);
  }
}
