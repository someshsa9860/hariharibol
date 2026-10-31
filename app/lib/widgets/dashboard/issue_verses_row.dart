import 'package:flutter/material.dart';

import '../../core/constants/home_config.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/home_issue_verse.dart';
import 'home_card_row.dart';

/// "For what you are working on": one verse card per item, each with the vikara
/// it was chosen for as a chip. A tap opens the verse, when it has a page.
class IssueVersesRow extends StatelessWidget {
  const IssueVersesRow({super.key, required this.items});

  final List<HomeIssueVerse> items;

  @override
  Widget build(BuildContext context) {
    return HomeCardRow(
      cardWidth: HomeConfig.issueVerseCardWidth,
      children: [for (final item in items) _IssueVerseCard(item: item)],
    );
  }
}

class _IssueVerseCard extends StatelessWidget {
  const _IssueVerseCard({required this.item});

  final HomeIssueVerse item;

  @override
  Widget build(BuildContext context) {
    final verse = item.verse;
    final sanskrit = verse.sanskrit;
    final meaning = verse.translation?.meaning;
    final path = verse.readingPath;

    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: path == null ? null : () => AppNavigator.instance.push(path),
        child: Padding(
          padding: AppSpacing.card,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Align(
                alignment: Alignment.centerLeft,
                child: Chip(
                  label: Text(item.issue.name),
                  visualDensity: VisualDensity.compact,
                ),
              ),
              const SizedBox(height: AppSpacing.sm),
              if (sanskrit != null && sanskrit.isNotEmpty) ...[
                Text(
                  sanskrit,
                  style: AppTypography.verse(context),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
              if (meaning != null && meaning.isNotEmpty)
                Text(
                  meaning,
                  style: context.texts.bodySmall,
                  maxLines: 3,
                  overflow: TextOverflow.ellipsis,
                ),
              const SizedBox(height: AppSpacing.sm),
              const Spacer(),
              Text(
                verse.reference,
                style: context.texts.labelMedium?.copyWith(fontWeight: FontWeight.w600),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
