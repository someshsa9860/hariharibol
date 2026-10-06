import 'package:flutter/material.dart';

import '../theme/app_spacing.dart';

/// The blocking loading dialog, owned in one place.
///
/// Two things go wrong with ad-hoc loading dialogs, and both are handled here:
/// a second `show` while one is up leaves an orphan that can never be
/// dismissed, and an early return skips the `hide` so the app sits behind a
/// barrier forever. This keeps a depth count, and [wrap] makes the hide part of
/// the `finally`.
class LoadingHandler {
  LoadingHandler(this._navigatorKey);

  final GlobalKey<NavigatorState> _navigatorKey;

  int _depth = 0;
  bool _visible = false;

  bool get isVisible => _visible;

  void show() {
    _depth++;
    if (_visible) return;

    final context = _navigatorKey.currentContext;
    if (context == null) return;

    _visible = true;
    showDialog<void>(
      context: context,
      barrierDismissible: false,
      useRootNavigator: true,
      // The scrim is the palette's own, not Material's black: in light
      // mode it is the deep orange ink, in dark mode it is black.
      barrierColor: Theme.of(context).colorScheme.scrim.withValues(alpha: 0.55),
      builder: (_) => const _LoadingDialog(),
    ).whenComplete(() {
      // Covers the case where the route is removed by something other than
      // hide() — a deep link replacing the stack, for instance.
      _visible = false;
      _depth = 0;
    });
  }

  void hide() {
    if (_depth > 0) _depth--;
    if (_depth > 0 || !_visible) return;

    final navigator = _navigatorKey.currentState;
    if (navigator == null) {
      _visible = false;
      return;
    }

    _visible = false;
    if (navigator.canPop()) navigator.pop();
  }

  /// Runs [action] with the dialog up, and takes it down however the action
  /// ends — returned, threw, or was cancelled.
  Future<T> wrap<T>(Future<T> Function() action) async {
    show();
    try {
      return await action();
    } finally {
      hide();
    }
  }
}

class _LoadingDialog extends StatelessWidget {
  const _LoadingDialog();

  @override
  Widget build(BuildContext context) {
    return const PopScope(
      // The barrier is there because the app is mid-write. Back must not walk
      // out from under it.
      canPop: false,
      child: Center(
        child: Card(
          child: Padding(
            padding: EdgeInsets.all(AppSpacing.xl),
            child: SizedBox(
              width: AppSizes.iconLg,
              height: AppSizes.iconLg,
              child: CircularProgressIndicator(strokeWidth: 3),
            ),
          ),
        ),
      ),
    );
  }
}
