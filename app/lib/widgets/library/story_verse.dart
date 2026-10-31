import 'package:flutter/material.dart';

import '../../core/constants/verse_text_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';
import '../../models/reading_mode.dart';
import '../../models/verse.dart';
import 'sanskrit_text.dart';

/// What story mode shows for [verse]: the one [part] the reader chose, or null
/// when the verse has none of it, in which case the verse is simply left out.
///
/// [translation] is the rendering picked under "Compare translations", if any.
/// The meaning is given plainly, without the quotation marks the verse-by-verse
/// layout puts round it: in running text they would only interrupt.
String? storyTextOf(
  Verse verse,
  StoryPart part, {
  VerseTranslation? translation,
}) {
  final rendering = translation ?? verse.translation;
  final text = switch (part) {
    StoryPart.sanskrit => verse.sanskrit,
    StoryPart.transliteration => verse.transliteration,
    StoryPart.translation => rendering?.meaning,
    StoryPart.purport =>
      (rendering?.hasPurport ?? false)
          ? rendering!.purport
          : verse.explanation?.text,
  }?.trim();
  return text == null || text.isEmpty ? null : text;
}

/// The room after item [index] of a story's list (item 0 is the heading, the
/// last of the [count] verses is followed by the chapter's navigation): none
/// between verses, so the chapter runs on.
double storyGapAfter(int index, int count) => index == 0
    ? AppSpacing.md
    : index == count
    ? AppSpacing.xl
    : 0;

/// One verse of a chapter read as a story: the chosen part, a small verse
/// number in front, and almost nothing between it and the next verse, so the
/// chapter reads as one flowing text.
///
/// A tap ([onTap]) opens the verse in full, in the verse-by-verse layout, and
/// every action that layout has sits behind a press and hold ([onLongPress]),
/// so the page stays quiet while it is being read.
class StoryVerse extends StatelessWidget {
  const StoryVerse({
    super.key,
    required this.verse,
    required this.part,
    required this.fontScale,
    required this.showNumber,
    required this.isFavorite,
    required this.isHighlighted,
    required this.playing,
    this.translation,
    this.onTap,
    this.onLongPress,
  });

  final Verse verse;
  final StoryPart part;
  final double fontScale;
  final bool showNumber;
  final bool isFavorite;
  final bool isHighlighted;
  final bool playing;
  final VerseTranslation? translation;
  final VoidCallback? onTap;
  final VoidCallback? onLongPress;

  TextStyle _style(BuildContext context) => switch (part) {
    StoryPart.sanskrit => AppTypography.verse(context, scale: fontScale),
    StoryPart.transliteration => AppTypography.transliteration(
      context,
      scale: fontScale,
    ),
    StoryPart.translation || StoryPart.purport => _prose(context),
  };

  /// Running text: a little larger and looser than the body, and in the full
  /// text colour, because a page of it is read for minutes at a time.
  TextStyle _prose(BuildContext context) {
    final base = context.texts.bodyLarge!;
    return base.copyWith(
      fontSize: (base.fontSize ?? 16) * fontScale * 1.06,
      height: 1.75,
      color: context.colors.onSurface,
    );
  }

  /// Lines of verse — the Sanskrit and its transliteration — keep their number
  /// in a column of its own, so every line of the verse starts at the same edge
  /// and the verses are told apart by a clear gap. Running text (meaning,
  /// purport) keeps the number in front of its first words.
  bool get _isVerseForm => part == StoryPart.sanskrit || part == StoryPart.transliteration;

  Widget _bookmark(Color color) => Icon(Icons.bookmark_rounded, size: AppSizes.iconSm, color: color);

  Widget _text(TextStyle style, String body, List<InlineSpan> leading) => part == StoryPart.sanskrit
      ? SanskritText(body, scale: fontScale, leading: leading)
      : Text.rich(TextSpan(children: [...leading, TextSpan(text: body)], style: style));

  /// [text] beside its number: the number, and the bookmark under it, in a
  /// column of the same width for every verse; their first baseline is the
  /// text's first baseline.
  Widget _numbered(BuildContext context, int number, TextStyle numberStyle, Widget text) {
    final gutter = MediaQuery.textScalerOf(context).scale(VerseTextConfig.numberGutter * fontScale);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        SizedBox(
          width: gutter,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('$number', style: numberStyle),
              if (isFavorite)
                Padding(
                  padding: const EdgeInsets.only(top: AppSpacing.xxs),
                  child: _bookmark(context.colors.primary),
                ),
            ],
          ),
        ),
        Expanded(child: text),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final body = storyTextOf(verse, part, translation: translation);
    if (body == null) return const SizedBox.shrink();

    final style = _style(context);
    final number = verse.verseNumber;
    final primary = context.colors.primary;
    final numberStyle = style.copyWith(
      fontSize: (style.fontSize ?? 16) * 0.68,
      fontWeight: FontWeight.w700,
      height: 1,
      letterSpacing: 0.4,
      color: primary,
    );

    final Widget content;
    if (_isVerseForm && showNumber && number != null) {
      content = _numbered(context, number, numberStyle, _text(style, body, const []));
    } else {
      content = _text(style, body, [
        if (showNumber && number != null) TextSpan(text: '$number ', style: numberStyle),
        if (isFavorite)
          WidgetSpan(
            alignment: PlaceholderAlignment.middle,
            child: Padding(
              padding: const EdgeInsets.only(right: AppSpacing.xs),
              child: _bookmark(primary),
            ),
          ),
      ]);
    }

    return Material(
      color: isHighlighted
          ? context.colors.primaryContainer
          : Colors.transparent,
      shape: RoundedRectangleBorder(
        borderRadius: AppRadius.smAll,
        // The verse being read aloud is outlined; the filled bookmark in front of
        // a saved verse says the same as colour would, in a shape.
        side: playing
            ? BorderSide(color: primary, width: 1.5)
            : BorderSide.none,
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onTap,
        onLongPress: onLongPress,
        child: Padding(
          padding: EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: _isVerseForm ? AppSpacing.sm : AppSpacing.xs,
          ),
          child: SizedBox(width: double.infinity, child: content),
        ),
      ),
    );
  }
}
