import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:in_app_purchase/in_app_purchase.dart';

import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../../models/subscription.dart';
import '../../providers/subscription_provider.dart';
import '../../services/purchase_service.dart';
import '../../widgets/common/app_error_view.dart';
import '../../widgets/common/app_loader.dart';
import '../../widgets/premium/current_plan_card.dart';
import '../../widgets/premium/plan_card.dart';

/// The plans, side by side: what each costs on this device's store and what
/// each one unlocks. The free plan is on the screen on purpose — the point is
/// that paid plans add, not that the free one is a locked room.
class PlansView extends ConsumerStatefulWidget {
  const PlansView({super.key});

  @override
  ConsumerState<PlansView> createState() => _PlansViewState();
}

class _PlansViewState extends ConsumerState<PlansView> {
  StreamSubscription<PurchaseOutcome>? _outcomes;

  @override
  void initState() {
    super.initState();
    // The store answers on its own schedule, so the result of a purchase is a
    // message here rather than the return value of the tap that started it.
    _outcomes = PurchaseService.instance.outcomes.listen(_onOutcome);
  }

  @override
  void dispose() {
    _outcomes?.cancel();
    super.dispose();
  }

  void _onOutcome(PurchaseOutcome outcome) {
    if (!mounted) return;
    final text = AppLocalizations.of(context);
    AppNavigator.instance.showMessage(switch (outcome.kind) {
      PurchaseOutcomeKind.success => text.plansPurchaseSuccess,
      PurchaseOutcomeKind.pending => text.plansPurchasePending,
      PurchaseOutcomeKind.cancelled => text.plansPurchaseCancelled,
      PurchaseOutcomeKind.failed => text.plansPurchaseFailed,
    });
  }

  Future<void> _buy(PlanPrice price, ProductDetails product) async {
    final text = AppLocalizations.of(context);
    try {
      await PurchaseService.instance.buy(product);
    } catch (_) {
      // The sheet could not be opened at all — distinct from the user closing it,
      // which arrives as a `cancelled` outcome.
      if (mounted) AppNavigator.instance.showMessage(text.plansStoreUnavailable);
    }
  }

  Future<void> _restore() async {
    final text = AppLocalizations.of(context);
    final navigator = AppNavigator.instance;
    try {
      await navigator.loading.wrap(ref.read(entitlementProvider.notifier).restore);
      navigator.showMessage(text.plansRestoreDone);
    } on ApiFailure catch (failure) {
      navigator.showFailure(failure);
    } catch (_) {
      navigator.showMessage(text.plansStoreUnavailable);
    }
  }

  Future<void> _reload() async {
    ref.invalidate(planCatalogProvider);
    await ref.read(entitlementProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final catalog = ref.watch(planCatalogProvider);
    final entitlement = ref.watch(entitlementProvider).value;
    final products = ref.watch(storeProductsProvider).value ?? const <String, ProductDetails>{};

    return Scaffold(
      appBar: AppBar(title: Text(text.plansTitle, style: context.texts.headlineSmall)),
      body: catalog.when(
        loading: () => const AppLoader(),
        error: (error, _) => AppErrorView(
          failure: error is ApiFailure ? error : ApiFailure(kind: FailureKind.unknown, message: ''),
          onRetry: _reload,
        ),
        data: (data) => RefreshIndicator(
          onRefresh: _reload,
          child: ListView(
            padding: AppSpacing.page,
            children: [
              Text(text.plansSubtitle, style: context.texts.bodyMedium),
              const SizedBox(height: AppSpacing.lg),
              if (entitlement != null) ...[
                CurrentPlanCard(entitlement: entitlement),
                const SizedBox(height: AppSpacing.lg),
              ],
              for (final plan in data.plans) ...[
                PlanCard(
                  plan: plan,
                  features: data.features,
                  isCurrent: entitlement?.plan?.id == plan.id,
                  products: products,
                  onBuy: _buy,
                ),
                const SizedBox(height: AppSpacing.lg),
              ],
              Center(
                child: TextButton(onPressed: _restore, child: Text(text.plansRestore)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
