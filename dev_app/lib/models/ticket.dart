import 'dev_message.dart';
import 'json.dart';

/// A support ticket or a piece of feedback (the support desk's `SupportTicket`).
class Ticket {
  const Ticket({
    required this.id,
    required this.kind,
    required this.category,
    required this.status,
    required this.subject,
    required this.rating,
    required this.preview,
    required this.awaitingStaff,
    required this.lastMessageAt,
    required this.person,
  });

  final String id;
  final String kind; // TICKET | FEEDBACK
  final String category;
  final String status; // OPEN | IN_PROGRESS | RESOLVED
  final String? subject;
  final int? rating;
  final String? preview;
  final bool awaitingStaff;
  final DateTime lastMessageAt;
  final ChatPerson person;

  bool get isFeedback => kind == 'FEEDBACK';
  bool get isResolved => status == 'RESOLVED';

  factory Ticket.fromJson(Json json) => Ticket(
        id: asString(json['id']),
        kind: asString(json['kind'], 'TICKET'),
        category: asString(json['category']),
        status: asString(json['status'], 'OPEN'),
        subject: asStringOrNull(json['subject']),
        rating: asIntOrNull(json['rating']),
        preview: asStringOrNull(json['preview']),
        awaitingStaff: asBool(json['awaitingStaff']),
        lastMessageAt: asDate(json['lastMessageAt']) ?? DateTime.now(),
        person: ChatPerson.fromJson(asJson(json['user']) ?? const {}),
      );
}

class TicketMessage {
  const TicketMessage({required this.id, required this.fromStaff, required this.body, required this.createdAt});

  final String id;
  final bool fromStaff;
  final String body;
  final DateTime createdAt;

  factory TicketMessage.fromJson(Json json) => TicketMessage(
        id: asString(json['id']),
        fromStaff: asBool(json['fromStaff']),
        body: asString(json['body']),
        createdAt: asDate(json['createdAt']) ?? DateTime.now(),
      );
}

class TicketDetail {
  const TicketDetail({required this.ticket, required this.messages, required this.screenshotUrl});

  final Ticket ticket;
  final List<TicketMessage> messages;
  final String? screenshotUrl;

  factory TicketDetail.fromJson(Json json) => TicketDetail(
        ticket: Ticket.fromJson(json),
        messages: asList(json['messages'], TicketMessage.fromJson),
        screenshotUrl: asStringOrNull(json['screenshotUrl']),
      );
}
