import 'package:flutter/material.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/app_spacing.dart';
import '../../core/theme/app_theme.dart';

/// The raised button in the middle of [GlassNavBar] — Sakha's.
///
/// A disc with a rim, standing partly above the bar so it reads as the one
/// thing on the bar that is not a place to be but a person to talk to. The disc
/// is neutral (white in the light theme, black in the dark) so the icon on it
/// can be drawn in its own colours; the rim and the glow are the saffron of the
/// light theme and the white of the dark one, which is the app's colour rule.
///
/// It breathes — a ring swelling and fading around it — a few times when it
/// first appears and then stands still. A ring that never stops would keep the
/// whole screen repainting for something nobody is looking at, and the frosted
/// bar under it would be re-rendered with every frame. With the system's
/// reduce-motion setting on it never moves; pressing it dips it a little.
class NavHeroButton extends StatefulWidget {
  const NavHeroButton({
    super.key,
    required this.icon,
    required this.semanticLabel,
    required this.onTap,
  });

  /// The icon, drawn at [iconSize] by whoever builds it.
  final Widget icon;
  final String semanticLabel;
  final VoidCallback onTap;

  /// The disc.
  static const double disc = 50;

  /// The gradient rim around the disc.
  static const double rim = 3;

  /// The whole button, rim included.
  static const double outer = disc + 2 * rim;

  /// How far it stands above the bar's top edge.
  static const double lift = 24;

  /// What the icon is drawn at inside the disc.
  static const double iconSize = 34;

  /// One breath of the ring, and how many it takes on first showing.
  static const Duration breath = Duration(milliseconds: 2200);
  static const int breaths = 3;

  /// How far the ring swells, as a share of [outer].
  static const double swell = 0.32;

  @override
  State<NavHeroButton> createState() => _NavHeroButtonState();
}

class _NavHeroButtonState extends State<NavHeroButton> with SingleTickerProviderStateMixin {
  late final AnimationController _breath = AnimationController(vsync: this, duration: NavHeroButton.breath);

  bool _pressed = false;
  bool _started = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _breath.stop();
    } else if (!_started) {
      _started = true;
      _breath.repeat(count: NavHeroButton.breaths);
    }
  }

  @override
  void dispose() {
    _breath.dispose();
    super.dispose();
  }

  void _press(bool down) {
    if (_pressed != down) setState(() => _pressed = down);
  }

  @override
  Widget build(BuildContext context) {
    final isLight = context.theme.brightness == Brightness.light;
    final rim = isLight
        ? const [AppColors.saffronLight, AppColors.orange]
        : const [AppColors.white, AppColors.inkMutedDark];
    final glow = isLight ? AppColors.saffron : AppColors.white;
    final fill = isLight ? AppColors.white : AppColors.black;

    final button = DecoratedBox(
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        gradient: LinearGradient(begin: Alignment.topLeft, end: Alignment.bottomRight, colors: rim),
        boxShadow: [
          BoxShadow(color: glow.withValues(alpha: isLight ? 0.45 : 0.28), blurRadius: 18, offset: const Offset(0, 6)),
        ],
      ),
      child: Padding(
        padding: const EdgeInsets.all(NavHeroButton.rim),
        child: DecoratedBox(
          decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
          child: SizedBox.square(
            dimension: NavHeroButton.disc,
            child: Center(child: widget.icon),
          ),
        ),
      ),
    );

    return Semantics(
      button: true,
      label: widget.semanticLabel,
      child: ExcludeSemantics(
        child: GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTapDown: (_) => _press(true),
          onTapUp: (_) => _press(false),
          onTapCancel: () => _press(false),
          onTap: widget.onTap,
          child: SizedBox.square(
            dimension: NavHeroButton.outer,
            // The ring is painted outside the button's own box, so it never
            // changes what the bar lays out.
            child: Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.center,
              children: [
                AnimatedBuilder(
                  animation: _breath,
                  builder: (context, _) {
                    final t = Curves.easeOut.transform(_breath.value);
                    final ring = NavHeroButton.outer * (1 + NavHeroButton.swell * t);
                    return IgnorePointer(
                      child: Container(
                        width: ring,
                        height: ring,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: glow.withValues(alpha: _breath.isAnimating ? 0.3 * (1 - t) : 0),
                        ),
                      ),
                    );
                  },
                ),
                AnimatedScale(
                  scale: _pressed ? 0.9 : 1,
                  duration: AppDurations.fast,
                  curve: Curves.easeOut,
                  child: button,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
