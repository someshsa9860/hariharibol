import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';
import 'highlighted_snippet.dart';

/// One verse in a search result list.
///
/// The citation leads, not the text — a search spans every book at once, so
/// "Bhagavad Gita · 2.47" is what tells two results apart before either line of
/// Sanskrit does. When the search says where it found the words, the passage is
/// shown with them picked out and a small label for which text it came from; a
/// verse reached by its number has no passage, so it shows the verse itself.
class VerseResultTile extends StatelessWidget {
  const VerseResultTile({super.key, required this.verse, this.onTap});

  final Verse verse;
  final VoidCallback? onTap;

  static String _verseLine(Verse verse) =>
      verse.sanskrit ?? verse.transliteration ?? verse.translation?.meaning ?? '';

  String _fieldLabel(AppLocalizations text, String field) => switch (field) {
        'meaning' => text.readingSectionMeaning,
        'purport' => text.readingSectionPurport,
        _ => text.readingSectionVerse,
      };

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final match = verse.searchMatch;
    final verseLine = _verseLine(verse);
    // The passage says it all when the words are in the verse itself; when they are in the
    // meaning or purport the verse is shown above it, for context.
    final showVerseLine = verseLine.isNotEmpty &&
        (match == null || match.field == 'meaning' || match.field == 'purport');

    return Card(
      margin: EdgeInsets.zero,
      child: InkWell(
        onTap: onTap,
        borderRadius: AppRadius.mdAll,
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text(
                      verse.citation,
                      style: context.texts.labelLarge?.copyWith(color: context.colors.primary),
                    ),
                  ),
                  if (match != null) _FieldTag(label: _fieldLabel(text, match.field)),
                ],
              ),
              if (showVerseLine) ...[
                const SizedBox(height: AppSpacing.sm),
                Text(
                  verseLine,
                  style: context.texts.bodyMedium?.copyWith(height: 1.45),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
              if (match != null) ...[
                const SizedBox(height: AppSpacing.sm),
                HighlightedSnippet(
                  snippet: match.snippet,
                  style: showVerseLine
                      ? context.texts.bodySmall?.copyWith(
                          color: context.colors.onSurfaceVariant,
                          height: 1.45,
                        )
                      : context.texts.bodyMedium?.copyWith(height: 1.45),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _FieldTag extends StatelessWidget {
  const _FieldTag({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.xxs),
      decoration: BoxDecoration(
        color: context.colors.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(AppRadius.pill),
      ),
      child: Text(
        label,
        style: context.texts.labelSmall?.copyWith(color: context.colors.onSurfaceVariant),
      ),
    );
  }
}
