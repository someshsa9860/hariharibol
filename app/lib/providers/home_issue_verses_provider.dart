import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/home_issue_verse.dart';
import 'home_provider.dart';
import 'language_chain_provider.dart';
import 'saved_then_fresh.dart';

/// Verses for the vikaras the reader reported lately, for Home. Watched only
/// while someone is signed in (the row is not drawn otherwise), so a signed-out
/// visitor makes no request. A failure leaves the row empty, not an error.
final homeIssueVersesProvider = StreamProvider.autoDispose<List<HomeIssueVerse>>((ref) {
  final languages = ref.watch(readingChainProvider);
  final service = ref.read(homeServiceProvider);
  return savedThenFresh(
    () => service.savedIssueVerses(languages),
    () => service.issueVerses(languages),
  );
});
