import 'dart:convert';

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

  return deeplinkRoute(text(PushConfig.deeplinkKey));
}

/// The screen a `hariharibol://<word>` link names, or null. Also what a
/// notification's buttons use, each with a link of its own.
String? deeplinkRoute(String? deeplink) {
  final link = Uri.tryParse(deeplink ?? '');
  if (link == null || link.scheme != PushConfig.deeplinkScheme) return null;
  String? query(String name) {
    final value = link.queryParameters[name]?.trim();
    return value == null || value.isEmpty ? null : value;
  }

  return switch (link.host) {
    PushConfig.deeplinkSadhana || PushConfig.deeplinkJap => AppRoutes.sadhana,
    PushConfig.deeplinkPremium => AppRoutes.plans,
    PushConfig.deeplinkCalendar => AppRoutes.calendar,
    PushConfig.deeplinkEtiquette => _etiquettePath(link),
    PushConfig.deeplinkPrayer => _prayerPath(link),
    PushConfig.deeplinkHome => AppRoutes.home,
    PushConfig.deeplinkSakha => AppRoutes.chat,
    PushConfig.deeplinkChant => AppRoutes.chant,
    PushConfig.deeplinkRead => AppRoutes.library,
    PushConfig.deeplinkReels => AppRoutes.reels,
    PushConfig.deeplinkRoutine => AppRoutes.routine,
    PushConfig.deeplinkRefer => AppRoutes.refer,
    PushConfig.deeplinkSearch => AppRoutes.search,
    PushConfig.deeplinkMantra => query('slug') == null ? null : AppRoutes.mantraPath(query('slug')!),
    PushConfig.deeplinkReel => query('id') == null ? null : AppRoutes.reelPath(query('id')!),
    PushConfig.deeplinkSupport => AppRoutes.support,
    PushConfig.deeplinkDeveloper => AppRoutes.developerChat,
    PushConfig.deeplinkTicket => query('id') == null ? null : AppRoutes.ticketPath(query('id')!),
    PushConfig.deeplinkVerse => _versePath(query),
    _ => null,
  };
}

/// `hariharibol://etiquette/<id>` is one item; without an id it is the list.
String _etiquettePath(Uri link) {
  final id = link.pathSegments.isEmpty ? '' : link.pathSegments.first.trim();
  return id.isEmpty ? AppRoutes.etiquette : AppRoutes.etiquettePath(id);
}

/// `hariharibol://prayer/<slug>` is one prayer; without a slug there is nothing to open.
String? _prayerPath(Uri link) {
  final slug = link.pathSegments.isEmpty ? '' : link.pathSegments.first.trim();
  return slug.isEmpty ? null : AppRoutes.prayerPath(slug);
}

String? _versePath(String? Function(String name) query) {
  final book = query('book');
  final chapter = int.tryParse(query('chapter') ?? '');
  if (book == null || chapter == null) return null;
  return AppRoutes.chapterPath(
    book,
    chapter,
    canto: int.tryParse(query('canto') ?? ''),
    verse: int.tryParse(query('verse') ?? ''),
  );
}

/// One button on a notification, from the push's `actions` data.
class PushAction {
  const PushAction({required this.id, required this.label, required this.deeplink});

  final String id;
  final String label;
  final String deeplink;
}

/// The buttons a push carries, at most two; empty when it has none or the list
/// cannot be read (a push must never fail for want of its buttons).
List<PushAction> pushActions(Map<String, dynamic> data) {
  final raw = data[PushConfig.actionsKey]?.toString();
  if (raw == null || raw.isEmpty) return const [];
  try {
    final list = jsonDecode(raw);
    if (list is! List) return const [];
    return [
      for (final item in list.take(2))
        if (item is Map && item['id'] != null && item['label'] != null && item['deeplink'] != null)
          PushAction(id: '${item['id']}', label: '${item['label']}', deeplink: '${item['deeplink']}'),
    ];
  } catch (_) {
    return const [];
  }
}

/// Where the button [actionId] leads.
String? pushActionRoute(Map<String, dynamic> data, String actionId) {
  for (final action in pushActions(data)) {
    if (action.id == actionId) return deeplinkRoute(action.deeplink);
  }
  return null;
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

  /// A notification was tapped. `data` is its payload. [actionId] names the
  /// button that was pressed, when it was one: that button's own link decides.
  void tapped(Map<String, dynamic> data, {String? actionId}) {
    final route = actionId == null ? pushRoute(data) : (pushActionRoute(data, actionId) ?? pushRoute(data));
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
