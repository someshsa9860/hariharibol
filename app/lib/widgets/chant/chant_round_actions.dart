import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// What can be done to the round in hand, in one row under the ring: take the
/// last bead back, and — once the round is far enough along — finish it early.
///
/// [onFinish] null leaves the finish button out altogether (no control that does
/// nothing); [onUndo] null leaves undo in place but dimmed, as it always was.
class ChantRoundActions extends StatelessWidget {
  const ChantRoundActions({super.key, required this.onUndo, required this.onFinish});

  final VoidCallback? onUndo;
  final VoidCallback? onFinish;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);

    return Wrap(
      alignment: WrapAlignment.center,
      crossAxisAlignment: WrapCrossAlignment.center,
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.xs,
      children: [
        IconButton(
          onPressed: onUndo,
          icon: const Icon(Icons.undo_rounded),
          tooltip: text.sadhanaUndoBead,
        ),
        if (onFinish != null)
          FilledButton.tonalIcon(
            onPressed: onFinish,
            icon: const Icon(Icons.check_rounded),
            label: Text(text.chantFinishRound),
            style: FilledButton.styleFrom(minimumSize: const Size(0, AppSizes.buttonHeightSm)),
          ),
      ],
    );
  }
}
