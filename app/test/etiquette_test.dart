import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:hariharibol/core/theme/app_theme.dart';
import 'package:hariharibol/l10n/generated/app_localizations.dart';
import 'package:hariharibol/l10n/generated/app_localizations_en.dart';
import 'package:hariharibol/models/etiquette.dart';
import 'package:hariharibol/services/push_link.dart';
import 'package:hariharibol/widgets/etiquette/etiquette_category_label.dart';
import 'package:hariharibol/widgets/etiquette/etiquette_source_card.dart';

void main() {
  group('Etiquette', () {
    test('reads an item in full', () {
      final item = Etiquette.fromJson({
        'id': 'e1',
        'slug': 'offer-prasada',
        'category': 'prasad',
        'title': 'Offer first',
        'summary': 'Offer food to the Lord before eating it.',
        'body': 'First paragraph.\n\nSecond paragraph.',
        'language': 'hi',
        'reference': 'Bhagavad-gītā 9.26',
        'author': 'Śrī Kṛṣṇa',
        'sourceName': 'Vedabase',
        'sourceUrl': 'https://vedabase.io/en/library/bg/9/26/',
      });
      expect(item.id, 'e1');
      expect(item.category, EtiquetteCategory.prasad);
      expect(item.language, 'hi');
      expect(item.reference, 'Bhagavad-gītā 9.26');
      expect(item.author, 'Śrī Kṛṣṇa');
      expect(item.sourceUrl, 'https://vedabase.io/en/library/bg/9/26/');
      expect(item.hasBody, isTrue);
    });

    test('a list row has no body, reference or author and is in English unless told otherwise', () {
      final item = Etiquette.fromJson({
        'id': 'e2',
        'slug': 'remove-shoes',
        'category': 'temple',
        'title': 'Leave shoes outside',
        'summary': 'Shoes stay at the door.',
      });
      expect(item.hasBody, isFalse);
      expect(item.reference, isNull);
      expect(item.author, isNull);
      expect(item.sourceName, isNull);
      expect(item.language, 'en');
    });

    test('a list keeps its categories and items in order', () {
      final list = EtiquetteList.fromJson({
        'categories': [
          {'id': 'temple', 'name': 'In the temple', 'count': 12},
          {'id': 'prasad', 'name': 'Prasāda and food', 'count': 7},
        ],
        'items': [
          {'id': 'a', 'slug': 'a', 'category': 'temple', 'title': 'A', 'summary': 'S'},
          {'id': 'b', 'slug': 'b', 'category': 'prasad', 'title': 'B', 'summary': 'S'},
        ],
      });
      expect(list.categories.map((c) => c.id), ['temple', 'prasad']);
      expect(list.categories.first.count, 12);
      expect(list.items.map((i) => i.id), ['a', 'b']);
    });

    test('an empty answer is an empty list', () {
      final list = EtiquetteList.fromJson({});
      expect(list.categories, isEmpty);
      expect(list.items, isEmpty);
    });

    test('today may have no item', () {
      final today = EtiquetteToday.fromJson({'date': '2026-10-23', 'item': null});
      expect(today.date, '2026-10-23');
      expect(today.item, isNull);
    });

    test('today carries the full item', () {
      final today = EtiquetteToday.fromJson({
        'date': '2026-10-23',
        'item': {'id': 'e1', 'slug': 's', 'category': 'holy-name', 'title': 'T', 'summary': 'S', 'body': 'B'},
      });
      expect(today.item?.id, 'e1');
      expect(today.item?.hasBody, isTrue);
    });
  });

  group('EtiquetteSourceCard', () {
    Widget card(Etiquette item) => MaterialApp(
      theme: AppTheme.light,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: Scaffold(body: EtiquetteSourceCard(item: item)),
    );

    const base = Etiquette(
      id: 'e1',
      slug: 's',
      category: EtiquetteCategory.prasad,
      title: 'T',
      summary: 'S',
    );

    testWidgets('says who it is by, then the verse, then the page', (tester) async {
      await tester.pumpWidget(
        card(
          const Etiquette(
            id: 'e1',
            slug: 's',
            category: EtiquetteCategory.prasad,
            title: 'T',
            summary: 'S',
            reference: 'Bhagavad-gītā 9.26',
            author: 'Śrī Kṛṣṇa',
            sourceName: 'Vedabase',
            sourceUrl: 'https://vedabase.io/en/library/bg/9/26/',
          ),
        ),
      );
      final text = AppLocalizationsEn();
      expect(find.text(text.etiquetteAuthorLabel.toUpperCase()), findsOneWidget);
      expect(find.text('Śrī Kṛṣṇa'), findsOneWidget);
      expect(find.text('Bhagavad-gītā 9.26'), findsOneWidget);
      expect(find.text('https://vedabase.io/en/library/bg/9/26/'), findsOneWidget);
      final author = tester.getTopLeft(find.text('Śrī Kṛṣṇa')).dy;
      final reference = tester.getTopLeft(find.text('Bhagavad-gītā 9.26')).dy;
      expect(author, lessThan(reference), reason: 'the author is the first line of the card');
    });

    testWidgets('an author alone is still shown', (tester) async {
      await tester.pumpWidget(
        card(
          const Etiquette(
            id: 'e1',
            slug: 's',
            category: EtiquetteCategory.temple,
            title: 'T',
            summary: 'S',
            author: 'Hindu Temple of Atlanta',
          ),
        ),
      );
      expect(find.text('Hindu Temple of Atlanta'), findsOneWidget);
    });

    testWidgets('an item that cites nothing draws nothing', (tester) async {
      await tester.pumpWidget(card(base));
      expect(find.byType(Card), findsNothing);
    });
  });

  group('the etiquette push', () {
    test('opens the item it names', () {
      final route = pushRoute({
        'deeplink': 'hariharibol://etiquette/e1',
        'etiquetteId': 'e1',
        'category': 'temple',
      });
      expect(route, '/etiquette/e1');
    });

    test('with no item opens the list', () {
      expect(pushRoute({'deeplink': 'hariharibol://etiquette'}), '/etiquette');
    });
  });

  group('etiquetteCategoryLabel', () {
    final text = AppLocalizationsEn();

    test('words every category the server files under', () {
      const ids = [
        EtiquetteCategory.temple,
        EtiquetteCategory.deity,
        EtiquetteCategory.prasad,
        EtiquetteCategory.holyName,
        EtiquetteCategory.guruVaishnava,
        EtiquetteCategory.speechMind,
        EtiquetteCategory.dailyLife,
        EtiquetteCategory.scripture,
        EtiquetteCategory.holyPlaces,
      ];
      final labels = [for (final id in ids) etiquetteCategoryLabel(text, id)];
      expect(labels.toSet().length, ids.length, reason: 'no two categories share a label');
      expect(etiquetteCategoryLabel(text, EtiquetteCategory.holyName), 'The holy name');
    });

    test('a category the app has no words for keeps the name the server sent', () {
      expect(etiquetteCategoryLabel(text, 'festivals', fallback: 'Festivals'), 'Festivals');
    });

    test('with no name either it title-cases the id', () {
      expect(etiquetteCategoryLabel(text, 'sacred-trees'), 'Sacred Trees');
    });
  });
}
