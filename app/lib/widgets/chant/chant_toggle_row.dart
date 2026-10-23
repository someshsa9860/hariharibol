import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// A labelled switch with one line of status under it — the shape both
/// detection switches share, so they read as a pair.
class ChantToggleRow extends StatelessWidget {
  const ChantToggleRow({
    super.key,
    required this.icon,
    required this.title,
    required this.status,
    required this.value,
    required this.onChanged,
    this.enabled = true,
  });

  final IconData icon;
  final String title;
  final String status;
  final bool value;
  final ValueChanged<bool> onChanged;

  /// False dims the switch and leaves it unable to be turned.
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm),
      child: Row(
        children: [
          Icon(icon, color: context.colors.onSurfaceVariant),
          const SizedBox(width: AppSpacing.md),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: context.texts.bodyLarge),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  status,
                  style: context.texts.bodySmall?.copyWith(color: context.colors.onSurfaceVariant),
                ),
              ],
            ),
          ),
          Switch(value: value, onChanged: enabled ? onChanged : null),
        ],
      ),
    );
  }
}
