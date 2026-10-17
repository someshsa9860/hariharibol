import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_typography.dart';

/// A block quote in an answer, drawn as a verse.
///
/// Sakha sets a shloka, a mantra or a passage in a `>` quote. Lines in
/// an Indic script are set in [AppTypography.verse] — the platform face with the
/// leading matras need, never the serif, which has no Devanagari. Lines in the
/// Roman alphabet (the transliteration, the translation) take the
/// transliteration style. Selectable, so a verse can be copied.
class ShlokaCard extends StatelessWidget {
  const ShlokaCard({super.key, required this.text});

  final String text;

  /// Devanagari through Malayalam, where the app's Indic scripts live.
  static final RegExp _indic = RegExp(r'[ऀ-෿]');

  @override
  Widget build(BuildContext context) {
    final lines = text.trim().split('\n').map((line) => line.trim()).toList();
    final verse = AppTypography.verse(context);
    final roman = AppTypography.transliteration(context);

    return Card(
      child: Padding(
        padding: AppSpacing.card,
        child: SelectionArea(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              for (final line in lines)
                if (line.isEmpty)
                  const SizedBox(height: AppSpacing.sm)
                else
                  Text(line, style: _indic.hasMatch(line) ? verse : roman),
            ],
          ),
        ),
      ),
    );
  }
}
