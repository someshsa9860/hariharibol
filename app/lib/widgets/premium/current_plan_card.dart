import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/subscription.dart';
import '../common/eyebrow.dart';

/// Which plan the person is on and, for a paid one, what happens next: it
/// renews, it ends, or — for a donor — it never does.
class CurrentPlanCard extends StatelessWidget {
  const CurrentPlanCard({super.key, required this.entitlement});

  final Entitlement entitlement;

  String? _status(AppLocalizations text, String locale) {
    if (!entitlement.isPremium) return null;
    if (entitlement.isDonor) return text.plansPermanent;

    final end = entitlement.premiumUntil;
    if (end == null) return null;
    final date = DateFormat.yMMMd(locale).format(end);
    return (entitlement.subscription?.autoRenew ?? false)
        ? text.plansRenews(date)
        : text.plansEnds(date);
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final status = _status(text, Localizations.localeOf(context).toString());

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Eyebrow(text.plansYourPlan),
            const SizedBox(height: AppSpacing.sm),
            Text(entitlement.plan?.name ?? '', style: context.texts.headlineSmall),
            if (status != null) ...[
              const SizedBox(height: AppSpacing.xs),
              Text(status, style: context.texts.bodyMedium),
            ],
          ],
        ),
      ),
    );
  }
}
