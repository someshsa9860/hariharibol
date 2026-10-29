import 'package:flutter/material.dart';

import '../../core/constants/verse_text_config.dart';
import '../../core/format/sanskrit_text.dart';
import '../../core/theme/app_theme.dart';
import '../../core/theme/app_typography.dart';

/// A verse's Sanskrit, set the way it is printed: dandas for the bars it was
/// stored with, and the line that says who speaks ("अर्जुन उवाच") smaller and
/// quieter above the verse so it reads as an introduction, not as a line of it.
///
/// [leading] goes in front of the first line, in the verse's own text run (a
/// bookmark, where the verse has no gutter of its own for it).
class SanskritText extends StatelessWidget {
  const SanskritText(
    this.text, {
    super.key,
    this.scale = 1.0,
    this.leading = const [],
  });

  final String text;
  final double scale;
  final List<InlineSpan> leading;

  @override
  Widget build(BuildContext context) {
    final style = AppTypography.verse(context, scale: scale);
    final (:speaker, :verse) = splitSpeaker(tidySanskrit(text));

    return Text.rich(
      TextSpan(
        style: style,
        children: [
          ...leading,
          if (speaker != null)
            TextSpan(
              text: '$speaker\n',
              style: style.copyWith(
                fontSize: (style.fontSize ?? 16) * VerseTextConfig.speakerScale,
                fontWeight: FontWeight.w400,
                color: context.colors.onSurfaceVariant,
              ),
            ),
          TextSpan(text: verse),
        ],
      ),
    );
  }
}
