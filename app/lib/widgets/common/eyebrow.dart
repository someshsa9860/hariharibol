import 'package:flutter/material.dart';

import '../../core/theme/app_typography.dart';

/// The small letterspaced caps that name a block — "VERSE OF THE DAY".
///
/// It uppercases its own text so callers pass ordinary sentence case and
/// translations do not have to be written shouting. Turkish and a few other
/// locales case differently, so the app's own locale does the mapping rather
/// than the device's.
class Eyebrow extends StatelessWidget {
  const Eyebrow(this.text, {super.key, this.color, this.align});

  final String text;
  final Color? color;
  final TextAlign? align;

  @override
  Widget build(BuildContext context) {
    return Text(
      text.toUpperCase(),
      textAlign: align,
      style: AppTypography.eyebrow(context, color: color),
    );
  }
}
