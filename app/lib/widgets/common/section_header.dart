import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';

/// The title above a list, with an optional action on the right.
///
/// The title is set in the heading serif; the action is small, in the brand
/// colour, and deliberately not a button — it sits at the end of a line of
/// reading, not on top of it.
class SectionHeader extends StatelessWidget {
  const SectionHeader({super.key, required this.title, this.onViewAll, this.actionLabel});

  final String title;
  final VoidCallback? onViewAll;

  /// Defaults to "View all".
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.baseline,
        textBaseline: TextBaseline.alphabetic,
        children: [
          Expanded(child: Text(title, style: AppTypography.section(context))),
          if (onViewAll != null)
            GestureDetector(
              onTap: onViewAll,
              behavior: HitTestBehavior.opaque,
              child: Padding(
                // Nothing visible, but it gives the tap the 44pt height a
                // small piece of text does not have on its own.
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.sm,
                  vertical: AppSpacing.md,
                ),
                child: Text(
                  actionLabel ?? AppLocalizations.of(context).actionViewAll,
                  style: context.texts.labelLarge?.copyWith(color: context.colors.primary),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
