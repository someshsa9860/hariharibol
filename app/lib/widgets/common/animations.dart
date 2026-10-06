import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';

/// A section that fades and rises into place when it first appears.
///
/// Used to bring a screen in a few pieces at a time rather than all at once,
/// which is most of the difference between a screen that appears and a screen
/// that arrives. [index] staggers it — each item starts a little after the one
/// above, so the eye is led down the page.
///
/// It runs once, on mount. A rebuild does not replay it, because a list that
/// re-animates every time its data refreshes is a list nobody can read. For the
/// same reason it does not belong on the rows of a lazily built list: those are
/// mounted again every time they scroll back into view.
///
/// With the system's reduce-motion setting on, the section is simply there.
class FadeSlideIn extends StatefulWidget {
  const FadeSlideIn({
    super.key,
    required this.child,
    this.index = 0,
    this.step = AppDurations.stagger,
    this.duration = AppDurations.entrance,
  });

  final Widget child;
  final int index;

  /// Delay added per [index].
  final Duration step;
  final Duration duration;

  @override
  State<FadeSlideIn> createState() => _FadeSlideInState();
}

class _FadeSlideInState extends State<FadeSlideIn> with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: widget.duration,
  );

  late final Animation<double> _curve = CurvedAnimation(
    parent: _controller,
    // Decelerating: fast off the mark, settling gently. Anything that eases in
    // at both ends reads as sluggish at this distance.
    curve: Curves.easeOutCubic,
  );

  bool _started = false;

  // Not initState: whether to animate at all is read from the MediaQuery, and
  // an inherited widget cannot be read that early.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    if (MediaQuery.maybeDisableAnimationsOf(context) ?? false) {
      _controller.value = 1;
      return;
    }

    // The stagger is capped: on a long list the twentieth item should not wait
    // a second and a half to appear.
    final delay = widget.step * widget.index.clamp(0, 8);
    if (delay == Duration.zero) {
      _controller.forward();
    } else {
      Future<void>.delayed(delay, () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _curve,
      // A section with async content underneath (the mantra browser) can
      // still be resizing while its own fade-in has not started yet — at
      // opacity 0 that resize happens on a branch Flutter has excluded from
      // the semantics tree, and reattaching it mid-resize is what corrupts
      // the tree. Keeping semantics attached throughout avoids that, and
      // costs nothing since the content is only genuinely hidden for a
      // few staggered milliseconds anyway.
      alwaysIncludeSemantics: true,
      child: AnimatedBuilder(
        animation: _curve,
        builder: (context, child) => Transform.translate(
          offset: Offset(0, (1 - _curve.value) * AppSpacing.lg),
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

/// Press feedback: the child shrinks slightly while a finger is on it.
///
/// A ripple says "something happened here"; this says "you are holding this",
/// which is what a whole card wants when the card is the button.
class TapScale extends StatefulWidget {
  const TapScale({super.key, required this.child, this.onTap, this.scale = 0.97});

  final Widget child;
  final VoidCallback? onTap;
  final double scale;

  @override
  State<TapScale> createState() => _TapScaleState();
}

class _TapScaleState extends State<TapScale> {
  bool _down = false;

  void _set(bool value) {
    if (widget.onTap == null || _down == value) return;
    setState(() => _down = value);
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      onTapDown: (_) => _set(true),
      onTapUp: (_) => _set(false),
      onTapCancel: () => _set(false),
      child: AnimatedScale(
        scale: _down ? widget.scale : 1,
        duration: AppDurations.fast,
        curve: Curves.easeOut,
        child: widget.child,
      ),
    );
  }
}
