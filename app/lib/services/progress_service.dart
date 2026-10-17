import '../core/constants/api_paths.dart';
import 'api_client.dart';

/// Where the reader left off in each book — feeds the dashboard's
/// "continue reading" card. `versesRead` only ever increases server side;
/// see `backend/controllers/app/progress.js`.
class ProgressService {
  ProgressService._();

  static final ProgressService instance = ProgressService._();

  final ApiClient _api = ApiClient.instance;

  // `async` and `await`, not an arrow returning the request: the callers end
  // with `.catchError((_) {})`, which throws an ArgumentError at run time when
  // the future underneath is really a `Future<ApiResponse>` and the handler
  // returns nothing — a failed save would become an uncaught error.
  Future<void> save(String verseId, {int? versesRead}) async {
    await _api.put(
      ApiPaths.progress,
      body: {'verseId': verseId, 'versesRead': ?versesRead},
    );
  }

  Future<void> reset(String bookId) async {
    await _api.delete(ApiPaths.progressForBook(bookId));
  }
}
