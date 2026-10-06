import '../core/constants/api_paths.dart';
import '../models/book.dart';
import '../models/mantra.dart';
import '../models/paged.dart';
import '../models/search_result.dart';
import '../models/verse.dart';
import 'api_client.dart';

/// Search across verses, mantras and books — always the server's index, never
/// a local copy. The corpus is re-translated and re-published from behind the
/// scenes; an on-device index would just be a second thing to keep in sync.
class SearchService {
  SearchService._();

  static final SearchService instance = SearchService._();

  final ApiClient _api = ApiClient.instance;

  /// The quick, unpaginated preview across all three kinds.
  Future<SearchOverview> overview(String query) async {
    final response = await _api.get(ApiPaths.search, query: {'q': query});
    return SearchOverview.fromJson(response.json);
  }

  Future<Paged<Verse>> verses(String query, {int page = 1}) async {
    final response = await _api.get(
      ApiPaths.search,
      query: {'q': query, 'type': SearchScope.verse.wire, 'page': page},
    );
    return Paged.fromResponse(response.data, response.meta, Verse.fromJson);
  }

  Future<Paged<Mantra>> mantras(String query, {int page = 1}) async {
    final response = await _api.get(
      ApiPaths.search,
      query: {'q': query, 'type': SearchScope.mantra.wire, 'page': page},
    );
    return Paged.fromResponse(response.data, response.meta, Mantra.fromJson);
  }

  Future<Paged<Book>> books(String query, {int page = 1}) async {
    final response = await _api.get(
      ApiPaths.search,
      query: {'q': query, 'type': SearchScope.book.wire, 'page': page},
    );
    return Paged.fromResponse(response.data, response.meta, Book.fromJson);
  }
}
