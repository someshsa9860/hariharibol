import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../models/home_feed.dart';
import 'api_client.dart';
import 'local_store.dart';

/// The dashboard, in one call.
///
/// The last good response is kept so a cold launch on a bad connection draws
/// something real instead of a spinner. It is a cache, not storage: the screen
/// shows it immediately and replaces it as soon as the network answers.
class HomeService {
  HomeService._();

  static final HomeService instance = HomeService._();

  final ApiClient _api = ApiClient.instance;

  Future<HomeFeed> fetch() async {
    final response = await _api.get(ApiPaths.home);
    final json = response.json;
    await LocalStore.instance.write(BoxKeys.lastHomePayload, json);
    await LocalStore.instance.write(
      BoxKeys.lastHomeFetchedAt,
      DateTime.now().toUtc().toIso8601String(),
    );
    return HomeFeed.fromJson(json);
  }

  HomeFeed? cached() {
    final json = LocalStore.instance.readJson(BoxKeys.lastHomePayload);
    if (json == null) return null;
    return HomeFeed.fromJson(json);
  }
}
