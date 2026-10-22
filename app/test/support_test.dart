import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/models/support.dart';
import 'package:hariharibol/services/push_link.dart';

void main() {
  group('SupportTicket.fromJson', () {
    test('reads a ticket with its conversation', () {
      final ticket = SupportTicket.fromJson({
        'id': 't1',
        'kind': 'TICKET',
        'category': 'bug',
        'status': 'IN_PROGRESS',
        'userUnread': true,
        'lastMessageAt': '2026-10-22T02:00:00.000Z',
        'messages': [
          {'id': 'm1', 'fromStaff': false, 'body': 'It crashes', 'createdAt': '2026-10-22T01:00:00.000Z'},
          {'id': 'm2', 'fromStaff': true, 'body': 'Looking into it', 'createdAt': '2026-10-22T02:00:00.000Z'},
        ],
      });
      expect(ticket.status, SupportStatus.inProgress);
      expect(ticket.hasUnreadReply, isTrue);
      expect(ticket.preview, 'It crashes');
      expect(ticket.messages.last.fromStaff, isTrue);
    });

    test('the list row shows the first line the server sent', () {
      final ticket = SupportTicket.fromJson({'id': 't2', 'kind': 'FEEDBACK', 'rating': 4, 'status': 'OPEN', 'preview': 'Lovely app'});
      expect(ticket.isFeedback, isTrue);
      expect(ticket.rating, 4);
      expect(ticket.preview, 'Lovely app');
    });

    test('an unknown status reads as open', () {
      expect(SupportTicket.fromJson({'id': 't3', 'status': 'SOMETHING_NEW'}).status, SupportStatus.open);
    });
  });

  group('support deep links', () {
    test('support opens the help screen', () {
      expect(deeplinkRoute('hariharibol://support'), '/support');
    });

    test('ticket opens one conversation, and needs its id', () {
      expect(deeplinkRoute('hariharibol://ticket?id=abc'), '/support/abc');
      expect(deeplinkRoute('hariharibol://ticket'), isNull);
    });
  });
}
