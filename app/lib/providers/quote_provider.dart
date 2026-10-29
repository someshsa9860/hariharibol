import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/quote.dart';
import '../services/quote_service.dart';
import 'language_chain_provider.dart';
import 'mantra_provider.dart';

/// The quotes for the chanting page: the saved copy first, then what the API
/// says. Watches the reading chain, so choosing another reading language
/// words them again. Read only when the page is showing quotes.
final chantQuotesProvider = StreamProvider.autoDispose<List<Quote>>((ref) {
  final chain = ref.watch(readingChainProvider);
  final service = QuoteService.instance;
  return savedThenFresh(() => service.saved(chain), () => service.list(chain));
});
