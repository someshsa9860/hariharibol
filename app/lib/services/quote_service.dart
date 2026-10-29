import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../models/quote.dart';
import 'api_client.dart';
import 'languages_query.dart';
import 'local_store.dart';

/// The quotes shown on the chanting page. One request returns every published
/// quote in the reader's reading language, and the answer is kept on the phone
/// so the page has quotes with no connection (the same idea as the Jap tab's
/// saved copies). Read only.
class QuoteService {
  QuoteService._();
  static final QuoteService instance = QuoteService._();

  final ApiClient _api = ApiClient.instance;

  /// One copy for each reading chain: the words are in that chain's language.
  static String cacheKey(List<String> languages) => '${BoxKeys.quotesCachePrefix}${languages.join(',')}';

  Future<List<Quote>> list(List<String> languages) async {
    final response = await _api.get(ApiPaths.quotes, query: languagesQuery(languages));
    final json = response.json;
    try {
      await LocalStore.instance.write(cacheKey(languages), json);
    } catch (_) {
      // Not keeping a copy is better than not showing the quotes.
    }
    return Quote.listFromJson(json);
  }

  /// The copy the API last sent for this chain, or null when there is none (or
  /// the store is not open, as in a test).
  List<Quote>? saved(List<String> languages) {
    try {
      final json = LocalStore.instance.readJson(cacheKey(languages));
      if (json == null) return null;
      final quotes = Quote.listFromJson(json);
      return quotes.isEmpty ? null : quotes;
    } catch (_) {
      return null;
    }
  }
}
