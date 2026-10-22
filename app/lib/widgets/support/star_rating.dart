import 'package:flutter/material.dart';

import '../../core/constants/support_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// Five tappable stars. [value] is 0 when nothing is chosen yet. With no
/// [onChanged] it only shows the rating.
class StarRating extends StatelessWidget {
  const StarRating({super.key, required this.value, this.onChanged, this.size = AppSizes.iconLg});

  final int value;
  final ValueChanged<int>? onChanged;
  final double size;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (var star = 1; star <= SupportConfig.starCount; star++)
          IconButton(
            onPressed: onChanged == null ? null : () => onChanged!(star),
            iconSize: size,
            padding: const EdgeInsets.all(AppSpacing.xs),
            constraints: const BoxConstraints(),
            // The filled and outlined shapes, not colour alone, say which are chosen.
            icon: Icon(
              star <= value ? Icons.star_rounded : Icons.star_outline_rounded,
              color: context.colors.primary,
            ),
          ),
      ],
    );
  }
}
