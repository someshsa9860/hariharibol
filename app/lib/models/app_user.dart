import 'json.dart';

/// The signed-in person, exactly as `sessionPayload` in the backend sends it.
class AppUser {
  const AppUser({
    required this.id,
    required this.email,
    required this.name,
    required this.avatarUrl,
    required this.authProvider,
    required this.appLanguage,
    required this.mantraLanguage,
    required this.readingLanguage,
    required this.timezone,
    required this.isPremium,
    required this.premiumUntil,
    required this.role,
    this.sampradaya,
    this.canAccessAdmin = false,
  });

  final String id;
  final String email;

  /// Apple lets people hide their name; it can genuinely be absent.
  final String? name;
  final String? avatarUrl;
  final String authProvider;

  /// The three language settings. The API resolves content against them in the
  /// order mantra → reading → app, so the app only stores and displays them.
  final String appLanguage;
  final String mantraLanguage;
  final String readingLanguage;

  final String timezone;
  final bool isPremium;

  /// Null for someone who became premium by donating — that does not expire.
  final DateTime? premiumUntil;
  final String role;

  /// The tradition their chanting points to — `shaiva`, `vaishnav` and so on —
  /// or null until one has been chanted on three separate days. The API works
  /// it out from their chanting and it can change as that does; the app never
  /// asks for it or lets anyone set it.
  final String? sampradaya;

  /// Set only by `/me`, and only when the account actually holds admin
  /// permissions. The app hides the admin entry point unless it is true; the
  /// API checks again on every admin route regardless.
  final bool canAccessAdmin;

  /// What to show when there is no name: the part of the email before the `@`.
  String get displayName {
    if (name != null && name!.trim().isNotEmpty) return name!.trim();
    final at = email.indexOf('@');
    return at > 0 ? email.substring(0, at) : email;
  }

  String get initials {
    final parts = displayName.trim().split(RegExp(r'\s+'));
    if (parts.isEmpty || parts.first.isEmpty) return '?';
    if (parts.length == 1) return parts.first.substring(0, 1).toUpperCase();
    return (parts.first.substring(0, 1) + parts[1].substring(0, 1)).toUpperCase();
  }

  factory AppUser.fromJson(Json json) => AppUser(
        id: asString(json['id']),
        email: asString(json['email']),
        name: asStringOrNull(json['name']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        authProvider: asString(json['authProvider'], 'GOOGLE'),
        appLanguage: asString(json['appLanguage'], 'en'),
        mantraLanguage: asString(json['mantraLanguage'], 'sa'),
        readingLanguage: asString(json['readingLanguage'], 'en'),
        timezone: asString(json['timezone'], 'Asia/Kolkata'),
        isPremium: asBool(json['isPremium']),
        premiumUntil: asDate(json['premiumUntil']),
        // Sign-in sends the role as a slug; `/me` sends the whole row.
        role: asJson(json['role']) != null
            ? asString(asJson(json['role'])!['slug'], 'user')
            : asString(json['role'], 'user'),
        sampradaya: asStringOrNull(json['sampradaya']),
        canAccessAdmin: asBool(json['canAccessAdmin']),
      );

  Json toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'avatarUrl': avatarUrl,
        'authProvider': authProvider,
        'appLanguage': appLanguage,
        'mantraLanguage': mantraLanguage,
        'readingLanguage': readingLanguage,
        'timezone': timezone,
        'isPremium': isPremium,
        'premiumUntil': premiumUntil?.toUtc().toIso8601String(),
        'role': role,
        'sampradaya': sampradaya,
        'canAccessAdmin': canAccessAdmin,
      };

  AppUser copyWith({
    String? name,
    String? avatarUrl,
    String? appLanguage,
    String? mantraLanguage,
    String? readingLanguage,
    String? timezone,
    bool? isPremium,
    DateTime? premiumUntil,
  }) =>
      AppUser(
        id: id,
        email: email,
        name: name ?? this.name,
        avatarUrl: avatarUrl ?? this.avatarUrl,
        authProvider: authProvider,
        appLanguage: appLanguage ?? this.appLanguage,
        mantraLanguage: mantraLanguage ?? this.mantraLanguage,
        readingLanguage: readingLanguage ?? this.readingLanguage,
        timezone: timezone ?? this.timezone,
        isPremium: isPremium ?? this.isPremium,
        premiumUntil: premiumUntil ?? this.premiumUntil,
        role: role,
        sampradaya: sampradaya,
        canAccessAdmin: canAccessAdmin,
      );
}
