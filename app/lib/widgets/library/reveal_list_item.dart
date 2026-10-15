import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';

/// The most pages [revealListItem] will walk before giving up.
const int _maxSteps = 40;

/// How many times it re-checks where the item came to rest.
const int _maxSettles = 3;

/// Scrolls a list until one of its items is on screen, even when the list has
/// not built that item yet.
///
/// A `ListView` builds only what is near the viewport, so an item far down has
/// no widget, and `Scrollable.ensureVisible` needs the item's own context. This
/// walks toward it: each step moves by the number of items between the target
/// and the nearest one that *is* built, at the list's average item height so far
/// (which gets truer as more are laid out), and then looks again. Once the item
/// exists, `ensureVisible` brings it to rest.
///
/// Two things about a lazy list shape the details. The list's length is only an
/// estimate until the end has been laid out, so a jump toward the end can land
/// past the real end, where nothing the caller can see is built — that is
/// pulled back to the real end and the walk goes on. And the offset an item
/// sits at moves while the items above it are measured, so after the scroll
/// the item's place is checked again and corrected.
///
/// [contextAt] gives the context of the item at an index, or null while it is
/// not built (a `GlobalKey`'s `currentContext`). [index] and [itemCount] count
/// every item of the list, the ones before and after the verses too.
///
/// Returns whether the item was brought into view.
Future<bool> revealListItem({
  required int index,
  required int itemCount,
  required BuildContext? Function(int index) contextAt,
  required Duration duration,
  required Curve curve,
  required double alignment,
}) async {
  // The list's scroll position, kept from the first step that sees it, so a
  // step with nothing built can still move.
  ScrollPosition? position;

  for (var step = 0; step < _maxSteps; step++) {
    final target = contextAt(index);
    if (target != null && target.mounted) {
      await _bringToRest(target, duration: duration, curve: curve, alignment: alignment);
      return true;
    }

    final nearest = _nearestBuilt(index, itemCount, contextAt);
    if (nearest != null) {
      position = Scrollable.maybeOf(nearest.context)?.position ?? position;
    }
    if (position == null || !position.hasContentDimensions) return false;

    if (nearest == null) {
      // A jump landed past the end, so only the unkeyed end of the list is
      // built. Back to the real end; the next look finds the last items.
      final end = position.pixels.clamp(position.minScrollExtent, position.maxScrollExtent);
      if ((end - position.pixels).abs() < 1) return false;
      position.jumpTo(end);
      await WidgetsBinding.instance.endOfFrame;
      continue;
    }

    // How far the target is, in items, times what an item has measured so far.
    final average = (position.maxScrollExtent + position.viewportDimension) / itemCount;
    final distance = (index - nearest.index) * average;
    // At least half a page, so a short guess still gets somewhere.
    final move = distance.abs() < position.viewportDimension / 2
        ? position.viewportDimension / 2 * (distance < 0 ? -1 : 1)
        : distance;
    final next = (position.pixels + move).clamp(position.minScrollExtent, position.maxScrollExtent);
    // Already at the end of the list and the item is still not there.
    if ((next - position.pixels).abs() < 1) return false;

    position.jumpTo(next);
    await WidgetsBinding.instance.endOfFrame;
  }
  return false;
}

/// Scrolls [target] into place, then makes sure it stayed there.
///
/// Items above it that were estimated when the scroll began get measured on the
/// way, which moves where the item is by the time the animation ends. Asking the
/// viewport where it now wants to be, and going there again, takes that out.
Future<void> _bringToRest(
  BuildContext target, {
  required Duration duration,
  required Curve curve,
  required double alignment,
}) async {
  alignment = _alignmentFor(target, alignment);
  await Scrollable.ensureVisible(target, duration: duration, curve: curve, alignment: alignment);

  for (var attempt = 0; attempt < _maxSettles; attempt++) {
    await WidgetsBinding.instance.endOfFrame;
    if (!target.mounted) return;

    final position = Scrollable.maybeOf(target)?.position;
    final box = target.findRenderObject();
    if (position == null || box == null || !position.hasContentDimensions) return;
    final viewport = RenderAbstractViewport.maybeOf(box);
    if (viewport == null) return;

    final wanted = viewport
        .getOffsetToReveal(box, alignment)
        .offset
        .clamp(position.minScrollExtent, position.maxScrollExtent);
    if ((wanted - position.pixels).abs() < 1) return;
    await Scrollable.ensureVisible(target, alignment: alignment);
  }
}

/// The alignment to scroll [target] to.
///
/// `ensureVisible` places an item at `alignment × (viewport − item)` from the
/// top, so an item taller than the viewport (a long purport) with 0.1 lands
/// *above* the top and its first lines are cut off. A tall item is aligned by its
/// top edge instead, which is where reading it begins.
double _alignmentFor(BuildContext target, double alignment) {
  final box = target.findRenderObject();
  final position = Scrollable.maybeOf(target)?.position;
  if (box is! RenderBox || !box.hasSize || position == null || !position.hasViewportDimension) {
    return alignment;
  }
  return box.size.height > position.viewportDimension ? 0 : alignment;
}

/// The built item closest to [index], looking outward from it.
({int index, BuildContext context})? _nearestBuilt(
  int index,
  int itemCount,
  BuildContext? Function(int index) contextAt,
) {
  for (var distance = 1; distance < itemCount; distance++) {
    for (final candidate in [index - distance, index + distance]) {
      if (candidate < 0 || candidate >= itemCount) continue;
      final context = contextAt(candidate);
      if (context != null && context.mounted) return (index: candidate, context: context);
    }
  }
  return null;
}
