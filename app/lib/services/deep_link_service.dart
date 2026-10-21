import 'dart:async';

import 'package:app_links/app_links.dart';
import 'package:flutter/foundation.dart';

import '../core/constants/storage_keys.dart';
import '../core/navigation/app_navigator.dart';
import '../core/navigation/app_routes.dart';
import '../core/session/app_session.dart';
import '../core/share_links.dart';
import '../l10n/generated/app_localizations.dart';
import '../models/api_failure.dart';
import '../models/share.dart';
import 'local_store.dart';
import 'push_link.dart';
import 'share_service.dart';

/// Opens what a tapped link points at, and remembers an invitation.
///
/// One place reads every incoming link. A link can reach the app twice — the
/// system hands it to [AppLinks] and the router sees its path — so each is
/// handled once ([_seen]). The destination is given to [PushLinks], which holds
/// it until the dashboard is up: that is what keeps a link from a closed app,
/// or from someone who is signed out, from being lost on the way in.
///
/// The browser cannot tell whether the app is installed, so nothing here is a
/// guess: Android App Links and iOS Universal Links hand the https link to the
/// app when it is there, and the website offers the stores when it is not.
class DeepLinkService {
  DeepLinkService._();

  @visibleForTesting
  DeepLinkService.test({
    required this.open,
    required this.resolve,
    required this.attribute,
    required this.isSignedIn,
  });

  static final DeepLinkService instance = DeepLinkService._();

  /// Where a resolved destination goes. Defaults to the push holder.
  void Function(String route) open = PushLinks.instance.openRoute;
  Future<SharedContent> Function(ContentLink link) resolve = ShareService.instance.resolve;
  Future<AttributionResult> Function(String code) attribute =
      (code) => ShareService.instance.attribute(code, typed: false);
  bool Function() isSignedIn = () => AppSession.instance.isSignedIn;

  /// Called when a link could not be opened (gone, offline). Says so in the
  /// reader's language; a test replaces it.
  void Function()? onUnavailable = () {
    final context = AppNavigator.instance.messengerKey.currentContext;
    if (context == null) return;
    AppNavigator.instance.showMessage(AppLocalizations.of(context).shareLinkGone);
  };

  StreamSubscription<Uri>? _sub;
  final Map<String, DateTime> _seen = {};

  /// Starts listening. Safe to call more than once.
  Future<void> start() async {
    if (_sub != null) return;
    final links = AppLinks();
    try {
      final initial = await links.getInitialLink();
      if (initial != null) unawaited(handle(initial));
    } catch (error) {
      debugPrint('Initial link could not be read: $error');
    }
    _sub = links.uriLinkStream.listen(
      (uri) => unawaited(handle(uri)),
      onError: (Object error) => debugPrint('Link stream failed: $error'),
    );
    // An invitation kept from before the account existed is presented as soon
    // as there is one.
    AppSession.instance.addListener(_sessionChanged);
    _sessionChanged();
  }

  void _sessionChanged() {
    if (isSignedIn()) unawaited(presentPendingInvite());
  }

  /// Handles one link. Returns true when it was one of ours (so the router
  /// knows to step aside).
  Future<bool> handle(Uri uri) async {
    final link = ShareLinks.parse(uri);
    if (link == null) return false;

    final key = uri.toString();
    final now = DateTime.now();
    final last = _seen[key];
    _seen[key] = now;
    _seen.removeWhere((_, at) => now.difference(at) > const Duration(minutes: 1));
    if (last != null && now.difference(last) < const Duration(seconds: 3)) return true;

    switch (link) {
      case InviteLink(:final code):
        await rememberInvite(code);
        await presentPendingInvite();
        open(AppRoutes.refer);
      case ContentLink():
        await _openContent(link);
    }
    return true;
  }

  Future<void> _openContent(ContentLink link) async {
    try {
      final content = await resolve(link);
      final route = routeFor(content);
      if (route == null) {
        onUnavailable?.call();
        return;
      }
      open(route);
    } on ApiFailure {
      onUnavailable?.call();
    }
  }

  /// The screen for a resolved destination. Never builds a route from anything
  /// the link itself said — only from what the server answered.
  @visibleForTesting
  static String? routeFor(SharedContent content) {
    switch (content.type) {
      case 'VERSE':
        final slug = content.bookSlug;
        if (slug == null) return null;
        final chapter = content.chapterNumber;
        if (chapter == null) return AppRoutes.bookPath(slug);
        return AppRoutes.chapterPath(slug, chapter, canto: content.cantoNumber, verse: content.verseNumber);
      case 'MANTRA':
        final slug = content.mantraSlug;
        return slug == null ? null : AppRoutes.mantraPath(slug);
      case 'REEL':
        final id = content.reelId;
        return id == null ? null : AppRoutes.reelPath(id);
    }
    return null;
  }

  // ── Invitations ────────────────────────────────────────────────────────────

  /// The first invitation wins, as on the server: a later link does not replace one already kept.
  Future<void> rememberInvite(String code) async {
    if (LocalStore.instance.read<String>(BoxKeys.pendingInvite) != null) return;
    await LocalStore.instance.write(BoxKeys.pendingInvite, code);
  }

  /// Presents a kept invitation. It is forgotten once the server has answered
  /// (accepted or refused — a refusal will not become valid later); a network
  /// failure keeps it for next time.
  Future<void> presentPendingInvite() async {
    final code = LocalStore.instance.read<String>(BoxKeys.pendingInvite);
    if (code == null || !isSignedIn()) return;
    try {
      await attribute(code);
      await LocalStore.instance.delete(BoxKeys.pendingInvite);
    } on ApiFailure {
      // Try again on the next launch or sign-in.
    }
  }
}
