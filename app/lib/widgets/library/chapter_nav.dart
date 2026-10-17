import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// Previous / next chapter, at the foot of a chapter. Draws nothing when the
/// chapter has neither.
class ChapterNav extends StatelessWidget {
  const ChapterNav({
    super.key,
    required this.hasPrevious,
    required this.hasNext,
    required this.onPrevious,
    required this.onNext,
  });

  final bool hasPrevious;
  final bool hasNext;
  final VoidCallback onPrevious;
  final VoidCallback onNext;

  @override
  Widget build(BuildContext context) {
    if (!hasPrevious && !hasNext) return const SizedBox.shrink();
    final text = AppLocalizations.of(context);

    return Row(
      children: [
        if (hasPrevious)
          Expanded(
            child: OutlinedButton.icon(
              onPressed: onPrevious,
              icon: const Icon(Icons.arrow_back_rounded),
              label: Text(text.chapterPrevious),
            ),
          ),
        if (hasPrevious && hasNext) const SizedBox(width: AppSpacing.md),
        if (hasNext)
          Expanded(
            child: FilledButton.icon(
              onPressed: onNext,
              icon: const Icon(Icons.arrow_forward_rounded),
              label: Text(text.chapterNext),
            ),
          ),
      ],
    );
  }
}
