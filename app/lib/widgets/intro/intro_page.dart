import 'dart:math' as math;

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../../core/constants/intro_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import 'intro_text.dart';

/// One welcome page: a picture over a title and a line of text.
///
/// It owns the page's two clocks (see `IntroConfig`). The **entrance** starts
/// when the page is more than half on screen and starts again each time it comes
/// back, after having been a full page away. The **loop** runs while any of the
/// page is showing. With the system's reduce-motion setting on neither runs: the
/// page is simply there, at the pose each picture reads best in.
///
/// While the pager moves the picture and the text travel at different speeds
/// against the page they are on — the picture slower, the text a little faster —
/// which, with the picture shrinking and fading as it goes, is what gives the
/// turn its depth.
class IntroPage extends StatefulWidget {
  const IntroPage({
    super.key,
    required this.index,
    required this.position,
    required this.scene,
    required this.title,
    required this.body,
  });

  final int index;

  /// The pager's position, in pages.
  final ValueListenable<double> position;

  /// The picture, given the page's two clocks.
  final Widget Function(Animation<double> enter, Animation<double> loop) scene;

  final String title;
  final String body;

  @override
  State<IntroPage> createState() => _IntroPageState();
}

class _IntroPageState extends State<IntroPage> with TickerProviderStateMixin {
  late final AnimationController _enter = AnimationController(
    vsync: this,
    duration: IntroConfig.enter,
  );
  late final AnimationController _loop = AnimationController(
    vsync: this,
    duration: IntroConfig.loop,
  );

  bool _arrived = false;
  bool _still = false;

  @override
  void initState() {
    super.initState();
    widget.position.addListener(_follow);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _still = MediaQuery.disableAnimationsOf(context);
    _follow();
  }

  @override
  void dispose() {
    widget.position.removeListener(_follow);
    _enter.dispose();
    _loop.dispose();
    super.dispose();
  }

  void _follow() {
    if (_still) {
      _loop.stop();
      _enter.value = 1;
      _loop.value = IntroConfig.stillLoop;
      return;
    }

    final distance = (widget.position.value - widget.index).abs();

    // A full page away: put the entrance back so it plays again on return.
    if (distance >= 1) {
      if (_arrived || _loop.isAnimating) {
        _arrived = false;
        _enter.value = 0;
        _loop.stop();
      }
      return;
    }

    if (!_loop.isAnimating) _loop.repeat();
    if (distance < 0.5 && !_arrived) {
      _arrived = true;
      _enter.forward(from: 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final texts = context.texts;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final side = math.min(
          math.min(width - AppSpacing.xl, constraints.maxHeight * IntroConfig.sceneShare),
          IntroConfig.sceneMaxSide,
        );

        return SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          child: ConstrainedBox(
            constraints: BoxConstraints(minHeight: constraints.maxHeight),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                _Parallax(
                  position: widget.position,
                  index: widget.index,
                  width: width,
                  shift: IntroConfig.sceneParallax,
                  dim: 0.9,
                  shrink: IntroConfig.sceneLeaveScale,
                  child: SizedBox.square(
                    dimension: math.max(side, 0),
                    child: widget.scene(_enter, _loop),
                  ),
                ),
                const SizedBox(height: AppSpacing.xl),
                _Parallax(
                  position: widget.position,
                  index: widget.index,
                  width: width,
                  shift: -IntroConfig.textParallax,
                  dim: 1.4,
                  child: Padding(
                    padding: AppSpacing.screenH + const EdgeInsets.symmetric(horizontal: AppSpacing.sm),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: IntroConfig.textMaxWidth),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IntroTitle(
                            text: widget.title,
                            enter: _enter,
                            style: (texts.headlineMedium ?? const TextStyle()).copyWith(
                              color: colors.onSurface,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.md),
                          IntroReveal(
                            enter: _enter,
                            child: Text(
                              widget.body,
                              textAlign: TextAlign.center,
                              style: texts.bodyLarge?.copyWith(color: colors.onSurfaceVariant),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      },
    );
  }
}

/// Moves, fades and shrinks [child] by how far its page is from the one in the
/// middle. [shift] is a share of the page width, added to the page's own travel.
class _Parallax extends StatelessWidget {
  const _Parallax({
    required this.position,
    required this.index,
    required this.width,
    required this.shift,
    required this.dim,
    required this.child,
    this.shrink = 0,
  });

  final ValueListenable<double> position;
  final int index;
  final double width;
  final double shift;
  final double dim;
  final double shrink;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return ValueListenableBuilder<double>(
      valueListenable: position,
      child: child,
      builder: (context, value, child) {
        final delta = (value - index).clamp(-1.0, 1.0);
        final distance = delta.abs();
        if (distance == 0) return child!;
        return Opacity(
          opacity: (1 - distance * dim).clamp(0.0, 1.0),
          child: Transform.translate(
            offset: Offset(delta * width * shift, 0),
            child: Transform.scale(scale: 1 - distance * shrink, child: child),
          ),
        );
      },
    );
  }
}
