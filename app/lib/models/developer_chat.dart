import 'json.dart';

/// One message in the reader's chat with the developer.
class DeveloperMessage {
  const DeveloperMessage({
    required this.id,
    required this.fromDeveloper,
    required this.body,
    required this.createdAt,
    this.pending = false,
    this.failed = false,
  });

  final String id;
  final bool fromDeveloper;
  final String body;
  final DateTime createdAt;

  /// Written on this phone and not yet confirmed by the server.
  final bool pending;
  final bool failed;

  DeveloperMessage copyWith({bool? pending, bool? failed}) => DeveloperMessage(
        id: id,
        fromDeveloper: fromDeveloper,
        body: body,
        createdAt: createdAt,
        pending: pending ?? this.pending,
        failed: failed ?? this.failed,
      );

  factory DeveloperMessage.fromJson(Json json) => DeveloperMessage(
        id: asString(json['id']),
        fromDeveloper: asBool(json['fromDeveloper']),
        body: asString(json['body']),
        createdAt: asDate(json['createdAt']) ?? DateTime.now(),
      );
}

/// A page of the conversation, oldest first.
class DeveloperThread {
  const DeveloperThread({this.messages = const [], this.hasMore = false, this.loadingOlder = false});

  final List<DeveloperMessage> messages;
  final bool hasMore;
  final bool loadingOlder;

  DeveloperThread copyWith({List<DeveloperMessage>? messages, bool? hasMore, bool? loadingOlder}) => DeveloperThread(
        messages: messages ?? this.messages,
        hasMore: hasMore ?? this.hasMore,
        loadingOlder: loadingOlder ?? this.loadingOlder,
      );

  factory DeveloperThread.fromJson(Json json) => DeveloperThread(
        messages: asList(json['messages'], DeveloperMessage.fromJson),
        hasMore: asBool(json['hasMore']),
      );
}
