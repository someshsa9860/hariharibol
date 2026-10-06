import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/issue.dart';
import '../services/issue_service.dart';

/// The seeded issue list.
///
/// It changes about once a release, so it is fetched once and kept for the life
/// of the app rather than re-requested every time the dashboard rebuilds.
final issuesProvider = FutureProvider<List<Issue>>((ref) {
  return IssueService.instance.list();
});
