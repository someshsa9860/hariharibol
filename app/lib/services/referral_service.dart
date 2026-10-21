import '../core/constants/api_paths.dart';
import '../core/constants/storage_keys.dart';
import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import '../models/referral.dart';
import 'api_client.dart';
import 'local_store.dart';

/// Refer & Earn. An invitation is a claim, never an opening: a code from a `/satsang/<code>` link is remembered here,
/// and handed to the server only once the reader is signed in. The server decides whether it counts.
class ReferralService {
  ReferralService._();

  static final ReferralService instance = ReferralService._();

  final ApiClient _api = ApiClient.instance;

  static final RegExp _code = RegExp(r'^[A-Za-z0-9]{4,20}$');

  Future<ReferralSummary> summary() async {
    final response = await _api.get(ApiPaths.referralMe);
    return ReferralSummary.fromJson(response.json);
  }

  /// Claims a code the reader typed. Throws `ApiFailure` (409 when it cannot count).
  Future<void> claim(String code) => _api.post(ApiPaths.referralClaim, body: {'code': code.trim()});

  /// Keeps the first invitation a person follows; a later link does not replace it.
  Future<void> remember(String code) async {
    if (!_code.hasMatch(code)) return;
    if (LocalStore.instance.read<String>(BoxKeys.pendingReferral) != null) return;
    await LocalStore.instance.write(BoxKeys.pendingReferral, code);
  }

  /// Called when a session starts or is restored. A code the server refuses for a reason that cannot change
  /// (their own, an old account, a second invitation) is dropped; a network failure keeps it for next time.
  Future<void> claimPending() async {
    final code = LocalStore.instance.read<String>(BoxKeys.pendingReferral);
    if (code == null || !AppSession.instance.isSignedIn) return;
    try {
      await claim(code);
      await LocalStore.instance.delete(BoxKeys.pendingReferral);
    } on ApiFailure catch (failure) {
      if (!failure.isNetwork && !failure.isAuth && failure.statusCode != 429 && (failure.statusCode ?? 500) < 500) {
        await LocalStore.instance.delete(BoxKeys.pendingReferral);
      }
    }
  }
}
