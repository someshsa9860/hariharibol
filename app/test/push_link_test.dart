import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/services/push_link.dart';

void main() {
  group('pushRoute', () {
    test('the daily sloka opens its chapter, scrolled to its verse', () {
      // Every value in a push arrives as a string.
      final route = pushRoute({
        'type': 'SLOKA',
        'deeplink': 'hariharibol://sloka/1.2.47',
        'verseId': '1.2.47',
        'bookSlug': 'bhagavad-gita',
        'cantoNumber': '',
        'chapterNumber': '2',
        'verseNumber': '47',
      });
      expect(route, '/library/bhagavad-gita/chapters/2?verse=47');
    });

    test('a Bhagavatam verse keeps its canto', () {
      final route = pushRoute({
        'bookSlug': 'srimad-bhagavatam',
        'cantoNumber': '10',
        'chapterNumber': '1',
        'verseNumber': '5',
      });
      expect(route, '/library/srimad-bhagavatam/chapters/1?canto=10&verse=5');
    });

    test('a book with no chapter opens on its own page', () {
      expect(pushRoute({'bookSlug': 'hanuman-chalisa', 'chapterNumber': ''}), '/library/hanuman-chalisa');
    });

    test('a deeplink to a screen opens that screen', () {
      expect(pushRoute({'deeplink': 'hariharibol://sadhana'}), '/sadhana');
      expect(pushRoute({'deeplink': 'hariharibol://premium'}), '/plans');
    });

    test('a sloka push from before the verse carried its place opens nowhere in particular', () {
      expect(pushRoute({'deeplink': 'hariharibol://sloka/1.2.47', 'verseId': '1.2.47'}), isNull);
    });

    test('a notification that names nowhere, or somewhere foreign, opens nothing', () {
      expect(pushRoute({}), isNull);
      expect(pushRoute({'deeplink': ''}), isNull);
      expect(pushRoute({'deeplink': 'https://example.com/sadhana'}), isNull);
    });
  });

  group('PushLinks', () {
    const sloka = {'bookSlug': 'bhagavad-gita', 'chapterNumber': '2', 'verseNumber': '47'};

    test('a tap before the dashboard is up waits for it', () {
      final opened = <String>[];
      final links = PushLinks.withOpener(opened.add);

      links.tapped(sloka);
      expect(opened, isEmpty);

      links.setReady(true);
      expect(opened, ['/library/bhagavad-gita/chapters/2?verse=47']);
    });

    test('a tap while the dashboard is up opens at once, and only once', () {
      final opened = <String>[];
      final links = PushLinks.withOpener(opened.add)..setReady(true);

      links.tapped(sloka);
      expect(opened, hasLength(1));

      links.setReady(false);
      links.setReady(true);
      expect(opened, hasLength(1));
    });

    test('of two taps before it is up, the later one wins', () {
      final opened = <String>[];
      final links = PushLinks.withOpener(opened.add);

      links.tapped(sloka);
      links.tapped({'deeplink': 'hariharibol://sadhana'});
      links.setReady(true);

      expect(opened, ['/sadhana']);
    });

    test('a notification that names nowhere is ignored', () {
      final opened = <String>[];
      final links = PushLinks.withOpener(opened.add)..setReady(true);

      links.tapped({'type': 'ANNOUNCEMENT'});
      expect(opened, isEmpty);
    });
  });
}
