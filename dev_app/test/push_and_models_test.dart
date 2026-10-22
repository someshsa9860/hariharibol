import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:hariharibol_dev/core/format/time_format.dart';
import 'package:hariharibol_dev/l10n/generated/app_localizations_en.dart';
import 'package:hariharibol_dev/models/dev_event.dart';
import 'package:hariharibol_dev/models/dev_message.dart';
import 'package:hariharibol_dev/models/ticket.dart';
import 'package:hariharibol_dev/services/push_service.dart';

void main() {
  setUpAll(() => initializeDateFormatting('en'));

  group('a tapped push', () {
    test('opens the conversation it names', () {
      expect(PushService.routeFor({'deeplink': 'chat/abc123'}), '/chats/abc123');
    });

    test('opens the ticket it names', () {
      expect(PushService.routeFor({'deeplink': 'ticket/t9'}), '/tickets/t9');
    });

    test('a digest or an alert opens the live feed', () {
      expect(PushService.routeFor({'deeplink': 'feed'}), '/live');
    });

    test('a missing or empty link leads nowhere', () {
      expect(PushService.routeFor({}), isNull);
      expect(PushService.routeFor({'deeplink': 'chat/'}), isNull);
      expect(PushService.routeFor({'deeplink': 'somewhere/else'}), isNull);
    });
  });

  group('events', () {
    final event = DevEvent.fromJson({
      'id': 'e1',
      'type': 'chat.message',
      'severity': 'info',
      'title': 'Asha',
      'body': 'Hello',
      'data': {'conversationId': 'c1', 'userId': 'u1'},
      'createdAt': '2026-10-22T02:46:11.000Z',
    });

    test('carry the conversation they are about', () {
      expect(event.conversationId, 'c1');
      expect(event.ticketId, isNull);
    });

    test('are matched by the feed filters on their type prefix', () {
      expect(FeedFilter.chats.matches(event), isTrue);
      expect(FeedFilter.alerts.matches(event), isFalse);
      expect(FeedFilter.all.matches(event), isTrue);
    });

    test('survive missing fields', () {
      final bare = DevEvent.fromJson({'id': 'x'});
      expect(bare.severity, 'info');
      expect(bare.data, isEmpty);
      expect(bare.isCritical, isFalse);
    });
  });

  group('conversations and tickets', () {
    test('read the unread count the server calls devUnread', () {
      final conversation = DevConversation.fromJson({
        'id': 'c1',
        'user': {'id': 'u1', 'name': null, 'email': 'asha@example.com'},
        'lastMessageAt': '2026-10-22T02:46:11.000Z',
        'lastMessagePreview': 'Hi',
        'devUnread': 3,
      });
      expect(conversation.unread, 3);
      expect(conversation.person.displayName, 'asha@example.com');
      expect(conversation.person.initial, 'A');
    });

    test('a ticket list row knows whether the reader is waiting', () {
      final ticket = Ticket.fromJson({
        'id': 't1',
        'kind': 'FEEDBACK',
        'category': 'GENERAL',
        'status': 'OPEN',
        'rating': 2,
        'awaitingStaff': true,
        'lastMessageAt': '2026-10-22T02:46:11.000Z',
        'user': {'id': 'u1', 'name': 'Asha', 'email': 'asha@example.com'},
      });
      expect(ticket.isFeedback, isTrue);
      expect(ticket.awaitingStaff, isTrue);
      expect(ticket.rating, 2);
    });
  });

  group('when something happened', () {
    final text = AppLocalizationsEn();
    final now = DateTime(2026, 10, 22, 14, 30);

    test('moments ago', () {
      expect(whenText(text, 'en', now.subtract(const Duration(seconds: 10)), now: now), 'Just now');
    });

    test('earlier today is a clock time', () {
      expect(whenText(text, 'en', DateTime(2026, 10, 22, 9, 5), now: now), '09:05');
    });

    test('yesterday and older', () {
      expect(whenText(text, 'en', DateTime(2026, 10, 21, 23, 0), now: now), 'Yesterday');
      expect(whenText(text, 'en', DateTime(2026, 10, 3, 8, 0), now: now), 'Oct 3');
      expect(whenText(text, 'en', DateTime(2025, 10, 3, 8, 0), now: now), 'Oct 3, 2025');
    });
  });
}
