import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../models/subscription.dart';
import '../services/purchase_service.dart';
import '../services/subscription_service.dart';
import '../services/user_service.dart';

/// Every plan, priced for the store this device buys from. The catalogue
/// changes when someone edits it in the admin panel, so it is re-read each time
/// the plans screen opens rather than kept for the life of the app.
final planCatalogProvider = FutureProvider.autoDispose<PlanCatalog>((ref) {
  return SubscriptionService.instance.plans(provider: PurchaseService.provider);
});

/// The store's own details for the products the catalogue lists — chiefly the
/// price in the buyer's currency, which is what they will really be charged. A
/// product the store does not know is simply absent, and the screen says so
/// rather than offering a button that cannot work.
final storeProductsProvider = FutureProvider.autoDispose<Map<String, ProductDetails>>((ref) async {
  final catalog = await ref.watch(planCatalogProvider.future);
  final ids = {
    for (final plan in catalog.plans)
      for (final price in plan.prices)
        if (price.provider == PurchaseService.provider) price.productId,
  };
  return PurchaseService.instance.details(ids);
});

/// What the signed-in person's plan unlocks. Kept alive: features are asked
/// about all over the app, and this is one small request.
class EntitlementNotifier extends AsyncNotifier<Entitlement> {
  StreamSubscription<PurchaseOutcome>? _outcomes;

  @override
  Future<Entitlement> build() {
    // A finished purchase changes the answer — re-read it, and the profile too,
    // since `isPremium` rides on the user object.
    _outcomes ??= PurchaseService.instance.outcomes.listen((outcome) {
      if (outcome.kind == PurchaseOutcomeKind.success) unawaited(_reloadAfterPurchase());
    });
    ref.onDispose(() {
      _outcomes?.cancel();
      _outcomes = null;
    });
    return SubscriptionService.instance.mine();
  }

  Future<void> refresh() async {
    state = await AsyncValue.guard(SubscriptionService.instance.mine);
  }

  Future<void> _reloadAfterPurchase() async {
    await refresh();
    await UserService.instance.reload();
  }

  /// Re-asks the store and the backend what this account owns, then reloads.
  Future<void> restore() async {
    await PurchaseService.instance.restore();
    await SubscriptionService.instance.restore();
    await _reloadAfterPurchase();
  }
}

final entitlementProvider =
    AsyncNotifierProvider<EntitlementNotifier, Entitlement>(EntitlementNotifier.new);

/// Whether the person's plan switches [featureKey] on. The single question the
/// rest of the app asks — `ref.watch(featureProvider('ads.removed'))` — so a
/// screen never needs to know which plan unlocks what.
final featureProvider = Provider.family<bool, String>((ref, featureKey) {
  return ref.watch(entitlementProvider).value?.can(featureKey) ?? false;
});
