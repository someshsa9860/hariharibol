import 'package:flutter/foundation.dart';

import '../core/constants/push_config.dart';
import '../core/navigation/app_navigator.dart';
import '../core/navigation/app_routes.dart';
import 'push_analytics.dart';

/// Where a tapped notification should take the reader, or null if it names
/// nowhere (a plain announcement just opens the app).
///
/// A verse's place in its book wins — the daily sloka sends it, which is how a
/// tap reaches the right chapter, scrolled to the verse, without asking the API
/// where it lives. Failing that, the `hariharibol://` deeplink the notification
/// carries decides, for the few that point at a screen.
String? pushRoute(Map<String, dynamic> data) {
  String? text(String key) {
    final value = data[key]?.toString().trim();
    return value == null || value.isEmpty ? null : value;
  }

  final slug = text(PushConfig.bookSlugKey);
  if (slug != null) {
    final chapter = int.tryParse(text(PushConfig.chapterNumberKey) ?? '');
    // A book with no chapters is read from its own page.
    if (chapter == null) return AppRoutes.bookPath(slug);
    return AppRoutes.chapterPath(
      slug,
      chapter,
      canto: int.tryParse(text(PushConfig.cantoNumberKey) ?? ''),
      verse: int.tryParse(text(PushConfig.verseNumberKey) ?? ''),
    );
  }

  final link = Uri.tryParse(text(PushConfig.deeplinkKey) ?? '');
  if (link == null || link.scheme != PushConfig.deeplinkScheme) return null;
  return switch (link.host) {
    PushConfig.deeplinkSadhana => AppRoutes.sadhana,
    PushConfig.deeplinkPremium => AppRoutes.plans,
    PushConfig.deeplinkCalendar => AppRoutes.calendar,
    _ => null,
  };
}

/// Holds a tapped notification until the app can show what it pointed at.
///
/// A tap can arrive before there is anywhere to go: the app was closed, so it
/// is still on the launch animation, or it is signed out, or it is held at the
/// language picker. The dashboard is the first screen that is none of those, so
/// it says when it is up ([setReady]); a tap before that waits, and one after
/// opens at once. The screen opens *over* the dashboard, so back lands on Home.
class PushLinks {
  PushLinks._()
      : _open = ((route) =>
            // Leaving the screen a push opened ends the reading time it measures.
            AppNavigator.instance.push(route).whenComplete(PushAnalytics.instance.endReading));

  @visibleForTesting
  PushLinks.withOpener(this._open);

  static final PushLinks instance = PushLinks._();

  final void Function(String route) _open;

  /// Told of every tap, with where it leads — what the push statistics hang on.
  /// Set by [FcmService]; tests leave it empty.
  void Function(Map<String, dynamic> data, String? route)? onTapped;

  String? _pending;
  bool _ready = false;

  /// A notification was tapped. `data` is its payload.
  void tapped(Map<String, dynamic> data) {
    final route = pushRoute(data);
    onTapped?.call(data, route);
    if (route == null) return;
    // Only the latest tap matters: a person who taps two before the app is up
    // wants the one they tapped last.
    _pending = route;
    _flush();
  }

  /// A screen to open as soon as the app can show it — what a shared link or a
  /// deep link resolved to. Same hold as a tapped notification.
  void openRoute(String route) {
    _pending = route;
    _flush();
  }

  /// The dashboard is on screen ([ready]) or has gone.
  void setReady(bool ready) {
    _ready = ready;
    _flush();
  }

  void _flush() {
    final route = _pending;
    if (!_ready || route == null) return;
    _pending = null;
    _open(route);
  }
}
