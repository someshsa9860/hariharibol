import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../common/sakha_icon.dart';

/// Sakha's face: its icon in a circle (`SakhaIcon`, the same file the nav
/// bar's button draws). It is a mark, not a character — nothing here suggests a
/// person, and nothing suggests a machine.
///
/// With [glow] a soft ring breathes around it, for the one place it is the
/// subject of the screen (the empty chat). The ring is decoration; with the
/// system's reduce-motion setting on it stands still.
class SakhaAvatar extends StatefulWidget {
  const SakhaAvatar({super.key, required this.size, this.glow = false});

  final double size;
  final bool glow;

  /// One breath of the ring.
  static const Duration breath = Duration(milliseconds: 2800);

  /// How far the ring swells, as a share of the avatar's size.
  static const double swell = 0.22;

  @override
  State<SakhaAvatar> createState() => _SakhaAvatarState();
}

class _SakhaAvatarState extends State<SakhaAvatar> with SingleTickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(vsync: this, duration: SakhaAvatar.breath);

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final still = !widget.glow || MediaQuery.disableAnimationsOf(context);
    if (still) {
      _breath.stop();
    } else if (!_breath.isAnimating) {
      _breath.repeat(reverse: true);
    }
  }

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final size = widget.size;

    final face = DecoratedBox(
      decoration: BoxDecoration(color: colors.primaryContainer, shape: BoxShape.circle),
      child: SizedBox.square(
        dimension: size,
        child: Center(child: SakhaIcon(size: size * 0.64)),
      ),
    );
    if (!widget.glow) return ExcludeSemantics(child: face);

    final room = size * (1 + SakhaAvatar.swell);
    return ExcludeSemantics(
      child: SizedBox.square(
        dimension: room,
        child: AnimatedBuilder(
          animation: _breath,
          builder: (context, child) {
            final t = Curves.easeInOut.transform(_breath.value);
            return Stack(
              alignment: Alignment.center,
              children: [
                Container(
                  width: size * (1 + SakhaAvatar.swell * t),
                  height: size * (1 + SakhaAvatar.swell * t),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.primary.withValues(alpha: 0.14 * (1 - t) + 0.04),
                  ),
                ),
                child!,
              ],
            );
          },
          child: face,
        ),
      ),
    );
  }
}
