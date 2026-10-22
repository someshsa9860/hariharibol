import 'json.dart';

/// The signed-in developer. Permissions come from `/api/admin/me`; the sign-in answer carries none.
class DevUser {
  const DevUser({
    required this.id,
    required this.email,
    required this.name,
    this.avatarUrl,
    this.permissions = const {},
  });

  final String id;
  final String email;
  final String? name;
  final String? avatarUrl;
  final Set<String> permissions;

  /// May use this app at all (the owner, the super admin, or a role granted `dev.access`).
  bool get canUseDevApp => permissions.contains('dev.access');

  /// May read and answer support tickets (`support.manage`).
  bool get canManageSupport => permissions.contains('support.manage');

  String get displayName {
    if (name != null && name!.trim().isNotEmpty) return name!.trim();
    final at = email.indexOf('@');
    return at > 0 ? email.substring(0, at) : email;
  }

  DevUser withPermissions(Set<String> value) =>
      DevUser(id: id, email: email, name: name, avatarUrl: avatarUrl, permissions: value);

  factory DevUser.fromJson(Json json) => DevUser(
        id: asString(json['id']),
        email: asString(json['email']),
        name: asStringOrNull(json['name']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
        permissions: asStringList(json['permissions']).toSet(),
      );

  Json toJson() => {
        'id': id,
        'email': email,
        'name': name,
        'avatarUrl': avatarUrl,
        'permissions': permissions.toList(),
      };
}
