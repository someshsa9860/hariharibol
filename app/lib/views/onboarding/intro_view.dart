import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/constants/intro_config.dart';
import '../../core/constants/storage_keys.dart';
import '../../core/navigation/app_navigator.dart';
import '../../core/navigation/app_routes.dart';
import '../../core/theme/app_spacing.dart';
import '../../l10n/generated/app_localizations.dart';
import '../../services/local_store.dart';
import '../../widgets/common/animations.dart';
import '../../widgets/intro/intro_backdrop.dart';
import '../../widgets/intro/intro_indicator.dart';
import '../../widgets/intro/intro_page.dart';
import '../../widgets/intro/scene_chant.dart';
import '../../widgets/intro/scene_read.dart';
import '../../widgets/intro/scene_reels.dart';
import '../../widgets/intro/scene_sakha.dart';
import '../../widgets/intro/scene_welcome.dart';

/// What is inside the app, in five pages, shown once on a new phone before
/// sign-in: the welcome, reading, chanting, Ask Sakha and reels.
///
/// The router sends a signed-out phone here until [BoxKeys.introSeen] is set,
/// which the last button, or Skip, does. Nothing here touches the network and
/// nothing on it needs an account.
class IntroView extends StatefulWidget {
  const IntroView({super.key});

  @override
  State<IntroView> createState() => _IntroViewState();
}

class _IntroViewState extends State<IntroView> with SingleTickerProviderStateMixin {
  final PageController _pager = PageController();

  /// The pager's position, in pages, as it is dragged. The backdrop, the
  /// indicator and the parallax all read this rather than the page it will
  /// settle on.
  final ValueNotifier<double> _position = ValueNotifier<double>(0);

  late final AnimationController _clock = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: IntroConfig.moteMs),
  );

  int _page = 0;
  bool _leaving = false;

  static const int _last = IntroConfig.pageCount - 1;

  @override
  void initState() {
    super.initState();
    _pager.addListener(_onScroll);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (MediaQuery.disableAnimationsOf(context)) {
      _clock.stop();
    } else if (!_clock.isAnimating) {
      _clock.repeat();
    }
  }

  @override
  void dispose() {
    _pager
      ..removeListener(_onScroll)
      ..dispose();
    _position.dispose();
    _clock.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (!_pager.hasClients || !_pager.position.haveDimensions) return;
    _position.value = _pager.page ?? _page.toDouble();
  }

  void _onPage(int page) {
    HapticFeedback.selectionClick();
    setState(() => _page = page);
  }

  void _next() {
    if (_page >= _last) {
      _finish();
      return;
    }
    if (MediaQuery.disableAnimationsOf(context)) {
      _pager.jumpToPage(_page + 1);
      return;
    }
    _pager.nextPage(duration: IntroConfig.pageTurn, curve: IntroConfig.pageTurnCurve);
  }

  /// Marks the pages as seen and moves on. First time round the router put them
  /// here as the whole of the app, so the way on is sign-in; opened again later
  /// over a signed-in app, they simply close.
  Future<void> _finish() async {
    if (_leaving) return;
    _leaving = true;

    await LocalStore.instance.write(BoxKeys.introSeen, true);
    if (!mounted) return;

    if (AppNavigator.instance.canPop) {
      AppNavigator.instance.pop();
    } else {
      AppNavigator.instance.go(AppRoutes.signIn);
    }
  }

  @override
  Widget build(BuildContext context) {
    final text = AppLocalizations.of(context);
    final last = _page == _last;
    // Skip fading and the button changing its face are motion too.
    final change = MediaQuery.disableAnimationsOf(context) ? Duration.zero : AppDurations.normal;

    final titles = [
      text.introWelcomeTitle,
      text.introReadTitle,
      text.introChantTitle,
      text.introSakhaTitle,
      text.introReelsTitle,
    ];
    final bodies = [
      text.introWelcomeBody,
      text.introReadBody,
      text.introChantBody,
      text.introSakhaBody,
      text.introReelsBody,
    ];
    final scenes = <Widget Function(Animation<double>, Animation<double>)>[
      (enter, loop) => WelcomeScene(enter: enter, loop: loop),
      (enter, loop) => ReadScene(enter: enter, loop: loop),
      (enter, loop) => ChantScene(enter: enter, loop: loop),
      (enter, loop) => SakhaScene(enter: enter, loop: loop),
      (enter, loop) => ReelsScene(enter: enter, loop: loop),
    ];

    return Scaffold(
      body: Stack(
        children: [
          Positioned.fill(child: IntroBackdrop(position: _position, clock: _clock)),
          SafeArea(
            child: Column(
              children: [
                Align(
                  alignment: AlignmentDirectional.centerEnd,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.lg, AppSpacing.sm, AppSpacing.md, 0),
                    // Kept in place (and just made invisible) on the last page so
                    // nothing below it moves.
                    child: AnimatedOpacity(
                      opacity: last ? 0 : 1,
                      duration: change,
                      child: IgnorePointer(
                        ignoring: last,
                        child: TextButton(onPressed: _finish, child: Text(text.introSkip)),
                      ),
                    ),
                  ),
                ),
                Expanded(
                  child: PageView.builder(
                    controller: _pager,
                    itemCount: IntroConfig.pageCount,
                    onPageChanged: _onPage,
                    itemBuilder: (context, index) => IntroPage(
                      index: index,
                      position: _position,
                      scene: scenes[index],
                      title: titles[index],
                      body: bodies[index],
                    ),
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                Semantics(
                  label: text.introPageOf(_page + 1, IntroConfig.pageCount),
                  excludeSemantics: true,
                  child: IntroIndicator(position: _position),
                ),
                const SizedBox(height: AppSpacing.xl),
                FadeSlideIn(
                  index: 6,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(AppSpacing.xl, 0, AppSpacing.xl, AppSpacing.xl),
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxWidth: IntroConfig.textMaxWidth),
                      child: FilledButton(
                        onPressed: _next,
                        child: AnimatedSwitcher(
                          duration: change,
                          transitionBuilder: (child, animation) {
                            final swap = animation.drive(CurveTween(curve: IntroConfig.labelSwap));
                            return FadeTransition(
                              opacity: swap,
                              child: ScaleTransition(
                                scale: Tween<double>(begin: IntroConfig.labelScale, end: 1).animate(swap),
                                child: child,
                              ),
                            );
                          },
                          child: Row(
                            key: ValueKey<bool>(last),
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Takes the width that is left and wraps rather than
                              // overflowing: a long word at the largest text size
                              // on a small phone needs a second line, not more room.
                              Flexible(
                                child: Text(
                                  last ? text.introStart : text.introNext,
                                  textAlign: TextAlign.center,
                                ),
                              ),
                              const SizedBox(width: AppSpacing.sm),
                              Icon(
                                last ? Icons.check_rounded : Icons.arrow_forward_rounded,
                                size: AppSizes.iconMd - AppSpacing.xs,
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
