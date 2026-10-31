import 'json.dart';

enum SupportStatus { open, inProgress, resolved }

SupportStatus _status(String wire) => switch (wire) {
      'IN_PROGRESS' => SupportStatus.inProgress,
      'RESOLVED' => SupportStatus.resolved,
      _ => SupportStatus.open,
    };

/// One message in a ticket's conversation.
class SupportMessage {
  const SupportMessage({required this.id, required this.fromStaff, required this.body, required this.createdAt});

  final String id;
  final bool fromStaff;
  final String body;
  final DateTime? createdAt;

  factory SupportMessage.fromJson(Json json) => SupportMessage(
        id: asString(json['id']),
        fromStaff: asBool(json['fromStaff']),
        body: asString(json['body']),
        createdAt: asDate(json['createdAt']),
      );
}

/// What a translation request asks for: a book in the library, and the reading language to put it in.
class SupportTranslation {
  const SupportTranslation({
    required this.bookSlug,
    required this.languageCode,
    required this.bookTitle,
    required this.languageName,
  });

  final String bookSlug;
  final String languageCode;
  final String bookTitle;
  final String languageName;

  factory SupportTranslation.fromJson(Json json) => SupportTranslation(
        bookSlug: asString(json['bookSlug']),
        languageCode: asString(json['languageCode']),
        bookTitle: asString(json['bookTitle']),
        languageName: asString(json['languageName']),
      );
}

SupportTranslation? _translation(dynamic wire) {
  final json = asJson(wire);
  return json == null ? null : SupportTranslation.fromJson(json);
}

/// A ticket or a piece of feedback the reader sent.
class SupportTicket {
  const SupportTicket({
    required this.id,
    required this.isFeedback,
    required this.category,
    required this.status,
    required this.subject,
    required this.rating,
    required this.hasUnreadReply,
    required this.lastMessageAt,
    this.screenshotUrl,
    this.firstLine,
    this.messages = const [],
    this.details,
  });

  final String id;
  final bool isFeedback;
  final String category;
  final SupportStatus status;
  final String? subject;
  final int? rating;
  final bool hasUnreadReply;
  final DateTime? lastMessageAt;
  final String? screenshotUrl;
  final String? firstLine;
  final List<SupportMessage> messages;

  /// Set on a translation request: the book and the reading language it names.
  final SupportTranslation? details;

  /// The first line of what the reader wrote, for the list.
  String get preview => subject ?? firstLine ?? (messages.isEmpty ? '' : messages.first.body);

  factory SupportTicket.fromJson(Json json) => SupportTicket(
        id: asString(json['id']),
        isFeedback: asString(json['kind']) == 'FEEDBACK',
        category: asString(json['category']),
        status: _status(asString(json['status'])),
        subject: asStringOrNull(json['subject']),
        rating: asIntOrNull(json['rating']),
        hasUnreadReply: asBool(json['userUnread']),
        lastMessageAt: asDate(json['lastMessageAt']),
        screenshotUrl: asStringOrNull(json['screenshotUrl']),
        firstLine: asStringOrNull(json['preview']),
        messages: asList(json['messages'], SupportMessage.fromJson),
        details: _translation(json['details']),
      );
}
