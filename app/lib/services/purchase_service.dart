import 'dart:async';
import 'dart:io';

import 'package:in_app_purchase/in_app_purchase.dart';

import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import 'subscription_service.dart';

/// What happened to a purchase, for the screen to say something about.
enum PurchaseOutcomeKind { success, pending, cancelled, failed }

class PurchaseOutcome {
  const PurchaseOutcome(this.kind, {this.productId});

  final PurchaseOutcomeKind kind;
  final String? productId;
}

/// Buying a plan from the store this device belongs to.
///
/// Google Play and the App Store both deliver purchases on one long-lived
/// stream — including ones that finished while the app was closed, or sat
/// pending while a parent approved them — so the stream is listened to from
/// boot rather than from the plans screen. A purchase is only *completed* (the
/// store's word for "we've got it, stop re-delivering") after the backend has
/// verified it with the store; if verification fails it is left open and
/// arrives again next launch, which is what stops someone paying and getting
/// nothing.
class PurchaseService {
  PurchaseService._();

  static final PurchaseService instance = PurchaseService._();

  /// The provider key the backend knows this device's store by. A new store
  /// means a new key here and in `backend/services/payments/` — nothing else.
  static String get provider => Platform.isIOS ? 'APPLE_APP_STORE' : 'GOOGLE_PLAY';

  final InAppPurchase _store = InAppPurchase.instance;
  final StreamController<PurchaseOutcome> _outcomes = StreamController.broadcast();
  StreamSubscription<List<PurchaseDetails>>? _purchases;

  Stream<PurchaseOutcome> get outcomes => _outcomes.stream;

  /// Safe to call more than once.
  void start() {
    _purchases ??= _store.purchaseStream.listen(
      _onPurchases,
      onError: (Object _) => _outcomes.add(const PurchaseOutcome(PurchaseOutcomeKind.failed)),
    );
  }

  Future<bool> get isAvailable => _store.isAvailable();

  /// The store's own details — including its localised price — for the
  /// products a plan lists. Missing ones are simply absent from the result.
  Future<Map<String, ProductDetails>> details(Set<String> productIds) async {
    if (productIds.isEmpty || !await isAvailable) return const {};
    final response = await _store.queryProductDetails(productIds);
    return {for (final detail in response.productDetails) detail.id: detail};
  }

  /// Opens the store's purchase sheet. The result arrives on [outcomes], not as
  /// a return value: a purchase can complete seconds later, or after a restart.
  Future<void> buy(ProductDetails product) async {
    start();
    await _store.buyNonConsumable(purchaseParam: PurchaseParam(productDetails: product));
  }

  /// Asks the store to re-send what this account already owns.
  Future<void> restore() async {
    start();
    await _store.restorePurchases();
  }

  Future<void> _onPurchases(List<PurchaseDetails> purchases) async {
    for (final purchase in purchases) {
      switch (purchase.status) {
        case PurchaseStatus.pending:
          _outcomes.add(PurchaseOutcome(PurchaseOutcomeKind.pending, productId: purchase.productID));
        case PurchaseStatus.canceled:
          _outcomes.add(PurchaseOutcome(PurchaseOutcomeKind.cancelled, productId: purchase.productID));
        case PurchaseStatus.error:
          _outcomes.add(PurchaseOutcome(PurchaseOutcomeKind.failed, productId: purchase.productID));
          if (purchase.pendingCompletePurchase) await _store.completePurchase(purchase);
        case PurchaseStatus.purchased || PurchaseStatus.restored:
          await _finish(purchase);
      }
    }
  }

  Future<void> _finish(PurchaseDetails purchase) async {
    // Signed out: nothing to attach the purchase to. Leave it open — the store
    // re-delivers it once someone is signed in.
    if (!AppSession.instance.isSignedIn) return;

    try {
      await SubscriptionService.instance.verify(
        provider: provider,
        productId: purchase.productID,
        // Android's verification data is the purchase token. On iOS it is a
        // receipt, which the backend does not use; it asks Apple about the
        // transaction id instead.
        purchaseToken: Platform.isIOS ? null : purchase.verificationData.serverVerificationData,
        transactionId: Platform.isIOS ? purchase.purchaseID : null,
      );
      if (purchase.pendingCompletePurchase) await _store.completePurchase(purchase);
      _outcomes.add(PurchaseOutcome(PurchaseOutcomeKind.success, productId: purchase.productID));
    } on ApiFailure {
      // Not completed on purpose — see the class comment.
      _outcomes.add(PurchaseOutcome(PurchaseOutcomeKind.failed, productId: purchase.productID));
    }
  }
}
