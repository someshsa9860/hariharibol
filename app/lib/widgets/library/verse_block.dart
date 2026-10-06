import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';

/// One verse in the reading screen: script, transliteration, translation,
/// commentary, and the action row (favourite, highlight, notes, compare
/// translations, related verses).
///
/// Purely presentational — every action is a callback, and the favourite,
/// highlight and note counts it shows are passed in explicitly rather than
/// read straight off [verse], so the screen holding it can apply an
/// optimistic update the moment someone taps, without waiting on a refetch.
class VerseBlock extends StatelessWidget {
  const VerseBlock({
    super.key,
    required this.verse,
    required this.fontScale,
    required this.isFavorite,
    required this.isHighlighted,
    required this.noteCount,
    required this.onToggleFavorite,
    required this.onToggleHighlight,
    required this.onOpenNotes,
    required this.onOpenRelated,
    this.translation,
    this.onCompareTranslations,
  });

  final Verse verse;
  final double fontScale;

  final bool isFavorite;
  final bool isHighlighted;
  final int noteCount;

  /// The rendering to show — usually [Verse.translation], but a different one
  /// once the reader has picked an acharya to compare against for this verse.
  final VerseTranslation? translation;

  final VoidCallback onToggleFavorite;
  final VoidCallback onToggleHighlight;
  final VoidCallback onOpenNotes;
  final VoidCallback onOpenRelated;

  /// Null when the verse has only one rendering — nothing to compare.
  final VoidCallback? onCompareTranslations;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final sanskrit = verse.sanskrit?.trim();
    final transliteration = verse.transliteration?.trim();
    final rendering = translation ?? verse.translation;
    final meaning = rendering?.meaning?.trim();
    final translatorName = rendering?.translator?.name;
    final explanation = verse.explanation;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: AppSpacing.lg, horizontal: AppSpacing.md),
      decoration: BoxDecoration(
        // Whole-verse emphasis, not colour-only — the filled highlight icon
        // below carries the same state, since dark mode has almost no tint to
        // spend here (see AppColors' note on why colour never carries meaning
        // alone).
        color: isHighlighted ? context.colors.primaryContainer : Colors.transparent,
        borderRadius: AppRadius.mdAll,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  text.labelVerse(verse.verseNumber ?? 0),
                  style: AppTypography.eyebrow(context, color: context.colors.primary),
                ),
              ),
              _ActionIcon(
                icon: isFavorite ? Icons.bookmark_rounded : Icons.bookmark_border_rounded,
                tooltip: isFavorite ? text.actionRemoveBookmark : text.actionBookmark,
                onPressed: onToggleFavorite,
              ),
              _ActionIcon(
                icon: isHighlighted ? Icons.format_paint_rounded : Icons.format_paint_outlined,
                tooltip: isHighlighted ? text.actionRemoveHighlight : text.actionHighlight,
                onPressed: onToggleHighlight,
              ),
              _ActionIcon(
                icon: Icons.edit_note_rounded,
                tooltip: text.verseNotesTitle,
                badgeCount: noteCount,
                onPressed: onOpenNotes,
              ),
              if (onCompareTranslations != null)
                _ActionIcon(
                  icon: Icons.compare_arrows_rounded,
                  tooltip: text.verseCompareTranslations,
                  onPressed: onCompareTranslations!,
                ),
              if (verse.relatedCount > 0)
                _ActionIcon(
                  icon: Icons.link_rounded,
                  tooltip: text.verseRelatedTitle,
                  onPressed: onOpenRelated,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (sanskrit != null && sanskrit.isNotEmpty)
            Text(sanskrit, style: AppTypography.verse(context, scale: fontScale)),
          if (transliteration != null && transliteration.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(transliteration, style: AppTypography.transliteration(context, scale: fontScale)),
          ],
          if (meaning != null && meaning.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text('“$meaning”', style: _scaled(context.texts.bodyLarge, fontScale)),
          ],
          if (translatorName != null && translatorName.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text('— $translatorName', style: context.texts.bodySmall),
          ],
          if (rendering?.hasPurport ?? false) ...[
            const SizedBox(height: AppSpacing.md),
            _Commentary(label: text.mantraPurport, text: rendering!.purport!.trim(), scale: fontScale),
          ] else if (explanation != null && explanation.text.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _Commentary(
              label: explanation.isGenerated ? text.verseExplanationAiLabel : text.verseExplanationLabel,
              text: explanation.text.trim(),
              scale: fontScale,
            ),
          ],
        ],
      ),
    );
  }

  TextStyle? _scaled(TextStyle? style, double scale) {
    if (style == null) return null;
    final size = style.fontSize;
    return size == null ? style : style.copyWith(fontSize: size * scale);
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({
    required this.icon,
    required this.tooltip,
    required this.onPressed,
    this.badgeCount = 0,
  });

  final IconData icon;
  final String tooltip;
  final VoidCallback onPressed;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: badgeCount > 0,
      label: Text('$badgeCount'),
      child: IconButton(
        icon: Icon(icon, size: AppSizes.iconSm),
        tooltip: tooltip,
        onPressed: onPressed,
        color: context.colors.onSurfaceVariant,
      ),
    );
  }
}

/// A collapsible purport or explanation — long text that would otherwise push
/// the next verse well down the screen before anyone has decided to read it.
class _Commentary extends StatefulWidget {
  const _Commentary({required this.label, required this.text, required this.scale});

  final String label;
  final String text;
  final double scale;

  @override
  State<_Commentary> createState() => _CommentaryState();
}

class _CommentaryState extends State<_Commentary> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        InkWell(
          onTap: () => setState(() => _expanded = !_expanded),
          borderRadius: AppRadius.smAll,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.xs),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  widget.label,
                  style: context.texts.labelLarge?.copyWith(color: context.colors.primary),
                ),
                const SizedBox(width: AppSpacing.xs),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: AppDurations.fast,
                  child: Icon(
                    Icons.expand_more_rounded,
                    size: AppSizes.iconSm,
                    color: context.colors.primary,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (_expanded)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs),
            child: Text(
              widget.text,
              style: TextStyle(
                fontSize: (context.texts.bodyMedium?.fontSize ?? 14) * widget.scale,
                height: context.texts.bodyMedium?.height,
                color: context.texts.bodyMedium?.color,
              ),
            ),
          ),
      ],
    );
  }
}
