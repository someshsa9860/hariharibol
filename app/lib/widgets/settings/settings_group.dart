import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../common/eyebrow.dart';

/// A titled block of settings rows, drawn as one card with dividers rather than
/// as separate tiles — which is what makes a settings screen read as a few
/// groups instead of a long undifferentiated list.
class SettingsGroup extends StatelessWidget {
  const SettingsGroup({super.key, required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: AppSpacing.xs, bottom: AppSpacing.sm),
          child: Eyebrow(title),
        ),
        Card(
          clipBehavior: Clip.antiAlias,
          child: Column(
            children: [
              for (var i = 0; i < children.length; i++) ...[
                if (i > 0) const Divider(height: 1, indent: AppSpacing.xxxl),
                children[i],
              ],
            ],
          ),
        ),
      ],
    );
  }
}

/// One row: a tinted icon, a label, what it is currently set to, and a chevron
/// when tapping it goes somewhere.
class SettingsRow extends StatelessWidget {
  const SettingsRow({
    super.key,
    required this.icon,
    required this.label,
    this.value,
    this.onTap,
    this.isDestructive = false,
  });

  final IconData icon;
  final String label;
  final String? value;
  final VoidCallback? onTap;

  /// Signing out and deleting an account. There is no red in the palette, so
  /// this is carried by the wording and the confirmation, not by the colour —
  /// the tint only makes the row look heavier than the ones above it.
  final bool isDestructive;

  @override
  Widget build(BuildContext context) {
    final tint = isDestructive ? context.colors.onSurface : context.colors.primary;

    return InkWell(
      onTap: onTap,
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.md,
          vertical: AppSpacing.md,
        ),
        child: Row(
          children: [
            Container(
              width: AppSizes.avatarSm,
              height: AppSizes.avatarSm,
              decoration: BoxDecoration(
                color: isDestructive
                    ? context.colors.surfaceContainerHighest
                    : context.colors.primaryContainer,
                borderRadius: AppRadius.smAll,
              ),
              child: Icon(icon, size: AppSizes.iconSm, color: tint),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(child: Text(label, style: context.texts.bodyLarge)),
            if (value != null) ...[
              const SizedBox(width: AppSpacing.sm),
              Flexible(
                child: Text(
                  value!,
                  style: context.texts.bodyMedium?.copyWith(
                    color: context.colors.onSurfaceVariant,
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.end,
                ),
              ),
            ],
            if (onTap != null) ...[
              const SizedBox(width: AppSpacing.xs),
              Icon(
                Icons.chevron_right_rounded,
                size: AppSizes.iconMd,
                color: context.colors.onSurfaceVariant,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
