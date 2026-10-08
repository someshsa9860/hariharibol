import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';

import '../../core/constants/splash_config.dart';
import '../../core/navigation/splash_gate.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../widgets/splash/splash_backdrop.dart';
import '../../widgets/splash/splash_logo.dart';
import '../../widgets/splash/splash_tagline.dart';

/// The launch animation.
///
/// The session is already restored by the time this draws, so the router could
/// leave it at once; instead it waits on [SplashGate], which this view opens
/// when the timeline ends. A tap opens it early — somebody opening the app for
/// the tenth time today has seen it.
///
/// With reduce-motion on, nothing moves: the finished logo is shown for a short
/// beat and the gate opens after it.
///
/// All the numbers are in [SplashConfig]; this view only runs the clock and
/// lays the three pieces out.
class SplashView extends StatefulWidget {
  const SplashView({super.key});

  @override
  State<SplashView> createState() => _SplashViewState();
}

class _SplashViewState extends State<SplashView> with SingleTickerProviderStateMixin {
  late final AnimationController _timeline = AnimationController(
    vsync: this,
    duration: SplashConfig.total,
  );

  Timer? _reducedHold;
  bool _started = false;

  /// Where the logo is centred. Slightly above the middle: the tagline is at
  /// the bottom, and the optical centre of the whole is higher than the maths.
  static const Alignment _mark = Alignment(0, -SplashConfig.logoLift);

  // Not initState: whether to animate at all is read from the MediaQuery, and
  // an inherited widget cannot be read that early.
  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_started) return;
    _started = true;

    if (MediaQuery.disableAnimationsOf(context)) {
      _timeline.value = 1;
      _reducedHold = Timer(SplashConfig.reducedMotionHold, SplashGate.instance.open);
      return;
    }

    _timeline.addStatusListener((status) {
      if (status == AnimationStatus.completed) SplashGate.instance.open();
    });
    _timeline.forward();
  }

  @override
  void dispose() {
    _reducedHold?.cancel();
    _timeline.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: SplashGate.instance.open,
        child: LayoutBuilder(
          builder: (context, screen) {
            // As wide as it is allowed, but never past the side margins.
            final logo = math.min(SplashConfig.logoWidth, screen.maxWidth - 2 * AppSpacing.xl);

            return Stack(
              fit: StackFit.expand,
              children: [
                SplashBackdrop(progress: _timeline, centre: _eye(screen.biggest, logo)),
                Align(
                  alignment: _mark,
                  child: Semantics(
                    label: AppLocalizations.of(context).appName,
                    image: true,
                    excludeSemantics: true,
                    child: SplashLogo(progress: _timeline, width: logo),
                  ),
                ),
                SafeArea(
                  child: Align(
                    alignment: Alignment.bottomCenter,
                    child: Padding(
                      padding: const EdgeInsets.only(
                        left: AppSpacing.xl,
                        right: AppSpacing.xl,
                        bottom: SplashConfig.taglineBottom,
                      ),
                      child: SplashTagline(progress: _timeline),
                    ),
                  ),
                ),
              ],
            );
          },
        ),
      ),
    );
  }

  /// Where the eye of the feather falls on a screen of this size, with the logo
  /// [logo] wide and laid out by an [Align] at [_mark].
  static Offset _eye(Size screen, double logo) {
    final topLeft = _mark.alongOffset(Offset(screen.width - logo, screen.height - logo));
    return topLeft + SplashConfig.logoEye * logo;
  }
}
