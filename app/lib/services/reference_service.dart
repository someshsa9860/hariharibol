import '../core/constants/api_paths.dart';
import '../models/language.dart';
import '../models/reference_item.dart';
import 'api_client.dart';

/// The seeded lists the app offers as choices — languages, deities, gurus.
///
/// All of it is public and changes about once a release, so callers cache it
/// for the life of the app rather than asking again on every screen.
class ReferenceService {
  ReferenceService._();

  static final ReferenceService instance = ReferenceService._();

  final ApiClient _api = ApiClient.instance;

  Future<List<Language>> languages() async {
    final response = await _api.get(ApiPaths.languages);
    return response.list
        .whereType<Map>()
        .map((item) => Language.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<List<ReferenceItem>> deities() => _references(ApiPaths.deities);
  Future<List<ReferenceItem>> gurus() => _references(ApiPaths.gurus);
  Future<List<ReferenceItem>> translators() => _references(ApiPaths.translators);

  Future<List<ReferenceItem>> _references(String path) async {
    final response = await _api.get(path);
    return response.list
        .whereType<Map>()
        .map((item) => ReferenceItem.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
