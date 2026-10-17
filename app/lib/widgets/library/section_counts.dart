import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';

/// How big a book, canto or chapter is, as a row of small chips: "12 cantos",
/// "335 chapters", "18000 verses". Each count is its own chip rather than one
/// joined line, because the word that joins them is different in every
/// language. A count of zero is left out.
class SectionCounts extends StatelessWidget {
  const SectionCounts({
    super.key,
    this.cantos = 0,
    this.chapters = 0,
    this.verses = 0,
  });

  final int cantos;
  final int chapters;
  final int verses;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final chips = [
      if (cantos > 0) text.bookCantoCount(cantos),
      if (chapters > 0) text.bookChapterCount(chapters),
      if (verses > 0) text.bookVerseCount(verses),
    ];
    if (chips.isEmpty) return const SizedBox.shrink();

    return Wrap(
      spacing: AppSpacing.sm,
      runSpacing: AppSpacing.sm,
      children: [for (final label in chips) Chip(label: Text(label))],
    );
  }
}
