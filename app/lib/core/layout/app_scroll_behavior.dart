import 'dart:ui' show PointerDeviceKind;

import 'package:flutter/material.dart';

import 'adaptive.dart';

/// Scrolling that suits a mouse and a remote as well as a finger.
///
/// A mouse and a trackpad drag lists and carousels (Flutter lets only touch do
/// that by default, which leaves a desktop window feeling stuck), and a desktop
/// window gets a scroll bar to grab.
class AppScrollBehavior extends MaterialScrollBehavior {
  const AppScrollBehavior();

  @override
  Set<PointerDeviceKind> get dragDevices => {
    PointerDeviceKind.touch,
    PointerDeviceKind.mouse,
    PointerDeviceKind.trackpad,
    PointerDeviceKind.stylus,
    PointerDeviceKind.invertedStylus,
  };

  @override
  Widget buildScrollbar(BuildContext context, Widget child, ScrollableDetails details) {
    if (!AdaptiveLayout.isDesktop) return child;
    return super.buildScrollbar(context, child, details);
  }
}
