import 'package:flutter/material.dart';

import '../../core/constants/chat_config.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/generated/app_localizations.dart';

/// Three dots that pulse in turn: the reply has been asked for and has not
/// started. It is a shape and a motion, never a colour; with the system's
/// reduce-motion setting on, the dots stand still.
class TypingIndicator extends StatefulWidget {
  const TypingIndicator({super.key});

  @override
  State<TypingIndicator> createState() => _TypingIndicatorState();
}

class _TypingIndicatorState extends State<TypingIndicator> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: ChatConfig.typingPulse);

  static const int _dots = 3;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _pulse.stop();
    } else if (!_pulse.isAnimating) {
      _pulse.repeat();
    }
  }

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final color = context.colors.onSurfaceVariant;

    return Semantics(
      label: AppLocalizations.of(context).chatTyping,
      child: ExcludeSemantics(
        child: AnimatedBuilder(
          animation: _pulse,
          builder: (context, _) => Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              for (var i = 0; i < _dots; i++) ...[
                if (i > 0) const SizedBox(width: AppSpacing.xs),
                Opacity(
                  opacity: _opacity(i),
                  child: Container(
                    width: ChatConfig.typingDot,
                    height: ChatConfig.typingDot,
                    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
                  ),
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }

  /// Each dot is brightest a third of a cycle after the one before it.
  double _opacity(int index) {
    if (!_pulse.isAnimating) return 1;
    final phase = (_pulse.value - index / _dots) % 1.0;
    return 0.3 + 0.7 * (1 - (phase * 2 - 1).abs());
  }
}
