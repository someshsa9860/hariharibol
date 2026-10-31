import 'package:flutter/foundation.dart' show visibleForTesting;

import '../core/constants/api_paths.dart';
import '../models/etiquette.dart';
import 'api_client.dart';
import 'languages_query.dart';
import 'response_cache.dart';

/// Devotee etiquette. Every call names the reader's reading chain, so the
/// words come back in the language just chosen rather than the one the account
/// last heard about (see "Three languages" in app/CLAUDE.md). Read only.
///
/// Every answer is kept for offline use, under the languages it was asked in.
class EtiquetteService {
  EtiquetteService._() : _api = ApiClient.instance;

  /// A service that talks through [api] instead of the app's own client, for
  /// tests that script the server.
  @visibleForTesting
  EtiquetteService.forTesting(ApiClient api) : _api = api;

  static final EtiquetteService instance = EtiquetteService._();

  final ApiClient _api;

  /// The day's item on the reader's own calendar; its item is null when
  /// nothing is published.
  Future<EtiquetteToday> today(List<String> languages) async {
    final response = await _api.getOrSaved(ApiPaths.etiquetteToday, query: languagesQuery(languages));
    return EtiquetteToday.fromJson(response.json);
  }

  /// The day's item as last saved. Offline on a later day it is still the last
  /// one the server chose: the choice is the server's to make.
  EtiquetteToday? savedToday(List<String> languages) {
    final copy = _api.saved(ApiPaths.etiquetteToday, query: languagesQuery(languages));
    return copy == null ? null : EtiquetteToday.fromJson(copy.json);
  }

  /// The categories that have anything, and every item.
  Future<EtiquetteList> list(List<String> languages) async {
    final response = await _api.getOrSaved(ApiPaths.etiquette, query: languagesQuery(languages));
    return EtiquetteList.fromJson(response.json);
  }

  EtiquetteList? savedList(List<String> languages) {
    final copy = _api.saved(ApiPaths.etiquette, query: languagesQuery(languages));
    return copy == null ? null : EtiquetteList.fromJson(copy.json);
  }

  /// One item in full.
  Future<Etiquette> item(String id, List<String> languages) async {
    final response = await _api.getOrSaved(ApiPaths.etiquetteItem(id), query: languagesQuery(languages));
    return Etiquette.fromJson(response.json);
  }

  /// One item as last saved. An item never opened is taken from today's copy
  /// when it is today's, else from the saved list, which has everything but
  /// the long text.
  Etiquette? savedItem(String id, List<String> languages) {
    final copy = _api.saved(ApiPaths.etiquetteItem(id), query: languagesQuery(languages));
    if (copy != null) return Etiquette.fromJson(copy.json);

    final today = savedToday(languages)?.item;
    if (today != null && today.id == id) return today;

    for (final item in savedList(languages)?.items ?? const <Etiquette>[]) {
      if (item.id == id) return item;
    }
    return null;
  }

  /// When this item's own page was last saved, or null. The warmer fetches the
  /// ones never saved and those saved long ago.
  DateTime? itemSavedAt(String id, List<String> languages) =>
      ResponseCache.instance.read(ApiPaths.etiquetteItem(id), languagesQuery(languages))?.savedAt;
}
