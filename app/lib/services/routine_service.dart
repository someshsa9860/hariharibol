import '../core/constants/api_paths.dart';
import '../models/routine_data.dart';
import '../models/routine_sync.dart';
import 'api_client.dart';

/// What the routine syncer needs from the server. An interface so the syncer
/// is tested without one.
abstract class RoutineRemote {
  /// Sends [changes] and answers with the routine as it then stands: the whole
  /// daily routine, and tasks and ticks from [since] (a day key) on.
  Future<RoutineData> sync(RoutineChanges changes, {required String since});
}

/// The routine on the account.
class RoutineService implements RoutineRemote {
  RoutineService._();

  static final RoutineService instance = RoutineService._();

  final ApiClient _api = ApiClient.instance;

  @override
  Future<RoutineData> sync(RoutineChanges changes, {required String since}) async {
    final response = await _api.post(ApiPaths.routineSync, body: changes.toJson(since));
    return RoutineData.fromServer(response.json);
  }
}
