import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/verse.dart';

/// A verse, as it appears on the dashboard.
///
/// The Sanskrit leads, the translation follows, and the translator is named
/// beside their own words — an acharya's rendering and our own explanation are
/// different things and must never be laid out as if they were the same.
class SlokaCard extends StatelessWidget {
  const SlokaCard({
    super.key,
    required this.verse,
    this.reason,
    this.onTap,
    this.showReference = true,
  });

  final Verse verse;

  /// Why this verse was chosen for this person, when it was chosen for them.
  final String? reason;
  final VoidCallback? onTap;
  final bool showReference;

  @override
  Widget build(BuildContext context) {
    final sanskrit = verse.sanskrit;
    final meaning = verse.translation?.meaning;
    final translator = verse.translation?.translator?.name;

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.lgAll,
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              if (reason != null) ...[
                Text(
                  reason!,
                  style: context.texts.bodySmall?.copyWith(color: context.colors.primary),
                ),
                const SizedBox(height: AppSpacing.md),
              ],
              if (sanskrit != null && sanskrit.isNotEmpty) ...[
                Text(sanskrit, style: AppTypography.verse(context)),
                const SizedBox(height: AppSpacing.md),
              ],
              if (meaning != null && meaning.isNotEmpty)
                Text(
                  meaning,
                  style: context.texts.bodyMedium,
                  maxLines: 4,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  if (showReference)
                    Expanded(
                      child: Text(
                        verse.reference,
                        style: context.texts.bodySmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ),
                  if (translator != null)
                    Text(translator, style: context.texts.bodySmall),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
