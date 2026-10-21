import 'dart:ui' show DisplayFeature, DisplayFeatureState, DisplayFeatureType;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

/// How much room the window has, on Material's width classes. A window, not a
/// device: a phone in landscape, a tablet in split screen, a folded or unfolded
/// foldable and a resized desktop window all land here by their width alone.
enum WindowSize {
  /// Phones upright and a folded foldable. The bottom bar.
  compact,

  /// Large phones in landscape, small tablets, a half-open foldable. A rail.
  medium,

  /// Tablets, an unfolded foldable, a small desktop window. A rail with words.
  expanded,

  /// Desktop windows and TVs. The same, with wider content and more columns.
  large;

  static const double mediumFrom = 600;
  static const double expandedFrom = 840;
  static const double largeFrom = 1200;

  static WindowSize of(double width) {
    if (width >= largeFrom) return large;
    if (width >= expandedFrom) return expanded;
    if (width >= mediumFrom) return medium;
    return compact;
  }

  bool get isCompact => this == compact;
  bool get usesRail => this != compact;
  bool get isWide => index >= expanded.index;
}

/// What the window looks like right now: its class, and where a fold or hinge
/// cuts it.
///
/// Read with [AdaptiveLayout.of]. It depends only on `MediaQuery`, so a window
/// resized, a device rotated or a foldable opened rebuilds whoever asked.
@immutable
class AdaptiveLayout {
  const AdaptiveLayout({
    required this.size,
    required this.width,
    required this.height,
    this.hinge,
    this.halfOpen = false,
    this.isTv = false,
  });

  final WindowSize size;
  final double width;
  final double height;

  /// The hinge or fold, in the window's own coordinates, when one cuts the
  /// window in two. Null on every device that does not fold.
  final Rect? hinge;

  /// A foldable standing half open, like a laptop (the system calls it a
  /// posture). Content that wants a floor goes below the hinge.
  final bool halfOpen;

  /// An Android TV or another set driven by a remote. Everything must be
  /// reachable with arrow keys and Select.
  final bool isTv;

  bool get hasVerticalHinge => hinge != null && hinge!.height >= hinge!.width;
  bool get hasHorizontalHinge => hinge != null && hinge!.width > hinge!.height;

  /// Whether the window is split into two screens side by side, either by a
  /// hinge or by being wide enough to put two panes on one.
  bool get canSplit => hasVerticalHinge || size.isWide;

  /// A TV set is read from the sofa: everything scales up a little.
  double get textScaleFloor => isTv ? 1.15 : 1.0;

  /// The width of the page's gutters: tight on a phone, roomy on a desktop.
  double get gutter => switch (size) {
    WindowSize.compact => 16,
    WindowSize.medium => 24,
    WindowSize.expanded => 32,
    WindowSize.large => 40,
  };

  static AdaptiveLayout of(BuildContext context) {
    final media = MediaQuery.of(context);
    final width = media.size.width;
    final features = media.displayFeatures;

    Rect? hinge;
    var halfOpen = false;
    for (final DisplayFeature f in features) {
      final isFold = f.type == DisplayFeatureType.hinge || f.type == DisplayFeatureType.fold;
      if (!isFold) continue;
      // A fold that is hidden or only a flat seam in a closed screen cuts nothing.
      if (f.bounds.isEmpty) continue;
      hinge = f.bounds;
      if (f.state == DisplayFeatureState.postureHalfOpened) halfOpen = true;
      break;
    }

    return AdaptiveLayout(
      size: WindowSize.of(width),
      width: width,
      height: media.size.height,
      hinge: hinge,
      halfOpen: halfOpen,
      isTv: _tv,
    );
  }

  /// Set once at launch from the platform (see `main.dart`).
  static bool _tv = false;
  static void markAsTv(bool value) => _tv = value;

  /// Whether the app is running somewhere with a pointer and a keyboard (a
  /// desktop window), where hover states and scroll bars earn their place.
  static bool get isDesktop =>
      !kIsWeb &&
      (defaultTargetPlatform == TargetPlatform.macOS ||
          defaultTargetPlatform == TargetPlatform.windows ||
          defaultTargetPlatform == TargetPlatform.linux);
}

/// The widest a screen's content grows before it is centred with margins.
abstract final class ContentWidths {
  /// Prose: a verse, a purport, a chat. Past this the eye loses its place.
  static const double reading = 720;

  /// Lists and forms.
  static const double regular = 880;

  /// Dashboards and grids.
  static const double wide = 1180;

  /// The reels feed keeps a phone's shape however big the window.
  static const double reel = 480;
}

/// Centres [child] in at most [maxWidth], painting the page colour on both
/// sides so a pushed screen does not leave the window black at its edges.
///
/// On a window narrower than [maxWidth] it is invisible, which is why it can
/// wrap every screen: phones are unchanged.
class ContentWidth extends StatelessWidget {
  const ContentWidth({
    super.key,
    required this.child,
    this.maxWidth = ContentWidths.regular,
    this.background,
  });

  final Widget child;
  final double maxWidth;

  /// The colour of the margins. The theme's page colour when null.
  final Color? background;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, box) {
        // Under the width, or folded: the hinge already says where the content
        // goes, and centring would put the middle of it on the fold.
        if (box.maxWidth <= maxWidth || AdaptiveLayout.of(context).hasVerticalHinge) {
          return child;
        }
        return ColoredBox(
          color: background ?? Theme.of(context).scaffoldBackgroundColor,
          child: Align(
            alignment: Alignment.topCenter,
            child: ConstrainedBox(
              constraints: BoxConstraints(maxWidth: maxWidth),
              child: child,
            ),
          ),
        );
      },
    );
  }
}

/// Two panes side by side, the way a foldable or a wide window wants them.
///
/// With a vertical hinge the panes are the two screens: the first ends where
/// the hinge begins and the second starts where it ends, so nothing is drawn
/// under the fold. Without one, they split by [firstFlex] : [secondFlex] with
/// [gap] between. [AdaptiveLayout.canSplit] says whether to use it at all;
/// otherwise show [first] alone.
class TwoPane extends StatelessWidget {
  const TwoPane({
    super.key,
    required this.first,
    required this.second,
    this.firstFlex = 4,
    this.secondFlex = 6,
    this.gap = 24,
    this.divider = true,
  });

  final Widget first;
  final Widget second;
  final int firstFlex;
  final int secondFlex;
  final double gap;
  final bool divider;

  @override
  Widget build(BuildContext context) {
    final layout = AdaptiveLayout.of(context);
    final hinge = layout.hinge;

    if (layout.hasVerticalHinge) {
      final left = hinge!.left;
      final right = layout.width - hinge.right;
      return Row(
        children: [
          SizedBox(width: left, child: first),
          SizedBox(width: hinge.width),
          SizedBox(width: right, child: second),
        ],
      );
    }

    return Row(
      children: [
        Expanded(flex: firstFlex, child: first),
        if (divider)
          VerticalDivider(width: gap, thickness: 1, color: Theme.of(context).colorScheme.outlineVariant)
        else
          SizedBox(width: gap),
        Expanded(flex: secondFlex, child: second),
      ],
    );
  }
}

/// Lays [children] out in [columns] columns, each child going to the shortest
/// column in turn. It is for a page of cards that is a list on a phone.
class CardColumns extends StatelessWidget {
  const CardColumns({
    super.key,
    required this.children,
    required this.columns,
    this.spacing = 16,
  });

  final List<Widget> children;
  final int columns;
  final double spacing;

  @override
  Widget build(BuildContext context) {
    if (columns <= 1) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) SizedBox(height: spacing),
            children[i],
          ],
        ],
      );
    }
    final lanes = List.generate(columns, (_) => <Widget>[]);
    for (var i = 0; i < children.length; i++) {
      lanes[i % columns].add(children[i]);
    }
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var c = 0; c < columns; c++) ...[
          if (c > 0) SizedBox(width: spacing),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < lanes[c].length; i++) ...[
                  if (i > 0) SizedBox(height: spacing),
                  lanes[c][i],
                ],
              ],
            ),
          ),
        ],
      ],
    );
  }
}
