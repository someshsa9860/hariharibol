import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';

/// Sakha's icon, drawn from `assets/sakha_icon.svg` in its own colours in both
/// themes — the same arrangement as [PeacockFeatherIcon]. It is the one place
/// the mark is drawn, so a new icon is a new file and nothing else.
///
/// Decorative; whatever holds it carries the label.
class SakhaIcon extends StatelessWidget {
  const SakhaIcon({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SvgPicture.asset(AppAssets.sakhaIcon, width: size, height: size),
    );
  }
}
