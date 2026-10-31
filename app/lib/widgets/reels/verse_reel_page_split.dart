import 'package:flutter/painting.dart';

/// What a page of a book reel holds.
enum VersePageKind { verse, meaning, purport }

class VersePage {
  const VersePage(this.kind, {this.sanskrit, this.transliteration, this.text, this.part = 0, this.parts = 1});

  final VersePageKind kind;
  final String? sanskrit;
  final String? transliteration;
  final String? text;

  /// For a purport split over several pages: which one this is, of how many.
  final int part;
  final int parts;

  int get wordCount => '${sanskrit ?? ''} ${transliteration ?? ''} ${text ?? ''}'
      .split(RegExp(r'\s+'))
      .where((word) => word.isNotEmpty)
      .length;
}

/// Splits a purport into pieces that each fit [maxHeight] at [width] in [style].
///
/// Measured with the real text style rather than guessed from a character
/// count, because a Devanagari or Tamil purport sets far taller than the same
/// number of Latin letters. A piece is cut at the end of a sentence when one
/// falls in the last third of what fits, so a page does not stop mid-thought
/// when it can stop at a full stop.
List<String> splitPurport(
  String text, {
  required TextStyle style,
  required double width,
  required double maxHeight,
  required TextDirection direction,
  required TextScaler scaler,
}) {
  final words = text.split(RegExp(r'\s+')).where((word) => word.isNotEmpty).toList();
  if (words.isEmpty) return const [];

  bool fits(int from, int count) {
    final painter = TextPainter(
      text: TextSpan(text: words.sublist(from, from + count).join(' '), style: style),
      textDirection: direction,
      textScaler: scaler,
    )..layout(maxWidth: width);
    final height = painter.height;
    painter.dispose();
    return height <= maxHeight;
  }

  final sentenceEnd = RegExp(r'[.!?।॥”’"]$');
  final pieces = <String>[];
  var from = 0;
  while (from < words.length) {
    var low = 1;
    var high = words.length - from;
    // Largest count that fits; at least one word, so a tiny screen still ends.
    while (low < high) {
      final mid = (low + high + 1) ~/ 2;
      if (fits(from, mid)) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    var count = low;
    if (from + count < words.length) {
      final earliest = (count * 2 / 3).floor();
      for (var i = count; i > earliest; i--) {
        if (sentenceEnd.hasMatch(words[from + i - 1])) {
          count = i;
          break;
        }
      }
    }
    pieces.add(words.sublist(from, from + count).join(' '));
    from += count;
  }
  return pieces;
}
