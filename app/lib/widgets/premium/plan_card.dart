import 'package:flutter/material.dart';
import 'package:in_app_purchase/in_app_purchase.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/subscription.dart';
import '../../services/purchase_service.dart';

/// One plan: what it is, what it costs here, what it unlocks, and how to buy it.
///
/// The same card draws the free plan — it simply has no prices, and says so —
/// which is what lets the screen read as a comparison rather than a sales page
/// with the free tier hidden.
class PlanCard extends StatelessWidget {
  const PlanCard({
    super.key,
    required this.plan,
    required this.features,
    required this.isCurrent,
    required this.products,
    required this.onBuy,
  });

  final SubscriptionPlan plan;

  /// The catalogue, in display order.
  final List<FeatureDef> features;
  final bool isCurrent;

  /// The store's details by product id. Empty while loading or when the store
  /// is unavailable.
  final Map<String, ProductDetails> products;
  final void Function(PlanPrice price, ProductDetails product) onBuy;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final prices = plan.prices.where((p) => p.provider == PurchaseService.provider).toList();

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(child: Text(plan.name, style: context.texts.headlineSmall)),
                if (isCurrent)
                  Chip(
                    label: Text(text.plansCurrent),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
            ),
            if (plan.description != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(plan.description!, style: context.texts.bodyMedium),
            ],
            const SizedBox(height: AppSpacing.lg),

            if (plan.isFree)
              Text(text.plansFreeForEveryone, style: context.texts.titleMedium)
            else
              for (final price in prices)
                _PriceRow(
                  price: price,
                  product: products[price.productId],
                  isCurrent: isCurrent,
                  onBuy: onBuy,
                ),

            if (features.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.lg),
              const Divider(height: 1),
              const SizedBox(height: AppSpacing.md),
              for (final feature in features)
                _FeatureRow(feature: feature, value: plan.features[feature.key]),
            ],
          ],
        ),
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({
    required this.price,
    required this.product,
    required this.isCurrent,
    required this.onBuy,
  });

  final PlanPrice price;
  final ProductDetails? product;
  final bool isCurrent;
  final void Function(PlanPrice price, ProductDetails product) onBuy;

  String _period(AppLocalizations text) => switch (price.periodDays) {
        7 => text.plansPeriodWeek,
        30 => text.plansPeriodMonth,
        365 => text.plansPeriodYear,
        final days => text.plansPeriodDays(days),
      };

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    // The store's price is what will be charged, in the buyer's own currency;
    // the catalogue's is only a fallback while the store has not answered.
    final amount = product?.price ??
        NumberFormat.simpleCurrency(name: price.currency).format(price.priceMinor / 100);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(text.plansPricePer(amount, _period(text)), style: context.texts.titleMedium),
                if (price.hasTrial)
                  Text(text.plansTrial(price.trialDays), style: context.texts.bodySmall),
                if (product == null) Text(text.plansProductMissing, style: context.texts.bodySmall),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          FilledButton(
            // A product the store does not list cannot be bought; the button
            // waits for it rather than opening a sheet that errors.
            onPressed: product == null || isCurrent ? null : () => onBuy(price, product!),
            child: Text(price.hasTrial ? text.plansStartTrial : text.plansSubscribe),
          ),
        ],
      ),
    );
  }
}

class _FeatureRow extends StatelessWidget {
  const _FeatureRow({required this.feature, required this.value});

  final FeatureDef feature;
  final FeatureValue? value;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final enabled = value?.enabled ?? false;

    // Colour never carries meaning here: the icon changes shape, and the words
    // say included or not for anyone who cannot tell the two icons apart.
    final detail = !enabled
        ? text.plansNotIncluded
        : feature.isLimit
            ? (value?.limit == null
                ? text.plansUnlimited
                : text.plansLimit(value!.limit!, feature.unit ?? ''))
            : text.plansIncluded;

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
      child: Row(
        children: [
          Icon(
            enabled ? Icons.check_circle_rounded : Icons.remove_circle_outline_rounded,
            size: AppSizes.iconMd,
            color: enabled ? context.colors.primary : context.colors.onSurfaceVariant,
          ),
          const SizedBox(width: AppSpacing.md),
          Expanded(child: Text(feature.name, style: context.texts.bodyMedium)),
          Text(detail.trim(), style: context.texts.bodySmall),
        ],
      ),
    );
  }
}
