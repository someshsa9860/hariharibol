import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/models/support.dart';
import 'package:hariharibol/services/push_link.dart';
import 'package:hariharibol/widgets/support/support_labels.dart';

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

  group('translation requests', () {
    test('a translation ticket names the book and the reading language', () {
      final ticket = SupportTicket.fromJson({
        'id': 't4',
        'kind': 'TICKET',
        'category': 'translation',
        'status': 'OPEN',
        'details': {
          'bookSlug': 'bhagavad-gita',
          'languageCode': 'mr',
          'bookTitle': 'Bhagavad-gita',
          'languageName': 'मराठी',
        },
      });
      expect(ticket.category, 'translation');
      expect(ticket.details?.bookSlug, 'bhagavad-gita');
      expect(ticket.details?.languageCode, 'mr');
      expect(ticket.details?.languageName, 'मराठी');
    });

    test('an ordinary ticket has no details', () {
      expect(SupportTicket.fromJson({'id': 't5', 'category': 'bug'}).details, isNull);
    });
  });

  group('topic words', () {
    final text = lookupAppLocalizations(const Locale('en'));

    test('the new topics have their own words', () {
      expect(supportCategoryLabel(text, 'feature'), 'A new feature');
      expect(supportCategoryLabel(text, 'translation'), 'Translate a book into another language');
    });

    test('a topic the app does not know reads as something else', () {
      expect(supportCategoryLabel(text, 'from-a-newer-server'), text.supportCategoryOther);
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
