import '../core/constants/api_paths.dart';
import 'api_client.dart';

/// Where the reader left off in each book — feeds the dashboard's
/// "continue reading" card. `versesRead` only ever increases server side;
/// see `backend/controllers/app/progress.js`.
class ProgressService {
  ProgressService._();

  static final ProgressService instance = ProgressService._();

  final ApiClient _api = ApiClient.instance;

  Future<void> save(String verseId, {int? versesRead}) => _api.put(
        ApiPaths.progress,
        body: {'verseId': verseId, 'versesRead': ?versesRead},
      );

  Future<void> reset(String bookId) => _api.delete(ApiPaths.progressForBook(bookId));
}
