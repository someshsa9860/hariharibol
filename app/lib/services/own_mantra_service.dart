import 'package:flutter/foundation.dart';

import '../core/constants/api_paths.dart';
import '../core/constants/own_mantra_config.dart';
import '../core/constants/storage_keys.dart';
import '../models/json.dart';
import '../models/mantra.dart';
import '../models/own_mantra.dart';
import 'api_client.dart';
import 'local_store.dart';

/// Mantras a reader adds that are not in the catalogue.
///
/// The reader says or types a mantra, the API finds well-known ones to choose
/// from, and what is chosen is saved for the readers who hold it. The words of
/// a suggestion stay on the server for an hour; the phone sends back only which
/// ones were chosen.
///
/// Anything that changes the reader's list also drops the saved copies of the
/// mantra lists, so the Jap tab does not show the old list first.
class OwnMantraService {
  OwnMantraService._(this._api);

  static final OwnMantraService instance = OwnMantraService._(ApiClient.instance);

  @visibleForTesting
  OwnMantraService.forTesting(this._api);

  final ApiClient _api;

  /// What the reader typed or said → mantras to choose from. An empty list is
  /// the answer when nothing well known matched.
  Future<MantraSuggestions> suggest(String text) async {
    final response = await _api.post(ApiPaths.mantraOwnSuggest, body: {'text': text});
    return MantraSuggestions.fromJson(response.json);
  }

  /// Saves the chosen suggestions ([picks] are their indexes). One result for
  /// each, in the order sent.
  Future<List<OwnMantraResult>> create(String suggestionId, List<int> picks) async {
    final response = await _api.post(
      ApiPaths.mantraOwn,
      body: {'suggestionId': suggestionId, 'picks': picks},
    );
    final items = response.json['items'];
    await _forgetSaved();
    return [
      for (final item in items is List ? items : const [])
        if (item is Map) OwnMantraResult.fromJson(Map<String, dynamic>.from(item)),
    ];
  }

  /// Replaces the picture of a mantra the reader added; the answer is the
  /// mantra with its new picture.
  Future<Mantra> changeImage(String slug, Uint8List bytes) async {
    final response = await _api.putBytes(
      ApiPaths.mantraOwnImage(slug),
      bytes,
      contentType: OwnMantraConfig.pictureContentType,
    );
    await _forgetSaved();
    return Mantra.fromJson(asJson(response.data) ?? const {});
  }

  /// Takes a private mantra off the reader's list.
  Future<void> leave(String slug) async {
    await _api.delete(ApiPaths.mantraOwnOne(slug));
    await _forgetSaved();
  }

  /// The saved lists and pages are the old list now. A failure to drop them is
  /// no reason to fail the call that has already changed the account.
  Future<void> _forgetSaved() async {
    try {
      await LocalStore.instance.deleteWithPrefix(BoxKeys.mantraCachePrefix);
    } catch (error) {
      if (kDebugMode) debugPrint('[OwnMantra] could not drop the saved mantras: $error');
    }
  }
}
