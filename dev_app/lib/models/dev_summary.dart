import 'json.dart';

/// The home screen's numbers (`GET /api/admin/dev/summary`).
class DevSummary {
  const DevSummary({
    required this.users,
    required this.signupsToday,
    required this.signups7d,
    required this.unreadChats,
    required this.unreadMessages,
    required this.criticalLastHour,
    required this.errorsLastHour,
    required this.online,
  });

  final int users;
  final int signupsToday;
  final int signups7d;
  final int unreadChats;
  final int unreadMessages;
  final int criticalLastHour;
  final int errorsLastHour;
  final int? online;

  factory DevSummary.fromJson(Json json) => DevSummary(
        users: asInt(json['users']),
        signupsToday: asInt(json['signupsToday']),
        signups7d: asInt(json['signups7d']),
        unreadChats: asInt(json['unreadChats']),
        unreadMessages: asInt(json['unreadMessages']),
        criticalLastHour: asInt(json['criticalLastHour']),
        errorsLastHour: asInt(json['errorsLastHour']),
        online: asIntOrNull(json['online']),
      );
}

/// Push preferences (`GET/PUT /api/admin/dev/prefs`).
class DevPrefs {
  const DevPrefs({this.pushEnabled = true, this.mutedTypes = const []});

  final bool pushEnabled;
  final List<String> mutedTypes;

  DevPrefs copyWith({bool? pushEnabled, List<String>? mutedTypes}) =>
      DevPrefs(pushEnabled: pushEnabled ?? this.pushEnabled, mutedTypes: mutedTypes ?? this.mutedTypes);

  factory DevPrefs.fromJson(Json json) => DevPrefs(
        pushEnabled: json['pushEnabled'] != false,
        mutedTypes: asStringList(json['mutedTypes']),
      );

  Json toJson() => {'pushEnabled': pushEnabled, 'mutedTypes': mutedTypes};
}
