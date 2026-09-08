import '../core/constants/api_paths.dart';
import '../models/issue.dart';
import 'api_client.dart';

/// The seeded list of things a person can say is wrong.
class IssueService {
  IssueService._();

  static final IssueService instance = IssueService._();

  final ApiClient _api = ApiClient.instance;

  /// [category] filters to `VIKARA` or `PRACTICE`; omitted, it returns both.
  Future<List<Issue>> list({String? category}) async {
    final response = await _api.get(
      ApiPaths.issues,
      query: category == null ? null : {'category': category},
    );
    return response.list
        .whereType<Map>()
        .map((item) => Issue.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
