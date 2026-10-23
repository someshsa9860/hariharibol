import '../core/constants/api_paths.dart';
import '../models/etiquette.dart';
import 'api_client.dart';
import 'languages_query.dart';

/// Devotee etiquette. Every call names the reader's reading chain, so the
/// words come back in the language just chosen rather than the one the account
/// last heard about (see "Three languages" in app/CLAUDE.md). Read only.
class EtiquetteService {
  EtiquetteService._();
  static final EtiquetteService instance = EtiquetteService._();

  final ApiClient _api = ApiClient.instance;

  /// The day's item on the reader's own calendar; its item is null when
  /// nothing is published.
  Future<EtiquetteToday> today(List<String> languages) async {
    final response = await _api.get(ApiPaths.etiquetteToday, query: languagesQuery(languages));
    return EtiquetteToday.fromJson(response.json);
  }

  /// The categories that have anything, and every item.
  Future<EtiquetteList> list(List<String> languages) async {
    final response = await _api.get(ApiPaths.etiquette, query: languagesQuery(languages));
    return EtiquetteList.fromJson(response.json);
  }

  /// One item in full.
  Future<Etiquette> item(String id, List<String> languages) async {
    final response = await _api.get(ApiPaths.etiquetteItem(id), query: languagesQuery(languages));
    return Etiquette.fromJson(response.json);
  }
}
