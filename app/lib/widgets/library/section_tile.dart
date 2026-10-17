import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';

/// One row of a book's contents — a canto of the Bhagavatam or a chapter of
/// either book: its number on a tinted square, its title, and what is inside it.
///
/// [label] ("Chapter 3") is what a screen reader says for the number; the
/// square itself shows the bare figure, so the number is never carried by
/// the square alone. [facts] are short counts ("47 verses"), each its own line
/// of text and not one joined sentence, since the joining word differs by
/// language.
class SectionTile extends StatelessWidget {
  const SectionTile({
    super.key,
    required this.number,
    required this.label,
    required this.title,
    required this.facts,
    required this.onTap,
    this.summary,
  });

  final int number;
  final String label;
  final String title;
  final List<String> facts;
  final String? summary;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final summary = this.summary?.trim();

    return Card(
      clipBehavior: Clip.antiAlias,
      child: Semantics(
        button: true,
        label: [label, title, ...facts].join(', '),
        excludeSemantics: true,
        onTap: onTap,
        child: InkWell(
          onTap: onTap,
          child: Padding(
            padding: AppSpacing.card,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _NumberSquare(number: number),
                const SizedBox(width: AppSpacing.lg),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: context.texts.titleMedium),
                      if (summary != null && summary.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          summary,
                          style: context.texts.bodySmall,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                      if (facts.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.sm),
                        Wrap(
                          spacing: AppSpacing.md,
                          runSpacing: AppSpacing.xxs,
                          children: [
                            for (final fact in facts)
                              Text(
                                fact,
                                style: context.texts.bodySmall?.copyWith(
                                  color: context.colors.onSurfaceVariant,
                                ),
                              ),
                          ],
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Icon(
                  Icons.chevron_right_rounded,
                  color: context.colors.onSurfaceVariant,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NumberSquare extends StatelessWidget {
  const _NumberSquare({required this.number});

  final int number;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: AppSizes.avatarMd,
      height: AppSizes.avatarMd,
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: context.colors.primaryContainer,
        borderRadius: AppRadius.mdAll,
      ),
      child: Text(
        '$number',
        style: AppTypography.numeral(
          context,
          size: 20,
        ).copyWith(color: context.colors.onPrimaryContainer),
      ),
    );
  }
}
