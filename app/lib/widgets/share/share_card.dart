import 'package:flutter/material.dart';

import 'share_target.dart';

enum ShareRatio {
  square(1, 1),
  portrait(4, 5),
  story(9, 16);

  const ShareRatio(this.w, this.h);
  final int w;
  final int h;
  double get aspect => w / h;
  String get label => '$w:$h';
}

class ShareTheme {
  const ShareTheme(this.colors, this.text);
  final List<Color> colors;
  final Color text;
}

/// A few backgrounds that suit devotional text, from warm to quiet to dark.
const List<ShareTheme> shareThemes = [
  ShareTheme([Color(0xFFFFD9A0), Color(0xFFF59E4B), Color(0xFFC2410C)], Color(0xFF2B1407)),
  ShareTheme([Color(0xFFF6A23C), Color(0xFFE0782D)], Color(0xFF2A1608)),
  ShareTheme([Color(0xFFFDE7EF), Color(0xFFF4B6C8), Color(0xFFC96A8F)], Color(0xFF3B1626)),
  ShareTheme([Color(0xFF3A1D12), Color(0xFF8A3B17), Color(0xFFE6A54A)], Color(0xFFFFF4DE)),
  ShareTheme([Color(0xFFFFFDF9)], Color(0xFF2A2420)),
  ShareTheme([Color(0xFFFBF6EE), Color(0xFFF1E4CF)], Color(0xFF2A2420)),
  ShareTheme([Color(0xFF12121C), Color(0xFF262648)], Color(0xFFF5EFE3)),
  ShareTheme([Color(0xFF0F2A22), Color(0xFF1F5C47), Color(0xFF7BB38F)], Color(0xFFF0F8F1)),
  ShareTheme([Color(0xFFFFCF4A), Color(0xFFFF8A2B), Color(0xFFD6336C)], Color(0xFF2A0F14)),
];

/// The card that is shared. The picture that leaves the app is this widget
/// rendered at a higher pixel ratio, so the preview and the export are the
/// same drawing. It is laid out for a fixed 360-point width; the studio scales
/// the preview, and the export raises the pixel ratio instead.
///
/// Text is never cut: the block sits in a [FittedBox] that shrinks it until it
/// fits, and the HariHariBol mark is a fixed element at the top left that the
/// text cannot reach.
class ShareCard extends StatelessWidget {
  const ShareCard({
    super.key,
    required this.target,
    required this.ratio,
    required this.theme,
    required this.showMeaning,
    required this.showTransliteration,
    required this.textScale,
    this.picture,
  });

  static const double width = 360;

  final ShareTarget target;
  final ShareRatio ratio;
  final ShareTheme theme;
  final bool showMeaning;
  final bool showTransliteration;
  final double textScale;

  /// A chosen or generated background. Drawn to cover the card, with a dark wash so text stays readable.
  final ImageProvider? picture;

  @override
  Widget build(BuildContext context) {
    final height = width / ratio.aspect;
    final onPicture = picture != null;
    final color = onPicture ? Colors.white : theme.text;
    final sanskrit = target.sanskrit?.trim() ?? '';
    final translit = target.transliteration?.trim() ?? '';
    final meaning = target.meaning?.trim() ?? '';

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: SizedBox(
        width: width,
        height: height,
        child: Stack(
          fit: StackFit.expand,
          children: [
            DecoratedBox(
              decoration: BoxDecoration(
                color: theme.colors.first,
                gradient: theme.colors.length > 1
                    ? LinearGradient(
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                        colors: theme.colors,
                      )
                    : null,
                image: onPicture ? DecorationImage(image: picture!, fit: BoxFit.cover) : null,
              ),
            ),
            if (onPicture) const ColoredBox(color: Color(0x66000000)),
            Positioned(
              left: 28,
              top: 28,
              child: Container(
                padding: const EdgeInsets.all(4),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.88),
                  borderRadius: BorderRadius.circular(12),
                ),
                // The official mark, transparent, at its own aspect ratio.
                child: Image.asset('assets/hariharibol_trprt.png', height: 34, fit: BoxFit.contain),
              ),
            ),
            Positioned(
              left: 28,
              right: 28,
              top: 96,
              bottom: 52,
              child: Center(
                child: FittedBox(
                  fit: BoxFit.scaleDown,
                  child: SizedBox(
                    width: width - 56,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (sanskrit.isNotEmpty)
                          Text(
                            sanskrit,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: color, fontSize: 22 * textScale, height: 1.6, fontWeight: FontWeight.w500),
                          ),
                        if (showTransliteration && translit.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            translit,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: color.withValues(alpha: 0.82), fontSize: 13 * textScale, height: 1.5, fontStyle: FontStyle.italic),
                          ),
                        ],
                        if (showMeaning && meaning.isNotEmpty) ...[
                          const SizedBox(height: 14),
                          Text(
                            meaning,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: color.withValues(alpha: 0.95), fontSize: 15 * textScale, height: 1.55),
                          ),
                        ],
                        if ((target.reference ?? '').isNotEmpty) ...[
                          const SizedBox(height: 16),
                          Text(
                            target.reference!,
                            textAlign: TextAlign.center,
                            style: TextStyle(color: color.withValues(alpha: 0.8), fontSize: 12 * textScale, fontWeight: FontWeight.w700, letterSpacing: 0.6),
                          ),
                        ],
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Positioned(
              left: 0,
              right: 0,
              bottom: 20,
              child: Text(
                'hariharibol.com',
                textAlign: TextAlign.center,
                style: TextStyle(color: color.withValues(alpha: 0.7), fontSize: 11, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
