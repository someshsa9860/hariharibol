import 'json.dart';

class DevMessage {
  const DevMessage({
    required this.id,
    required this.conversationId,
    required this.fromDeveloper,
    required this.body,
    required this.createdAt,
    this.pending = false,
    this.failed = false,
  });

  final String id;
  final String conversationId;
  final bool fromDeveloper;
  final String body;
  final DateTime createdAt;

  /// Sent from this phone and not yet confirmed by the server.
  final bool pending;
  final bool failed;

  DevMessage copyWith({bool? pending, bool? failed}) => DevMessage(
        id: id,
        conversationId: conversationId,
        fromDeveloper: fromDeveloper,
        body: body,
        createdAt: createdAt,
        pending: pending ?? this.pending,
        failed: failed ?? this.failed,
      );

  factory DevMessage.fromJson(Json json) => DevMessage(
        id: asString(json['id']),
        conversationId: asString(json['conversationId']),
        fromDeveloper: asBool(json['fromDeveloper']),
        body: asString(json['body']),
        createdAt: asDate(json['createdAt']) ?? DateTime.now(),
      );
}

/// The reader on the other end.
class ChatPerson {
  const ChatPerson({required this.id, required this.name, required this.email, this.avatarUrl});

  final String id;
  final String? name;
  final String email;
  final String? avatarUrl;

  String get displayName => (name != null && name!.trim().isNotEmpty) ? name!.trim() : email;

  String get initial => displayName.isEmpty ? '?' : displayName.substring(0, 1).toUpperCase();

  factory ChatPerson.fromJson(Json json) => ChatPerson(
        id: asString(json['id']),
        name: asStringOrNull(json['name']),
        email: asString(json['email']),
        avatarUrl: asStringOrNull(json['avatarUrl']),
      );
}

class DevConversation {
  const DevConversation({
    required this.id,
    required this.person,
    required this.lastMessageAt,
    required this.lastMessagePreview,
    required this.unread,
  });

  final String id;
  final ChatPerson person;
  final DateTime lastMessageAt;
  final String? lastMessagePreview;
  final int unread;

  DevConversation copyWith({DateTime? lastMessageAt, String? lastMessagePreview, int? unread}) => DevConversation(
        id: id,
        person: person,
        lastMessageAt: lastMessageAt ?? this.lastMessageAt,
        lastMessagePreview: lastMessagePreview ?? this.lastMessagePreview,
        unread: unread ?? this.unread,
      );

  factory DevConversation.fromJson(Json json) => DevConversation(
        id: asString(json['id']),
        person: ChatPerson.fromJson(asJson(json['user']) ?? const {}),
        lastMessageAt: asDate(json['lastMessageAt']) ?? DateTime.now(),
        lastMessagePreview: asStringOrNull(json['lastMessagePreview']),
        unread: asInt(json['devUnread']),
      );
}
