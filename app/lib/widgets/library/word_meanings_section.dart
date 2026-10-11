import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';
import '../../providers/reading_prefs_provider.dart';
import 'collapsible_section.dart';

/// A verse's word-for-word: "Word meanings", closed until opened, then one row
/// to a word, the Sanskrit on the left and what it means on the right.
///
/// Open or closed is remembered for every verse ([wordMeaningsOpenProvider]).
/// A verse with no word-for-word gets nothing at all — not a heading over an
/// empty list.
class WordMeaningsSection extends ConsumerWidget {
  const WordMeaningsSection({super.key, required this.words, required this.fontScale});

  final List<WordMeaning> words;
  final double fontScale;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (words.isEmpty) return const SizedBox.shrink();

    return CollapsibleSection(
      label: AppLocalizations.of(context).verseWordMeanings,
      expanded: ref.watch(wordMeaningsOpenProvider),
      onToggle: () => ref.read(wordMeaningsOpenProvider.notifier).set(!ref.read(wordMeaningsOpenProvider)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [for (final word in words) _WordRow(word: word, fontScale: fontScale)],
      ),
    );
  }
}

class _WordRow extends StatelessWidget {
  const _WordRow({required this.word, required this.fontScale});

  final WordMeaning word;
  final double fontScale;

  @override
  Widget build(BuildContext context) {
    final body = context.texts.bodyMedium;
    final meaning = Text(
      word.meaning,
      style: body?.copyWith(fontSize: (body.fontSize ?? 14) * fontScale),
    );
    final sanskrit = word.word?.trim();

    return MergeSemantics(
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
        // A word the source did not split out has only its meaning, which then
        // takes the whole row.
        child: sanskrit == null || sanskrit.isEmpty
            ? meaning
            : Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    flex: 2,
                    child: Text(sanskrit, style: AppTypography.transliteration(context, scale: fontScale)),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(flex: 3, child: meaning),
                ],
              ),
      ),
    );
  }
}
