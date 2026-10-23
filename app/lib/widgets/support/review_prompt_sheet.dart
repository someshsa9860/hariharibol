import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

enum ReviewAnswer { liked, unhappy, dismissed }

/// "Enjoying HariHariBol?" — asked before the store's own rating sheet, so only
/// someone who says yes is sent there and anyone who says no is sent to write to us.
class ReviewPromptSheet extends StatelessWidget {
  const ReviewPromptSheet._();

  static Future<ReviewAnswer> show(BuildContext context) async {
    final answer = await showModalBottomSheet<ReviewAnswer>(
      context: context,
      useRootNavigator: true,
      builder: (_) => const ReviewPromptSheet._(),
    );
    return answer ?? ReviewAnswer.dismissed;
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return SafeArea(
      child: Padding(
        padding: AppSpacing.card,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(text.reviewPromptTitle, style: context.texts.titleLarge, textAlign: TextAlign.center),
            const SizedBox(height: AppSpacing.lg),
            FilledButton(
              onPressed: () => Navigator.of(context).pop(ReviewAnswer.liked),
              style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
              child: Text(text.reviewPromptYes),
            ),
            const SizedBox(height: AppSpacing.sm),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pop(ReviewAnswer.unhappy),
              style: OutlinedButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeight)),
              child: Text(text.reviewPromptNo),
            ),
          ],
        ),
      ),
    );
  }
}
