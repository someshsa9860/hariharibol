import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show ProviderOrFamily;

import '../core/constants/own_mantra_config.dart';
import '../models/api_failure.dart';
import '../models/mantra.dart';
import '../models/own_mantra.dart';
import '../services/own_mantra_service.dart';
import 'mantra_provider.dart';

/// The service behind the screen. A provider so a test can hand in a fake.
final ownMantraServiceProvider = Provider<OwnMantraService>((ref) => OwnMantraService.instance);

/// Where the reader is in adding mantras.
enum OwnMantraStage {
  /// Typing or speaking; nothing is being looked for.
  input,

  /// Looking for mantras to suggest.
  suggesting,

  /// Choosing from what was found (which may be nothing).
  choosing,

  /// Saving the chosen ones.
  creating,

  /// Saved; showing how each one went.
  done,
}

class OwnMantraState {
  const OwnMantraState({
    this.stage = OwnMantraStage.input,
    this.text = '',
    this.suggestions,
    this.picked = const {},
    this.results = const [],
    this.failure,
  });

  final OwnMantraStage stage;

  /// What was last searched for.
  final String text;
  final MantraSuggestions? suggestions;

  /// The indexes of the suggestions chosen, at most [OwnMantraConfig.maxPicks].
  final Set<int> picked;
  final List<OwnMantraResult> results;

  /// The last call's failure. The screen words it by code and the next call
  /// clears it.
  final ApiFailure? failure;

  bool get busy => stage == OwnMantraStage.suggesting || stage == OwnMantraStage.creating;
  bool get canAdd => stage == OwnMantraStage.choosing && picked.isNotEmpty;
  bool get atMostPicked => picked.length >= OwnMantraConfig.maxPicks;

  OwnMantraState copyWith({
    OwnMantraStage? stage,
    String? text,
    MantraSuggestions? suggestions,
    Set<int>? picked,
    List<OwnMantraResult>? results,
    ApiFailure? failure,
    bool clearFailure = false,
  }) =>
      OwnMantraState(
        stage: stage ?? this.stage,
        text: text ?? this.text,
        suggestions: suggestions ?? this.suggestions,
        picked: picked ?? this.picked,
        results: results ?? this.results,
        failure: clearFailure ? null : failure ?? this.failure,
      );
}

/// Forgets what the providers hold of the mantra lists, so the Jap tab reads
/// the list again. [invalidate] is a `ref.invalidate`, which both a `Ref` and a
/// `WidgetRef` have.
void invalidateMantras(void Function(ProviderOrFamily provider) invalidate, {Iterable<String> slugs = const []}) {
  invalidate(mantraListProvider);
  invalidate(mantraCategoriesProvider);
  for (final slug in slugs) {
    invalidate(mantraDetailProvider(slug));
  }
}

class OwnMantraNotifier extends Notifier<OwnMantraState> {
  @override
  OwnMantraState build() => const OwnMantraState();

  OwnMantraService get _service => ref.read(ownMantraServiceProvider);

  /// Looks for mantras for what the reader typed or said. A new search forgets
  /// the old choices.
  Future<void> search(String text) async {
    final words = text.trim();
    if (words.isEmpty || state.busy) return;

    state = OwnMantraState(stage: OwnMantraStage.suggesting, text: words);
    try {
      final found = await _service.suggest(words);
      if (!ref.mounted) return;
      state = state.copyWith(stage: OwnMantraStage.choosing, suggestions: found);
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      state = state.copyWith(stage: OwnMantraStage.input, failure: failure);
    }
  }

  /// Chooses or unchooses a suggestion. A sixth choice is ignored: the reader
  /// unchooses one first.
  void toggle(MantraSuggestion suggestion) {
    if (state.stage != OwnMantraStage.choosing || !suggestion.canPick) return;

    final next = {...state.picked};
    if (!next.remove(suggestion.index)) {
      if (state.atMostPicked) return;
      next.add(suggestion.index);
    }
    state = state.copyWith(picked: next, clearFailure: true);
  }

  /// Saves the chosen mantras.
  Future<void> addChosen() async {
    final found = state.suggestions;
    if (found == null || !state.canAdd) return;

    final picks = (state.picked.toList()..sort());
    state = state.copyWith(stage: OwnMantraStage.creating, clearFailure: true);

    // The lists must be told even if the reader has left the screen by the time
    // the answer comes, so the provider stays until it does.
    final link = ref.keepAlive();
    try {
      final results = await _service.create(found.suggestionId, picks);
      invalidateMantras(
        ref.invalidate,
        slugs: [for (final result in results) if (result.mantra != null) result.mantra!.slug],
      );
      if (!ref.mounted) return;
      state = state.copyWith(stage: OwnMantraStage.done, results: results);
    } on ApiFailure catch (failure) {
      if (!ref.mounted) return;
      // The suggestions were kept for an hour and it has passed: back to the
      // text, which is still in the box, to search again.
      state = failure.statusCode == OwnMantraConfig.statusExpired
          ? OwnMantraState(text: state.text, failure: failure)
          : state.copyWith(stage: OwnMantraStage.choosing, failure: failure);
    } finally {
      link.close();
    }
  }

  /// Puts the mantra with its new picture in place of the old one in the results.
  void pictureChanged(Mantra mantra) {
    state = state.copyWith(
      results: [
        for (final result in state.results)
          result.mantra?.slug == mantra.slug ? result.withMantra(mantra) : result,
      ],
    );
  }
}

final ownMantraProvider =
    NotifierProvider.autoDispose<OwnMantraNotifier, OwnMantraState>(OwnMantraNotifier.new);
