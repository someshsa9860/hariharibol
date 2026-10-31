import 'package:flutter/widgets.dart';

/// Whether a reels screen is the thing on screen, for the four that play
/// reels (the feed, one reel, the book run and "more like this").
///
/// Two things take a reel off screen without disposing it, and both must stop
/// it playing: the app going to the background, and something covering the
/// screen. The second is read from `TickerMode` — the shell turns it off for a
/// hidden tab and the navigator for a route under an opaque one pushed over it
/// (the chat, a creator's page) — so a screen needs no route bookkeeping of
/// its own. A bottom sheet is not opaque and leaves the reel playing.
///
/// Pass [reelsOnScreen] into the active page's `isActive`.
mixin ReelsOnScreen<T extends StatefulWidget> on State<T>, WidgetsBindingObserver {
  bool _shown = true;
  bool _suspended = false;

  /// Neither covered nor in the background.
  bool get reelsOnScreen => _shown && !_suspended;

  /// Called when a covered screen is uncovered.
  void onReelsShown() {}

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final shown = TickerMode.valuesOf(context).enabled;
    if (shown == _shown) return;
    _shown = shown;
    if (shown) onReelsShown();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final suspended = state != AppLifecycleState.resumed;
    if (suspended == _suspended) return;
    setState(() => _suspended = suspended);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }
}
