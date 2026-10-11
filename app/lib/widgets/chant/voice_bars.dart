import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// Four small bars that rise and fall while a voice is being heard and rest
/// flat when it is not — the "it hears you" sign on the live card. The words
/// beside it say the same thing, so the motion and colour are only a help.
///
/// Holds still when the system asks for reduced motion.
class VoiceBars extends StatefulWidget {
  const VoiceBars({super.key, required this.active});

  final bool active;

  @override
  State<VoiceBars> createState() => _VoiceBarsState();
}

class _VoiceBarsState extends State<VoiceBars> with SingleTickerProviderStateMixin {
  static const int _bars = 4;
  static const double _barWidth = 3;
  static const double _gap = 3;
  static const double _lowest = 4;
  static const double _highest = AppSizes.iconSm;

  /// How far along its wave each bar starts, so they do not rise together.
  static const double _stagger = 0.22;
  static const Duration _period = Duration(milliseconds: 900);

  late final AnimationController _wave = AnimationController(vsync: this, duration: _period);
  bool _reduceMotion = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _reduceMotion = MediaQuery.disableAnimationsOf(context);
    _sync();
  }

  @override
  void didUpdateWidget(VoiceBars oldWidget) {
    super.didUpdateWidget(oldWidget);
    _sync();
  }

  void _sync() {
    final shouldMove = widget.active && !_reduceMotion;
    if (shouldMove && !_wave.isAnimating) {
      _wave.repeat();
    } else if (!shouldMove && _wave.isAnimating) {
      _wave.stop();
    }
  }

  @override
  void dispose() {
    _wave.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = widget.active ? context.colors.primary : context.colors.outline;

    return ExcludeSemantics(
      child: SizedBox(
        height: _highest,
        child: AnimatedBuilder(
          animation: _wave,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              for (var i = 0; i < _bars; i++) ...[
                if (i > 0) const SizedBox(width: _gap),
                Container(
                  width: _barWidth,
                  height: _height(i),
                  decoration: BoxDecoration(
                    color: color,
                    borderRadius: const BorderRadius.all(Radius.circular(AppRadius.pill)),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  double _height(int bar) {
    // Resting, or held still: the bars are a flat, even row.
    if (!widget.active || _reduceMotion) return widget.active ? (_lowest + _highest) / 2 : _lowest;
    final wave = (math.sin(2 * math.pi * (_wave.value + bar * _stagger)) + 1) / 2;
    return _lowest + (_highest - _lowest) * wave;
  }
}
