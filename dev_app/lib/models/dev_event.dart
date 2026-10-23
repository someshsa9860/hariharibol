import 'json.dart';

/// One line of the live feed (`DevEvent` on the server).
class DevEvent {
  const DevEvent({
    required this.id,
    required this.type,
    required this.severity,
    required this.title,
    required this.body,
    required this.data,
    required this.createdAt,
  });

  final String id;
  final String type;
  final String severity;
  final String title;
  final String? body;
  final Json data;
  final DateTime createdAt;

  bool get isCritical => severity == 'critical';

  /// The conversation a chat event is about.
  String? get conversationId => asStringOrNull(data['conversationId']);

  /// The ticket a ticket or feedback event is about.
  String? get ticketId => asStringOrNull(data['ticketId']);

  factory DevEvent.fromJson(Json json) => DevEvent(
        id: asString(json['id']),
        type: asString(json['type']),
        severity: asString(json['severity'], 'info'),
        title: asString(json['title']),
        body: asStringOrNull(json['body']),
        data: asJson(json['data']) ?? const {},
        createdAt: asDate(json['createdAt']) ?? DateTime.now(),
      );
}

/// The kinds the feed's filter offers, by the type prefix the server matches.
enum FeedFilter {
  all(null),
  alerts('error'),
  health('health'),
  users('user'),
  support('ticket'),
  feedback('feedback'),
  chats('chat');

  const FeedFilter(this.typePrefix);

  final String? typePrefix;

  bool matches(DevEvent event) => typePrefix == null || event.type.startsWith(typePrefix!);
}
