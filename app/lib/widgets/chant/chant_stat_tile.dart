import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../common/eyebrow.dart';

/// One figure with its icon: the icon and number on one line, what it is below.
///
/// The icon is there for finding the figure at a glance, not for meaning —
/// every tile also says what it is in words, since in dark mode the icon has
/// no colour to lean on.
class ChantStatTile extends StatelessWidget {
  const ChantStatTile({
    super.key,
    required this.icon,
    required this.label,
    required this.value,
  });

  final IconData icon;
  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                Icon(icon, size: AppSizes.iconSm + 2, color: context.colors.primary),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerLeft,
                    child: Text(value, style: AppTypography.numeral(context, size: 22)),
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Eyebrow(label),
          ],
        ),
      ),
    );
  }
}

/// Three tiles abreast. A row rather than a grid so each can be told what
/// to be without a fixed aspect ratio breaking under a large text size.
class ChantStatRow extends StatelessWidget {
  const ChantStatRow({super.key, required this.tiles});

  final List<ChantStatTile> tiles;

  @override
  Widget build(BuildContext context) {
    return IntrinsicHeight(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < tiles.length; i++) ...[
            if (i > 0) const SizedBox(width: AppSpacing.sm),
            Expanded(child: tiles[i]),
          ],
        ],
      ),
    );
  }
}
