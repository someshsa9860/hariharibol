import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../models/mantra.dart';
import '../models/mantra_category.dart';
import 'api_client.dart';
import 'local_store.dart';

/// Mantras. Listing and a single mantra are both public — signed out, they
/// simply come back without `isFavorite` or `myRounds`.
///
/// Every answer is also kept on the phone as the API sent it, and the `saved…`
/// readers give it back, so the Jap tab and the counter work with no
/// connection. The providers show the saved copy first and replace it when the
/// network answers (`providers/mantra_provider.dart`). It is a cache, not
/// storage: a copy is overwritten by the next answer and nothing reads it
/// while the network is the better source.
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
    final rows = _rows(response.list);
    await _keep(BoxKeys.mantraList(category), rows);
    return _mantras(rows);
  }

  Future<List<MantraCategory>> categories() async {
    final response = await _api.get(ApiPaths.mantraCategories);
    final rows = _rows(response.list);
    await _keep(BoxKeys.mantraCategories, rows);
    return _categories(rows);
  }

  Future<Mantra> get(String slug) async {
    final response = await _api.get(ApiPaths.mantra(slug));
    await _keep(BoxKeys.mantraDetail(slug), response.json);
    return Mantra.fromJson(response.json);
  }

  /// The last list answered for [category] — for a category never opened on
  /// this phone, the full list narrowed to it. Null when nothing is saved.
  List<Mantra>? savedList({String? category}) {
    final own = _savedRows(BoxKeys.mantraList(category));
    if (own != null) return _mantras(own);
    if (category == null) return null;

    final all = _savedRows(BoxKeys.mantraList(null));
    if (all == null) return null;
    return _mantras(all).where((mantra) => mantra.category == category).toList();
  }

  List<MantraCategory>? savedCategories() {
    final rows = _savedRows(BoxKeys.mantraCategories);
    return rows == null ? null : _categories(rows);
  }

  /// A mantra's own page as last answered, or failing that its place in the
  /// full list. The list carries all the counter needs (text, standard time,
  /// prayer, deity, recording); the page adds only the reader's own rounds
  /// and favourite mark.
  Mantra? savedMantra(String slug) {
    try {
      final own = LocalStore.instance.readJson(BoxKeys.mantraDetail(slug));
      if (own != null) return Mantra.fromJson(own);
    } catch (_) {
      // Unreadable: fall through to the list.
    }

    final all = _savedRows(BoxKeys.mantraList(null));
    if (all == null) return null;
    for (final row in all) {
      if (row['slug'] == slug) return Mantra.fromJson(row);
    }
    return null;
  }

  List<Map<String, dynamic>> _rows(List<dynamic> items) =>
      [for (final item in items) if (item is Map) Map<String, dynamic>.from(item)];

  List<Mantra> _mantras(List<Map<String, dynamic>> rows) => rows.map(Mantra.fromJson).toList();

  List<MantraCategory> _categories(List<Map<String, dynamic>> rows) =>
      rows.map(MantraCategory.fromJson).toList();

  /// A copy that cannot be kept is no reason to fail the request it came from.
  Future<void> _keep(String key, Object value) async {
    try {
      await LocalStore.instance.write(key, value);
    } catch (error) {
      if (kDebugMode) debugPrint('[Mantras] could not keep $key: $error');
    }
  }

  List<Map<String, dynamic>>? _savedRows(String key) {
    try {
      final saved = LocalStore.instance.read<List>(key);
      return saved == null ? null : _rows(saved);
    } catch (_) {
      return null;
    }
  }
}
