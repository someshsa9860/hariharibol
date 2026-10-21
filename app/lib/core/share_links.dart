/// What a shared link points at — the app's copy of the grammar in
/// `backend/utils/share.js` and `website/src/lib/share-link.ts`. One parser:
/// nothing else in the app reads a share URL.
///
/// Two families that never mix: content (`/shloka`, `/naam`, `/darshan`) and an
/// invitation (`/satsang`). Opening content never attributes a referral.
library;

enum ShareType {
  verse('VERSE', 'shloka'),
  mantra('MANTRA', 'naam'),
  reel('REEL', 'darshan');

  const ShareType(this.apiName, this.route);

  /// The name the API uses.
  final String apiName;

  /// The path segment on hariharibol.com.
  final String route;

  static ShareType? fromRoute(String route) {
    for (final type in values) {
      if (type.route == route) return type;
    }
    return null;
  }
}

sealed class ShareLink {
  const ShareLink();
}

class ContentLink extends ShareLink {
  const ContentLink(this.type, this.code);
  final ShareType type;
  final String code;

  @override
  bool operator ==(Object other) => other is ContentLink && other.type == type && other.code == code;

  @override
  int get hashCode => Object.hash(type, code);
}

class InviteLink extends ShareLink {
  const InviteLink(this.code);
  final String code;

  @override
  bool operator ==(Object other) => other is InviteLink && other.code == code;

  @override
  int get hashCode => code.hashCode;
}

abstract final class ShareLinks {
  static const String webHost = 'hariharibol.com';
  static const String appScheme = 'hariharibol';
  static const String inviteRoute = 'satsang';

  // Base58: no 0, O, I or l.
  static final RegExp _contentCode = RegExp(r'^[1-9A-HJ-NP-Za-km-z]{8,16}$');
  static final RegExp _inviteCode = RegExp(r'^[A-HJ-NP-Z2-9]{6,12}$');

  /// The code as typed by a person: any case, spaces and dashes ignored.
  static String? normaliseInvite(String raw) {
    final code = raw.trim().toUpperCase().replaceAll(RegExp(r'[\s-]'), '');
    return _inviteCode.hasMatch(code) ? code : null;
  }

  /// Reads a link, or returns null. Accepted:
  ///   https://hariharibol.com/shloka/<code>  (and www.)
  ///   hariharibol://shloka/<code>
  ///   hariharibol://open?path=/shloka/<code>   (the website's "Open in the app" button)
  ///   /shloka/<code>                          (how the platform hands a link to the router)
  /// Any other host is refused, so a link can never send the app elsewhere.
  static ShareLink? parse(Uri uri) {
    final List<String> parts;
    if (uri.scheme == 'https' || uri.scheme == 'http') {
      if (uri.host != webHost && uri.host != 'www.$webHost') return null;
      parts = uri.pathSegments;
    } else if (uri.scheme == appScheme) {
      final path = uri.queryParameters['path'];
      if (uri.host == 'open' && path != null) {
        parts = Uri.tryParse(path)?.pathSegments ?? const [];
      } else {
        parts = [uri.host, ...uri.pathSegments];
      }
    } else if (uri.scheme.isEmpty && uri.host.isEmpty) {
      // The platform hands a link to the router as just its path.
      parts = uri.pathSegments;
    } else {
      return null;
    }
    if (parts.length < 2) return null;
    final route = parts[0];
    final code = parts[1];
    if (route == inviteRoute) {
      final invite = normaliseInvite(code);
      return invite == null ? null : InviteLink(invite);
    }
    final type = ShareType.fromRoute(route);
    if (type != null && _contentCode.hasMatch(code)) return ContentLink(type, code);
    return null;
  }

  /// True for a path the router must not treat as a screen of its own: it is
  /// handled by DeepLinkService, and the router is sent home.
  static bool claims(Uri uri) => parse(uri) != null;
}
