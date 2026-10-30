import 'package:flutter/material.dart';

import '../../core/constants/setup_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../common/eyebrow.dart';

/// One step of the first-run setup: where the reader is, what is asked, the
/// answer, and the button that moves on. Every step is laid out the same way,
/// so the questions do not jump about as the reader goes through them.
class SetupStepFrame extends StatelessWidget {
  const SetupStepFrame({
    super.key,
    required this.step,
    required this.title,
    required this.subtitle,
    required this.body,
    required this.footer,
    this.onBack,
  });

  /// Zero-based: the first step reads "Step 1 of 5".
  final int step;
  final String title;
  final String subtitle;
  final Widget body;
  final Widget footer;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Padding(
      padding: AppSpacing.page.copyWith(bottom: AppSpacing.lg),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (onBack != null)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: IconButton(
                onPressed: onBack,
                icon: const Icon(Icons.arrow_back_rounded),
                tooltip: text.actionBack,
                padding: EdgeInsets.zero,
                alignment: Alignment.centerLeft,
                constraints: const BoxConstraints(minWidth: AppSizes.iconLg),
              ),
            ),
          Eyebrow(text.languageStepOf(step + 1, SetupConfig.stepCount)),
          const SizedBox(height: AppSpacing.sm),
          Text(title, style: context.texts.headlineMedium),
          const SizedBox(height: AppSpacing.sm),
          Text(
            subtitle,
            style: context.texts.bodyMedium?.copyWith(
              color: context.colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: AppSpacing.xl),
          Expanded(child: body),
          const SizedBox(height: AppSpacing.lg),
          footer,
        ],
      ),
    );
  }
}
