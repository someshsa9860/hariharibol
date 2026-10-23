import 'dart:async';
import 'dart:typed_data';

import 'package:hariharibol/models/api_failure.dart';
import 'package:hariharibol/models/mantra.dart';
import 'package:hariharibol/models/own_mantra.dart';
import 'package:hariharibol/services/own_mantra_service.dart';

/// A mantra as the API sends one a reader added.
Mantra ownMantra(
  String slug, {
  String type = 'PRIVATE',
  bool mine = true,
  String? imageUrl,
}) =>
    Mantra.fromJson({
      'id': 'id-$slug',
      'slug': slug,
      'name': 'Name of $slug',
      'text': 'text of $slug',
      'mantraType': type,
      'isMine': mine,
      'imageUrl': ?imageUrl,
    });

MantraSuggestion suggestion(
  int index, {
  String status = 'new',
  String kind = 'deity',
  String? slug,
}) =>
    MantraSuggestion(
      index: index,
      name: 'Mantra $index',
      sanskrit: 'sanskrit $index',
      transliteration: 'translit $index',
      kind: kind,
      addressedTo: 'Deity $index',
      status: status,
      slug: slug,
    );

/// The server's side of adding an own mantra, played by hand: what a search
/// finds and what a choice makes are set on it, and what was asked is kept.
class FakeOwnMantraService implements OwnMantraService {
  MantraSuggestions found = const MantraSuggestions(suggestionId: '', items: []);
  List<OwnMantraResult> made = const [];

  /// Thrown by the next search / choice / removal.
  ApiFailure? searchFailure;
  ApiFailure? createFailure;
  ApiFailure? leaveFailure;

  /// When set, a search waits for it — a search that is still going.
  Completer<MantraSuggestions>? holdSearch;

  final List<String> searched = [];
  final List<List<int>> created = [];
  final List<String> createdFor = [];
  final List<String> left = [];

  @override
  Future<MantraSuggestions> suggest(String text) async {
    searched.add(text);
    final failure = searchFailure;
    if (failure != null) throw failure;
    return holdSearch?.future ?? found;
  }

  @override
  Future<List<OwnMantraResult>> create(String suggestionId, List<int> picks) async {
    createdFor.add(suggestionId);
    created.add(picks);
    final failure = createFailure;
    if (failure != null) throw failure;
    return made;
  }

  @override
  Future<Mantra> changeImage(String slug, Uint8List bytes) async => ownMantra(slug);

  @override
  Future<void> leave(String slug) async {
    final failure = leaveFailure;
    if (failure != null) throw failure;
    left.add(slug);
  }
}
