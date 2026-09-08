import '../core/constants/api_paths.dart';
import '../core/session/app_session.dart';
import '../models/app_user.dart';
import 'api_client.dart';

/// The signed-in person's own profile and settings.
///
/// Every call here ends by writing the fresh user back into [AppSession], so
/// there is one copy of the profile in the app and screens never hold a stale
/// one of their own.
class UserService {
  UserService._();

  static final UserService instance = UserService._();

  final ApiClient _api = ApiClient.instance;

  /// Re-reads the profile. Worth doing on resume: a donation made in a browser
  /// or a subscription bought on another device is how someone becomes premium,
  /// and neither event reaches this app any other way.
  Future<AppUser> reload() async {
    final response = await _api.get(ApiPaths.me);
    final user = AppUser.fromJson(response.json);
    await AppSession.instance.updateUser(user);
    return user;
  }

  Future<AppUser> updateProfile({String? name, String? timezone}) async {
    final response = await _api.patch(ApiPaths.me, body: {
      'name': ?name,
      'timezone': ?timezone,
    });
    final user = AppUser.fromJson(response.json);
    await AppSession.instance.updateUser(user);
    return user;
  }

  /// The three language choices are set together — changing one usually means
  /// reconsidering the others, and the API validates each against the slot it
  /// is being used for.
  Future<AppUser> updateLanguages({
    String? appLanguage,
    String? mantraLanguage,
    String? readingLanguage,
  }) async {
    final response = await _api.patch(ApiPaths.meLanguages, body: {
      'appLanguage': ?appLanguage,
      'mantraLanguage': ?mantraLanguage,
      'readingLanguage': ?readingLanguage,
    });
    final user = AppUser.fromJson(response.json);
    await AppSession.instance.updateUser(user);
    return user;
  }
}
