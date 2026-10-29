import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/format/script.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../models/verse.dart';
import '../../models/verse_part.dart';
import '../common/peacock_feather_icon.dart';
import 'collapsible_section.dart';
import 'sanskrit_text.dart';
import 'word_meanings_section.dart';
import '../../views/share/share_studio_view.dart';
import '../share/share_target.dart';

/// One verse in the reading screen: script, transliteration, word meanings,
/// translation, commentary, and the action row (favourite, highlight, notes,
/// compare translations, related verses).
///
/// Presentational — every action is a callback, and the favourite, highlight
/// and note counts it shows are passed in explicitly rather than read straight
/// off [verse], so the screen holding it can apply an optimistic update the
/// moment someone taps, without waiting on a refetch. The one thing it holds
/// itself is whether "Word meanings" is open, which is remembered across every
/// verse (see [WordMeaningsSection]).
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
    this.onAskSakha,
    this.onStartReels,
    this.translation,
    this.onCompareTranslations,
    this.onPlay,
    this.playing,
    this.hidden = const {},
    this.onCollapse,
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

  /// Opens Ask Sakha with this verse. Null hides the button.
  final VoidCallback? onAskSakha;

  /// Starts the book's reels from this verse (the peacock feather). Null hides it.
  final VoidCallback? onStartReels;

  /// Null when the verse has only one rendering — nothing to compare.
  final VoidCallback? onCompareTranslations;

  /// Plays this verse (recitation, meaning, purport). Null when there is
  /// nothing to play, so the button is not shown rather than shown dead.
  final VoidCallback? onPlay;

  /// Set when the verse was opened out of a story: puts a button first in the
  /// header that closes it back into the story's running text.
  final VoidCallback? onCollapse;

  /// This verse is the one being read aloud, and which part of it is heard.
  final bool? playing;

  /// Parts the reader has chosen not to see (Reading settings). The screen
  /// holding the block passes them in, so the block itself reads no settings.
  final Set<VersePart> hidden;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final sanskrit = verse.sanskrit?.trim();
    final showSanskrit =
        !hidden.contains(VersePart.sanskrit) &&
        sanskrit != null &&
        sanskrit.isNotEmpty;
    // A transliteration in the verse's own script (a Marathi reader's Devanagari
    // under the Devanagari verse) would only repeat it. A Tamil or Roman one is
    // a different way to read the same words, so it is shown.
    final transliteration = hidden.contains(VersePart.transliteration)
        ? null
        : _transliterationToShow(verse.transliteration?.trim(), sanskrit);
    final rendering = translation ?? verse.translation;
    final meaning = rendering?.meaning?.trim();
    final translatorName = rendering?.translator?.creditName;
    final explanation = verse.explanation;
    // The purport and the explanation that stands in for it are one slot.
    final showCommentary = !hidden.contains(VersePart.purport);

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(
        vertical: AppSpacing.lg,
        horizontal: AppSpacing.md,
      ),
      decoration: BoxDecoration(
        // Whole-verse emphasis, not colour-only — the filled highlight icon
        // below carries the same state, since dark mode has almost no tint to
        // spend here (see AppColors' note on why colour never carries meaning
        // alone).
        color: isHighlighted
            ? context.colors.primaryContainer
            : Colors.transparent,
        borderRadius: AppRadius.mdAll,
        // The verse being read aloud is outlined; the part being heard is
        // also named in words under the number, since an outline is only colour.
        border: playing == true
            ? Border.all(color: context.colors.primary, width: 1.5)
            : null,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _VerseHeader(
            label: text.labelVerseShort(verse.verseNumber ?? 0),
            play: onPlay == null
                ? null
                : _Action(
                    icon: playing == true
                        ? Icons.volume_up_rounded
                        : Icons.play_arrow_rounded,
                    tooltip: text.readingAudioPlayVerse,
                    onPressed: onPlay!,
                  ),
            // In the order they are given up when the row is too narrow: the
            // last ones go into the "more" menu first.
            actions: [
              if (onCollapse != null)
                _Action(
                  icon: Icons.unfold_less_rounded,
                  tooltip: text.readingStoryCollapse,
                  onPressed: onCollapse!,
                ),
              _Action(
                icon: isFavorite
                    ? Icons.bookmark_rounded
                    : Icons.bookmark_border_rounded,
                tooltip: isFavorite
                    ? text.actionRemoveBookmark
                    : text.actionBookmark,
                onPressed: onToggleFavorite,
              ),
              _Action(
                icon: isHighlighted
                    ? Icons.format_paint_rounded
                    : Icons.format_paint_outlined,
                tooltip: isHighlighted
                    ? text.actionRemoveHighlight
                    : text.actionHighlight,
                onPressed: onToggleHighlight,
              ),
              _Action(
                icon: Icons.edit_note_rounded,
                tooltip: text.verseNotesTitle,
                badgeCount: noteCount,
                onPressed: onOpenNotes,
              ),
              _Action(
                icon: Icons.ios_share_rounded,
                tooltip: text.shareTitle,
                onPressed: () => ShareStudio.open(context, ShareTarget.verse(verse, translation: translation)),
              ),
              if (onStartReels != null)
                _Action(
                  iconWidget: const PeacockFeatherIcon(size: AppSizes.iconSm),
                  tooltip: text.verseStartReels,
                  onPressed: onStartReels!,
                ),
              if (onAskSakha != null)
                _Action(
                  icon: Icons.chat_bubble_outline_rounded,
                  tooltip: text.verseAskSakha,
                  onPressed: onAskSakha!,
                ),
              if (onCompareTranslations != null)
                _Action(
                  icon: Icons.compare_arrows_rounded,
                  tooltip: text.verseCompareTranslations,
                  onPressed: onCompareTranslations!,
                ),
              if (verse.relatedCount > 0)
                _Action(
                  icon: Icons.link_rounded,
                  tooltip: text.verseRelatedTitle,
                  onPressed: onOpenRelated,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          if (showSanskrit) SanskritText(sanskrit, scale: fontScale),
          if (transliteration != null && transliteration.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Text(
              transliteration,
              style: AppTypography.transliteration(context, scale: fontScale),
            ),
          ],
          if (verse.wordMeanings.isNotEmpty &&
              !hidden.contains(VersePart.wordMeanings)) ...[
            const SizedBox(height: AppSpacing.sm),
            WordMeaningsSection(
              words: verse.wordMeanings,
              fontScale: fontScale,
            ),
          ],
          if (meaning != null && meaning.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              text.labelQuotedMeaning(meaning),
              style: _scaled(context.texts.bodyLarge, fontScale),
            ),
          ],
          if (translatorName != null && translatorName.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              text.labelTranslatorCredit(translatorName),
              style: context.texts.bodySmall,
            ),
          ],
          if (showCommentary && (rendering?.hasPurport ?? false)) ...[
            const SizedBox(height: AppSpacing.md),
            _Commentary(
              label: text.mantraPurport,
              text: rendering!.purport!.trim(),
              scale: fontScale,
            ),
          ] else if (showCommentary &&
              explanation != null &&
              explanation.text.trim().isNotEmpty) ...[
            const SizedBox(height: AppSpacing.md),
            _Commentary(
              label: explanation.isGenerated
                  ? text.verseExplanationAiLabel
                  : text.verseExplanationLabel,
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

String? _transliterationToShow(String? transliteration, String? sanskrit) {
  if (transliteration == null || transliteration.isEmpty) return null;
  if (sanskrit != null && sameScript(transliteration, sanskrit)) return null;
  return transliteration;
}

/// One button of the verse's action row.
class _Action {
  const _Action({
    this.icon,
    this.iconWidget,
    required this.tooltip,
    required this.onPressed,
    this.badgeCount = 0,
  });

  final IconData? icon;

  /// Used instead of [icon] for a drawn glyph such as the peacock feather.
  final Widget? iconWidget;
  final String tooltip;
  final VoidCallback onPressed;
  final int badgeCount;

  Widget get glyph => iconWidget ?? Icon(icon, size: AppSizes.iconSm);
}

/// The verse's label and its actions in one row. Each action is a full-size
/// tap target, so a phone holds only a few; the ones that do not fit go into a
/// "more" menu rather than running off the edge, and with room (a tablet) every
/// action stays in the row.
class _VerseHeader extends StatelessWidget {
  const _VerseHeader({
    required this.label,
    required this.play,
    required this.actions,
  });

  final String label;
  final _Action? play;
  final List<_Action> actions;

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    return LayoutBuilder(
      builder: (context, box) {
        final slots =
            ((box.maxWidth - AppSizes.verseLabelMin) / kMinInteractiveDimension)
                .floor() -
            (play == null ? 0 : 1);
        final inline = actions.length <= slots
            ? actions
            : actions.take(math.max(slots - 1, 0)).toList();
        final more = actions.skip(inline.length).toList();

        return Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            if (play != null) _ActionIcon(action: play!),
            Expanded(
              child: Text(
                label,
                maxLines: 1,
                softWrap: false,
                overflow: TextOverflow.ellipsis,
                style: AppTypography.eyebrow(
                  context,
                  color: context.colors.primary,
                ),
              ),
            ),
            for (final action in inline) _ActionIcon(action: action),
            if (more.isNotEmpty)
              PopupMenuButton<_Action>(
                tooltip: text.reelMore,
                icon: const Icon(Icons.more_vert_rounded, size: AppSizes.iconSm),
                iconColor: context.colors.onSurfaceVariant,
                onSelected: (action) => action.onPressed(),
                itemBuilder: (context) => [
                  for (final action in more)
                    PopupMenuItem(
                      value: action,
                      child: Row(
                        children: [
                          action.glyph,
                          const SizedBox(width: AppSpacing.sm),
                          Flexible(child: Text(action.tooltip)),
                        ],
                      ),
                    ),
                ],
              ),
          ],
        );
      },
    );
  }
}

class _ActionIcon extends StatelessWidget {
  const _ActionIcon({required this.action});

  final _Action action;

  @override
  Widget build(BuildContext context) {
    return Badge(
      isLabelVisible: action.badgeCount > 0,
      label: Text('${action.badgeCount}'),
      child: IconButton(
        icon: action.glyph,
        tooltip: action.tooltip,
        onPressed: action.onPressed,
        color: context.colors.onSurfaceVariant,
      ),
    );
  }
}

/// A collapsible purport or explanation — long text that would otherwise push
/// the next verse well down the screen before anyone has decided to read it.
/// Shut again every time the verse is built; only the word meanings are remembered.
class _Commentary extends StatefulWidget {
  const _Commentary({
    required this.label,
    required this.text,
    required this.scale,
  });

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
    return CollapsibleSection(
      label: widget.label,
      expanded: _expanded,
      onToggle: () => setState(() => _expanded = !_expanded),
      child: Text(
        widget.text,
        style: TextStyle(
          fontSize: (context.texts.bodyMedium?.fontSize ?? 14) * widget.scale,
          height: context.texts.bodyMedium?.height,
          color: context.texts.bodyMedium?.color,
        ),
      ),
    );
  }
}
