import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// A label with a turning chevron that shows or hides [child] — the purport and
/// the word meanings under a verse, which would otherwise push the next verse
/// well down the screen before anyone has decided to read them.
///
/// Whether it is open is the caller's to hold, so a section can remember it
/// (word meanings) or forget it (the purport).
class CollapsibleSection extends StatelessWidget {
  const CollapsibleSection({
    super.key,
    required this.label,
    required this.expanded,
    required this.onToggle,
    required this.child,
  });

  final String label;
  final bool expanded;
  final VoidCallback onToggle;

  /// Built only while open.
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Semantics(
          expanded: expanded,
          child: InkWell(
            onTap: onToggle,
            borderRadius: AppRadius.smAll,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: context.texts.labelLarge?.copyWith(
                      color: context.colors.primary,
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  AnimatedRotation(
                    turns: expanded ? 0.5 : 0,
                    duration: AppDurations.fast,
                    child: Icon(
                      Icons.expand_more_rounded,
                      size: AppSizes.iconSm,
                      color: context.colors.primary,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        if (expanded)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: child,
          ),
      ],
    );
  }
}
