import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../models/verse.dart';

/// One verse in a search result list.
///
/// The citation leads, not the text — a search spans every book at once, so
/// "Bhagavad Gita 2.47" is what tells two results apart before either line of
/// Sanskrit does.
class VerseResultTile extends StatelessWidget {
  const VerseResultTile({super.key, required this.verse, this.onTap});

  final Verse verse;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final excerpt = verse.sanskrit ?? verse.transliteration ?? verse.translation?.meaning ?? '';

    return Card(
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                verse.citation,
                style: context.texts.labelMedium?.copyWith(color: context.colors.primary),
              ),
              if (excerpt.isNotEmpty) ...[
                const SizedBox(height: AppSpacing.xs),
                Text(
                  excerpt,
                  style: context.texts.bodyMedium,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
