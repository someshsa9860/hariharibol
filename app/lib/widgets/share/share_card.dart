import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';

/// How a share card looks. The preview on the studio screen and the exported picture are both drawn from one of
/// these by [ShareCard], so what is seen is what is saved.
@immutable
class ShareDesign {
  const ShareDesign({
    this.format = ShareFormat.square,
    this.gradient = 0,
    this.solid,
    this.background,
    this.darken = 0.12,
    this.lightText = true,
    this.textScale = 1,
    this.align = TextAlign.center,
    this.showMeaning = true,
    this.showReference = true,
  });

  final ShareFormat format;

  /// Index into [AppColors.shareGradients] — used when there is no [solid] and no [background].
  final int gradient;
  final Color? solid;

  /// A picture (the reader's own, or an AI background) laid over the whole card.
  final ImageProvider? background;
  final double darken;
  final bool lightText;
  final double textScale;
  final TextAlign align;
  final bool showMeaning;
  final bool showReference;

  ShareDesign copyWith({
    ShareFormat? format,
    int? gradient,
    Color? solid,
    ImageProvider? background,
    bool clearBackground = false,
    bool clearSolid = false,
    double? darken,
    bool? lightText,
    double? textScale,
    TextAlign? align,
    bool? showMeaning,
    bool? showReference,
  }) =>
      ShareDesign(
        format: format ?? this.format,
        gradient: gradient ?? this.gradient,
        solid: clearSolid ? null : (solid ?? this.solid),
        background: clearBackground ? null : (background ?? this.background),
        darken: darken ?? this.darken,
        lightText: lightText ?? this.lightText,
        textScale: textScale ?? this.textScale,
        align: align ?? this.align,
        showMeaning: showMeaning ?? this.showMeaning,
        showReference: showReference ?? this.showReference,
      );
}

enum ShareFormat {
  square(1, 1),
  portrait(4, 5),
  story(9, 16);

  const ShareFormat(this.w, this.h);

  final double w;
  final double h;

  double get ratio => w / h;
}

/// The card itself. Drawn at 360 logical pixels wide; the studio captures it at 3× for a 1080-pixel picture. The
/// text is scaled down to fit (never cut), and sits below the logo, which is always top-left and never covered.
class ShareCard extends StatelessWidget {
  const ShareCard({
    super.key,
    required this.design,
    required this.main,
    this.meaning,
    this.reference,
    this.mainFont,
  });

  static const double width = 360;

  final ShareDesign design;
  final String main;
  final String? meaning;
  final String? reference;
  final String? mainFont;

  @override
  Widget build(BuildContext context) {
    final height = width / design.format.ratio;
    final ink = design.lightText ? AppColors.white : AppColors.ink;
    final style = DefaultTextStyle.of(context).style;

    return SizedBox(
      width: width,
      height: height,
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (design.background != null)
            Image(image: design.background!, fit: BoxFit.cover)
          else if (design.solid != null)
            ColoredBox(color: design.solid!)
          else
            DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: AppColors.shareGradients[design.gradient % AppColors.shareGradients.length],
                ),
              ),
            ),
          if (design.darken > 0) ColoredBox(color: AppColors.black.withValues(alpha: design.darken)),
          Padding(
            // Room for the logo above the text: the text never sits behind it.
            padding: const EdgeInsets.fromLTRB(28, 92, 28, 28),
            child: Center(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: SizedBox(
                  width: width - 56,
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: switch (design.align) {
                      TextAlign.left || TextAlign.start => CrossAxisAlignment.start,
                      TextAlign.right || TextAlign.end => CrossAxisAlignment.end,
                      _ => CrossAxisAlignment.center,
                    },
                    children: [
                      Text(
                        main,
                        textAlign: design.align,
                        style: style.copyWith(
                          color: ink,
                          fontSize: 24 * design.textScale,
                          height: 1.5,
                          fontWeight: FontWeight.w500,
                          fontFamily: mainFont,
                        ),
                      ),
                      if (design.showMeaning && (meaning ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 16),
                        Text(
                          meaning!.trim(),
                          textAlign: design.align,
                          style: style.copyWith(color: ink.withValues(alpha: 0.95), fontSize: 13 * design.textScale, height: 1.5),
                        ),
                      ],
                      if (design.showReference && (reference ?? '').trim().isNotEmpty) ...[
                        const SizedBox(height: 14),
                        Text(
                          '— ${reference!.trim()}',
                          textAlign: design.align,
                          style: style.copyWith(color: ink.withValues(alpha: 0.8), fontSize: 11 * design.textScale, fontWeight: FontWeight.w600),
                        ),
                      ],
                    ],
                  ),
                ),
              ),
            ),
          ),
          // The official logo, transparent, top-left, aspect kept.
          const Positioned(
            left: 20,
            top: 20,
            child: Image(image: AssetImage('assets/hariharibol_trprt.png'), height: 56, fit: BoxFit.contain),
          ),
        ],
      ),
    );
  }
}
