import '../core/constants/api_paths.dart';
import '../models/subscription.dart';
import 'api_client.dart';

/// Plans, and what the signed-in person is entitled to.
///
/// Money itself is not handled here — the store takes the payment and
/// `PurchaseService` drives that. This only reads the catalogue and tells the
/// backend about a completed purchase so it can check it with the store.
class SubscriptionService {
  SubscriptionService._();

  static final SubscriptionService instance = SubscriptionService._();

  final ApiClient _api = ApiClient.instance;

  /// Every active plan with its prices and feature values. [provider] narrows
  /// the prices to the store this device buys from — the other store's product
  /// ids would only be noise.
  Future<PlanCatalog> plans({String? provider}) async {
    final response = await _api.get(
      ApiPaths.subscriptionPlans,
      query: {'provider': ?provider},
    );
    return PlanCatalog.fromJson(response.json);
  }

  Future<Entitlement> mine() async {
    final response = await _api.get(ApiPaths.subscriptionMe);
    return Entitlement.fromJson(response.json);
  }

  /// Hands a finished store purchase to the backend. The token is never trusted
  /// there — it is checked with Google or Apple server to server — so this
  /// either returns an active subscription or throws.
  Future<void> verify({
    required String provider,
    required String productId,
    String? purchaseToken,
    String? transactionId,
  }) async {
    await _api.post(
      ApiPaths.subscriptionVerify,
      body: {
        'provider': provider,
        'productId': productId,
        'purchaseToken': ?purchaseToken,
        'transactionId': ?transactionId,
      },
    );
  }

  /// Rebuilds entitlement from the ledger — for a reinstall, or a purchase made
  /// on another device.
  Future<void> restore() => _api.post(ApiPaths.subscriptionRestore);
}
