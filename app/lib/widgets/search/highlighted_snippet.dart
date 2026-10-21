import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

/// A passage from a search result, with the words that matched picked out.
///
/// The server marks them with `[brackets]` (the same convention the offline
/// search uses); they are shown bold in the primary colour on a soft wash, and
/// the brackets themselves are not.
class HighlightedSnippet extends StatelessWidget {
  const HighlightedSnippet({super.key, required this.snippet, this.maxLines = 3, this.style});

  final String snippet;
  final int maxLines;
  final TextStyle? style;

  static final RegExp _marked = RegExp(r'\[([^\]]+)\]');

  /// The passage cut into pieces: plain text and matched words, in order.
  static List<({String text, bool matched})> split(String snippet) {
    final pieces = <({String text, bool matched})>[];
    var at = 0;
    for (final match in _marked.allMatches(snippet)) {
      if (match.start > at) pieces.add((text: snippet.substring(at, match.start), matched: false));
      pieces.add((text: match.group(1)!, matched: true));
      at = match.end;
    }
    if (at < snippet.length) pieces.add((text: snippet.substring(at), matched: false));
    return pieces;
  }

  @override
  Widget build(BuildContext context) {
    final base = style ?? context.texts.bodyMedium!;
    final accent = context.colors.primary;

    return Text.rich(
      TextSpan(
        style: base,
        children: [
          for (final piece in split(snippet))
            TextSpan(
              text: piece.text,
              style: piece.matched
                  ? TextStyle(
                      fontWeight: FontWeight.w700,
                      color: accent,
                      backgroundColor: accent.withValues(alpha: 0.12),
                    )
                  : null,
            ),
        ],
      ),
      maxLines: maxLines,
      overflow: TextOverflow.ellipsis,
    );
  }
}
