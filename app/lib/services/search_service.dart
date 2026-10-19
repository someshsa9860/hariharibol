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
///
/// The server forgives spelling, spacing and a book named at the start of the
/// query, so what is sent is what the reader typed.
class SearchService {
  SearchService._();

  static final SearchService instance = SearchService._();

  final ApiClient _api = ApiClient.instance;

  Map<String, dynamic> _query(SearchRequest request, [SearchScope? scope, int? page]) => {
        'q': request.query,
        if (request.book != null) 'book': request.book,
        if (scope != null) 'type': scope.wire,
        if (page != null) 'page': page,
      };

  /// The quick, unpaginated preview across all three kinds.
  Future<SearchOverview> overview(SearchRequest request) async {
    final response = await _api.get(ApiPaths.search, query: _query(request));
    return SearchOverview.fromJson(response.json);
  }

  Future<Paged<Verse>> verses(SearchRequest request, {int page = 1}) async {
    final response = await _api.get(ApiPaths.search, query: _query(request, SearchScope.verse, page));
    return Paged.fromResponse(response.data, response.meta, Verse.fromJson);
  }

  Future<Paged<Mantra>> mantras(SearchRequest request, {int page = 1}) async {
    final response = await _api.get(ApiPaths.search, query: _query(request, SearchScope.mantra, page));
    return Paged.fromResponse(response.data, response.meta, Mantra.fromJson);
  }

  Future<Paged<Book>> books(SearchRequest request, {int page = 1}) async {
    final response = await _api.get(ApiPaths.search, query: _query(request, SearchScope.book, page));
    return Paged.fromResponse(response.data, response.meta, Book.fromJson);
  }
}
