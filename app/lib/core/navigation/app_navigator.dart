import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../l10n/generated/app_localizations.dart';
import '../../models/api_failure.dart';
import '../theme/app_spacing.dart';
import 'loading_handler.dart';

/// Every navigation, dialog, snack bar and loading spinner goes through here.
///
/// Views do not touch `Navigator` or `GoRouter` directly. The reason is not
/// purity: it is that a service or a controller often needs to react to
/// something — a dead session, a deep link, a push notification tapped while
/// the app was closed — and none of those have a `BuildContext` to hand.
class AppNavigator {
  AppNavigator._();

  static final AppNavigator instance = AppNavigator._();

  /// The root navigator. Dialogs, snack bars and the loading barrier all attach
  /// to this rather than to a tab's own navigator, so they survive a tab switch.
  final GlobalKey<NavigatorState> rootKey = GlobalKey<NavigatorState>(debugLabel: 'root');

  final GlobalKey<ScaffoldMessengerState> messengerKey =
      GlobalKey<ScaffoldMessengerState>(debugLabel: 'messenger');

  late final LoadingHandler loading = LoadingHandler(rootKey);

  GoRouter? _router;

  /// Called once, by the router factory.
  // ignore: use_setters_to_change_properties
  void attach(GoRouter router) => _router = router;

  BuildContext? get context => rootKey.currentContext;

  GoRouter get _go {
    final router = _router;
    if (router == null) throw StateError('AppNavigator.attach() has not run yet');
    return router;
  }

  /// Replaces the current location — used for tabs and for anything that ends a
  /// flow, so the back button does not walk into a screen the person has left.
  void go(String location, {Object? extra}) => _go.go(location, extra: extra);

  void goNamed(String name, {Map<String, String> params = const {}, Object? extra}) =>
      _go.goNamed(name, pathParameters: params, extra: extra);

  /// Pushes on top, for a screen the person is expected to come back from.
  Future<T?> push<T>(String location, {Object? extra}) => _go.push<T>(location, extra: extra);

  void pop<T>([T? result]) {
    if (_go.canPop()) _go.pop(result);
  }

  bool get canPop => _go.canPop();

  // ── Feedback ───────────────────────────────────────────────────────────────

  void showMessage(String message) => _snack(message, isError: false);

  /// Shows what went wrong, in the words the API used where they are meant for
  /// people, and a generic line where they are not.
  void showFailure(ApiFailure failure) => _snack(failure.message, isError: true);

  void _snack(String message, {required bool isError}) {
    final messenger = messengerKey.currentState;
    if (messenger == null) return;
    final context = messengerKey.currentContext;
    final scheme = context == null ? null : Theme.of(context).colorScheme;

    messenger
      ..clearSnackBars()
      ..showSnackBar(
        SnackBar(
          content: Text(message),
          duration: AppDurations.snack,
          backgroundColor: isError ? scheme?.error : null,
        ),
      );
  }

  /// A yes/no question. Returns false if the person backs out.
  Future<bool> confirm({
    required String title,
    required String message,
    String? confirmLabel,
    bool isDestructive = false,
  }) async {
    final context = rootKey.currentContext;
    if (context == null) return false;
    final text = AppLocalizations.of(context);

    final answer = await showDialog<bool>(
      context: context,
      useRootNavigator: true,
      builder: (dialogContext) => AlertDialog(
        title: Text(title),
        content: Text(message),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(dialogContext).pop(false),
            child: Text(text.actionCancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(dialogContext).pop(true),
            style: isDestructive
                ? FilledButton.styleFrom(
                    backgroundColor: Theme.of(dialogContext).colorScheme.error,
                    minimumSize: const Size(0, AppSizes.buttonHeight),
                  )
                : null,
            child: Text(confirmLabel ?? text.actionOk),
          ),
        ],
      ),
    );

    return answer ?? false;
  }
}
