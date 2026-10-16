/// Makes half-written markdown safe to draw.
///
/// A reply arrives a few characters at a time, so for most of its life the text
/// ends in the middle of something: a code fence not yet closed, a `**` waiting
/// for its partner. Drawn as is, the raw marks flash on screen and then snap
/// into bold or a code block when the closing half arrives — the flicker people
/// notice in a streaming chat.
///
/// This closes what is open, for display only. The stored text is never
/// changed, and once the reply is complete the real text is drawn.
///
///   * an unclosed ``` or ~~~ fence is closed on a new line;
///   * an unclosed `code`, `**bold`, `*italic*`, `__bold` or `_italic` in the
///     last paragraph is closed;
///   * a marker with nothing after it yet (`**` at the very end) is dropped;
///   * an image whose link is not finished is dropped, and a link is closed.
///
/// Marks that are not emphasis are left alone: `snake_case_name`, `2 * 3`, a
/// bullet's `* `, an escaped `\*`, and anything inside a code block.
String streamingSafeMarkdown(String text) {
  if (text.isEmpty) return text;

  final scan = _scanBlocks(text);
  if (scan.openFence != null) {
    // A fence with nothing in it yet would draw an empty box for a moment.
    if (scan.openLineEnd >= text.length) return text.substring(0, scan.openLineStart);
    // Inside a code block nothing is emphasis. Close it and stop.
    final needsBreak = text.endsWith('\n') ? '' : '\n';
    return '$text$needsBreak${scan.openFence}';
  }

  final head = text.substring(0, scan.paragraphStart);
  final tail = text.substring(scan.paragraphStart);
  return head + _closeInline(tail);
}

class _BlockScan {
  const _BlockScan({
    required this.openFence,
    required this.openLineStart,
    required this.openLineEnd,
    required this.paragraphStart,
  });

  /// The fence that would close the open code block, or null.
  final String? openFence;

  /// Where the line that opened it starts and ends.
  final int openLineStart;
  final int openLineEnd;

  /// Where the last paragraph starts — after the last blank line or code block.
  final int paragraphStart;
}

final RegExp _fenceLine = RegExp(r'^ {0,3}(`{3,}|~{3,})(.*)$');

_BlockScan _scanBlocks(String text) {
  String? open;
  var openLineStart = 0;
  var openLineEnd = 0;
  var paragraphStart = 0;
  var offset = 0;

  for (final line in text.split('\n')) {
    final next = offset + line.length + 1;
    final fence = _fenceLine.firstMatch(line.endsWith('\r') ? line.substring(0, line.length - 1) : line);

    if (open != null) {
      // A closing fence is the same mark, at least as long, with nothing after.
      if (fence != null && fence.group(1)!.startsWith(open[0]) && fence.group(1)!.length >= open.length && fence.group(2)!.trim().isEmpty) {
        open = null;
        paragraphStart = next;
      }
    } else if (fence != null && !(fence.group(1)!.startsWith('`') && fence.group(2)!.contains('`'))) {
      open = fence.group(1);
      openLineStart = offset;
      openLineEnd = offset + line.length;
      paragraphStart = next;
    } else if (line.trim().isEmpty) {
      paragraphStart = next;
    }
    offset = next;
  }

  return _BlockScan(
    openFence: open,
    openLineStart: openLineStart,
    openLineEnd: openLineEnd,
    paragraphStart: paragraphStart.clamp(0, text.length),
  );
}

class _Open {
  _Open(this.mark, this.size);

  final String mark;
  int size;
}

bool _isSpace(String? char) => char == null || char.trim().isEmpty;
bool _isWord(String? char) => char != null && RegExp(r'[\p{L}\p{N}]', unicode: true).hasMatch(char);

String _closeInline(String paragraph) {
  var text = paragraph;

  // An image whose address is still arriving would try to load half a URL.
  final unfinishedImage = RegExp(r'!\[[^\]]*\]?(\([^)\n]*)?$');
  text = text.replaceFirst(unfinishedImage, '');

  final stack = <_Open>[];
  var inCodeSize = 0;
  var codeRunStart = 0;
  var lastRunStart = -1;
  var lastRunEnd = -1;

  var i = 0;
  while (i < text.length) {
    final char = text[i];

    if (char == r'\') {
      i += 2;
      continue;
    }

    if (char == '`') {
      var j = i;
      while (j < text.length && text[j] == '`') {
        j++;
      }
      final size = j - i;
      if (inCodeSize == 0) {
        inCodeSize = size;
        codeRunStart = i;
      } else if (inCodeSize == size) {
        inCodeSize = 0;
      }
      i = j;
      continue;
    }

    if (inCodeSize == 0 && (char == '*' || char == '_')) {
      var j = i;
      while (j < text.length && text[j] == char) {
        j++;
      }
      final size = j - i;
      final before = i > 0 ? text[i - 1] : null;
      final after = j < text.length ? text[j] : null;

      // snake_case_name: an underscore between two word characters is a letter.
      final inWord = char == '_' && _isWord(before) && _isWord(after);
      if (!inWord) {
        final canClose = !_isSpace(before);
        final canOpen = !_isSpace(after);
        final index = stack.lastIndexWhere((open) => open.mark == char);

        if (canClose && index != -1) {
          final open = stack[index];
          if (size >= open.size) {
            stack.removeRange(index, stack.length);
          } else {
            open.size -= size;
          }
        } else if (canOpen) {
          stack.add(_Open(char, size > 3 ? 3 : size));
        } else if (after == null && _isSpace(before)) {
          // A marker alone at the end, with nothing after it yet.
          lastRunStart = i;
          lastRunEnd = j;
        }
      }
      i = j;
      continue;
    }

    i++;
  }

  // A code mark that opened at the very end has nothing in it yet.
  if (inCodeSize > 0 && codeRunStart + inCodeSize == text.length) {
    text = text.substring(0, codeRunStart);
    inCodeSize = 0;
    lastRunStart = -1;
  }

  if (lastRunStart != -1 && lastRunEnd == text.length) {
    text = text.substring(0, lastRunStart);
  }

  final closing = StringBuffer();
  if (inCodeSize > 0) closing.write('`' * inCodeSize);
  for (final open in stack.reversed) {
    closing.write(open.mark * open.size);
  }

  text = '$text$closing';

  // A link whose address is not finished yet: close the bracket pair.
  final unfinishedLink = RegExp(r'\]\([^)\s]*$');
  if (unfinishedLink.hasMatch(text)) text = '$text)';

  return text;
}
