import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/book.dart';
import '../../providers/language_chain_provider.dart';
import '../common/eyebrow.dart';
import 'section_counts.dart';

/// The top of a canto's chapter list: which canto this is, its title in the
/// reader's reading language, and how much is in it.
class CantoHeader extends ConsumerWidget {
  const CantoHeader({super.key, required this.canto});

  final BookSection canto;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final text = AppLocalizations.of(context);
    final chain = ref.watch(readingChainProvider);
    final summary = canto.summaryFor(chain)?.trim();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Eyebrow(text.labelCanto(canto.number), color: context.colors.primary),
        const SizedBox(height: AppSpacing.sm),
        Text(canto.titleFor(chain), style: context.texts.headlineMedium),
        if (summary != null && summary.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          Text(summary, style: context.texts.bodyMedium),
        ],
        const SizedBox(height: AppSpacing.lg),
        SectionCounts(chapters: canto.totalChapters ?? 0, verses: canto.totalVerses),
      ],
    );
  }
}
