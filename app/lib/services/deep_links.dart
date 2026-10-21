import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/app_config.dart';
import '../core/navigation/app_routes.dart';
import '../core/session/app_session.dart';
import '../models/api_failure.dart';
import '../models/share.dart';
import 'push_link.dart';
import 'referral_service.dart';
import 'share_service.dart';

/// Every link that opens the app from outside — the one place a URL is read.
///
///   https://hariharibol.com/shloka/<code>   a verse
///   https://hariharibol.com/mantra/<code>   a mantra
///   https://hariharibol.com/divya/<code>    a reel
///   https://hariharibol.com/satsang/<code>  an invitation (remembered; never opens content)
///   hariharibol://<same path>               the same, for a phone without the https association
///
/// A content link is looked up on the server (the code is opaque) and becomes a route the app already has; the
/// route then goes through [PushLinks], which holds it until the dashboard is on screen, so a cold start, a
/// signed-out start and a start held at the language picker all end on the right screen. An invitation is never
/// acted on beyond remembering it: opening a link does not reward anyone.
class DeepLinks {
  DeepLinks._() : _opener = PushLinks.instance.openRoute;

  @visibleForTesting
  DeepLinks.withOpener(this._opener);

  static final DeepLinks instance = DeepLinks._();

  final void Function(String route) _opener;
  StreamSubscription<Uri>? _sub;
  String? _lastKey;
  DateTime? _lastAt;
  bool _started = false;

  static const Map<String, String> _kinds = {'shloka': 'SHLOKA', 'mantra': 'MANTRA', 'divya': 'REEL'};
  static const String _invitation = 'satsang';
  static const Set<String> _hosts = {'hariharibol.com', 'www.hariharibol.com'};

  /// Listens for links, and picks up the one that launched the app. Called once, after the session is restored.
  Future<void> start() async {
    if (_started) return;
    _started = true;

    final links = AppLinks();
    _sub = links.uriLinkStream.listen(
      (uri) => unawaited(handle(uri)),
      onError: (Object _) {}, // a malformed link is simply not opened
    );
    try {
      final initial = await links.getInitialLink();
      if (initial != null) unawaited(handle(initial));
    } catch (_) {
      // No initial link, or the platform could not say.
    }

    // An invitation remembered before sign-in is claimed the moment a session exists.
    AppSession.instance.addListener(_onSession);
    _onSession();
  }

  @visibleForTesting
  Future<void> stop() async {
    await _sub?.cancel();
    AppSession.instance.removeListener(_onSession);
    _started = false;
  }

  void _onSession() {
    if (AppSession.instance.isSignedIn) unawaited(ReferralService.instance.claimPending());
  }

  /// What a link names, or null when it is not one of ours. Pure; exposed for tests.
  static ({String segment, String code})? parse(Uri uri) {
    final List<String> parts;
    if (uri.scheme == AppConfig.appScheme) {
      // hariharibol://mantra/ABC → host "mantra", path "/ABC"
      parts = [uri.host, ...uri.pathSegments.where((s) => s.isNotEmpty)];
    } else if ((uri.scheme == 'https' || uri.scheme == 'http') && _hosts.contains(uri.host)) {
      parts = uri.pathSegments.where((s) => s.isNotEmpty).toList();
    } else {
      return null;
    }
    if (parts.length < 2) return null;
    final segment = parts[0].toLowerCase();
    final code = parts[1];
    if (!RegExp(r'^[A-Za-z0-9]{4,20}$').hasMatch(code)) return null;
    if (!_kinds.containsKey(segment) && segment != _invitation) return null;
    return (segment: segment, code: code);
  }

  /// The route inside the app for something a link resolved to, or null when the place is incomplete.
  static String? routeFor(ResolvedShare share) {
    final place = share.place;
    switch (share.kind) {
      case 'SHLOKA':
        {
        final slug = place['bookSlug'] as String?;
        if (slug == null) return null;
        final chapter = (place['chapterNumber'] as num?)?.toInt();
        if (chapter == null) return AppRoutes.bookPath(slug);
        return AppRoutes.chapterPath(
          slug,
          chapter,
          canto: (place['cantoNumber'] as num?)?.toInt(),
          verse: (place['verseNumber'] as num?)?.toInt(),
        );
        }
      case 'MANTRA':
        {
          final slug = place['slug'] as String?;
          return slug == null ? null : AppRoutes.mantraPath(slug);
        }
      case 'REEL':
        {
          final id = place['reelId'] as String?;
          // The reel itself, not the feed.
          return id == null ? null : AppRoutes.reelPath(id);
        }
    }
    return null;
  }

  Future<void> handle(Uri uri) async {
    final parsed = parse(uri);
    if (parsed == null) return;

    // The same link arriving twice (the stream and the launch link both report it) opens once.
    final key = '${parsed.segment}/${parsed.code}';
    final now = DateTime.now();
    if (_lastKey == key && _lastAt != null && now.difference(_lastAt!) < const Duration(seconds: 3)) return;
    _lastKey = key;
    _lastAt = now;

    if (parsed.segment == _invitation) {
      await ReferralService.instance.remember(parsed.code);
      _onSession();
      return;
    }

    try {
      final resolved = await ShareService.instance.resolve(parsed.code, kind: _kinds[parsed.segment]);
      final route = routeFor(resolved);
      if (route != null) _opener(route);
    } on ApiFailure {
      // Unknown, taken down, or no connection: the app is already open, and Home is the honest place to be.
    }
  }
}
