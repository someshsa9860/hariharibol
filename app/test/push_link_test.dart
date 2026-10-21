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

  group('deeplinks from the admin panel', () {
    test('Ask Sakha opens the chat, whatever the route is called inside', () {
      expect(pushRoute({'deeplink': 'hariharibol://sakha'}), '/chat');
      expect(pushRoute({'deeplink': 'hariharibol://jap'}), '/sadhana');
      expect(pushRoute({'deeplink': 'hariharibol://read'}), '/library');
      expect(pushRoute({'deeplink': 'hariharibol://reels'}), '/reels');
    });

    test('a mantra, a reel and a verse carry what they need in the query', () {
      expect(deeplinkRoute('hariharibol://mantra?slug=maha-mantra'), '/mantras/maha-mantra');
      expect(deeplinkRoute('hariharibol://reel?id=r1'), '/reels/r1');
      expect(deeplinkRoute('hariharibol://verse?book=bhagavad-gita&chapter=2&verse=47'),
          '/library/bhagavad-gita/chapters/2?verse=47');
    });

    test('a link missing what it needs, or from another scheme, opens nowhere', () {
      expect(deeplinkRoute('hariharibol://mantra'), isNull);
      expect(deeplinkRoute('hariharibol://verse?book=gita'), isNull);
      expect(deeplinkRoute('https://hariharibol.com/sakha'), isNull);
      expect(deeplinkRoute(null), isNull);
    });
  });

  group('buttons', () {
    const actions = '[{"id":"a1","label":"Ask Sakha","deeplink":"hariharibol://sakha"},'
        '{"id":"a2","label":"Read","deeplink":"hariharibol://read"},'
        '{"id":"a3","label":"Third","deeplink":"hariharibol://reels"}]';

    test('at most two are read, and a broken list gives none', () {
      expect(pushActions({'actions': actions}).map((a) => a.label), ['Ask Sakha', 'Read']);
      expect(pushActions({'actions': 'not json'}), isEmpty);
      expect(pushActions({}), isEmpty);
    });

    test('a button leads to its own link, not the push\'s', () {
      final data = {'deeplink': 'hariharibol://calendar', 'actions': actions};
      expect(pushActionRoute(data, 'a1'), '/chat');
      expect(pushActionRoute(data, 'a2'), '/library');
      expect(pushActionRoute(data, 'zzz'), isNull);
    });

    test('pressing a button opens its screen once the app is ready', () {
      final opened = <String>[];
      final links = PushLinks.withOpener(opened.add)..setReady(true);
      links.tapped({'deeplink': 'hariharibol://calendar', 'actions': actions}, actionId: 'a1');
      expect(opened, ['/chat']);
    });
  });
}
