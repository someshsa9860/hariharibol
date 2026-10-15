import 'package:flutter/material.dart';
import 'package:flutter_svg/flutter_svg.dart';

import '../../core/constants/app_assets.dart';

/// A peacock feather in its natural colours: a bronze quill, an emerald-to-gold
/// plume with fine barbs, and the iconic eye (gold, teal, royal blue, midnight).
///
/// Drawn from `assets/peacock_feather.svg`, so it stays sharp at any size and
/// keeps its own colours in both themes. Decorative; the control it sits in
/// carries the label.
class PeacockFeatherIcon extends StatelessWidget {
  const PeacockFeatherIcon({super.key, required this.size});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ExcludeSemantics(
      child: SvgPicture.asset(
        AppAssets.peacockFeather,
        width: size,
        height: size,
      ),
    );
  }
}
