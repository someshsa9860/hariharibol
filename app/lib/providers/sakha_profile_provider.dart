import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/api_failure.dart';
import '../models/sakha_profile.dart';
import 'chat_provider.dart';
import 'session_provider.dart';

/// What Sakha has noted about the reader — the data behind the profile sheet.
///
/// Read again each time the sheet opens (the provider is `autoDispose`) and for
/// whoever signs in next. The two actions answer with the failure instead of
/// throwing, as `SadhanaTodayNotifier.refresh` does, and leave the screen on
/// what is true: a switch that was refused goes back, a delete that failed
/// keeps the list.
class SakhaProfileNotifier extends AsyncNotifier<SakhaProfile> {
  @override
  Future<SakhaProfile> build() {
    ref.watch(currentUserProvider.select((user) => user?.id));
    return ref.watch(chatServiceProvider).profile();
  }

  /// Turns the noticing on or off. The switch moves at once and goes back if
  /// the server refuses; the server's answer replaces it when it comes.
  Future<ApiFailure?> setLearning(bool learning) async {
    final before = state.value;
    if (before == null) return null;
    state = AsyncData(before.copyWith(learning: learning));
    try {
      final saved = await ref.read(chatServiceProvider).setProfileLearning(learning);
      if (ref.mounted) state = AsyncData(saved);
      return null;
    } on ApiFailure catch (failure) {
      if (ref.mounted) state = AsyncData(before);
      return failure;
    }
  }

  /// Deletes everything noted. The switch is left as the reader set it: this
  /// is not "stop learning", and the next chat can note things again.
  Future<ApiFailure?> delete() async {
    final learning = state.value?.learning ?? true;
    try {
      await ref.read(chatServiceProvider).deleteProfile();
    } on ApiFailure catch (failure) {
      return failure;
    }
    if (ref.mounted) state = AsyncData(SakhaProfile(learning: learning));
    return null;
  }
}

/// A read that fails is shown at once, with Try again, instead of after
/// Riverpod's ten silent retries: opened offline, the sheet would otherwise
/// spin for some forty seconds before saying so.
final sakhaProfileProvider = AsyncNotifierProvider.autoDispose<SakhaProfileNotifier, SakhaProfile>(
  SakhaProfileNotifier.new,
  retry: (_, _) => null,
);
